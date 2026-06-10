import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintPlanRunDiff,
  blueprintPlanRunRecord
} from "../src/mcp/tools/plan-run.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

async function createPlanRunRepo(filesModified = ["src/app.ts"]): Promise<{
  repoPath: string;
  baseHead: string;
}> {
  const repoPath = await createCommittedGitRepo("blueprint-plan-run-git-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-phase-discovery");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, "src/app.ts"), "export const value = 'base';\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/REQUIREMENTS.md"),
    "# Requirements\n\n- LIFE-01: exercise PlanRun git diffs.\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery** - Add PlanRun git diff support

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Add PlanRun git diff support.
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
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "plan-run baseline"], repoPath);

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
objective: "Capture PlanRun git evidence."
depends_on: []
requirements:
  - LIFE-01
files_modified:
${filesModified.map((filePath) => `  - ${filePath}`).join("\n")}
read_first:
  - src/mcp/tools/plan-run.ts
acceptance_criteria:
  - tests/plan-run-git.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Capture PlanRun git evidence.

## Scope

- Add a PlanRun diff tool.

## Requirement Coverage

| Requirement | Status | Covered By | Evidence |
|-------------|--------|------------|----------|
| LIFE-01 | covered | Task 1 | tests/plan-run-git.test.ts |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-01-PLAN.md | used | Provides the authorized file surface. |

## File / Surface Coverage

| File / Surface | Covered By | Verification |
|----------------|------------|--------------|
${filesModified.map((filePath) => `| ${filePath} | Task 1 | tests/plan-run-git.test.ts exits 0 |`).join("\n")}

## Unknowns And Deferrals

| Item | Disposition | Follow-up |
|------|-------------|-----------|
| Review artifacts | deferred | Later PlanRun wave |

## Tasks

### Task 1: Capture PlanRun diffs

#### Read First

- src/mcp/tools/plan-run.ts

#### Action

- Add PlanRun git diff metadata.

#### Acceptance Criteria

- tests/plan-run-git.test.ts exits 0

## External Service Prerequisites

| Service | Category | Purpose | User Setup / Startup | Readiness Check | Can Agent Proceed Without It |
|---------|----------|---------|----------------------|-----------------|------------------------------|
| none | none | No external services are required. | No user setup required. | Repo-local execution only. | yes |

## Verification

- npm test passes for PlanRun git diff coverage

## Must Haves

- PlanRun diffs are computed from git.
`;
}

async function recordRun(repoPath: string, baseHead: string): Promise<void> {
  await blueprintPlanRunRecord({
    cwd: repoPath,
    runId: "run-01",
    phase: "3",
    planId: "1",
    status: "PREPARED",
    baseHead,
    changedFiles: ["src/app.ts"]
  });
}

test("plan-run diff tool registers the MCP entry", () => {
  assert.ok(blueprintToolNames.includes("blueprint_plan_run_diff"));
});

test("plan-run diff detects modified files and returns diff stat", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await recordRun(repoPath, baseHead);
  await writeFile(path.join(repoPath, "src/app.ts"), "export const value = 'changed';\n", "utf8");

  const result = await blueprintPlanRunDiff({
    cwd: repoPath,
    phase: "3",
    planId: "1"
  });

  assert.equal(result.status, "ready");
  assert.equal(result.runId, "run-01");
  assert.equal(result.baseHead, baseHead);
  assert.equal(result.currentHead, baseHead);
  assert.deepEqual(result.changedFiles, [
    {
      path: "src/app.ts",
      status: "modified",
      authorized: true
    }
  ]);
  assert.deepEqual(result.unauthorizedChangedFiles, []);
  assert.match(result.diffStat, /src\/app\.ts/);
  assert.equal(result.patch, null);
  assert.equal(result.truncated, false);
});

test("plan-run diff detects added untracked files", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo(["src/app.ts", "src/new.ts"]);
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await recordRun(repoPath, baseHead);
  await writeFile(path.join(repoPath, "src/new.ts"), "export const value = 'new';\n", "utf8");

  const result = await blueprintPlanRunDiff({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    runId: "run-01",
    includePatch: true
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(result.changedFiles, [
    {
      path: "src/new.ts",
      status: "added",
      authorized: true
    }
  ]);
  assert.match(result.diffStat, /src\/new\.ts/);
  assert.match(result.patch ?? "", /diff --git a\/src\/new\.ts b\/src\/new\.ts/);
  assert.match(result.patch ?? "", /\+export const value = 'new';/);
});

test("plan-run diff detects deleted files", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await recordRun(repoPath, baseHead);
  await rm(path.join(repoPath, "src/app.ts"));

  const result = await blueprintPlanRunDiff({
    cwd: repoPath,
    phase: "3",
    planId: "1"
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(result.changedFiles, [
    {
      path: "src/app.ts",
      status: "deleted",
      authorized: true
    }
  ]);
});

test("plan-run diff reports unauthorized changed files", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await recordRun(repoPath, baseHead);
  await writeFile(path.join(repoPath, "src/extra.ts"), "export const extra = true;\n", "utf8");

  const result = await blueprintPlanRunDiff({
    cwd: repoPath,
    phase: "3",
    planId: "1"
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(result.changedFiles, [
    {
      path: "src/extra.ts",
      status: "added",
      authorized: false
    }
  ]);
  assert.deepEqual(result.unauthorizedChangedFiles, ["src/extra.ts"]);
});

test("plan-run diff truncates large patches on request", async (t) => {
  const { repoPath, baseHead } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await recordRun(repoPath, baseHead);
  await writeFile(
    path.join(repoPath, "src/app.ts"),
    `export const value = '${"x".repeat(500)}';\n`,
    "utf8"
  );

  const result = await blueprintPlanRunDiff({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    includePatch: true,
    maxPatchBytes: 80
  });

  assert.equal(result.status, "ready");
  assert.equal(result.truncated, true);
  assert.ok(result.patch);
  assert.ok(Buffer.byteLength(result.patch, "utf8") <= 80);
});

test("plan-run diff blocks when the recorded base head is unknown", async (t) => {
  const { repoPath } = await createPlanRunRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const missingBaseHead = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  await recordRun(repoPath, missingBaseHead);

  const result = await blueprintPlanRunDiff({
    cwd: repoPath,
    phase: "3",
    planId: "1"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.baseHead, missingBaseHead);
  assert.match(result.warnings.join("\n"), /single revision|unknown|deadbeef/i);
});

test("plan-run diff blocks when cwd is not a git repo", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-plan-run-nongit-"));
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  const result = await blueprintPlanRunDiff({
    cwd: tempRoot,
    phase: "3",
    planId: "1"
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.runId, null);
  assert.equal(result.baseHead, null);
  assert.match(result.warnings.join("\n"), /git repository root|no \.git/i);
});
