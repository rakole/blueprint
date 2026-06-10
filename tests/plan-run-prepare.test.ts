import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintPlanRunLoad,
  blueprintPlanRunPrepare
} from "../src/mcp/tools/plan-run.js";
import {
  blueprintWorkspaceCreate,
  blueprintWorkspaceRegistryGet
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
    path.join(os.tmpdir(), "blueprint-plan-run-prepare-test-")
  );

  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  return {
    workspaceRoot: path.join(tempRoot, "workspaces"),
    globalHome: path.join(tempRoot, "global-home")
  };
}

async function createPlanRunRepo(workspaceRoot: string): Promise<{
  repoPath: string;
}> {
  const repoPath = await createCommittedGitRepo("blueprint-plan-run-prepare-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-phase-discovery");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, "src/app.ts"), "export const value = 'base';\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    "# Requirements\n\n- LIFE-01: exercise PlanRun prepare.\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery** - Add PlanRun prepare support

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Add PlanRun prepare support.
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
    validPlanContent(),
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "plan-run prepare baseline"], repoPath);

  return {
    repoPath
  };
}

function validPlanContent(): string {
  return `---
phase: 3
plan_id: "01"
title: "Plan 01"
wave: 1
status: planned
objective: "Prepare a PlanRun workspace."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - src/app.ts
read_first:
  - src/mcp/tools/plan-run.ts
acceptance_criteria:
  - npm test -- tests/plan-run-prepare.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Prepare a PlanRun workspace.

## Scope

- Add a PlanRun prepare tool.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | tests/plan-run-prepare.test.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-01-PLAN.md | used | Provides the authorized file surface. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
| src/app.ts | Task 1 | npm test -- tests/plan-run-prepare.test.ts exits 0 |

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Implementation execution | deferred | Later PlanRun wave |

## Tasks

### Task 1: Prepare workspace

#### Read First

- src/mcp/tools/plan-run.ts

#### Action

- Add PlanRun prepare metadata.

#### Acceptance Criteria

- npm test -- tests/plan-run-prepare.test.ts exits 0

## External Service Prerequisites

| Service | Category | Purpose | User Setup / Startup | Readiness Check | Can Agent Proceed Without It |
|---------|----------|---------|----------------------|-----------------|------------------------------|
| none | none | No external services are required. | No user setup required. | Repo-local execution only. | yes |

## Verification

- npm test passes for PlanRun prepare coverage

## Must Haves

- PlanRun prepare uses workspace creation rather than duplicating worktree setup.
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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

test("plan-run prepare tool registers the MCP entry", () => {
  assert.ok(blueprintToolNames.includes("blueprint_plan_run_prepare"));
});

test("plan-run prepare preview does not create a worktree or run record", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-01",
      mode: "preview"
    })
  );

  assert.equal(result.status, "preview");
  assert.equal(result.workspacePath, path.join(workspaceRoot, "phase-3-plan-01-plan-01"));
  assert.equal(result.worktreePath, null);
  assert.equal(await pathExists(result.workspacePath), false);
  assert.equal(await pathExists(result.recordPath ?? ""), false);
  assert.deepEqual(result.authorizedFiles, ["src/app.ts"]);
  assert.deepEqual(result.verificationCommands, ["npm test -- tests/plan-run-prepare.test.ts"]);
});

test("plan-run prepare creates a worktree and writes a PREPARED run record", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-01",
      mode: "prepare"
    })
  );

  assert.equal(result.status, "prepared");
  assert.equal(result.branchName, "blu/phase-3-plan-01-plan-01");
  assert.equal(result.workspacePath, path.join(workspaceRoot, "phase-3-plan-01-plan-01"));
  assert.equal(result.worktreePath, path.join(result.workspacePath, "repo"));
  assert.equal(await runGit(["branch", "--show-current"], result.worktreePath ?? ""), result.branchName);
  assert.equal(
    await realpath(await runGit(["rev-parse", "--show-toplevel"], result.worktreePath ?? "")),
    await realpath(result.worktreePath ?? "")
  );

  const loaded = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });

  assert.equal(loaded.found, true);
  assert.equal(loaded.run?.attempts.at(-1)?.status, "PREPARED");
  assert.equal(loaded.run?.worktree.path, result.worktreePath);
  assert.equal(loaded.run?.worktree.branchName, result.branchName);
});

test("plan-run prepare allows later prepares after PlanRun bookkeeping exists", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const first = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-01",
      mode: "prepare",
      workspaceName: "first-run",
      workspacePath: path.join(workspaceRoot, "first-run"),
      branchName: "blu/phase-3-plan-01-first"
    })
  );
  const second = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-02",
      mode: "prepare",
      workspaceName: "second-run",
      workspacePath: path.join(workspaceRoot, "second-run"),
      branchName: "blu/phase-3-plan-01-second"
    })
  );

  assert.equal(first.status, "prepared");
  assert.equal(second.status, "prepared");
  assert.equal(second.worktreePath, path.join(workspaceRoot, "second-run/repo"));
});

test("plan-run prepare cleans up workspace and branch when record persistence fails", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  const workspacePath = path.join(workspaceRoot, "record-failure");
  const branchName = "blu/phase-3-plan-01-record-failure";
  const indexPath = path.join(repoPath, ".blueprint/runs/phase-3/plan-01/RUNS.json");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, "{not-json", "utf8");

  const result = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-01",
      mode: "prepare",
      workspaceName: "record-failure",
      workspacePath,
      branchName
    })
  );

  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /not valid JSON|RUNS\.json/i);
  assert.equal(await pathExists(workspacePath), false);
  assert.equal(await runGit(["branch", "--list", branchName], repoPath), "");

  const registry = await withGlobalHome(globalHome, () =>
    blueprintWorkspaceRegistryGet()
  );
  assert.equal(
    registry.workspaces.some((workspace) => workspace.name === "record-failure"),
    false
  );
});

test("plan-run prepare cleanup preserves a branch that already existed", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  const workspacePath = path.join(workspaceRoot, "existing-branch-failure");
  const branchName = "blu/phase-3-plan-01-existing";
  const indexPath = path.join(repoPath, ".blueprint/runs/phase-3/plan-01/RUNS.json");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await runGit(["branch", branchName], repoPath);
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, "{not-json", "utf8");

  const result = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-01",
      mode: "prepare",
      workspaceName: "existing-branch-failure",
      workspacePath,
      branchName
    })
  );

  assert.equal(result.status, "blocked");
  assert.equal(await pathExists(workspacePath), false);
  assert.equal(await runGit(["branch", "--list", branchName], repoPath), branchName);
});

test("plan-run prepare blocks dirty source before workspace creation", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  const workspacePath = path.join(workspaceRoot, "dirty-run");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeFile(path.join(repoPath, "dirty.txt"), "dirty\n", "utf8");

  const result = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-01",
      mode: "prepare",
      workspaceName: "dirty-run",
      workspacePath
    })
  );

  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /uncommitted changes/);
  assert.equal(await pathExists(workspacePath), false);
});

test("plan-run prepare returns a valid default branch ref", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-01"
    })
  );

  assert.equal(result.status, "preview");
  assert.ok(result.branchName);
  assert.equal(await runGit(["check-ref-format", "--branch", result.branchName ?? ""], repoPath), result.branchName);
});

test("plan-run prepare reports duplicate workspace or branch failures clearly", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  const workspacePath = path.join(workspaceRoot, "duplicate-run");
  const branchName = "blu/phase-3-plan-01-duplicate";
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await withGlobalHome(globalHome, () =>
    blueprintWorkspaceCreate({
      cwd: repoPath,
      name: "duplicate-run",
      path: workspacePath,
      branch: branchName
    })
  );

  const result = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "1",
      runId: "run-01",
      mode: "prepare",
      workspaceName: "duplicate-run",
      workspacePath,
      branchName
    })
  );

  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /already contains|already used|already exists/i);
});

test("plan-run prepare blocks missing plans and phases", async (t) => {
  const { workspaceRoot, globalHome } = await createPlanRunTestRoot(t);
  const { repoPath } = await createPlanRunRepo(workspaceRoot);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const missingPlan = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "3",
      planId: "2",
      runId: "run-01",
      mode: "prepare"
    })
  );
  const missingPhase = await withGlobalHome(globalHome, () =>
    blueprintPlanRunPrepare({
      cwd: repoPath,
      phase: "4",
      planId: "1",
      runId: "run-01",
      mode: "prepare"
    })
  );

  assert.equal(missingPlan.status, "blocked");
  assert.match(missingPlan.blockers.join("\n"), /Plan 02|not found|does not exist/i);
  assert.equal(missingPhase.status, "blocked");
  assert.match(missingPhase.blockers.join("\n"), /Phase 4|not found|could not be resolved/i);
});
