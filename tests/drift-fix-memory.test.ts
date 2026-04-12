import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "drift-fix-memory.mjs");

async function withTempRoot(run: (root: string) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-drift-memory-"));

  try {
    await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

function exec(root: string, args: string[]) {
  const result = spawnSync("node", [scriptPath, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BLUEPRINT_DRIFT_MEMORY_ROOT: root
    },
    encoding: "utf8"
  });

  return result;
}

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  return result;
}

async function withTempGitRepo(run: (repo: string) => Promise<void>) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-drift-worktree-"));

  try {
    git(repo, ["init"]);
    git(repo, ["checkout", "-b", "main"]);
    git(repo, ["config", "user.name", "Codex Test"]);
    git(repo, ["config", "user.email", "codex@example.com"]);

    await fs.mkdir(path.join(repo, "src"), { recursive: true });
    await fs.writeFile(path.join(repo, "src", "runtime-helper.ts"), "export const value = 1;\n", "utf8");

    git(repo, ["add", "src/runtime-helper.ts"]);
    git(repo, ["commit", "-m", "Initial state"]);

    await run(repo);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
}

test("init creates the shared drift memory layout and manifest", async () => {
  await withTempRoot(async (root) => {
    const init = exec(root, ["init", "--branch", "codex/test"]);

    assert.equal(init.status, 0, init.stderr);
    assert.match(init.stdout, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const manifest = JSON.parse(
      await fs.readFile(path.join(root, "manifest.json"), "utf8")
    ) as { planDoc: string; initialBranch: string };

    assert.equal(
      manifest.planDoc,
      "docs/build/WAVE-2-PARALLEL-CLOSEOUT-PLAN.md"
    );
    assert.equal(manifest.initialBranch, "codex/test");
    await fs.access(path.join(root, "claims"));
    await fs.access(path.join(root, "completed"));
    await fs.access(path.join(root, "blocked"));
    await fs.access(path.join(root, "agents"));
    await fs.access(path.join(root, "notes", "shared"));
    await fs.access(path.join(root, "notes", "tasks"));
  });
});

test("claim prevents duplicate claims and complete records verified changed files", async () => {
  await withTempRoot(async (root) => {
    await withTempGitRepo(async (worktree) => {
      assert.equal(exec(root, ["init"]).status, 0);
      assert.equal(
        exec(root, [
          "claim",
          "--agent",
          "agent-a",
          "--task",
          "W2-03",
          "--summary",
          "Implement complete-milestone manifest",
          "--worktree",
          worktree,
          "--branch",
          "codex/test"
        ]).status,
        0
      );

      const duplicate = exec(root, [
        "claim",
        "--agent",
        "agent-b",
        "--task",
        "W2-03"
      ]);

      assert.equal(duplicate.status, 1);
      assert.match(duplicate.stderr, /already claimed by agent-a/);

      await fs.writeFile(
        path.join(worktree, "src", "runtime-helper.ts"),
        "export const value = 2;\n",
        "utf8"
      );

      const complete = exec(root, [
        "complete",
        "--agent",
        "agent-a",
        "--task",
        "W2-03",
        "--summary",
        "Manifest updated",
        "--tests",
        "npm test -- tests/complete-milestone-metadata.test.ts",
        "--files",
        "src/runtime-helper.ts"
      ]);

      assert.equal(complete.status, 0, complete.stderr);

      const completion = JSON.parse(
        await fs.readFile(path.join(root, "completed", "W2-03.json"), "utf8")
      ) as {
        agentId: string;
        files: string[];
        tests: string;
        verifiedFiles: string[];
      };

      assert.equal(completion.agentId, "agent-a");
      assert.deepEqual(completion.files, ["src/runtime-helper.ts"]);
      assert.deepEqual(completion.verifiedFiles, ["src/runtime-helper.ts"]);
      assert.equal(
        completion.tests,
        "npm test -- tests/complete-milestone-metadata.test.ts"
      );
    });
  });
});

test("complete rejects no-op claims unless an explicit no-file-change reason is given", async () => {
  await withTempRoot(async (root) => {
    await withTempGitRepo(async (worktree) => {
      assert.equal(exec(root, ["init"]).status, 0);
      assert.equal(
        exec(root, [
          "claim",
          "--agent",
          "agent-a",
          "--task",
          "W2-08",
          "--summary",
          "Run final regression pass",
          "--worktree",
          worktree,
          "--branch",
          "codex/test"
        ]).status,
        0
      );

      const rejected = exec(root, [
        "complete",
        "--agent",
        "agent-a",
        "--task",
        "W2-08",
        "--summary",
        "Regression pass complete",
        "--tests",
        "npm test",
        "--files",
        "src/runtime-helper.ts"
      ]);

      assert.equal(rejected.status, 1);
      assert.match(rejected.stderr, /No change evidence found/);

      const allowed = exec(root, [
        "complete",
        "--agent",
        "agent-a",
        "--task",
        "W2-08",
        "--summary",
        "Regression-only closeout",
        "--tests",
        "npm test",
        "--no-files-reason",
        "Regression-only pass; no repo edits were needed."
      ]);

      assert.equal(allowed.status, 0, allowed.stderr);

      const completion = JSON.parse(
        await fs.readFile(path.join(root, "completed", "W2-08.json"), "utf8")
      ) as { files: string[]; noFilesReason: string };

      assert.deepEqual(completion.files, []);
      assert.equal(
        completion.noFilesReason,
        "Regression-only pass; no repo edits were needed."
      );
    });
  });
});

test("note writes shared and task-scoped notes for later agents", async () => {
  await withTempRoot(async (root) => {
    assert.equal(exec(root, ["init"]).status, 0);

    const shared = exec(root, [
      "note",
      "--agent",
      "agent-a",
      "--title",
      "Gemini smoke note",
      "--body",
      "Use a clean HOME when running gemini extensions link."
    ]);

    assert.equal(shared.status, 0, shared.stderr);

    const taskNote = exec(root, [
      "note",
      "--agent",
      "agent-b",
      "--task",
      "DF-015",
      "--title",
      "Smoke harness finding",
      "--body",
      "gemini extensions validate succeeds before link smoke."
    ]);

    assert.equal(taskNote.status, 0, taskNote.stderr);

    const sharedNotes = await fs.readdir(path.join(root, "notes", "shared"));
    const taskNotes = await fs.readdir(path.join(root, "notes", "tasks", "DF-015"));

    assert.equal(sharedNotes.length, 1);
    assert.equal(taskNotes.length, 1);
  });
});
