import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import * as z from "zod/v4";

import {
  ensureRepoRoot,
  getProjectRoot,
  toRepoRelativePath
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { blueprintPhaseContext, blueprintRoadmapRead } from "./phase.js";
import { listArtifactContracts } from "../artifact-contracts/index.js";
import { resolveBlueprintRuntimeHost } from "../runtime-host.js";
import {
  ensurePathWithinRootSync,
  safeJsonParseObject
} from "../../shared/security.js";

type ImpactStatus = "PASS" | "WARN" | "BLOCK";
type ImpactRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
type ImpactConfidenceLevel = "low" | "medium" | "high";
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
  surfaces: ImpactSurfaceRecord[];
  areaSummary: ImpactSummaryRecord[];
  surfaceSummary: ImpactSummaryRecord[];
  ownership: ImpactOwnershipAnalysis;
  dependencyGraph: ImpactDependencyAnalysis;
  findings: ImpactFindingRecord[];
  unknowns: ImpactUnknownRecord[];
  evidence: ImpactEvidenceRecord[];
};

type ImpactAnalyzeResult = {
  phaseStatus: "ownership-dependencies-analyzed";
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
  obligations: unknown[];
  unknowns: ImpactUnknownRecord[];
  evidence: ImpactEvidenceRecord[];
  report: ImpactAnalysisReport;
  warnings: string[];
};

type ImpactEvidenceRecord = {
  id: string;
  kind: "scope" | "surface" | "ownership" | "dependency" | "metadata" | "config";
  source: string;
  summary: string;
  paths: string[];
  data?: Record<string, unknown>;
};

type ImpactUnknownCategory =
  | "ownership"
  | "dependency"
  | "contract"
  | "obligation"
  | "risk-scoring";

type ImpactUnknownRecord = {
  id: string;
  category: ImpactUnknownCategory;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  impactedFiles: string[];
  reason: string;
  resolution: string;
  evidenceRefs: string[];
};

type ImpactFindingRecord = {
  id: string;
  checkId: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: ImpactStatus;
  confidence: number;
  impactedFiles: string[];
  impactedAreas: string[];
  owners: string[];
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

type CommandCatalogLike = {
  commands?: Record<
    string,
    {
      implemented?: boolean;
      manifestPath?: string | null;
      specPath?: string | null;
      skillPath?: string | null;
      blockedBy?: string[];
    }
  >;
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
  status: "disabled";
  impactId: string;
  impactDir: string;
  paths: {
    impactMarkdown: string | null;
    impactJson: string | null;
    summaryJson: string | null;
    evidenceJsonl: string | null;
    reviewChecklist: string | null;
    questions: string | null;
  };
  written: false;
  warnings: string[];
};

type ImpactOutputRenderResult = {
  phaseStatus: "placeholder";
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

const IMPACT_PLACEHOLDER_WARNING =
  "/blu-impact Phase 5 config, scope, context, surface, ownership, and dependency analysis are registered; report writing and output rendering remain disabled placeholders for later impact phases.";
const IMPACT_SCHEMA_VERSION = "blueprint.impact.config.v1";
const PLACEHOLDER_IMPACT_ID = "impact-phase-5-placeholder";
const OWNERSHIP_SCHEMA_VERSION = "blueprint.impact.ownership.v1";
const DEPENDENCY_GRAPH_SCHEMA_VERSION = "blueprint.impact.dependency-graph.v1";
const IMPACT_PROJECT_CONFIG_PATH = ".blueprint/impact/config.json";
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
  "mcp-server": 6,
  "mcp-tool": 7,
  "mcp-resource": 8,
  "artifact-contract": 9,
  skill: 10,
  agent: 11,
  "extension-manifest": 12,
  hook: 13,
  "package-runtime": 14,
  "build-config": 15,
  test: 16,
  docs: 17,
  generated: 18,
  config: 19,
  source: 20,
  "repo-root": 21,
  unknown: 22
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
  return [...records].sort((left, right) => left.id.localeCompare(right.id));
}

function sortUnknownRecords(records: ImpactUnknownRecord[]): ImpactUnknownRecord[] {
  return [...records].sort((left, right) => left.id.localeCompare(right.id));
}

function findingSeverityRank(value: ImpactFindingRecord["severity"]): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[value];
}

function findingStatusRank(value: ImpactStatus): number {
  return { BLOCK: 0, WARN: 1, PASS: 2 }[value];
}

function sortFindings(records: ImpactFindingRecord[]): ImpactFindingRecord[] {
  return [...records].sort(
    (left, right) =>
      findingStatusRank(left.status) - findingStatusRank(right.status) ||
      findingSeverityRank(left.severity) - findingSeverityRank(right.severity) ||
      left.impactedAreas.join(",").localeCompare(right.impactedAreas.join(",")) ||
      left.checkId.localeCompare(right.checkId) ||
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
      (entry.blockedBy ?? []).filter((blockedBy) => blockedBy.startsWith("Missing ")).length,
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
      registeredImpactTools: [...IMPACT_TOOL_NAMES],
      implementationPhase: 5,
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

  if (sources.length === 0) {
    warnings.push(
      "No changed files were provided to impact analysis; Phase 5 ownership and dependency analysis has no file-backed surfaces."
    );
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
    summary: "Impact analysis resolved effective Phase 5 ownership and dependency configuration.",
    paths: [],
    data: {
      ownershipSources: config.ownership.sources,
      dependencySources: config.dependencyGraph.sources,
      customGraphFiles: config.dependencyGraph.customGraphFiles
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
  const deferredEvidenceRef = addEvidence(evidence, {
    kind: "metadata",
    source: "phase-5-deferred-checks",
    summary:
      "Phase 5 analyzes ownership and dependencies only; contract, obligation, and scoring phases remain deferred.",
    paths: []
  });
  const deferredUnknowns: ImpactUnknownRecord[] = [
    {
      id: "unknown.contractChecksDeferred",
      category: "contract",
      title: "Contract checks are deferred",
      severity: "MEDIUM",
      impactedFiles: files,
      reason: "Phase 6 contract and compatibility checks are not part of this Phase 5 implementation.",
      resolution: "Run the future contract/compatibility phase when it lands before treating compatibility as proven.",
      evidenceRefs: [deferredEvidenceRef]
    },
    {
      id: "unknown.obligationChecksDeferred",
      category: "obligation",
      title: "Review, test, and documentation obligations are deferred",
      severity: "MEDIUM",
      impactedFiles: files,
      reason: "Phase 6/7 obligation checks are not part of this Phase 5 implementation.",
      resolution: "Use later obligation analysis before relying on this report for required tests or reviewers beyond ownership.",
      evidenceRefs: [deferredEvidenceRef]
    },
    {
      id: "unknown.riskScoringDeferred",
      category: "risk-scoring",
      title: "Full risk scoring is deferred",
      severity: "LOW",
      impactedFiles: files,
      reason: "Phase 7 full scoring is deferred; Phase 5 only adjusts status for sensitive missing-owner BLOCK cases.",
      resolution: "Treat current risk and confidence as simple advisory signals until Phase 7 scoring lands.",
      evidenceRefs: [deferredEvidenceRef]
    }
  ];
  const findings = sortFindings([...ownershipResult.findings]);
  const unknowns = sortUnknownRecords([
    ...ownershipResult.unknowns,
    ...dependencyResult.unknowns,
    ...deferredUnknowns
  ]);
  const allEvidence = sortEvidenceRecords([
    ...evidence,
    ...ownershipResult.evidence,
    ...dependencyResult.evidence
  ]);
  const status: ImpactStatus = findings.some((finding) => finding.status === "BLOCK")
    ? "BLOCK"
    : "WARN";
  const impactId = placeholderImpactId({
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
    }
  });
  const confidenceScore =
    files.length === 0
      ? 0.25
      : status === "BLOCK"
        ? 0.66
        : ownershipResult.ownership.coverage.status === "complete" &&
            dependencyResult.dependencyGraph.coverage.status === "complete-ish"
          ? 0.68
          : 0.56;
  const confidenceLevel: ImpactConfidenceLevel =
    confidenceScore >= 0.67 ? "high" : confidenceScore >= 0.45 ? "medium" : "low";
  const risk: ImpactRisk =
    status === "BLOCK"
      ? {
          level: "critical",
          reasons: [
            "A sensitive changed file lacks an explicit owner or fallback reviewer.",
            "Phase 7 full scoring is deferred; this critical risk reflects only the Phase 5 BLOCK rule."
          ]
        }
      : {
          level: "unknown",
          reasons: [
            "Phase 5 analyzes ownership and dependency coverage, but contract, obligation, and full scoring checks are deferred.",
            "Missing metadata remains visible as unknowns instead of proving low impact."
          ]
        };
  const confidence: ImpactConfidence = {
    score: confidenceScore,
    level: confidenceLevel,
    reasons:
      files.length > 0
        ? [
            "Changed files were normalized and classified deterministically.",
            "Ownership and dependency metadata were analyzed where configured and available.",
            "Confidence remains capped until contract, obligation, and Phase 7 scoring checks land."
          ]
        : [
            "No file-backed scope was available for deterministic ownership or dependency analysis.",
            "Confidence remains low until a scope resolver supplies changed files."
          ]
  };
  const summary =
    status === "BLOCK"
      ? "Impact analysis found a sensitive ownership gap that blocks advisory approval until resolved."
      : "Impact analysis classified changed file surfaces and analyzed configured ownership and dependency metadata; deferred phases remain explicit unknowns.";

  return {
    phaseStatus: "ownership-dependencies-analyzed",
    impactId,
    status,
    impactStatus: status,
    risk,
    confidence,
    surfaces,
    areaSummary,
    surfaceSummary,
    ownership: ownershipResult.ownership,
    dependencyGraph: dependencyResult.dependencyGraph,
    findings,
    obligations: [],
    unknowns,
    evidence: allEvidence,
    report: {
      schemaVersion: "blueprint.impact.report.v1",
      impactId,
      status,
      summary,
      files,
      surfaces,
      areaSummary,
      surfaceSummary,
      ownership: ownershipResult.ownership,
      dependencyGraph: dependencyResult.dependencyGraph,
      findings,
      obligations: [],
      unknowns,
      evidence: allEvidence
    },
    warnings: [...new Set(warnings)].sort()
  };
}

export async function blueprintImpactReportWrite(
  args: ImpactReportWriteArgs = {}
): Promise<ImpactReportWriteResult> {
  await ensureRepoRoot(args.cwd);

  const impactId = args.impactId ?? PLACEHOLDER_IMPACT_ID;

  return {
    status: "disabled",
    impactId,
    impactDir: `.blueprint/impact/${impactId}`,
    paths: {
      impactMarkdown: null,
      impactJson: null,
      summaryJson: null,
      evidenceJsonl: null,
      reviewChecklist: null,
      questions: null
    },
    written: false,
    warnings: [
      IMPACT_PLACEHOLDER_WARNING,
      "Impact report writing is intentionally disabled until Phase 8 adds validated report persistence."
    ]
  };
}

export async function blueprintImpactOutputRender(
  args: ImpactOutputRenderArgs = {}
): Promise<ImpactOutputRenderResult> {
  await ensureRepoRoot(args.cwd);

  const mode = args.mode ?? "human";
  const impactId = args.impactId ?? PLACEHOLDER_IMPACT_ID;
  const content =
    mode === "json"
      ? JSON.stringify(
          {
            impactId,
            status: "WARN",
            warning: IMPACT_PLACEHOLDER_WARNING
          },
          null,
          2
        )
      : `Impact ${impactId}: WARN\n\n${IMPACT_PLACEHOLDER_WARNING}`;

  return {
    phaseStatus: "placeholder",
    mode,
    status: "WARN",
    impactStatus: "WARN",
    content,
    impactId,
    warnings: [
      IMPACT_PLACEHOLDER_WARNING,
      "Output rendering uses placeholder content until normalized report rendering lands in Phase 8."
    ]
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
      "Persist a validated impact report bundle under .blueprint/impact/<impact-id>/ when the report-writing phase is implemented.",
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
