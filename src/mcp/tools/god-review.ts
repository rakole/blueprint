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
 * These helpers are intentionally registered on the shared MCP substrate even
 * though they remain private to the hidden command branch. They exist so that
 * branch can share deterministic path safety, session shapes, report rendering
 * shells, and finding parsing without overloading the normal
 * `review.code-review` / `XX-REVIEW.md` flow.
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
const GOD_REVIEW_FIX_SELECTION_STATUS_VALUES = [
  "ready",
  "empty",
  "stale",
  "invalid"
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
export type GodReviewFixSelectionStatus =
  typeof GOD_REVIEW_FIX_SELECTION_STATUS_VALUES[number];

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

    for (const issue of validateGodReviewSessionPaths(session)) {
      context.addIssue({
        code: "custom",
        path: [issue.field],
        message: issue.message
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
  remediationAttempts?: GodReviewParsedRemediation[];
  remediated?: boolean;
  stale?: boolean;
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

export type GodReviewFixTarget = {
  id: string;
  title: string;
  severity: GodReviewSeverity | null;
  disposition: GodReviewDisposition | null;
  fixEligibility: GodReviewFixEligibility | null;
  files: string[];
  selectedBy: GodReviewSelectedBy;
  requiresConfirmationForCodeEdit: boolean;
};

export type GodReviewFixSelection = {
  status: GodReviewFixSelectionStatus;
  selectedBy: GodReviewSelectedBy;
  reason: string | null;
  targets: GodReviewFixTarget[];
  excluded: Array<{ id: string; reason: string }>;
  staleReasons: string[];
  fingerprintFresh: boolean;
  evidenceFresh: boolean;
  currentFingerprint: GodReviewScopeFingerprint | null;
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

export type GodReviewAppendedFinding = {
  id: string;
  title: string;
  severity: GodReviewSeverity;
  disposition: GodReviewDisposition;
  confidence: "high" | "medium" | "low" | null;
  files: string[];
  evidence: string | null;
  impact: string | null;
  recommendation: string | null;
  fixEligibility: GodReviewFixEligibility;
};

export type GodReviewAppendResult = {
  status: "appended" | "stale" | "invalid" | "refused";
  activated: boolean;
  refusal?: string;
  reason: string | null;
  runId: string | null;
  sessionPath: string | null;
  humanStatePath: string | null;
  reportPath: string | null;
  groupId: GodReviewGroupId | null;
  groupStatus: GodReviewGroupStatus | null;
  findingIds: string[];
  findings: GodReviewAppendedFinding[];
  nextGroupId: GodReviewGroupId | null;
  nextCommand: string | null;
  written: boolean;
  staleReasons: string[];
  warnings: string[];
};

export type GodReviewLoadFindingsResult = {
  status: "found" | "not_found" | "invalid" | "refused";
  activated: boolean;
  refusal?: string;
  reason: string | null;
  reportPath: string | null;
  sessionPath: string | null;
  findings: GodReviewParsedFinding[];
  remediations: GodReviewParsedRemediation[];
  selection: GodReviewFixSelection | null;
  warnings: string[];
};

export type GodReviewRecordFixResult = {
  status: "recorded" | "stale" | "invalid" | "refused";
  activated: boolean;
  refusal?: string;
  reason: string | null;
  runId: string | null;
  sessionPath: string | null;
  humanStatePath: string | null;
  reportPath: string | null;
  remediationId: string | null;
  findingId: string | null;
  selectedBy: GodReviewSelectedBy | null;
  remediationStatus: GodReviewRemediationStatus | null;
  filesChanged: string[];
  terminal: boolean;
  cleanupEligible: boolean;
  written: boolean;
  staleReasons: string[];
  warnings: string[];
};

export type GodReviewCleanupResult = {
  status: "cleaned" | "blocked" | "invalid" | "refused";
  activated: boolean;
  refusal?: string;
  reason: string | null;
  runId: string | null;
  sessionPath: string | null;
  humanStatePath: string | null;
  reportPath: string | null;
  deletedPaths: string[];
  preservedPaths: string[];
  cleanupEligible: boolean;
  reviewTerminal: boolean;
  godFixTerminal: boolean;
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

const godReviewAppendFindingInputSchema = z.object({
  title: z.string().min(1),
  severity: z.string().min(1),
  disposition: z.string().min(1),
  confidence: z.string().optional(),
  files: z.array(z.string()).optional(),
  evidence: z.string().optional(),
  impact: z.string().optional(),
  recommendation: z.string().optional(),
  fixEligibility: z.string().optional()
});
const godReviewAppendInputSchema = {
  cwd: z.string().optional(),
  activeCommand: z.enum(GOD_REVIEW_ACTIVE_COMMANDS),
  rawInvocation: z.string(),
  phase: z.union([z.string(), z.number()]).optional(),
  runId: z.string().optional(),
  sessionPath: z.string().optional(),
  groupId: z.enum(GOD_REVIEW_GROUP_ID_VALUES),
  status: z.enum(["completed", "blocked"]),
  findings: z.array(godReviewAppendFindingInputSchema).optional(),
  groups: z.array(z.unknown()).optional()
};
const godReviewAppendArgsSchema = z.object(godReviewAppendInputSchema);
type GodReviewAppendArgs = z.infer<typeof godReviewAppendArgsSchema>;

const godReviewLoadFindingsInputSchema = {
  cwd: z.string().optional(),
  activeCommand: z.enum(GOD_REVIEW_ACTIVE_COMMANDS),
  rawInvocation: z.string(),
  phase: z.union([z.string(), z.number()]).optional(),
  runId: z.string().optional(),
  sessionPath: z.string().optional(),
  reportPath: z.string().optional(),
  findingIds: z.array(z.string()).optional(),
  severity: z.string().optional(),
  all: z.boolean().optional()
};
const godReviewLoadFindingsArgsSchema = z.object(godReviewLoadFindingsInputSchema);
type GodReviewLoadFindingsArgs = z.infer<typeof godReviewLoadFindingsArgsSchema>;

const godReviewRecordFixInputSchema = {
  cwd: z.string().optional(),
  activeCommand: z.literal("/blu-code-review-fix"),
  rawInvocation: z.string(),
  phase: z.union([z.string(), z.number()]).optional(),
  runId: z.string().optional(),
  sessionPath: z.string().optional(),
  reportPath: z.string().optional(),
  findingId: z.string().min(1),
  status: godReviewRemediationStatusSchema,
  selectedBy: godReviewSelectedBySchema,
  filesChanged: z.array(z.string()).optional(),
  verification: z.string().optional(),
  evidence: z.string().optional(),
  followUp: z.string().optional(),
  terminal: z.boolean().optional()
};
const godReviewRecordFixArgsSchema = z.object(godReviewRecordFixInputSchema);
type GodReviewRecordFixArgs = z.infer<typeof godReviewRecordFixArgsSchema>;

const godReviewCleanupInputSchema = {
  cwd: z.string().optional(),
  activeCommand: z.literal("/blu-code-review-fix"),
  rawInvocation: z.string(),
  phase: z.union([z.string(), z.number()]).optional(),
  runId: z.string().optional(),
  sessionPath: z.string().optional(),
  noEligibleFindingsTerminal: z.boolean().optional()
};
const godReviewCleanupArgsSchema = z.object(godReviewCleanupInputSchema);
type GodReviewCleanupArgs = z.infer<typeof godReviewCleanupArgsSchema>;

function hasGodReviewFlag(rawInvocation: string): boolean {
  return new RegExp(`(^|\\s)${GOD_REVIEW_FLAG}(?=$|\\s)`).test(rawInvocation);
}

function rawInvocationCommand(rawInvocation: string): string {
  return rawInvocation.trim().split(/\s+/)[0] ?? "";
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

  if (rawInvocationCommand(args.rawInvocation) !== activeCommand) {
    return {
      status: "refused",
      refusal: GOD_REVIEW_REFUSAL,
      sideEffectsAllowed: false,
      reason: "Raw invocation command does not match the active hidden god-review command."
    };
  }

  if (!hasGodReviewFlag(args.rawInvocation)) {
    return {
      status: "refused",
      refusal: GOD_REVIEW_REFUSAL,
      sideEffectsAllowed: false,
      reason: "Raw invocation does not contain the standalone hidden god-review flag token."
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
  contentHashes?: Array<{ path: string; hash: string }>;
}): string {
  const payload = JSON.stringify({
    files: stableUniqueSorted(args.files),
    skippedFiles: stableUniqueSorted(args.skippedFiles ?? []),
    contentHashes: [...(args.contentHashes ?? [])].sort((left, right) =>
      left.path.localeCompare(right.path)
    )
  });

  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

async function hashGodReviewResolvedFileSet(args: {
  projectRoot: string;
  files: string[];
  skippedFiles?: string[];
}): Promise<string> {
  const contentHashes = await Promise.all(
    stableUniqueSorted(args.files).map(async (file) => {
      const content = await fs.readFile(resolveRepoRelativePath(args.projectRoot, file));

      return {
        path: file,
        hash: `sha256:${createHash("sha256").update(content).digest("hex")}`
      };
    })
  );

  return hashGodReviewFileSet({
    files: args.files,
    skippedFiles: args.skippedFiles,
    contentHashes
  });
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

function isGeneratedPhaseSessionPath(value: string): boolean {
  return /^\.blueprint\/phases\/[^/]+\/\.god-review-session\.json$/.test(value);
}

function isGeneratedPhaseHumanStatePath(value: string): boolean {
  return /^\.blueprint\/phases\/[^/]+\/\.god-review-state\.md$/.test(value);
}

function isGeneratedPhaseReportPath(value: string): boolean {
  return /^\.blueprint\/phases\/[^/]+\/[^/]+-GOD-REVIEW\.md$/.test(value);
}

function isGeneratedReportSessionPath(value: string): boolean {
  return /^\.blueprint\/reports\/\.god-review-[A-Za-z0-9._-]+\.json$/.test(value);
}

function isGeneratedReportHumanStatePath(value: string): boolean {
  return /^\.blueprint\/reports\/[A-Za-z0-9._-]+\.god-review-state\.md$/.test(value);
}

function isGeneratedReportReportPath(value: string): boolean {
  return /^\.blueprint\/reports\/god-review-[A-Za-z0-9._-]+\.md$/.test(value);
}

function normalizeSessionOwnedPath(value: string): string {
  return path.posix.normalize(normalizePathSeparators(value.trim()));
}

function validateGodReviewSessionPaths(session: {
  scopeKind: GodReviewScopeKind;
  runId: string;
  sessionPath: string;
  humanStatePath: string;
  reportPath: string;
}): Array<{ field: "sessionPath" | "humanStatePath" | "reportPath"; message: string }> {
  const issues: Array<{
    field: "sessionPath" | "humanStatePath" | "reportPath";
    message: string;
  }> = [];
  const sessionPath = normalizeSessionOwnedPath(session.sessionPath);
  const humanStatePath = normalizeSessionOwnedPath(session.humanStatePath);
  const reportPath = normalizeSessionOwnedPath(session.reportPath);

  if (
    sessionPath !== session.sessionPath ||
    humanStatePath !== session.humanStatePath ||
    reportPath !== session.reportPath
  ) {
    return [
      {
        field: "sessionPath",
        message: "God-review session paths must be normalized repo-relative paths."
      }
    ];
  }

  if (session.scopeKind === "phase") {
    if (!isGeneratedPhaseSessionPath(sessionPath)) {
      issues.push({
        field: "sessionPath",
        message: "Phase god-review sessions must use a generated phase session path."
      });
    }

    const phaseDir = sessionPath.replace(/\/\.god-review-session\.json$/, "");

    if (
      !isGeneratedPhaseHumanStatePath(humanStatePath) ||
      humanStatePath !== `${phaseDir}/.god-review-state.md`
    ) {
      issues.push({
        field: "humanStatePath",
        message: "Phase god-review human state must use the generated phase state path."
      });
    }

    if (!isGeneratedPhaseReportPath(reportPath) || !reportPath.startsWith(`${phaseDir}/`)) {
      issues.push({
        field: "reportPath",
        message: "Phase god-review reports must stay in the generated phase report path."
      });
    }

    return issues;
  }

  const expected = buildGodReviewReportPaths({ runId: session.runId });

  if (!isGeneratedReportSessionPath(sessionPath) || sessionPath !== expected.sessionPath) {
    issues.push({
      field: "sessionPath",
      message: "Report-scoped god-review sessions must use the generated report session path."
    });
  }

  if (
    !isGeneratedReportHumanStatePath(humanStatePath) ||
    humanStatePath !== expected.humanStatePath
  ) {
    issues.push({
      field: "humanStatePath",
      message: "Report-scoped god-review human state must use the generated report state path."
    });
  }

  if (!isGeneratedReportReportPath(reportPath) || reportPath !== expected.reportPath) {
    issues.push({
      field: "reportPath",
      message: "Report-scoped god-review reports must use the generated report path."
    });
  }

  return issues;
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

function invalidAppendResult(args: {
  activated?: boolean;
  reason: string;
  warnings?: string[];
}): GodReviewAppendResult {
  return {
    status: "invalid",
    activated: args.activated ?? true,
    reason: args.reason,
    runId: null,
    sessionPath: null,
    humanStatePath: null,
    reportPath: null,
    groupId: null,
    groupStatus: null,
    findingIds: [],
    findings: [],
    nextGroupId: null,
    nextCommand: null,
    written: false,
    staleReasons: [],
    warnings: args.warnings ?? []
  };
}

function invalidLoadFindingsResult(args: {
  activated?: boolean;
  reason: string;
  reportPath?: string | null;
  sessionPath?: string | null;
  warnings?: string[];
}): GodReviewLoadFindingsResult {
  return {
    status: "invalid",
    activated: args.activated ?? true,
    reason: args.reason,
    reportPath: args.reportPath ?? null,
    sessionPath: args.sessionPath ?? null,
    findings: [],
    remediations: [],
    selection: null,
    warnings: args.warnings ?? []
  };
}

function invalidRecordFixResult(args: {
  activated?: boolean;
  reason: string;
  runId?: string | null;
  sessionPath?: string | null;
  humanStatePath?: string | null;
  reportPath?: string | null;
  findingId?: string | null;
  selectedBy?: GodReviewSelectedBy | null;
  remediationStatus?: GodReviewRemediationStatus | null;
  filesChanged?: string[];
  terminal?: boolean;
  cleanupEligible?: boolean;
  staleReasons?: string[];
  warnings?: string[];
}): GodReviewRecordFixResult {
  return {
    status: "invalid",
    activated: args.activated ?? true,
    reason: args.reason,
    runId: args.runId ?? null,
    sessionPath: args.sessionPath ?? null,
    humanStatePath: args.humanStatePath ?? null,
    reportPath: args.reportPath ?? null,
    remediationId: null,
    findingId: args.findingId ?? null,
    selectedBy: args.selectedBy ?? null,
    remediationStatus: args.remediationStatus ?? null,
    filesChanged: args.filesChanged ?? [],
    terminal: args.terminal ?? false,
    cleanupEligible: args.cleanupEligible ?? false,
    written: false,
    staleReasons: args.staleReasons ?? [],
    warnings: args.warnings ?? []
  };
}

function invalidCleanupResult(args: {
  activated?: boolean;
  reason: string;
  status?: "blocked" | "invalid";
  runId?: string | null;
  sessionPath?: string | null;
  humanStatePath?: string | null;
  reportPath?: string | null;
  deletedPaths?: string[];
  preservedPaths?: string[];
  cleanupEligible?: boolean;
  reviewTerminal?: boolean;
  godFixTerminal?: boolean;
  warnings?: string[];
}): GodReviewCleanupResult {
  return {
    status: args.status ?? "invalid",
    activated: args.activated ?? true,
    reason: args.reason,
    runId: args.runId ?? null,
    sessionPath: args.sessionPath ?? null,
    humanStatePath: args.humanStatePath ?? null,
    reportPath: args.reportPath ?? null,
    deletedPaths: args.deletedPaths ?? [],
    preservedPaths: args.preservedPaths ?? [],
    cleanupEligible: args.cleanupEligible ?? false,
    reviewTerminal: args.reviewTerminal ?? false,
    godFixTerminal: args.godFixTerminal ?? false,
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

function parseFlagValues(rawInvocation: string, flag: string): string[] {
  const tokens = rawInvocation.trim().split(/\s+/);
  const values: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] === flag) {
      const value = tokens[index + 1];

      if (value && !value.startsWith("--")) {
        values.push(value);
      }

      continue;
    }

    if (tokens[index].startsWith(`${flag}=`)) {
      const value = tokens[index].slice(flag.length + 1);

      if (value.length > 0) {
        values.push(value);
      }
    }
  }

  return values;
}

function hasInvocationFlag(rawInvocation: string, flag: string): boolean {
  return new RegExp(`(^|\\s)${flag}(?=$|\\s)`).test(rawInvocation);
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

  if (
    !isGeneratedPhaseSessionPath(normalizedPath) &&
    !isGeneratedReportSessionPath(normalizedPath)
  ) {
    return {
      valid: false,
      path: null,
      reason: "God-review session path must be a generated hidden session JSON path."
    };
  }

  return { valid: true, path: normalizedPath };
}

function normalizeGodReviewReportPath(rawPath: string): GodReviewRepoPathResult {
  const requestedPath = normalizePathSeparators(rawPath.trim());

  if (requestedPath.length === 0) {
    return { valid: false, path: null, reason: "Report path must not be empty." };
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
      reason: "God-review reports must stay inside .blueprint."
    };
  }

  if (!normalizedPath.endsWith(".md")) {
    return {
      valid: false,
      path: null,
      reason: "God-review report path must point to a Markdown file."
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

async function resolveGodReviewReportReference(
  args: GodReviewLoadFindingsArgs,
  projectRoot: string
): Promise<
  | { valid: true; reportPath: string; sessionPath: string | null }
  | { valid: false; reason: string; reportPath: string | null; sessionPath: string | null; warnings: string[] }
> {
  if (args.reportPath) {
    const normalized = normalizeGodReviewReportPath(args.reportPath);

    if (!normalized.valid) {
      return {
          valid: false,
          reason: normalized.reason,
          reportPath: null,
          sessionPath: null,
          warnings: []
        };
    }

    const explicitSessionPath = args.sessionPath;
    const runId = args.runId;

    if (explicitSessionPath) {
      const normalizedSessionPath = normalizeGodReviewSessionPath(explicitSessionPath);

      return normalizedSessionPath.valid
        ? {
            valid: true,
            reportPath: normalized.path,
            sessionPath: normalizedSessionPath.path
          }
        : {
            valid: false,
            reason: normalizedSessionPath.reason,
            reportPath: normalized.path,
            sessionPath: null,
            warnings: []
          };
    }

    if (runId) {
      if (!isValidRunId(runId)) {
        return {
          valid: false,
          reason: "runId may contain only letters, numbers, dots, underscores, and dashes.",
          reportPath: normalized.path,
          sessionPath: null,
          warnings: []
        };
      }

      return {
        valid: true,
        reportPath: normalized.path,
        sessionPath: buildGodReviewReportPaths({ runId }).sessionPath
      };
    }

    return { valid: true, reportPath: normalized.path, sessionPath: null };
  }

  const sessionPath = await resolveGodReviewSessionPath(args, projectRoot);

  if (!sessionPath.valid) {
    return {
      valid: false,
      reason: sessionPath.reason,
      reportPath: null,
      sessionPath: null,
      warnings: []
    };
  }

  const loaded = await loadGodReviewSession({
    projectRoot,
    sessionPath: sessionPath.path
  });

  if (!loaded.valid) {
    return {
      valid: false,
      reason: loaded.reason,
      reportPath: null,
      sessionPath: sessionPath.path,
      warnings: loaded.warnings
    };
  }

  return {
    valid: true,
    reportPath: loaded.session.reportPath,
    sessionPath: loaded.session.sessionPath
  };
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
    fileSetHash: await hashGodReviewResolvedFileSet({
      projectRoot: args.projectRoot,
      files: resolvedFiles.files,
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

function normalizeVocabularyValue<T extends readonly string[]>(
  rawValue: string | undefined,
  values: T
): T[number] | null {
  if (rawValue === undefined) {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase().replace(/\s+/g, "-");

  return values.includes(normalized) ? normalized : null;
}

function defaultFixEligibility(args: {
  disposition: GodReviewDisposition;
  severity: GodReviewSeverity;
}): GodReviewFixEligibility {
  if (
    args.disposition === "follow-up" &&
    ["critical", "high", "medium"].includes(args.severity)
  ) {
    return "eligible";
  }

  return "not-eligible";
}

function normalizeAppendFindings(args: {
  prefix: GodReviewGroupPrefix;
  existingFindingIds: string[];
  findings: z.infer<typeof godReviewAppendFindingInputSchema>[];
}):
  | { valid: true; findings: GodReviewAppendedFinding[] }
  | { valid: false; reason: string; warnings: string[] } {
  const findings: GodReviewAppendedFinding[] = [];
  const warnings: string[] = [];
  let nextNumber = args.existingFindingIds.filter((id) =>
    id.startsWith(`GOD-${args.prefix}-`)
  ).length + 1;

  for (const finding of args.findings) {
    const severity = normalizeVocabularyValue(
      finding.severity,
      GOD_REVIEW_SEVERITY_VALUES
    );
    const disposition = normalizeVocabularyValue(
      finding.disposition,
      GOD_REVIEW_DISPOSITION_VALUES
    );
    const confidence = normalizeVocabularyValue(finding.confidence, [
      "high",
      "medium",
      "low"
    ] as const);

    if (severity === null) {
      warnings.push(`Unsupported severity: ${finding.severity}`);
    }

    if (disposition === null) {
      warnings.push(`Unsupported disposition: ${finding.disposition}`);
    }

    if (finding.confidence !== undefined && confidence === null) {
      warnings.push(`Unsupported confidence: ${finding.confidence}`);
    }

    if (severity === null || disposition === null) {
      continue;
    }

    const fixEligibility =
      normalizeVocabularyValue(
        finding.fixEligibility,
        GOD_REVIEW_FIX_ELIGIBILITY_VALUES
      ) ??
      defaultFixEligibility({
        disposition,
        severity
      });

    if (
      finding.fixEligibility !== undefined &&
      normalizeVocabularyValue(
        finding.fixEligibility,
        GOD_REVIEW_FIX_ELIGIBILITY_VALUES
      ) === null
    ) {
      warnings.push(`Unsupported fix eligibility: ${finding.fixEligibility}`);
      continue;
    }

    const id = `GOD-${args.prefix}-${String(nextNumber).padStart(3, "0")}`;
    nextNumber += 1;
    findings.push({
      id,
      title: finding.title.trim(),
      severity,
      disposition,
      confidence,
      files: stableUniqueSorted(finding.files ?? []),
      evidence: finding.evidence?.trim() || null,
      impact: finding.impact?.trim() || null,
      recommendation: finding.recommendation?.trim() || null,
      fixEligibility
    });
  }

  if (warnings.length > 0) {
    return {
      valid: false,
      reason: "God-review append finding vocabulary validation failed.",
      warnings
    };
  }

  return { valid: true, findings };
}

function renderFindingFileList(files: string[]): string {
  return files.length === 0
    ? "none"
    : files.map((file) => `\`${file}\``).join(", ");
}

function renderGodReviewGroupSection(args: {
  group: (typeof GOD_REVIEW_GROUPS)[number];
  status: "completed" | "blocked";
  findings: GodReviewAppendedFinding[];
}): string {
  const lines = [
    "",
    `## GOD-${args.group.prefix} ${args.group.title}`,
    "",
    `Status: ${args.status}`,
    `Group ID: ${args.group.id}`,
    "Scope: frozen session scope",
    "",
    "### Findings",
    ""
  ];

  if (args.findings.length === 0) {
    lines.push("- none", "");
    return lines.join("\n");
  }

  for (const finding of args.findings) {
    lines.push(
      `#### ${finding.id}: ${finding.title}`,
      `- Severity: ${finding.severity}`,
      `- Disposition: ${finding.disposition}`,
      `- Confidence: ${finding.confidence ?? "medium"}`,
      `- Files: ${renderFindingFileList(finding.files)}`,
      `- Evidence: ${finding.evidence ?? "none"}`,
      `- Impact: ${finding.impact ?? "none"}`,
      `- Recommendation: ${finding.recommendation ?? "none"}`,
      `- Fix Eligibility: ${finding.fixEligibility}`,
      ""
    );
  }

  return lines.join("\n");
}

function nextGroupIdAfterAppend(groups: GodReviewGroupState[]): GodReviewGroupId | null {
  return (
    groups.find(
      (group) => group.status === "pending" || group.status === "in-progress"
    )?.id ?? null
  );
}

function collectDuplicateFindingIds(findings: GodReviewParsedFinding[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const finding of findings) {
    if (seen.has(finding.id)) {
      duplicates.add(finding.id);
    }

    seen.add(finding.id);
  }

  return [...duplicates].sort((left, right) => left.localeCompare(right));
}

function attachRemediationState(args: {
  findings: GodReviewParsedFinding[];
  remediations: GodReviewParsedRemediation[];
}): GodReviewParsedFinding[] {
  return args.findings.map((finding) => {
    const remediationAttempts = args.remediations.filter(
      (remediation) => remediation.findingId === finding.id
    );
    const latestAttempt = remediationAttempts.at(-1) ?? null;

    return {
      ...finding,
      remediationAttempts,
      remediated: remediationAttempts.some(
        (remediation) => remediation.status === "fixed"
      ),
      stale: latestAttempt?.status === "stale"
    };
  });
}

function invalidFixSelection(args: {
  selectedBy?: GodReviewSelectedBy;
  reason: string;
  staleReasons?: string[];
  fingerprintFresh?: boolean;
  evidenceFresh?: boolean;
  currentFingerprint?: GodReviewScopeFingerprint | null;
}): GodReviewFixSelection {
  return {
    status: "invalid",
    selectedBy: args.selectedBy ?? "default",
    reason: args.reason,
    targets: [],
    excluded: [],
    staleReasons: args.staleReasons ?? [],
    fingerprintFresh: args.fingerprintFresh ?? false,
    evidenceFresh: args.evidenceFresh ?? false,
    currentFingerprint: args.currentFingerprint ?? null
  };
}

function normalizeRequestedFindingIds(args: GodReviewLoadFindingsArgs): string[] {
  return stableUniqueSorted([
    ...(args.findingIds ?? []),
    ...parseFlagValues(args.rawInvocation, "--finding")
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0));
}

function resolveGodReviewFixSelectionIntent(args: GodReviewLoadFindingsArgs):
  | {
      valid: true;
      selectedBy: GodReviewSelectedBy;
      findingIds: string[];
      severity: GodReviewSeverity | null;
    }
  | { valid: false; selectedBy: GodReviewSelectedBy; reason: string } {
  const findingIds = normalizeRequestedFindingIds(args);
  const severityRaw = args.severity ?? parseFlagValue(args.rawInvocation, "--severity");
  const all = args.all === true || hasInvocationFlag(args.rawInvocation, "--all");

  if (findingIds.length > 0) {
    return {
      valid: true,
      selectedBy: "explicit-id",
      findingIds,
      severity: null
    };
  }

  if (all) {
    return {
      valid: true,
      selectedBy: "all",
      findingIds: [],
      severity: null
    };
  }

  if (severityRaw) {
    const severity = normalizeVocabularyValue(severityRaw, GOD_REVIEW_SEVERITY_VALUES);

    if (severity === null) {
      return {
        valid: false,
        selectedBy: "severity-filter",
        reason: `Unsupported god-review fix severity selector: ${severityRaw}.`
      };
    }

    return {
      valid: true,
      selectedBy: "severity-filter",
      findingIds: [],
      severity
    };
  }

  return {
    valid: true,
    selectedBy: "default",
    findingIds: [],
    severity: null
  };
}

function godReviewFindingExclusionReason(args: {
  finding: GodReviewParsedFinding;
  selectedBy: GodReviewSelectedBy;
  findingIds: string[];
  severity: GodReviewSeverity | null;
}): string | null {
  if (args.selectedBy === "explicit-id" && !args.findingIds.includes(args.finding.id)) {
    return "not explicitly selected";
  }

  if (args.selectedBy === "explicit-id") {
    if (args.finding.fixEligibility !== "eligible") {
      return `fix eligibility is ${args.finding.fixEligibility ?? "missing"}`;
    }

    return null;
  }

  if (args.finding.disposition !== "follow-up") {
    return `disposition is ${args.finding.disposition ?? "missing"}`;
  }

  if (args.finding.fixEligibility !== "eligible") {
    return `fix eligibility is ${args.finding.fixEligibility ?? "missing"}`;
  }

  if (
    args.selectedBy === "default" &&
    args.finding.severity !== "high" &&
    args.finding.severity !== "medium"
  ) {
    return `severity is ${args.finding.severity ?? "missing"}`;
  }

  if (
    args.selectedBy === "severity-filter" &&
    args.finding.severity !== args.severity
  ) {
    return `severity is ${args.finding.severity ?? "missing"}`;
  }

  return null;
}

function selectGodReviewFixTargets(args: {
  findings: GodReviewParsedFinding[];
  selectedBy: GodReviewSelectedBy;
  findingIds: string[];
  severity: GodReviewSeverity | null;
}):
  | {
      valid: true;
      targets: GodReviewFixTarget[];
      excluded: Array<{ id: string; reason: string }>;
    }
  | {
      valid: false;
      reason: string;
      excluded: Array<{ id: string; reason: string }>;
    } {
  const targets: GodReviewFixTarget[] = [];
  const excluded: Array<{ id: string; reason: string }> = [];

  for (const finding of args.findings) {
    const reason = godReviewFindingExclusionReason({
      finding,
      selectedBy: args.selectedBy,
      findingIds: args.findingIds,
      severity: args.severity
    });

    if (reason !== null) {
      excluded.push({ id: finding.id, reason });
      continue;
    }

    targets.push({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      disposition: finding.disposition,
      fixEligibility: finding.fixEligibility,
      files: finding.files,
      selectedBy: args.selectedBy,
      requiresConfirmationForCodeEdit: finding.disposition !== "follow-up"
    });
  }

  if (args.selectedBy === "explicit-id") {
    const existingIds = new Set(args.findings.map((finding) => finding.id));
    const missingIds = args.findingIds.filter((findingId) => !existingIds.has(findingId));

    if (missingIds.length > 0) {
      return {
        valid: false,
        reason: `Selected god-review finding IDs do not exist: ${missingIds.join(", ")}.`,
        excluded
      };
    }
  }

  return {
    valid: true,
    targets,
    excluded
  };
}

function parseGodReviewFileReference(
  rawReference: string
): GodReviewRepoPathResult & { line: number | null } {
  const trimmed = rawReference.trim();
  const lineMatch = trimmed.match(/^(.+):(\d+)$/);
  const rawPath = lineMatch ? lineMatch[1] : trimmed;
  const line = lineMatch ? Number(lineMatch[2]) : null;
  const normalized = normalizeGodReviewRepoRelativeFilePath(rawPath);

  if (!normalized.valid) {
    return { ...normalized, line };
  }

  return {
    valid: true,
    path: normalized.path,
    line
  };
}

function extractNearbyEvidenceSnippets(evidence: string | null): string[] {
  return parseBacktickedList(evidence)
    .map((snippet) => snippet.trim())
    .filter((snippet) => snippet.length > 0);
}

async function validateGodReviewFixTargetEvidence(args: {
  projectRoot: string;
  target: GodReviewFixTarget;
  finding: GodReviewParsedFinding;
}): Promise<string[]> {
  const staleReasons: string[] = [];
  const targetFiles = args.finding.files.length > 0 ? args.finding.files : args.target.files;

  if (targetFiles.length === 0) {
    return [`${args.target.id} has no referenced files.`];
  }

  const readableFileTexts = new Map<string, string>();

  for (const fileReference of targetFiles) {
    const parsedReference = parseGodReviewFileReference(fileReference);

    if (!parsedReference.valid) {
      staleReasons.push(
        `${args.target.id} references invalid file ${fileReference}: ${parsedReference.reason}`
      );
      continue;
    }

    let absolutePath: string;

    try {
      absolutePath = resolveRepoRelativePath(args.projectRoot, parsedReference.path);
    } catch (error) {
      staleReasons.push(
        `${args.target.id} references invalid file ${parsedReference.path}: ${
          error instanceof Error ? error.message : "could not resolve path"
        }`
      );
      continue;
    }

    let stats;

    try {
      stats = await fs.stat(absolutePath);
    } catch {
      staleReasons.push(`${args.target.id} references missing file ${parsedReference.path}.`);
      continue;
    }

    if (!stats.isFile()) {
      staleReasons.push(`${args.target.id} references non-file path ${parsedReference.path}.`);
      continue;
    }

    const fileText = await fs.readFile(absolutePath, "utf8");
    readableFileTexts.set(parsedReference.path, fileText);

    if (parsedReference.line !== null) {
      const lineCount = fileText.split("\n").length;

      if (parsedReference.line < 1 || parsedReference.line > lineCount) {
        staleReasons.push(
          `${args.target.id} references ${parsedReference.path}:${parsedReference.line}, but the file has ${lineCount} line(s).`
        );
      }
    }
  }

  const snippets = extractNearbyEvidenceSnippets(args.finding.evidence);

  for (const snippet of snippets) {
    const snippetFound = [...readableFileTexts.values()].some((text) =>
      text.includes(snippet)
    );

    if (!snippetFound) {
      staleReasons.push(
        `${args.target.id} evidence snippet \`${snippet}\` was not found near referenced files.`
      );
    }
  }

  return stableUniqueSorted(staleReasons);
}

async function resolveGodReviewFixSelection(args: {
  projectRoot: string;
  loadArgs: GodReviewLoadFindingsArgs;
  sessionPath: string | null;
  findings: GodReviewParsedFinding[];
}): Promise<GodReviewFixSelection | null> {
  if (args.loadArgs.activeCommand !== "/blu-code-review-fix") {
    return null;
  }

  const intent = resolveGodReviewFixSelectionIntent(args.loadArgs);

  if (!intent.valid) {
    return invalidFixSelection({
      selectedBy: intent.selectedBy,
      reason: intent.reason
    });
  }

  if (args.sessionPath === null) {
    return invalidFixSelection({
      selectedBy: intent.selectedBy,
      reason:
        "Hidden god-review fix selection requires a saved session path so the frozen scope fingerprint can be revalidated."
    });
  }

  const loaded = await loadGodReviewSession({
    projectRoot: args.projectRoot,
    sessionPath: args.sessionPath
  });

  if (!loaded.valid) {
    return invalidFixSelection({
      selectedBy: intent.selectedBy,
      reason: loaded.reason,
      staleReasons: loaded.warnings
    });
  }

  const fingerprint = await computeCurrentFingerprintForSession({
    projectRoot: args.projectRoot,
    session: loaded.session
  });

  if (fingerprint.staleReasons.length > 0) {
    return {
      status: "stale",
      selectedBy: intent.selectedBy,
      reason:
        "God-review scope fingerprint changed. Start a new hidden review before fixing saved findings.",
      targets: [],
      excluded: [],
      staleReasons: fingerprint.staleReasons,
      fingerprintFresh: false,
      evidenceFresh: false,
      currentFingerprint: fingerprint.fingerprint
    };
  }

  const selected = selectGodReviewFixTargets({
    findings: args.findings,
    selectedBy: intent.selectedBy,
    findingIds: intent.findingIds,
    severity: intent.severity
  });

  if (!selected.valid) {
    return invalidFixSelection({
      selectedBy: intent.selectedBy,
      reason: selected.reason,
      fingerprintFresh: true,
      evidenceFresh: true,
      currentFingerprint: fingerprint.fingerprint
    });
  }

  const findingsById = new Map(args.findings.map((finding) => [finding.id, finding]));
  const staleReasons = (
    await Promise.all(
      selected.targets.map((target) =>
        validateGodReviewFixTargetEvidence({
          projectRoot: args.projectRoot,
          target,
          finding: findingsById.get(target.id) ?? {
            id: target.id,
            title: target.title,
            severity: target.severity,
            disposition: target.disposition,
            confidence: null,
            files: target.files,
            evidence: null,
            impact: null,
            recommendation: null,
            fixEligibility: target.fixEligibility
          }
        })
      )
    )
  ).flat();

  if (staleReasons.length > 0) {
    return {
      status: "stale",
      selectedBy: intent.selectedBy,
      reason:
        "Selected god-review findings have stale referenced files, cited lines, or nearby evidence.",
      targets: [],
      excluded: selected.excluded,
      staleReasons: stableUniqueSorted(staleReasons),
      fingerprintFresh: true,
      evidenceFresh: false,
      currentFingerprint: fingerprint.fingerprint
    };
  }

  return {
    status: selected.targets.length > 0 ? "ready" : "empty",
    selectedBy: intent.selectedBy,
    reason:
      selected.targets.length > 0
        ? null
        : "No god-review findings matched the hidden fix selection rules.",
    targets: selected.targets,
    excluded: selected.excluded,
    staleReasons: [],
    fingerprintFresh: true,
    evidenceFresh: true,
    currentFingerprint: fingerprint.fingerprint
  };
}

function nextGodReviewRemediationId(remediations: GodReviewParsedRemediation[]): string {
  const maxId = remediations.reduce((max, remediation) => {
    const match = remediation.id.match(/^GOD-FIX-(\d{3})$/);

    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `GOD-FIX-${String(maxId + 1).padStart(3, "0")}`;
}

function formatOptionalRemediationValue(value: string | undefined): string {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : "none";
}

function renderRemediationFilesChanged(filesChanged: string[]): string {
  return filesChanged.length === 0
    ? "none"
    : filesChanged.map((file) => `\`${file}\``).join(", ");
}

function renderGodReviewRemediationEntry(args: {
  remediationId: string;
  findingId: string;
  status: GodReviewRemediationStatus;
  selectedBy: GodReviewSelectedBy;
  filesChanged: string[];
  verification?: string;
  evidence?: string;
  followUp?: string;
}): string {
  return [
    `### ${args.remediationId}: ${args.findingId}`,
    `- Status: ${args.status}`,
    `- Finding: ${args.findingId}`,
    `- Selected By: ${args.selectedBy}`,
    `- Files Changed: ${renderRemediationFilesChanged(args.filesChanged)}`,
    `- Verification: ${formatOptionalRemediationValue(args.verification)}`,
    `- Evidence: ${formatOptionalRemediationValue(args.evidence)}`,
    `- Follow-Up: ${formatOptionalRemediationValue(args.followUp)}`,
    ""
  ].join("\n");
}

function appendRemediationLogPayload(args: {
  report: string;
  entry: string;
}): string {
  const hasRemediationLog = /^## Remediation Log\s*$/m.test(args.report);
  const beforeEntry = hasRemediationLog ? "\n" : "\n## Remediation Log\n\n";

  return `${args.report.endsWith("\n") ? "" : "\n"}${beforeEntry}${args.entry}`;
}

async function normalizeRemediationChangedFiles(args: {
  projectRoot: string;
  status: GodReviewRemediationStatus;
  filesChanged: string[] | undefined;
}): Promise<
  | { valid: true; filesChanged: string[] }
  | { valid: false; reason: string; filesChanged: string[]; warnings: string[] }
> {
  const requestedFiles = stableUniqueSorted(args.filesChanged ?? []);

  if (args.status !== "fixed" && requestedFiles.length > 0) {
    return {
      valid: false,
      reason:
        "Only fixed god-review remediation entries may claim changed files; stale, skipped, deferred, and blocked entries must be no-edit records.",
      filesChanged: requestedFiles,
      warnings: []
    };
  }

  if (args.status === "fixed" && requestedFiles.length === 0) {
    return {
      valid: false,
      reason: "Fixed god-review remediation entries must name at least one changed file.",
      filesChanged: [],
      warnings: []
    };
  }

  if (requestedFiles.length === 0) {
    return { valid: true, filesChanged: [] };
  }

  const resolvedFiles = await resolveExistingRepoFiles({
    projectRoot: args.projectRoot,
    files: requestedFiles,
    sourceLabel: "god-review remediation changed file"
  });

  if (!resolvedFiles.valid) {
    return {
      valid: false,
      reason: resolvedFiles.reason ?? "One or more changed files were invalid.",
      filesChanged: requestedFiles,
      warnings: resolvedFiles.warnings
    };
  }

  return {
    valid: true,
    filesChanged: resolvedFiles.files
  };
}

function buildRecordFixSelectionArgs(args: {
  recordArgs: GodReviewRecordFixArgs;
  session: GodReviewSession;
  finding: GodReviewParsedFinding;
}): GodReviewLoadFindingsArgs {
  const selectionArgs: GodReviewLoadFindingsArgs = {
    cwd: args.recordArgs.cwd,
    activeCommand: "/blu-code-review-fix",
    rawInvocation: args.recordArgs.rawInvocation,
    phase: args.recordArgs.phase,
    runId: args.recordArgs.runId,
    sessionPath: args.recordArgs.sessionPath ?? args.session.sessionPath,
    reportPath: args.recordArgs.reportPath ?? args.session.reportPath
  };

  switch (args.recordArgs.selectedBy) {
    case "explicit-id":
      return {
        ...selectionArgs,
        findingIds: [args.recordArgs.findingId]
      };
    case "severity-filter":
      return {
        ...selectionArgs,
        severity: args.finding.severity ?? undefined
      };
    case "all":
      return {
        ...selectionArgs,
        all: true
      };
    case "default":
      return selectionArgs;
  }
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
      fileSetHash: await hashGodReviewResolvedFileSet({
        projectRoot: args.projectRoot,
        files: resolvedFiles.files
      }),
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
      fileSetHash: await hashGodReviewResolvedFileSet({
        projectRoot: args.projectRoot,
        files: resolvedFiles.files
      }),
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

export async function blueprintGodReviewAppend(
  rawArgs: GodReviewAppendArgs
): Promise<GodReviewAppendResult> {
  const parsed = godReviewAppendArgsSchema.safeParse(rawArgs);

  if (!parsed.success) {
    return invalidAppendResult({
      activated: false,
      reason: "Invalid blueprint_god_review_append arguments.",
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
      groupId: null,
      groupStatus: null,
      findingIds: [],
      findings: [],
      nextGroupId: null,
      nextCommand: null,
      written: false,
      staleReasons: [],
      warnings: []
    };
  }

  if ((args.groups ?? []).length > 0) {
    return invalidAppendResult({
      reason:
        "blueprint_god_review_append accepts exactly one group per call; use groupId, not groups."
    });
  }

  const projectRoot = await ensureRepoRoot(args.cwd);
  const sessionPath = await resolveGodReviewSessionPath(args, projectRoot);

  if (!sessionPath.valid) {
    return invalidAppendResult({
      reason: sessionPath.reason
    });
  }

  const loaded = await loadGodReviewSession({
    projectRoot,
    sessionPath: sessionPath.path
  });

  if (!loaded.valid) {
    return invalidAppendResult({
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
        "God-review scope fingerprint changed. Start a new hidden review run instead of appending to this session.",
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      groupId: args.groupId,
      groupStatus: null,
      findingIds: [],
      findings: [],
      nextGroupId: session.nextGroupId,
      nextCommand,
      written: false,
      staleReasons: fingerprint.staleReasons,
      warnings: fingerprint.warnings
    };
  }

  if (session.nextGroupId !== args.groupId) {
    return invalidAppendResult({
      reason: `God-review groups must be appended in session order. Next group is ${session.nextGroupId ?? "none"}, not ${args.groupId}.`
    });
  }

  const sessionGroup = session.groups.find((group) => group.id === args.groupId);
  const groupDefinition = GOD_REVIEW_GROUPS.find((group) => group.id === args.groupId);

  if (!sessionGroup || !groupDefinition) {
    return invalidAppendResult({
      reason: `Unknown god-review group: ${args.groupId}.`
    });
  }

  if (sessionGroup.status !== "pending" && sessionGroup.status !== "in-progress") {
    return invalidAppendResult({
      reason: `${args.groupId} has already been appended and will not be rewritten.`
    });
  }

  const normalizedFindings = normalizeAppendFindings({
    prefix: sessionGroup.prefix,
    existingFindingIds: sessionGroup.findingIds,
    findings: args.findings ?? []
  });

  if (!normalizedFindings.valid) {
    return invalidAppendResult({
      reason: normalizedFindings.reason,
      warnings: normalizedFindings.warnings
    });
  }

  const findingIds = normalizedFindings.findings.map((finding) => finding.id);
  const nextGroups = session.groups.map((group) =>
    group.id === args.groupId
      ? {
          ...group,
          status: args.status,
          findingIds
        }
      : group
  );
  const nextGroupId = args.status === "blocked" ? null : nextGroupIdAfterAppend(nextGroups);
  const updatedAt = new Date().toISOString();
  const nextStatus: GodReviewSessionStatus =
    args.status === "blocked"
      ? "blocked"
      : nextGroupId === null
        ? "completed"
        : "in-progress";
  const updatedSession: GodReviewSession = {
    ...session,
    status: nextStatus,
    updatedAt,
    groups: nextGroups,
    nextGroupId,
    cleanup: {
      ...session.cleanup,
      reviewTerminal: nextStatus === "completed" || nextStatus === "blocked"
    }
  };
  const updatedNextCommand = nextGodReviewCommand({
    activeCommand: updatedSession.activeCommand,
    scopeKind: updatedSession.scopeKind,
    phase: updatedSession.phase ?? null,
    runId: updatedSession.runId
  });
  const reportPath = resolveBlueprintPath(projectRoot, updatedSession.reportPath);
  const sessionFilePath = resolveBlueprintPath(projectRoot, updatedSession.sessionPath);
  const humanStatePath = resolveBlueprintPath(projectRoot, updatedSession.humanStatePath);

  await fs.appendFile(
    reportPath,
    renderGodReviewGroupSection({
      group: groupDefinition,
      status: args.status,
      findings: normalizedFindings.findings
    }),
    "utf8"
  );
  await fs.writeFile(
    sessionFilePath,
    `${JSON.stringify(updatedSession, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    humanStatePath,
    renderGodReviewHumanState({
      runId: updatedSession.runId,
      scopeKind: updatedSession.scopeKind,
      fileCount: updatedSession.files.length,
      currentGroupId: args.groupId,
      nextGroupId,
      reviewTerminal: updatedSession.cleanup.reviewTerminal,
      godFixTerminal: updatedSession.cleanup.godFixTerminal,
      stale: false,
      nextCommand: updatedNextCommand
    }),
    "utf8"
  );

  return {
    status: "appended",
    activated: true,
    reason: null,
    runId: updatedSession.runId,
    sessionPath: updatedSession.sessionPath,
    humanStatePath: updatedSession.humanStatePath,
    reportPath: updatedSession.reportPath,
    groupId: args.groupId,
    groupStatus: args.status,
    findingIds,
    findings: normalizedFindings.findings,
    nextGroupId,
    nextCommand: updatedNextCommand,
    written: true,
    staleReasons: [],
    warnings: fingerprint.warnings
  };
}

export async function blueprintGodReviewLoadFindings(
  rawArgs: GodReviewLoadFindingsArgs
): Promise<GodReviewLoadFindingsResult> {
  const parsed = godReviewLoadFindingsArgsSchema.safeParse(rawArgs);

  if (!parsed.success) {
    return invalidLoadFindingsResult({
      activated: false,
      reason: "Invalid blueprint_god_review_load_findings arguments.",
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
      reportPath: null,
      sessionPath: null,
      findings: [],
      remediations: [],
      selection: null,
      warnings: []
    };
  }

  const projectRoot = await ensureRepoRoot(args.cwd);
  const reference = await resolveGodReviewReportReference(args, projectRoot);

  if (!reference.valid) {
    return invalidLoadFindingsResult({
      reason: reference.reason,
      reportPath: reference.reportPath,
      sessionPath: reference.sessionPath,
      warnings: reference.warnings
    });
  }

  const reportAbsolutePath = resolveBlueprintPath(projectRoot, reference.reportPath);
  const report = await readTextIfPresent(reportAbsolutePath);

  if (report === null) {
    return {
      status: "not_found",
      activated: true,
      reason: `${reference.reportPath} does not exist.`,
      reportPath: reference.reportPath,
      sessionPath: reference.sessionPath,
      findings: [],
      remediations: [],
      selection: null,
      warnings: []
    };
  }

  const parsedReport = parseGodReviewReportShell(report);
  const duplicateIds = collectDuplicateFindingIds(parsedReport.findings);

  if (duplicateIds.length > 0) {
    return invalidLoadFindingsResult({
      reason: `Duplicate god-review finding IDs are not allowed: ${duplicateIds.join(", ")}.`,
      reportPath: reference.reportPath,
      sessionPath: reference.sessionPath,
      warnings: parsedReport.warnings
    });
  }

  const findings = attachRemediationState(parsedReport);
  const selection = await resolveGodReviewFixSelection({
    projectRoot,
    loadArgs: args,
    sessionPath: reference.sessionPath,
    findings
  });

  return {
    status: "found",
    activated: true,
    reason: null,
    reportPath: reference.reportPath,
    sessionPath: reference.sessionPath,
    findings,
    remediations: parsedReport.remediations,
    selection,
    warnings: parsedReport.warnings
  };
}

export async function blueprintGodReviewRecordFix(
  rawArgs: GodReviewRecordFixArgs
): Promise<GodReviewRecordFixResult> {
  const parsed = godReviewRecordFixArgsSchema.safeParse(rawArgs);

  if (!parsed.success) {
    return invalidRecordFixResult({
      activated: false,
      reason: "Invalid blueprint_god_review_record_fix arguments.",
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
      remediationId: null,
      findingId: null,
      selectedBy: null,
      remediationStatus: null,
      filesChanged: [],
      terminal: false,
      cleanupEligible: false,
      written: false,
      staleReasons: [],
      warnings: []
    };
  }

  const projectRoot = await ensureRepoRoot(args.cwd);
  const sessionPath = await resolveGodReviewSessionPath(args, projectRoot);

  if (!sessionPath.valid) {
    return invalidRecordFixResult({
      reason: sessionPath.reason,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status
    });
  }

  const loaded = await loadGodReviewSession({
    projectRoot,
    sessionPath: sessionPath.path
  });

  if (!loaded.valid) {
    return invalidRecordFixResult({
      reason: loaded.reason,
      sessionPath: sessionPath.path,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status,
      warnings: loaded.warnings
    });
  }

  const session = loaded.session;
  const reportPath = args.reportPath ?? session.reportPath;
  const normalizedReportPath = normalizeGodReviewReportPath(reportPath);

  if (!normalizedReportPath.valid) {
    return invalidRecordFixResult({
      reason: normalizedReportPath.reason,
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status
    });
  }

  if (normalizedReportPath.path !== session.reportPath) {
    return invalidRecordFixResult({
      reason:
        "blueprint_god_review_record_fix must append to the durable report recorded by the saved god-review session.",
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: normalizedReportPath.path,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status
    });
  }

  const reportAbsolutePath = resolveBlueprintPath(projectRoot, session.reportPath);
  const report = await readTextIfPresent(reportAbsolutePath);

  if (report === null) {
    return invalidRecordFixResult({
      reason: `${session.reportPath} does not exist.`,
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status
    });
  }

  const parsedReport = parseGodReviewReportShell(report);
  const duplicateIds = collectDuplicateFindingIds(parsedReport.findings);

  if (duplicateIds.length > 0) {
    return invalidRecordFixResult({
      reason: `Duplicate god-review finding IDs are not allowed: ${duplicateIds.join(", ")}.`,
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status,
      warnings: parsedReport.warnings
    });
  }

  const findings = attachRemediationState(parsedReport);
  const finding = findings.find((candidate) => candidate.id === args.findingId);

  if (!finding) {
    return invalidRecordFixResult({
      reason: `Selected god-review finding ID does not exist: ${args.findingId}.`,
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status,
      warnings: parsedReport.warnings
    });
  }

  const selection = await resolveGodReviewFixSelection({
    projectRoot,
    loadArgs: buildRecordFixSelectionArgs({
      recordArgs: args,
      session,
      finding
    }),
    sessionPath: session.sessionPath,
    findings
  });
  const selectedTarget = selection?.targets.find((target) => target.id === args.findingId);

  if (selection?.status === "stale" && args.status !== "stale") {
    return {
      status: "stale",
      activated: true,
      reason:
        "God-review selection is stale. Record a no-edit stale remediation entry or start a fresh hidden review.",
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      remediationId: null,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status,
      filesChanged: args.filesChanged ?? [],
      terminal: false,
      cleanupEligible: session.cleanup.eligible,
      written: false,
      staleReasons: selection.staleReasons,
      warnings: [...parsedReport.warnings, ...selection.staleReasons]
    };
  }

  if (
    args.status === "fixed" &&
    (selection === null || selection.status !== "ready" || !selectedTarget)
  ) {
    return invalidRecordFixResult({
      reason:
        selection?.reason ??
        "Fixed god-review remediation entries require an edit-ready private selection target.",
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status,
      staleReasons: selection?.staleReasons ?? [],
      warnings: parsedReport.warnings
    });
  }

  if (
    args.status !== "fixed" &&
    selection?.status === "invalid" &&
    args.selectedBy !== "explicit-id"
  ) {
    return invalidRecordFixResult({
      reason: selection.reason ?? "God-review remediation selection was invalid.",
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status,
      staleReasons: selection.staleReasons,
      warnings: [...parsedReport.warnings, ...selection.staleReasons]
    });
  }

  const changedFiles = await normalizeRemediationChangedFiles({
    projectRoot,
    status: args.status,
    filesChanged: args.filesChanged
  });

  if (!changedFiles.valid) {
    return invalidRecordFixResult({
      reason: changedFiles.reason,
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      findingId: args.findingId,
      selectedBy: args.selectedBy,
      remediationStatus: args.status,
      filesChanged: changedFiles.filesChanged,
      warnings: [...parsedReport.warnings, ...changedFiles.warnings]
    });
  }

  const remediationId = nextGodReviewRemediationId(parsedReport.remediations);
  const entry = renderGodReviewRemediationEntry({
    remediationId,
    findingId: args.findingId,
    status: args.status,
    selectedBy: args.selectedBy,
    filesChanged: changedFiles.filesChanged,
    verification: args.verification,
    evidence:
      args.status === "stale" && (args.evidence === undefined || args.evidence.trim() === "")
        ? selection?.staleReasons.join("; ")
        : args.evidence,
    followUp: args.followUp
  });
  const updatedAt = new Date().toISOString();
  const terminal = args.terminal === true;
  const cleanup = {
    ...session.cleanup,
    godFixTerminal: session.cleanup.godFixTerminal || terminal
  };
  cleanup.eligible = cleanup.reviewTerminal && cleanup.godFixTerminal;
  const updatedSession: GodReviewSession = {
    ...session,
    updatedAt,
    cleanup
  };
  const nextCommand = terminal
    ? "hidden fix terminal"
    : nextGodReviewCommand({
        activeCommand: "/blu-code-review-fix",
        scopeKind: session.scopeKind,
        phase: session.phase ?? null,
        runId: session.runId
      });

  await fs.appendFile(
    reportAbsolutePath,
    appendRemediationLogPayload({ report, entry }),
    "utf8"
  );
  await fs.writeFile(
    resolveBlueprintPath(projectRoot, updatedSession.sessionPath),
    `${JSON.stringify(updatedSession, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    resolveBlueprintPath(projectRoot, updatedSession.humanStatePath),
    renderGodReviewHumanState({
      runId: updatedSession.runId,
      scopeKind: updatedSession.scopeKind,
      fileCount: updatedSession.files.length,
      currentGroupId: null,
      nextGroupId: updatedSession.nextGroupId,
      reviewTerminal: updatedSession.cleanup.reviewTerminal,
      godFixTerminal: updatedSession.cleanup.godFixTerminal,
      stale: args.status === "stale",
      nextCommand
    }),
    "utf8"
  );

  return {
    status: "recorded",
    activated: true,
    reason: null,
    runId: updatedSession.runId,
    sessionPath: updatedSession.sessionPath,
    humanStatePath: updatedSession.humanStatePath,
    reportPath: updatedSession.reportPath,
    remediationId,
    findingId: args.findingId,
    selectedBy: args.selectedBy,
    remediationStatus: args.status,
    filesChanged: changedFiles.filesChanged,
    terminal: updatedSession.cleanup.godFixTerminal,
    cleanupEligible: updatedSession.cleanup.eligible,
    written: true,
    staleReasons: args.status === "stale" ? selection?.staleReasons ?? [] : [],
    warnings: parsedReport.warnings
  };
}

async function noEligibleHiddenFixTerminal(args: {
  projectRoot: string;
  cleanupArgs: GodReviewCleanupArgs;
  session: GodReviewSession;
  report: string;
}): Promise<
  | { terminal: true; warnings: string[] }
  | { terminal: false; reason: string; warnings: string[] }
> {
  const parsedReport = parseGodReviewReportShell(args.report);
  const duplicateIds = collectDuplicateFindingIds(parsedReport.findings);

  if (duplicateIds.length > 0) {
    return {
      terminal: false,
      reason: `Duplicate god-review finding IDs are not allowed: ${duplicateIds.join(", ")}.`,
      warnings: parsedReport.warnings
    };
  }

  const findings = attachRemediationState(parsedReport);
  const selection = await resolveGodReviewFixSelection({
    projectRoot: args.projectRoot,
    loadArgs: {
      cwd: args.cleanupArgs.cwd,
      activeCommand: "/blu-code-review-fix",
      rawInvocation: args.cleanupArgs.rawInvocation,
      phase: args.cleanupArgs.phase,
      runId: args.cleanupArgs.runId,
      sessionPath: args.cleanupArgs.sessionPath ?? args.session.sessionPath,
      reportPath: args.session.reportPath
    },
    sessionPath: args.session.sessionPath,
    findings
  });

  if (selection?.status === "empty") {
    return {
      terminal: true,
      warnings: parsedReport.warnings
    };
  }

  return {
    terminal: false,
    reason:
      selection?.reason ??
      "Hidden fix cleanup cannot treat this run as no-op terminal because eligible fix targets still exist or selection is not empty.",
    warnings: [
      ...parsedReport.warnings,
      ...(selection?.staleReasons ?? [])
    ]
  };
}

export async function blueprintGodReviewCleanup(
  rawArgs: GodReviewCleanupArgs
): Promise<GodReviewCleanupResult> {
  const parsed = godReviewCleanupArgsSchema.safeParse(rawArgs);

  if (!parsed.success) {
    return invalidCleanupResult({
      activated: false,
      reason: "Invalid blueprint_god_review_cleanup arguments.",
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
      deletedPaths: [],
      preservedPaths: [],
      cleanupEligible: false,
      reviewTerminal: false,
      godFixTerminal: false,
      warnings: []
    };
  }

  const projectRoot = await ensureRepoRoot(args.cwd);
  const sessionPath = await resolveGodReviewSessionPath(args, projectRoot);

  if (!sessionPath.valid) {
    return invalidCleanupResult({
      reason: sessionPath.reason
    });
  }

  const loaded = await loadGodReviewSession({
    projectRoot,
    sessionPath: sessionPath.path
  });

  if (!loaded.valid) {
    return invalidCleanupResult({
      reason: loaded.reason,
      sessionPath: sessionPath.path,
      warnings: loaded.warnings
    });
  }

  const session = loaded.session;
  const reportPath = resolveBlueprintPath(projectRoot, session.reportPath);
  const report = await readTextIfPresent(reportPath);

  if (report === null) {
    return invalidCleanupResult({
      reason: `${session.reportPath} does not exist. Cleanup preserves the durable god-review report, so the report must exist before cleanup.`,
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      preservedPaths: [],
      cleanupEligible: false,
      reviewTerminal: session.cleanup.reviewTerminal,
      godFixTerminal: session.cleanup.godFixTerminal
    });
  }

  if (!session.cleanup.reviewTerminal) {
    return invalidCleanupResult({
      status: "blocked",
      reason:
        "God-review cleanup is blocked until the hidden review is terminal.",
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      preservedPaths: [session.reportPath],
      cleanupEligible: false,
      reviewTerminal: false,
      godFixTerminal: session.cleanup.godFixTerminal
    });
  }

  let godFixTerminal = session.cleanup.godFixTerminal;
  let warnings: string[] = [];

  if (!godFixTerminal && args.noEligibleFindingsTerminal === true) {
    const noEligible = await noEligibleHiddenFixTerminal({
      projectRoot,
      cleanupArgs: args,
      session,
      report
    });

    if (!noEligible.terminal) {
      return invalidCleanupResult({
        status: "blocked",
        reason: noEligible.reason,
        runId: session.runId,
        sessionPath: session.sessionPath,
        humanStatePath: session.humanStatePath,
        reportPath: session.reportPath,
        preservedPaths: [session.reportPath],
        cleanupEligible: false,
        reviewTerminal: true,
        godFixTerminal: false,
        warnings: noEligible.warnings
      });
    }

    godFixTerminal = true;
    warnings = noEligible.warnings;
  }

  if (!godFixTerminal) {
    return invalidCleanupResult({
      status: "blocked",
      reason:
        "God-review cleanup is blocked until hidden fix mode reaches a terminal result.",
      runId: session.runId,
      sessionPath: session.sessionPath,
      humanStatePath: session.humanStatePath,
      reportPath: session.reportPath,
      preservedPaths: [session.reportPath],
      cleanupEligible: false,
      reviewTerminal: true,
      godFixTerminal: false
    });
  }

  const sessionAbsolutePath = resolveBlueprintPath(projectRoot, session.sessionPath);
  const humanStateAbsolutePath = resolveBlueprintPath(projectRoot, session.humanStatePath);
  const deletedPaths: string[] = [];

  for (const [relativePath, absolutePath] of [
    [session.sessionPath, sessionAbsolutePath],
    [session.humanStatePath, humanStateAbsolutePath]
  ] as const) {
    if (await pathExists(absolutePath)) {
      await fs.rm(absolutePath, { force: true });
      deletedPaths.push(relativePath);
    }
  }

  return {
    status: "cleaned",
    activated: true,
    reason: null,
    runId: session.runId,
    sessionPath: session.sessionPath,
    humanStatePath: session.humanStatePath,
    reportPath: session.reportPath,
    deletedPaths,
    preservedPaths: [session.reportPath],
    cleanupEligible: true,
    reviewTerminal: true,
    godFixTerminal: true,
    warnings
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
  },
  {
    name: "blueprint_god_review_append",
    description:
      "Private hidden god-review append tool: appends exactly one ordered review group section, assigns GOD finding IDs, and updates only the private session plus human state.",
    inputSchema: godReviewAppendInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintGodReviewAppend(args as GodReviewAppendArgs)
  },
  {
    name: "blueprint_god_review_load_findings",
    description:
      "Private hidden god-review finding loader: parses GOD findings/remediation attempts only from the durable god-review report and, in hidden fix mode, returns edit-ready selection after scope and evidence freshness checks.",
    inputSchema: godReviewLoadFindingsInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintGodReviewLoadFindings(args as GodReviewLoadFindingsArgs)
  },
  {
    name: "blueprint_god_review_record_fix",
    description:
      "Private hidden god-review remediation recorder: appends exactly one GOD-FIX entry to the durable god-review report after activation, selection, and stale-evidence checks.",
    inputSchema: godReviewRecordFixInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintGodReviewRecordFix(args as GodReviewRecordFixArgs)
  },
  {
    name: "blueprint_god_review_cleanup",
    description:
      "Private hidden god-review cleanup tool: deletes only temporary hidden session/state files after hidden review and hidden fix are terminal, preserving the durable god-review report.",
    inputSchema: godReviewCleanupInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintGodReviewCleanup(args as GodReviewCleanupArgs)
  }
];
