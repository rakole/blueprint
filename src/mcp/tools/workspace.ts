import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import * as z from "zod/v4";

import {
  BLUEPRINT_DIR,
  BLUEPRINT_STATE_PATH,
  ensureRepoRoot,
  resolveBlueprintPath,
  toRepoRelativePath,
  writeJsonFile
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import type { BlueprintState } from "./state.js";
import { resolveBlueprintRuntimeHost } from "../runtime-host.js";
import {
  assertNoNullBytes,
  ensurePathWithinRootSync,
  isPathWithinRootSync,
  safeJsonParseObject,
  validateFieldNameSegment
} from "../../shared/security.js";

const execFileAsync = promisify(execFile);
const WORKSPACE_MANIFEST_FILE = ".blueprint-workspace.json";
const WORKSPACE_REGISTRY_VERSION = 1;
const WORKSPACE_STRATEGIES = ["worktree", "clone"] as const;
const PATCH_REGISTRY_VERSION = 1;
const PATCH_MANIFEST_VERSION = 1;
const PATCH_AUDIT_VERSION = 1;
const PATCH_AUDIT_ACTIONS = ["record", "preview", "reapply"] as const;
const PATCH_OUTCOMES = ["recorded", "applied", "conflict", "blocked"] as const;
const WORKSPACE_REGISTRY_LOCK_RETRY_MS = 50;
const WORKSPACE_REGISTRY_LOCK_STALE_MS = 60_000;
const WORKSTREAMS_ROOT_PATH = `${BLUEPRINT_DIR}/workstreams`;
const WORKSTREAMS_INDEX_PATH = `${WORKSTREAMS_ROOT_PATH}/WORKSTREAMS.md`;
const WORKSTREAM_STATE_FILENAME = "state.json";
const WORKSTREAM_STATE_VERSION = 1;
const WORKSTREAM_STATUSES = ["active", "paused", "completed"] as const;
const WORKSTREAM_OPERATIONS = ["create", "switch", "resume", "complete"] as const;
const WORKSTREAM_WAITING_STATES = [
  "workstream-switch-confirmation",
  "workstream-archive-confirmation",
  "missing-workstream",
  "missing-resume-snapshot",
  "dirty-working-tree",
  "corrupt-workstream-index"
] as const;
const WORKSTREAMS_COMMAND = "/blu-workstreams";
const PROGRESS_COMMAND = "/blu-progress";

type WorkspaceStrategy = (typeof WORKSPACE_STRATEGIES)[number];
type PatchAuditAction = (typeof PATCH_AUDIT_ACTIONS)[number];
type PatchOutcome = (typeof PATCH_OUTCOMES)[number];
type WorkstreamStatus = (typeof WORKSTREAM_STATUSES)[number];
type WorkstreamOperation = (typeof WORKSTREAM_OPERATIONS)[number];
type WorkstreamWaitingState = (typeof WORKSTREAM_WAITING_STATES)[number];

type WorkstreamStateSnapshot = Pick<
  BlueprintState,
  | "projectStatus"
  | "currentMilestone"
  | "currentPhase"
  | "activeCommand"
  | "nextAction"
  | "blockers"
  | "roadmapEvolutionNotes"
  | "lastUpdated"
>;

type WorkstreamStateDocument = {
  version: number;
  name: string;
  slug: string;
  status: WorkstreamStatus;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  completedAt: string | null;
  stateSnapshot: WorkstreamStateSnapshot | null;
};

type WorkstreamSummary = WorkstreamStateDocument & {
  statePath: string;
};

type WorkstreamListArgs = {
  cwd?: string;
};

type WorkstreamListResult = {
  status: "ready" | "project_missing" | "invalid";
  rootPath: string;
  indexPath: string;
  active: WorkstreamSummary | null;
  workstreams: WorkstreamSummary[];
  summary: {
    total: number;
    active: number;
    paused: number;
    completed: number;
    nextAction: string | null;
  };
  warnings: string[];
  waitingState: WorkstreamWaitingState | null;
  reason: string | null;
};

type WorkstreamMutateArgs = {
  cwd?: string;
  operation: WorkstreamOperation;
  workstream: string;
};

type WorkstreamMutateResult = {
  status: "updated" | "reused" | "blocked" | "project_missing" | "invalid";
  operation: WorkstreamOperation;
  rootPath: string;
  indexPath: string;
  active: WorkstreamSummary | null;
  workstreams: WorkstreamSummary[];
  affectedPaths: string[];
  warnings: string[];
  waitingState: WorkstreamWaitingState | null;
  nextAction: string | null;
  reason: string | null;
  statePatch: Partial<BlueprintState> | null;
};

type WorkspaceRepoMember = {
  name: string;
  sourcePath: string;
  path: string;
  strategy: WorkspaceStrategy;
  branch: string | null;
  head: string;
  blueprintProject: boolean;
};

type WorkspaceRegistryEntry = {
  name: string;
  path: string;
  manifestPath: string;
  strategy: WorkspaceStrategy;
  branch: string | null;
  createdAt: string;
  repos: WorkspaceRepoMember[];
};

type WorkspaceRegistryDocument = {
  version: number;
  workspaces: WorkspaceRegistryEntry[];
};

type WorkspaceRegistryGetArgs = {
  cwd?: string;
};

type WorkspaceRegistryGetResult = {
  registryPath: string;
  workspaces: WorkspaceRegistryEntry[];
};

type WorkspaceCreateArgs = {
  cwd?: string;
  name: string;
  repos?: string[];
  path?: string;
  strategy?: WorkspaceStrategy;
  branch?: string;
};

type WorkspaceCreateResult = {
  workspacePath: string;
  manifestPath: string;
  registryPath: string;
  registryEntry: WorkspaceRegistryEntry;
  repoMembers: WorkspaceRepoMember[];
};

type ResolvedSourceRepo = {
  name: string;
  sourcePath: string;
  defaultBranch: string | null;
  head: string;
  blueprintProject: boolean;
};

type CreatedWorkspaceMember = WorkspaceRepoMember & {
  rollbackStrategy: WorkspaceStrategy;
  createdSourceBranch: string | null;
};

type PatchCompatibility = {
  host: string | null;
  repoRootName: string;
  remoteUrl: string | null;
};

type PatchManifest = {
  version: number;
  patchId: string;
  label: string | null;
  createdAt: string;
  sourceVersion: string | null;
  repoRootName: string;
  repoRemote: string | null;
  patchFile: string;
  patchHash: string;
  trackedFiles: string[];
  compatibility: PatchCompatibility;
  lastAppliedAt: string | null;
  lastOutcome: PatchOutcome | null;
};

type PatchAuditEntry = {
  version: number;
  timestamp: string;
  action: PatchAuditAction;
  outcome: PatchOutcome;
  cwd: string;
  repoRoot: string;
  targetHead: string | null;
  trackedFiles: string[];
  conflicts: string[];
  warnings: string[];
  dryRun: boolean;
};

type PatchRegistryDocument = {
  version: number;
  patches: string[];
};

type PatchListArgs = {
  cwd?: string;
  patchIds?: string[];
};

type PatchListResult = {
  registryPath: string;
  patches: Array<{
    patchId: string;
    label: string | null;
    createdAt: string;
    sourceVersion: string | null;
    trackedFiles: string[];
    manifestPath: string;
    patchPath: string;
    auditPath: string;
    lastAppliedAt: string | null;
    lastOutcome: PatchOutcome | null;
    compatibility: {
      status: "compatible" | "mismatch" | "unknown";
      reasons: string[];
    };
  }>;
};

type PatchRecordArgs = {
  cwd?: string;
  patchId: string;
  patch?: string;
  trackedFiles: string[];
  label?: string;
  sourceVersion?: string;
  compatibility?: Partial<PatchCompatibility>;
  audit?: {
    action?: PatchAuditAction;
    outcome?: PatchOutcome;
    conflicts?: string[];
    warnings?: string[];
    dryRun?: boolean;
    targetHead?: string | null;
  };
};

type PatchRecordResult = {
  patchId: string;
  registryPath: string;
  manifestPath: string;
  patchPath: string;
  auditPath: string;
  trackedFiles: string[];
  updated: boolean;
};

type PatchReapplyArgs = {
  cwd?: string;
  patchIds?: string[];
  dryRun?: boolean;
};

type PatchConflict = {
  patchId: string;
  message: string;
};

type PatchReapplyResult = {
  registryPath: string;
  appliedPatches: string[];
  skippedPatches: string[];
  conflicts: PatchConflict[];
  preview: boolean;
  targetHead: string | null;
};

const workspaceRegistryGetInputSchema = {
  cwd: z.string().optional()
};

const workspaceCreateInputSchema = {
  cwd: z.string().optional(),
  name: z.string().trim().min(1),
  repos: z.array(z.string().trim().min(1)).optional(),
  path: z.string().trim().min(1).optional(),
  strategy: z.enum(WORKSPACE_STRATEGIES).optional(),
  branch: z.string().trim().min(1).optional()
};
const workstreamListInputSchema = {
  cwd: z.string().optional()
};
const workstreamMutateInputSchema = {
  cwd: z.string().optional(),
  operation: z.enum(WORKSTREAM_OPERATIONS),
  workstream: z.string().trim().min(1)
};
const patchListInputSchema = {
  cwd: z.string().optional(),
  patchIds: z.array(z.string().trim().min(1)).optional()
};
const patchRecordInputSchema = {
  cwd: z.string().optional(),
  patchId: z.string().trim().min(1),
  patch: z.string().min(1).optional(),
  trackedFiles: z.array(z.string().trim().min(1)).min(1),
  label: z.string().trim().min(1).optional(),
  sourceVersion: z.string().trim().min(1).optional(),
  compatibility: z
    .object({
      host: z.string().trim().min(1).nullable().optional(),
      repoRootName: z.string().trim().min(1).optional(),
      remoteUrl: z.string().trim().min(1).nullable().optional()
    })
    .optional(),
  audit: z
    .object({
      action: z.enum(PATCH_AUDIT_ACTIONS).optional(),
      outcome: z.enum(PATCH_OUTCOMES).optional(),
      conflicts: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional(),
      dryRun: z.boolean().optional(),
      targetHead: z.string().trim().min(1).nullable().optional()
    })
    .optional()
};
const patchReapplyInputSchema = {
  cwd: z.string().optional(),
  patchIds: z.array(z.string().trim().min(1)).optional(),
  dryRun: z.boolean().optional()
};

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

function normalizeWorkspaceName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, "-");
  validateFieldNameSegment(trimmed, "Workspace name");
  return trimmed;
}

function normalizeWorkstreamName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  assertNoNullBytes(normalized, "Workstream name");

  if (normalized.length === 0) {
    throw new Error("Workstream name is required.");
  }

  return normalized;
}

function slugifyWorkstreamName(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .replace(/[_\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length === 0) {
    throw new Error(`Workstream name must include letters or numbers: ${value}`);
  }

  validateFieldNameSegment(slug, "Workstream slug");
  return slug;
}

function slugifyRepoName(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
    .replace(/[_\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "repo";
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeTextForComparison(value: string): string {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`(?:^|\\n)## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  );

  return match?.[1]?.trim() ?? "";
}

function parseBulletSection(markdown: string, heading: string): string[] {
  return extractMarkdownSection(markdown, heading)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0 && line.toLowerCase() !== "none");
}

function parseStateSnapshot(raw: string): WorkstreamStateSnapshot {
  const getLineValue = (label: string): string | null => {
    const match = raw.match(new RegExp(`^- ${label}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : null;
  };
  const getRequiredLineValue = (label: string): string => {
    const value = getLineValue(label);

    if (!value) {
      throw new Error(`STATE.md is malformed; missing required field "${label}".`);
    }

    return value;
  };

  return {
    projectStatus: getRequiredLineValue("Project status"),
    currentMilestone: getRequiredLineValue("Current milestone"),
    currentPhase: getRequiredLineValue("Current phase"),
    activeCommand: getRequiredLineValue("Active command"),
    nextAction: getRequiredLineValue("Next action"),
    lastUpdated: getRequiredLineValue("Last updated"),
    blockers: parseBulletSection(raw, "Blockers"),
    roadmapEvolutionNotes: parseBulletSection(raw, "Roadmap Evolution Notes")
  };
}

async function readCurrentStateSnapshot(
  projectRoot: string
): Promise<WorkstreamStateSnapshot | null> {
  const statePath = resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH);

  if (!(await pathExists(statePath))) {
    return null;
  }

  const raw = await fs.readFile(statePath, "utf8");
  return parseStateSnapshot(raw);
}

async function readRequiredCurrentStateSnapshot(
  projectRoot: string
): Promise<
  | {
      status: "ready";
      snapshot: WorkstreamStateSnapshot;
    }
  | {
      status: "blocked";
      reason: string;
    }
> {
  const statePath = resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH);
  const stateRelativePath = toRepoRelativePath(projectRoot, statePath);

  try {
    const snapshot = await readCurrentStateSnapshot(projectRoot);

    if (!snapshot) {
      return {
        status: "blocked",
        reason: `Cannot capture the current active workstream because ${stateRelativePath} is missing.`
      };
    }

    return {
      status: "ready",
      snapshot
    };
  } catch (error) {
    return {
      status: "blocked",
      reason:
        error instanceof Error
          ? `Cannot capture the current active workstream because ${stateRelativePath} could not be read: ${error.message}`
          : `Cannot capture the current active workstream because ${stateRelativePath} could not be read.`
    };
  }
}

function normalizeStateSnapshot(value: unknown, slug: string): WorkstreamStateSnapshot | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "object") {
    throw new Error(`Workstream snapshot is malformed for ${slug}.`);
  }

  const snapshot = value as Record<string, unknown>;
  const stringField = (field: keyof WorkstreamStateSnapshot): string => {
    const currentValue = snapshot[field];

    if (typeof currentValue !== "string" || currentValue.trim().length === 0) {
      throw new Error(`Workstream snapshot field ${field} is malformed for ${slug}.`);
    }

    return currentValue;
  };
  const arrayField = (field: "blockers" | "roadmapEvolutionNotes"): string[] => {
    const currentValue = snapshot[field];

    if (!Array.isArray(currentValue)) {
      throw new Error(`Workstream snapshot field ${field} is malformed for ${slug}.`);
    }

    return currentValue.map((entry) => {
      if (typeof entry !== "string" || entry.trim().length === 0) {
        throw new Error(`Workstream snapshot field ${field} is malformed for ${slug}.`);
      }

      return entry;
    });
  };

  return {
    projectStatus: stringField("projectStatus"),
    currentMilestone: stringField("currentMilestone"),
    currentPhase: stringField("currentPhase"),
    activeCommand: stringField("activeCommand"),
    nextAction: stringField("nextAction"),
    lastUpdated: stringField("lastUpdated"),
    blockers: arrayField("blockers"),
    roadmapEvolutionNotes: arrayField("roadmapEvolutionNotes")
  };
}

function normalizeWorkstreamStateDocument(
  value: unknown,
  expectedSlug: string
): WorkstreamStateDocument {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Workstream state is malformed for ${expectedSlug}.`);
  }

  const document = value as Record<string, unknown>;

  if (
    typeof document.version !== "number" ||
    typeof document.name !== "string" ||
    typeof document.slug !== "string" ||
    typeof document.status !== "string" ||
    typeof document.createdAt !== "string" ||
    typeof document.updatedAt !== "string"
  ) {
    throw new Error(`Workstream state is missing required fields for ${expectedSlug}.`);
  }

  if (document.version !== WORKSTREAM_STATE_VERSION) {
    throw new Error(
      `Workstream state version is unsupported for ${expectedSlug}: ${document.version}.`
    );
  }

  const slug = slugifyWorkstreamName(document.slug);

  if (slug !== expectedSlug) {
    throw new Error(
      `Workstream state slug mismatch for ${expectedSlug}; recorded slug is ${document.slug}.`
    );
  }

  if (!WORKSTREAM_STATUSES.includes(document.status as WorkstreamStatus)) {
    throw new Error(`Workstream state has unsupported status for ${expectedSlug}.`);
  }

  return {
    version: document.version,
    name: normalizeWorkstreamName(document.name),
    slug,
    status: document.status as WorkstreamStatus,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    activatedAt: typeof document.activatedAt === "string" ? document.activatedAt : null,
    completedAt: typeof document.completedAt === "string" ? document.completedAt : null,
    stateSnapshot: normalizeStateSnapshot(document.stateSnapshot, slug)
  };
}

function compareWorkstreams(left: WorkstreamStateDocument, right: WorkstreamStateDocument): number {
  const statusOrder: Record<WorkstreamStatus, number> = {
    active: 0,
    paused: 1,
    completed: 2
  };

  const statusComparison = statusOrder[left.status] - statusOrder[right.status];

  if (statusComparison !== 0) {
    return statusComparison;
  }

  const createdComparison = left.createdAt.localeCompare(right.createdAt);

  if (createdComparison !== 0) {
    return createdComparison;
  }

  return left.name.localeCompare(right.name);
}

function summarizeSnapshot(snapshot: WorkstreamStateSnapshot | null): string {
  if (!snapshot) {
    return "none";
  }

  return `Phase ${snapshot.currentPhase}; ${snapshot.activeCommand}`;
}

function summarizeCounts(workstreams: WorkstreamStateDocument[]): string {
  const counts = {
    active: workstreams.filter((entry) => entry.status === "active").length,
    paused: workstreams.filter((entry) => entry.status === "paused").length,
    completed: workstreams.filter((entry) => entry.status === "completed").length
  };

  return `${counts.active} active, ${counts.paused} paused, ${counts.completed} completed`;
}

function renderWorkstreamsIndex(workstreams: WorkstreamStateDocument[]): string {
  const ordered = [...workstreams].sort(compareWorkstreams);
  const active = ordered.find((entry) => entry.status === "active") ?? null;
  const rows =
    ordered.length === 0
      ? "| none | none | none | none | none |\n"
      : ordered
          .map(
            (entry) =>
              `| \`${entry.name}\` | \`${entry.slug}\` | \`${entry.status}\` | \`${summarizeSnapshot(entry.stateSnapshot)}\` | \`${entry.updatedAt}\` |`
          )
          .join("\n");

  return [
    "# Blueprint Workstreams",
    "",
    `- Active workstream: ${active ? `\`${active.name}\`` : "none"}`,
    `- Workstream counts: ${summarizeCounts(ordered)}`,
    "",
    "| Name | Slug | Status | Snapshot | Updated |",
    "|---|---|---|---|---|",
    rows,
    ""
  ].join("\n");
}

async function writeFileAtomically(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}

async function writeJsonAtomically(
  filePath: string,
  value: Record<string, unknown>
): Promise<void> {
  await writeFileAtomically(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

type WorkstreamFileSnapshot = {
  path: string;
  existed: boolean;
  content: string | null;
};

type WorkstreamDirectorySnapshot = {
  path: string;
  existed: boolean;
};

async function snapshotFiles(paths: string[]): Promise<WorkstreamFileSnapshot[]> {
  return Promise.all(
    [...new Set(paths)].map(async (targetPath) => {
      if (!(await pathExists(targetPath))) {
        return {
          path: targetPath,
          existed: false,
          content: null
        };
      }

      return {
        path: targetPath,
        existed: true,
        content: await fs.readFile(targetPath, "utf8")
      };
    })
  );
}

async function snapshotDirectories(paths: string[]): Promise<WorkstreamDirectorySnapshot[]> {
  return Promise.all(
    [...new Set(paths)].map(async (targetPath) => ({
      path: targetPath,
      existed: await pathExists(targetPath)
    }))
  );
}

async function restoreFileSnapshots(snapshots: WorkstreamFileSnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    if (!snapshot.existed) {
      await fs.rm(snapshot.path, { force: true }).catch(() => undefined);
      continue;
    }

    await fs.mkdir(path.dirname(snapshot.path), { recursive: true });
    await fs.writeFile(snapshot.path, snapshot.content ?? "", "utf8");
  }
}

async function restoreDirectorySnapshots(
  snapshots: WorkstreamDirectorySnapshot[]
): Promise<void> {
  const missingDirectories = snapshots
    .filter((snapshot) => !snapshot.existed)
    .sort((left, right) => right.path.length - left.path.length);

  for (const snapshot of missingDirectories) {
    await fs.rm(snapshot.path, { recursive: true, force: true }).catch(() => undefined);
  }
}

function workstreamsRootAbsolute(projectRoot: string): string {
  return resolveBlueprintPath(projectRoot, WORKSTREAMS_ROOT_PATH);
}

function workstreamsIndexAbsolute(projectRoot: string): string {
  return resolveBlueprintPath(projectRoot, WORKSTREAMS_INDEX_PATH);
}

function workstreamStateAbsolute(projectRoot: string, slug: string): string {
  return path.join(workstreamsRootAbsolute(projectRoot), slug, WORKSTREAM_STATE_FILENAME);
}

function workstreamSummary(
  projectRoot: string,
  entry: WorkstreamStateDocument
): WorkstreamSummary {
  return {
    ...entry,
    statePath: toRepoRelativePath(projectRoot, workstreamStateAbsolute(projectRoot, entry.slug))
  };
}

function workstreamNextAction(workstreams: WorkstreamStateDocument[]): string | null {
  if (workstreams.length === 0) {
    return `Run ${WORKSTREAMS_COMMAND} create <name> to add the first project-local workstream`;
  }

  const active = workstreams.find((entry) => entry.status === "active");

  if (active) {
    return `Run ${PROGRESS_COMMAND} or ${WORKSTREAMS_COMMAND} resume ${active.slug} to continue the active workstream`;
  }

  const resumable = workstreams.find((entry) => entry.stateSnapshot !== null);

  if (resumable) {
    return `Run ${WORKSTREAMS_COMMAND} resume ${resumable.slug} to restore saved state for that workstream`;
  }

  const paused = workstreams.find((entry) => entry.status === "paused");

  if (paused) {
    return `Run ${WORKSTREAMS_COMMAND} switch ${paused.slug} to make that paused workstream active`;
  }

  return `Run ${WORKSTREAMS_COMMAND} create <name> to add another workstream`;
}

function buildResumeStatePatch(
  snapshot: WorkstreamStateSnapshot | null
): Partial<BlueprintState> | null {
  if (!snapshot) {
    return null;
  }

  return {
    projectStatus: snapshot.projectStatus,
    currentMilestone: snapshot.currentMilestone,
    currentPhase: snapshot.currentPhase,
    activeCommand: snapshot.activeCommand,
    nextAction: snapshot.nextAction,
    blockers: snapshot.blockers,
    roadmapEvolutionNotes: snapshot.roadmapEvolutionNotes
  };
}

type LoadedWorkstreamStore =
  | {
      status: "ready";
      projectRoot: string;
      rootPath: string;
      indexPath: string;
      workstreams: WorkstreamStateDocument[];
      active: WorkstreamStateDocument | null;
      warnings: string[];
    }
  | {
      status: "project_missing" | "invalid";
      projectRoot: string;
      rootPath: string;
      indexPath: string;
      workstreams: WorkstreamStateDocument[];
      active: null;
      warnings: string[];
      waitingState: WorkstreamWaitingState | null;
      reason: string;
    };

async function loadWorkstreamStore(projectRoot: string): Promise<LoadedWorkstreamStore> {
  const blueprintRoot = path.join(projectRoot, BLUEPRINT_DIR);
  const rootPath = workstreamsRootAbsolute(projectRoot);
  const indexPath = workstreamsIndexAbsolute(projectRoot);

  if (!(await pathExists(blueprintRoot))) {
    return {
      status: "project_missing",
      projectRoot,
      rootPath,
      indexPath,
      workstreams: [],
      active: null,
      warnings: [],
      waitingState: null,
      reason: "Blueprint project state is missing; initialize the repo before managing workstreams."
    };
  }

  let entries: Array<{ isDirectory: () => boolean; isFile: () => boolean; name: string }>;

  try {
    entries = (await fs.readdir(rootPath, {
      encoding: "utf8",
      withFileTypes: true
    })) as Array<{ isDirectory: () => boolean; isFile: () => boolean; name: string }>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        status: "ready",
        projectRoot,
        rootPath,
        indexPath,
        workstreams: [],
        active: null,
        warnings: []
      };
    }

    throw error;
  }

  try {
    const workstreams: WorkstreamStateDocument[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        continue;
      }

      if (!entry.isDirectory()) {
        continue;
      }

      const statePath = path.join(rootPath, entry.name, WORKSTREAM_STATE_FILENAME);

      if (!(await pathExists(statePath))) {
        throw new Error(`Workstream directory is missing ${WORKSTREAM_STATE_FILENAME}: ${entry.name}`);
      }

      const raw = await fs.readFile(statePath, "utf8");
      const parsed = safeJsonParseObject(raw, {
        label: statePath
      });
      workstreams.push(normalizeWorkstreamStateDocument(parsed, entry.name));
    }

    workstreams.sort(compareWorkstreams);

    const activeWorkstreams = workstreams.filter((entry) => entry.status === "active");

    if (activeWorkstreams.length > 1) {
      throw new Error("More than one active workstream is recorded on disk.");
    }

    const expectedIndex = renderWorkstreamsIndex(workstreams);
    const indexExists = await pathExists(indexPath);

    if (workstreams.length > 0 && !indexExists) {
      throw new Error("The workstream index is missing while workstream state files exist.");
    }

    if (indexExists) {
      const actualIndex = await fs.readFile(indexPath, "utf8");

      if (
        normalizeTextForComparison(actualIndex) !==
        normalizeTextForComparison(expectedIndex)
      ) {
        throw new Error("The workstream index is stale relative to the canonical state files.");
      }
    }

    return {
      status: "ready",
      projectRoot,
      rootPath,
      indexPath,
      workstreams,
      active: activeWorkstreams[0] ?? null,
      warnings: []
    };
  } catch (error) {
    return {
      status: "invalid",
      projectRoot,
      rootPath,
      indexPath,
      workstreams: [],
      active: null,
      warnings: [],
      waitingState: "corrupt-workstream-index",
      reason:
        error instanceof Error
          ? `Workstream state is corrupt: ${error.message}`
          : "Workstream state is corrupt."
    };
  }
}

function buildWorkstreamListResult(store: LoadedWorkstreamStore): WorkstreamListResult {
  const summaries =
    store.status === "ready"
      ? store.workstreams.map((entry) => workstreamSummary(store.projectRoot, entry))
      : [];

  return {
    status: store.status,
    rootPath: toRepoRelativePath(store.projectRoot, store.rootPath),
    indexPath: toRepoRelativePath(store.projectRoot, store.indexPath),
    active:
      store.status === "ready" && store.active
        ? workstreamSummary(store.projectRoot, store.active)
        : null,
    workstreams: summaries,
    summary: {
      total: summaries.length,
      active: summaries.filter((entry) => entry.status === "active").length,
      paused: summaries.filter((entry) => entry.status === "paused").length,
      completed: summaries.filter((entry) => entry.status === "completed").length,
      nextAction: store.status === "ready" ? workstreamNextAction(store.workstreams) : null
    },
    warnings: store.warnings,
    waitingState: store.status === "ready" ? null : store.waitingState,
    reason: store.status === "ready" ? null : store.reason
  };
}

function buildMutationResult(
  store: LoadedWorkstreamStore,
  base: Omit<
    WorkstreamMutateResult,
    "rootPath" | "indexPath" | "active" | "workstreams" | "warnings"
  >
): WorkstreamMutateResult {
  return {
    ...base,
    rootPath: toRepoRelativePath(store.projectRoot, store.rootPath),
    indexPath: toRepoRelativePath(store.projectRoot, store.indexPath),
    active:
      store.status === "ready" && store.active
        ? workstreamSummary(store.projectRoot, store.active)
        : null,
    workstreams:
      store.status === "ready"
        ? store.workstreams.map((entry) => workstreamSummary(store.projectRoot, entry))
        : [],
    warnings: store.warnings
  };
}

function buildMissingCurrentStateSnapshotResult(
  store: LoadedWorkstreamStore,
  operation: WorkstreamOperation,
  projectRoot: string,
  reason: string
): WorkstreamMutateResult {
  const statePath = toRepoRelativePath(
    projectRoot,
    resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH)
  );

  return buildMutationResult(store, {
    status: "blocked",
    operation,
    affectedPaths: [],
    waitingState: "missing-resume-snapshot",
    nextAction: `Run ${PROGRESS_COMMAND} to regenerate ${statePath} before retrying the requested workstream change.`,
    reason,
    statePatch: null
  });
}

function findWorkstreamEntry(
  workstreams: WorkstreamStateDocument[],
  requested: string
): WorkstreamStateDocument | null {
  const normalizedName = requested.trim().toLowerCase();
  let requestedSlug: string | null = null;

  try {
    requestedSlug = slugifyWorkstreamName(requested);
  } catch {
    requestedSlug = null;
  }

  return (
    workstreams.find((entry) => entry.slug === requested) ??
    workstreams.find((entry) => entry.name.toLowerCase() === normalizedName) ??
    (requestedSlug
      ? workstreams.find((entry) => entry.slug === requestedSlug) ?? null
      : null)
  );
}

async function persistWorkstreamState(
  projectRoot: string,
  workstreams: WorkstreamStateDocument[],
  affectedSlugs: string[]
): Promise<string[]> {
  const indexPath = workstreamsIndexAbsolute(projectRoot);
  const indexRelativePath = toRepoRelativePath(projectRoot, indexPath);
  const uniqueSlugs = [...new Set(affectedSlugs)];
  const statePaths = uniqueSlugs.map((slug) => workstreamStateAbsolute(projectRoot, slug));
  const snapshots = await snapshotFiles([indexPath, ...statePaths]);
  const directorySnapshots = await snapshotDirectories([
    workstreamsRootAbsolute(projectRoot),
    ...uniqueSlugs.map((slug) => path.dirname(workstreamStateAbsolute(projectRoot, slug)))
  ]);

  try {
    for (const slug of uniqueSlugs) {
      const entry = workstreams.find((candidate) => candidate.slug === slug);

      if (!entry) {
        continue;
      }

      await writeJsonAtomically(
        workstreamStateAbsolute(projectRoot, slug),
        entry as unknown as Record<string, unknown>
      );
    }

    await writeFileAtomically(indexPath, renderWorkstreamsIndex(workstreams));
  } catch (error) {
    await restoreFileSnapshots(snapshots);
    await restoreDirectorySnapshots(directorySnapshots);
    throw error;
  }

  return [
    ...uniqueSlugs.map((slug) =>
      toRepoRelativePath(projectRoot, workstreamStateAbsolute(projectRoot, slug))
    ),
    indexRelativePath
  ];
}

async function runGit(
  args: string[],
  options: { cwd?: string; allowFailure?: boolean } = {}
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: options.cwd
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      success: true
    };
  } catch (error) {
    if (options.allowFailure) {
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
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: false
      };
    }

    if (error instanceof Error) {
      throw new Error(error.message);
    }

    throw error;
  }
}

async function resolveGitRepoRoot(candidatePath: string): Promise<string> {
  const result = await runGit(["-C", candidatePath, "rev-parse", "--show-toplevel"], {
    allowFailure: true
  });

  if (!result.success || !result.stdout) {
    throw new Error(`Workspace source repo is not a valid git repository: ${candidatePath}`);
  }

  return result.stdout;
}

async function gitCurrentBranch(repoPath: string): Promise<string | null> {
  const result = await runGit(["-C", repoPath, "branch", "--show-current"], {
    allowFailure: true
  });

  return result.success && result.stdout.length > 0 ? result.stdout : null;
}

async function gitHeadSha(repoPath: string): Promise<string> {
  const result = await runGit(["-C", repoPath, "rev-parse", "HEAD"], {
    allowFailure: true
  });

  if (!result.success || result.stdout.length === 0) {
    throw new Error(`Unable to resolve HEAD for workspace source repo: ${repoPath}`);
  }

  return result.stdout;
}

async function gitWorkingTreeClean(repoPath: string): Promise<boolean> {
  const result = await runGit(["-C", repoPath, "status", "--short"], {
    allowFailure: true
  });

  return result.success && result.stdout.length === 0;
}

async function gitWorkingTreeCleanForWorkstreamTransition(
  repoPath: string
): Promise<boolean> {
  const result = await runGit(
    [
      "-C",
      repoPath,
      "status",
      "--short",
      "--untracked-files=all",
      "--",
      ".",
      `:(exclude)${WORKSTREAMS_ROOT_PATH}/**`,
      `:(exclude)${BLUEPRINT_STATE_PATH}`
    ],
    {
      allowFailure: true
    }
  );

  return result.success && result.stdout.length === 0;
}

async function localBranchExists(repoPath: string, branch: string): Promise<boolean> {
  const result = await runGit(
    ["-C", repoPath, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
    { allowFailure: true }
  );

  return result.success && result.stdout.length > 0;
}

async function remoteBranchExists(repoPath: string, branch: string): Promise<boolean> {
  const result = await runGit(
    ["-C", repoPath, "rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`],
    { allowFailure: true }
  );

  return result.success && result.stdout.length > 0;
}

function parseWorkspaceRegistryDocument(
  raw: string,
  registryPath: string
): WorkspaceRegistryDocument {
  const parsed = safeJsonParseObject(raw, {
    label: registryPath
  }) as unknown;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("workspaces" in parsed) ||
    !Array.isArray((parsed as { workspaces?: unknown }).workspaces)
  ) {
    throw new Error(
      `Workspace registry is malformed at ${registryPath}; repair or remove it before creating a new workspace.`
    );
  }

  const workspaces = ((parsed as { workspaces: unknown[] }).workspaces ?? []).map(
    normalizeRegistryEntry
  );

  const parsedRecord = parsed as Record<string, unknown>;
  const version = parsedRecord.version;

  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error(
      `Workspace registry is malformed at ${registryPath}; version must be ${WORKSPACE_REGISTRY_VERSION}.`
    );
  }

  if (version !== WORKSPACE_REGISTRY_VERSION) {
    throw new Error(
      `Workspace registry version is unsupported at ${registryPath}: ${version}.`
    );
  }

  return {
    version,
    workspaces
  };
}

async function listWorkspaceRegistryBackups(registryPath: string): Promise<string[]> {
  const directory = path.dirname(registryPath);
  const backupPrefix = `${path.basename(registryPath)}.bak-`;

  let entries: Array<{ isFile: () => boolean; name: string }>;

  try {
    entries = (await fs.readdir(directory, {
      encoding: "utf8",
      withFileTypes: true
    })) as Array<{ isFile: () => boolean; name: string }>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const backupCandidates = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(backupPrefix))
    .map((entry) => path.join(directory, entry.name));

  const backupsWithStats = await Promise.all(
    backupCandidates.map(async (backupPath) => {
      try {
        const stats = await fs.stat(backupPath);
        return {
          backupPath,
          mtimeMs: stats.mtimeMs
        };
      } catch {
        return null;
      }
    })
  );

  return backupsWithStats
    .filter((entry): entry is { backupPath: string; mtimeMs: number } => entry !== null)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .map((entry) => entry.backupPath);
}

async function recoverWorkspaceRegistryDocument(
  registryPath: string
): Promise<WorkspaceRegistryDocument | null> {
  const backupPaths = await listWorkspaceRegistryBackups(registryPath);
  let lastError: Error | null = null;

  for (const backupPath of backupPaths) {
    try {
      const raw = await fs.readFile(backupPath, "utf8");
      const document = parseWorkspaceRegistryDocument(raw, backupPath);

      await fs.mkdir(path.dirname(registryPath), { recursive: true });
      await fs.copyFile(backupPath, registryPath).catch(() => undefined);

      return document;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Workspace registry backup recovery failed.");
    }
  }

  if (lastError) {
    throw new Error(
      `Workspace registry recovery failed at ${registryPath}: ${lastError.message}`
    );
  }

  return null;
}

async function readWorkspaceRegistryDocument(
  registryPath: string
): Promise<WorkspaceRegistryDocument> {
  if (!(await pathExists(registryPath))) {
    const recovered = await recoverWorkspaceRegistryDocument(registryPath);

    if (recovered) {
      return recovered;
    }

    return {
      version: WORKSPACE_REGISTRY_VERSION,
      workspaces: []
    };
  }

  const raw = await fs.readFile(registryPath, "utf8");
  return parseWorkspaceRegistryDocument(raw, registryPath);
}

function normalizeRegistryEntry(value: unknown): WorkspaceRegistryEntry {
  if (typeof value !== "object" || value === null) {
    throw new Error("Workspace registry entry must be an object.");
  }

  const entry = value as Record<string, unknown>;

  if (
    typeof entry.name !== "string" ||
    typeof entry.path !== "string" ||
    typeof entry.manifestPath !== "string" ||
    typeof entry.strategy !== "string" ||
    typeof entry.createdAt !== "string" ||
    !Array.isArray(entry.repos)
  ) {
    throw new Error("Workspace registry entry is missing required fields.");
  }

  const strategy = entry.strategy;

  if (!WORKSPACE_STRATEGIES.includes(strategy as WorkspaceStrategy)) {
    throw new Error(`Workspace registry entry has unsupported strategy: ${strategy}`);
  }

  return {
    name: entry.name,
    path: entry.path,
    manifestPath: entry.manifestPath,
    strategy: strategy as WorkspaceStrategy,
    branch: typeof entry.branch === "string" ? entry.branch : null,
    createdAt: entry.createdAt,
    repos: entry.repos.map((member) => normalizeWorkspaceRepoMember(member, strategy))
  };
}

function normalizeWorkspaceRepoMember(
  value: unknown,
  fallbackStrategy: string
): WorkspaceRepoMember {
  if (typeof value !== "object" || value === null) {
    throw new Error("Workspace repo member must be an object.");
  }

  const member = value as Record<string, unknown>;

  if (
    typeof member.name !== "string" ||
    typeof member.sourcePath !== "string" ||
    typeof member.path !== "string" ||
    typeof member.head !== "string"
  ) {
    throw new Error("Workspace repo member is missing required fields.");
  }

  const strategy =
    typeof member.strategy === "string" ? member.strategy : fallbackStrategy;

  if (!WORKSPACE_STRATEGIES.includes(strategy as WorkspaceStrategy)) {
    throw new Error(`Workspace repo member has unsupported strategy: ${strategy}`);
  }

  return {
    name: member.name,
    sourcePath: member.sourcePath,
    path: member.path,
    strategy: strategy as WorkspaceStrategy,
    branch: typeof member.branch === "string" ? member.branch : null,
    head: member.head,
    blueprintProject: member.blueprintProject === true
  };
}

async function writeWorkspaceRegistryDocument(
  registryPath: string,
  document: WorkspaceRegistryDocument
): Promise<void> {
  const directory = path.dirname(registryPath);
  const tempPath = path.join(
    directory,
    `${path.basename(registryPath)}.tmp-${process.pid}-${Date.now()}`
  );

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  if (!(await pathExists(registryPath))) {
    await fs.rename(tempPath, registryPath);
    return;
  }

  const backupPath = path.join(
    directory,
    `${path.basename(registryPath)}.bak-${process.pid}-${Date.now()}`
  );
  let restoredOriginal = false;

  try {
    await fs.copyFile(registryPath, backupPath);
    await fs.rename(tempPath, registryPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);

    if (!(await pathExists(registryPath)) && (await pathExists(backupPath))) {
      await fs.copyFile(backupPath, registryPath)
        .then(() => {
          restoredOriginal = true;
        })
        .catch(() => undefined);
    }

    if (error instanceof Error && !restoredOriginal) {
      throw new Error(`Unable to update workspace registry at ${registryPath}: ${error.message}`);
    }

    throw error;
  }

  await fs.rm(backupPath, { force: true }).catch(() => undefined);
}

async function acquireWorkspaceRegistryLock(lockPath: string): Promise<void> {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  for (;;) {
    try {
      await fs.mkdir(lockPath);
      return;
    } catch (error) {
      const lockError = error as NodeJS.ErrnoException;

      if (lockError.code !== "EEXIST") {
        throw error;
      }

      try {
        const stats = await fs.stat(lockPath);

        if (Date.now() - stats.mtimeMs > WORKSPACE_REGISTRY_LOCK_STALE_MS) {
          await fs.rm(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, WORKSPACE_REGISTRY_LOCK_RETRY_MS));
    }
  }
}

async function withWorkspaceRegistryLock<T>(
  registryPath: string,
  callback: () => Promise<T>
): Promise<T> {
  const lockPath = `${registryPath}.lock`;
  await acquireWorkspaceRegistryLock(lockPath);

  try {
    return await callback();
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
  }
}

function normalizePatchId(value: string): string {
  const trimmed = value.trim();
  validateFieldNameSegment(trimmed, "Patch id");
  return trimmed;
}

function normalizeRecordedPatchId(value: unknown, indexPath: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `Patch registry is malformed at ${indexPath}; patch ids must be non-empty strings.`
    );
  }

  try {
    return normalizePatchId(value);
  } catch {
    throw new Error(
      `Patch registry is malformed at ${indexPath}; patch id is not file-safe: ${value}`
    );
  }
}

function patchIndexPath(registryPath: string): string {
  return path.join(registryPath, "index.json");
}

function patchManifestPath(registryPath: string, patchId: string): string {
  return path.join(registryPath, `${patchId}.json`);
}

function patchContentPath(registryPath: string, patchId: string): string {
  return path.join(registryPath, `${patchId}.patch`);
}

function patchAuditPath(registryPath: string, patchId: string): string {
  return path.join(registryPath, `${patchId}.audit.ndjson`);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeTrackedFiles(repoRoot: string, trackedFiles: string[]): string[] {
  const normalized = new Set<string>();

  for (const trackedFile of trackedFiles) {
    assertNoNullBytes(trackedFile, "Patch tracked file");
    const candidatePath = path.isAbsolute(trackedFile)
      ? path.resolve(trackedFile)
      : path.resolve(repoRoot, trackedFile);

    ensurePathWithinRootSync(repoRoot, candidatePath, {
      label: "Patch tracked file"
    });

    const relativePath = path.relative(repoRoot, candidatePath).replaceAll(path.sep, "/");

    if (!relativePath || relativePath === ".") {
      throw new Error("Patch tracked file must resolve to a file path inside the repo.");
    }

    normalized.add(relativePath);
  }

  return [...normalized];
}

async function gitRemoteUrl(repoPath: string): Promise<string | null> {
  const result = await runGit(["-C", repoPath, "remote", "get-url", "origin"], {
    allowFailure: true
  });

  return result.success && result.stdout.length > 0 ? result.stdout : null;
}

function normalizePatchManifest(value: unknown, patchId: string): PatchManifest {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Patch manifest is malformed for ${patchId}.`);
  }

  const manifest = value as Record<string, unknown>;

  if (
    typeof manifest.version !== "number" ||
    typeof manifest.patchId !== "string" ||
    typeof manifest.createdAt !== "string" ||
    typeof manifest.patchFile !== "string" ||
    typeof manifest.patchHash !== "string" ||
    typeof manifest.repoRootName !== "string" ||
    !Array.isArray(manifest.trackedFiles) ||
    typeof manifest.compatibility !== "object" ||
    manifest.compatibility === null
  ) {
    throw new Error(`Patch manifest is missing required fields for ${patchId}.`);
  }

  const compatibility = manifest.compatibility as Record<string, unknown>;

  if (typeof compatibility.repoRootName !== "string") {
    throw new Error(`Patch compatibility is malformed for ${patchId}.`);
  }

  let manifestPatchId: string;

  try {
    manifestPatchId = normalizePatchId(manifest.patchId);
  } catch {
    throw new Error(`Patch manifest is malformed for ${patchId}.`);
  }

  if (manifestPatchId !== patchId) {
    throw new Error(
      `Patch registry is malformed for ${patchId}; recorded manifest patch id does not match its registry entry.`
    );
  }

  const trackedFiles = manifest.trackedFiles.map((trackedFile) => {
    if (typeof trackedFile !== "string" || trackedFile.trim().length === 0) {
      throw new Error(`Patch tracked files are malformed for ${patchId}.`);
    }

    return trackedFile;
  });

  const lastOutcome =
    typeof manifest.lastOutcome === "string" &&
    PATCH_OUTCOMES.includes(manifest.lastOutcome as PatchOutcome)
      ? (manifest.lastOutcome as PatchOutcome)
      : null;

  return {
    version: manifest.version,
    patchId: manifestPatchId,
    label: typeof manifest.label === "string" ? manifest.label : null,
    createdAt: manifest.createdAt,
    sourceVersion: typeof manifest.sourceVersion === "string" ? manifest.sourceVersion : null,
    repoRootName: manifest.repoRootName,
    repoRemote: typeof manifest.repoRemote === "string" ? manifest.repoRemote : null,
    patchFile: manifest.patchFile,
    patchHash: manifest.patchHash,
    trackedFiles,
    compatibility: {
      host: typeof compatibility.host === "string" ? compatibility.host : null,
      repoRootName: compatibility.repoRootName,
      remoteUrl: typeof compatibility.remoteUrl === "string" ? compatibility.remoteUrl : null
    },
    lastAppliedAt:
      typeof manifest.lastAppliedAt === "string" ? manifest.lastAppliedAt : null,
    lastOutcome
  };
}

async function readPatchRegistryDocument(registryPath: string): Promise<PatchRegistryDocument> {
  const indexPath = patchIndexPath(registryPath);

  if (!(await pathExists(indexPath))) {
    return {
      version: PATCH_REGISTRY_VERSION,
      patches: []
    };
  }

  const raw = await fs.readFile(indexPath, "utf8");
  const parsed = safeJsonParseObject(raw, {
    label: indexPath
  }) as unknown;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("patches" in parsed) ||
    !Array.isArray((parsed as { patches?: unknown }).patches)
  ) {
    throw new Error(
      `Patch registry is malformed at ${indexPath}; repair or remove it before replaying patches.`
    );
  }

  const patchIds = ((parsed as { patches: unknown[] }).patches ?? []).map((patchId) =>
    normalizeRecordedPatchId(patchId, indexPath)
  );

  return {
    version:
      typeof (parsed as Record<string, unknown>).version === "number"
        ? ((parsed as Record<string, unknown>).version as number)
        : PATCH_REGISTRY_VERSION,
    patches: [...new Set(patchIds)]
  };
}

async function writePatchRegistryDocument(
  registryPath: string,
  document: PatchRegistryDocument
): Promise<void> {
  await fs.mkdir(registryPath, { recursive: true });
  await writeJsonFile(patchIndexPath(registryPath), document as unknown as Record<string, unknown>);
}

async function readPatchManifest(registryPath: string, patchId: string): Promise<PatchManifest> {
  const manifestPath = patchManifestPath(registryPath, patchId);

  if (!(await pathExists(manifestPath))) {
    throw new Error(`Patch target is missing from the registry: ${patchId}`);
  }

  const raw = await fs.readFile(manifestPath, "utf8");
  const parsed = safeJsonParseObject(raw, {
    label: manifestPath
  });

  return normalizePatchManifest(parsed, patchId);
}

async function appendPatchAuditEntry(
  registryPath: string,
  patchId: string,
  entry: PatchAuditEntry
): Promise<void> {
  await fs.mkdir(registryPath, { recursive: true });
  await fs.appendFile(
    patchAuditPath(registryPath, patchId),
    `${JSON.stringify(entry)}\n`,
    "utf8"
  );
}

async function loadPatchContent(
  registryPath: string,
  patchId: string,
  manifest: PatchManifest
): Promise<string> {
  if (manifest.patchId !== patchId) {
    throw new Error(
      `Patch registry is malformed for ${patchId}; recorded manifest patch id does not match its registry entry.`
    );
  }

  const contentPath = patchContentPath(registryPath, patchId);

  if (!(await pathExists(contentPath))) {
    throw new Error(`Patch target is missing from the registry: ${patchId}`);
  }

  const patch = await fs.readFile(contentPath, "utf8");

  if (sha256(patch) !== manifest.patchHash) {
    throw new Error(
      `Patch registry is malformed for ${patchId}; recorded patch content does not match its manifest.`
    );
  }

  return patch;
}

function assertNotInstalledExtensionTarget(repoRoot: string): void {
  const extensionPath = resolveBlueprintRuntimeHost().extensionPath;

  if (!extensionPath) {
    return;
  }

  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedExtensionPath = path.resolve(extensionPath);

  if (
    resolvedRepoRoot === resolvedExtensionPath ||
    resolvedRepoRoot.startsWith(`${resolvedExtensionPath}${path.sep}`)
  ) {
    throw new Error(
      `Patch replay must not target the installed extension directory: ${resolvedExtensionPath}`
    );
  }
}

async function resolvePatchReplayTarget(cwd?: string): Promise<string> {
  const repoRoot = await resolveGitRepoRoot(cwd ?? process.cwd());
  assertNotInstalledExtensionTarget(repoRoot);
  return repoRoot;
}

async function buildPatchCompatibilityStatus(
  manifest: PatchManifest,
  repoRoot: string | null
): Promise<{ status: "compatible" | "mismatch" | "unknown"; reasons: string[] }> {
  if (!repoRoot) {
    return {
      status: "unknown",
      reasons: []
    };
  }

  const runtimeHost = resolveBlueprintRuntimeHost();
  const reasons: string[] = [];
  const repoName = path.basename(repoRoot);

  if (manifest.compatibility.host && manifest.compatibility.host !== runtimeHost.host) {
    reasons.push(
      `Recorded for host ${manifest.compatibility.host}, but active host is ${runtimeHost.host}.`
    );
  }

  if (manifest.compatibility.repoRootName !== repoName) {
    reasons.push(
      `Recorded for repo ${manifest.compatibility.repoRootName}, but current repo is ${repoName}.`
    );
  }

  const currentRemote = await gitRemoteUrl(repoRoot);

  if (
    manifest.compatibility.remoteUrl &&
    manifest.compatibility.remoteUrl !== currentRemote
  ) {
    reasons.push("Recorded origin remote does not match the current repo origin.");
  }

  return {
    status: reasons.length === 0 ? "compatible" : "mismatch",
    reasons
  };
}

function selectedPatchIds(
  registry: PatchRegistryDocument,
  requestedPatchIds: string[] | undefined
): string[] {
  if (!requestedPatchIds || requestedPatchIds.length === 0) {
    return registry.patches;
  }

  const normalized = requestedPatchIds.map((patchId) => normalizePatchId(patchId));
  const known = new Set(registry.patches);

  for (const patchId of normalized) {
    if (!known.has(patchId)) {
      throw new Error(`Patch target is missing from the registry: ${patchId}`);
    }
  }

  return normalized;
}

async function selectedPatchIdsForReplay(
  registryPath: string,
  registry: PatchRegistryDocument,
  repoRoot: string,
  requestedPatchIds: string[] | undefined
): Promise<string[]> {
  if (requestedPatchIds && requestedPatchIds.length > 0) {
    return selectedPatchIds(registry, requestedPatchIds);
  }

  const compatiblePatchIds = await Promise.all(
    registry.patches.map(async (patchId) => {
      const manifest = await readPatchManifest(registryPath, patchId);
      const compatibility = await buildPatchCompatibilityStatus(manifest, repoRoot);
      return compatibility.status === "compatible" ? patchId : null;
    })
  );

  return compatiblePatchIds.filter((patchId): patchId is string => patchId !== null);
}

async function resolveDefaultWorkspaceRoot(cwd?: string): Promise<string> {
  try {
    const config = await blueprintConfigGet({
      scope: "effective",
      cwd
    });
    const configuredRoot = config.config.maintenance.workspace_root?.trim();

    if (configuredRoot) {
      return expandHomePath(configuredRoot);
    }
  } catch (error) {
    if (
      !(
        error instanceof Error &&
        error.message ===
          "Blueprint commands must run from the repository root; no .git entry was found in the current directory."
      )
    ) {
      throw error;
    }
  }

  return path.join(os.homedir(), "blueprint-workspaces");
}

async function resolveWorkspacePath(args: WorkspaceCreateArgs): Promise<string> {
  if (args.path) {
    return path.resolve(expandHomePath(args.path));
  }

  const workspaceRoot = await resolveDefaultWorkspaceRoot(args.cwd);
  return path.join(workspaceRoot, normalizeWorkspaceName(args.name));
}

async function validateWorkspaceBranchName(branch: string): Promise<string> {
  const trimmed = branch.trim();
  assertNoNullBytes(trimmed, "Workspace branch");

  if (trimmed.startsWith("-")) {
    throw new Error(`Workspace branch name is invalid: ${trimmed}`);
  }

  const result = await runGit(["check-ref-format", "--branch", trimmed], {
    allowFailure: true
  });

  if (!result.success || result.stdout.length === 0) {
    throw new Error(`Workspace branch name is invalid: ${trimmed}`);
  }

  return trimmed;
}

function resolveRequestedRepos(args: WorkspaceCreateArgs): string[] {
  if (args.repos && args.repos.length > 0) {
    return args.repos;
  }

  if (args.cwd) {
    return [args.cwd];
  }

  return [process.cwd()];
}

async function resolveSourceRepos(
  repoInputs: string[],
  cwd?: string
): Promise<ResolvedSourceRepo[]> {
  const resolved: ResolvedSourceRepo[] = [];
  const seen = new Set<string>();

  for (const repoInput of repoInputs) {
    assertNoNullBytes(repoInput, "Workspace repo");
    const candidatePath = path.resolve(cwd ?? process.cwd(), expandHomePath(repoInput));
    const sourcePath = await resolveGitRepoRoot(candidatePath);

    if (seen.has(sourcePath)) {
      continue;
    }

    seen.add(sourcePath);

    resolved.push({
      name: slugifyRepoName(path.basename(sourcePath)),
      sourcePath,
      defaultBranch: await gitCurrentBranch(sourcePath),
      head: await gitHeadSha(sourcePath),
      blueprintProject: await pathExists(path.join(sourcePath, ".blueprint"))
    });
  }

  if (resolved.length === 0) {
    throw new Error("At least one workspace source repo is required.");
  }

  return resolved;
}

function ensureWorkspaceTargetIsSafe(
  workspacePath: string,
  sourceRepos: ResolvedSourceRepo[]
): void {
  for (const sourceRepo of sourceRepos) {
    if (isPathWithinRootSync(sourceRepo.sourcePath, workspacePath)) {
      throw new Error(`Workspace path must not be inside the source repo root: ${workspacePath}`);
    }
  }
}

async function ensureWorkspaceTargetDoesNotExist(workspacePath: string): Promise<void> {
  if (await pathExists(workspacePath)) {
    throw new Error(`Workspace path already exists: ${workspacePath}`);
  }
}

function buildWorkspaceManifestPath(workspacePath: string): string {
  return path.join(workspacePath, WORKSPACE_MANIFEST_FILE);
}

function assertNotInstalledExtensionPath(candidatePath: string, label: string): void {
  const extensionPath = resolveBlueprintRuntimeHost().extensionPath;

  if (!extensionPath) {
    return;
  }

  if (isPathWithinRootSync(extensionPath, candidatePath)) {
    throw new Error(
      `${label} must not target the installed extension directory: ${path.resolve(extensionPath)}`
    );
  }
}

async function rollbackPartialWorktreeAdd(
  sourceRepoPath: string,
  memberPath: string,
  createdSourceBranch: string | null
): Promise<void> {
  await runGit(["-C", sourceRepoPath, "worktree", "remove", "--force", memberPath], {
    allowFailure: true
  });
  await fs.rm(memberPath, { recursive: true, force: true }).catch(() => undefined);

  if (createdSourceBranch) {
    await runGit(
      ["-C", sourceRepoPath, "branch", "--delete", "--force", createdSourceBranch],
      {
        allowFailure: true
      }
    );
  }
}

async function createWorkspaceMember(
  workspacePath: string,
  sourceRepo: ResolvedSourceRepo,
  strategy: WorkspaceStrategy,
  requestedBranch: string | null,
  usedTargetNames: Set<string>
): Promise<CreatedWorkspaceMember> {
  let candidateName = sourceRepo.name;
  let duplicateIndex = 2;
  let createdSourceBranch: string | null = null;

  while (usedTargetNames.has(candidateName)) {
    candidateName = `${sourceRepo.name}-${duplicateIndex}`;
    duplicateIndex += 1;
  }

  usedTargetNames.add(candidateName);

  const memberPath = path.join(workspacePath, candidateName);

  if (strategy === "worktree") {
    const localBranchAlreadyExists = requestedBranch
      ? await localBranchExists(sourceRepo.sourcePath, requestedBranch)
      : false;
    const partialCreatedBranch =
      requestedBranch && !localBranchAlreadyExists ? requestedBranch : null;

    if (requestedBranch) {
      try {
        if (localBranchAlreadyExists) {
          await runGit([
            "-C",
            sourceRepo.sourcePath,
            "worktree",
            "add",
            memberPath,
            requestedBranch
          ]);
        } else if (await remoteBranchExists(sourceRepo.sourcePath, requestedBranch)) {
          await runGit([
            "-C",
            sourceRepo.sourcePath,
            "worktree",
            "add",
            "--track",
            "-b",
            requestedBranch,
            memberPath,
            `origin/${requestedBranch}`
          ]);
          createdSourceBranch = requestedBranch;
        } else {
          await runGit([
            "-C",
            sourceRepo.sourcePath,
            "worktree",
            "add",
            "-b",
            requestedBranch,
            memberPath,
            "HEAD"
          ]);
          createdSourceBranch = requestedBranch;
        }
      } catch (error) {
        await rollbackPartialWorktreeAdd(
          sourceRepo.sourcePath,
          memberPath,
          partialCreatedBranch
        );
        throw error;
      }
    } else {
      try {
        await runGit([
          "-C",
          sourceRepo.sourcePath,
          "worktree",
          "add",
          "--detach",
          memberPath,
          "HEAD"
        ]);
      } catch (error) {
        await rollbackPartialWorktreeAdd(sourceRepo.sourcePath, memberPath, null);
        throw error;
      }
    }
  } else {
    await runGit(["clone", sourceRepo.sourcePath, memberPath]);

    if (requestedBranch) {
      if (await remoteBranchExists(memberPath, requestedBranch)) {
        await runGit([
          "-C",
          memberPath,
          "checkout",
          "-b",
          requestedBranch,
          "--track",
          `origin/${requestedBranch}`
        ]);
      } else {
        await runGit(["-C", memberPath, "checkout", "-b", requestedBranch]);
      }
    }
  }

  return {
    name: candidateName,
    sourcePath: sourceRepo.sourcePath,
    path: memberPath,
    strategy,
    branch: (await gitCurrentBranch(memberPath)) ?? requestedBranch ?? null,
    head: await gitHeadSha(memberPath),
    blueprintProject: sourceRepo.blueprintProject,
    rollbackStrategy: strategy,
    createdSourceBranch
  };
}

async function rollbackCreatedMembers(createdMembers: CreatedWorkspaceMember[]): Promise<void> {
  for (const member of [...createdMembers].reverse()) {
    try {
      if (member.rollbackStrategy === "worktree") {
        await runGit(["-C", member.sourcePath, "worktree", "remove", "--force", member.path], {
          allowFailure: true
        });
      }

      if (member.createdSourceBranch) {
        await runGit(
          ["-C", member.sourcePath, "branch", "--delete", "--force", member.createdSourceBranch],
          {
            allowFailure: true
          }
        );
      }
    } catch {
      // fall through to best-effort filesystem cleanup
    }

    await fs.rm(member.path, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function blueprintWorkspaceRegistryGet(
  _args: WorkspaceRegistryGetArgs = {}
): Promise<WorkspaceRegistryGetResult> {
  const registryPath = expandHomePath(
    resolveBlueprintRuntimeHost().workspaceRegistryPath
  );
  const registry = await readWorkspaceRegistryDocument(registryPath);

  return {
    registryPath,
    workspaces: registry.workspaces
  };
}

export async function blueprintWorkspaceCreate(
  args: WorkspaceCreateArgs
): Promise<WorkspaceCreateResult> {
  const normalizedName = normalizeWorkspaceName(args.name);
  const requestedBranch = args.branch
    ? await validateWorkspaceBranchName(args.branch)
    : null;
  const strategy = args.strategy ?? "worktree";
  const registryPath = expandHomePath(
    resolveBlueprintRuntimeHost().workspaceRegistryPath
  );
  const workspacePath = await resolveWorkspacePath({
    ...args,
    name: normalizedName
  });
  const sourceRepos = await resolveSourceRepos(resolveRequestedRepos(args), args.cwd);
  const manifestPath = buildWorkspaceManifestPath(workspacePath);

  assertNotInstalledExtensionPath(workspacePath, "Workspace path");
  ensureWorkspaceTargetIsSafe(workspacePath, sourceRepos);
  await ensureWorkspaceTargetDoesNotExist(workspacePath);

  for (const sourceRepo of sourceRepos) {
    assertNotInstalledExtensionPath(sourceRepo.sourcePath, "Workspace source repo");

    if (!(await gitWorkingTreeClean(sourceRepo.sourcePath))) {
      throw new Error(
        `Workspace source repo has uncommitted changes and must be clean before workspace creation: ${sourceRepo.sourcePath}`
      );
    }
  }

  return withWorkspaceRegistryLock(registryPath, async () => {
    const registry = await readWorkspaceRegistryDocument(registryPath);

    if (
      registry.workspaces.some(
        (workspace) =>
          workspace.name === normalizedName ||
          path.resolve(workspace.path) === path.resolve(workspacePath)
      )
    ) {
      throw new Error(
        `Workspace registry already contains ${normalizedName} or ${workspacePath}; choose a unique workspace name and target path.`
      );
    }

    const createdMembers: CreatedWorkspaceMember[] = [];
    const usedTargetNames = new Set<string>();
    const createdAt = new Date().toISOString();

    try {
      await fs.mkdir(path.dirname(workspacePath), { recursive: true });
      await fs.mkdir(workspacePath, { recursive: false });

      for (const sourceRepo of sourceRepos) {
        const createdMember = await createWorkspaceMember(
          workspacePath,
          sourceRepo,
          strategy,
          requestedBranch,
          usedTargetNames
        );
        createdMembers.push(createdMember);
      }

      const registryEntry: WorkspaceRegistryEntry = {
        name: normalizedName,
        path: workspacePath,
        manifestPath,
        strategy,
        branch: requestedBranch,
        createdAt,
        repos: createdMembers.map(({ rollbackStrategy: _rollbackStrategy, ...member }) => member)
      };

      await writeJsonFile(manifestPath, registryEntry as unknown as Record<string, unknown>);
      await writeWorkspaceRegistryDocument(registryPath, {
        version: WORKSPACE_REGISTRY_VERSION,
        workspaces: [...registry.workspaces, registryEntry]
      });

      return {
        workspacePath,
        manifestPath,
        registryPath,
        registryEntry,
        repoMembers: registryEntry.repos
      };
    } catch (error) {
      await rollbackCreatedMembers(createdMembers);
      await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => undefined);

      if (error instanceof Error) {
        throw error;
      }

      throw error;
    }
  });
}

export async function blueprintWorkstreamList(
  args: WorkstreamListArgs = {}
): Promise<WorkstreamListResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const store = await loadWorkstreamStore(projectRoot);
  return buildWorkstreamListResult(store);
}

export async function blueprintWorkstreamMutate(
  args: WorkstreamMutateArgs
): Promise<WorkstreamMutateResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const store = await loadWorkstreamStore(projectRoot);

  if (store.status !== "ready") {
    return buildMutationResult(store, {
      status: store.status,
      operation: args.operation,
      affectedPaths: [],
      waitingState: store.waitingState,
      nextAction: store.status === "project_missing"
        ? "Initialize Blueprint project state before creating workstreams."
        : `Repair ${toRepoRelativePath(projectRoot, store.indexPath)} before mutating workstreams.`,
      reason: store.reason,
      statePatch: null
    });
  }

  const operation = args.operation;
  const now = new Date().toISOString();
  const workstreams = store.workstreams.map((entry) => ({ ...entry }));

  if (operation === "create") {
    const name = normalizeWorkstreamName(args.workstream);
    const slug = slugifyWorkstreamName(name);
    const existing = findWorkstreamEntry(workstreams, slug);

    if (existing) {
      return buildMutationResult(store, {
        status: "reused",
        operation,
        affectedPaths: [],
        waitingState: null,
        nextAction:
          existing.status === "active"
            ? `Continue the active workstream ${existing.slug} or inspect progress with ${PROGRESS_COMMAND}.`
            : `Run ${WORKSTREAMS_COMMAND} switch ${existing.slug} or ${WORKSTREAMS_COMMAND} resume ${existing.slug} when you want to return to it.`,
        reason: `Workstream ${existing.name} already exists.`,
        statePatch: null
      });
    }

    let currentSnapshot: WorkstreamStateSnapshot | null = null;

    if (!store.active) {
      const snapshotResult = await readRequiredCurrentStateSnapshot(projectRoot);

      if (snapshotResult.status === "blocked") {
        return buildMissingCurrentStateSnapshotResult(
          store,
          operation,
          projectRoot,
          snapshotResult.reason
        );
      }

      currentSnapshot = snapshotResult.snapshot;
    }

    const newEntry: WorkstreamStateDocument = {
      version: WORKSTREAM_STATE_VERSION,
      name,
      slug,
      status: store.active ? "paused" : "active",
      createdAt: now,
      updatedAt: now,
      activatedAt: store.active ? null : now,
      completedAt: null,
      stateSnapshot: store.active ? null : currentSnapshot
    };
    workstreams.push(newEntry);
    workstreams.sort(compareWorkstreams);
    const reloadedStore: LoadedWorkstreamStore = {
      ...store,
      workstreams,
      active: workstreams.find((entry) => entry.status === "active") ?? null
    };
    const affectedPaths = await persistWorkstreamState(projectRoot, workstreams, [slug]);

    return buildMutationResult(reloadedStore, {
      status: "updated",
      operation,
      affectedPaths,
      waitingState: null,
      nextAction:
        newEntry.status === "active"
          ? `Continue the active workstream ${slug} or inspect repo status with ${PROGRESS_COMMAND}.`
          : `Run ${WORKSTREAMS_COMMAND} switch ${slug} when you want to make the new workstream active.`,
      reason: null,
      statePatch: null
    });
  }

  const target = findWorkstreamEntry(workstreams, args.workstream);

  if (!target) {
    return buildMutationResult(store, {
      status: "blocked",
      operation,
      affectedPaths: [],
      waitingState: "missing-workstream",
      nextAction: `Run ${WORKSTREAMS_COMMAND} create <name> to add a new workstream first.`,
      reason: `No workstream matched ${args.workstream}.`,
      statePatch: null
    });
  }

  const currentActive = workstreams.find((entry) => entry.status === "active") ?? null;
  const targetIsActive = currentActive?.slug === target.slug;
  const requiresCleanTree =
    operation === "switch"
      ? !targetIsActive
      : operation === "resume"
        ? true
        : targetIsActive;

  if (requiresCleanTree && !(await gitWorkingTreeCleanForWorkstreamTransition(projectRoot))) {
    return buildMutationResult(store, {
      status: "blocked",
      operation,
      affectedPaths: [],
      waitingState: "dirty-working-tree",
      nextAction: "Clean or stash the working tree before retrying the workstream transition.",
      reason: "Workstream transitions that change the active stream require a clean working tree.",
      statePatch: null
    });
  }

  if (operation === "switch") {
    if (target.status === "completed") {
      return buildMutationResult(store, {
        status: "blocked",
        operation,
        affectedPaths: [],
        waitingState: "missing-workstream",
        nextAction: `Run ${WORKSTREAMS_COMMAND} resume ${target.slug} to reactivate that completed workstream from its saved snapshot.`,
        reason: `Completed workstream ${target.name} must be resumed instead of switched.`,
        statePatch: null
      });
    }

    if (targetIsActive) {
      return buildMutationResult(store, {
        status: "reused",
        operation,
        affectedPaths: [],
        waitingState: null,
        nextAction: `Run ${PROGRESS_COMMAND} to inspect the current active workstream.`,
        reason: `Workstream ${target.name} is already active.`,
        statePatch: null
      });
    }

    let currentSnapshot: WorkstreamStateSnapshot | null = null;

    if (currentActive) {
      const snapshotResult = await readRequiredCurrentStateSnapshot(projectRoot);

      if (snapshotResult.status === "blocked") {
        return buildMissingCurrentStateSnapshotResult(
          store,
          operation,
          projectRoot,
          snapshotResult.reason
        );
      }

      currentSnapshot = snapshotResult.snapshot;
    }

    if (currentActive) {
      currentActive.status = "paused";
      currentActive.updatedAt = now;
      currentActive.stateSnapshot = currentSnapshot;
    }

    target.status = "active";
    target.updatedAt = now;
    target.activatedAt = now;
    target.completedAt = null;
    workstreams.sort(compareWorkstreams);
    const reloadedStore: LoadedWorkstreamStore = {
      ...store,
      workstreams,
      active: target
    };
    const affectedPaths = await persistWorkstreamState(projectRoot, workstreams, [
      ...(currentActive ? [currentActive.slug] : []),
      target.slug
    ]);

    return buildMutationResult(reloadedStore, {
      status: "updated",
      operation,
      affectedPaths,
      waitingState: null,
      nextAction:
        target.stateSnapshot === null
          ? `Run ${PROGRESS_COMMAND} to continue from the current repo state, then switch away later to capture a resumable snapshot for ${target.slug}.`
          : `Run ${WORKSTREAMS_COMMAND} resume ${target.slug} to restore its saved state snapshot.`,
      reason: null,
      statePatch: null
    });
  }

  if (operation === "resume") {
    if (target.stateSnapshot === null) {
      return buildMutationResult(store, {
        status: "blocked",
        operation,
        affectedPaths: [],
        waitingState: "missing-resume-snapshot",
        nextAction: `Switch to ${target.slug}, do the work, and switch away later to capture a saved snapshot before trying to resume it.`,
        reason: `Workstream ${target.name} does not have a saved STATE.md snapshot to restore.`,
        statePatch: null
      });
    }

    let currentSnapshot: WorkstreamStateSnapshot | null = null;

    if (currentActive && currentActive.slug !== target.slug) {
      const snapshotResult = await readRequiredCurrentStateSnapshot(projectRoot);

      if (snapshotResult.status === "blocked") {
        return buildMissingCurrentStateSnapshotResult(
          store,
          operation,
          projectRoot,
          snapshotResult.reason
        );
      }

      currentSnapshot = snapshotResult.snapshot;
    }

    if (currentActive && currentActive.slug !== target.slug) {
      currentActive.status = "paused";
      currentActive.updatedAt = now;
      currentActive.stateSnapshot = currentSnapshot;
    }

    target.status = "active";
    target.updatedAt = now;
    target.activatedAt = now;
    target.completedAt = null;
    workstreams.sort(compareWorkstreams);
    const reloadedStore: LoadedWorkstreamStore = {
      ...store,
      workstreams,
      active: target
    };
    const affectedPaths = await persistWorkstreamState(projectRoot, workstreams, [
      ...(currentActive && currentActive.slug !== target.slug ? [currentActive.slug] : []),
      target.slug
    ]);

    return buildMutationResult(reloadedStore, {
      status: targetIsActive ? "reused" : "updated",
      operation,
      affectedPaths,
      waitingState: null,
      nextAction: `Apply the returned state patch through blueprint_state_update, then continue work on ${target.slug}.`,
      reason: null,
      statePatch: buildResumeStatePatch(target.stateSnapshot)
    });
  }

  if (target.status === "completed") {
    return buildMutationResult(store, {
      status: "reused",
      operation,
      affectedPaths: [],
      waitingState: null,
      nextAction: `Run ${WORKSTREAMS_COMMAND} create <name> to add a new workstream or ${WORKSTREAMS_COMMAND} resume ${target.slug} to reactivate this one.`,
      reason: `Workstream ${target.name} is already completed.`,
      statePatch: null
    });
  }

  if (targetIsActive) {
    const snapshotResult = await readRequiredCurrentStateSnapshot(projectRoot);

    if (snapshotResult.status === "blocked") {
      return buildMissingCurrentStateSnapshotResult(
        store,
        operation,
        projectRoot,
        snapshotResult.reason
      );
    }

    target.stateSnapshot = snapshotResult.snapshot;
  }

  target.status = "completed";
  target.updatedAt = now;
  target.completedAt = now;
  workstreams.sort(compareWorkstreams);
  const reloadedStore: LoadedWorkstreamStore = {
    ...store,
    workstreams,
    active: workstreams.find((entry) => entry.status === "active") ?? null
  };
  const affectedPaths = await persistWorkstreamState(projectRoot, workstreams, [target.slug]);

  return buildMutationResult(reloadedStore, {
    status: "updated",
    operation,
    affectedPaths,
    waitingState: null,
    nextAction:
      reloadedStore.active !== null
        ? `Run ${WORKSTREAMS_COMMAND} resume ${reloadedStore.active.slug} or ${PROGRESS_COMMAND} to continue the remaining active workstream.`
        : `Run ${WORKSTREAMS_COMMAND} create <name> to start a new workstream or ${PROGRESS_COMMAND} to inspect the repo state.`,
    reason: null,
    statePatch: null
  });
}

export async function blueprintPatchList(
  args: PatchListArgs = {}
): Promise<PatchListResult> {
  const registryPath = expandHomePath(resolveBlueprintRuntimeHost().patchRegistryPath);
  const registry = await readPatchRegistryDocument(registryPath);
  const repoRoot = args.cwd ? await resolveGitRepoRoot(args.cwd) : null;
  const requestedPatchIds = args.patchIds?.map((patchId) => normalizePatchId(patchId));
  const patchIds = selectedPatchIds(registry, requestedPatchIds);

  const patches = await Promise.all(
    patchIds.map(async (patchId) => {
      const manifest = await readPatchManifest(registryPath, patchId);
      await loadPatchContent(registryPath, patchId, manifest);

      return {
        patchId,
        label: manifest.label,
        createdAt: manifest.createdAt,
        sourceVersion: manifest.sourceVersion,
        trackedFiles: manifest.trackedFiles,
        manifestPath: patchManifestPath(registryPath, patchId),
        patchPath: patchContentPath(registryPath, patchId),
        auditPath: patchAuditPath(registryPath, patchId),
        lastAppliedAt: manifest.lastAppliedAt,
        lastOutcome: manifest.lastOutcome,
        compatibility: await buildPatchCompatibilityStatus(manifest, repoRoot)
      };
    })
  );

  return {
    registryPath,
    patches
  };
}

export async function blueprintPatchRecord(
  args: PatchRecordArgs
): Promise<PatchRecordResult> {
  const repoRoot = await resolvePatchReplayTarget(args.cwd);
  const runtimeHost = resolveBlueprintRuntimeHost();
  const registryPath = expandHomePath(runtimeHost.patchRegistryPath);
  const patchId = normalizePatchId(args.patchId);
  const trackedFiles = normalizeTrackedFiles(repoRoot, args.trackedFiles);
  const registry = await readPatchRegistryDocument(registryPath);
  const createdAt = new Date().toISOString();
  const patchPath = patchContentPath(registryPath, patchId);
  const manifestPath = patchManifestPath(registryPath, patchId);
  const auditPath = patchAuditPath(registryPath, patchId);
  const existingManifest = (await pathExists(manifestPath))
    ? await readPatchManifest(registryPath, patchId)
    : null;
  const updatingStoredPatch = existingManifest !== null;
  const hasNewPatchContent = typeof args.patch === "string" && args.patch.length > 0;
  const patch =
    hasNewPatchContent
      ? args.patch
      : existingManifest
        ? await loadPatchContent(registryPath, patchId, existingManifest)
        : null;

  if (!patch) {
    throw new Error(`Patch content is required when creating a new registry entry: ${patchId}`);
  }

  assertNoNullBytes(patch, "Patch content");
  const normalizedPatch = patch.endsWith("\n") ? patch : `${patch}\n`;
  const patchHash = sha256(normalizedPatch);
  let repoRemote: string | null;
  let sourceVersion: string | null;
  let compatibility: PatchCompatibility;

  if (updatingStoredPatch && !hasNewPatchContent && existingManifest) {
    repoRemote = existingManifest.repoRemote;
    sourceVersion = existingManifest.sourceVersion;
    compatibility = existingManifest.compatibility;
  } else {
    repoRemote = await gitRemoteUrl(repoRoot);
    sourceVersion = args.sourceVersion ?? (await gitHeadSha(repoRoot));
    compatibility = {
      host: args.compatibility?.host ?? runtimeHost.host,
      repoRootName: args.compatibility?.repoRootName ?? path.basename(repoRoot),
      remoteUrl:
        args.compatibility?.remoteUrl === undefined
          ? repoRemote
          : args.compatibility.remoteUrl
    };
  }
  const manifest: PatchManifest = {
    version: PATCH_MANIFEST_VERSION,
    patchId,
    label: args.label?.trim() || null,
    createdAt: existingManifest?.createdAt ?? createdAt,
    sourceVersion,
    repoRootName: path.basename(repoRoot),
    repoRemote,
    patchFile: path.basename(patchPath),
    patchHash,
    trackedFiles,
    compatibility,
    lastAppliedAt:
      args.audit?.outcome === "applied" ? createdAt : existingManifest?.lastAppliedAt ?? null,
    lastOutcome: args.audit?.outcome ?? existingManifest?.lastOutcome ?? "recorded"
  };

  await fs.mkdir(registryPath, { recursive: true });
  await fs.writeFile(patchPath, normalizedPatch, "utf8");
  await writeJsonFile(manifestPath, manifest as unknown as Record<string, unknown>);

  if (!registry.patches.includes(patchId)) {
    await writePatchRegistryDocument(registryPath, {
      version: registry.version || PATCH_REGISTRY_VERSION,
      patches: [...registry.patches, patchId]
    });
  }

  const auditEntry: PatchAuditEntry = {
    version: PATCH_AUDIT_VERSION,
    timestamp: createdAt,
    action: args.audit?.action ?? "record",
    outcome: args.audit?.outcome ?? "recorded",
    cwd: path.resolve(args.cwd ?? process.cwd()),
    repoRoot,
    targetHead: args.audit?.targetHead ?? sourceVersion,
    trackedFiles,
    conflicts: args.audit?.conflicts ?? [],
    warnings: args.audit?.warnings ?? [],
    dryRun: args.audit?.dryRun ?? false
  };

  await appendPatchAuditEntry(registryPath, patchId, auditEntry);

  return {
    patchId,
    registryPath,
    manifestPath,
    patchPath,
    auditPath,
    trackedFiles,
    updated: existingManifest !== null
  };
}

export async function blueprintPatchReapply(
  args: PatchReapplyArgs = {}
): Promise<PatchReapplyResult> {
  const repoRoot = await resolvePatchReplayTarget(args.cwd);
  const registryPath = expandHomePath(resolveBlueprintRuntimeHost().patchRegistryPath);
  const registry = await readPatchRegistryDocument(registryPath);
  const requestedPatchIds = args.patchIds?.map((patchId) => normalizePatchId(patchId));
  const patchIds = await selectedPatchIdsForReplay(
    registryPath,
    registry,
    repoRoot,
    requestedPatchIds
  );
  const dirtyTree = !(await gitWorkingTreeClean(repoRoot));
  const targetHead = await gitHeadSha(repoRoot);

  if (patchIds.length === 0) {
    return {
      registryPath,
      appliedPatches: [],
      skippedPatches: [],
      conflicts: [],
      preview: args.dryRun ?? false,
      targetHead
    };
  }

  if (dirtyTree) {
    throw new Error(`Patch replay requires a clean working tree: ${repoRoot}`);
  }

  const conflicts: PatchConflict[] = [];
  const patchFiles: string[] = [];

  for (const patchId of patchIds) {
    const manifest = await readPatchManifest(registryPath, patchId);
    const compatibility = await buildPatchCompatibilityStatus(manifest, repoRoot);

    if (compatibility.status === "mismatch") {
      throw new Error(
        `Patch compatibility mismatch for ${patchId}: ${compatibility.reasons.join(" ")}`
      );
    }

    await loadPatchContent(registryPath, patchId, manifest);
    patchFiles.push(patchContentPath(registryPath, patchId));
  }

  const checkResult = await runGit(
    ["-C", repoRoot, "apply", "--check", "--verbose", ...patchFiles],
    { allowFailure: true }
  );

  if (!checkResult.success) {
    for (const patchId of patchIds) {
      const patchFile = patchContentPath(registryPath, patchId);
      const patchCheck = await runGit(
        ["-C", repoRoot, "apply", "--check", "--verbose", patchFile],
        { allowFailure: true }
      );

      if (!patchCheck.success) {
        conflicts.push({
          patchId,
          message: patchCheck.stderr || patchCheck.stdout || "Patch did not apply cleanly."
        });
      }
    }

    return {
      registryPath,
      appliedPatches: [],
      skippedPatches: patchIds,
      conflicts,
      preview: args.dryRun ?? false,
      targetHead
    };
  }

  if (args.dryRun) {
    return {
      registryPath,
      appliedPatches: [],
      skippedPatches: [],
      conflicts: [],
      preview: true,
      targetHead
    };
  }

  const applyResult = await runGit(
    ["-C", repoRoot, "apply", "--verbose", "--whitespace=nowarn", ...patchFiles],
    { allowFailure: true }
  );

  if (!applyResult.success) {
    return {
      registryPath,
      appliedPatches: [],
      skippedPatches: patchIds,
      conflicts: [
        {
          patchId: patchIds.join(","),
          message: applyResult.stderr || applyResult.stdout || "Patch replay failed."
        }
      ],
      preview: false,
      targetHead
    };
  }

  return {
    registryPath,
    appliedPatches: patchIds,
    skippedPatches: [],
    conflicts: [],
    preview: false,
    targetHead
  };
}

export const workspaceToolDefinitions = [
  {
    name: "blueprint_workspace_registry_get",
    description:
      "Read the host-global Blueprint workspace registry without mutating workspace state.",
    inputSchema: workspaceRegistryGetInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintWorkspaceRegistryGet(args as WorkspaceRegistryGetArgs)
  },
  {
    name: "blueprint_workspace_create",
    description:
      "Create a Blueprint workspace on disk and record it in the host-global registry transactionally.",
    inputSchema: workspaceCreateInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintWorkspaceCreate(args as WorkspaceCreateArgs)
  },
  {
    name: "blueprint_workstream_list",
    description:
      "Read the project-local Blueprint workstream index plus per-workstream state and report the active stream summary.",
    inputSchema: workstreamListInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintWorkstreamList(args as WorkstreamListArgs)
  },
  {
    name: "blueprint_workstream_mutate",
    description:
      "Create, switch, resume, or complete project-local Blueprint workstreams while keeping WORKSTREAMS.md aligned with canonical per-stream state.",
    inputSchema: workstreamMutateInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintWorkstreamMutate(args as WorkstreamMutateArgs)
  },
  {
    name: "blueprint_patch_list",
    description:
      "List recorded Blueprint patch manifests from the host-global patch registry and report repo compatibility.",
    inputSchema: patchListInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPatchList(args as PatchListArgs)
  },
  {
    name: "blueprint_patch_record",
    description:
      "Persist a patch manifest plus audit entry in the host-global Blueprint patch registry.",
    inputSchema: patchRecordInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPatchRecord(args as PatchRecordArgs)
  },
  {
    name: "blueprint_patch_reapply",
    description:
      "Preview or replay recorded patches against a clean repo while enforcing host-global registry and compatibility guards.",
    inputSchema: patchReapplyInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPatchReapply(args as PatchReapplyArgs)
  }
];
