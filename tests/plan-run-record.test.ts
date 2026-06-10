import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  PLAN_RUN_SCHEMA_VERSION,
  blueprintPlanRunLoad,
  blueprintPlanRunRecord,
  buildPlanRunIndexPath
} from "../src/mcp/tools/plan-run.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

async function createPlanRunRepo(filesModified = ["src/app.ts"]): Promise<{
  repoPath: string;
  baseHead: string;
}> {
  const repoPath = await createCommittedGitRepo("blueprint-plan-run-record-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-phase-discovery");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    "# Requirements\n\n- LIFE-01: exercise PlanRun persistence.\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery** - Add the plan-run persistence slice

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Add PlanRun state.
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
        mode: "interactive",
        granularity: "standard",
        model_profile: "balanced",
        project_code: null,
        phase_naming: "sequential",
        response_language: null,
        defaults: {}
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

  return {
    repoPath,
    baseHead: await runGit(["rev-parse", "HEAD"], repoPath)
  };
}

function validPlanContent(filesModified: string[]): string {
  return `---
phase: 3
plan_id: "01"
title: "Plan 01"
wave: 1
status: planned
objective: "Persist PlanRun execution state."
depends_on: []
requirements:
  - LIFE-01
files_modified:
${filesModified.map((filePath) => `  - ${filePath}`).join("\n")}
read_first:
  - src/mcp/tools/plan-run.ts
acceptance_criteria:
  - tests/plan-run-record.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Persist PlanRun execution state.

## Scope

- Add PlanRun record and load persistence.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | tests/plan-run-record.test.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-01-PLAN.md | used | Provides the authorized file surface. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
${filesModified.map((filePath) => `| ${filePath} | Task 1 | tests/plan-run-record.test.ts exits 0 |`).join("\n")}

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Diff computation | deferred | Later PlanRun wave |

## Tasks

### Task 1: Persist PlanRun state

#### Read First

- src/mcp/tools/plan-run.ts

#### Action

- Add PlanRun record and load tools.

#### Acceptance Criteria

- tests/plan-run-record.test.ts exits 0

## External Service Prerequisites

| Service | Category | Purpose | User Setup / Startup | Readiness Check | Can Agent Proceed Without It |
|---------|----------|---------|----------------------|-----------------|------------------------------|
| none | none | No external services are required. | No user setup required. | Repo-local execution only. | yes |

## Verification

- npm test passes for PlanRun persistence coverage

## Must Haves

- PlanRun records persist under .blueprint/runs.
`;
}

test("plan-run tools register record and load MCP entries", () => {
  assert.ok(blueprintToolNames.includes("blueprint_plan_run_record"));
  assert.ok(blueprintToolNames.includes("blueprint_plan_run_load"));
});

test("plan-run record creates RUNS index and reloadable run records", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const recorded = await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    changedFiles: ["src/app.ts"],
    commandsRun: [
      {
        command: "npm test -- tests/plan-run-record.test.ts",
        exitCode: 0,
        stdoutTail: "ok"
      }
    ],
    verification: [
      {
        command: "npm test -- tests/plan-run-record.test.ts",
        result: "pass",
        evidence: "Focused PlanRun persistence test passed."
      }
    ],
    summaryPath: ".blueprint/reports/plan-run-summary.md"
  });

  assert.equal(recorded.status, "recorded");
  assert.equal(recorded.created, true);
  assert.equal(recorded.updated, false);
  assert.equal(recorded.run.schemaVersion, PLAN_RUN_SCHEMA_VERSION);
  assert.equal(recorded.run.runId, "run-01");
  assert.equal(recorded.run.phase, "3");
  assert.equal(recorded.run.planId, "01");
  assert.equal(recorded.run.planPath, ".blueprint/phases/03-phase-discovery/03-01-PLAN.md");
  assert.deepEqual(recorded.run.authorization.authorizedFiles, ["src/app.ts"]);
  assert.deepEqual(recorded.run.authorization.unauthorizedChangedFiles, []);
  assert.equal(recorded.run.attempts.length, 1);
  assert.equal(recorded.run.attempts[0]?.status, "PREPARED");
  assert.equal(recorded.run.verification[0]?.result, "pass");

  const index = JSON.parse(await readFile(recorded.indexPath, "utf8")) as {
    latestRunId: string;
    runs: Array<{ runId: string }>;
  };
  assert.equal(index.latestRunId, "run-01");
  assert.deepEqual(index.runs.map((entry) => entry.runId), ["run-01"]);

  const loaded = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "03",
    planId: "01"
  });

  assert.equal(loaded.found, true);
  assert.equal(loaded.run?.runId, "run-01");
  assert.equal(loaded.history.length, 1);
});

test("plan-run record appends attempts and keeps history across runs", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    changedFiles: ["src/app.ts"]
  });
  await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "IMPLEMENTED",
    baseHead,
    currentHead: baseHead,
    changedFiles: ["src/app.ts"],
    commandsRun: [{ command: "npm run typecheck", exitCode: 0 }]
  });
  await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-02",
    phase: "3",
    planId: "1",
    status: "PARTIAL",
    baseHead,
    changedFiles: ["src/app.ts", "src/extra.ts"]
  });

  const first = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01"
  });
  const latest = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1"
  });

  assert.equal(first.run?.attempts.length, 2);
  assert.equal(first.run?.attempts[1]?.status, "IMPLEMENTED");
  assert.equal(latest.run?.runId, "run-02");
  assert.deepEqual(
    latest.history.map((entry) => entry.runId),
    ["run-01", "run-02"]
  );
  assert.deepEqual(latest.run?.authorization.unauthorizedChangedFiles, ["src/extra.ts"]);
});

test("plan-run record resolves relative worktree paths from the target repo root", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  const originalCwd = process.cwd();
  t.after(async () => {
    process.chdir(originalCwd);
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  process.chdir(path.dirname(repoPath));

  const recorded = await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    worktreePath: "worktrees/run-01",
    changedFiles: ["src/app.ts"]
  });

  assert.equal(
    recorded.run.worktree.path,
    path.join(repoPath, "worktrees/run-01")
  );
});

test("plan-run load resolves persisted relative worktree paths from the target repo root", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  const originalCwd = process.cwd();
  t.after(async () => {
    process.chdir(originalCwd);
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const recorded = await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    worktreePath: path.join(repoPath, "worktrees/run-01"),
    changedFiles: ["src/app.ts"]
  });
  const runRecord = JSON.parse(await readFile(recorded.path, "utf8")) as {
    worktree: { path: string };
  };
  const index = JSON.parse(await readFile(recorded.indexPath, "utf8")) as {
    runs: Array<{ worktreePath: string | null }>;
  };
  const firstRun = index.runs[0];

  assert.ok(firstRun);

  runRecord.worktree.path = "worktrees/run-01";
  firstRun.worktreePath = "worktrees/run-01";
  await writeFile(recorded.path, JSON.stringify(runRecord, null, 2), "utf8");
  await writeFile(recorded.indexPath, JSON.stringify(index, null, 2), "utf8");
  process.chdir(path.dirname(repoPath));

  const loaded = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1"
  });

  assert.equal(loaded.run?.worktree.path, path.join(repoPath, "worktrees/run-01"));
  assert.equal(
    loaded.history[0]?.worktreePath,
    path.join(repoPath, "worktrees/run-01")
  );
});

test("plan-run record refuses malformed existing RUNS indexes", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const indexPath = buildPlanRunIndexPath(repoPath, "3", "1");
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: 2,
        phase: "3",
        planId: "01",
        latestRunId: null,
        runs: []
      },
      null,
      2
    ),
    "utf8"
  );

  await assert.rejects(
    () =>
      blueprintPlanRunRecord({
        cwd: repoPath,
        runId: "run-01",
        phase: "3",
        planId: "1",
        status: "PREPARED",
        baseHead,
        changedFiles: ["src/app.ts"]
      }),
    /schemaVersion.*must equal 1/
  );
});

test("plan-run load rejects RUNS indexes with phantom latest run ids", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const recorded = await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    changedFiles: ["src/app.ts"]
  });
  const index = JSON.parse(await readFile(recorded.indexPath, "utf8")) as {
    latestRunId: string;
  };

  index.latestRunId = "run-99";
  await writeFile(recorded.indexPath, JSON.stringify(index, null, 2), "utf8");

  await assert.rejects(
    () =>
      blueprintPlanRunLoad({
        cwd: repoPath,
        phase: "3",
        planId: "1"
      }),
    /latestRunId.*runs/
  );
});

test("plan-run load rejects stale RUNS indexes with older latest run ids", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    changedFiles: ["src/app.ts"]
  });
  const recorded = await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-02",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    changedFiles: ["src/app.ts"]
  });
  const index = JSON.parse(await readFile(recorded.indexPath, "utf8")) as {
    latestRunId: string;
    runs: Array<{ runId: string; createdAt: string; updatedAt: string }>;
  };
  const firstRun = index.runs.find((run) => run.runId === "run-01");
  const secondRun = index.runs.find((run) => run.runId === "run-02");

  assert.ok(firstRun);
  assert.ok(secondRun);

  firstRun.updatedAt = "2026-04-11T00:00:00.000Z";
  secondRun.updatedAt = "2026-04-11T00:00:01.000Z";
  index.latestRunId = "run-01";
  await writeFile(recorded.indexPath, JSON.stringify(index, null, 2), "utf8");

  await assert.rejects(
    () =>
      blueprintPlanRunLoad({
        cwd: repoPath,
        phase: "3",
        planId: "1"
      }),
    /latestRunId.*newest run entry/
  );
});

test("plan-run load rejects RUNS indexes with unsafe summary paths", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const recorded = await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    changedFiles: ["src/app.ts"],
    summaryPath: ".blueprint/reports/plan-run-summary.md"
  });
  const index = JSON.parse(await readFile(recorded.indexPath, "utf8")) as {
    runs: Array<{ summaryPath: string | null }>;
  };
  const firstRun = index.runs[0];

  assert.ok(firstRun);

  index.runs[0] = {
    ...firstRun,
    summaryPath: "/tmp/escape.md"
  };
  await writeFile(recorded.indexPath, JSON.stringify(index, null, 2), "utf8");

  await assert.rejects(
    () =>
      blueprintPlanRunLoad({
        cwd: repoPath,
        phase: "3",
        planId: "1"
      }),
    /repo-relative/
  );
});

test("plan-run load and update reject malformed existing run records", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const recorded = await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    changedFiles: ["src/app.ts"]
  });
  const persisted = JSON.parse(await readFile(recorded.path, "utf8")) as {
    git: { changedFiles: string[] };
  };

  persisted.git.changedFiles = ["/tmp/escape.ts"];
  await writeFile(recorded.path, JSON.stringify(persisted, null, 2), "utf8");

  await assert.rejects(
    () =>
      blueprintPlanRunLoad({
        cwd: repoPath,
        phase: "3",
        planId: "1",
        runId: "run-01"
      }),
    /repo-relative/
  );
  await assert.rejects(
    () =>
      blueprintPlanRunRecord({
        cwd: repoPath,
        runId: "run-01",
        phase: "3",
        planId: "1",
        status: "IMPLEMENTED",
        baseHead,
        changedFiles: ["src/app.ts"]
      }),
    /repo-relative/
  );
});

test("plan-run load rejects run records with mismatched source repo roots", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const recorded = await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    changedFiles: ["src/app.ts"]
  });
  const persisted = JSON.parse(await readFile(recorded.path, "utf8")) as {
    source: { repoRoot: string };
  };

  persisted.source.repoRoot = path.dirname(repoPath);
  await writeFile(recorded.path, JSON.stringify(persisted, null, 2), "utf8");

  await assert.rejects(
    () =>
      blueprintPlanRunLoad({
        cwd: repoPath,
        phase: "3",
        planId: "1",
        runId: "run-01"
      }),
    /source\.repoRoot.*target repo root/
  );
});

test("plan-run record rejects escaping run ids and changed file paths", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    () =>
      blueprintPlanRunRecord({
        cwd: repoPath,
        runId: "../escape",
        phase: "3",
        planId: "1",
        status: "PREPARED",
        baseHead,
        changedFiles: ["src/app.ts"]
      }),
    /Plan run id/
  );

  await assert.rejects(
    () =>
      blueprintPlanRunRecord({
        cwd: repoPath,
        runId: "run-01",
        phase: "3",
        planId: "1",
        status: "PREPARED",
        baseHead,
        changedFiles: ["/tmp/escape.ts"]
      }),
    /repo-relative/
  );
});

test("plan-run record serializes concurrent writers without losing runs", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await Promise.all(
    [1, 2, 3, 4, 5].map((number) =>
      blueprintPlanRunRecord({
        cwd: repoPath,
        runId: `run-0${number}`,
        phase: "3",
        planId: "1",
        status: "PREPARED",
        baseHead,
        changedFiles: ["src/app.ts"]
      })
    )
  );

  const loaded = await blueprintPlanRunLoad({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-05"
  });

  assert.equal(loaded.found, true);
  assert.equal(loaded.history.length, 5);
  assert.deepEqual(
    loaded.history.map((entry) => entry.runId).sort(),
    ["run-01", "run-02", "run-03", "run-04", "run-05"]
  );
});
