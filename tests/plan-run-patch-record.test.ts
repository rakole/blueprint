import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintPlanRunDiff,
  blueprintPlanRunLoad,
  blueprintPlanRunPatchRecord,
  blueprintPlanRunPrepare,
  blueprintPlanRunRecord
} from "../src/mcp/tools/plan-run.js";
import {
  blueprintPatchList,
  blueprintPatchRecord,
  blueprintWorkspaceCreate
} from "../src/mcp/tools/workspace.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

type TestContextWithCleanup = {
  after(callback: () => void | Promise<void>): void;
};

async function createPlanRunTestRoot(
  t: TestContextWithCleanup
): Promise<{
  workspaceRoot: string;
  globalHome: string;
}> {
  const tempRoot = await mkdtemp(
    path.join(os.tmpdir(), "blueprint-plan-run-patch-record-test-")
  );

  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  return {
    workspaceRoot: path.join(tempRoot, "workspaces"),
    globalHome: path.join(tempRoot, "global-home")
  };
}

async function createPlanRunRepo(
  workspaceRoot: string,
  filesModified = ["src/app.ts"]
): Promise<{
  repoPath: string;
}> {
  const repoPath = await createCommittedGitRepo("blueprint-plan-run-patch-record-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-phase-discovery");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(path.join(repoPath, "assets"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, "src/app.ts"), "export const value = 'base';\n", "utf8");

  if (filesModified.includes("assets/blob.bin")) {
    await writeFile(path.join(repoPath, "assets/blob.bin"), Buffer.from([0, 1, 2, 3]));
  }

  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    "# Requirements\n\n- LIFE-01: exercise PlanRun patch capture.\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery** - Add PlanRun patch capture support

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Add PlanRun patch capture support.
**Requirements**: LIFE-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-04-11T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify(
      {
        version: 2,
        workflow: {
          use_worktrees: true
        },
        maintenance: {
          workspace_root: workspaceRoot
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "03-01-PLAN.md"),
    validPlanContent(filesModified),
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "plan-run patch capture baseline"], repoPath);

  return {
    repoPath
  };
}

function validPlanContent(filesModified: string[]): string {
  return `---
phase: 3
plan_id: "01"
title: "Plan 01"
wave: 1
status: planned
objective: "Capture a PlanRun patch."
depends_on: []
requirements:
  - LIFE-01
files_modified:
${filesModified.map((filePath) => `  - ${filePath}`).join("\n")}
read_first:
  - src/mcp/tools/plan-run.ts
acceptance_criteria:
  - npm test -- tests/plan-run-patch-record.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Capture a PlanRun patch.

## Scope

- Add PlanRun patch capture.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | tests/plan-run-patch-record.test.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-01-PLAN.md | used | Provides the authorized file surface. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
${filesModified.map((filePath) => `| ${filePath} | Task 1 | tests/plan-run-patch-record.test.ts exits 0 |`).join("\n")}

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Phase summary | deferred | Later PlanRun wave |

## Tasks

### Task 1: Capture patch

#### Read First

- src/mcp/tools/plan-run.ts

#### Action

- Capture the authorized implementation diff as a patch registry record.

#### Acceptance Criteria

- npm test -- tests/plan-run-patch-record.test.ts exits 0

## External Service Prerequisites

| Service | Category | Purpose | User Setup / Startup | Readiness Check | Can Agent Proceed Without It |
|---------|----------|---------|----------------------|-----------------|------------------------------|
| none | none | No external services are required. | No user setup required. | Repo-local execution only. | yes |

## Verification

- npm test passes for PlanRun patch capture coverage

## Must Haves

- Unauthorized changes block patch registry persistence.
`;
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPath(filePath: string): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    try {
      await access(filePath);
      return;
    } catch {
      await sleep(10);
    }
  }

  throw new Error(`Timed out waiting for ${filePath}`);
}

async function prepareRun(
  repoPath: string,
  globalHome: string
): Promise<{
  worktreePath: string;
}> {
  const prepared = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-01",
      mode: "prepare"
    })
  );

  assert.equal(prepared.status, "prepared");
  assert.ok(prepared.worktreePath);

  return {
    worktreePath: prepared.worktreePath
  };
}

test("plan-run patch record tool registers the MCP entry", () => {
  assert.ok(blueprintToolNames.includes("blueprint_plan_run_patch_record"));
});

test("plan-run patch record captures authorized worktree diff and updates run metadata", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const { worktreePath } = await prepareRun(repoPath, globalHome);

  await writeFile(path.join(worktreePath, "src/app.ts"), "export const value = 'changed';\n", "utf8");
  await writeFile(path.join(repoPath, "source-dirty.txt"), "dirty source should not matter\n", "utf8");

  const diff = await blueprintPlanRunDiff({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    includePatch: true
  });

  assert.equal(diff.status, "ready");
  assert.deepEqual(diff.changedFiles, [
    {
      path: "src/app.ts",
      status: "modified",
      authorized: true
    }
  ]);
  assert.doesNotMatch(diff.diffStat, /source-dirty/);

  const recorded = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPatchRecord({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      commandsRun: [
        {
          command: "npm test -- tests/plan-run-patch-record.test.ts",
          exitCode: 0,
          stdoutTail: "ok"
        }
      ],
      verification: [
        {
          command: "npm test -- tests/plan-run-patch-record.test.ts",
          result: "pass",
          evidence: "Focused PlanRun patch capture coverage passed."
        }
      ]
    })
  );

  assert.equal(recorded.status, "recorded");
  assert.equal(recorded.patchId, "plan-run-3-01-run-01");
  assert.equal(path.basename(recorded.patchPath ?? ""), "plan-run-3-01-run-01.patch");
  assert.equal(recorded.diffRoot, worktreePath);
  assert.deepEqual(recorded.unauthorizedChangedFiles, []);
  assert.match(await readFile(recorded.patchPath ?? "", "utf8"), /changed/);

  const listed = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath,
      patchIds: ["plan-run-3-01-run-01"]
    })
  );

  assert.equal(listed.patches.length, 1);
  assert.equal(listed.patches[0]?.patchId, "plan-run-3-01-run-01");
  assert.equal(listed.patches[0]?.compatibility.status, "compatible");

  const loaded = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });

  assert.equal(loaded.found, true);
  assert.equal(loaded.run?.git.patchId, "plan-run-3-01-run-01");
  assert.deepEqual(loaded.run?.git.changedFiles, ["src/app.ts"]);
  assert.equal(loaded.history.at(-1)?.status, "IMPLEMENTED");
});

test("plan-run patch record preserves existing patch registry entries", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const { worktreePath } = await prepareRun(repoPath, globalHome);

  await withGlobalHome(globalHome, () =>
    blueprintPatchRecord({
      cwd: repoPath,
      patchId: "manual-entry",
      patch: "diff --git a/src/app.ts b/src/app.ts\n",
      trackedFiles: ["src/app.ts"],
      sourceVersion: "manual-source"
    })
  );
  await writeFile(path.join(worktreePath, "src/app.ts"), "export const value = 'changed';\n", "utf8");

  const recorded = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPatchRecord({
      cwd: repoPath,
      phase: "3",
      planId: "1"
    })
  );
  const listed = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath
    })
  );

  assert.equal(recorded.status, "recorded");
  assert.deepEqual(
    listed.patches.map((patch) => patch.patchId).sort(),
    ["manual-entry", "plan-run-3-01-run-01"]
  );
});

test("plan-run patch record rolls back global patch entry when run metadata persistence fails", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const { worktreePath } = await prepareRun(repoPath, globalHome);
  const loadedBefore = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });
  const patchId = "plan-run-3-01-run-01";
  const patchRegistryPath = path.join(globalHome, "patches");

  assert.ok(loadedBefore.path);
  await writeFile(path.join(worktreePath, "src/app.ts"), "export const value = 'changed';\n", "utf8");

  await assert.rejects(
    withEnvironment(
      {
        BLUEPRINT_TEST_FAIL_PLAN_RUN_RECORD_WRITE_ONCE: loadedBefore.path
      },
      () =>
        withGlobalHome(globalHome, () =>
          blueprintPlanRunPatchRecord({
            cwd: repoPath,
            phase: "3",
            planId: "1"
          })
        )
    ),
    /Injected PlanRun record write failure/
  );

  const listedAfterFailure = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath
    })
  );
  const loadedAfterFailure = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });

  assert.deepEqual(listedAfterFailure.patches, []);
  await assert.rejects(readFile(path.join(patchRegistryPath, `${patchId}.patch`)));
  await assert.rejects(readFile(path.join(patchRegistryPath, `${patchId}.json`)));
  await assert.rejects(readFile(path.join(patchRegistryPath, `${patchId}.audit.ndjson`)));
  assert.equal(loadedAfterFailure.run?.git.patchId, null);
  assert.equal(loadedAfterFailure.history.at(-1)?.status, "PREPARED");

  const recorded = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPatchRecord({
      cwd: repoPath,
      phase: "3",
      planId: "1"
    })
  );
  const listedAfterRetry = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath,
      patchIds: [patchId]
    })
  );

  assert.equal(recorded.status, "recorded");
  assert.equal(recorded.patchId, patchId);
  assert.equal(listedAfterRetry.patches.length, 1);
  assert.equal(listedAfterRetry.patches[0]?.patchId, patchId);
});

test("plan-run patch record does not roll back a successful same-run retry during compensation", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const { worktreePath } = await prepareRun(repoPath, globalHome);
  const loadedBefore = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });
  const patchId = "plan-run-3-01-run-01";
  const patchRegistryPath = path.join(globalHome, "patches");
  const rollbackMarkerPath = path.join(globalHome, "rollback-pending.marker");
  const rollbackReleasePath = path.join(globalHome, "rollback-release.marker");

  assert.ok(loadedBefore.path);
  await writeFile(path.join(worktreePath, "src/app.ts"), "export const value = 'changed';\n", "utf8");

  const firstAttempt = withEnvironment(
    {
      BLUEPRINT_TEST_FAIL_PLAN_RUN_RECORD_WRITE_ONCE: loadedBefore.path,
      BLUEPRINT_TEST_PLAN_RUN_PATCH_ROLLBACK_MARKER: rollbackMarkerPath,
      BLUEPRINT_TEST_PLAN_RUN_PATCH_ROLLBACK_RELEASE: rollbackReleasePath
    },
    () =>
      withGlobalHome(globalHome, () =>
        blueprintPlanRunPatchRecord({
          cwd: repoPath,
          phase: "3",
          planId: "1"
        })
      )
  );

  await waitForPath(rollbackMarkerPath);

  const retry = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPatchRecord({
      cwd: repoPath,
      phase: "3",
      planId: "1"
    })
  );

  await writeFile(rollbackReleasePath, "release\n", "utf8");
  await assert.rejects(firstAttempt, /patch registry rollback also failed/);

  const listedAfterRace = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath,
      patchIds: [patchId]
    })
  );
  const loadedAfterRace = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });

  assert.equal(retry.status, "recorded");
  assert.equal(retry.patchId, patchId);
  assert.equal(listedAfterRace.patches.length, 1);
  assert.equal(listedAfterRace.patches[0]?.patchId, patchId);
  assert.match(await readFile(path.join(patchRegistryPath, `${patchId}.patch`), "utf8"), /changed/);
  assert.equal(loadedAfterRace.run?.git.patchId, patchId);
  assert.equal(loadedAfterRace.history.at(-1)?.status, "IMPLEMENTED");
});

test("plan-run patch record blocks unauthorized changes without writing patch registry entries", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const { worktreePath } = await prepareRun(repoPath, globalHome);

  await writeFile(path.join(worktreePath, "src/extra.ts"), "export const extra = true;\n", "utf8");

  const recorded = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPatchRecord({
      cwd: repoPath,
      phase: "3",
      planId: "1"
    })
  );

  assert.equal(recorded.status, "blocked");
  assert.equal(recorded.patchId, "plan-run-3-01-run-01");
  assert.deepEqual(recorded.unauthorizedChangedFiles, ["src/extra.ts"]);
  assert.match(recorded.blockers.join("\n"), /outside the plan authorization/);
  assert.equal(recorded.patchPath, null);

  const listed = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath
    })
  );

  assert.deepEqual(listed.patches, []);

  const loaded = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });

  assert.equal(loaded.run?.git.patchId, null);
  assert.deepEqual(loaded.run?.authorization.unauthorizedChangedFiles, ["src/extra.ts"]);
  assert.equal(loaded.history.at(-1)?.status, "BLOCKED");
});

test("plan-run patch record blocks manual same-tree runs without writing patch registry entries", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const baseHead = await runGit(["rev-parse", "HEAD"], repoPath);

  await blueprintPlanRunRecord({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01",
    status: "PREPARED",
    baseHead,
    changedFiles: []
  });
  await writeFile(path.join(repoPath, "src/app.ts"), "export const value = 'same-tree';\n", "utf8");

  const recorded = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPatchRecord({
      cwd: repoPath,
      phase: "3",
      planId: "1"
    })
  );

  assert.equal(recorded.status, "blocked");
  assert.match(recorded.blockers.join("\n"), /requires a PREPARED worktree-backed run/);
  assert.equal(recorded.patchPath, null);

  const listed = await withGlobalHome(globalHome, () =>
    blueprintPatchList({
      cwd: repoPath
    })
  );

  assert.deepEqual(listed.patches, []);
});

test("plan-run patch record blocks forged worktree paths outside the prepared workspace", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const { worktreePath } = await prepareRun(repoPath, globalHome);
  const loaded = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });
  const foreignClonePath = path.join(path.dirname(repoPath), "foreign-clone");

  await runGit(["clone", repoPath, foreignClonePath]);
  await writeFile(path.join(foreignClonePath, "src/app.ts"), "export const value = 'foreign';\n", "utf8");

  assert.ok(loaded.path);
  const runRecord = JSON.parse(await readFile(loaded.path, "utf8")) as {
    worktree: {
      path: string | null;
      branchName: string | null;
      strategy: string;
    };
  };
  const index = JSON.parse(await readFile(loaded.indexPath, "utf8")) as {
    runs: Array<{
      runId: string;
      worktreePath: string | null;
      branchName: string | null;
    }>;
  };
  const indexRun = index.runs.find((run) => run.runId === "run-01");

  assert.ok(indexRun);

  runRecord.worktree.path = foreignClonePath;
  runRecord.worktree.branchName = null;
  runRecord.worktree.strategy = "worktree";
  indexRun.worktreePath = foreignClonePath;
  indexRun.branchName = null;
  await writeFile(loaded.path, JSON.stringify(runRecord, null, 2), "utf8");
  await writeFile(loaded.indexPath, JSON.stringify(index, null, 2), "utf8");

  const recorded = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPatchRecord({
      cwd: repoPath,
      phase: "3",
      planId: "1"
    })
  );

  assert.equal(recorded.status, "blocked");
  assert.equal(recorded.diffRoot, foreignClonePath);
  assert.match(recorded.blockers.join("\n"), /does not belong to the source repo|not registered/);
  assert.equal(recorded.patchPath, null);
  assert.equal(
    (
      await withGlobalHome(globalHome, () =>
        blueprintPatchList({
          cwd: repoPath
        })
      )
    ).patches.length,
    0
  );
  assert.notEqual(foreignClonePath, worktreePath);
});

test("plan-run record rejects retargeting a prepared run to another registered worktree", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const { worktreePath } = await prepareRun(repoPath, globalHome);
  const loaded = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });

  assert.ok(loaded.run);

  const secondWorkspace = await withGlobalHome(globalHome, () =>
    blueprintWorkspaceCreate({
      cwd: repoPath,
      name: "second-plan-run-workspace",
      path: path.join(workspaceRoot, "second-plan-run-workspace"),
      strategy: "worktree",
      branch: "blu/second-plan-run",
      cleanStatusPathspecs: [
        ".",
        ":(exclude)node_modules/**",
        ":(exclude)**/node_modules/**",
        ":(exclude).blueprint/runs/**",
        ":(exclude).git/**"
      ]
    })
  );
  const secondWorktreePath = secondWorkspace.repoMembers[0]?.path;

  assert.ok(secondWorktreePath);
  assert.notEqual(secondWorktreePath, worktreePath);
  const secondWorktreeHead = await runGit(["rev-parse", "HEAD"], secondWorktreePath);

  await assert.rejects(
    () =>
      blueprintPlanRunRecord({
        cwd: repoPath,
        phase: "3",
        planId: "1",
        runId: "run-01",
        status: "PREPARED",
        worktreePath: secondWorktreePath,
        branchName: "blu/second-plan-run",
        baseHead: loaded.run?.source.baseHead ?? "",
        currentHead: secondWorktreeHead,
        changedFiles: []
      }),
    /worktree branch is immutable|worktree path is immutable/
  );
});

test("plan-run patch record preserves binary git patches", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot, [
    "src/app.ts",
    "assets/blob.bin"
  ]);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const { worktreePath } = await prepareRun(repoPath, globalHome);

  await writeFile(
    path.join(worktreePath, "assets/blob.bin"),
    Buffer.from([0, 4, 5, 6, 7, 8, 9, 10])
  );

  const recorded = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPatchRecord({
      cwd: repoPath,
      phase: "3",
      planId: "1"
    })
  );

  assert.equal(recorded.status, "recorded");
  assert.deepEqual(recorded.changedFiles, [
    {
      path: "assets/blob.bin",
      status: "modified",
      authorized: true
    }
  ]);
  assert.match(await readFile(recorded.patchPath ?? "", "utf8"), /GIT binary patch/);
});
