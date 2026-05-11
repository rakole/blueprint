import { createHash } from "node:crypto";
import path from "node:path";

import * as z from "zod/v4";

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
