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
const IMPACT_PROJECT_CONFIG_PATH = ".blueprint/impact/config.json";
const IMPACT_GLOBAL_DEFAULTS_BASENAME = "impact.defaults.json";
const GIT_COMMAND_TIMEOUT_MS = 15_000;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
