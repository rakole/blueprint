import { randomUUID } from "node:crypto";
import { access, lstat, readFile, readdir, realpath } from "node:fs/promises";
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
import {
  blueprintArtifactReportWrite,
  isVerificationArtifactReadyForUat,
  validateReviewArtifactContent,
  validateReviewArtifactScopeCoverage,
  validateVerificationArtifactContent
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { evaluatePhaseQualityGates, isReviewableRepoFile } from "./quality-gates.js";
import {
  blueprintStateUpdate,
  type StateUpdateArgs,
  type StateUpdateResult
} from "./state.js";

const REPORT_NAME = "ship-latest";
const REPORT_PATH = ".blueprint/reports/ship-latest.md";
const APPROVAL_TTL_MS = 10 * 60 * 1_000;
const TERMINAL_TTL_MS = 5 * 60 * 1_000;
const MAX_APPROVALS = 128;

const evidenceSchema = z.object({
  path: z.string().min(1),
  kind: z.enum(["review", "security", "verification", "pr-branch"])
});

const previewInputSchema = {
  cwd: z.string().optional(),
  baseBranch: z.string().min(1),
  remoteName: z.string().min(1).optional(),
  ghRepository: z.string().min(1).optional(),
  posture: z.enum(["draft", "ready"]),
  push: z.boolean(),
  createPr: z.boolean(),
  title: z.string().min(1),
  body: z.string().min(1),
  evidence: z.array(evidenceSchema).min(1),
  overwriteReport: z.boolean().optional(),
  statePatch: z.record(z.string(), z.unknown()).optional()
};

const executeInputSchema = {
  operationId: z.string().uuid(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  confirmed: z.literal(true)
};

const persistInputSchema = {
  operationId: z.string().uuid(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  stage: z.enum(["outcome-report", "state"])
};

export type ShipEvidenceInput = {
  path: string;
  kind: "review" | "security" | "verification" | "pr-branch";
};

export type ShipPreviewArgs = {
  cwd?: string;
  baseBranch: string;
  remoteName?: string;
  ghRepository?: string;
  posture: "draft" | "ready";
  push: boolean;
  createPr: boolean;
  title: string;
  body: string;
  evidence: ShipEvidenceInput[];
  overwriteReport?: boolean;
  statePatch?: StateUpdateArgs["patch"];
};

type ProcessReceipt = {
  stage: string;
  command: "git" | "gh";
  argv: string[];
  result: QualityShippingProcessResult;
};

type EvidenceReceipt = ShipEvidenceInput & {
  contentSha256: string | null;
  coveredHead: string | null;
  coveredBase: string | null;
  outcome: "approved" | "passed" | "clean" | "blocking" | "unknown";
  phasePrefix: string | null;
  phaseDir: string | null;
};

type QualityGateInventoryEntry = {
  path: string;
  contentSha256: string;
};

type LoadedQualityGateInventoryEntry = QualityGateInventoryEntry & {
  content: string;
};

type GhFailureReason =
  | "gh-missing"
  | "gh-unauthenticated"
  | "gh-repository-unavailable"
  | "pr-view-unavailable"
  | "pr-create-failed";

type ExistingPr = {
  disposition: "absent" | "exact" | "divergent";
  url: string | null;
  headOid: string | null;
};

export type ShipApprovalPacket = {
  schemaVersion: 1;
  operation: "ship";
  repoRoot: string;
  gitCommonDir: string;
  branch: string;
  head: string;
  baseBranch: string;
  baseOid: string;
  mergeBase: string;
  candidateCommits: string[];
  changedPaths: string[];
  reviewablePaths: string[];
  remote: {
    name: string;
    fetchUrl: string;
    pushUrl: string;
    headRef: string;
    observedHeadOid: string | null;
    baseRef: string;
    observedBaseOid: string;
  };
  upstream: string;
  ghRepository: { selector: string; url: string } | null;
  gitConfigSha256: string;
  blueprintConfig: {
    sha256: string;
    codeReview: boolean;
    securePhase: boolean;
    baseBranch: string | null;
    branchingStrategy: string;
    commitDocs: boolean;
    noUat: boolean;
    provenance: unknown;
  };
  posture: "draft" | "ready";
  pushRequested: boolean;
  prRequested: boolean;
  title: string;
  bodySha256: string;
  evidence: EvidenceReceipt[];
  qualityGateInventory: {
    phaseDir: string;
    entries: QualityGateInventoryEntry[];
  };
  gate: {
    reviewRequired: boolean;
    securityRequired: boolean;
    reviewSatisfied: boolean;
    securitySatisfied: boolean;
  };
  existingPr: ExistingPr;
  report: {
    path: typeof REPORT_PATH;
    overwriteApproved: boolean;
    priorExists: boolean;
    priorContentSha256: string | null;
    preMutationContentSha256: string;
  };
  statePatch: StateUpdateArgs["patch"] | null;
  executionPlan: Array<{ stage: "push" | "pr-create"; command: "git" | "gh"; argv: string[] }>;
};

type PreviewResult = {
  status: "ready" | "blocked" | "invalid";
  operationId: string | null;
  fingerprint: string | null;
  packet: ShipApprovalPacket | null;
  waitingState: "ship-confirmation" | "report-overwrite-confirmation" | null;
  blockers: string[];
  warnings: string[];
};

export type ShipExecutionResult = {
  status: "blocked" | "stale" | "succeeded" | "partial" | "failed" | "outcome-unknown";
  stage: "approval" | "revalidate" | "pre-report" | "push" | "pr-create" | "outcome-report" | "state" | "persistence-recovery";
  operationId: string;
  fingerprint: string;
  externalMutationStarted: boolean;
  push: {
    status: "not-requested" | "not-attempted" | "pushed" | "reused" | "failed" | "outcome-unknown";
    remoteHeadBefore: string | null;
    remoteHeadAfter: string | null;
  };
  pr: {
    status: "not-requested" | "not-attempted" | "created" | "reused" | "failed" | "outcome-unknown";
    url: string | null;
  };
  gh: {
    status: "not-requested" | "ready" | GhFailureReason;
    detail: string | null;
  };
  processes: ProcessReceipt[];
  report: {
    path: typeof REPORT_PATH;
    preMutationStatus: "not-attempted" | "created" | "updated" | "reused" | "failed";
    outcomeStatus: "not-attempted" | "created" | "updated" | "reused" | "failed";
    error: string | null;
  };
  state: {
    status: "not-requested" | "not-attempted" | "updated" | "unchanged" | "failed";
    path: string | null;
    error: string | null;
  };
  blockers: string[];
  warnings: string[];
  recoveryActions: string[];
};

type ReportResult = Awaited<ReturnType<typeof blueprintArtifactReportWrite>>;
type ReportWriter = (args: {
  cwd?: string;
  reportName: string;
  content?: string;
  overwrite?: boolean;
  expectedExistingContentSha256?: string | null;
}) => Promise<ReportResult>;
type StateUpdater = (args: StateUpdateArgs) => Promise<StateUpdateResult>;
type ConfigReader = (args: { cwd?: string; scope: "effective" }) => ReturnType<typeof blueprintConfigGet>;

type StoredApproval = {
  packet: ShipApprovalPacket;
  fingerprint: string;
  body: string;
  preMutationReportContent: string;
  consumed: boolean;
  createdAt: number;
  expiresAt: number;
  terminalExpiresAt: number | null;
  lastResult: ShipExecutionResult | null;
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
let stateUpdater: StateUpdater = blueprintStateUpdate;
let configReader: ConfigReader = blueprintConfigGet;
let remoteSelectorResolver: (remoteUrl: string) => string | null = selectorFromRemoteUrl;
let nowProvider = () => Date.now();
let approvalTtlMs = APPROVAL_TTL_MS;
let terminalTtlMs = TERMINAL_TTL_MS;
let maxApprovals = MAX_APPROVALS;

export const shipToolTestHooks = {
  canonicalEvidenceRoleForTest(evidencePath: string): ReturnType<typeof canonicalEvidenceRole> {
    return canonicalEvidenceRole(evidencePath);
  },
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
  setStateUpdaterForTest(updater: StateUpdater): () => void {
    const previous = stateUpdater;
    stateUpdater = updater;
    return () => { stateUpdater = previous; };
  },
  setConfigReaderForTest(reader: ConfigReader): () => void {
    const previous = configReader;
    configReader = reader;
    return () => { configReader = previous; };
  },
  setRemoteSelectorResolverForTest(resolver: (remoteUrl: string) => string | null): () => void {
    const previous = remoteSelectorResolver;
    remoteSelectorResolver = resolver;
    return () => { remoteSelectorResolver = previous; };
  },
  clearApprovalsForTest(): void { approvals.clear(); },
  mutateApprovalForTest(
    operationId: string,
    mutate: (packet: ShipApprovalPacket) => void,
    rebindStoredFingerprint = false
  ): string | null {
    const stored = approvals.get(operationId);
    if (!stored) return null;
    mutate(stored.packet);
    if (rebindStoredFingerprint) stored.fingerprint = approvalFingerprint(stored.packet);
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
      approvals.clear();
    };
  }
};

function pruneApprovals(forInsertion = false): void {
  const now = nowProvider();
  for (const [id, stored] of approvals) {
    const expiry = stored.consumed ? stored.terminalExpiresAt ?? stored.expiresAt : stored.expiresAt;
    if (expiry <= now) approvals.delete(id);
  }
  while (forInsertion && approvals.size >= maxApprovals) {
    const oldest = [...approvals.entries()].sort(([, a], [, b]) => a.createdAt - b.createdAt)[0];
    if (!oldest) break;
    approvals.delete(oldest[0]);
  }
}

function succeeded(result: QualityShippingProcessResult): boolean {
  return result.exitCode === 0 && result.signal === null && !result.timedOut;
}

function abnormal(result: QualityShippingProcessResult): boolean {
  return result.exitCode === null || result.signal !== null || result.timedOut;
}

async function run(command: "git" | "gh", cwd: string, argv: readonly string[]): Promise<QualityShippingProcessResult> {
  return processRunner(command, argv, cwd, qualityShippingGitEnvironment());
}

async function gitText(cwd: string, argv: readonly string[], label: string): Promise<string> {
  const result = await run("git", cwd, argv);
  if (!succeeded(result)) throw new Error(`${label} failed: ${result.stderr || result.stdout || `exit ${String(result.exitCode)}`}`);
  return result.stdout.trim();
}

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
}

function rejectLiteral(value: string, label: string): void {
  if (!value || value.startsWith("-") || value.includes("\0") || /[\r\n]/.test(value)) {
    throw new Error(`${label} is unsafe or ambiguous.`);
  }
}

async function inProgressState(commonDir: string): Promise<string[]> {
  const markers = [["merge", "MERGE_HEAD"], ["cherry-pick", "CHERRY_PICK_HEAD"], ["revert", "REVERT_HEAD"], ["rebase-merge", "rebase-merge"], ["rebase-apply", "rebase-apply"], ["sequencer", "sequencer"], ["bisect", "BISECT_LOG"]] as const;
  const found: string[] = [];
  for (const [label, marker] of markers) if (await exists(path.join(commonDir, marker))) found.push(label);
  return found;
}

async function snapshot(cwd: string): Promise<Snapshot> {
  const root = await realpath(await gitText(cwd, ["rev-parse", "--show-toplevel"], "repository discovery"));
  const commonRaw = await gitText(root, ["rev-parse", "--git-common-dir"], "git common-dir discovery");
  const common = await realpath(path.resolve(root, commonRaw));
  const [branch, head, status, config] = await Promise.all([
    run("git", root, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
    run("git", root, ["rev-parse", "--verify", "HEAD"]),
    run("git", root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    run("git", root, ["config", "--null", "--list"])
  ]);
  if (!succeeded(head) || !succeeded(status) || !succeeded(config)) throw new Error("Repository HEAD, status, or effective git config could not be inspected.");
  return { repoRoot: root, gitCommonDir: common, branch: succeeded(branch) ? branch.stdout.trim() : null,
    head: head.stdout.trim() || null, status: status.stdout, gitConfigSha256: qualityShippingSha256(config.stdout),
    inProgressState: await inProgressState(common) };
}

async function resolveCommit(repoRoot: string, ref: string, label: string): Promise<string> {
  rejectLiteral(ref, label);
  const result = await run("git", repoRoot, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]);
  const oid = result.stdout.trim();
  if (!succeeded(result) || !isCanonicalFullGitHash(oid)) throw new Error(`${label} does not resolve to one unambiguous commit.`);
  return oid;
}

async function remoteOid(repoRoot: string, pushUrl: string, ref: string): Promise<string | null> {
  const result = await run("git", repoRoot, ["ls-remote", "--exit-code", "--heads", "--", pushUrl, ref]);
  if (result.exitCode === 2 && !result.signal && !result.timedOut) return null;
  if (!succeeded(result)) throw new Error(`Remote ref inspection failed: ${result.stderr || result.stdout || `exit ${String(result.exitCode)}`}`);
  const oid = result.stdout.trim().split(/\s+/, 1)[0] ?? "";
  if (!isCanonicalFullGitHash(oid)) throw new Error("Remote ref inspection returned an invalid object id.");
  return oid;
}

type LoadedEvidence = EvidenceReceipt & { content: string | null };

function decodeCanonicalMarkdown(bytes: Buffer, evidencePath: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Canonical Markdown authority ${evidencePath} is not valid UTF-8; replacement decoding is forbidden.`);
  }
}

function canonicalEvidenceRole(evidencePath: string): { kind: ShipEvidenceInput["kind"]; phasePrefix: string | null; phaseDir: string | null } | null {
  if (evidencePath === ".blueprint/reports/pr-branch-latest.md") return { kind: "pr-branch", phasePrefix: null, phaseDir: null };
  const match = evidencePath.match(/^\.blueprint\/phases\/([^/]+)\/(\d+(?:\.\d+)?)-(REVIEW|SECURITY|VERIFICATION)\.md$/);
  if (!match) return null;
  const directoryPrefix = match[1]!.match(/^(\d+(?:\.\d+)?)-/)?.[1] ?? null;
  if (directoryPrefix !== match[2]) return null;
  const kind = match[3] === "REVIEW" ? "review" : match[3] === "SECURITY" ? "security" : "verification";
  return { kind, phasePrefix: match[2]!, phaseDir: `.blueprint/phases/${match[1]!}` };
}

async function evidenceReceipts(repoRoot: string, inputs: ShipEvidenceInput[]): Promise<LoadedEvidence[]> {
  const output: LoadedEvidence[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    rejectLiteral(input.path, "Evidence path");
    if (path.isAbsolute(input.path) || input.path.split(/[\\/]+/).includes("..")) throw new Error("Evidence paths must be safe repo-relative paths.");
    const normalized = input.path.replaceAll("\\", "/").replace(/^\.\//, "");
    if (seen.has(normalized)) throw new Error("Each evidence path may be supplied only once.");
    seen.add(normalized);
    const role = canonicalEvidenceRole(normalized);
    if (!role) throw new Error(`Evidence path ${normalized} is not a canonical phase quality artifact or pr-branch-latest receipt.`);
    if (role.kind !== input.kind) throw new Error(`Evidence kind ${input.kind} does not match the canonical ${role.kind} role derived from ${normalized}.`);
    const absolutePath = path.resolve(repoRoot, normalized);
    const lexicalRelative = path.relative(repoRoot, absolutePath);
    if (lexicalRelative === ".." || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
      throw new Error(`Evidence path ${normalized} escapes the canonical repository.`);
    }
    try {
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink()) {
        try {
          const linkedPath = await realpath(absolutePath);
          const linkedRelative = path.relative(repoRoot, linkedPath);
          if (linkedRelative === ".." || linkedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(linkedRelative)) {
            throw new Error(`Evidence path ${normalized} resolves outside the canonical repository.`);
          }
        } catch (error) {
          if (error instanceof Error && /resolves outside/.test(error.message)) throw error;
          throw new Error(`Evidence path ${normalized} is a broken or unresolvable symlink.`);
        }
        throw new Error(`Evidence path ${normalized} is a symlink; evidence inputs must be canonical repository files.`);
      }
      const resolvedPath = await realpath(absolutePath);
      const resolvedRelative = path.relative(repoRoot, resolvedPath);
      if (resolvedRelative === ".." || resolvedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(resolvedRelative)) {
        throw new Error(`Evidence path ${normalized} resolves outside the canonical repository.`);
      }
      const canonicalPath = resolvedRelative.replaceAll("\\", "/");
      if (canonicalPath !== normalized) {
        throw new Error(`Evidence path ${normalized} uses a symlink or non-canonical repository alias.`);
      }
      const bytes = await readFile(resolvedPath);
      const content = decodeCanonicalMarkdown(bytes, canonicalPath);
      output.push({ ...input, path: canonicalPath, contentSha256: qualityShippingSha256(bytes), coveredHead: null,
        coveredBase: null, outcome: "unknown", phasePrefix: role.phasePrefix, phaseDir: role.phaseDir, content });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT")) throw error;
      output.push({ ...input, path: normalized, contentSha256: null, coveredHead: null, coveredBase: null, outcome: "unknown",
        phasePrefix: role.phasePrefix, phaseDir: role.phaseDir, content: null });
    }
  }
  return output;
}

function lineValue(content: string, label: string): string | null {
  return content.match(new RegExp(`^- ${label.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}: (.+)$`, "m"))?.[1]?.trim() ?? null;
}

function parsePrBranchDigestInputs(content: string): Array<{ path: string; sha256: string }> | null {
  const raw = lineValue(content, "Digest inputs used");
  if (!raw) return null;
  const entries: Array<{ path: string; sha256: string }> = [];
  for (const token of raw.split(", ")) {
    const split = token.lastIndexOf(":");
    if (split <= 0) return null;
    const evidencePath = token.slice(0, split);
    const sha256 = token.slice(split + 1);
    if (!/^[0-9a-f]{64}$/.test(sha256)) return null;
    entries.push({ path: evidencePath, sha256 });
  }
  return entries;
}

async function loadQualityGateInventory(repoRoot: string, phaseDir: string): Promise<LoadedQualityGateInventoryEntry[]> {
  const absoluteDir = path.resolve(repoRoot, phaseDir);
  const metadata = await lstat(absoluteDir);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`Canonical phase directory ${phaseDir} must be one real directory.`);
  const resolvedDir = await realpath(absoluteDir);
  if (resolvedDir !== absoluteDir) throw new Error(`Canonical phase directory ${phaseDir} resolves through a non-canonical alias.`);
  const entries = await readdir(resolvedDir, { withFileTypes: true });
  const output: LoadedQualityGateInventoryEntry[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`Canonical phase inventory entry ${phaseDir}/${entry.name} must be one regular non-symlink file.`);
    }
    const absolute = path.join(resolvedDir, entry.name);
    const resolved = await realpath(absolute);
    if (resolved !== absolute) throw new Error(`Canonical phase inventory entry ${phaseDir}/${entry.name} resolves through a non-canonical alias.`);
    const inventoryPath = `${phaseDir}/${entry.name}`;
    const bytes = await readFile(resolved);
    const content = decodeCanonicalMarkdown(bytes, inventoryPath);
    output.push({ path: inventoryPath, contentSha256: qualityShippingSha256(bytes), content });
  }
  return output;
}

async function validateAuthoritativeEvidence(args: {
  repoRoot: string;
  evidence: LoadedEvidence[];
  head: string;
  baseBranch: string;
  baseOid: string;
  branch: string;
  reviewablePaths: string[];
  config: ShipApprovalPacket["blueprintConfig"];
}): Promise<{ receipts: EvidenceReceipt[]; inventory: ShipApprovalPacket["qualityGateInventory"] | null; blockers: string[] }> {
  const blockers: string[] = [];
  const byKind = (kind: ShipEvidenceInput["kind"]) => args.evidence.filter((entry) => entry.kind === kind);
  const reviewRequired = args.config.codeReview && args.reviewablePaths.length > 0;
  const securityRequired = reviewRequired && args.config.securePhase;
  if (byKind("verification").length !== 1) blockers.push("Exactly one canonical verification evidence artifact is required.");
  if (byKind("pr-branch").length !== 1) blockers.push("Exactly one canonical pr-branch evidence artifact is required.");
  if (byKind("review").length > 1 || (reviewRequired && byKind("review").length !== 1)) blockers.push("Exactly one canonical review evidence artifact is required by the effective gate.");
  if (byKind("security").length > 1 || (securityRequired && byKind("security").length !== 1)) blockers.push("Exactly one canonical security evidence artifact is required by the effective gate.");
  if (args.evidence.some((entry) => entry.content === null)) blockers.push("Every canonical evidence artifact must exist and be readable.");
  const qualityEvidence = args.evidence.filter((entry) => entry.kind !== "pr-branch");
  const phasePrefixes = new Set(qualityEvidence.map((entry) => entry.phasePrefix));
  const phaseDirs = new Set(qualityEvidence.map((entry) => entry.phaseDir));
  if (phasePrefixes.size !== 1 || phasePrefixes.has(null)) blockers.push("Review, security, and verification evidence must belong to the same canonical phase prefix.");
  if (phaseDirs.size !== 1 || phaseDirs.has(null)) blockers.push("Review, security, and verification evidence must belong to the exact same canonical phase directory.");
  if (blockers.length > 0) return { receipts: args.evidence.map(({ content: _content, ...entry }) => entry), inventory: null, blockers };

  const review = byKind("review")[0];
  const security = byKind("security")[0];
  const verification = byKind("verification")[0]!;
  const prBranch = byKind("pr-branch")[0]!;
  const qualityArtifacts = [review, security, verification].filter((entry): entry is LoadedEvidence => entry !== undefined);
  const qualityDigests = qualityArtifacts.map((entry) => entry.contentSha256);
  if (new Set(qualityDigests).size !== qualityDigests.length) blockers.push("Review, security, and verification evidence must have pairwise-distinct content digests.");

  if (review) {
    const reviewValidation = validateReviewArtifactContent(review.content!, "code-review");
    const reviewScope = validateReviewArtifactScopeCoverage(review.content!, args.reviewablePaths);
    if (!reviewValidation.valid) blockers.push(`Canonical review evidence is invalid: ${reviewValidation.issues.join(" ")}`);
    if (!reviewScope.valid) blockers.push(`Canonical review scope is incomplete: ${reviewScope.issues.join(" ")}`);
    if (!/^\*\*Verdict:\*\*\s*PASS\s*$/m.test(review.content!)) blockers.push("Canonical review evidence must have Verdict PASS.");
  }

  if (security) {
    const securityValidation = validateReviewArtifactContent(security.content!, "security");
    if (!securityValidation.valid) blockers.push(`Canonical security evidence is invalid: ${securityValidation.issues.join(" ")}`);
    if (!/^\*\*Status:\*\*\s*(?:COMPLETED|PASS)\s*$/mi.test(security.content!) ||
        !/^\*\*Readiness:\*\*\s*ready-for-routing\s*$/mi.test(security.content!) ||
        !/^\*\*Completion State:\*\*\s*complete\s*$/mi.test(security.content!)) {
      blockers.push("Canonical security evidence must be completed, ready-for-routing, and complete.");
    }
  }

  const phaseDir = verification.phaseDir!;
  const loadedInventory = await loadQualityGateInventory(args.repoRoot, phaseDir);
  for (const artifact of qualityArtifacts) {
    const inventoried = loadedInventory.find((entry) => entry.path === artifact.path);
    if (!inventoried || inventoried.contentSha256 !== artifact.contentSha256) {
      blockers.push(`Canonical evidence ${artifact.path} changed while the phase quality-gate inventory was being bound.`);
    }
  }
  const summaryPaths = loadedInventory.filter((entry) => /-SUMMARY\.md$/.test(entry.path)).map((entry) => entry.path);
  const verificationValidation = validateVerificationArtifactContent(verification.content!, summaryPaths, { noUat: args.config.noUat });
  if (!verificationValidation.valid) blockers.push(`Canonical verification evidence is invalid: ${verificationValidation.issues.join(" ")}`);
  if (!isVerificationArtifactReadyForUat(verification.content!)) blockers.push("Canonical verification evidence must be PASS and ready for UAT.");

  const phasePrefix = verification.phasePrefix!;
  const quality = await evaluatePhaseQualityGates({ projectRoot: args.repoRoot, phaseNumber: phasePrefix, phasePrefix,
    phaseDir, artifacts: { all: loadedInventory.map((entry) => ({ path: entry.path, content: entry.content })) } });
  if (quality.requiresCodeReview !== reviewRequired || quality.requiresSecurePhase !== securityRequired) {
    blockers.push("Canonical phase quality-gate requirements do not reconcile with the current base-to-HEAD reviewable scope and effective config.");
  }
  if ((reviewRequired || securityRequired) && (!quality.gatesSatisfied || quality.reviewDebtKind !== null || quality.securityDebtKind !== null)) {
    blockers.push(`Canonical phase quality gates are not satisfied (${quality.missingGate ?? quality.reviewDebtKind ?? quality.securityDebtKind ?? "quality debt"}).`);
  }

  const pr = prBranch.content!;
  const created = lineValue(pr, "Created branch")?.match(/^(.+) \(([0-9a-f]{40}|[0-9a-f]{64})\)$/);
  const base = lineValue(pr, "Base branch")?.match(/^(.+) \(([0-9a-f]{40}|[0-9a-f]{64})\)$/);
  const candidate = lineValue(pr, "Candidate branch");
  const digests = parsePrBranchDigestInputs(pr);
  const expected = qualityArtifacts.map((entry) => `${entry.path}:${entry.contentSha256}`).sort();
  const actual = digests?.map((entry) => `${entry.path}:${entry.sha256}`).sort() ?? [];
  const liveCreated = created ? await resolveCommit(args.repoRoot, `refs/heads/${created[1]}`, "PR branch receipt branch") : null;
  if (lineValue(pr, "Execution mode") !== "confirmed-replay actual outcome" || candidate !== args.branch || created?.[1] !== args.branch ||
      created?.[2] !== args.head || liveCreated !== args.head || base?.[1] !== args.baseBranch || base?.[2] !== args.baseOid ||
      lineValue(pr, "Clean review branch status") !== "clean" || lineValue(pr, "Clean final checkout status") !== "clean" ||
      lineValue(pr, "Recovery or blocker") !== "blockers=none; recovery=none") {
    blockers.push("pr-branch-latest is not a successful current branch/HEAD/base clean confirmed receipt.");
  }
  if (qualityShippingFingerprint(actual) !== qualityShippingFingerprint(expected)) {
    blockers.push("pr-branch-latest Digest inputs used must link exactly once to the supplied review, security, and verification digests.");
  }

  const approved = blockers.length === 0;
  return { receipts: args.evidence.map(({ content: _content, ...entry }) => ({ ...entry, coveredHead: approved ? args.head : null,
    coveredBase: approved ? args.baseOid : null, outcome: approved ? (entry.kind === "verification" ? "passed" : "approved") : "blocking" })),
    inventory: { phaseDir, entries: loadedInventory.map(({ content: _content, ...entry }) => entry) }, blockers };
}

async function configReceipt(repoRoot: string): Promise<ShipApprovalPacket["blueprintConfig"]> {
  const result = await configReader({ cwd: repoRoot, scope: "effective" });
  const selected = {
    codeReview: result.config.workflow.code_review,
    securePhase: result.config.workflow.secure_phase,
    baseBranch: result.config.git.base_branch,
    branchingStrategy: result.config.git.branching_strategy,
    commitDocs: result.config.planning.commit_docs,
    noUat: result.config.workflow.no_uat,
    provenance: result.provenance
  };
  return { ...selected, sha256: qualityShippingFingerprint(selected) };
}

async function reportReceipt(repoRoot: string): Promise<{ exists: boolean; sha256: string | null }> {
  try {
    const content = await readFile(path.join(repoRoot, REPORT_PATH));
    return { exists: true, sha256: qualityShippingSha256(content) };
  } catch { return { exists: false, sha256: null }; }
}

function reportStatus(result: ReportResult): "created" | "updated" | "reused" | "failed" {
  if (result.status === "invalid") return "failed";
  if (result.status === "created" || result.status === "updated" || result.status === "reused") return result.status;
  return "failed";
}

async function inspectExistingPr(repoRoot: string, selector: string, branch: string, base: string, head: string, posture: "draft" | "ready"): Promise<ExistingPr> {
  const result = await run("gh", repoRoot, ["pr", "view", branch, "--repo", selector, "--json", "url,headRefName,baseRefName,isDraft,state,headRefOid"]);
  if (!succeeded(result)) {
    if (result.exitCode === 1 && /no pull requests? found|no pull request|could not resolve to a pull request/i.test(`${result.stderr}\n${result.stdout}`)) {
      return { disposition: "absent", url: null, headOid: null };
    }
    throw new Error(`Existing PR inspection failed and absence is not authoritative: ${result.stderr || result.stdout || `exit ${String(result.exitCode)}`}`);
  }
  try {
    const value = JSON.parse(result.stdout) as Record<string, unknown>;
    const exact = value.headRefName === branch && value.baseRefName === base && value.headRefOid === head &&
      value.state === "OPEN" && value.isDraft === (posture === "draft") && typeof value.url === "string";
    if (!exact) return { disposition: "divergent", url: typeof value.url === "string" ? value.url : null,
      headOid: typeof value.headRefOid === "string" ? value.headRefOid : null };
    return { disposition: "exact", url: String(value.url), headOid: head };
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("gh returned malformed existing-PR metadata.");
    throw error;
  }
}

function baseResult(packet: ShipApprovalPacket | null, operationId: string, fingerprint: string): ShipExecutionResult {
  return { status: "blocked", stage: "approval", operationId, fingerprint, externalMutationStarted: false,
    push: { status: packet?.pushRequested ? "not-attempted" : "not-requested", remoteHeadBefore: packet?.remote.observedHeadOid ?? null, remoteHeadAfter: null },
    pr: { status: packet?.prRequested ? "not-attempted" : "not-requested", url: packet?.existingPr.url ?? null }, processes: [],
    gh: { status: packet?.prRequested ? "ready" : "not-requested", detail: null },
    report: { path: REPORT_PATH, preMutationStatus: "not-attempted", outcomeStatus: "not-attempted", error: null },
    state: { status: packet?.statePatch ? "not-attempted" : "not-requested", path: null, error: null },
    blockers: [], warnings: [], recoveryActions: [] };
}

function planFor(packet: Omit<ShipApprovalPacket, "executionPlan">, body: string): ShipApprovalPacket["executionPlan"] {
  const plan: ShipApprovalPacket["executionPlan"] = [];
  if (packet.pushRequested && packet.remote.observedHeadOid !== packet.head) {
    plan.push({ stage: "push", command: "git", argv: ["push", "--porcelain", "--", packet.remote.pushUrl, `${packet.head}:${packet.remote.headRef}`] });
  }
  if (packet.prRequested && packet.existingPr.disposition !== "exact") {
    plan.push({ stage: "pr-create", command: "gh", argv: ["pr", "create", "--repo", packet.ghRepository!.selector, "--base", packet.baseBranch, "--head", packet.branch,
      ...(packet.posture === "draft" ? ["--draft"] : []), "--title", packet.title, "--body", body] });
  }
  return plan;
}

function approvalFingerprint(packet: ShipApprovalPacket): string {
  return qualityShippingFingerprint({
    ...packet,
    report: { ...packet.report, preMutationContentSha256: "bound-at-write" }
  });
}

function commandText(stage: { command: string; argv: string[] } | undefined): string {
  if (!stage) return "none";
  return `${stage.command} ${stage.argv.map((value) => JSON.stringify(value)).join(" ")}`;
}

function boundedRenderedProcessText(value: string): string {
  const limit = 8_192;
  const fullyRendered = JSON.stringify(value);
  if (Buffer.byteLength(fullyRendered, "utf8") <= limit) return fullyRendered;

  const codePoints = [...value];
  const totalBytes = Buffer.byteLength(value, "utf8");
  let low = 0;
  let high = codePoints.length;
  let best = JSON.stringify(`...[truncated ${String(totalBytes)} UTF-8 bytes]`);

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const prefix = codePoints.slice(0, middle).join("");
    const omittedBytes = totalBytes - Buffer.byteLength(prefix, "utf8");
    const candidate = JSON.stringify(`${prefix}...[truncated ${String(omittedBytes)} UTF-8 bytes]`);
    if (Buffer.byteLength(candidate, "utf8") <= limit) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return best;
}

function freshPreviewRecovery(packet: ShipApprovalPacket, result: ShipExecutionResult | null): string {
  if (result?.push.status === "outcome-unknown") {
    return "Inspect and reconcile the exact remote ref before any PR creation or retry; only then obtain the appropriate completely fresh preview and never replay stale argv.";
  }
  const pushConfirmed = result?.push.status === "pushed" || result?.push.status === "reused";
  const pushStillRequired = packet.executionPlan.some((entry) => entry.stage === "push") && !pushConfirmed;
  if (pushStillRequired) {
    return `Restore gh availability/authentication and repository access, then obtain a completely fresh preview preserving the original push:${String(packet.pushRequested)} and createPr:${String(packet.prRequested)} intent; never replay stale argv.`;
  }
  return "Restore gh availability/authentication and repository access, then obtain a fresh preview with push:false and createPr:true; never replay stale gh argv.";
}

function renderReport(packet: ShipApprovalPacket, fingerprint: string, result: ShipExecutionResult | null): string {
  const pushPlan = packet.executionPlan.find((entry) => entry.stage === "push");
  const prPlan = packet.executionPlan.find((entry) => entry.stage === "pr-create");
  const processLines = result?.processes.length ? result.processes.map((entry) =>
    `- ${entry.stage}: ${entry.command} argv=${JSON.stringify(entry.argv)} exit=${String(entry.result.exitCode)} signal=${entry.result.signal ?? "none"} timedOut=${String(entry.result.timedOut)} stdout=${boundedRenderedProcessText(entry.result.stdout)} stderr=${boundedRenderedProcessText(entry.result.stderr)}`).join("\n") : "- none";
  const pushOutcome = !result ? "not-run" : result.push.status === "pushed" || result.push.status === "reused" ? "success" : result.push.status === "outcome-unknown" ? "outcome-unknown" : result.push.status === "failed" ? "failed" : result.push.status === "not-requested" ? "not-run" : "blocked";
  const prOutcome = !result ? "not-run" : result.pr.status === "created" ? "created" : result.pr.status === "reused" ? "updated" : result.pr.status === "outcome-unknown" ? "outcome-unknown" : result.pr.status === "failed" ? "failed" : result.pr.status === "not-requested" ? "not-run" : "blocked";
  const evidence = packet.evidence.map((entry) => `${entry.kind}:${entry.path}@${entry.contentSha256 ?? "missing"}`).join(", ");
  const recovery = result?.recoveryActions.length ? result.recoveryActions : ["Verify the approved push URL and remote ref.", freshPreviewRecovery(packet, result), "Route the next action from the durable receipt."];
  const ghStatus = result?.gh.status ?? (packet.prRequested ? "ready" : "not-requested");
  const ghFallbackRequired = result !== null && ghStatus !== "ready" && ghStatus !== "not-requested";
  const ghFallback = freshPreviewRecovery(packet, result);
  return `# Ship Report

## Selected Scope

- **Scope:** current-branch
- **Source branch:** ${packet.branch}
- **Source HEAD:** ${packet.head}
- **Base branch:** ${packet.baseBranch}
- **Execution mode:** ${result ? (result.status === "blocked" || result.status === "stale" ? "blocked" : "confirmed-run") : "preview-only"}
- **Draft or ready mode:** ${packet.posture}
- **Config used:** git.base_branch=${packet.blueprintConfig.baseBranch ?? "none"}; git.branching_strategy=${packet.blueprintConfig.branchingStrategy}; planning.commit_docs=${String(packet.blueprintConfig.commitDocs)}
- **Current branch:** ${packet.branch}

## Saved Evidence

- **Digest inputs used:** ${packet.evidence.map((entry) => entry.path).join(", ")}
- **Saved evidence paths:** ${evidence}
- **Tracked files:** ${packet.changedPaths.join(", ") || "none"}
- **Draft PR body source:** generated body sha256=${packet.bodySha256}

## Branch Plan

- **Push requested:** ${String(packet.pushRequested)}
- **PR requested:** ${String(packet.prRequested)}
- **Git commands approved:** ${commandText(pushPlan)}

## Remote Actions

- **gh commands approved:** ${commandText(prPlan)}
- **gh availability and auth:** ${ghStatus}
- **gh detail:** ${result?.gh.detail ?? "none"}

## Push Or PR Outcome

- **Push outcome:** ${pushOutcome}
- **PR outcome:** ${prOutcome}
- **Outcome blockers:** ${result?.blockers.join("; ") || "none"}
- **Outcome recovery:** ${result?.recoveryActions.join("; ") || "none"}
- **gh fallback notes:** ${ghFallbackRequired || result?.pr.status === "failed" || result?.pr.status === "outcome-unknown" ? ghFallback : "none"}

## Manual Fallback Guidance

- **Manual checklist:**
  1. ${recovery[0] ?? "Inspect the durable receipt."}
  2. ${recovery[1] ?? "Do not duplicate external mutation."}
  3. ${recovery[2] ?? "Run /blu-progress after recovery."}

## Runtime Receipt

- Approval fingerprint: ${fingerprint}
- Repository: ${packet.repoRoot}
- Git common directory: ${packet.gitCommonDir}
- Remote: ${packet.remote.name}; fetch=${packet.remote.fetchUrl}; push=${packet.remote.pushUrl}
- GitHub repository: ${packet.ghRepository ? `${packet.ghRepository.selector} ${packet.ghRepository.url}` : "not-requested"}
- gh status: ${result?.gh.status ?? (packet.prRequested ? "ready" : "not-requested")}${result?.gh.detail ? ` (${result.gh.detail})` : ""}
- Remote head before: ${packet.remote.observedHeadOid ?? "absent"}
- Remote head after: ${result?.push.remoteHeadAfter ?? "not-observed"}
- Base OID: ${packet.baseOid}
- Merge base: ${packet.mergeBase}
- Blueprint config sha256: ${packet.blueprintConfig.sha256}
- PR URL: ${result?.pr.url ?? packet.existingPr.url ?? "none"}
- State persistence: ${result?.state.status ?? (packet.statePatch ? "not-attempted" : "not-requested")}${result?.state.path ? ` at ${result.state.path}` : ""}${result?.state.error ? ` error=${result.state.error}` : ""}
- Process receipts:
${processLines}

## Next Safe Action

- ${result?.status === "succeeded" ? "/blu-progress" : recovery[0] ?? "Inspect the durable ship receipt."}
`;
}

function gateFor(evidence: EvidenceReceipt[], head: string, base: string, config: ShipApprovalPacket["blueprintConfig"], reviewablePaths: string[]): ShipApprovalPacket["gate"] {
  const satisfies = (kind: EvidenceReceipt["kind"]) => evidence.some((entry) => entry.kind === kind && entry.contentSha256 !== null &&
    entry.coveredHead === head && entry.coveredBase === base && ["approved", "passed", "clean"].includes(entry.outcome));
  const reviewRequired = config.codeReview && reviewablePaths.length > 0;
  const securityRequired = reviewRequired && config.securePhase;
  return { reviewRequired, securityRequired, reviewSatisfied: !reviewRequired || satisfies("review"),
    securitySatisfied: !securityRequired || satisfies("security") };
}

function selectorFromRemoteUrl(remoteUrl: string): string | null {
  const https = remoteUrl.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (https) return `${https[1]}/${https[2]}/${https[3]}`;
  const scp = remoteUrl.match(/^[^@\s]+@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
  if (scp) return `${scp[1]}/${scp[2]}/${scp[3]}`;
  const ssh = remoteUrl.match(/^ssh:\/\/(?:[^@/]+@)?([^/]+)\/([^/]+)\/(.+?)(?:\.git)?\/?$/);
  return ssh ? `${ssh[1]}/${ssh[2]}/${ssh[3]}` : null;
}

async function ghPreflight(repoRoot: string, selector: string): Promise<{ blockers: string[]; url: string | null; failure: GhFailureReason | null }> {
  const blockers: string[] = [];
  let failure: GhFailureReason | null = null;
  rejectLiteral(selector, "GitHub repository selector");
  if (!/^(?:[^/\s]+\/)?[^/\s]+\/[^/\s]+$/.test(selector)) blockers.push("GitHub repository selector must be exact [host/]owner/repo syntax.");
  const available = await run("gh", repoRoot, ["--version"]);
  if (!succeeded(available)) { failure = "gh-missing"; blockers.push(abnormal(available) ? "gh could not be spawned or observed." : "gh is unavailable."); }
  if (blockers.length === 0) {
    const parts = selector.split("/");
    const auth = await run("gh", repoRoot, parts.length === 3 ? ["auth", "status", "--hostname", parts[0]!] : ["auth", "status"]);
    if (!succeeded(auth)) { failure = "gh-unauthenticated"; blockers.push(abnormal(auth) ? "gh authentication status could not be observed." : "gh is unauthenticated."); }
  }
  let url: string | null = null;
  if (blockers.length === 0) {
    const repository = await run("gh", repoRoot, ["repo", "view", "--repo", selector, "--json", "nameWithOwner,url"]);
    if (!succeeded(repository)) { failure = "gh-repository-unavailable"; blockers.push("GitHub repository selector could not be verified."); }
    else {
      try {
        const parsed = JSON.parse(repository.stdout) as Record<string, unknown>;
        const ownerRepo = selector.split("/").slice(-2).join("/");
        if (parsed.nameWithOwner !== ownerRepo || typeof parsed.url !== "string") { failure = "gh-repository-unavailable"; blockers.push("GitHub repository verification did not match the exact approved selector."); }
        else url = parsed.url;
      } catch { failure = "gh-repository-unavailable"; blockers.push("GitHub repository verification returned malformed metadata."); }
    }
  }
  return { blockers, url, failure };
}

async function singleEffectiveRemoteUrl(repoRoot: string, remoteName: string, push: boolean): Promise<string> {
  const argv = ["remote", "get-url", ...(push ? ["--push"] : []), "--all", remoteName];
  const value = await gitText(repoRoot, argv, push ? "effective remote push URL" : "effective remote fetch URL");
  const urls = value.split(/\r?\n/).filter(Boolean);
  if (urls.length !== 1 || urls[0]!.includes("\0")) {
    throw new Error(`Remote ${remoteName} must resolve to exactly one effective ${push ? "push" : "fetch"} URL.`);
  }
  const url = urls[0]!;
  if (push) await assertResolvedPushUrlStable(repoRoot, url);
  return url;
}

async function assertResolvedPushUrlStable(repoRoot: string, pushUrl: string): Promise<void> {
  const rules = await run("git", repoRoot, ["config", "--null", "--get-regexp", "^url\\..*\\.(insteadof|pushinsteadof)$"]);
  if (rules.exitCode === 1 && !rules.signal && !rules.timedOut) return;
  if (!succeeded(rules)) throw new Error("Effective Git URL rewrite rules could not be inspected safely.");
  const matchingPrefixes = rules.stdout.split("\0").filter(Boolean).flatMap((entry) => {
    const split = entry.indexOf("\n");
    return split < 0 ? [] : [entry.slice(split + 1)];
  }).filter((prefix) => prefix.length > 0 && pushUrl.startsWith(prefix));
  if (matchingPrefixes.length > 0) {
    throw new Error("The resolved effective push URL is itself matched by a Git insteadOf/pushInsteadOf rule; recursive endpoint rewriting is ambiguous and shipping fails closed.");
  }
}

export async function blueprintShipPreview(args: ShipPreviewArgs): Promise<PreviewResult> {
  pruneApprovals(true);
  try {
    rejectLiteral(args.baseBranch, "Base branch");
    if (args.remoteName) rejectLiteral(args.remoteName, "Remote name");
    if (args.ghRepository) rejectLiteral(args.ghRepository, "GitHub repository selector");
    const snap = await snapshot(args.cwd ?? process.cwd());
    const blockers: string[] = [];
    const policyWarnings: string[] = [];
    if (!snap.branch) blockers.push("Detached HEAD is unsupported.");
    if (!snap.head) blockers.push("Repository HEAD is missing.");
    if (snap.status.length > 0) blockers.push("Working tree and index must be clean.");
    if (snap.inProgressState.length > 0) blockers.push(`In-progress git state: ${snap.inProgressState.join(", ")}.`);
    if (!snap.branch || !snap.head) return { status: "blocked", operationId: null, fingerprint: null, packet: null, waitingState: null, blockers, warnings: [] };
    const branchCheck = await run("git", snap.repoRoot, ["check-ref-format", "--branch", snap.branch]);
    const baseCheck = await run("git", snap.repoRoot, ["check-ref-format", "--branch", args.baseBranch]);
    if (!succeeded(branchCheck) || branchCheck.stdout.trim() !== snap.branch) blockers.push("Current branch is unsafe or ref-like.");
    if (!succeeded(baseCheck) || baseCheck.stdout.trim() !== args.baseBranch) blockers.push("Base branch is invalid or ref-like.");
    const baseOid = await resolveCommit(snap.repoRoot, `refs/heads/${args.baseBranch}`, "Base branch");
    const mergeBase = await gitText(snap.repoRoot, ["merge-base", baseOid, snap.head], "merge-base");
    if (mergeBase !== baseOid) blockers.push("Base branch must be an ancestor of the shipping HEAD.");
    const commits = (await gitText(snap.repoRoot, ["rev-list", "--reverse", `${baseOid}..${snap.head}`], "shipping commit ledger")).split(/\r?\n/).filter(Boolean);
    if (commits.length === 0) blockers.push("Shipping branch has no commits ahead of the base.");
    const changedRaw = await gitText(snap.repoRoot, ["diff", "--name-only", "-z", baseOid, snap.head, "--", "."], "shipping changed paths");
    const changedPaths = changedRaw.split("\0").filter(Boolean).sort();
    const reviewablePaths = changedPaths.filter(isReviewableRepoFile);
    const remotes = (await gitText(snap.repoRoot, ["remote"], "remote discovery")).split(/\r?\n/).filter(Boolean);
    const remoteName = args.remoteName ?? (remotes.length === 1 ? remotes[0] : null);
    if (!remoteName || !remotes.includes(remoteName)) blockers.push(args.remoteName ? "Requested remote does not exist." : "Remote is ambiguous; specify one exact remote name.");
    if (!remoteName) return { status: "blocked", operationId: null, fingerprint: null, packet: null, waitingState: null, blockers, warnings: [] };
    const [fetchUrl, pushUrl] = await Promise.all([
      singleEffectiveRemoteUrl(snap.repoRoot, remoteName, false),
      singleEffectiveRemoteUrl(snap.repoRoot, remoteName, true)
    ]);
    const upstreamResult = await run("git", snap.repoRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
    const upstream = succeeded(upstreamResult) ? upstreamResult.stdout.trim() : "";
    if (upstream !== `${remoteName}/${snap.branch}`) blockers.push(upstream ? `Upstream ${upstream} does not match ${remoteName}/${snap.branch}.` : "Current branch has no exact upstream.");
    const headRef = `refs/heads/${snap.branch}`;
    const baseRef = `refs/heads/${args.baseBranch}`;
    const [observedHeadOid, observedBaseOid] = await Promise.all([remoteOid(snap.repoRoot, pushUrl, headRef), remoteOid(snap.repoRoot, pushUrl, baseRef)]);
    if (!observedBaseOid) blockers.push("Remote base branch is missing.");
    else if (observedBaseOid !== baseOid) blockers.push("Local base branch does not equal the exact remote base branch.");
    if (observedHeadOid && observedHeadOid !== snap.head) {
      const ancestor = await run("git", snap.repoRoot, ["merge-base", "--is-ancestor", observedHeadOid, snap.head]);
      if (!succeeded(ancestor)) blockers.push("Remote head is not a safe ancestor of the approved local HEAD (non-fast-forward). ");
    }
    const config = await configReceipt(snap.repoRoot);
    const loadedEvidence = await evidenceReceipts(snap.repoRoot, args.evidence);
    const authoritative = await validateAuthoritativeEvidence({ repoRoot: snap.repoRoot, evidence: loadedEvidence, head: snap.head,
      baseBranch: args.baseBranch, baseOid, branch: snap.branch, reviewablePaths, config });
    const evidence = authoritative.receipts;
    blockers.push(...authoritative.blockers);
    if (config.baseBranch !== null && config.baseBranch !== args.baseBranch) policyWarnings.push(`Explicit base branch ${args.baseBranch} overrides effective git.base_branch=${config.baseBranch}; both values are fingerprint-bound.`);
    const gate = gateFor(evidence, snap.head, baseOid, config, reviewablePaths);
    if (args.posture === "ready" && !gate.reviewSatisfied) blockers.push("Current-HEAD/base review evidence is missing, stale, blocking, or mismatched.");
    if (args.posture === "ready" && !gate.securitySatisfied) blockers.push("Current-HEAD/base security evidence is missing, stale, blocking, or mismatched.");
    if (args.posture === "ready" && !args.createPr) blockers.push("Ready shipping requires an approved PR creation stage.");
    if (args.createPr && !args.push && observedHeadOid !== snap.head) blockers.push("PR-only execution requires the exact remote head to already equal the approved local HEAD.");
    let ghRepository: ShipApprovalPacket["ghRepository"] = null;
    if (args.createPr) {
      if (!args.ghRepository) blockers.push("PR creation requires one explicit GitHub repository selector.");
      else {
        const derived = remoteSelectorResolver(pushUrl);
        if (!derived) blockers.push("Approved remote URL cannot be resolved to one GitHub repository selector.");
        else if (derived !== args.ghRepository) blockers.push(`GitHub repository selector ${args.ghRepository} does not match approved remote ${derived}.`);
        const gh = await ghPreflight(snap.repoRoot, args.ghRepository);
        blockers.push(...gh.blockers);
        if (gh.url) ghRepository = { selector: args.ghRepository, url: gh.url };
      }
    }
    let existingPr: ExistingPr = { disposition: "absent", url: null, headOid: null };
    if (args.createPr && ghRepository && blockers.length === 0) {
      existingPr = await inspectExistingPr(snap.repoRoot, ghRepository.selector, snap.branch, args.baseBranch, snap.head, args.posture);
      if (existingPr.disposition === "divergent") blockers.push("An observed existing PR diverges in base, OID, open state, or draft/ready posture.");
    }
    const report = await reportReceipt(snap.repoRoot);
    if (report.exists && !args.overwriteReport) return { status: "blocked", operationId: null, fingerprint: null, packet: null,
      waitingState: "report-overwrite-confirmation", blockers: ["The existing ship-latest report requires explicit overwrite approval."], warnings: [] };
    if (blockers.length > 0 || !observedBaseOid) return { status: "blocked", operationId: null, fingerprint: null, packet: null, waitingState: null, blockers, warnings: [] };
    const partial = { schemaVersion: 1 as const, operation: "ship" as const, repoRoot: snap.repoRoot, gitCommonDir: snap.gitCommonDir,
      branch: snap.branch, head: snap.head, baseBranch: args.baseBranch, baseOid, mergeBase, candidateCommits: commits, changedPaths, reviewablePaths,
      remote: { name: remoteName, fetchUrl, pushUrl, headRef, observedHeadOid, baseRef, observedBaseOid }, upstream,
      gitConfigSha256: snap.gitConfigSha256, blueprintConfig: config, ghRepository, posture: args.posture, pushRequested: args.push,
      prRequested: args.createPr, title: args.title, bodySha256: qualityShippingSha256(args.body), evidence,
      qualityGateInventory: authoritative.inventory!, gate, existingPr,
      report: { path: REPORT_PATH as typeof REPORT_PATH, overwriteApproved: args.overwriteReport === true, priorExists: report.exists,
        priorContentSha256: report.sha256, preMutationContentSha256: "" }, statePatch: args.statePatch ?? null };
    const packet: ShipApprovalPacket = { ...partial, executionPlan: planFor(partial, args.body) };
    const operationId = randomUUID();
    const fingerprint = approvalFingerprint(packet);
    const pre = renderReport(packet, fingerprint, null);
    packet.report.preMutationContentSha256 = qualityShippingSha256(pre);
    const now = nowProvider();
    approvals.set(operationId, { packet: structuredClone(packet), fingerprint, body: args.body, preMutationReportContent: pre,
      consumed: false, createdAt: now, expiresAt: now + approvalTtlMs, terminalExpiresAt: null, lastResult: null,
      outcomeReportContent: null, expectedReportContentSha256: null });
    pruneApprovals();
    const warnings = [...policyWarnings, ...(args.posture === "draft" && (!gate.reviewSatisfied || !gate.securitySatisfied) ? ["Draft shipping records unsatisfied readiness evidence without claiming ready status."] : [])];
    warnings.push("Approval and operation lock are process-local; restart or expiry fails closed.");
    return { status: "ready", operationId, fingerprint, packet, waitingState: "ship-confirmation", blockers: [], warnings };
  } catch (error) {
    return { status: "invalid", operationId: null, fingerprint: null, packet: null, waitingState: null,
      blockers: [error instanceof Error ? error.message : String(error)], warnings: [] };
  }
}

type FreshnessResult = { changes: string[]; ghFailure: GhFailureReason | null; ghDetail: string | null };

async function freshChanges(
  stored: StoredApproval,
  afterPreReport = false,
  expectedRemoteHead: string | null = stored.packet.remote.observedHeadOid,
  compareExistingPr = true
): Promise<FreshnessResult> {
  const p = stored.packet;
  const changed: string[] = [];
  const snap = await snapshot(p.repoRoot);
  if (snap.repoRoot !== p.repoRoot || snap.gitCommonDir !== p.gitCommonDir) changed.push("repository identity");
  if (snap.branch !== p.branch) changed.push("head branch");
  if (snap.head !== p.head) changed.push("HEAD");
  if (snap.status !== "") changed.push("working tree");
  if (snap.inProgressState.length > 0) changed.push("in-progress git state");
  if (snap.gitConfigSha256 !== p.gitConfigSha256) changed.push("effective git config");
  if ((await configReceipt(p.repoRoot)).sha256 !== p.blueprintConfig.sha256) changed.push("effective Blueprint config");
  if (await resolveCommit(p.repoRoot, `refs/heads/${p.baseBranch}`, "Base branch") !== p.baseOid) changed.push("base branch");
  const [fetchUrl, pushUrl] = await Promise.all([
    singleEffectiveRemoteUrl(p.repoRoot, p.remote.name, false),
    singleEffectiveRemoteUrl(p.repoRoot, p.remote.name, true)
  ]);
  if (fetchUrl !== p.remote.fetchUrl) changed.push("effective remote fetch URL");
  if (pushUrl !== p.remote.pushUrl) changed.push("effective remote push URL");
  let head: string | null = null;
  let base: string | null = null;
  try { [head, base] = await Promise.all([remoteOid(p.repoRoot, p.remote.pushUrl, p.remote.headRef), remoteOid(p.repoRoot, p.remote.pushUrl, p.remote.baseRef)]); }
  catch { changed.push("remote refs could not be observed"); }
  if (!changed.includes("remote refs could not be observed") && head !== expectedRemoteHead) changed.push("remote head ref");
  if (!changed.includes("remote refs could not be observed") && base !== p.remote.observedBaseOid) changed.push("remote base ref");
  const upstream = await run("git", p.repoRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (!succeeded(upstream) || upstream.stdout.trim() !== p.upstream) changed.push("upstream");
  const currentConfig = await configReceipt(p.repoRoot);
  const loaded = await evidenceReceipts(p.repoRoot, p.evidence.map(({ path: evidencePath, kind }) => ({ path: evidencePath, kind })));
  const authoritative = await validateAuthoritativeEvidence({ repoRoot: p.repoRoot, evidence: loaded, head: p.head, baseBranch: p.baseBranch, baseOid: p.baseOid,
    branch: p.branch, reviewablePaths: p.reviewablePaths, config: currentConfig });
  if (authoritative.blockers.length > 0 || qualityShippingFingerprint(authoritative.receipts) !== qualityShippingFingerprint(p.evidence)) changed.push("evidence");
  if (!authoritative.inventory || qualityShippingFingerprint(authoritative.inventory) !== qualityShippingFingerprint(p.qualityGateInventory)) changed.push("phase quality-gate inventory");
  let ghFailure: GhFailureReason | null = null;
  let ghDetail: string | null = null;
  if (p.prRequested) {
    const gh = await ghPreflight(p.repoRoot, p.ghRepository!.selector);
    ghFailure = gh.failure;
    ghDetail = gh.blockers.join(" ") || null;
    if (gh.blockers.length > 0 || gh.url !== p.ghRepository!.url) changed.push("gh repository, availability, or authentication");
    else if (compareExistingPr) {
      try {
        const inspected = await inspectExistingPr(p.repoRoot, p.ghRepository!.selector, p.branch, p.baseBranch, p.head, p.posture);
        if (qualityShippingFingerprint(inspected) !== qualityShippingFingerprint(p.existingPr)) {
          changed.push(inspected.disposition === "divergent" ? "existing PR diverged" : "existing PR");
        }
      } catch (error) {
        ghFailure = "pr-view-unavailable";
        ghDetail = error instanceof Error ? error.message : String(error);
        changed.push("existing PR could not be inspected");
      }
    }
  }
  const report = await reportReceipt(p.repoRoot);
  if (afterPreReport) {
    if (!report.exists || report.sha256 !== stored.expectedReportContentSha256) changed.push("pre-mutation report");
  } else if (report.exists !== p.report.priorExists || report.sha256 !== p.report.priorContentSha256) changed.push("report compare-and-swap receipt");
  return { changes: changed, ghFailure, ghDetail };
}

function classifyPushFailure(result: QualityShippingProcessResult): string {
  const text = `${result.stderr}\n${result.stdout}`;
  if (/non-fast-forward|fetch first|rejected/i.test(text)) return "Push was rejected as non-fast-forward or remote-advanced.";
  return abnormal(result) ? "Push outcome is unknown because the process could not be observed normally." : `Push failed with exit ${String(result.exitCode)}.`;
}

function classifyGhFailure(result: QualityShippingProcessResult): string {
  const text = `${result.stderr}\n${result.stdout}`;
  if (result.exitCode === null) return "gh is missing or could not be spawned.";
  if (/auth|login|authentication|not logged/i.test(text)) return "gh authentication failed.";
  return abnormal(result) ? "PR creation outcome is unknown because gh did not complete normally." : `PR creation failed with exit ${String(result.exitCode)}.`;
}

function ghCreateFailureReason(result: QualityShippingProcessResult): GhFailureReason {
  const text = `${result.stderr}\n${result.stdout}`;
  if (result.exitCode === null || /command not found|enoent/i.test(text)) return "gh-missing";
  if (/auth|login|authentication|not logged/i.test(text)) return "gh-unauthenticated";
  return "pr-create-failed";
}

async function persistOutcome(stored: StoredApproval, result: ShipExecutionResult): Promise<void> {
  const content = renderReport(stored.packet, stored.fingerprint, result);
  stored.outcomeReportContent = content;
  try {
    const write = await reportWriter({ cwd: stored.packet.repoRoot, reportName: REPORT_NAME, content, overwrite: true,
      expectedExistingContentSha256: stored.expectedReportContentSha256 });
    result.report.outcomeStatus = reportStatus(write);
    if (result.report.outcomeStatus === "failed") throw new Error(`Outcome report was rejected with status ${write.status}.`);
    stored.expectedReportContentSha256 = qualityShippingSha256(content);
  } catch (error) {
    result.report.outcomeStatus = "failed";
    result.report.error = error instanceof Error ? error.message : String(error);
    if (result.status === "succeeded") {
      result.status = result.externalMutationStarted ? "partial" : "failed";
    }
    result.stage = "outcome-report";
    result.recoveryActions.push(`Retry only blueprint_ship_persist stage outcome-report for operation ${result.operationId}; do not repeat push or PR creation.`);
  }
}

async function observeRemoteHead(stored: StoredApproval): Promise<string | null> {
  return remoteOid(stored.packet.repoRoot, stored.packet.remote.pushUrl, stored.packet.remote.headRef);
}

function recordTerminal(stored: StoredApproval, result: ShipExecutionResult): void {
  stored.lastResult = result;
  stored.terminalExpiresAt = nowProvider() + terminalTtlMs;
}

export async function blueprintShipExecute(args: { operationId: string; fingerprint: string; confirmed: true }): Promise<ShipExecutionResult> {
  pruneApprovals();
  const stored = approvals.get(args.operationId);
  if (!stored) {
    const result = baseResult(null, args.operationId, args.fingerprint);
    result.status = "stale"; result.blockers.push("Approval is missing or expired; create a fresh preview."); return result;
  }
  if (stored.fingerprint !== args.fingerprint) {
    const result = baseResult(stored.packet, args.operationId, args.fingerprint);
    result.status = "stale"; result.blockers.push("Approval fingerprint does not match."); return result;
  }
  if (stored.consumed) return stored.lastResult ? structuredClone(stored.lastResult) : (() => { const r = baseResult(stored.packet, args.operationId, args.fingerprint); r.status = "stale"; r.blockers.push("Approval was already consumed."); return r; })();
  if (stored.expiresAt <= nowProvider()) {
    approvals.delete(args.operationId);
    const result = baseResult(stored.packet, args.operationId, args.fingerprint); result.status = "stale"; result.blockers.push("Approval expired before execution."); return result;
  }
  const release = tryAcquireQualityShippingOperationLock("ship", stored.packet.gitCommonDir);
  if (!release) {
    const result = baseResult(stored.packet, args.operationId, args.fingerprint); result.blockers.push("Another Quality Shipping operation is active for this repository; approval was not consumed."); return result;
  }
  const result = baseResult(stored.packet, args.operationId, args.fingerprint);
  try {
    stored.consumed = true;
    result.stage = "revalidate";
    const recomputedFingerprint = approvalFingerprint(stored.packet);
    if (recomputedFingerprint !== stored.fingerprint) {
      result.status = "stale";
      result.blockers.push("Stored ship approval packet fingerprint no longer matches its canonical bound fields.");
      recordTerminal(stored, result);
      return result;
    }
    if (qualityShippingSha256(stored.body) !== stored.packet.bodySha256) {
      result.status = "stale";
      result.blockers.push("Stored ship PR body no longer matches the fingerprint-bound body digest.");
      recordTerminal(stored, result);
      return result;
    }
    const regeneratedPlan = planFor(stored.packet, stored.body);
    if (qualityShippingFingerprint(regeneratedPlan) !== qualityShippingFingerprint(stored.packet.executionPlan)) {
      result.status = "stale";
      result.blockers.push("Stored ship execution plan does not equal the canonical exact-argv plan regenerated at the mutation boundary.");
      recordTerminal(stored, result);
      return result;
    }
    const fresh = await freshChanges(stored);
    if (fresh.changes.length > 0) {
      if (fresh.ghFailure) { result.gh = { status: fresh.ghFailure, detail: fresh.ghDetail }; result.recoveryActions.push(freshPreviewRecovery(stored.packet, result)); }
      result.status = "stale"; result.blockers.push(`Approval is stale: ${fresh.changes.join(", ")}.`); recordTerminal(stored, result); return result;
    }
    result.stage = "pre-report";
    const pre = await reportWriter({ cwd: stored.packet.repoRoot, reportName: REPORT_NAME, content: stored.preMutationReportContent,
      overwrite: stored.packet.report.overwriteApproved, expectedExistingContentSha256: stored.packet.report.priorContentSha256 });
    result.report.preMutationStatus = reportStatus(pre);
    if (result.report.preMutationStatus === "failed") throw new Error(`Pre-mutation report was rejected with status ${pre.status}.`);
    stored.expectedReportContentSha256 = stored.packet.report.preMutationContentSha256;
    const afterReport = await freshChanges(stored, true);
    if (afterReport.changes.length > 0) {
      if (afterReport.ghFailure) { result.gh = { status: afterReport.ghFailure, detail: afterReport.ghDetail }; result.recoveryActions.push(freshPreviewRecovery(stored.packet, result)); }
      result.status = "stale"; result.stage = "revalidate"; result.blockers.push(`Approval changed after pre-report persistence: ${afterReport.changes.join(", ")}.`);
      await persistOutcome(stored, result); recordTerminal(stored, result); return result;
    }
    if (stored.packet.remote.observedHeadOid === stored.packet.head) {
      result.push.status = stored.packet.pushRequested ? "reused" : "not-requested";
      result.push.remoteHeadAfter = stored.packet.head;
    }
    const pushPlan = stored.packet.executionPlan.find((entry) => entry.stage === "push");
    if (pushPlan) {
      result.stage = "push"; result.externalMutationStarted = true;
      const receipt = await run("git", stored.packet.repoRoot, pushPlan.argv);
      result.processes.push({ stage: "push", command: "git", argv: [...pushPlan.argv], result: receipt });
      let observed: string | null = null;
      let observationError: string | null = null;
      try { observed = await observeRemoteHead(stored); } catch (error) { observationError = error instanceof Error ? error.message : String(error); }
      result.push.remoteHeadAfter = observed;
      if (observed === stored.packet.head && succeeded(receipt)) result.push.status = "pushed";
      else if (observed === stored.packet.head) {
        result.push.status = "reused";
        result.warnings.push(`Push process returned exit ${String(receipt.exitCode)}, but the exact approved remote ref was observed at the approved HEAD; classified as reused-by-observation, not newly pushed.`);
      }
      else if (observationError || succeeded(receipt)) {
        result.push.status = "outcome-unknown";
        result.status = "outcome-unknown";
        result.blockers.push(observationError
          ? `Push completed but the exact remote ref could not be observed: ${observationError}`
          : `Push exited successfully, but the exact push target ref was subsequently observed at ${observed ?? "absent"} instead of the approved HEAD; outcome is unknown.`);
        result.recoveryActions.push("Inspect the exact remote ref before any PR creation or retry.");
      } else {
        result.push.status = abnormal(receipt) ? "outcome-unknown" : "failed";
        result.status = abnormal(receipt) ? "outcome-unknown" : "failed";
        result.blockers.push(classifyPushFailure(receipt));
        result.recoveryActions.push("Inspect the exact remote ref before any new preview; PR creation was not attempted.");
      }
    }
    if (result.push.status === "failed" || result.push.status === "outcome-unknown") {
      await persistOutcome(stored, result); recordTerminal(stored, result); return result;
    }
    if (stored.packet.prRequested && stored.packet.existingPr.disposition === "exact") {
      result.pr.status = "reused"; result.pr.url = stored.packet.existingPr.url;
    }
    const prPlan = stored.packet.executionPlan.find((entry) => entry.stage === "pr-create");
    if (prPlan) {
      result.stage = "pr-create";
      const prePr = await freshChanges(stored, true, stored.packet.head, false);
      if (prePr.changes.length > 0) {
        if (prePr.ghFailure) { result.gh = { status: prePr.ghFailure, detail: prePr.ghDetail }; result.recoveryActions.push(freshPreviewRecovery(stored.packet, result)); }
        result.status = "partial"; result.blockers.push(`State changed after confirmed push and before PR creation: ${prePr.changes.join(", ")}.`);
        result.recoveryActions.push("Re-establish fresh gh, repository, remote, config, evidence, and report state, then create a new preview before any PR command; do not use the stale approved argv.");
        result.recoveryActions.push("The confirmed push remains successful; do not push again or create a PR until authoritative current no-PR inspection succeeds.");
      } else {
        let existing: ExistingPr;
        try {
          existing = await inspectExistingPr(stored.packet.repoRoot, stored.packet.ghRepository!.selector, stored.packet.branch, stored.packet.baseBranch, stored.packet.head, stored.packet.posture);
        } catch (error) {
          result.pr.status = "failed";
          result.gh = { status: "pr-view-unavailable", detail: error instanceof Error ? error.message : String(error) };
          result.status = result.push.status === "pushed" || result.push.status === "reused" ? "partial" : "failed";
          result.blockers.push(`PR inspection failed before creation: ${result.gh.detail}`);
          result.recoveryActions.push(freshPreviewRecovery(stored.packet, result));
          await persistOutcome(stored, result); recordTerminal(stored, result); return result;
        }
        if (existing.disposition === "exact") {
          result.pr.status = "reused";
          result.pr.url = existing.url;
        } else if (existing.disposition === "divergent") {
          result.pr.status = "failed";
          result.status = result.push.status === "pushed" || result.push.status === "reused" ? "partial" : "failed";
          result.blockers.push("An observed existing PR diverges from the approved base, head OID, open state, or posture; PR creation was not attempted.");
          result.recoveryActions.push(freshPreviewRecovery(stored.packet, result));
        } else {
        result.externalMutationStarted = true;
        const receipt = await run("gh", stored.packet.repoRoot, prPlan.argv);
        result.processes.push({ stage: "pr-create", command: "gh", argv: [...prPlan.argv], result: receipt });
        try {
          const verified = await inspectExistingPr(stored.packet.repoRoot, stored.packet.ghRepository!.selector, stored.packet.branch, stored.packet.baseBranch, stored.packet.head, stored.packet.posture);
          if (verified.disposition === "exact" && verified.url) {
            result.pr.status = succeeded(receipt) ? "created" : "reused";
            result.pr.url = verified.url;
            if (!succeeded(receipt)) result.warnings.push(`gh pr create returned exit ${String(receipt.exitCode)}, but the exact approved PR was observed; classified as reused-by-observation.`);
          } else if (succeeded(receipt)) {
            result.pr.status = "outcome-unknown"; result.status = "outcome-unknown";
            result.gh = { status: "pr-view-unavailable", detail: "gh pr create exited successfully but no exact PR was observed" };
            result.blockers.push("gh exited successfully but authoritative inspection reported no exact PR.");
            result.recoveryActions.push(freshPreviewRecovery(stored.packet, result));
          } else {
            result.pr.status = abnormal(receipt) ? "outcome-unknown" : "failed";
            result.status = abnormal(receipt) ? "outcome-unknown" : "partial";
            result.gh = { status: ghCreateFailureReason(receipt), detail: classifyGhFailure(receipt) };
            result.blockers.push(classifyGhFailure(receipt));
            result.recoveryActions.push(freshPreviewRecovery(stored.packet, result));
            result.recoveryActions.push("The confirmed push remains successful; do not push again.");
          }
        } catch (error) {
          result.pr.status = "outcome-unknown"; result.status = "outcome-unknown";
          result.gh = { status: "pr-view-unavailable", detail: error instanceof Error ? error.message : String(error) };
          result.blockers.push(`The exact PR outcome could not be verified after gh pr create: ${error instanceof Error ? error.message : String(error)}`);
          result.recoveryActions.push(freshPreviewRecovery(stored.packet, result));
          result.recoveryActions.push("The confirmed push remains successful; do not push again.");
        }
        }
      }
    }
    if (result.status === "blocked") result.status = result.blockers.length > 0 ? "partial" : "succeeded";
    result.stage = "outcome-report";
    await persistOutcome(stored, result);
    const externalComplete = (!stored.packet.pushRequested || ["pushed", "reused"].includes(result.push.status)) &&
      (!stored.packet.prRequested || ["created", "reused"].includes(result.pr.status));
    if (result.report.outcomeStatus !== "failed" && externalComplete && stored.packet.statePatch) {
      result.stage = "state";
      try {
        const state = await stateUpdater({ cwd: stored.packet.repoRoot, patch: stored.packet.statePatch });
        result.state = { status: state.updated ? "updated" : "unchanged", path: state.statePath, error: null };
        result.stage = "outcome-report";
        await persistOutcome(stored, result);
      } catch (error) {
        result.state = { status: "failed", path: null, error: error instanceof Error ? error.message : String(error) };
        result.status = "partial"; result.blockers.push(`State update failed after confirmed external outcomes: ${result.state.error}`);
        result.recoveryActions.push("Retry only blueprint_ship_persist stage state; do not repeat push or PR creation.");
        await persistOutcome(stored, result);
      }
    }
    if (externalComplete && result.report.outcomeStatus !== "failed" && result.state.status !== "failed" && result.status !== "outcome-unknown") result.status = "succeeded";
    recordTerminal(stored, result); return result;
  } catch (error) {
    result.status = result.externalMutationStarted ? "partial" : result.stage === "pre-report" ? "blocked" : "failed";
    result.blockers.push(error instanceof Error ? error.message : String(error));
    if (result.stage === "pre-report" && result.report.preMutationStatus === "not-attempted") {
      result.report.preMutationStatus = "failed"; result.report.error = result.blockers.at(-1) ?? null;
    }
    if (result.externalMutationStarted || ["created", "updated", "reused"].includes(result.report.preMutationStatus)) {
      result.recoveryActions.push("Inspect the exact remote branch and PR before any retry; never repeat external mutation from this consumed approval.");
      await persistOutcome(stored, result).catch(() => undefined);
    }
    recordTerminal(stored, result); return result;
  } finally { release(); pruneApprovals(); }
}

export async function blueprintShipPersist(args: { operationId: string; fingerprint: string; stage: "outcome-report" | "state" }): Promise<ShipExecutionResult> {
  pruneApprovals();
  const stored = approvals.get(args.operationId);
  if (!stored || !stored.consumed || !stored.lastResult || stored.fingerprint !== args.fingerprint) {
    const result = baseResult(null, args.operationId, args.fingerprint); result.status = "stale"; result.stage = "persistence-recovery";
    result.blockers.push("No matching process-local terminal ship receipt is available; external mutation will not be entered."); return result;
  }
  const release = tryAcquireQualityShippingOperationLock("ship", stored.packet.gitCommonDir);
  if (!release) { const r = structuredClone(stored.lastResult); r.status = "blocked"; r.stage = "persistence-recovery"; r.blockers = ["Another Quality Shipping operation is active for this repository."]; return r; }
  try {
    const result = structuredClone(stored.lastResult);
    result.stage = "persistence-recovery";
    const externalComplete = (!stored.packet.pushRequested || ["pushed", "reused"].includes(result.push.status)) &&
      (!stored.packet.prRequested || ["created", "reused"].includes(result.pr.status));
    if (args.stage === "state") {
      if (!externalComplete || !stored.packet.statePatch || !["failed", "not-attempted"].includes(result.state.status) || result.report.outcomeStatus === "failed") {
        result.status = "blocked"; result.blockers.push("State recovery requires retained not-attempted or failed state persistence after confirmed external outcomes and outcome-report persistence."); return result;
      }
      try {
        const state = await stateUpdater({ cwd: stored.packet.repoRoot, patch: stored.packet.statePatch });
        result.state = { status: state.updated ? "updated" : "unchanged", path: state.statePath, error: null };
        result.status = "succeeded";
        result.blockers = result.blockers.filter((blocker) => !/State update failed after confirmed external outcomes|State persistence recovery failed/i.test(blocker));
        result.recoveryActions = result.recoveryActions.filter((action) => !/blueprint_ship_persist stage state/i.test(action));
      } catch (error) {
        result.state = { status: "failed", path: null, error: error instanceof Error ? error.message : String(error) }; result.status = "partial";
        result.blockers.push(`State persistence recovery failed: ${result.state.error}`); result.recoveryActions.push("Retry only blueprint_ship_persist stage state.");
      }
      const content = renderReport(stored.packet, stored.fingerprint, result);
      stored.outcomeReportContent = content;
      try {
        const write = await reportWriter({ cwd: stored.packet.repoRoot, reportName: REPORT_NAME, content, overwrite: true,
          expectedExistingContentSha256: stored.expectedReportContentSha256 });
        result.report.outcomeStatus = reportStatus(write);
        if (result.report.outcomeStatus === "failed") throw new Error(`State-recovery report was rejected with status ${write.status}.`);
        result.report.error = null;
        stored.expectedReportContentSha256 = qualityShippingSha256(content);
      } catch (error) {
        result.status = "partial";
        result.report.outcomeStatus = "failed";
        result.report.error = error instanceof Error ? error.message : String(error);
        result.blockers.push(`Final state receipt persistence failed: ${result.report.error}`);
        result.recoveryActions.push("Retry only blueprint_ship_persist stage outcome-report; do not retry state or external mutation.");
      }
    } else {
      if (result.report.outcomeStatus !== "failed" || !stored.outcomeReportContent) {
        result.status = "blocked"; result.blockers.push("Outcome-report recovery requires a retained failed outcome-report receipt."); return result;
      }
      try {
        const content = renderReport(stored.packet, stored.fingerprint, result); stored.outcomeReportContent = content;
        const write = await reportWriter({ cwd: stored.packet.repoRoot, reportName: REPORT_NAME, content, overwrite: true,
          expectedExistingContentSha256: stored.expectedReportContentSha256 });
        result.report.outcomeStatus = reportStatus(write);
        if (result.report.outcomeStatus === "failed") throw new Error(`Outcome report was rejected with status ${write.status}.`);
        result.report.error = null; stored.expectedReportContentSha256 = qualityShippingSha256(content);
        result.recoveryActions = result.recoveryActions.filter((action) => !/blueprint_ship_persist stage outcome-report/i.test(action));
        if (!externalComplete) {
          // Persistence recovery never changes the underlying external stage truth.
          result.status = stored.lastResult.status === "outcome-unknown" ? "outcome-unknown" : stored.lastResult.status === "failed" ? "failed" : "partial";
        } else if (stored.packet.statePatch && !["updated", "unchanged"].includes(result.state.status)) {
          result.status = "partial";
          if (!result.recoveryActions.some((action) => /blueprint_ship_persist stage state/i.test(action))) {
            result.recoveryActions.push("Call blueprint_ship_persist stage state; do not retry push or PR creation.");
          }
        } else {
          result.status = "succeeded";
        }
      } catch (error) {
        result.status = "partial"; result.report.outcomeStatus = "failed"; result.report.error = error instanceof Error ? error.message : String(error);
        result.blockers.push(`Persistence-only report recovery failed: ${result.report.error}`); result.recoveryActions.push("Retry only blueprint_ship_persist; do not retry external mutation.");
      }
    }
    stored.lastResult = result; stored.terminalExpiresAt = nowProvider() + terminalTtlMs; return result;
  } finally { release(); }
}

export const shipToolDefinitions: ToolDefinition[] = [
  { name: "blueprint_ship_preview", description: "Plan a config-, evidence-, repository-, remote-, and report-bound ship approval without mutation.",
    inputSchema: previewInputSchema, handler: async (args) => blueprintShipPreview(args as ShipPreviewArgs) },
  { name: "blueprint_ship_execute", description: "Consume one ship approval, revalidate before each external stage, execute exact argv, and persist truthful outcomes.",
    inputSchema: executeInputSchema, handler: async (args) => blueprintShipExecute(args as { operationId: string; fingerprint: string; confirmed: true }) },
  { name: "blueprint_ship_persist", description: "Retry only receipt-bound ship report or state persistence without re-entering push or PR creation.",
    inputSchema: persistInputSchema, handler: async (args) => blueprintShipPersist(args as { operationId: string; fingerprint: string; stage: "outcome-report" | "state" }) }
];
