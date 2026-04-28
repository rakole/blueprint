import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import * as z from "zod/v4";

import {
  artifactToolDefinitions,
  ensureRepoRoot,
  getProjectRoot,
  toRepoRelativePath
} from "./artifacts.js";
import { blueprintConfigGet, configToolDefinitions } from "./config.js";
import {
  blueprintPhaseContext,
  blueprintRoadmapRead,
  phaseToolDefinitions
} from "./phase.js";
import { reviewToolDefinitions } from "./review.js";
import { stateToolDefinitions } from "./state.js";
import { updateToolDefinitions } from "./update.js";
import { workspaceToolDefinitions } from "./workspace.js";
import { listArtifactContracts } from "../artifact-contracts/index.js";
import { resolveBlueprintRuntimeHost } from "../runtime-host.js";
import {
  ensurePathWithinRootSync,
  safeJsonParseObject
} from "../../shared/security.js";

type ImpactStatus = "PASS" | "WARN" | "BLOCK";
type ImpactRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
type ImpactConfidenceLevel = "low" | "medium" | "high";
type ImpactSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type ImpactOutputMode = "human" | "json" | "markdown" | "pr-comment" | "summary";
type ImpactScopeMode = NonNullable<ImpactScopeResolveArgs["mode"]>;
type ImpactScopeKind = Exclude<ImpactScopeMode, "auto"> | "unresolved";
type ImpactConfigStatus = "ok" | "invalid";
type ImpactScopeStatus = "resolved" | "unresolved";

type ImpactConfigGetArgs = {
  cwd?: string;
  configPath?: string;
  strictConfig?: boolean;
  overrides?: Record<string, unknown>;
};

type ImpactScopeResolveArgs = {
  cwd?: string;
  mode?:
    | "auto"
    | "staged"
    | "working-tree"
    | "range"
    | "base-head"
    | "files"
    | "diff-file"
    | "description";
  description?: string;
  range?: string;
  base?: string;
  head?: string;
  files?: string[];
  diffFile?: string;
  phase?: string | number;
  roadmapItem?: string;
  seedFile?: string;
  meta?: Record<string, string>;
};

type ImpactContextLoadArgs = {
  cwd?: string;
  phase?: string | number;
  roadmapItem?: string;
  includeRuntime?: boolean;
  includeCatalog?: boolean;
  includeArtifacts?: boolean;
};

type ImpactAnalyzeArgs = {
  cwd?: string;
  changedFiles?: string[];
  files?: string[];
  scope?: Record<string, unknown>;
  context?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

type ImpactReportWriteArgs = {
  cwd?: string;
  impactId?: string;
  report?: Record<string, unknown>;
  overwrite?: boolean;
  writeEvidenceLog?: boolean;
};

type ImpactOutputRenderArgs = {
  cwd?: string;
  mode?: ImpactOutputMode;
  impactId?: string;
  report?: Record<string, unknown>;
  verbosity?: "compact" | "normal" | "detailed";
};

type ImpactConfidence = {
  score: number;
  level: ImpactConfidenceLevel;
  reasons: string[];
};

type ImpactRisk = {
  level: ImpactRiskLevel;
  reasons: string[];
};

type ImpactScopeSummary = {
  kind: ImpactScopeKind;
  description: string | null;
  files: string[];
  source: string;
};

type ImpactConfig = {
  schemaVersion: typeof IMPACT_SCHEMA_VERSION;
  baseBranches: string[];
  paths: {
    include: string[];
    ignore: string[];
    generated: string[];
    docs: string[];
    tests: string[];
  };
  ownership: {
    sources: string[];
    requiredOwnerMatch: boolean;
    fallbackReviewers: string[];
  };
  dependencyGraph: {
    sources: string[];
    customGraphFiles: string[];
    requireReverseDepsFor: string[];
  };
  risk: {
    blockOnCritical: boolean;
    blockOnBreakingContract: boolean;
    blockOnSensitiveUnknownOwner: boolean;
    warnBelowConfidence: number;
    blockBelowConfidenceForSensitiveAreas: number;
  };
  reporting: {
    defaultVerbosity: "compact" | "normal" | "detailed";
    writeEvidenceLog: boolean;
    redactPathPatterns: string[];
  };
};

type ImpactConfigGetResult = {
  status: ImpactConfigStatus;
  config: ImpactConfig;
  provenance: {
    layersApplied: string[];
    defaultsPath: string | null;
    projectPath: string | null;
    invocationPath: string | null;
  };
  warnings: string[];
  errors: string[];
  configHash: string;
};

type ImpactScopeResolveResult = {
  status: ImpactScopeStatus;
  scope: ImpactScopeSummary;
  changedFiles: string[];
  git: {
    mode: ImpactScopeMode;
    range: string | null;
    base: string | null;
    head: string | null;
  };
  diffStats: {
    filesChanged: number;
    additions: number | null;
    deletions: number | null;
  };
  patchHash: string | null;
  scopeFingerprint: string;
  confidence: ImpactConfidence;
  warnings: string[];
};

type DiffMetadata = {
  changedFiles: string[];
  additions: number | null;
  deletions: number | null;
  patchHash: string | null;
};

type ImpactSurface =
  | "secret-sensitive"
  | "env-config"
  | "command-catalog"
  | "command-manifest"
  | "command-doc"
  | "runtime-reference"
  | "mcp-server"
  | "mcp-tool"
  | "mcp-resource"
  | "artifact-contract"
  | "skill"
  | "agent"
  | "extension-manifest"
  | "hook"
  | "package-runtime"
  | "build-config"
  | "test"
  | "docs"
  | "generated"
  | "config"
  | "source"
  | "repo-root"
  | "unknown";

type ImpactSurfaceRecord = {
  path: string;
  surfaces: ImpactSurface[];
  primarySurface: ImpactSurface;
  area: string;
  reasons: string[];
};

type ImpactSummaryRecord = {
  name: string;
  files: string[];
  count: number;
};

type ImpactRuntimeContext = {
  registeredTools: string[];
  registeredImpactTools: string[];
  implementationPhase: number;
  readOnly: boolean;
  includeRuntime: boolean;
  includeCatalog: boolean;
  includeArtifacts: boolean;
};

type ImpactRepoHints = {
  cwdAccepted: boolean;
  packageMetadataLoaded: boolean;
  packageJsonPath: string | null;
  packageName: string | null;
  packageVersion: string | null;
  packageScripts: string[];
  packageManager: string | null;
  testPaths: string[];
  docsPaths: string[];
  sourceRoots: string[];
  artifactContractsLoaded: boolean;
};

type ImpactCommandAssets = {
  commandCount: number;
  implementedCommands: string[];
  nonRoutableCommands: string[];
  manifestPaths: string[];
  specPaths: string[];
  skillPaths: string[];
  missingAssetCount: number;
  impact: unknown;
};

type ImpactPhaseContextEntry = {
  phaseNumber: string;
  phaseName: string | null;
  requestedBy: string[];
  context: unknown;
  warnings: string[];
};

type ImpactContextLoadResult = {
  status: "loaded" | "partial";
  project: unknown | null;
  config: Awaited<ReturnType<typeof blueprintConfigGet>> | null;
  roadmap: Awaited<ReturnType<typeof blueprintRoadmapRead>> | null;
  phases: ImpactPhaseContextEntry[];
  catalog?: unknown;
  commandAssets?: ImpactCommandAssets;
  artifactContracts?: ReturnType<typeof listArtifactContracts>;
  runtime?: ImpactRuntimeContext;
  repoHints: ImpactRepoHints;
  warnings: string[];
};

type ImpactAnalysisReport = Record<string, unknown> & {
  schemaVersion: "blueprint.impact.report.v1";
  impactId: string;
  status: ImpactStatus;
  impactStatus: ImpactStatus;
  summary: string;
  scope: ImpactReportScope;
  files: string[];
  risk: ImpactRisk;
  confidence: ImpactConfidence;
  scoring: ImpactScoringSummary;
  topImpactedAreas: ImpactSummaryRecord[];
  requiredReviewers: string[];
  requiredTests: string[];
  requiredActions: string[];
  blockingFindings: ImpactFindingRecord[];
  warningFindings: ImpactFindingRecord[];
  surfaces: ImpactSurfaceRecord[];
  areaSummary: ImpactSummaryRecord[];
  surfaceSummary: ImpactSummaryRecord[];
  ownership: ImpactOwnershipAnalysis;
  dependencyGraph: ImpactDependencyAnalysis;
  findings: ImpactFindingRecord[];
  obligations: ImpactObligationRecord[];
  unknowns: ImpactUnknownRecord[];
  evidence: ImpactEvidenceRecord[];
};

type ImpactAnalyzeResult = {
  phaseStatus: "scored-report-modeled";
  impactId: string;
  status: ImpactStatus;
  impactStatus: ImpactStatus;
  risk: ImpactRisk;
  confidence: ImpactConfidence;
  surfaces: ImpactSurfaceRecord[];
  areaSummary: ImpactSummaryRecord[];
  surfaceSummary: ImpactSummaryRecord[];
  ownership: ImpactOwnershipAnalysis;
  dependencyGraph: ImpactDependencyAnalysis;
  findings: ImpactFindingRecord[];
  obligations: ImpactObligationRecord[];
  unknowns: ImpactUnknownRecord[];
  evidence: ImpactEvidenceRecord[];
  report: ImpactAnalysisReport;
  warnings: string[];
};

type ImpactReportScope = {
  kind: string;
  source: string | null;
  description: string | null;
  fingerprint: string;
  confidence: ImpactConfidence;
};

type ImpactScoringSummary = {
  status: ImpactStatus;
  riskLevel: ImpactRiskLevel;
  confidenceScore: number;
  confidenceLevel: ImpactConfidenceLevel;
  maxSeverity: ImpactSeverity | null;
  blocking: boolean;
  drivers: string[];
  reducers: string[];
  policy: {
    blockOnCritical: boolean;
    blockOnBreakingContract: boolean;
    blockOnSensitiveUnknownOwner: boolean;
    warnBelowConfidence: number;
    blockBelowConfidenceForSensitiveAreas: number;
  };
};

type ImpactEvidenceRecord = {
  id: string;
  kind:
    | "scope"
    | "surface"
    | "ownership"
    | "dependency"
    | "metadata"
    | "config"
    | "contract"
    | "obligation"
    | "build";
  source: string;
  summary: string;
  paths: string[];
  data?: Record<string, unknown>;
};

type ImpactUnknownCategory =
  | "scope"
  | "ownership"
  | "dependency"
  | "contract"
  | "obligation";

type ImpactUnknownRecord = {
  id: string;
  category: ImpactUnknownCategory;
  title: string;
  severity: ImpactSeverity;
  impactedFiles: string[];
  reason: string;
  resolution: string;
  evidenceRefs: string[];
};

type ImpactFindingRecord = {
  id: string;
  checkId: string;
  title: string;
  severity: ImpactSeverity;
  status: ImpactStatus;
  confidence: number;
  impactedFiles: string[];
  impactedAreas: string[];
  owners: string[];
  requiredActions: string[];
  evidenceRefs: string[];
};

type ImpactObligationCategory =
  | "contract-review"
  | "docs"
  | "tests"
  | "release"
  | "migration"
  | "security"
  | "deployment"
  | "build";

type ImpactObligationRecord = {
  id: string;
  category: ImpactObligationCategory;
  title: string;
  severity: ImpactSeverity;
  status: ImpactStatus;
  impactedFiles: string[];
  sourceSurfaces: ImpactSurface[];
  requiredActions: string[];
  evidenceRefs: string[];
};

type ImpactOwnershipRule = {
  source: "codeowners" | "metadata";
  sourcePath: string;
  pattern: string;
  owners: string[];
  sensitive: boolean;
  line: number | null;
  order: number;
};

type ImpactOwnershipMatch = {
  path: string;
  owners: string[];
  matchedRules: ImpactOwnershipRule[];
  fallbackReviewers: string[];
  fallbackUsed: boolean;
  sensitive: boolean;
  ownerMissing: boolean;
  evidenceRefs: string[];
};

type ImpactOwnershipCoverage = {
  status: "none" | "partial" | "complete";
  sourcesConfigured: string[];
  sourcesUsed: string[];
  fallbackReviewers: string[];
  filesWithOwners: number;
  filesMissingOwners: number;
  gaps: string[];
};

type ImpactOwnershipAnalysis = {
  coverage: ImpactOwnershipCoverage;
  codeownersPath: string | null;
  metadataPaths: string[];
  rules: ImpactOwnershipRule[];
  matches: ImpactOwnershipMatch[];
};

type ImpactDependencyNode = {
  id: string;
  path: string | null;
  kind: "package" | "workspace" | "file" | "external" | "custom";
  source: string;
};

type ImpactDependencyEdge = {
  from: string;
  to: string;
  type: string;
  source: string;
};

type ImpactDependencyCoverage = {
  status: "none" | "partial" | "complete-ish";
  sourcesConfigured: string[];
  sourcesUsed: string[];
  filesCovered: string[];
  filesUncovered: string[];
  gaps: string[];
};

type ImpactDependencyAnalysis = {
  coverage: ImpactDependencyCoverage;
  nodes: ImpactDependencyNode[];
  edges: ImpactDependencyEdge[];
  reverseDependentsByPath: Record<string, string[]>;
};

type ImpactFileInputSource = {
  label: string;
  files: string[];
};

type ImpactPackageMetadata = {
  loaded: boolean;
  name: string | null;
  version: string | null;
  scripts: string[];
  packageManager: string | null;
  warnings: string[];
  partial: boolean;
};

type RoadmapPhaseLike = {
  phaseNumber: string;
  phaseName: string;
  requirements: string[];
};

type CommandCatalogEntryLike = {
  command?: unknown;
  route?: unknown;
  primarySkill?: unknown;
  declaredStatus?: unknown;
  status?: unknown;
  implemented?: unknown;
  blockedBy?: unknown;
  manifestPath?: unknown;
  skillPath?: unknown;
  specPath?: unknown;
  requiredTools?: unknown;
  requiredToolsSatisfied?: unknown;
};

type CommandCatalogLike = {
  commands?: Record<string, CommandCatalogEntryLike>;
};

type PackageJsonLike = {
  name?: unknown;
  version?: unknown;
  scripts?: unknown;
  packageManager?: unknown;
};

type ImpactSurfaceRule = {
  surface: ImpactSurface;
  reason: string;
};

type ImpactReportWriteResult = {
  status: "written" | "reused" | "overwritten" | "invalid";
  impactId: string;
  impactDir: string;
  paths: {
    impactMarkdown: string;
    impactJson: string;
    summaryJson: string;
    evidenceJsonl: string | null;
    reviewChecklist: string | null;
    questions: string | null;
  };
  written: boolean;
  errors: string[];
  warnings: string[];
};

type ImpactOutputRenderResult = {
  phaseStatus: "rendered";
  mode: ImpactOutputMode;
  status: ImpactStatus;
  impactStatus: ImpactStatus;
  content: string;
  impactId: string;
  warnings: string[];
};

const IMPACT_TOOL_NAMES = [
  "blueprint_impact_config_get",
  "blueprint_impact_scope_resolve",
  "blueprint_impact_context_load",
  "blueprint_impact_analyze",
  "blueprint_impact_report_write",
  "blueprint_impact_output_render"
] as const;
const PROJECT_RUNTIME_TOOL_NAMES = [
  "blueprint_command_catalog",
  "blueprint_project_init",
  "blueprint_project_status"
] as const;

const IMPACT_SCHEMA_VERSION = "blueprint.impact.config.v1";
const IMPACT_REPORT_SCHEMA_VERSION = "blueprint.impact.report.v1";
const OWNERSHIP_SCHEMA_VERSION = "blueprint.impact.ownership.v1";
const DEPENDENCY_GRAPH_SCHEMA_VERSION = "blueprint.impact.dependency-graph.v1";
const IMPACT_PROJECT_CONFIG_PATH = ".blueprint/impact/config.json";
const IMPACT_REPORT_ROOT = ".blueprint/impact";
const IMPACT_GLOBAL_DEFAULTS_BASENAME = "impact.defaults.json";
const GIT_COMMAND_TIMEOUT_MS = 15_000;
const CODEOWNERS_CANDIDATES = [
  "CODEOWNERS",
  ".github/CODEOWNERS",
  "docs/CODEOWNERS"
] as const;
const PACKAGE_JSON_SOURCE = "package-json";
const PACKAGE_LOCK_SOURCE = "package-lock";
const TS_IMPORT_SCAN_SOURCE = "ts-import-scan";
const CUSTOM_GRAPH_SOURCE = "custom-graph";
const BOUNDED_SOURCE_ROOTS = ["src", "lib", "packages", "apps"] as const;
const KNOWN_IMPACT_CONFIG_TOP_LEVEL_KEYS = [
  "schemaVersion",
  "baseBranches",
  "paths",
  "ownership",
  "dependencyGraph",
  "risk",
  "reporting"
] as const;
const BUILT_IN_BASE_BRANCHES = ["main", "master"] as const;
const execFileAsync = promisify(execFile);
const IMPACT_SURFACE_PRIORITY: Record<ImpactSurface, number> = {
  "secret-sensitive": 1,
  "env-config": 2,
  "command-catalog": 3,
  "command-manifest": 4,
  "command-doc": 5,
  "runtime-reference": 6,
  "mcp-server": 7,
  "mcp-tool": 8,
  "mcp-resource": 9,
  "artifact-contract": 10,
  skill: 11,
  agent: 12,
  "extension-manifest": 13,
  hook: 14,
  "package-runtime": 15,
  "build-config": 16,
  test: 17,
  docs: 18,
  generated: 19,
  config: 20,
  source: 21,
  "repo-root": 22,
  unknown: 23
};
const SOURCE_FILE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx"
]);
const CONFIG_FILE_EXTENSIONS = new Set([".json", ".jsonc", ".toml", ".yaml", ".yml"]);
const DOC_FILE_EXTENSIONS = new Set([".md", ".mdx", ".markdown", ".rst", ".txt"]);
const TEST_FILE_PATTERNS = [
  /\.test\.[^.]+$/u,
  /\.spec\.[^.]+$/u,
  /(^|\/)__tests__\//u,
  /(^|\/)tests?\//u
] as const;
const GENERATED_FILE_PATTERNS = [
  /(^|\/)dist\//u,
  /\.generated\./u,
  /\.gen\./u,
  /\.d\.ts$/u
] as const;
const SECRET_PATH_PATTERN =
  /(^|\/)(secrets?|credentials?|tokens?)(\/|$)|(^|[-_.])(secret|credential|token)([-_.]|$)/iu;
const IMPACT_REPORT_REQUIRED_HEADINGS = [
  "Summary",
  "Change Scope",
  "Top Impacted Areas",
  "Required Reviewers",
  "Required Tests",
  "Blocking Findings",
  "Warnings",
  "Contract And Compatibility Impact",
  "Database, Config, Infra, And Deployment Impact",
  "Unknowns And Missing Metadata",
  "Evidence",
  "Suggested Next Actions"
] as const;
const IMPACT_OPTIONAL_BUNDLE_FILES = [
  "evidence.jsonl",
  "review-checklist.md",
  "QUESTIONS.md"
] as const;
const IMPACT_REQUIRED_BUNDLE_FILES = ["IMPACT.md", "impact.json", "summary.json"] as const;
const IMPACT_ALLOWED_BUNDLE_FILES = new Set<string>([
  ...IMPACT_REQUIRED_BUNDLE_FILES,
  ...IMPACT_OPTIONAL_BUNDLE_FILES
]);
const NON_PATH_SCOPE_SOURCES = new Set([
  "git-staged",
  "git-working-tree",
  "git-range",
  "git-base-head",
  "git-current-branch",
  "ci-pr-refs",
  "ci-head-parent",
  "explicit-files",
  "description-only",
  "unresolved"
]);

const nonEmptyStringSchema = z.string().trim().min(1);
const impactModeSchema = z.enum([
  "auto",
  "staged",
  "working-tree",
  "range",
  "base-head",
  "files",
  "diff-file",
  "description"
]);
const impactIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^impact-[a-z0-9][a-z0-9._-]*$/u);
const outputModeSchema = z.enum(["human", "json", "markdown", "pr-comment", "summary"]);
const configVerbositySchema = z.enum(["compact", "normal", "detailed"]);

const impactConfigGetInputSchema = {
  cwd: z.string().optional(),
  configPath: z.string().optional(),
  strictConfig: z.boolean().optional(),
  overrides: z.record(z.string(), z.unknown()).optional()
};

const impactScopeResolveInputSchema = {
  cwd: z.string().optional(),
  mode: impactModeSchema.optional(),
  description: z.string().optional(),
  range: nonEmptyStringSchema.optional(),
  base: nonEmptyStringSchema.optional(),
  head: nonEmptyStringSchema.optional(),
  files: z.array(nonEmptyStringSchema).optional(),
  diffFile: nonEmptyStringSchema.optional(),
  phase: z.union([z.string(), z.number()]).optional(),
  roadmapItem: nonEmptyStringSchema.optional(),
  seedFile: nonEmptyStringSchema.optional(),
  meta: z.record(z.string(), z.string()).optional()
};

const impactContextLoadInputSchema = {
  cwd: z.string().optional(),
  phase: z.union([z.string(), z.number()]).optional(),
  roadmapItem: nonEmptyStringSchema.optional(),
  includeRuntime: z.boolean().optional(),
  includeCatalog: z.boolean().optional(),
  includeArtifacts: z.boolean().optional()
};

const impactAnalyzeInputSchema = {
  cwd: z.string().optional(),
  changedFiles: z.array(nonEmptyStringSchema).optional(),
  files: z.array(nonEmptyStringSchema).optional(),
  scope: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  config: z.record(z.string(), z.unknown()).optional()
};

const impactReportWriteInputSchema = {
  cwd: z.string().optional(),
  impactId: impactIdSchema.optional(),
  report: z.record(z.string(), z.unknown()).optional(),
  overwrite: z.boolean().optional(),
  writeEvidenceLog: z.boolean().optional()
};

const impactOutputRenderInputSchema = {
  cwd: z.string().optional(),
  mode: outputModeSchema.optional(),
  impactId: impactIdSchema.optional(),
  report: z.record(z.string(), z.unknown()).optional(),
  verbosity: z.enum(["compact", "normal", "detailed"]).optional()
};

const stringArraySchema = z.array(nonEmptyStringSchema);
const partialImpactConfigSchema = z
  .object({
    schemaVersion: z.literal(IMPACT_SCHEMA_VERSION).optional(),
    baseBranches: stringArraySchema.optional(),
    paths: z
      .object({
        include: stringArraySchema.optional(),
        ignore: stringArraySchema.optional(),
        generated: stringArraySchema.optional(),
        docs: stringArraySchema.optional(),
        tests: stringArraySchema.optional()
      })
      .optional(),
    ownership: z
      .object({
        sources: stringArraySchema.optional(),
        requiredOwnerMatch: z.boolean().optional(),
        fallbackReviewers: stringArraySchema.optional()
      })
      .optional(),
    dependencyGraph: z
      .object({
        sources: stringArraySchema.optional(),
        customGraphFiles: stringArraySchema.optional(),
        requireReverseDepsFor: stringArraySchema.optional()
      })
      .optional(),
    risk: z
      .object({
        blockOnCritical: z.boolean().optional(),
        blockOnBreakingContract: z.boolean().optional(),
        blockOnSensitiveUnknownOwner: z.boolean().optional(),
        warnBelowConfidence: z.number().min(0).max(1).optional(),
        blockBelowConfidenceForSensitiveAreas: z.number().min(0).max(1).optional()
      })
      .optional(),
    reporting: z
      .object({
        defaultVerbosity: configVerbositySchema.optional(),
        writeEvidenceLog: z.boolean().optional(),
        redactPathPatterns: stringArraySchema.optional()
      })
      .optional()
  })
  .passthrough();
const impactConfigSchema = z.object({
  schemaVersion: z.literal(IMPACT_SCHEMA_VERSION),
  baseBranches: stringArraySchema,
  paths: z.object({
    include: stringArraySchema,
    ignore: stringArraySchema,
    generated: stringArraySchema,
    docs: stringArraySchema,
    tests: stringArraySchema
  }),
  ownership: z.object({
    sources: stringArraySchema,
    requiredOwnerMatch: z.boolean(),
    fallbackReviewers: stringArraySchema
  }),
  dependencyGraph: z.object({
    sources: stringArraySchema,
    customGraphFiles: stringArraySchema,
    requireReverseDepsFor: stringArraySchema
  }),
  risk: z.object({
    blockOnCritical: z.boolean(),
    blockOnBreakingContract: z.boolean(),
    blockOnSensitiveUnknownOwner: z.boolean(),
    warnBelowConfidence: z.number().min(0).max(1),
    blockBelowConfidenceForSensitiveAreas: z.number().min(0).max(1)
  }),
  reporting: z.object({
    defaultVerbosity: configVerbositySchema,
    writeEvidenceLog: z.boolean(),
    redactPathPatterns: stringArraySchema
  })
});
const impactScopeSeedSchema = z
  .object({
    mode: impactModeSchema.optional(),
    description: z.string().optional(),
    range: nonEmptyStringSchema.optional(),
    base: nonEmptyStringSchema.optional(),
    head: nonEmptyStringSchema.optional(),
    files: z.array(nonEmptyStringSchema).optional(),
    diffFile: nonEmptyStringSchema.optional(),
    phase: z.union([z.string(), z.number()]).optional(),
    roadmapItem: nonEmptyStringSchema.optional(),
    meta: z.record(z.string(), z.string()).optional()
  })
  .passthrough();
const ownershipMetadataSchema = z.object({
  schemaVersion: z.literal(OWNERSHIP_SCHEMA_VERSION),
  rules: z
    .array(
      z.object({
        pattern: nonEmptyStringSchema,
        owners: stringArraySchema.optional().default([]),
        sensitive: z.boolean().optional().default(false)
      })
    )
    .optional()
    .default([]),
  fallbackReviewers: stringArraySchema.optional().default([])
});
const dependencyGraphMetadataSchema = z.object({
  schemaVersion: z.literal(DEPENDENCY_GRAPH_SCHEMA_VERSION),
  nodes: z
    .array(
      z.object({
        id: nonEmptyStringSchema,
        path: nonEmptyStringSchema.optional()
      })
    )
    .optional()
    .default([]),
  edges: z
    .array(
      z.object({
        from: nonEmptyStringSchema,
        to: nonEmptyStringSchema,
        type: nonEmptyStringSchema.optional().default("depends-on")
      })
    )
    .optional()
    .default([])
});
const impactStatusSchema = z.enum(["PASS", "WARN", "BLOCK"]);
const impactRiskLevelSchema = z.enum(["low", "medium", "high", "critical", "unknown"]);
const impactConfidenceLevelSchema = z.enum(["low", "medium", "high"]);
const impactSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const impactSurfaceSchema = z.enum([
  "secret-sensitive",
  "env-config",
  "command-catalog",
  "command-manifest",
  "command-doc",
  "runtime-reference",
  "mcp-server",
  "mcp-tool",
  "mcp-resource",
  "artifact-contract",
  "skill",
  "agent",
  "extension-manifest",
  "hook",
  "package-runtime",
  "build-config",
  "test",
  "docs",
  "generated",
  "config",
  "source",
  "repo-root",
  "unknown"
]);
const impactConfidenceSchema = z
  .object({
    score: z.number().min(0).max(1),
    level: impactConfidenceLevelSchema,
    reasons: stringArraySchema
  })
  .strict();
const impactRiskSchema = z
  .object({
    level: impactRiskLevelSchema,
    reasons: stringArraySchema
  })
  .strict();
const impactReportScopeSchema = z
  .object({
    kind: nonEmptyStringSchema,
    source: z.string().nullable(),
    description: z.string().nullable(),
    fingerprint: nonEmptyStringSchema,
    confidence: impactConfidenceSchema
  })
  .strict();
const impactScoringSchema = z
  .object({
    status: impactStatusSchema,
    riskLevel: impactRiskLevelSchema,
    confidenceScore: z.number().min(0).max(1),
    confidenceLevel: impactConfidenceLevelSchema,
    maxSeverity: impactSeveritySchema.nullable(),
    blocking: z.boolean(),
    drivers: z.array(z.string()),
    reducers: z.array(z.string()),
    policy: z
      .object({
        blockOnCritical: z.boolean(),
        blockOnBreakingContract: z.boolean(),
        blockOnSensitiveUnknownOwner: z.boolean(),
        warnBelowConfidence: z.number().min(0).max(1),
        blockBelowConfidenceForSensitiveAreas: z.number().min(0).max(1)
      })
      .strict()
  })
  .strict();
const impactSummaryRecordSchema = z
  .object({
    name: nonEmptyStringSchema,
    files: z.array(nonEmptyStringSchema),
    count: z.number().int().min(0)
  })
  .strict();
const impactEvidenceSchema = z
  .object({
    id: nonEmptyStringSchema,
    kind: z.enum([
      "scope",
      "surface",
      "ownership",
      "dependency",
      "metadata",
      "config",
      "contract",
      "obligation",
      "build"
    ]),
    source: nonEmptyStringSchema,
    summary: nonEmptyStringSchema,
    paths: z.array(nonEmptyStringSchema),
    data: z.record(z.string(), z.unknown()).optional()
  })
  .strict();
const impactFindingSchema = z
  .object({
    id: nonEmptyStringSchema,
    checkId: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    severity: impactSeveritySchema,
    status: impactStatusSchema,
    confidence: z.number().min(0).max(1),
    impactedFiles: z.array(nonEmptyStringSchema),
    impactedAreas: z.array(nonEmptyStringSchema),
    owners: z.array(nonEmptyStringSchema),
    requiredActions: z.array(nonEmptyStringSchema),
    evidenceRefs: z.array(nonEmptyStringSchema)
  })
  .strict();
const impactObligationSchema = z
  .object({
    id: nonEmptyStringSchema,
    category: z.enum([
      "contract-review",
      "docs",
      "tests",
      "release",
      "migration",
      "security",
      "deployment",
      "build"
    ]),
    title: nonEmptyStringSchema,
    severity: impactSeveritySchema,
    status: impactStatusSchema,
    impactedFiles: z.array(nonEmptyStringSchema),
    sourceSurfaces: z.array(impactSurfaceSchema),
    requiredActions: z.array(nonEmptyStringSchema),
    evidenceRefs: z.array(nonEmptyStringSchema)
  })
  .strict();
const impactUnknownSchema = z
  .object({
    id: nonEmptyStringSchema,
    category: z.enum(["scope", "ownership", "dependency", "contract", "obligation"]),
    title: nonEmptyStringSchema,
    severity: impactSeveritySchema,
    impactedFiles: z.array(nonEmptyStringSchema),
    reason: nonEmptyStringSchema,
    resolution: nonEmptyStringSchema,
    evidenceRefs: z.array(nonEmptyStringSchema)
  })
  .strict();
const impactSurfaceRecordSchema = z
  .object({
    path: nonEmptyStringSchema,
    surfaces: z.array(impactSurfaceSchema).min(1),
    primarySurface: impactSurfaceSchema,
    area: nonEmptyStringSchema,
    reasons: stringArraySchema
  })
  .strict();
const impactOwnershipRuleSchema = z
  .object({
    source: z.enum(["codeowners", "metadata"]),
    sourcePath: nonEmptyStringSchema,
    pattern: nonEmptyStringSchema,
    owners: z.array(nonEmptyStringSchema),
    sensitive: z.boolean(),
    line: z.number().int().min(1).nullable(),
    order: z.number().int().min(0)
  })
  .strict();
const impactOwnershipSchema = z
  .object({
    coverage: z
      .object({
        status: z.enum(["none", "partial", "complete"]),
        sourcesConfigured: z.array(nonEmptyStringSchema),
        sourcesUsed: z.array(nonEmptyStringSchema),
        fallbackReviewers: z.array(nonEmptyStringSchema),
        filesWithOwners: z.number().int().min(0),
        filesMissingOwners: z.number().int().min(0),
        gaps: z.array(z.string())
      })
      .strict(),
    codeownersPath: z.string().nullable(),
    metadataPaths: z.array(nonEmptyStringSchema),
    rules: z.array(impactOwnershipRuleSchema),
    matches: z.array(
      z
        .object({
          path: nonEmptyStringSchema,
          owners: z.array(nonEmptyStringSchema),
          matchedRules: z.array(impactOwnershipRuleSchema),
          fallbackReviewers: z.array(nonEmptyStringSchema),
          fallbackUsed: z.boolean(),
          sensitive: z.boolean(),
          ownerMissing: z.boolean(),
          evidenceRefs: z.array(nonEmptyStringSchema)
        })
        .strict()
    )
  })
  .strict();
const impactDependencySchema = z
  .object({
    coverage: z
      .object({
        status: z.enum(["none", "partial", "complete-ish"]),
        sourcesConfigured: z.array(nonEmptyStringSchema),
        sourcesUsed: z.array(nonEmptyStringSchema),
        filesCovered: z.array(nonEmptyStringSchema),
        filesUncovered: z.array(nonEmptyStringSchema),
        gaps: z.array(z.string())
      })
      .strict(),
    nodes: z.array(
      z
        .object({
          id: nonEmptyStringSchema,
          path: z.string().nullable(),
          kind: z.enum(["package", "workspace", "file", "external", "custom"]),
          source: nonEmptyStringSchema
        })
        .strict()
    ),
    edges: z.array(
      z
        .object({
          from: nonEmptyStringSchema,
          to: nonEmptyStringSchema,
          type: nonEmptyStringSchema,
          source: nonEmptyStringSchema
        })
        .strict()
    ),
    reverseDependentsByPath: z.record(z.string(), z.array(nonEmptyStringSchema))
  })
  .strict();
const impactReportSchema = z
  .object({
    schemaVersion: z.literal(IMPACT_REPORT_SCHEMA_VERSION),
    impactId: impactIdSchema,
    status: impactStatusSchema,
    impactStatus: impactStatusSchema,
    summary: nonEmptyStringSchema,
    scope: impactReportScopeSchema,
    files: z.array(nonEmptyStringSchema),
    risk: impactRiskSchema,
    confidence: impactConfidenceSchema,
    scoring: impactScoringSchema,
    topImpactedAreas: z.array(impactSummaryRecordSchema),
    requiredReviewers: z.array(nonEmptyStringSchema),
    requiredTests: z.array(nonEmptyStringSchema),
    requiredActions: z.array(nonEmptyStringSchema),
    blockingFindings: z.array(impactFindingSchema),
    warningFindings: z.array(impactFindingSchema),
    surfaces: z.array(impactSurfaceRecordSchema),
    areaSummary: z.array(impactSummaryRecordSchema),
    surfaceSummary: z.array(impactSummaryRecordSchema),
    ownership: impactOwnershipSchema,
    dependencyGraph: impactDependencySchema,
    findings: z.array(impactFindingSchema),
    obligations: z.array(impactObligationSchema),
    unknowns: z.array(impactUnknownSchema),
    evidence: z.array(impactEvidenceSchema)
  })
  .strict();
type ParsedImpactReport = z.infer<typeof impactReportSchema>;

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 12);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function placeholderConfidence(reason: string): ImpactConfidence {
  return {
    score: 0.1,
    level: "low",
    reasons: [reason]
  };
}

function placeholderImpactId(seed: unknown): string {
  return `impact-${stableHash(seed)}`;
}

function getBuiltInImpactConfig(): ImpactConfig {
  return {
    schemaVersion: IMPACT_SCHEMA_VERSION,
    baseBranches: [...BUILT_IN_BASE_BRANCHES],
    paths: {
      include: ["**/*"],
      ignore: ["node_modules/**", "coverage/**"],
      generated: ["dist/**", "**/*.generated.*"],
      docs: ["docs/**", "**/*.md"],
      tests: ["tests/**", "**/*.test.ts"]
    },
    ownership: {
      sources: [
        "CODEOWNERS",
        ".github/CODEOWNERS",
        "docs/CODEOWNERS",
        ".blueprint/impact/ownership.json"
      ],
      requiredOwnerMatch: false,
      fallbackReviewers: []
    },
    dependencyGraph: {
      sources: ["package-json", "package-lock", "ts-import-scan"],
      customGraphFiles: [".blueprint/impact/dependency-graph.json"],
      requireReverseDepsFor: ["runtime", "contract", "security", "compliance"]
    },
    risk: {
      blockOnCritical: true,
      blockOnBreakingContract: true,
      blockOnSensitiveUnknownOwner: true,
      warnBelowConfidence: 0.7,
      blockBelowConfidenceForSensitiveAreas: 0.5
    },
    reporting: {
      defaultVerbosity: "normal",
      writeEvidenceLog: true,
      redactPathPatterns: ["**/secrets/**"]
    }
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareImpactSurfaces(left: ImpactSurface, right: ImpactSurface): number {
  return IMPACT_SURFACE_PRIORITY[left] - IMPACT_SURFACE_PRIORITY[right];
}

function normalizeRepoPathForClassification(filePath: string): string {
  return filePath.trim().replaceAll("\\", "/").replace(/^\.\//u, "");
}

function addSurfaceRule(
  rules: ImpactSurfaceRule[],
  surface: ImpactSurface,
  reason: string
): void {
  if (!rules.some((rule) => rule.surface === surface)) {
    rules.push({ surface, reason });
  }
}

function hasPathSegment(filePath: string, segment: string): boolean {
  return (
    filePath === segment ||
    filePath.startsWith(`${segment}/`) ||
    filePath.endsWith(`/${segment}`) ||
    filePath.includes(`/${segment}/`)
  );
}

function hasConfigName(filePath: string): boolean {
  const basename = path.posix.basename(filePath);
  return (
    basename.startsWith(".") ||
    basename.includes("config") ||
    basename.includes("settings") ||
    hasPathSegment(filePath, "config") ||
    hasPathSegment(filePath, ".github")
  );
}

function isGeneratedPath(filePath: string): boolean {
  return GENERATED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function isTestPath(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function isDocsPath(filePath: string): boolean {
  const extension = path.posix.extname(filePath).toLowerCase();
  return hasPathSegment(filePath, "docs") || DOC_FILE_EXTENSIONS.has(extension);
}

function areaForSurface(surface: ImpactSurface): string {
  if (
    [
      "command-catalog",
      "command-manifest",
      "command-doc",
      "runtime-reference",
      "mcp-server",
      "mcp-tool",
      "mcp-resource",
      "artifact-contract",
      "skill",
      "agent",
      "extension-manifest",
      "hook",
      "package-runtime",
      "build-config"
    ].includes(surface)
  ) {
    return "blueprint-runtime";
  }

  if (surface === "secret-sensitive" || surface === "env-config") {
    return "sensitive-config";
  }

  if (surface === "test") {
    return "tests";
  }

  if (surface === "docs") {
    return "docs";
  }

  if (surface === "generated") {
    return "generated";
  }

  if (surface === "config") {
    return "config";
  }

  if (surface === "source") {
    return "source";
  }

  if (surface === "repo-root") {
    return "repo-root";
  }

  return "unknown";
}

function classifyImpactFile(filePath: string): ImpactSurfaceRecord {
  const normalizedPath = normalizeRepoPathForClassification(filePath);
  const basename = path.posix.basename(normalizedPath);
  const extension = path.posix.extname(normalizedPath).toLowerCase();
  const rules: ImpactSurfaceRule[] = [];

  if (SECRET_PATH_PATTERN.test(normalizedPath)) {
    addSurfaceRule(
      rules,
      "secret-sensitive",
      "Path name indicates secret, token, or credential sensitivity."
    );
  }

  if (basename === ".env" || basename.startsWith(".env.")) {
    addSurfaceRule(rules, "env-config", "Environment file path matched .env*.");
  }

  if (normalizedPath === "docs/COMMAND-CATALOG.md") {
    addSurfaceRule(rules, "command-catalog", "Command catalog documentation changed.");
    addSurfaceRule(rules, "docs", "Command catalog is a documentation surface.");
  }

  if (normalizedPath === "docs/RUNTIME-REFERENCE.md") {
    addSurfaceRule(rules, "runtime-reference", "Runtime reference contract documentation changed.");
    addSurfaceRule(rules, "docs", "Runtime reference is a documentation surface.");
  }

  if (/^commands\/[^/]+\.toml$/u.test(normalizedPath)) {
    addSurfaceRule(rules, "command-manifest", "Command manifest TOML changed.");
    addSurfaceRule(rules, "config", "Command manifests are TOML configuration.");
  }

  if (hasPathSegment(normalizedPath, "docs/commands")) {
    addSurfaceRule(rules, "command-doc", "Command specification documentation changed.");
    addSurfaceRule(rules, "docs", "Command specifications are documentation surfaces.");
  }

  if (normalizedPath === "src/mcp/server.ts") {
    addSurfaceRule(rules, "mcp-server", "MCP server registration surface changed.");
    addSurfaceRule(rules, "source", "MCP server is TypeScript source.");
  }

  if (hasPathSegment(normalizedPath, "src/mcp/tools")) {
    addSurfaceRule(rules, "mcp-tool", "MCP tool implementation surface changed.");
    addSurfaceRule(rules, "source", "MCP tools are TypeScript source.");
  }

  if (normalizedPath === "src/mcp/command-resources.ts") {
    addSurfaceRule(rules, "mcp-resource", "MCP command resource projection changed.");
    addSurfaceRule(rules, "source", "MCP resources are TypeScript source.");
  }

  if (hasPathSegment(normalizedPath, "src/mcp/artifact-contracts")) {
    addSurfaceRule(rules, "artifact-contract", "Artifact contract registry changed.");
    addSurfaceRule(rules, "source", "Artifact contracts are TypeScript source.");
  }

  if (hasPathSegment(normalizedPath, "skills")) {
    addSurfaceRule(rules, "skill", "Blueprint skill contract changed.");

    if (isDocsPath(normalizedPath)) {
      addSurfaceRule(rules, "docs", "Markdown skill files are documentation surfaces.");
    }
  }

  if (hasPathSegment(normalizedPath, "agents")) {
    addSurfaceRule(rules, "agent", "Blueprint agent contract changed.");

    if (isDocsPath(normalizedPath)) {
      addSurfaceRule(rules, "docs", "Markdown agent files are documentation surfaces.");
    }
  }

  if (
    normalizedPath === "gemini-extension.json" ||
    normalizedPath === "tabnine-extension.json"
  ) {
    addSurfaceRule(rules, "extension-manifest", "Extension host manifest changed.");
    addSurfaceRule(rules, "config", "Extension manifests are JSON configuration.");
  }

  if (hasPathSegment(normalizedPath, "hooks") || hasPathSegment(normalizedPath, "src/hooks")) {
    addSurfaceRule(rules, "hook", "Blueprint advisory hook surface changed.");

    if (hasPathSegment(normalizedPath, "src/hooks")) {
      addSurfaceRule(rules, "source", "Hook runtime implementation is source code.");
    }
  }

  if (normalizedPath === "package.json" || normalizedPath === "package-lock.json") {
    addSurfaceRule(rules, "package-runtime", "Node package runtime metadata changed.");
    addSurfaceRule(rules, "config", "Package metadata is JSON configuration.");
  }

  if (normalizedPath === "tsconfig.json" || normalizedPath === "scripts/build.mjs") {
    addSurfaceRule(rules, "build-config", "Build configuration changed.");
    addSurfaceRule(rules, "config", "Build configuration is runtime configuration.");
  }

  if (isTestPath(normalizedPath)) {
    addSurfaceRule(rules, "test", "Path matched tests directory or test file suffix.");
  }

  if (isDocsPath(normalizedPath)) {
    addSurfaceRule(rules, "docs", "Path matched docs directory or documentation file extension.");
  }

  if (isGeneratedPath(normalizedPath)) {
    addSurfaceRule(rules, "generated", "Path matched generated output directory or suffix.");
  }

  if (CONFIG_FILE_EXTENSIONS.has(extension) || hasConfigName(normalizedPath)) {
    addSurfaceRule(rules, "config", "Path matched configuration extension or naming convention.");
  }

  if (hasPathSegment(normalizedPath, "src") && SOURCE_FILE_EXTENSIONS.has(extension)) {
    addSurfaceRule(rules, "source", "Path matched source tree and code extension.");
  }

  if (!normalizedPath.includes("/")) {
    addSurfaceRule(rules, "repo-root", "Path is at the repository root.");
  }

  if (rules.length === 0) {
    addSurfaceRule(rules, "unknown", "No impact surface rule matched this path.");
  }

  const sortedRules = rules.sort((left, right) =>
    compareImpactSurfaces(left.surface, right.surface)
  );
  const surfaces = sortedRules.map((rule) => rule.surface);
  const primarySurface = surfaces[0] ?? "unknown";

  return {
    path: normalizedPath,
    surfaces,
    primarySurface,
    area: areaForSurface(primarySurface),
    reasons: sortedRules.map((rule) => rule.reason)
  };
}

function summarizeSurfaceRecords(
  records: ImpactSurfaceRecord[],
  selector: (record: ImpactSurfaceRecord) => string,
  sortNames: (left: string, right: string) => number = (left, right) => left.localeCompare(right)
): ImpactSummaryRecord[] {
  const summary = new Map<string, Set<string>>();

  for (const record of records) {
    const key = selector(record);
    const files = summary.get(key) ?? new Set<string>();
    files.add(record.path);
    summary.set(key, files);
  }

  return [...summary.entries()]
    .sort(([left], [right]) => sortNames(left, right))
    .map(([name, files]) => {
      const sortedFiles = [...files].sort();

      return {
        name,
        files: sortedFiles,
        count: sortedFiles.length
      };
    });
}

function buildAreaSummary(records: ImpactSurfaceRecord[]): ImpactSummaryRecord[] {
  const areaOrder = [
    "sensitive-config",
    "blueprint-runtime",
    "tests",
    "docs",
    "generated",
    "config",
    "source",
    "repo-root",
    "unknown"
  ];

  return summarizeSurfaceRecords(records, (record) => record.area, (left, right) => {
    const leftIndex = areaOrder.indexOf(left);
    const rightIndex = areaOrder.indexOf(right);
    const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    return normalizedLeftIndex - normalizedRightIndex || left.localeCompare(right);
  });
}

function buildSurfaceSummary(records: ImpactSurfaceRecord[]): ImpactSummaryRecord[] {
  const surfaceFiles = new Map<ImpactSurface, Set<string>>();

  for (const record of records) {
    for (const surface of record.surfaces) {
      const files = surfaceFiles.get(surface) ?? new Set<string>();
      files.add(record.path);
      surfaceFiles.set(surface, files);
    }
  }

  return [...surfaceFiles.entries()]
    .sort(([left], [right]) => compareImpactSurfaces(left, right))
    .map(([name, files]) => {
      const sortedFiles = [...files].sort();

      return {
        name,
        files: sortedFiles,
        count: sortedFiles.length
      };
    });
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function allRegisteredRuntimeToolNames(): string[] {
  return uniqueSorted([
    ...PROJECT_RUNTIME_TOOL_NAMES,
    ...configToolDefinitions.map((definition) => definition.name),
    ...stateToolDefinitions.map((definition) => definition.name),
    ...phaseToolDefinitions.map((definition) => definition.name),
    ...reviewToolDefinitions.map((definition) => definition.name),
    ...artifactToolDefinitions.map((definition) => definition.name),
    ...impactToolDefinitions.map((definition) => definition.name),
    ...updateToolDefinitions.map((definition) => definition.name),
    ...workspaceToolDefinitions.map((definition) => definition.name)
  ]);
}

function stableRecordId(prefix: string, seed: unknown): string {
  return `${prefix}.${stableHash(seed)}`;
}

function sanitizeIdentifier(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return sanitized.length > 0 ? sanitized.slice(0, 80) : "unknown";
}

function sortEvidenceRecords(records: ImpactEvidenceRecord[]): ImpactEvidenceRecord[] {
  const deduped = new Map<string, ImpactEvidenceRecord>();

  for (const record of records) {
    const existing = deduped.get(record.id);

    if (!existing) {
      deduped.set(record.id, {
        ...record,
        paths: uniqueSorted(record.paths)
      });
      continue;
    }

    deduped.set(record.id, {
      ...existing,
      paths: uniqueSorted([...existing.paths, ...record.paths])
    });
  }

  return [...deduped.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function sortUnknownRecords(records: ImpactUnknownRecord[]): ImpactUnknownRecord[] {
  const deduped = new Map<string, ImpactUnknownRecord>();

  for (const record of records) {
    const existing = deduped.get(record.id);

    if (!existing) {
      deduped.set(record.id, {
        ...record,
        impactedFiles: uniqueSorted(record.impactedFiles),
        evidenceRefs: uniqueSorted(record.evidenceRefs)
      });
      continue;
    }

    deduped.set(record.id, {
      ...existing,
      severity: moreSevere(existing.severity, record.severity),
      impactedFiles: uniqueSorted([...existing.impactedFiles, ...record.impactedFiles]),
      evidenceRefs: uniqueSorted([...existing.evidenceRefs, ...record.evidenceRefs])
    });
  }

  return [...deduped.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function findingSeverityRank(value: ImpactSeverity): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[value];
}

function findingStatusRank(value: ImpactStatus): number {
  return { BLOCK: 0, WARN: 1, PASS: 2 }[value];
}

function moreSevere(left: ImpactSeverity, right: ImpactSeverity): ImpactSeverity {
  return findingSeverityRank(left) <= findingSeverityRank(right) ? left : right;
}

function higherImpactStatus(left: ImpactStatus, right: ImpactStatus): ImpactStatus {
  return findingStatusRank(left) <= findingStatusRank(right) ? left : right;
}

function sortFindings(records: ImpactFindingRecord[]): ImpactFindingRecord[] {
  const deduped = new Map<string, ImpactFindingRecord>();

  for (const record of records) {
    const existing = deduped.get(record.id);

    if (!existing) {
      deduped.set(record.id, {
        ...record,
        impactedFiles: uniqueSorted(record.impactedFiles),
        impactedAreas: uniqueSorted(record.impactedAreas),
        owners: uniqueSorted(record.owners),
        requiredActions: uniqueSorted(record.requiredActions),
        evidenceRefs: uniqueSorted(record.evidenceRefs)
      });
      continue;
    }

    deduped.set(record.id, {
      ...existing,
      severity: moreSevere(existing.severity, record.severity),
      status: higherImpactStatus(existing.status, record.status),
      confidence: Math.max(existing.confidence, record.confidence),
      impactedFiles: uniqueSorted([...existing.impactedFiles, ...record.impactedFiles]),
      impactedAreas: uniqueSorted([...existing.impactedAreas, ...record.impactedAreas]),
      owners: uniqueSorted([...existing.owners, ...record.owners]),
      requiredActions: uniqueSorted([...existing.requiredActions, ...record.requiredActions]),
      evidenceRefs: uniqueSorted([...existing.evidenceRefs, ...record.evidenceRefs])
    });
  }

  return [...deduped.values()].sort(
    (left, right) =>
      findingStatusRank(left.status) - findingStatusRank(right.status) ||
      findingSeverityRank(left.severity) - findingSeverityRank(right.severity) ||
      left.impactedAreas.join(",").localeCompare(right.impactedAreas.join(",")) ||
      left.checkId.localeCompare(right.checkId) ||
      left.id.localeCompare(right.id)
  );
}

function sortObligations(records: ImpactObligationRecord[]): ImpactObligationRecord[] {
  const deduped = new Map<string, ImpactObligationRecord>();

  for (const record of records) {
    const existing = deduped.get(record.id);

    if (!existing) {
      deduped.set(record.id, {
        ...record,
        impactedFiles: uniqueSorted(record.impactedFiles),
        sourceSurfaces: [...new Set(record.sourceSurfaces)].sort(compareImpactSurfaces),
        requiredActions: uniqueSorted(record.requiredActions),
        evidenceRefs: uniqueSorted(record.evidenceRefs)
      });
      continue;
    }

    deduped.set(record.id, {
      ...existing,
      impactedFiles: uniqueSorted([...existing.impactedFiles, ...record.impactedFiles]),
      sourceSurfaces: [...new Set([...existing.sourceSurfaces, ...record.sourceSurfaces])].sort(
        compareImpactSurfaces
      ),
      requiredActions: uniqueSorted([...existing.requiredActions, ...record.requiredActions]),
      evidenceRefs: uniqueSorted([...existing.evidenceRefs, ...record.evidenceRefs])
    });
  }

  return [...deduped.values()].sort(
    (left, right) =>
      findingStatusRank(left.status) - findingStatusRank(right.status) ||
      findingSeverityRank(left.severity) - findingSeverityRank(right.severity) ||
      left.category.localeCompare(right.category) ||
      left.title.localeCompare(right.title) ||
      left.id.localeCompare(right.id)
  );
}

function addEvidence(
  records: ImpactEvidenceRecord[],
  record: Omit<ImpactEvidenceRecord, "id">
): string {
  const id = stableRecordId(`ev.${record.kind}`, record);
  records.push({
    id,
    ...record,
    paths: uniqueSorted(record.paths)
  });
  return id;
}

function clampConfidenceScore(value: number): number {
  return Math.min(0.95, Math.max(0.05, Math.round(value * 100) / 100));
}

function confidenceLevelForScore(score: number): ImpactConfidenceLevel {
  return score >= 0.75 ? "high" : score >= 0.45 ? "medium" : "low";
}

function parseImpactConfidence(value: unknown): ImpactConfidence | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const score = typeof value.score === "number" ? value.score : null;
  const level =
    value.level === "low" || value.level === "medium" || value.level === "high"
      ? value.level
      : null;

  if (score === null || level === null) {
    return null;
  }

  return {
    score: clampConfidenceScore(score),
    level,
    reasons: extractStringArray(value.reasons)
  };
}

function nestedScopeRecord(args: ImpactAnalyzeArgs): Record<string, unknown> | undefined {
  return isPlainObject(args.scope?.scope) ? args.scope.scope : args.scope;
}

function buildReportScope(
  args: ImpactAnalyzeArgs,
  files: string[],
  warnings: string[]
): ImpactReportScope {
  const scopeRecord = args.scope;
  const scopePayload = nestedScopeRecord(args);
  const providedConfidence =
    parseImpactConfidence(scopeRecord?.confidence) ??
    parseImpactConfidence(scopePayload?.confidence);
  const kind = stringValue(scopePayload?.kind) ?? (files.length > 0 ? "files" : "unresolved");
  const source = stringValue(scopePayload?.source);
  const description = stringValue(scopePayload?.description);
  const fingerprint =
    stringValue(scopeRecord?.scopeFingerprint) ??
    stringValue(scopePayload?.scopeFingerprint) ??
    stableHash({
      kind,
      source,
      description,
      files
    });
  const inferredConfidence =
    providedConfidence ??
    (kind === "description"
      ? confidenceForScope("description", [], warnings)
      : confidenceForScope(files.length > 0 ? "files" : "unresolved", files, warnings));

  return {
    kind,
    source,
    description,
    fingerprint,
    confidence: inferredConfidence
  };
}

function reverseDependencyCoverageRelevant(surfaces: ImpactSurfaceRecord[]): boolean {
  return surfaces.some((surface) =>
    surface.surfaces.some((name) =>
      [
        "package-runtime",
        "source",
        "secret-sensitive",
        "mcp-server",
        "mcp-tool",
        "mcp-resource",
        "artifact-contract",
        "hook"
      ].includes(name)
    )
  );
}

function highAssuranceSurfacePresent(surfaces: ImpactSurfaceRecord[]): boolean {
  return surfaces.some((surface) =>
    surface.surfaces.some((name) =>
      [
        "secret-sensitive",
        "env-config",
        "command-catalog",
        "command-manifest",
        "command-doc",
        "runtime-reference",
        "mcp-server",
        "mcp-tool",
        "mcp-resource",
        "artifact-contract",
        "extension-manifest",
        "hook",
        "package-runtime",
        "build-config"
      ].includes(name)
    )
  );
}

function maxSeverityFromRecords(
  findings: ImpactFindingRecord[],
  obligations: ImpactObligationRecord[],
  unknowns: ImpactUnknownRecord[]
): ImpactSeverity | null {
  const severities = [
    ...findings.map((finding) => finding.severity),
    ...obligations.map((obligation) => obligation.severity),
    ...unknowns.map((unknown) => unknown.severity)
  ];

  return severities.reduce<ImpactSeverity | null>(
    (current, severity) => (current === null ? severity : moreSevere(current, severity)),
    null
  );
}

function confidencePenaltyForUnknown(unknown: ImpactUnknownRecord): number {
  return {
    LOW: 0.03,
    MEDIUM: 0.07,
    HIGH: 0.11,
    CRITICAL: 0.16
  }[unknown.severity];
}

function buildConfidenceScore(options: {
  scope: ImpactReportScope;
  files: string[];
  warnings: string[];
  surfaces: ImpactSurfaceRecord[];
  ownership: ImpactOwnershipAnalysis;
  dependencyGraph: ImpactDependencyAnalysis;
  unknowns: ImpactUnknownRecord[];
}): ImpactConfidence {
  const reducers: string[] = [];
  const drivers: string[] = [...options.scope.confidence.reasons];
  let score = options.scope.confidence.score;

  if (options.files.length === 0) {
    score = Math.min(score, 0.25);
    reducers.push("No file-backed scope was available to prove blast radius.");
  } else {
    drivers.push("Changed files were normalized and classified deterministically.");
  }

  if (options.ownership.coverage.status === "complete") {
    score += 0.04;
    drivers.push("Ownership coverage is complete for the analyzed files.");
  } else if (options.files.length > 0 && options.ownership.coverage.status === "partial") {
    score -= 0.06;
    reducers.push("Ownership coverage is partial.");
  } else if (options.files.length > 0) {
    score -= 0.1;
    reducers.push("Ownership coverage is missing.");
  }

  if (reverseDependencyCoverageRelevant(options.surfaces)) {
    if (options.dependencyGraph.coverage.status === "complete-ish") {
      score += 0.04;
      drivers.push("Reverse dependency coverage is present for relevant impact drivers.");
    } else if (options.dependencyGraph.coverage.status === "partial") {
      score -= 0.07;
      reducers.push("Reverse dependency coverage is partial.");
    } else {
      score -= 0.12;
      reducers.push("Reverse dependency coverage is missing for relevant impact drivers.");
    }
  }

  const unknownPenalty = Math.min(
    0.35,
    options.unknowns.reduce((total, unknown) => total + confidencePenaltyForUnknown(unknown), 0)
  );

  if (unknownPenalty > 0) {
    score -= unknownPenalty;
    reducers.push(
      `${options.unknowns.length} structured unknown${
        options.unknowns.length === 1 ? "" : "s"
      } reduced confidence.`
    );
  }

  if (options.warnings.length > 0) {
    score -= Math.min(0.08, options.warnings.length * 0.01);
    reducers.push("Analysis warnings remain and were reflected in confidence.");
  }

  const roundedScore = clampConfidenceScore(score);

  return {
    score: roundedScore,
    level: confidenceLevelForScore(roundedScore),
    reasons: uniqueSorted([...drivers, ...reducers])
  };
}

function hasBreakingContractSignal(
  findings: ImpactFindingRecord[],
  _obligations: ImpactObligationRecord[],
  unknowns: ImpactUnknownRecord[]
): boolean {
  return (
    findings.some(
      (finding) =>
        finding.checkId.startsWith("contract.") &&
        (finding.status === "BLOCK" || finding.severity === "CRITICAL")
    ) ||
    unknowns.some(
      (unknown) =>
        unknown.category === "contract" && unknown.severity === "CRITICAL"
    )
  );
}

function buildImpactStatus(options: {
  config: ImpactConfig;
  findings: ImpactFindingRecord[];
  obligations: ImpactObligationRecord[];
  unknowns: ImpactUnknownRecord[];
  confidence: ImpactConfidence;
  surfaces: ImpactSurfaceRecord[];
  files: string[];
}): { status: ImpactStatus; drivers: string[]; reducers: string[] } {
  const drivers: string[] = [];
  const reducers: string[] = [];
  let status: ImpactStatus = "PASS";
  const hasBlockingFinding =
    options.findings.some((finding) => finding.status === "BLOCK") ||
    options.obligations.some((obligation) => obligation.status === "BLOCK");
  const hasCriticalSignal =
    [...options.findings, ...options.obligations, ...options.unknowns].some(
      (record) => record.severity === "CRITICAL"
    );

  if (hasBlockingFinding) {
    status = "BLOCK";
    drivers.push("At least one deterministic finding or obligation has BLOCK status.");
  }

  if (options.config.risk.blockOnCritical && hasCriticalSignal) {
    status = "BLOCK";
    drivers.push("risk.blockOnCritical is enabled and a CRITICAL signal is present.");
  }

  if (
    options.config.risk.blockOnBreakingContract &&
    hasBreakingContractSignal(options.findings, options.obligations, options.unknowns)
  ) {
    status = "BLOCK";
    drivers.push("risk.blockOnBreakingContract is enabled and contract impact is high.");
  }

  if (
    highAssuranceSurfacePresent(options.surfaces) &&
    options.confidence.score < options.config.risk.blockBelowConfidenceForSensitiveAreas
  ) {
    status = "BLOCK";
    drivers.push(
      "High-assurance surfaces are in scope and confidence is below the configured sensitive-area blocking threshold."
    );
  }

  if (status !== "BLOCK") {
    if (options.files.length === 0) {
      status = "WARN";
      reducers.push("Scope is not file-backed, so PASS is not allowed.");
    } else if (options.findings.length > 0) {
      status = "WARN";
      reducers.push("Non-blocking findings require reviewer attention.");
    } else if (options.obligations.length > 0) {
      status = "WARN";
      reducers.push("Review, test, documentation, release, migration, security, deployment, or build obligations remain.");
    } else if (options.unknowns.length > 0) {
      status = "WARN";
      reducers.push("Structured unknowns remain and cannot be treated as safety.");
    } else if (options.confidence.score < options.config.risk.warnBelowConfidence) {
      status = "WARN";
      reducers.push("Confidence is below risk.warnBelowConfidence.");
    } else {
      drivers.push("No blocking or warning impact signals remain above policy thresholds.");
    }
  }

  return {
    status,
    drivers: uniqueSorted(drivers),
    reducers: uniqueSorted(reducers)
  };
}

function buildImpactRisk(options: {
  status: ImpactStatus;
  maxSeverity: ImpactSeverity | null;
  surfaces: ImpactSurfaceRecord[];
  findings: ImpactFindingRecord[];
  obligations: ImpactObligationRecord[];
  unknowns: ImpactUnknownRecord[];
  files: string[];
}): ImpactRisk {
  const reasons: string[] = [];
  const highAssurance = highAssuranceSurfacePresent(options.surfaces);
  let level: ImpactRiskLevel = "low";

  if (options.files.length === 0) {
    level = "unknown";
    reasons.push("No file-backed scope was available, so risk cannot be proven low.");
  } else if (options.status === "BLOCK" && options.maxSeverity === "CRITICAL") {
    level = "critical";
    reasons.push("A CRITICAL signal produced or reinforced an advisory BLOCK.");
  } else if (options.status === "BLOCK") {
    level = "high";
    reasons.push("A deterministic BLOCK signal requires review before approval.");
  } else if (options.maxSeverity === "CRITICAL" || options.maxSeverity === "HIGH") {
    level = highAssurance ? "high" : "medium";
    reasons.push(
      highAssurance
        ? "High-severity signals affect high-assurance surfaces."
        : "High-severity signals are present but not blocking."
    );
  } else if (options.maxSeverity === "MEDIUM") {
    level = "medium";
    reasons.push("Medium-severity findings, obligations, or unknowns require reviewer attention.");
  } else if (options.findings.length + options.obligations.length + options.unknowns.length > 0) {
    level = "low";
    reasons.push("Only low-severity non-blocking impact signals remain.");
  } else {
    level = "low";
    reasons.push("No findings, obligations, or unknowns remained after deterministic analysis.");
  }

  if (highAssurance) {
    reasons.push("The scope includes runtime, contract, config, package, build, extension, or secret-sensitive surfaces.");
  }

  return {
    level,
    reasons: uniqueSorted(reasons)
  };
}

function requiredReviewersFromOwnership(ownership: ImpactOwnershipAnalysis): string[] {
  return uniqueSorted(
    ownership.matches.flatMap((match) =>
      match.owners.length > 0 ? match.owners : match.fallbackReviewers
    )
  );
}

function requiredTestsFromObligations(obligations: ImpactObligationRecord[]): string[] {
  return uniqueSorted(
    obligations
      .filter((obligation) => obligation.category === "tests")
      .flatMap((obligation) => obligation.requiredActions)
  );
}

function requiredActionsFromSignals(
  findings: ImpactFindingRecord[],
  obligations: ImpactObligationRecord[],
  unknowns: ImpactUnknownRecord[]
): string[] {
  return uniqueSorted([
    ...findings.flatMap((finding) => finding.requiredActions),
    ...obligations.flatMap((obligation) => obligation.requiredActions),
    ...unknowns.map((unknown) => unknown.resolution)
  ]);
}

function buildAnalysisSummary(options: {
  status: ImpactStatus;
  risk: ImpactRisk;
  confidence: ImpactConfidence;
  files: string[];
  findings: ImpactFindingRecord[];
  obligations: ImpactObligationRecord[];
  unknowns: ImpactUnknownRecord[];
}): string {
  const scopeText =
    options.files.length === 0
      ? "no file-backed scope"
      : `${options.files.length} changed file${options.files.length === 1 ? "" : "s"}`;

  return `Impact status ${options.status} with ${options.risk.level} risk and ${options.confidence.level} confidence (${options.confidence.score}) across ${scopeText}; findings=${options.findings.length}, obligations=${options.obligations.length}, unknowns=${options.unknowns.length}.`;
}

function scoreImpactAnalysis(options: {
  config: ImpactConfig;
  scope: ImpactReportScope;
  files: string[];
  warnings: string[];
  surfaces: ImpactSurfaceRecord[];
  areaSummary: ImpactSummaryRecord[];
  ownership: ImpactOwnershipAnalysis;
  dependencyGraph: ImpactDependencyAnalysis;
  findings: ImpactFindingRecord[];
  obligations: ImpactObligationRecord[];
  unknowns: ImpactUnknownRecord[];
}): {
  status: ImpactStatus;
  risk: ImpactRisk;
  confidence: ImpactConfidence;
  scoring: ImpactScoringSummary;
  summary: string;
  topImpactedAreas: ImpactSummaryRecord[];
  requiredReviewers: string[];
  requiredTests: string[];
  requiredActions: string[];
  blockingFindings: ImpactFindingRecord[];
  warningFindings: ImpactFindingRecord[];
} {
  const confidence = buildConfidenceScore({
    scope: options.scope,
    files: options.files,
    warnings: options.warnings,
    surfaces: options.surfaces,
    ownership: options.ownership,
    dependencyGraph: options.dependencyGraph,
    unknowns: options.unknowns
  });
  const statusResult = buildImpactStatus({
    config: options.config,
    findings: options.findings,
    obligations: options.obligations,
    unknowns: options.unknowns,
    confidence,
    surfaces: options.surfaces,
    files: options.files
  });
  const maxSeverity = maxSeverityFromRecords(
    options.findings,
    options.obligations,
    options.unknowns
  );
  const risk = buildImpactRisk({
    status: statusResult.status,
    maxSeverity,
    surfaces: options.surfaces,
    findings: options.findings,
    obligations: options.obligations,
    unknowns: options.unknowns,
    files: options.files
  });
  const summary = buildAnalysisSummary({
    status: statusResult.status,
    risk,
    confidence,
    files: options.files,
    findings: options.findings,
    obligations: options.obligations,
    unknowns: options.unknowns
  });

  return {
    status: statusResult.status,
    risk,
    confidence,
    scoring: {
      status: statusResult.status,
      riskLevel: risk.level,
      confidenceScore: confidence.score,
      confidenceLevel: confidence.level,
      maxSeverity,
      blocking: statusResult.status === "BLOCK",
      drivers: uniqueSorted([...statusResult.drivers, ...risk.reasons]),
      reducers: uniqueSorted(statusResult.reducers),
      policy: {
        blockOnCritical: options.config.risk.blockOnCritical,
        blockOnBreakingContract: options.config.risk.blockOnBreakingContract,
        blockOnSensitiveUnknownOwner: options.config.risk.blockOnSensitiveUnknownOwner,
        warnBelowConfidence: options.config.risk.warnBelowConfidence,
        blockBelowConfidenceForSensitiveAreas:
          options.config.risk.blockBelowConfidenceForSensitiveAreas
      }
    },
    summary,
    topImpactedAreas: options.areaSummary.slice(0, 5),
    requiredReviewers: requiredReviewersFromOwnership(options.ownership),
    requiredTests: requiredTestsFromObligations(options.obligations),
    requiredActions: requiredActionsFromSignals(
      options.findings,
      options.obligations,
      options.unknowns
    ),
    blockingFindings: options.findings.filter((finding) => finding.status === "BLOCK"),
    warningFindings: options.findings.filter((finding) => finding.status === "WARN")
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

function globPatternToRegExp(pattern: string): RegExp {
  const normalized = pattern.trim().replaceAll("\\", "/").replace(/^\//u, "");
  let expression = "^";

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];

    if (character === "*" && next === "*") {
      expression += ".*";
      index += 1;
    } else if (character === "*") {
      expression += "[^/]*";
    } else if (character === "?") {
      expression += "[^/]";
    } else {
      expression += escapeRegExp(character ?? "");
    }
  }

  if (normalized.endsWith("/")) {
    expression += ".*";
  }

  expression += "$";
  return new RegExp(expression, "u");
}

function matchesRepoPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = normalizeRepoPathForClassification(filePath);
  const normalizedPattern = pattern.trim().replaceAll("\\", "/").replace(/^\//u, "");

  if (normalizedPattern.length === 0) {
    return false;
  }

  if (!normalizedPattern.includes("/")) {
    return globPatternToRegExp(normalizedPattern).test(path.posix.basename(normalizedPath));
  }

  return globPatternToRegExp(normalizedPattern).test(normalizedPath);
}

function isCodeownersCandidate(source: string): source is (typeof CODEOWNERS_CANDIDATES)[number] {
  return (CODEOWNERS_CANDIDATES as readonly string[]).includes(source);
}

function hasSurface(record: ImpactSurfaceRecord, surface: ImpactSurface): boolean {
  return record.surfaces.includes(surface);
}

function isContractLikeSurface(record: ImpactSurfaceRecord): boolean {
  return record.surfaces.some((surface) =>
    [
      "command-catalog",
      "command-manifest",
      "command-doc",
      "runtime-reference",
      "mcp-server",
      "mcp-tool",
      "mcp-resource",
      "artifact-contract",
      "skill",
      "agent",
      "extension-manifest",
      "hook"
    ].includes(surface)
  );
}

function isGeneratedOnlySurface(record: ImpactSurfaceRecord): boolean {
  return record.surfaces.includes("generated") && !record.surfaces.includes("source");
}

function isReverseDependencyRelevant(record: ImpactSurfaceRecord): boolean {
  return (
    hasSurface(record, "source") ||
    hasSurface(record, "package-runtime") ||
    hasSurface(record, "secret-sensitive") ||
    isContractLikeSurface(record)
  );
}

function cloneConfig(config: ImpactConfig): ImpactConfig {
  return JSON.parse(JSON.stringify(config)) as ImpactConfig;
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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveContainedInputPath(
  projectRoot: string,
  inputPath: string,
  label: string
): string {
  const trimmed = inputPath.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} must not be blank.`);
  }

  const candidatePath = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(projectRoot, trimmed);

  return ensurePathWithinRootSync(projectRoot, candidatePath, { label });
}

function toRepoRelativeInputPath(projectRoot: string, inputPath: string, label: string): string {
  const absolutePath = resolveContainedInputPath(projectRoot, inputPath, label);
  return toRepoRelativePath(projectRoot, absolutePath);
}

function extractStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function collectAnalyzeFileSources(args: ImpactAnalyzeArgs): ImpactFileInputSource[] {
  const nestedScope = isPlainObject(args.scope?.scope) ? args.scope.scope : undefined;

  return [
    {
      label: "changedFiles",
      files: extractStringArray(args.changedFiles)
    },
    {
      label: "files",
      files: extractStringArray(args.files)
    },
    {
      label: "scope.files",
      files: extractStringArray(args.scope?.files)
    },
    {
      label: "scope.changedFiles",
      files: extractStringArray(args.scope?.changedFiles)
    },
    {
      label: "scope.scope.files",
      files: extractStringArray(nestedScope?.files)
    },
    {
      label: "scope.scope.changedFiles",
      files: extractStringArray(nestedScope?.changedFiles)
    }
  ].filter((source) => source.files.length > 0);
}

function normalizeAnalyzeFileSources(
  projectRoot: string,
  sources: ImpactFileInputSource[],
  warnings: string[]
): string[] {
  const normalizedBySource = sources.map((source) => ({
    label: source.label,
    files: [
      ...new Set(
        source.files.map((file) =>
          toRepoRelativeInputPath(projectRoot, file, `Impact analyze ${source.label} file`)
        )
      )
    ].sort()
  }));
  const sourceFingerprints = [
    ...new Set(normalizedBySource.map((source) => source.files.join("\n")))
  ];

  if (sourceFingerprints.length > 1) {
    warnings.push(
      `Impact analyze file inputs differed across ${normalizedBySource
        .map((source) => source.label)
        .join(", ")}; using deterministic union.`
    );
  }

  return [...new Set(normalizedBySource.flatMap((source) => source.files))].sort();
}

function getImpactDefaultsPath(): string {
  const runtimeHost = resolveBlueprintRuntimeHost();
  return path.resolve(
    expandHomePath(
      path.join(runtimeHost.globalBlueprintDir, IMPACT_GLOBAL_DEFAULTS_BASENAME)
    )
  );
}

function isUnsafeRepoPattern(value: string): boolean {
  const normalized = value.trim().replaceAll("\\", "/");
  return (
    normalized.length === 0 ||
    normalized.includes("\0") ||
    path.isAbsolute(value) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  );
}

function validateConfigPathArrays(config: ImpactConfig): string[] {
  const errors: string[] = [];
  const pathArrays: Array<[string, string[]]> = [
    ["paths.include", config.paths.include],
    ["paths.ignore", config.paths.ignore],
    ["paths.generated", config.paths.generated],
    ["paths.docs", config.paths.docs],
    ["paths.tests", config.paths.tests],
    ["ownership.sources", config.ownership.sources],
    ["dependencyGraph.customGraphFiles", config.dependencyGraph.customGraphFiles],
    ["reporting.redactPathPatterns", config.reporting.redactPathPatterns]
  ];

  for (const [label, values] of pathArrays) {
    for (const value of values) {
      if (isUnsafeRepoPattern(value)) {
        errors.push(`${label} contains a path pattern that escapes the repository: ${value}`);
      }
    }
  }

  return errors;
}

function formatZodIssues(prefix: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const issuePath = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${prefix} ${issuePath}: ${issue.message}`;
  });
}

function sanitizeConfigLayer(
  layer: Record<string, unknown>,
  label: string,
  strictConfig: boolean,
  warnings: string[],
  errors: string[]
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const knownKeys = new Set<string>(KNOWN_IMPACT_CONFIG_TOP_LEVEL_KEYS);

  for (const [key, value] of Object.entries(layer)) {
    if (!knownKeys.has(key)) {
      const message = `Unknown impact config key in ${label}: ${key}`;

      if (strictConfig) {
        errors.push(message);
      } else {
        warnings.push(message);
      }

      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

function mergeConfigLayer(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      mergeConfigLayer(target[key] as Record<string, unknown>, value);
    } else if (Array.isArray(value)) {
      target[key] = [...value];
    } else {
      target[key] = value;
    }
  }
}

async function readConfigLayer(
  filePath: string,
  label: string,
  warnings: string[],
  errors: string[]
): Promise<Record<string, unknown> | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }

  try {
    return safeJsonParseObject(await fs.readFile(filePath, "utf8"), { label });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `${label} could not be read.`);
    return null;
  }
}

function applyConfigLayer(
  config: Record<string, unknown>,
  layer: Record<string, unknown>,
  label: string,
  strictConfig: boolean,
  warnings: string[],
  errors: string[]
): boolean {
  const sanitized = sanitizeConfigLayer(layer, label, strictConfig, warnings, errors);
  const parseResult = partialImpactConfigSchema.safeParse(sanitized);

  if (!parseResult.success) {
    errors.push(...formatZodIssues(`Invalid impact config in ${label}:`, parseResult.error));
    return false;
  }

  mergeConfigLayer(config, parseResult.data);
  return Object.keys(sanitized).length > 0;
}

function validateFinalImpactConfig(config: Record<string, unknown>, errors: string[]): ImpactConfig {
  const parseResult = impactConfigSchema.safeParse(config);

  if (!parseResult.success) {
    errors.push(...formatZodIssues("Invalid effective impact config:", parseResult.error));
    return getBuiltInImpactConfig();
  }

  errors.push(...validateConfigPathArrays(parseResult.data));
  return parseResult.data;
}

function resolveAnalyzeImpactConfig(
  providedConfig: Record<string, unknown> | undefined,
  warnings: string[]
): ImpactConfig {
  const config = cloneConfig(getBuiltInImpactConfig()) as unknown as Record<string, unknown>;
  const errors: string[] = [];

  if (providedConfig && Object.keys(providedConfig).length > 0) {
    applyConfigLayer(config, providedConfig, "analyze config", false, warnings, errors);
  }

  const effectiveConfig = validateFinalImpactConfig(config, errors);

  if (errors.length > 0) {
    throw new Error(`Invalid impact analyze config: ${[...new Set(errors)].join(" ")}`);
  }

  return effectiveConfig;
}

function parseCodeownersRules(raw: string, sourcePath: string): ImpactOwnershipRule[] {
  const rules: ImpactOwnershipRule[] = [];

  for (const [lineIndex, rawLine] of raw.split(/\r?\n/u).entries()) {
    const line = rawLine.replace(/\s+#.*$/u, "").trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const [pattern, ...owners] = line.split(/\s+/u);

    if (!pattern) {
      continue;
    }

    rules.push({
      source: "codeowners",
      sourcePath,
      pattern,
      owners: uniqueSorted(owners),
      sensitive: false,
      line: lineIndex + 1,
      order: rules.length
    });
  }

  return rules;
}

function matchLastCodeownersRule(
  filePath: string,
  rules: ImpactOwnershipRule[]
): ImpactOwnershipRule | null {
  let matched: ImpactOwnershipRule | null = null;

  for (const rule of rules) {
    if (matchesRepoPattern(filePath, rule.pattern)) {
      matched = rule;
    }
  }

  return matched;
}

async function loadOwnershipAnalysis(
  projectRoot: string,
  files: string[],
  surfaces: ImpactSurfaceRecord[],
  config: ImpactConfig,
  warnings: string[]
): Promise<{
  ownership: ImpactOwnershipAnalysis;
  unknowns: ImpactUnknownRecord[];
  findings: ImpactFindingRecord[];
  evidence: ImpactEvidenceRecord[];
}> {
  const evidence: ImpactEvidenceRecord[] = [];
  const unknowns: ImpactUnknownRecord[] = [];
  const findings: ImpactFindingRecord[] = [];
  const configuredSources = uniqueSorted(config.ownership.sources);
  const sourcesUsed: string[] = [];
  const metadataFallbackReviewers: string[] = [];
  const metadataPaths: string[] = [];
  const rules: ImpactOwnershipRule[] = [];
  let codeownersPath: string | null = null;

  for (const source of config.ownership.sources) {
    if (!isCodeownersCandidate(source)) {
      continue;
    }

    const absolutePath = resolveContainedInputPath(
      projectRoot,
      source,
      "Impact ownership CODEOWNERS source"
    );

    if (!(await pathExists(absolutePath))) {
      continue;
    }

    codeownersPath = toRepoRelativePath(projectRoot, absolutePath);
    const parsedRules = parseCodeownersRules(await fs.readFile(absolutePath, "utf8"), codeownersPath);
    rules.push(...parsedRules);
    sourcesUsed.push(codeownersPath);
    addEvidence(evidence, {
      kind: "ownership",
      source: codeownersPath,
      summary: `Loaded ${parsedRules.length} CODEOWNERS ownership rules; last matching rule wins within this file.`,
      paths: [codeownersPath],
      data: { ruleCount: parsedRules.length }
    });
    break;
  }

  const metadataSources = config.ownership.sources.filter((source) => !isCodeownersCandidate(source));

  for (const source of metadataSources) {
    const absolutePath = resolveContainedInputPath(
      projectRoot,
      source,
      "Impact ownership metadata source"
    );

    if (!(await pathExists(absolutePath))) {
      continue;
    }

    const relativePath = toRepoRelativePath(projectRoot, absolutePath);

    try {
      const parsed = safeJsonParseObject(await fs.readFile(absolutePath, "utf8"), {
        label: `Impact ownership metadata ${relativePath}`
      });
      const metadataResult = ownershipMetadataSchema.safeParse(parsed);

      if (!metadataResult.success) {
        throw new Error(
          formatZodIssues(`Invalid impact ownership metadata ${relativePath}:`, metadataResult.error).join(
            " "
          )
        );
      }

      const startIndex = rules.length;
      for (const [index, rule] of metadataResult.data.rules.entries()) {
        rules.push({
          source: "metadata",
          sourcePath: relativePath,
          pattern: rule.pattern,
          owners: uniqueSorted(rule.owners),
          sensitive: rule.sensitive,
          line: null,
          order: startIndex + index
        });
      }

      metadataFallbackReviewers.push(...metadataResult.data.fallbackReviewers);
      metadataPaths.push(relativePath);
      sourcesUsed.push(relativePath);
      addEvidence(evidence, {
        kind: "ownership",
        source: relativePath,
        summary: `Loaded ${metadataResult.data.rules.length} optional ownership metadata rules.`,
        paths: [relativePath],
        data: {
          ruleCount: metadataResult.data.rules.length,
          fallbackReviewerCount: metadataResult.data.fallbackReviewers.length
        }
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Impact ownership metadata ${relativePath} could not be parsed.`;
      warnings.push(message);
      const evidenceRef = addEvidence(evidence, {
        kind: "metadata",
        source: relativePath,
        summary: "Optional ownership metadata could not be parsed; ownership analysis continued without it.",
        paths: [relativePath]
      });
      unknowns.push({
        id: `unknown.ownership.metadata.${sanitizeIdentifier(relativePath)}`,
        category: "ownership",
        title: "Optional ownership metadata is malformed",
        severity: "MEDIUM",
        impactedFiles: [],
        reason: message,
        resolution: `Repair ${relativePath} to match ${OWNERSHIP_SCHEMA_VERSION}.`,
        evidenceRefs: [evidenceRef]
      });
    }
  }

  const effectiveMetadataFallback = uniqueSorted(metadataFallbackReviewers);
  const configuredFallback = uniqueSorted(config.ownership.fallbackReviewers);
  const orderedFallbackReviewers =
    configuredFallback.length > 0 ? configuredFallback : effectiveMetadataFallback;
  const matches: ImpactOwnershipMatch[] = [];
  const surfaceByPath = new Map(surfaces.map((surface) => [surface.path, surface]));

  for (const file of files) {
    const codeownersRule = matchLastCodeownersRule(file, rules.filter((rule) => rule.source === "codeowners"));
    const metadataRules = rules.filter(
      (rule) => rule.source === "metadata" && matchesRepoPattern(file, rule.pattern)
    );
    const matchedRules = [...(codeownersRule ? [codeownersRule] : []), ...metadataRules].sort(
      (left, right) => left.order - right.order
    );
    const explicitOwners = uniqueSorted(matchedRules.flatMap((rule) => rule.owners));
    const fallbackReviewers = explicitOwners.length === 0 ? orderedFallbackReviewers : [];
    const owners = explicitOwners.length > 0 ? explicitOwners : fallbackReviewers;
    const surface = surfaceByPath.get(file);
    const sensitive =
      surface?.surfaces.includes("secret-sensitive") === true ||
      matchedRules.some((rule) => rule.sensitive);
    const ownerMissing = owners.length === 0;
    const evidenceRef = addEvidence(evidence, {
      kind: "ownership",
      source: matchedRules.length > 0 ? "ownership-rules" : "ownership-coverage",
      summary: ownerMissing
        ? "No explicit owner or fallback reviewer matched this changed file."
        : fallbackReviewers.length > 0
          ? "Fallback reviewers were applied because no specific ownership rule matched this changed file."
          : "Specific ownership rules matched this changed file.",
      paths: [file],
      data: {
        ownerCount: owners.length,
        fallbackUsed: fallbackReviewers.length > 0,
        sensitive
      }
    });

    matches.push({
      path: file,
      owners,
      matchedRules,
      fallbackReviewers,
      fallbackUsed: fallbackReviewers.length > 0,
      sensitive,
      ownerMissing,
      evidenceRefs: [evidenceRef]
    });

    if (ownerMissing) {
      unknowns.push({
        id: `unknown.ownership.${sanitizeIdentifier(file)}`,
        category: "ownership",
        title: sensitive ? "Sensitive changed file has no owner" : "Changed file has no owner",
        severity: sensitive ? "HIGH" : "MEDIUM",
        impactedFiles: [file],
        reason:
          "No configured CODEOWNERS rule, ownership metadata rule, or fallback reviewer covered this changed file.",
        resolution:
          "Add a CODEOWNERS or impact ownership metadata rule, or configure ownership.fallbackReviewers.",
        evidenceRefs: [evidenceRef]
      });
    }

    if (sensitive && ownerMissing && config.risk.blockOnSensitiveUnknownOwner) {
      findings.push({
        id: `finding.ownership.sensitive-owner.${sanitizeIdentifier(file)}`,
        checkId: "ownership.sensitive-owner",
        title: "Sensitive changed file has no accountable owner",
        severity: "CRITICAL",
        status: "BLOCK",
        confidence: 0.86,
        impactedFiles: [file],
        impactedAreas: [surface?.area ?? "sensitive-config"],
        owners: [],
        requiredActions: [
          "Assign an explicit owner or fallback reviewer before relying on this impact report."
        ],
        evidenceRefs: [evidenceRef]
      });
    }
  }

  const filesWithOwners = matches.filter((match) => !match.ownerMissing).length;
  const filesMissingOwners = matches.length - filesWithOwners;
  const coverageStatus =
    matches.length === 0 || filesWithOwners === 0
      ? "none"
      : filesMissingOwners === 0
        ? "complete"
        : "partial";

  return {
    ownership: {
      coverage: {
        status: coverageStatus,
        sourcesConfigured: configuredSources,
        sourcesUsed: uniqueSorted(sourcesUsed),
        fallbackReviewers: orderedFallbackReviewers,
        filesWithOwners,
        filesMissingOwners,
        gaps: matches.filter((match) => match.ownerMissing).map((match) => match.path).sort()
      },
      codeownersPath,
      metadataPaths: metadataPaths.sort(),
      rules: rules.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath) || left.order - right.order),
      matches: matches.sort((left, right) => left.path.localeCompare(right.path))
    },
    unknowns: sortUnknownRecords(unknowns),
    findings: sortFindings(findings),
    evidence: sortEvidenceRecords(evidence)
  };
}

function addDependencyNode(
  nodes: Map<string, ImpactDependencyNode>,
  node: ImpactDependencyNode
): void {
  const existing = nodes.get(node.id);

  if (!existing) {
    nodes.set(node.id, node);
    return;
  }

  nodes.set(node.id, {
    ...existing,
    path: existing.path ?? node.path,
    source: uniqueSorted([...existing.source.split(","), node.source]).join(",")
  });
}

function addDependencyEdge(
  edges: Map<string, ImpactDependencyEdge>,
  edge: ImpactDependencyEdge
): void {
  const key = `${edge.from}\0${edge.to}\0${edge.type}\0${edge.source}`;

  if (!edges.has(key)) {
    edges.set(key, edge);
  }
}

function dependencyNamesFromPackageJson(parsed: Record<string, unknown>): string[] {
  return uniqueSorted(
    ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].flatMap(
      (key) => (isPlainObject(parsed[key]) ? Object.keys(parsed[key]) : [])
    )
  );
}

function packageScriptsFromPackageJson(parsed: Record<string, unknown>): string[] {
  return isPlainObject(parsed.scripts) ? Object.keys(parsed.scripts).sort() : [];
}

function packageJsonWorkspaces(parsed: Record<string, unknown>): string[] {
  if (Array.isArray(parsed.workspaces)) {
    return parsed.workspaces.filter((item): item is string => typeof item === "string");
  }

  if (isPlainObject(parsed.workspaces) && Array.isArray(parsed.workspaces.packages)) {
    return parsed.workspaces.packages.filter((item): item is string => typeof item === "string");
  }

  return [];
}

async function readJsonObjectIfPresent(
  filePath: string,
  label: string
): Promise<Record<string, unknown> | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }

  return safeJsonParseObject(await fs.readFile(filePath, "utf8"), { label });
}

async function resolveSimpleWorkspaceDirectories(
  projectRoot: string,
  workspacePatterns: string[]
): Promise<string[]> {
  const directories: string[] = [];

  for (const pattern of workspacePatterns) {
    const normalizedPattern = pattern.trim().replaceAll("\\", "/").replace(/\/+$/u, "");

    if (!["packages/*", "apps/*"].includes(normalizedPattern)) {
      continue;
    }

    const root = normalizedPattern.split("/")[0];
    const absoluteRoot = path.join(projectRoot, root);

    if (!(await pathExists(absoluteRoot))) {
      continue;
    }

    const entries = await fs.readdir(absoluteRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }

      const relativePath = `${root}/${entry.name}`;

      if (await pathExists(path.join(projectRoot, relativePath, "package.json"))) {
        directories.push(relativePath);
      }
    }
  }

  return uniqueSorted(directories);
}

async function loadPackageJsonDependencySource(
  projectRoot: string,
  nodes: Map<string, ImpactDependencyNode>,
  edges: Map<string, ImpactDependencyEdge>,
  evidence: ImpactEvidenceRecord[],
  warnings: string[]
): Promise<{ used: boolean; packageNameByWorkspacePath: Map<string, string> }> {
  const packagePath = path.join(projectRoot, "package.json");
  const parsed = await readJsonObjectIfPresent(packagePath, "Impact package.json");
  const packageNameByWorkspacePath = new Map<string, string>();

  if (!parsed) {
    return { used: false, packageNameByWorkspacePath };
  }

  const rootName = typeof parsed.name === "string" ? parsed.name : "root-package";
  const rootNodeId = `package:${rootName}`;
  addDependencyNode(nodes, {
    id: rootNodeId,
    path: ".",
    kind: "package",
    source: PACKAGE_JSON_SOURCE
  });

  for (const dependencyName of dependencyNamesFromPackageJson(parsed)) {
    const dependencyNodeId = `external:${dependencyName}`;
    addDependencyNode(nodes, {
      id: dependencyNodeId,
      path: null,
      kind: "external",
      source: PACKAGE_JSON_SOURCE
    });
    addDependencyEdge(edges, {
      from: rootNodeId,
      to: dependencyNodeId,
      type: "package-dependency",
      source: PACKAGE_JSON_SOURCE
    });
  }

  const workspaceDirectories = await resolveSimpleWorkspaceDirectories(
    projectRoot,
    packageJsonWorkspaces(parsed)
  );
  const workspacePackageNames = new Map<string, string>();

  for (const workspacePath of workspaceDirectories) {
    try {
      const workspacePackage = await readJsonObjectIfPresent(
        path.join(projectRoot, workspacePath, "package.json"),
        `Impact workspace package ${workspacePath}/package.json`
      );

      if (!workspacePackage) {
        continue;
      }

      const workspaceName =
        typeof workspacePackage.name === "string" ? workspacePackage.name : workspacePath;
      const workspaceNodeId = `package:${workspaceName}`;
      workspacePackageNames.set(workspaceName, workspaceNodeId);
      packageNameByWorkspacePath.set(workspacePath, workspaceName);
      addDependencyNode(nodes, {
        id: workspaceNodeId,
        path: workspacePath,
        kind: "workspace",
        source: PACKAGE_JSON_SOURCE
      });
      addDependencyEdge(edges, {
        from: rootNodeId,
        to: workspaceNodeId,
        type: "workspace",
        source: PACKAGE_JSON_SOURCE
      });
    } catch (error) {
      warnings.push(
        `Could not read impact workspace package metadata at ${workspacePath}/package.json: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  for (const workspacePath of workspaceDirectories) {
    const workspacePackage = await readJsonObjectIfPresent(
      path.join(projectRoot, workspacePath, "package.json"),
      `Impact workspace package ${workspacePath}/package.json`
    );

    if (!workspacePackage) {
      continue;
    }

    const workspaceName =
      typeof workspacePackage.name === "string" ? workspacePackage.name : workspacePath;
    const fromNodeId = `package:${workspaceName}`;

    for (const dependencyName of dependencyNamesFromPackageJson(workspacePackage)) {
      const workspaceTargetId = workspacePackageNames.get(dependencyName);

      if (workspaceTargetId) {
        addDependencyEdge(edges, {
          from: fromNodeId,
          to: workspaceTargetId,
          type: "workspace-package-dependency",
          source: PACKAGE_JSON_SOURCE
        });
      }
    }
  }

  addEvidence(evidence, {
    kind: "dependency",
    source: "package.json",
    summary: "Loaded package runtime dependencies, scripts, and simple packages/* or apps/* workspaces.",
    paths: ["package.json", ...workspaceDirectories.map((entry) => `${entry}/package.json`)],
    data: {
      dependencyCount: dependencyNamesFromPackageJson(parsed).length,
      scriptCount: packageScriptsFromPackageJson(parsed).length,
      workspaceCount: workspaceDirectories.length
    }
  });

  return { used: true, packageNameByWorkspacePath };
}

async function loadPackageLockDependencySource(
  projectRoot: string,
  nodes: Map<string, ImpactDependencyNode>,
  evidence: ImpactEvidenceRecord[],
  unknowns: ImpactUnknownRecord[],
  warnings: string[]
): Promise<boolean> {
  const lockPath = path.join(projectRoot, "package-lock.json");

  if (!(await pathExists(lockPath))) {
    return false;
  }

  try {
    const parsed = safeJsonParseObject(await fs.readFile(lockPath, "utf8"), {
      label: "Impact package-lock.json"
    });
    const packages = isPlainObject(parsed.packages) ? Object.entries(parsed.packages) : [];

    for (const [packagePath] of packages.slice(0, 500)) {
      if (packagePath.length === 0 || packagePath.startsWith("node_modules/")) {
        continue;
      }

      addDependencyNode(nodes, {
        id: `lock:${packagePath}`,
        path: normalizeRepoPathForClassification(packagePath),
        kind: "package",
        source: PACKAGE_LOCK_SOURCE
      });
    }

    addEvidence(evidence, {
      kind: "dependency",
      source: "package-lock.json",
      summary: "Loaded package-lock package path hints for dependency coverage.",
      paths: ["package-lock.json"],
      data: { packageHintCount: packages.length }
    });
    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impact package-lock.json could not be parsed.";
    warnings.push(message);
    const evidenceRef = addEvidence(evidence, {
      kind: "metadata",
      source: "package-lock.json",
      summary: "package-lock metadata could not be parsed; dependency analysis continued without it.",
      paths: ["package-lock.json"]
    });
    unknowns.push({
      id: "unknown.dependency.package-lock-metadata",
      category: "dependency",
      title: "package-lock metadata is malformed",
      severity: "LOW",
      impactedFiles: [],
      reason: message,
      resolution: "Repair package-lock.json or disable the package-lock impact dependency source.",
      evidenceRefs: [evidenceRef]
    });
    return false;
  }
}

async function listBoundedSourceFiles(
  projectRoot: string,
  roots: readonly string[],
  changedFiles: string[]
): Promise<string[]> {
  const results = new Set<string>();
  const queue: Array<{ relativePath: string; depth: number }> = [];

  for (const root of roots) {
    if (await pathExists(path.join(projectRoot, root))) {
      queue.push({ relativePath: root, depth: 0 });
    }
  }

  while (queue.length > 0 && results.size < 600) {
    const current = queue.shift();

    if (!current || current.depth > 8) {
      continue;
    }

    const absolutePath = path.join(projectRoot, current.relativePath);
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.size >= 600) {
        break;
      }

      if (entry.name.startsWith(".")) {
        continue;
      }

      const relativePath = `${current.relativePath}/${entry.name}`;

      if (entry.isDirectory()) {
        if (["node_modules", "dist", "coverage", "build"].includes(entry.name)) {
          continue;
        }

        queue.push({ relativePath, depth: current.depth + 1 });
      } else if (SOURCE_FILE_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase())) {
        results.add(relativePath);
      }
    }
  }

  for (const file of changedFiles) {
    if (SOURCE_FILE_EXTENSIONS.has(path.posix.extname(file).toLowerCase())) {
      results.add(file);
    }
  }

  return [...results].sort();
}

function resolveImportSpecifierToRepoPath(
  importerPath: string,
  specifier: string,
  knownRepoPaths: Set<string>
): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = path.posix.normalize(path.posix.join(path.posix.dirname(importerPath), specifier));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`
  ];

  return candidates.find((candidate) => knownRepoPaths.has(candidate)) ?? candidates[0] ?? null;
}

function extractImportSpecifiers(sourceText: string): string[] {
  const specifiers = new Set<string>();
  const importPattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu;

  for (const match of sourceText.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];

    if (specifier) {
      specifiers.add(specifier);
    }
  }

  return [...specifiers].sort();
}

function findWorkspaceNodeForPath(
  filePath: string,
  nodes: Map<string, ImpactDependencyNode>
): ImpactDependencyNode | null {
  const workspaceNodes = [...nodes.values()]
    .filter((node) => node.kind === "workspace" && node.path)
    .sort((left, right) => (right.path?.length ?? 0) - (left.path?.length ?? 0));

  return (
    workspaceNodes.find(
      (node) => node.path && (filePath === node.path || filePath.startsWith(`${node.path}/`))
    ) ?? null
  );
}

async function loadTsImportScanDependencySource(
  projectRoot: string,
  changedFiles: string[],
  surfaceByPath: Map<string, ImpactSurfaceRecord>,
  nodes: Map<string, ImpactDependencyNode>,
  edges: Map<string, ImpactDependencyEdge>,
  evidence: ImpactEvidenceRecord[]
): Promise<boolean> {
  const sourceFiles = await listBoundedSourceFiles(projectRoot, BOUNDED_SOURCE_ROOTS, changedFiles);
  const sourceFileSet = new Set(sourceFiles);
  let scannedCount = 0;
  let skippedSecretCount = 0;
  const workspaceNameToNode = new Map(
    [...nodes.values()]
      .filter((node) => node.kind === "workspace" && node.id.startsWith("package:"))
      .map((node) => [node.id.slice("package:".length), node.id])
  );

  for (const file of sourceFiles) {
    const classifiedSurface = surfaceByPath.get(file) ?? classifyImpactFile(file);

    if (classifiedSurface.surfaces.includes("secret-sensitive")) {
      skippedSecretCount += 1;
      continue;
    }

    const absolutePath = path.join(projectRoot, file);

    if (!(await pathExists(absolutePath))) {
      continue;
    }

    const fileNodeId = `file:${file}`;
    addDependencyNode(nodes, {
      id: fileNodeId,
      path: file,
      kind: "file",
      source: TS_IMPORT_SCAN_SOURCE
    });

    const workspaceNode = findWorkspaceNodeForPath(file, nodes);

    if (workspaceNode) {
      addDependencyEdge(edges, {
        from: workspaceNode.id,
        to: fileNodeId,
        type: "contains-file",
        source: TS_IMPORT_SCAN_SOURCE
      });
    }

    const rawSource = await fs.readFile(absolutePath, "utf8");
    scannedCount += 1;

    for (const specifier of extractImportSpecifiers(rawSource)) {
      const targetPath = resolveImportSpecifierToRepoPath(file, specifier, sourceFileSet);

      if (targetPath) {
        const targetNodeId = `file:${targetPath}`;
        addDependencyNode(nodes, {
          id: targetNodeId,
          path: targetPath,
          kind: "file",
          source: TS_IMPORT_SCAN_SOURCE
        });
        addDependencyEdge(edges, {
          from: fileNodeId,
          to: targetNodeId,
          type: "ts-import",
          source: TS_IMPORT_SCAN_SOURCE
        });
        continue;
      }

      const workspaceTargetId = workspaceNameToNode.get(specifier);

      if (workspaceTargetId) {
        addDependencyEdge(edges, {
          from: fileNodeId,
          to: workspaceTargetId,
          type: "workspace-import",
          source: TS_IMPORT_SCAN_SOURCE
        });
      }
    }
  }

  addEvidence(evidence, {
    kind: "dependency",
    source: TS_IMPORT_SCAN_SOURCE,
    summary:
      "Scanned bounded TypeScript/JavaScript roots and changed source files for dependency edges; secret-sensitive paths were skipped.",
    paths: [],
    data: {
      scannedFileCount: scannedCount,
      skippedSecretFileCount: skippedSecretCount
    }
  });

  return scannedCount > 0 || skippedSecretCount > 0;
}

async function loadCustomDependencyGraphs(
  projectRoot: string,
  config: ImpactConfig,
  nodes: Map<string, ImpactDependencyNode>,
  edges: Map<string, ImpactDependencyEdge>,
  evidence: ImpactEvidenceRecord[],
  unknowns: ImpactUnknownRecord[],
  warnings: string[]
): Promise<boolean> {
  let used = false;

  for (const graphPath of config.dependencyGraph.customGraphFiles) {
    const absolutePath = resolveContainedInputPath(
      projectRoot,
      graphPath,
      "Impact dependency graph source"
    );

    if (!(await pathExists(absolutePath))) {
      continue;
    }

    const relativePath = toRepoRelativePath(projectRoot, absolutePath);

    try {
      const parsed = safeJsonParseObject(await fs.readFile(absolutePath, "utf8"), {
        label: `Impact dependency graph ${relativePath}`
      });
      const graphResult = dependencyGraphMetadataSchema.safeParse(parsed);

      if (!graphResult.success) {
        throw new Error(
          formatZodIssues(`Invalid impact dependency graph ${relativePath}:`, graphResult.error).join(
            " "
          )
        );
      }

      for (const node of graphResult.data.nodes) {
        addDependencyNode(nodes, {
          id: node.id,
          path: node.path
            ? toRepoRelativeInputPath(projectRoot, node.path, "Impact dependency graph node path")
            : null,
          kind: "custom",
          source: relativePath
        });
      }

      for (const edge of graphResult.data.edges) {
        addDependencyEdge(edges, {
          from: edge.from,
          to: edge.to,
          type: edge.type,
          source: relativePath
        });
      }

      addEvidence(evidence, {
        kind: "dependency",
        source: relativePath,
        summary: "Loaded optional custom impact dependency graph metadata.",
        paths: [relativePath],
        data: {
          nodeCount: graphResult.data.nodes.length,
          edgeCount: graphResult.data.edges.length
        }
      });
      used = true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Impact dependency graph ${relativePath} could not be parsed.`;

      if (message.includes("escapes the allowed root")) {
        throw error;
      }

      warnings.push(message);
      const evidenceRef = addEvidence(evidence, {
        kind: "metadata",
        source: relativePath,
        summary: "Optional dependency graph metadata could not be parsed; dependency analysis continued without it.",
        paths: [relativePath]
      });
      unknowns.push({
        id: `unknown.dependency.metadata.${sanitizeIdentifier(relativePath)}`,
        category: "dependency",
        title: "Optional dependency graph metadata is malformed",
        severity: "MEDIUM",
        impactedFiles: [],
        reason: message,
        resolution: `Repair ${relativePath} to match ${DEPENDENCY_GRAPH_SCHEMA_VERSION}.`,
        evidenceRefs: [evidenceRef]
      });
    }
  }

  return used;
}

function nodeMatchesChangedFile(node: ImpactDependencyNode, filePath: string): boolean {
  if (!node.path) {
    return false;
  }

  if (node.path === ".") {
    return filePath === "package.json" || filePath === "package-lock.json";
  }

  return (
    filePath === node.path ||
    filePath.startsWith(`${node.path}/`) ||
    node.path.startsWith(`${filePath}/`)
  );
}

function buildReverseDependentsByPath(
  files: string[],
  nodes: ImpactDependencyNode[],
  edges: ImpactDependencyEdge[]
): Record<string, string[]> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, Set<string>>();

  for (const edge of edges) {
    const dependents = incoming.get(edge.to) ?? new Set<string>();
    const fromNode = nodeById.get(edge.from);
    dependents.add(fromNode?.path ?? edge.from);
    incoming.set(edge.to, dependents);
  }

  const reverseDependentsByPath: Record<string, string[]> = {};

  for (const file of files) {
    const matchingNodeIds = nodes
      .filter((node) => nodeMatchesChangedFile(node, file))
      .map((node) => node.id);
    const dependents = uniqueSorted(
      matchingNodeIds.flatMap((nodeId) => [...(incoming.get(nodeId) ?? new Set<string>())])
    );
    reverseDependentsByPath[file] = dependents;
  }

  return Object.fromEntries(
    Object.entries(reverseDependentsByPath).sort(([left], [right]) => left.localeCompare(right))
  );
}

function buildDependencyCoverage(
  files: string[],
  surfaces: ImpactSurfaceRecord[],
  sourcesConfigured: string[],
  sourcesUsed: string[],
  nodes: ImpactDependencyNode[],
  reverseDependentsByPath: Record<string, string[]>
): ImpactDependencyCoverage {
  const surfaceByPath = new Map(surfaces.map((surface) => [surface.path, surface]));
  const relevantFiles = files.filter((file) => {
    const surface = surfaceByPath.get(file);
    return surface ? isReverseDependencyRelevant(surface) : false;
  });
  const filesCovered = relevantFiles.filter((file) =>
    nodes.some((node) => nodeMatchesChangedFile(node, file))
  );
  const reverseCovered = filesCovered.filter(
    (file) => (reverseDependentsByPath[file]?.length ?? 0) > 0
  );
  const filesUncovered = relevantFiles.filter((file) => !filesCovered.includes(file));
  const gaps = uniqueSorted([
    ...filesUncovered.map((file) => `No dependency node covered ${file}.`),
    ...relevantFiles
      .filter((file) => !reverseCovered.includes(file))
      .map((file) => `Reverse dependency coverage is absent for ${file}.`)
  ]);
  const status =
    relevantFiles.length === 0 || sourcesUsed.length === 0 || filesCovered.length === 0
      ? "none"
      : gaps.length === 0
        ? "complete-ish"
        : "partial";

  return {
    status,
    sourcesConfigured,
    sourcesUsed,
    filesCovered: filesCovered.sort(),
    filesUncovered: filesUncovered.sort(),
    gaps
  };
}

function dependencyUnknownId(filePath: string, surface: ImpactSurfaceRecord): string {
  if (surface.surfaces.includes("package-runtime")) {
    return `unknown.reverseDependencies.package-runtime.${sanitizeIdentifier(filePath)}`;
  }

  if (surface.surfaces.includes("secret-sensitive")) {
    return `unknown.reverseDependencies.security-sensitive.${sanitizeIdentifier(filePath)}`;
  }

  if (isContractLikeSurface(surface)) {
    return `unknown.reverseDependencies.contract.${sanitizeIdentifier(filePath)}`;
  }

  return `unknown.reverseDependencies.source.${sanitizeIdentifier(filePath)}`;
}

async function loadDependencyAnalysis(
  projectRoot: string,
  files: string[],
  surfaces: ImpactSurfaceRecord[],
  config: ImpactConfig,
  warnings: string[]
): Promise<{
  dependencyGraph: ImpactDependencyAnalysis;
  unknowns: ImpactUnknownRecord[];
  evidence: ImpactEvidenceRecord[];
}> {
  const nodesById = new Map<string, ImpactDependencyNode>();
  const edgesByKey = new Map<string, ImpactDependencyEdge>();
  const evidence: ImpactEvidenceRecord[] = [];
  const unknowns: ImpactUnknownRecord[] = [];
  const sourcesConfigured = uniqueSorted(config.dependencyGraph.sources);
  const sourcesUsed: string[] = [];
  const surfaceByPath = new Map(surfaces.map((surface) => [surface.path, surface]));

  if (config.dependencyGraph.sources.includes(PACKAGE_JSON_SOURCE)) {
    const packageJsonResult = await loadPackageJsonDependencySource(
      projectRoot,
      nodesById,
      edgesByKey,
      evidence,
      warnings
    );

    if (packageJsonResult.used) {
      sourcesUsed.push(PACKAGE_JSON_SOURCE);
    }
  }

  if (config.dependencyGraph.sources.includes(PACKAGE_LOCK_SOURCE)) {
    const usedPackageLock = await loadPackageLockDependencySource(
      projectRoot,
      nodesById,
      evidence,
      unknowns,
      warnings
    );

    if (usedPackageLock) {
      sourcesUsed.push(PACKAGE_LOCK_SOURCE);
    }
  }

  if (
    config.dependencyGraph.sources.includes(CUSTOM_GRAPH_SOURCE) ||
    config.dependencyGraph.sources.includes("custom")
  ) {
    const usedCustomGraph = await loadCustomDependencyGraphs(
      projectRoot,
      config,
      nodesById,
      edgesByKey,
      evidence,
      unknowns,
      warnings
    );

    if (usedCustomGraph) {
      sourcesUsed.push(CUSTOM_GRAPH_SOURCE);
    }
  }

  if (config.dependencyGraph.sources.includes(TS_IMPORT_SCAN_SOURCE)) {
    const usedTsScan = await loadTsImportScanDependencySource(
      projectRoot,
      files,
      surfaceByPath,
      nodesById,
      edgesByKey,
      evidence
    );

    if (usedTsScan) {
      sourcesUsed.push(TS_IMPORT_SCAN_SOURCE);
    }
  }

  const nodes = [...nodesById.values()].sort((left, right) => left.id.localeCompare(right.id));
  const edges = [...edgesByKey.values()].sort(
    (left, right) =>
      left.from.localeCompare(right.from) ||
      left.to.localeCompare(right.to) ||
      left.type.localeCompare(right.type) ||
      left.source.localeCompare(right.source)
  );
  const reverseDependentsByPath = buildReverseDependentsByPath(files, nodes, edges);
  const coverage = buildDependencyCoverage(
    files,
    surfaces,
    sourcesConfigured,
    uniqueSorted(sourcesUsed),
    nodes,
    reverseDependentsByPath
  );

  for (const file of files) {
    const surface = surfaceByPath.get(file);

    if (!surface || !isReverseDependencyRelevant(surface)) {
      continue;
    }

    const hasReverseCoverage =
      coverage.filesCovered.includes(file) && (reverseDependentsByPath[file]?.length ?? 0) > 0;

    if (!hasReverseCoverage) {
      const evidenceRef = addEvidence(evidence, {
        kind: "dependency",
        source: "dependency-coverage",
        summary: "Reverse dependency coverage is absent or partial for this changed file.",
        paths: [file],
        data: {
          coverageStatus: coverage.status,
          reverseDependentCount: reverseDependentsByPath[file]?.length ?? 0
        }
      });
      unknowns.push({
        id: dependencyUnknownId(file, surface),
        category: "dependency",
        title: "Reverse dependency impact is not fully known",
        severity:
          surface.surfaces.includes("secret-sensitive") || isContractLikeSurface(surface)
            ? "HIGH"
            : "MEDIUM",
        impactedFiles: [file],
        reason:
          "The available dependency graph sources do not fully prove which downstream files, packages, or runtime surfaces depend on this change.",
        resolution:
          "Add or repair dependency graph metadata, enable bounded import scanning, or review downstream dependents manually.",
        evidenceRefs: [evidenceRef]
      });
    }
  }

  const hasGenerated = surfaces.some((surface) => surface.surfaces.includes("generated"));
  const hasSource = surfaces.some((surface) => surface.surfaces.includes("source"));

  if (hasGenerated && hasSource) {
    const impactedFiles = surfaces
      .filter((surface) => surface.surfaces.includes("generated") || surface.surfaces.includes("source"))
      .map((surface) => surface.path)
      .sort();
    const evidenceRef = addEvidence(evidence, {
      kind: "dependency",
      source: "surface-coverage",
      summary: "Generated and source files changed together; source remains an impact driver.",
      paths: impactedFiles
    });
    unknowns.push({
      id: "unknown.reverseDependencies.mixed-generated-source",
      category: "dependency",
      title: "Generated and source changes need source-driven dependency review",
      severity: "MEDIUM",
      impactedFiles,
      reason:
        "Generated output changed alongside source files, so analysis must not downgrade the scope to generated-only.",
      resolution:
        "Review source-level dependency coverage and ensure generated output corresponds to the source change.",
      evidenceRefs: [evidenceRef]
    });
  } else if (surfaces.some(isGeneratedOnlySurface)) {
    addEvidence(evidence, {
      kind: "dependency",
      source: "surface-coverage",
      summary: "Generated-only changed files were detected; dependency conclusions remain scoped to generated outputs.",
      paths: surfaces.filter(isGeneratedOnlySurface).map((surface) => surface.path)
    });
  }

  return {
    dependencyGraph: {
      coverage,
      nodes,
      edges,
      reverseDependentsByPath
    },
    unknowns: sortUnknownRecords(unknowns),
    evidence: sortEvidenceRecords(evidence)
  };
}

type Phase6Context = {
  catalog: CommandCatalogLike | null;
  commandAssets: Record<string, unknown> | null;
  runtime: Record<string, unknown> | null;
  artifactContracts: unknown[] | null;
  provided: boolean;
};

function hasOwnContextKey(context: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(context, key);
}

function catalogEntries(catalog: CommandCatalogLike): Array<[string, CommandCatalogEntryLike]> {
  return Object.entries(catalog.commands ?? {})
    .filter(([, entry]) => isPlainObject(entry))
    .sort(([left], [right]) => left.localeCompare(right)) as Array<
    [string, CommandCatalogEntryLike]
  >;
}

function contextRequiresCatalog(surfaces: ImpactSurfaceRecord[]): boolean {
  return surfaces.some((surface) =>
    surface.surfaces.some((name) =>
      [
        "command-catalog",
        "command-manifest",
        "command-doc",
        "runtime-reference",
        "mcp-resource"
      ].includes(name)
    )
  );
}

function contextRequiresRuntime(surfaces: ImpactSurfaceRecord[]): boolean {
  return surfaces.some((surface) =>
    surface.surfaces.some((name) =>
      [
        "command-catalog",
        "command-manifest",
        "command-doc",
        "runtime-reference",
        "mcp-server",
        "mcp-tool",
        "mcp-resource",
        "extension-manifest"
      ].includes(name)
    )
  );
}

function contextRequiresArtifactContracts(surfaces: ImpactSurfaceRecord[]): boolean {
  return surfaces.some((surface) => surface.surfaces.includes("artifact-contract"));
}

function addContextUnknown(
  evidence: ImpactEvidenceRecord[],
  unknowns: ImpactUnknownRecord[],
  warnings: string[],
  options: {
    id: string;
    title: string;
    reason: string;
    resolution: string;
    impactedFiles: string[];
    contextKey: string;
  }
): void {
  warnings.push(options.reason);
  const evidenceRef = addEvidence(evidence, {
    kind: "contract",
    source: "impact-context",
    summary: options.reason,
    paths: options.impactedFiles,
    data: { contextKey: options.contextKey }
  });
  unknowns.push({
    id: options.id,
    category: "contract",
    title: options.title,
    severity: "HIGH",
    impactedFiles: options.impactedFiles,
    reason: options.reason,
    resolution: options.resolution,
    evidenceRefs: [evidenceRef]
  });
}

async function resolvePhase6Context(
  projectRoot: string,
  providedContext: Record<string, unknown> | undefined,
  surfaces: ImpactSurfaceRecord[],
  evidence: ImpactEvidenceRecord[],
  unknowns: ImpactUnknownRecord[],
  warnings: string[]
): Promise<Phase6Context> {
  const contractFiles = surfaces.filter(isContractLikeSurface).map((surface) => surface.path);
  const requireCatalog = contextRequiresCatalog(surfaces);
  const requireRuntime = contextRequiresRuntime(surfaces);
  const requireArtifactContracts = contextRequiresArtifactContracts(surfaces);

  if (!providedContext) {
    let catalog: CommandCatalogLike | null = null;
    let commandAssets: Record<string, unknown> | null = null;
    let artifactContracts: unknown[] | null = null;
    const runtime: Record<string, unknown> = {
      registeredTools: allRegisteredRuntimeToolNames(),
      registeredImpactTools: [...IMPACT_TOOL_NAMES],
      implementationPhase: 11,
      readOnly: true,
      includeRuntime: true,
      includeCatalog: true,
      includeArtifacts: true
    };

    try {
      const loadedCatalog = await loadCommandCatalog();

      if (isPlainObject(loadedCatalog) && isPlainObject(loadedCatalog.commands)) {
        catalog = loadedCatalog as CommandCatalogLike;
        commandAssets = buildCommandAssets(loadedCatalog) as unknown as Record<string, unknown>;
      } else if (requireCatalog) {
        addContextUnknown(evidence, unknowns, warnings, {
          id: "unknown.contract.catalog-context-malformed",
          title: "Command catalog context is malformed",
          reason:
            "Live command catalog context was loaded for impact analysis, but it did not expose a commands object.",
          resolution:
            "Repair the command catalog projection before treating command contract safety as known.",
          impactedFiles: contractFiles,
          contextKey: "catalog"
        });
      }
    } catch (error) {
      if (requireCatalog) {
        addContextUnknown(evidence, unknowns, warnings, {
          id: "unknown.contract.catalog-context-missing",
          title: "Command catalog context is unavailable",
          reason: `Live command catalog context could not be loaded for impact analysis: ${
            error instanceof Error ? error.message : String(error)
          }`,
          resolution:
            "Load or provide command catalog context before treating command contract safety as known.",
          impactedFiles: contractFiles,
          contextKey: "catalog"
        });
      }
    }

    try {
      artifactContracts = listArtifactContracts();
    } catch (error) {
      if (requireArtifactContracts) {
        addContextUnknown(evidence, unknowns, warnings, {
          id: "unknown.contract.artifact-contract-context-missing",
          title: "Artifact contract context is unavailable",
          reason: `Live artifact contract context could not be loaded for impact analysis: ${
            error instanceof Error ? error.message : String(error)
          }`,
          resolution:
            "Load artifact contract context before treating artifact compatibility as known.",
          impactedFiles: surfaces
            .filter((surface) => surface.surfaces.includes("artifact-contract"))
            .map((surface) => surface.path),
          contextKey: "artifactContracts"
        });
      }
    }

    return {
      catalog,
      commandAssets,
      runtime,
      artifactContracts,
      provided: false
    };
  }

  const catalogValue = providedContext.catalog;
  const commandAssetsValue = providedContext.commandAssets;
  const runtimeValue = providedContext.runtime;
  const artifactContractsValue = providedContext.artifactContracts;
  let catalog: CommandCatalogLike | null = null;
  let commandAssets: Record<string, unknown> | null = null;
  let runtime: Record<string, unknown> | null = null;
  let artifactContracts: unknown[] | null = null;

  if (isPlainObject(catalogValue) && isPlainObject(catalogValue.commands)) {
    catalog = catalogValue as CommandCatalogLike;
  } else if (requireCatalog) {
    addContextUnknown(evidence, unknowns, warnings, {
      id: hasOwnContextKey(providedContext, "catalog")
        ? "unknown.contract.catalog-context-malformed"
        : "unknown.contract.catalog-context-missing",
      title: hasOwnContextKey(providedContext, "catalog")
        ? "Command catalog context is malformed"
        : "Command catalog context is missing",
      reason: hasOwnContextKey(providedContext, "catalog")
        ? "Provided impact context.catalog did not expose a commands object."
        : "Provided impact context omitted catalog data for command-like changed surfaces.",
      resolution:
        "Provide context.catalog from blueprint_command_catalog or omit context so live read-only catalog loading can run.",
      impactedFiles: contractFiles,
      contextKey: "catalog"
    });
  }

  if (isPlainObject(commandAssetsValue)) {
    commandAssets = commandAssetsValue;
  }

  if (isPlainObject(runtimeValue)) {
    runtime = runtimeValue;
  } else if (requireRuntime) {
    addContextUnknown(evidence, unknowns, warnings, {
      id: hasOwnContextKey(providedContext, "runtime")
        ? "unknown.contract.runtime-context-malformed"
        : "unknown.contract.runtime-context-missing",
      title: hasOwnContextKey(providedContext, "runtime")
        ? "Runtime tool context is malformed"
        : "Runtime tool context is missing",
      reason: hasOwnContextKey(providedContext, "runtime")
        ? "Provided impact context.runtime was not an object."
        : "Provided impact context omitted runtime data for command, MCP, or extension changed surfaces.",
      resolution:
        "Provide runtime tool context or omit context so live read-only runtime loading can run.",
      impactedFiles: contractFiles,
      contextKey: "runtime"
    });
  }

  if (Array.isArray(artifactContractsValue)) {
    artifactContracts = artifactContractsValue;
  } else if (requireArtifactContracts) {
    addContextUnknown(evidence, unknowns, warnings, {
      id: hasOwnContextKey(providedContext, "artifactContracts")
        ? "unknown.contract.artifact-contract-context-malformed"
        : "unknown.contract.artifact-contract-context-missing",
      title: hasOwnContextKey(providedContext, "artifactContracts")
        ? "Artifact contract context is malformed"
        : "Artifact contract context is missing",
      reason: hasOwnContextKey(providedContext, "artifactContracts")
        ? "Provided impact context.artifactContracts was not an array."
        : "Provided impact context omitted artifactContracts for artifact contract changed surfaces.",
      resolution:
        "Provide context.artifactContracts from blueprint_artifact_contract_read/listArtifactContracts or omit context so live read-only artifact loading can run.",
      impactedFiles: surfaces
        .filter((surface) => surface.surfaces.includes("artifact-contract"))
        .map((surface) => surface.path),
      contextKey: "artifactContracts"
    });
  }

  return {
    catalog,
    commandAssets,
    runtime,
    artifactContracts,
    provided: true
  };
}

function extractBlockedBy(entry: CommandCatalogEntryLike): string[] {
  return extractStringArray(entry.blockedBy);
}

function extractRequiredTools(entry: CommandCatalogEntryLike): string[] {
  return extractStringArray(entry.requiredTools);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function pathFromBlockedBy(blockedBy: string[], prefix: string): string | null {
  const row = blockedBy.find((item) => item.startsWith(prefix));

  return row ? row.slice(prefix.length).trim() || null : null;
}

function expectedCommandManifestPath(commandName: string): string {
  return commandName === "blu" ? "commands/blu.toml" : `commands/blu-${commandName}.toml`;
}

function expectedCommandSpecPath(commandName: string): string {
  return commandName === "blu" ? "docs/commands/blu.md" : `docs/commands/${commandName}.md`;
}

function expectedSkillPath(entry: CommandCatalogEntryLike): string | null {
  const primarySkill = stringValue(entry.primarySkill);

  return primarySkill ? `skills/${primarySkill}/SKILL.md` : null;
}

function registeredRuntimeToolNames(runtime: Record<string, unknown> | null): Set<string> | null {
  if (!runtime) {
    return null;
  }

  const keys = ["registeredTools", "toolNames", "availableTools", "registeredImpactTools"];
  const names = keys.flatMap((key) => extractStringArray(runtime[key]));

  return names.length > 0 ? new Set(names) : null;
}

function addCommandSubstrateFinding(
  findings: ImpactFindingRecord[],
  evidence: ImpactEvidenceRecord[],
  commandName: string,
  entry: CommandCatalogEntryLike,
  asset: "spec" | "manifest" | "skill" | "required-tools",
  impactedFiles: string[],
  requiredActions: string[],
  extraData: Record<string, unknown> = {}
): void {
  const blockedBy = extractBlockedBy(entry);
  const evidenceRef = addEvidence(evidence, {
    kind: "contract",
    source: "command-substrate",
    summary:
      "A command declared implemented is missing required runtime substrate according to catalog blockedBy evidence.",
    paths: impactedFiles,
    data: {
      command: commandName,
      asset,
      declaredStatus: entry.declaredStatus,
      status: entry.status,
      implemented: entry.implemented,
      blockedBy,
      ...extraData
    }
  });
  const titleByAsset = {
    spec: "Implemented command missing command spec",
    manifest: "Implemented command missing command manifest",
    skill: "Implemented command missing primary skill",
    "required-tools": "Implemented command missing required MCP tool"
  } as const;

  findings.push({
    id: `finding.contract.command-substrate.${sanitizeIdentifier(commandName)}.${asset}`,
    checkId: `contract.command.${asset}`,
    title: titleByAsset[asset],
    severity: "CRITICAL",
    status: "BLOCK",
    confidence: 0.9,
    impactedFiles,
    impactedAreas: ["blueprint-runtime"],
    owners: [],
    requiredActions,
    evidenceRefs: [evidenceRef]
  });
}

function analyzeImplementedCommandSubstrate(
  catalog: CommandCatalogLike | null,
  runtime: Record<string, unknown> | null,
  findings: ImpactFindingRecord[],
  evidence: ImpactEvidenceRecord[]
): void {
  if (!catalog) {
    return;
  }

  const runtimeToolNames = registeredRuntimeToolNames(runtime);

  for (const [commandName, entry] of catalogEntries(catalog)) {
    if (entry.declaredStatus !== "implemented") {
      continue;
    }

    const blockedBy = extractBlockedBy(entry);
    const specPath =
      stringValue(entry.specPath) ??
      pathFromBlockedBy(blockedBy, "Missing command spec: ") ??
      expectedCommandSpecPath(commandName);
    const manifestPath =
      stringValue(entry.manifestPath) ??
      pathFromBlockedBy(blockedBy, "Missing command manifest: ") ??
      expectedCommandManifestPath(commandName);
    const skillPath =
      stringValue(entry.skillPath) ??
      pathFromBlockedBy(blockedBy, "Missing primary skill: ") ??
      expectedSkillPath(entry);
    const missingRequiredToolsFromBlockedBy = uniqueSorted(
      blockedBy
        .filter((item) => item.startsWith("Missing required MCP tool: "))
        .map((item) => item.slice("Missing required MCP tool: ".length).trim())
    );
    const missingRequiredToolsFromRuntime =
      runtimeToolNames && extractRequiredTools(entry).length > 0
        ? extractRequiredTools(entry).filter((toolName) => !runtimeToolNames.has(toolName))
        : [];
    const missingRequiredTools = uniqueSorted([
      ...missingRequiredToolsFromBlockedBy,
      ...missingRequiredToolsFromRuntime,
      ...(entry.requiredToolsSatisfied === false &&
      missingRequiredToolsFromBlockedBy.length === 0 &&
      missingRequiredToolsFromRuntime.length === 0
        ? ["unknown-required-tool"]
        : [])
    ]);

    if (!stringValue(entry.specPath) || blockedBy.some((item) => item.startsWith("Missing command spec: "))) {
      addCommandSubstrateFinding(
        findings,
        evidence,
        commandName,
        entry,
        "spec",
        [specPath],
        [
          `Restore ${specPath} before ${commandName} can remain declared implemented.`,
          "Keep the command out of runnable routing until the catalog substrate is complete."
        ]
      );
    }

    if (
      !stringValue(entry.manifestPath) ||
      blockedBy.some((item) => item.startsWith("Missing command manifest: "))
    ) {
      addCommandSubstrateFinding(
        findings,
        evidence,
        commandName,
        entry,
        "manifest",
        [manifestPath],
        [
          `Restore ${manifestPath} before ${commandName} can remain declared implemented.`,
          "Keep the command out of runnable routing until the catalog substrate is complete."
        ]
      );
    }

    if (!stringValue(entry.skillPath) || blockedBy.some((item) => item.startsWith("Missing primary skill: "))) {
      addCommandSubstrateFinding(
        findings,
        evidence,
        commandName,
        entry,
        "skill",
        skillPath ? [skillPath] : [],
        [
          "Restore the declared primary skill before this command can remain declared implemented.",
          "Keep the command out of runnable routing until the catalog substrate is complete."
        ]
      );
    }

    if (missingRequiredTools.length > 0) {
      addCommandSubstrateFinding(
        findings,
        evidence,
        commandName,
        entry,
        "required-tools",
        [],
        [
          `Register or restore missing required MCP tools: ${missingRequiredTools.join(", ")}.`,
          "Keep the command out of runnable routing until all required tools are present."
        ],
        { missingRequiredTools }
      );
    }
  }
}

function nonImplementedCommandsFromContext(
  catalog: CommandCatalogLike | null,
  commandAssets: Record<string, unknown> | null
): string[] {
  if (catalog) {
    return catalogEntries(catalog)
      .filter(([, entry]) => entry.implemented !== true || entry.status !== "implemented")
      .map(([command]) => command)
      .sort();
  }

  return commandAssets ? extractStringArray(commandAssets.nonRoutableCommands) : [];
}

function isRouterHelpProgressNextSurface(filePath: string): boolean {
  return (
    /^(?:commands\/blu(?:-(?:help|progress|next))?\.toml)$/u.test(filePath) ||
    /^docs\/commands\/(?:root-router|help|progress|next)\.md$/u.test(filePath) ||
    filePath === "src/mcp/command-resources.ts" ||
    filePath === "src/mcp/tools/project.ts"
  );
}

function analyzePlannedCommandExposure(
  files: string[],
  catalog: CommandCatalogLike | null,
  commandAssets: Record<string, unknown> | null,
  findings: ImpactFindingRecord[],
  evidence: ImpactEvidenceRecord[]
): void {
  const routerFiles = files.filter(isRouterHelpProgressNextSurface);

  if (routerFiles.length === 0) {
    return;
  }

  const nonImplementedCommands = nonImplementedCommandsFromContext(catalog, commandAssets);

  if (nonImplementedCommands.length === 0) {
    return;
  }

  const evidenceRef = addEvidence(evidence, {
    kind: "contract",
    source: "planned-command-exposure",
    summary:
      "Router/help/progress/next surfaces changed while non-implemented commands exist in catalog context.",
    paths: routerFiles,
    data: {
      nonImplementedCommands
    }
  });

  findings.push({
    id: "finding.contract.planned-command-exposure.requires-review",
    checkId: "contract.planned-command-exposure",
    title: "planned command exposure requires review",
    severity: "HIGH",
    status: "BLOCK",
    confidence: 0.74,
    impactedFiles: routerFiles,
    impactedAreas: ["blueprint-runtime"],
    owners: [],
    requiredActions: [
      "Verify router, help, progress, and next surfaces did not recommend or route non-implemented commands.",
      "Keep planned commands non-routable until their catalog entry is implemented."
    ],
    evidenceRefs: [evidenceRef]
  });
}

function addObligation(
  obligations: ImpactObligationRecord[],
  evidence: ImpactEvidenceRecord[],
  options: {
    category: ImpactObligationCategory;
    title: string;
    severity: ImpactObligationRecord["severity"];
    status?: ImpactStatus;
    impactedFiles: string[];
    sourceSurfaces: ImpactSurface[];
    requiredActions: string[];
    evidenceKind?: ImpactEvidenceRecord["kind"];
    source?: string;
  }
): void {
  if (options.impactedFiles.length === 0) {
    return;
  }

  const evidenceRef = addEvidence(evidence, {
    kind: options.evidenceKind ?? "obligation",
    source: options.source ?? "surface-obligation",
    summary: options.title,
    paths: options.impactedFiles,
    data: {
      category: options.category,
      sourceSurfaces: options.sourceSurfaces
    }
  });

  obligations.push({
    id: `obligation.${options.category}.${sanitizeIdentifier(options.title)}`,
    category: options.category,
    title: options.title,
    severity: options.severity,
    status: options.status ?? "WARN",
    impactedFiles: options.impactedFiles,
    sourceSurfaces: options.sourceSurfaces,
    requiredActions: options.requiredActions,
    evidenceRefs: [evidenceRef]
  });
}

function filesWithAnySurface(
  surfaces: ImpactSurfaceRecord[],
  surfaceNames: ImpactSurface[]
): string[] {
  return surfaces
    .filter((surface) => surfaceNames.some((name) => surface.surfaces.includes(name)))
    .map((surface) => surface.path)
    .sort();
}

function addSurfaceObligations(
  surfaces: ImpactSurfaceRecord[],
  obligations: ImpactObligationRecord[],
  evidence: ImpactEvidenceRecord[]
): void {
  const commandFiles = filesWithAnySurface(surfaces, [
    "command-catalog",
    "command-manifest",
    "command-doc",
    "runtime-reference"
  ]);
  const mcpFiles = filesWithAnySurface(surfaces, ["mcp-server", "mcp-tool", "mcp-resource"]);
  const artifactFiles = filesWithAnySurface(surfaces, ["artifact-contract"]);
  const skillAgentFiles = filesWithAnySurface(surfaces, ["skill", "agent"]);
  const extensionFiles = filesWithAnySurface(surfaces, ["extension-manifest"]);
  const hookFiles = filesWithAnySurface(surfaces, ["hook"]);
  const packageBuildFiles = filesWithAnySurface(surfaces, ["package-runtime", "build-config"]);
  const sensitiveConfigFiles = filesWithAnySurface(surfaces, [
    "secret-sensitive",
    "env-config"
  ]);

  addObligation(obligations, evidence, {
    category: "contract-review",
    title: "Command contract review required",
    severity: "HIGH",
    impactedFiles: commandFiles,
    sourceSurfaces: ["command-catalog", "command-manifest", "command-doc"],
    requiredActions: [
      "Review command manifest, command documentation, catalog status, and routing expectations together."
    ]
  });
  addObligation(obligations, evidence, {
    category: "docs",
    title: "Command documentation and runtime reference must be reviewed",
    severity: "MEDIUM",
    impactedFiles: commandFiles,
    sourceSurfaces: ["command-catalog", "command-manifest", "command-doc"],
    requiredActions: [
      "Verify command docs, MCP tool docs, and runtime reference remain aligned with the changed command surface."
    ]
  });
  addObligation(obligations, evidence, {
    category: "tests",
    title: "Command metadata tests must cover command contract changes",
    severity: "MEDIUM",
    impactedFiles: commandFiles,
    sourceSurfaces: ["command-catalog", "command-manifest", "command-doc"],
    requiredActions: [
      "Add or update command catalog, routing, and metadata regression tests for the changed command surface."
    ]
  });

  addObligation(obligations, evidence, {
    category: "docs",
    title: "MCP tool documentation must be reviewed",
    severity: "MEDIUM",
    impactedFiles: mcpFiles,
    sourceSurfaces: ["mcp-server", "mcp-tool", "mcp-resource"],
    requiredActions: [
      "Update docs/MCP-TOOLS.md and runtime-reference notes for changed MCP tools or resources."
    ]
  });
  addObligation(obligations, evidence, {
    category: "tests",
    title: "MCP registry and contract tests must cover runtime changes",
    severity: "HIGH",
    impactedFiles: mcpFiles,
    sourceSurfaces: ["mcp-server", "mcp-tool", "mcp-resource"],
    requiredActions: [
      "Run or add tests that prove MCP registration, tool schema, and resource contract behavior."
    ]
  });
  addObligation(obligations, evidence, {
    category: "build",
    title: "Runtime source changes require generated dist review",
    severity: "HIGH",
    impactedFiles: mcpFiles,
    sourceSurfaces: ["mcp-server", "mcp-tool", "mcp-resource"],
    requiredActions: ["Run the build and verify dist output provenance for runtime source changes."],
    evidenceKind: "build"
  });

  addObligation(obligations, evidence, {
    category: "docs",
    title: "Artifact schema documentation must be reviewed",
    severity: "MEDIUM",
    impactedFiles: artifactFiles,
    sourceSurfaces: ["artifact-contract"],
    requiredActions: [
      "Verify docs describe any artifact heading, template, or report contract compatibility changes."
    ]
  });
  addObligation(obligations, evidence, {
    category: "tests",
    title: "Artifact contract tests must cover schema changes",
    severity: "HIGH",
    impactedFiles: artifactFiles,
    sourceSurfaces: ["artifact-contract"],
    requiredActions: [
      "Add or update artifact-contract tests for required headings, locked markers, and template compatibility."
    ]
  });
  addObligation(obligations, evidence, {
    category: "migration",
    title: "Artifact compatibility and migration review required",
    severity: "HIGH",
    impactedFiles: artifactFiles,
    sourceSurfaces: ["artifact-contract"],
    requiredActions: [
      "Review whether existing .blueprint artifacts need compatibility notes or migration guidance."
    ]
  });

  addObligation(obligations, evidence, {
    category: "contract-review",
    title: "Skill and agent contract review required",
    severity: "HIGH",
    impactedFiles: skillAgentFiles,
    sourceSurfaces: ["skill", "agent"],
    requiredActions: [
      "Review skill and agent frontmatter, tool boundaries, and command contract alignment."
    ]
  });
  addObligation(obligations, evidence, {
    category: "tests",
    title: "Skill and agent metadata tests must cover contract changes",
    severity: "MEDIUM",
    impactedFiles: skillAgentFiles,
    sourceSurfaces: ["skill", "agent"],
    requiredActions: [
      "Run or update metadata tests that validate skill and agent discoverability and contracts."
    ]
  });

  addObligation(obligations, evidence, {
    category: "deployment",
    title: "Extension deployment install smoke required",
    severity: "HIGH",
    impactedFiles: extensionFiles,
    sourceSurfaces: ["extension-manifest"],
    requiredActions: [
      "Run extension install or smoke coverage for changed Gemini/Tabnine extension manifests."
    ]
  });
  addObligation(obligations, evidence, {
    category: "build",
    title: "Built entrypoint must be verified",
    severity: "HIGH",
    impactedFiles: extensionFiles,
    sourceSurfaces: ["extension-manifest"],
    requiredActions: ["Verify dist/mcp/server.js exists and matches the current runtime source."],
    evidenceKind: "build"
  });

  for (const files of [hookFiles, packageBuildFiles, sensitiveConfigFiles]) {
    const sourceSurfaces: ImpactSurface[] =
      files === hookFiles
        ? ["hook"]
        : files === packageBuildFiles
          ? ["package-runtime", "build-config"]
          : ["secret-sensitive", "env-config"];

    addObligation(obligations, evidence, {
      category: "security",
      title: "Security review required for sensitive runtime surface",
      severity: "HIGH",
      impactedFiles: files,
      sourceSurfaces,
      requiredActions: [
        "Review changed secrets, environment, hook, package, or build behavior for unsafe execution or disclosure risk."
      ]
    });
    addObligation(obligations, evidence, {
      category: "deployment",
      title: "Deployment readiness review required",
      severity: "MEDIUM",
      impactedFiles: files,
      sourceSurfaces,
      requiredActions: [
        "Verify deployment, install, or local runtime instructions remain accurate for this changed surface."
      ]
    });
    addObligation(obligations, evidence, {
      category: "release",
      title: "Release notes review required",
      severity: "MEDIUM",
      impactedFiles: files,
      sourceSurfaces,
      requiredActions: [
        "Decide whether release notes or operator-facing change notes are required."
      ]
    });
    addObligation(obligations, evidence, {
      category: "tests",
      title: "Targeted test coverage required for runtime-sensitive change",
      severity: "HIGH",
      impactedFiles: files,
      sourceSurfaces,
      requiredActions: [
        "Run or add tests for the changed security, deployment, package, build, or hook behavior."
      ]
    });
  }
}

function isRuntimeSourceOrExtensionSurface(surface: ImpactSurfaceRecord): boolean {
  if (surface.surfaces.includes("generated")) {
    return false;
  }

  return surface.surfaces.some((name) =>
    [
      "mcp-server",
      "mcp-tool",
      "mcp-resource",
      "artifact-contract",
      "hook",
      "extension-manifest"
    ].includes(name)
  );
}

async function addBuildAndDistFindings(
  projectRoot: string,
  surfaces: ImpactSurfaceRecord[],
  findings: ImpactFindingRecord[],
  unknowns: ImpactUnknownRecord[],
  obligations: ImpactObligationRecord[],
  evidence: ImpactEvidenceRecord[],
  warnings: string[]
): Promise<void> {
  const runtimeOrExtensionFiles = surfaces
    .filter(isRuntimeSourceOrExtensionSurface)
    .map((surface) => surface.path)
    .sort();
  const mcpOrExtensionFiles = surfaces
    .filter((surface) =>
      surface.surfaces.some((name) =>
        [
          "mcp-server",
          "mcp-tool",
          "mcp-resource",
          "artifact-contract",
          "extension-manifest"
        ].includes(name)
      )
    )
    .map((surface) => surface.path)
    .sort();
  const hookRuntimeFiles = surfaces
    .filter((surface) => surface.surfaces.includes("hook"))
    .map((surface) => surface.path)
    .sort();
  const distFiles = surfaces
    .filter((surface) => surface.path.startsWith("dist/"))
    .map((surface) => surface.path)
    .sort();
  const mcpRuntimeBundleFiles = distFiles
    .filter((filePath) => filePath === "dist/mcp/server.js")
    .sort();
  const hookRuntimeBundleFiles = distFiles
    .filter((filePath) => /^dist\/hooks\/[^/]+\.js$/u.test(filePath))
    .sort();
  const hasRuntimeOrExtension = runtimeOrExtensionFiles.length > 0;
  const hasDistFiles = distFiles.length > 0;
  const missingMcpRuntimeBundleCoverage =
    mcpOrExtensionFiles.length > 0 && mcpRuntimeBundleFiles.length === 0;
  const missingHookRuntimeBundleCoverage =
    hookRuntimeFiles.length > 0 && hookRuntimeBundleFiles.length === 0;
  const hasRuntimeDistBundleCoverage =
    hasRuntimeOrExtension &&
    !missingMcpRuntimeBundleCoverage &&
    !missingHookRuntimeBundleCoverage;

  if (hasRuntimeOrExtension && !(await pathExists(path.join(projectRoot, "dist/mcp/server.js")))) {
    const evidenceRef = addEvidence(evidence, {
      kind: "build",
      source: "dist-entrypoint",
      summary: "dist/mcp/server.js is missing while extension or runtime source surfaces changed.",
      paths: [...runtimeOrExtensionFiles, "dist/mcp/server.js"],
      data: { missingPath: "dist/mcp/server.js" }
    });
    findings.push({
      id: "finding.build.dist-entrypoint.missing",
      checkId: "build.dist-entrypoint",
      title: "Missing built entrypoint blocks extension runtime readiness",
      severity: "CRITICAL",
      status: "BLOCK",
      confidence: 0.94,
      impactedFiles: runtimeOrExtensionFiles,
      impactedAreas: ["blueprint-runtime"],
      owners: [],
      requiredActions: [
        "Run the build and restore dist/mcp/server.js before treating extension runtime readiness as known."
      ],
      evidenceRefs: [evidenceRef]
    });
  }

  if (hasRuntimeOrExtension && !hasRuntimeDistBundleCoverage) {
    const evidenceRef = addEvidence(evidence, {
      kind: "build",
      source: "dist-coverage",
      summary:
        "Runtime source or extension manifest changed without corresponding dist/** runtime bundle coverage.",
      paths: runtimeOrExtensionFiles,
      data: {
        changedDistFiles: distFiles,
        changedMcpRuntimeBundleFiles: mcpRuntimeBundleFiles,
        changedHookRuntimeBundleFiles: hookRuntimeBundleFiles,
        missingMcpRuntimeBundleCoverage,
        missingHookRuntimeBundleCoverage
      }
    });
    const reason =
      "Runtime source or extension manifest changes are in scope without corresponding dist/** runtime bundle coverage.";
    warnings.push(reason);
    findings.push({
      id: "finding.build.dist-coverage.missing",
      checkId: "build.dist-coverage",
      title: "Runtime changes require generated dist coverage",
      severity: "HIGH",
      status: "WARN",
      confidence: 0.78,
      impactedFiles: runtimeOrExtensionFiles,
      impactedAreas: ["blueprint-runtime"],
      owners: [],
      requiredActions: [
        "Run npm run build and include or verify generated dist output before relying on this impact report."
      ],
      evidenceRefs: [evidenceRef]
    });
    unknowns.push({
      id: "unknown.obligation.build-dist-coverage",
      category: "obligation",
      title: "Generated dist coverage is not proven",
      severity: "MEDIUM",
      impactedFiles: runtimeOrExtensionFiles,
      reason,
      resolution:
        "Run the build and review generated dist output provenance; this is a coverage gap, not a stale-content claim.",
      evidenceRefs: [evidenceRef]
    });
  }

  if (hasDistFiles && !hasRuntimeOrExtension) {
    const evidenceRef = addEvidence(evidence, {
      kind: "build",
      source: "generated-provenance",
      summary: "dist/** changed without runtime source or extension manifest coverage.",
      paths: distFiles
    });
    const reason =
      "Generated dist output changed without matching runtime source or extension manifest coverage in the analyzed scope.";
    warnings.push(reason);
    findings.push({
      id: "finding.build.generated-only.provenance",
      checkId: "build.generated-provenance",
      title: "Generated-only dist change requires provenance review",
      severity: "MEDIUM",
      status: "WARN",
      confidence: 0.76,
      impactedFiles: distFiles,
      impactedAreas: ["generated"],
      owners: [],
      requiredActions: [
        "Verify generated output provenance and confirm the source change is present or intentionally outside scope."
      ],
      evidenceRefs: [evidenceRef]
    });
    unknowns.push({
      id: "unknown.obligation.generated-dist-provenance",
      category: "obligation",
      title: "Generated dist provenance is not proven",
      severity: "MEDIUM",
      impactedFiles: distFiles,
      reason,
      resolution:
        "Review build provenance and source correspondence before relying on generated-only output.",
      evidenceRefs: [evidenceRef]
    });
  }

  if (hasDistFiles) {
    addObligation(obligations, evidence, {
      category: "build",
      title: "Generated output provenance must be verified",
      severity: "HIGH",
      impactedFiles: uniqueSorted([...runtimeOrExtensionFiles, ...distFiles]),
      sourceSurfaces: ["generated"],
      requiredActions: [
        "Verify dist/** output was generated from the intended source and extension runtime inputs."
      ],
      evidenceKind: "build",
      source: "generated-provenance"
    });
  }
}

async function analyzeContractAndObligations(
  projectRoot: string,
  files: string[],
  surfaces: ImpactSurfaceRecord[],
  providedContext: Record<string, unknown> | undefined,
  warnings: string[]
): Promise<{
  findings: ImpactFindingRecord[];
  obligations: ImpactObligationRecord[];
  unknowns: ImpactUnknownRecord[];
  evidence: ImpactEvidenceRecord[];
}> {
  const findings: ImpactFindingRecord[] = [];
  const obligations: ImpactObligationRecord[] = [];
  const unknowns: ImpactUnknownRecord[] = [];
  const evidence: ImpactEvidenceRecord[] = [];
  const phase6Context = await resolvePhase6Context(
    projectRoot,
    providedContext,
    surfaces,
    evidence,
    unknowns,
    warnings
  );

  addEvidence(evidence, {
    kind: "contract",
    source: phase6Context.provided ? "provided-context" : "live-readonly-context",
    summary:
      "Impact contract and obligation analysis consumed catalog, runtime, command asset, and artifact context where available.",
    paths: files.filter((file) => isContractLikeSurface(classifyImpactFile(file))),
    data: {
      catalogLoaded: phase6Context.catalog !== null,
      commandAssetsLoaded: phase6Context.commandAssets !== null,
      runtimeLoaded: phase6Context.runtime !== null,
      artifactContractsLoaded: phase6Context.artifactContracts !== null,
      contextProvided: phase6Context.provided
    }
  });

  analyzeImplementedCommandSubstrate(
    phase6Context.catalog,
    phase6Context.runtime,
    findings,
    evidence
  );
  analyzePlannedCommandExposure(
    files,
    phase6Context.catalog,
    phase6Context.commandAssets,
    findings,
    evidence
  );
  addSurfaceObligations(surfaces, obligations, evidence);
  await addBuildAndDistFindings(
    projectRoot,
    surfaces,
    findings,
    unknowns,
    obligations,
    evidence,
    warnings
  );

  return {
    findings: sortFindings(findings),
    obligations: sortObligations(obligations),
    unknowns: sortUnknownRecords(unknowns),
    evidence: sortEvidenceRecords(evidence)
  };
}

async function runGit(
  projectRoot: string,
  args: string[],
  options: { allowFailure?: boolean } = {}
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: projectRoot,
      timeout: GIT_COMMAND_TIMEOUT_MS,
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

async function isGitRepository(projectRoot: string): Promise<boolean> {
  const result = await runGit(projectRoot, ["rev-parse", "--is-inside-work-tree"], {
    allowFailure: true
  });
  return result.success && result.stdout.trim() === "true";
}

function parseNullSeparatedPaths(stdout: string): string[] {
  return [...new Set(stdout.split("\0").map((value) => value.trim()).filter(Boolean))].sort();
}

function parseNumstat(stdout: string): { additions: number | null; deletions: number | null } {
  let additions = 0;
  let deletions = 0;
  let sawBinary = false;

  for (const line of stdout.split(/\r?\n/u)) {
    const [rawAdditions, rawDeletions] = line.split("\t");

    if (!rawAdditions || !rawDeletions) {
      continue;
    }

    if (rawAdditions === "-" || rawDeletions === "-") {
      sawBinary = true;
      continue;
    }

    additions += Number.parseInt(rawAdditions, 10);
    deletions += Number.parseInt(rawDeletions, 10);
  }

  return {
    additions: sawBinary ? null : additions,
    deletions: sawBinary ? null : deletions
  };
}

function parsePorcelainPaths(stdout: string): string[] {
  const paths: string[] = [];

  for (const line of stdout.split(/\r?\n/u)) {
    if (line.trim().length === 0) {
      continue;
    }

    const status = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    const normalizedPath = rawPath.includes(" -> ")
      ? rawPath.split(" -> ").at(-1) ?? rawPath
      : rawPath;

    if (status === "??" || status[1] !== " ") {
      paths.push(normalizedPath.replace(/^"|"$/gu, ""));
    }
  }

  return paths;
}

function assertSafeGitRevision(value: string, label: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} must not be blank.`);
  }

  if (trimmed.includes("\0") || trimmed.startsWith("-")) {
    throw new Error(`${label} is not a safe git revision: ${value}`);
  }

  return trimmed;
}

async function resolveGitDiffMetadata(
  projectRoot: string,
  kind: Exclude<ImpactScopeKind, "unresolved" | "files" | "diff-file" | "description">,
  diffArgs: string[],
  hashSeed: Record<string, unknown>
): Promise<DiffMetadata> {
  const nameResult = await runGit(
    projectRoot,
    ["diff", "--name-only", "-z", "--diff-filter=ACMRTUXB", ...diffArgs],
    { allowFailure: true }
  );

  if (!nameResult.success) {
    return {
      changedFiles: [],
      additions: null,
      deletions: null,
      patchHash: null
    };
  }

  let changedFiles = parseNullSeparatedPaths(nameResult.stdout);
  const numstatResult = await runGit(projectRoot, ["diff", "--numstat", ...diffArgs], {
    allowFailure: true
  });
  const stats = numstatResult.success
    ? parseNumstat(numstatResult.stdout)
    : { additions: null, deletions: null };

  if (kind === "working-tree") {
    const statusResult = await runGit(projectRoot, ["status", "--porcelain=v1"], {
      allowFailure: true
    });
    const workingTreeOnlyPaths = statusResult.success
      ? parsePorcelainPaths(statusResult.stdout)
      : [];
    changedFiles = [...new Set([...changedFiles, ...workingTreeOnlyPaths])].sort();
  }

  return {
    changedFiles,
    additions: stats.additions,
    deletions: stats.deletions,
    patchHash:
      changedFiles.length > 0
        ? stableHash({
            ...hashSeed,
            changedFiles,
            additions: stats.additions,
            deletions: stats.deletions
          })
        : null
  };
}

function parseDiffFilePaths(rawDiff: string): string[] {
  const paths: string[] = [];

  for (const line of rawDiff.split(/\r?\n/u)) {
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git "?a\/(.+?)"? "?b\/(.+?)"?$/u.exec(line);

      if (match?.[2] && match[2] !== "/dev/null") {
        paths.push(match[2]);
      }

      continue;
    }

    if (line.startsWith("+++ ")) {
      const nextPath = line.slice(4).trim();

      if (nextPath !== "/dev/null") {
        paths.push(nextPath.replace(/^"?(?:b\/)?(.+?)"?$/u, "$1"));
      }
    }
  }

  return [...new Set(paths)].sort();
}

function parseDiffFileStats(rawDiff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const line of rawDiff.split(/\r?\n/u)) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }

    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

function confidenceForScope(
  kind: ImpactScopeKind,
  changedFiles: string[],
  warnings: string[]
): ImpactConfidence {
  if (kind === "description") {
    return {
      score: 0.2,
      level: "low",
      reasons: [
        "Description-only impact scope has no proven file or git evidence.",
        "Description-only scope cannot produce a high-confidence PASS."
      ]
    };
  }

  if (changedFiles.length === 0) {
    return {
      score: 0,
      level: "low",
      reasons: ["No changed files were resolved for impact analysis."]
    };
  }

  if (warnings.length > 0) {
    return {
      score: 0.72,
      level: "medium",
      reasons: ["Scope is file-backed, but one or more resolution warnings remain."]
    };
  }

  return {
    score: kind === "files" ? 0.76 : 0.86,
    level: "high",
    reasons:
      kind === "files"
        ? ["Explicit file scope was provided and path-containment checks passed."]
        : ["Git-backed scope resolved changed files and deterministic diff metadata."]
  };
}

function unresolvedScopeResult(
  mode: ImpactScopeMode,
  description: string | null,
  warnings: string[],
  seed: Record<string, unknown>
): ImpactScopeResolveResult {
  return {
    status: "unresolved",
    scope: {
      kind: "unresolved",
      description,
      files: [],
      source: "unresolved"
    },
    changedFiles: [],
    git: {
      mode,
      range: null,
      base: null,
      head: null
    },
    diffStats: {
      filesChanged: 0,
      additions: null,
      deletions: null
    },
    patchHash: null,
    scopeFingerprint: stableHash(seed),
    confidence: confidenceForScope("unresolved", [], warnings),
    warnings
  };
}

async function detectDefaultBaseRef(projectRoot: string): Promise<string | null> {
  for (const baseBranch of BUILT_IN_BASE_BRANCHES) {
    const localResult = await runGit(
      projectRoot,
      ["rev-parse", "--verify", `${baseBranch}^{commit}`],
      { allowFailure: true }
    );

    if (localResult.success) {
      return baseBranch;
    }

    const remoteResult = await runGit(
      projectRoot,
      ["rev-parse", "--verify", `origin/${baseBranch}^{commit}`],
      { allowFailure: true }
    );

    if (remoteResult.success) {
      return `origin/${baseBranch}`;
    }
  }

  const originHead = await runGit(
    projectRoot,
    ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
    { allowFailure: true }
  );

  return originHead.success ? originHead.stdout.trim() : null;
}

async function resolveAutoGitScope(
  projectRoot: string
): Promise<
  | {
      kind: "staged" | "working-tree" | "range" | "base-head";
      diffArgs: string[];
      range: string | null;
      base: string | null;
      head: string | null;
      source: string;
    }
  | null
> {
  const staged = await resolveGitDiffMetadata(projectRoot, "staged", ["--cached", "--"], {
    kind: "staged"
  });

  if (staged.changedFiles.length > 0) {
    return {
      kind: "staged",
      diffArgs: ["--cached", "--"],
      range: null,
      base: null,
      head: null,
      source: "git-staged"
    };
  }

  const workingTree = await resolveGitDiffMetadata(projectRoot, "working-tree", ["--"], {
    kind: "working-tree"
  });

  if (workingTree.changedFiles.length > 0) {
    return {
      kind: "working-tree",
      diffArgs: ["--"],
      range: null,
      base: null,
      head: null,
      source: "git-working-tree"
    };
  }

  const currentBranch = await runGit(projectRoot, ["branch", "--show-current"], {
    allowFailure: true
  });
  const baseRef = await detectDefaultBaseRef(projectRoot);
  const branchName = currentBranch.success ? currentBranch.stdout.trim() : "";

  if (baseRef && branchName && !BUILT_IN_BASE_BRANCHES.includes(branchName as "main" | "master")) {
    return {
      kind: "base-head",
      diffArgs: [`${baseRef}..HEAD`, "--"],
      range: null,
      base: baseRef,
      head: "HEAD",
      source: "git-current-branch"
    };
  }

  if (process.env.GITHUB_BASE_REF && process.env.GITHUB_HEAD_REF) {
    return {
      kind: "base-head",
      diffArgs: [`${process.env.GITHUB_BASE_REF}..${process.env.GITHUB_HEAD_REF}`, "--"],
      range: null,
      base: process.env.GITHUB_BASE_REF,
      head: process.env.GITHUB_HEAD_REF,
      source: "ci-pr-refs"
    };
  }

  if (
    process.env.CI &&
    (await runGit(projectRoot, ["rev-parse", "--verify", "HEAD^"], {
      allowFailure: true
    })).success
  ) {
    return {
      kind: "range",
      diffArgs: ["HEAD^..HEAD", "--"],
      range: "HEAD^..HEAD",
      base: null,
      head: null,
      source: "ci-head-parent"
    };
  }

  return null;
}

async function loadSeededScopeArgs(
  projectRoot: string,
  args: ImpactScopeResolveArgs
): Promise<ImpactScopeResolveArgs> {
  if (!args.seedFile) {
    return args;
  }

  const seedPath = resolveContainedInputPath(projectRoot, args.seedFile, "Impact seed file");
  const parsed = safeJsonParseObject(await fs.readFile(seedPath, "utf8"), {
    label: "Impact seed file"
  });
  const seedResult = impactScopeSeedSchema.safeParse(parsed);

  if (!seedResult.success) {
    throw new Error(
      formatZodIssues("Invalid impact seed file:", seedResult.error).join(" ")
    );
  }

  return {
    ...seedResult.data,
    ...args,
    meta: {
      ...(seedResult.data.meta ?? {}),
      ...(args.meta ?? {})
    }
  };
}

export async function blueprintImpactConfigGet(
  args: ImpactConfigGetArgs = {}
): Promise<ImpactConfigGetResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const strictConfig = args.strictConfig ?? false;
  const config = cloneConfig(getBuiltInImpactConfig()) as unknown as Record<string, unknown>;
  const warnings: string[] = [];
  const errors: string[] = [];
  const layersApplied = ["built-in"];
  const defaultsPath = getImpactDefaultsPath();
  const projectConfigPath = path.join(projectRoot, IMPACT_PROJECT_CONFIG_PATH);
  let appliedDefaultsPath: string | null = null;
  let appliedProjectPath: string | null = null;
  let appliedInvocationPath: string | null = null;

  const defaultsLayer = await readConfigLayer(
    defaultsPath,
    "Impact host-global defaults",
    warnings,
    errors
  );

  if (defaultsLayer) {
    if (
      applyConfigLayer(
        config,
        defaultsLayer,
        "host-global defaults",
        strictConfig,
        warnings,
        errors
      )
    ) {
      layersApplied.push("host-global-defaults");
      appliedDefaultsPath = defaultsPath;
    }
  } else {
    warnings.push(
      `No host-global impact defaults found at ${defaultsPath}; using built-in safe defaults for that layer.`
    );
  }

  const projectLayer = await readConfigLayer(
    projectConfigPath,
    "Project impact config",
    warnings,
    errors
  );

  if (projectLayer) {
    if (
      applyConfigLayer(config, projectLayer, "project config", strictConfig, warnings, errors)
    ) {
      layersApplied.push("project");
      appliedProjectPath = toRepoRelativePath(projectRoot, projectConfigPath);
    }
  } else {
    warnings.push(
      `No project impact config found at ${IMPACT_PROJECT_CONFIG_PATH}; using built-in safe defaults for that layer.`
    );
  }

  if (args.configPath) {
    const invocationPath = resolveContainedInputPath(
      projectRoot,
      args.configPath,
      "Invocation impact config path"
    );
    const invocationLayer = await readConfigLayer(
      invocationPath,
      "Invocation impact config",
      warnings,
      errors
    );

    if (invocationLayer) {
      if (
        applyConfigLayer(
          config,
          invocationLayer,
          "invocation config",
          strictConfig,
          warnings,
          errors
        )
      ) {
        layersApplied.push("invocation");
        appliedInvocationPath = toRepoRelativePath(projectRoot, invocationPath);
      }
    } else {
      errors.push(`Invocation impact config was not found: ${args.configPath}`);
    }
  }

  if (args.overrides && Object.keys(args.overrides).length > 0) {
    if (
      applyConfigLayer(
        config,
        args.overrides,
        "invocation overrides",
        strictConfig,
        warnings,
        errors
      )
    ) {
      layersApplied.push("overrides");
    }
  }

  const effectiveConfig = validateFinalImpactConfig(config, errors);

  if (errors.length === 0) {
    warnings.push("Impact config loaded successfully through the Phase 3 config resolver.");
  }

  return {
    status: errors.length === 0 ? "ok" : "invalid",
    config: effectiveConfig,
    provenance: {
      layersApplied,
      defaultsPath: appliedDefaultsPath,
      projectPath: appliedProjectPath,
      invocationPath: appliedInvocationPath
    },
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
    configHash: stableHash(effectiveConfig)
  };
}

async function resolveFilesScope(
  projectRoot: string,
  args: ImpactScopeResolveArgs,
  mode: ImpactScopeMode,
  description: string | null,
  warnings: string[]
): Promise<ImpactScopeResolveResult> {
  const files = [
    ...new Set(
      (args.files ?? []).map((file) =>
        toRepoRelativeInputPath(projectRoot, file, "Impact file")
      )
    )
  ].sort();
  const nextWarnings =
    files.length > 0
      ? warnings
      : [...warnings, "Explicit files mode did not include any files to analyze."];

  return {
    status: files.length > 0 ? "resolved" : "unresolved",
    scope: {
      kind: "files",
      description,
      files,
      source: "explicit-files"
    },
    changedFiles: files,
    git: {
      mode,
      range: null,
      base: null,
      head: null
    },
    diffStats: {
      filesChanged: files.length,
      additions: null,
      deletions: null
    },
    patchHash: files.length > 0 ? stableHash({ mode: "files", files }) : null,
    scopeFingerprint: stableHash({
      mode: "files",
      description,
      files,
      phase: args.phase ?? null,
      roadmapItem: args.roadmapItem ?? null,
      meta: args.meta ?? {}
    }),
    confidence: confidenceForScope("files", files, nextWarnings),
    warnings: nextWarnings
  };
}

async function resolveDiffFileScope(
  projectRoot: string,
  args: ImpactScopeResolveArgs,
  mode: ImpactScopeMode,
  description: string | null,
  warnings: string[]
): Promise<ImpactScopeResolveResult> {
  if (!args.diffFile) {
    return unresolvedScopeResult(
      mode,
      description,
      [...warnings, "diff-file scope requires a diffFile path."],
      { mode, description, reason: "missing-diff-file" }
    );
  }

  const diffPath = resolveContainedInputPath(projectRoot, args.diffFile, "Impact diff file");
  const rawDiff = await fs.readFile(diffPath, "utf8");
  const files = parseDiffFilePaths(rawDiff)
    .map((file) => toRepoRelativeInputPath(projectRoot, file, "Impact diff path"))
    .sort();
  const stats = parseDiffFileStats(rawDiff);
  const diffFileRelativePath = toRepoRelativePath(projectRoot, diffPath);
  const nextWarnings =
    files.length > 0
      ? warnings
      : [...warnings, "Diff file did not expose changed file paths."];

  return {
    status: files.length > 0 ? "resolved" : "unresolved",
    scope: {
      kind: "diff-file",
      description,
      files,
      source: diffFileRelativePath
    },
    changedFiles: files,
    git: {
      mode,
      range: null,
      base: null,
      head: null
    },
    diffStats: {
      filesChanged: files.length,
      additions: stats.additions,
      deletions: stats.deletions
    },
    patchHash:
      files.length > 0
        ? stableHash({
            mode: "diff-file",
            diffFile: diffFileRelativePath,
            byteLength: Buffer.byteLength(rawDiff, "utf8"),
            files,
            additions: stats.additions,
            deletions: stats.deletions
          })
        : null,
    scopeFingerprint: stableHash({
      mode: "diff-file",
      description,
      diffFile: diffFileRelativePath,
      files,
      phase: args.phase ?? null,
      roadmapItem: args.roadmapItem ?? null,
      meta: args.meta ?? {}
    }),
    confidence: confidenceForScope("diff-file", files, nextWarnings),
    warnings: nextWarnings
  };
}

function resolveDescriptionScope(
  args: ImpactScopeResolveArgs,
  mode: ImpactScopeMode,
  description: string | null,
  warnings: string[]
): ImpactScopeResolveResult {
  const nextWarnings = [
    ...warnings,
    "Description-only impact scope is low confidence because no changed files or git evidence were resolved.",
    "Description-only scope cannot be marked as a high-confidence PASS."
  ];
  const fingerprintSeed = {
    mode: "description",
    description,
    phase: args.phase ?? null,
    roadmapItem: args.roadmapItem ?? null,
    meta: args.meta ?? {}
  };

  return {
    status: "resolved",
    scope: {
      kind: "description",
      description,
      files: [],
      source: "description-only"
    },
    changedFiles: [],
    git: {
      mode,
      range: null,
      base: null,
      head: null
    },
    diffStats: {
      filesChanged: 0,
      additions: null,
      deletions: null
    },
    patchHash: stableHash(fingerprintSeed),
    scopeFingerprint: stableHash(fingerprintSeed),
    confidence: confidenceForScope("description", [], nextWarnings),
    warnings: nextWarnings
  };
}

async function resolveGitBackedScope(
  projectRoot: string,
  args: ImpactScopeResolveArgs,
  mode: ImpactScopeMode,
  kind: Exclude<ImpactScopeKind, "unresolved" | "files" | "diff-file" | "description">,
  diffArgs: string[],
  git: { range: string | null; base: string | null; head: string | null },
  source: string,
  description: string | null,
  warnings: string[]
): Promise<ImpactScopeResolveResult> {
  const metadata = await resolveGitDiffMetadata(projectRoot, kind, diffArgs, {
    kind,
    git
  });
  const nextWarnings =
    metadata.changedFiles.length > 0
      ? warnings
      : [...warnings, `No changed files were found for ${kind} scope.`];

  return {
    status: metadata.changedFiles.length > 0 ? "resolved" : "unresolved",
    scope: {
      kind,
      description,
      files: metadata.changedFiles,
      source
    },
    changedFiles: metadata.changedFiles,
    git: {
      mode,
      range: git.range,
      base: git.base,
      head: git.head
    },
    diffStats: {
      filesChanged: metadata.changedFiles.length,
      additions: metadata.additions,
      deletions: metadata.deletions
    },
    patchHash: metadata.patchHash,
    scopeFingerprint: stableHash({
      mode,
      kind,
      source,
      description,
      files: metadata.changedFiles,
      git,
      phase: args.phase ?? null,
      roadmapItem: args.roadmapItem ?? null,
      meta: args.meta ?? {}
    }),
    confidence: confidenceForScope(kind, metadata.changedFiles, nextWarnings),
    warnings: nextWarnings
  };
}

async function resolveScopeWithGit(
  projectRoot: string,
  args: ImpactScopeResolveArgs,
  mode: ImpactScopeMode,
  description: string | null,
  warnings: string[]
): Promise<ImpactScopeResolveResult> {
  if (mode === "staged") {
    return resolveGitBackedScope(
      projectRoot,
      args,
      mode,
      "staged",
      ["--cached", "--"],
      { range: null, base: null, head: null },
      "git-staged",
      description,
      warnings
    );
  }

  if (mode === "working-tree") {
    return resolveGitBackedScope(
      projectRoot,
      args,
      mode,
      "working-tree",
      ["--"],
      { range: null, base: null, head: null },
      "git-working-tree",
      description,
      warnings
    );
  }

  if (mode === "range") {
    if (!args.range) {
      return unresolvedScopeResult(
        mode,
        description,
        [...warnings, "range scope requires a range value."],
        { mode, description, reason: "missing-range" }
      );
    }

    const range = assertSafeGitRevision(args.range, "Impact git range");
    return resolveGitBackedScope(
      projectRoot,
      args,
      mode,
      "range",
      [range, "--"],
      { range, base: null, head: null },
      "git-range",
      description,
      warnings
    );
  }

  if (mode === "base-head") {
    if (!args.base || !args.head) {
      return unresolvedScopeResult(
        mode,
        description,
        [...warnings, "base-head scope requires both base and head values."],
        { mode, description, reason: "missing-base-head" }
      );
    }

    const base = assertSafeGitRevision(args.base, "Impact base ref");
    const head = assertSafeGitRevision(args.head, "Impact head ref");
    return resolveGitBackedScope(
      projectRoot,
      args,
      mode,
      "base-head",
      [`${base}..${head}`, "--"],
      { range: null, base, head },
      "git-base-head",
      description,
      warnings
    );
  }

  const autoScope = await resolveAutoGitScope(projectRoot);

  if (autoScope) {
    return resolveGitBackedScope(
      projectRoot,
      args,
      mode,
      autoScope.kind,
      autoScope.diffArgs,
      {
        range: autoScope.range,
        base: autoScope.base,
        head: autoScope.head
      },
      autoScope.source,
      description,
      warnings
    );
  }

  if (description) {
    return resolveDescriptionScope(args, mode, description, warnings);
  }

  return unresolvedScopeResult(
    mode,
    description,
    [...warnings, "No staged, working-tree, branch, CI, or description scope could be resolved."],
    { mode, description, reason: "no-auto-scope" }
  );
}

export async function blueprintImpactScopeResolve(
  args: ImpactScopeResolveArgs = {}
): Promise<ImpactScopeResolveResult> {
  const initialProjectRoot = getProjectRoot(args.cwd);
  const hasGit = await isGitRepository(initialProjectRoot);
  const projectRoot = hasGit ? await ensureRepoRoot(args.cwd) : initialProjectRoot;
  const seededArgs = await loadSeededScopeArgs(projectRoot, args);
  const mode = seededArgs.mode ?? "auto";
  const description = seededArgs.description?.trim() || null;
  const warnings: string[] = [];

  if (!hasGit) {
    warnings.push("No git repository was detected for scope resolution.");
  }

  if (mode === "files" || (mode === "auto" && seededArgs.files?.length)) {
    return resolveFilesScope(projectRoot, seededArgs, mode, description, warnings);
  }

  if (mode === "diff-file" || (mode === "auto" && seededArgs.diffFile)) {
    return resolveDiffFileScope(projectRoot, seededArgs, mode, description, warnings);
  }

  if (mode === "description") {
    return resolveDescriptionScope(seededArgs, mode, description, warnings);
  }

  if (!hasGit) {
    if (description) {
      return resolveDescriptionScope(seededArgs, mode, description, warnings);
    }

    return unresolvedScopeResult(
      mode,
      description,
      [...warnings, "A git-backed scope was requested, but this directory is not a git repository."],
      { mode, description, reason: "not-git-repository" }
    );
  }

  if (mode === "auto" && seededArgs.range) {
    return resolveScopeWithGit(projectRoot, seededArgs, "range", description, warnings);
  }

  if (mode === "auto" && seededArgs.base && seededArgs.head) {
    return resolveScopeWithGit(projectRoot, seededArgs, "base-head", description, warnings);
  }

  return resolveScopeWithGit(projectRoot, seededArgs, mode, description, warnings);
}

async function readPackageMetadata(projectRoot: string): Promise<ImpactPackageMetadata> {
  const packageJsonPath = path.join(projectRoot, "package.json");

  if (!(await pathExists(packageJsonPath))) {
    return {
      loaded: false,
      name: null,
      version: null,
      scripts: [],
      packageManager: null,
      warnings: ["No package.json found; package runtime hints are unavailable."],
      partial: false
    };
  }

  try {
    const parsed = safeJsonParseObject(await fs.readFile(packageJsonPath, "utf8"), {
      label: "package.json"
    }) as PackageJsonLike;
    const scripts = isPlainObject(parsed.scripts)
      ? Object.keys(parsed.scripts).sort()
      : [];

    return {
      loaded: true,
      name: typeof parsed.name === "string" ? parsed.name : null,
      version: typeof parsed.version === "string" ? parsed.version : null,
      scripts,
      packageManager:
        typeof parsed.packageManager === "string" ? parsed.packageManager : null,
      warnings: [],
      partial: false
    };
  } catch (error) {
    return {
      loaded: false,
      name: null,
      version: null,
      scripts: [],
      packageManager: null,
      warnings: [
        `Could not parse package.json for impact repo hints: ${
          error instanceof Error ? error.message : String(error)
        }`
      ],
      partial: true
    };
  }
}

async function listExistingTopLevelPaths(
  projectRoot: string,
  candidates: string[]
): Promise<string[]> {
  const existing: string[] = [];

  for (const candidate of candidates) {
    if (await pathExists(path.join(projectRoot, candidate))) {
      existing.push(candidate);
    }
  }

  return existing.sort();
}

async function loadRepoHints(
  projectRoot: string,
  artifactContractsLoaded: boolean
): Promise<{ repoHints: ImpactRepoHints; warnings: string[]; partial: boolean }> {
  const packageMetadata = await readPackageMetadata(projectRoot);
  const testPaths = await listExistingTopLevelPaths(projectRoot, [
    "tests",
    "test",
    "src/__tests__"
  ]);
  const docsPaths = await listExistingTopLevelPaths(projectRoot, [
    "docs",
    "README.md",
    "CHANGELOG.md"
  ]);
  const sourceRoots = await listExistingTopLevelPaths(projectRoot, [
    "src",
    "lib",
    "packages",
    "apps"
  ]);

  return {
    repoHints: {
      cwdAccepted: true,
      packageMetadataLoaded: packageMetadata.loaded,
      packageJsonPath: packageMetadata.loaded ? "package.json" : null,
      packageName: packageMetadata.name,
      packageVersion: packageMetadata.version,
      packageScripts: packageMetadata.scripts,
      packageManager: packageMetadata.packageManager,
      testPaths,
      docsPaths,
      sourceRoots,
      artifactContractsLoaded
    },
    warnings: packageMetadata.warnings,
    partial: packageMetadata.partial
  };
}

function normalizeRoadmapItem(value: string | number): string {
  return String(value).trim().toLowerCase();
}

function getRoadmapPhases(
  roadmap: Awaited<ReturnType<typeof blueprintRoadmapRead>> | null
): RoadmapPhaseLike[] {
  return (roadmap?.phases ?? []).map((phase) => ({
    phaseNumber: phase.phaseNumber,
    phaseName: phase.phaseName,
    requirements: phase.requirements
  }));
}

function matchRoadmapItem(
  roadmap: Awaited<ReturnType<typeof blueprintRoadmapRead>> | null,
  roadmapItem: string
): RoadmapPhaseLike[] {
  const normalizedItem = normalizeRoadmapItem(roadmapItem);

  return getRoadmapPhases(roadmap).filter((phase) => {
    if (normalizeRoadmapItem(phase.phaseNumber) === normalizedItem) {
      return true;
    }

    if (normalizeRoadmapItem(phase.phaseName) === normalizedItem) {
      return true;
    }

    return phase.requirements.some(
      (requirement) => normalizeRoadmapItem(requirement) === normalizedItem
    );
  });
}

function comparePhaseNumbers(left: string, right: string): number {
  const leftNumber = Number.parseFloat(left);
  const rightNumber = Number.parseFloat(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, undefined, { numeric: true });
}

function mergePhaseContextEntry(
  entries: Map<string, ImpactPhaseContextEntry>,
  context: Awaited<ReturnType<typeof blueprintPhaseContext>>,
  requestedBy: string
): void {
  if (!context.phase) {
    return;
  }

  const existing = entries.get(context.phase.phaseNumber);

  if (existing) {
    existing.requestedBy = [...new Set([...existing.requestedBy, requestedBy])].sort();
    existing.warnings = [...new Set([...existing.warnings, ...context.warnings])].sort();
    return;
  }

  entries.set(context.phase.phaseNumber, {
    phaseNumber: context.phase.phaseNumber,
    phaseName: context.phase.phaseName,
    requestedBy: [requestedBy],
    context,
    warnings: [...new Set(context.warnings)].sort()
  });
}

async function loadRequestedPhaseContexts(
  projectRoot: string,
  args: ImpactContextLoadArgs,
  roadmap: Awaited<ReturnType<typeof blueprintRoadmapRead>> | null,
  warnings: string[]
): Promise<{ phases: ImpactPhaseContextEntry[]; partial: boolean }> {
  const entries = new Map<string, ImpactPhaseContextEntry>();
  let partial = false;

  if (args.phase !== undefined) {
    try {
      const context = await blueprintPhaseContext({ cwd: projectRoot, phase: args.phase });

      if (context.phase) {
        mergePhaseContextEntry(entries, context, "phase");
      } else {
        partial = true;
        warnings.push(
          `Requested impact phase target could not be resolved: ${String(args.phase)}.`
        );
        warnings.push(...context.warnings);
      }
    } catch (error) {
      partial = true;
      warnings.push(
        `Requested impact phase target could not be loaded: ${String(args.phase)} (${
          error instanceof Error ? error.message : String(error)
        }).`
      );
    }
  }

  if (args.roadmapItem !== undefined) {
    const matches = matchRoadmapItem(roadmap, args.roadmapItem);

    if (matches.length === 0) {
      partial = true;
      warnings.push(
        `Requested impact roadmapItem could not be resolved from phase number, phase name, or requirement id: ${args.roadmapItem}.`
      );
    }

    for (const match of matches) {
      try {
        const context = await blueprintPhaseContext({
          cwd: projectRoot,
          phase: match.phaseNumber
        });

        if (context.phase) {
          mergePhaseContextEntry(entries, context, "roadmapItem");
        } else {
          partial = true;
          warnings.push(
            `Requested impact roadmapItem matched phase ${match.phaseNumber}, but phase context could not be loaded.`
          );
          warnings.push(...context.warnings);
        }
      } catch (error) {
        partial = true;
        warnings.push(
          `Requested impact roadmapItem matched phase ${match.phaseNumber}, but phase context failed to load (${
            error instanceof Error ? error.message : String(error)
          }).`
        );
      }
    }
  }

  return {
    phases: [...entries.values()].sort((left, right) =>
      comparePhaseNumbers(left.phaseNumber, right.phaseNumber)
    ),
    partial
  };
}

function buildCommandAssets(catalog: unknown): ImpactCommandAssets {
  const commands = (catalog as CommandCatalogLike).commands ?? {};
  const entries = Object.entries(commands);
  const manifestPaths = entries
    .map(([, entry]) => entry.manifestPath)
    .filter((value): value is string => typeof value === "string")
    .sort();
  const specPaths = entries
    .map(([, entry]) => entry.specPath)
    .filter((value): value is string => typeof value === "string")
    .sort();
  const skillPaths = entries
    .map(([, entry]) => entry.skillPath)
    .filter((value): value is string => typeof value === "string")
    .sort();
  const implementedCommands = entries
    .filter(([, entry]) => entry.implemented === true)
    .map(([command]) => command)
    .sort();
  const nonRoutableCommands = entries
    .filter(([, entry]) => entry.implemented !== true)
    .map(([command]) => command)
    .sort();
  const missingAssetCount = entries.reduce(
    (count, [, entry]) =>
      count +
      extractBlockedBy(entry).filter((blockedBy) => blockedBy.startsWith("Missing ")).length,
    0
  );

  return {
    commandCount: entries.length,
    implementedCommands,
    nonRoutableCommands,
    manifestPaths,
    specPaths,
    skillPaths,
    missingAssetCount,
    impact: commands.impact ?? null
  };
}

async function loadProjectStatus(projectRoot: string): Promise<unknown> {
  const projectModule = (await import("./project.js")) as {
    blueprintProjectStatus: (args?: { cwd?: string }) => Promise<unknown>;
  };

  return projectModule.blueprintProjectStatus({ cwd: projectRoot });
}

async function loadCommandCatalog(): Promise<unknown> {
  const projectModule = (await import("./project.js")) as {
    blueprintCommandCatalog: () => Promise<unknown>;
  };

  return projectModule.blueprintCommandCatalog();
}

export async function blueprintImpactContextLoad(
  args: ImpactContextLoadArgs = {}
): Promise<ImpactContextLoadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const includeRuntime = args.includeRuntime ?? true;
  const includeCatalog = args.includeCatalog ?? true;
  const includeArtifacts = args.includeArtifacts ?? true;
  const warnings: string[] = [];
  let partial = false;
  let project: unknown | null = null;
  let config: Awaited<ReturnType<typeof blueprintConfigGet>> | null = null;
  let roadmap: Awaited<ReturnType<typeof blueprintRoadmapRead>> | null = null;
  let catalog: unknown | undefined;
  let commandAssets: ImpactCommandAssets | undefined;
  let artifactContracts: ReturnType<typeof listArtifactContracts> | undefined;
  let runtime: ImpactRuntimeContext | undefined;

  try {
    project = await loadProjectStatus(projectRoot);
  } catch (error) {
    partial = true;
    warnings.push(
      `Blueprint project status could not be loaded for impact context: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  try {
    config = await blueprintConfigGet({ cwd: projectRoot, scope: "effective" });
    warnings.push(...config.warnings);
  } catch (error) {
    partial = true;
    warnings.push(
      `Blueprint config could not be loaded for impact context: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  try {
    roadmap = await blueprintRoadmapRead({ cwd: projectRoot });
    warnings.push(...roadmap.warnings);
  } catch (error) {
    partial = true;
    warnings.push(
      `Blueprint roadmap could not be loaded for impact context: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (includeCatalog) {
    try {
      catalog = await loadCommandCatalog();
      commandAssets = buildCommandAssets(catalog);
    } catch (error) {
      partial = true;
      warnings.push(
        `Blueprint command catalog could not be loaded for impact context: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  } else {
    warnings.push(
      "includeCatalog=false; command catalog and command asset context omitted by request."
    );
  }

  if (includeArtifacts) {
    try {
      artifactContracts = listArtifactContracts();
    } catch (error) {
      partial = true;
      warnings.push(
        `Blueprint artifact contracts could not be loaded for impact context: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  } else {
    warnings.push("includeArtifacts=false; artifact contract context omitted by request.");
  }

  if (includeRuntime) {
    runtime = {
      registeredTools: allRegisteredRuntimeToolNames(),
      registeredImpactTools: [...IMPACT_TOOL_NAMES],
      implementationPhase: 11,
      readOnly: true,
      includeRuntime,
      includeCatalog,
      includeArtifacts
    };
  } else {
    warnings.push("includeRuntime=false; runtime metadata omitted by request.");
  }

  const requestedPhases = await loadRequestedPhaseContexts(
    projectRoot,
    args,
    roadmap,
    warnings
  );
  partial ||= requestedPhases.partial;

  const repoHintsResult = await loadRepoHints(projectRoot, artifactContracts !== undefined);
  partial ||= repoHintsResult.partial;
  warnings.push(...repoHintsResult.warnings);

  return {
    status: partial ? "partial" : "loaded",
    project,
    config,
    roadmap,
    phases: requestedPhases.phases,
    ...(catalog !== undefined ? { catalog } : {}),
    ...(commandAssets !== undefined ? { commandAssets } : {}),
    ...(artifactContracts !== undefined ? { artifactContracts } : {}),
    ...(runtime !== undefined ? { runtime } : {}),
    repoHints: repoHintsResult.repoHints,
    warnings: [...new Set(warnings)].sort()
  };
}

export async function blueprintImpactAnalyze(
  args: ImpactAnalyzeArgs = {}
): Promise<ImpactAnalyzeResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const warnings: string[] = [];
  const config = resolveAnalyzeImpactConfig(args.config, warnings);
  const sources = collectAnalyzeFileSources(args);
  const files = normalizeAnalyzeFileSources(projectRoot, sources, warnings);
  const surfaces = files.map((file) => classifyImpactFile(file));
  const areaSummary = buildAreaSummary(surfaces);
  const surfaceSummary = buildSurfaceSummary(surfaces);
  const evidence: ImpactEvidenceRecord[] = [];
  const analysisUnknowns: ImpactUnknownRecord[] = [];

  if (sources.length === 0) {
    warnings.push(
      "No changed files were provided to impact analysis; ownership, dependency, contract, obligation, and scoring analysis has no file-backed surfaces."
    );
  }

  const reportScope = buildReportScope(args, files, warnings);
  const scopeEvidenceRef = addEvidence(evidence, {
    kind: "scope",
    source: "impact-analyze-scope",
    summary:
      files.length === 0
        ? "No file-backed scope was provided to impact analysis."
        : "Impact analysis consumed normalized scope provenance and file-backed changed paths.",
    paths: files,
    data: {
      scopeKind: reportScope.kind,
      scopeSource: reportScope.source,
      scopeFingerprint: reportScope.fingerprint,
      fileCount: files.length
    }
  });

  if (files.length === 0) {
    analysisUnknowns.push({
      id: "unknown.scope.file-backed",
      category: "scope",
      title: "Impact scope is not file-backed",
      severity: "HIGH",
      impactedFiles: [],
      reason:
        "Impact analysis did not receive changed files from git, explicit files, a diff file, or another file-backed seed.",
      resolution:
        "Resolve scope with --staged, --working-tree, --range, --base/--head, --files, --diff-file, or a seed containing changed files.",
      evidenceRefs: [scopeEvidenceRef]
    });
  }

  addEvidence(evidence, {
    kind: "surface",
    source: "impact-surface-classifier",
    summary: "Changed files were classified into deterministic multi-label impact surfaces.",
    paths: files,
    data: {
      fileCount: files.length,
      areaCount: areaSummary.length,
      surfaceCount: surfaceSummary.length
    }
  });

  addEvidence(evidence, {
    kind: "config",
    source: "impact-analyze-config",
    summary: "Impact analysis resolved effective ownership, dependency, risk, and reporting configuration.",
    paths: [],
    data: {
      ownershipSources: config.ownership.sources,
      dependencySources: config.dependencyGraph.sources,
      customGraphFiles: config.dependencyGraph.customGraphFiles,
      risk: config.risk
    }
  });

  const ownershipResult = await loadOwnershipAnalysis(
    projectRoot,
    files,
    surfaces,
    config,
    warnings
  );
  const dependencyResult = await loadDependencyAnalysis(
    projectRoot,
    files,
    surfaces,
    config,
    warnings
  );
  const contractResult = await analyzeContractAndObligations(
    projectRoot,
    files,
    surfaces,
    args.context,
    warnings
  );
  const findings = sortFindings([...ownershipResult.findings, ...contractResult.findings]);
  const obligations = sortObligations(contractResult.obligations);
  const unknowns = sortUnknownRecords([
    ...analysisUnknowns,
    ...ownershipResult.unknowns,
    ...dependencyResult.unknowns,
    ...contractResult.unknowns
  ]);
  const scoringResult = scoreImpactAnalysis({
    config,
    scope: reportScope,
    files,
    warnings,
    surfaces,
    areaSummary,
    ownership: ownershipResult.ownership,
    dependencyGraph: dependencyResult.dependencyGraph,
    findings,
    obligations,
    unknowns
  });
  addEvidence(evidence, {
    kind: "metadata",
    source: "impact-scoring",
    summary:
      "Impact scoring separated impact status, risk level, confidence score, and confidence level.",
    paths: files,
    data: {
      status: scoringResult.status,
      riskLevel: scoringResult.risk.level,
      confidenceScore: scoringResult.confidence.score,
      confidenceLevel: scoringResult.confidence.level,
      maxSeverity: scoringResult.scoring.maxSeverity,
      blocking: scoringResult.scoring.blocking
    }
  });
  const allEvidence = sortEvidenceRecords([
    ...evidence,
    ...ownershipResult.evidence,
    ...dependencyResult.evidence,
    ...contractResult.evidence
  ]);
  const impactId = placeholderImpactId({
    scope: reportScope,
    files,
    surfaces: surfaces.map((surface) => ({
      path: surface.path,
      surfaces: surface.surfaces
    })),
    ownership: {
      coverage: ownershipResult.ownership.coverage,
      matches: ownershipResult.ownership.matches.map((match) => ({
        path: match.path,
        owners: match.owners,
        fallbackUsed: match.fallbackUsed,
        sensitive: match.sensitive,
        ownerMissing: match.ownerMissing
      }))
    },
    dependencyGraph: {
      coverage: dependencyResult.dependencyGraph.coverage,
      nodes: dependencyResult.dependencyGraph.nodes,
      edges: dependencyResult.dependencyGraph.edges,
      reverseDependentsByPath: dependencyResult.dependencyGraph.reverseDependentsByPath
    },
    findings,
    obligations,
    unknowns,
    scoring: scoringResult.scoring
  });

  return {
    phaseStatus: "scored-report-modeled",
    impactId,
    status: scoringResult.status,
    impactStatus: scoringResult.status,
    risk: scoringResult.risk,
    confidence: scoringResult.confidence,
    surfaces,
    areaSummary,
    surfaceSummary,
    ownership: ownershipResult.ownership,
    dependencyGraph: dependencyResult.dependencyGraph,
    findings,
    obligations,
    unknowns,
    evidence: allEvidence,
    report: {
      schemaVersion: "blueprint.impact.report.v1",
      impactId,
      status: scoringResult.status,
      impactStatus: scoringResult.status,
      summary: scoringResult.summary,
      scope: reportScope,
      files,
      risk: scoringResult.risk,
      confidence: scoringResult.confidence,
      scoring: scoringResult.scoring,
      topImpactedAreas: scoringResult.topImpactedAreas,
      requiredReviewers: scoringResult.requiredReviewers,
      requiredTests: scoringResult.requiredTests,
      requiredActions: scoringResult.requiredActions,
      blockingFindings: scoringResult.blockingFindings,
      warningFindings: scoringResult.warningFindings,
      surfaces,
      areaSummary,
      surfaceSummary,
      ownership: ownershipResult.ownership,
      dependencyGraph: dependencyResult.dependencyGraph,
      findings,
      obligations,
      unknowns,
      evidence: allEvidence
    },
    warnings: [...new Set(warnings)].sort()
  };
}

function normalizeImpactReportForPersistence(
  rawReport: unknown,
  requestedImpactId: string | undefined,
  projectRoot: string
): {
  impactId: string;
  report: ParsedImpactReport | null;
  errors: string[];
  warnings: string[];
} {
  const fallbackImpactId =
    requestedImpactId ??
    (isPlainObject(rawReport) && typeof rawReport.impactId === "string"
      ? rawReport.impactId
      : "impact-invalid");
  const impactIdParse = impactIdSchema.safeParse(fallbackImpactId);
  const impactId = impactIdParse.success ? impactIdParse.data : "impact-invalid";
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!impactIdParse.success) {
    errors.push(`Invalid impact id: ${fallbackImpactId}`);
  }

  if (!rawReport) {
    errors.push("Impact report payload is required.");
    return { impactId, report: null, errors, warnings };
  }

  const parsedReport = impactReportSchema.safeParse(rawReport);

  if (!parsedReport.success) {
    errors.push(
      ...parsedReport.error.issues.map((issue) => {
        const issuePath = issue.path.length > 0 ? issue.path.join(".") : "report";

        return `${issuePath}: ${issue.message}`;
      })
    );
    return { impactId, report: null, errors: uniqueSorted(errors), warnings };
  }

  const report = normalizeParsedImpactReport(parsedReport.data);

  if (requestedImpactId && requestedImpactId !== report.impactId) {
    errors.push(
      `Requested impactId ${requestedImpactId} does not match report impactId ${report.impactId}.`
    );
  }

  const quality = validateImpactReportQuality(report, projectRoot);
  errors.push(...quality.errors);
  warnings.push(...quality.warnings);

  return {
    impactId: report.impactId,
    report,
    errors: uniqueSorted(errors),
    warnings: uniqueSorted(warnings)
  };
}

function normalizeParsedImpactReport(report: ParsedImpactReport): ParsedImpactReport {
  return {
    ...report,
    files: uniqueSorted(report.files),
    topImpactedAreas: sortSummaryRecords(report.topImpactedAreas),
    requiredReviewers: uniqueSorted(report.requiredReviewers),
    requiredTests: uniqueSorted(report.requiredTests),
    requiredActions: uniqueSorted(report.requiredActions),
    blockingFindings: sortFindings(report.blockingFindings),
    warningFindings: sortFindings(report.warningFindings),
    surfaces: [...report.surfaces]
      .map((surface) => ({
        ...surface,
        surfaces: [...new Set(surface.surfaces)].sort(compareImpactSurfaces),
        reasons: uniqueSorted(surface.reasons)
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    areaSummary: sortSummaryRecords(report.areaSummary),
    surfaceSummary: sortSummaryRecords(report.surfaceSummary),
    ownership: {
      ...report.ownership,
      rules: [...report.ownership.rules].sort(
        (left, right) =>
          left.order - right.order ||
          left.sourcePath.localeCompare(right.sourcePath) ||
          left.pattern.localeCompare(right.pattern)
      ),
      matches: [...report.ownership.matches].sort((left, right) =>
        left.path.localeCompare(right.path)
      )
    },
    dependencyGraph: {
      ...report.dependencyGraph,
      nodes: [...report.dependencyGraph.nodes].sort((left, right) =>
        left.id.localeCompare(right.id)
      ),
      edges: [...report.dependencyGraph.edges].sort(
        (left, right) =>
          left.from.localeCompare(right.from) ||
          left.to.localeCompare(right.to) ||
          left.type.localeCompare(right.type)
      ),
      reverseDependentsByPath: Object.fromEntries(
        Object.entries(report.dependencyGraph.reverseDependentsByPath)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, values]) => [key, uniqueSorted(values)])
      )
    },
    findings: sortFindings(report.findings),
    obligations: sortObligations(report.obligations),
    unknowns: sortUnknownRecords(report.unknowns),
    evidence: sortEvidenceRecords(report.evidence)
  };
}

function sortSummaryRecords(records: ImpactSummaryRecord[]): ImpactSummaryRecord[] {
  return [...records]
    .map((record) => {
      const files = uniqueSorted(record.files);

      return {
        ...record,
        files,
        count: files.length
      };
    })
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.name.localeCompare(right.name)
    );
}

function validateImpactReportQuality(
  report: ParsedImpactReport,
  projectRoot: string
): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const evidenceIds = new Set(report.evidence.map((evidence) => evidence.id));

  validateImpactReportRepoPaths(report, projectRoot, errors);
  validateEvidenceBackedRecords(report, evidenceIds, errors);
  validateRequiredSignalGrounding(report, errors);
  validateReportContradictions(report, errors);
  validateConfidenceGrounding(report, errors);

  if (report.confidence.reasons.length === 0) {
    errors.push("Impact report confidence requires at least one explanation.");
  }

  if (report.risk.reasons.length === 0) {
    errors.push("Impact report risk requires at least one explanation.");
  }

  const markdown = renderImpactMarkdown(report);
  validateRenderedImpactMarkdown(markdown, errors, warnings);

  return {
    errors: uniqueSorted(errors),
    warnings: uniqueSorted(warnings)
  };
}

function validateReportRepoRelativePath(
  projectRoot: string,
  value: string,
  label: string,
  errors: string[]
): void {
  const trimmed = value.trim();
  const slashNormalized = trimmed.replaceAll("\\", "/");

  if (trimmed.length === 0) {
    errors.push(`${label} must not be blank.`);
    return;
  }

  if (trimmed.includes("\0")) {
    errors.push(`${label} must not contain null bytes.`);
    return;
  }

  if (
    path.isAbsolute(trimmed) ||
    path.posix.isAbsolute(slashNormalized) ||
    /^[A-Za-z]:[\\/]/u.test(trimmed)
  ) {
    errors.push(`${label} must be repo-relative, not absolute: ${value}`);
    return;
  }

  const normalizedPath = path.posix.normalize(slashNormalized);

  if (normalizedPath === ".." || normalizedPath.startsWith("../")) {
    errors.push(`${label} escapes the repository: ${value}`);
    return;
  }

  try {
    ensurePathWithinRootSync(projectRoot, path.resolve(projectRoot, normalizedPath), {
      label
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `${label} escapes the repository.`);
  }
}

function validateReportRepoRelativePaths(
  projectRoot: string,
  values: string[],
  label: string,
  errors: string[]
): void {
  values.forEach((value, index) =>
    validateReportRepoRelativePath(projectRoot, value, `${label}[${index}]`, errors)
  );
}

function hasPathTraversalSegment(value: string): boolean {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .some((segment) => segment === "..");
}

function shouldValidateReportScopeSource(scope: ImpactReportScope): boolean {
  if (scope.source === null) {
    return scope.kind === "diff-file";
  }

  const trimmed = scope.source.trim();
  const slashNormalized = trimmed.replaceAll("\\", "/");

  return (
    scope.kind === "diff-file" ||
    !NON_PATH_SCOPE_SOURCES.has(trimmed) ||
    trimmed.includes("\0") ||
    path.isAbsolute(trimmed) ||
    path.posix.isAbsolute(slashNormalized) ||
    /^[A-Za-z]:[\\/]/u.test(trimmed) ||
    hasPathTraversalSegment(trimmed)
  );
}

function validateReportScopeSource(
  projectRoot: string,
  scope: ImpactReportScope,
  errors: string[]
): void {
  if (!shouldValidateReportScopeSource(scope)) {
    return;
  }

  if (scope.source === null) {
    errors.push("report.scope.source is required for diff-file scope.");
    return;
  }

  if (hasPathTraversalSegment(scope.source)) {
    errors.push(`report.scope.source must not contain traversal segments: ${scope.source}`);
    return;
  }

  validateReportRepoRelativePath(projectRoot, scope.source, "report.scope.source", errors);
}

function shouldValidateDependencyRepoPathValue(value: string): boolean {
  const trimmed = value.trim();

  return (
    trimmed.includes("\0") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("../") ||
    trimmed.includes("/../") ||
    /^[A-Za-z]:[\\/]/u.test(trimmed) ||
    !/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)
  );
}

function validateDependencyRepoPathValue(
  projectRoot: string,
  value: string,
  label: string,
  errors: string[]
): void {
  if (shouldValidateDependencyRepoPathValue(value)) {
    validateReportRepoRelativePath(projectRoot, value, label, errors);
  }
}

function validateImpactReportRepoPaths(
  report: ParsedImpactReport,
  projectRoot: string,
  errors: string[]
): void {
  validateReportScopeSource(projectRoot, report.scope, errors);
  validateReportRepoRelativePaths(projectRoot, report.files, "report.files", errors);

  for (const [summaryLabel, records] of [
    ["report.topImpactedAreas", report.topImpactedAreas],
    ["report.areaSummary", report.areaSummary],
    ["report.surfaceSummary", report.surfaceSummary]
  ] as const) {
    records.forEach((record, index) =>
      validateReportRepoRelativePaths(
        projectRoot,
        record.files,
        `${summaryLabel}[${index}].files`,
        errors
      )
    );
  }

  report.surfaces.forEach((surface, index) =>
    validateReportRepoRelativePath(projectRoot, surface.path, `report.surfaces[${index}].path`, errors)
  );

  for (const [findingLabel, findings] of [
    ["report.findings", report.findings],
    ["report.blockingFindings", report.blockingFindings],
    ["report.warningFindings", report.warningFindings]
  ] as const) {
    findings.forEach((finding, index) =>
      validateReportRepoRelativePaths(
        projectRoot,
        finding.impactedFiles,
        `${findingLabel}[${index}].impactedFiles`,
        errors
      )
    );
  }

  report.obligations.forEach((obligation, index) =>
    validateReportRepoRelativePaths(
      projectRoot,
      obligation.impactedFiles,
      `report.obligations[${index}].impactedFiles`,
      errors
    )
  );
  report.unknowns.forEach((unknown, index) =>
    validateReportRepoRelativePaths(
      projectRoot,
      unknown.impactedFiles,
      `report.unknowns[${index}].impactedFiles`,
      errors
    )
  );
  report.evidence.forEach((evidence, index) =>
    validateReportRepoRelativePaths(
      projectRoot,
      evidence.paths,
      `report.evidence[${index}].paths`,
      errors
    )
  );

  if (report.ownership.codeownersPath !== null) {
    validateReportRepoRelativePath(
      projectRoot,
      report.ownership.codeownersPath,
      "report.ownership.codeownersPath",
      errors
    );
  }

  validateReportRepoRelativePaths(
    projectRoot,
    report.ownership.metadataPaths,
    "report.ownership.metadataPaths",
    errors
  );

  report.ownership.rules.forEach((rule, index) =>
    validateReportRepoRelativePath(
      projectRoot,
      rule.sourcePath,
      `report.ownership.rules[${index}].sourcePath`,
      errors
    )
  );
  report.ownership.matches.forEach((match, matchIndex) => {
    validateReportRepoRelativePath(
      projectRoot,
      match.path,
      `report.ownership.matches[${matchIndex}].path`,
      errors
    );
    match.matchedRules.forEach((rule, ruleIndex) =>
      validateReportRepoRelativePath(
        projectRoot,
        rule.sourcePath,
        `report.ownership.matches[${matchIndex}].matchedRules[${ruleIndex}].sourcePath`,
        errors
      )
    );
  });

  validateReportRepoRelativePaths(
    projectRoot,
    report.dependencyGraph.coverage.filesCovered,
    "report.dependencyGraph.coverage.filesCovered",
    errors
  );
  validateReportRepoRelativePaths(
    projectRoot,
    report.dependencyGraph.coverage.filesUncovered,
    "report.dependencyGraph.coverage.filesUncovered",
    errors
  );
  report.dependencyGraph.nodes.forEach((node, index) => {
    if (node.path !== null) {
      validateReportRepoRelativePath(
        projectRoot,
        node.path,
        `report.dependencyGraph.nodes[${index}].path`,
        errors
      );
    }
  });

  Object.entries(report.dependencyGraph.reverseDependentsByPath).forEach(
    ([filePath, dependents], pathIndex) => {
      validateReportRepoRelativePath(
        projectRoot,
        filePath,
        `report.dependencyGraph.reverseDependentsByPath key[${pathIndex}]`,
        errors
      );
      dependents.forEach((dependent, dependentIndex) =>
        validateDependencyRepoPathValue(
          projectRoot,
          dependent,
          `report.dependencyGraph.reverseDependentsByPath[${filePath}][${dependentIndex}]`,
          errors
        )
      );
    }
  );
}

function validateEvidenceBackedRecords(
  report: ParsedImpactReport,
  evidenceIds: Set<string>,
  errors: string[]
): void {
  for (const finding of report.findings) {
    if (finding.evidenceRefs.length === 0) {
      errors.push(`Finding ${finding.id} is missing evidence refs.`);
    }

    for (const evidenceRef of finding.evidenceRefs) {
      if (!evidenceIds.has(evidenceRef)) {
        errors.push(`Finding ${finding.id} references unknown evidence ${evidenceRef}.`);
      }
    }
  }

  for (const obligation of report.obligations) {
    if (obligation.evidenceRefs.length === 0) {
      errors.push(`Obligation ${obligation.id} is missing evidence refs.`);
    }

    for (const evidenceRef of obligation.evidenceRefs) {
      if (!evidenceIds.has(evidenceRef)) {
        errors.push(`Obligation ${obligation.id} references unknown evidence ${evidenceRef}.`);
      }
    }
  }

  for (const unknown of report.unknowns) {
    if (unknown.evidenceRefs.length === 0) {
      errors.push(`Unknown ${unknown.id} is missing evidence refs.`);
    }

    if (isGenericFiller(unknown.reason) || isGenericFiller(unknown.resolution)) {
      errors.push(`Unknown ${unknown.id} must include a specific reason and resolution.`);
    }

    for (const evidenceRef of unknown.evidenceRefs) {
      if (!evidenceIds.has(evidenceRef)) {
        errors.push(`Unknown ${unknown.id} references unknown evidence ${evidenceRef}.`);
      }
    }
  }
}

function validateRequiredSignalGrounding(report: ParsedImpactReport, errors: string[]): void {
  const groundedReviewers = new Set([
    ...report.ownership.coverage.fallbackReviewers,
    ...report.ownership.matches.flatMap((match) => match.owners),
    ...report.ownership.matches.flatMap((match) => match.fallbackReviewers)
  ]);
  const groundedTests = new Set(
    report.obligations
      .filter((obligation) => obligation.category === "tests")
      .flatMap((obligation) => obligation.requiredActions)
  );
  const groundedActions = new Set([
    ...report.findings.flatMap((finding) => finding.requiredActions),
    ...report.obligations.flatMap((obligation) => obligation.requiredActions),
    ...report.unknowns.map((unknown) => unknown.resolution)
  ]);

  for (const reviewer of report.requiredReviewers) {
    if (!groundedReviewers.has(reviewer)) {
      errors.push(`Required reviewer ${reviewer} is not grounded in ownership evidence.`);
    }
  }

  for (const test of report.requiredTests) {
    if (!groundedTests.has(test)) {
      errors.push(`Required test ${test} is not grounded in a test obligation.`);
    }
  }

  for (const action of report.requiredActions) {
    if (!groundedActions.has(action)) {
      errors.push(`Required action ${action} is not grounded in findings, obligations, or unknowns.`);
    }
  }
}

function validateReportContradictions(report: ParsedImpactReport, errors: string[]): void {
  const hasBlockingSignals =
    report.findings.some((finding) => finding.status === "BLOCK") ||
    report.obligations.some((obligation) => obligation.status === "BLOCK") ||
    report.unknowns.some(
      (unknown) => unknown.severity === "HIGH" || unknown.severity === "CRITICAL"
    );

  if (report.status !== report.impactStatus || report.status !== report.scoring.status) {
    errors.push("Impact report status, impactStatus, and scoring.status must agree.");
  }

  if (report.status === "PASS" && hasBlockingSignals) {
    errors.push("Impact report cannot be PASS while blocking findings, obligations, or unknowns remain.");
  }

  if (report.status === "BLOCK" && !hasBlockingSignals && !report.scoring.blocking) {
    errors.push("Impact report cannot be BLOCK without a blocking signal or scoring.blocking=true.");
  }

  validateFindingProjection(
    report.findings,
    report.blockingFindings,
    "BLOCK",
    "blockingFindings",
    errors
  );
  validateFindingProjection(
    report.findings,
    report.warningFindings,
    "WARN",
    "warningFindings",
    errors
  );
}

function validateFindingProjection(
  findings: ImpactFindingRecord[],
  projectedFindings: ImpactFindingRecord[],
  status: "BLOCK" | "WARN",
  label: string,
  errors: string[]
): void {
  const expected = findings.filter((finding) => finding.status === status);
  const expectedById = new Map(expected.map((finding) => [finding.id, finding]));
  const projectedById = new Map(projectedFindings.map((finding) => [finding.id, finding]));
  const missingIds = expected
    .filter((finding) => !projectedById.has(finding.id))
    .map((finding) => finding.id);
  const extraIds = projectedFindings
    .filter((finding) => !expectedById.has(finding.id))
    .map((finding) => finding.id);

  if (missingIds.length > 0 || extraIds.length > 0) {
    errors.push(
      `${label} ids must exactly match findings with status ${status}; missing: ${
        missingIds.join(", ") || "none"
      }; extra: ${extraIds.join(", ") || "none"}.`
    );
  }

  for (const finding of projectedFindings) {
    const canonical = expectedById.get(finding.id);

    if (finding.status !== status) {
      errors.push(`${label} ${finding.id} status ${finding.status} does not match ${status}.`);
    }

    if (!canonical) {
      continue;
    }

    if (stableStringify(canonical.evidenceRefs) !== stableStringify(finding.evidenceRefs)) {
      errors.push(`${label} ${finding.id} evidenceRefs do not match canonical finding evidence.`);
    }

    if (stableStringify(canonical) !== stableStringify(finding)) {
      errors.push(`${label} ${finding.id} details do not match canonical finding.`);
    }
  }
}

function validateConfidenceGrounding(report: ParsedImpactReport, errors: string[]): void {
  const highConfidence = report.confidence.level === "high" || report.confidence.score >= 0.75;
  const scopeProofed =
    report.files.length > 0 &&
    report.scope.kind !== "description" &&
    report.scope.kind !== "unresolved" &&
    report.evidence.some(
      (evidence) => evidence.kind === "scope" || evidence.paths.some((file) => report.files.includes(file))
    );

  if (highConfidence && !scopeProofed) {
    errors.push("High confidence requires file-backed scope proof and scope evidence.");
  }
}

function validateRenderedImpactMarkdown(
  markdown: string,
  errors: string[],
  warnings: string[]
): void {
  const sections = parseMarkdownSections(markdown);

  for (const heading of IMPACT_REPORT_REQUIRED_HEADINGS) {
    const section = sections.get(heading);

    if (!section) {
      errors.push(`IMPACT.md is missing required heading: ${heading}.`);
      continue;
    }

    if (section.trim().length === 0) {
      errors.push(`IMPACT.md section ${heading} is empty.`);
    } else if (isGenericFiller(section)) {
      errors.push(`IMPACT.md section ${heading} contains generic filler.`);
    }
  }

  const placeholderMatches = markdown.match(/<[^>\n]+>|\bTBD\b|\bTODO\b/giu) ?? [];
  for (const match of placeholderMatches) {
    errors.push(`IMPACT.md contains unresolved placeholder text: ${match}.`);
  }

  for (const line of markdown.split(/\r?\n/u)) {
    if (/\bN\/A\b/iu.test(line) && !/\b(because|reason|not applicable)\b/iu.test(line)) {
      errors.push(`IMPACT.md contains generic N/A without an explicit reason: ${line.trim()}`);
    }
  }

  if (!markdown.includes("Impact drivers") || !markdown.includes("Confidence factors")) {
    warnings.push("IMPACT.md should include impact drivers and confidence factors.");
  }
}

function parseMarkdownSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string | null = null;
  let content: string[] = [];

  for (const line of markdown.split(/\r?\n/u)) {
    const match = /^## ([^\n#]+)$/u.exec(line);

    if (match) {
      if (current) {
        sections.set(current, content.join("\n").trim());
      }

      current = match[1].trim();
      content = [];
      continue;
    }

    if (current) {
      content.push(line);
    }
  }

  if (current) {
    sections.set(current, content.join("\n").trim());
  }

  return sections;
}

function isGenericFiller(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    normalized.length === 0 ||
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "not applicable" ||
    normalized === "todo" ||
    normalized === "tbd" ||
    normalized === "-" ||
    normalized === "no impact" ||
    normalized === "no warnings"
  );
}

function impactBundleRelativePaths(
  impactId: string,
  report: ParsedImpactReport | null,
  writeEvidenceLog?: boolean
): ImpactReportWriteResult["paths"] {
  const base = `${IMPACT_REPORT_ROOT}/${impactId}`;
  const shouldWriteEvidence = Boolean(writeEvidenceLog) || Boolean(report && report.evidence.length > 0);
  const shouldWriteChecklist = Boolean(
    report &&
      (report.requiredReviewers.length > 0 ||
        report.requiredTests.length > 0 ||
        report.requiredActions.length > 0 ||
        report.obligations.length > 0)
  );
  const shouldWriteQuestions = Boolean(report && report.unknowns.length > 0);

  return {
    impactMarkdown: `${base}/IMPACT.md`,
    impactJson: `${base}/impact.json`,
    summaryJson: `${base}/summary.json`,
    evidenceJsonl: shouldWriteEvidence ? `${base}/evidence.jsonl` : null,
    reviewChecklist: shouldWriteChecklist ? `${base}/review-checklist.md` : null,
    questions: shouldWriteQuestions ? `${base}/QUESTIONS.md` : null
  };
}

function buildImpactReportBundle(
  report: ParsedImpactReport,
  options: { writeEvidenceLog?: boolean }
): {
  files: Map<string, string>;
} {
  const paths = impactBundleRelativePaths(report.impactId, report, options.writeEvidenceLog);
  const files = new Map<string, string>();

  files.set("IMPACT.md", renderImpactMarkdown(report));
  files.set("impact.json", `${stableJson(report)}\n`);
  files.set("summary.json", `${stableJson(buildImpactSummaryJson(report, paths))}\n`);

  if (paths.evidenceJsonl) {
    files.set(
      "evidence.jsonl",
      report.evidence.map((evidence) => stableStringify(evidence)).join("\n") + "\n"
    );
  }

  if (paths.reviewChecklist) {
    files.set("review-checklist.md", renderImpactReviewChecklist(report));
  }

  if (paths.questions) {
    files.set("QUESTIONS.md", renderImpactQuestions(report));
  }

  return { files };
}

function buildImpactSummaryJson(
  report: ParsedImpactReport,
  paths: ImpactReportWriteResult["paths"]
): Record<string, unknown> {
  return {
    schemaVersion: IMPACT_REPORT_SCHEMA_VERSION,
    impactId: report.impactId,
    status: report.status,
    impactStatus: report.impactStatus,
    risk: report.risk,
    confidence: report.confidence,
    scope: report.scope,
    counts: {
      files: report.files.length,
      findings: report.findings.length,
      obligations: report.obligations.length,
      unknowns: report.unknowns.length,
      evidence: report.evidence.length
    },
    topImpactedAreas: report.topImpactedAreas,
    requiredReviewers: report.requiredReviewers,
    requiredTests: report.requiredTests,
    requiredActions: report.requiredActions,
    paths
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value), null, 2);
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJsonValue(item)])
    );
  }

  return value;
}

function renderImpactOutput(
  report: ParsedImpactReport,
  mode: ImpactOutputMode,
  verbosity: "compact" | "normal" | "detailed" = "normal"
): string {
  switch (mode) {
    case "json":
      return `${stableJson(report)}\n`;
    case "markdown":
      return renderImpactMarkdown(report);
    case "pr-comment":
      return renderImpactPrComment(report);
    case "summary":
      return renderImpactSummaryText(report);
    case "human":
    default:
      return renderImpactHumanText(report, verbosity);
  }
}

function renderImpactMarkdown(report: ParsedImpactReport): string {
  return `# Impact Report: ${report.impactId}

## Summary

${report.summary}

- Status: ${report.status}
- Risk: ${report.risk.level}
- Confidence: ${report.confidence.level} (${report.confidence.score})
- Impact drivers: ${sentenceList(report.scoring.drivers, "No impact drivers were recorded because the analyzer found no status or risk signals.")}
- Impact reducers: ${sentenceList(report.scoring.reducers, "No impact reducers were recorded because no weakening signals were detected.")}
- Confidence factors: ${sentenceList(report.confidence.reasons, "No confidence factors were recorded because confidence evidence was unavailable.")}

## Change Scope

${renderChangeScope(report)}

## Top Impacted Areas

${renderSummaryRecords(report.topImpactedAreas, "No impacted areas were detected because the resolved scope contained no changed files.")}

## Required Reviewers

${renderStringList(report.requiredReviewers, "No required reviewers are listed because ownership metadata did not identify owners or fallback reviewers for this scope.")}

## Required Tests

${renderStringList(report.requiredTests, "No required tests are listed because the analyzed signals did not produce test obligations.")}

## Blocking Findings

${renderFindings(report.blockingFindings, "No blocking finding records were emitted. BLOCK status can still come from scoring policy, high-assurance low-confidence thresholds, or structured unknowns; see Summary and Unknowns.")}

## Warnings

${renderWarningsSection(report)}

## Contract And Compatibility Impact

${renderContractImpact(report)}

## Database, Config, Infra, And Deployment Impact

${renderOperationalImpact(report)}

## Unknowns And Missing Metadata

${renderUnknowns(report)}

## Evidence

${renderEvidence(report)}

## Suggested Next Actions

${renderStringList(report.requiredActions, "No suggested next actions are listed because no findings, obligations, or unknowns required follow-up.")}
`;
}

function renderChangeScope(report: ParsedImpactReport): string {
  const fileLines =
    report.files.length > 0
      ? report.files.map((file) => `- \`${file}\``).join("\n")
      : "- No changed files were included because the resolved scope was not file-backed.";

  return [
    `- Kind: ${report.scope.kind}`,
    `- Source: ${report.scope.source ?? "No source recorded because scope resolution did not provide one."}`,
    `- Fingerprint: ${report.scope.fingerprint}`,
    `- Description: ${report.scope.description ?? "No description was provided because this report used file or git scope."}`,
    "",
    fileLines
  ].join("\n");
}

function renderSummaryRecords(records: ImpactSummaryRecord[], emptyReason: string): string {
  if (records.length === 0) {
    return emptyReason;
  }

  return records
    .map((record) => {
      const files =
        record.files.length > 0
          ? record.files.map((file) => `  - \`${file}\``).join("\n")
          : "  - No files listed because the summary count was zero.";

      return `- ${record.name}: ${record.count}\n${files}`;
    })
    .join("\n");
}

function renderStringList(values: string[], emptyReason: string): string {
  if (values.length === 0) {
    return emptyReason;
  }

  return values.map((value) => `- ${value}`).join("\n");
}

function renderFindings(findings: ImpactFindingRecord[], emptyReason: string): string {
  if (findings.length === 0) {
    return emptyReason;
  }

  return findings
    .map(
      (finding) => `- ${finding.id}: ${finding.title}
  - Status: ${finding.status}
  - Severity: ${finding.severity}
  - Evidence: ${finding.evidenceRefs.join(", ")}
  - Actions: ${sentenceList(finding.requiredActions, "No action was required because this finding is informational.")}`
    )
    .join("\n");
}

function renderWarningsSection(report: ParsedImpactReport): string {
  const warningFindings = renderFindings(
    report.warningFindings,
    "No warning findings were detected because the report did not include WARN findings."
  );
  const warningObligations = report.obligations.filter((obligation) => obligation.status === "WARN");

  if (warningObligations.length === 0) {
    return warningFindings;
  }

  return `${warningFindings}

Obligations:
${warningObligations
  .map(
    (obligation) => `- ${obligation.id}: ${obligation.title}
  - Category: ${obligation.category}
  - Evidence: ${obligation.evidenceRefs.join(", ")}
  - Actions: ${sentenceList(obligation.requiredActions, "No action was required because this obligation is informational.")}`
  )
  .join("\n")}`;
}

function renderContractImpact(report: ParsedImpactReport): string {
  const contractSignals = [
    ...report.findings.filter((finding) => finding.checkId.startsWith("contract.")),
    ...report.findings.filter((finding) => finding.checkId.includes("routing"))
  ];
  const contractObligations = report.obligations.filter(
    (obligation) => obligation.category === "contract-review" || obligation.category === "docs"
  );

  if (contractSignals.length === 0 && contractObligations.length === 0) {
    return "No contract or compatibility impact was detected because no command, MCP, artifact-contract, skill, agent, extension, or runtime-reference surfaces produced contract signals.";
  }

  return [
    renderFindings(contractSignals, "No contract findings were detected because contract checks did not produce findings."),
    renderStringList(
      contractObligations.map((obligation) => `${obligation.title} (${obligation.id})`),
      "No contract obligations were produced because contract surfaces did not require follow-up."
    )
  ].join("\n\n");
}

function renderOperationalImpact(report: ParsedImpactReport): string {
  const operationalObligations = report.obligations.filter((obligation) =>
    ["deployment", "migration", "security", "build", "release"].includes(obligation.category)
  );
  const operationalFiles = report.surfaces.filter((surface) =>
    surface.surfaces.some((name) =>
      [
        "secret-sensitive",
        "env-config",
        "config",
        "package-runtime",
        "build-config",
        "extension-manifest",
        "hook"
      ].includes(name)
    )
  );

  if (operationalObligations.length === 0 && operationalFiles.length === 0) {
    return "No database, config, infra, or deployment impact was detected because the resolved scope contained no configured persistence, migration, config, infra, package, build, extension, hook, or secret-sensitive paths.";
  }

  return [
    renderStringList(
      operationalFiles.map((surface) => `\`${surface.path}\` (${surface.surfaces.join(", ")})`),
      "No operational files were listed because only obligations were detected."
    ),
    renderStringList(
      operationalObligations.map((obligation) => `${obligation.title} (${obligation.id})`),
      "No operational obligations were listed because operational files did not require follow-up."
    )
  ].join("\n\n");
}

function renderUnknowns(report: ParsedImpactReport): string {
  if (report.unknowns.length === 0) {
    return "No unknowns remain because scope, ownership, dependency, contract, and obligation metadata were sufficient for this advisory report.";
  }

  return report.unknowns
    .map(
      (unknown) => `- ${unknown.id}: ${unknown.title}
  - Category: ${unknown.category}
  - Severity: ${unknown.severity}
  - Reason: ${unknown.reason}
  - Resolution: ${unknown.resolution}
  - Evidence: ${unknown.evidenceRefs.join(", ")}`
    )
    .join("\n");
}

function renderEvidence(report: ParsedImpactReport): string {
  if (report.evidence.length === 0) {
    return "No evidence records were included because the report payload did not provide evidence; this should be treated as invalid for persisted impact reports.";
  }

  return report.evidence
    .map(
      (evidence) => `- ${evidence.id}: ${evidence.summary}
  - Kind: ${evidence.kind}
  - Source: ${evidence.source}
  - Paths: ${sentenceList(evidence.paths.map((file) => `\`${file}\``), "No paths because this evidence record describes configuration or aggregate metadata.")}`
    )
    .join("\n");
}

function sentenceList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join("; ") : fallback;
}

function renderImpactReviewChecklist(report: ParsedImpactReport): string {
  return `# Impact Review Checklist: ${report.impactId}

## Reviewers

${renderChecklistItems(report.requiredReviewers, "No reviewer checkbox because no required reviewers were derived.")}

## Tests

${renderChecklistItems(report.requiredTests, "No test checkbox because no required tests were derived.")}

## Actions

${renderChecklistItems(report.requiredActions, "No action checkbox because no required actions were derived.")}

## Obligations

${renderChecklistItems(
  report.obligations.map((obligation) => `${obligation.title} (${obligation.id})`),
  "No obligation checkbox because no obligations were derived."
)}
`;
}

function renderChecklistItems(values: string[], emptyReason: string): string {
  if (values.length === 0) {
    return emptyReason;
  }

  return values.map((value) => `- [ ] ${value}`).join("\n");
}

function renderImpactQuestions(report: ParsedImpactReport): string {
  return `# Impact Questions: ${report.impactId}

${report.unknowns
  .map(
    (unknown) => `## ${unknown.title}

- Unknown ID: ${unknown.id}
- Severity: ${unknown.severity}
- Why it matters: ${unknown.reason}
- Suggested resolution: ${unknown.resolution}
- Evidence: ${unknown.evidenceRefs.join(", ")}
`
  )
  .join("\n")}`;
}

function renderImpactPrComment(report: ParsedImpactReport): string {
  return `## Blueprint Impact: ${report.status}

- Impact ID: \`${report.impactId}\`
- Risk: ${report.risk.level}
- Confidence: ${report.confidence.level} (${report.confidence.score})
- Files: ${report.files.length}
- Findings: ${report.findings.length}
- Obligations: ${report.obligations.length}
- Unknowns: ${report.unknowns.length}

${renderStringList(report.requiredActions.slice(0, 8), "No next actions are required because no follow-up signals were produced.")}
`;
}

function renderImpactSummaryText(report: ParsedImpactReport): string {
  return [
    `${report.status} ${report.impactId}`,
    `Risk: ${report.risk.level}`,
    `Confidence: ${report.confidence.level} (${report.confidence.score})`,
    `Files: ${report.files.length}`,
    `Findings: ${report.findings.length}`,
    `Obligations: ${report.obligations.length}`,
    `Unknowns: ${report.unknowns.length}`
  ].join("\n");
}

function renderImpactHumanText(
  report: ParsedImpactReport,
  verbosity: "compact" | "normal" | "detailed"
): string {
  const lines = [
    `Impact ${report.impactId}: ${report.status}`,
    `Risk ${report.risk.level}; confidence ${report.confidence.level} (${report.confidence.score}).`,
    report.summary
  ];

  if (verbosity !== "compact") {
    lines.push(
      `Top areas: ${sentenceList(
        report.topImpactedAreas.map((area) => `${area.name} (${area.count})`),
        "No impacted areas because the scope had no changed files."
      )}`,
      `Required reviewers: ${sentenceList(
        report.requiredReviewers,
        "No reviewers because ownership metadata did not derive required owners."
      )}`,
      `Required tests: ${sentenceList(
        report.requiredTests,
        "No tests because no test obligations were derived."
      )}`
    );
  }

  if (verbosity === "detailed") {
    lines.push(
      `Required actions: ${sentenceList(
        report.requiredActions,
        "No actions because no findings, obligations, or unknowns required follow-up."
      )}`,
      `Unknowns: ${sentenceList(
        report.unknowns.map((unknown) => `${unknown.id}: ${unknown.title}`),
        "No unknowns remain because metadata coverage was sufficient."
      )}`
    );
  }

  return `${lines.join("\n")}\n`;
}

function ensureImpactBundleDir(projectRoot: string, impactId: string): string {
  const impactRoot = ensurePathWithinRootSync(projectRoot, path.join(projectRoot, IMPACT_REPORT_ROOT), {
    label: "impact report root"
  });
  const impactDir = ensurePathWithinRootSync(impactRoot, path.join(impactRoot, impactId), {
    label: "impact report directory"
  });

  ensurePathWithinRootSync(projectRoot, impactDir, { label: "impact report directory" });
  return impactDir;
}

async function compareImpactBundle(
  projectRoot: string,
  impactDir: string,
  files: Map<string, string>
): Promise<{ existing: boolean; identical: boolean }> {
  const existing = await pathExists(impactDir);

  if (!existing) {
    return { existing: false, identical: false };
  }

  for (const [fileName, content] of files) {
    const filePath = ensurePathWithinRootSync(impactDir, path.join(impactDir, fileName), {
      label: "impact report file"
    });
    ensurePathWithinRootSync(projectRoot, filePath, { label: "impact report file" });

    if (!(await pathExists(filePath))) {
      return { existing: true, identical: false };
    }

    if ((await fs.readFile(filePath, "utf8")) !== content) {
      return { existing: true, identical: false };
    }
  }

  const existingEntries = await fs.readdir(impactDir, { withFileTypes: true });

  for (const entry of existingEntries) {
    if (!IMPACT_ALLOWED_BUNDLE_FILES.has(entry.name) || !files.has(entry.name)) {
      return { existing: true, identical: false };
    }
  }

  return { existing: true, identical: true };
}

async function pruneImpactStaleBundleFiles(
  projectRoot: string,
  impactDir: string,
  files: Map<string, string>
): Promise<void> {
  if (!(await pathExists(impactDir))) {
    return;
  }

  const entries = await fs.readdir(impactDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!files.has(entry.name)) {
      const stalePath = ensurePathWithinRootSync(impactDir, path.join(impactDir, entry.name), {
        label: "stale impact report file"
      });
      ensurePathWithinRootSync(projectRoot, stalePath, { label: "stale impact report file" });
      await fs.rm(stalePath, { recursive: entry.isDirectory(), force: true });
    }
  }
}

async function writeImpactBundleFilesAtomically(
  projectRoot: string,
  impactDir: string,
  files: Map<string, string>
): Promise<void> {
  for (const [fileName, content] of files) {
    const filePath = ensurePathWithinRootSync(impactDir, path.join(impactDir, fileName), {
      label: "impact report file"
    });
    ensurePathWithinRootSync(projectRoot, filePath, { label: "impact report file" });
    const tempPath = `${filePath}.tmp-${process.pid}-${stableHash({ fileName, content })}`;

    await fs.writeFile(tempPath, content, "utf8");
    await fs.rename(tempPath, filePath);
  }
}

async function readSavedImpactReport(
  projectRoot: string,
  impactId: string
): Promise<Record<string, unknown>> {
  const impactDir = ensureImpactBundleDir(projectRoot, impactId);
  const reportPath = ensurePathWithinRootSync(impactDir, path.join(impactDir, "impact.json"), {
    label: "saved impact report"
  });

  if (!(await pathExists(reportPath))) {
    throw new Error(`${IMPACT_REPORT_ROOT}/${impactId}/impact.json does not exist.`);
  }

  return safeJsonParseObject(await fs.readFile(reportPath, "utf8"), {
    label: `${IMPACT_REPORT_ROOT}/${impactId}/impact.json`
  });
}

export async function blueprintImpactReportWrite(
  args: ImpactReportWriteArgs = {}
): Promise<ImpactReportWriteResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const parsed = normalizeImpactReportForPersistence(args.report, args.impactId, projectRoot);
  const impactId = parsed.impactId;
  const paths = impactBundleRelativePaths(impactId, parsed.report, args.writeEvidenceLog);

  if (parsed.errors.length > 0 || !parsed.report) {
    return {
      status: "invalid",
      impactId,
      impactDir: `${IMPACT_REPORT_ROOT}/${impactId}`,
      paths,
      written: false,
      errors: parsed.errors,
      warnings: parsed.warnings
    };
  }

  const bundle = buildImpactReportBundle(parsed.report, {
    writeEvidenceLog: args.writeEvidenceLog
  });
  const impactDir = ensureImpactBundleDir(projectRoot, impactId);
  const comparison = await compareImpactBundle(projectRoot, impactDir, bundle.files);

  if (comparison.existing && comparison.identical) {
    return {
      status: "reused",
      impactId,
      impactDir: `${IMPACT_REPORT_ROOT}/${impactId}`,
      paths,
      written: false,
      errors: [],
      warnings: parsed.warnings
    };
  }

  if (comparison.existing && !args.overwrite) {
    return {
      status: "invalid",
      impactId,
      impactDir: `${IMPACT_REPORT_ROOT}/${impactId}`,
      paths,
      written: false,
      errors: [
        `Impact report bundle ${IMPACT_REPORT_ROOT}/${impactId} already exists with different content; pass overwrite=true to replace it.`
      ],
      warnings: parsed.warnings
    };
  }

  await fs.mkdir(impactDir, { recursive: true });
  await pruneImpactStaleBundleFiles(projectRoot, impactDir, bundle.files);
  await writeImpactBundleFilesAtomically(projectRoot, impactDir, bundle.files);

  return {
    status: comparison.existing ? "overwritten" : "written",
    impactId,
    impactDir: `${IMPACT_REPORT_ROOT}/${impactId}`,
    paths,
    written: true,
    errors: [],
    warnings: parsed.warnings
  };
}

export async function blueprintImpactOutputRender(
  args: ImpactOutputRenderArgs = {}
): Promise<ImpactOutputRenderResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const mode = args.mode ?? "human";
  const rawReport =
    args.report ??
    (args.impactId
      ? await readSavedImpactReport(projectRoot, args.impactId)
      : undefined);
  const parsed = normalizeImpactReportForPersistence(rawReport, args.impactId, projectRoot);

  if (!parsed.report || parsed.errors.length > 0) {
    throw new Error(
      `Impact report cannot be rendered: ${parsed.errors.join("; ") || "report is required"}`
    );
  }

  return {
    phaseStatus: "rendered",
    mode,
    status: parsed.report.status,
    impactStatus: parsed.report.impactStatus,
    content: renderImpactOutput(parsed.report, mode, args.verbosity),
    impactId: parsed.report.impactId,
    warnings: parsed.warnings
  };
}

export const impactToolDefinitions = [
  {
    name: "blueprint_impact_config_get",
    description:
      "Load Blueprint impact-analysis configuration provenance and validation signals without mutating repo state.",
    inputSchema: impactConfigGetInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintImpactConfigGet(args as ImpactConfigGetArgs)
  },
  {
    name: "blueprint_impact_scope_resolve",
    description:
      "Resolve the proposed impact-analysis scope from git, explicit files, diff input, or description-only seeds without reading secrets.",
    inputSchema: impactScopeResolveInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintImpactScopeResolve(args as ImpactScopeResolveArgs)
  },
  {
    name: "blueprint_impact_context_load",
    description:
      "Load Blueprint and repository context for impact analysis while treating missing optional metadata as explicit warnings.",
    inputSchema: impactContextLoadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintImpactContextLoad(args as ImpactContextLoadArgs)
  },
  {
    name: "blueprint_impact_analyze",
    description:
      "Analyze impact surfaces, findings, obligations, unknowns, risk, confidence, and advisory status from normalized scope and context.",
    inputSchema: impactAnalyzeInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintImpactAnalyze(args as ImpactAnalyzeArgs)
  },
  {
    name: "blueprint_impact_report_write",
    description:
      "Persist a validated impact report bundle under .blueprint/impact/<impact-id>/ with reuse and overwrite protection.",
    inputSchema: impactReportWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintImpactReportWrite(args as ImpactReportWriteArgs)
  },
  {
    name: "blueprint_impact_output_render",
    description:
      "Render a normalized impact report or saved impact id as human, JSON, Markdown, PR-comment, or summary output.",
    inputSchema: impactOutputRenderInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintImpactOutputRender(args as ImpactOutputRenderArgs)
  }
];
