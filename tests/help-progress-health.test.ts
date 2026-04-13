import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintArtifactList,
  blueprintArtifactValidate
} from "../src/mcp/tools/artifacts.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  blueprintStateLoad,
  blueprintStateSync
} from "../src/mcp/tools/state.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "tests/fixtures/help-progress-health");

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyFixtureContents(sourcePath: string, targetPath: string): Promise<void> {
  const entries = await readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntry = path.join(sourcePath, entry.name);
    const targetEntry = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await mkdir(targetEntry, { recursive: true });
      await copyFixtureContents(sourceEntry, targetEntry);
      continue;
    }

    const sourceStats = await stat(sourceEntry);
    await mkdir(path.dirname(targetEntry), { recursive: true });
    await copyFile(sourceEntry, targetEntry);
    await import("node:fs/promises").then(({ chmod }) =>
      chmod(targetEntry, sourceStats.mode)
    );
  }
}

async function createRepoFromFixture(fixtureName: string): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-help-progress-health-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");

  const sourcePath = path.join(fixtureRoot, fixtureName);

  if (await pathExists(sourcePath)) {
    await copyFixtureContents(sourcePath, repoPath);
  }

  return repoPath;
}

async function createExecutionReadyRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-execute-phase-routing-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Execution Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 2: Discovery**
- [ ] **Phase 3: Phase Discovery** - Execute the prepared plans
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
    JSON.stringify({ version: 2 }, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    `# Phase 03: Phase Discovery - Context

## Decisions
- Execution should activate once plans exist and summaries are absent.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    `# Phase 03: Phase Discovery - Research

**Researched:** 2026-04-11
**Domain:** execute-phase runtime
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXEC-01 | Execute plans with durable summary persistence. | Use plan and summary indexes to select pending work. |

## Summary

- Plans are ready for execution and no summary artifacts exist yet.

## User Constraints

- Keep writes inside .blueprint/.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Architecture Patterns

- Commands stay thin; MCP tools own persistence.

## Don't Hand-Roll

- Reuse the existing plan and summary index flow.

## Common Pitfalls

- Treating a missing summary as completed execution.

## Code Examples

\`\`\`ts
await blueprintPhaseContext({ cwd: repoPath, phase: "3" });
\`\`\`

## Recommendations

- Route to /blu-execute-phase once the phase has plans and no summaries.

## Sources

- \`src/mcp/tools/phase.ts\`
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"),
    `# Phase 03: Phase Discovery - UI Spec

## Outcome Mode

- Explicit skip rationale
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-PLAN.md"),
    `---
phase: 3
plan_id: "01"
title: "Execution Plan 01"
wave: 1
status: planned
objective: "Exercise the execute-phase router."
depends_on: []
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Exercise the execute-phase router.
`,
    "utf8"
  );

  return repoPath;
}

async function createMilestoneCloseoutRepo(reportStage: "none" | "audit" | "complete" | "summary"): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-milestone-closeout-routing-"));
  const repoPath = path.join(tempRoot, "repo");
  const reportsDir = path.join(repoPath, ".blueprint/reports");
  const phaseRoot = path.join(repoPath, ".blueprint/phases/03-milestone-closeout");

  await mkdir(phaseRoot, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Milestone Closeout Fixture

## Milestone

- Active milestone: v2

## Phases

- [x] **Phase 2: Validation Hardening**
- [x] **Phase 3: Milestone Closeout**

## Phase Details

### Phase 2: Validation Hardening
**Goal**: Finish the earlier validation slice.
**Requirements**: CLOSE-01

### Phase 3: Milestone Closeout
**Goal**: Finalize milestone evidence and archival routing.
**Requirements**: CLOSE-02
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 3
- Active command: /blu-progress
- Next action: Run /blu-progress
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
  await writeFile(
    path.join(phaseRoot, "03-CONTEXT.md"),
    `# Phase 03: Milestone Closeout - Context

## Decisions
- All milestone phases are complete, so routing should move through audit, completion, summary, and new milestone steps in order.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseRoot, "03-RESEARCH.md"),
    `# Phase 03: Milestone Closeout - Research

**Researched:** 2026-04-12
**Domain:** milestone closeout routing
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLOSE-02 | Route completed milestone work through audit, completion, summary, and carry-forward reset. | Use report presence plus all-phases-complete state to derive the next safe closeout action. |

## Summary

- The final completed phase should route to the milestone audit first, then completion, then summary, then the next milestone start.

## User Constraints

- Keep writes inside .blueprint/.
- Do not expose blocked commands while deriving the next action.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Architecture Patterns

- Use durable milestone reports as routing checkpoints.
- Keep routing dependent on implemented commands only.

## Don't Hand-Roll

- Reuse the existing roadmap, artifact, and state MCP substrates.

## Common Pitfalls

- Skipping the audit report gate and jumping straight to archival.
- Treating invalid research as good enough to continue closeout routing.

## Code Examples

\`\`\`ts
await blueprintStateLoad({ cwd: repoPath });
\`\`\`

## Recommendations

- Route to \`/blu-audit-milestone v2\` when all milestone phases are complete and no milestone audit report exists.
- Advance sequentially through completion, summary, and \`new-milestone\` once each report appears.

## Sources

- src/mcp/tools/state.ts
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseRoot, "03-UI-SPEC.md"),
    `# Phase 03: Milestone Closeout - UI Spec

## Outcome Mode

- Explicit skip rationale
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseRoot, "03-01-PLAN.md"),
    `---
phase: 3
plan_id: "01"
title: "Milestone Closeout"
wave: 1
status: done
objective: "Close the milestone."
depends_on: []
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 03: Milestone Closeout - Plan 01

## Goal

Close the milestone.

## Scope

- Reports and routing only.

## Tasks

### Task 1

#### Read First

- .blueprint/ROADMAP.md

#### Action

- Generate milestone closeout reports.

#### Acceptance Criteria

- Routing advances to the next closeout step.

## Verification

- Confirm milestone-closeout routing.

## Must Haves

- Keep writes inside .blueprint/.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseRoot, "03-01-SUMMARY.md"),
    `# Phase 03: Milestone Closeout - Summary

## Result

- Execution completed and the milestone is ready for closeout routing.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseRoot, "03-VERIFICATION.md"),
    `# Phase 03: Milestone Closeout - Verification

## Result

- Validation evidence is complete.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseRoot, "03-UAT.md"),
    `# Phase 03: Milestone Closeout - UAT

## Result

- UAT evidence is complete.
`,
    "utf8"
  );

  if (reportStage === "audit" || reportStage === "complete" || reportStage === "summary") {
    await writeFile(
      path.join(reportsDir, "milestone-audit-v2.md"),
      `# Milestone Audit: v2

## Result

- Audit complete.
`,
      "utf8"
    );
  }

  if (reportStage === "complete" || reportStage === "summary") {
    await writeFile(
      path.join(reportsDir, "milestone-complete-v2.md"),
      `# Milestone Complete: v2

## Result

- Completion recorded.
`,
      "utf8"
    );
  }

  if (reportStage === "summary") {
    await writeFile(
      path.join(reportsDir, "milestone-summary-v2.md"),
      `# Milestone Summary: v2

## Result

- Carry-forward summary recorded.
`,
      "utf8"
    );
  }

  return repoPath;
}

test("read-path tools distinguish uninitialized Blueprint repos", async (t) => {
  const repoPath = await createRepoFromFixture("uninitialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });
  const artifacts = await blueprintArtifactList({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(status.status, "uninitialized");
  assert.equal(status.initialized, false);
  assert.match(status.nextAction, /\/blu-new-project/);
  assert.equal(state.derivedStatus.projectStatus, "uninitialized");
  assert.equal(state.derivedStatus.currentPhase, null);
  assert.match(state.derivedStatus.nextAction, /\/blu-new-project/);
  assert.deepEqual(artifacts.artifacts.core, []);
  assert.ok(artifacts.missing.includes(".blueprint/STATE.md"));
  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /Missing \.blueprint\/ directory/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu-new-project/);
});

test("read-path tools distinguish partial Blueprint repos and expose repair blockers", async (t) => {
  const repoPath = await createRepoFromFixture("partial-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });
  const artifacts = await blueprintArtifactList({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(status.status, "partial");
  assert.equal(status.initialized, false);
  assert.match(status.nextAction, /\/blu-health/);
  assert.equal(state.derivedStatus.projectStatus, "partial");
  assert.equal(state.derivedStatus.currentPhase, "2");
  assert.equal(state.derivedStatus.hasBlockers, true);
  assert.match(state.blockers.join("\n"), /Missing \.blueprint\/STATE\.md/);
  assert.ok(artifacts.missing.includes(".blueprint/REQUIREMENTS.md"));
  assert.ok(artifacts.missing.includes(".blueprint/config.json"));
  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /Missing core artifact: \.blueprint\/STATE\.md/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu-health --repair/);
});

test("state sync reconstructs STATE.md from surviving roadmap and artifact signals", async (t) => {
  const repoPath = await createRepoFromFixture("partial-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const syncResult = await blueprintStateSync({ cwd: repoPath });
  const syncedDocument = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");
  const loadedState = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(syncResult.statePath, ".blueprint/STATE.md");
  assert.ok(syncResult.syncedFields.includes("projectStatus"));
  assert.ok(syncResult.syncedFields.includes("currentPhase"));
  assert.ok(syncResult.syncedFields.includes("blockers"));
  assert.match(syncResult.warnings.join("\n"), /STATE\.md was missing/);
  assert.match(syncedDocument, /- Project status: partial/);
  assert.match(syncedDocument, /- Current phase: 2/);
  assert.match(syncedDocument, /- Active command: \/blu-health/);
  assert.match(loadedState.blockers.join("\n"), /Missing \.blueprint\/REQUIREMENTS\.md/);
});

test("initialized Blueprint repos report healthy read-path status and artifact coverage", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });
  const artifacts = await blueprintArtifactList({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(status.status, "initialized");
  assert.equal(status.initialized, true);
  assert.equal(status.currentPhase, "2");
  assert.equal(status.currentMilestone, "v2");
  assert.match(status.nextAction, /\/blu-ui-phase 2/);
  assert.equal(state.derivedStatus.projectStatus, "initialized");
  assert.equal(state.derivedStatus.currentPhase, "2");
  assert.equal(state.derivedStatus.hasBlockers, false);
  assert.match(state.derivedStatus.nextAction, /\/blu-ui-phase 2/);
  assert.ok(artifacts.artifacts.core.includes(".blueprint/STATE.md"));
  assert.equal(artifacts.artifacts.codebase.length, 7);
  assert.ok(artifacts.artifacts.codebase.includes(".blueprint/codebase/STRUCTURE.md"));
  assert.ok(artifacts.reports.includes(".blueprint/reports/health-report.md"));
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test("project status chooses the next implemented discovery command from current phase artifacts", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const phaseRoot = path.join(repoPath, ".blueprint/phases/02-router-health-and-mapping");
  const contextPath = path.join(phaseRoot, "02-CONTEXT.md");
  const researchPath = path.join(phaseRoot, "02-RESEARCH.md");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const uiStep = await blueprintProjectStatus({ cwd: repoPath });
  await rm(researchPath);
  const researchStep = await blueprintProjectStatus({ cwd: repoPath });
  await rm(contextPath);
  const discussStep = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(uiStep.nextAction, /\/blu-ui-phase 2/);
  assert.match(researchStep.nextAction, /\/blu-research-phase 2/);
  assert.match(discussStep.nextAction, /\/blu-discuss-phase 2/);
});

test("project status recommends execute-phase once plans exist and summaries are still absent", async (t) => {
  const repoPath = await createExecutionReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(status.currentPhase, "3");
  assert.equal(state.derivedStatus.currentPhase, "3");
  assert.match(status.nextAction, /\/blu-execute-phase 3/);
  assert.match(state.derivedStatus.nextAction, /\/blu-execute-phase 3/);
});

test("project status recommends validate-phase once execution summaries exist without verification", async (t) => {
  const repoPath = await createExecutionReadyRepo();
  const phaseRoot = path.join(repoPath, ".blueprint/phases/03-phase-discovery");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(phaseRoot, "03-01-SUMMARY.md"),
    `# Phase 03: Phase Discovery - Summary

## Result

- Execution finished and produced durable summary evidence.
`,
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(status.currentPhase, "3");
  assert.equal(state.derivedStatus.currentPhase, "3");
  assert.match(status.nextAction, /\/blu-validate-phase 3/);
  assert.match(state.derivedStatus.nextAction, /\/blu-validate-phase 3/);
});

test("project status routes milestone closeout through audit, completion, summary, and next milestone in order", async (t) => {
  const noReportsRepo = await createMilestoneCloseoutRepo("none");
  const auditRepo = await createMilestoneCloseoutRepo("audit");
  const completeRepo = await createMilestoneCloseoutRepo("complete");
  const summaryRepo = await createMilestoneCloseoutRepo("summary");
  t.after(async () => {
    await rm(path.dirname(noReportsRepo), { recursive: true, force: true });
    await rm(path.dirname(auditRepo), { recursive: true, force: true });
    await rm(path.dirname(completeRepo), { recursive: true, force: true });
    await rm(path.dirname(summaryRepo), { recursive: true, force: true });
  });

  const noReportsStatus = await blueprintProjectStatus({ cwd: noReportsRepo });
  const noReportsState = await blueprintStateLoad({ cwd: noReportsRepo });
  const auditStatus = await blueprintProjectStatus({ cwd: auditRepo });
  const auditState = await blueprintStateLoad({ cwd: auditRepo });
  const completeStatus = await blueprintProjectStatus({ cwd: completeRepo });
  const completeState = await blueprintStateLoad({ cwd: completeRepo });
  const summaryStatus = await blueprintProjectStatus({ cwd: summaryRepo });
  const summaryState = await blueprintStateLoad({ cwd: summaryRepo });

  assert.match(noReportsStatus.nextAction, /\/blu-audit-milestone v2/);
  assert.match(noReportsState.derivedStatus.nextAction, /\/blu-audit-milestone v2/);
  assert.match(auditStatus.nextAction, /\/blu-complete-milestone v2/);
  assert.match(auditState.derivedStatus.nextAction, /\/blu-complete-milestone v2/);
  assert.match(completeStatus.nextAction, /\/blu-milestone-summary v2/);
  assert.match(completeState.derivedStatus.nextAction, /\/blu-milestone-summary v2/);
  assert.match(summaryStatus.nextAction, /\/blu-new-milestone/);
  assert.match(summaryState.derivedStatus.nextAction, /\/blu-new-milestone/);
});

test("project status prefers reconciled roadmap signals over stale STATE.md values", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const statePath = path.join(repoPath, ".blueprint/STATE.md");
  const roadmapPath = path.join(repoPath, ".blueprint/ROADMAP.md");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    statePath,
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 2
- Active command: /blu-progress
- Next action: Run /blu-progress to review Phase 2 and the next safe action
- Last updated: 2026-04-10T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );

  await writeFile(
    roadmapPath,
    `# Roadmap: initialized-repo

## Milestone

- Active milestone: v3

## Phases

- [x] Phase 1: Foundation bootstrap
- [ ] Phase 3: Discovery and definition
`,
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(status.status, "initialized");
  assert.equal(status.currentMilestone, "v3");
  assert.equal(status.currentPhase, "3");
  assert.match(status.nextAction, /\/blu-health/);
});

test("project status reports malformed config as a health warning instead of throwing", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const configPath = path.join(repoPath, ".blueprint/config.json");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(configPath, "{ invalid json", "utf8");

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(status.status, "initialized");
  assert.equal(status.initialized, true);
  assert.match(
    status.health.warnings.join("\n"),
    /Blueprint config could not be read:/
  );
});

test("state load clears stale structural blockers after the repo is healthy again", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const statePath = path.join(repoPath, ".blueprint/STATE.md");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    statePath,
    `# Blueprint State

- Project status: partial
- Current milestone: v2
- Current phase: 2
- Active command: /blu-health
- Next action: Run /blu-health to inspect blockers and repair options
- Last updated: 2026-04-10T00:00:00.000Z

## Blockers

- Missing .blueprint/REQUIREMENTS.md
`,
    "utf8"
  );

  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(state.derivedStatus.projectStatus, "initialized");
  assert.equal(state.derivedStatus.hasBlockers, false);
  assert.deepEqual(state.blockers, []);
  assert.match(state.derivedStatus.nextAction, /\/blu-ui-phase 2/);
});

test("artifact validation flags malformed legacy config and incomplete bundles with repair guidance", async (t) => {
  const repoPath = await createRepoFromFixture("legacy-config-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /Config warning: Migrated legacy config key commit_docs/);
  assert.match(validation.issues.join("\n"), /Config warning: Migrated legacy config key parallelization/);
  assert.match(validation.issues.join("\n"), /Config warning: Ignored disallowed config key: workflow\.use_workspaces/);
  assert.match(validation.issues.join("\n"), /Codebase artifact bundle is incomplete/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu-health --repair/);
});

test("artifact validation does not flag an in-progress discovery phase as structurally broken", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-discovery-validation-"));
  const repoPath = path.join(tempRoot, "repo");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Discovery Validation

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery**
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-discuss-phase
- Next action: Run /blu-discuss-phase to finish discovery
- Last updated: 2026-04-11T00:00:00.000Z

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
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    `# Phase 03 Context

## Decisions
- Discovery is still in progress.
`,
    "utf8"
  );

  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test("help progress and health command files reference registered MCP tool names", async () => {
  const commandFiles = [
    {
      file: "commands/blu-help.toml",
      tools: ["blueprint_command_catalog", "blueprint_project_status"]
    },
    {
      file: "commands/blu-add-phase.toml",
      tools: [
        "blueprint_roadmap_read",
        "blueprint_roadmap_add_phase",
        "blueprint_artifact_scaffold",
        "blueprint_state_update"
      ]
    },
    {
      file: "commands/blu-insert-phase.toml",
      tools: [
        "blueprint_roadmap_read",
        "blueprint_roadmap_insert_phase",
        "blueprint_artifact_scaffold",
        "blueprint_state_update"
      ]
    },
    {
      file: "commands/blu-remove-phase.toml",
      tools: [
        "blueprint_roadmap_read",
        "blueprint_artifact_list",
        "blueprint_roadmap_remove_phase",
        "blueprint_state_update"
      ]
    },
    {
      file: "commands/blu-progress.toml",
      tools: [
        "blueprint_project_status",
        "blueprint_config_get",
        "blueprint_state_load",
        "blueprint_artifact_list",
        "blueprint_command_catalog"
      ]
    },
    {
      file: "commands/blu-health.toml",
      tools: [
        "blueprint_project_status",
        "blueprint_config_get",
        "blueprint_config_set",
        "blueprint_state_load",
        "blueprint_artifact_list",
        "blueprint_artifact_validate",
        "blueprint_state_sync"
      ]
    },
    {
      file: "commands/blu-debug.toml",
      tools: [
        "blueprint_project_status",
        "blueprint_artifact_report_write",
        "blueprint_artifact_mutate_index",
        "blueprint_state_update"
      ]
    },
    {
      file: "commands/blu-docs-update.toml",
      tools: [
        "blueprint_project_status",
        "blueprint_artifact_list",
        "blueprint_artifact_summary_digest",
        "blueprint_artifact_report_write"
      ]
    },
    {
      file: "commands/blu-code-review.toml",
      tools: [
        "blueprint_phase_locate",
        "blueprint_artifact_list",
        "blueprint_review_scope",
        "blueprint_review_record"
      ]
    },
    {
      file: "commands/blu-audit-fix.toml",
      tools: [
        "blueprint_phase_locate",
        "blueprint_artifact_list",
        "blueprint_review_scope",
        "blueprint_artifact_report_write",
        "blueprint_artifact_mutate_index",
        "blueprint_state_update"
      ]
    }
  ];

  for (const command of commandFiles) {
    const raw = await readFile(path.join(repoRoot, command.file), "utf8");

    for (const toolName of command.tools) {
      assert.ok(
        blueprintToolNames.includes(toolName),
        `${toolName} should be registered in the MCP server`
      );
      assert.match(raw, new RegExp(toolName));
    }
  }

  const healthCommand = await readFile(path.join(repoRoot, "commands/blu-health.toml"), "utf8");
  assert.match(healthCommand, /--repair/);
  assert.match(healthCommand, /explicit confirmation-style response/i);
});

test("runtime-facing docs mention shipped command coverage instead of a docs-only runtime description", async () => {
  const geminiFile = await readFile(path.join(repoRoot, "GEMINI.md"), "utf8");
  const readmeFile = await readFile(path.join(repoRoot, "README.md"), "utf8");

  assert.match(geminiFile, /\/blu-settings/);
  assert.match(geminiFile, /\/blu-set-profile/);
  assert.match(geminiFile, /\/blu-help/);
  assert.match(geminiFile, /\/blu-progress/);
  assert.match(geminiFile, /\/blu-health/);
  assert.match(geminiFile, /\/blu-map-codebase/);
  assert.match(geminiFile, /\.planning\//);
  assert.match(readmeFile, /active implementation/i);
  assert.match(readmeFile, /## Current Runtime Layout/);
  assert.match(readmeFile, /commands\/blu-help\.toml/);
  assert.match(readmeFile, /commands\/blu-progress\.toml/);
  assert.match(readmeFile, /commands\/blu-health\.toml/);
  assert.match(readmeFile, /commands\/blu-map-codebase\.toml/);
  assert.match(readmeFile, /commands\/blu-debug\.toml/);
  assert.match(readmeFile, /commands\/blu-docs-update\.toml/);
  assert.match(readmeFile, /commands\/blu-code-review\.toml/);
  assert.match(readmeFile, /commands\/blu-audit-fix\.toml/);
  assert.match(geminiFile, /\/blu-debug/);
  assert.match(geminiFile, /\/blu-docs-update/);
  assert.match(geminiFile, /\/blu-code-review/);
  assert.match(geminiFile, /\/blu-audit-fix/);
  assert.match(readmeFile, /skills\/blueprint-router\.md/);
  assert.doesNotMatch(readmeFile, /## Planned Runtime Layout/);
});
