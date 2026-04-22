import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import * as z from "zod/v4";

import { writeJsonFile } from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { resolveBlueprintRuntimeHost } from "../runtime-host.js";
import {
  assertNoNullBytes,
  ensurePathWithinRootSync,
  safeJsonParseObject,
  validateFieldNameSegment
} from "../../shared/security.js";

const execFileAsync = promisify(execFile);
const WORKSPACE_MANIFEST_FILE = ".blueprint-workspace.json";
const WORKSPACE_REGISTRY_VERSION = 1;
const WORKSPACE_STRATEGIES = ["worktree", "clone"] as const;

type WorkspaceStrategy = (typeof WORKSPACE_STRATEGIES)[number];

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

async function readWorkspaceRegistryDocument(
  registryPath: string
): Promise<WorkspaceRegistryDocument> {
  if (!(await pathExists(registryPath))) {
    return {
      version: WORKSPACE_REGISTRY_VERSION,
      workspaces: []
    };
  }

  const raw = await fs.readFile(registryPath, "utf8");
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

  return {
    version:
      typeof parsedRecord.version === "number"
        ? parsedRecord.version
        : WORKSPACE_REGISTRY_VERSION,
    workspaces
  };
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
  await fs.rename(tempPath, registryPath);
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
  } catch {
    // Fall back only when config is unavailable in the current repo context.
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
    try {
      ensurePathWithinRootSync(sourceRepo.sourcePath, workspacePath, {
        label: "Workspace path"
      });
      throw new Error(
        `Workspace path must not be inside the source repo root: ${workspacePath}`
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          `Workspace path must not be inside the source repo root: ${workspacePath}`
      ) {
        throw error;
      }
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

async function createWorkspaceMember(
  workspacePath: string,
  sourceRepo: ResolvedSourceRepo,
  strategy: WorkspaceStrategy,
  requestedBranch: string | null,
  usedTargetNames: Set<string>
): Promise<CreatedWorkspaceMember> {
  let candidateName = sourceRepo.name;
  let duplicateIndex = 2;

  while (usedTargetNames.has(candidateName)) {
    candidateName = `${sourceRepo.name}-${duplicateIndex}`;
    duplicateIndex += 1;
  }

  usedTargetNames.add(candidateName);

  const memberPath = path.join(workspacePath, candidateName);

  if (strategy === "worktree") {
    if (requestedBranch) {
      if (await localBranchExists(sourceRepo.sourcePath, requestedBranch)) {
        await runGit(["-C", sourceRepo.sourcePath, "worktree", "add", memberPath, requestedBranch]);
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
      }
    } else {
      await runGit([
        "-C",
        sourceRepo.sourcePath,
        "worktree",
        "add",
        "--detach",
        memberPath,
        "HEAD"
      ]);
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
    rollbackStrategy: strategy
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
  const requestedBranch = args.branch?.trim() || null;
  const strategy = args.strategy ?? "worktree";
  const registryPath = expandHomePath(
    resolveBlueprintRuntimeHost().workspaceRegistryPath
  );
  const workspacePath = await resolveWorkspacePath({
    ...args,
    name: normalizedName
  });
  const sourceRepos = await resolveSourceRepos(resolveRequestedRepos(args), args.cwd);
  const registry = await readWorkspaceRegistryDocument(registryPath);
  const manifestPath = buildWorkspaceManifestPath(workspacePath);

  ensureWorkspaceTargetIsSafe(workspacePath, sourceRepos);
  await ensureWorkspaceTargetDoesNotExist(workspacePath);

  for (const sourceRepo of sourceRepos) {
    if (!(await gitWorkingTreeClean(sourceRepo.sourcePath))) {
      throw new Error(
        `Workspace source repo has uncommitted changes and must be clean before workspace creation: ${sourceRepo.sourcePath}`
      );
    }
  }

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
      version: registry.version || WORKSPACE_REGISTRY_VERSION,
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
  }
];
