import { randomUUID } from "node:crypto";
import { access, lstat, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as z from "zod/v4";

import type { ToolDefinition } from "../tool-types.js";
import {
  assertUndoRevertArgv,
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
import {
  blueprintStateUpdate,
  type StateUpdateArgs,
  type StateUpdateResult
} from "./state.js";

const UNDO_REPORT_NAME = "undo-latest";
const UNDO_REPORT_PATH = ".blueprint/reports/undo-latest.md";
const UNDO_SCHEMA_VERSION = 1;
const UNDO_APPROVAL_TTL_MS = 10 * 60 * 1_000;
const UNDO_TERMINAL_RECEIPT_TTL_MS = 5 * 60 * 1_000;
const UNDO_MAX_APPROVALS = 128;

const undoTargetSchema = z.object({
  sha: z.string(),
  mainline: z.number().int().positive().optional()
});

const undoPreviewInputSchema = {
  cwd: z.string().optional(),
  targets: z.array(undoTargetSchema).min(1),
  reason: z.string().min(1),
  evidencePaths: z.array(z.string()).min(1),
  dependencyImpact: z.string().optional(),
  overwriteReport: z.boolean().optional(),
  statePatch: z.record(z.string(), z.unknown()).optional()
};

const undoExecuteInputSchema = {
  operationId: z.string().uuid(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  confirmed: z.literal(true)
};

const undoPersistInputSchema = {
  operationId: z.string().uuid(),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  stage: z.enum(["outcome-report", "state"])
};

export type UndoTargetInput = {
  sha: string;
  mainline?: number;
};

export type UndoPreviewArgs = {
  cwd?: string;
  targets: UndoTargetInput[];
  reason: string;
  evidencePaths: string[];
  dependencyImpact?: string;
  overwriteReport?: boolean;
  statePatch?: StateUpdateArgs["patch"];
};

export type UndoCandidate = {
  sha: string;
  parents: string[];
  mainline: number | null;
  subject: string;
  changedPaths: string[];
  order: number;
  argv: string[];
};

export type UndoEvidenceReceipt = {
  path: string;
  contentSha256: string | null;
};

type UndoAppliedRevert = {
  target: string;
  revertCommit: string;
};

export type UndoApprovalPacket = {
  schemaVersion: 1;
  operation: "undo";
  repoRoot: string;
  gitCommonDir: string;
  branch: string;
  head: string;
  gitConfigSha256: string;
  workingTreeFingerprint: string;
  inProgressState: string[];
  candidates: UndoCandidate[];
  evidence: UndoEvidenceReceipt[];
  priorAppliedReverts: UndoAppliedRevert[];
  reason: string;
  dependencyImpact: string;
  report: {
    path: typeof UNDO_REPORT_PATH;
    overwriteApproved: boolean;
    priorExists: boolean;
    priorContentSha256: string | null;
    preMutationContentSha256: string;
  };
  statePatch: StateUpdateArgs["patch"] | null;
};

type UndoPreviewStatus = "ready" | "blocked" | "already-applied" | "invalid";
type UndoExecutionStatus =
  | "blocked"
  | "stale"
  | "already-applied"
  | "succeeded"
  | "partial"
  | "failed"
  | "outcome-unknown";

type UndoPreviewResult = {
  status: UndoPreviewStatus;
  operationId: string | null;
  fingerprint: string | null;
  packet: UndoApprovalPacket | null;
  waitingState: "undo-confirmation" | "report-overwrite-confirmation" | null;
  blockers: string[];
  warnings: string[];
};

type UndoProcessReceipt = {
  target: string;
  argv: string[];
  result: QualityShippingProcessResult;
  headBefore: string;
  headAfter: string;
};

export type UndoExecutionResult = {
  status: UndoExecutionStatus;
  stage: "approval" | "revalidate" | "pre-report" | "execute" | "outcome-report" | "state" | "persistence-recovery";
  operationId: string;
  fingerprint: string;
  mutationStarted: boolean;
  mutationStatus: "not-started" | "succeeded" | "partial" | "failed" | "outcome-unknown";
  originalHead: string | null;
  finalHead: string | null;
  finalWorkingTreeStatus: "clean" | "dirty" | "unknown";
  attempted: string[];
  reverted: Array<{ target: string; revertCommit: string }>;
  unreverted: string[];
  processes: UndoProcessReceipt[];
  conflictedPaths: string[];
  inProgressState: string[];
  report: {
    path: typeof UNDO_REPORT_PATH;
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

type UndoReportWriteResult = Awaited<ReturnType<typeof blueprintArtifactReportWrite>>;
type UndoReportWriter = (args: {
  cwd?: string;
  reportName: string;
  content?: string;
  overwrite?: boolean;
  expectedExistingContentSha256?: string | null;
}) => Promise<UndoReportWriteResult>;
type UndoStateUpdater = (args: StateUpdateArgs) => Promise<StateUpdateResult>;

type StoredApproval = {
  packet: UndoApprovalPacket;
  fingerprint: string;
  preMutationReportContent: string;
  consumed: boolean;
  completionStatus: UndoExecutionStatus | null;
  createdAt: number;
  expiresAt: number;
  terminalExpiresAt: number | null;
  lastResult: UndoExecutionResult | null;
  outcomeReportContent: string | null;
  expectedReportContentSha256: string | null;
  deferredStateAfterReportRecovery: boolean;
};

type RepositorySnapshot = {
  repoRoot: string;
  gitCommonDir: string;
  branch: string | null;
  head: string | null;
  gitConfigSha256: string;
  status: string;
  inProgressState: string[];
};

type ObservedUndoState = {
  head: string | null;
  branch: string | null;
  gitConfigSha256: string;
  status: string;
  inProgressState: string[];
  conflictedPaths: string[];
};

const approvals = new Map<string, StoredApproval>();
let processRunner: QualityShippingProcessRunner = qualityShippingProcessRunner;
let reportWriter: UndoReportWriter = blueprintArtifactReportWrite;
let stateUpdater: UndoStateUpdater = blueprintStateUpdate;
let nowProvider = () => Date.now();
let approvalTtlMs = UNDO_APPROVAL_TTL_MS;
let terminalReceiptTtlMs = UNDO_TERMINAL_RECEIPT_TTL_MS;
let maxApprovals = UNDO_MAX_APPROVALS;

export const undoToolTestHooks = {
  setProcessRunnerForTest(runner: QualityShippingProcessRunner): () => void {
    const previous = processRunner;
    processRunner = runner;
    return () => {
      processRunner = previous;
    };
  },
  setReportWriterForTest(writer: UndoReportWriter): () => void {
    const previous = reportWriter;
    reportWriter = writer;
    return () => {
      reportWriter = previous;
    };
  },
  setStateUpdaterForTest(updater: UndoStateUpdater): () => void {
    const previous = stateUpdater;
    stateUpdater = updater;
    return () => {
      stateUpdater = previous;
    };
  },
  clearApprovalsForTest(): void {
    approvals.clear();
  },
  setRetentionForTest(args: {
    now?: () => number;
    approvalTtlMs?: number;
    terminalReceiptTtlMs?: number;
    maxApprovals?: number;
  }): () => void {
    const previous = {
      nowProvider,
      approvalTtlMs,
      terminalReceiptTtlMs,
      maxApprovals
    };
    if (args.now) nowProvider = args.now;
    if (args.approvalTtlMs !== undefined) approvalTtlMs = args.approvalTtlMs;
    if (args.terminalReceiptTtlMs !== undefined) terminalReceiptTtlMs = args.terminalReceiptTtlMs;
    if (args.maxApprovals !== undefined) maxApprovals = args.maxApprovals;

    return () => {
      nowProvider = previous.nowProvider;
      approvalTtlMs = previous.approvalTtlMs;
      terminalReceiptTtlMs = previous.terminalReceiptTtlMs;
      maxApprovals = previous.maxApprovals;
      approvals.clear();
    };
  }
};

function pruneApprovals(forInsertion = false): void {
  const now = nowProvider();

  for (const [operationId, approval] of approvals) {
    const expiry = approval.consumed
      ? approval.terminalExpiresAt ?? approval.expiresAt
      : approval.expiresAt;
    if (expiry <= now) approvals.delete(operationId);
  }

  while (forInsertion && approvals.size >= maxApprovals) {
    const oldest = [...approvals.entries()].sort(
      ([, left], [, right]) => left.createdAt - right.createdAt
    )[0];
    if (!oldest) break;
    approvals.delete(oldest[0]);
  }
}

function recordTerminalResult(stored: StoredApproval, result: UndoExecutionResult): void {
  stored.completionStatus = result.status;
  stored.lastResult = result;
  stored.terminalExpiresAt = nowProvider() + terminalReceiptTtlMs;
}

function lines(value: string): string[] {
  return value.split(/\r?\n/).filter((line) => line.length > 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runGit(
  cwd: string,
  argv: readonly string[]
): Promise<QualityShippingProcessResult> {
  return processRunner("git", argv, cwd, qualityShippingGitEnvironment());
}

async function requiredGit(cwd: string, argv: readonly string[]): Promise<string> {
  const result = await runGit(cwd, argv);

  if (result.exitCode !== 0 || result.signal || result.timedOut) {
    throw new Error(
      `git ${argv.join(" ")} failed: ${result.stderr || result.stdout || `exit ${String(result.exitCode)}`}`
    );
  }

  return result.stdout.replace(/[\r\n]+$/g, "");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function gitPathExists(repoRoot: string, name: string): Promise<boolean> {
  const gitPath = await requiredGit(repoRoot, ["rev-parse", "--git-path", name]);
  return pathExists(path.isAbsolute(gitPath) ? gitPath : path.resolve(repoRoot, gitPath));
}

async function inspectRepository(cwd: string): Promise<RepositorySnapshot> {
  const repoRootRaw = await requiredGit(cwd, ["rev-parse", "--show-toplevel"]);
  const repoRoot = await realpath(repoRootRaw);
  const gitCommonDirRaw = await requiredGit(repoRoot, ["rev-parse", "--git-common-dir"]);
  const gitCommonDir = await realpath(
    path.isAbsolute(gitCommonDirRaw)
      ? gitCommonDirRaw
      : path.resolve(repoRoot, gitCommonDirRaw)
  );
  const headResult = await runGit(repoRoot, ["rev-parse", "--verify", "HEAD"]);
  const branchResult = await runGit(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const status = await requiredGit(repoRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all"
  ]);
  const gitConfig = await requiredGit(repoRoot, [
    "config",
    "--list",
    "--show-origin",
    "--show-scope",
    "-z"
  ]);
  const inProgressChecks = [
    ["merge", "MERGE_HEAD"],
    ["rebase", "rebase-merge"],
    ["rebase", "rebase-apply"],
    ["cherry-pick", "CHERRY_PICK_HEAD"],
    ["revert", "REVERT_HEAD"],
    ["sequencer", "sequencer"]
  ] as const;
  const inProgressState: string[] = [];

  for (const [label, marker] of inProgressChecks) {
    if (await gitPathExists(repoRoot, marker)) {
      inProgressState.push(label);
    }
  }

  return {
    repoRoot,
    gitCommonDir,
    branch:
      branchResult.exitCode === 0
        ? branchResult.stdout.replace(/[\r\n]+$/g, "")
        : null,
    head:
      headResult.exitCode === 0
        ? headResult.stdout.replace(/[\r\n]+$/g, "")
        : null,
    gitConfigSha256: qualityShippingSha256(gitConfig),
    status,
    inProgressState: [...new Set(inProgressState)].sort()
  };
}

function statusContainsOnlyUndoReport(status: string): boolean {
  const entries = lines(status);
  return (
    entries.length > 0 &&
    entries.every((entry) => {
      const candidatePath = entry.slice(3).replace(/^"|"$/g, "");
      return candidatePath === UNDO_REPORT_PATH;
    })
  );
}

function repositoryBlockers(snapshot: RepositorySnapshot): string[] {
  const blockers: string[] = [];

  if (!snapshot.head) blockers.push("Repository has no resolvable HEAD.");
  if (!snapshot.branch) blockers.push("Detached HEAD is not allowed for undo.");
  if (snapshot.status) blockers.push("Working tree must be clean before undo preview.");
  if (snapshot.inProgressState.length > 0) {
    blockers.push(
      `Git operation already in progress: ${snapshot.inProgressState.join(", ")}. Resolve it manually before undo.`
    );
  }

  return blockers;
}

function normalizeEvidencePath(repoRoot: string, value: string): string {
  const trimmed = value.trim().replaceAll("\\", "/");

  if (!trimmed || path.isAbsolute(trimmed) || trimmed.split("/").includes("..")) {
    throw new Error(`Evidence path must be repo-relative and contained: ${value}`);
  }

  const absolutePath = path.resolve(repoRoot, trimmed);
  const relativePath = path.relative(repoRoot, absolutePath).replaceAll("\\", "/");

  if (!relativePath || relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
    throw new Error(`Evidence path must resolve inside the repository: ${value}`);
  }

  if (relativePath !== trimmed) {
    throw new Error(`Evidence path uses a non-canonical repository alias: ${value}`);
  }

  return relativePath;
}

async function assertCanonicalEvidenceParents(
  repoRoot: string,
  relativePath: string
): Promise<void> {
  const parentParts = relativePath.split("/").slice(0, -1);
  let currentPath = repoRoot;

  for (const part of parentParts) {
    currentPath = path.join(currentPath, part);
    let metadata: Awaited<ReturnType<typeof lstat>>;
    try {
      metadata = await lstat(currentPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }

    if (metadata.isSymbolicLink()) {
      try {
        const linkedPath = await realpath(currentPath);
        const linkedRelativePath = path.relative(repoRoot, linkedPath);
        if (
          linkedRelativePath === ".." ||
          linkedRelativePath.startsWith(`..${path.sep}`) ||
          path.isAbsolute(linkedRelativePath)
        ) {
          throw new Error(`Evidence path resolves outside the repository: ${relativePath}`);
        }
      } catch (error) {
        if (error instanceof Error && /resolves outside the repository/.test(error.message)) {
          throw error;
        }
        throw new Error(`Evidence path has a broken or unresolvable parent symlink: ${relativePath}`);
      }
      throw new Error(`Evidence path uses a parent symlink or non-canonical repository alias: ${relativePath}`);
    }

    if (!metadata.isDirectory()) {
      throw new Error(`Evidence path parent must be a directory: ${relativePath}`);
    }
  }
}

async function evidenceReceipts(
  repoRoot: string,
  evidencePaths: readonly string[]
): Promise<UndoEvidenceReceipt[]> {
  const normalized = [...new Set(evidencePaths.map((value) => normalizeEvidencePath(repoRoot, value)))].sort();
  const receipts: UndoEvidenceReceipt[] = [];

  for (const relativePath of normalized) {
    const absolutePath = path.join(repoRoot, relativePath);
    let contentSha256: string | null = null;

    if (relativePath === UNDO_REPORT_PATH) {
      throw new Error(`${UNDO_REPORT_PATH} cannot be its own undo evidence input.`);
    }

    try {
      await assertCanonicalEvidenceParents(repoRoot, relativePath);
      const metadata = await lstat(absolutePath);

      if (metadata.isSymbolicLink()) {
        try {
          const linkedPath = await realpath(absolutePath);
          const linkedRelativePath = path.relative(repoRoot, linkedPath);

          if (
            linkedRelativePath === ".." ||
            linkedRelativePath.startsWith(`..${path.sep}`) ||
            path.isAbsolute(linkedRelativePath)
          ) {
            throw new Error(`Evidence path resolves outside the repository: ${relativePath}`);
          }
        } catch (error) {
          if (error instanceof Error && /resolves outside the repository/.test(error.message)) {
            throw error;
          }
          throw new Error(`Evidence path is a broken or unresolvable symlink: ${relativePath}`);
        }
        throw new Error(`Evidence path is a symlink and is not canonical evidence: ${relativePath}`);
      }

      if (!metadata.isFile()) {
        throw new Error(`Evidence path must be a regular file: ${relativePath}`);
      }

      const realEvidencePath = await realpath(absolutePath);
      const realRelativePath = path.relative(repoRoot, realEvidencePath);

      if (
        realRelativePath === ".." ||
        realRelativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(realRelativePath)
      ) {
        throw new Error(`Evidence path resolves outside the repository: ${relativePath}`);
      }

      if (realEvidencePath !== absolutePath) {
        throw new Error(`Evidence path uses a symlink or non-canonical repository alias: ${relativePath}`);
      }

      contentSha256 = qualityShippingSha256(await readFile(realEvidencePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    receipts.push({ path: relativePath, contentSha256 });
  }

  return receipts;
}

async function readUndoReportReceipt(repoRoot: string): Promise<{
  exists: boolean;
  contentSha256: string | null;
  content: string | null;
  appliedReverts: UndoAppliedRevert[];
}> {
  const reportPath = path.join(repoRoot, UNDO_REPORT_PATH);

  if (!(await pathExists(reportPath))) {
    return { exists: false, contentSha256: null, content: null, appliedReverts: [] };
  }

  const contentBuffer = await readFile(reportPath);
  const content = contentBuffer.toString("utf8");
  const appliedReverts: UndoAppliedRevert[] = [];
  const ledgerSection = content.match(
    /(?:^|\n)## Durable Idempotency Ledger\s*\n([\s\S]*?)(?=\n## |$)/
  )?.[1] ?? "";

  for (const line of ledgerSection.split(/\r?\n/)) {
    const match = line.match(
      /^\|\s*((?:[0-9a-f]{40}|[0-9a-f]{64}))\s*\|\s*((?:[0-9a-f]{40}|[0-9a-f]{64}))\s*\|$/
    );
    if (match) {
      appliedReverts.push({ target: match[1]!, revertCommit: match[2]! });
    }
  }

  return {
    exists: true,
    contentSha256: qualityShippingSha256(contentBuffer),
    content,
    appliedReverts
  };
}

async function isAncestor(repoRoot: string, ancestor: string, descendant: string): Promise<boolean> {
  const result = await runGit(repoRoot, ["merge-base", "--is-ancestor", ancestor, descendant]);
  return result.exitCode === 0;
}

function inversePatchShapeFingerprint(diff: string): string | null {
  const semanticLines = diff
    .split(/\r?\n/)
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("index ")) return false;
      if (line.startsWith("--- ") || line.startsWith("+++ ")) return false;
      if (line.startsWith("@@")) return false;
      if (line.startsWith(" ")) return false;
      if (line === "\\ No newline at end of file") return false;
      return true;
    })
    .join("\n");

  return semanticLines ? qualityShippingSha256(semanticLines) : null;
}

type SemanticRevertCorrelation = "not-found" | "already-applied" | "ambiguous";

async function treePathFingerprint(
  repoRoot: string,
  treeish: string,
  changedPaths: readonly string[]
): Promise<string> {
  return qualityShippingSha256(
    await requiredGit(repoRoot, ["ls-tree", "-z", treeish, "--", ...changedPaths])
  );
}

async function expectedRevertTree(
  repoRoot: string,
  headBefore: string,
  candidate: UndoCandidate
): Promise<string | null> {
  const selectedParent = candidate.parents[(candidate.mainline ?? 1) - 1];
  if (!selectedParent) return null;
  const sourceObjectsRaw = await requiredGit(repoRoot, ["rev-parse", "--git-path", "objects"]);
  const sourceObjects = await realpath(
    path.isAbsolute(sourceObjectsRaw)
      ? sourceObjectsRaw
      : path.resolve(repoRoot, sourceObjectsRaw)
  );
  const temporaryObjectRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-undo-tree-"));
  const temporaryObjects = path.join(temporaryObjectRoot, "objects");

  try {
    await mkdir(temporaryObjects, { recursive: true });
    const result = await processRunner(
      "git",
      [
        "merge-tree",
        "--write-tree",
        "--no-messages",
        "--merge-base",
        candidate.sha,
        headBefore,
        selectedParent
      ],
      repoRoot,
      {
        ...qualityShippingGitEnvironment(),
        GIT_OBJECT_DIRECTORY: temporaryObjects,
        GIT_ALTERNATE_OBJECT_DIRECTORIES: sourceObjects
      }
    );
    const tree = result.stdout.trim().split(/\r?\n/, 1)[0] ?? "";

    return result.exitCode === 0 &&
      !result.signal &&
      !result.timedOut &&
      isCanonicalFullGitHash(tree)
      ? tree
      : null;
  } finally {
    await rm(temporaryObjectRoot, { recursive: true, force: true });
  }
}

async function exactRevertTransitionMatches(
  repoRoot: string,
  headBefore: string,
  headAfter: string,
  expectedTree: string | null
): Promise<boolean> {
  if (!expectedTree) return false;

  const [parentsResult, treeResult] = await Promise.all([
    runGit(repoRoot, ["show", "-s", "--format=%P", headAfter]),
    runGit(repoRoot, ["rev-parse", "--verify", `${headAfter}^{tree}`])
  ]);
  if (
    parentsResult.exitCode !== 0 ||
    parentsResult.signal ||
    parentsResult.timedOut ||
    treeResult.exitCode !== 0 ||
    treeResult.signal ||
    treeResult.timedOut
  ) {
    return false;
  }

  const parents = parentsResult.stdout.trim().split(/\s+/).filter(Boolean);
  return (
    parents.length === 1 &&
    parents[0] === headBefore &&
    treeResult.stdout.trim() === expectedTree
  );
}

async function correlateSemanticRevert(
  repoRoot: string,
  head: string,
  target: string,
  selectedParent: string,
  changedPaths: readonly string[]
): Promise<SemanticRevertCorrelation> {
  const reverseTargetDiff = await requiredGit(repoRoot, [
    "diff",
    "--no-ext-diff",
    "--no-renames",
    "--full-index",
    "--binary",
    target,
    selectedParent,
    "--",
    ...changedPaths
  ]);
  const reverseTargetExactFingerprint = qualityShippingSha256(reverseTargetDiff);
  const reverseTargetShapeFingerprint = inversePatchShapeFingerprint(reverseTargetDiff);

  if (!reverseTargetShapeFingerprint) return "ambiguous";

  const descendants = lines(
    await requiredGit(repoRoot, [
      "rev-list",
      "--parents",
      "--ancestry-path",
      `${target}..${head}`
    ])
  );
  let inverseLookingDescendant = false;

  for (const descendant of descendants) {
    const [commit, ...parents] = descendant.trim().split(/\s+/);
    if (!commit || parents.length !== 1) continue;

    const candidateDiff = await requiredGit(repoRoot, [
      "diff",
      "--no-ext-diff",
      "--no-renames",
      "--full-index",
      "--binary",
      parents[0]!,
      commit,
      "--",
      ...changedPaths
    ]);
    const exactMatch = qualityShippingSha256(candidateDiff) === reverseTargetExactFingerprint;
    const shapeMatch =
      inversePatchShapeFingerprint(candidateDiff) === reverseTargetShapeFingerprint;
    if (exactMatch || shapeMatch) {
      inverseLookingDescendant = true;
      break;
    }
  }

  if (!inverseLookingDescendant) return "not-found";

  const [headState, targetState, selectedParentState] = await Promise.all([
    treePathFingerprint(repoRoot, head, changedPaths),
    treePathFingerprint(repoRoot, target, changedPaths),
    treePathFingerprint(repoRoot, selectedParent, changedPaths)
  ]);

  if (headState === selectedParentState) return "already-applied";
  if (headState === targetState) return "ambiguous";
  return "ambiguous";
}

async function resolveCandidates(
  snapshot: RepositorySnapshot,
  targets: readonly UndoTargetInput[],
  priorAppliedReverts: readonly UndoAppliedRevert[] = []
): Promise<{ candidates: UndoCandidate[]; blockers: string[]; alreadyApplied: boolean }> {
  const blockers: string[] = [];
  const seen = new Set<string>();
  const unresolved: Array<Omit<UndoCandidate, "order" | "argv">> = [];
  let alreadyApplied = false;

  if (!snapshot.head) {
    return { candidates: [], blockers: ["Repository HEAD is unavailable."], alreadyApplied };
  }

  for (const target of targets) {
    const sha = target.sha.trim().toLowerCase();

    if (!isCanonicalFullGitHash(sha)) {
      blockers.push(`Undo target must be a canonical full commit hash: ${target.sha}`);
      continue;
    }
    if (seen.has(sha)) {
      blockers.push(`Duplicate undo target is not allowed: ${sha}`);
      continue;
    }
    seen.add(sha);

    if (priorAppliedReverts.some((entry) => entry.target === sha)) {
      blockers.push(`Undo target already appears in the durable idempotency ledger: ${sha}`);
      alreadyApplied = true;
      continue;
    }

    const resolved = await runGit(snapshot.repoRoot, ["rev-parse", "--verify", `${sha}^{commit}`]);
    const resolvedSha = resolved.stdout.trim().toLowerCase();

    if (resolved.exitCode !== 0 || resolvedSha !== sha) {
      blockers.push(`Undo target does not resolve exactly to a commit: ${sha}`);
      continue;
    }
    if (!(await isAncestor(snapshot.repoRoot, sha, snapshot.head))) {
      blockers.push(`Undo target is not an ancestor of approved HEAD: ${sha}`);
      continue;
    }
    const metadata = await requiredGit(snapshot.repoRoot, [
      "show",
      "-s",
      "--format=%H%x00%P%x00%s",
      sha
    ]);
    const [metadataSha = "", parentsRaw = "", subject = ""] = metadata.split("\0");
    const parents = parentsRaw.trim() ? parentsRaw.trim().split(/\s+/) : [];

    if (metadataSha.toLowerCase() !== sha) {
      blockers.push(`Undo target metadata changed during preview: ${sha}`);
      continue;
    }
    if (parents.length === 0) {
      blockers.push(`Root commits are not supported by bounded undo: ${sha}`);
      continue;
    }
    if (parents.length > 1 && target.mainline === undefined) {
      blockers.push(`Merge commit requires an explicit mainline parent: ${sha}`);
      continue;
    }
    if (
      target.mainline !== undefined &&
      (parents.length === 1 || target.mainline < 1 || target.mainline > parents.length)
    ) {
      blockers.push(`Invalid mainline parent ${String(target.mainline)} for ${sha}.`);
      continue;
    }

    const changedPaths = lines(
      parents.length > 1 && target.mainline !== undefined
        ? await requiredGit(snapshot.repoRoot, [
            "diff",
            "--name-only",
            parents[target.mainline - 1]!,
            sha
          ])
        : await requiredGit(snapshot.repoRoot, [
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            sha
          ])
    ).sort();

    const selectedParent = parents[(target.mainline ?? 1) - 1]!;
    const semanticRevert = await correlateSemanticRevert(
      snapshot.repoRoot,
      snapshot.head,
      sha,
      selectedParent,
      changedPaths
    );
    if (semanticRevert === "already-applied") {
      blockers.push(
        `Undo target has a semantic inverse patch descendant and its current paths match the selected parent: ${sha}`
      );
      alreadyApplied = true;
      continue;
    }
    if (semanticRevert === "ambiguous") {
      blockers.push(
        `Undo target has inverse-looking descendant history, but its current paths do not prove that the target effect is absent: ${sha}`
      );
      continue;
    }

    unresolved.push({
      sha,
      parents,
      mainline: target.mainline ?? null,
      subject,
      changedPaths
    });
  }

  const relation = new Map<string, number>();
  for (let left = 0; left < unresolved.length; left += 1) {
    for (let right = left + 1; right < unresolved.length; right += 1) {
      const leftCandidate = unresolved[left]!;
      const rightCandidate = unresolved[right]!;
      const leftBeforeRight = await isAncestor(
        snapshot.repoRoot,
        leftCandidate.sha,
        rightCandidate.sha
      );
      const rightBeforeLeft = await isAncestor(
        snapshot.repoRoot,
        rightCandidate.sha,
        leftCandidate.sha
      );

      if (!leftBeforeRight && !rightBeforeLeft) {
        blockers.push(
          `Undo targets are incomparable; provide a single ancestry chain: ${leftCandidate.sha}, ${rightCandidate.sha}`
        );
      } else {
        relation.set(
          `${leftCandidate.sha}:${rightCandidate.sha}`,
          leftBeforeRight ? 1 : -1
        );
        relation.set(
          `${rightCandidate.sha}:${leftCandidate.sha}`,
          leftBeforeRight ? -1 : 1
        );
      }
    }
  }

  const ordered = [...unresolved].sort(
    (left, right) => relation.get(`${left.sha}:${right.sha}`) ?? 0
  );
  const candidates = ordered.map((candidate, index) => {
    const argv = candidate.mainline
      ? ["revert", "--no-edit", "-m", String(candidate.mainline), candidate.sha]
      : ["revert", "--no-edit", candidate.sha];
    assertUndoRevertArgv(argv);
    return { ...candidate, order: index + 1, argv };
  });

  return { candidates, blockers, alreadyApplied };
}

function markdownValue(value: string): string {
  return value.replaceAll("|", "\\|").replace(/[\r\n]+/g, " ").trim();
}

function displayArgv(argv: readonly string[]): string {
  return ["git", ...argv].join(" ");
}

function renderDurableLedger(entries: readonly UndoAppliedRevert[]): string {
  const uniqueEntries = [...new Map(entries.map((entry) => [entry.target, entry])).values()];
  const rows = uniqueEntries.length > 0
    ? uniqueEntries.map((entry) => `| ${entry.target} | ${entry.revertCommit} |`).join("\n")
    : "| none | none |";

  return `## Durable Idempotency Ledger

| Original target | Created revert commit |
|---|---|
${rows}`;
}

type UndoReportPacketView = Omit<UndoApprovalPacket, "report"> & {
  reportOverwriteApproved: boolean;
};

function renderPreMutationReport(packet: UndoReportPacketView): string {
  const evidencePaths = packet.evidence.map((entry) => entry.path).join(", ") || "none";
  const trackedFiles = [...new Set(packet.candidates.flatMap((candidate) => candidate.changedPaths))]
    .sort()
    .join(", ") || "none";
  const ledger = packet.candidates
    .map(
      (candidate) =>
        `| ${candidate.sha} | ${markdownValue(candidate.subject)} | ${markdownValue(candidate.changedPaths.join(", ") || "none")} | revert | order ${candidate.order}${candidate.mainline ? `; mainline ${candidate.mainline}` : ""} |`
    )
    .join("\n");
  const commands = packet.candidates.map((candidate) => displayArgv(candidate.argv)).join(", then ");

  return `# Undo Report

## Requested Scope

- **Scope:** commits
- **Reason:** ${markdownValue(packet.reason)}
- **Execution mode:** confirmed-run
- **Pending gate:** approved

## Branch State

- **Current branch:** ${packet.branch}
- **HEAD:** ${packet.head}
- **Working tree status:** clean
- **Merge state:** not in progress
- **Report overwrite status:** ${packet.reportOverwriteApproved ? "overwrite approved" : "new report"}

## Affected Evidence And Digest Inputs

- **Digest inputs used:** ${evidencePaths}
- **Affected evidence:** ${evidencePaths}
- **Stale evidence impact:** ${markdownValue(packet.dependencyImpact || "none")}
- **Tracked files:** ${trackedFiles}

## Candidate Revert Set

- **Commit ledger:**

| Commit | Subject | Scope | Revert action | Notes |
|---|---|---|---|---|
${ledger}

## Dependency Impact

- **Dependency risk:** ${markdownValue(packet.dependencyImpact || "none")}

## Approved Revert Commands

- **Pending git commands:** none
- **Approved git commands:** ${commands}
- **Forbidden-command check:** passed

## Mutation Outcome

- **Revert outcome:** not-run
- **Blockers:** none

${renderDurableLedger(packet.priorAppliedReverts)}

## Next Safe Action

- Run the approved one-shot undo execution.
`;
}

function renderOutcomeReport(
  packet: UndoApprovalPacket,
  result: UndoExecutionResult
): string {
  const preReport = renderPreMutationReport({
    ...packet,
    reportOverwriteApproved: packet.report.overwriteApproved
  });
  const outcome =
    result.mutationStatus === "succeeded"
      ? "success"
      : result.mutationStatus === "outcome-unknown"
        ? "outcome-unknown"
        : result.status === "partial"
          ? "partial"
          : result.status === "blocked" || result.status === "stale"
            ? "blocked"
            : "failed";
  const blockers = result.blockers.join("; ") || "none";
  const finalMergeState = result.inProgressState.length > 0
    ? `${result.inProgressState[0]} in progress`
    : "not in progress";
  const appliedReverts = [
    ...packet.priorAppliedReverts,
    ...result.reverted
  ];
  const processRows = result.processes.length
    ? result.processes
        .map(
          (receipt) =>
            `| ${receipt.target} | ${receipt.result.exitCode ?? "null"} | ${receipt.result.signal ?? "none"} | ${receipt.result.timedOut} | ${markdownValue(receipt.result.stdout || "none")} | ${markdownValue(receipt.result.stderr || "none")} |`
        )
        .join("\n")
    : "| none | none | none | false | none | none |";

  const reportWithOutcome = preReport.replace(
    /- \*\*Revert outcome:\*\* not-run\n- \*\*Blockers:\*\* none/,
    `- **Revert outcome:** ${outcome}\n- **Blockers:** ${markdownValue(blockers)}`
  ).replace(
    /- \*\*Working tree status:\*\* clean/,
    `- **Working tree status:** ${result.finalWorkingTreeStatus}`
  ).replace(
    /- \*\*Merge state:\*\* not in progress/,
    `- **Merge state:** ${finalMergeState}`
  ).replace(
    "- Run the approved one-shot undo execution.",
    result.recoveryActions.length > 0
      ? `- ${markdownValue(result.recoveryActions.join("; "))}`
      : "- /blu-progress"
  ).replace(
    /## Durable Idempotency Ledger[\s\S]*?(?=\n## Next Safe Action)/,
    renderDurableLedger(appliedReverts)
  );

  return `${reportWithOutcome}
## Structured Execution Receipt

- **Operation id:** ${result.operationId}
- **Approval fingerprint:** ${result.fingerprint}
- **Original HEAD:** ${result.originalHead ?? "none"}
- **Final HEAD:** ${result.finalHead ?? "none"}
- **Mutation status:** ${result.mutationStatus}
- **Attempted targets:** ${result.attempted.join(", ") || "none"}
- **Reverted targets:** ${result.reverted.map((entry) => `${entry.target}->${entry.revertCommit}`).join(", ") || "none"}
- **Unreverted targets:** ${result.unreverted.join(", ") || "none"}
- **In-progress state:** ${result.inProgressState.join(", ") || "none"}
- **Conflicted paths:** ${result.conflictedPaths.join(", ") || "none"}
- **State persistence status:** ${result.state.status}
- **State persistence path:** ${result.state.path ?? "none"}
- **State persistence error:** ${markdownValue(result.state.error ?? "none")}

| Target | Exit code | Signal | Timed out | Stdout | Stderr |
|---|---:|---|---|---|---|
${processRows}
`;
}

async function buildApprovalPacket(args: UndoPreviewArgs): Promise<{
  packet: UndoApprovalPacket | null;
  preMutationReportContent: string | null;
  blockers: string[];
  alreadyApplied: boolean;
}> {
  const snapshot = await inspectRepository(args.cwd ?? process.cwd());
  const blockers = repositoryBlockers(snapshot);

  if (!snapshot.head || !snapshot.branch) {
    return { packet: null, preMutationReportContent: null, blockers, alreadyApplied: false };
  }

  const reportReceipt = await readUndoReportReceipt(snapshot.repoRoot);
  const resolved = await resolveCandidates(
    snapshot,
    args.targets,
    reportReceipt.appliedReverts
  );
  blockers.push(...resolved.blockers);
  const reportExists = reportReceipt.exists;

  if (reportExists && !args.overwriteReport) {
    blockers.push("undo-latest already exists and requires explicit report overwrite confirmation.");
  }

  if (!Array.isArray(args.evidencePaths) || args.evidencePaths.length === 0) {
    blockers.push("Undo preview requires at least one authoritative evidence or digest input path.");
  }

  if (
    resolved.candidates.some((candidate) =>
      candidate.changedPaths.includes(UNDO_REPORT_PATH)
    )
  ) {
    blockers.push(
      `${UNDO_REPORT_PATH} overlaps the candidate revert patch and cannot be safely used for report-before-mutate undo.`
    );
  }

  let evidence: UndoEvidenceReceipt[] = [];
  try {
    evidence = await evidenceReceipts(snapshot.repoRoot, args.evidencePaths ?? []);
  } catch (error) {
    blockers.push(errorMessage(error));
  }

  if (blockers.length > 0) {
    return {
      packet: null,
      preMutationReportContent: null,
      blockers,
      alreadyApplied: resolved.alreadyApplied
    };
  }

  const packetBase = {
    schemaVersion: UNDO_SCHEMA_VERSION as 1,
    operation: "undo" as const,
    repoRoot: snapshot.repoRoot,
    gitCommonDir: snapshot.gitCommonDir,
    branch: snapshot.branch,
    head: snapshot.head,
    gitConfigSha256: snapshot.gitConfigSha256,
    workingTreeFingerprint: qualityShippingSha256(snapshot.status),
    inProgressState: snapshot.inProgressState,
    candidates: resolved.candidates,
    evidence,
    priorAppliedReverts: reportReceipt.appliedReverts,
    reason: args.reason.trim(),
    dependencyImpact: args.dependencyImpact?.trim() || "none",
    statePatch: args.statePatch ?? null,
    reportOverwriteApproved: Boolean(args.overwriteReport)
  };
  const preMutationReportContent = renderPreMutationReport(packetBase);
  const { reportOverwriteApproved: _reportOverwriteApproved, ...fingerprintBase } = packetBase;
  const packet: UndoApprovalPacket = {
    ...fingerprintBase,
    report: {
      path: UNDO_REPORT_PATH,
      overwriteApproved: Boolean(args.overwriteReport),
      priorExists: reportReceipt.exists,
      priorContentSha256: reportReceipt.contentSha256,
      preMutationContentSha256: qualityShippingSha256(preMutationReportContent)
    }
  };

  return { packet, preMutationReportContent, blockers: [], alreadyApplied: false };
}

export async function blueprintUndoPreview(args: UndoPreviewArgs): Promise<UndoPreviewResult> {
  try {
    pruneApprovals(true);
    const built = await buildApprovalPacket(args);

    if (!built.packet || !built.preMutationReportContent) {
      const overwriteBlocked = built.blockers.some((blocker) => blocker.includes("overwrite confirmation"));
      return {
        status: built.alreadyApplied ? "already-applied" : "blocked",
        operationId: null,
        fingerprint: null,
        packet: null,
        waitingState: overwriteBlocked ? "report-overwrite-confirmation" : null,
        blockers: built.blockers,
        warnings: []
      };
    }

    const operationId = randomUUID();
    const fingerprint = qualityShippingFingerprint(built.packet);
    approvals.set(operationId, {
      packet: built.packet,
      fingerprint,
      preMutationReportContent: built.preMutationReportContent,
      consumed: false,
      completionStatus: null,
      createdAt: nowProvider(),
      expiresAt: nowProvider() + approvalTtlMs,
      terminalExpiresAt: null,
      lastResult: null,
      outcomeReportContent: null,
      expectedReportContentSha256: built.packet.report.priorContentSha256,
      deferredStateAfterReportRecovery: false
    });

    return {
      status: "ready",
      operationId,
      fingerprint,
      packet: built.packet,
      waitingState: "undo-confirmation",
      blockers: [],
      warnings: []
    };
  } catch (error) {
    return {
      status: "invalid",
      operationId: null,
      fingerprint: null,
      packet: null,
      waitingState: null,
      blockers: [errorMessage(error)],
      warnings: []
    };
  }
}

function emptyExecutionResult(
  operationId: string,
  fingerprint: string,
  status: UndoExecutionStatus,
  blocker: string
): UndoExecutionResult {
  return {
    status,
    stage: "approval",
    operationId,
    fingerprint,
    mutationStarted: false,
    mutationStatus: "not-started",
    originalHead: null,
    finalHead: null,
    finalWorkingTreeStatus: "unknown",
    attempted: [],
    reverted: [],
    unreverted: [],
    processes: [],
    conflictedPaths: [],
    inProgressState: [],
    report: {
      path: UNDO_REPORT_PATH,
      preMutationStatus: "not-attempted",
      outcomeStatus: "not-attempted",
      error: null
    },
    state: {
      status: "not-attempted",
      path: null,
      error: null
    },
    blockers: [blocker],
    warnings: [],
    recoveryActions: []
  };
}

async function revalidateApproval(stored: StoredApproval): Promise<string[]> {
  const live = await inspectRepository(stored.packet.repoRoot);
  const blockers: string[] = [];

  if (live.repoRoot !== stored.packet.repoRoot || live.gitCommonDir !== stored.packet.gitCommonDir) {
    blockers.push("Repository identity changed after approval.");
  }
  if (live.branch !== stored.packet.branch) blockers.push("Branch changed after approval.");
  if (live.head !== stored.packet.head) blockers.push("HEAD changed after approval.");
  if (live.gitConfigSha256 !== stored.packet.gitConfigSha256) {
    blockers.push("Effective git configuration changed after approval.");
  }
  if (qualityShippingSha256(live.status) !== stored.packet.workingTreeFingerprint) {
    blockers.push("Working tree changed after approval.");
  }
  if (live.inProgressState.join("\0") !== stored.packet.inProgressState.join("\0")) {
    blockers.push("Git sequencer state changed after approval.");
  }
  try {
    const liveEvidence = await evidenceReceipts(
      stored.packet.repoRoot,
      stored.packet.evidence.map((entry) => entry.path)
    );
    if (qualityShippingFingerprint(liveEvidence) !== qualityShippingFingerprint(stored.packet.evidence)) {
      blockers.push("Evidence inputs changed after approval.");
    }
  } catch (error) {
    blockers.push(`Evidence inputs changed after approval: ${errorMessage(error)}`);
  }
  const candidates = await resolveCandidates(
    live,
    stored.packet.candidates.map((candidate) => ({
      sha: candidate.sha,
      mainline: candidate.mainline ?? undefined
    })),
    stored.packet.priorAppliedReverts
  );
  if (candidates.blockers.length > 0) blockers.push(...candidates.blockers);
  if (qualityShippingFingerprint(candidates.candidates) !== qualityShippingFingerprint(stored.packet.candidates)) {
    blockers.push("Candidate ledger or revert order changed after approval.");
  }
  const reportReceipt = await readUndoReportReceipt(stored.packet.repoRoot);
  if (
    reportReceipt.exists !== stored.packet.report.priorExists ||
    reportReceipt.contentSha256 !== stored.packet.report.priorContentSha256
  ) {
    blockers.push("undo-latest existence or content changed after approval.");
  }

  return [...new Set(blockers)];
}

async function observedConflictState(repoRoot: string): Promise<ObservedUndoState> {
  const snapshot = await inspectRepository(repoRoot);
  const conflicts = await runGit(repoRoot, ["diff", "--name-only", "--diff-filter=U"]);
  return {
    head: snapshot.head,
    branch: snapshot.branch,
    gitConfigSha256: snapshot.gitConfigSha256,
    status: snapshot.status,
    inProgressState: snapshot.inProgressState,
    conflictedPaths: lines(conflicts.stdout).sort()
  };
}

function reportStatus(result: UndoReportWriteResult): "created" | "updated" | "reused" | "failed" {
  return result.status === "invalid" ? "failed" : result.status;
}

async function replacePreMutationReportWithTerminalOutcome(
  stored: StoredApproval,
  result: UndoExecutionResult
): Promise<void> {
  const terminalContent = renderOutcomeReport(stored.packet, result);
  stored.outcomeReportContent = terminalContent;

  try {
    const terminalReport = await reportWriter({
      cwd: stored.packet.repoRoot,
      reportName: UNDO_REPORT_NAME,
      content: terminalContent,
      overwrite: true,
      expectedExistingContentSha256: stored.expectedReportContentSha256
    });
    result.report.outcomeStatus = reportStatus(terminalReport);
    if (terminalReport.status === "invalid") {
      throw new Error(terminalReport.issues.join("; ") || "Terminal undo report validation failed.");
    }
    result.report.error = null;
    stored.expectedReportContentSha256 = qualityShippingSha256(terminalContent);
  } catch (error) {
    result.report.outcomeStatus = "failed";
    result.report.error = errorMessage(error);
    result.blockers.push(
      `The consumed approval is stale, but terminal report replacement failed: ${errorMessage(error)}`
    );
    result.recoveryActions = [
      "Call blueprint_undo_persist for stage outcome-report; never run the stale approval or retry git."
    ];
  }
}

export async function blueprintUndoExecute(args: {
  operationId: string;
  fingerprint: string;
  confirmed: true;
}): Promise<UndoExecutionResult> {
  pruneApprovals();
  const stored = approvals.get(args.operationId);

  if (!stored) {
    return emptyExecutionResult(
      args.operationId,
      args.fingerprint,
      "stale",
      "Undo approval is missing or expired; create a fresh preview."
    );
  }
  if (stored.consumed) {
    return emptyExecutionResult(
      args.operationId,
      args.fingerprint,
      stored.completionStatus === "succeeded" ? "already-applied" : "stale",
      "Undo approval is one-shot and has already been consumed."
    );
  }

  if (args.fingerprint !== stored.fingerprint || qualityShippingFingerprint(stored.packet) !== stored.fingerprint) {
    stored.consumed = true;
    const result = emptyExecutionResult(
      args.operationId,
      args.fingerprint,
      "stale",
      "Undo approval fingerprint does not match the canonical packet."
    );
    recordTerminalResult(stored, result);
    return result;
  }

  const releaseLock = tryAcquireQualityShippingOperationLock(
    "undo",
    stored.packet.gitCommonDir
  );
  if (!releaseLock) {
    return emptyExecutionResult(
      args.operationId,
      args.fingerprint,
      "blocked",
      "Another Quality Shipping operation is active for this repository; this approval remains unconsumed."
    );
  }

  try {
    if (stored.consumed) {
      return emptyExecutionResult(
        args.operationId,
        args.fingerprint,
        "stale",
        "Undo approval was consumed while waiting for the operation lock."
      );
    }
    stored.consumed = true;
    const result = emptyExecutionResult(args.operationId, args.fingerprint, "failed", "");
    result.blockers = [];
    result.originalHead = stored.packet.head;
    result.finalHead = stored.packet.head;
    result.unreverted = stored.packet.candidates.map((candidate) => candidate.sha);
    result.state.status = stored.packet.statePatch ? "not-attempted" : "not-requested";

    try {
      result.stage = "revalidate";
      const staleReasons = await revalidateApproval(stored);
      if (staleReasons.length > 0) {
        result.status = "stale";
        result.blockers = staleReasons;
        recordTerminalResult(stored, result);
        return result;
      }

      result.stage = "pre-report";
      const preReport = await reportWriter({
        cwd: stored.packet.repoRoot,
        reportName: UNDO_REPORT_NAME,
        content: stored.preMutationReportContent,
        overwrite: stored.packet.report.overwriteApproved,
        expectedExistingContentSha256: stored.packet.report.priorContentSha256
      });
      result.report.preMutationStatus = reportStatus(preReport);
      if (preReport.status === "invalid") {
        result.status = "blocked";
        result.blockers = preReport.issues;
        result.report.error = preReport.issues.join("; ");
        recordTerminalResult(stored, result);
        return result;
      }

      const persistedPreReport = await readFile(
        path.join(stored.packet.repoRoot, stored.packet.report.path)
      );
      if (qualityShippingSha256(persistedPreReport) !== stored.packet.report.preMutationContentSha256) {
        result.status = "stale";
        result.blockers = ["Persisted pre-mutation report does not match the approved report receipt."];
        recordTerminalResult(stored, result);
        return result;
      }
      stored.expectedReportContentSha256 = stored.packet.report.preMutationContentSha256;

      const afterReport = await inspectRepository(stored.packet.repoRoot);
      const afterReportEvidence = await evidenceReceipts(
        stored.packet.repoRoot,
        stored.packet.evidence.map((entry) => entry.path)
      );
      if (
        afterReport.head !== stored.packet.head ||
        afterReport.branch !== stored.packet.branch ||
        afterReport.gitConfigSha256 !== stored.packet.gitConfigSha256 ||
        afterReport.inProgressState.length > 0 ||
        (afterReport.status && !statusContainsOnlyUndoReport(afterReport.status)) ||
        qualityShippingFingerprint(afterReportEvidence) !==
          qualityShippingFingerprint(stored.packet.evidence)
      ) {
        result.status = "stale";
        result.blockers = ["Repository changed after the pre-mutation report was persisted."];
        result.finalHead = afterReport.head;
        result.finalWorkingTreeStatus =
          afterReport.status && !statusContainsOnlyUndoReport(afterReport.status)
            ? "dirty"
            : "clean";
        result.inProgressState = afterReport.inProgressState;
        result.recoveryActions = [
          "Create a fresh undo preview; the consumed approval cannot be reused."
        ];
        await replacePreMutationReportWithTerminalOutcome(stored, result);
        recordTerminalResult(stored, result);
        return result;
      }

      result.stage = "execute";
      let expectedHead = stored.packet.head;

      for (const candidate of stored.packet.candidates) {
        const beforeStep = await inspectRepository(stored.packet.repoRoot);
        if (
          beforeStep.head !== expectedHead ||
          beforeStep.branch !== stored.packet.branch ||
          beforeStep.gitConfigSha256 !== stored.packet.gitConfigSha256 ||
          beforeStep.inProgressState.length > 0 ||
          (beforeStep.status && !statusContainsOnlyUndoReport(beforeStep.status))
        ) {
          result.status = result.mutationStarted ? "partial" : "stale";
          result.mutationStatus = result.mutationStarted ? "partial" : "not-started";
          result.blockers.push("Repository changed immediately before an approved revert step.");
          break;
        }

        assertUndoRevertArgv(candidate.argv);
        const expectedTree = await expectedRevertTree(
          stored.packet.repoRoot,
          expectedHead,
          candidate
        );
        result.mutationStarted = true;
        result.attempted.push(candidate.sha);
        let processResult: QualityShippingProcessResult;
        try {
          processResult = await runGit(stored.packet.repoRoot, candidate.argv);
        } catch (error) {
          processResult = {
            exitCode: null,
            stdout: "",
            stderr: errorMessage(error),
            signal: null,
            timedOut: false
          };
        }
        const observed = await observedConflictState(stored.packet.repoRoot).catch(() => null);
        if (!observed) {
          result.processes.push({
            target: candidate.sha,
            argv: [...candidate.argv],
            result: processResult,
            headBefore: expectedHead,
            headAfter: expectedHead
          });
          result.status = "outcome-unknown";
          result.mutationStatus = "outcome-unknown";
          result.finalWorkingTreeStatus = "unknown";
          result.blockers.push(
            processResult.stderr || "Unable to inspect repository state after the revert process."
          );
          result.recoveryActions = ["Inspect HEAD, status, and sequencer state manually before any recovery."];
          break;
        }
        const headAfter = observed.head ?? expectedHead;
        result.processes.push({
          target: candidate.sha,
          argv: [...candidate.argv],
          result: processResult,
          headBefore: expectedHead,
          headAfter
        });
        result.finalHead = headAfter;
        result.inProgressState = observed.inProgressState;
        result.conflictedPaths = observed.conflictedPaths;
        result.finalWorkingTreeStatus = observed.status ? "dirty" : "clean";

        if (
          processResult.exitCode !== 0 ||
          processResult.signal ||
          processResult.timedOut
        ) {
          result.mutationStatus =
            headAfter !== expectedHead || processResult.exitCode === null
              ? "outcome-unknown"
              : "partial";
          result.status =
            result.mutationStatus === "outcome-unknown" ? "outcome-unknown" : "partial";
          result.blockers.push(
            processResult.stderr || processResult.stdout || "git revert failed without process output."
          );
          result.recoveryActions = observed.inProgressState.includes("revert") || observed.inProgressState.includes("sequencer")
            ? ["Resolve conflicts, then manually run git revert --continue, or manually run git revert --abort."]
            : ["Inspect the recorded process receipt and repository state before creating a fresh preview."];
          break;
        }

        if (headAfter === expectedHead) {
          result.status = "outcome-unknown";
          result.mutationStatus = "outcome-unknown";
          result.blockers.push("git revert exited successfully but HEAD did not advance.");
          result.recoveryActions = ["Inspect git history and repository state before any retry."];
          break;
        }

        if (
          observed.inProgressState.length > 0 ||
          observed.conflictedPaths.length > 0 ||
          (observed.status && !statusContainsOnlyUndoReport(observed.status))
        ) {
          result.status = "partial";
          result.mutationStatus = "partial";
          result.blockers.push(
            "git revert exited successfully but the observed repository state is not clean and settled."
          );
          result.recoveryActions = [
            "Inspect the recorded HEAD, status, conflicts, and sequencer state before any retry."
          ];
          break;
        }

        const exactTransition =
          observed.branch === stored.packet.branch &&
          observed.gitConfigSha256 === stored.packet.gitConfigSha256 &&
          await exactRevertTransitionMatches(
            stored.packet.repoRoot,
            expectedHead,
            headAfter,
            expectedTree
          );
        if (!exactTransition) {
          result.status = "outcome-unknown";
          result.mutationStatus = "outcome-unknown";
          result.blockers.push(
            "git revert exited successfully, but the observed commit is not the exact approved direct-parent revert transition."
          );
          result.recoveryActions = [
            "Inspect the recorded HEAD, its parent and tree, branch, and effective git configuration before any retry."
          ];
          break;
        }

        result.reverted.push({ target: candidate.sha, revertCommit: headAfter });
        result.unreverted = result.unreverted.filter((sha) => sha !== candidate.sha);
        expectedHead = headAfter;
      }

      if (result.reverted.length === stored.packet.candidates.length) {
        result.status = "succeeded";
        result.mutationStatus = "succeeded";
        result.finalHead = expectedHead;
        result.recoveryActions = [];
      } else if (result.mutationStarted && result.status === "failed") {
        if (result.mutationStatus !== "outcome-unknown") result.status = "partial";
        result.mutationStatus = "partial";
      }

      result.stage = "outcome-report";
      const outcomeContent = renderOutcomeReport(stored.packet, result);
      stored.outcomeReportContent = outcomeContent;
      try {
        const outcomeReport = await reportWriter({
          cwd: stored.packet.repoRoot,
          reportName: UNDO_REPORT_NAME,
          content: outcomeContent,
          overwrite: true,
          expectedExistingContentSha256: stored.expectedReportContentSha256
        });
        result.report.outcomeStatus = reportStatus(outcomeReport);
        if (outcomeReport.status === "invalid") {
          throw new Error(outcomeReport.issues.join("; ") || "Outcome report validation failed.");
        }
        stored.expectedReportContentSha256 = qualityShippingSha256(outcomeContent);
      } catch (error) {
        result.report.outcomeStatus = "failed";
        result.report.error = errorMessage(error);
        result.blockers.push(`Git outcome is preserved, but the actual-outcome report failed: ${errorMessage(error)}`);
        result.recoveryActions.push(
          "Call blueprint_undo_persist for stage outcome-report with this operation id and fingerprint; do not retry git revert."
        );
        if (result.mutationStatus !== "outcome-unknown") result.status = "partial";
        recordTerminalResult(stored, result);
        return result;
      }

      if (result.mutationStatus !== "succeeded" || !stored.packet.statePatch) {
        recordTerminalResult(stored, result);
        return result;
      }

      result.stage = "state";
      try {
        const stateResult = await stateUpdater({
          cwd: stored.packet.repoRoot,
          patch: stored.packet.statePatch
        });
        result.state = {
          status: stateResult.updated ? "updated" : "unchanged",
          path: stateResult.statePath,
          error: null
        };
      } catch (error) {
        result.state = {
          status: "failed",
          path: null,
          error: errorMessage(error)
        };
        result.blockers.push(`Git and outcome report succeeded, but state update failed: ${errorMessage(error)}`);
        result.recoveryActions.push("Retry only the state update after verifying the saved outcome report.");
        result.status = "partial";
      }

      const finalOutcomeContent = renderOutcomeReport(stored.packet, result);
      stored.outcomeReportContent = finalOutcomeContent;
      try {
        const finalReport = await reportWriter({
          cwd: stored.packet.repoRoot,
          reportName: UNDO_REPORT_NAME,
          content: finalOutcomeContent,
          overwrite: true,
          expectedExistingContentSha256: stored.expectedReportContentSha256
        });
        result.report.outcomeStatus = reportStatus(finalReport);
        if (finalReport.status === "invalid") {
          throw new Error(finalReport.issues.join("; ") || "Final state receipt report validation failed.");
        }
        stored.expectedReportContentSha256 = qualityShippingSha256(finalOutcomeContent);
      } catch (error) {
        result.report.outcomeStatus = "failed";
        result.report.error = errorMessage(error);
        result.status = "partial";
        result.recoveryActions.push(
          "Call blueprint_undo_persist for stage outcome-report; git and state must not be retried."
        );
      }
      if (result.state.status === "failed" && result.report.outcomeStatus !== "failed") {
        result.recoveryActions = [
          "Call blueprint_undo_persist for stage state; it will retry only state persistence and then refresh the final report."
        ];
      }

      recordTerminalResult(stored, result);
      return result;
    } catch (error) {
      const message = errorMessage(error);
      result.blockers.push(message);
      if (!result.mutationStarted) {
        result.status = result.stage === "pre-report" ? "blocked" : "failed";
        result.mutationStatus = "not-started";
        if (result.stage === "pre-report") {
          result.report.preMutationStatus = "failed";
          result.report.error = message;
        }
      } else {
        const observed = await observedConflictState(stored.packet.repoRoot).catch(() => null);
        result.status = observed ? "partial" : "outcome-unknown";
        result.mutationStatus = observed ? "partial" : "outcome-unknown";
        if (observed) {
          result.finalHead = observed.head;
          result.finalWorkingTreeStatus = observed.status ? "dirty" : "clean";
          result.inProgressState = observed.inProgressState;
          result.conflictedPaths = observed.conflictedPaths;
        }
        result.recoveryActions.push("Inspect repository state before any retry; never auto-abort or auto-retry undo.");
      }
      recordTerminalResult(stored, result);
      return result;
    }
  } finally {
    releaseLock();
  }
}

export async function blueprintUndoPersist(args: {
  operationId: string;
  fingerprint: string;
  stage: "outcome-report" | "state";
}): Promise<UndoExecutionResult> {
  pruneApprovals();
  const stored = approvals.get(args.operationId);

  if (!stored || !stored.consumed || !stored.lastResult) {
    return emptyExecutionResult(
      args.operationId,
      args.fingerprint,
      "stale",
      "Undo terminal receipt is missing or expired; persistence recovery is unavailable."
    );
  }
  if (args.fingerprint !== stored.fingerprint) {
    return emptyExecutionResult(
      args.operationId,
      args.fingerprint,
      "stale",
      "Persistence recovery fingerprint does not match the terminal undo receipt."
    );
  }

  const releaseLock = tryAcquireQualityShippingOperationLock("undo", stored.packet.gitCommonDir);
  if (!releaseLock) {
    return emptyExecutionResult(
      args.operationId,
      args.fingerprint,
      "blocked",
      "Another Quality Shipping operation is active; persistence recovery did not start."
    );
  }

  try {
    const result = structuredClone(stored.lastResult);
    result.stage = "persistence-recovery";

    const removeOutcomeReportPersistenceDiagnostics = () => {
      result.blockers = result.blockers.filter(
        (blocker) =>
          !blocker.startsWith("Git outcome is preserved, but the actual-outcome report failed:") &&
          !blocker.startsWith("Persistence-only report recovery failed:")
      );
      result.recoveryActions = result.recoveryActions.filter(
        (action) =>
          !action.startsWith("Call blueprint_undo_persist for stage outcome-report") &&
          action !== "Retry only blueprint_undo_persist; do not retry git."
      );
    };
    const removeStatePersistenceDiagnostics = () => {
      result.blockers = result.blockers.filter(
        (blocker) =>
          !blocker.startsWith("Git and outcome report succeeded, but state update failed:") &&
          !blocker.startsWith("State persistence recovery failed:")
      );
      result.recoveryActions = result.recoveryActions.filter(
        (action) =>
          action !== "Retry only the state update after verifying the saved outcome report." &&
          !action.startsWith("Call blueprint_undo_persist for stage state") &&
          action !== "Retry only blueprint_undo_persist stage state."
      );
    };
    const appendRecoveryAction = (action: string) => {
      if (!result.recoveryActions.includes(action)) result.recoveryActions.push(action);
    };

    if (args.stage === "state") {
      if (
        result.mutationStatus !== "succeeded" ||
        !stored.packet.statePatch ||
        result.report.outcomeStatus === "failed" ||
        (result.state.status !== "failed" &&
          !(result.state.status === "not-attempted" && stored.deferredStateAfterReportRecovery))
      ) {
        result.status = "blocked";
        result.blockers.push(
          "State-only recovery requires an exact retained failed-state receipt or report-recovery-deferred state receipt after successful git mutation and outcome-report persistence."
        );
        return result;
      }

      removeStatePersistenceDiagnostics();
      try {
        stored.deferredStateAfterReportRecovery = false;
        const stateResult = await stateUpdater({
          cwd: stored.packet.repoRoot,
          patch: stored.packet.statePatch
        });
        result.state = {
          status: stateResult.updated ? "updated" : "unchanged",
          path: stateResult.statePath,
          error: null
        };
        result.status = "succeeded";
      } catch (error) {
        result.state = { status: "failed", path: null, error: errorMessage(error) };
        result.status = "partial";
        result.blockers.push(`State persistence recovery failed: ${errorMessage(error)}`);
        appendRecoveryAction("Retry only blueprint_undo_persist stage state.");
      }
    } else {
      if (result.report.outcomeStatus !== "failed" || !stored.outcomeReportContent) {
        result.status = "blocked";
        result.blockers.push(
          "Outcome-report recovery requires an exact retained failed outcome-report receipt."
        );
        return result;
      }
      removeOutcomeReportPersistenceDiagnostics();
    }

    const recoveryContent = renderOutcomeReport(stored.packet, result);
    stored.outcomeReportContent = recoveryContent;
    try {
      const reportResult = await reportWriter({
        cwd: stored.packet.repoRoot,
        reportName: UNDO_REPORT_NAME,
        content: recoveryContent,
        overwrite: true,
        expectedExistingContentSha256: stored.expectedReportContentSha256
      });
      result.report.outcomeStatus = reportStatus(reportResult);
      result.report.error = null;
      if (reportResult.status === "invalid") {
        throw new Error(reportResult.issues.join("; ") || "Recovered outcome report is invalid.");
      }
      stored.expectedReportContentSha256 = qualityShippingSha256(recoveryContent);
      if (args.stage === "outcome-report") {
        if (result.mutationStatus === "succeeded" && stored.packet.statePatch && result.state.status !== "updated" && result.state.status !== "unchanged") {
          stored.deferredStateAfterReportRecovery = result.state.status === "not-attempted";
          result.status = "partial";
          appendRecoveryAction("Call blueprint_undo_persist for stage state; do not retry git.");
        } else {
          result.status =
            result.mutationStatus === "outcome-unknown"
              ? "outcome-unknown"
              : result.mutationStatus === "succeeded"
                ? "succeeded"
                : "partial";
        }
      }
    } catch (error) {
      result.report.outcomeStatus = "failed";
      result.report.error = errorMessage(error);
      if (result.mutationStatus !== "outcome-unknown") result.status = "partial";
      result.blockers.push(`Persistence-only report recovery failed: ${errorMessage(error)}`);
      appendRecoveryAction("Retry only blueprint_undo_persist; do not retry git.");
    }

    recordTerminalResult(stored, result);
    return result;
  } finally {
    releaseLock();
  }
}

export const undoToolDefinitions: ToolDefinition[] = [
  {
    name: "blueprint_undo_preview",
    description:
      "Inspect a bounded exact commit set and create a freshness-bound one-shot undo approval packet without mutating git.",
    inputSchema: undoPreviewInputSchema,
    handler: async (args) => blueprintUndoPreview(args as UndoPreviewArgs)
  },
  {
    name: "blueprint_undo_execute",
    description:
      "Consume one confirmed undo approval, revalidate it, persist the approved plan, run only literal safe git revert argv, persist the actual receipt, then optionally update Blueprint state.",
    inputSchema: undoExecuteInputSchema,
    handler: async (args) =>
      blueprintUndoExecute(
        args as { operationId: string; fingerprint: string; confirmed: true }
      )
  },
  {
    name: "blueprint_undo_persist",
    description:
      "Retry only fingerprint-bound undo outcome-report or state persistence from a retained terminal receipt; never re-enter git mutation.",
    inputSchema: undoPersistInputSchema,
    handler: async (args) =>
      blueprintUndoPersist(
        args as {
          operationId: string;
          fingerprint: string;
          stage: "outcome-report" | "state";
        }
      )
  }
];
