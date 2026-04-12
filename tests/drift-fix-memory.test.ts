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
      "docs/drift-fixes/2026-04-12-parallel-extension-repair-plan.md"
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

test("claim prevents duplicate claims and complete moves the task to completed", async () => {
  await withTempRoot(async (root) => {
    assert.equal(exec(root, ["init"]).status, 0);
    assert.equal(
      exec(root, [
        "claim",
        "--agent",
        "agent-a",
        "--task",
        "DF-001",
        "--summary",
        "Own runtime vocabulary helper"
      ]).status,
      0
    );

    const duplicate = exec(root, [
      "claim",
      "--agent",
      "agent-b",
      "--task",
      "DF-001"
    ]);

    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /already claimed by agent-a/);

    const complete = exec(root, [
      "complete",
      "--agent",
      "agent-a",
      "--task",
      "DF-001",
      "--summary",
      "Helper added",
      "--tests",
      "npm test -- --test-name-pattern=runtime vocabulary",
      "--files",
      "src/mcp/tools/project.ts,tests/runtime-tool-contracts.test.ts"
    ]);

    assert.equal(complete.status, 0, complete.stderr);

    const completion = JSON.parse(
      await fs.readFile(path.join(root, "completed", "DF-001.json"), "utf8")
    ) as { agentId: string; files: string[]; tests: string };

    assert.equal(completion.agentId, "agent-a");
    assert.deepEqual(completion.files, [
      "src/mcp/tools/project.ts",
      "tests/runtime-tool-contracts.test.ts"
    ]);
    assert.equal(
      completion.tests,
      "npm test -- --test-name-pattern=runtime vocabulary"
    );
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
