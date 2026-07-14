import { randomUUID } from "node:crypto";
import { access, lstat, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";

import * as z from "zod/v4";

import type { ToolDefinition } from "../tool-types.js";
import {
  isCanonicalFullGitHash,
  qualityShippingFingerprint,
  qualityShippingGitEnvironment,
  qualityShippingProcessRunner,
  qualityShippingSha256,
  tryAcquireQualityShippingOperationLock,
  type QualityShippingProcessResult,
  type QualityShippingProcessRunner
} from "../quality-shipping-safety.js";
import { blueprintArtifactReportWrite } from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";

const REPORT_NAME = "pr-branch-latest";
const REPORT_PATH = ".blueprint/reports/pr-branch-latest.md";
const APPROVAL_TTL_MS = 10 * 60 * 1_000;
const TERMINAL_TTL_MS = 5 * 60 * 1_000;
const MAX_APPROVALS = 128;

const previewInputSchema = {
  cwd: z.string().optional(),
  baseRef: z.string().min(1),
  reviewBranch: z.string().min(1),
  blueprintPolicy: z.enum(["exclude", "include"]),
  evidencePaths: z.array(z.string()).min(1),
  overwriteReport: z.boolean().optional(),
  stayOnReviewBranch: z.boolean().optional()
};

const executeInputSchema = {
  operationId: z.string().uuid(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  confirmed: z.literal(true)
};

const persistInputSchema = {
  operationId: z.string().uuid(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/)
};

export type PrBranchPreviewArgs = {
  cwd?: string;
  baseRef: string;
  reviewBranch: string;
  blueprintPolicy: "exclude" | "include";
  evidencePaths: string[];
  overwriteReport?: boolean;
  stayOnReviewBranch?: boolean;
};

type PathChange = {
  status: string;
  paths: string[];
};

export type PrBranchCommit = {
  sourceCommit: string;
  parents: string[];
  tree: string;
  subject: string;
  author: string;
  message: string;
  filteredDeltaSha256: string;
  classification: "code-only" | "blueprint-only" | "mixed";
  action: "include" | "exclude";
  pathChanges: PathChange[];
  includedPaths: string[];
  excludedPaths: string[];
};

type EvidenceReceipt = { path: string; contentSha256: string | null };

export type PrBranchApprovalPacket = {
  schemaVersion: 1;
  operation: "pr-branch";
  repoRoot: string;
  gitCommonDir: string;
  sourceBranch: string;
  sourceHead: string;
  baseRef: string;
  baseOid: string;
  mergeBase: string;
  reviewBranch: string;
  reviewRefDisposition: "absent";
  blueprintPolicy: "exclude" | "include";
  stayOnReviewBranch: boolean;
  gitConfigSha256: string;
  blueprintConfig: {
    sha256: string;
    gitBaseBranch: string | null;
    gitBranchingStrategy: string;
    planningCommitDocs: boolean;
    layersApplied: string[];
    defaultsPath: string | null;
    projectPath: string | null;
    sourcePath: string | null;
  };
  workingTreeFingerprint: string;
  inProgressState: string[];
  commits: PrBranchCommit[];
  includedPaths: string[];
  excludedPaths: string[];
  expectedRetainedTree: Array<{ path: string; entry: string | null }>;
  evidence: EvidenceReceipt[];
  report: {
    path: typeof REPORT_PATH;
    overwriteApproved: boolean;
    priorExists: boolean;
    priorContentSha256: string | null;
    preMutationContentSha256: string;
  };
  executionPlan: Array<{ stage: string; argv: string[] }>;
};

type ProcessReceipt = {
  stage: string;
  argv: string[];
  result: QualityShippingProcessResult;
};

type Mapping = {
  sourceCommit: string;
  reviewCommit: string | null;
  outcome: "replayed" | "excluded" | "empty-after-filter" | "failed" | "not-attempted";
  observedSubject?: string | null;
  verification?: "verified" | "not-applicable" | "not-attempted" | "mismatch" | "unknown";
};

export type PrBranchExecutionResult = {
  status: "blocked" | "stale" | "succeeded" | "partial" | "failed" | "outcome-unknown";
  stage: "approval" | "revalidate" | "pre-report" | "create-branch" | "replay" | "validate" | "restore-source" | "outcome-report" | "persistence-recovery";
  operationId: string;
  fingerprint: string;
  mutationStarted: boolean;
  source: { branch: string; beforeOid: string; afterOid: string | null; preserved: boolean; restored: boolean };
  review: { branch: string; oid: string | null; disposition: "absent" | "created" | "partial" | "complete" };
  mapping: Mapping[];
  processes: ProcessReceipt[];
  validation: {
    clean: boolean | null;
    finalClean: boolean | null;
    retainedPaths: string[];
    excludedPathsFound: string[];
    retainedCommitCount: number | null;
    currentBranch: string | null;
    currentHead: string | null;
  };
  report: {
    path: typeof REPORT_PATH;
    preMutationStatus: "not-attempted" | "created" | "updated" | "reused" | "failed";
    outcomeStatus: "not-attempted" | "created" | "updated" | "reused" | "failed";
    error: string | null;
  };
  blockers: string[];
  warnings: string[];
  recoveryActions: string[];
};

type PreviewResult = {
  status: "ready" | "blocked" | "already-complete" | "partial" | "divergent" | "invalid";
  operationId: string | null;
  fingerprint: string | null;
  packet: PrBranchApprovalPacket | null;
  waitingState: "review-branch-confirmation" | "report-overwrite-confirmation" | null;
  blockers: string[];
  warnings: string[];
};

type ReportWriteResult = Awaited<ReturnType<typeof blueprintArtifactReportWrite>>;
type ReportWriter = (args: {
  cwd?: string;
  reportName: string;
  content?: string;
  overwrite?: boolean;
  expectedExistingContentSha256?: string | null;
}) => Promise<ReportWriteResult>;

type StoredApproval = {
  packet: PrBranchApprovalPacket;
  fingerprint: string;
  preMutationReportContent: string;
  consumed: boolean;
  createdAt: number;
  expiresAt: number;
  terminalExpiresAt: number | null;
  lastResult: PrBranchExecutionResult | null;
  outcomeReportContent: string | null;
  expectedReportContentSha256: string | null;
};

type Snapshot = {
  repoRoot: string;
  gitCommonDir: string;
  branch: string | null;
  head: string | null;
  status: string;
  gitConfigSha256: string;
  inProgressState: string[];
};

const approvals = new Map<string, StoredApproval>();
let processRunner: QualityShippingProcessRunner = qualityShippingProcessRunner;
let reportWriter: ReportWriter = blueprintArtifactReportWrite;
let effectiveConfigReader: (args: { cwd?: string; scope: "effective" }) => ReturnType<typeof blueprintConfigGet> = blueprintConfigGet;
let nowProvider = () => Date.now();
let approvalTtlMs = APPROVAL_TTL_MS;
let terminalTtlMs = TERMINAL_TTL_MS;
let maxApprovals = MAX_APPROVALS;

export const prBranchToolTestHooks = {
  setProcessRunnerForTest(runner: QualityShippingProcessRunner): () => void {
    const previous = processRunner;
    processRunner = runner;
    return () => { processRunner = previous; };
  },
  setReportWriterForTest(writer: ReportWriter): () => void {
    const previous = reportWriter;
    reportWriter = writer;
    return () => { reportWriter = previous; };
  },
  setEffectiveConfigReaderForTest(reader: typeof effectiveConfigReader): () => void {
    const previous = effectiveConfigReader;
    effectiveConfigReader = reader;
    return () => { effectiveConfigReader = previous; };
  },
  clearApprovalsForTest(): void { approvals.clear(); },
  mutateApprovalForTest(
    operationId: string,
    mutate: (packet: PrBranchApprovalPacket) => void,
    rebindStoredFingerprint = false
  ): string | null {
    const stored = approvals.get(operationId);
    if (!stored) return null;
    mutate(stored.packet);
    if (rebindStoredFingerprint) stored.fingerprint = prBranchApprovalFingerprint(stored.packet);
    return stored.fingerprint;
  },
  setRetentionForTest(args: { now?: () => number; approvalTtlMs?: number; terminalTtlMs?: number; maxApprovals?: number }): () => void {
    const previous = { nowProvider, approvalTtlMs, terminalTtlMs, maxApprovals };
    if (args.now) nowProvider = args.now;
    if (args.approvalTtlMs !== undefined) approvalTtlMs = args.approvalTtlMs;
    if (args.terminalTtlMs !== undefined) terminalTtlMs = args.terminalTtlMs;
    if (args.maxApprovals !== undefined) maxApprovals = args.maxApprovals;
    return () => {
      nowProvider = previous.nowProvider;
      approvalTtlMs = previous.approvalTtlMs;
      terminalTtlMs = previous.terminalTtlMs;
      maxApprovals = previous.maxApprovals;
    };
  }
};

function env(): NodeJS.ProcessEnv {
  return qualityShippingGitEnvironment();
}

async function git(cwd: string, argv: readonly string[]): Promise<QualityShippingProcessResult> {
  return processRunner("git", argv, cwd, env());
}

function succeeded(result: QualityShippingProcessResult): boolean {
  return result.exitCode === 0 && result.signal === null && !result.timedOut;
}

async function localBranchDisposition(repoRoot: string, branch: string): Promise<"exists" | "absent"> {
  const result = await git(repoRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  if (succeeded(result)) return "exists";
  if (result.exitCode === 1 && result.signal === null && !result.timedOut) return "absent";
  throw new Error(`Local branch inspection failed for ${branch}: exit=${result.exitCode ?? "null"}, signal=${result.signal ?? "none"}, timedOut=${result.timedOut}.`);
}

async function gitText(cwd: string, argv: readonly string[], label: string): Promise<string> {
  const result = await git(cwd, argv);
  if (!succeeded(result)) throw new Error(`${label} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
}

function isBlueprintPath(value: string): boolean {
  return value === ".blueprint" || value.startsWith(".blueprint/");
}

function rejectUnsafeRefInput(value: string, label: string): void {
  if (!value || value.startsWith("-") || value.includes("\0") || /[\r\n]/.test(value)) {
    throw new Error(`${label} is unsafe or ambiguous.`);
  }
}

async function inProgressState(commonDir: string): Promise<string[]> {
  const markers = [
    ["merge", "MERGE_HEAD"],
    ["cherry-pick", "CHERRY_PICK_HEAD"],
    ["revert", "REVERT_HEAD"],
    ["rebase-merge", "rebase-merge"],
    ["rebase-apply", "rebase-apply"],
    ["sequencer", "sequencer"],
    ["bisect", "BISECT_LOG"]
  ] as const;
  const found: string[] = [];
  for (const [name, marker] of markers) if (await exists(path.join(commonDir, marker))) found.push(name);
  return found;
}

async function snapshot(cwd: string): Promise<Snapshot> {
  const repoRootRaw = await gitText(cwd, ["rev-parse", "--show-toplevel"], "repository discovery");
  const repoRoot = await realpath(repoRootRaw);
  const commonRaw = await gitText(repoRoot, ["rev-parse", "--git-common-dir"], "git common-dir discovery");
  const gitCommonDir = await realpath(path.resolve(repoRoot, commonRaw));
  const branchResult = await git(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const headResult = await git(repoRoot, ["rev-parse", "--verify", "HEAD"]);
  const statusResult = await git(repoRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const configResult = await git(repoRoot, ["config", "--null", "--list"]);
  if (!succeeded(headResult) || !succeeded(statusResult) || !succeeded(configResult)) {
    throw new Error("Repository HEAD, status, or effective git config could not be inspected.");
  }
  return {
    repoRoot,
    gitCommonDir,
    branch: succeeded(branchResult) ? branchResult.stdout.trim() : null,
    head: headResult.stdout.trim() || null,
    status: statusResult.stdout,
    gitConfigSha256: qualityShippingSha256(configResult.stdout),
    inProgressState: await inProgressState(gitCommonDir)
  };
}

async function resolveCommit(repoRoot: string, ref: string, label: string): Promise<string> {
  rejectUnsafeRefInput(ref, label);
  const result = await git(repoRoot, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]);
  const oid = result.stdout.trim();
  if (!succeeded(result) || !isCanonicalFullGitHash(oid)) throw new Error(`${label} does not resolve to one unambiguous commit.`);
  return oid;
}

function splitNul(value: string): string[] {
  const values = value.split("\0");
  if (values.at(-1) === "") values.pop();
  return values;
}

function parseNameStatus(value: string): PathChange[] {
  const tokens = splitNul(value);
  const changes: PathChange[] = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++] ?? "";
    const count = /^[RC]/.test(status) ? 2 : 1;
    const paths = tokens.slice(index, index + count);
    if (paths.length !== count) throw new Error("git diff-tree returned a truncated NUL-delimited path record.");
    index += count;
    changes.push({ status, paths });
  }
  return changes;
}

type CommitIdentity = { author: string; message: string; subject: string };

function parseCommitIdentity(value: string): CommitIdentity {
  const separator = value.indexOf("\n\n");
  if (separator < 0) throw new Error("Commit object did not contain a header/message separator.");
  const headers = value.slice(0, separator).split("\n");
  const authorLine = headers.find((line) => line.startsWith("author "));
  if (!authorLine) throw new Error("Commit object did not contain author metadata.");
  const message = value.slice(separator + 2);
  return { author: authorLine.slice("author ".length), message, subject: message.split(/\r?\n/, 1)[0] ?? "" };
}

function filteredDeltaArgs(
  parent: string,
  commit: string,
  policy: "exclude" | "include"
): string[] {
  const args = ["diff", "--binary", "--full-index", parent, commit, "--", "."];
  if (policy === "exclude") args.push(":(exclude).blueprint", ":(exclude).blueprint/**");
  return args;
}

async function filteredDeltaSha256(repoRoot: string, parent: string, commit: string, policy: "exclude" | "include"): Promise<string> {
  const result = await git(repoRoot, filteredDeltaArgs(parent, commit, policy));
  if (!succeeded(result)) throw new Error(`Filtered delta inspection failed for ${commit}: ${result.stderr || result.stdout}`);
  return qualityShippingSha256(result.stdout);
}

async function inspectCommit(repoRoot: string, sha: string, policy: "exclude" | "include"): Promise<PrBranchCommit> {
  const metadata = splitNul(await gitText(
    repoRoot,
    ["show", "-s", "--format=%P%x00%T%x00%s%x00", sha],
    `commit metadata ${sha}`
  ));
  const parents = (metadata[0] ?? "").split(" ").filter(Boolean);
  if (parents.length > 1) throw new Error(`Merge commit ${sha} is unsupported by deterministic pr-branch replay.`);
  const parent = parents[0];
  if (!parent) throw new Error(`Root commit ${sha} is unsupported by deterministic pr-branch replay.`);
  const tree = metadata[1] ?? "";
  const identityResult = await git(repoRoot, ["cat-file", "commit", sha]);
  if (!succeeded(identityResult)) throw new Error(`Commit identity inspection failed for ${sha}: ${identityResult.stderr || identityResult.stdout}`);
  const identity = parseCommitIdentity(identityResult.stdout);
  const subject = metadata[2] ?? identity.subject;
  if (!isCanonicalFullGitHash(tree)) throw new Error(`Commit ${sha} did not expose a canonical tree hash.`);
  const diff = await gitText(
    repoRoot,
    ["diff-tree", "--root", "--no-commit-id", "--name-status", "-z", "-r", "-M", sha],
    `commit paths ${sha}`
  );
  const pathChanges = parseNameStatus(`${diff}${diff.endsWith("\0") || !diff ? "" : "\0"}`);
  const allPaths = [...new Set(pathChanges.flatMap((change) => change.paths))].sort();
  const blueprintPaths = allPaths.filter(isBlueprintPath);
  const nonBlueprintPaths = allPaths.filter((entry) => !isBlueprintPath(entry));
  const classification = blueprintPaths.length === 0
    ? "code-only"
    : nonBlueprintPaths.length === 0
      ? "blueprint-only"
      : "mixed";
  const excludedPaths = policy === "exclude" ? blueprintPaths : [];
  const includedPaths = policy === "exclude" ? nonBlueprintPaths : allPaths;
  return {
    sourceCommit: sha,
    parents,
    tree,
    subject,
    author: identity.author,
    message: identity.message,
    filteredDeltaSha256: await filteredDeltaSha256(repoRoot, parent, sha, policy),
    classification,
    action: includedPaths.length === 0 ? "exclude" : "include",
    pathChanges,
    includedPaths,
    excludedPaths
  };
}

async function evidenceReceipts(repoRoot: string, evidencePaths: string[]): Promise<EvidenceReceipt[]> {
  const normalized = [...new Set(evidencePaths.map((value) => value.trim().replaceAll("\\", "/").replace(/^\.\//, "")))].sort();
  const receipts: EvidenceReceipt[] = [];
  for (const relative of normalized) {
    if (!relative || relative.startsWith("-") || path.isAbsolute(relative) || relative.split("/").includes("..")) {
      throw new Error(`Evidence path must be a safe repo-relative canonical path: ${relative}`);
    }
    const absolute = path.resolve(repoRoot, relative);
    const lexicalRelative = path.relative(repoRoot, absolute);
    if (!lexicalRelative || lexicalRelative === ".." || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
      throw new Error(`Evidence path escapes the canonical repository: ${relative}`);
    }
    if (lexicalRelative.replaceAll("\\", "/") !== relative) {
      throw new Error(`Evidence path ${relative} uses a non-canonical repository alias.`);
    }
    try {
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink()) {
        let linkedPath: string;
        try { linkedPath = await realpath(absolute); }
        catch { throw new Error(`Evidence path ${relative} is a broken or unresolvable symlink.`); }
        const linkedRelative = path.relative(repoRoot, linkedPath);
        if (linkedRelative === ".." || linkedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(linkedRelative)) {
          throw new Error(`Evidence path ${relative} resolves outside the canonical repository.`);
        }
        throw new Error(`Evidence path ${relative} is a symlink; evidence inputs must be canonical repository files.`);
      }
      const resolved = await realpath(absolute);
      const resolvedRelative = path.relative(repoRoot, resolved);
      if (resolvedRelative === ".." || resolvedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(resolvedRelative)) {
        throw new Error(`Evidence path ${relative} resolves outside the canonical repository.`);
      }
      const canonical = resolvedRelative.replaceAll("\\", "/");
      if (canonical !== relative) {
        throw new Error(`Evidence path ${relative} uses a symlink or non-canonical repository alias.`);
      }
      receipts.push({ path: canonical, contentSha256: qualityShippingSha256(await readFile(resolved)) });
    }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") receipts.push({ path: relative, contentSha256: null }); else throw error;
    }
  }
  return receipts;
}

async function reportReceipt(repoRoot: string): Promise<{ exists: boolean; sha256: string | null }> {
  try { return { exists: true, sha256: qualityShippingSha256(await readFile(path.join(repoRoot, REPORT_PATH))) }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false, sha256: null }; throw error; }
}

function executionPlan(packet: Omit<PrBranchApprovalPacket, "executionPlan" | "report">): Array<{ stage: string; argv: string[] }> {
  const plan: Array<{ stage: string; argv: string[] }> = [
    { stage: "create-branch", argv: ["switch", "-c", packet.reviewBranch, packet.baseOid] }
  ];
  for (const commit of packet.commits) {
    if (commit.action === "exclude") continue;
    if (packet.blueprintPolicy === "exclude" && commit.classification === "mixed") {
      const parent = commit.parents[0];
      if (!parent) throw new Error(`Mixed root commit ${commit.sourceCommit} is unsupported.`);
      const patchPath = "<runtime-owned-mkdtemp>/replay.patch";
      plan.push(
        { stage: `filter-diff:${commit.sourceCommit}`, argv: ["diff", "--binary", "--full-index", `--output=${patchPath}`, parent, commit.sourceCommit, "--", ".", ":(exclude).blueprint", ":(exclude).blueprint/**"] },
        { stage: `replay:${commit.sourceCommit}`, argv: ["apply", "--index", "--3way", "--", patchPath] },
        { stage: `commit:${commit.sourceCommit}`, argv: ["commit", "--no-verify", "-C", commit.sourceCommit] }
      );
    } else {
      plan.push({ stage: `replay:${commit.sourceCommit}`, argv: ["cherry-pick", commit.sourceCommit] });
    }
  }
  if (!packet.stayOnReviewBranch) plan.push({ stage: "restore-source", argv: ["switch", "--", packet.sourceBranch] });
  return plan;
}

function prBranchApprovalFingerprint(packet: PrBranchApprovalPacket): string {
  return qualityShippingFingerprint({
    ...packet,
    report: { ...packet.report, preMutationContentSha256: "bound-at-write" }
  });
}

function workingFingerprint(value: Pick<Snapshot, "repoRoot" | "gitCommonDir" | "branch" | "head" | "status" | "gitConfigSha256" | "inProgressState">): string {
  return qualityShippingFingerprint(value);
}

async function effectiveBlueprintConfigReceipt(repoRoot: string): Promise<PrBranchApprovalPacket["blueprintConfig"]> {
  const result = await effectiveConfigReader({ cwd: repoRoot, scope: "effective" });
  return {
    sha256: qualityShippingFingerprint(result),
    gitBaseBranch: result.config.git.base_branch,
    gitBranchingStrategy: result.config.git.branching_strategy,
    planningCommitDocs: result.config.planning.commit_docs,
    layersApplied: [...result.provenance.layersApplied],
    defaultsPath: result.provenance.defaultsPath,
    projectPath: result.provenance.projectPath,
    sourcePath: result.sourcePath
  };
}

function parseTreeEntry(stdout: string): string | null {
  if (!stdout) return null;
  const record = splitNul(stdout)[0];
  if (!record) return null;
  const tab = record.indexOf("\t");
  const metadata = tab >= 0 ? record.slice(0, tab) : record;
  const match = metadata.match(/^([0-7]{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})$/);
  if (!match) throw new Error("git ls-tree returned an invalid tree entry.");
  return `${match[1]}:${match[2]}:${match[3]}`;
}

async function treeEntry(repoRoot: string, commit: string, relativePath: string): Promise<string | null> {
  const receipt = await git(repoRoot, ["ls-tree", "-z", commit, "--", relativePath]);
  if (!succeeded(receipt)) throw new Error(`Tree entry inspection failed for ${relativePath}.`);
  return parseTreeEntry(receipt.stdout);
}

function pruneApprovals(): void {
  const now = nowProvider();
  for (const [id, stored] of approvals) {
    const expiry = stored.consumed ? stored.terminalExpiresAt : stored.expiresAt;
    if (expiry !== null && expiry <= now) approvals.delete(id);
  }
  if (approvals.size <= maxApprovals) return;
  const ordered = [...approvals.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  for (const [id] of ordered.slice(0, approvals.size - maxApprovals)) approvals.delete(id);
}

function reportWriteStatus(result: ReportWriteResult): "created" | "updated" | "reused" | "failed" {
  return result.status === "invalid" ? "failed" : result.status;
}

function boundedProcessText(value: string): { text: string; truncated: boolean; length: number; sha256: string } {
  const limit = 8_192;
  return {
    text: value.length <= limit ? value : value.slice(0, limit),
    truncated: value.length > limit,
    length: value.length,
    sha256: qualityShippingSha256(value)
  };
}

function renderedProcessReceipts(result: PrBranchExecutionResult | null): string {
  if (!result) return "- Pre-mutation intent only: no execution process receipts exist yet.";
  if (result.processes.length === 0) return "- No git process was entered for this outcome.";
  return result.processes.map((entry) => `    ${JSON.stringify({
    stage: entry.stage,
    argv: entry.argv,
    exitCode: entry.result.exitCode,
    signal: entry.result.signal,
    timedOut: entry.result.timedOut,
    stdout: boundedProcessText(entry.result.stdout),
    stderr: boundedProcessText(entry.result.stderr)
  })}`).join("\n\n");
}

function tableText(value: string): string {
  return value.replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
}

function renderReport(packet: PrBranchApprovalPacket, fingerprint: string, result: PrBranchExecutionResult | null): string {
  const mappings: Mapping[] = result?.mapping ?? packet.commits.map((commit) => ({
    sourceCommit: commit.sourceCommit,
    reviewCommit: null,
    outcome: commit.action === "exclude" ? "excluded" as const : "failed" as const,
    verification: commit.action === "exclude" ? "not-applicable" as const : "not-attempted" as const
  }));
  const created = result?.review.oid ? `${packet.reviewBranch} (${result.review.oid})` : "not created";
  const currentBranch = result?.validation.currentBranch ?? "not verified";
  const currentHead = result?.validation.currentHead ?? "not verified";
  const commandText = packet.executionPlan.map((entry) => `git ${entry.argv.join(" ")}`).join("; ");
  const ledger = packet.commits.map((commit) => {
    const mapping = mappings.find((entry) => entry.sourceCommit === commit.sourceCommit);
    const classification = mapping?.outcome === "empty-after-filter" ? "empty-after-filter" : commit.classification;
    const verification = mapping?.verification ?? (mapping?.outcome === "failed" ? "unknown" : "not-attempted");
    return `| ${commit.sourceCommit} | ${tableText(commit.subject)} | ${tableText(mapping?.observedSubject ?? "not observed")} | ${classification} | ${mapping?.outcome ?? commit.action} | ${verification} | ${commit.excludedPaths.join(", ") || "none"} |`;
  }).join("\n");
  return `# PR Branch Report\n\n## Source Branch\n\n- Base branch: ${packet.baseRef} (${packet.baseOid})\n- Source branch: ${packet.sourceBranch}\n- Source HEAD: ${packet.sourceHead}\n- Config used: effective Blueprint config sha256=${packet.blueprintConfig.sha256}; git.base_branch=${packet.blueprintConfig.gitBaseBranch}; git.branching_strategy=${packet.blueprintConfig.gitBranchingStrategy}; planning.commit_docs=${packet.blueprintConfig.planningCommitDocs}; effective git config sha256=${packet.gitConfigSha256}; policy=${packet.blueprintPolicy}\n\n## Review Branch\n\n- Candidate branch: ${packet.reviewBranch}\n- Created branch: ${created}\n- Current branch after run: ${currentBranch}\n- Current HEAD after run: ${currentHead}\n- Execution mode: ${result ? "confirmed-replay actual outcome" : "preview-only pre-mutation intent"}\n- Git commands approved: ${commandText}\n- Approval fingerprint: ${fingerprint}\n\n## Filtered Scope\n\n- .blueprint policy: ${packet.blueprintPolicy} because the caller explicitly selected the runtime policy\n- Digest inputs used: ${packet.evidence.map((entry) => `${entry.path}:${entry.contentSha256 ?? "missing"}`).join(", ")}\n- Included paths: ${packet.includedPaths.join(", ") || "none"}\n- Excluded paths: ${packet.excludedPaths.join(", ") || "none"}\n\n| Commit | Approved source subject | Observed review subject | Classification | Outcome | Verification | Filtered paths |\n|---|---|---|---|---|---|---|\n${ledger || "| none | none | not observed | blueprint-only | exclude | not-applicable | none |"}\n\n## Verification\n\n- Clean review branch status: ${result?.validation.clean === true ? "clean" : result?.validation.clean === false ? "dirty" : "not verified"}\n- Clean final checkout status: ${result?.validation.finalClean === true ? "clean" : result?.validation.finalClean === false ? "dirty" : "not verified"}\n- Excluded .blueprint file count in review diff: ${result?.validation.excludedPathsFound.length ?? 0}\n- Total files in review diff: ${result?.validation.retainedPaths.length ?? 0}\n- Review branch commits ahead of base: ${result?.validation.retainedCommitCount ?? 0}\n- Recovery or blocker: ${result ? `blockers=${result.blockers.join("; ") || "none"}; recovery=${result.recoveryActions.join("; ") || "none"}` : "none"}\n\n## Normalized Process Receipts\n\n${renderedProcessReceipts(result)}\n\n## Next Safe Action\n\n- ${result?.status === "succeeded" ? `Inspect ${packet.reviewBranch}, then push it manually when ready.` : result ? "Follow the exact recovery action above; do not delete or overwrite either branch." : "Confirm this exact operation id and fingerprint to create the review branch."}`;
}

function baseResult(packet: PrBranchApprovalPacket, operationId: string, fingerprint: string): PrBranchExecutionResult {
  return {
    status: "blocked", stage: "approval", operationId, fingerprint, mutationStarted: false,
    source: { branch: packet.sourceBranch, beforeOid: packet.sourceHead, afterOid: null, preserved: false, restored: false },
    review: { branch: packet.reviewBranch, oid: null, disposition: "absent" }, mapping: [], processes: [],
    validation: { clean: null, finalClean: null, retainedPaths: [], excludedPathsFound: [], retainedCommitCount: null, currentBranch: null, currentHead: null },
    report: { path: REPORT_PATH, preMutationStatus: "not-attempted", outcomeStatus: "not-attempted", error: null },
    blockers: [], warnings: [], recoveryActions: []
  };
}

async function existingBranchDisposition(
  repoRoot: string,
  reviewBranch: string,
  report: { exists: boolean },
  request: { sourceBranch: string; sourceHead: string; baseOid: string; policy: "exclude" | "include"; evidence: EvidenceReceipt[]; blueprintConfigSha256: string }
): Promise<PreviewResult["status"] | null> {
  if (await localBranchDisposition(repoRoot, reviewBranch) === "absent") return null;
  if (!report.exists) return "divergent";
  const content = await readFile(path.join(repoRoot, REPORT_PATH), "utf8");
  const escaped = reviewBranch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const createdOid = content.match(new RegExp(`^- Created branch: ${escaped} \\(([0-9a-f]{40}|[0-9a-f]{64})\\)$`, "m"))?.[1] ?? null;
  const sourceBranch = content.match(/^- Source branch: (.+)$/m)?.[1] ?? null;
  const sourceHead = content.match(/^- Source HEAD: ([0-9a-f]{40}|[0-9a-f]{64})$/m)?.[1] ?? null;
  const baseOid = content.match(/^- Base branch: .+ \(([0-9a-f]{40}|[0-9a-f]{64})\)$/m)?.[1] ?? null;
  const reviewOid = await currentOid(repoRoot, `refs/heads/${reviewBranch}`);
  const actualSourceOid = sourceBranch && sourceHead ? await currentOid(repoRoot, `refs/heads/${sourceBranch}`) : null;
  const excluded = await git(repoRoot, ["diff", "--name-only", "-z", `${baseOid ?? reviewBranch}..${reviewBranch}`, "--", ".blueprint"]);
  const evidenceText = request.evidence.map((entry) => `${entry.path}:${entry.contentSha256 ?? "missing"}`).join(", ");
  if (
    content.includes(`- Candidate branch: ${reviewBranch}`) &&
    content.includes("- Clean review branch status: clean") &&
    content.includes(`- Source branch: ${request.sourceBranch}`) &&
    content.includes(`- Source HEAD: ${request.sourceHead}`) &&
    content.includes(`(${request.baseOid})`) &&
    content.includes(`policy=${request.policy}`) &&
    content.includes(`effective Blueprint config sha256=${request.blueprintConfigSha256}`) &&
    content.includes(`- Digest inputs used: ${evidenceText}`) &&
    sourceHead === request.sourceHead && baseOid === request.baseOid &&
    createdOid !== null && reviewOid === createdOid && actualSourceOid === sourceHead &&
    succeeded(excluded) && (request.policy === "include" || excluded.stdout.length === 0)
  ) return "already-complete";
  if (content.includes(`- Candidate branch: ${reviewBranch}`)) return "partial";
  return "divergent";
}

export async function blueprintPrBranchPreview(args: PrBranchPreviewArgs): Promise<PreviewResult> {
  pruneApprovals();
  try {
    rejectUnsafeRefInput(args.baseRef, "Base ref");
    rejectUnsafeRefInput(args.reviewBranch, "Review branch");
    const initial = await snapshot(args.cwd ?? process.cwd());
    const blockers: string[] = [];
    if (!initial.branch) blockers.push("Detached HEAD is unsupported.");
    if (!initial.head) blockers.push("Repository HEAD is missing.");
    if (initial.status.length > 0) blockers.push("Working tree and index must be clean.");
    if (initial.inProgressState.length > 0) blockers.push(`In-progress git state: ${initial.inProgressState.join(", ")}.`);
    const branchCheck = await git(initial.repoRoot, ["check-ref-format", "--branch", args.reviewBranch]);
    if (!succeeded(branchCheck) || branchCheck.stdout.trim() !== args.reviewBranch) blockers.push("Review branch name is invalid or ref-like rather than literal.");
    if (initial.branch) {
      const sourceBranchCheck = await git(initial.repoRoot, ["check-ref-format", "--branch", initial.branch]);
      if (!succeeded(sourceBranchCheck) || sourceBranchCheck.stdout.trim() !== initial.branch || initial.branch.startsWith("-")) blockers.push("Current source branch name is unsafe for deterministic restore.");
    }
    const report = await reportReceipt(initial.repoRoot);
    if (blockers.length > 0 || !initial.branch || !initial.head) {
      return { status: "blocked", operationId: null, fingerprint: null, packet: null, waitingState: null, blockers, warnings: [] };
    }
    const baseOid = await resolveCommit(initial.repoRoot, args.baseRef, "Base ref");
    const symbolicBase = await git(initial.repoRoot, ["rev-parse", "--symbolic-full-name", "--verify", "--end-of-options", args.baseRef]);
    if (!succeeded(symbolicBase)) {
      throw new Error(`Base ref symbolic classification failed: exit=${symbolicBase.exitCode ?? "null"}, signal=${symbolicBase.signal ?? "none"}, timedOut=${symbolicBase.timedOut}.`);
    }
    if (symbolicBase.stdout.trim().startsWith("refs/remotes/")) {
      blockers.push("Remote-tracking base refs are unsupported; resolve and approve a local branch, tag, or exact commit instead.");
    }
    const shallow = await git(initial.repoRoot, ["rev-parse", "--is-shallow-repository"]);
    if (!succeeded(shallow) || shallow.stdout.trim() === "true") blockers.push("Shallow or uninspectable repositories are unsupported.");
    if (baseOid === initial.head) blockers.push("Source branch has no commits ahead of the base.");
    const mergeBase = await gitText(initial.repoRoot, ["merge-base", baseOid, initial.head], "merge-base");
    if (!isCanonicalFullGitHash(mergeBase) || mergeBase !== baseOid) blockers.push("Base must be an ancestor of the source HEAD.");
    const commitText = await gitText(initial.repoRoot, ["rev-list", "--reverse", "--topo-order", `${mergeBase}..${initial.head}`], "candidate commit ledger");
    const hashes = commitText.split(/\r?\n/).filter(Boolean);
    const commits: PrBranchCommit[] = [];
    for (const sha of hashes) commits.push(await inspectCommit(initial.repoRoot, sha, args.blueprintPolicy));
    const finalDiffArgv = ["diff", "--name-only", "-z", baseOid, initial.head, "--", "."];
    if (args.blueprintPolicy === "exclude") finalDiffArgv.push(":(exclude).blueprint", ":(exclude).blueprint/**");
    const finalDiff = await git(initial.repoRoot, finalDiffArgv);
    if (!succeeded(finalDiff)) throw new Error("Exact filtered final path set could not be inspected.");
    const includedPaths = splitNul(finalDiff.stdout).sort();
    const excludedPaths = [...new Set(commits.flatMap((entry) => entry.excludedPaths))].sort();
    if (commits.every((entry) => entry.action === "exclude")) blockers.push("Filtering leaves no retained commits; no review branch will be created.");
    if (includedPaths.length === 0) blockers.push("Filtering leaves no final retained content; no review branch will be created.");
    if (blockers.length > 0) return { status: "blocked", operationId: null, fingerprint: null, packet: null, waitingState: null, blockers, warnings: [] };
    const expectedRetainedTree: PrBranchApprovalPacket["expectedRetainedTree"] = [];
    for (const relativePath of includedPaths) {
      expectedRetainedTree.push({ path: relativePath, entry: await treeEntry(initial.repoRoot, initial.head, relativePath) });
    }
    const evidence = await evidenceReceipts(initial.repoRoot, args.evidencePaths);
    const blueprintConfig = await effectiveBlueprintConfigReceipt(initial.repoRoot);
    const disposition = await existingBranchDisposition(initial.repoRoot, args.reviewBranch, report, {
      sourceBranch: initial.branch,
      sourceHead: initial.head,
      baseOid,
      policy: args.blueprintPolicy,
      evidence,
      blueprintConfigSha256: blueprintConfig.sha256
    });
    if (disposition) {
      return { status: disposition, operationId: null, fingerprint: null, packet: null, waitingState: null,
        blockers: [`Review branch ${args.reviewBranch} already exists (${disposition}) for the current resolved request or is safely blocked as non-equivalent. It will not be deleted or overwritten.`], warnings: [] };
    }
    if (report.exists && !args.overwriteReport) {
      return { status: "blocked", operationId: null, fingerprint: null, packet: null,
        waitingState: "report-overwrite-confirmation", blockers: ["The existing pr-branch report requires explicit overwrite approval."], warnings: [] };
    }
    const partialPacket = {
      schemaVersion: 1 as const, operation: "pr-branch" as const, repoRoot: initial.repoRoot, gitCommonDir: initial.gitCommonDir,
      sourceBranch: initial.branch, sourceHead: initial.head, baseRef: args.baseRef, baseOid, mergeBase,
      reviewBranch: args.reviewBranch, reviewRefDisposition: "absent" as const, blueprintPolicy: args.blueprintPolicy,
      stayOnReviewBranch: args.stayOnReviewBranch === true, gitConfigSha256: initial.gitConfigSha256,
      blueprintConfig,
      workingTreeFingerprint: workingFingerprint(initial), inProgressState: initial.inProgressState, commits,
      includedPaths, excludedPaths, expectedRetainedTree, evidence
    };
    const placeholderReport: PrBranchApprovalPacket["report"] = { path: REPORT_PATH, overwriteApproved: args.overwriteReport === true,
      priorExists: report.exists, priorContentSha256: report.sha256, preMutationContentSha256: "" };
    const plan = executionPlan(partialPacket);
    const packet: PrBranchApprovalPacket = { ...partialPacket, report: placeholderReport, executionPlan: plan };
    const operationId = randomUUID();
    const approvalFingerprint = prBranchApprovalFingerprint(packet);
    const reportContent = renderReport(packet, approvalFingerprint, null);
    packet.report.preMutationContentSha256 = qualityShippingSha256(reportContent);
    const now = nowProvider();
    approvals.set(operationId, { packet: structuredClone(packet), fingerprint: approvalFingerprint, preMutationReportContent: reportContent, consumed: false,
      createdAt: now, expiresAt: now + approvalTtlMs, terminalExpiresAt: null, lastResult: null,
      outcomeReportContent: null, expectedReportContentSha256: null });
    pruneApprovals();
    return { status: "ready", operationId, fingerprint: approvalFingerprint, packet,
      waitingState: "review-branch-confirmation", blockers: [], warnings: ["Approval and operation lock are process-local; restart or expiry fails closed."] };
  } catch (error) {
    return { status: "invalid", operationId: null, fingerprint: null, packet: null, waitingState: null,
      blockers: [error instanceof Error ? error.message : String(error)], warnings: [] };
  }
}

async function compareFresh(packet: PrBranchApprovalPacket): Promise<string[]> {
  const changed: string[] = [];
  const current = await snapshot(packet.repoRoot);
  if (current.repoRoot !== packet.repoRoot || current.gitCommonDir !== packet.gitCommonDir) changed.push("repository identity");
  if (current.branch !== packet.sourceBranch) changed.push("source branch");
  if (current.head !== packet.sourceHead) changed.push("source HEAD");
  if (current.status !== "") changed.push("working tree");
  if (current.gitConfigSha256 !== packet.gitConfigSha256) changed.push("effective git config");
  if ((await effectiveBlueprintConfigReceipt(packet.repoRoot)).sha256 !== packet.blueprintConfig.sha256) changed.push("effective Blueprint config");
  if (current.inProgressState.length > 0) changed.push("in-progress git state");
  if (await resolveCommit(packet.repoRoot, packet.baseRef, "Base ref") !== packet.baseOid) changed.push("base ref");
  if (await localBranchDisposition(packet.repoRoot, packet.reviewBranch) === "exists") changed.push("review branch collision");
  if (qualityShippingFingerprint(await evidenceReceipts(packet.repoRoot, packet.evidence.map((entry) => entry.path))) !== qualityShippingFingerprint(packet.evidence)) changed.push("evidence");
  const report = await reportReceipt(packet.repoRoot);
  if (report.exists !== packet.report.priorExists || report.sha256 !== packet.report.priorContentSha256) changed.push("report compare-and-swap receipt");
  const commitText = await gitText(packet.repoRoot, ["rev-list", "--reverse", "--topo-order", `${packet.mergeBase}..${packet.sourceHead}`], "candidate commit ledger");
  const hashes = commitText.split(/\r?\n/).filter(Boolean);
  if (qualityShippingFingerprint(hashes) !== qualityShippingFingerprint(packet.commits.map((entry) => entry.sourceCommit))) changed.push("candidate commit order");
  return changed;
}

async function compareFreshAfterPreReport(packet: PrBranchApprovalPacket, expectedReportSha256: string): Promise<string[]> {
  const changed: string[] = [];
  const current = await snapshot(packet.repoRoot);
  if (current.repoRoot !== packet.repoRoot || current.gitCommonDir !== packet.gitCommonDir) changed.push("repository identity");
  if (current.branch !== packet.sourceBranch) changed.push("source branch");
  if (current.head !== packet.sourceHead) changed.push("source HEAD");
  if (current.status !== "") changed.push("working tree");
  if (current.gitConfigSha256 !== packet.gitConfigSha256) changed.push("effective git config");
  if ((await effectiveBlueprintConfigReceipt(packet.repoRoot)).sha256 !== packet.blueprintConfig.sha256) changed.push("effective Blueprint config");
  if (current.inProgressState.length > 0) changed.push("in-progress git state");
  if (await resolveCommit(packet.repoRoot, packet.baseRef, "Base ref") !== packet.baseOid) changed.push("base ref");
  if (await localBranchDisposition(packet.repoRoot, packet.reviewBranch) === "exists") changed.push("review branch collision");
  const evidence = await evidenceReceipts(packet.repoRoot, packet.evidence.map((entry) => entry.path));
  if (qualityShippingFingerprint(evidence) !== qualityShippingFingerprint(packet.evidence)) changed.push("evidence");
  const report = await reportReceipt(packet.repoRoot);
  if (!report.exists || report.sha256 !== expectedReportSha256) changed.push("pre-mutation report");
  return changed;
}

async function recordProcess(result: PrBranchExecutionResult, stage: string, argv: string[]): Promise<QualityShippingProcessResult> {
  const receipt = await git(approvals.get(result.operationId)?.packet.repoRoot ?? globalThis.process.cwd(), argv);
  result.processes.push({ stage, argv: [...argv], result: receipt });
  return receipt;
}

function abnormal(result: QualityShippingProcessResult): boolean {
  return result.timedOut || result.signal !== null || result.exitCode === null;
}

async function currentOid(repoRoot: string, ref = "HEAD"): Promise<string | null> {
  const result = await git(repoRoot, ["rev-parse", "--verify", "--end-of-options", ref]);
  return succeeded(result) && isCanonicalFullGitHash(result.stdout.trim()) ? result.stdout.trim() : null;
}

async function readOidReceipt(
  result: PrBranchExecutionResult,
  stage: string,
  ref: string
): Promise<string | null> {
  const receipt = await recordProcess(result, stage, ["rev-parse", "--verify", "--end-of-options", ref]);
  const oid = receipt.stdout.trim();
  return succeeded(receipt) && isCanonicalFullGitHash(oid) ? oid : null;
}

function markValidationUnknown(result: PrBranchExecutionResult, blocker: string): void {
  result.status = "outcome-unknown";
  result.blockers.push(blocker);
}

function markPartial(result: PrBranchExecutionResult, blocker: string): void {
  if (result.status !== "outcome-unknown") result.status = "partial";
  result.blockers.push(blocker);
}

async function persistOutcome(stored: StoredApproval, result: PrBranchExecutionResult): Promise<void> {
  const content = renderReport(stored.packet, stored.fingerprint, result);
  stored.outcomeReportContent = content;
  try {
    const write = await reportWriter({ cwd: stored.packet.repoRoot, reportName: REPORT_NAME, content, overwrite: true,
      expectedExistingContentSha256: stored.expectedReportContentSha256 });
    const status = reportWriteStatus(write);
    result.report.outcomeStatus = status;
    if (status === "failed") throw new Error(`Outcome report was rejected with status ${write.status}.`);
    stored.expectedReportContentSha256 = qualityShippingSha256(content);
  } catch (error) {
    result.report.outcomeStatus = "failed";
    result.report.error = error instanceof Error ? error.message : String(error);
    if (result.status !== "outcome-unknown") result.status = result.mutationStarted ? "partial" : "failed";
    result.stage = "outcome-report";
    result.recoveryActions.push(`Retry only blueprint_pr_branch_persist for operation ${result.operationId}; do not replay git mutation.`);
  }
}

export async function blueprintPrBranchExecute(args: { operationId: string; fingerprint: string; confirmed: true }): Promise<PrBranchExecutionResult> {
  pruneApprovals();
  const stored = approvals.get(args.operationId);
  if (!stored) {
    const dummyPacket = { sourceBranch: "unknown", sourceHead: "unknown", reviewBranch: "unknown" } as PrBranchApprovalPacket;
    const result = baseResult(dummyPacket, args.operationId, args.fingerprint);
    result.blockers.push("Approval is missing or expired; create a fresh preview.");
    return result;
  }
  const result = baseResult(stored.packet, args.operationId, args.fingerprint);
  if (stored.fingerprint !== args.fingerprint) { result.blockers.push("Approval fingerprint mismatch."); return result; }
  if (stored.consumed) {
    if (stored.lastResult) return { ...stored.lastResult, status: "blocked", stage: "approval", mutationStarted: false,
      blockers: [...stored.lastResult.blockers, "Approval is one-shot and was already consumed; no git process was entered by this call."] };
    result.blockers.push("Approval is one-shot and was already consumed."); return result;
  }
  if (stored.expiresAt <= nowProvider()) { approvals.delete(args.operationId); result.blockers.push("Approval expired; create a fresh preview."); return result; }
  const release = tryAcquireQualityShippingOperationLock("pr-branch", stored.packet.gitCommonDir);
  if (!release) { result.blockers.push("Another Quality Shipping operation is active for this repository; approval was not consumed."); return result; }
  try {
    stored.consumed = true;
    stored.terminalExpiresAt = nowProvider() + terminalTtlMs;
    result.stage = "revalidate";
    if (prBranchApprovalFingerprint(stored.packet) !== stored.fingerprint) {
      result.status = "stale";
      result.blockers.push("Stored pr-branch approval packet fingerprint no longer matches its canonical bound fields.");
      stored.lastResult = result;
      return result;
    }
    const regeneratedPlan = executionPlan(stored.packet);
    if (qualityShippingFingerprint(regeneratedPlan) !== qualityShippingFingerprint(stored.packet.executionPlan)) {
      result.status = "stale";
      result.blockers.push("Stored pr-branch execution plan does not equal the canonical exact-argv plan regenerated at the mutation boundary.");
      stored.lastResult = result;
      return result;
    }
    let changed: string[];
    try {
      changed = await compareFresh(stored.packet);
    } catch (error) {
      result.status = "failed";
      result.blockers.push(`Pre-mutation revalidation failed closed: ${error instanceof Error ? error.message : String(error)}`);
      stored.lastResult = result;
      return result;
    }
    if (changed.length > 0) { result.status = "stale"; result.blockers.push(`Approval is stale: ${changed.join(", ")}.`); stored.lastResult = result; return result; }
    result.stage = "pre-report";
    try {
      const write = await reportWriter({ cwd: stored.packet.repoRoot, reportName: REPORT_NAME,
        content: stored.preMutationReportContent, overwrite: stored.packet.report.overwriteApproved,
        expectedExistingContentSha256: stored.packet.report.priorContentSha256 });
      result.report.preMutationStatus = reportWriteStatus(write);
      if (result.report.preMutationStatus === "failed") throw new Error(`Pre-mutation report was rejected with status ${write.status}.`);
      const persisted = await reportReceipt(stored.packet.repoRoot);
      const exactSha = qualityShippingSha256(stored.preMutationReportContent);
      const newlineSha = qualityShippingSha256(`${stored.preMutationReportContent}\n`);
      if (!persisted.exists || !persisted.sha256 || (persisted.sha256 !== exactSha && persisted.sha256 !== newlineSha)) {
        throw new Error("Persisted pre-mutation report content did not match the approved runtime rendering.");
      }
      stored.expectedReportContentSha256 = persisted.sha256;
    } catch (error) {
      result.report.preMutationStatus = "failed"; result.report.error = error instanceof Error ? error.message : String(error);
      result.status = "failed"; result.blockers.push("Pre-mutation report failed; no branch was created."); stored.lastResult = result; return result;
    }
    let postReportChanged: string[];
    try {
      postReportChanged = await compareFreshAfterPreReport(stored.packet, stored.expectedReportContentSha256);
    } catch (error) {
      result.status = "failed";
      result.stage = "revalidate";
      result.blockers.push(`Post-report pre-mutation revalidation failed closed: ${error instanceof Error ? error.message : String(error)}`);
      stored.lastResult = result;
      return result;
    }
    if (postReportChanged.length > 0) {
      result.status = "stale";
      result.stage = "revalidate";
      result.blockers.push(`Repository changed after pre-mutation report persistence: ${postReportChanged.join(", ")}.`);
      await persistOutcome(stored, result);
      stored.lastResult = result;
      return result;
    }
    result.stage = "create-branch";
    const create = await recordProcess(result, "create-branch", ["switch", "-c", stored.packet.reviewBranch, stored.packet.baseOid]);
    if (!succeeded(create)) {
      result.status = abnormal(create) ? "outcome-unknown" : "failed";
      result.blockers.push("Review branch creation failed.");
      result.review.oid = await currentOid(stored.packet.repoRoot, `refs/heads/${stored.packet.reviewBranch}`);
      result.review.disposition = result.review.oid ? "partial" : "absent";
      result.mutationStarted = result.review.oid !== null;
      await persistOutcome(stored, result); stored.lastResult = result; return result;
    }
    result.mutationStarted = true; result.review.disposition = "created";
    result.stage = "replay";
    const createdHead = await readOidReceipt(result, "validate-created-head", "HEAD");
    const replayAllowed = createdHead === stored.packet.baseOid;
    if (!replayAllowed) {
      markValidationUnknown(result, "Created review branch HEAD could not be verified at the exact approved base before replay.");
    }
    for (const commit of replayAllowed ? stored.packet.commits : []) {
      if (commit.action === "exclude") { result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "excluded", verification: "not-applicable" }); continue; }
      const headBefore = await readOidReceipt(result, `head-before:${commit.sourceCommit}`, "HEAD");
      if (!headBefore) {
        result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "failed" });
        markValidationUnknown(result, `HEAD before replay ${commit.sourceCommit} could not be verified.`);
        break;
      }
      const mixed = stored.packet.blueprintPolicy === "exclude" && commit.classification === "mixed";
      let replay: QualityShippingProcessResult;
      let ownedTempDir: string | null = null;
      if (mixed) {
        const parent = commit.parents[0];
        if (!parent) {
          result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "failed" });
          result.status = "partial";
          result.blockers.push(`Mixed root commit ${commit.sourceCommit} is unsupported.`);
          break;
        }
        try {
          ownedTempDir = await mkdtemp(path.join(stored.packet.gitCommonDir, "blueprint-pr-branch-"));
          const mixedPatchPath = path.join(ownedTempDir, "replay.patch");
          const patchResult = await recordProcess(result, `filter-diff:${commit.sourceCommit}`, ["diff", "--binary", "--full-index", `--output=${mixedPatchPath}`, parent, commit.sourceCommit, "--", ".", ":(exclude).blueprint", ":(exclude).blueprint/**"]);
          if (!succeeded(patchResult)) {
            result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "failed" });
            result.status = abnormal(patchResult) ? "outcome-unknown" : "partial";
            result.blockers.push(`Filtered patch construction failed at ${commit.sourceCommit}.`);
            break;
          }
          if ((await readFile(mixedPatchPath)).length === 0) {
            const emptyHead = await readOidReceipt(result, `head-after-empty:${commit.sourceCommit}`, "HEAD");
            if (emptyHead !== headBefore) {
              result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: emptyHead, outcome: "failed" });
              markValidationUnknown(result, `Execution-time empty replay ${commit.sourceCommit} unexpectedly changed HEAD.`);
              break;
            }
            result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "empty-after-filter", verification: "not-applicable" });
            continue;
          }
          replay = await recordProcess(result, `replay:${commit.sourceCommit}`, ["apply", "--index", "--3way", "--", mixedPatchPath]);
        } catch (error) {
          result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "failed" });
          result.status = "partial";
          result.blockers.push(`Filtered patch staging failed at ${commit.sourceCommit}: ${error instanceof Error ? error.message : String(error)}`);
          break;
        } finally {
          if (ownedTempDir) await rm(ownedTempDir, { recursive: true, force: true }).catch(() => undefined);
        }
      } else {
        replay = await recordProcess(result, `replay:${commit.sourceCommit}`, ["cherry-pick", commit.sourceCommit]);
      }
      if (!succeeded(replay)) {
        result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "failed" });
        result.status = abnormal(replay) ? "outcome-unknown" : "partial";
        result.blockers.push(`Replay failed at ${commit.sourceCommit}; conflicts were not resolved automatically.`);
        const cherryPickHead = path.join(stored.packet.gitCommonDir, "CHERRY_PICK_HEAD");
        if (!mixed && await exists(cherryPickHead)) await recordProcess(result, "abort-cherry-pick", ["cherry-pick", "--abort"]);
        break;
      }
      if (mixed) {
        const staged = await recordProcess(result, `staged:${commit.sourceCommit}`, ["diff", "--cached", "--quiet", "--exit-code"]);
        if (staged.exitCode === 0 && !staged.signal && !staged.timedOut) {
          const emptyHead = await readOidReceipt(result, `head-after-empty:${commit.sourceCommit}`, "HEAD");
          if (emptyHead !== headBefore) {
            result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: emptyHead, outcome: "failed" });
            markValidationUnknown(result, `Execution-time empty replay ${commit.sourceCommit} unexpectedly changed HEAD.`);
            break;
          }
          result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "empty-after-filter", verification: "not-applicable" }); continue;
        }
        if (staged.exitCode !== 1 || abnormal(staged)) { result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "failed" }); result.status = abnormal(staged) ? "outcome-unknown" : "partial"; result.blockers.push(`Filtered staged-state inspection failed at ${commit.sourceCommit}.`); break; }
        const commitResult = await recordProcess(result, `commit:${commit.sourceCommit}`, ["commit", "--no-verify", "-C", commit.sourceCommit]);
        if (!succeeded(commitResult)) { result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "failed" }); result.status = abnormal(commitResult) ? "outcome-unknown" : "partial"; result.blockers.push(`Filtered commit creation failed at ${commit.sourceCommit}.`); break; }
      }
      const headAfter = await readOidReceipt(result, `head-after:${commit.sourceCommit}`, "HEAD");
      if (!headAfter || headAfter === headBefore) {
        result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: headAfter, outcome: "failed", verification: "unknown" });
        markValidationUnknown(result, `Replay ${commit.sourceCommit} returned success without a verifiable HEAD advance.`);
        break;
      }
      const parentReceipt = await recordProcess(result, `validate-replay-parent:${commit.sourceCommit}`, ["rev-list", "--parents", "-n", "1", headAfter]);
      const identityReceipt = await recordProcess(result, `validate-replay-identity:${commit.sourceCommit}`, ["cat-file", "commit", headAfter]);
      const deltaReceipt = await recordProcess(result, `validate-replay-delta:${commit.sourceCommit}`, filteredDeltaArgs(headBefore, headAfter, stored.packet.blueprintPolicy));
      if (!succeeded(parentReceipt) || !succeeded(identityReceipt) || !succeeded(deltaReceipt)) {
        result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: headAfter, outcome: "failed", verification: "unknown" });
        markValidationUnknown(result, `Replay identity or filtered-delta verification could not be completed for ${commit.sourceCommit}.`);
        break;
      }
      let observedIdentity: CommitIdentity;
      try {
        observedIdentity = parseCommitIdentity(identityReceipt.stdout);
      } catch (error) {
        result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: headAfter, outcome: "failed", verification: "unknown" });
        markValidationUnknown(result, `Replay identity was unreadable for ${commit.sourceCommit}: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
      const parentTokens = parentReceipt.stdout.trim().split(/\s+/).filter(Boolean);
      const parentMatches = parentTokens.length === 2 && parentTokens[0] === headAfter && parentTokens[1] === headBefore;
      const authorMatches = observedIdentity.author === commit.author;
      const messageMatches = observedIdentity.message === commit.message;
      const deltaMatches = qualityShippingSha256(deltaReceipt.stdout) === commit.filteredDeltaSha256;
      if (!parentMatches || !authorMatches || !messageMatches || !deltaMatches) {
        result.mapping.push({
          sourceCommit: commit.sourceCommit,
          reviewCommit: headAfter,
          outcome: "failed",
          observedSubject: observedIdentity.subject,
          verification: "mismatch"
        });
        markPartial(result, `Replay verification mismatch for ${commit.sourceCommit}: parent=${parentMatches ? "match" : "mismatch"}, author=${authorMatches ? "match" : "mismatch"}, message=${messageMatches ? "match" : "mismatch"}, filtered-delta=${deltaMatches ? "match" : "mismatch"}.`);
        break;
      }
      result.mapping.push({
        sourceCommit: commit.sourceCommit,
        reviewCommit: headAfter,
        outcome: "replayed",
        observedSubject: observedIdentity.subject,
        verification: "verified"
      });
    }
    const hasFailure = result.mapping.some((entry) => entry.outcome === "failed");
    if (hasFailure || !replayAllowed) {
      for (const commit of stored.packet.commits) {
        if (!result.mapping.some((entry) => entry.sourceCommit === commit.sourceCommit)) {
          result.mapping.push({ sourceCommit: commit.sourceCommit, reviewCommit: null, outcome: "not-attempted", verification: "not-attempted" });
        }
      }
    }
    result.stage = "validate";
    result.review.oid = await readOidReceipt(result, "validate-review-ref", `refs/heads/${stored.packet.reviewBranch}`);
    if (!result.review.oid) markValidationUnknown(result, "Review branch ref could not be verified after replay.");
    const status = await recordProcess(result, "validate-status", ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    if (succeeded(status)) result.validation.clean = status.stdout.length === 0;
    else markValidationUnknown(result, "Post-replay clean-status validation failed.");
    const retained = await recordProcess(result, "validate-retained-paths", ["diff", "--name-only", "-z", `${stored.packet.baseOid}..${stored.packet.reviewBranch}`]);
    if (succeeded(retained)) {
      result.validation.retainedPaths = splitNul(retained.stdout);
      result.validation.excludedPathsFound = stored.packet.blueprintPolicy === "exclude"
        ? result.validation.retainedPaths.filter(isBlueprintPath)
        : [];
      if (qualityShippingFingerprint([...result.validation.retainedPaths].sort()) !== qualityShippingFingerprint(stored.packet.includedPaths)) {
        markPartial(result, "Final retained path set does not exactly match the approved filtered source diff.");
      }
    } else {
      markValidationUnknown(result, "Post-replay retained/excluded path validation failed.");
    }
    for (const expected of stored.packet.expectedRetainedTree) {
      const treeReceipt = await recordProcess(result, `validate-tree:${expected.path}`, ["ls-tree", "-z", stored.packet.reviewBranch, "--", expected.path]);
      if (!succeeded(treeReceipt)) {
        markValidationUnknown(result, `Final retained tree entry could not be read for ${expected.path}.`);
        continue;
      }
      try {
        if (parseTreeEntry(treeReceipt.stdout) !== expected.entry) {
          markPartial(result, `Final retained tree entry does not match the approved source content for ${expected.path}.`);
        }
      } catch (error) {
        markValidationUnknown(result, error instanceof Error ? error.message : String(error));
      }
    }
    const count = await recordProcess(result, "validate-commit-count", ["rev-list", "--count", `${stored.packet.baseOid}..${stored.packet.reviewBranch}`]);
    if (succeeded(count) && /^[0-9]+$/.test(count.stdout.trim())) {
      result.validation.retainedCommitCount = Number.parseInt(count.stdout.trim(), 10);
    } else {
      markValidationUnknown(result, "Post-replay commit-count validation failed.");
    }
    const sequence = await recordProcess(result, "validate-commit-sequence", ["rev-list", "--reverse", `${stored.packet.baseOid}..${stored.packet.reviewBranch}`]);
    const expectedReviewCommits = result.mapping
      .filter((entry) => entry.outcome === "replayed")
      .map((entry) => entry.reviewCommit)
      .filter((entry): entry is string => entry !== null);
    if (succeeded(sequence)) {
      const actualReviewCommits = sequence.stdout.trim().split(/\r?\n/).filter(Boolean);
      if (qualityShippingFingerprint(actualReviewCommits) !== qualityShippingFingerprint(expectedReviewCommits)) {
        markPartial(result, "Created review commit sequence does not exactly match the observed source-to-review mapping.");
      }
    } else {
      markValidationUnknown(result, "Post-replay commit-sequence validation failed.");
    }
    if (result.validation.retainedCommitCount !== null && result.validation.retainedCommitCount !== expectedReviewCommits.length) {
      markPartial(result, "Created review commit count does not exactly match the observed replay mapping.");
    }
    const approvedRetained = stored.packet.commits.filter((entry) => entry.action === "include").map((entry) => entry.sourceCommit);
    const observedRetained = result.mapping
      .filter((entry) => entry.outcome === "replayed" || entry.outcome === "empty-after-filter")
      .map((entry) => entry.sourceCommit);
    if (!hasFailure && replayAllowed && qualityShippingFingerprint(approvedRetained) !== qualityShippingFingerprint(observedRetained)) {
      markPartial(result, "Approved retained commit actions do not exactly match replayed or execution-time-empty outcomes.");
    }
    if (!hasFailure && result.validation.retainedPaths.length === 0) {
      markPartial(result, "Review branch contains no retained file diff after replay.");
    }
    result.source.afterOid = await readOidReceipt(result, "validate-source-ref", `refs/heads/${stored.packet.sourceBranch}`);
    result.source.preserved = result.source.afterOid === stored.packet.sourceHead;
    if (!stored.packet.stayOnReviewBranch && result.validation.clean === true) {
      result.stage = "restore-source";
      const restoreSource = await recordProcess(result, "restore-source", ["switch", "--", stored.packet.sourceBranch]);
      const restoredBranch = await recordProcess(result, "validate-restored-branch", ["symbolic-ref", "--quiet", "--short", "HEAD"]);
      const restoredHead = await readOidReceipt(result, "validate-restored-head", "HEAD");
      result.source.restored = succeeded(restoreSource) && succeeded(restoredBranch) &&
        restoredBranch.stdout.trim() === stored.packet.sourceBranch && restoredHead === stored.packet.sourceHead;
      if (!result.source.restored) {
        if (abnormal(restoreSource) || !succeeded(restoredBranch) || !restoredHead) markValidationUnknown(result, "Review branch exists, but exact source checkout restoration could not be verified.");
        else markPartial(result, "Review branch exists, but git did not restore the exact approved source branch and HEAD.");
      }
    } else if (stored.packet.stayOnReviewBranch) result.source.restored = false;
    if (!result.source.preserved) markPartial(result, "Source ref preservation could not be verified.");
    if (result.validation.excludedPathsFound.length > 0) markPartial(result, "Excluded .blueprint paths remain in the review diff.");
    if (result.validation.clean !== true) markPartial(result, "Review branch is not clean after replay.");
    result.stage = "validate";
    const finalBranch = await recordProcess(result, "validate-final-branch", ["symbolic-ref", "--quiet", "--short", "HEAD"]);
    const finalHead = await readOidReceipt(result, "validate-final-head", "HEAD");
    result.validation.currentBranch = succeeded(finalBranch) && finalBranch.stdout.trim() ? finalBranch.stdout.trim() : null;
    result.validation.currentHead = finalHead;
    const expectedFinalBranch = stored.packet.stayOnReviewBranch ? stored.packet.reviewBranch : stored.packet.sourceBranch;
    const expectedFinalHead = stored.packet.stayOnReviewBranch ? result.review.oid : stored.packet.sourceHead;
    if (!succeeded(finalBranch) || !finalHead || !expectedFinalHead) {
      markValidationUnknown(result, `Final checkout posture could not be verified as ${expectedFinalBranch} at the exact expected HEAD.`);
    } else if (result.validation.currentBranch !== expectedFinalBranch || result.validation.currentHead !== expectedFinalHead) {
      markPartial(result, `Final checkout posture mismatch: expected ${expectedFinalBranch} at ${expectedFinalHead}, observed ${result.validation.currentBranch ?? "detached-or-unknown"} at ${result.validation.currentHead}.`);
    }
    const finalStatus = await recordProcess(result, "validate-final-status", ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    if (succeeded(finalStatus)) {
      result.validation.finalClean = finalStatus.stdout.length === 0;
      if (!result.validation.finalClean) markPartial(result, "Final checkout is not clean after the approved checkout posture was established.");
    } else {
      markValidationUnknown(result, "Final checkout clean-status validation failed.");
    }
    if (!hasFailure && replayAllowed && result.blockers.length === 0) { result.status = "succeeded"; result.review.disposition = "complete"; }
    else result.review.disposition = "partial";
    if (result.status !== "succeeded" && result.recoveryActions.length === 0) result.recoveryActions.push(`Inspect ${stored.packet.reviewBranch}; do not delete or overwrite it. Return to ${stored.packet.sourceBranch} only when git status is clean.`);
    result.stage = "outcome-report";
    await persistOutcome(stored, result);
    stored.lastResult = result;
    return result;
  } catch (error) {
    result.status = result.mutationStarted ? "partial" : "failed";
    result.blockers.push(error instanceof Error ? error.message : String(error));
    if (result.mutationStarted) result.recoveryActions.push(`Inspect ${stored.packet.reviewBranch}; do not retry mutation with this consumed approval.`);
    try { await persistOutcome(stored, result); } catch { /* preserve original structured failure */ }
    stored.lastResult = result;
    return result;
  } finally { release(); pruneApprovals(); }
}

export async function blueprintPrBranchPersist(args: { operationId: string; fingerprint: string }): Promise<PrBranchExecutionResult> {
  pruneApprovals();
  const stored = approvals.get(args.operationId);
  if (!stored || stored.fingerprint !== args.fingerprint || !stored.consumed || !stored.lastResult ||
    !stored.outcomeReportContent || stored.lastResult.report.outcomeStatus !== "failed") {
    const dummyPacket = { sourceBranch: "unknown", sourceHead: "unknown", reviewBranch: "unknown" } as PrBranchApprovalPacket;
    const result = baseResult(dummyPacket, args.operationId, args.fingerprint);
    result.stage = "persistence-recovery";
    result.blockers.push("No matching process-local terminal receipt is available; git mutation will not be entered.");
    return result;
  }
  const release = tryAcquireQualityShippingOperationLock("pr-branch", stored.packet.gitCommonDir);
  if (!release) {
    const blocked = structuredClone(stored.lastResult);
    blocked.status = "blocked";
    blocked.stage = "persistence-recovery";
    blocked.blockers = ["Another Quality Shipping operation is active for this repository; the terminal receipt was retained and persistence recovery did not start."];
    return blocked;
  }
  const result = structuredClone(stored.lastResult);
  result.stage = "persistence-recovery";
  try {
    try {
      const write = await reportWriter({ cwd: stored.packet.repoRoot, reportName: REPORT_NAME, content: stored.outcomeReportContent,
        overwrite: true, expectedExistingContentSha256: stored.expectedReportContentSha256 });
      result.report.outcomeStatus = reportWriteStatus(write);
      if (result.report.outcomeStatus === "failed") throw new Error(`Outcome report was rejected with status ${write.status}.`);
      result.report.error = null;
      result.recoveryActions = result.recoveryActions.filter((action) => !action.includes("blueprint_pr_branch_persist"));
      if (result.status !== "outcome-unknown" && result.review.disposition === "complete" && result.blockers.length === 0) {
        result.status = "succeeded";
      }
      stored.expectedReportContentSha256 = qualityShippingSha256(stored.outcomeReportContent);
    } catch (error) {
      if (result.status !== "outcome-unknown") result.status = "partial";
      result.report.outcomeStatus = "failed";
      result.report.error = error instanceof Error ? error.message : String(error);
    }
    stored.lastResult = result;
    return result;
  } finally {
    release();
  }
}

export const prBranchToolDefinitions: ToolDefinition[] = [
  { name: "blueprint_pr_branch_preview", description: "Plan a freshness-bound deterministic pr-branch replay without mutating git.", inputSchema: previewInputSchema,
    handler: async (args) => blueprintPrBranchPreview(args as PrBranchPreviewArgs) },
  { name: "blueprint_pr_branch_execute", description: "Execute exactly one confirmed pr-branch approval through safe argv and persist actual outcomes.", inputSchema: executeInputSchema,
    handler: async (args) => blueprintPrBranchExecute(args as { operationId: string; fingerprint: string; confirmed: true }) },
  { name: "blueprint_pr_branch_persist", description: "Retry only the receipt-bound pr-branch outcome report without re-entering git mutation.", inputSchema: persistInputSchema,
    handler: async (args) => blueprintPrBranchPersist(args as { operationId: string; fingerprint: string }) }
];
