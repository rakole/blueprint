import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import * as z from "zod/v4";

import type { ToolDefinition } from "../tool-types.js";
import {
  ensureRepoRoot,
  resolveBlueprintPath,
  resolveRepoRelativePath
} from "./artifacts.js";
import { blueprintPhaseLocate } from "./phase.js";
import { blueprintReviewScope } from "./review.js";

/**
 * Private god-review substrate for hidden `--feels-like-god` review/fix modes.
 *
 * These helpers are intentionally not registered as MCP tools yet. They exist
 * so the hidden command branch can share deterministic path safety, session
 * shapes, report rendering shells, and finding parsing without overloading the
 * normal `review.code-review` / `XX-REVIEW.md` flow.
 *
 * MCP registration may make tools discoverable to clients; privacy here means
 * undocumented and hidden-branch-only, not invisible. Do not wire these results
 * into quality-gate routing, `STATE.md` next actions, public command catalog
 * output, or `blueprint_review_load_findings`. The temporary
 * `.god-review-state.md` file is a god-mode progress aid only, while session
 * JSON owns continuation scope.
 */

const execFileAsync = promisify(execFile);

export const GOD_REVIEW_FLAG = "--feels-like-god" as const;
export const GOD_REVIEW_REFUSAL = [
  "God mode only wakes during special `occassions`.",
  "This is a mistaken skill invocation, reach out to blueprint admin for help.",
  "No `thunderbolt` today."
].join("\n");

export const GOD_REVIEW_PRIVATE_TOOL_NAMES = [
  "blueprint_god_review_start",
  "blueprint_god_review_next",
  "blueprint_god_review_append",
  "blueprint_god_review_load_findings",
  "blueprint_god_review_record_fix",
  "blueprint_god_review_cleanup"
] as const;

export const GOD_REVIEW_MUTATION_TOOL_NAMES = [
  "blueprint_god_review_start",
  "blueprint_god_review_append",
  "blueprint_god_review_record_fix",
  "blueprint_god_review_cleanup"
] as const;

export const GOD_REVIEW_ACTIVE_COMMANDS = [
  "/blu-code-review",
  "/blu-code-review-fix"
] as const;

const GOD_REVIEW_SCOPE_KIND_VALUES = [
  "phase",
  "pr",
  "current-diff",
  "explicit-files"
] as const;
const GOD_REVIEW_SESSION_STATUS_VALUES = [
  "in-progress",
  "completed",
  "blocked",
  "stale"
] as const;
const GOD_REVIEW_GROUP_STATUS_VALUES = [
  "pending",
  "in-progress",
  "completed",
  "blocked"
] as const;
const GOD_REVIEW_SEVERITY_VALUES = [
  "critical",
  "high",
  "medium",
  "low",
  "unknown"
] as const;
const GOD_REVIEW_DISPOSITION_VALUES = [
  "follow-up",
  "observation",
  "blocked",
  "accepted-risk"
] as const;
const GOD_REVIEW_FIX_ELIGIBILITY_VALUES = [
  "eligible",
  "needs-confirmation",
  "not-eligible"
] as const;
const GOD_REVIEW_REMEDIATION_STATUS_VALUES = [
  "fixed",
  "skipped",
  "deferred",
  "stale",
  "blocked"
] as const;
const GOD_REVIEW_SELECTED_BY_VALUES = [
  "default",
  "explicit-id",
  "severity-filter",
  "all"
] as const;

export const GOD_REVIEW_GROUPS = [
  {
    id: "correctness-contracts",
    prefix: "COR",
    title: "Correctness And Contracts"
  },
  {
    id: "security-privacy-auth",
    prefix: "SEC",
    title: "Security, Privacy, And Authorization"
  },
  {
    id: "data-state-consistency",
    prefix: "DAT",
    title: "Data, State, And Consistency"
  },
  {
    id: "failure-reliability",
    prefix: "REL",
    title: "Failure Handling And Reliability"
  },
  {
    id: "tests-verification",
    prefix: "TST",
    title: "Tests And Verification"
  },
  {
    id: "architecture-maintainability",
    prefix: "ARC",
    title: "Architecture And Maintainability"
  },
  {
    id: "performance-scalability",
    prefix: "PER",
    title: "Performance And Scalability"
  },
  {
    id: "operations-portability-product",
    prefix: "OPS",
    title: "Operations, Portability, And Product Surface"
  }
] as const;

const GOD_REVIEW_GROUP_ID_VALUES = GOD_REVIEW_GROUPS.map((group) => group.id) as [
  "correctness-contracts",
  "security-privacy-auth",
  "data-state-consistency",
  "failure-reliability",
  "tests-verification",
  "architecture-maintainability",
  "performance-scalability",
  "operations-portability-product"
];
const GOD_REVIEW_GROUP_PREFIX_VALUES = GOD_REVIEW_GROUPS.map((group) => group.prefix) as [
  "COR",
  "SEC",
  "DAT",
  "REL",
  "TST",
  "ARC",
  "PER",
  "OPS"
];

export type GodReviewPrivateToolName = typeof GOD_REVIEW_PRIVATE_TOOL_NAMES[number];
export type GodReviewMutationToolName = typeof GOD_REVIEW_MUTATION_TOOL_NAMES[number];
export type GodReviewActiveCommand = typeof GOD_REVIEW_ACTIVE_COMMANDS[number];
export type GodReviewScopeKind = typeof GOD_REVIEW_SCOPE_KIND_VALUES[number];
export type GodReviewSessionStatus = typeof GOD_REVIEW_SESSION_STATUS_VALUES[number];
export type GodReviewGroupId = typeof GOD_REVIEW_GROUP_ID_VALUES[number];
export type GodReviewGroupPrefix = typeof GOD_REVIEW_GROUP_PREFIX_VALUES[number];
export type GodReviewGroupStatus = typeof GOD_REVIEW_GROUP_STATUS_VALUES[number];
export type GodReviewSeverity = typeof GOD_REVIEW_SEVERITY_VALUES[number];
export type GodReviewDisposition = typeof GOD_REVIEW_DISPOSITION_VALUES[number];
export type GodReviewFixEligibility = typeof GOD_REVIEW_FIX_ELIGIBILITY_VALUES[number];
export type GodReviewRemediationStatus =
  typeof GOD_REVIEW_REMEDIATION_STATUS_VALUES[number];
export type GodReviewSelectedBy = typeof GOD_REVIEW_SELECTED_BY_VALUES[number];

export const godReviewScopeKindSchema = z.enum(GOD_REVIEW_SCOPE_KIND_VALUES);
export const godReviewSessionStatusSchema = z.enum(GOD_REVIEW_SESSION_STATUS_VALUES);
export const godReviewGroupStatusSchema = z.enum(GOD_REVIEW_GROUP_STATUS_VALUES);
export const godReviewSeveritySchema = z.enum(GOD_REVIEW_SEVERITY_VALUES);
export const godReviewDispositionSchema = z.enum(GOD_REVIEW_DISPOSITION_VALUES);
export const godReviewFixEligibilitySchema = z.enum(GOD_REVIEW_FIX_ELIGIBILITY_VALUES);
export const godReviewRemediationStatusSchema = z.enum(
  GOD_REVIEW_REMEDIATION_STATUS_VALUES
);
export const godReviewSelectedBySchema = z.enum(GOD_REVIEW_SELECTED_BY_VALUES);

export const godReviewScopeFingerprintSchema = z.object({
  baseSha: z.string().nullable(),
  headSha: z.string().nullable(),
  diffHash: z.string().nullable(),
  fileSetHash: z.string(),
  prNumber: z.number().int().positive().nullable()
});

export const godReviewGroupStateSchema = z.object({
  id: z.enum(GOD_REVIEW_GROUP_ID_VALUES),
  prefix: z.enum(GOD_REVIEW_GROUP_PREFIX_VALUES),
  status: godReviewGroupStatusSchema,
  findingIds: z.array(z.string())
});

export const godReviewSessionSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string().min(1),
    parentRunId: z.string().min(1).nullable(),
    status: godReviewSessionStatusSchema,
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    activeCommand: z.enum(GOD_REVIEW_ACTIVE_COMMANDS),
    scopeKind: godReviewScopeKindSchema,
    phase: z.union([z.string(), z.number()]).optional(),
    sessionPath: z.string().min(1),
    humanStatePath: z.string().min(1),
    reportPath: z.string().min(1),
    files: z.array(z.string()),
    skippedFiles: z.array(z.string()),
    scopeFingerprint: godReviewScopeFingerprintSchema,
    groups: z.array(godReviewGroupStateSchema),
    nextGroupId: z.enum(GOD_REVIEW_GROUP_ID_VALUES).nullable(),
    cleanup: z.object({
      reviewTerminal: z.boolean(),
      godFixTerminal: z.boolean(),
      eligible: z.boolean()
    })
  })
  .superRefine((session, context) => {
    if (session.scopeKind === "phase" && session.phase === undefined) {
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "phase is required when scopeKind is phase."
      });
    }

    if (session.scopeKind !== "phase" && session.phase !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["phase"],
        message: "phase must be omitted unless scopeKind is phase."
      });
    }
  });

export type GodReviewScopeFingerprint = z.infer<typeof godReviewScopeFingerprintSchema>;
export type GodReviewGroupState = z.infer<typeof godReviewGroupStateSchema>;
export type GodReviewSession = z.infer<typeof godReviewSessionSchema>;

export type GodReviewActivationResult =
  | {
      status: "valid";
      activeCommand: GodReviewActiveCommand;
      mode: "review" | "fix";
      hiddenFlag: true;
    }
  | {
      status: "refused";
      refusal: string;
      sideEffectsAllowed: false;
      reason: string;
    };

export type GodReviewRepoPathResult =
  | { valid: true; path: string }
  | { valid: false; path: null; reason: string };

export type GodReviewPhasePaths = {
  sessionPath: string;
  humanStatePath: string;
  reportPath: string;
};

export type GodReviewReportPaths = GodReviewPhasePaths;

export type GodReviewParsedFinding = {
  id: string;
  title: string;
  severity: GodReviewSeverity | null;
  disposition: GodReviewDisposition | null;
  confidence: "high" | "medium" | "low" | null;
  files: string[];
  evidence: string | null;
  impact: string | null;
  recommendation: string | null;
  fixEligibility: GodReviewFixEligibility | null;
};

export type GodReviewParsedRemediation = {
  id: string;
  findingId: string;
  status: GodReviewRemediationStatus | null;
  selectedBy: GodReviewSelectedBy | null;
  filesChanged: string[];
  verification: string | null;
  evidence: string | null;
  followUp: string | null;
};

export type GodReviewParseResult = {
  findings: GodReviewParsedFinding[];
  remediations: GodReviewParsedRemediation[];
  warnings: string[];
};

type GodReviewScopeResolution = {
  scopeKind: GodReviewScopeKind;
  phase: string | number | null;
  paths: GodReviewPhasePaths;
  files: string[];
  skippedFiles: string[];
  fingerprint: GodReviewScopeFingerprint;
  warnings: string[];
};

export type GodReviewStartResult = {
  status: "started" | "reused" | "invalid" | "refused";
  activated: boolean;
  refusal?: string;
  reason: string | null;
  runId: string | null;
  scopeKind: GodReviewScopeKind | null;
  phase: string | number | null;
  sessionPath: string | null;
  humanStatePath: string | null;
  reportPath: string | null;
  files: string[];
  skippedFiles: string[];
  scopeFingerprint: GodReviewScopeFingerprint | null;
  groups: GodReviewGroupState[];
  nextGroupId: GodReviewGroupId | null;
  nextCommand: string | null;
  written: boolean;
  createdPaths: string[];
  warnings: string[];
};

export type GodReviewNextResult = {
  status: "ready" | "complete" | "stale" | "invalid" | "refused";
  activated: boolean;
  refusal?: string;
  reason: string | null;
  runId: string | null;
  sessionPath: string | null;
  humanStatePath: string | null;
  reportPath: string | null;
  scopeKind: GodReviewScopeKind | null;
  phase: string | number | null;
  files: string[];
  scopeFingerprint: GodReviewScopeFingerprint | null;
  currentFingerprint: GodReviewScopeFingerprint | null;
  staleReasons: string[];
  nextGroup: GodReviewGroupState | null;
  nextGroupId: GodReviewGroupId | null;
  nextCommand: string | null;
  written: false;
  warnings: string[];
};

const godReviewStartInputSchema = {
  cwd: z.string().optional(),
  activeCommand: z.enum(GOD_REVIEW_ACTIVE_COMMANDS),
  rawInvocation: z.string(),
  scopeKind: godReviewScopeKindSchema.optional(),
  phase: z.union([z.string(), z.number()]).optional(),
  prNumber: z.number().int().positive().optional(),
  files: z.array(z.string()).optional(),
  runId: z.string().optional()
};
const godReviewStartArgsSchema = z.object(godReviewStartInputSchema);
type GodReviewStartArgs = z.infer<typeof godReviewStartArgsSchema>;

const godReviewNextInputSchema = {
  cwd: z.string().optional(),
  activeCommand: z.enum(GOD_REVIEW_ACTIVE_COMMANDS),
  rawInvocation: z.string(),
  phase: z.union([z.string(), z.number()]).optional(),
  runId: z.string().optional(),
  sessionPath: z.string().optional()
};
const godReviewNextArgsSchema = z.object(godReviewNextInputSchema);
type GodReviewNextArgs = z.infer<typeof godReviewNextArgsSchema>;

function hasGodReviewFlag(rawInvocation: string): boolean {
  return new RegExp(`(^|\\s)${GOD_REVIEW_FLAG}(?=$|\\s)`).test(rawInvocation);
}

function isGodReviewActiveCommand(value: string): value is GodReviewActiveCommand {
  return (GOD_REVIEW_ACTIVE_COMMANDS as readonly string[]).includes(value);
}

export function isGodReviewPrivateToolName(
  toolName: string
): toolName is GodReviewPrivateToolName {
  return (GOD_REVIEW_PRIVATE_TOOL_NAMES as readonly string[]).includes(toolName);
}

export function evaluateGodReviewActivation(args: {
  activeCommand: string;
  rawInvocation: string;
}): GodReviewActivationResult {
  const activeCommand = args.activeCommand.trim();

  if (!isGodReviewActiveCommand(activeCommand)) {
    return {
      status: "refused",
      refusal: GOD_REVIEW_REFUSAL,
      sideEffectsAllowed: false,
      reason: "Active command is not a hidden god-review command."
    };
  }

  if (!hasGodReviewFlag(args.rawInvocation)) {
    return {
      status: "refused",
      refusal: GOD_REVIEW_REFUSAL,
      sideEffectsAllowed: false,
      reason: "Raw invocation does not include the hidden god-review flag."
    };
  }

  return {
    status: "valid",
    activeCommand,
    mode: activeCommand === "/blu-code-review" ? "review" : "fix",
    hiddenFlag: true
  };
}

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, "/");
}

function hasGlobPattern(value: string): boolean {
  return /[*?[\]{}]/.test(value);
}

export function normalizeGodReviewRepoRelativeFilePath(
  rawPath: string
): GodReviewRepoPathResult {
  const requestedPath = normalizePathSeparators(rawPath.trim());

  if (requestedPath.length === 0) {
    return { valid: false, path: null, reason: "Path must not be empty." };
  }

  if (path.isAbsolute(requestedPath)) {
    return {
      valid: false,
      path: null,
      reason: "Absolute filesystem paths are not allowed."
    };
  }

  if (hasGlobPattern(requestedPath)) {
    return { valid: false, path: null, reason: "Globs are not allowed." };
  }

  if (requestedPath.endsWith("/")) {
    return { valid: false, path: null, reason: "Directories are not allowed." };
  }

  const normalizedPath = path.posix.normalize(requestedPath);

  if (
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.startsWith("../")
  ) {
    return {
      valid: false,
      path: null,
      reason: "Paths must stay inside the repository."
    };
  }

  if (normalizedPath === ".blueprint" || normalizedPath.startsWith(".blueprint/")) {
    return {
      valid: false,
      path: null,
      reason: ".blueprint artifacts are not part of god-review source scope."
    };
  }

  return { valid: true, path: normalizedPath };
}

function stableUniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function hashGodReviewFileSet(args: {
  files: string[];
  skippedFiles?: string[];
}): string {
  const payload = JSON.stringify({
    files: stableUniqueSorted(args.files),
    skippedFiles: stableUniqueSorted(args.skippedFiles ?? [])
  });

  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

export function buildGodReviewPhasePaths(args: {
  phaseDir: string;
  phasePrefix: string;
}): GodReviewPhasePaths {
  return {
    sessionPath: `${args.phaseDir}/.god-review-session.json`,
    humanStatePath: `${args.phaseDir}/.god-review-state.md`,
    reportPath: `${args.phaseDir}/${args.phasePrefix}-GOD-REVIEW.md`
  };
}

export function buildGodReviewReportPaths(args: { runId: string }): GodReviewReportPaths {
  return {
    sessionPath: `.blueprint/reports/.god-review-${args.runId}.json`,
    humanStatePath: `.blueprint/reports/${args.runId}.god-review-state.md`,
    reportPath: `.blueprint/reports/god-review-${args.runId}.md`
  };
}

export function buildInitialGodReviewGroups(): GodReviewGroupState[] {
  return GOD_REVIEW_GROUPS.map((group) => ({
    id: group.id,
    prefix: group.prefix,
    status: "pending",
    findingIds: []
  }));
}

function stableHash(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isValidRunId(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && !value.includes("..");
}

function generateGodReviewRunId(args: {
  scopeKind: GodReviewScopeKind;
  files: string[];
}): string {
  const day = new Date().toISOString().slice(0, 10);
  const scopeHash = createHash("sha256")
    .update(JSON.stringify({ scopeKind: args.scopeKind, files: args.files }))
    .digest("hex")
    .slice(0, 8);
  const entropy = randomBytes(3).toString("hex");

  return `god-${day}-${scopeHash}-${entropy}`;
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfPresent(absolutePath: string): Promise<string | null> {
  try {
    return await fs.readFile(absolutePath, "utf8");
  } catch {
    return null;
  }
}

async function runExternalCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    });

    return String(stdout).trim();
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error
        ? String((error as Error & { stderr?: unknown }).stderr ?? "").trim()
        : "";
    const details = stderr.length > 0 ? `: ${stderr}` : "";

    throw new Error(`${command} ${args.join(" ")} failed${details}`);
  }
}

async function currentGitHead(projectRoot: string): Promise<string | null> {
  try {
    const head = await runExternalCommand("git", ["rev-parse", "HEAD"], projectRoot);
    return head.length > 0 ? head : null;
  } catch {
    return null;
  }
}

async function resolveExistingRepoFiles(args: {
  projectRoot: string;
  files: string[];
  sourceLabel: string;
}): Promise<{
  valid: boolean;
  files: string[];
  skippedFiles: string[];
  warnings: string[];
  reason: string | null;
}> {
  const resolvedFiles = new Set<string>();
  const warnings: string[] = [];
  const skippedFiles: string[] = [];

  for (const rawFile of args.files) {
    const normalized = normalizeGodReviewRepoRelativeFilePath(rawFile);

    if (!normalized.valid) {
      skippedFiles.push(rawFile);
      warnings.push(
        `Invalid ${args.sourceLabel} path: ${rawFile} (${normalized.reason})`
      );
      continue;
    }

    let absolutePath: string;

    try {
      absolutePath = resolveRepoRelativePath(args.projectRoot, normalized.path);
    } catch (error) {
      skippedFiles.push(normalized.path);
      warnings.push(
        error instanceof Error
          ? `Invalid ${args.sourceLabel} path: ${normalized.path} (${error.message})`
          : `Invalid ${args.sourceLabel} path: ${normalized.path} (could not be resolved).`
      );
      continue;
    }

    let stats;

    try {
      stats = await fs.stat(absolutePath);
    } catch {
      skippedFiles.push(normalized.path);
      warnings.push(
        `Invalid ${args.sourceLabel} path: ${normalized.path} (file does not exist).`
      );
      continue;
    }

    if (!stats.isFile()) {
      skippedFiles.push(normalized.path);
      warnings.push(
        `Invalid ${args.sourceLabel} path: ${normalized.path} (${stats.isDirectory() ? "directories" : "non-file entries"} are not allowed).`
      );
      continue;
    }

    resolvedFiles.add(normalized.path);
  }

  const files = [...resolvedFiles].sort((left, right) => left.localeCompare(right));
  const valid = skippedFiles.length === 0 && files.length > 0;

  return {
    valid,
    files,
    skippedFiles,
    warnings,
    reason:
      files.length === 0
        ? `No valid repo files were resolved for ${args.sourceLabel}.`
        : skippedFiles.length > 0
          ? `One or more ${args.sourceLabel} paths were invalid.`
          : null
  };
}

async function hashCurrentDiff(projectRoot: string, files: string[]): Promise<string> {
  const [diff, untrackedPayloads] = await Promise.all([
    runExternalCommand("git", ["diff", "--binary", "HEAD", "--"], projectRoot),
    Promise.all(
      files.map(async (file) => {
        const trackedStatus = await runExternalCommand(
          "git",
          ["ls-files", "--error-unmatch", file],
          projectRoot
        ).then(
          () => "tracked",
          () => "untracked"
        );

        if (trackedStatus === "tracked") {
          return null;
        }

        const content = await fs.readFile(
          resolveRepoRelativePath(projectRoot, file),
          "utf8"
        );

        return `untracked:${file}\n${content}`;
      })
    )
  ]);

  return stableHash(`${diff}\n${untrackedPayloads.filter(Boolean).join("\n")}`);
}

function nextGodReviewCommand(args: {
  activeCommand: GodReviewActiveCommand;
  scopeKind: GodReviewScopeKind;
  phase: string | number | null;
  runId: string;
}): string {
  if (args.scopeKind === "phase" && args.phase !== null) {
    return `${args.activeCommand} ${args.phase} ${GOD_REVIEW_FLAG} --continue`;
  }

  return `${args.activeCommand} ${GOD_REVIEW_FLAG} --run-id ${args.runId} --continue`;
}

async function writeGodReviewSessionArtifacts(args: {
  projectRoot: string;
  session: GodReviewSession;
  reportHeader: string;
  humanState: string;
}): Promise<string[]> {
  const createdPaths: string[] = [];

  for (const [relativePath, content] of [
    [args.session.sessionPath, `${JSON.stringify(args.session, null, 2)}\n`],
    [args.session.reportPath, args.reportHeader],
    [args.session.humanStatePath, args.humanState]
  ] as const) {
    const absolutePath = resolveBlueprintPath(args.projectRoot, relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    if (!(await pathExists(absolutePath))) {
      createdPaths.push(relativePath);
    }

    await fs.writeFile(absolutePath, content, "utf8");
  }

  return createdPaths;
}

function startResultFromSession(args: {
  status: "started" | "reused";
  session: GodReviewSession;
  nextCommand: string;
  written: boolean;
  createdPaths: string[];
  warnings: string[];
  reason: string | null;
}): GodReviewStartResult {
  return {
    status: args.status,
    activated: true,
    reason: args.reason,
    runId: args.session.runId,
    scopeKind: args.session.scopeKind,
    phase: args.session.phase ?? null,
    sessionPath: args.session.sessionPath,
    humanStatePath: args.session.humanStatePath,
    reportPath: args.session.reportPath,
    files: args.session.files,
    skippedFiles: args.session.skippedFiles,
    scopeFingerprint: args.session.scopeFingerprint,
    groups: args.session.groups,
    nextGroupId: args.session.nextGroupId,
    nextCommand: args.nextCommand,
    written: args.written,
    createdPaths: args.createdPaths,
    warnings: args.warnings
  };
}

function invalidStartResult(args: {
  activated?: boolean;
  reason: string;
  warnings?: string[];
}): GodReviewStartResult {
  return {
    status: "invalid",
    activated: args.activated ?? true,
    reason: args.reason,
    runId: null,
    scopeKind: null,
    phase: null,
    sessionPath: null,
    humanStatePath: null,
    reportPath: null,
    files: [],
    skippedFiles: [],
    scopeFingerprint: null,
    groups: [],
    nextGroupId: null,
    nextCommand: null,
    written: false,
    createdPaths: [],
    warnings: args.warnings ?? []
  };
}

function invalidNextResult(args: {
  activated?: boolean;
  reason: string;
  warnings?: string[];
}): GodReviewNextResult {
  return {
    status: "invalid",
    activated: args.activated ?? true,
    reason: args.reason,
    runId: null,
    sessionPath: null,
    humanStatePath: null,
    reportPath: null,
    scopeKind: null,
    phase: null,
    files: [],
    scopeFingerprint: null,
    currentFingerprint: null,
    staleReasons: [],
    nextGroup: null,
    nextGroupId: null,
    nextCommand: null,
    written: false,
    warnings: args.warnings ?? []
  };
}

function determineScopeKind(args: GodReviewStartArgs): GodReviewScopeKind {
  if (args.scopeKind) {
    return args.scopeKind;
  }

  if (args.prNumber !== undefined) {
    return "pr";
  }

  if ((args.files ?? []).length > 0) {
    return "explicit-files";
  }

  if (/\s--current-diff(?=$|\s)/.test(args.rawInvocation)) {
    return "current-diff";
  }

  return "phase";
}

function parsePhaseFromInvocation(rawInvocation: string): string | null {
  const tokens = rawInvocation.trim().split(/\s+/).slice(1);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === GOD_REVIEW_FLAG || token === "--continue") {
      continue;
    }

    if (token.startsWith("--")) {
      if (["--run-id", "--pr", "--finding", "--severity"].includes(token)) {
        index += 1;
      }
      continue;
    }

    if (/^\d+(?:\.\d+)?$/.test(token)) {
      return token;
    }
  }

  return null;
}

function parseFlagValue(rawInvocation: string, flag: string): string | null {
  const tokens = rawInvocation.trim().split(/\s+/);

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] === flag) {
      return tokens[index + 1] ?? null;
    }

    if (tokens[index].startsWith(`${flag}=`)) {
      return tokens[index].slice(flag.length + 1);
    }
  }

  return null;
}

function normalizeGodReviewSessionPath(rawPath: string): GodReviewRepoPathResult {
  const requestedPath = normalizePathSeparators(rawPath.trim());

  if (requestedPath.length === 0) {
    return { valid: false, path: null, reason: "Session path must not be empty." };
  }

  if (path.isAbsolute(requestedPath)) {
    return {
      valid: false,
      path: null,
      reason: "Absolute filesystem paths are not allowed."
    };
  }

  if (hasGlobPattern(requestedPath)) {
    return { valid: false, path: null, reason: "Globs are not allowed." };
  }

  const normalizedPath = path.posix.normalize(requestedPath);

  if (!normalizedPath.startsWith(".blueprint/")) {
    return {
      valid: false,
      path: null,
      reason: "God-review sessions must stay inside .blueprint."
    };
  }

  if (!normalizedPath.endsWith(".json")) {
    return {
      valid: false,
      path: null,
      reason: "God-review session path must point to a JSON file."
    };
  }

  return { valid: true, path: normalizedPath };
}

async function resolveGodReviewSessionPath(
  args: GodReviewNextArgs,
  projectRoot: string
): Promise<{ valid: true; path: string } | { valid: false; reason: string }> {
  const explicitSessionPath = args.sessionPath ?? parseFlagValue(args.rawInvocation, "--session");

  if (explicitSessionPath) {
    const normalized = normalizeGodReviewSessionPath(explicitSessionPath);

    return normalized.valid
      ? { valid: true, path: normalized.path }
      : { valid: false, reason: normalized.reason };
  }

  const runId = args.runId ?? parseFlagValue(args.rawInvocation, "--run-id");

  if (runId) {
    if (!isValidRunId(runId)) {
      return {
        valid: false,
        reason: "runId may contain only letters, numbers, dots, underscores, and dashes."
      };
    }

    return {
      valid: true,
      path: buildGodReviewReportPaths({ runId }).sessionPath
    };
  }

  const phase = args.phase ?? parsePhaseFromInvocation(args.rawInvocation);

  if (phase === null || phase === undefined) {
    return {
      valid: false,
      reason:
        "Unable to resolve god-review session path. Provide phase, runId, or sessionPath."
    };
  }

  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase
  });

  if (
    !located.found ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    return {
      valid: false,
      reason: located.reason ?? "Phase could not be resolved for god-review continuation."
    };
  }

  return {
    valid: true,
    path: buildGodReviewPhasePaths({
      phaseDir: located.phaseDir,
      phasePrefix: located.phasePrefix
    }).sessionPath
  };
}

async function loadGodReviewSession(args: {
  projectRoot: string;
  sessionPath: string;
}): Promise<
  | { valid: true; session: GodReviewSession }
  | { valid: false; reason: string; warnings: string[] }
> {
  const absolutePath = resolveBlueprintPath(args.projectRoot, args.sessionPath);
  const raw = await readTextIfPresent(absolutePath);

  if (raw === null) {
    return {
      valid: false,
      reason: `${args.sessionPath} does not exist.`,
      warnings: []
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      valid: false,
      reason: `${args.sessionPath} is not valid JSON.`,
      warnings: []
    };
  }

  const session = godReviewSessionSchema.safeParse(parsed);

  if (!session.success) {
    return {
      valid: false,
      reason: `${args.sessionPath} is not a valid god-review session.`,
      warnings: session.error.issues.map((issue) => issue.message)
    };
  }

  return { valid: true, session: session.data };
}

function compareGodReviewFingerprints(args: {
  saved: GodReviewScopeFingerprint;
  current: GodReviewScopeFingerprint;
}): string[] {
  const staleReasons: string[] = [];

  for (const field of ["baseSha", "headSha", "diffHash", "fileSetHash", "prNumber"] as const) {
    if (args.saved[field] !== args.current[field]) {
      staleReasons.push(
        `${field} changed from ${args.saved[field] ?? "null"} to ${args.current[field] ?? "null"}`
      );
    }
  }

  return staleReasons;
}

async function fingerprintStoredFileSet(args: {
  projectRoot: string;
  session: GodReviewSession;
}): Promise<{
  fingerprint: GodReviewScopeFingerprint;
  staleReasons: string[];
  warnings: string[];
}> {
  const resolvedFiles = await resolveExistingRepoFiles({
    projectRoot: args.projectRoot,
    files: args.session.files,
    sourceLabel: "saved god-review session"
  });
  const headSha = await currentGitHead(args.projectRoot);
  const fingerprint = {
    ...args.session.scopeFingerprint,
    baseSha: headSha,
    headSha,
    diffHash: args.session.scopeFingerprint.diffHash,
    fileSetHash: hashGodReviewFileSet({
      files: args.session.files,
      skippedFiles: args.session.skippedFiles
    })
  };
  const staleReasons = compareGodReviewFingerprints({
    saved: args.session.scopeFingerprint,
    current: fingerprint
  });

  if (!resolvedFiles.valid) {
    staleReasons.push(
      resolvedFiles.reason ?? "Saved god-review session files are no longer valid."
    );
  }

  return {
    fingerprint,
    staleReasons,
    warnings: resolvedFiles.warnings
  };
}

async function fingerprintCurrentDiffForSession(args: {
  projectRoot: string;
  session: GodReviewSession;
}): Promise<{
  fingerprint: GodReviewScopeFingerprint;
  staleReasons: string[];
  warnings: string[];
}> {
  const [changed, untracked] = await Promise.all([
    runExternalCommand("git", ["diff", "--name-only", "HEAD", "--"], args.projectRoot),
    runExternalCommand(
      "git",
      ["ls-files", "--others", "--exclude-standard"],
      args.projectRoot
    )
  ]);
  const currentFiles = [...changed.split("\n"), ...untracked.split("\n")]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const resolvedFiles = await resolveExistingRepoFiles({
    projectRoot: args.projectRoot,
    files: currentFiles,
    sourceLabel: "current-diff god-review scope"
  });
  const headSha = await currentGitHead(args.projectRoot);
  const fingerprint = {
    baseSha: headSha,
    headSha,
    diffHash:
      resolvedFiles.files.length > 0
        ? await hashCurrentDiff(args.projectRoot, resolvedFiles.files)
        : stableHash(""),
    fileSetHash: hashGodReviewFileSet({
      files: resolvedFiles.files,
      skippedFiles: resolvedFiles.skippedFiles
    }),
    prNumber: null
  };

  return {
    fingerprint,
    staleReasons: compareGodReviewFingerprints({
      saved: args.session.scopeFingerprint,
      current: fingerprint
    }),
    warnings: resolvedFiles.warnings
  };
}

async function fingerprintPrForSession(args: {
  projectRoot: string;
  session: GodReviewSession;
}): Promise<{
  fingerprint: GodReviewScopeFingerprint;
  staleReasons: string[];
  warnings: string[];
}> {
  const prNumber = args.session.scopeFingerprint.prNumber;

  if (prNumber === null) {
    return {
      fingerprint: args.session.scopeFingerprint,
      staleReasons: ["Saved PR god-review session is missing prNumber."],
      warnings: []
    };
  }

  const pr = String(prNumber);
  const [nameOnly, diff, viewJson] = await Promise.all([
    runExternalCommand("gh", ["pr", "diff", pr, "--name-only"], args.projectRoot),
    runExternalCommand("gh", ["pr", "diff", pr], args.projectRoot),
    runExternalCommand(
      "gh",
      ["pr", "view", pr, "--json", "baseRefOid,headRefOid"],
      args.projectRoot
    )
  ]);
  const files = nameOnly
    .split("\n")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const resolvedFiles = await resolveExistingRepoFiles({
    projectRoot: args.projectRoot,
    files,
    sourceLabel: "PR god-review scope"
  });
  let prView: { baseRefOid?: unknown; headRefOid?: unknown };

  try {
    prView = JSON.parse(viewJson) as { baseRefOid?: unknown; headRefOid?: unknown };
  } catch {
    return {
      fingerprint: args.session.scopeFingerprint,
      staleReasons: ["gh pr view did not return valid JSON for PR god-review scope."],
      warnings: []
    };
  }

  const fingerprint = {
    baseSha:
      typeof prView.baseRefOid === "string" && prView.baseRefOid.length > 0
        ? prView.baseRefOid
        : null,
    headSha:
      typeof prView.headRefOid === "string" && prView.headRefOid.length > 0
        ? prView.headRefOid
        : null,
    diffHash: stableHash(diff),
    fileSetHash: hashGodReviewFileSet({
      files: resolvedFiles.files,
      skippedFiles: resolvedFiles.skippedFiles
    }),
    prNumber
  };

  return {
    fingerprint,
    staleReasons: compareGodReviewFingerprints({
      saved: args.session.scopeFingerprint,
      current: fingerprint
    }),
    warnings: resolvedFiles.warnings
  };
}

async function computeCurrentFingerprintForSession(args: {
  projectRoot: string;
  session: GodReviewSession;
}): Promise<{
  fingerprint: GodReviewScopeFingerprint;
  staleReasons: string[];
  warnings: string[];
}> {
  switch (args.session.scopeKind) {
    case "phase":
    case "explicit-files":
      return fingerprintStoredFileSet(args);
    case "current-diff":
      return fingerprintCurrentDiffForSession(args);
    case "pr":
      return fingerprintPrForSession(args);
  }
}

function nextPendingGodReviewGroup(
  session: GodReviewSession
): GodReviewGroupState | null {
  if (session.nextGroupId !== null) {
    return session.groups.find((group) => group.id === session.nextGroupId) ?? null;
  }

  return (
    session.groups.find(
      (group) => group.status === "pending" || group.status === "in-progress"
    ) ?? null
  );
}

async function resolvePhaseScope(args: {
  projectRoot: string;
  phase: string | number | undefined;
  rawInvocation: string;
}): Promise<GodReviewScopeResolution | GodReviewStartResult> {
  const phase = args.phase ?? parsePhaseFromInvocation(args.rawInvocation) ?? undefined;
  const scoped = await blueprintReviewScope({
    cwd: args.projectRoot,
    phase
  });

  if (scoped.status !== "ready" || !scoped.phase) {
    return invalidStartResult({
      reason: scoped.reason ?? "Phase scope could not be resolved.",
      warnings: scoped.warnings
    });
  }

  const resolvedFiles = await resolveExistingRepoFiles({
    projectRoot: args.projectRoot,
    files: scoped.files,
    sourceLabel: "phase god-review scope"
  });

  if (!resolvedFiles.valid) {
    return invalidStartResult({
      reason: resolvedFiles.reason ?? "Phase scope contained invalid files.",
      warnings: [...scoped.warnings, ...resolvedFiles.warnings]
    });
  }

  const headSha = await currentGitHead(args.projectRoot);
  const paths = buildGodReviewPhasePaths({
    phaseDir: scoped.phase.phaseDir,
    phasePrefix: scoped.phase.phasePrefix
  });

  return {
    scopeKind: "phase",
    phase: scoped.phase.phaseNumber,
    paths,
    files: resolvedFiles.files,
    skippedFiles: [],
    fingerprint: {
      baseSha: headSha,
      headSha,
      diffHash: null,
      fileSetHash: hashGodReviewFileSet({ files: resolvedFiles.files }),
      prNumber: null
    },
    warnings: [...scoped.warnings, ...resolvedFiles.warnings]
  };
}

async function resolveExplicitFilesScope(args: {
  projectRoot: string;
  files: string[] | undefined;
  runId: string | undefined;
}): Promise<GodReviewScopeResolution | GodReviewStartResult> {
  const resolvedFiles = await resolveExistingRepoFiles({
    projectRoot: args.projectRoot,
    files: args.files ?? [],
    sourceLabel: "explicit god-review scope"
  });

  if (!resolvedFiles.valid) {
    return invalidStartResult({
      reason: resolvedFiles.reason ?? "Explicit file scope contained invalid files.",
      warnings: resolvedFiles.warnings
    });
  }

  if (args.runId !== undefined && !isValidRunId(args.runId)) {
    return invalidStartResult({
      reason: "runId may contain only letters, numbers, dots, underscores, and dashes."
    });
  }

  const runId =
    args.runId ??
    generateGodReviewRunId({
      scopeKind: "explicit-files",
      files: resolvedFiles.files
    });
  const headSha = await currentGitHead(args.projectRoot);

  return {
    scopeKind: "explicit-files",
    phase: null,
    paths: buildGodReviewReportPaths({ runId }),
    files: resolvedFiles.files,
    skippedFiles: [],
    fingerprint: {
      baseSha: headSha,
      headSha,
      diffHash: null,
      fileSetHash: hashGodReviewFileSet({ files: resolvedFiles.files }),
      prNumber: null
    },
    warnings: resolvedFiles.warnings
  };
}

async function resolveCurrentDiffScope(args: {
  projectRoot: string;
  runId: string | undefined;
}): Promise<GodReviewScopeResolution | GodReviewStartResult> {
  if (args.runId !== undefined && !isValidRunId(args.runId)) {
    return invalidStartResult({
      reason: "runId may contain only letters, numbers, dots, underscores, and dashes."
    });
  }

  const [changed, untracked] = await Promise.all([
    runExternalCommand("git", ["diff", "--name-only", "HEAD", "--"], args.projectRoot),
    runExternalCommand(
      "git",
      ["ls-files", "--others", "--exclude-standard"],
      args.projectRoot
    )
  ]);
  const changedFiles = [...changed.split("\n"), ...untracked.split("\n")]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const resolvedFiles = await resolveExistingRepoFiles({
    projectRoot: args.projectRoot,
    files: changedFiles,
    sourceLabel: "current-diff god-review scope"
  });

  if (!resolvedFiles.valid) {
    return invalidStartResult({
      reason: resolvedFiles.reason ?? "Current diff scope contained invalid files.",
      warnings: resolvedFiles.warnings
    });
  }

  const runId =
    args.runId ??
    generateGodReviewRunId({
      scopeKind: "current-diff",
      files: resolvedFiles.files
    });
  const headSha = await currentGitHead(args.projectRoot);

  return {
    scopeKind: "current-diff",
    phase: null,
    paths: buildGodReviewReportPaths({ runId }),
    files: resolvedFiles.files,
    skippedFiles: [],
    fingerprint: {
      baseSha: headSha,
      headSha,
      diffHash: await hashCurrentDiff(args.projectRoot, resolvedFiles.files),
      fileSetHash: hashGodReviewFileSet({ files: resolvedFiles.files }),
      prNumber: null
    },
    warnings: resolvedFiles.warnings
  };
}

async function resolvePrScope(args: {
  projectRoot: string;
  prNumber: number | undefined;
  runId: string | undefined;
}): Promise<GodReviewScopeResolution | GodReviewStartResult> {
  if (args.prNumber === undefined) {
    return invalidStartResult({ reason: "prNumber is required for PR god-review scope." });
  }

  if (args.runId !== undefined && !isValidRunId(args.runId)) {
    return invalidStartResult({
      reason: "runId may contain only letters, numbers, dots, underscores, and dashes."
    });
  }

  const pr = String(args.prNumber);
  const [nameOnly, diff, viewJson] = await Promise.all([
    runExternalCommand("gh", ["pr", "diff", pr, "--name-only"], args.projectRoot),
    runExternalCommand("gh", ["pr", "diff", pr], args.projectRoot),
    runExternalCommand(
      "gh",
      ["pr", "view", pr, "--json", "baseRefOid,headRefOid"],
      args.projectRoot
    )
  ]);
  const files = nameOnly
    .split("\n")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const resolvedFiles = await resolveExistingRepoFiles({
    projectRoot: args.projectRoot,
    files,
    sourceLabel: "PR god-review scope"
  });

  if (!resolvedFiles.valid) {
    return invalidStartResult({
      reason: resolvedFiles.reason ?? "PR scope contained invalid files.",
      warnings: resolvedFiles.warnings
    });
  }

  let prView: { baseRefOid?: unknown; headRefOid?: unknown };

  try {
    prView = JSON.parse(viewJson) as { baseRefOid?: unknown; headRefOid?: unknown };
  } catch {
    return invalidStartResult({
      reason: "gh pr view did not return valid JSON for PR god-review scope."
    });
  }

  const runId =
    args.runId ??
    generateGodReviewRunId({
      scopeKind: "pr",
      files: resolvedFiles.files
    });

  return {
    scopeKind: "pr",
    phase: null,
    paths: buildGodReviewReportPaths({ runId }),
    files: resolvedFiles.files,
    skippedFiles: [],
    fingerprint: {
      baseSha:
        typeof prView.baseRefOid === "string" && prView.baseRefOid.length > 0
          ? prView.baseRefOid
          : null,
      headSha:
        typeof prView.headRefOid === "string" && prView.headRefOid.length > 0
          ? prView.headRefOid
          : null,
      diffHash: stableHash(diff),
      fileSetHash: hashGodReviewFileSet({ files: resolvedFiles.files }),
      prNumber: args.prNumber
    },
    warnings: resolvedFiles.warnings
  };
}

async function resolveGodReviewScope(
  args: GodReviewStartArgs,
  projectRoot: string
): Promise<GodReviewScopeResolution | GodReviewStartResult> {
  const scopeKind = determineScopeKind(args);

  switch (scopeKind) {
    case "phase":
      return resolvePhaseScope({
        projectRoot,
        phase: args.phase,
        rawInvocation: args.rawInvocation
      });
    case "explicit-files":
      return resolveExplicitFilesScope({
        projectRoot,
        files: args.files,
        runId: args.runId
      });
    case "current-diff":
      return resolveCurrentDiffScope({
        projectRoot,
        runId: args.runId
      });
    case "pr":
      return resolvePrScope({
        projectRoot,
        prNumber: args.prNumber,
        runId: args.runId
      });
  }
}

export function renderGodReviewReportHeader(args: {
  runId: string;
  status: GodReviewSessionStatus;
  scopeKind: GodReviewScopeKind;
  sessionPath: string;
  scopeFingerprintSummary: string;
}): string {
  return [
    `# God Review: ${args.runId}`,
    "",
    `Status: ${args.status}`,
    `Scope Kind: ${args.scopeKind}`,
    `Session: \`${args.sessionPath}\``,
    `Scope Fingerprint: \`${args.scopeFingerprintSummary}\``,
    ""
  ].join("\n");
}

export function renderGodReviewHumanState(args: {
  runId: string;
  scopeKind: GodReviewScopeKind;
  fileCount: number;
  currentGroupId: GodReviewGroupId | null;
  nextGroupId: GodReviewGroupId | null;
  reviewTerminal: boolean;
  godFixTerminal: boolean;
  stale: boolean;
  nextCommand: string;
}): string {
  return [
    `# God Review State: ${args.runId}`,
    "",
    `- Scope kind: ${args.scopeKind}`,
    `- File count: ${args.fileCount}`,
    `- Current group: ${args.currentGroupId ?? "none"}`,
    `- Next group: ${args.nextGroupId ?? "none"}`,
    `- Review terminal: ${args.reviewTerminal ? "yes" : "no"}`,
    `- Hidden fix terminal: ${args.godFixTerminal ? "yes" : "no"}`,
    `- Stale scope: ${args.stale ? "yes" : "no"}`,
    `- Next hidden command: ${args.nextCommand}`,
    ""
  ].join("\n");
}

export async function blueprintGodReviewStart(
  rawArgs: GodReviewStartArgs
): Promise<GodReviewStartResult> {
  const parsed = godReviewStartArgsSchema.safeParse(rawArgs);

  if (!parsed.success) {
    return invalidStartResult({
      activated: false,
      reason: "Invalid blueprint_god_review_start arguments.",
      warnings: parsed.error.issues.map((issue) => issue.message)
    });
  }

  const args = parsed.data;
  const activation = evaluateGodReviewActivation({
    activeCommand: args.activeCommand,
    rawInvocation: args.rawInvocation
  });

  if (activation.status === "refused") {
    return {
      status: "refused",
      activated: false,
      refusal: activation.refusal,
      reason: activation.reason,
      runId: null,
      scopeKind: null,
      phase: null,
      sessionPath: null,
      humanStatePath: null,
      reportPath: null,
      files: [],
      skippedFiles: [],
      scopeFingerprint: null,
      groups: [],
      nextGroupId: null,
      nextCommand: null,
      written: false,
      createdPaths: [],
      warnings: []
    };
  }

  const projectRoot = await ensureRepoRoot(args.cwd);
  const resolvedScope = await resolveGodReviewScope(args, projectRoot);

  if ("status" in resolvedScope) {
    return resolvedScope;
  }

  const sessionPath = resolveBlueprintPath(projectRoot, resolvedScope.paths.sessionPath);
  const existingSessionRaw = await readTextIfPresent(sessionPath);

  if (existingSessionRaw !== null) {
    let existingSessionJson: unknown;

    try {
      existingSessionJson = JSON.parse(existingSessionRaw);
    } catch {
      return invalidStartResult({
        reason: `${resolvedScope.paths.sessionPath} is not valid JSON.`
      });
    }

    const existingSession = godReviewSessionSchema.safeParse(existingSessionJson);

    if (!existingSession.success) {
      return invalidStartResult({
        reason: `${resolvedScope.paths.sessionPath} is not a valid god-review session.`,
        warnings: existingSession.error.issues.map((issue) => issue.message)
      });
    }

    return startResultFromSession({
      status: "reused",
      session: existingSession.data,
      nextCommand: nextGodReviewCommand({
        activeCommand: existingSession.data.activeCommand,
        scopeKind: existingSession.data.scopeKind,
        phase: existingSession.data.phase ?? null,
        runId: existingSession.data.runId
      }),
      written: false,
      createdPaths: [],
      warnings: resolvedScope.warnings,
      reason: "Existing god-review session reused."
    });
  }

  const now = new Date().toISOString();
  const runId =
    resolvedScope.scopeKind === "phase"
      ? `god-${String(resolvedScope.phase)}`
      : path
          .basename(resolvedScope.paths.sessionPath)
          .replace(/^\.god-review-/, "")
          .replace(/\.json$/, "");
  const groups = buildInitialGodReviewGroups();
  const nextGroupId = groups[0]?.id ?? null;
  const session: GodReviewSession = {
    schemaVersion: 1,
    runId,
    parentRunId: null,
    status: "in-progress",
    createdAt: now,
    updatedAt: now,
    activeCommand: activation.activeCommand,
    scopeKind: resolvedScope.scopeKind,
    ...(resolvedScope.scopeKind === "phase" ? { phase: resolvedScope.phase ?? undefined } : {}),
    sessionPath: resolvedScope.paths.sessionPath,
    humanStatePath: resolvedScope.paths.humanStatePath,
    reportPath: resolvedScope.paths.reportPath,
    files: resolvedScope.files,
    skippedFiles: resolvedScope.skippedFiles,
    scopeFingerprint: resolvedScope.fingerprint,
    groups,
    nextGroupId,
    cleanup: {
      reviewTerminal: false,
      godFixTerminal: false,
      eligible: false
    }
  };
  const nextCommand = nextGodReviewCommand({
    activeCommand: activation.activeCommand,
    scopeKind: session.scopeKind,
    phase: session.phase ?? null,
    runId: session.runId
  });
  const reportHeader = renderGodReviewReportHeader({
    runId: session.runId,
    status: session.status,
    scopeKind: session.scopeKind,
    sessionPath: session.sessionPath,
    scopeFingerprintSummary: session.scopeFingerprint.fileSetHash
  });
  const humanState = renderGodReviewHumanState({
    runId: session.runId,
    scopeKind: session.scopeKind,
    fileCount: session.files.length,
    currentGroupId: null,
    nextGroupId,
    reviewTerminal: false,
    godFixTerminal: false,
    stale: false,
    nextCommand
  });
  const createdPaths = await writeGodReviewSessionArtifacts({
    projectRoot,
    session,
    reportHeader,
    humanState
  });

  return startResultFromSession({
    status: "started",
    session,
    nextCommand,
    written: true,
    createdPaths,
    warnings: resolvedScope.warnings,
    reason: null
  });
}

export async function blueprintGodReviewNext(
  rawArgs: GodReviewNextArgs
): Promise<GodReviewNextResult> {
  const parsed = godReviewNextArgsSchema.safeParse(rawArgs);

  if (!parsed.success) {
    return invalidNextResult({
      activated: false,
      reason: "Invalid blueprint_god_review_next arguments.",
      warnings: parsed.error.issues.map((issue) => issue.message)
    });
  }

  const args = parsed.data;
  const activation = evaluateGodReviewActivation({
    activeCommand: args.activeCommand,
    rawInvocation: args.rawInvocation
  });

  if (activation.status === "refused") {
    return {
      status: "refused",
      activated: false,
      refusal: activation.refusal,
      reason: activation.reason,
      runId: null,
      sessionPath: null,
      humanStatePath: null,
      reportPath: null,
      scopeKind: null,
      phase: null,
      files: [],
      scopeFingerprint: null,
      currentFingerprint: null,
      staleReasons: [],
      nextGroup: null,
      nextGroupId: null,
      nextCommand: null,
      written: false,
      warnings: []
    };
  }

  const projectRoot = await ensureRepoRoot(args.cwd);
  const sessionPath = await resolveGodReviewSessionPath(args, projectRoot);

  if (!sessionPath.valid) {
    return invalidNextResult({
      reason: sessionPath.reason
    });
  }

  const loaded = await loadGodReviewSession({
    projectRoot,
    sessionPath: sessionPath.path
  });

  if (!loaded.valid) {
    return invalidNextResult({
      reason: loaded.reason,
      warnings: loaded.warnings
    });
  }

  const session = loaded.session;
  const fingerprint = await computeCurrentFingerprintForSession({
    projectRoot,
    session
  });
  const nextCommand = nextGodReviewCommand({
    activeCommand: session.activeCommand,
    scopeKind: session.scopeKind,
    phase: session.phase ?? null,
    runId: session.runId
  });

  if (fingerprint.staleReasons.length > 0) {
    return {
      status: "stale",
      activated: true,
      reason:
        "God-review scope fingerprint changed. Start a new hidden review run instead of continuing this session.",
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      scopeKind: session.scopeKind,
      phase: session.phase ?? null,
      files: session.files,
      scopeFingerprint: session.scopeFingerprint,
      currentFingerprint: fingerprint.fingerprint,
      staleReasons: fingerprint.staleReasons,
      nextGroup: null,
      nextGroupId: session.nextGroupId,
      nextCommand,
      written: false,
      warnings: fingerprint.warnings
    };
  }

  const nextGroup = nextPendingGodReviewGroup(session);

  return {
    status: nextGroup === null ? "complete" : "ready",
    activated: true,
    reason: nextGroup === null ? "No pending god-review groups remain." : null,
    runId: session.runId,
    sessionPath: session.sessionPath,
    humanStatePath: session.humanStatePath,
    reportPath: session.reportPath,
    scopeKind: session.scopeKind,
    phase: session.phase ?? null,
    files: session.files,
    scopeFingerprint: session.scopeFingerprint,
    currentFingerprint: fingerprint.fingerprint,
    staleReasons: [],
    nextGroup,
    nextGroupId: nextGroup?.id ?? null,
    nextCommand,
    written: false,
    warnings: fingerprint.warnings
  };
}

function parseBulletValue(lines: string[], label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^- ${escapedLabel}:\\s*(.+)$`, "i");
  const match = lines.map((line) => line.trim()).find((line) => pattern.test(line));

  return match?.match(pattern)?.[1]?.trim() ?? null;
}

function parseBacktickedList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
}

function normalizeEnumValue<T extends readonly string[]>(
  rawValue: string | null,
  values: T
): T[number] | null {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase();

  return values.includes(normalized) ? normalized : null;
}

export function parseGodReviewReportShell(content: string): GodReviewParseResult {
  const findings: GodReviewParsedFinding[] = [];
  const remediations: GodReviewParsedRemediation[] = [];
  const warnings: string[] = [];
  const lines = content.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const findingMatch = lines[index].match(/^#### (GOD-[A-Z]{3}-\d{3}):\s*(.+)$/);

    if (findingMatch) {
      const bodyLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^#### |^## |^### /.test(lines[index])) {
        bodyLines.push(lines[index]);
        index += 1;
      }

      index -= 1;

      const severityRaw = parseBulletValue(bodyLines, "Severity");
      const dispositionRaw = parseBulletValue(bodyLines, "Disposition");
      const fixEligibilityRaw = parseBulletValue(bodyLines, "Fix Eligibility");
      const severity = normalizeEnumValue(severityRaw, GOD_REVIEW_SEVERITY_VALUES);
      const disposition = normalizeEnumValue(dispositionRaw, GOD_REVIEW_DISPOSITION_VALUES);
      const fixEligibility = normalizeEnumValue(
        fixEligibilityRaw,
        GOD_REVIEW_FIX_ELIGIBILITY_VALUES
      );

      if (severityRaw && severity === null) {
        warnings.push(`${findingMatch[1]} has unsupported severity: ${severityRaw}`);
      }

      if (dispositionRaw && disposition === null) {
        warnings.push(`${findingMatch[1]} has unsupported disposition: ${dispositionRaw}`);
      }

      findings.push({
        id: findingMatch[1],
        title: findingMatch[2].trim(),
        severity,
        disposition,
        confidence: normalizeEnumValue(parseBulletValue(bodyLines, "Confidence"), [
          "high",
          "medium",
          "low"
        ] as const),
        files: parseBacktickedList(parseBulletValue(bodyLines, "Files")),
        evidence: parseBulletValue(bodyLines, "Evidence"),
        impact: parseBulletValue(bodyLines, "Impact"),
        recommendation: parseBulletValue(bodyLines, "Recommendation"),
        fixEligibility
      });

      continue;
    }

    const remediationMatch = lines[index].match(
      /^### (GOD-FIX-\d{3}):\s*(GOD-[A-Z]{3}-\d{3})$/
    );

    if (remediationMatch) {
      const bodyLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^### |^## /.test(lines[index])) {
        bodyLines.push(lines[index]);
        index += 1;
      }

      index -= 1;

      remediations.push({
        id: remediationMatch[1],
        findingId: remediationMatch[2],
        status: normalizeEnumValue(
          parseBulletValue(bodyLines, "Status"),
          GOD_REVIEW_REMEDIATION_STATUS_VALUES
        ),
        selectedBy: normalizeEnumValue(
          parseBulletValue(bodyLines, "Selected By"),
          GOD_REVIEW_SELECTED_BY_VALUES
        ),
        filesChanged: parseBacktickedList(parseBulletValue(bodyLines, "Files Changed")),
        verification: parseBulletValue(bodyLines, "Verification"),
        evidence: parseBulletValue(bodyLines, "Evidence"),
        followUp: parseBulletValue(bodyLines, "Follow-Up")
      });
    }
  }

  return {
    findings,
    remediations,
    warnings
  };
}

export const godReviewToolDefinitions: ToolDefinition[] = [
  {
    name: "blueprint_god_review_start",
    description:
      "Private hidden god-review start tool: validates hidden activation, freezes phase/PR/current-diff/explicit-file scope, and writes session/report/state metadata outside the normal review lifecycle.",
    inputSchema: godReviewStartInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintGodReviewStart(args as GodReviewStartArgs)
  },
  {
    name: "blueprint_god_review_next",
    description:
      "Private hidden god-review continuation tool: loads a saved session, checks the frozen scope fingerprint for staleness, and returns the next pending review group without rediscovering or rewriting scope.",
    inputSchema: godReviewNextInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintGodReviewNext(args as GodReviewNextArgs)
  }
];
