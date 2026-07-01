import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import * as z from "zod/v4";

import type { ToolDefinition } from "../tool-types.js";
import {
  BLUEPRINT_DIR,
  ensureParentDirectory,
  ensureRepoRoot,
  resolveRepoRelativePath,
  resolveBlueprintPath,
  withBlueprintRepoLock
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { blueprintPhaseExecutionTargets, blueprintPhasePlanRead } from "./phase.js";
import { normalizePlanId } from "./phase-plan-identifiers.js";
import { normalizePhaseNumber, type NumericInput } from "./phase-numbering.js";
import {
  blueprintPatchRecord,
  rollbackPatchRecordToSnapshot,
  blueprintWorkspaceCreate,
  blueprintWorkspaceRegistryGet,
  blueprintWorkspaceRemove
} from "./workspace.js";
import {
  assertNoNullBytes,
  ensurePathWithinRootSync,
  safeJsonParseObject
} from "../../shared/security.js";

const execFileAsync = promisify(execFile);

export const PLAN_RUN_SCHEMA_VERSION = 1;
export const PLAN_RUNS_ROOT_PATH = `${BLUEPRINT_DIR}/runs`;
export const PLAN_RUN_REPORTS_ROOT_PATH = `${BLUEPRINT_DIR}/reports`;
const PLAN_RUN_DEFAULT_MAX_PATCH_BYTES = 64 * 1024;
const PLAN_RUN_GIT_COMMAND_TIMEOUT_MS = 30_000;
const PLAN_RUN_GIT_PATHSPECS = [
  ".",
  ":(exclude)node_modules/**",
  ":(exclude)**/node_modules/**",
  `:(exclude)${PLAN_RUNS_ROOT_PATH}/**`,
  ":(exclude).git/**"
] as const;

export const PLAN_RUN_STATUSES = [
  "PREPARED",
  "IMPLEMENTED",
  "VERIFIED",
  "PARTIAL",
  "BLOCKED",
  "FAILED",
  "APPROVED",
  "ROLLED_BACK"
] as const;
const PLAN_RUN_RECORDABLE_STATUSES = [
  "PREPARED",
  "IMPLEMENTED",
  "VERIFIED",
  "PARTIAL",
  "BLOCKED",
  "FAILED"
] as const;
const PLAN_RUN_VERIFICATION_RESULTS = [
  "pass",
  "fail",
  "blocked",
  "not-run"
] as const;
const PLAN_RUN_REVIEW_VERDICTS = [
  "APPROVED",
  "CHANGES_REQUESTED",
  "BLOCKED"
] as const;
const PLAN_RUN_ROLLBACK_STRATEGIES = [
  "branch-reset",
  "reverse-patch",
  "delete-worktree"
] as const;
const PLAN_RUN_PREPARE_MODES = ["preview", "prepare"] as const;
const PLAN_RUN_CHANGED_FILE_STATUSES = [
  "added",
  "modified",
  "deleted",
  "renamed",
  "unknown"
] as const;

export type PlanRunStatus = (typeof PLAN_RUN_STATUSES)[number];

export type PlanRunVerificationResult =
  (typeof PLAN_RUN_VERIFICATION_RESULTS)[number];
export type PlanRunReviewVerdict = (typeof PLAN_RUN_REVIEW_VERDICTS)[number];
export type PlanRunRollbackStrategy = (typeof PLAN_RUN_ROLLBACK_STRATEGIES)[number];
export type PlanRunChangedFileStatus =
  (typeof PLAN_RUN_CHANGED_FILE_STATUSES)[number];

export type PlanRunCommandEvidence = {
  command: string;
  exitCode: number | null;
  evidence: string;
};

export type PlanRunVerification = {
  command: string;
  result: PlanRunVerificationResult;
  evidence: string;
};

export type PlanRunAttempt = {
  attempt: number;
  status: PlanRunStatus;
  startedAt: string;
  completedAt: string | null;
  commandsRun: PlanRunCommandEvidence[];
  notes: string[];
};

export type PlanRunIndex = {
  schemaVersion: typeof PLAN_RUN_SCHEMA_VERSION;
  phase: string;
  planId: string;
  latestRunId: string | null;
  runs: Array<{
    runId: string;
    status: PlanRunStatus;
    createdAt: string;
    updatedAt: string;
    branchName: string | null;
    worktreePath: string | null;
    summaryPath: string | null;
    reviewVerdict: PlanRunReviewVerdict | null;
  }>;
};

export type PlanRunRecord = {
  schemaVersion: typeof PLAN_RUN_SCHEMA_VERSION;
  runId: string;
  phase: string;
  planId: string;
  planPath: string;
  planTitle: string | null;
  createdAt: string;
  updatedAt: string;
  source: {
    repoRoot: string;
    baseHead: string;
    baseBranch: string | null;
  };
  worktree: {
    path: string | null;
    branchName: string | null;
    strategy: "worktree" | "same-tree" | "manual";
  };
  authorization: {
    authorizedFiles: string[];
    authorizedSurfaces: string[];
    unauthorizedChangedFiles: string[];
    scopeWarnings: string[];
  };
  git: {
    currentHead: string | null;
    changedFiles: string[];
    diffStat: string | null;
    patchId: string | null;
  };
  attempts: PlanRunAttempt[];
  verification: PlanRunVerification[];
  review: {
    verdict: PlanRunReviewVerdict | null;
    openFindings: number;
    reviewPath: string | null;
  };
  rollback: {
    rollbackAvailable: boolean;
    rollbackStrategy: PlanRunRollbackStrategy | null;
    rollbackPath: string | null;
    rolledBackAt: string | null;
  };
  summaryPath: string | null;
  nextAction: string;
  warnings: string[];
};

export type PlanRunChangedFile = {
  path: string;
  status: PlanRunChangedFileStatus;
  authorized: boolean;
};

type PlanRunCommandInput = {
  command: string;
  exitCode: number | null;
  stdoutTail?: string;
  stderrTail?: string;
  durationMs?: number;
};

type PlanRunPatchInput = {
  patchId: string;
  recorded: boolean;
  registryPath?: string;
  patchPath?: string;
};

type PlanRunRecordArgs = {
  cwd?: string;
  runId: string;
  phase: NumericInput;
  planId: NumericInput;
  status: (typeof PLAN_RUN_RECORDABLE_STATUSES)[number];
  worktreePath?: string;
  branchName?: string;
  baseHead: string;
  currentHead?: string;
  changedFiles: string[];
  unauthorizedChangedFiles?: string[];
  commandsRun?: PlanRunCommandInput[];
  verification?: PlanRunVerification[];
  patch?: PlanRunPatchInput;
  summaryPath?: string;
  notes?: string[];
  warnings?: string[];
};

type PlanRunLoadArgs = {
  cwd?: string;
  phase: NumericInput;
  planId: NumericInput;
  runId?: string;
};

type PlanRunDiffArgs = {
  cwd?: string;
  phase: NumericInput;
  planId: NumericInput;
  runId?: string;
  includePatch?: boolean;
  maxPatchBytes?: number;
};

type PlanRunPatchRecordArgs = {
  cwd?: string;
  phase: NumericInput;
  planId: NumericInput;
  runId?: string;
  maxPatchBytes?: number;
  commandsRun?: PlanRunCommandInput[];
  verification?: PlanRunVerification[];
  notes?: string[];
  warnings?: string[];
};

type PlanRunPrepareArgs = {
  cwd?: string;
  phase: NumericInput;
  planId: NumericInput;
  runId?: string;
  mode?: (typeof PLAN_RUN_PREPARE_MODES)[number];
  branchName?: string;
  workspaceName?: string;
  workspacePath?: string;
};

type PlanRunRecordResult = {
  status: "recorded";
  created: boolean;
  updated: boolean;
  indexPath: string;
  path: string;
  run: PlanRunRecord;
  history: PlanRunIndex["runs"];
  warnings: string[];
};

type PlanRunLoadResult = {
  found: boolean;
  phase: string;
  planId: string;
  runId: string | null;
  indexPath: string;
  path: string | null;
  run: PlanRunRecord | null;
  history: PlanRunIndex["runs"];
  latestRunId: string | null;
  reason: string | null;
  warnings: string[];
};

type PlanRunDiffResult = {
  status: "ready" | "blocked";
  runId: string | null;
  baseHead: string | null;
  currentHead: string | null;
  changedFiles: PlanRunChangedFile[];
  unauthorizedChangedFiles: string[];
  diffStat: string;
  patch: string | null;
  truncated: boolean;
  warnings: string[];
};

type PlanRunPatchRecordResult = {
  status: "recorded" | "blocked";
  phase: string;
  planId: string;
  runId: string | null;
  sourceRoot: string | null;
  diffRoot: string | null;
  patchId: string | null;
  baseHead: string | null;
  currentHead: string | null;
  changedFiles: PlanRunChangedFile[];
  unauthorizedChangedFiles: string[];
  diffStat: string;
  registryPath: string | null;
  manifestPath: string | null;
  patchPath: string | null;
  auditPath: string | null;
  recordPath: string | null;
  indexPath: string | null;
  blockers: string[];
  warnings: string[];
};

type PlanRunPrepareResult = {
  status: "preview" | "prepared" | "blocked";
  mode: (typeof PLAN_RUN_PREPARE_MODES)[number];
  phase: string;
  planId: string;
  runId: string | null;
  planPath: string | null;
  planTitle: string | null;
  branchName: string | null;
  workspaceName: string | null;
  workspacePath: string | null;
  worktreePath: string | null;
  strategy: "worktree" | "same-tree";
  baseHead: string | null;
  currentHead: string | null;
  authorizedFiles: string[];
  verificationCommands: string[];
  recordPath: string | null;
  indexPath: string | null;
  blockers: string[];
  warnings: string[];
};

const commandEvidenceInputSchema = z.object({
  command: z.string().trim().min(1),
  exitCode: z.union([z.number().int(), z.null()]),
  stdoutTail: z.string().optional(),
  stderrTail: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional()
});

const verificationInputSchema = z.object({
  command: z.string().trim().min(1),
  result: z.enum(PLAN_RUN_VERIFICATION_RESULTS),
  evidence: z.string().trim().min(1)
});

const patchInputSchema = z.object({
  patchId: z.string().trim().min(1),
  recorded: z.boolean(),
  registryPath: z.string().trim().min(1).optional(),
  patchPath: z.string().trim().min(1).optional()
});

const planRunRecordInputSchema = {
  cwd: z.string().optional(),
  runId: z.string().trim().min(1),
  phase: z.union([z.string(), z.number()]),
  planId: z.union([z.string(), z.number()]),
  status: z.enum(PLAN_RUN_RECORDABLE_STATUSES),
  worktreePath: z.string().trim().min(1).optional(),
  branchName: z.string().trim().min(1).optional(),
  baseHead: z.string().trim().min(1),
  currentHead: z.string().trim().min(1).optional(),
  changedFiles: z.array(z.string().trim().min(1)),
  unauthorizedChangedFiles: z.array(z.string().trim().min(1)).optional(),
  commandsRun: z.array(commandEvidenceInputSchema).optional(),
  verification: z.array(verificationInputSchema).optional(),
  patch: patchInputSchema.optional(),
  summaryPath: z.string().trim().min(1).optional(),
  notes: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional()
};

const planRunLoadInputSchema = {
  cwd: z.string().optional(),
  phase: z.union([z.string(), z.number()]),
  planId: z.union([z.string(), z.number()]),
  runId: z.string().trim().min(1).optional()
};

const planRunDiffInputSchema = {
  cwd: z.string().optional(),
  phase: z.union([z.string(), z.number()]),
  planId: z.union([z.string(), z.number()]),
  runId: z.string().trim().min(1).optional(),
  includePatch: z.boolean().optional(),
  maxPatchBytes: z.number().int().nonnegative().optional()
};

const planRunPatchRecordInputSchema = {
  cwd: z.string().optional(),
  phase: z.union([z.string(), z.number()]),
  planId: z.union([z.string(), z.number()]),
  runId: z.string().trim().min(1).optional(),
  maxPatchBytes: z.number().int().nonnegative().optional(),
  commandsRun: z.array(commandEvidenceInputSchema).optional(),
  verification: z.array(verificationInputSchema).optional(),
  notes: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional()
};

const planRunPrepareInputSchema = {
  cwd: z.string().optional(),
  phase: z.union([z.string(), z.number()]),
  planId: z.union([z.string(), z.number()]),
  runId: z.string().trim().min(1).optional(),
  mode: z.enum(PLAN_RUN_PREPARE_MODES).optional(),
  branchName: z.string().trim().min(1).optional(),
  workspaceName: z.string().trim().min(1).optional(),
  workspacePath: z.string().trim().min(1).optional()
};

export function normalizePlanRunPhase(value: NumericInput): string {
  return normalizePhaseNumber(value);
}

export function normalizePlanRunPlanId(value: NumericInput): string {
  return normalizePlanId(value);
}

export function normalizePlanRunId(value: string): string {
  const trimmed = value.trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    throw new Error(
      `Plan run id must contain only lowercase letters, digits, and single dash separators: ${value}`
    );
  }

  return trimmed;
}

export function assertPlanRunSchemaVersion(
  value: unknown,
  label = "PlanRun schemaVersion"
): asserts value is typeof PLAN_RUN_SCHEMA_VERSION {
  if (value !== PLAN_RUN_SCHEMA_VERSION) {
    throw new Error(`${label} must equal ${PLAN_RUN_SCHEMA_VERSION}.`);
  }
}

function planRunRelativeRootPath(phase: NumericInput, planId: NumericInput): string {
  return `${PLAN_RUNS_ROOT_PATH}/phase-${normalizePlanRunPhase(phase)}/plan-${normalizePlanRunPlanId(planId)}`;
}

function resolvePlanRunPath(projectRoot: string, relativePath: string): string {
  const absolutePath = resolveBlueprintPath(projectRoot, relativePath);
  const planRunsRoot = path.join(projectRoot, PLAN_RUNS_ROOT_PATH);

  return ensurePathWithinRootSync(planRunsRoot, absolutePath, {
    label: "PlanRun path"
  });
}

export function buildPlanRunRootPath(
  projectRoot: string,
  phase: NumericInput,
  planId: NumericInput
): string {
  return resolvePlanRunPath(projectRoot, planRunRelativeRootPath(phase, planId));
}

export function buildPlanRunIndexPath(
  projectRoot: string,
  phase: NumericInput,
  planId: NumericInput
): string {
  return resolvePlanRunPath(
    projectRoot,
    `${planRunRelativeRootPath(phase, planId)}/RUNS.json`
  );
}

export function buildPlanRunRecordPath(
  projectRoot: string,
  phase: NumericInput,
  planId: NumericInput,
  runId: string
): string {
  return resolvePlanRunPath(
    projectRoot,
    `${planRunRelativeRootPath(phase, planId)}/${normalizePlanRunId(runId)}.json`
  );
}

export function buildPlanRunDiffPath(
  projectRoot: string,
  phase: NumericInput,
  planId: NumericInput,
  runId: string
): string {
  return resolvePlanRunPath(
    projectRoot,
    `${planRunRelativeRootPath(phase, planId)}/${normalizePlanRunId(runId)}-DIFF.md`
  );
}

export function buildPlanRunReviewPath(
  projectRoot: string,
  phase: NumericInput,
  planId: NumericInput,
  runId: string
): string {
  return resolvePlanRunPath(
    projectRoot,
    `${planRunRelativeRootPath(phase, planId)}/${normalizePlanRunId(runId)}-REVIEW.md`
  );
}

export function buildPlanRunRollbackPath(
  projectRoot: string,
  phase: NumericInput,
  planId: NumericInput,
  runId: string
): string {
  return resolvePlanRunPath(
    projectRoot,
    `${planRunRelativeRootPath(phase, planId)}/${normalizePlanRunId(runId)}-ROLLBACK.md`
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return value;
}

function normalizePlanRunStatus(value: unknown): PlanRunStatus {
  if (typeof value !== "string" || !PLAN_RUN_STATUSES.includes(value as PlanRunStatus)) {
    throw new Error(`Unsupported PlanRun status: ${String(value)}`);
  }

  return value as PlanRunStatus;
}

function normalizePlanRunReviewVerdict(value: unknown, label: string): PlanRunReviewVerdict {
  if (
    typeof value !== "string" ||
    !PLAN_RUN_REVIEW_VERDICTS.includes(value as PlanRunReviewVerdict)
  ) {
    throw new Error(`${label} is not a supported PlanRun review verdict: ${String(value)}`);
  }

  return value as PlanRunReviewVerdict;
}

function normalizePlanRunRollbackStrategy(
  value: unknown,
  label: string
): PlanRunRollbackStrategy {
  if (
    typeof value !== "string" ||
    !PLAN_RUN_ROLLBACK_STRATEGIES.includes(value as PlanRunRollbackStrategy)
  ) {
    throw new Error(`${label} is not a supported PlanRun rollback strategy: ${String(value)}`);
  }

  return value as PlanRunRollbackStrategy;
}

function normalizeNullableStringValue(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string or null.`);
  }

  return normalizeString(value, label);
}

function normalizeRequiredStringValue(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  const normalized = normalizeString(value, label);

  if (!normalized) {
    throw new Error(`${label} must not be blank.`);
  }

  return normalized;
}

function normalizeString(value: string | undefined, label: string): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  assertNoNullBytes(trimmed, label);

  if (trimmed.length === 0) {
    throw new Error(`${label} must not be blank.`);
  }

  return trimmed;
}

function normalizeStringList(values: string[] | undefined, label: string): string[] {
  return uniqueSortedStrings(
    (values ?? []).map((value, index) => {
      const trimmed = normalizeString(value, `${label}[${index}]`);

      if (!trimmed) {
        throw new Error(`${label}[${index}] must not be blank.`);
      }

      return trimmed;
    })
  );
}

function normalizeRequiredStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((entry, index) =>
    normalizeRequiredStringValue(entry, `${label}[${index}]`)
  );
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeRepoRelativePlanRunPath(
  projectRoot: string,
  value: string,
  label: string
): string {
  const absolutePath = resolveRepoRelativePath(projectRoot, value);
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

function normalizeRepoRelativePlanRunPaths(
  projectRoot: string,
  values: string[] | undefined,
  label: string
): string[] {
  return uniqueSortedStrings(
    (values ?? []).map((value, index) =>
      normalizeRepoRelativePlanRunPath(projectRoot, value, `${label}[${index}]`)
    )
  );
}

function normalizePersistedRepoRelativePlanRunPaths(
  projectRoot: string,
  values: unknown,
  label: string
): string[] {
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array.`);
  }

  return uniqueSortedStrings(
    values.map((value, index) => {
      const normalized = normalizeRequiredStringValue(value, `${label}[${index}]`);
      return normalizeRepoRelativePlanRunPath(projectRoot, normalized, `${label}[${index}]`);
    })
  );
}

function normalizeBlueprintArtifactPath(
  projectRoot: string,
  value: unknown,
  label: string
): string {
  const normalized = normalizeRequiredStringValue(value, label);
  const absolutePath = resolveBlueprintPath(projectRoot, normalized);
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

function normalizeNullableBlueprintArtifactPath(
  projectRoot: string,
  value: unknown,
  label: string
): string | null {
  if (value === null) {
    return null;
  }

  return normalizeBlueprintArtifactPath(projectRoot, value, label);
}

function normalizeOptionalRepoRelativePlanRunPath(
  projectRoot: string,
  value: string | undefined,
  label: string
): string | null {
  const normalized = normalizeString(value, label);

  if (!normalized) {
    return null;
  }

  return normalizeBlueprintArtifactPath(projectRoot, normalized, label);
}

function normalizeOptionalFilesystemPath(
  projectRoot: string,
  value: string | undefined,
  label: string
): string | null {
  const normalized = normalizeString(value, label);

  if (!normalized) {
    return null;
  }

  return path.resolve(projectRoot, normalized);
}

function normalizePersistedFilesystemPath(
  projectRoot: string,
  value: unknown,
  label: string
): string | null {
  if (value === null) {
    return null;
  }

  return path.resolve(projectRoot, normalizeRequiredStringValue(value, label));
}

function expandHomePath(value: string): string {
  const trimmed = value.trim();

  if (trimmed === "~") {
    return os.homedir();
  }

  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }

  return trimmed;
}

function slugifyPlanRunSegment(value: string, fallback: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .replace(/[_\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : fallback;
}

function normalizePlanRunWorkspaceName(value: string): string {
  const normalized = slugifyPlanRunSegment(value, "plan-run");

  assertNoNullBytes(normalized, "workspaceName");

  return normalized;
}

function buildDefaultPlanRunSlug(planTitle: string | null, planId: string): string {
  const titleSlug = slugifyPlanRunSegment(planTitle ?? "", "");

  return titleSlug || `plan-${planId}`;
}

function renderPlanRunBranchName(args: {
  template: string | null | undefined;
  phase: string;
  planId: string;
  slug: string;
}): string {
  const defaultTemplate = "blu/phase-{phase}-plan-{planId}-{slug}";
  const template =
    args.template && args.template !== "blu/phase-{phase}-{slug}"
      ? args.template
      : defaultTemplate;

  return template
    .replaceAll("{phase}", args.phase)
    .replaceAll("{planId}", args.planId)
    .replaceAll("{plan}", args.planId)
    .replaceAll("{slug}", args.slug);
}

function normalizeBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function normalizeNonnegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  return value;
}

function normalizePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return value;
}

async function runGit(
  projectRoot: string,
  args: string[],
  options: { allowFailure?: boolean } = {}
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: projectRoot,
      timeout: PLAN_RUN_GIT_COMMAND_TIMEOUT_MS,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0"
      }
    });

    return {
      stdout,
      stderr,
      success: true
    };
  } catch (error) {
    if (!options.allowFailure) {
      throw error;
    }

    const stdout =
      error && typeof error === "object" && "stdout" in error
        ? String((error as { stdout?: string }).stdout ?? "")
        : "";
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String((error as { stderr?: string }).stderr ?? "")
        : error instanceof Error
          ? error.message
          : "git command failed";

    return {
      stdout,
      stderr,
      success: false
    };
  }
}

function normalizeGitRevision(value: string, label: string): string {
  const normalized = normalizeRequiredStringValue(value, label);

  if (normalized.startsWith("-")) {
    throw new Error(`${label} must not look like a command option.`);
  }

  return normalized;
}

function blockedPlanRunDiffResult(args: {
  runId: string | null;
  baseHead: string | null;
  currentHead?: string | null;
  warnings: string[];
}): PlanRunDiffResult {
  return {
    status: "blocked",
    runId: args.runId,
    baseHead: args.baseHead,
    currentHead: args.currentHead ?? null,
    changedFiles: [],
    unauthorizedChangedFiles: [],
    diffStat: "",
    patch: null,
    truncated: false,
    warnings: uniqueSortedStrings(args.warnings)
  };
}

function blockedPlanRunPatchRecordResult(args: {
  phase: string;
  planId: string;
  runId: string | null;
  sourceRoot?: string | null;
  diffRoot?: string | null;
  patchId?: string | null;
  baseHead?: string | null;
  currentHead?: string | null;
  changedFiles?: PlanRunChangedFile[];
  unauthorizedChangedFiles?: string[];
  diffStat?: string;
  recordPath?: string | null;
  indexPath?: string | null;
  blockers: string[];
  warnings?: string[];
}): PlanRunPatchRecordResult {
  return {
    status: "blocked",
    phase: args.phase,
    planId: args.planId,
    runId: args.runId,
    sourceRoot: args.sourceRoot ?? null,
    diffRoot: args.diffRoot ?? null,
    patchId: args.patchId ?? null,
    baseHead: args.baseHead ?? null,
    currentHead: args.currentHead ?? null,
    changedFiles: args.changedFiles ?? [],
    unauthorizedChangedFiles: uniqueSortedStrings(args.unauthorizedChangedFiles ?? []),
    diffStat: args.diffStat ?? "",
    registryPath: null,
    manifestPath: null,
    patchPath: null,
    auditPath: null,
    recordPath: args.recordPath ?? null,
    indexPath: args.indexPath ?? null,
    blockers: uniqueSortedStrings(args.blockers),
    warnings: uniqueSortedStrings(args.warnings ?? [])
  };
}

function isIgnoredPlanRunGitPath(filePath: string): boolean {
  const segments = filePath.split("/");

  return (
    filePath === ".git" ||
    segments.includes(".git") ||
    segments.includes("node_modules") ||
    filePath === PLAN_RUNS_ROOT_PATH ||
    filePath.startsWith(`${PLAN_RUNS_ROOT_PATH}/`)
  );
}

function mapGitStatus(status: string): PlanRunChangedFileStatus {
  if (status.startsWith("A")) {
    return "added";
  }

  if (status.startsWith("D")) {
    return "deleted";
  }

  if (status.startsWith("R")) {
    return "renamed";
  }

  if (status.startsWith("M") || status.startsWith("T")) {
    return "modified";
  }

  return "unknown";
}

function parseGitNameStatus(stdout: string): Array<{
  path: string;
  status: PlanRunChangedFileStatus;
}> {
  const fields = stdout.split("\0").filter(Boolean);
  const changedFiles: Array<{ path: string; status: PlanRunChangedFileStatus }> = [];

  for (let index = 0; index < fields.length;) {
    const status = fields[index++] ?? "";

    if (status.startsWith("R")) {
      index += 1;
      const renamedPath = fields[index++];

      if (renamedPath) {
        changedFiles.push({
          path: renamedPath,
          status: "renamed"
        });
      }
      continue;
    }

    const filePath = fields[index++];

    if (!filePath) {
      continue;
    }

    changedFiles.push({
      path: filePath,
      status: mapGitStatus(status)
    });
  }

  return changedFiles;
}

function parseNullSeparatedGitPaths(stdout: string): string[] {
  return stdout.split("\0").map((value) => value.trim()).filter(Boolean);
}

function normalizeGitChangedFiles(
  projectRoot: string,
  values: Array<{ path: string; status: PlanRunChangedFileStatus }>,
  authorizedFiles: string[]
): PlanRunChangedFile[] {
  const byPath = new Map<string, PlanRunChangedFileStatus>();

  for (const value of values) {
    if (isIgnoredPlanRunGitPath(value.path)) {
      continue;
    }

    const normalizedPath = normalizeRepoRelativePlanRunPath(
      projectRoot,
      value.path,
      "git.changedFiles"
    );

    if (isIgnoredPlanRunGitPath(normalizedPath)) {
      continue;
    }

    byPath.set(normalizedPath, value.status);
  }

  return [...byPath.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, status]) => ({
      path: filePath,
      status,
      authorized: isChangedPathAuthorized(filePath, authorizedFiles)
    }));
}

function normalizeGitPathList(projectRoot: string, values: string[]): string[] {
  return uniqueSortedStrings(
    values
      .filter((filePath) => !isIgnoredPlanRunGitPath(filePath))
      .map((filePath) =>
        normalizeRepoRelativePlanRunPath(projectRoot, filePath, "git.untrackedFiles")
      )
      .filter((filePath) => !isIgnoredPlanRunGitPath(filePath))
  );
}

async function gitHeadSha(projectRoot: string): Promise<{
  value: string | null;
  warning: string | null;
}> {
  const result = await runGit(projectRoot, ["rev-parse", "HEAD"], {
    allowFailure: true
  });

  if (!result.success) {
    return {
      value: null,
      warning: `Unable to read current git HEAD: ${result.stderr || "git rev-parse failed"}`
    };
  }

  return {
    value: result.stdout.trim(),
    warning: null
  };
}

async function gitStatusShort(projectRoot: string): Promise<{
  value: string | null;
  warning: string | null;
}> {
  const result = await runGit(
    projectRoot,
    ["status", "--short", "--", ...PLAN_RUN_GIT_PATHSPECS],
    {
      allowFailure: true
    }
  );

  if (!result.success) {
    return {
      value: null,
      warning: `Unable to read git status: ${result.stderr || "git status failed"}`
    };
  }

  return {
    value: result.stdout.trim(),
    warning: null
  };
}

async function gitLocalBranchExists(
  projectRoot: string,
  branchName: string
): Promise<boolean> {
  const result = await runGit(projectRoot, ["branch", "--list", branchName], {
    allowFailure: true
  });

  return result.success && result.stdout.trim().length > 0;
}

async function deleteLocalBranchIfPresent(
  projectRoot: string,
  branchName: string
): Promise<string | null> {
  const branchExists = await gitLocalBranchExists(projectRoot, branchName);

  if (!branchExists) {
    return null;
  }

  const result = await runGit(
    projectRoot,
    ["branch", "--delete", "--force", branchName],
    { allowFailure: true }
  );

  return result.success
    ? null
    : `Unable to delete cleanup branch ${branchName}: ${result.stderr || "git branch --delete failed"}`;
}

async function cleanupPreparedPlanRunWorkspace(args: {
  projectRoot: string;
  workspaceName: string;
  workspacePath: string;
  branchName: string;
  branchExistedBeforePrepare: boolean;
}): Promise<string[]> {
  const warnings: string[] = [];

  try {
    await blueprintWorkspaceRemove({
      cwd: args.projectRoot,
      name: args.workspaceName,
      path: args.workspacePath
    });
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Unable to clean up prepared workspace after PlanRun record failure: ${error.message}`
        : "Unable to clean up prepared workspace after PlanRun record failure."
    );
  }

  if (!args.branchExistedBeforePrepare) {
    const branchDeleteWarning = await deleteLocalBranchIfPresent(
      args.projectRoot,
      args.branchName
    );

    if (branchDeleteWarning) {
      warnings.push(branchDeleteWarning);
    }
  }

  return warnings;
}

async function gitVerifyCommit(
  projectRoot: string,
  revision: string
): Promise<string | null> {
  const result = await runGit(
    projectRoot,
    ["rev-parse", "--verify", `${revision}^{commit}`],
    { allowFailure: true }
  );

  return result.success ? null : result.stderr || `Unknown git base revision: ${revision}`;
}

async function resolvePlanRunDiffProjectRoot(args: {
  sourceProjectRoot: string;
  run: PlanRunRecord;
}): Promise<{ projectRoot: string; warning: string | null }> {
  if (!args.run.worktree.path) {
    return {
      projectRoot: args.sourceProjectRoot,
      warning: null
    };
  }

  try {
    return {
      projectRoot: await ensureRepoRoot(args.run.worktree.path),
      warning: null
    };
  } catch (error) {
    return {
      projectRoot: args.run.worktree.path,
      warning:
        error instanceof Error
          ? `Unable to use recorded PlanRun worktree for diff capture: ${error.message}`
          : "Unable to use recorded PlanRun worktree for diff capture."
    };
  }
}

async function realpathOrResolve(targetPath: string): Promise<string> {
  try {
    return await fs.realpath(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

async function gitCommonDir(projectRoot: string): Promise<{
  path: string | null;
  warning: string | null;
}> {
  const result = await runGit(projectRoot, ["rev-parse", "--git-common-dir"], {
    allowFailure: true
  });

  if (!result.success) {
    return {
      path: null,
      warning: `Unable to read git common directory for ${projectRoot}: ${result.stderr || "git rev-parse --git-common-dir failed"}`
    };
  }

  const rawCommonDir = result.stdout.trim();
  const commonDir = path.isAbsolute(rawCommonDir)
    ? rawCommonDir
    : path.resolve(projectRoot, rawCommonDir);

  return {
    path: await realpathOrResolve(commonDir),
    warning: null
  };
}

async function gitCurrentBranch(projectRoot: string): Promise<{
  value: string | null;
  warning: string | null;
}> {
  const result = await runGit(projectRoot, ["branch", "--show-current"], {
    allowFailure: true
  });

  if (!result.success) {
    return {
      value: null,
      warning: `Unable to read git branch for ${projectRoot}: ${result.stderr || "git branch --show-current failed"}`
    };
  }

  const branchName = result.stdout.trim();

  return {
    value: branchName.length > 0 ? branchName : null,
    warning: null
  };
}

async function workspaceRegistryContainsPlanRunWorktree(args: {
  sourceProjectRoot: string;
  worktreeProjectRoot: string;
  branchName: string | null;
}): Promise<{ matched: boolean; warning: string | null }> {
  let registry: Awaited<ReturnType<typeof blueprintWorkspaceRegistryGet>>;

  try {
    registry = await blueprintWorkspaceRegistryGet();
  } catch (error) {
    return {
      matched: false,
      warning:
        error instanceof Error
          ? `Unable to verify PlanRun worktree in workspace registry: ${error.message}`
          : "Unable to verify PlanRun worktree in workspace registry."
    };
  }

  const sourceRoot = await realpathOrResolve(args.sourceProjectRoot);
  const worktreeRoot = await realpathOrResolve(args.worktreeProjectRoot);

  for (const workspace of registry.workspaces) {
    for (const member of workspace.repos) {
      const memberSourcePath = await realpathOrResolve(member.sourcePath);
      const memberPath = await realpathOrResolve(member.path);
      const branchMatches =
        !args.branchName || member.branch === null || member.branch === args.branchName;

      if (
        member.strategy === "worktree" &&
        memberSourcePath === sourceRoot &&
        memberPath === worktreeRoot &&
        branchMatches
      ) {
        return {
          matched: true,
          warning: null
        };
      }
    }
  }

  return {
    matched: false,
    warning: `Recorded PlanRun worktree is not registered for source repo ${args.sourceProjectRoot}: ${args.worktreeProjectRoot}`
  };
}

async function resolvePlanRunPatchCaptureProjectRoot(args: {
  sourceProjectRoot: string;
  run: PlanRunRecord;
}): Promise<{ projectRoot: string | null; warning: string | null }> {
  if (args.run.worktree.strategy !== "worktree" || !args.run.worktree.path) {
    return {
      projectRoot: args.run.worktree.path,
      warning:
        "PlanRun patch capture requires a PREPARED worktree-backed run with a recorded worktreePath."
    };
  }

  let worktreeProjectRoot: string;

  try {
    worktreeProjectRoot = await ensureRepoRoot(args.run.worktree.path);
  } catch (error) {
    return {
      projectRoot: args.run.worktree.path,
      warning:
        error instanceof Error
          ? `Unable to use recorded PlanRun worktree for patch capture: ${error.message}`
          : "Unable to use recorded PlanRun worktree for patch capture."
    };
  }

  const [sourceRoot, worktreeRoot] = await Promise.all([
    realpathOrResolve(args.sourceProjectRoot),
    realpathOrResolve(worktreeProjectRoot)
  ]);

  if (sourceRoot === worktreeRoot) {
    return {
      projectRoot: worktreeProjectRoot,
      warning: "PlanRun patch capture requires an isolated worktree, not the source repo root."
    };
  }

  const [sourceCommonDir, worktreeCommonDir] = await Promise.all([
    gitCommonDir(args.sourceProjectRoot),
    gitCommonDir(worktreeProjectRoot)
  ]);

  if (sourceCommonDir.warning || worktreeCommonDir.warning) {
    return {
      projectRoot: worktreeProjectRoot,
      warning: sourceCommonDir.warning ?? worktreeCommonDir.warning
    };
  }

  if (!sourceCommonDir.path || !worktreeCommonDir.path || sourceCommonDir.path !== worktreeCommonDir.path) {
    return {
      projectRoot: worktreeProjectRoot,
      warning: `Recorded PlanRun worktree does not belong to the source repo: ${worktreeProjectRoot}`
    };
  }

  if (args.run.worktree.branchName) {
    const currentBranch = await gitCurrentBranch(worktreeProjectRoot);

    if (currentBranch.warning) {
      return {
        projectRoot: worktreeProjectRoot,
        warning: currentBranch.warning
      };
    }

    if (currentBranch.value !== args.run.worktree.branchName) {
      return {
        projectRoot: worktreeProjectRoot,
        warning: `Recorded PlanRun worktree branch mismatch: expected ${args.run.worktree.branchName}, found ${currentBranch.value ?? "detached HEAD"}.`
      };
    }
  }

  const registryMatch = await workspaceRegistryContainsPlanRunWorktree({
    sourceProjectRoot: args.sourceProjectRoot,
    worktreeProjectRoot,
    branchName: args.run.worktree.branchName
  });

  if (!registryMatch.matched) {
    return {
      projectRoot: worktreeProjectRoot,
      warning: registryMatch.warning
    };
  }

  return {
    projectRoot: worktreeProjectRoot,
    warning: null
  };
}

async function gitChangedFiles(
  projectRoot: string,
  baseHead: string,
  authorizedFiles: string[]
): Promise<{
  changedFiles: PlanRunChangedFile[];
  untrackedFiles: string[];
  warning: string | null;
}> {
  const diffResult = await runGit(
    projectRoot,
    [
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      baseHead,
      "--",
      ...PLAN_RUN_GIT_PATHSPECS
    ],
    { allowFailure: true }
  );

  if (!diffResult.success) {
    return {
      changedFiles: [],
      untrackedFiles: [],
      warning: `Unable to read git changed files: ${diffResult.stderr || "git diff failed"}`
    };
  }

  const untrackedResult = await runGit(
    projectRoot,
    [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...PLAN_RUN_GIT_PATHSPECS
    ],
    { allowFailure: true }
  );
  const untrackedFiles = untrackedResult.success
    ? normalizeGitPathList(projectRoot, parseNullSeparatedGitPaths(untrackedResult.stdout))
    : [];
  const untrackedChangedFiles = untrackedFiles.map((filePath) => ({
    path: filePath,
    status: "added" as const
  }));

  return {
    changedFiles: normalizeGitChangedFiles(
      projectRoot,
      [...parseGitNameStatus(diffResult.stdout), ...untrackedChangedFiles],
      authorizedFiles
    ),
    untrackedFiles,
    warning: untrackedResult.success
      ? null
      : `Unable to read untracked git files: ${untrackedResult.stderr || "git ls-files failed"}`
  };
}

function countTextLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.endsWith("\n")
    ? content.slice(0, -1).split("\n").length
    : content.split("\n").length;
}

async function readUntrackedFileForDiff(
  projectRoot: string,
  filePath: string
): Promise<
  | {
      kind: "text";
      content: string;
      additions: number;
    }
  | {
      kind: "binary";
      bytes: number;
    }
> {
  const fileBuffer = await fs.readFile(path.join(projectRoot, filePath));

  if (fileBuffer.includes(0)) {
    return {
      kind: "binary",
      bytes: fileBuffer.length
    };
  }

  const content = fileBuffer.toString("utf8");

  return {
    kind: "text",
    content,
    additions: countTextLines(content)
  };
}

async function renderUntrackedDiffStat(
  projectRoot: string,
  untrackedFiles: string[]
): Promise<{ stat: string; warning: string | null }> {
  const lines: string[] = [];

  for (const filePath of untrackedFiles) {
    try {
      const file = await readUntrackedFileForDiff(projectRoot, filePath);

      if (file.kind === "binary") {
        lines.push(` ${filePath} | Bin 0 -> ${file.bytes} bytes`);
      } else {
        lines.push(` ${filePath} | ${file.additions} ${"+".repeat(Math.min(file.additions, 60))}`);
      }
    } catch (error) {
      return {
        stat: "",
        warning:
          error instanceof Error
            ? `Unable to read untracked file for diff stat ${filePath}: ${error.message}`
            : `Unable to read untracked file for diff stat ${filePath}.`
      };
    }
  }

  return {
    stat: lines.join("\n"),
    warning: null
  };
}

function renderUntrackedTextPatch(filePath: string, content: string): string {
  const lines = content.length > 0 ? content.split("\n") : [];
  const endsWithNewline = content.endsWith("\n");
  const contentLines = endsWithNewline ? lines.slice(0, -1) : lines;
  const hunkLength = Math.max(contentLines.length, 1);
  const patchLines = [
    `diff --git a/${filePath} b/${filePath}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${filePath}`,
    `@@ -0,0 +1,${hunkLength} @@`
  ];

  if (contentLines.length === 0) {
    patchLines.push("+");
  } else {
    patchLines.push(...contentLines.map((line) => `+${line}`));
  }

  if (!endsWithNewline) {
    patchLines.push("\\ No newline at end of file");
  }

  return patchLines.join("\n");
}

async function renderUntrackedDiffPatch(
  projectRoot: string,
  untrackedFiles: string[]
): Promise<{ patch: string; warning: string | null }> {
  const patches: string[] = [];

  for (const filePath of untrackedFiles) {
    try {
      const file = await readUntrackedFileForDiff(projectRoot, filePath);

      if (file.kind === "binary") {
        patches.push(
          [
            `diff --git a/${filePath} b/${filePath}`,
            "new file mode 100644",
            `Binary files /dev/null and b/${filePath} differ`
          ].join("\n")
        );
      } else {
        patches.push(renderUntrackedTextPatch(filePath, file.content));
      }
    } catch (error) {
      return {
        patch: "",
        warning:
          error instanceof Error
            ? `Unable to read untracked file for patch ${filePath}: ${error.message}`
            : `Unable to read untracked file for patch ${filePath}.`
      };
    }
  }

  return {
    patch: patches.join("\n"),
    warning: null
  };
}

function joinDiffParts(parts: string[]): string {
  return parts
    .map((part) => part.trimEnd())
    .filter((part) => part.length > 0)
    .join("\n");
}

async function gitDiffStat(
  projectRoot: string,
  baseHead: string,
  untrackedFiles: string[]
): Promise<{ diffStat: string; warning: string | null }> {
  const result = await runGit(
    projectRoot,
    ["diff", "--stat", baseHead, "--", ...PLAN_RUN_GIT_PATHSPECS],
    { allowFailure: true }
  );

  if (!result.success) {
    return {
      diffStat: "",
      warning: `Unable to read git diff stat: ${result.stderr || "git diff --stat failed"}`
    };
  }

  const untrackedStat = await renderUntrackedDiffStat(projectRoot, untrackedFiles);

  if (untrackedStat.warning) {
    return {
      diffStat: "",
      warning: untrackedStat.warning
    };
  }

  return {
    diffStat: joinDiffParts([result.stdout, untrackedStat.stat]),
    warning: null
  };
}

function truncatePatch(patch: string, maxPatchBytes: number): {
  patch: string;
  truncated: boolean;
} {
  const patchBytes = Buffer.from(patch, "utf8");

  if (patchBytes.length <= maxPatchBytes) {
    return {
      patch,
      truncated: false
    };
  }

  return {
    patch: patchBytes.subarray(0, maxPatchBytes).toString("utf8"),
    truncated: true
  };
}

async function gitDiffPatch(
  projectRoot: string,
  baseHead: string,
  maxPatchBytes: number,
  untrackedFiles: string[]
): Promise<{ patch: string; truncated: boolean; warning: string | null }> {
  const result = await runGit(
    projectRoot,
    ["diff", "--binary", baseHead, "--", ...PLAN_RUN_GIT_PATHSPECS],
    { allowFailure: true }
  );

  if (!result.success) {
    return {
      patch: "",
      truncated: false,
      warning: `Unable to read git patch: ${result.stderr || "git diff --binary failed"}`
    };
  }

  const untrackedPatch = await renderUntrackedDiffPatch(projectRoot, untrackedFiles);

  if (untrackedPatch.warning) {
    return {
      patch: "",
      truncated: false,
      warning: untrackedPatch.warning
    };
  }

  return {
    ...truncatePatch(joinDiffParts([result.stdout, untrackedPatch.patch]), maxPatchBytes),
    warning: null
  };
}

function formatCommandEvidence(command: PlanRunCommandInput): PlanRunCommandEvidence {
  const evidenceParts: string[] = [];

  if (command.stdoutTail?.trim()) {
    evidenceParts.push(`stdout tail:\n${command.stdoutTail.trim()}`);
  }

  if (command.stderrTail?.trim()) {
    evidenceParts.push(`stderr tail:\n${command.stderrTail.trim()}`);
  }

  if (command.durationMs !== undefined) {
    evidenceParts.push(`duration_ms: ${command.durationMs}`);
  }

  return {
    command: command.command.trim(),
    exitCode: command.exitCode,
    evidence: evidenceParts.join("\n\n") || `exit_code: ${command.exitCode ?? "unknown"}`
  };
}

function normalizePersistedCommandEvidence(
  value: unknown,
  label: string
): PlanRunCommandEvidence {
  const commandEvidence = requirePlainObject(value, label);
  const exitCode = commandEvidence.exitCode;

  if (exitCode !== null && (typeof exitCode !== "number" || !Number.isInteger(exitCode))) {
    throw new Error(`${label}.exitCode must be an integer or null.`);
  }

  return {
    command: normalizeRequiredStringValue(commandEvidence.command, `${label}.command`),
    exitCode,
    evidence: normalizeRequiredStringValue(commandEvidence.evidence, `${label}.evidence`)
  };
}

function normalizePlanRunAttempt(value: unknown, label: string): PlanRunAttempt {
  const attempt = requirePlainObject(value, label);

  if (!Array.isArray(attempt.commandsRun)) {
    throw new Error(`${label}.commandsRun must be an array.`);
  }

  return {
    attempt: normalizePositiveInteger(attempt.attempt, `${label}.attempt`),
    status: normalizePlanRunStatus(attempt.status),
    startedAt: normalizeRequiredStringValue(attempt.startedAt, `${label}.startedAt`),
    completedAt: normalizeNullableStringValue(attempt.completedAt, `${label}.completedAt`),
    commandsRun: attempt.commandsRun.map((entry, index) =>
      normalizePersistedCommandEvidence(entry, `${label}.commandsRun[${index}]`)
    ),
    notes: normalizeRequiredStringArray(attempt.notes, `${label}.notes`)
  };
}

function normalizeVerificationEntries(
  verification: unknown[] | undefined
): PlanRunVerification[] {
  return (verification ?? []).map((entry, index) => {
    const verificationEntry = requirePlainObject(entry, `verification[${index}]`);
    const command = normalizeRequiredStringValue(
      verificationEntry.command,
      `verification[${index}].command`
    );
    const evidence = normalizeRequiredStringValue(
      verificationEntry.evidence,
      `verification[${index}].evidence`
    );

    if (
      typeof verificationEntry.result !== "string" ||
      !PLAN_RUN_VERIFICATION_RESULTS.includes(
        verificationEntry.result as PlanRunVerificationResult
      )
    ) {
      throw new Error(
        `verification[${index}].result is not supported: ${String(verificationEntry.result)}`
      );
    }

    return {
      command,
      result: verificationEntry.result as PlanRunVerificationResult,
      evidence
    };
  });
}

function isChangedPathAuthorized(changedFile: string, authorizedFiles: string[]): boolean {
  return authorizedFiles.some((authorizedFile) => {
    const normalizedAuthorized = authorizedFile.endsWith("/")
      ? authorizedFile.slice(0, -1)
      : authorizedFile;

    return (
      changedFile === normalizedAuthorized ||
      changedFile.startsWith(`${normalizedAuthorized}/`)
    );
  });
}

function deriveUnauthorizedChangedFiles(args: {
  changedFiles: string[];
  authorizedFiles: string[];
  explicitUnauthorizedChangedFiles: string[];
}): string[] {
  return uniqueSortedStrings([
    ...args.explicitUnauthorizedChangedFiles,
    ...args.changedFiles.filter(
      (changedFile) => !isChangedPathAuthorized(changedFile, args.authorizedFiles)
    )
  ]);
}

function extractVerificationCommands(acceptanceCriteria: string[]): string[] {
  const commandPrefixes = /^(?:`)?(?:npm|pnpm|yarn|node|npx|tsx|tsc|git|make|pytest|go|cargo|deno|bun)\b/u;

  return uniqueSortedStrings(
    acceptanceCriteria
      .map((criterion) => criterion.trim().replace(/^`|`$/gu, ""))
      .filter((criterion) => commandPrefixes.test(criterion))
      .map((criterion) => criterion.replace(/\s+exits?\s+0\.?$/iu, "").trim())
      .filter(Boolean)
  );
}

function blockedPlanRunPrepareResult(args: {
  mode: (typeof PLAN_RUN_PREPARE_MODES)[number];
  phase: string;
  planId: string;
  runId?: string | null;
  planPath?: string | null;
  planTitle?: string | null;
  branchName?: string | null;
  workspaceName?: string | null;
  workspacePath?: string | null;
  worktreePath?: string | null;
  strategy?: "worktree" | "same-tree";
  baseHead?: string | null;
  currentHead?: string | null;
  authorizedFiles?: string[];
  verificationCommands?: string[];
  recordPath?: string | null;
  indexPath?: string | null;
  blockers: string[];
  warnings?: string[];
}): PlanRunPrepareResult {
  return {
    status: "blocked",
    mode: args.mode,
    phase: args.phase,
    planId: args.planId,
    runId: args.runId ?? null,
    planPath: args.planPath ?? null,
    planTitle: args.planTitle ?? null,
    branchName: args.branchName ?? null,
    workspaceName: args.workspaceName ?? null,
    workspacePath: args.workspacePath ?? null,
    worktreePath: args.worktreePath ?? null,
    strategy: args.strategy ?? "worktree",
    baseHead: args.baseHead ?? null,
    currentHead: args.currentHead ?? null,
    authorizedFiles: args.authorizedFiles ?? [],
    verificationCommands: args.verificationCommands ?? [],
    recordPath: args.recordPath ?? null,
    indexPath: args.indexPath ?? null,
    blockers: uniqueSortedStrings(args.blockers),
    warnings: uniqueSortedStrings(args.warnings ?? [])
  };
}

function planRunNextAction(status: PlanRunStatus): string {
  switch (status) {
    case "PREPARED":
      return "Continue implementation and record the next PlanRun attempt.";
    case "IMPLEMENTED":
    case "PARTIAL":
      return "Run verification and update this PlanRun with command evidence.";
    case "VERIFIED":
      return "Review the recorded implementation evidence before preparing a PR.";
    case "BLOCKED":
      return "Resolve the blocker and record a follow-up PlanRun attempt.";
    case "FAILED":
      return "Inspect the failed evidence and choose retry or rollback.";
    case "APPROVED":
      return "Prepare the reviewed PlanRun for PR publication.";
    case "ROLLED_BACK":
      return "Confirm rollback evidence and close the PlanRun.";
  }
}

function buildPlanRunPatchId(args: {
  phase: string;
  planId: string;
  runId: string;
}): string {
  return normalizePlanRunId(`plan-run-${args.phase}-${args.planId}-${args.runId}`);
}

function normalizePlanRunIndexSummary(
  projectRoot: string,
  value: unknown,
  label: string
): PlanRunIndex["runs"][number] {
  const summary = requirePlainObject(value, label);

  return {
    runId: normalizePlanRunId(normalizeRequiredStringValue(summary.runId, `${label}.runId`)),
    status: normalizePlanRunStatus(summary.status),
    createdAt: normalizeRequiredStringValue(summary.createdAt, `${label}.createdAt`),
    updatedAt: normalizeRequiredStringValue(summary.updatedAt, `${label}.updatedAt`),
    branchName:
      summary.branchName === null
        ? null
        : normalizeRequiredStringValue(summary.branchName, `${label}.branchName`),
    worktreePath:
      normalizePersistedFilesystemPath(
        projectRoot,
        summary.worktreePath,
        `${label}.worktreePath`
      ),
    summaryPath:
      summary.summaryPath === null
        ? null
        : normalizeBlueprintArtifactPath(projectRoot, summary.summaryPath, `${label}.summaryPath`),
    reviewVerdict:
      summary.reviewVerdict === null
        ? null
        : normalizePlanRunReviewVerdict(summary.reviewVerdict, `${label}.reviewVerdict`)
  };
}

function comparePlanRunIndexSummaries(
  left: PlanRunIndex["runs"][number],
  right: PlanRunIndex["runs"][number]
): number {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt.localeCompare(right.updatedAt);
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.runId.localeCompare(right.runId);
}

function normalizePlanRunIndex(
  value: unknown,
  expected: { projectRoot: string; phase: string; planId: string; label: string }
): PlanRunIndex {
  if (!isPlainObject(value)) {
    throw new Error(`${expected.label} must be a JSON object.`);
  }

  assertPlanRunSchemaVersion(value.schemaVersion, `${expected.label}.schemaVersion`);

  const phase = normalizePlanRunPhase(String(value.phase ?? ""));
  const planId = normalizePlanRunPlanId(String(value.planId ?? ""));

  if (phase !== expected.phase || planId !== expected.planId) {
    throw new Error(
      `${expected.label} is for phase ${phase} plan ${planId}, expected phase ${expected.phase} plan ${expected.planId}.`
    );
  }

  if (!Array.isArray(value.runs)) {
    throw new Error(`${expected.label}.runs must be an array.`);
  }

  const latestRunId =
    value.latestRunId === null
      ? null
      : normalizePlanRunId(String(value.latestRunId ?? ""));
  const runs = value.runs.map((entry, index) =>
    normalizePlanRunIndexSummary(
      expected.projectRoot,
      entry,
      `${expected.label}.runs[${index}]`
    )
  );

  if (latestRunId && !runs.some((entry) => entry.runId === latestRunId)) {
    throw new Error(`${expected.label}.latestRunId must reference an entry in runs.`);
  }

  if (!latestRunId && runs.length > 0) {
    throw new Error(`${expected.label}.latestRunId must be set when runs are present.`);
  }

  const latestRun = runs.reduce<PlanRunIndex["runs"][number] | null>(
    (currentLatest, run) =>
      currentLatest && comparePlanRunIndexSummaries(currentLatest, run) >= 0
        ? currentLatest
        : run,
    null
  );

  if (latestRun && latestRunId !== latestRun.runId) {
    throw new Error(`${expected.label}.latestRunId must reference the newest run entry.`);
  }

  return {
    schemaVersion: PLAN_RUN_SCHEMA_VERSION,
    phase,
    planId,
    latestRunId,
    runs
  };
}

function normalizePlanRunRecord(
  value: unknown,
  expected: {
    projectRoot: string;
    phase: string;
    planId: string;
    runId: string;
    label: string;
  }
): PlanRunRecord {
  const record = requirePlainObject(value, expected.label);

  assertPlanRunSchemaVersion(record.schemaVersion, `${expected.label}.schemaVersion`);

  const phase = normalizePlanRunPhase(
    normalizeRequiredStringValue(record.phase, `${expected.label}.phase`)
  );
  const planId = normalizePlanRunPlanId(
    normalizeRequiredStringValue(record.planId, `${expected.label}.planId`)
  );
  const runId = normalizePlanRunId(
    normalizeRequiredStringValue(record.runId, `${expected.label}.runId`)
  );

  if (phase !== expected.phase || planId !== expected.planId || runId !== expected.runId) {
    throw new Error(
      `${expected.label} is for phase ${phase} plan ${planId} run ${runId}, expected phase ${expected.phase} plan ${expected.planId} run ${expected.runId}.`
    );
  }

  const source = requirePlainObject(record.source, `${expected.label}.source`);
  const worktree = requirePlainObject(record.worktree, `${expected.label}.worktree`);
  const authorization = requirePlainObject(
    record.authorization,
    `${expected.label}.authorization`
  );
  const git = requirePlainObject(record.git, `${expected.label}.git`);
  const review = requirePlainObject(record.review, `${expected.label}.review`);
  const rollback = requirePlainObject(record.rollback, `${expected.label}.rollback`);

  if (!Array.isArray(record.attempts)) {
    throw new Error(`${expected.label}.attempts must be an array.`);
  }

  if (!Array.isArray(record.verification)) {
    throw new Error(`${expected.label}.verification must be an array.`);
  }

  const sourceRepoRoot = path.resolve(
    normalizeRequiredStringValue(source.repoRoot, `${expected.label}.source.repoRoot`)
  );

  if (sourceRepoRoot !== expected.projectRoot) {
    throw new Error(`${expected.label}.source.repoRoot must match the target repo root.`);
  }

  return {
    schemaVersion: PLAN_RUN_SCHEMA_VERSION,
    runId,
    phase,
    planId,
    planPath: normalizeBlueprintArtifactPath(
      expected.projectRoot,
      record.planPath,
      `${expected.label}.planPath`
    ),
    planTitle: normalizeNullableStringValue(record.planTitle, `${expected.label}.planTitle`),
    createdAt: normalizeRequiredStringValue(record.createdAt, `${expected.label}.createdAt`),
    updatedAt: normalizeRequiredStringValue(record.updatedAt, `${expected.label}.updatedAt`),
    source: {
      repoRoot: sourceRepoRoot,
      baseHead: normalizeRequiredStringValue(
        source.baseHead,
        `${expected.label}.source.baseHead`
      ),
      baseBranch: normalizeNullableStringValue(
        source.baseBranch,
        `${expected.label}.source.baseBranch`
      )
    },
    worktree: {
      path: normalizePersistedFilesystemPath(
        expected.projectRoot,
        worktree.path,
        `${expected.label}.worktree.path`
      ),
      branchName: normalizeNullableStringValue(
        worktree.branchName,
        `${expected.label}.worktree.branchName`
      ),
      strategy: (() => {
        const strategy = normalizeRequiredStringValue(
          worktree.strategy,
          `${expected.label}.worktree.strategy`
        );

        if (!["worktree", "same-tree", "manual"].includes(strategy)) {
          throw new Error(`${expected.label}.worktree.strategy is not supported: ${strategy}`);
        }

        return strategy as PlanRunRecord["worktree"]["strategy"];
      })()
    },
    authorization: {
      authorizedFiles: normalizePersistedRepoRelativePlanRunPaths(
        expected.projectRoot,
        authorization.authorizedFiles,
        `${expected.label}.authorization.authorizedFiles`
      ),
      authorizedSurfaces: normalizePersistedRepoRelativePlanRunPaths(
        expected.projectRoot,
        authorization.authorizedSurfaces,
        `${expected.label}.authorization.authorizedSurfaces`
      ),
      unauthorizedChangedFiles: normalizePersistedRepoRelativePlanRunPaths(
        expected.projectRoot,
        authorization.unauthorizedChangedFiles,
        `${expected.label}.authorization.unauthorizedChangedFiles`
      ),
      scopeWarnings: normalizeRequiredStringArray(
        authorization.scopeWarnings,
        `${expected.label}.authorization.scopeWarnings`
      )
    },
    git: {
      currentHead: normalizeNullableStringValue(
        git.currentHead,
        `${expected.label}.git.currentHead`
      ),
      changedFiles: normalizePersistedRepoRelativePlanRunPaths(
        expected.projectRoot,
        git.changedFiles,
        `${expected.label}.git.changedFiles`
      ),
      diffStat: normalizeNullableStringValue(git.diffStat, `${expected.label}.git.diffStat`),
      patchId: normalizeNullableStringValue(git.patchId, `${expected.label}.git.patchId`)
    },
    attempts: record.attempts.map((attempt, index) =>
      normalizePlanRunAttempt(attempt, `${expected.label}.attempts[${index}]`)
    ),
    verification: normalizeVerificationEntries(
      record.verification as PlanRunVerification[]
    ),
    review: {
      verdict:
        review.verdict === null
          ? null
          : normalizePlanRunReviewVerdict(review.verdict, `${expected.label}.review.verdict`),
      openFindings: normalizeNonnegativeInteger(
        review.openFindings,
        `${expected.label}.review.openFindings`
      ),
      reviewPath: normalizeNullableBlueprintArtifactPath(
        expected.projectRoot,
        review.reviewPath,
        `${expected.label}.review.reviewPath`
      )
    },
    rollback: {
      rollbackAvailable: normalizeBoolean(
        rollback.rollbackAvailable,
        `${expected.label}.rollback.rollbackAvailable`
      ),
      rollbackStrategy:
        rollback.rollbackStrategy === null
          ? null
          : normalizePlanRunRollbackStrategy(
              rollback.rollbackStrategy,
              `${expected.label}.rollback.rollbackStrategy`
            ),
      rollbackPath: normalizeNullableBlueprintArtifactPath(
        expected.projectRoot,
        rollback.rollbackPath,
        `${expected.label}.rollback.rollbackPath`
      ),
      rolledBackAt: normalizeNullableStringValue(
        rollback.rolledBackAt,
        `${expected.label}.rollback.rolledBackAt`
      )
    },
    summaryPath: normalizeNullableBlueprintArtifactPath(
      expected.projectRoot,
      record.summaryPath,
      `${expected.label}.summaryPath`
    ),
    nextAction: normalizeRequiredStringValue(record.nextAction, `${expected.label}.nextAction`),
    warnings: normalizeRequiredStringArray(record.warnings, `${expected.label}.warnings`)
  };
}

async function readJsonObjectIfPresent(
  filePath: string,
  label: string
): Promise<Record<string, unknown> | null> {
  try {
    return safeJsonParseObject(await fs.readFile(filePath, "utf8"), { label });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function maybeFailPlanRunRecordWrite(filePath: string): void {
  const injectedFailure = process.env.BLUEPRINT_TEST_FAIL_PLAN_RUN_RECORD_WRITE_ONCE;

  if (!injectedFailure) {
    return;
  }

  const matchesPath =
    injectedFailure === "1" || path.resolve(injectedFailure) === path.resolve(filePath);

  if (!matchesPath) {
    return;
  }

  delete process.env.BLUEPRINT_TEST_FAIL_PLAN_RUN_RECORD_WRITE_ONCE;
  throw new Error(`Injected PlanRun record write failure for ${filePath}`);
}

function parsePositivePlanRunTestIntegerEnv(name: string): number | null {
  const raw = process.env[name];

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function waitForPlanRunTestPath(filePath: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await fs.access(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw new Error(`Timed out waiting for PlanRun test release file: ${filePath}`);
}

async function maybeDelayPlanRunPatchRollbackForTest(): Promise<void> {
  const markerPath = process.env.BLUEPRINT_TEST_PLAN_RUN_PATCH_ROLLBACK_MARKER;
  const releasePath = process.env.BLUEPRINT_TEST_PLAN_RUN_PATCH_ROLLBACK_RELEASE;
  const delayMs = parsePositivePlanRunTestIntegerEnv(
    "BLUEPRINT_TEST_PLAN_RUN_PATCH_ROLLBACK_DELAY_MS"
  );

  if (!markerPath && !releasePath && !delayMs) {
    return;
  }

  if (markerPath) {
    await fs.mkdir(path.dirname(markerPath), { recursive: true });
    await fs.writeFile(markerPath, "rollback-pending\n", "utf8");
  }

  if (releasePath) {
    await waitForPlanRunTestPath(releasePath, delayMs ?? 5_000);
    return;
  }

  if (delayMs) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function writeAtomicJsonFile(filePath: string, value: Record<string, unknown>): Promise<void> {
  await ensureParentDirectory(filePath);
  maybeFailPlanRunRecordWrite(filePath);

  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2)}.tmp`
  );

  try {
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function buildPlanRunIndex(args: {
  existingIndex: PlanRunIndex | null;
  run: PlanRunRecord;
}): PlanRunIndex {
  const latestAttempt = args.run.attempts.at(-1);
  const summary: PlanRunIndex["runs"][number] = {
    runId: args.run.runId,
    status: latestAttempt?.status ?? "PREPARED",
    createdAt: args.run.createdAt,
    updatedAt: args.run.updatedAt,
    branchName: args.run.worktree.branchName,
    worktreePath: args.run.worktree.path,
    summaryPath: args.run.summaryPath,
    reviewVerdict: args.run.review.verdict
  };
  const priorRuns = args.existingIndex?.runs.filter(
    (entry) => entry.runId !== args.run.runId
  ) ?? [];

  return {
    schemaVersion: PLAN_RUN_SCHEMA_VERSION,
    phase: args.run.phase,
    planId: args.run.planId,
    latestRunId: args.run.runId,
    runs: [...priorRuns, summary].sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.runId.localeCompare(right.runId)
        : left.createdAt.localeCompare(right.createdAt)
    )
  };
}

async function readPlanRunIndexIfPresent(args: {
  projectRoot: string;
  indexPath: string;
  phase: string;
  planId: string;
}): Promise<PlanRunIndex | null> {
  const parsed = await readJsonObjectIfPresent(args.indexPath, args.indexPath);

  if (!parsed) {
    return null;
  }

  return normalizePlanRunIndex(parsed, {
    projectRoot: args.projectRoot,
    phase: args.phase,
    planId: args.planId,
    label: args.indexPath
  });
}

async function readPlanRunRecordIfPresent(args: {
  projectRoot: string;
  recordPath: string;
  phase: string;
  planId: string;
  runId: string;
}): Promise<PlanRunRecord | null> {
  const parsed = await readJsonObjectIfPresent(args.recordPath, args.recordPath);

  if (!parsed) {
    return null;
  }

  return normalizePlanRunRecord(parsed, {
    projectRoot: args.projectRoot,
    phase: args.phase,
    planId: args.planId,
    runId: args.runId,
    label: args.recordPath
  });
}

async function loadPlanMetadata(args: {
  projectRoot: string;
  phase: string;
  planId: string;
}): Promise<{
  path: string;
  title: string | null;
  authorizedFiles: string[];
  warnings: string[];
}> {
  const planRead = await blueprintPhasePlanRead({
    cwd: args.projectRoot,
    phase: args.phase,
    planId: args.planId
  });

  if (!planRead.phaseFound) {
    throw new Error(planRead.reason ?? `Phase ${args.phase} was not found.`);
  }

  if (!planRead.found || !planRead.path) {
    throw new Error(
      planRead.reason ?? `Plan ${args.planId} was not found for phase ${args.phase}.`
    );
  }

  return {
    path: planRead.path,
    title: planRead.metadata?.title ?? null,
    authorizedFiles: normalizeRepoRelativePlanRunPaths(
      args.projectRoot,
      planRead.metadata?.filesModified ?? [],
      "plan.metadata.filesModified"
    ),
    warnings: planRead.validation?.warnings ?? []
  };
}

function createPlanRunRecord(args: {
  projectRoot: string;
  input: PlanRunRecordArgs;
  phase: string;
  planId: string;
  runId: string;
  planPath: string;
  planTitle: string | null;
  authorizedFiles: string[];
  changedFiles: string[];
  unauthorizedChangedFiles: string[];
  warnings: string[];
  existingRecord: PlanRunRecord | null;
  now: string;
}): PlanRunRecord {
  const existing = args.existingRecord;
  const commandEvidence = (args.input.commandsRun ?? []).map(formatCommandEvidence);
  const notes = normalizeStringList(args.input.notes, "notes");
  const nextAttemptNumber = (existing?.attempts.at(-1)?.attempt ?? 0) + 1;
  const attempt: PlanRunAttempt = {
    attempt: nextAttemptNumber,
    status: args.input.status,
    startedAt: args.now,
    completedAt: args.now,
    commandsRun: commandEvidence,
    notes
  };
  const inputBranchName = normalizeString(args.input.branchName, "branchName");
  const inputWorktreePath = normalizeOptionalFilesystemPath(
    args.projectRoot,
    args.input.worktreePath,
    "worktreePath"
  );

  if (
    existing?.worktree.branchName &&
    inputBranchName &&
    inputBranchName !== existing.worktree.branchName
  ) {
    throw new Error(
      `PlanRun ${args.runId} worktree branch is immutable once recorded; expected ${existing.worktree.branchName}, received ${inputBranchName}.`
    );
  }

  if (
    existing?.worktree.path &&
    inputWorktreePath &&
    inputWorktreePath !== existing.worktree.path
  ) {
    throw new Error(
      `PlanRun ${args.runId} worktree path is immutable once recorded; expected ${existing.worktree.path}, received ${inputWorktreePath}.`
    );
  }

  const branchName = inputBranchName ?? existing?.worktree.branchName ?? null;
  const worktreePath = inputWorktreePath ?? existing?.worktree.path ?? null;
  const summaryPath =
    normalizeOptionalRepoRelativePlanRunPath(
      args.projectRoot,
      args.input.summaryPath,
      "summaryPath"
    ) ??
    existing?.summaryPath ??
    null;
  const verification =
    args.input.verification === undefined
      ? existing?.verification ?? []
      : normalizeVerificationEntries(args.input.verification);
  const patchId = normalizeString(args.input.patch?.patchId, "patch.patchId");
  const scopeWarnings = args.unauthorizedChangedFiles.length > 0
    ? [
        `Changed files outside the plan authorization: ${args.unauthorizedChangedFiles.join(", ")}`
      ]
    : [];

  return {
    schemaVersion: PLAN_RUN_SCHEMA_VERSION,
    runId: args.runId,
    phase: args.phase,
    planId: args.planId,
    planPath: args.planPath,
    planTitle: args.planTitle,
    createdAt: existing?.createdAt ?? args.now,
    updatedAt: args.now,
    source: {
      repoRoot: args.projectRoot,
      baseHead: normalizeString(args.input.baseHead, "baseHead") ?? "",
      baseBranch: existing?.source.baseBranch ?? null
    },
    worktree: {
      path: worktreePath,
      branchName,
      strategy: worktreePath ? "worktree" : existing?.worktree.strategy ?? "manual"
    },
    authorization: {
      authorizedFiles: args.authorizedFiles,
      authorizedSurfaces: args.authorizedFiles,
      unauthorizedChangedFiles: args.unauthorizedChangedFiles,
      scopeWarnings
    },
    git: {
      currentHead:
        normalizeString(args.input.currentHead, "currentHead") ??
        existing?.git.currentHead ??
        null,
      changedFiles: args.changedFiles,
      diffStat: existing?.git.diffStat ?? null,
      patchId: patchId ?? existing?.git.patchId ?? null
    },
    attempts: [...(existing?.attempts ?? []), attempt],
    verification,
    review: existing?.review ?? {
      verdict: null,
      openFindings: 0,
      reviewPath: null
    },
    rollback: existing?.rollback ?? {
      rollbackAvailable: Boolean(args.input.baseHead),
      rollbackStrategy: null,
      rollbackPath: null,
      rolledBackAt: null
    },
    summaryPath,
    nextAction: planRunNextAction(args.input.status),
    warnings: uniqueSortedStrings([
      ...(existing?.warnings ?? []),
      ...args.warnings,
      ...scopeWarnings
    ])
  };
}

export async function blueprintPlanRunRecord(
  args: PlanRunRecordArgs
): Promise<PlanRunRecordResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const phase = normalizePlanRunPhase(args.phase);
  const planId = normalizePlanRunPlanId(args.planId);
  const runId = normalizePlanRunId(args.runId);
  const indexPath = buildPlanRunIndexPath(projectRoot, phase, planId);
  const recordPath = buildPlanRunRecordPath(projectRoot, phase, planId, runId);
  const planMetadata = await loadPlanMetadata({
    projectRoot,
    phase,
    planId
  });
  const changedFiles = normalizeRepoRelativePlanRunPaths(
    projectRoot,
    args.changedFiles,
    "changedFiles"
  );
  const explicitUnauthorizedChangedFiles = normalizeRepoRelativePlanRunPaths(
    projectRoot,
    args.unauthorizedChangedFiles,
    "unauthorizedChangedFiles"
  );
  const unauthorizedChangedFiles = deriveUnauthorizedChangedFiles({
    changedFiles,
    authorizedFiles: planMetadata.authorizedFiles,
    explicitUnauthorizedChangedFiles
  });
  const warnings = uniqueSortedStrings([
    ...normalizeStringList(args.warnings, "warnings"),
    ...planMetadata.warnings
  ]);

  return withBlueprintRepoLock(projectRoot, "plan-run-record", async () => {
    const existingIndex = await readPlanRunIndexIfPresent({
      projectRoot,
      indexPath,
      phase,
      planId
    });
    const existingRecord = await readPlanRunRecordIfPresent({
      projectRoot,
      recordPath,
      phase,
      planId,
      runId
    });
    const run = createPlanRunRecord({
      projectRoot,
      input: args,
      phase,
      planId,
      runId,
      planPath: planMetadata.path,
      planTitle: planMetadata.title,
      authorizedFiles: planMetadata.authorizedFiles,
      changedFiles,
      unauthorizedChangedFiles,
      warnings,
      existingRecord,
      now: new Date().toISOString()
    });
    const index = buildPlanRunIndex({
      existingIndex,
      run
    });

    await writeAtomicJsonFile(recordPath, run as unknown as Record<string, unknown>);
    await writeAtomicJsonFile(indexPath, index as unknown as Record<string, unknown>);

    const reloadedIndex = await readPlanRunIndexIfPresent({
      projectRoot,
      indexPath,
      phase,
      planId
    });
    const reloadedRun = await readPlanRunRecordIfPresent({
      projectRoot,
      recordPath,
      phase,
      planId,
      runId
    });

    if (!reloadedIndex || !reloadedRun) {
      throw new Error(`PlanRun ${runId} failed to reload after persistence.`);
    }

    return {
      status: "recorded",
      created: existingRecord === null,
      updated: existingRecord !== null,
      indexPath,
      path: recordPath,
      run: reloadedRun,
      history: reloadedIndex.runs,
      warnings: reloadedRun.warnings
    };
  });
}

export async function blueprintPlanRunLoad(
  args: PlanRunLoadArgs
): Promise<PlanRunLoadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const phase = normalizePlanRunPhase(args.phase);
  const planId = normalizePlanRunPlanId(args.planId);
  const indexPath = buildPlanRunIndexPath(projectRoot, phase, planId);
  const index = await readPlanRunIndexIfPresent({
    projectRoot,
    indexPath,
    phase,
    planId
  });

  if (!index) {
    return {
      found: false,
      phase,
      planId,
      runId: null,
      indexPath,
      path: null,
      run: null,
      history: [],
      latestRunId: null,
      reason: `${indexPath} does not exist yet.`,
      warnings: []
    };
  }

  const selectedRunId = args.runId
    ? normalizePlanRunId(args.runId)
    : index.latestRunId;

  if (!selectedRunId) {
    return {
      found: false,
      phase,
      planId,
      runId: null,
      indexPath,
      path: null,
      run: null,
      history: index.runs,
      latestRunId: index.latestRunId,
      reason: "No PlanRun entries are recorded yet.",
      warnings: []
    };
  }

  const recordPath = buildPlanRunRecordPath(projectRoot, phase, planId, selectedRunId);
  const run = await readPlanRunRecordIfPresent({
    projectRoot,
    recordPath,
    phase,
    planId,
    runId: selectedRunId
  });

  return {
    found: run !== null,
    phase,
    planId,
    runId: selectedRunId,
    indexPath,
    path: recordPath,
    run,
    history: index.runs,
    latestRunId: index.latestRunId,
    reason: run ? null : `${recordPath} does not exist yet.`,
    warnings: run?.warnings ?? []
  };
}

export async function blueprintPlanRunDiff(
  args: PlanRunDiffArgs
): Promise<PlanRunDiffResult> {
  const phase = normalizePlanRunPhase(args.phase);
  const planId = normalizePlanRunPlanId(args.planId);
  const requestedRunId = args.runId ? normalizePlanRunId(args.runId) : null;
  let projectRoot: string;

  try {
    projectRoot = await ensureRepoRoot(args.cwd);
  } catch (error) {
    return blockedPlanRunDiffResult({
      runId: requestedRunId,
      baseHead: null,
      warnings: [
        error instanceof Error
          ? error.message
          : "Blueprint PlanRun diff requires a git repository root."
      ]
    });
  }

  const loaded = await blueprintPlanRunLoad({
    cwd: projectRoot,
    phase,
    planId,
    runId: requestedRunId ?? undefined
  });

  if (!loaded.found || !loaded.run) {
    return blockedPlanRunDiffResult({
      runId: loaded.runId,
      baseHead: null,
      warnings: [loaded.reason ?? "PlanRun record is missing."]
    });
  }

  const run = loaded.run;
  const diffProjectRoot = await resolvePlanRunDiffProjectRoot({
    sourceProjectRoot: projectRoot,
    run
  });

  if (diffProjectRoot.warning) {
    return blockedPlanRunDiffResult({
      runId: run.runId,
      baseHead: run.source.baseHead,
      warnings: [diffProjectRoot.warning]
    });
  }

  let baseHead: string;

  try {
    baseHead = normalizeGitRevision(run.source.baseHead, "PlanRun source.baseHead");
  } catch (error) {
    return blockedPlanRunDiffResult({
      runId: run.runId,
      baseHead: run.source.baseHead,
      warnings: [
        error instanceof Error
          ? error.message
          : "PlanRun source.baseHead is not safe to use as a git revision."
      ]
    });
  }

  const currentHead = await gitHeadSha(diffProjectRoot.projectRoot);

  if (!currentHead.value) {
    return blockedPlanRunDiffResult({
      runId: run.runId,
      baseHead,
      warnings: [currentHead.warning ?? "Unable to read current git HEAD."]
    });
  }

  const baseHeadWarning = await gitVerifyCommit(diffProjectRoot.projectRoot, baseHead);

  if (baseHeadWarning) {
    return blockedPlanRunDiffResult({
      runId: run.runId,
      baseHead,
      currentHead: currentHead.value,
      warnings: [baseHeadWarning]
    });
  }

  const changedFilesResult = await gitChangedFiles(
    diffProjectRoot.projectRoot,
    baseHead,
    run.authorization.authorizedFiles
  );

  if (changedFilesResult.warning) {
    return blockedPlanRunDiffResult({
      runId: run.runId,
      baseHead,
      currentHead: currentHead.value,
      warnings: [changedFilesResult.warning]
    });
  }

  const diffStatResult = await gitDiffStat(
    diffProjectRoot.projectRoot,
    baseHead,
    changedFilesResult.untrackedFiles
  );

  if (diffStatResult.warning) {
    return blockedPlanRunDiffResult({
      runId: run.runId,
      baseHead,
      currentHead: currentHead.value,
      warnings: [diffStatResult.warning]
    });
  }

  let patch: string | null = null;
  let truncated = false;
  const includePatch = args.includePatch ?? false;

  if (includePatch) {
    const patchResult = await gitDiffPatch(
      diffProjectRoot.projectRoot,
      baseHead,
      args.maxPatchBytes ?? PLAN_RUN_DEFAULT_MAX_PATCH_BYTES,
      changedFilesResult.untrackedFiles
    );

    if (patchResult.warning) {
      return blockedPlanRunDiffResult({
        runId: run.runId,
        baseHead,
        currentHead: currentHead.value,
        warnings: [patchResult.warning]
      });
    }

    patch = patchResult.patch;
    truncated = patchResult.truncated;
  }

  const unauthorizedChangedFiles = uniqueSortedStrings(
    changedFilesResult.changedFiles
      .filter((changedFile) => !changedFile.authorized)
      .map((changedFile) => changedFile.path)
  );

  return {
    status: "ready",
    runId: run.runId,
    baseHead,
    currentHead: currentHead.value,
    changedFiles: changedFilesResult.changedFiles,
    unauthorizedChangedFiles,
    diffStat: diffStatResult.diffStat,
    patch,
    truncated,
    warnings: run.warnings
  };
}

export async function blueprintPlanRunPatchRecord(
  args: PlanRunPatchRecordArgs
): Promise<PlanRunPatchRecordResult> {
  const phase = normalizePlanRunPhase(args.phase);
  const planId = normalizePlanRunPlanId(args.planId);
  const requestedRunId = args.runId ? normalizePlanRunId(args.runId) : null;
  let projectRoot: string;

  try {
    projectRoot = await ensureRepoRoot(args.cwd);
  } catch (error) {
    return blockedPlanRunPatchRecordResult({
      phase,
      planId,
      runId: requestedRunId,
      blockers: [
        error instanceof Error
          ? error.message
          : "Blueprint PlanRun patch capture requires the source repository root."
      ]
    });
  }

  const loaded = await blueprintPlanRunLoad({
    cwd: projectRoot,
    phase,
    planId,
    runId: requestedRunId ?? undefined
  });

  if (!loaded.found || !loaded.run) {
    return blockedPlanRunPatchRecordResult({
      phase,
      planId,
      runId: loaded.runId,
      sourceRoot: projectRoot,
      indexPath: loaded.indexPath,
      recordPath: loaded.path,
      blockers: [loaded.reason ?? "PlanRun record is missing."],
      warnings: loaded.warnings
    });
  }

  const run = loaded.run;
  const patchId = buildPlanRunPatchId({
    phase,
    planId,
    runId: run.runId
  });
  const diffProjectRoot = await resolvePlanRunPatchCaptureProjectRoot({
    sourceProjectRoot: projectRoot,
    run
  });

  if (diffProjectRoot.warning || !diffProjectRoot.projectRoot) {
    return blockedPlanRunPatchRecordResult({
      phase,
      planId,
      runId: run.runId,
      sourceRoot: projectRoot,
      diffRoot: diffProjectRoot.projectRoot,
      patchId,
      baseHead: run.source.baseHead,
      indexPath: loaded.indexPath,
      recordPath: loaded.path,
      blockers: [
        diffProjectRoot.warning ?? "PlanRun patch capture could not resolve the worktree."
      ],
      warnings: loaded.warnings
    });
  }

  const diff = await blueprintPlanRunDiff({
    cwd: projectRoot,
    phase,
    planId,
    runId: run.runId,
    includePatch: true,
    maxPatchBytes: args.maxPatchBytes ?? Number.MAX_SAFE_INTEGER
  });

  if (diff.status === "blocked") {
    return blockedPlanRunPatchRecordResult({
      phase,
      planId,
      runId: run.runId,
      sourceRoot: projectRoot,
      diffRoot: diffProjectRoot.projectRoot,
      patchId,
      baseHead: diff.baseHead,
      currentHead: diff.currentHead,
      indexPath: loaded.indexPath,
      recordPath: loaded.path,
      blockers: diff.warnings.length > 0 ? diff.warnings : ["PlanRun diff capture was blocked."],
      warnings: loaded.warnings
    });
  }

  const changedFilePaths = diff.changedFiles.map((changedFile) => changedFile.path);

  if (changedFilePaths.length === 0 || !diff.patch) {
    return blockedPlanRunPatchRecordResult({
      phase,
      planId,
      runId: run.runId,
      sourceRoot: projectRoot,
      diffRoot: diffProjectRoot.projectRoot,
      patchId,
      baseHead: diff.baseHead,
      currentHead: diff.currentHead,
      changedFiles: diff.changedFiles,
      unauthorizedChangedFiles: diff.unauthorizedChangedFiles,
      diffStat: diff.diffStat,
      indexPath: loaded.indexPath,
      recordPath: loaded.path,
      blockers: ["No implementation diff exists for this PlanRun."],
      warnings: diff.warnings
    });
  }

  if (!diff.baseHead) {
    return blockedPlanRunPatchRecordResult({
      phase,
      planId,
      runId: run.runId,
      sourceRoot: projectRoot,
      diffRoot: diffProjectRoot.projectRoot,
      patchId,
      currentHead: diff.currentHead,
      changedFiles: diff.changedFiles,
      unauthorizedChangedFiles: diff.unauthorizedChangedFiles,
      diffStat: diff.diffStat,
      indexPath: loaded.indexPath,
      recordPath: loaded.path,
      blockers: ["PlanRun diff did not return a baseHead for patch capture."],
      warnings: diff.warnings
    });
  }

  const diffBaseHead = diff.baseHead;

  if (diff.truncated) {
    return blockedPlanRunPatchRecordResult({
      phase,
      planId,
      runId: run.runId,
      sourceRoot: projectRoot,
      diffRoot: diffProjectRoot.projectRoot,
      patchId,
      baseHead: diff.baseHead,
      currentHead: diff.currentHead,
      changedFiles: diff.changedFiles,
      unauthorizedChangedFiles: diff.unauthorizedChangedFiles,
      diffStat: diff.diffStat,
      indexPath: loaded.indexPath,
      recordPath: loaded.path,
      blockers: ["PlanRun patch capture was truncated; refusing to record a partial patch."],
      warnings: diff.warnings
    });
  }

  if (diff.unauthorizedChangedFiles.length > 0) {
    const recordedBlockedRun = await blueprintPlanRunRecord({
      cwd: projectRoot,
      runId: run.runId,
      phase,
      planId,
      status: "BLOCKED",
      worktreePath: run.worktree.path ?? undefined,
      branchName: run.worktree.branchName ?? undefined,
      baseHead: diffBaseHead,
      currentHead: diff.currentHead ?? undefined,
      changedFiles: changedFilePaths,
      unauthorizedChangedFiles: diff.unauthorizedChangedFiles,
      commandsRun: args.commandsRun,
      verification: args.verification,
      notes: args.notes,
      warnings: [
        ...(args.warnings ?? []),
        ...diff.warnings,
        `PlanRun patch capture blocked because changed files were outside the plan authorization: ${diff.unauthorizedChangedFiles.join(", ")}`
      ]
    });

    return blockedPlanRunPatchRecordResult({
      phase,
      planId,
      runId: run.runId,
      sourceRoot: projectRoot,
      diffRoot: diffProjectRoot.projectRoot,
      patchId,
      baseHead: diff.baseHead,
      currentHead: diff.currentHead,
      changedFiles: diff.changedFiles,
      unauthorizedChangedFiles: diff.unauthorizedChangedFiles,
      diffStat: diff.diffStat,
      indexPath: recordedBlockedRun.indexPath,
      recordPath: recordedBlockedRun.path,
      blockers: [
        `Changed files outside the plan authorization: ${diff.unauthorizedChangedFiles.join(", ")}`
      ],
      warnings: recordedBlockedRun.warnings
    });
  }

  const patchRecord = await blueprintPatchRecord(
    {
      cwd: diffProjectRoot.projectRoot,
      patchId,
      patch: diff.patch,
      trackedFiles: changedFilePaths,
      label: `Plan run ${phase}/${planId}`,
      sourceVersion: diffBaseHead,
      compatibility: {
        repoRootName: path.basename(projectRoot)
      },
      audit: {
        action: "record",
        outcome: "recorded",
        targetHead: diff.currentHead,
        warnings: diff.warnings
      }
    },
    {
      captureRollbackSnapshot: true
    }
  );
  let recordedRun: PlanRunRecordResult;

  try {
    recordedRun = await blueprintPlanRunRecord({
      cwd: projectRoot,
      runId: run.runId,
      phase,
      planId,
      status: "IMPLEMENTED",
      worktreePath: run.worktree.path ?? undefined,
      branchName: run.worktree.branchName ?? undefined,
      baseHead: diffBaseHead,
      currentHead: diff.currentHead ?? undefined,
      changedFiles: changedFilePaths,
      unauthorizedChangedFiles: [],
      commandsRun: args.commandsRun,
      verification: args.verification,
      patch: {
        patchId: patchRecord.patchId,
        recorded: true,
        registryPath: patchRecord.registryPath,
        patchPath: patchRecord.patchPath
      },
      notes: args.notes,
      warnings: [...(args.warnings ?? []), ...diff.warnings]
    });
  } catch (error) {
    try {
      await maybeDelayPlanRunPatchRollbackForTest();
      await rollbackPatchRecordToSnapshot(patchRecord.rollbackSnapshot);
    } catch (rollbackError) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      const rollbackMessage =
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError);

      throw new Error(
        `PlanRun metadata persistence failed after patch registry write, and patch registry rollback also failed. Original error: ${originalMessage}. Rollback error: ${rollbackMessage}`
      );
    }

    throw error;
  }

  return {
    status: "recorded",
    phase,
    planId,
    runId: run.runId,
    sourceRoot: projectRoot,
    diffRoot: diffProjectRoot.projectRoot,
    patchId: patchRecord.patchId,
    baseHead: diff.baseHead,
    currentHead: diff.currentHead,
    changedFiles: diff.changedFiles,
    unauthorizedChangedFiles: diff.unauthorizedChangedFiles,
    diffStat: diff.diffStat,
    registryPath: patchRecord.registryPath,
    manifestPath: patchRecord.manifestPath,
    patchPath: patchRecord.patchPath,
    auditPath: patchRecord.auditPath,
    recordPath: recordedRun.path,
    indexPath: recordedRun.indexPath,
    blockers: [],
    warnings: recordedRun.warnings
  };
}

export async function blueprintPlanRunPrepare(
  args: PlanRunPrepareArgs
): Promise<PlanRunPrepareResult> {
  const mode = args.mode ?? "preview";
  const phase = normalizePlanRunPhase(args.phase);
  const planId = normalizePlanRunPlanId(args.planId);
  const runId = args.runId
    ? normalizePlanRunId(args.runId)
    : normalizePlanRunId(`run-${Date.now().toString(36)}`);
  let projectRoot: string;

  try {
    projectRoot = await ensureRepoRoot(args.cwd);
  } catch (error) {
    return blockedPlanRunPrepareResult({
      mode,
      phase,
      planId,
      runId,
      blockers: [
        error instanceof Error
          ? error.message
          : "Blueprint PlanRun prepare requires a git repository root."
      ]
    });
  }

  const recordPath = buildPlanRunRecordPath(projectRoot, phase, planId, runId);
  const indexPath = buildPlanRunIndexPath(projectRoot, phase, planId);
  const [configResult, executionTargets, planRead, baseHead, sourceStatus] =
    await Promise.all([
      blueprintConfigGet({
        cwd: projectRoot,
        scope: "effective"
      }),
      blueprintPhaseExecutionTargets({
        cwd: projectRoot,
        phase,
        includeConflicts: true
      }),
      blueprintPhasePlanRead({
        cwd: projectRoot,
        phase,
        planId
      }),
      gitHeadSha(projectRoot),
      gitStatusShort(projectRoot)
    ]);

  if (!executionTargets.phaseFound) {
    return blockedPlanRunPrepareResult({
      mode,
      phase,
      planId,
      runId,
      recordPath,
      indexPath,
      blockers: executionTargets.blockers.reasons.length > 0
        ? executionTargets.blockers.reasons
        : [executionTargets.warnings[0] ?? `Phase ${phase} was not found.`],
      warnings: executionTargets.warnings
    });
  }

  if (!planRead.phaseFound || !planRead.found || !planRead.path) {
    return blockedPlanRunPrepareResult({
      mode,
      phase,
      planId,
      runId,
      recordPath,
      indexPath,
      blockers: [planRead.reason ?? `Plan ${planId} was not found for phase ${phase}.`],
      warnings: planRead.validation?.warnings ?? []
    });
  }

  const authorizedFiles = normalizeRepoRelativePlanRunPaths(
    projectRoot,
    planRead.metadata?.filesModified ?? [],
    "plan.metadata.filesModified"
  );
  const verificationCommands = extractVerificationCommands(
    planRead.metadata?.acceptanceCriteria ?? []
  );
  const planTitle = planRead.metadata?.title ?? null;
  const slug = buildDefaultPlanRunSlug(planTitle, planId);
  const branchName =
    args.branchName ??
    renderPlanRunBranchName({
      template: configResult.config.git.phase_branch_template,
      phase,
      planId,
      slug
    });
  const workspaceName = normalizePlanRunWorkspaceName(
    args.workspaceName ?? `phase-${phase}-plan-${planId}-${slug}`
  );
  const workspacePath = path.resolve(
    expandHomePath(
      args.workspacePath ??
      path.join(configResult.config.maintenance.workspace_root, workspaceName)
    )
  );
  const strategy: PlanRunPrepareResult["strategy"] =
    configResult.config.workflow.use_worktrees ? "worktree" : "same-tree";
  const commonResult = {
    mode,
    phase,
    planId,
    runId,
    planPath: planRead.path,
    planTitle,
    branchName,
    workspaceName,
    workspacePath,
    strategy,
    baseHead: baseHead.value,
    currentHead: baseHead.value,
    authorizedFiles,
    verificationCommands,
    recordPath,
    indexPath,
    warnings: uniqueSortedStrings([
      ...configResult.warnings,
      ...(planRead.validation?.warnings ?? []),
      ...executionTargets.warnings
    ])
  };
  const blockers = [
    ...(baseHead.warning ? [baseHead.warning] : []),
    ...(sourceStatus.warning ? [sourceStatus.warning] : []),
    ...(sourceStatus.value ? [
      `Source repository has uncommitted changes and must be clean before PlanRun prepare: ${sourceStatus.value}`
    ] : []),
    ...(executionTargets.blockers.executionBlocked
      ? executionTargets.blockers.reasons
      : []),
    ...(!executionTargets.selectedPlanIds.includes(planId)
      ? [`Plan ${planId} is not currently selected for execution.`]
      : []),
    ...(strategy === "same-tree"
      ? ["workflow.use_worktrees is disabled; same-tree PlanRun prepare is not implemented yet."]
      : [])
  ];

  if (blockers.length > 0 || !baseHead.value) {
    return blockedPlanRunPrepareResult({
      ...commonResult,
      blockers: blockers.length > 0 ? blockers : ["Unable to read base HEAD."]
    });
  }

  if (mode === "preview") {
    return {
      status: "preview",
      ...commonResult,
      worktreePath: null,
      blockers: []
    };
  }

  const branchExistedBeforePrepare = await gitLocalBranchExists(projectRoot, branchName);
  let workspace: Awaited<ReturnType<typeof blueprintWorkspaceCreate>> | null = null;

  try {
    workspace = await blueprintWorkspaceCreate({
      cwd: projectRoot,
      name: workspaceName,
      path: workspacePath,
      strategy: "worktree",
      branch: branchName,
      cleanStatusPathspecs: PLAN_RUN_GIT_PATHSPECS
    });
    const worktreePath = workspace.repoMembers[0]?.path ?? workspace.workspacePath;
    const worktreeHead = workspace.repoMembers[0]?.head ?? baseHead.value;
    const recorded = await blueprintPlanRunRecord({
      cwd: projectRoot,
      runId,
      phase,
      planId,
      status: "PREPARED",
      worktreePath,
      branchName,
      baseHead: baseHead.value,
      currentHead: worktreeHead,
      changedFiles: [],
      warnings: commonResult.warnings
    });

    return {
      status: "prepared",
      ...commonResult,
      worktreePath,
      currentHead: worktreeHead,
      recordPath: recorded.path,
      indexPath: recorded.indexPath,
      blockers: [],
      warnings: recorded.warnings
    };
  } catch (error) {
    const cleanupWarnings = workspace
      ? await cleanupPreparedPlanRunWorkspace({
          projectRoot,
          workspaceName,
          workspacePath,
          branchName,
          branchExistedBeforePrepare
        })
      : [];

    return blockedPlanRunPrepareResult({
      ...commonResult,
      blockers: [
        error instanceof Error
          ? error.message
          : "PlanRun workspace preparation failed."
      ],
      warnings: [...commonResult.warnings, ...cleanupWarnings]
    });
  }
}

export const planRunToolDefinitions: ToolDefinition[] = [
  {
    name: "blueprint_plan_run_record",
    description:
      "Persist or update a phase plan execution run record plus its phase-plan run index under .blueprint/runs.",
    inputSchema: planRunRecordInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPlanRunRecord(args as PlanRunRecordArgs)
  },
  {
    name: "blueprint_plan_run_load",
    description:
      "Load the latest or selected phase plan execution run record and the run history index.",
    inputSchema: planRunLoadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPlanRunLoad(args as PlanRunLoadArgs)
  },
  {
    name: "blueprint_plan_run_prepare",
    description:
      "Preview or create an isolated workspace branch for a phase plan and record the initial prepared PlanRun.",
    inputSchema: planRunPrepareInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPlanRunPrepare(args as PlanRunPrepareArgs)
  },
  {
    name: "blueprint_plan_run_diff",
    description:
      "Compute safe git diff metadata for a recorded phase plan execution run without persisting review or patch artifacts.",
    inputSchema: planRunDiffInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPlanRunDiff(args as PlanRunDiffArgs)
  },
  {
    name: "blueprint_plan_run_patch_record",
    description:
      "Capture a recorded PlanRun implementation diff into the host-global patch registry and persist patch metadata back onto the PlanRun.",
    inputSchema: planRunPatchRecordInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPlanRunPatchRecord(args as PlanRunPatchRecordArgs)
  }
];
