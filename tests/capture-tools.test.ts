import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintArtifactMutateIndex,
  blueprintArtifactScaffold
} from "../src/mcp/tools/artifacts.js";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function createCaptureRepo(initialized = true): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-capture-tools-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");

  if (!initialized) {
    return repoPath;
  }

  await mkdir(path.join(repoPath, ".blueprint/phases"), { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "# Roadmap\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 1
- Active command: /blu:progress
- Next action: Run /blu:progress
- Last updated: 2026-04-12T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify({ version: 2 }, null, 2),
    "utf8"
  );

  return repoPath;
}

test("capture tools register blueprint_artifact_mutate_index", () => {
  assert.ok(
    blueprintToolNames.includes("blueprint_artifact_mutate_index"),
    "blueprint_artifact_mutate_index should be registered"
  );
});

test("blueprint_artifact_mutate_index appends a backlog entry and reserves an optional 999.x stub", async (t) => {
  const repoPath = await createCaptureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintArtifactMutateIndex({
    cwd: repoPath,
    target: "backlog",
    entry: {
      text: "Offline mode",
      addedAt: "2026-04-12",
      reservePhaseStub: true
    }
  });
  const backlogBody = await readFile(
    path.join(repoPath, ".blueprint/backlog/BACKLOG.md"),
    "utf8"
  );

  assert.equal(result.status, "created");
  assert.equal(result.targetPath, ".blueprint/backlog/BACKLOG.md");
  assert.deepEqual(result.createdEntryIds, ["BACKLOG-001"]);
  assert.deepEqual(result.duplicateEntryIds, []);
  assert.equal(result.updatedCounts.added, 1);
  assert.equal(result.updatedCounts.preserved, 0);
  assert.equal(result.reservedPhase?.phaseNumber, "999.1");
  assert.equal(result.reservedPhase?.phaseDir, ".blueprint/phases/999.1-offline-mode");
  assert.deepEqual(result.reservedPhase?.artifactPaths, [
    ".blueprint/phases/999.1-offline-mode/999.1-CONTEXT.md"
  ]);
  assert.match(backlogBody, /^# Backlog/m);
  assert.match(backlogBody, /### BACKLOG-001/);
  assert.match(backlogBody, /- Added: 2026-04-12/);
  assert.match(backlogBody, /- Status: backlog/);
  assert.match(backlogBody, /- Reserved Phase: 999\.1/);
  assert.match(backlogBody, /- Description: Offline mode/);

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: result.reservedPhase?.artifactPaths
  });

  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/999.1-offline-mode/999.1-CONTEXT.md")
    ),
    true
  );
});

test("blueprint_artifact_mutate_index appends todo entries with open status", async (t) => {
  const repoPath = await createCaptureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintArtifactMutateIndex({
    cwd: repoPath,
    target: "todo",
    entry: {
      text: "Add retry telemetry",
      addedAt: "2026-04-12"
    }
  });
  const todoBody = await readFile(
    path.join(repoPath, ".blueprint/todos/TODO.md"),
    "utf8"
  );

  assert.equal(result.status, "created");
  assert.equal(result.targetPath, ".blueprint/todos/TODO.md");
  assert.deepEqual(result.createdEntryIds, ["TODO-001"]);
  assert.deepEqual(result.duplicateEntryIds, []);
  assert.equal(result.updatedCounts.added, 1);
  assert.equal(result.updatedCounts.preserved, 0);
  assert.equal(result.reservedPhase, null);
  assert.match(todoBody, /^# Todos/m);
  assert.match(todoBody, /### TODO-001/);
  assert.match(todoBody, /- Added: 2026-04-12/);
  assert.match(todoBody, /- Status: open/);
  assert.match(todoBody, /- Description: Add retry telemetry/);
});

test("blueprint_artifact_mutate_index rejects duplicate backlog ideas after normalization", async (t) => {
  const repoPath = await createCaptureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactMutateIndex({
    cwd: repoPath,
    target: "backlog",
    entry: {
      text: "Offline mode"
    }
  });
  const duplicate = await blueprintArtifactMutateIndex({
    cwd: repoPath,
    target: "backlog",
    entry: {
      text: "  offline   mode  "
    }
  });
  const backlogBody = await readFile(
    path.join(repoPath, ".blueprint/backlog/BACKLOG.md"),
    "utf8"
  );

  assert.equal(duplicate.status, "duplicate");
  assert.deepEqual(duplicate.createdEntryIds, []);
  assert.deepEqual(duplicate.duplicateEntryIds, ["BACKLOG-001"]);
  assert.equal(duplicate.updatedCounts.duplicates, 1);
  assert.doesNotMatch(backlogBody, /BACKLOG-002/);
});

test("blueprint_artifact_mutate_index degrades safely when no Blueprint project exists", async (t) => {
  const repoPath = await createCaptureRepo(false);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintArtifactMutateIndex({
    cwd: repoPath,
    target: "backlog",
    entry: {
      text: "Offline mode"
    }
  });

  assert.equal(result.status, "project_missing");
  assert.deepEqual(result.createdEntryIds, []);
  assert.match(result.warnings.join("\n"), /\/blu:new-project/);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/backlog/BACKLOG.md")),
    false
  );
});
