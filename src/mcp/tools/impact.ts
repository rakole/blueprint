import { createHash } from "node:crypto";

import * as z from "zod/v4";

import { ensureRepoRoot } from "./artifacts.js";

type ImpactStatus = "PASS" | "WARN" | "BLOCK";
type ImpactRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
type ImpactConfidenceLevel = "low" | "medium" | "high";
type ImpactOutputMode = "human" | "json" | "markdown" | "pr-comment" | "summary";

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
  kind:
    | "unresolved"
    | "staged"
    | "working-tree"
    | "range"
    | "base-head"
    | "files"
    | "diff-file"
    | "description";
  description: string | null;
  files: string[];
  source: string;
};

type ImpactConfigGetResult = {
  status: "placeholder";
  config: Record<string, unknown>;
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
  status: "placeholder";
  scope: ImpactScopeSummary;
  changedFiles: string[];
  git: {
    mode: ImpactScopeResolveArgs["mode"];
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

type ImpactContextLoadResult = {
  status: "placeholder";
  project: null;
  config: null;
  roadmap: null;
  phases: unknown[];
  catalog: null;
  runtime: {
    registeredImpactTools: string[];
    includeRuntime: boolean;
    includeCatalog: boolean;
    includeArtifacts: boolean;
  };
  repoHints: {
    cwdAccepted: boolean;
    packageMetadataLoaded: boolean;
    artifactContractsLoaded: boolean;
  };
  warnings: string[];
};

type ImpactAnalyzeResult = {
  phaseStatus: "placeholder";
  impactId: string;
  status: ImpactStatus;
  impactStatus: ImpactStatus;
  risk: ImpactRisk;
  confidence: ImpactConfidence;
  surfaces: unknown[];
  findings: unknown[];
  obligations: unknown[];
  unknowns: string[];
  evidence: unknown[];
  report: Record<string, unknown>;
  warnings: string[];
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
  "/blu-impact Phase 2 MCP skeleton is registered; deterministic implementation continues in later impact phases.";
const IMPACT_SCHEMA_VERSION = "blueprint.impact.config.v1";
const PLACEHOLDER_IMPACT_ID = "impact-phase-2-placeholder";

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

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 12);
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

function getPlaceholderConfig(): Record<string, unknown> {
  return {
    schemaVersion: IMPACT_SCHEMA_VERSION,
    paths: {
      include: ["**/*"],
      ignore: ["node_modules/**", "coverage/**"],
      generated: ["dist/**", "**/*.generated.*"],
      docs: ["docs/**", "**/*.md"],
      tests: ["tests/**", "**/*.test.ts"]
    },
    ownership: {
      sources: ["CODEOWNERS", ".blueprint/impact/ownership.json"],
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

export async function blueprintImpactConfigGet(
  args: ImpactConfigGetArgs = {}
): Promise<ImpactConfigGetResult> {
  await ensureRepoRoot(args.cwd);

  const config = getPlaceholderConfig();
  const warnings = [
    IMPACT_PLACEHOLDER_WARNING,
    "Impact config merging is not active yet; returning the built-in safe-default shape only."
  ];

  if (args.configPath) {
    warnings.push(
      "Invocation configPath was accepted by the Phase 2 schema but is not read until Phase 3."
    );
  }

  if (args.strictConfig) {
    warnings.push(
      "strictConfig was accepted by the Phase 2 schema but is not enforced until Phase 3."
    );
  }

  if (args.overrides && Object.keys(args.overrides).length > 0) {
    warnings.push(
      "Config overrides were accepted by the Phase 2 schema but are not merged until Phase 3."
    );
  }

  return {
    status: "placeholder",
    config,
    provenance: {
      layersApplied: ["built-in-placeholder"],
      defaultsPath: null,
      projectPath: null,
      invocationPath: null
    },
    warnings,
    errors: [],
    configHash: stableHash(config)
  };
}

export async function blueprintImpactScopeResolve(
  args: ImpactScopeResolveArgs = {}
): Promise<ImpactScopeResolveResult> {
  await ensureRepoRoot(args.cwd);

  const mode = args.mode ?? "auto";
  const files = [...new Set(args.files ?? [])].sort();
  const description = args.description?.trim() || null;
  const hasSpecificScope = files.length > 0 || Boolean(args.range || args.base || args.head || args.diffFile);
  const kind: ImpactScopeSummary["kind"] =
    mode === "auto" && !hasSpecificScope && description ? "description" : mode === "auto" ? "unresolved" : mode;
  const fingerprintSeed = {
    mode,
    description,
    range: args.range ?? null,
    base: args.base ?? null,
    head: args.head ?? null,
    files,
    diffFile: args.diffFile ?? null,
    phase: args.phase ?? null,
    roadmapItem: args.roadmapItem ?? null,
    seedFile: args.seedFile ?? null,
    meta: args.meta ?? {}
  };

  return {
    status: "placeholder",
    scope: {
      kind,
      description,
      files,
      source: "phase-2-skeleton"
    },
    changedFiles: files,
    git: {
      mode,
      range: args.range ?? null,
      base: args.base ?? null,
      head: args.head ?? null
    },
    diffStats: {
      filesChanged: files.length,
      additions: null,
      deletions: null
    },
    patchHash: null,
    scopeFingerprint: stableHash(fingerprintSeed),
    confidence: placeholderConfidence(
      "Scope resolution has only validated inputs; git and diff inspection are implemented in Phase 3."
    ),
    warnings: [
      IMPACT_PLACEHOLDER_WARNING,
      "No git diff, patch, or file content has been inspected by the Phase 2 scope skeleton."
    ]
  };
}

export async function blueprintImpactContextLoad(
  args: ImpactContextLoadArgs = {}
): Promise<ImpactContextLoadResult> {
  await ensureRepoRoot(args.cwd);

  return {
    status: "placeholder",
    project: null,
    config: null,
    roadmap: null,
    phases: [],
    catalog: null,
    runtime: {
      registeredImpactTools: [...IMPACT_TOOL_NAMES],
      includeRuntime: args.includeRuntime ?? true,
      includeCatalog: args.includeCatalog ?? true,
      includeArtifacts: args.includeArtifacts ?? true
    },
    repoHints: {
      cwdAccepted: true,
      packageMetadataLoaded: false,
      artifactContractsLoaded: false
    },
    warnings: [
      IMPACT_PLACEHOLDER_WARNING,
      "Blueprint context, roadmap, catalog, runtime metadata, and repo hints are not loaded until Phase 4."
    ]
  };
}

export async function blueprintImpactAnalyze(
  args: ImpactAnalyzeArgs = {}
): Promise<ImpactAnalyzeResult> {
  await ensureRepoRoot(args.cwd);

  const impactId = placeholderImpactId({
    scope: args.scope ?? null,
    context: args.context ?? null,
    config: args.config ?? null
  });

  return {
    phaseStatus: "placeholder",
    impactId,
    status: "WARN",
    impactStatus: "WARN",
    risk: {
      level: "unknown",
      reasons: [
        "Impact analysis has not classified changed surfaces, ownership, dependencies, contracts, or obligations yet."
      ]
    },
    confidence: placeholderConfidence(
      "Phase 2 only proves the typed MCP seam exists; analysis scoring arrives in later phases."
    ),
    surfaces: [],
    findings: [],
    obligations: [],
    unknowns: [
      "unknown.impactAnalysisNotImplemented",
      "unknown.ownershipNotLoaded",
      "unknown.dependencyGraphNotLoaded"
    ],
    evidence: [],
    report: {
      schemaVersion: "blueprint.impact.report.v1",
      impactId,
      status: "WARN",
      summary:
        "Impact analysis is registered but not implemented; treat this as an advisory placeholder only."
    },
    warnings: [
      IMPACT_PLACEHOLDER_WARNING,
      "Analysis returns WARN with low confidence until surface classification, ownership, dependency, and scoring phases land."
    ]
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
