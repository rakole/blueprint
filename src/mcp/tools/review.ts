import { promises as fs } from "node:fs";
import path from "node:path";

import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import * as z from "zod/v4";

import { prepareTextForPersistence } from "../../shared/security.js";
import { readArtifactContract } from "../artifact-contracts/index.js";
import { blueprintDirectCommand } from "../command-paths.js";
import {
  ensureRepoRoot,
  resolveBlueprintPath,
  resolveRepoRelativePath,
  toRepoRelativePath,
  validatePlanArtifactContent,
  validateReviewArtifactContent,
  validateReviewArtifactScopeCoverage,
  writeTextFile
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import {
  blueprintPhaseExecutionTargets,
  blueprintPhaseLocate,
  blueprintPhasePlanIndex,
  blueprintPhasePlanRead,
  blueprintPhaseSummaryIndex,
  blueprintPhaseSummaryRead
} from "./phase.js";

type ReviewArtifactKind =
  | "code-review"
  | "peer-review"
  | "review-fix"
  | "security"
  | "ui-review";

type NumericInput = string | number;

type ReviewFindingSeverity = "critical" | "high" | "medium" | "low" | "unknown";
type ReviewFindingDisposition = "follow-up" | "observation" | "blocked" | "accepted-risk";
type CodeReviewEvidenceCoverageStatus = "used" | "deferred" | "irrelevant";

type ReviewFinding = {
  id: string;
  severity: ReviewFindingSeverity;
  summary: string;
  sourceSection: string | null;
};

type ReviewRecordArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact: ReviewArtifactKind;
  content?: string;
  model?: unknown;
  overwrite?: boolean;
  scopeFiles?: string[];
  scopeSource?: ReviewModeSource;
  depth?: ReviewDepth;
};

type ReviewRecordResult = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  artifact: ReviewArtifactKind;
  reportPath: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused" | "invalid";
  counts: {
    sections: number;
    findings: number;
    followUps: number;
  };
  followUps: string[];
  warnings: string[];
};

type ReviewDepth = "quick" | "standard" | "deep";
type ReviewModeSource =
  | "explicit-files"
  | "phase-plans"
  | "phase-summaries"
  | "phase-evidence";

type ReviewScopeConfirmation = {
  recommended: boolean;
  pendingGate: "none" | "scope-confirmation";
  reasons: string[];
  thresholds: {
    broadFileCount: number;
    multiPlanCount: number;
    deepFileCount: number;
  };
  signals: {
    fileCount: number;
    summaryCount: number;
    matchedPlanCount: number;
    depth: ReviewDepth;
    source: ReviewModeSource;
  };
};

type ReviewScopeArgs = {
  cwd?: string;
  phase?: NumericInput;
  files?: string[];
  depth?: ReviewDepth;
  includeAuthoringContext?: boolean;
};

type ReviewScopePhase = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
  resolvedFrom: "explicit" | "state" | "roadmap";
};

type CodeReviewAuthoringContext = {
  phase: ReviewScopePhase;
  files: string[];
  reviewMode: {
    depth: ReviewDepth;
    source: ReviewModeSource;
  };
  knownEvidenceArtifacts: string[];
  allowedNextActions: string[];
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
};

type ReviewScopeResult = {
  status: "ready" | "invalid";
  phase: ReviewScopePhase | null;
  files: string[];
  reviewMode: {
    depth: ReviewDepth;
    source: ReviewModeSource;
  };
  confirmationRecommended: ReviewScopeConfirmation;
  artifacts: {
    plans: string[];
    summaries: string[];
    verification: string | null;
    uat: string | null;
    existingReview: string | null;
    security: string | null;
  };
  authoringContext?: CodeReviewAuthoringContext;
  reason: string | null;
  warnings: string[];
};

type NormalizeReviewFilesResult = {
  files: string[];
  rejected: boolean;
};

type ReviewLoadFindingsArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact?: ReviewArtifactKind;
};

type ReviewLoadFindingsResult = {
  phaseFound: boolean;
  found: boolean;
  phaseNumber: string | null;
  phasePrefix: string | null;
  phaseName: string | null;
  phaseDir: string | null;
  artifact: ReviewArtifactKind;
  path: string | null;
  findings: ReviewFinding[];
  severityCounts: Record<ReviewFindingSeverity, number>;
  followUps: string[];
  reason: string | null;
  warnings: string[];
};

type CodeReviewStructuredModel = {
  verdict: "PASS" | "FOLLOW_UP" | "BLOCKED";
  reviewSummary: string[];
  positiveSignals: string[];
  findings: Array<{
    severity: ReviewFindingSeverity;
    disposition: ReviewFindingDisposition;
    location: string;
    evidence: string;
    impact: string;
    recommendation: string;
  }>;
  evidenceCoverage: Record<
    string,
    {
      status: CodeReviewEvidenceCoverageStatus;
      rationale: string;
    }
  >;
  followUps: string[];
  nextSafeAction: string;
};

type SecurityReviewStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type SecurityReviewReadiness = "ready-for-routing" | "needs-follow-up" | "blocked";
type SecurityReviewCompletionState = "complete" | "partial" | "blocked";
type SecurityThreatStatus = "closed" | "accepted" | "open" | "none";
type SecurityEvidenceCoverageStatus = "used" | "deferred" | "unavailable";
type SecurityManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type SecurityGapStatus = "OPEN" | "BLOCKED" | "NONE";

type SecurityDeclaredThreat = {
  threatId: string;
  sourcePlan: string;
  category: string;
  component: string;
  disposition: string;
  mitigation: string;
};

type SecuritySummaryThreatFlag = {
  flagId: string;
  sourceSummary: string;
  threatId: string | null;
  evidence: string;
};

type SecurityThreatRegisterRow = {
  threatId: string;
  status: SecurityThreatStatus;
  evidence: string;
  verifierNote: string;
};

type SecurityStructuredModel = {
  status: SecurityReviewStatus;
  readiness: SecurityReviewReadiness;
  completionState: SecurityReviewCompletionState;
  securitySummary: string[];
  evidenceCoverage: Record<
    string,
    {
      status: SecurityEvidenceCoverageStatus;
      rationale: string;
    }
  >;
  threatRegister: SecurityThreatRegisterRow[];
  acceptedRisks: Array<{
    threatId: string;
    rationale: string;
    acceptedBy: string;
    acceptedAt: string;
    evidence: string;
  }>;
  findings: Array<{
    kind: "open-threat" | "missing-control" | "unregistered-flag" | "suspicious-artifact" | "hardening-follow-up" | "none";
    severity: ReviewFindingSeverity | "none";
    threatId: string;
    evidence: string;
    recommendation: string;
    status: "open" | "follow-up" | "accepted" | "closed" | "none";
  }>;
  manualOrDeferredWork: Array<{
    item: string;
    reason: string;
    followUp: string;
    status: SecurityManualStatus;
  }>;
  gapRoutes: Array<{
    gap: string;
    evidence: string;
    repair: string;
    status: SecurityGapStatus;
  }>;
  followUps: string[];
  auditTrail: {
    auditDate: string;
    executionMode: "inline" | "security-auditor-assisted";
    overwriteGate: "none" | "confirmed" | "reused" | "not-needed";
    verifyOrAcceptDecision: "none" | "verified" | "accepted" | "pending";
    pendingOpenThreatStatus: "none" | "verifying" | "accepted" | "still-open";
    verifierNote: string;
  };
  nextSafeAction: string;
};

type SecurityAuthoringContext = {
  phase: ReviewScopePhase;
  path: string;
  completedSummaries: string[];
  pendingPlans: string[];
  declaredThreats: SecurityDeclaredThreat[];
  summaryThreatFlags: SecuritySummaryThreatFlag[];
  knownEvidenceArtifacts: string[];
  existingSecurity: string | null;
  allowedNextActions: string[];
  completedNextSafeAction: string;
  partialNextSafeAction: string;
  blockedNextSafeAction: string;
  schemaPath: string;
  baseSchema: Record<string, unknown>;
  taskSchema: Record<string, unknown>;
};

type ReviewDiagnosticSource = "scope" | "schema" | "residual" | "markdown";

type ReviewModelDiagnostic = {
  source: ReviewDiagnosticSource;
  path: string;
  code: string;
  message: string;
  context: Record<string, unknown>;
  suggestion: string;
};

type ReviewValidateModelArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact?: "code-review" | "security";
  files?: string[];
  depth?: ReviewDepth;
  model: unknown;
};

type ReviewValidateModelResult = {
  status: "valid" | "invalid";
  valid: boolean;
  phase: ReviewScopeResult["phase"];
  files: string[];
  reviewMode: ReviewScopeResult["reviewMode"];
  schemaPath: string | null;
  taskSchema: Record<string, unknown> | null;
  diagnostics: ReviewModelDiagnostic[];
  diagnosticCounts: {
    total: number;
    bySource: Record<ReviewDiagnosticSource, number>;
    byCode: Record<string, number>;
  };
  normalizedModel: CodeReviewStructuredModel | SecurityStructuredModel | null;
  renderPreview: string | null;
  warnings: string[];
};

type ReviewAuthoringContextArgs = {
  cwd?: string;
  phase?: NumericInput;
  artifact: "code-review" | "security";
  files?: string[];
  depth?: ReviewDepth;
};

type ReviewAuthoringContextResult = {
  status: "ready" | "invalid";
  artifact: "code-review" | "security";
  phase: ReviewScopePhase | null;
  files: string[];
  reviewMode: ReviewScopeResult["reviewMode"] | null;
  schemaPath: string | null;
  baseSchema: Record<string, unknown> | null;
  taskSchema: Record<string, unknown> | null;
  modelOnly: boolean;
  authoringContext: CodeReviewAuthoringContext | SecurityAuthoringContext | null;
  prerequisiteBlockers: string[];
  reason: string | null;
  warnings: string[];
};

const REVIEW_ARTIFACT_SUFFIXES: Record<ReviewArtifactKind, string> = {
  "code-review": "-REVIEW.md",
  "peer-review": "-REVIEWS.md",
  "review-fix": "-REVIEW-FIX.md",
  security: "-SECURITY.md",
  "ui-review": "-UI-REVIEW.md"
};

const numericBlueprintInputSchema = z.union([z.string(), z.number()]);

const reviewRecordInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum([
    "code-review",
    "peer-review",
    "review-fix",
    "security",
    "ui-review"
  ]),
  content: z.string().optional(),
  model: z.unknown().optional(),
  overwrite: z.boolean().optional(),
  scopeFiles: z.array(z.string()).optional(),
  scopeSource: z
    .enum(["explicit-files", "phase-plans", "phase-summaries", "phase-evidence"])
    .optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional()
};

const reviewScopeInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  files: z.array(z.string()).optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
  includeAuthoringContext: z.boolean().optional()
};

const reviewLoadFindingsInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z
    .enum(["code-review", "peer-review", "review-fix", "security", "ui-review"])
    .optional()
};

const reviewValidateModelInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["code-review", "security"]).optional(),
  files: z.array(z.string()).optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
  model: z.unknown()
};

const reviewAuthoringContextInputSchema = {
  cwd: z.string().optional(),
  phase: numericBlueprintInputSchema.optional(),
  artifact: z.enum(["code-review", "security"]),
  files: z.array(z.string()).optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional()
};

const CODE_REVIEW_MODEL_IDENTITY_KEYS = new Set([
  "cwd",
  "phase",
  "phaseNumber",
  "phasePrefix",
  "phaseName",
  "phaseDir",
  "artifact",
  "path",
  "reportPath",
  "content"
]);

const SECURITY_MODEL_IDENTITY_KEYS = new Set([
  "cwd",
  "phase",
  "phaseNumber",
  "phasePrefix",
  "phaseName",
  "phaseDir",
  "artifact",
  "path",
  "reportPath",
  "content",
  "summaryPath",
  "summaryPaths",
  "linkedPlanPath",
  "planPath",
  "planPaths",
  "threatCounts"
]);

const CODE_REVIEW_LOCATION_PATTERN =
  /^((?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+):(\d+)(?:-(\d+))?$/;
const CODE_REVIEW_NEXT_ACTION_BUILDERS = [
  (phaseNumber: string) => `/blu-code-review-fix ${phaseNumber}`,
  (phaseNumber: string) => `/blu-secure-phase ${phaseNumber}`,
  (phaseNumber: string) => `/blu-verify-work ${phaseNumber}`,
  (phaseNumber: string) => `/blu-add-tests ${phaseNumber}`,
  (phaseNumber: string) => `/blu-validate-phase ${phaseNumber}`,
  () => "/blu-progress"
] as const;

function createAjvValidator(): Ajv2020 {
  return new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: true
  });
}

type CommandCatalogResult = {
  commands: Record<string, { implemented: boolean }>;
};

let implementedCommandNamesPromise: Promise<Set<string> | null> | null = null;

function normalizeTextContent(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function collectModelStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectModelStringValues(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap((item) => collectModelStringValues(item));
  }

  return [];
}

function collectModelStringEntries(
  value: unknown,
  pathValue = "model"
): Array<{ path: string; value: string }> {
  if (typeof value === "string") {
    return [{ path: pathValue, value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectModelStringEntries(item, `${pathValue}[${index}]`)
    );
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      collectModelStringEntries(item, `${pathValue}.${key}`)
    );
  }

  return [];
}

function cloneJsonObject<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function modelDiagnostic(args: ReviewModelDiagnostic): ReviewModelDiagnostic {
  return args;
}

function emptyDiagnosticCounts(): ReviewValidateModelResult["diagnosticCounts"] {
  return {
    total: 0,
    bySource: {
      scope: 0,
      schema: 0,
      residual: 0,
      markdown: 0
    },
    byCode: {}
  };
}

function countDiagnostics(
  diagnostics: ReviewModelDiagnostic[]
): ReviewValidateModelResult["diagnosticCounts"] {
  const counts = emptyDiagnosticCounts();

  for (const diagnostic of diagnostics) {
    counts.total += 1;
    counts.bySource[diagnostic.source] += 1;
    counts.byCode[diagnostic.code] = (counts.byCode[diagnostic.code] ?? 0) + 1;
  }

  return counts;
}

function formatReviewDiagnostic(diagnostic: ReviewModelDiagnostic): string {
  return `${diagnostic.source}:${diagnostic.path}:${diagnostic.code}: ${diagnostic.message} Suggestion: ${diagnostic.suggestion}`;
}

function renderBulletList(items: string[], fallback = "none"): string {
  const lines = items.map((item) => item.trim()).filter((item) => item.length > 0);

  if (lines.length === 0) {
    return `- ${fallback}`;
  }

  return lines.map((item) => `- ${item}`).join("\n");
}

function isGenericNoneValue(value: string): boolean {
  return /^(?:none|n\/a|na|not applicable)$/i.test(value.trim());
}

function hasPlaceholderLanguage(value: string): boolean {
  return /\b(?:todo|tbd|placeholder|replace me|fill in|insert here|coming soon)\b/i.test(value);
}

async function getImplementedCommandNames(): Promise<Set<string> | null> {
  if (!implementedCommandNamesPromise) {
    implementedCommandNamesPromise = (async () => {
      try {
        const projectModule = (await import("./project.js")) as {
          blueprintCommandCatalog: () => Promise<CommandCatalogResult>;
        };
        const catalog = await projectModule.blueprintCommandCatalog();
        const implementedCommands = new Set(
          Object.entries(catalog.commands)
            .filter(([, entry]) => entry.implemented)
            .map(([commandName]) => blueprintDirectCommand(commandName).toLowerCase())
        );

        if (
          !implementedCommands.has("/blu-progress") ||
          !implementedCommands.has("/blu-code-review")
        ) {
          return null;
        }

        return implementedCommands;
      } catch {
        return null;
      }
    })();
  }

  return implementedCommandNamesPromise;
}

function extractBlueprintDirectCommands(value: string): string[] {
  return [
    ...new Set(
      [...value.matchAll(/\/blu-[a-z0-9-]+/gi)].map((match) =>
        match[0].toLowerCase()
      )
    )
  ];
}

async function validateImplementedNextSafeAction(
  value: string,
  sourceLabel = "Code-review model nextSafeAction"
): Promise<string[]> {
  const commands = extractBlueprintDirectCommands(value);

  if (commands.length === 0) {
    return [
      `${sourceLabel} must contain a direct Blueprint command such as /blu-progress.`
    ];
  }

  const implementedCommands = await getImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return [
      `${sourceLabel} could not be checked because the implemented command catalog was unavailable.`
    ];
  }

  const nonImplementedCommands = commands.filter(
    (command) => !implementedCommands.has(command)
  );

  if (nonImplementedCommands.length > 0) {
    return [
      `${sourceLabel} points to non-implemented command(s): ${nonImplementedCommands.join(", ")}.`
    ];
  }

  return [];
}

async function buildAllowedCodeReviewNextActions(phaseNumber: string): Promise<string[]> {
  const candidates = CODE_REVIEW_NEXT_ACTION_BUILDERS.map((buildAction) =>
    buildAction(phaseNumber)
  );
  const implementedCommands = await getImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return candidates;
  }

  return candidates.filter((action) =>
    extractBlueprintDirectCommands(action).every((command) =>
      implementedCommands.has(command)
    )
  );
}

function escapePatternLiteral(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function buildScopedLocationPattern(scopeFiles: string[]): string {
  const filePattern =
    scopeFiles.length === 0
      ? "(?:(?:[A-Za-z0-9._-]+/)+[A-Za-z0-9._-]+(?:\\.[A-Za-z0-9._-]+)?|[A-Za-z0-9._-]*\\.[A-Za-z0-9._-]+)"
      : `(?:${scopeFiles.map(escapePatternLiteral).join("|")})`;

  return `^${filePattern}:\\d+(?:-\\d+)?$`;
}

function buildTaskLocationSchema(scopeFiles: string[]): Record<string, unknown> {
  return {
    type: "string",
    description:
      "Repo-relative file:line or file:line-line citation narrowed to the resolved review scope.",
    pattern: buildScopedLocationPattern(scopeFiles),
    examples: scopeFiles.slice(0, 1).map((scopeFile) => `${scopeFile}:1`)
  };
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getJsonObjectProperty(
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  return asJsonObject(value[key]);
}

function buildCodeReviewTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  scopeFiles: string[];
  knownEvidenceArtifacts: string[];
  allowedNextActions: string[];
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");
  const defs = getJsonObjectProperty(schema, "$defs");
  const finding = defs ? getJsonObjectProperty(defs, "finding") : null;
  const findingProperties = finding ? getJsonObjectProperty(finding, "properties") : null;
  const location = findingProperties ? getJsonObjectProperty(findingProperties, "location") : null;

  if (properties) {
    const nextSafeAction = getJsonObjectProperty(properties, "nextSafeAction");
    if (nextSafeAction) {
      nextSafeAction.enum = args.allowedNextActions;
    }

    properties.evidenceCoverage = {
      type: "object",
      description:
        "Exhaustive coverage decisions for the exact known evidence artifacts in this phase.",
      additionalProperties: false,
      required: args.knownEvidenceArtifacts,
      properties: Object.fromEntries(
        args.knownEvidenceArtifacts.map((artifactPath) => [
          artifactPath,
          { $ref: "#/$defs/evidenceCoverageEntry" }
        ])
      )
    };
  }

  if (location) {
    for (const key of Object.keys(location)) {
      delete location[key];
    }
    Object.assign(location, buildTaskLocationSchema(args.scopeFiles));
  }

  return schema;
}

async function buildCodeReviewAuthoringContext(args: {
  phase: ReviewScopePhase;
  files: string[];
  reviewMode: ReviewScopeResult["reviewMode"];
  knownEvidenceArtifacts: string[];
}): Promise<CodeReviewAuthoringContext> {
  const modelContract = readArtifactContract("review.code-review").modelContract;

  if (!modelContract) {
    throw new Error("review.code-review does not expose a modelContract.");
  }
  if (!modelContract.schemaPath) {
    throw new Error("review.code-review modelContract does not expose a schemaPath.");
  }

  const allowedNextActions = await buildAllowedCodeReviewNextActions(args.phase.phaseNumber);
  const baseSchema = cloneJsonObject(modelContract.jsonSchema);
  const taskSchema = buildCodeReviewTaskSchema({
    baseSchema,
    scopeFiles: args.files,
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    allowedNextActions
  });

  return {
    phase: args.phase,
    files: [...args.files],
    reviewMode: { ...args.reviewMode },
    knownEvidenceArtifacts: [...args.knownEvidenceArtifacts],
    allowedNextActions,
    schemaPath: modelContract.schemaPath,
    baseSchema,
    taskSchema
  };
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function exactObjectPropertyContains(
  propertyName: string,
  value: string
): Record<string, unknown> {
  return {
    contains: {
      type: "object",
      required: [propertyName],
      properties: {
        [propertyName]: { const: value }
      }
    },
    minContains: 1,
    maxContains: 1
  };
}

function exactArraySentinel(schema: Record<string, unknown>): Record<string, unknown> {
  return {
    minItems: 1,
    maxItems: 1,
    items: schema
  };
}

async function buildAllowedSecurityNextActions(args: {
  phaseNumber: string;
  artifacts: {
    verification: string | null;
    uat: string | null;
  };
}): Promise<{
  completedNextSafeAction: string;
  partialNextSafeAction: string;
  blockedNextSafeAction: string;
  allowedNextActions: string[];
}> {
  const completedCandidate =
    args.artifacts.verification === null
      ? `/blu-validate-phase ${args.phaseNumber}`
      : args.artifacts.uat === null
        ? `/blu-verify-work ${args.phaseNumber}`
        : "/blu-progress";
  const partialCandidate = "/blu-progress";
  const blockedNextSafeAction = "Blocked: pending-open-threat";
  const implementedCommands = await getImplementedCommandNames();
  const implementedOrProgress = (candidate: string): string => {
    if (implementedCommands === null || implementedCommands.size === 0) {
      return candidate;
    }

    const commands = extractBlueprintDirectCommands(candidate);

    return commands.length > 0 && commands.every((command) => implementedCommands.has(command))
      ? candidate
      : "/blu-progress";
  };
  const completedNextSafeAction = implementedOrProgress(completedCandidate);
  const partialNextSafeAction = implementedOrProgress(partialCandidate);

  return {
    completedNextSafeAction,
    partialNextSafeAction,
    blockedNextSafeAction,
    allowedNextActions: uniqueSortedStrings([
      completedNextSafeAction,
      partialNextSafeAction,
      blockedNextSafeAction
    ])
  };
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutLeadingPipe = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutOuterPipes = withoutLeadingPipe.endsWith("|")
    ? withoutLeadingPipe.slice(0, -1)
    : withoutLeadingPipe;
  const cells: string[] = [];
  let current = "";

  for (let index = 0; index < withoutOuterPipes.length; index += 1) {
    const char = withoutOuterPipes[index];
    const next = withoutOuterPipes[index + 1];

    if (char === "\\" && next === "|") {
      current += "|";
      index += 1;
      continue;
    }

    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());

  return cells;
}

function isMarkdownTableSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdownTableRows(section: string): string[][] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .map(splitMarkdownTableRow)
    .filter((cells) => cells.length > 0)
    .filter((cells) => !isMarkdownTableSeparatorRow(cells));
}

function normalizeThreatCell(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeThreatId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/`/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : fallback;
}

function isThreatIdSentinel(value: string): boolean {
  const normalized = value
    .trim()
    .replace(/^`+|`+$/g, "")
    .replace(/\s+/g, " ");

  return /^(?:none|n\/a|na)$/i.test(normalized);
}

function looksLikeExplicitThreatId(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9._-]*-\d[A-Za-z0-9._-]*$/.test(
    value.trim().replace(/^`+|`+$/g, "")
  );
}

function extractThreatModelContent(content: string): string[] {
  const blockSections = [...content.matchAll(/<threat_model\b[^>]*>([\s\S]*?)<\/threat_model>/gi)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((section) => section.length > 0);

  if (blockSections.length > 0) {
    return blockSections;
  }

  return extractMarkdownSectionContent(
    content,
    /^(?:threat model|threat register|security threats?|security model)$/i
  );
}

function planThreatIdPrefix(sourcePlan: string): string {
  return sourcePlan.match(/(?:^|\/)(\d+(?:-\d+)*)-PLAN\.md$/)?.[1] ?? "plan";
}

function disambiguateDeclaredThreatIds(threats: SecurityDeclaredThreat[]): SecurityDeclaredThreat[] {
  const seen = new Set<string>();

  return threats.map((threat) => {
    if (!seen.has(threat.threatId)) {
      seen.add(threat.threatId);
      return threat;
    }

    const baseThreatId = `${planThreatIdPrefix(threat.sourcePlan)}-${threat.threatId}`;
    let uniqueThreatId = baseThreatId;
    let suffix = 2;

    while (seen.has(uniqueThreatId)) {
      uniqueThreatId = `${baseThreatId}-${suffix}`;
      suffix += 1;
    }

    seen.add(uniqueThreatId);

    return {
      ...threat,
      threatId: uniqueThreatId
    };
  });
}

function parseThreatRowsFromPlanContent(content: string, sourcePlan: string): SecurityDeclaredThreat[] {
  const sections = extractThreatModelContent(content);
  const threats: SecurityDeclaredThreat[] = [];

  for (const section of sections) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length > 0) {
      const header = tableRows[0].map((cell) =>
        cell.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
      );
      const rows = header.some((cell) => cell === "threat id" || cell === "id")
        ? tableRows.slice(1)
        : tableRows;
      const findIndex = (patterns: RegExp[], fallback: number): number => {
        const index = header.findIndex((cell) => patterns.some((pattern) => pattern.test(cell)));
        return index >= 0 ? index : fallback;
      };
      const threatIdIndex = findIndex([/^(?:threat )?id$/], 0);
      const categoryIndex = findIndex([/^category$/, /^stride$/], 1);
      const componentIndex = findIndex([/^component$/, /^surface$/, /^boundary$/], 2);
      const dispositionIndex = findIndex([/^disposition$/, /^decision$/], 3);
      const mitigationIndex = findIndex([/^mitigation$/, /^control$/, /^evidence$/], 4);

      rows.forEach((row, index) => {
        const fallbackId = `T-${String(threats.length + index + 1).padStart(2, "0")}`;
        const rawThreatId = row[threatIdIndex] ?? "";

        if (isThreatIdSentinel(rawThreatId)) {
          return;
        }

        const threatId = normalizeThreatId(rawThreatId, fallbackId);

        threats.push({
          threatId,
          sourcePlan,
          category: normalizeThreatCell(row[categoryIndex] ?? "", "unspecified"),
          component: normalizeThreatCell(row[componentIndex] ?? "", "unspecified"),
          disposition: normalizeThreatCell(row[dispositionIndex] ?? "", "mitigate"),
          mitigation: normalizeThreatCell(row[mitigationIndex] ?? "", "No mitigation text found in the saved plan.")
        });
      });

      continue;
    }

    const bullets = collectListItems(section);
    bullets.forEach((item, index) => {
      const rawMatch = item.match(/^`?([^`:\-]+?)`?\s*[:\-]\s*(.+)$/);

      if (rawMatch && isThreatIdSentinel(rawMatch[1])) {
        return;
      }

      if (!rawMatch && isThreatIdSentinel(item)) {
        return;
      }

      const match = item.match(/^`?([A-Za-z0-9._-]+)`?\s*[:\-]\s*(.+)$/);
      const threatId = normalizeThreatId(match?.[1] ?? "", `T-${String(index + 1).padStart(2, "0")}`);
      const mitigation = normalizeThreatCell(match?.[2] ?? item, "No mitigation text found in the saved plan.");

      if (match && isThreatIdSentinel(match[1])) {
        return;
      }

      threats.push({
        threatId,
        sourcePlan,
        category: "unspecified",
        component: "unspecified",
        disposition: "mitigate",
        mitigation
      });
    });
  }

  return disambiguateDeclaredThreatIds(threats);
}

function normalizeMarkdownHeaderCell(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findHeaderIndex(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function parsePotentialThreatFlagId(value: string, headerImpliesThreatId: boolean): string | null {
  const raw = value.trim();

  if (raw.length === 0 || isThreatIdSentinel(raw)) {
    return null;
  }

  if (!headerImpliesThreatId && !looksLikeExplicitThreatId(raw)) {
    return null;
  }

  const normalized = normalizeThreatId(raw, "");

  return normalized.length > 0 ? normalized : null;
}

function parseThreatFlagsFromSummaryContent(
  content: string,
  sourceSummary: string
): SecuritySummaryThreatFlag[] {
  const flags: SecuritySummaryThreatFlag[] = [];

  for (const section of extractMarkdownSectionContent(content, /^Threat Flags?$/i)) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length > 0) {
      const header = tableRows[0].map(normalizeMarkdownHeaderCell);
      const hasHeader = header.some((cell) =>
        /^(?:threat id|id|flag|finding|evidence|summary|description|status)$/.test(cell)
      );
      const rows = hasHeader ? tableRows.slice(1) : tableRows;
      const threatIdIndex = hasHeader
        ? findHeaderIndex(header, [/^(?:threat )?id$/])
        : -1;
      const evidenceIndex = hasHeader
        ? findHeaderIndex(header, [/^flag$/, /^finding$/, /^evidence$/, /^summary$/, /^description$/, /^notes?$/])
        : -1;

      rows.forEach((row) => {
        if (row.every((cell) => isPlaceholderReviewListItem(cell))) {
          return;
        }

        const fallbackEvidence = row.filter((cell) => cell.trim().length > 0).join(" | ");
        const evidence = normalizeThreatCell(
          row[evidenceIndex >= 0 ? evidenceIndex : threatIdIndex >= 0 ? Math.min(threatIdIndex + 1, row.length - 1) : 0] ??
            fallbackEvidence,
          fallbackEvidence
        );
        const threatId = parsePotentialThreatFlagId(
          threatIdIndex >= 0 ? row[threatIdIndex] ?? "" : row[0] ?? "",
          threatIdIndex >= 0
        );

        if (evidence.length === 0 || isPlaceholderReviewListItem(evidence)) {
          return;
        }

        flags.push({
          flagId: `${sourceSummary}#TF-${String(flags.length + 1).padStart(2, "0")}`,
          sourceSummary,
          threatId,
          evidence
        });
      });

      continue;
    }

    for (const item of collectListItems(section)) {
      if (isPlaceholderReviewListItem(item)) {
        continue;
      }

      const match =
        item.match(/^`?([A-Za-z][A-Za-z0-9._-]*-\d[A-Za-z0-9._-]*)`?\s*[:\-]\s*(.+)$/) ??
        item.match(/^(?:threat\s+)?`?([A-Za-z][A-Za-z0-9._-]*-\d[A-Za-z0-9._-]*)`?\s*[:\-]\s*(.+)$/i);
      const threatId = match ? parsePotentialThreatFlagId(match[1], false) : null;
      const evidence = normalizeThreatCell(match?.[2] ?? item, item);

      flags.push({
        flagId: `${sourceSummary}#TF-${String(flags.length + 1).padStart(2, "0")}`,
        sourceSummary,
        threatId,
        evidence
      });
    }
  }

  return flags;
}

function buildSecurityTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  declaredThreats: SecurityDeclaredThreat[];
  summaryThreatFlags: SecuritySummaryThreatFlag[];
  knownEvidenceArtifacts: string[];
  allowedNextActions: string[];
  completedNextSafeAction: string;
  partialNextSafeAction: string;
  blockedNextSafeAction: string;
  allowCompleted: boolean;
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");
  const defs = getJsonObjectProperty(schema, "$defs");

  if (properties) {
    const status = getJsonObjectProperty(properties, "status");
    if (status && !args.allowCompleted) {
      status.enum = ["PARTIAL", "BLOCKED"];
    }

    const evidenceCoverage = getJsonObjectProperty(properties, "evidenceCoverage");
    if (evidenceCoverage) {
      evidenceCoverage.additionalProperties = false;
      evidenceCoverage.required = args.knownEvidenceArtifacts;
      evidenceCoverage.properties = Object.fromEntries(
        args.knownEvidenceArtifacts.map((artifactPath) => [
          artifactPath,
          { $ref: "#/$defs/evidenceCoverageEntry" }
        ])
      );
    }

    const threatRegister = getJsonObjectProperty(properties, "threatRegister");
    if (threatRegister) {
      if (args.declaredThreats.length === 0) {
        Object.assign(threatRegister, exactArraySentinel({ $ref: "#/$defs/noThreatRow" }));
      } else {
        threatRegister.minItems = args.declaredThreats.length;
        threatRegister.maxItems = args.declaredThreats.length;
        const items = getJsonObjectProperty(threatRegister, "items");
        const oneOf = Array.isArray(items?.oneOf) ? items.oneOf : null;
        const realThreatRow = oneOf
          ? oneOf.find((candidate) => asJsonObject(candidate)?.$ref === "#/$defs/threatRegisterRow")
          : null;
        const threatRowSchema = asJsonObject(realThreatRow);
        const threatRow = threatRowSchema
          ? getJsonObjectProperty(defs ?? {}, "threatRegisterRow")
          : getJsonObjectProperty(defs ?? {}, "threatRegisterRow");
        const threatProperties = threatRow ? getJsonObjectProperty(threatRow, "properties") : null;
        const threatId = threatProperties ? getJsonObjectProperty(threatProperties, "threatId") : null;

        if (threatId) {
          threatId.enum = args.declaredThreats.map((threat) => threat.threatId);
        }
        threatRegister.allOf = args.declaredThreats.map((threat) =>
          exactObjectPropertyContains("threatId", threat.threatId)
        );
      }
    }

    const acceptedRisks = getJsonObjectProperty(properties, "acceptedRisks");
    const findings = getJsonObjectProperty(properties, "findings");
    const threatIdEnum = args.declaredThreats.map((threat) => threat.threatId);

    for (const definitionName of ["acceptedRiskRow", "findingRow"] as const) {
      const definition = getJsonObjectProperty(defs ?? {}, definitionName);
      const definitionProperties = definition ? getJsonObjectProperty(definition, "properties") : null;
      const threatId = definitionProperties ? getJsonObjectProperty(definitionProperties, "threatId") : null;

      if (threatId && threatIdEnum.length > 0) {
        threatId.enum = definitionName === "findingRow"
          ? [...threatIdEnum, "unregistered"]
          : threatIdEnum;
      } else if (threatId && definitionName === "findingRow") {
        threatId.enum = ["unregistered"];
      }
    }

    if (acceptedRisks && threatIdEnum.length === 0) {
      Object.assign(acceptedRisks, exactArraySentinel({ $ref: "#/$defs/noAcceptedRiskRow" }));
    }
    if (findings && threatIdEnum.length === 0) {
      findings.minItems = 1;
    }

    const nextSafeAction = getJsonObjectProperty(properties, "nextSafeAction");
    if (nextSafeAction) {
      nextSafeAction.enum = args.allowedNextActions;
    }
  }

  const existingAllOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  schema.allOf = [
    ...existingAllOf,
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "COMPLETED" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.completedNextSafeAction }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "PARTIAL" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.partialNextSafeAction }
        }
      }
    },
    {
      if: {
        required: ["status"],
        properties: {
          status: { const: "BLOCKED" }
        }
      },
      then: {
        properties: {
          nextSafeAction: { const: args.blockedNextSafeAction }
        }
      }
    }
  ];

  schema["x-blueprint-runtimeContext"] = {
    declaredThreats: args.declaredThreats,
    summaryThreatFlags: args.summaryThreatFlags,
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    completedNextSafeAction: args.completedNextSafeAction,
    partialNextSafeAction: args.partialNextSafeAction,
    blockedNextSafeAction: args.blockedNextSafeAction,
    allowCompleted: args.allowCompleted
  };

  return schema;
}

async function buildSecurityAuthoringContext(args: {
  projectRoot: string;
  phase?: NumericInput;
}): Promise<ReviewAuthoringContextResult> {
  const located = await blueprintPhaseLocate({
    cwd: args.projectRoot,
    phase: args.phase
  });
  const modelContract = readArtifactContract("review.security").modelContract;
  const baseSchema = modelContract ? cloneJsonObject(modelContract.jsonSchema) : null;

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    const reason = located.reason ?? "Phase could not be resolved for security authoring.";

    return {
      status: "invalid",
      artifact: "security",
      phase: null,
      files: [],
      reviewMode: null,
      schemaPath: modelContract?.schemaPath ?? null,
      baseSchema,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: located.warnings
    };
  }

  if (!modelContract || !modelContract.schemaPath) {
    const reason = "review.security does not expose a modelContract schema path.";

    return {
      status: "invalid",
      artifact: "security",
      phase: null,
      files: [],
      reviewMode: null,
      schemaPath: modelContract?.schemaPath ?? null,
      baseSchema,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: located.warnings
    };
  }

  const phaseNumber = located.phaseNumber;
  const securityBaseSchema = cloneJsonObject(modelContract.jsonSchema);
  const phase: ReviewScopePhase = {
    phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName:
      located.phaseName ??
      `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
    phaseDir: located.phaseDir,
    resolvedFrom: located.resolvedFrom
  };
  const artifacts = {
    plans: located.artifacts
      .filter((artifact) => artifact.endsWith("-PLAN.md"))
      .sort((left, right) => left.localeCompare(right)),
    summaries: located.artifacts
      .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      .sort((left, right) => left.localeCompare(right)),
    verification: findPhaseArtifact(located.artifacts, "-VERIFICATION.md"),
    uat: findPhaseArtifact(located.artifacts, "-UAT.md"),
    existingSecurity: findPhaseArtifact(located.artifacts, "-SECURITY.md")
  };
  const [planIndex, summaryIndex, executionTargets] = await Promise.all([
    blueprintPhasePlanIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseSummaryIndex({
      cwd: args.projectRoot,
      phase: phaseNumber
    }),
    blueprintPhaseExecutionTargets({
      cwd: args.projectRoot,
      phase: phaseNumber
    })
  ]);
  const completedSummaries = summaryIndex.summaries
    .filter((summary) => summaryIndex.completedPlans.includes(summary.planId))
    .map((summary) => summary.path)
    .sort((left, right) => left.localeCompare(right));
  const blockers: string[] = [];

  if (planIndex.plans.length === 0) {
    blockers.push(
      `Phase ${phaseNumber} has no saved PLAN artifacts, so review.security cannot bind to plan provenance.`
    );
  }

  if (completedSummaries.length === 0) {
    blockers.push(
      `Phase ${phaseNumber} has no valid completed SUMMARY artifacts. Run /blu-execute-phase ${phaseNumber} before /blu-secure-phase.`
    );
  }

  if (summaryIndex.pendingPlans.length > 0) {
    blockers.push(
      `Phase ${phaseNumber} still has pending execution plans: ${summaryIndex.pendingPlans.join(", ")}. Run /blu-execute-phase ${phaseNumber} before persisting security evidence.`
    );
  }

  if (executionTargets.blockers.lowerWavePendingPlanIds.length > 0) {
    blockers.push(
      `Lower-wave pending plans block full security coverage: ${executionTargets.blockers.lowerWavePendingPlanIds.join(", ")}.`
    );
  }

  const planReads = await Promise.all(
    planIndex.plans.map((plan) =>
      blueprintPhasePlanRead({
        cwd: args.projectRoot,
        phase: phaseNumber,
        planId: plan.planId
      })
    )
  );
  const summaryReads = await Promise.all(
    summaryIndex.completedPlans.map((planId) =>
      blueprintPhaseSummaryRead({
        cwd: args.projectRoot,
        phase: phaseNumber,
        planId
      })
    )
  );

  for (const planRead of planReads) {
    if (!planRead.found || !planRead.path) {
      blockers.push(planRead.reason ?? "A saved plan could not be read for security provenance.");
      continue;
    }

    if (!planRead.validation?.valid) {
      const issues = planRead.validation?.issues.length
        ? planRead.validation.issues
        : ["Linked plan artifact is invalid."];
      blockers.push(...issues.map((issue) => `${planRead.path}: ${issue}`));
    }
  }

  for (const summaryRead of summaryReads) {
    if (!summaryRead.found || !summaryRead.path) {
      blockers.push(summaryRead.reason ?? "A completed summary could not be read for security evidence.");
      continue;
    }

    if (!summaryRead.validation?.valid) {
      const issues = summaryRead.validation?.issues.length
        ? summaryRead.validation.issues
        : ["Completed summary artifact is invalid."];
      blockers.push(...issues.map((issue) => `${summaryRead.path}: ${issue}`));
    }
  }

  const declaredThreats = disambiguateDeclaredThreatIds(
    planReads.flatMap((planRead) =>
      planRead.path && planRead.content
        ? parseThreatRowsFromPlanContent(planRead.content, planRead.path)
        : []
    )
  );
  const summaryThreatFlags = summaryReads.flatMap((summaryRead) =>
    summaryRead.path && summaryRead.content
      ? parseThreatFlagsFromSummaryContent(summaryRead.content, summaryRead.path)
      : []
  );
  const knownEvidenceArtifacts = uniqueSortedStrings([
    ...planIndex.plans.map((plan) => plan.path),
    ...completedSummaries,
    ...(artifacts.verification ? [artifacts.verification] : []),
    ...(artifacts.uat ? [artifacts.uat] : [])
  ]);
  const allowedNextActions = await buildAllowedSecurityNextActions({
    phaseNumber,
    artifacts
  });
  const taskSchema =
    blockers.length === 0
      ? buildSecurityTaskSchema({
          baseSchema: securityBaseSchema,
          declaredThreats,
          summaryThreatFlags,
          knownEvidenceArtifacts,
          allowCompleted: declaredThreats.length > 0,
          ...allowedNextActions
        })
      : null;
  const authoringContext: SecurityAuthoringContext | null = taskSchema
    ? {
        phase,
        path: `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES.security}`,
        completedSummaries,
        pendingPlans: summaryIndex.pendingPlans,
        declaredThreats,
        summaryThreatFlags,
        knownEvidenceArtifacts,
        existingSecurity: artifacts.existingSecurity,
        ...allowedNextActions,
        schemaPath: modelContract.schemaPath,
        baseSchema: securityBaseSchema,
        taskSchema
      }
    : null;

  return {
    status: blockers.length === 0 ? "ready" : "invalid",
    artifact: "security",
    phase,
    files: [],
    reviewMode: null,
    schemaPath: modelContract.schemaPath,
    baseSchema: securityBaseSchema,
    taskSchema,
    modelOnly: true,
    authoringContext,
    prerequisiteBlockers: blockers,
    reason: blockers.length > 0 ? blockers.join(" ") : null,
    warnings: uniqueSortedStrings([
      ...located.warnings,
      ...planIndex.warnings,
      ...summaryIndex.warnings,
      ...executionTargets.warnings
    ])
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function countMarkdownSections(content: string): number {
  return [...content.matchAll(/^##?\s+.+$/gm)].length;
}

function collectListItems(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .flatMap((line) => {
      const checklistMatch = line.match(/^[-*]\s+\[(?: |x|X)\]\s+(.+)$/);

      if (checklistMatch) {
        return [checklistMatch[1].trim()];
      }

      const bulletMatch = line.match(/^[-*+]\s+(.+)$/);

      if (bulletMatch) {
        return [bulletMatch[1].trim()];
      }

      const numberedMatch = line.match(/^\d+\.\s+(.+)$/);

      return numberedMatch ? [numberedMatch[1].trim()] : [];
    })
    .filter((item) => item.length > 0);
}

function extractMarkdownSectionItems(
  content: string,
  headingPattern: RegExp
): string[] {
  const lines = content.split("\n");
  const items: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(##+)\s+(.+)$/);

    if (!headingMatch || !headingPattern.test(headingMatch[2].trim())) {
      continue;
    }

    const sectionLevel = headingMatch[1].length;
    const sectionLines: string[] = [];

    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextHeadingMatch = lines[innerIndex].match(/^(##+)\s+(.+)$/);

      if (nextHeadingMatch && nextHeadingMatch[1].length <= sectionLevel) {
        break;
      }

      sectionLines.push(lines[innerIndex]);
    }

    items.push(...collectListItems(sectionLines.join("\n")));
  }

  return [...new Set(items)];
}

function normalizeReviewListItem(item: string): string {
  return normalizeFindingSummary(item)
    .replace(/^`+|`+$/g, "")
    .replace(/^[\s"'“”‘’()[\]{}<>]+|[\s"'“”‘’()[\]{}<>.,;:!?]+$/g, "")
    .trim()
    .toLowerCase();
}

function hasGlobPattern(candidate: string): boolean {
  return /[*?[\]{}]/.test(candidate);
}

function isPlaceholderReviewListItem(item: string): boolean {
  const normalized = normalizeReviewListItem(item);

  return (
    normalized.length === 0 ||
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "not applicable" ||
    normalized === "no finding" ||
    normalized === "no findings" ||
    normalized === "no follow up" ||
    normalized === "no follow ups" ||
    normalized === "no follow-up" ||
    normalized === "no follow-ups"
  );
}

function collectSubstantiveReviewItems(
  content: string,
  headingPattern: RegExp
): string[] {
  return extractMarkdownSectionItems(content, headingPattern).filter(
    (item) => !isPlaceholderReviewListItem(item)
  );
}

function extractMarkdownSectionContent(
  content: string,
  headingPattern: RegExp
): string[] {
  const lines = content.split("\n");
  const sections: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(##+)\s+(.+)$/);

    if (!headingMatch || !headingPattern.test(headingMatch[2].trim())) {
      continue;
    }

    const sectionLevel = headingMatch[1].length;
    const sectionLines: string[] = [];

    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextHeadingMatch = lines[innerIndex].match(/^(##+)\s+(.+)$/);

      if (nextHeadingMatch && nextHeadingMatch[1].length <= sectionLevel) {
        break;
      }

      sectionLines.push(lines[innerIndex]);
    }

    sections.push(sectionLines.join("\n"));
  }

  return sections;
}

function parseSecurityThreatRegisterFindings(content: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const seenSummaries = new Set<string>();

  for (const section of extractMarkdownSectionContent(content, /^Threat Register$/i)) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length === 0) {
      continue;
    }

    let headers: string[] | null = null;

    for (const cells of tableRows) {
      if (cells.length < 4) {
        continue;
      }

      const normalizedCells = cells.map(normalizeMarkdownHeaderCell);

      if (
        headers === null &&
        normalizedCells.some((cell) => cell === "threat id")
      ) {
        headers = normalizedCells;
        continue;
      }

      const threatIdIndex = headers ? findHeaderIndex(headers, [/^threat id$/]) : -1;
      const dispositionIndex = headers ? findHeaderIndex(headers, [/^disposition$/]) : -1;
      const mitigationIndex = headers ? findHeaderIndex(headers, [/^mitigation$/]) : -1;
      const statusIndex = headers ? findHeaderIndex(headers, [/^status$/]) : -1;
      const evidenceIndex = headers
        ? findHeaderIndex(headers, [/^evidence(?: note)?$/, /^evidence .* note$/])
        : -1;
      const hasRichFallbackShape = cells.length >= 7;

      const threatId = cells[threatIdIndex >= 0 ? threatIdIndex : 0] ?? "";
      const disposition =
        cells[
          dispositionIndex >= 0
            ? dispositionIndex
            : hasRichFallbackShape
              ? 3
              : 1
        ] ?? "";
      const mitigation =
        cells[
          mitigationIndex >= 0
            ? mitigationIndex
            : hasRichFallbackShape
              ? 4
              : -1
        ] ?? "";
      const status =
        cells[
          statusIndex >= 0
            ? statusIndex
            : hasRichFallbackShape
              ? 6
              : 2
        ] ?? "";
      const evidence =
        cells[
          evidenceIndex >= 0
            ? evidenceIndex
            : hasRichFallbackShape
              ? 7
              : 3
        ] ?? "";

      if (
        threatId.length === 0 ||
        threatId === "Threat ID" ||
        !/\bopen\b/i.test(status)
      ) {
        continue;
      }

      const evidenceNote = evidence.length > 0 ? evidence : mitigation;
      const summary = normalizeFindingSummary(
        `Open threat ${threatId}: ${evidenceNote.length > 0 ? evidenceNote : `${disposition} ${status}`}`
      );

      if (summary.length === 0 || seenSummaries.has(summary)) {
        continue;
      }

      seenSummaries.add(summary);
      findings.push({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: "unknown",
        summary,
        sourceSection: "Threat Register"
      });
    }
  }

  return findings;
}

function extractMarkdownSectionEntries(
  content: string,
  headingPattern: RegExp
): Array<{
  heading: string;
  items: string[];
}> {
  const lines = content.split("\n");
  const entries: Array<{
    heading: string;
    items: string[];
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index].match(/^(##+)\s+(.+)$/);

    if (!headingMatch || !headingPattern.test(headingMatch[2].trim())) {
      continue;
    }

    const sectionLevel = headingMatch[1].length;
    const sectionLines: string[] = [];

    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextHeadingMatch = lines[innerIndex].match(/^(##+)\s+(.+)$/);

      if (nextHeadingMatch && nextHeadingMatch[1].length <= sectionLevel) {
        break;
      }

      sectionLines.push(lines[innerIndex]);
    }

    const items = [...new Set(collectListItems(sectionLines.join("\n")))];

    if (items.length > 0) {
      entries.push({
        heading: headingMatch[2].trim(),
        items
      });
    }
  }

  return entries;
}

function emptySeverityCounts(): Record<ReviewFindingSeverity, number> {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0
  };
}

function inferFindingSeverity(
  heading: string,
  item: string
): ReviewFindingSeverity {
  const source = `${heading} ${item}`.toLowerCase();

  if (/\b(?:critical|p0)\b/.test(source)) {
    return "critical";
  }

  if (/\b(?:high|p1)\b/.test(source)) {
    return "high";
  }

  if (/\b(?:medium|p2)\b/.test(source)) {
    return "medium";
  }

  if (/\b(?:low|p3)\b/.test(source)) {
    return "low";
  }

  return "unknown";
}

function normalizeFindingSummary(item: string): string {
  return item
    .replace(
      /^(?:\[(?:critical|high|medium|low|unknown|p[0-3]|blocker|follow-?up|observation|pass)\]\s*)+/i,
      ""
    )
    .replace(/^(?:critical|high|medium|low|p[0-3])\s*[:\-]\s*/i, "")
    .replace(
      /^severity\s*[:\-]\s*(?:critical|high|medium|low|unknown)\s*[:\-]?\s*/i,
      ""
    )
    .trim();
}

function resolveFindingsHeadingPattern(artifact: ReviewArtifactKind): RegExp {
  if (artifact === "review-fix") {
    return /^(findings addressed|findings)$/i;
  }

  return /^(findings?|security findings|risks?|gaps found|unresolved gaps)$/i;
}

function normalizeSecurityFindingSeverity(value: string): ReviewFindingSeverity {
  const normalized = value.toLowerCase();

  return (["critical", "high", "medium", "low", "unknown"] as const).includes(
    normalized as ReviewFindingSeverity
  )
    ? normalized as ReviewFindingSeverity
    : "unknown";
}

function parseSecurityFindingsTableFindings(content: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const seenSummaries = new Set<string>();

  for (const section of extractMarkdownSectionContent(content, /^Findings$/i)) {
    const tableRows = parseMarkdownTableRows(section);

    if (tableRows.length === 0) {
      continue;
    }

    let headers: string[] | null = null;

    for (const cells of tableRows) {
      if (cells.length < 6) {
        continue;
      }

      const normalizedCells = cells.map(normalizeMarkdownHeaderCell);

      if (
        headers === null &&
        normalizedCells.includes("kind") &&
        normalizedCells.includes("severity")
      ) {
        headers = normalizedCells;
        continue;
      }

      const kindIndex = headers ? findHeaderIndex(headers, [/^kind$/]) : 0;
      const severityIndex = headers ? findHeaderIndex(headers, [/^severity$/]) : 1;
      const threatIdIndex = headers ? findHeaderIndex(headers, [/^threat id$/]) : 2;
      const statusIndex = headers ? findHeaderIndex(headers, [/^status$/]) : 3;
      const evidenceIndex = headers ? findHeaderIndex(headers, [/^evidence$/]) : 4;
      const recommendationIndex = headers ? findHeaderIndex(headers, [/^recommendation$/]) : 5;
      const kind = cells[kindIndex >= 0 ? kindIndex : 0] ?? "";
      const severity = cells[severityIndex >= 0 ? severityIndex : 1] ?? "";
      const threatId = cells[threatIdIndex >= 0 ? threatIdIndex : 2] ?? "";
      const status = cells[statusIndex >= 0 ? statusIndex : 3] ?? "";
      const evidence = cells[evidenceIndex >= 0 ? evidenceIndex : 4] ?? "";
      const recommendation = cells[recommendationIndex >= 0 ? recommendationIndex : 5] ?? "";

      if (
        kind === "none" &&
        severity === "none" &&
        threatId === "none" &&
        status === "none" &&
        evidence === "none" &&
        recommendation === "none"
      ) {
        continue;
      }

      if (kind.length === 0 || isPlaceholderReviewListItem(evidence)) {
        continue;
      }

      const summary = normalizeFindingSummary(
        kind === "open-threat"
          ? `Open threat ${threatId}: ${evidence}`
          : `${kind}${threatId && threatId !== "none" ? ` ${threatId}` : ""}: ${evidence}${
              recommendation && !isPlaceholderReviewListItem(recommendation)
                ? ` Recommendation: ${recommendation}`
                : ""
            }`
      );

      if (summary.length === 0 || seenSummaries.has(summary)) {
        continue;
      }

      seenSummaries.add(summary);
      findings.push({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: normalizeSecurityFindingSeverity(severity),
        summary,
        sourceSection: "Findings"
      });
    }
  }

  return findings;
}

function parseFindingsFromArtifact(
  content: string,
  artifact: ReviewArtifactKind
): {
  findings: ReviewFinding[];
  severityCounts: Record<ReviewFindingSeverity, number>;
  followUps: string[];
} {
  const entries = extractMarkdownSectionEntries(content, resolveFindingsHeadingPattern(artifact));
  const findings: ReviewFinding[] = [];
  const seenSummaries = new Set<string>();
  const severityCounts = emptySeverityCounts();

  for (const entry of entries) {
    for (const item of entry.items) {
      if (isPlaceholderReviewListItem(item)) {
        continue;
      }

      const summary = normalizeFindingSummary(item);

      if (summary.length === 0 || seenSummaries.has(summary)) {
        continue;
      }

      const severity = inferFindingSeverity(entry.heading, item);
      seenSummaries.add(summary);
      severityCounts[severity] += 1;
      findings.push({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity,
        summary,
        sourceSection: entry.heading
      });
    }
  }

  if (artifact === "security") {
    for (const tableFinding of parseSecurityFindingsTableFindings(content)) {
      if (seenSummaries.has(tableFinding.summary)) {
        continue;
      }

      seenSummaries.add(tableFinding.summary);
      severityCounts[tableFinding.severity] += 1;
      findings.push({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: tableFinding.severity,
        summary: tableFinding.summary,
        sourceSection: tableFinding.sourceSection
      });
    }

    for (const threatFinding of parseSecurityThreatRegisterFindings(content)) {
      if (seenSummaries.has(threatFinding.summary)) {
        continue;
      }

      seenSummaries.add(threatFinding.summary);
      severityCounts[threatFinding.severity] += 1;
      findings.push({
        id: `F-${String(findings.length + 1).padStart(2, "0")}`,
        severity: threatFinding.severity,
        summary: threatFinding.summary,
        sourceSection: threatFinding.sourceSection
      });
    }
  }

  return {
    findings,
    severityCounts,
    followUps: collectSubstantiveReviewItems(
      content,
      /^(follow-?ups?|follow-up fixes|suggested repairs|recommended fixes|next actions?)$/i
    )
  };
}

function collectReviewCounts(
  content: string,
  artifact: ReviewArtifactKind
): {
  counts: ReviewRecordResult["counts"];
  followUps: string[];
} {
  const parsedFindings = parseFindingsFromArtifact(content, artifact);

  return {
    counts: {
      sections: countMarkdownSections(content),
      findings: parsedFindings.findings.length,
      followUps: parsedFindings.followUps.length
    },
    followUps: parsedFindings.followUps
  };
}

type LocatedReviewPhase = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName?: string | null;
  phaseDir: string;
  artifacts: string[];
};

function reviewRecordInvalidResult(args: {
  located: LocatedReviewPhase;
  artifact: ReviewArtifactKind;
  reportPath: string;
  counts?: ReviewRecordResult["counts"];
  followUps?: string[];
  warnings: string[];
}): ReviewRecordResult {
  return {
    phaseNumber: args.located.phaseNumber,
    phasePrefix: args.located.phasePrefix,
    phaseName: args.located.phaseName ?? `Phase ${args.located.phasePrefix}`,
    phaseDir: args.located.phaseDir,
    artifact: args.artifact,
    reportPath: args.reportPath,
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    counts:
      args.counts ?? {
        sections: 0,
        findings: 0,
        followUps: 0
      },
    followUps: args.followUps ?? [],
    warnings: args.warnings
  };
}

function collectKnownCodeReviewEvidenceArtifacts(
  located: LocatedReviewPhase,
  reportPath: string
): string[] {
  return located.artifacts
    .filter((artifactPath) => artifactPath !== reportPath)
    .filter((artifactPath) =>
      /-(?:PLAN|SUMMARY|VERIFICATION|UAT|SECURITY)\.md$/i.test(artifactPath)
    )
    .sort((left, right) => left.localeCompare(right));
}

function validateCodeReviewEvidenceCoverage(
  content: string,
  knownEvidenceArtifacts: string[]
): string[] {
  if (knownEvidenceArtifacts.length === 0) {
    return [];
  }

  const evidenceSections = extractMarkdownSectionContent(content, /^Evidence Reviewed$/i).join("\n");
  const missingEvidence = knownEvidenceArtifacts.filter(
    (artifactPath) => !evidenceSections.includes(artifactPath)
  );

  return missingEvidence.length === 0
    ? []
    : [
        `Review artifact section Evidence Reviewed must cite or explicitly defer every saved phase evidence artifact. Missing: ${missingEvidence.join(", ")}.`
      ];
}

async function validateCodeReviewNextSafeAction(content: string): Promise<string[]> {
  return validateImplementedNextSafeAction(
    extractMarkdownSectionContent(content, /^Next Safe Action$/i).join("\n"),
    "Review artifact section Next Safe Action"
  );
}

function codeReviewModelSeverityCounts(
  findings: CodeReviewStructuredModel["findings"]
): Record<ReviewFindingSeverity, number> {
  const counts = emptySeverityCounts();

  for (const finding of findings) {
    counts[finding.severity] += 1;
  }

  return counts;
}

function renderCodeReviewFinding(finding: CodeReviewStructuredModel["findings"][number]): string {
  return `- [${finding.severity}][${finding.disposition}] \`${finding.location}\` - Evidence: ${finding.evidence} Impact: ${finding.impact} Fix/verification: ${finding.recommendation}`;
}

function renderCodeReviewEvidenceCoverage(args: {
  model: CodeReviewStructuredModel;
  knownEvidenceArtifacts: string[];
}): string[] {
  if (args.knownEvidenceArtifacts.length === 0) {
    return ["none"];
  }

  return args.knownEvidenceArtifacts.map((artifactPath) => {
    const coverage = args.model.evidenceCoverage[artifactPath];
    return `${artifactPath} - ${coverage.status}: ${coverage.rationale}`;
  });
}

function renderCodeReviewModelContent(
  model: CodeReviewStructuredModel,
  located: LocatedReviewPhase,
  authoringContext: CodeReviewAuthoringContext
): string {
  const severityCounts = codeReviewModelSeverityCounts(model.findings);
  const evidenceReviewed = renderCodeReviewEvidenceCoverage({
    model,
    knownEvidenceArtifacts: authoringContext.knownEvidenceArtifacts
  });
  const findings =
    model.findings.length > 0
      ? model.findings.map(renderCodeReviewFinding)
      : ["none"];

  return normalizeTextContent(`# Phase ${located.phasePrefix}: ${located.phaseName ?? `Phase ${located.phasePrefix}`} - Code Review

**Verdict:** ${model.verdict}

## Review Summary

- Depth: ${authoringContext.reviewMode.depth}
- Scope source: ${authoringContext.reviewMode.source}
- File count: ${authoringContext.files.length}
${renderBulletList(model.reviewSummary)}

## Scope Reviewed

${renderBulletList(authoringContext.files)}

## Evidence Reviewed

${renderBulletList(evidenceReviewed)}

## Positive Signals

${renderBulletList(model.positiveSignals)}

## Severity Summary

- critical: ${severityCounts.critical}
- high: ${severityCounts.high}
- medium: ${severityCounts.medium}
- low: ${severityCounts.low}
- unknown: ${severityCounts.unknown}

## Findings

${findings.join("\n")}

## Follow-Ups

${renderBulletList(model.followUps)}

## Next Safe Action

- ${model.nextSafeAction}
`);
}

function markdownTableCell(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ").replace(/\|/g, "\\|").trim();
}

function renderMarkdownTable(headers: string[], rows: string[][]): string {
  return [
    headers,
    headers.map(() => "---"),
    ...rows
  ]
    .map((row) => `| ${row.map(markdownTableCell).join(" | ")} |`)
    .join("\n");
}

function securityThreatCounts(model: SecurityStructuredModel): {
  declared: number;
  closed: number;
  accepted: number;
  open: number;
} {
  const realThreats = model.threatRegister.filter((row) => row.threatId !== "none");

  return {
    declared: realThreats.length,
    closed: realThreats.filter((row) => row.status === "closed").length,
    accepted: realThreats.filter((row) => row.status === "accepted").length,
    open: realThreats.filter((row) => row.status === "open").length
  };
}

function renderSecurityEvidenceCoverage(args: {
  model: SecurityStructuredModel;
  knownEvidenceArtifacts: string[];
}): string[] {
  return args.knownEvidenceArtifacts.map((artifactPath) => {
    const coverage = args.model.evidenceCoverage[artifactPath];
    return `${artifactPath} - ${coverage.status}: ${coverage.rationale}`;
  });
}

function renderSecurityModelContent(
  model: SecurityStructuredModel,
  located: LocatedReviewPhase,
  authoringContext: SecurityAuthoringContext
): string {
  const threatById = new Map(
    authoringContext.declaredThreats.map((threat) => [threat.threatId, threat])
  );
  const counts = securityThreatCounts(model);
  const threatRows =
    model.threatRegister.length > 0
      ? model.threatRegister.map((row) => {
          if (row.threatId === "none") {
            return ["none", "none", "none", "none", "none", "none", "none", "none", "none"];
          }

          const declared = threatById.get(row.threatId);

          return [
            row.threatId,
            declared?.sourcePlan ?? "unknown",
            declared?.category ?? "unknown",
            declared?.component ?? "unknown",
            declared?.disposition ?? "unknown",
            declared?.mitigation ?? "unknown",
            row.status,
            row.evidence,
            row.verifierNote
          ];
        })
      : [["none", "none", "none", "none", "none", "none", "none", "none", "none"]];
  const acceptedRiskRows = model.acceptedRisks.map((row) => [
    row.threatId,
    row.rationale,
    row.acceptedBy,
    row.acceptedAt,
    row.evidence
  ]);
  const findingRows = model.findings.map((row) => [
    row.kind,
    row.severity,
    row.threatId,
    row.status,
    row.evidence,
    row.recommendation
  ]);
  const manualRows = model.manualOrDeferredWork.map((row) => [
    row.item,
    row.reason,
    row.followUp,
    row.status
  ]);
  const gapRows = model.gapRoutes.map((row) => [
    row.gap,
    row.evidence,
    row.repair,
    row.status
  ]);

  return normalizeTextContent(`# Phase ${located.phasePrefix}: ${located.phaseName ?? `Phase ${located.phasePrefix}`} - Security Review

**Status:** ${model.status}
**Readiness:** ${model.readiness}
**Completion State:** ${model.completionState}
**Next Safe Action:** ${model.nextSafeAction}

## Security Summary

- Declared threats: ${counts.declared}
- Closed threats: ${counts.closed}
- Accepted risks: ${counts.accepted}
- Open threats: ${counts.open}
${renderBulletList(model.securitySummary)}

## Evidence Reviewed

${renderBulletList(renderSecurityEvidenceCoverage({
  model,
  knownEvidenceArtifacts: authoringContext.knownEvidenceArtifacts
}))}

## Threat Register

${renderMarkdownTable(
  [
    "Threat ID",
    "Source Plan",
    "Category",
    "Component",
    "Disposition",
    "Mitigation",
    "Status",
    "Evidence",
    "Verifier Note"
  ],
  threatRows
)}

## Accepted Risks

${renderMarkdownTable(
  ["Threat ID", "Rationale", "Accepted By", "Accepted At", "Evidence"],
  acceptedRiskRows
)}

## Findings

${renderMarkdownTable(
  ["Kind", "Severity", "Threat ID", "Status", "Evidence", "Recommendation"],
  findingRows
)}

## Manual / Deferred Work

${renderMarkdownTable(
  ["Item", "Reason", "Follow-Up", "Status"],
  manualRows
)}

## Gap / Repair Routes

${renderMarkdownTable(
  ["Gap", "Evidence", "Repair", "Status"],
  gapRows
)}

## Follow-Ups

${renderBulletList(model.followUps)}

## Security Audit Trail

- Audit date: ${model.auditTrail.auditDate}
- Execution mode: ${model.auditTrail.executionMode}
- Overwrite gate: ${model.auditTrail.overwriteGate}
- Verify-or-accept decision: ${model.auditTrail.verifyOrAcceptDecision}
- Pending-open-threat status: ${model.auditTrail.pendingOpenThreatStatus}
- Verifier note: ${model.auditTrail.verifierNote}

## Next Safe Action

- ${model.nextSafeAction}
`);
}

function ajvPathToModelPath(instancePath: string): string {
  if (instancePath.length === 0) {
    return "model";
  }

  return `model${instancePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const decoded = segment.replace(/~1/g, "/").replace(/~0/g, "~");
      return /^\d+$/.test(decoded) ? `[${decoded}]` : `.${decoded}`;
    })
    .join("")}`;
}

function schemaDiagnosticFromAjvError(error: ErrorObject): ReviewModelDiagnostic {
  const missingProperty =
    typeof error.params === "object" &&
    error.params !== null &&
    "missingProperty" in error.params &&
    typeof error.params.missingProperty === "string"
      ? error.params.missingProperty
      : null;
  const additionalProperty =
    typeof error.params === "object" &&
    error.params !== null &&
    "additionalProperty" in error.params &&
    typeof error.params.additionalProperty === "string"
      ? error.params.additionalProperty
      : null;
  const basePath = ajvPathToModelPath(error.instancePath);
  const pathValue =
    missingProperty !== null
      ? `${basePath}.${missingProperty}`
      : additionalProperty !== null
        ? `${basePath}.${additionalProperty}`
        : basePath;

  return modelDiagnostic({
    source: "schema",
    path: pathValue,
    code: `schema.${error.keyword}`,
    message: error.message ?? "Model does not match the review task schema.",
    context: {
      keyword: error.keyword,
      params: error.params,
      schemaPath: error.schemaPath
    },
    suggestion:
      missingProperty !== null
        ? `Add required field ${missingProperty}.`
        : additionalProperty !== null
          ? `Remove unsupported field ${additionalProperty}.`
          : "Revise the model to satisfy the narrowed task schema returned by blueprint_review_scope."
  });
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }

  return value.map((item) => item.trim());
}

function normalizeCodeReviewFinding(
  finding: unknown
): CodeReviewStructuredModel["findings"][number] | null {
  const findingObject = asJsonObject(finding);

  if (
    !findingObject ||
    typeof findingObject.severity !== "string" ||
    typeof findingObject.disposition !== "string" ||
    typeof findingObject.location !== "string" ||
    typeof findingObject.evidence !== "string" ||
    typeof findingObject.impact !== "string" ||
    typeof findingObject.recommendation !== "string"
  ) {
    return null;
  }

  return {
    severity: findingObject.severity as ReviewFindingSeverity,
    disposition: findingObject.disposition as ReviewFindingDisposition,
    location: findingObject.location.trim(),
    evidence: findingObject.evidence.trim(),
    impact: findingObject.impact.trim(),
    recommendation: findingObject.recommendation.trim()
  };
}

function normalizeEvidenceCoverage(
  evidenceCoverage: Record<string, unknown>
): CodeReviewStructuredModel["evidenceCoverage"] | null {
  const normalized: CodeReviewStructuredModel["evidenceCoverage"] = {};

  for (const [artifactPath, coverage] of Object.entries(evidenceCoverage)) {
    const coverageObject = asJsonObject(coverage);

    if (
      !coverageObject ||
      typeof coverageObject.status !== "string" ||
      typeof coverageObject.rationale !== "string"
    ) {
      return null;
    }

    normalized[artifactPath] = {
      status: coverageObject.status as CodeReviewEvidenceCoverageStatus,
      rationale: coverageObject.rationale.trim()
    };
  }

  return normalized;
}

function normalizeCodeReviewModel(model: Record<string, unknown>): CodeReviewStructuredModel | null {
  const findings = Array.isArray(model.findings) ? model.findings : null;
  const evidenceCoverage = asJsonObject(model.evidenceCoverage);
  const reviewSummary = normalizeStringArray(model.reviewSummary);
  const positiveSignals = normalizeStringArray(model.positiveSignals);
  const followUps = normalizeStringArray(model.followUps);

  if (
    typeof model.verdict !== "string" ||
    reviewSummary === null ||
    positiveSignals === null ||
    findings === null ||
    evidenceCoverage === null ||
    followUps === null ||
    typeof model.nextSafeAction !== "string"
  ) {
    return null;
  }

  const normalizedFindings = findings.map(normalizeCodeReviewFinding);
  const normalizedEvidenceCoverage = normalizeEvidenceCoverage(evidenceCoverage);

  if (
    normalizedFindings.some((finding) => finding === null) ||
    normalizedEvidenceCoverage === null
  ) {
    return null;
  }

  return {
    verdict: model.verdict as CodeReviewStructuredModel["verdict"],
    reviewSummary,
    positiveSignals,
    findings: normalizedFindings as CodeReviewStructuredModel["findings"],
    evidenceCoverage: normalizedEvidenceCoverage,
    followUps,
    nextSafeAction: model.nextSafeAction.trim()
  };
}

function normalizeCodeReviewModelForResiduals(
  model: Record<string, unknown>
): CodeReviewStructuredModel {
  const findings = Array.isArray(model.findings)
    ? model.findings.flatMap((finding) => {
        const normalized = normalizeCodeReviewFinding(finding);
        return normalized ? [normalized] : [];
      })
    : [];
  const evidenceCoverage = asJsonObject(model.evidenceCoverage);

  return {
    verdict:
      typeof model.verdict === "string"
        ? model.verdict as CodeReviewStructuredModel["verdict"]
        : "" as CodeReviewStructuredModel["verdict"],
    reviewSummary: normalizeStringArray(model.reviewSummary) ?? [],
    positiveSignals: normalizeStringArray(model.positiveSignals) ?? [],
    findings,
    evidenceCoverage: evidenceCoverage
      ? normalizeEvidenceCoverage(evidenceCoverage) ?? {}
      : {},
    followUps: normalizeStringArray(model.followUps) ?? [],
    nextSafeAction:
      typeof model.nextSafeAction === "string" ? model.nextSafeAction.trim() : ""
  };
}

function normalizeSecurityEvidenceCoverage(
  evidenceCoverage: Record<string, unknown>
): SecurityStructuredModel["evidenceCoverage"] | null {
  const normalized: SecurityStructuredModel["evidenceCoverage"] = {};

  for (const [artifactPath, coverage] of Object.entries(evidenceCoverage)) {
    const coverageObject = asJsonObject(coverage);

    if (
      !coverageObject ||
      typeof coverageObject.status !== "string" ||
      typeof coverageObject.rationale !== "string"
    ) {
      return null;
    }

    normalized[artifactPath] = {
      status: coverageObject.status as SecurityEvidenceCoverageStatus,
      rationale: coverageObject.rationale.trim()
    };
  }

  return normalized;
}

function normalizeSecurityModel(model: Record<string, unknown>): SecurityStructuredModel | null {
  const securitySummary = normalizeStringArray(model.securitySummary);
  const followUps = normalizeStringArray(model.followUps);
  const evidenceCoverage = asJsonObject(model.evidenceCoverage);
  const threatRegister = Array.isArray(model.threatRegister) ? model.threatRegister : null;
  const acceptedRisks = Array.isArray(model.acceptedRisks) ? model.acceptedRisks : null;
  const findings = Array.isArray(model.findings) ? model.findings : null;
  const manualOrDeferredWork = Array.isArray(model.manualOrDeferredWork)
    ? model.manualOrDeferredWork
    : null;
  const gapRoutes = Array.isArray(model.gapRoutes) ? model.gapRoutes : null;
  const auditTrail = asJsonObject(model.auditTrail);

  if (
    typeof model.status !== "string" ||
    typeof model.readiness !== "string" ||
    typeof model.completionState !== "string" ||
    securitySummary === null ||
    evidenceCoverage === null ||
    threatRegister === null ||
    acceptedRisks === null ||
    findings === null ||
    manualOrDeferredWork === null ||
    gapRoutes === null ||
    followUps === null ||
    !auditTrail ||
    typeof auditTrail.auditDate !== "string" ||
    typeof auditTrail.executionMode !== "string" ||
    typeof auditTrail.overwriteGate !== "string" ||
    typeof auditTrail.verifyOrAcceptDecision !== "string" ||
    typeof auditTrail.pendingOpenThreatStatus !== "string" ||
    typeof auditTrail.verifierNote !== "string" ||
    typeof model.nextSafeAction !== "string"
  ) {
    return null;
  }

  const normalizedEvidenceCoverage = normalizeSecurityEvidenceCoverage(evidenceCoverage);
  const normalizedThreatRegister = threatRegister.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.threatId === "string" &&
      typeof rowObject.status === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.verifierNote === "string"
      ? {
          threatId: rowObject.threatId.trim(),
          status: rowObject.status as SecurityThreatStatus,
          evidence: rowObject.evidence.trim(),
          verifierNote: rowObject.verifierNote.trim()
        }
      : null;
  });
  const normalizedAcceptedRisks = acceptedRisks.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.threatId === "string" &&
      typeof rowObject.rationale === "string" &&
      typeof rowObject.acceptedBy === "string" &&
      typeof rowObject.acceptedAt === "string" &&
      typeof rowObject.evidence === "string"
      ? {
          threatId: rowObject.threatId.trim(),
          rationale: rowObject.rationale.trim(),
          acceptedBy: rowObject.acceptedBy.trim(),
          acceptedAt: rowObject.acceptedAt.trim(),
          evidence: rowObject.evidence.trim()
        }
      : null;
  });
  const normalizedFindings = findings.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.kind === "string" &&
      typeof rowObject.severity === "string" &&
      typeof rowObject.threatId === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.recommendation === "string" &&
      typeof rowObject.status === "string"
      ? {
          kind: rowObject.kind as SecurityStructuredModel["findings"][number]["kind"],
          severity: rowObject.severity as SecurityStructuredModel["findings"][number]["severity"],
          threatId: rowObject.threatId.trim(),
          evidence: rowObject.evidence.trim(),
          recommendation: rowObject.recommendation.trim(),
          status: rowObject.status as SecurityStructuredModel["findings"][number]["status"]
        }
      : null;
  });
  const normalizedManual = manualOrDeferredWork.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.item === "string" &&
      typeof rowObject.reason === "string" &&
      typeof rowObject.followUp === "string" &&
      typeof rowObject.status === "string"
      ? {
          item: rowObject.item.trim(),
          reason: rowObject.reason.trim(),
          followUp: rowObject.followUp.trim(),
          status: rowObject.status as SecurityManualStatus
        }
      : null;
  });
  const normalizedGaps = gapRoutes.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.gap === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.repair === "string" &&
      typeof rowObject.status === "string"
      ? {
          gap: rowObject.gap.trim(),
          evidence: rowObject.evidence.trim(),
          repair: rowObject.repair.trim(),
          status: rowObject.status as SecurityGapStatus
        }
      : null;
  });

  if (
    normalizedEvidenceCoverage === null ||
    normalizedThreatRegister.some((row) => row === null) ||
    normalizedAcceptedRisks.some((row) => row === null) ||
    normalizedFindings.some((row) => row === null) ||
    normalizedManual.some((row) => row === null) ||
    normalizedGaps.some((row) => row === null)
  ) {
    return null;
  }

  return {
    status: model.status as SecurityReviewStatus,
    readiness: model.readiness as SecurityReviewReadiness,
    completionState: model.completionState as SecurityReviewCompletionState,
    securitySummary,
    evidenceCoverage: normalizedEvidenceCoverage,
    threatRegister: normalizedThreatRegister as SecurityStructuredModel["threatRegister"],
    acceptedRisks: normalizedAcceptedRisks as SecurityStructuredModel["acceptedRisks"],
    findings: normalizedFindings as SecurityStructuredModel["findings"],
    manualOrDeferredWork: normalizedManual as SecurityStructuredModel["manualOrDeferredWork"],
    gapRoutes: normalizedGaps as SecurityStructuredModel["gapRoutes"],
    followUps,
    auditTrail: {
      auditDate: auditTrail.auditDate.trim(),
      executionMode: auditTrail.executionMode as SecurityStructuredModel["auditTrail"]["executionMode"],
      overwriteGate: auditTrail.overwriteGate as SecurityStructuredModel["auditTrail"]["overwriteGate"],
      verifyOrAcceptDecision: auditTrail.verifyOrAcceptDecision as SecurityStructuredModel["auditTrail"]["verifyOrAcceptDecision"],
      pendingOpenThreatStatus: auditTrail.pendingOpenThreatStatus as SecurityStructuredModel["auditTrail"]["pendingOpenThreatStatus"],
      verifierNote: auditTrail.verifierNote.trim()
    },
    nextSafeAction: model.nextSafeAction.trim()
  };
}

function normalizeSecurityModelForResiduals(
  model: Record<string, unknown>
): SecurityStructuredModel | null {
  return normalizeSecurityModel(model);
}

function parseCodeReviewLocation(location: string): {
  file: string;
  startLine: number;
  endLine: number;
} | null {
  const match = location.match(CODE_REVIEW_LOCATION_PATTERN);

  if (!match) {
    return null;
  }

  const file = match[1];
  const startLine = Number(match[2]);
  const endLine = match[3] ? Number(match[3]) : startLine;

  return {
    file,
    startLine,
    endLine
  };
}

async function countFileLines(filePath: string): Promise<number> {
  const content = await fs.readFile(filePath, "utf8");
  const contentWithoutTerminalNewline = content.replace(/(?:\r\n|\r|\n)$/, "");

  if (contentWithoutTerminalNewline.length === 0) {
    return content.length === 0 ? 0 : 1;
  }

  return contentWithoutTerminalNewline.split(/\r\n|\r|\n/).length;
}

function addGenericValueDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: CodeReviewStructuredModel;
}): void {
  for (const [field, values] of [
    ["reviewSummary", args.model.reviewSummary],
    ["positiveSignals", args.model.positiveSignals]
  ] as const) {
    values.forEach((value, index) => {
      if (isGenericNoneValue(value)) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.${field}[${index}]`,
            code: "residual.generic_text",
            message: `Code-review model ${field} cannot use generic none values.`,
            context: { value },
            suggestion: "Replace the generic value with concrete review evidence."
          })
        );
      }
    });
  }

  if (
    args.model.findings.length > 0 &&
    args.model.followUps.every((followUp) => isGenericNoneValue(followUp))
  ) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.followUps",
        code: "residual.generic_text",
        message: "Code-review model with findings must include concrete followUps instead of generic none.",
        context: { findingCount: args.model.findings.length },
        suggestion: "Add a concrete fix, test, or validation follow-up for the findings."
      })
    );
  }

  args.model.findings.forEach((finding, index) => {
    for (const field of ["evidence", "impact", "recommendation"] as const) {
      if (isGenericNoneValue(finding[field])) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findings[${index}].${field}`,
            code: "residual.generic_text",
            message: `Code-review model findings.${index}.${field} must be concrete instead of generic none.`,
            context: { value: finding[field] },
            suggestion: "Replace the generic value with specific line-backed review reasoning."
          })
        );
      }
    }
  });

  for (const [artifactPath, coverage] of Object.entries(args.model.evidenceCoverage)) {
    if (isGenericNoneValue(coverage.rationale)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.evidenceCoverage.${artifactPath}.rationale`,
          code: "residual.generic_text",
          message: `Code-review model evidenceCoverage rationale for ${artifactPath} must be concrete.`,
          context: { artifactPath, value: coverage.rationale },
          suggestion: "Explain why this exact evidence artifact was used, deferred, or irrelevant."
        })
      );
    }
  }
}

function addPlaceholderDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: Record<string, unknown>;
}): void {
  const modelContract = readArtifactContract("review.code-review").modelContract;
  const stringEntries = collectModelStringEntries(args.model);

  for (const entry of stringEntries) {
    if (hasPlaceholderLanguage(entry.value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.placeholder_text",
          message: "Code-review model still contains placeholder language.",
          context: { value: entry.value },
          suggestion: "Replace placeholder wording with concrete review evidence."
        })
      );
    }
  }

  if (!modelContract) {
    return;
  }

  for (const signal of modelContract.exampleLeakageSignals) {
    const leakedEntry = stringEntries.find((entry) => entry.value.includes(signal));

    if (leakedEntry) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: leakedEntry.path,
          code: "residual.example_leakage",
          message: `Code-review model copied example leakage signal from ${modelContract.schemaId}.`,
          context: { signal },
          suggestion: "Replace copied example wording with review-specific evidence."
        })
      );
    }
  }
}

function addEvidenceCoverageDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: CodeReviewStructuredModel;
  knownEvidenceArtifacts: string[];
}): void {
  const knownEvidence = new Set(args.knownEvidenceArtifacts);
  const coverageKeys = Object.keys(args.model.evidenceCoverage);
  const missing = args.knownEvidenceArtifacts.filter(
    (artifactPath) => !(artifactPath in args.model.evidenceCoverage)
  );
  const unknown = coverageKeys.filter((artifactPath) => !knownEvidence.has(artifactPath));

  if (missing.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.evidenceCoverage",
        code: "residual.evidence_missing",
        message: `Code-review model evidenceCoverage must include every known evidence artifact. Missing: ${missing.join(", ")}.`,
        context: { missing },
        suggestion: "Add exact evidenceCoverage keys from authoringContext.knownEvidenceArtifacts."
      })
    );
  }

  if (unknown.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.evidenceCoverage",
        code: "residual.evidence_unknown",
        message: `Code-review model evidenceCoverage contains artifacts outside the live phase inventory: ${unknown.join(", ")}.`,
        context: { unknown },
        suggestion: "Remove invented or stale evidence keys and use only exact known evidence artifact paths."
      })
    );
  }
}

async function addFindingLocationDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  projectRoot: string;
  model: CodeReviewStructuredModel;
  scopeFiles: string[];
}): Promise<void> {
  const scopeSet = new Set(args.scopeFiles);
  const seenLocations = new Map<string, number>();
  const rangesByFile = new Map<string, Array<{ index: number; startLine: number; endLine: number }>>();

  for (const [index, finding] of args.model.findings.entries()) {
    const parsed = parseCodeReviewLocation(finding.location);

    if (!parsed) {
      continue;
    }

    if (scopeSet.size > 0 && !scopeSet.has(parsed.file)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.location_out_of_scope",
          message: `Code-review model finding location is outside the resolved review scope: ${finding.location}.`,
          context: { location: finding.location, scopeFiles: args.scopeFiles },
          suggestion: "Use a file:line citation from the resolved blueprint_review_scope.files list."
        })
      );
    }

    if (parsed.startLine < 1 || parsed.endLine < parsed.startLine) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.invalid_line_range",
          message: `Code-review model finding has an invalid line range: ${finding.location}.`,
          context: { location: finding.location, startLine: parsed.startLine, endLine: parsed.endLine },
          suggestion: "Use one-based line numbers with an end line greater than or equal to the start line."
        })
      );
      continue;
    }

    let absolutePath: string;
    try {
      absolutePath = resolveRepoRelativePath(args.projectRoot, parsed.file);
    } catch (error) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.location_path_invalid",
          message:
            error instanceof Error
              ? error.message
              : `Code-review model finding path could not be resolved: ${parsed.file}.`,
          context: { location: finding.location, file: parsed.file },
          suggestion: "Use a repo-relative file path inside the resolved review scope."
        })
      );
      continue;
    }

    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findings[${index}].location`,
            code: "residual.location_not_file",
            message: `Code-review model finding path is not a file: ${parsed.file}.`,
            context: { location: finding.location, file: parsed.file },
            suggestion: "Use a repo-relative file path to an existing file."
          })
        );
        continue;
      }

      const lineCount = await countFileLines(absolutePath);
      if (parsed.endLine > lineCount) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.findings[${index}].location`,
            code: "residual.line_range_missing",
            message: `Code-review model finding line range exceeds ${parsed.file}'s ${lineCount} line(s): ${finding.location}.`,
            context: { location: finding.location, file: parsed.file, lineCount },
            suggestion: "Update the finding to cite an existing line or line range."
          })
        );
      }
    } catch {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.location_missing_file",
          message: `Code-review model finding cites a file that does not exist: ${parsed.file}.`,
          context: { location: finding.location, file: parsed.file },
          suggestion: "Use a file returned by blueprint_review_scope.files."
        })
      );
    }

    const previousIndex = seenLocations.get(finding.location);
    if (previousIndex !== undefined) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.duplicate_location",
          message: `Code-review model repeats the same finding location: ${finding.location}.`,
          context: { location: finding.location, firstFindingIndex: previousIndex, duplicateFindingIndex: index },
          suggestion: "Merge duplicate findings or cite distinct line-backed evidence."
        })
      );
    } else {
      seenLocations.set(finding.location, index);
    }

    const ranges = rangesByFile.get(parsed.file) ?? [];
    const overlapping = ranges.find(
      (range) => parsed.startLine <= range.endLine && parsed.endLine >= range.startLine
    );

    if (overlapping) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.findings[${index}].location`,
          code: "residual.conflicting_location",
          message: `Code-review model has overlapping finding locations in ${parsed.file}.`,
          context: {
            file: parsed.file,
            firstFindingIndex: overlapping.index,
            conflictingFindingIndex: index
          },
          suggestion: "Merge overlapping findings unless they cite distinct, non-overlapping evidence."
        })
      );
    }

    ranges.push({
      index,
      startLine: parsed.startLine,
      endLine: parsed.endLine
    });
    rangesByFile.set(parsed.file, ranges);
  }
}

function addVerdictContradictionDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: CodeReviewStructuredModel;
}): void {
  const followUpFindings = args.model.findings.filter(
    (finding) => finding.disposition === "follow-up"
  );
  const blockedFindings = args.model.findings.filter(
    (finding) => finding.disposition === "blocked"
  );
  const nextAction = args.model.nextSafeAction;

  if (args.model.verdict === "PASS" && args.model.findings.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.verdict",
        code: "residual.verdict_contradiction",
        message: "Code-review model verdict PASS contradicts non-empty findings.",
        context: { verdict: args.model.verdict, findingCount: args.model.findings.length },
        suggestion: "Use FOLLOW_UP or BLOCKED when findings remain, or remove non-actionable findings."
      })
    );
  }

  if (args.model.verdict === "FOLLOW_UP" && followUpFindings.length === 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.verdict",
        code: "residual.verdict_contradiction",
        message: "Code-review model verdict FOLLOW_UP requires at least one follow-up finding.",
        context: { verdict: args.model.verdict },
        suggestion: "Add a follow-up finding or change the verdict to PASS when no follow-up remains."
      })
    );
  }

  if (args.model.verdict === "BLOCKED" && blockedFindings.length === 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.verdict",
        code: "residual.verdict_contradiction",
        message: "Code-review model verdict BLOCKED requires at least one blocked finding.",
        context: { verdict: args.model.verdict },
        suggestion: "Mark the blocking finding disposition as blocked or use FOLLOW_UP for non-blocking fixes."
      })
    );
  }

  if (followUpFindings.length > 0 && nextAction === "/blu-progress") {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_contradiction",
        message: "Code-review model routes to /blu-progress while follow-up findings remain.",
        context: { nextSafeAction: nextAction, followUpFindingCount: followUpFindings.length },
        suggestion: "Route to /blu-code-review-fix <phase> or another allowed repair/validation action."
      })
    );
  }

  if (
    (args.model.verdict === "BLOCKED" || blockedFindings.length > 0) &&
    nextAction === "/blu-progress"
  ) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_contradiction",
        message: "Code-review model routes to /blu-progress while blocked findings or a BLOCKED verdict remain.",
        context: {
          verdict: args.model.verdict,
          nextSafeAction: nextAction,
          blockedFindingCount: blockedFindings.length
        },
        suggestion: "Route to /blu-code-review-fix <phase> or another allowed repair/validation action."
      })
    );
  }

  if (args.model.findings.length === 0 && /\/blu-code-review-fix\b/i.test(nextAction)) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_contradiction",
        message: "Code-review model routes to code-review-fix without findings.",
        context: { nextSafeAction: nextAction },
        suggestion: "Use /blu-progress or another allowed non-fix next action when no findings remain."
      })
    );
  }
}

async function collectCodeReviewResidualDiagnostics(args: {
  projectRoot: string;
  model: Record<string, unknown>;
  normalizedModel: CodeReviewStructuredModel | null;
  authoringContext: CodeReviewAuthoringContext;
}): Promise<ReviewModelDiagnostic[]> {
  const diagnostics: ReviewModelDiagnostic[] = [];
  const identityKeys = Object.keys(args.model).filter((key) =>
    CODE_REVIEW_MODEL_IDENTITY_KEYS.has(key)
  );

  if (identityKeys.length > 0) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model",
        code: "residual.runtime_owned_field",
        message: `Code-review model must not include MCP-owned identity or rendering keys: ${identityKeys.join(", ")}.`,
        context: { identityKeys },
        suggestion: "Remove runtime-owned fields and author only the review.code-review model fields."
      })
    );
  }

  addPlaceholderDiagnostics({ diagnostics, model: args.model });

  if (!args.normalizedModel) {
    return diagnostics;
  }

  addGenericValueDiagnostics({
    diagnostics,
    model: args.normalizedModel
  });
  addEvidenceCoverageDiagnostics({
    diagnostics,
    model: args.normalizedModel,
    knownEvidenceArtifacts: args.authoringContext.knownEvidenceArtifacts
  });
  await addFindingLocationDiagnostics({
    diagnostics,
    projectRoot: args.projectRoot,
    model: args.normalizedModel,
    scopeFiles: args.authoringContext.files
  });
  addVerdictContradictionDiagnostics({
    diagnostics,
    model: args.normalizedModel
  });

  const nextSafeActionIssues = await validateImplementedNextSafeAction(
    args.normalizedModel.nextSafeAction
  );
  for (const issue of nextSafeActionIssues) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_unimplemented",
        message: issue,
        context: { nextSafeAction: args.normalizedModel.nextSafeAction },
        suggestion: "Use one of authoringContext.allowedNextActions."
      })
    );
  }

  return diagnostics;
}

function addSecurityPlaceholderDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: Record<string, unknown>;
}): void {
  const modelContract = readArtifactContract("review.security").modelContract;
  const stringEntries = collectModelStringEntries(args.model);

  for (const entry of stringEntries) {
    if (hasPlaceholderLanguage(entry.value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: entry.path,
          code: "residual.placeholder_text",
          message: "Security review model still contains placeholder language.",
          context: { value: entry.value },
          suggestion: "Replace placeholder wording with concrete security evidence."
        })
      );
    }
  }

  if (!modelContract) {
    return;
  }

  for (const signal of modelContract.exampleLeakageSignals) {
    const leakedEntry = stringEntries.find((entry) => entry.value.includes(signal));

    if (leakedEntry) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: leakedEntry.path,
          code: "residual.example_leakage",
          message: `Security review model copied example leakage signal from ${modelContract.schemaId}.`,
          context: { signal },
          suggestion: "Replace copied example wording with phase-specific security evidence."
        })
      );
    }
  }
}

function addSecurityGenericValueDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: SecurityStructuredModel;
}): void {
  args.model.securitySummary.forEach((value, index) => {
    if (isGenericNoneValue(value)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.securitySummary[${index}]`,
          code: "residual.generic_text",
          message: "Security review summary cannot use generic none values.",
          context: { value },
          suggestion: "Replace the generic value with concrete security posture evidence."
        })
      );
    }
  });

  for (const [artifactPath, coverage] of Object.entries(args.model.evidenceCoverage)) {
    if (isGenericNoneValue(coverage.rationale)) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `model.evidenceCoverage.${artifactPath}.rationale`,
          code: "residual.generic_text",
          message: `Security review evidenceCoverage rationale for ${artifactPath} must be concrete.`,
          context: { artifactPath, value: coverage.rationale },
          suggestion: "Explain why this exact upstream artifact was used, deferred, or unavailable."
        })
      );
    }
  }

  for (const [index, row] of args.model.threatRegister.entries()) {
    if (row.threatId === "none") {
      continue;
    }

    for (const field of ["evidence", "verifierNote"] as const) {
      if (isGenericNoneValue(row[field])) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `model.threatRegister[${index}].${field}`,
            code: "residual.generic_text",
            message: `Security review threatRegister.${index}.${field} must be concrete.`,
            context: { value: row[field] },
            suggestion: "Use artifact, code, acceptance, or explicit gap evidence for each declared threat."
          })
        );
      }
    }
  }
}

function normalizeThreatFlagMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function securityFindingMentionsThreatFlag(
  finding: SecurityStructuredModel["findings"][number],
  flag: SecuritySummaryThreatFlag
): boolean {
  const flagText = normalizeThreatFlagMatchText(flag.evidence);
  const findingText = normalizeThreatFlagMatchText(
    `${finding.evidence} ${finding.recommendation}`
  );

  return (
    flagText.length > 0 &&
    findingText.length > 0 &&
    findingText.includes(flagText)
  );
}

function securityThreatRegisterMentionsThreatFlag(
  row: SecurityThreatRegisterRow,
  flag: SecuritySummaryThreatFlag
): boolean {
  const flagText = normalizeThreatFlagMatchText(flag.evidence);
  const rowText = normalizeThreatFlagMatchText(`${row.evidence} ${row.verifierNote}`);

  return (
    flagText.length > 0 &&
    rowText.length > 0 &&
    rowText.includes(flagText)
  );
}

function addSecuritySemanticDiagnostics(args: {
  diagnostics: ReviewModelDiagnostic[];
  model: SecurityStructuredModel;
  authoringContext: SecurityAuthoringContext;
}): void {
  const declaredThreatIds = new Set(args.authoringContext.declaredThreats.map((threat) => threat.threatId));
  const openThreats = args.model.threatRegister.filter((row) => row.status === "open");
  const acceptedThreatRows = args.model.threatRegister
    .filter((row) => row.status === "accepted")
    .map((row) => row.threatId);
  const acceptedRiskRows = args.model.acceptedRisks
    .filter((row) => row.threatId !== "none")
    .map((row) => row.threatId);
  const missingAcceptedRisks = acceptedThreatRows.filter(
    (threatId) => !acceptedRiskRows.includes(threatId)
  );
  const unexpectedAcceptedRisks = acceptedRiskRows.filter((threatId) => {
    const threatRow = args.model.threatRegister.find((row) => row.threatId === threatId);
    return !threatRow || threatRow.status !== "accepted";
  });
  const unknownThreatIds = args.model.threatRegister
    .filter((row) => row.threatId !== "none")
    .map((row) => row.threatId)
    .filter((threatId) => !declaredThreatIds.has(threatId));
  const realFindings = args.model.findings.filter((row) => row.kind !== "none");

  if (unknownThreatIds.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.threatRegister",
        code: "residual.threat_unknown",
        message: `Security review model contains threat ids outside the live saved-plan register: ${unknownThreatIds.join(", ")}.`,
        context: { unknownThreatIds },
        suggestion: "Use only exact threat ids from authoringContext.declaredThreats."
      })
    );
  }

  args.authoringContext.summaryThreatFlags.forEach((flag, index) => {
    if (flag.threatId && declaredThreatIds.has(flag.threatId)) {
      const hasThreatRegisterCoverage = args.model.threatRegister.some(
        (row) =>
          row.threatId === flag.threatId &&
          row.status !== "none" &&
          securityThreatRegisterMentionsThreatFlag(row, flag)
      );
      const hasFindingCoverage = realFindings.some(
        (row) => securityFindingMentionsThreatFlag(row, flag)
      );

      if (!hasThreatRegisterCoverage && !hasFindingCoverage) {
        args.diagnostics.push(
          modelDiagnostic({
            source: "residual",
            path: `authoringContext.summaryThreatFlags[${index}]`,
            code: "residual.summary_threat_flag_uncovered",
            message: `Summary threat flag ${flag.flagId} maps to declared threat ${flag.threatId} but is not covered by the security model.`,
            context: { flag },
            suggestion: "Cover the flag with the matching threatRegister row or a concrete security finding."
          })
        );
      }

      return;
    }

    const matchingUnregisteredFindings = realFindings.filter(
      (row) => row.kind === "unregistered-flag" && row.threatId === "unregistered"
    );
    const hasExplicitCoverage = matchingUnregisteredFindings.some((row) =>
      securityFindingMentionsThreatFlag(row, flag)
    );

    if (!hasExplicitCoverage) {
      args.diagnostics.push(
        modelDiagnostic({
          source: "residual",
          path: `authoringContext.summaryThreatFlags[${index}]`,
          code: "residual.summary_threat_flag_uncovered",
          message: `Summary threat flag ${flag.flagId} is not registered in saved plan threats and must be covered by an unregistered-flag finding.`,
          context: { flag },
          suggestion: "Add a findings row with kind unregistered-flag, threatId unregistered, concrete evidence, and a follow-up route."
        })
      );
    }
  });

  if (missingAcceptedRisks.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.acceptedRisks",
        code: "residual.accepted_risk_missing",
        message: `Accepted threat rows require matching acceptedRisks entries: ${missingAcceptedRisks.join(", ")}.`,
        context: { missingAcceptedRisks },
        suggestion: "Add accepted-risk rows with explicit acceptance source and date, or change the threat status."
      })
    );
  }

  if (unexpectedAcceptedRisks.length > 0) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.acceptedRisks",
        code: "residual.accepted_risk_contradiction",
        message: `Accepted risk rows must map to threatRegister rows with status accepted: ${unexpectedAcceptedRisks.join(", ")}.`,
        context: { unexpectedAcceptedRisks },
        suggestion: "Remove stale accepted-risk rows or mark the matching threat status as accepted."
      })
    );
  }

  if (openThreats.length === 0 && args.model.nextSafeAction === args.authoringContext.blockedNextSafeAction) {
    args.diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_contradiction",
        message: "Security review model uses the blocked pending-open-threat action without open threats.",
        context: { nextSafeAction: args.model.nextSafeAction },
        suggestion: "Use the status-safe next action from the runtime task schema."
      })
    );
  }
}

async function collectSecurityResidualDiagnostics(args: {
  model: Record<string, unknown>;
  normalizedModel: SecurityStructuredModel | null;
  authoringContext: SecurityAuthoringContext;
}): Promise<ReviewModelDiagnostic[]> {
  const diagnostics: ReviewModelDiagnostic[] = [];
  const identityKeys = Object.keys(args.model).filter((key) =>
    SECURITY_MODEL_IDENTITY_KEYS.has(key)
  );

  if (identityKeys.length > 0) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model",
        code: "residual.runtime_owned_field",
        message: `Security review model must not include MCP-owned identity or provenance keys: ${identityKeys.join(", ")}.`,
        context: { identityKeys },
        suggestion: "Remove runtime-owned fields and author only the review.security model fields."
      })
    );
  }

  addSecurityPlaceholderDiagnostics({ diagnostics, model: args.model });

  if (!args.normalizedModel) {
    return diagnostics;
  }

  addSecurityGenericValueDiagnostics({
    diagnostics,
    model: args.normalizedModel
  });
  addSecuritySemanticDiagnostics({
    diagnostics,
    model: args.normalizedModel,
    authoringContext: args.authoringContext
  });

  const nextSafeActionIssues =
    args.normalizedModel.nextSafeAction === args.authoringContext.blockedNextSafeAction
      ? []
      : await validateImplementedNextSafeAction(
          args.normalizedModel.nextSafeAction,
          "Security review model nextSafeAction"
        );
  for (const issue of nextSafeActionIssues) {
    diagnostics.push(
      modelDiagnostic({
        source: "residual",
        path: "model.nextSafeAction",
        code: "residual.next_action_unimplemented",
        message: issue,
        context: { nextSafeAction: args.normalizedModel.nextSafeAction },
        suggestion: "Use one of authoringContext.allowedNextActions."
      })
    );
  }

  return diagnostics;
}


function parsePlanIdForSuffix(
  pathValue: string,
  phasePrefix: string,
  suffix: "PLAN" | "SUMMARY"
): string | null {
  const match = pathValue.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-${suffix}\\.md$`)
  );

  if (!match) {
    return null;
  }

  return match[1].padStart(2, "0");
}

function findPhaseArtifact(artifacts: string[], suffix: string): string | null {
  return artifacts.find((artifact) => artifact.endsWith(suffix)) ?? null;
}

async function readRepoFileIfPresent(
  projectRoot: string,
  relativePath: string
): Promise<string | null> {
  try {
    const absolutePath = resolveRepoRelativePath(projectRoot, relativePath);
    return await fs.readFile(absolutePath, "utf8");
  } catch {
    return null;
  }
}

async function normalizeExplicitReviewFiles(
  projectRoot: string,
  files: string[],
  warnings: string[]
): Promise<NormalizeReviewFilesResult> {
  return normalizeReviewFiles(projectRoot, files, warnings, "explicit review");
}

const REVIEW_SCOPE_CONFIRMATION_THRESHOLDS = {
  broadFileCount: 5,
  multiPlanCount: 2,
  deepFileCount: 3
} as const;

async function normalizeReviewFiles(
  projectRoot: string,
  files: string[],
  warnings: string[],
  sourceLabel: string
): Promise<NormalizeReviewFilesResult> {
  const resolvedFiles = new Set<string>();
  let rejected = false;

  for (const rawFile of files) {
    const requestedPath = rawFile.trim();

    if (requestedPath.length === 0) {
      continue;
    }

    if (path.isAbsolute(requestedPath)) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${requestedPath} (absolute filesystem paths are not allowed).`
      );
      rejected = true;
      continue;
    }

    if (hasGlobPattern(requestedPath)) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${requestedPath} (wildcards are not allowed).`
      );
      rejected = true;
      continue;
    }

    let absolutePath: string;

    try {
      absolutePath = resolveRepoRelativePath(projectRoot, requestedPath);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Invalid ${sourceLabel} path: ${requestedPath} (${error.message})`
          : `Invalid ${sourceLabel} path: ${requestedPath} (could not be resolved).`
      );
      rejected = true;
      continue;
    }

    const relativePath = toRepoRelativePath(projectRoot, absolutePath);

    if (relativePath.startsWith(".blueprint/")) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${relativePath} (.blueprint artifacts are not reviewable repo files).`
      );
      rejected = true;
      continue;
    }

    let stats;

    try {
      stats = await fs.stat(absolutePath);
    } catch {
      warnings.push(`Invalid ${sourceLabel} path: ${relativePath} (file does not exist).`);
      rejected = true;
      continue;
    }

    if (!stats.isFile()) {
      warnings.push(
        `Invalid ${sourceLabel} path: ${relativePath} (${stats.isDirectory() ? "directories" : "non-file entries"} are not allowed).`
      );
      rejected = true;
      continue;
    }

    resolvedFiles.add(relativePath);
  }

  return {
    files: [...resolvedFiles].sort((left, right) => left.localeCompare(right)),
    rejected
  };
}

function extractPathCandidates(text: string): string[] {
  const candidates = new Set<string>();

  for (const match of text.matchAll(/`([^`]+)`/g)) {
    candidates.add(match[1].trim());
  }

  for (const match of text.matchAll(
    /(?:^|[\s("'`])((?:\.{1,2}\/)?(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+(?:\.[A-Za-z0-9._-]+)?)(?=$|[\s"'`),.;:!?])/g
  )) {
    candidates.add(match[1].trim());
  }

  return [...candidates].filter((candidate) => candidate.length > 0);
}

async function deriveReviewFilesFromSummaries(
  projectRoot: string,
  located: {
    artifacts: string[];
  },
  warnings: string[]
): Promise<{
  files: string[];
  summaryCount: number;
}> {
  const summaryFiles = located.artifacts.filter((artifact) =>
    artifact.endsWith("-SUMMARY.md")
  );

  if (summaryFiles.length === 0) {
    warnings.push(
      "No saved execution summaries were found for the selected phase, so Blueprint could not derive a review scope from summary evidence."
    );
  }

  const resolvedFiles = new Set<string>();

  for (const summaryPath of summaryFiles) {
    const content = await readRepoFileIfPresent(projectRoot, summaryPath);

    if (content === null) {
      warnings.push(`Skipped unreadable summary artifact while deriving review scope: ${summaryPath}`);
      continue;
    }

    const summaryEntries = extractMarkdownSectionEntries(
      content,
      /^changes made$/i
    );

    for (const entry of summaryEntries) {
      for (const candidate of extractPathCandidates(entry.items.join("\n"))) {
        let absolutePath: string;

        try {
          absolutePath = resolveRepoRelativePath(projectRoot, candidate);
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? error.message
              : `Could not resolve summary-derived review path from ${summaryPath}: ${candidate}`
          );
          continue;
        }

        const relativePath = toRepoRelativePath(projectRoot, absolutePath);

        if (relativePath.startsWith(".blueprint/")) {
          warnings.push(
            `Skipped Blueprint artifact path from ${summaryPath} review scope: ${relativePath}`
          );
          continue;
        }

        let stats;

        try {
          stats = await fs.stat(absolutePath);
        } catch {
          warnings.push(
            `Skipped missing repo path from ${summaryPath} review scope: ${relativePath}`
          );
          continue;
        }

        if (!stats.isFile()) {
          warnings.push(
            `Skipped non-file repo path from ${summaryPath} review scope: ${relativePath}`
          );
          continue;
        }

        resolvedFiles.add(relativePath);
      }
    }
  }

  return {
    files: [...resolvedFiles].sort((left, right) => left.localeCompare(right)),
    summaryCount: summaryFiles.length
  };
}

async function deriveReviewFilesFromPlans(
  projectRoot: string,
  located: {
    phaseNumber: string;
    phasePrefix: string;
    artifacts: string[];
  },
  warnings: string[]
): Promise<{
  files: string[];
  matchedPlanCount: number;
}> {
  const summaryPlanIds = new Set(
    located.artifacts
      .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      .map((artifact) => parsePlanIdForSuffix(artifact, located.phasePrefix, "SUMMARY"))
      .filter((planId): planId is string => planId !== null)
  );

  if (summaryPlanIds.size === 0) {
    warnings.push(
      "No execution summaries were found for the selected phase, so Blueprint could not derive a review scope from executed plans."
    );

    return {
      files: [],
      matchedPlanCount: 0
    };
  }

  const planPaths = located.artifacts.filter((artifact) => {
    if (!artifact.endsWith("-PLAN.md")) {
      return false;
    }

    const planId = parsePlanIdForSuffix(artifact, located.phasePrefix, "PLAN");
    return planId !== null && summaryPlanIds.has(planId);
  });

  if (planPaths.length === 0) {
    warnings.push(
      "Execution summaries exist, but the matching plan artifacts were missing, so Blueprint could not derive changed repo files for review."
    );

    return {
      files: [],
      matchedPlanCount: 0
    };
  }

  const resolvedFiles = new Set<string>();

  for (const planPath of planPaths) {
    const content = await readRepoFileIfPresent(projectRoot, planPath);

    if (content === null) {
      warnings.push(`Skipped unreadable plan artifact while deriving review scope: ${planPath}`);
      continue;
    }

    const validation = validatePlanArtifactContent(content, located.phaseNumber);

    if (!validation.valid) {
      warnings.push(
        `Plan metadata issues in ${planPath}: ${validation.issues.join(" ")}`
      );
    }

    for (const plannedPath of validation.metadata.filesModified) {
      const requestedPath = plannedPath.trim();

      if (requestedPath.length === 0) {
        continue;
      }

      if (requestedPath.includes("*")) {
        warnings.push(
          `Skipped wildcard review scope entry from ${planPath}: ${requestedPath}`
        );
        continue;
      }

      let absolutePath: string;

      try {
        absolutePath = resolveRepoRelativePath(projectRoot, requestedPath);
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? error.message
            : `Could not resolve planned review path from ${planPath}: ${requestedPath}`
        );
        continue;
      }

      const relativePath = toRepoRelativePath(projectRoot, absolutePath);

      if (relativePath.startsWith(".blueprint/")) {
        warnings.push(
          `Skipped Blueprint artifact path from ${planPath} review scope: ${relativePath}`
        );
        continue;
      }

      let stats;

      try {
        stats = await fs.stat(absolutePath);
      } catch {
        warnings.push(
          `Skipped missing repo path from ${planPath} review scope: ${relativePath}`
        );
        continue;
      }

      if (!stats.isFile()) {
        warnings.push(
          `Skipped non-file repo path from ${planPath} review scope: ${relativePath}`
        );
        continue;
      }

      resolvedFiles.add(relativePath);
    }
  }

  return {
    files: [...resolvedFiles].sort((left, right) => left.localeCompare(right)),
    matchedPlanCount: planPaths.length
  };
}

function determineReviewModeSource(
  explicitFiles: string[],
  summaryFiles: string[],
  planFiles: string[]
): ReviewModeSource {
  if (explicitFiles.length > 0) {
    return "explicit-files";
  }

  if (summaryFiles.length > 0 && planFiles.length > 0) {
    return "phase-evidence";
  }

  if (summaryFiles.length > 0) {
    return "phase-summaries";
  }

  return "phase-plans";
}

function buildReviewScopeConfirmation(args: {
  fileCount: number;
  summaryCount: number;
  matchedPlanCount: number;
  depth: ReviewDepth;
  source: ReviewModeSource;
}): ReviewScopeConfirmation {
  const reasons: string[] = [];

  if (args.fileCount >= REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.broadFileCount) {
    reasons.push(
      `Resolved scope includes ${args.fileCount} files, meeting the broad-scope confirmation threshold of ${REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.broadFileCount}.`
    );
  }

  if (
    args.source !== "explicit-files" &&
    args.summaryCount >= REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.multiPlanCount
  ) {
    reasons.push(
      `Resolved scope includes evidence from ${args.summaryCount} executed plans, meeting the multi-plan confirmation threshold of ${REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.multiPlanCount}.`
    );
  }

  if (
    args.depth === "deep" &&
    args.fileCount >= REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.deepFileCount
  ) {
    reasons.push(
      `Deep review over ${args.fileCount} files meets the deep-review confirmation threshold of ${REVIEW_SCOPE_CONFIRMATION_THRESHOLDS.deepFileCount}.`
    );
  }

  return {
    recommended: reasons.length > 0,
    pendingGate: reasons.length > 0 ? "scope-confirmation" : "none",
    reasons,
    thresholds: { ...REVIEW_SCOPE_CONFIRMATION_THRESHOLDS },
    signals: {
      fileCount: args.fileCount,
      summaryCount: args.summaryCount,
      matchedPlanCount: args.matchedPlanCount,
      depth: args.depth,
      source: args.source
    }
  };
}

function resolveConfiguredReviewDepth(
  value: unknown,
  warnings: string[]
): ReviewDepth {
  if (value === "quick" || value === "standard" || value === "deep") {
    return value;
  }

  if (value !== undefined) {
    warnings.push(
      `Ignoring invalid workflow.code_review_depth value and using standard instead: ${String(value)}`
    );
  }

  return "standard";
}

async function resolveReviewSettings(projectRoot: string, requestedDepth?: ReviewDepth): Promise<{
  allowed: boolean;
  depth: ReviewDepth;
  warnings: string[];
}> {
  try {
    const config = await blueprintConfigGet({
      scope: "effective",
      cwd: projectRoot
    });
    const warnings = [...config.warnings];

    return {
      allowed: config.config.workflow.code_review,
      depth:
        requestedDepth ??
        resolveConfiguredReviewDepth(config.config.workflow.code_review_depth, warnings),
      warnings
    };
  } catch {
    return {
      allowed: true,
      depth: requestedDepth ?? "standard",
      warnings: ["Blueprint review config could not be read; using standard depth."]
    };
  }
}

export async function blueprintReviewScope(
  args: ReviewScopeArgs
): Promise<ReviewScopeResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });
  const reviewSettings = await resolveReviewSettings(projectRoot, args.depth);
  const explicitScopeRequested = (args.files ?? []).some((candidate) => candidate.trim().length > 0);
  const artifacts = {
    plans: located.artifacts
      .filter((artifact) => artifact.endsWith("-PLAN.md"))
      .sort((left, right) => left.localeCompare(right)),
    summaries: located.artifacts
      .filter((artifact) => artifact.endsWith("-SUMMARY.md"))
      .sort((left, right) => left.localeCompare(right)),
    verification: findPhaseArtifact(located.artifacts, "-VERIFICATION.md"),
    uat: findPhaseArtifact(located.artifacts, "-UAT.md"),
    existingReview: findPhaseArtifact(located.artifacts, "-REVIEW.md"),
    security: findPhaseArtifact(located.artifacts, "-SECURITY.md")
  };

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    return {
      status: "invalid",
      phase: null,
      files: [],
      reviewMode: {
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: 0,
        summaryCount: artifacts.summaries.length,
        matchedPlanCount: 0,
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      }),
      artifacts,
      reason: located.reason ?? "Phase could not be resolved for review scoping.",
      warnings: [...located.warnings, ...reviewSettings.warnings]
    };
  }

  if (!reviewSettings.allowed) {
    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName:
          located.phaseName ??
          `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      files: [],
      reviewMode: {
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: 0,
        summaryCount: artifacts.summaries.length,
        matchedPlanCount: 0,
        depth: reviewSettings.depth,
        source: explicitScopeRequested ? "explicit-files" : "phase-plans"
      }),
      artifacts,
      reason: "workflow.code_review is disabled in the effective Blueprint config.",
      warnings: [...located.warnings, ...reviewSettings.warnings]
    };
  }

  const warnings = [...located.warnings];
  const explicitScope = await normalizeExplicitReviewFiles(
    projectRoot,
    args.files ?? [],
    warnings
  );
  const explicitFiles = explicitScope.files;

  if (explicitScopeRequested && explicitScope.rejected) {
    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName:
          located.phaseName ??
          `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      files: [],
      reviewMode: {
        depth: reviewSettings.depth,
        source: "explicit-files"
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: 0,
        summaryCount: artifacts.summaries.length,
        matchedPlanCount: 0,
        depth: reviewSettings.depth,
        source: "explicit-files"
      }),
      artifacts,
      reason:
        "Explicit review scope contained invalid `--files` entries. Re-run with only repo-relative file paths to existing repo files.",
      warnings: [...warnings, ...reviewSettings.warnings]
    };
  }
  let files: string[] = [];
  let source: ReviewModeSource = "phase-plans";
  let summaryCount = artifacts.summaries.length;
  let matchedPlanCount = 0;

  if (explicitFiles.length > 0) {
    files = explicitFiles;
    source = "explicit-files";
  } else {
    const summaryScope = await deriveReviewFilesFromSummaries(
      projectRoot,
      { artifacts: located.artifacts },
      warnings
    );
    const planScope = await deriveReviewFilesFromPlans(
      projectRoot,
      {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        artifacts: located.artifacts
      },
      warnings
    );

    files = [...new Set([...summaryScope.files, ...planScope.files])].sort((left, right) =>
      left.localeCompare(right)
    );
    summaryCount = summaryScope.summaryCount;
    matchedPlanCount = planScope.matchedPlanCount;
    source = determineReviewModeSource(explicitFiles, summaryScope.files, planScope.files);
  }
  if (files.length === 0) {
    const missingSummaries = artifacts.summaries.length === 0;
    const missingPlans = artifacts.plans.length === 0;

    if (missingSummaries) {
      warnings.push(
        "No saved SUMMARY artifacts were found for this phase; implicit review scope resolution requires saved execution evidence."
      );
    }

    if (missingPlans) {
      warnings.push(
        "No saved PLAN artifacts were found for this phase; implicit review scope resolution requires saved plan metadata."
      );
    }

    return {
      status: "invalid",
      phase: {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName:
          located.phaseName ??
          `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
        phaseDir: located.phaseDir,
        resolvedFrom: located.resolvedFrom
      },
      files,
      reviewMode: {
        depth: reviewSettings.depth,
        source
      },
      confirmationRecommended: buildReviewScopeConfirmation({
        fileCount: files.length,
        summaryCount,
        matchedPlanCount,
        depth: reviewSettings.depth,
        source
      }),
      artifacts,
      reason:
        explicitScopeRequested
          ? "No valid repo files remained in the explicit review scope."
          : missingSummaries && missingPlans
            ? "Blueprint could not derive any reviewable repo files because saved SUMMARY and PLAN artifacts were missing for this phase. Re-run with explicit --files paths or restore the saved evidence."
            : missingSummaries
              ? "Blueprint could not derive any reviewable repo files because saved SUMMARY artifacts were missing for this phase. Re-run with explicit --files paths or restore the saved summaries."
              : missingPlans
                ? "Blueprint could not derive any reviewable repo files because saved PLAN artifacts were missing for this phase. Re-run with explicit --files paths or restore the saved plans."
                : "Blueprint could not derive any reviewable repo files from the saved SUMMARY/PLAN evidence. Re-run with explicit --files paths or update the saved artifacts to include repo file paths.",
      warnings: [...warnings, ...reviewSettings.warnings]
    };
  }

  const phase = {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName:
      located.phaseName ??
      `Phase ${located.phasePrefix} ${path.basename(located.phaseDir)}`,
    phaseDir: located.phaseDir,
    resolvedFrom: located.resolvedFrom
  };
  const reviewMode = {
    depth: reviewSettings.depth,
    source
  };
  const reportPath = `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES["code-review"]}`;
  const knownEvidenceArtifacts = collectKnownCodeReviewEvidenceArtifacts(
    {
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      artifacts: located.artifacts
    },
    reportPath
  );
  const authoringContext = args.includeAuthoringContext
    ? await buildCodeReviewAuthoringContext({
        phase,
        files,
        reviewMode,
        knownEvidenceArtifacts
      })
    : undefined;

  return {
    status: "ready",
    phase,
    files,
    reviewMode,
    confirmationRecommended: buildReviewScopeConfirmation({
      fileCount: files.length,
      summaryCount,
      matchedPlanCount,
      depth: reviewSettings.depth,
      source
    }),
    artifacts,
    authoringContext,
    reason: null,
    warnings: [...warnings, ...reviewSettings.warnings]
  };
}

export async function blueprintReviewAuthoringContext(
  args: ReviewAuthoringContextArgs
): Promise<ReviewAuthoringContextResult> {
  const artifact = args.artifact;
  const projectRoot = await ensureRepoRoot(args.cwd);

  if (artifact === "security") {
    return buildSecurityAuthoringContext({
      projectRoot,
      phase: args.phase
    });
  }

  const scoped = await blueprintReviewScope({
    cwd: projectRoot,
    phase: args.phase,
    files: args.files,
    depth: args.depth,
    includeAuthoringContext: true
  });

  if (scoped.status !== "ready" || !scoped.phase || !scoped.authoringContext) {
    const reason = scoped.reason ?? "Code-review authoring context could not resolve a ready review scope.";

    return {
      status: "invalid",
      artifact: "code-review",
      phase: scoped.phase,
      files: scoped.files,
      reviewMode: scoped.reviewMode,
      schemaPath: null,
      baseSchema: readArtifactContract("review.code-review").modelContract
        ? cloneJsonObject(readArtifactContract("review.code-review").modelContract!.jsonSchema)
        : null,
      taskSchema: null,
      modelOnly: true,
      authoringContext: null,
      prerequisiteBlockers: [reason],
      reason,
      warnings: scoped.warnings
    };
  }

  return {
    status: "ready",
    artifact: "code-review",
    phase: scoped.phase,
    files: scoped.files,
    reviewMode: scoped.reviewMode,
    schemaPath: scoped.authoringContext.schemaPath,
    baseSchema: scoped.authoringContext.baseSchema,
    taskSchema: scoped.authoringContext.taskSchema,
    modelOnly: true,
    authoringContext: scoped.authoringContext,
    prerequisiteBlockers: [],
    reason: null,
    warnings: scoped.warnings
  };
}

export async function blueprintReviewValidateModel(
  args: ReviewValidateModelArgs
): Promise<ReviewValidateModelResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const artifact = args.artifact ?? "code-review";
  const context = await blueprintReviewAuthoringContext({
    cwd: projectRoot,
    phase: args.phase,
    artifact,
    files: args.files,
    depth: args.depth
  });

  if (context.status !== "ready" || !context.phase || !context.taskSchema || !context.authoringContext) {
    const diagnostics = context.prerequisiteBlockers.length > 0
      ? context.prerequisiteBlockers.map((message) =>
          modelDiagnostic({
            source: "scope",
            path: "phase",
            code: "scope.invalid",
            message,
            context: {
              reason: context.reason,
              warnings: context.warnings
            },
            suggestion:
              artifact === "security"
                ? "Resolve completed phase execution evidence and live plan provenance before authoring review.security."
                : "Resolve a valid phase review scope first, or pass explicit repo-relative files that exist."
          })
        )
      : [
      modelDiagnostic({
        source: "scope",
        path: "phase",
        code: "scope.invalid",
        message: context.reason ?? "Review model validation could not resolve a ready authoring context.",
        context: {
          reason: context.reason,
          warnings: context.warnings
        },
        suggestion:
          artifact === "security"
            ? "Resolve completed phase execution evidence and live plan provenance before authoring review.security."
            : "Resolve a valid phase review scope first, or pass explicit repo-relative files that exist."
      })
    ];

    return {
      status: "invalid",
      valid: false,
      phase: context.phase,
      files: context.files,
      reviewMode: context.reviewMode ?? {
        depth: args.depth ?? "standard",
        source: "phase-evidence"
      },
      schemaPath: context.schemaPath,
      taskSchema: context.taskSchema,
      diagnostics,
      diagnosticCounts: countDiagnostics(diagnostics),
      normalizedModel: null,
      renderPreview: null,
      warnings: context.warnings
    };
  }

  const modelObject = asJsonObject(args.model);
  const diagnostics: ReviewModelDiagnostic[] = [];

  if (!modelObject) {
    diagnostics.push(
      modelDiagnostic({
        source: "schema",
        path: "model",
        code: "schema.type",
        message: `${artifact === "security" ? "Security review" : "Code-review"} model must be a JSON object.`,
        context: { receivedType: Array.isArray(args.model) ? "array" : typeof args.model },
        suggestion: "Return a JSON object that matches authoringContext.taskSchema."
      })
    );
  }

  let normalizedModel: CodeReviewStructuredModel | null = null;
  let normalizedSecurityModel: SecurityStructuredModel | null = null;

  if (modelObject) {
    const validate = createAjvValidator().compile(context.taskSchema);
    const schemaValid = validate(modelObject);
    if (!schemaValid) {
      diagnostics.push(...(validate.errors ?? []).map(schemaDiagnosticFromAjvError));
    }

    if (artifact === "security") {
      normalizedSecurityModel = normalizeSecurityModel(modelObject);
      diagnostics.push(
        ...await collectSecurityResidualDiagnostics({
          model: modelObject,
          normalizedModel: normalizeSecurityModelForResiduals(modelObject),
          authoringContext: context.authoringContext as SecurityAuthoringContext
        })
      );
    } else {
      normalizedModel = normalizeCodeReviewModel(modelObject);
      const residualModel = normalizeCodeReviewModelForResiduals(modelObject);
      diagnostics.push(
        ...await collectCodeReviewResidualDiagnostics({
          projectRoot,
          model: modelObject,
          normalizedModel: residualModel,
          authoringContext: context.authoringContext as CodeReviewAuthoringContext
        })
      );
    }
  }

  let renderPreview: string | null = null;

  if (artifact === "code-review" && diagnostics.length === 0 && normalizedModel) {
    const located: LocatedReviewPhase = {
      phaseNumber: context.phase.phaseNumber,
      phasePrefix: context.phase.phasePrefix,
      phaseName: context.phase.phaseName,
      phaseDir: context.phase.phaseDir,
      artifacts: [
        ...(context.authoringContext as CodeReviewAuthoringContext).knownEvidenceArtifacts
      ]
    };
    const rendered = renderCodeReviewModelContent(
      normalizedModel,
      located,
      context.authoringContext as CodeReviewAuthoringContext
    );
    const markdownValidation = validateReviewArtifactContent(rendered, "code-review");
    const scopedValidation = validateReviewArtifactScopeCoverage(
      rendered,
      (context.authoringContext as CodeReviewAuthoringContext).files
    );
    const evidenceCoverageIssues = validateCodeReviewEvidenceCoverage(
      rendered,
      (context.authoringContext as CodeReviewAuthoringContext).knownEvidenceArtifacts
    );
    const nextSafeActionIssues = await validateCodeReviewNextSafeAction(rendered);
    const markdownIssues = [
      ...markdownValidation.issues,
      ...scopedValidation.issues,
      ...evidenceCoverageIssues,
      ...nextSafeActionIssues
    ];

    for (const issue of markdownIssues) {
      diagnostics.push(
        modelDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion: "Repair the model so MCP-rendered Markdown satisfies the canonical review artifact contract."
        })
      );
    }

    if (markdownIssues.length === 0) {
      renderPreview = rendered;
    }
  }

  if (artifact === "security" && diagnostics.length === 0 && normalizedSecurityModel) {
    const securityContext = context.authoringContext as SecurityAuthoringContext;
    const located: LocatedReviewPhase = {
      phaseNumber: context.phase.phaseNumber,
      phasePrefix: context.phase.phasePrefix,
      phaseName: context.phase.phaseName,
      phaseDir: context.phase.phaseDir,
      artifacts: securityContext.knownEvidenceArtifacts
    };
    const rendered = renderSecurityModelContent(
      normalizedSecurityModel,
      located,
      securityContext
    );
    const markdownValidation = validateReviewArtifactContent(rendered, "security");
    const markdownIssues = [...markdownValidation.issues];

    for (const issue of markdownIssues) {
      diagnostics.push(
        modelDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion: "Repair the model so MCP-rendered Markdown satisfies the canonical security artifact contract."
        })
      );
    }

    if (markdownIssues.length === 0) {
      renderPreview = rendered;
    }
  }

  return {
    status: diagnostics.length === 0 ? "valid" : "invalid",
    valid: diagnostics.length === 0,
    phase: context.phase,
    files: context.files,
    reviewMode: context.reviewMode ?? {
      depth: args.depth ?? "standard",
      source: "phase-evidence"
    },
    schemaPath: context.schemaPath,
    taskSchema: context.taskSchema,
    diagnostics,
    diagnosticCounts: countDiagnostics(diagnostics),
    normalizedModel: diagnostics.some((diagnostic) => diagnostic.source === "schema")
      ? null
      : artifact === "security"
        ? normalizedSecurityModel
        : normalizedModel,
    renderPreview,
    warnings: context.warnings
  };
}

function sameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size !== rightSet.size) {
    return false;
  }

  return [...leftSet].every((value) => rightSet.has(value));
}

async function resolveCodeReviewRecordValidationFiles(args: {
  projectRoot: string;
  recordArgs: ReviewRecordArgs;
}): Promise<string[] | undefined> {
  if (!args.recordArgs.scopeFiles || args.recordArgs.scopeFiles.length === 0) {
    return undefined;
  }

  if (args.recordArgs.scopeSource) {
    return args.recordArgs.scopeSource === "explicit-files"
      ? args.recordArgs.scopeFiles
      : undefined;
  }

  const implicitScope = await blueprintReviewScope({
    cwd: args.projectRoot,
    phase: args.recordArgs.phase,
    depth: args.recordArgs.depth
  });

  if (
    implicitScope.status === "ready" &&
    sameStringSet(args.recordArgs.scopeFiles, implicitScope.files)
  ) {
    return undefined;
  }

  return args.recordArgs.scopeFiles;
}

export async function blueprintReviewRecord(
  args: ReviewRecordArgs
): Promise<ReviewRecordResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    throw new Error(
      located.reason ?? "Phase could not be resolved for review persistence."
    );
  }

  const reportPath = `${located.phaseDir}/${located.phasePrefix}${REVIEW_ARTIFACT_SUFFIXES[args.artifact]}`;
  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;
  const warnings: string[] = [];
  const modelOnlyArtifact = args.artifact === "code-review" || args.artifact === "security";
  const locatedReviewPhase: LocatedReviewPhase = {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName,
    phaseDir: located.phaseDir,
    artifacts: located.artifacts
  };

  if (modelOnlyArtifact && hasContent) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      warnings: [
        `review.${args.artifact === "security" ? "security" : "code-review"} is model-only; content is invalid. Call blueprint_review_validate_model with JSON first, then persist the same model through blueprint_review_record.`
      ]
    });
  }

  if (modelOnlyArtifact && !hasModel) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      warnings: [
        `review.${args.artifact === "security" ? "security" : "code-review"} requires a structured model. Markdown content fallback is not supported.`
      ]
    });
  }

  if (!modelOnlyArtifact && hasModel) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      warnings: [
        `${args.artifact} does not support structured model writes. Supply canonical Markdown content instead.`
      ]
    });
  }

  if (!modelOnlyArtifact && !hasContent) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      warnings: [
        "Review artifact writes must supply Markdown content for non-code-review artifacts."
      ]
    });
  }

  let content = args.content ?? "";
  let codeReviewScopeFiles: string[] = [];

  if (modelOnlyArtifact) {
    const modelArtifact = args.artifact === "security" ? "security" : "code-review";
    const validationFiles =
      args.artifact === "code-review"
        ? await resolveCodeReviewRecordValidationFiles({
            projectRoot,
            recordArgs: args
          })
        : undefined;
    const validation = await blueprintReviewValidateModel({
      cwd: projectRoot,
      phase: args.phase,
      artifact: modelArtifact,
      files: validationFiles,
      depth: args.depth,
      model: args.model
    });

    if (!validation.valid || !validation.renderPreview) {
      return reviewRecordInvalidResult({
        located: locatedReviewPhase,
        artifact: args.artifact,
        reportPath,
        warnings: [
          ...warnings,
          ...validation.diagnostics.map(formatReviewDiagnostic)
        ]
      });
    }

    content = validation.renderPreview;
    codeReviewScopeFiles = args.artifact === "code-review" ? validation.files : [];
  }

  const prepared = prepareTextForPersistence(normalizeTextContent(content), {
    label: reportPath
  });
  const normalizedContent = normalizeTextContent(prepared.content);
  const { counts, followUps } = collectReviewCounts(normalizedContent, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, reportPath);
  const exists = await pathExists(absolutePath);
  warnings.push(...prepared.warnings);
  const validation = validateReviewArtifactContent(normalizedContent, args.artifact);
  const evidenceCoverageIssues =
    args.artifact === "code-review"
      ? validateCodeReviewEvidenceCoverage(
          normalizedContent,
          collectKnownCodeReviewEvidenceArtifacts(locatedReviewPhase, reportPath)
        )
      : [];
  const nextSafeActionIssues =
    args.artifact === "code-review"
      ? await validateCodeReviewNextSafeAction(normalizedContent)
      : [];

  if (normalizedContent.trim().length === 0) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      counts,
      followUps,
      warnings: [...warnings, `${reportPath} content must not be empty.`]
    });
  }

  if (!validation.valid) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      counts,
      followUps,
      warnings: [...warnings, ...validation.issues]
    });
  }

  if (evidenceCoverageIssues.length > 0) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      counts,
      followUps,
      warnings: [...warnings, ...evidenceCoverageIssues]
    });
  }

  if (nextSafeActionIssues.length > 0) {
    return reviewRecordInvalidResult({
      located: locatedReviewPhase,
      artifact: args.artifact,
      reportPath,
      counts,
      followUps,
      warnings: [...warnings, ...nextSafeActionIssues]
    });
  }

  if (args.artifact === "code-review" && codeReviewScopeFiles.length > 0) {
    const scopedValidation = validateReviewArtifactScopeCoverage(
      normalizedContent,
      codeReviewScopeFiles
    );

    if (!scopedValidation.valid) {
      return reviewRecordInvalidResult({
        located: locatedReviewPhase,
        artifact: args.artifact,
        reportPath,
        counts,
        followUps,
        warnings: [...warnings, ...scopedValidation.issues]
      });
    }
  }

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");

    if (existingContent === normalizedContent) {
      warnings.push("Preserved existing review artifact because the content was unchanged.");

      return {
        phaseNumber: located.phaseNumber,
        phasePrefix: located.phasePrefix,
        phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
        phaseDir: located.phaseDir,
        artifact: args.artifact,
        reportPath,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        counts,
        followUps,
        warnings
      };
    }

    if (!(args.overwrite ?? false)) {
      throw new Error(
        `${reportPath} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  warnings.push(
    ...await writeTextFile(absolutePath, normalizedContent, {
      label: reportPath,
      enforcePromptBoundary: false
    })
  );

  if (exists) {
    warnings.push(`Replaced existing review artifact: ${reportPath}`);
  }

  warnings.push(...validation.warnings);

  return {
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
    phaseDir: located.phaseDir,
    artifact: args.artifact,
    reportPath,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    counts,
    followUps,
    warnings
  };
}

export async function blueprintReviewLoadFindings(
  args: ReviewLoadFindingsArgs
): Promise<ReviewLoadFindingsResult> {
  const artifact = args.artifact ?? "code-review";
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = await blueprintPhaseLocate({
    cwd: projectRoot,
    phase: args.phase
  });

  if (
    !located.found ||
    !located.phaseNumber ||
    !located.phasePrefix ||
    !located.phaseDir
  ) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifact,
      path: null,
      findings: [],
      severityCounts: emptySeverityCounts(),
      followUps: [],
      reason:
        located.reason ?? "Phase could not be resolved for review findings loading.",
      warnings: [
        ...located.warnings
      ]
    };
  }

  const artifactPath =
    located.artifacts.find((candidate) =>
      candidate.endsWith(REVIEW_ARTIFACT_SUFFIXES[artifact])
    ) ?? null;

  if (!artifactPath) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
      phaseDir: located.phaseDir,
      artifact,
      path: null,
      findings: [],
      severityCounts: emptySeverityCounts(),
      followUps: [],
      reason: `Phase ${located.phaseNumber} does not have a saved ${REVIEW_ARTIFACT_SUFFIXES[artifact]} artifact yet.`,
      warnings: located.warnings
    };
  }

  const content = await fs.readFile(
    resolveBlueprintPath(projectRoot, artifactPath),
    "utf8"
  );
  const parsed = parseFindingsFromArtifact(content, artifact);

  return {
    phaseFound: true,
    found: true,
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName ?? `Phase ${located.phasePrefix}`,
    phaseDir: located.phaseDir,
    artifact,
    path: artifactPath,
    findings: parsed.findings,
    severityCounts: parsed.severityCounts,
    followUps: parsed.followUps,
    reason: null,
    warnings:
      parsed.findings.length === 0
        ? [
            ...located.warnings,
            `No structured findings were parsed from ${artifactPath}.`
          ]
        : located.warnings
  };
}

export const reviewToolDefinitions = [
  {
    name: "blueprint_review_scope",
    description:
      "Resolve a phase-backed Blueprint code-review scope, including effective review settings and saved phase evidence, from executed plan metadata or explicit repo file paths.",
    inputSchema: reviewScopeInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewScope(args as ReviewScopeArgs)
  },
  {
    name: "blueprint_review_load_findings",
    description:
      "Load structured findings and severity counts from a saved phase-scoped Blueprint review artifact.",
    inputSchema: reviewLoadFindingsInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewLoadFindings(args as ReviewLoadFindingsArgs)
  },
  {
    name: "blueprint_review_validate_model",
    description:
      "Validate a model-authored review.code-review or review.security JSON payload against the runtime task schema, residual quality checks, and canonical Markdown render before persistence.",
    inputSchema: reviewValidateModelInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewValidateModel(args as ReviewValidateModelArgs)
  },
  {
    name: "blueprint_review_authoring_context",
    description:
      "Build the model-only review authoring context and narrowed task schema for review.code-review or review.security before model drafting.",
    inputSchema: reviewAuthoringContextInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewAuthoringContext(args as ReviewAuthoringContextArgs)
  },
  {
    name: "blueprint_review_record",
    description:
      "Persist a phase-scoped Blueprint review artifact such as SECURITY, REVIEW, or UI-REVIEW with overwrite protection; code-review and security persist model-authored JSON only after validator replay.",
    inputSchema: reviewRecordInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintReviewRecord(args as ReviewRecordArgs)
  }
];
