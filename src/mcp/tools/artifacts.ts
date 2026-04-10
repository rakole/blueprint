import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

export const BLUEPRINT_DIR = ".blueprint";
export const BLUEPRINT_STATE_PATH = `${BLUEPRINT_DIR}/STATE.md`;
export const BLUEPRINT_CONFIG_PATH = `${BLUEPRINT_DIR}/config.json`;
export const SUPPORTED_BOOTSTRAP_ARTIFACTS = [
  `${BLUEPRINT_DIR}/PROJECT.md`,
  `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
  `${BLUEPRINT_DIR}/ROADMAP.md`,
  `${BLUEPRINT_DIR}/phases/`
] as const;

export type SupportedBootstrapArtifact =
  (typeof SUPPORTED_BOOTSTRAP_ARTIFACTS)[number];

type ArtifactScaffoldArgs = {
  cwd?: string;
  artifacts?: string[];
  overwrite?: boolean;
  projectName?: string;
};

type ArtifactScaffoldResult = {
  createdFiles: string[];
  reusedFiles: string[];
  warnings: string[];
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

  return resolveRepoRelativePath(projectRoot, relativePath);
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

export const artifactToolDefinitions = [
  {
    name: "blueprint_artifact_scaffold",
    description:
      "Create or reuse the Blueprint bootstrap artifacts inside .blueprint/.",
    inputSchema: artifactScaffoldInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintArtifactScaffold(args as ArtifactScaffoldArgs)
  }
];
