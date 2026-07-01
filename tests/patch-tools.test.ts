import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintPatchList,
  blueprintPatchRecord,
  blueprintPatchReapply,
  workspaceToolTestHooks
} from "../src/mcp/tools/workspace.js";

const execFileAsync = promisify(execFile);

type Deferred<T = void> = {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(error: unknown): void;
};

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function waitForCondition(label: string, predicate: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }

    await sleep(10);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function waitFor<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label}.`));
    }, 5000);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

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

async function waitForPath(filePath: string): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    try {
      await fs.access(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw new Error(`Timed out waiting for ${filePath}`);
}

async function createFakeGitThatFailsAfterRealApply(
  tempRoot: string
): Promise<string> {
  const realGitPath = (await execFileAsync("which", ["git"])).stdout.trim() ||
    "/usr/bin/git";
  const fakeBinPath = path.join(tempRoot, "fake-bin");
  const fakeGitPath = path.join(fakeBinPath, "git");

  await fs.mkdir(fakeBinPath, { recursive: true });
  await fs.writeFile(
    fakeGitPath,
    `#!/bin/sh
real_git=${JSON.stringify(realGitPath)}
is_apply=0
is_check=0
for arg in "$@"; do
  if [ "$arg" = "apply" ]; then
    is_apply=1
  fi
  if [ "$arg" = "--check" ]; then
    is_check=1
  fi
done
if [ "$is_apply" = "1" ] && [ "$is_check" = "0" ]; then
  "$real_git" "$@"
  code=$?
  if [ "$BLUEPRINT_TEST_FAIL_REAL_APPLY_AFTER_MUTATION" = "1" ]; then
    exit 1
  fi
  exit $code
fi
exec "$real_git" "$@"
`,
    "utf8"
  );
  await fs.chmod(fakeGitPath, 0o755);

  return fakeBinPath;
}

async function recordPatchFromCurrentDiff(
  repoPath: string,
  globalHome: string,
  patchId: string
): Promise<string> {
  const patch = await runGit(["diff", "--binary", "HEAD", "--", "README.md"], repoPath);

  await withGlobalHome(globalHome, () =>
    blueprintPatchRecord({
      cwd: repoPath,
      patchId,
      patch,
      trackedFiles: ["README.md"],
      label: patchId
    })
  );

  return patch;
}

test("patch tools register host-global patch list, record, and replay MCP entries", () => {
  assert.ok(blueprintToolNames.includes("blueprint_patch_list"));
  assert.ok(blueprintToolNames.includes("blueprint_patch_record"));
  assert.ok(blueprintToolNames.includes("blueprint_patch_reapply"));
});

test("patch list returns empty without creating missing host-global Blueprint home", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-list-empty-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  const globalHome = path.join(tempRoot, "missing-global-home");

  assert.equal(await pathExists(globalHome), false);

  const listed = await withGlobalHome(globalHome, () => blueprintPatchList({}));

  assert.equal(listed.registryPath, path.join(globalHome, "patches"));
  assert.deepEqual(listed.patches, []);
  assert.equal(await pathExists(globalHome), false);
});

test("patch list rejects explicit missing patch ids without creating missing host-global Blueprint home", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-list-missing-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  const globalHome = path.join(tempRoot, "missing-global-home");

  assert.equal(await pathExists(globalHome), false);

  await assert.rejects(
    withGlobalHome(globalHome, () =>
      blueprintPatchList({
        patchIds: ["missing-patch"]
      })
    ),
    /Patch target is missing from the registry: missing-patch/
  );
  assert.equal(await pathExists(globalHome), false);
});

test("patch tools support clean replay and audit recording from the host-global registry", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-clean-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\npatched line\n", "utf8");
  const patch = await recordPatchFromCurrentDiff(repoPath, globalHome, "readme-fix");
  await runGit(["checkout", "--", "README.md"], repoPath);

  const listed = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath
    })
  );

  assert.equal(listed.registryPath, path.join(globalHome, "patches"));
  assert.equal(listed.patches.length, 1);
  assert.equal(listed.patches[0]?.patchId, "readme-fix");
  assert.equal(listed.patches[0]?.compatibility.status, "compatible");

  const preview = await withGlobalHome(globalHome, () =>
    blueprintPatchReapply({
      cwd: repoPath,
      patchIds: ["readme-fix"],
      dryRun: true
    })
  );

  assert.equal(preview.preview, true);
  assert.deepEqual(preview.conflicts, []);

  const replay = await withGlobalHome(globalHome, () =>
    blueprintPatchReapply({
      cwd: repoPath,
      patchIds: ["readme-fix"]
    })
  );

  assert.deepEqual(replay.appliedPatches, ["readme-fix"]);
  assert.deepEqual(replay.conflicts, []);
  assert.match(await fs.readFile(path.join(repoPath, "README.md"), "utf8"), /patched line/);

  const auditResult = await withGlobalHome(globalHome, () =>
    blueprintPatchRecord({
      cwd: repoPath,
      patchId: "readme-fix",
      trackedFiles: ["README.md"],
      audit: {
        action: "reapply",
        outcome: "applied",
        targetHead: replay.targetHead
      }
    })
  );

  const auditLog = await fs.readFile(auditResult.auditPath, "utf8");

  assert.match(auditLog, /"action":"record"/);
  assert.match(auditLog, /"action":"reapply"/);
  assert.match(patch, /patched line/);
});

test("patch replay stops before mutation when the target repo has a dirty tree", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-dirty-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\npatched line\n", "utf8");
  await recordPatchFromCurrentDiff(repoPath, globalHome, "dirty-stop");
  await runGit(["checkout", "--", "README.md"], repoPath);
  await fs.writeFile(path.join(repoPath, "local.txt"), "dirty\n", "utf8");

  await assert.rejects(
    withGlobalHome(globalHome, () =>
      blueprintPatchReapply({
        cwd: repoPath,
        patchIds: ["dirty-stop"]
      })
    ),
    /clean working tree/
  );
});

test("patch replay rolls back worktree changes when real git apply fails after check", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-apply-failure-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const fakeBinPath = await createFakeGitThatFailsAfterRealApply(tempRoot);
  const baseContent = await fs.readFile(path.join(repoPath, "README.md"), "utf8");

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\nmutating patch\n", "utf8");
  await recordPatchFromCurrentDiff(repoPath, globalHome, "apply-fails-after-mutation");
  await runGit(["checkout", "--", "README.md"], repoPath);

  const replay = await withEnvironment(
    {
      BLUEPRINT_TEST_FAIL_REAL_APPLY_AFTER_MUTATION: "1",
      PATH: `${fakeBinPath}${path.delimiter}${process.env.PATH ?? ""}`
    },
    () =>
      withGlobalHome(globalHome, () =>
        blueprintPatchReapply({
          cwd: repoPath,
          patchIds: ["apply-fails-after-mutation"]
        })
      )
  );

  assert.equal(replay.status, "failed");
  assert.deepEqual(replay.appliedPatches, []);
  assert.deepEqual(replay.skippedPatches, ["apply-fails-after-mutation"]);
  assert.equal(replay.rollback?.attempted, true);
  assert.equal(replay.rollback?.succeeded, true);
  assert.deepEqual(replay.rollback?.dirtyFiles, []);
  assert.deepEqual(replay.rollback?.restoredFiles, ["README.md"]);
  assert.match(replay.conflicts[0]?.message ?? "", /rolled back/);
  assert.equal(await fs.readFile(path.join(repoPath, "README.md"), "utf8"), baseContent);
  assert.equal(await runGit(["status", "--short"], repoPath), "");
});

test("patch tools stop on malformed registry metadata", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-malformed-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const patchRegistryPath = path.join(globalHome, "patches");

  await fs.mkdir(patchRegistryPath, { recursive: true });
  await fs.writeFile(
    path.join(patchRegistryPath, "index.json"),
    JSON.stringify({ version: 1, patches: [42] }, null, 2),
    "utf8"
  );

  await assert.rejects(
    withGlobalHome(globalHome, () =>
      blueprintPatchList({
        cwd: repoPath
      })
    ),
    /Patch registry is malformed/
  );
});

test("patch tools reject non-file-safe patch ids from the on-disk registry", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-unsafe-id-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const patchRegistryPath = path.join(globalHome, "patches");

  await fs.mkdir(patchRegistryPath, { recursive: true });
  await fs.writeFile(
    path.join(patchRegistryPath, "index.json"),
    JSON.stringify({ version: 1, patches: ["../escape"] }, null, 2),
    "utf8"
  );

  await assert.rejects(
    withGlobalHome(globalHome, () =>
      blueprintPatchList({
        cwd: repoPath
      })
    ),
    /patch id is not file-safe/
  );
});

test("patch tools reject missing, non-integer, and unsupported registry versions", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-version-drift-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const patchRegistryPath = path.join(globalHome, "patches");
  const cases: Array<{ name: string; document: Record<string, unknown>; pattern: RegExp }> = [
    {
      name: "missing",
      document: { patches: [] },
      pattern: /version must be 1/
    },
    {
      name: "non-integer",
      document: { version: "1", patches: [] },
      pattern: /version must be 1/
    },
    {
      name: "unsupported",
      document: { version: 999, patches: [] },
      pattern: /version is unsupported/
    }
  ];

  await fs.mkdir(patchRegistryPath, { recursive: true });

  for (const entry of cases) {
    await fs.writeFile(
      path.join(patchRegistryPath, "index.json"),
      JSON.stringify(entry.document, null, 2),
      "utf8"
    );

    await assert.rejects(
      withGlobalHome(globalHome, () =>
        blueprintPatchList({
          cwd: repoPath
        })
      ),
      entry.pattern,
      `expected ${entry.name} patch registry version to be rejected`
    );
  }
});

test("concurrent patch records serialize index updates without losing entries", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-concurrent-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");

  await withEnvironment(
    {
      BLUEPRINT_TEST_PATCH_RECORD_BEFORE_INDEX_DELAY_MS: "75"
    },
    () =>
      withGlobalHome(globalHome, () =>
        Promise.all([
          blueprintPatchRecord({
            cwd: repoPath,
            patchId: "concurrent-a",
            patch: "diff --git a/README.md b/README.md\n",
            trackedFiles: ["README.md"],
            sourceVersion: "source-a"
          }),
          blueprintPatchRecord({
            cwd: repoPath,
            patchId: "concurrent-b",
            patch: "diff --git a/README.md b/README.md\n",
            trackedFiles: ["README.md"],
            sourceVersion: "source-b"
          })
        ])
      )
  );

  const listed = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath
    })
  );

  assert.deepEqual(
    listed.patches.map((patch) => patch.patchId).sort(),
    ["concurrent-a", "concurrent-b"]
  );
});

test("patch registry stale recovery preserves a replacement lock held by another waiter", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-stale-lock-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const patchRegistryPath = path.join(globalHome, "patches");
  const patchLockPath = `${patchRegistryPath}.lock`;
  const firstObservedStale = deferred<void>();
  const releaseFirstObserverRecovery = deferred<void>();
  let staleRecoveryAttempts = 0;

  await fs.mkdir(patchLockPath, { recursive: true });
  await fs.writeFile(path.join(patchLockPath, "owner"), "abandoned-owner\n", "utf8");
  await fs.writeFile(path.join(patchLockPath, "lease"), "abandoned-owner\n", "utf8");
  await sleep(80);

  const restoreHooks = workspaceToolTestHooks.setWorkspaceRegistryLockRecoveryHooksForTest({
    beforeStaleRecoveryClaim: async (observedLockPath) => {
      assert.equal(observedLockPath, patchLockPath);
      staleRecoveryAttempts += 1;

      if (staleRecoveryAttempts === 1) {
        firstObservedStale.resolve();
        await releaseFirstObserverRecovery.promise;
      }
    }
  });
  t.after(() => {
    restoreHooks();
    releaseFirstObserverRecovery.resolve();
  });

  await withEnvironment(
    {
      BLUEPRINT_TEST_WORKSPACE_REGISTRY_LOCK_RETRY_MS: "5",
      BLUEPRINT_TEST_WORKSPACE_REGISTRY_LOCK_STALE_MS: "40",
      BLUEPRINT_TEST_WORKSPACE_REGISTRY_LOCK_HEARTBEAT_MS: "10",
      BLUEPRINT_TEST_PATCH_RECORD_BEFORE_INDEX_DELAY_MS: "180"
    },
    () =>
      withGlobalHome(globalHome, async () => {
        const firstObserver = blueprintPatchRecord({
          cwd: repoPath,
          patchId: "first-observer",
          patch: "diff --git a/README.md b/README.md\n",
          trackedFiles: ["README.md"],
          sourceVersion: "first-source"
        });

        await waitFor(firstObservedStale.promise, "first patch stale observer");

        const replacement = blueprintPatchRecord({
          cwd: repoPath,
          patchId: "replacement-owner",
          patch: "diff --git a/README.md b/README.md\n",
          trackedFiles: ["README.md"],
          sourceVersion: "replacement-source"
        });

        await waitForCondition("replacement patch content", () =>
          pathExists(path.join(patchRegistryPath, "replacement-owner.patch"))
        );
        const replacementOwner = await fs.readFile(path.join(patchLockPath, "owner"), "utf8");

        releaseFirstObserverRecovery.resolve();
        await sleep(90);

        assert.equal(await fs.readFile(path.join(patchLockPath, "owner"), "utf8"), replacementOwner);
        await assert.rejects(fs.access(path.join(patchRegistryPath, "first-observer.patch")));

        await Promise.all([replacement, firstObserver]);
      })
  );

  const listed = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath
    })
  );
  assert.deepEqual(
    listed.patches.map((patch) => patch.patchId).sort(),
    ["first-observer", "replacement-owner"]
  );
  assert.equal(staleRecoveryAttempts, 2);
});

test("patch registry readers wait for a consistent patch record snapshot", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-consistent-read-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const markerPath = path.join(tempRoot, "patch-written.marker");

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\nfirst patch\n", "utf8");
  await recordPatchFromCurrentDiff(repoPath, globalHome, "consistent");
  await runGit(["checkout", "--", "README.md"], repoPath);

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\nsecond patch\n", "utf8");
  const secondPatch = await runGit(["diff", "--binary", "HEAD", "--", "README.md"], repoPath);
  await runGit(["checkout", "--", "README.md"], repoPath);

  await withEnvironment(
    {
      BLUEPRINT_TEST_PATCH_RECORD_AFTER_PATCH_WRITE_DELAY_MS: "150",
      BLUEPRINT_TEST_PATCH_RECORD_AFTER_PATCH_WRITE_MARKER: markerPath
    },
    () =>
      withGlobalHome(globalHome, async () => {
        const recordPromise = blueprintPatchRecord({
          cwd: repoPath,
          patchId: "consistent",
          patch: secondPatch,
          trackedFiles: ["README.md"],
          label: "second"
        });

        await waitForPath(markerPath);
        const [listed, preview] = await Promise.all([
          blueprintPatchList({
            cwd: repoPath,
            patchIds: ["consistent"]
          }),
          blueprintPatchReapply({
            cwd: repoPath,
            patchIds: ["consistent"],
            dryRun: true
          })
        ]);
        await recordPromise;

        assert.equal(listed.patches.length, 1);
        assert.equal(listed.patches[0]?.label, "second");
        assert.equal(preview.status, "preview");
        assert.deepEqual(preview.conflicts, []);
      })
  );
});

test("patch record rolls back newly-written patch files when index persistence fails", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-index-failure-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const patchRegistryPath = path.join(globalHome, "patches");

  await assert.rejects(
    withEnvironment(
      {
        BLUEPRINT_TEST_FAIL_PATCH_REGISTRY_WRITE_ONCE: patchRegistryPath
      },
      () =>
        withGlobalHome(globalHome, () =>
          blueprintPatchRecord({
            cwd: repoPath,
            patchId: "index-fails",
            patch: "diff --git a/README.md b/README.md\n",
            trackedFiles: ["README.md"],
            sourceVersion: "source"
          })
        )
    ),
    /Injected patch registry write failure/
  );

  await assert.rejects(fs.access(path.join(patchRegistryPath, "index-fails.patch")));
  await assert.rejects(fs.access(path.join(patchRegistryPath, "index-fails.json")));
  await assert.rejects(fs.access(path.join(patchRegistryPath, "index-fails.audit.ndjson")));

  const listed = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath
    })
  );

  assert.deepEqual(listed.patches, []);
});

test("patch replay stops before mutation on compatibility mismatch", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-mismatch-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo-a");
  const secondRepoPath = await createGitRepo(tempRoot, "repo-b");
  const globalHome = path.join(tempRoot, "global-home");

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo-a\npatched line\n", "utf8");
  const patch = await runGit(["diff", "--binary", "HEAD", "--", "README.md"], repoPath);
  await withGlobalHome(globalHome, () =>
    blueprintPatchRecord({
      cwd: repoPath,
      patchId: "mismatch",
      patch,
      trackedFiles: ["README.md"],
      compatibility: {
        repoRootName: "repo-a"
      }
    })
  );

  await assert.rejects(
    withGlobalHome(globalHome, () =>
      blueprintPatchReapply({
        cwd: secondRepoPath,
        patchIds: ["mismatch"]
      })
    ),
    /compatibility mismatch/
  );
});

test("patch tools reject manifests whose patch id does not match the requested registry entry", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-manifest-mismatch-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const patchRegistryPath = path.join(globalHome, "patches");

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\nalpha line\n", "utf8");
  await recordPatchFromCurrentDiff(repoPath, globalHome, "alpha");
  await runGit(["checkout", "--", "README.md"], repoPath);

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\nbeta line\n", "utf8");
  await recordPatchFromCurrentDiff(repoPath, globalHome, "beta");
  await runGit(["checkout", "--", "README.md"], repoPath);

  const alphaManifestPath = path.join(patchRegistryPath, "alpha.json");
  const alphaManifest = JSON.parse(await fs.readFile(alphaManifestPath, "utf8")) as {
    patchId: string;
  };
  alphaManifest.patchId = "beta";
  await fs.writeFile(alphaManifestPath, JSON.stringify(alphaManifest, null, 2), "utf8");

  await assert.rejects(
    withGlobalHome(globalHome, () =>
      blueprintPatchList({
        cwd: repoPath,
        patchIds: ["alpha"]
      })
    ),
    /recorded manifest patch id does not match its registry entry/
  );
});

test("patch replay reports conflicts without mutating repo files", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-conflict-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\npatched line\n", "utf8");
  await recordPatchFromCurrentDiff(repoPath, globalHome, "conflict");
  await runGit(["checkout", "--", "README.md"], repoPath);

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\nconflicting line\n", "utf8");
  await runGit(["add", "README.md"], repoPath);
  await runGit(["commit", "-m", "conflicting change"], repoPath);

  const result = await withGlobalHome(globalHome, () =>
    blueprintPatchReapply({
      cwd: repoPath,
      patchIds: ["conflict"]
    })
  );

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.appliedPatches, []);
  assert.deepEqual(result.skippedPatches, ["conflict"]);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0]?.patchId, "conflict");
  assert.match(await fs.readFile(path.join(repoPath, "README.md"), "utf8"), /conflicting line/);
});

test("audit-only patch recording preserves stored provenance and last applied metadata for blocked outcomes", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-audit-preserve-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createGitRepo(tempRoot, "repo");
  const globalHome = path.join(tempRoot, "global-home");
  const patchRegistryPath = path.join(globalHome, "patches");

  await fs.writeFile(path.join(repoPath, "README.md"), "# repo\npatched line\n", "utf8");
  await withGlobalHome(globalHome, () =>
    blueprintPatchRecord({
      cwd: repoPath,
      patchId: "audit-preserve",
      patch: "--- a/README.md\n+++ b/README.md\n@@ -1 +1,2 @@\n # repo\n+patched line\n",
      trackedFiles: ["README.md"],
      sourceVersion: "source-sha-1",
      compatibility: {
        host: "gemini",
        repoRootName: "repo",
        remoteUrl: "https://example.com/original.git"
      }
    })
  );

  const appliedResult = await withGlobalHome(globalHome, () =>
    blueprintPatchRecord({
      cwd: repoPath,
      patchId: "audit-preserve",
      trackedFiles: ["README.md"],
      audit: {
        action: "reapply",
        outcome: "applied",
        targetHead: "target-head-applied"
      }
    })
  );

  const appliedManifest = JSON.parse(
    await fs.readFile(path.join(patchRegistryPath, "audit-preserve.json"), "utf8")
  ) as {
    sourceVersion: string | null;
    repoRemote: string | null;
    compatibility: {
      host: string | null;
      repoRootName: string;
      remoteUrl: string | null;
    };
    lastAppliedAt: string | null;
    lastOutcome: string | null;
  };

  await withGlobalHome(globalHome, () =>
    blueprintPatchRecord({
      cwd: repoPath,
      patchId: "audit-preserve",
      trackedFiles: ["README.md"],
      sourceVersion: "source-sha-2",
      compatibility: {
        host: "other-host",
        repoRootName: "other-repo",
        remoteUrl: "https://example.com/override.git"
      },
      audit: {
        action: "reapply",
        outcome: "conflict",
        targetHead: "target-head-conflict",
        conflicts: ["README.md"]
      }
    })
  );

  const blockedManifest = JSON.parse(
    await fs.readFile(path.join(patchRegistryPath, "audit-preserve.json"), "utf8")
  ) as {
    sourceVersion: string | null;
    repoRemote: string | null;
    compatibility: {
      host: string | null;
      repoRootName: string;
      remoteUrl: string | null;
    };
    lastAppliedAt: string | null;
    lastOutcome: string | null;
  };
  const auditLog = await fs.readFile(appliedResult.auditPath, "utf8");

  assert.equal(appliedManifest.sourceVersion, "source-sha-1");
  assert.equal(blockedManifest.sourceVersion, appliedManifest.sourceVersion);
  assert.equal(blockedManifest.repoRemote, appliedManifest.repoRemote);
  assert.deepEqual(blockedManifest.compatibility, appliedManifest.compatibility);
  assert.equal(blockedManifest.lastAppliedAt, appliedManifest.lastAppliedAt);
  assert.equal(blockedManifest.lastOutcome, "conflict");
  assert.match(auditLog, /"outcome":"applied"/);
  assert.match(auditLog, /"outcome":"conflict"/);
});

test("implicit patch replay stays bounded to compatible entries for the current repo", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-patch-compatible-scope-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoAPath = await createGitRepo(tempRoot, "repo-a");
  const repoBPath = await createGitRepo(tempRoot, "repo-b");
  const globalHome = path.join(tempRoot, "global-home");

  await fs.writeFile(path.join(repoAPath, "README.md"), "# repo-a\npatch for repo a\n", "utf8");
  await recordPatchFromCurrentDiff(repoAPath, globalHome, "repo-a-fix");
  await runGit(["checkout", "--", "README.md"], repoAPath);

  await fs.writeFile(path.join(repoBPath, "README.md"), "# repo-b\npatch for repo b\n", "utf8");
  await recordPatchFromCurrentDiff(repoBPath, globalHome, "repo-b-fix");
  await runGit(["checkout", "--", "README.md"], repoBPath);

  const result = await withGlobalHome(globalHome, () =>
    blueprintPatchReapply({
      cwd: repoAPath
    })
  );

  assert.deepEqual(result.appliedPatches, ["repo-a-fix"]);
  assert.deepEqual(result.skippedPatches, []);
  assert.deepEqual(result.conflicts, []);
  assert.match(await fs.readFile(path.join(repoAPath, "README.md"), "utf8"), /patch for repo a/);
  assert.doesNotMatch(
    await fs.readFile(path.join(repoBPath, "README.md"), "utf8"),
    /patch for repo b/
  );
});
