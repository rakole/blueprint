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

## Locked Decisions From Context

- Router surfaces must stay limited to implemented commands.

## User Constraints

- Keep writes inside .blueprint/.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Installation And Setup

- Run router and health fixtures against repos seeded with discovery artifacts.

## Alternatives Considered

- Recommending next steps from docs alone was rejected in favor of runtime status reads.

## Architecture Patterns

- Commands stay thin; MCP tools own persistence.

## Don't Hand-Roll

- Reuse the existing plan and summary index flow.

## Anti-Patterns

- Recommending planning or execution from malformed discovery evidence.

## State Of The Art

- Router and health flows now derive lifecycle guidance from saved artifact validity.

## Common Pitfalls

- Treating a missing summary as completed execution.

## Open Questions

- Should health repair suggest regenerating stale research automatically in later waves?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Routing guidance | HIGH | The fixture asserts the next-step outcome from controlled artifact state. |

## Code Examples

\`\`\`ts
await blueprintPhaseContext({ cwd: repoPath, phase: "3" });
\`\`\`

## Recommendations

- Route to /blu-execute-phase once the phase has plans and no summaries.

## Sources

- \`src/mcp/tools/phase.ts\` - lifecycle routing and artifact readiness checks.
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

async function createUiDiscoveryWithoutResearchRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-ui-discovery-routing-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/02-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: UI Discovery Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 2: Phase Discovery**
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 2
- Active command: /blu-discuss-phase
- Next action: Run /blu-discuss-phase to finish discovery
- Last updated: 2026-04-19T00:00:00.000Z

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
          research: false,
          ui_phase: true
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-phase-discovery/02-CONTEXT.md"),
    `# Phase 02: Phase Discovery - Context

## Decisions
- UI discovery should still be requested even when research is disabled.
`,
    "utf8"
  );

  return repoPath;
}

async function createUiDiscoveryWithoutResearchButInvalidResearchRepo(): Promise<string> {
  const repoPath = await createUiDiscoveryWithoutResearchRepo();

  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-phase-discovery/02-RESEARCH.md"),
    `# Phase 02: Phase Discovery - Research

**Researched:** <YYYY-MM-DD>
**Domain:** <research domain>
**Confidence:** LOW|MEDIUM|HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| <requirement-id> | <phase requirement> | <evidence-backed guidance> |

## Summary

- <key conclusion>

## Locked Decisions From Context

- <phase decision preserved from context>

## User Constraints

- <repo, product, or workflow constraint>

## Standard Stack

- <runtime, library, or shared repo pattern>

## Installation And Setup

- <installation or setup guidance>

## Alternatives Considered

- <alternative considered and tradeoff>

## Architecture Patterns

- <durable implementation pattern>

## Don't Hand-Roll

- <existing tool, helper, or platform feature>

## Anti-Patterns

- <anti-pattern detail or implementation to avoid>

## State Of The Art

- <current ecosystem or repo update>

## Common Pitfalls

- <failure mode or regression risk>

## Open Questions

- <open question that still needs an answer>

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| <topic> | LOW|MEDIUM|HIGH | <evidence-backed confidence explanation> |

## Code Examples

\`\`\`text
<short code or pseudocode example>
\`\`\`

## Recommendations

- <prescriptive recommendation with tradeoffs>

## Sources

- <repo path, URL, or cited file reference> - why it matters
`,
    "utf8"
  );

  return repoPath;
}

async function createStaleRoadmapAdvancedStateRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-stale-roadmap-state-"));
  const repoPath = path.join(tempRoot, "repo");
  const completedPhaseRoot = path.join(repoPath, ".blueprint/phases/04-results-dashboard");
  const nextPhaseRoot = path.join(repoPath, ".blueprint/phases/05-rule-management");

  await mkdir(completedPhaseRoot, { recursive: true });
  await mkdir(nextPhaseRoot, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Stale Progress Fixture

## Milestone

- Active milestone: v2

## Phases

- [x] **Phase 1: Foundation**
- [x] **Phase 2: Discovery**
- [x] **Phase 3: Delivery**
- [ ] **Phase 4: Results Dashboard**
- [ ] **Phase 5: Rule Management**

## Phase Details

### Phase 4: Results Dashboard
**Goal**: Close out dashboard work before moving on.
**Requirements**: RCA-04
**Status**: completed

### Phase 5: Rule Management
**Goal**: Start the next planned milestone slice.
**Requirements**: RCA-05
**Status**: planned
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 5
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-04-18T00:00:00.000Z

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

  for (const artifact of [
    "04-CONTEXT.md",
    "04-RESEARCH.md",
    "04-UI-SPEC.md",
    "04-01-PLAN.md",
    "04-01-SUMMARY.md",
    "04-VERIFICATION.md",
    "04-UAT.md"
  ]) {
    await writeFile(path.join(completedPhaseRoot, artifact), "# Completed\n", "utf8");
  }

  await writeFile(
    path.join(nextPhaseRoot, "05-CONTEXT.md"),
    `# Phase 05: Rule Management - Context

## Decisions

- Phase 5 is the real next slice even if Phase 4's roadmap checkbox drifted.
`,
    "utf8"
  );

  return repoPath;
}

async function createMilestoneCloseoutRepo(
  reportStage: "none" | "audit" | "complete" | "summary",
  options: {
    malformedEarlierSummary?: boolean;
    missingEarlierVerification?: boolean;
    missingEarlierUat?: boolean;
    missingEarlierSummary?: boolean;
  } = {}
): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-milestone-closeout-routing-"));
  const repoPath = path.join(tempRoot, "repo");
  const reportsDir = path.join(repoPath, ".blueprint/reports");
  const earlierPhaseRoot = path.join(repoPath, ".blueprint/phases/02-validation-hardening");
  const phaseRoot = path.join(repoPath, ".blueprint/phases/03-milestone-closeout");

  await mkdir(earlierPhaseRoot, { recursive: true });
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
    path.join(earlierPhaseRoot, "02-01-SUMMARY.md"),
    options.malformedEarlierSummary
      ? `# Phase 02: Validation Hardening - Summary 01

## Outcome

- Earlier milestone execution evidence drifted out of shape.
`
      : `# Phase 02: Validation Hardening - Summary 01

**Plan:** \`02-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Earlier milestone execution evidence is complete.

## Changes Made

- Captured the earlier milestone execution summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/02-validation-hardening/02-01-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/02-validation-hardening/02-01-SUMMARY.md\`
`,
    "utf8"
  );
  await writeFile(
    path.join(earlierPhaseRoot, "02-01-PLAN.md"),
    `---
phase: 2
plan_id: "01"
title: "Validation Hardening Plan 01"
wave: 1
status: done
objective: "Exercise milestone closeout routing."
depends_on: []
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 02: Validation Hardening - Plan 01
`,
    "utf8"
  );
  if (options.missingEarlierSummary) {
    await writeFile(
      path.join(earlierPhaseRoot, "02-02-PLAN.md"),
      `---
phase: 2
plan_id: "02"
title: "Validation Hardening Plan 02"
wave: 1
status: planned
objective: "Exercise milestone closeout summary coverage."
depends_on: []
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 02: Validation Hardening - Plan 02
`,
      "utf8"
    );
  }
  if (!options.missingEarlierVerification) {
    await writeFile(
      path.join(earlierPhaseRoot, "02-VERIFICATION.md"),
      `# Phase 02: Validation Hardening - Verification

**Coverage:** Reviewed \`02-01-SUMMARY.md\` for completed execution evidence.

## Validation Summary

- Validation evidence is complete.

## Evidence Reviewed

- .blueprint/phases/02-validation-hardening/02-01-SUMMARY.md

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work 2
`,
      "utf8"
    );
  }
  if (!options.missingEarlierUat) {
    await writeFile(
      path.join(earlierPhaseRoot, "02-UAT.md"),
      `# Phase 02: Validation Hardening - UAT

**Status:** PASS

## UAT Summary

- UAT evidence is complete.

## Questions Asked

- Did the earlier milestone close out cleanly?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/02-validation-hardening/02-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
`,
      "utf8"
    );
  }
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

## Locked Decisions From Context

- Milestone closeout should stay report-backed and avoid hidden command expansion.

## User Constraints

- Keep writes inside .blueprint/.
- Do not expose blocked commands while deriving the next action.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Installation And Setup

- Run closeout fixtures after seeding roadmap, reports, and the saved research artifact.

## Alternatives Considered

- Manual closeout summaries without the saved research trail were rejected.

## Architecture Patterns

- Use durable milestone reports as routing checkpoints.
- Keep routing dependent on implemented commands only.

## Don't Hand-Roll

- Reuse the existing roadmap, artifact, and state MCP substrates.

## Anti-Patterns

- Treating milestone closeout as complete without discovery evidence from the active phase.

## State Of The Art

- Closeout routing now combines saved reports and discovery artifacts for the next safe action.

## Common Pitfalls

- Skipping the audit report gate and jumping straight to archival.
- Treating invalid research as good enough to continue closeout routing.

## Open Questions

- Should later milestone flows summarize research confidence in the final report?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Milestone closeout routing | HIGH | The fixture controls the saved reports and active-phase artifacts. |

## Code Examples

\`\`\`ts
await blueprintStateLoad({ cwd: repoPath });
\`\`\`

## Recommendations

- Route to /blu-audit-milestone v2 when all milestone phases are complete and no milestone audit report exists.
- Advance sequentially through completion, summary, and new-milestone once each report appears.

## Sources

- src/mcp/tools/state.ts - closeout routing and phase-status derivation.
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
    `# Phase 03: Milestone Closeout - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution completed and the milestone is ready for closeout routing.

## Changes Made

- Captured the completed milestone closeout execution.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/03-milestone-closeout/03-01-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-milestone-closeout/03-01-SUMMARY.md\`
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseRoot, "03-VERIFICATION.md"),
    `# Phase 03: Milestone Closeout - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.

## Validation Summary

- Validation evidence is complete.

## Evidence Reviewed

- .blueprint/phases/03-milestone-closeout/03-01-SUMMARY.md

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work 3
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseRoot, "03-UAT.md"),
    `# Phase 03: Milestone Closeout - UAT

**Status:** PASS

## UAT Summary

- UAT evidence is complete.

## Questions Asked

- Did the milestone closeout match the saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/03-milestone-closeout/03-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
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
    `# Phase 03: Phase Discovery - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced durable summary evidence.

## Changes Made

- Captured the completed execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`
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

test("project status ignores placeholder summaries when deciding validation readiness", async (t) => {
  const repoPath = await createExecutionReadyRepo();
  const phaseRoot = path.join(repoPath, ".blueprint/phases/03-phase-discovery");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(phaseRoot, "03-01-SUMMARY.md"),
    `# Phase 03: Phase Discovery - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Concise delivery summary grounded in the completed work.

## Changes Made

- Explicit code, config, or artifact changes completed for this plan.

## Verification

- Command, test, or evidence that supports the reported outcome.

## Follow-Ups

- Remaining gap, handoff, or \`none\`.

## Evidence

- or other saved repo evidence if helpful.
`,
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-execute-phase 3/);
  assert.match(state.derivedStatus.nextAction, /\/blu-execute-phase 3/);
  assert.doesNotMatch(status.nextAction, /\/blu-validate-phase 3/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-validate-phase 3/);
});

test("project status ignores placeholder verification and UAT evidence during milestone closeout routing", async (t) => {
  const repoPath = await createMilestoneCloseoutRepo("none");
  const phaseRoot = path.join(repoPath, ".blueprint/phases/02-validation-hardening");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(phaseRoot, "02-VERIFICATION.md"),
    `# Phase 02: Validation Hardening - Verification

**Coverage:** Reviewed \`02-01-SUMMARY.md\` and any other saved phase summaries for validation evidence.

## Validation Summary

- Concise readiness result grounded in the saved summaries.

## Evidence Reviewed

- .blueprint/phases/02-validation-hardening/02-01-SUMMARY.md

## Gaps Found

- Explicit blocker, follow-up, or \`none\`.

## Suggested Repairs

- Explicit next repair, follow-up, or \`none\`.

## Next Safe Action

- /blu-verify-work 2
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseRoot, "02-UAT.md"),
    `# Phase 02: Validation Hardening - UAT

**Status:** PASS

## UAT Summary

- Concise user-facing result grounded in the saved summaries and verification artifact.

## Questions Asked

- Question asked during the UAT pass, or \`none\`.

## Observed Behavior

- Observed behavior tied to saved summary evidence such as \`.blueprint/phases/02-validation-hardening/02-01-SUMMARY.md\`.

## Unresolved Gaps

- Explicit blocker, follow-up, or \`none\`.

## Follow-Up Fixes

- Explicit follow-up fix, acceptance note, or \`none\`.

## Next Safe Action

- /blu-progress
`,
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-validate-phase 2/);
  assert.match(state.derivedStatus.nextAction, /\/blu-validate-phase 2/);
  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-audit-milestone/);
});

test("project status stays blocked from milestone audit when an earlier checked-off phase is missing plan summaries", async (t) => {
  const repoPath = await createMilestoneCloseoutRepo("none", {
    missingEarlierSummary: true
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-audit-milestone/);
});

test("project status routes to ui-phase when research is disabled but UI discovery is still required", async (t) => {
  const repoPath = await createUiDiscoveryWithoutResearchRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(status.currentPhase, "2");
  assert.equal(state.derivedStatus.currentPhase, "2");
  assert.match(status.nextAction, /\/blu-ui-phase 2/);
  assert.match(state.derivedStatus.nextAction, /\/blu-ui-phase 2/);
});

test("project status ignores stale invalid research when research is disabled", async (t) => {
  const repoPath = await createUiDiscoveryWithoutResearchButInvalidResearchRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(status.nextAction, /\/blu-ui-phase 2/);
  assert.match(state.derivedStatus.nextAction, /\/blu-ui-phase 2/);
  assert.doesNotMatch(status.nextAction, /\/blu-research-phase 2/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-research-phase 2/);
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

test("project status requires milestone-wide validation evidence before closeout routing", async (t) => {
  const repoPath = await createMilestoneCloseoutRepo("none", {
    missingEarlierVerification: true
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-audit-milestone/);
  assert.match(status.nextAction, /\/blu-validate-phase 2/);
  assert.match(state.derivedStatus.nextAction, /\/blu-validate-phase 2/);
});

test("project status blocks milestone closeout when earlier summary evidence is malformed", async (t) => {
  const repoPath = await createMilestoneCloseoutRepo("none", {
    malformedEarlierSummary: true
  });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-audit-milestone/);
  assert.match(status.nextAction, /\/blu-validate-phase 2/);
  assert.match(state.derivedStatus.nextAction, /\/blu-validate-phase 2/);
});

test("project status blocks milestone closeout when verification evidence lacks a valid summary link", async (t) => {
  const repoPath = await createMilestoneCloseoutRepo("none");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-validation-hardening/02-VERIFICATION.md"),
    `# Phase 02: Validation Hardening - Verification

**Coverage:** Reviewed the completed milestone evidence.

## Validation Summary

- Validation evidence is complete.

## Evidence Reviewed

- unrelated-notes.md

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work 2
`,
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-audit-milestone/);
  assert.match(status.nextAction, /\/blu-validate-phase 2/);
  assert.match(state.derivedStatus.nextAction, /\/blu-validate-phase 2/);
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

test("project status prefers a later stored phase when roadmap completion drift leaves the prior phase unchecked", async (t) => {
  const repoPath = await createStaleRoadmapAdvancedStateRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(status.status, "initialized");
  assert.equal(status.currentPhase, "5");
  assert.equal(state.derivedStatus.currentPhase, "5");
  assert.match(status.nextAction, /\/blu-research-phase 5/);
  assert.match(state.derivedStatus.nextAction, /\/blu-research-phase 5/);
  assert.doesNotMatch(status.nextAction, /Phase 4/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /Phase 4/);
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
      file: "commands/blu-review.toml",
      tools: [
        "blueprint_phase_locate",
        "blueprint_artifact_list",
        "blueprint_phase_plan_index",
        "blueprint_phase_plan_read",
        "blueprint_review_record"
      ]
    },
    {
      file: "commands/blu-code-review.toml",
      tools: [
        "blueprint_phase_locate",
        "blueprint_config_get",
        "blueprint_artifact_list",
        "blueprint_artifact_contract_read",
        "blueprint_review_scope",
        "blueprint_review_record"
      ]
    },
    {
      file: "commands/blu-code-review-fix.toml",
      tools: [
        "blueprint_phase_locate",
        "blueprint_review_load_findings",
        "blueprint_artifact_contract_read",
        "blueprint_review_record",
        "blueprint_state_update"
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
    },
    {
      file: "commands/blu-ui-review.toml",
      tools: [
        "blueprint_phase_locate",
        "blueprint_artifact_list",
        "blueprint_review_record"
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
  assert.match(readmeFile, /commands\/blu-review\.toml/);
  assert.match(readmeFile, /commands\/blu-code-review\.toml/);
  assert.match(readmeFile, /commands\/blu-code-review-fix\.toml/);
  assert.match(readmeFile, /commands\/blu-audit-fix\.toml/);
  assert.match(readmeFile, /commands\/blu-ui-review\.toml/);
  assert.match(readmeFile, /commands\/blu-ship\.toml/);
  assert.match(geminiFile, /\/blu-debug/);
  assert.match(geminiFile, /\/blu-docs-update/);
  assert.match(geminiFile, /\/blu-review/);
  assert.match(geminiFile, /\/blu-code-review/);
  assert.match(geminiFile, /\/blu-code-review-fix/);
  assert.match(geminiFile, /\/blu-audit-fix/);
  assert.match(geminiFile, /\/blu-ui-review/);
  assert.match(geminiFile, /\/blu-ship/);
  assert.match(readmeFile, /skills\/blueprint-router\.md/);
  assert.match(readmeFile, /skills\/blueprint-maintenance\/SKILL\.md/);
  assert.doesNotMatch(readmeFile, /## Planned Runtime Layout/);
});
