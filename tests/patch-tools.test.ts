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
  blueprintPatchReapply
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
