import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { blueprintToolNames, blueprintToolRegistry } from "../src/mcp/server.js";
import {
  blueprintWorkspaceCreate,
  blueprintWorkspaceRegistryGet
} from "../src/mcp/tools/workspace.js";

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function initializeGitRepo(repoPath: string): Promise<void> {
  try {
    await runGit(["init", "-b", "main"], repoPath);
  } catch {
    await runGit(["init"], repoPath);
    await runGit(["checkout", "-b", "main"], repoPath);
  }
}

async function createGitRepo(tempRoot: string, name: string): Promise<string> {
  const repoPath = path.join(tempRoot, name);

  await fs.mkdir(repoPath, { recursive: true });
  await initializeGitRepo(repoPath);
  await runGit(["config", "user.name", "Blueprint Tests"], repoPath);
  await runGit(["config", "user.email", "blueprint-tests@example.com"], repoPath);
  await fs.writeFile(path.join(repoPath, "README.md"), `# ${name}\n`, "utf8");
  await runGit(["add", "README.md"], repoPath);
  await runGit(["commit", "-m", "init"], repoPath);

  return repoPath;
}

async function withGlobalHome<T>(
  globalHome: string,
  callback: () => Promise<T>
): Promise<T> {
  const previous = process.env.BLUEPRINT_GLOBAL_HOME;
  process.env.BLUEPRINT_GLOBAL_HOME = globalHome;

  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.BLUEPRINT_GLOBAL_HOME;
    } else {
      process.env.BLUEPRINT_GLOBAL_HOME = previous;
    }
  }
}

async function withHomeDirectory<T>(
  homeDirectory: string,
  callback: () => Promise<T>
): Promise<T> {
  const previousHome = process.env.HOME;
  process.env.HOME = homeDirectory;

  try {
    return await callback();
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
  }
}

async function withEnvironment<T>(
  overrides: Record<string, string | undefined>,
  callback: () => Promise<T>
): Promise<T> {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("workspace tools register registry and create MCP entries", () => {
  assert.ok(
    blueprintToolNames.includes("blueprint_workspace_registry_get"),
    "blueprint_workspace_registry_get should be registered"
  );
  assert.ok(
    blueprintToolNames.includes("blueprint_workspace_create"),
    "blueprint_workspace_create should be registered"
  );
  assert.equal(
    blueprintToolRegistry.blueprint_workspace_create.inputSchema.strategy.safeParse("worktree")
      .success,
    true
  );
  assert.equal(
    blueprintToolRegistry.blueprint_workspace_create.inputSchema.strategy.safeParse("clone")
      .success,
    true
  );
});

test("blueprint_workspace_registry_get returns an empty host-global registry when missing", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-registry-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const result = await withGlobalHome(globalHome, () => blueprintWorkspaceRegistryGet());

  assert.equal(result.registryPath, path.join(globalHome, "workspaces.json"));
  assert.deepEqual(result.workspaces, []);
});

test("blueprint_workspace_create derives the default workspace root from effective config and persists registry plus manifest", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-create-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const canonicalRepoPath = await fs.realpath(repoPath);
  const configuredWorkspaceRoot = path.join(tempRoot, "configured-workspaces");
  const globalHome = path.join(tempRoot, "global-home");

  await fs.mkdir(path.join(repoPath, ".blueprint"), { recursive: true });
  await fs.writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify(
      {
        version: 2,
        maintenance: {
          workspace_root: configuredWorkspaceRoot
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await runGit(["add", ".blueprint/config.json"], repoPath);
  await runGit(["commit", "-m", "add blueprint config"], repoPath);

  const result = await withGlobalHome(globalHome, () =>
    blueprintWorkspaceCreate({
      cwd: repoPath,
      name: "feature-a"
    })
  );

  assert.equal(result.workspacePath, path.join(configuredWorkspaceRoot, "feature-a"));
  assert.equal(result.manifestPath, path.join(result.workspacePath, ".blueprint-workspace.json"));
  assert.equal(result.registryPath, path.join(globalHome, "workspaces.json"));
  assert.equal(result.registryEntry.name, "feature-a");
  assert.equal(result.registryEntry.strategy, "worktree");
  assert.equal(result.registryEntry.branch, null);
  assert.equal(result.repoMembers.length, 1);
  assert.equal(result.repoMembers[0]?.sourcePath, canonicalRepoPath);
  assert.equal(result.repoMembers[0]?.strategy, "worktree");
  assert.equal(result.repoMembers[0]?.blueprintProject, true);

  const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8")) as {
    name: string;
    path: string;
    repos: Array<{ path: string }>;
  };
  const registry = JSON.parse(await fs.readFile(result.registryPath, "utf8")) as {
    workspaces: Array<{ name: string; path: string }>;
  };

  assert.equal(manifest.name, "feature-a");
  assert.equal(manifest.path, result.workspacePath);
  assert.equal(manifest.repos[0]?.path, result.repoMembers[0]?.path);
  assert.equal(registry.workspaces.length, 1);
  assert.equal(registry.workspaces[0]?.name, "feature-a");
  assert.equal(registry.workspaces[0]?.path, result.workspacePath);

  const listed = await withGlobalHome(globalHome, () => blueprintWorkspaceRegistryGet());
  assert.equal(listed.workspaces.length, 1);
  assert.equal(listed.workspaces[0]?.manifestPath, result.manifestPath);
});

test("blueprint_workspace_create rolls back disk state and newly-created source branches when host-global registry persistence fails", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-rollback-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const configuredWorkspaceRoot = path.join(tempRoot, "configured-workspaces");
  const brokenGlobalHome = path.join(tempRoot, "global-home-file");

  await fs.mkdir(path.join(repoPath, ".blueprint"), { recursive: true });
  await fs.writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify(
      {
        version: 2,
        maintenance: {
          workspace_root: configuredWorkspaceRoot
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await runGit(["add", ".blueprint/config.json"], repoPath);
  await runGit(["commit", "-m", "add blueprint config"], repoPath);
  await fs.writeFile(brokenGlobalHome, "not-a-directory", "utf8");

  await assert.rejects(
    withGlobalHome(brokenGlobalHome, () =>
      blueprintWorkspaceCreate({
        cwd: repoPath,
        name: "feature-b",
        branch: "feature-b"
      })
    ),
    /ENOTDIR|not a directory|EEXIST/
  );

  const workspacePath = path.join(configuredWorkspaceRoot, "feature-b");
  const worktreeList = await runGit(["worktree", "list", "--porcelain"], repoPath);

  await assert.rejects(fs.access(workspacePath));
  await assert.rejects(fs.access(path.join(workspacePath, ".blueprint-workspace.json")));
  assert.doesNotMatch(worktreeList, /feature-b/);
  assert.equal(await runGit(["branch", "--list", "feature-b"], repoPath), "");
});

test("blueprint_workspace_create appends to an existing host-global registry document", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-registry-update-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");

  const firstWorkspace = await withGlobalHome(globalHome, () =>
    blueprintWorkspaceCreate({
      cwd: repoPath,
      name: "feature-a",
      path: path.join(tempRoot, "workspaces", "feature-a")
    })
  );
  const secondWorkspace = await withGlobalHome(globalHome, () =>
    blueprintWorkspaceCreate({
      cwd: repoPath,
      name: "feature-b",
      path: path.join(tempRoot, "workspaces", "feature-b")
    })
  );

  const registry = JSON.parse(await fs.readFile(firstWorkspace.registryPath, "utf8")) as {
    workspaces: Array<{ name: string; path: string }>;
  };

  assert.deepEqual(
    registry.workspaces.map((workspace) => workspace.name),
    ["feature-a", "feature-b"]
  );
  assert.deepEqual(
    registry.workspaces.map((workspace) => workspace.path),
    [firstWorkspace.workspacePath, secondWorkspace.workspacePath]
  );
});

test("blueprint_workspace_create tracks origin branch when worktree mode targets a remote-only branch", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-remote-branch-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const seedRepo = await createGitRepo(tempRoot, "seed");
  const remoteRepoPath = path.join(tempRoot, "remote.git");
  await runGit(["clone", "--bare", seedRepo, remoteRepoPath]);
  await runGit(["remote", "add", "origin", remoteRepoPath], seedRepo);
  await runGit(["push", "-u", "origin", "main"], seedRepo);
  await runGit(["checkout", "-b", "feature-remote"], seedRepo);
  await fs.writeFile(path.join(seedRepo, "feature.txt"), "feature branch\n", "utf8");
  await runGit(["add", "feature.txt"], seedRepo);
  await runGit(["commit", "-m", "feature remote"], seedRepo);
  await runGit(["push", "-u", "origin", "feature-remote"], seedRepo);
  await runGit(["checkout", "main"], seedRepo);

  const sourceRepo = path.join(tempRoot, "source");
  await runGit(["clone", remoteRepoPath, sourceRepo]);
  await runGit(["config", "user.name", "Blueprint Tests"], sourceRepo);
  await runGit(["config", "user.email", "blueprint-tests@example.com"], sourceRepo);

  assert.equal(await runGit(["branch", "--list", "feature-remote"], sourceRepo), "");

  const featureHead = await runGit(["rev-parse", "feature-remote"], seedRepo);
  const globalHome = path.join(tempRoot, "global-home");
  const workspacePath = path.join(tempRoot, "workspaces", "feature-remote");
  const result = await withGlobalHome(globalHome, () =>
    blueprintWorkspaceCreate({
      cwd: sourceRepo,
      name: "feature-remote",
      path: workspacePath,
      branch: "feature-remote"
    })
  );

  assert.equal(result.repoMembers[0]?.branch, "feature-remote");
  assert.equal(await runGit(["rev-parse", "HEAD"], result.repoMembers[0]!.path), featureHead);
  assert.equal(
    await runGit(
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
      result.repoMembers[0]!.path
    ),
    "origin/feature-remote"
  );
});

test("blueprint_workspace_create rejects invalid branch names before git mutation", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-invalid-branch-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const workspacePath = path.join(tempRoot, "workspaces", "invalid-branch");

  await assert.rejects(
    withGlobalHome(globalHome, () =>
      blueprintWorkspaceCreate({
        cwd: repoPath,
        name: "invalid-branch",
        path: workspacePath,
        branch: "-bad-branch"
      })
    ),
    /Workspace branch name is invalid: -bad-branch/
  );

  await assert.rejects(fs.access(workspacePath));
  assert.doesNotMatch(
    await runGit(["worktree", "list", "--porcelain"], repoPath),
    new RegExp(workspacePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
});

test("blueprint_workspace_create rejects unsupported workspace registry versions before mutation", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-version-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const registryPath = path.join(globalHome, "workspaces.json");
  const workspacePath = path.join(tempRoot, "workspaces", "feature-version");
  const unsupportedRegistry = {
    version: 99,
    workspaces: []
  };

  await fs.mkdir(globalHome, { recursive: true });
  await fs.writeFile(registryPath, `${JSON.stringify(unsupportedRegistry, null, 2)}\n`, "utf8");

  await assert.rejects(
    withGlobalHome(globalHome, () =>
      blueprintWorkspaceCreate({
        cwd: repoPath,
        name: "feature-version",
        path: workspacePath
      })
    ),
    /Workspace registry version is unsupported/
  );

  await assert.rejects(fs.access(workspacePath));
  assert.deepEqual(
    JSON.parse(await fs.readFile(registryPath, "utf8")),
    unsupportedRegistry
  );
});

test("blueprint_workspace_create surfaces malformed config instead of falling back to the default workspace root", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-config-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const fakeHome = path.join(tempRoot, "home");

  await fs.mkdir(path.join(repoPath, ".blueprint"), { recursive: true });
  await fs.writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n", "utf8");

  await assert.rejects(
    withHomeDirectory(fakeHome, () =>
      withGlobalHome(globalHome, () =>
        blueprintWorkspaceCreate({
          cwd: repoPath,
          name: "feature-config"
        })
      )
    ),
    /config\.json is not valid JSON/
  );

  await assert.rejects(
    fs.access(path.join(fakeHome, "blueprint-workspaces", "feature-config"))
  );
});

test("blueprint_workspace_create refuses installed extension repos and installed extension target paths", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-extension-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const extensionRepo = await createGitRepo(tempRoot, "installed-extension");
  const otherRepo = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = extensionRepo;
  const extensionTarget = path.join(extensionPath, "workspaces", "feature-target");

  await assert.rejects(
    withEnvironment({ BLUEPRINT_EXTENSION_PATH: extensionPath }, () =>
      withGlobalHome(globalHome, () =>
        blueprintWorkspaceCreate({
          cwd: extensionRepo,
          name: "feature-source"
        })
      )
    ),
    /Workspace source repo must not target the installed extension directory/
  );

  await assert.rejects(
    withEnvironment({ BLUEPRINT_EXTENSION_PATH: extensionPath }, () =>
      withGlobalHome(globalHome, () =>
        blueprintWorkspaceCreate({
          cwd: otherRepo,
          name: "feature-target",
          path: extensionTarget
        })
      )
    ),
    /Workspace path must not target the installed extension directory/
  );

  await assert.rejects(fs.access(extensionTarget));
  const registryResult = await withGlobalHome(globalHome, () => blueprintWorkspaceRegistryGet());
  assert.deepEqual(registryResult.workspaces, []);
});

test("blueprint_workspace_registry_get recovers from the newest backup when the primary registry file is missing", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-registry-recover-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const registryPath = path.join(globalHome, "workspaces.json");
  const backupPath = path.join(globalHome, "workspaces.json.bak-1234-5678");
  const recoveredDocument = {
    version: 1,
    workspaces: [
      {
        name: "feature-recovered",
        path: path.join(tempRoot, "workspaces", "feature-recovered"),
        manifestPath: path.join(
          tempRoot,
          "workspaces",
          "feature-recovered",
          ".blueprint-workspace.json"
        ),
        strategy: "worktree",
        branch: null,
        createdAt: "2026-04-22T00:00:00.000Z",
        repos: [
          {
            name: "repo",
            sourcePath: path.join(tempRoot, "repo"),
            path: path.join(tempRoot, "workspaces", "feature-recovered", "repo"),
            strategy: "worktree",
            branch: null,
            head: "abc123",
            blueprintProject: false
          }
        ]
      }
    ]
  };

  await fs.mkdir(globalHome, { recursive: true });
  await fs.writeFile(backupPath, `${JSON.stringify(recoveredDocument, null, 2)}\n`, "utf8");

  const result = await withGlobalHome(globalHome, () => blueprintWorkspaceRegistryGet());

  assert.equal(result.workspaces.length, 1);
  assert.equal(result.workspaces[0]?.name, "feature-recovered");
  assert.deepEqual(JSON.parse(await fs.readFile(registryPath, "utf8")), recoveredDocument);
});

test("blueprint_workspace_create waits for the registry lock before mutating workspace state", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-locking-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const registryLockPath = path.join(globalHome, "workspaces.json.lock");
  const workspacePath = path.join(tempRoot, "workspaces", "feature-lock");

  await fs.mkdir(registryLockPath, { recursive: true });

  const createPromise = withGlobalHome(globalHome, () =>
    blueprintWorkspaceCreate({
      cwd: repoPath,
      name: "feature-lock",
      path: workspacePath
    })
  );

  await new Promise((resolve) => setTimeout(resolve, 150));
  await assert.rejects(fs.access(workspacePath));

  await fs.rm(registryLockPath, { recursive: true, force: true });
  const result = await createPromise;

  assert.equal(result.workspacePath, workspacePath);
  assert.equal((await withGlobalHome(globalHome, () => blueprintWorkspaceRegistryGet())).workspaces.length, 1);
});

test("blueprint_workspace_create allows workspace roots that merely share a path prefix with the source repo", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-prefix-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const workspacePath = path.join(tempRoot, "repo-workspaces", "feature-prefix");

  const result = await withGlobalHome(globalHome, () =>
    blueprintWorkspaceCreate({
      cwd: repoPath,
      name: "feature-prefix",
      path: workspacePath
    })
  );

  assert.equal(result.workspacePath, workspacePath);
  await fs.access(path.join(workspacePath, ".blueprint-workspace.json"));
});

test("blueprint_workspace_create rolls back partially-created worktrees and branches when git reports failure after mutation", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workspace-partial-worktree-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const workspacePath = path.join(tempRoot, "workspaces", "feature-partial");
  const fakeBin = path.join(tempRoot, "fake-bin");
  const realGitPath = (await execFileAsync("sh", ["-lc", "command -v git"])).stdout.trim();
  const fakeGitPath = path.join(fakeBin, "git");

  await fs.mkdir(fakeBin, { recursive: true });
  await fs.writeFile(
    fakeGitPath,
    `#!/bin/sh
set -eu
REAL_GIT=${JSON.stringify(realGitPath)}
if [ "$#" -ge 6 ] && [ "$3" = "worktree" ] && [ "$4" = "add" ]; then
  "$REAL_GIT" "$@"
  status=$?
  if [ "$status" -ne 0 ]; then
    exit "$status"
  fi
  exit 1
fi
exec "$REAL_GIT" "$@"
`,
    "utf8"
  );
  await fs.chmod(fakeGitPath, 0o755);

  await assert.rejects(
    withEnvironment(
      {
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`
      },
      () =>
        withGlobalHome(globalHome, () =>
          blueprintWorkspaceCreate({
            cwd: repoPath,
            name: "feature-partial",
            path: workspacePath,
            branch: "feature-partial"
          })
        )
    ),
    /Command failed/
  );

  await assert.rejects(fs.access(workspacePath));
  assert.equal(await runGit(["branch", "--list", "feature-partial"], repoPath), "");
  assert.doesNotMatch(
    await runGit(["worktree", "list", "--porcelain"], repoPath),
    /feature-partial/
  );
});
