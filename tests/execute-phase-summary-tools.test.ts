import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintArtifactList } from "../src/mcp/tools/artifacts.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  blueprintPhaseContext,
  blueprintPhasePlanIndex,
  blueprintPhaseSummaryIndex,
  blueprintPhaseSummaryRead,
  blueprintPhaseSummaryWrite,
  blueprintPhaseValidationWrite
} from "../src/mcp/tools/phase.js";

async function createExecutionRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-execute-phase-summary-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Summary Fixture

## Milestone

- Active milestone: v1

## Phases

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
- Active command: /blu-execute-phase
- Next action: Run /blu-execute-phase 3
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

- Summary writes must stay MCP-owned.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    `# Phase 03: Phase Discovery - Research

**Researched:** 2026-04-11
**Domain:** execute-phase summary tooling
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXEC-01 | Persist one summary per completed plan. | Summary MCP writes keep execution evidence deterministic. |

## Summary

- Execution should stay plan-aware and summary-backed.

## Locked Decisions From Context

- Execution summaries should remain linked to saved plan and discovery evidence.

## User Constraints

- Keep writes inside .blueprint/.

## Standard Stack

- TypeScript on Node.js

## Installation And Setup

- Run execution summary fixtures after seeding the saved research artifact for the phase.

## Alternatives Considered

- Generating summaries without the saved discovery trail was rejected as too lossy.

## Architecture Patterns

- Commands stay thin; MCP tools own persistence.

## Don't Hand-Roll

- Use phase summary read/write helpers instead of raw file writes.

## Anti-Patterns

- Letting execution proceed as if research were optional once coding starts.

## State Of The Art

- Execution reporting now keeps saved discovery evidence available across the lifecycle.

## Common Pitfalls

- Treating a plan as executed before a summary exists.

## Open Questions

- Should execution summaries quote the key research recommendation that was followed?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Execution summary grounding | HIGH | The fixture verifies summary flows against saved discovery evidence. |

## Code Examples

\`\`\`ts
await blueprintPhaseSummaryWrite({ cwd: repoPath, phase: "3", planId: "01", content });
\`\`\`

## Recommendations

- Route to /blu-execute-phase only after discovery and planning artifacts are already in place.

## Sources

- \`src/mcp/tools/phase.ts\` - summary indexing and phase-routing substrate.
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
objective: "Exercise summary indexing."
depends_on: []
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Exercise summary indexing.
`,
    "utf8"
  );

  return repoPath;
}

function validSummaryContent(planId = "01"): string {
  return `# Phase 03: Phase Discovery - Summary ${planId}

**Plan:** \`03-${planId}-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced a summary artifact.

## Changes Made

- Added summary indexing coverage for execute-phase.

## Verification

- Ran the summary tooling test slice.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-${planId}-SUMMARY.md\`
`;
}

function summaryWithUntouchedScaffoldSections(planId = "01"): string {
  return `# Phase 03: Phase Discovery - Summary ${planId}

**Plan:** \`03-${planId}-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced a summary artifact.

## Changes Made

- Explicit code, config, or artifact changes completed for this plan.

## Verification

- Command, test, or evidence that supports the reported outcome.

## Follow-Ups

- Remaining gap, handoff, or \`none\`.

## Evidence

- \`or other saved repo evidence if helpful.\`
`;
}

function validVerificationContent(summaryFile = "03-01-SUMMARY.md"): string {
  return `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`${summaryFile}\` for the completed execution plan.

## Validation Summary

- The validated feature set is ready for UAT.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/${summaryFile}

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with \`/blu-verify-work 3\`.
`;
}

function executionPlanContent(planId: string, wave: number, gapClosure = false): string {
  return `---
phase: 3
plan_id: "${planId}"
title: "Execution Plan ${planId}"
wave: ${wave}
status: planned
${gapClosure ? "gap_closure: true\n" : ""}objective: "Ship the plan-phase runtime."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/phase-planning-tools.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan ${planId}

## Goal

Ship the plan-phase runtime.

## Scope

- Add plan indexing and wave-targeting coverage.

## Tasks

### Task 1: Validate the target set

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Add Blueprint plan indexing and writing support with overwrite protection.

#### Acceptance Criteria

- The plan remains execution-ready and indexed as a real gap-closure target when \`gap_closure: true\` is set.

## Verification

- Execute-phase targeting can derive the gap-only set from the plan index instead of pending summaries alone.

## Must Haves

- Preserve lower-wave debt until earlier waves are completed.
`;
}

test("execute-phase summary tools are registered in the Blueprint server", () => {
  for (const toolName of [
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_summary_write"
  ]) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
  }
});

test("phase context indexes execution summaries alongside plans", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const beforeStatus = await blueprintProjectStatus({ cwd: repoPath });
  const created = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "1",
    content: validSummaryContent("01")
  });
  const index = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "3" });
  const read = await blueprintPhaseSummaryRead({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });
  const reused = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: validSummaryContent("01")
  });
  const invalid = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: "   ",
    overwrite: true
  });

  const planPath = ".blueprint/phases/03-phase-discovery/03-01-PLAN.md";
  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });
  const listed = await blueprintArtifactList({ cwd: repoPath });
  const afterStatus = await blueprintProjectStatus({ cwd: repoPath });
  const summaryBody = await readFile(
    path.join(repoPath, summaryPath),
    "utf8"
  );

  assert.match(beforeStatus.nextAction, /\/blu-execute-phase 3/);
  assert.equal(created.status, "created");
  assert.deepEqual(index.completedPlans, ["01"]);
  assert.deepEqual(index.pendingPlans, []);
  assert.equal(read.found, true);
  assert.equal(read.metadata?.linkedPlanPath, planPath);
  assert.equal(reused.status, "reused");
  assert.equal(invalid.status, "invalid");
  assert.match(invalid.issues.join("\n"), /must not be empty/i);
  assert.deepEqual(context.phase?.artifacts.plans, [planPath]);
  assert.deepEqual(context.phase?.artifacts.summaries, [summaryPath]);
  assert.ok(context.phase?.artifacts.all.includes(summaryPath));
  assert.ok(listed.artifacts.phases.includes(planPath));
  assert.ok(listed.artifacts.phases.includes(summaryPath));
  assert.match(afterStatus.nextAction, /\/blu-validate-phase 3/);
  assert.match(summaryBody, /summary artifact/i);
});

test("phase summary writes reject untouched templates and repo validation reports malformed summaries as issues", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const untouchedSummary = `# Phase 03: Phase Discovery - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED|PARTIAL|BLOCKED

## Outcome

- Concise delivery summary grounded in the completed work.

## Changes Made

- Explicit code, config, or artifact changes completed for this plan.

## Verification

- Command, test, or evidence that supports the reported outcome.

## Follow-Ups

- Remaining gap, handoff, or \`none\`.

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\` or other saved repo evidence if helpful.
`;

  const rejected = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: untouchedSummary,
    overwrite: true
  });
  const missingRead = await blueprintPhaseSummaryRead({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });
  const summaryPath = path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md");

  await writeFile(summaryPath, untouchedSummary, "utf8");

  assert.equal(rejected.status, "invalid");
  assert.equal(missingRead.found, false);
  assert.match(rejected.issues.join("\n"), /locked marker|placeholder scaffold text|must start/i);
});

test("phase summary writes reject summaries whose H1 appears after body text", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const prefacedSummary = `Preamble text that should not precede the H1.

# Phase 03: Phase Discovery - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced a summary artifact.

## Changes Made

- Added summary indexing coverage for execute-phase.

## Verification

- Ran the summary tooling test slice.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`
`;

  const rejected = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: prefacedSummary,
    overwrite: true
  });

  assert.equal(rejected.status, "invalid");
  assert.match(rejected.issues.join("\n"), /must start with a '# \.\.\. - Summary' heading/i);
});

test("phase summary writes reject summaries whose Plan marker does not match the linked plan path", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const mismatchedPlanSummary = `# Phase 03: Phase Discovery - Summary 01

**Plan:** \`.blueprint/phases/03-phase-discovery/03-02-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced a summary artifact.

## Changes Made

- Added summary indexing coverage for execute-phase.

## Verification

- Ran the summary tooling test slice.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`
`;

  const rejected = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: mismatchedPlanSummary,
    overwrite: true
  });

  assert.equal(rejected.status, "invalid");
  assert.match(rejected.issues.join("\n"), /does not match linked plan path/i);
});

test("phase summary writes reject untouched scaffold prose in the summary sections", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const rejected = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: summaryWithUntouchedScaffoldSections("01"),
    overwrite: true
  });

  assert.equal(rejected.status, "invalid");
  assert.match(rejected.issues.join("\n"), /placeholder scaffold text/i);
  assert.match(
    rejected.issues.join("\n"),
    /Explicit code, config, or artifact changes completed for this plan\./
  );
  assert.match(
    rejected.issues.join("\n"),
    /Command, test, or evidence that supports the reported outcome\./
  );
  assert.match(rejected.issues.join("\n"), /Remaining gap, handoff, or `none`\./);
  assert.match(rejected.issues.join("\n"), /or other saved repo evidence if helpful\./);
});

test("phase summary indexing ignores malformed summaries when computing completion state", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalidSummary = `# Phase 03: Phase Discovery - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Concise delivery summary grounded in the completed work.

## Changes Made

- Only the outcome section was written in this malformed summary fixture.

## Verification

- Missing required verification details.

## Follow-Ups

- Missing follow-up details.

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`
`;
  const summaryPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  );

  await writeFile(summaryPath, invalidSummary, "utf8");

  const index = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "3" });

  assert.deepEqual(index.completedPlans, []);
  assert.deepEqual(index.pendingPlans, ["01"]);
  assert.equal(index.summaries.length, 1);
  assert.match(index.warnings.join("\n"), /03-01-SUMMARY\.md/);
  assert.match(
    index.warnings.join("\n"),
    /invalid and does not count as completed execution evidence|missing required section/i
  );
});

test("execute-phase targeting keeps --gaps-only on explicit gap plans and preserves lower-wave debt", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    executionPlanContent("02", 1),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-03-PLAN.md"),
    executionPlanContent("03", 2, true),
    "utf8"
  );
  await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: validSummaryContent("01")
  });

  const planIndex = await blueprintPhasePlanIndex({ cwd: repoPath, phase: "3" });
  const summaryIndex = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "3" });
  const gapsOnlyTargets = summaryIndex.pendingPlans.filter((planId) =>
    planIndex.gapClosurePlans.includes(planId)
  );
  const lowerWaveDebt = summaryIndex.pendingPlans.filter((planId) => {
    const wave = planIndex.plans.find((plan) => plan.planId === planId)?.wave;
    return typeof wave === "number" && wave < 2;
  });

  assert.deepEqual(summaryIndex.pendingPlans, ["02", "03"]);
  assert.deepEqual(planIndex.gapClosurePlans, ["03"]);
  assert.deepEqual(gapsOnlyTargets, ["03"]);
  assert.deepEqual(lowerWaveDebt, ["02"]);
});

test("phase validation writes require a valid execution summary before verification", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalidSummaryPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  );

  await writeFile(
    invalidSummaryPath,
    `# Phase 03: Phase Discovery - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Concise delivery summary grounded in the completed work.

## Changes Made

- Only the outcome section was written in this malformed summary fixture.
`,
    "utf8"
  );

  await assert.rejects(
    blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "3",
      artifact: "verification",
      content: validVerificationContent(),
      overwrite: true
    }),
    /valid execution summaries/i
  );
});

test("phase summary tools accept numeric phase and plan identifiers from runtime callers", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const created = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: 3,
    planId: 1,
    content: validSummaryContent("01")
  });
  const read = await blueprintPhaseSummaryRead({
    cwd: repoPath,
    phase: "03-phase-discovery",
    planId: 1
  });
  const index = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: 3 });

  assert.equal(created.planId, "01");
  assert.equal(created.phaseNumber, "3");
  assert.equal(read.found, true);
  assert.equal(read.planId, "01");
  assert.deepEqual(index.completedPlans, ["01"]);
});
