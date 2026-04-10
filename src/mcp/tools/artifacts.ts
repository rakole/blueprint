import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import { blueprintConfigGet } from "./config.js";

export const BLUEPRINT_DIR = ".blueprint";
export const BLUEPRINT_STATE_PATH = `${BLUEPRINT_DIR}/STATE.md`;
export const BLUEPRINT_CONFIG_PATH = `${BLUEPRINT_DIR}/config.json`;
export const BLUEPRINT_PHASES_PATH = `${BLUEPRINT_DIR}/phases`;
export const BLUEPRINT_REPORTS_PATH = `${BLUEPRINT_DIR}/reports`;
export const BLUEPRINT_CODEBASE_PATH = `${BLUEPRINT_DIR}/codebase`;
export const SUPPORTED_BOOTSTRAP_ARTIFACTS = [
  `${BLUEPRINT_DIR}/PROJECT.md`,
  `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
  `${BLUEPRINT_DIR}/ROADMAP.md`,
  `${BLUEPRINT_DIR}/phases/`
] as const;
export const CORE_PROJECT_ARTIFACTS = [
  `${BLUEPRINT_DIR}/PROJECT.md`,
  `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
  `${BLUEPRINT_DIR}/ROADMAP.md`,
  BLUEPRINT_STATE_PATH,
  BLUEPRINT_CONFIG_PATH,
  `${BLUEPRINT_DIR}/phases/`
] as const;
export const CODEBASE_ARTIFACTS = [
  `${BLUEPRINT_CODEBASE_PATH}/STACK.md`,
  `${BLUEPRINT_CODEBASE_PATH}/ARCHITECTURE.md`,
  `${BLUEPRINT_CODEBASE_PATH}/CONVENTIONS.md`,
  `${BLUEPRINT_CODEBASE_PATH}/TESTING.md`,
  `${BLUEPRINT_CODEBASE_PATH}/INTEGRATIONS.md`,
  `${BLUEPRINT_CODEBASE_PATH}/CONCERNS.md`
] as const;

export type SupportedBootstrapArtifact =
  (typeof SUPPORTED_BOOTSTRAP_ARTIFACTS)[number];
export type BlueprintReadiness = "uninitialized" | "partial" | "initialized";

type ArtifactScaffoldArgs = {
  cwd?: string;
  artifacts?: string[];
  overwrite?: boolean;
  projectName?: string;
};

type ArtifactListArgs = {
  cwd?: string;
};

type ArtifactScaffoldResult = {
  createdFiles: string[];
  reusedFiles: string[];
  warnings: string[];
};

type ArtifactListResult = {
  artifacts: {
    core: string[];
    phases: string[];
    codebase: string[];
  };
  reports: string[];
  missing: string[];
};

type ArtifactValidateArgs = {
  cwd?: string;
};

type ArtifactValidateResult = {
  valid: boolean;
  issues: string[];
  suggestedRepairs: string[];
};

type ArtifactRenderer = (projectName: string) => string;

const ARTIFACT_RENDERERS: Record<SupportedBootstrapArtifact, ArtifactRenderer> = {
  ".blueprint/PROJECT.md": (projectName) => `# ${projectName}

## Vision

Describe the product outcome Blueprint should help this repository reach.

## Audience

- Primary users:
- Secondary users:

## Constraints

- Installed as a Gemini CLI extension
- Project state lives in \`.blueprint/\`
- Persistent mutations must flow through Blueprint MCP tools

## Current Milestone

Define the smallest useful milestone that should land first.

## Non-Goals

- Hidden runtime conventions
- Undocumented aliases
- Prompt-only persistence
`,
  ".blueprint/REQUIREMENTS.md": (projectName) => `# Requirements: ${projectName}

## Requirements Table

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| RQ-01 | Replace this placeholder with the first real requirement. | Pending | Seeded by \`/blu:new-project\` |

## Acceptance Notes

- Convert placeholders into explicit requirements before planning.

## Deferred Items

- Add future work after the initial milestone is defined.
`,
  ".blueprint/ROADMAP.md": (projectName) => `# Roadmap: ${projectName}

## Milestone

- Active milestone: v1

## Phases

- [ ] Phase 1: Discovery and definition

## Notes

- Replace this starter roadmap with real phase goals before execution.
`,
  ".blueprint/phases/": () => ""
};

const artifactScaffoldInputSchema = {
  cwd: z.string().optional(),
  projectName: z.string().optional(),
  overwrite: z.boolean().optional(),
  artifacts: z.array(z.string()).optional()
};
const artifactListInputSchema = {
  cwd: z.string().optional()
};
const artifactValidateInputSchema = {
  cwd: z.string().optional()
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export function getProjectRoot(cwd?: string): string {
  return path.resolve(cwd ?? process.cwd());
}

export function getBlueprintRoot(cwd?: string): string {
  return path.join(getProjectRoot(cwd), BLUEPRINT_DIR);
}

export async function blueprintPathExists(targetPath: string): Promise<boolean> {
  return pathExists(targetPath);
}

export async function ensureRepoRoot(cwd?: string): Promise<string> {
  const projectRoot = getProjectRoot(cwd);
  const gitPath = path.join(projectRoot, ".git");

  if (!(await pathExists(gitPath))) {
    throw new Error(
      "Blueprint commands must run from the repository root; no .git entry was found in the current directory."
    );
  }

  return projectRoot;
}

export function toRepoRelativePath(projectRoot: string, absolutePath: string): string {
  return toPosixPath(path.relative(projectRoot, absolutePath));
}

export function resolveRepoRelativePath(
  projectRoot: string,
  relativePath: string
): string {
  const absolutePath = path.resolve(projectRoot, relativePath);
  const relativeToRoot = path.relative(projectRoot, absolutePath);

  if (
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new Error(`Path traversal is not allowed: ${relativePath}`);
  }

  return absolutePath;
}

export function resolveBlueprintPath(
  projectRoot: string,
  relativePath: string
): string {
  if (!relativePath.startsWith(`${BLUEPRINT_DIR}/`)) {
    throw new Error(
      `Blueprint artifacts must stay inside ${BLUEPRINT_DIR}/: ${relativePath}`
    );
  }

  const absolutePath = resolveRepoRelativePath(projectRoot, relativePath);
  const relativeToBlueprintRoot = path.relative(getBlueprintRoot(projectRoot), absolutePath);

  if (
    relativeToBlueprintRoot.startsWith("..") ||
    path.isAbsolute(relativeToBlueprintRoot)
  ) {
    throw new Error(`Path traversal is not allowed: ${relativePath}`);
  }

  return absolutePath;
}

export async function ensureParentDirectory(targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

export async function readJsonIfPresent(
  filePath: string
): Promise<Record<string, unknown> | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }

  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!isPlainObject(parsed)) {
    throw new Error(`${filePath} must contain a JSON object.`);
  }

  return parsed;
}

export async function writeJsonFile(
  filePath: string,
  value: Record<string, unknown>
): Promise<void> {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeTextFile(
  filePath: string,
  value: string
): Promise<void> {
  await ensureParentDirectory(filePath);
  await fs.writeFile(filePath, value, "utf8");
}

async function listRelativeFiles(rootPath: string, projectRoot: string): Promise<string[]> {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(absolutePath, projectRoot)));
      continue;
    }

    files.push(toRepoRelativePath(projectRoot, absolutePath));
  }

  return files.sort();
}

async function listImmediateDirectories(rootPath: string): Promise<string[]> {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function inspectBlueprintArtifacts(projectRoot: string): Promise<{
  readiness: BlueprintReadiness;
  blueprintRootExists: boolean;
  core: { present: string[]; missing: string[] };
  phases: string[];
  reports: string[];
  codebase: { present: string[]; missing: string[] };
}> {
  const blueprintRoot = getBlueprintRoot(projectRoot);
  const blueprintRootExists = await pathExists(blueprintRoot);
  const corePresent: string[] = [];
  const coreMissing: string[] = [];

  for (const artifact of CORE_PROJECT_ARTIFACTS) {
    const artifactPath = resolveBlueprintPath(projectRoot, artifact);

    if (await pathExists(artifactPath)) {
      corePresent.push(artifact);
    } else {
      coreMissing.push(artifact);
    }
  }

  const phases = await listRelativeFiles(
    resolveBlueprintPath(projectRoot, BLUEPRINT_PHASES_PATH),
    projectRoot
  );
  const reports = await listRelativeFiles(
    resolveBlueprintPath(projectRoot, BLUEPRINT_REPORTS_PATH),
    projectRoot
  );
  const codebasePresent: string[] = [];
  const codebaseMissing: string[] = [];

  for (const artifact of CODEBASE_ARTIFACTS) {
    const artifactPath = resolveBlueprintPath(projectRoot, artifact);

    if (await pathExists(artifactPath)) {
      codebasePresent.push(artifact);
    } else {
      codebaseMissing.push(artifact);
    }
  }

  const readiness: BlueprintReadiness = !blueprintRootExists
    ? "uninitialized"
    : coreMissing.length === 0
      ? "initialized"
      : "partial";

  return {
    readiness,
    blueprintRootExists,
    core: {
      present: corePresent,
      missing: coreMissing
    },
    phases,
    reports,
    codebase: {
      present: codebasePresent,
      missing: codebaseMissing
    }
  };
}

function normalizeRequestedArtifacts(
  requestedArtifacts?: string[]
): SupportedBootstrapArtifact[] {
  if (!requestedArtifacts || requestedArtifacts.length === 0) {
    return [...SUPPORTED_BOOTSTRAP_ARTIFACTS];
  }

  const normalized = requestedArtifacts.map((artifact) => {
    const value = artifact.trim();

    if (!SUPPORTED_BOOTSTRAP_ARTIFACTS.includes(value as SupportedBootstrapArtifact)) {
      throw new Error(`Unsupported Blueprint artifact requested: ${artifact}`);
    }

    return value as SupportedBootstrapArtifact;
  });

  return [...new Set(normalized)];
}

function inferProjectName(projectRoot: string, requestedName?: string): string {
  const trimmed = requestedName?.trim();

  if (trimmed) {
    return trimmed;
  }

  return path.basename(projectRoot);
}

export async function blueprintArtifactScaffold(
  args: ArtifactScaffoldArgs = {}
): Promise<ArtifactScaffoldResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const projectName = inferProjectName(projectRoot, args.projectName);
  const overwrite = args.overwrite ?? false;
  const artifacts = normalizeRequestedArtifacts(args.artifacts);
  const createdFiles: string[] = [];
  const reusedFiles: string[] = [];
  const warnings: string[] = [];

  await fs.mkdir(getBlueprintRoot(projectRoot), { recursive: true });

  for (const artifact of artifacts) {
    const absolutePath = resolveBlueprintPath(projectRoot, artifact);
    const exists = await pathExists(absolutePath);

    if (artifact.endsWith("/")) {
      if (exists) {
        reusedFiles.push(artifact);
      } else {
        await fs.mkdir(absolutePath, { recursive: true });
        createdFiles.push(artifact);
      }
      continue;
    }

    if (exists && !overwrite) {
      reusedFiles.push(artifact);
      continue;
    }

    const renderArtifact = ARTIFACT_RENDERERS[artifact];

    if (!renderArtifact) {
      warnings.push(`No renderer registered for ${artifact}; skipped.`);
      continue;
    }

    await writeTextFile(absolutePath, renderArtifact(projectName));

    if (exists) {
      warnings.push(`Replaced existing artifact: ${artifact}`);
    } else {
      createdFiles.push(artifact);
    }
  }

  return {
    createdFiles,
    reusedFiles,
    warnings
  };
}

export async function blueprintArtifactList(
  args: ArtifactListArgs = {}
): Promise<ArtifactListResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const missing = [...inspection.core.missing];

  if (inspection.codebase.present.length > 0 && inspection.codebase.missing.length > 0) {
    missing.push(...inspection.codebase.missing);
  }

  return {
    artifacts: {
      core: inspection.core.present,
      phases: inspection.phases,
      codebase: inspection.codebase.present
    },
    reports: inspection.reports,
    missing
  };
}

function collectPhaseBundleIssues(
  phaseArtifacts: string[],
  phaseDirectories: string[]
): string[] {
  const issues: string[] = [];

  for (const directoryName of phaseDirectories) {
    const phasePrefix = directoryName.match(/^(\d+(?:\.\d+)?)/)?.[1];

    if (!phasePrefix) {
      continue;
    }

    const expectedPrefix = `${BLUEPRINT_PHASES_PATH}/${directoryName}/${phasePrefix}`;
    const hasContext = phaseArtifacts.some((artifact) =>
      artifact.endsWith(`${expectedPrefix}-CONTEXT.md`)
    );
    const hasResearch = phaseArtifacts.some((artifact) =>
      artifact.endsWith(`${expectedPrefix}-RESEARCH.md`)
    );
    const hasPlan = phaseArtifacts.some((artifact) =>
      artifact.includes(`${expectedPrefix}-`) && artifact.endsWith("-PLAN.md")
    );

    if (!hasContext || !hasResearch || !hasPlan) {
      const missingParts = [
        !hasContext ? "CONTEXT" : null,
        !hasResearch ? "RESEARCH" : null,
        !hasPlan ? "PLAN" : null
      ].filter((value): value is string => value !== null);

      issues.push(
        `Phase artifact bundle is incomplete for ${directoryName}: missing ${missingParts.join(", ")}`
      );
    }
  }

  return issues;
}

export async function blueprintArtifactValidate(
  args: ArtifactValidateArgs = {}
): Promise<ArtifactValidateResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const issues: string[] = [];
  const suggestedRepairs = new Set<string>();

  if (!inspection.blueprintRootExists) {
    issues.push(`Missing ${BLUEPRINT_DIR}/ directory.`);
    suggestedRepairs.add("Run /blu:new-project to initialize Blueprint artifacts.");
  }

  for (const artifact of inspection.core.missing) {
    issues.push(`Missing core artifact: ${artifact}`);
  }

  if (inspection.core.missing.length > 0) {
    suggestedRepairs.add("Run /blu:health to inspect partial Blueprint state.");
    suggestedRepairs.add("Use /blu:health --repair only after reviewing the proposed writes.");
  }

  const configPath = resolveBlueprintPath(projectRoot, BLUEPRINT_CONFIG_PATH);
  const configExists = await pathExists(configPath);

  if (configExists) {
    try {
      const config = await blueprintConfigGet({
        scope: "project",
        cwd: projectRoot
      });

      for (const warning of config.warnings) {
        issues.push(`Config warning: ${warning}`);
      }

      if (config.warnings.length > 0) {
        suggestedRepairs.add(
          "Run /blu:health --repair to normalize malformed or legacy Blueprint config."
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(`Malformed config: ${message}`);
      suggestedRepairs.add(
        "Run /blu:health --repair to rewrite .blueprint/config.json in normalized form."
      );
    }
  }

  const phaseDirectories = await listImmediateDirectories(
    resolveBlueprintPath(projectRoot, BLUEPRINT_PHASES_PATH)
  );

  for (const issue of collectPhaseBundleIssues(inspection.phases, phaseDirectories)) {
    issues.push(issue);
    suggestedRepairs.add("Restore or regenerate the missing phase artifacts before execution.");
  }

  if (inspection.codebase.present.length > 0 && inspection.codebase.missing.length > 0) {
    issues.push(
      `Codebase artifact bundle is incomplete: missing ${inspection.codebase.missing.join(", ")}`
    );
    suggestedRepairs.add("Re-run /blu:map-codebase to recreate the missing codebase artifacts.");
  }

  return {
    valid: issues.length === 0,
    issues,
    suggestedRepairs: [...suggestedRepairs]
  };
}

export const artifactToolDefinitions = [
  {
    name: "blueprint_artifact_scaffold",
    description:
      "Create or reuse the Blueprint bootstrap artifacts inside .blueprint/.",
    inputSchema: artifactScaffoldInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactScaffold(args as ArtifactScaffoldArgs)
  },
  {
    name: "blueprint_artifact_list",
    description:
      "List Blueprint core, phase, codebase, and report artifacts without mutating the repo.",
    inputSchema: artifactListInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactList(args as ArtifactListArgs)
  },
  {
    name: "blueprint_artifact_validate",
    description:
      "Validate Blueprint artifact structure, config health, and bundle completeness.",
    inputSchema: artifactValidateInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactValidate(args as ArtifactValidateArgs)
  }
];
