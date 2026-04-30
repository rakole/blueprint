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
  blueprintPhaseExecutionTargets,
  blueprintPhaseSummaryAuthoringContext,
  blueprintPhaseSummaryIndex,
  blueprintPhaseSummaryRead,
  blueprintPhaseSummaryValidateModel,
  blueprintPhaseSummaryWrite,
  blueprintPhaseValidationWrite,
  phaseToolDefinitions
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
    executionPlanContent("01", 1),
    "utf8"
  );

  return repoPath;
}

function validSummaryContent(
  planId = "01",
  status: "COMPLETED" | "PARTIAL" | "BLOCKED" = "COMPLETED"
): string {
  const isComplete = status === "COMPLETED";
  const isBlocked = status === "BLOCKED";
  const readiness = isComplete
    ? "ready-for-validation"
    : isBlocked
      ? "blocked"
      : "not-ready-for-validation";
  const completionState = isComplete ? "complete" : isBlocked ? "blocked" : "pending";
  const nextSafeAction = isComplete
    ? "/blu-validate-phase 3"
    : isBlocked
      ? "/blu-progress"
      : "/blu-execute-phase 3";
  const verificationResult = isComplete ? "pass" : isBlocked ? "blocked" : "fail";
  const gapRow = isComplete
    ? "| none | none | none | NONE |"
    : `| ${isBlocked ? "Execution blocked before completion" : "Verification did not pass"} | Targeted verification evidence is not passing. | ${isBlocked ? "Resolve the blocker before retrying." : "Rerun execute-phase after repair."} | ${isBlocked ? "BLOCKED" : "OPEN"} |`;
  const manualRow = isComplete
    ? "| none | none | none | NONE |"
    : `| Plan ${planId} verification follow-up | ${isBlocked ? "A blocker stopped verification." : "Verification still needs repair."} | ${nextSafeAction} | ${isBlocked ? "MANUAL" : "DEFERRED"} |`;
  const followUp = isComplete
    ? "none"
    : isBlocked
      ? "Resolve the execution blocker."
      : "Repair and rerun the targeted verification.";

  return `# Phase 03: Phase Discovery - Summary ${planId}

**Plan:** \`03-${planId}-PLAN.md\`
**Status:** ${status}
**Readiness:** ${readiness}
**Completion State:** ${completionState}
**Next Safe Action:** ${nextSafeAction}

## Outcome

- Execution finished and produced a summary artifact.

## Changes Made

- Added summary indexing coverage for execute-phase.

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| tests/phase-planning-tools.test.ts exits 0 | npm test -- tests/phase-planning-tools.test.ts | ${verificationResult} | Focused plan tooling tests ${isComplete ? "passed" : "did not pass"}. | The selected acceptance criterion ${isComplete ? "passed" : "remains unresolved"}. |

## Dependency Plans

| Plan | Status | Evidence |
|------|--------|----------|
| none | none | none |

## Manual / Deferred Work

| Item | Reason | Follow-Up | Status |
|------|--------|-----------|--------|
${manualRow}

## Gap / Repair Routes

| Gap | Evidence | Repair | Status |
|-----|----------|--------|--------|
${gapRow}

## Follow-Ups

- ${followUp}

## Evidence

| Kind | Source | Summary |
|------|--------|---------|
| artifact | .blueprint/phases/03-phase-discovery/03-${planId}-SUMMARY.md | Saved summary artifact. |
`;
}

function validSummaryModel(
  planId = "01",
  status: "COMPLETED" | "PARTIAL" | "BLOCKED" = "COMPLETED",
  patch: Record<string, unknown> = {}
): Record<string, unknown> {
  const isComplete = status === "COMPLETED";
  const isBlocked = status === "BLOCKED";

  return {
    status,
    readiness: isComplete
      ? "ready-for-validation"
      : isBlocked
        ? "blocked"
        : "not-ready-for-validation",
    completionState: isComplete ? "complete" : isBlocked ? "blocked" : "pending",
    outcome: isComplete
      ? [`Execution finished for plan ${planId} and produced durable summary evidence.`]
      : [`Execution made bounded progress for plan ${planId} but still has open execution debt.`],
    changesMade: [
      `Updated the execute-phase summary tooling surfaces owned by plan ${planId}.`
    ],
    targetedVerification: [
      {
        check: "tests/phase-planning-tools.test.ts exits 0",
        command: "npm test -- tests/phase-planning-tools.test.ts",
        result: isComplete ? "pass" : isBlocked ? "blocked" : "fail",
        evidence: isComplete
          ? "Focused plan tooling tests passed."
          : "Focused plan tooling tests did not reach a passing state.",
        notes: isComplete
          ? "The selected acceptance criterion passed."
          : "The selected acceptance criterion remains unresolved."
      }
    ],
    dependencyPlans: [],
    manualOrDeferredWork: isComplete
      ? [
          {
            item: "none",
            reason: "none",
            followUp: "none",
            status: "NONE"
          }
        ]
      : [
          {
            item: `Plan ${planId} verification follow-up`,
            reason: isBlocked ? "A blocker stopped verification." : "Verification still needs repair.",
            followUp: isBlocked ? "/blu-progress" : "/blu-execute-phase 3",
            status: isBlocked ? "MANUAL" : "DEFERRED"
          }
        ],
    gapRoutes: isComplete
      ? [
          {
            gap: "none",
            evidence: "none",
            repair: "none",
            status: "NONE"
          }
        ]
      : [
          {
            gap: isBlocked ? "Execution blocked before completion" : "Verification did not pass",
            evidence: "Targeted verification evidence is not passing.",
            repair: isBlocked ? "Resolve the blocker before retrying." : "Rerun execute-phase after repair.",
            status: isBlocked ? "BLOCKED" : "OPEN"
          }
        ],
    followUps: isComplete ? ["none"] : [isBlocked ? "Resolve the execution blocker." : "Repair and rerun the targeted verification."],
    evidence: [
      {
        kind: "test",
        source: "npm test -- tests/phase-planning-tools.test.ts",
        summary: `Targeted verification evidence for plan ${planId}.`
      }
    ],
    nextSafeAction: isComplete
      ? "/blu-validate-phase 3"
      : isBlocked
        ? "/blu-progress"
        : "/blu-execute-phase 3",
    ...patch
  };
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
    "blueprint_phase_execution_targets",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_summary_authoring_context",
    "blueprint_phase_summary_validate_model",
    "blueprint_phase_summary_write"
  ]) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
  }

  const writeTool = phaseToolDefinitions.find(
    (definition) => definition.name === "blueprint_phase_summary_write"
  );
  assert.ok(writeTool);
  assert.ok("model" in writeTool.inputSchema);
  assert.equal("content" in writeTool.inputSchema, false);
  assert.match(writeTool.description, /Markdown content fallback is not supported/i);
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
    model: validSummaryModel("01")
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
    model: validSummaryModel("01")
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
  assert.equal(
    read.metadata?.linkedPlanPath,
    ".blueprint/phases/03-phase-discovery/03-01-PLAN.md"
  );
  assert.equal(read.metadata?.status, "COMPLETED");
  assert.equal(read.validation?.valid, true);
  assert.deepEqual(read.validation?.issues, []);
  assert.equal(reused.status, "reused");
  assert.equal(invalid.status, "invalid");
  assert.match(invalid.issues.join("\n"), /model-only|content is invalid/i);
  assert.deepEqual(context.phase?.artifacts.plans, [planPath]);
  assert.deepEqual(context.phase?.artifacts.summaries, [summaryPath]);
  assert.ok(context.phase?.artifacts.all.includes(summaryPath));
  assert.ok(listed.artifacts.phases.includes(planPath));
  assert.ok(listed.artifacts.phases.includes(summaryPath));
  assert.match(afterStatus.nextAction, /\/blu-validate-phase 3/);
  assert.match(summaryBody, /Targeted verification evidence for plan 01/i);
});

test("phase summary authoring context narrows optional empty dependency context exactly", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const context = await blueprintPhaseSummaryAuthoringContext({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });
  const taskSchemaText = JSON.stringify(context.taskSchema);

  assert.equal(context.status, "ready");
  assert.deepEqual(context.dependencyPlans, []);
  assert.match(taskSchemaText, /"dependencyPlans"/);
  assert.match(taskSchemaText, /"maxItems":0/);

  const invalid = await blueprintPhaseSummaryValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: validSummaryModel("01", "COMPLETED", {
      dependencyPlans: [
        {
          planId: "99",
          path: ".blueprint/phases/03-phase-discovery/03-99-PLAN.md",
          status: "satisfied",
          evidence: "Injected dependency evidence."
        }
      ]
    })
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must NOT have more than 0 items/i
  );
});

test("phase summary authoring context blocks missing required upstream plan context early", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const context = await blueprintPhaseSummaryAuthoringContext({
    cwd: repoPath,
    phase: "3",
    planId: "02"
  });
  const validation = await blueprintPhaseSummaryValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    model: validSummaryModel("02")
  });

  assert.equal(context.status, "invalid");
  assert.equal(context.taskSchema, null);
  assert.match(context.reason ?? "", /does not exist yet/i);
  assert.equal(validation.status, "invalid");
  assert.match(
    validation.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /does not exist yet|runtime task schema/i
  );
});

test("phase summary schema rejects unsupported fields, missing required fields, and unsafe rendered sinks", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const unsupported = await blueprintPhaseSummaryValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: validSummaryModel("01", "COMPLETED", {
      linkedPlanPath: "03-99-PLAN.md"
    })
  });
  const missingModel = validSummaryModel("01");
  delete missingModel.evidence;
  const missing = await blueprintPhaseSummaryValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: missingModel
  });
  const injected = await blueprintPhaseSummaryValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: validSummaryModel("01", "COMPLETED", {
      targetedVerification: [
        {
          check: "tests/phase-planning-tools.test.ts exits 0",
          command: "npm test -- tests/phase-planning-tools.test.ts\n## Injected",
          result: "pass",
          evidence: "targeted output",
          notes: "safe note"
        }
      ]
    })
  });

  assert.equal(unsupported.status, "invalid");
  assert.match(
    unsupported.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must NOT have additional properties/i
  );
  assert.equal(missing.status, "invalid");
  assert.match(
    missing.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must have required property 'evidence'/i
  );
  assert.equal(injected.status, "invalid");
  assert.match(
    injected.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must match pattern/i
  );
});

test("phase summary runtime narrowing rejects out-of-scope acceptance criteria without mutating later schemas", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    executionPlanContent("02", 1).replace(
      "tests/phase-planning-tools.test.ts exits 0",
      "tests/execute-phase-summary-tools.test.ts exits 0"
    ),
    "utf8"
  );

  const contextOne = await blueprintPhaseSummaryAuthoringContext({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });
  const contextTwo = await blueprintPhaseSummaryAuthoringContext({
    cwd: repoPath,
    phase: "3",
    planId: "02"
  });
  const invalidTwo = await blueprintPhaseSummaryValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    model: validSummaryModel("02")
  });
  const validTwo = await blueprintPhaseSummaryValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    model: validSummaryModel("02", "COMPLETED", {
      targetedVerification: [
        {
          check: "tests/execute-phase-summary-tools.test.ts exits 0",
          command: "npm test -- tests/execute-phase-summary-tools.test.ts",
          result: "pass",
          evidence: "Focused execute summary tests passed.",
          notes: "The selected acceptance criterion passed."
        }
      ],
      evidence: [
        {
          kind: "test",
          source: "npm test -- tests/execute-phase-summary-tools.test.ts",
          summary: "Focused execute-phase summary tests passed."
        }
      ]
    })
  });

  assert.equal(contextOne.status, "ready");
  assert.equal(contextTwo.status, "ready");
  assert.match(JSON.stringify(contextOne.taskSchema), /phase-planning-tools/);
  assert.doesNotMatch(JSON.stringify(contextTwo.taskSchema), /phase-planning-tools/);
  assert.match(JSON.stringify(contextTwo.taskSchema), /execute-phase-summary-tools/);
  assert.equal(invalidTwo.status, "invalid");
  assert.match(
    invalidTwo.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /allowed values|must be equal to one of|must be equal to constant/i
  );
  assert.equal(validTwo.status, "valid");
  assert.match(
    validTwo.renderPreview ?? "",
    /\*\*Plan:\*\* `\.blueprint\/phases\/03-phase-discovery\/03-02-PLAN\.md`/
  );
});

test("phase summary writer rejects markdown fallback and repo validation reports malformed summaries as issues", async (t) => {
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
  const invalidRead = await blueprintPhaseSummaryRead({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });

  assert.equal(rejected.status, "invalid");
  assert.equal(missingRead.found, false);
  assert.equal(invalidRead.found, true);
  assert.equal(invalidRead.metadata?.linkedPlanPath, "03-01-PLAN.md");
  assert.equal(invalidRead.validation?.valid, false);
  assert.match(invalidRead.validation?.issues.join("\n") ?? "", /placeholder scaffold text|must start|locked marker/i);
  assert.match(rejected.issues.join("\n"), /model-only|content is invalid/i);
});

test("phase summary reads expose mismatched plan markers without inventing linked plan paths", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md");
  await writeFile(
    summaryPath,
    `# Phase 03: Phase Discovery - Summary 01

**Plan:** \`03-02-PLAN.md\`
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
`,
    "utf8"
  );

  const read = await blueprintPhaseSummaryRead({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });
  const index = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "3" });

  assert.equal(read.found, true);
  assert.equal(read.metadata?.linkedPlanPath, "03-02-PLAN.md");
  assert.equal(read.validation?.valid, false);
  assert.match(
    read.validation?.issues.join("\n") ?? "",
    /does not match linked plan path/i
  );
  assert.equal(index.summaries[0]?.linkedPlanPath, "03-02-PLAN.md");
  assert.deepEqual(index.completedPlans, []);
  assert.deepEqual(index.pendingPlans, ["01"]);
});

test("phase summary reads reject summaries whose H1 appears after body text", async (t) => {
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

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"),
    prefacedSummary,
    "utf8"
  );
  const read = await blueprintPhaseSummaryRead({ cwd: repoPath, phase: "3", planId: "01" });

  assert.equal(read.validation?.valid, false);
  assert.match(read.validation?.issues.join("\n") ?? "", /must start with a '# \.\.\. - Summary' heading/i);
});

test("phase summary reads reject summaries whose Plan marker does not match the linked plan path", async (t) => {
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

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"),
    mismatchedPlanSummary,
    "utf8"
  );
  const read = await blueprintPhaseSummaryRead({ cwd: repoPath, phase: "3", planId: "01" });

  assert.equal(read.validation?.valid, false);
  assert.match(read.validation?.issues.join("\n") ?? "", /does not match linked plan path/i);
});

test("phase summary reads reject raw markdown that contradicts lifecycle truth table", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"),
    validSummaryContent("01").replace(
      "**Readiness:** ready-for-validation",
      "**Readiness:** blocked"
    ),
    "utf8"
  );

  const read = await blueprintPhaseSummaryRead({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });
  const index = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "3" });

  assert.equal(read.validation?.valid, false);
  assert.match(
    read.validation?.issues.join("\n") ?? "",
    /status COMPLETED requires \*\*Readiness:\*\* ready-for-validation/i
  );
  assert.deepEqual(index.completedPlans, []);
  assert.deepEqual(index.pendingPlans, ["01"]);
});

test("partial and blocked summaries are valid evidence but do not close execution debt", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    executionPlanContent("02", 1),
    "utf8"
  );

  const partial = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: validSummaryModel("01", "PARTIAL")
  });
  const blocked = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    model: validSummaryModel("02", "BLOCKED")
  });
  const index = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "3" });
  const readPartial = await blueprintPhaseSummaryRead({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });

  assert.equal(partial.status, "created");
  assert.equal(blocked.status, "created");
  assert.equal(readPartial.validation?.valid, true);
  assert.equal(readPartial.metadata?.status, "PARTIAL");
  assert.deepEqual(index.completedPlans, []);
  assert.deepEqual(index.pendingPlans, ["01", "02"]);
  assert.match(index.warnings.join("\n"), /status is PARTIAL, so it remains pending execution debt/);
  assert.match(index.warnings.join("\n"), /status is BLOCKED, so it remains pending execution debt/);
});

test("completed summaries linked to stale plans do not close execution debt", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    executionPlanContent("02", 1).replace("depends_on: []", "depends_on:\n  - \"09\""),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"),
    validSummaryContent("02"),
    "utf8"
  );

  const index = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "3" });

  assert.deepEqual(index.completedPlans, []);
  assert.deepEqual(index.pendingPlans, ["01", "02"]);
  assert.match(
    index.warnings.join("\n"),
    /03-02-SUMMARY\.md: linked plan .*03-02-PLAN\.md is missing dependency plan artifacts/i
  );
  await assert.rejects(
    blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "3",
      artifact: "verification",
      content: validVerificationContent("03-02-SUMMARY.md"),
      overwrite: true
    }),
    /valid execution summaries/i
  );
});

test("phase summary schema rejects invalid summary statuses", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const rejected = await blueprintPhaseSummaryValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: validSummaryModel("01", "COMPLETED", { status: "DONE" })
  });

  assert.equal(rejected.status, "invalid");
  assert.match(
    rejected.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must be equal to one of the allowed values/i
  );
});

test("phase summary writes reject execution evidence for invalid saved plans", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    executionPlanContent("02", 1).replace("depends_on: []", "depends_on:\n  - not-a-plan"),
    "utf8"
  );

  const rejected = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    model: validSummaryModel("02")
  });

  assert.equal(rejected.status, "invalid");
  assert.equal(rejected.written, false);
  assert.match(rejected.issues.join("\n"), /03-02-PLAN\.md/);
  assert.match(rejected.issues.join("\n"), /invalid depends_on reference/i);
});

test("phase summary writes reject execution evidence when linked dependency plans are missing", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    executionPlanContent("02", 1).replace("depends_on: []", "depends_on:\n  - \"09\""),
    "utf8"
  );

  const rejected = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "02",
    model: validSummaryModel("02")
  });
  const summaryRead = await blueprintPhaseSummaryRead({
    cwd: repoPath,
    phase: "3",
    planId: "02"
  });

  assert.equal(rejected.status, "invalid");
  assert.equal(rejected.written, false);
  assert.match(rejected.issues.join("\n"), /missing dependency plan artifacts/i);
  assert.match(rejected.issues.join("\n"), /03-09-PLAN\.md/);
  assert.equal(summaryRead.found, false);
});

test("phase summary model validation rejects untouched scaffold prose in summary fields", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const rejected = await blueprintPhaseSummaryValidateModel({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: validSummaryModel("01", "COMPLETED", {
      changesMade: ["Explicit code, config, or artifact changes completed for this plan."],
      targetedVerification: [
        {
          check: "tests/phase-planning-tools.test.ts exits 0",
          command: "npm test -- tests/phase-planning-tools.test.ts",
          result: "pass",
          evidence: "Command, test, or evidence that supports the reported outcome.",
          notes: "Replace with concrete evidence."
        }
      ],
      evidence: [
        {
          kind: "artifact",
          source: ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md",
          summary: "or other saved repo evidence if helpful."
        }
      ]
    })
  });

  assert.equal(rejected.status, "invalid");
  assert.match(
    rejected.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /placeholder language|or other saved repo evidence if helpful|Replace with concrete evidence/i
  );
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

test("phase execution targets select the earliest runnable wave, expose overlap summaries, and block later gap-only work behind lower-wave debt", async (t) => {
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
    executionPlanContent("03", 2, true).replace(
      "  - src/mcp/tools/phase.ts",
      "  - tests/execute-phase-summary-tools.test.ts"
    ),
    "utf8"
  );
  await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: validSummaryModel("01")
  });
  await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "03",
    model: validSummaryModel("03", "PARTIAL")
  });

  const defaultTargets = await blueprintPhaseExecutionTargets({
    cwd: repoPath,
    phase: "3"
  });
  const gapsOnlyTargets = await blueprintPhaseExecutionTargets({
    cwd: repoPath,
    phase: "3",
    gapsOnly: true
  });
  const waveTwoTargets = await blueprintPhaseExecutionTargets({
    cwd: repoPath,
    phase: "3",
    wave: 2
  });

  assert.deepEqual(defaultTargets.pendingPlanIds, ["02", "03"]);
  assert.deepEqual(defaultTargets.candidatePlanIds, ["02", "03"]);
  assert.deepEqual(defaultTargets.selectedPlanIds, ["02"]);
  assert.equal(defaultTargets.selectedWave, 1);
  assert.deepEqual(defaultTargets.overlapPlanIds, ["01", "03"]);
  assert.deepEqual(defaultTargets.overwriteCandidatePlanIds, ["03"]);
  assert.equal(defaultTargets.blockers.executionBlocked, false);
  assert.equal(defaultTargets.conflicts?.groups.length, 1);
  assert.deepEqual(defaultTargets.conflicts?.groups[0]?.planIds, ["01", "02", "03"]);
  assert.match(defaultTargets.conflicts?.warnings.join("\n") ?? "", /src\/mcp\/tools\/phase\.ts/);
  assert.deepEqual(
    defaultTargets.existingSummaries.map((summary) => summary.planId),
    ["01", "03"]
  );
  assert.equal(
    defaultTargets.existingSummaries.find((summary) => summary.planId === "03")?.status,
    "PARTIAL"
  );
  assert.equal(
    defaultTargets.existingSummaries.find((summary) => summary.planId === "03")?.overwriteCandidate,
    true
  );

  assert.deepEqual(gapsOnlyTargets.candidatePlanIds, ["03"]);
  assert.deepEqual(gapsOnlyTargets.selectedPlanIds, ["03"]);
  assert.deepEqual(
    gapsOnlyTargets.lowerWavePendingPlans.map((plan) => plan.planId),
    ["02"]
  );
  assert.equal(gapsOnlyTargets.blockers.executionBlocked, true);
  assert.match(gapsOnlyTargets.blockers.reasons.join("\n"), /Lower-wave pending plans still block wave 2/i);

  assert.deepEqual(waveTwoTargets.candidatePlanIds, ["03"]);
  assert.deepEqual(waveTwoTargets.selectedPlanIds, ["03"]);
  assert.equal(waveTwoTargets.blockers.executionBlocked, true);
  assert.match(waveTwoTargets.blockers.reasons.join("\n"), /Lower-wave pending plans still block wave 2/i);
});

test("phase execution targets surface stale selected plans and plan-index warnings as blockers", async (t) => {
  const repoPath = await createExecutionRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    executionPlanContent("02", 1).replace("depends_on: []", "depends_on:\n  - \"09\""),
    "utf8"
  );

  const targets = await blueprintPhaseExecutionTargets({
    cwd: repoPath,
    phase: "3"
  });

  assert.deepEqual(targets.selectedPlanIds, ["01", "02"]);
  assert.equal(targets.blockers.executionBlocked, true);
  assert.deepEqual(targets.blockers.stalePlanIds, ["02"]);
  assert.deepEqual(
    targets.blockers.missingPlanPaths,
    [".blueprint/phases/03-phase-discovery/03-09-PLAN.md"]
  );
  assert.match(targets.blockers.reasons.join("\n"), /Selected plans are stale/i);
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
    model: validSummaryModel("01")
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
