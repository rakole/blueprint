import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintArtifactList,
  blueprintArtifactReportAuthoringContext,
  blueprintArtifactReportValidateModel,
  blueprintArtifactReportWrite
} from "../src/mcp/tools/artifacts.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  blueprintPhasePlanIndex,
  blueprintPhasePlanRead,
  blueprintPhasePlanWrite,
  blueprintPhaseSummaryIndex,
  blueprintPhaseSummaryRead,
  blueprintPhaseSummaryWrite,
  blueprintPhaseValidationRead,
  blueprintPhaseValidationWrite
} from "../src/mcp/tools/phase.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const noExternalServicesSection = `## External Service Prerequisites

| Service | Category | Purpose | User Setup / Startup | Readiness Check | Can Agent Proceed Without It |
|---------|----------|---------|----------------------|-----------------|------------------------------|
| none | none | No external services are required for this plan. | No user setup required. | Repo-local execution only. | yes |`;

async function createLifecyclePilotRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-lifecycle-pilot-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-lifecycle-pilot");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Lifecycle Pilot Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Lifecycle Pilot** - Prove lifecycle pilot coherence

## Phase Details

### Phase 3: Lifecycle Pilot
**Goal**: Prove lifecycle pilot coherence.
**Requirements**: LIFE-01
**Status**: planned
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-plan-phase
- Next action: Run /blu-plan-phase 3
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
    path.join(phaseDir, "03-CONTEXT.md"),
    `# Phase 03: Lifecycle Pilot - Context

## Discovery Grounding

- Project brief: Blueprint keeps lifecycle persistence on MCP tools.
- Requirements grounding: LIFE-01 must stay summary-backed across lifecycle handoffs.
- Workflow posture: Long-running lifecycle work should keep routing aligned to saved artifacts.

## Implementation Decisions

- Use saved plans, summaries, verification, UAT, and report artifacts as the lifecycle evidence chain.

## Specific Ideas

- Add one focused integration test cluster that follows the shipped lifecycle substrate.

## Existing Code Insights

- The plan, summary, validation, and report tools already expose the lifecycle persistence contract.

## Open Questions

- none

## Deferred Ideas

- none

## Canonical References

- docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine.md
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "03-RESEARCH.md"),
    validResearchContent(),
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "03-UI-SPEC.md"),
    `# Phase 03: Lifecycle Pilot - UI Spec

## Outcome Mode

- Explicit skip rationale

## Rationale

- No frontend surface changes are in scope for this lifecycle pilot.

## User Experience Goals

- No user-facing UI changes are in scope for this lifecycle pilot.
`,
    "utf8"
  );

  return repoPath;
}

function validResearchContent(): string {
  return `# Phase 03: Lifecycle Pilot - Research

**Researched:** 2026-04-11
**Domain:** lifecycle pilot integration coverage
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | Keep plan, execute, validate, verify, and add-tests grounded in saved artifacts. | Use MCP-owned plan, summary, validation, and report tooling. |

## Summary

- The lifecycle pilot needs first-class artifact handoffs across the shipped phase tools.

## Locked Decisions From Context

- Lifecycle routing must preserve implemented-only exposure and MCP-owned persistence.

## User Constraints

- Keep writes inside .blueprint/ plus the selected repo test file.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Installation And Setup

- Run lifecycle pilot fixtures after seeding context, research, and UI spec under .blueprint/phases/.

## Alternatives Considered

- Command-level mocks were rejected because they weaken the saved-artifact contract.

## Architecture Patterns

- Commands stay thin; MCP tools own persistence.

## Don't Hand-Roll

- Reuse existing phase resolution helpers and state sync flows.

## Anti-Patterns

- Letting lifecycle routing normalize away missing or weak saved evidence.

## State Of The Art

- Lifecycle commands consume saved discovery, execution, and validation artifacts through MCP-backed readiness checks.

## Common Pitfalls

- Accepting scaffold-only lifecycle artifacts as real outputs.

## Open Questions

- Should future lifecycle parity require explicit carry-forward of report evidence into validation notes?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Lifecycle readiness | HIGH | The fixture controls the exact saved artifacts supplied to the lifecycle tools. |

## Code Examples

\`\`\`ts
await blueprintPhaseValidationWrite({ cwd: repoPath, phase: "3", artifact: "verification", content });
\`\`\`

## Recommendations

- Validate every lifecycle artifact before treating the route progression as durable.

## Sources

- \`src/mcp/tools/phase.ts\` - current lifecycle tool substrate.
`;
}

function validPlanContent(planId = "01"): string {
  return `---
phase: 3
plan_id: "${planId}"
title: "Lifecycle Plan ${planId}"
wave: 1
status: planned
objective: "Ship the lifecycle pilot integration coverage."
depends_on: []
requirements:
  - LIFE-01
files_modified:
  - tests/lifecycle-pilot-integration.test.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/lifecycle-pilot-integration.test.ts exits 0
autonomous: true
---

# Phase 03: Lifecycle Pilot - Plan ${planId}

## Goal

Ship the lifecycle pilot integration coverage.

## Scope

- Add lifecycle pilot integration coverage through the existing MCP-backed artifacts.

## Tasks

### Task 1: Add the lifecycle integration coverage

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Add focused integration coverage for the plan, summary, validation, verification, and add-tests handoff.

#### Acceptance Criteria

- src/mcp/tools/phase.ts contains blueprintPhasePlanWrite

${noExternalServicesSection}

## Verification

- npm test passes for the lifecycle pilot coverage.

## Must Haves

- Lifecycle persistence stays MCP-backed.

## Requirement Coverage

| Requirement | Planned Coverage | Evidence |
| --- | --- | --- |
| LIFE-01 | Exercise the saved plan to execute, validate, verify, and add-tests lifecycle. | tests/lifecycle-pilot-integration.test.ts exits 0 |

## Evidence Coverage

| Evidence | How It Will Be Produced | Owner |
| --- | --- | --- |
| Lifecycle summary, verification, UAT, and add-tests report | Persist each artifact through the MCP-backed lifecycle flow. | Blueprint lifecycle tests |

## File / Surface Coverage

| File / Surface | Expected Change | Verification |
| --- | --- | --- |
| tests/lifecycle-pilot-integration.test.ts | Integration fixture covers the lifecycle handoff. | Focused lifecycle pilot tests |

## Unknowns And Deferrals

| Unknown / Deferral | Handling | Follow-Up |
| --- | --- | --- |
| Broader command routing coverage | Keep outside the lifecycle fixture. | Cover in command contract tests. |
`;
}

function validSummaryContent(planId = "01"): string {
  return `# Phase 03: Lifecycle Pilot - Summary ${planId}

**Plan:** \`03-${planId}-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution completed and produced durable lifecycle summary evidence.

## Changes Made

- Captured the lifecycle pilot completion in the saved summary artifact.

## Verification

- The lifecycle integration test checks the saved handoff chain.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-lifecycle-pilot/03-${planId}-SUMMARY.md\`
`;
}

function validSummaryModel(planId = "01"): Record<string, unknown> {
  return {
    status: "COMPLETED",
    readiness: "ready-for-validation",
    completionState: "complete",
    outcome: [
      `Execution completed for lifecycle pilot plan ${planId} and produced durable lifecycle summary evidence.`
    ],
    changesMade: [
      "Captured the lifecycle pilot completion in the saved summary artifact."
    ],
    targetedVerification: [
      {
        check: "tests/lifecycle-pilot-integration.test.ts exits 0",
        command: "npx tsx --test tests/lifecycle-pilot-integration.test.ts",
        result: "pass",
        evidence: "The lifecycle integration test checks the saved handoff chain.",
        notes: "The selected acceptance criterion passed."
      }
    ],
    dependencyPlans: [],
    manualOrDeferredWork: [
      {
        item: "none",
        reason: "none",
        followUp: "none",
        status: "NONE"
      }
    ],
    gapRoutes: [
      {
        gap: "none",
        evidence: "none",
        repair: "none",
        status: "NONE"
      }
    ],
    followUps: ["none"],
    evidence: [
      {
        kind: "test",
        source: "tests/lifecycle-pilot-integration.test.ts",
        summary: "Lifecycle integration coverage exercised the saved handoff chain."
      }
    ],
    nextSafeAction: "/blu-validate-phase 3"
  };
}

function validVerificationContent(options: {
  summaryFile?: string;
  nextSafeAction?: string;
  extraCoverageNote?: string;
} = {}): string {
  const summaryFile = options.summaryFile ?? "03-01-SUMMARY.md";
  const nextSafeAction = options.nextSafeAction ?? "Continue with `/blu-verify-work 3`.";
  const extraCoverageNote = options.extraCoverageNote
    ? `\n- ${options.extraCoverageNote}`
    : "";

  return `# Phase 03: Lifecycle Pilot - Verification

**Coverage:** Reviewed \`${summaryFile}\` for the completed lifecycle pilot execution.
**Gate State:** PASS
**Sign-off:** verified by the Blueprint verifier

## Validation Summary

- The lifecycle pilot is ready for UAT.${extraCoverageNote}

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| LIFE-01 | Keep plan, execute, validate, verify, and add-tests grounded in saved artifacts. | .blueprint/phases/03-lifecycle-pilot/${summaryFile} | PASS | The lifecycle handoff stays anchored to the saved summary. |

## Evidence Reviewed

- .blueprint/phases/03-lifecycle-pilot/${summaryFile}

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: tsx --test tests/lifecycle-pilot-integration.test.ts
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: verified
- Readiness: ready for UAT

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| none | none | none | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- ${nextSafeAction}
`;
}

function validUatContent(summaryFile = "03-01-SUMMARY.md"): string {
  return `# Phase 03: Lifecycle Pilot - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- The lifecycle pilot passed against \`.blueprint/phases/03-lifecycle-pilot/${summaryFile}\` with ready verification evidence.

## Session State

- Resume source: \`.blueprint/phases/03-lifecycle-pilot/${summaryFile}\`
- Current session step: Close the initial UAT pass.
- Continuity notes: Keep the saved lifecycle evidence stable if the session resumes.

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the saved lifecycle evidence stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Lifecycle pilot UAT smoke | Keep the saved lifecycle evidence stable. | .blueprint/phases/03-lifecycle-pilot/${summaryFile} | pass | none |

## Result Summary

- Total: 1
- Passed: 1
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- Did the saved lifecycle evidence match the observed behavior?

## Observed Behavior

- The validated behavior matched \`.blueprint/phases/03-lifecycle-pilot/${summaryFile}\`.

## Unresolved Gaps

- none

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
| none | none | none | none | none | none |

## Follow-Up Fixes

- none

## Next Safe Action

- Return to \`/blu-progress\` for the next safe implemented action.
`;
}

function validAddTestsReportContent(): string {
  return `# Add Tests Report - Phase 3

## Coverage Goal

- Add focused lifecycle pilot integration coverage for the saved plan -> execute -> validate -> verify -> add-tests flow.

## Evidence Used

- .blueprint/phases/03-lifecycle-pilot/03-01-SUMMARY.md
- .blueprint/phases/03-lifecycle-pilot/03-VERIFICATION.md
- .blueprint/phases/03-lifecycle-pilot/03-UAT.md

## Tests Added Or Updated

- tests/lifecycle-pilot-integration.test.ts

## Remaining Gaps

- none

## Next Safe Action

- Run \`/blu-audit-milestone v1\` after reviewing the saved add-tests report.
`;
}

async function validAddTestsReportModel(repoPath: string): Promise<Record<string, unknown>> {
  const context = await blueprintArtifactReportAuthoringContext({
    cwd: repoPath,
    reportName: "add-tests-3"
  });
  const summaryEvidence = Object.fromEntries(
    context.completedSummaries.map((summary) => [
      summary.path,
      {
        planId: summary.planId,
        linkedPlanPath: summary.linkedPlanPath,
        summaryStatus: "COMPLETED",
        targetedVerification: summary.targetedVerification,
        coverageNote: "Lifecycle pilot add-tests coverage is grounded in this completed summary."
      }
    ])
  );

  return {
    status: "COMPLETED",
    readiness: "ready-for-routing",
    completionState: "complete",
    coverageGoal: [
      "Add focused lifecycle pilot integration coverage for the saved add-tests flow."
    ],
    evidenceUsed: [
      ...context.completedSummaries.map((summary) => summary.path),
      ...context.validationEvidencePaths
    ],
    summaryEvidence,
    pendingPlans: [],
    dependencyPlans: [],
    classification: [
      {
        target: "tests/lifecycle-pilot-integration.test.ts",
        category: "Integration / API",
        reason: "Existing integration coverage exercises Blueprint lifecycle persistence."
      }
    ],
    testPlan: [
      {
        target: "tests/lifecycle-pilot-integration.test.ts",
        scenario: "Verify add-tests report persistence after lifecycle completion.",
        expectedAssertion: "The report appears in artifact inventory without changing completion.",
        command: "npm test -- tests/lifecycle-pilot-integration.test.ts"
      }
    ],
    testsAddedOrUpdated: [
      {
        path: "tests/lifecycle-pilot-integration.test.ts",
        summary: "Recorded add-tests report-backed lifecycle completion coverage."
      }
    ],
    targetedCommands: [
      {
        command: "npm test -- tests/lifecycle-pilot-integration.test.ts",
        result: "pass",
        evidence: "The lifecycle pilot integration test exits 0."
      }
    ],
    resultCounts: {
      generated: 1,
      passing: 1,
      failing: 0,
      blocked: 0
    },
    bugsOrBlockers: [
      {
        item: "none",
        evidence: "none",
        status: "NONE"
      }
    ],
    manualOrDeferredWork: [
      {
        item: "none",
        reason: "none",
        followUp: "none",
        status: "NONE"
      }
    ],
    remainingGaps: [
      {
        gap: "none",
        evidence: "none",
        repair: "none",
        status: "NONE"
      }
    ],
    followUpFixes: ["none"],
    verificationWrite: {
      status: "written",
      evidence: ".blueprint/phases/03-lifecycle-pilot/03-VERIFICATION.md updated through MCP."
    },
    nextSafeAction: context.allowedNextActions[0] ?? "/blu-progress"
  };
}

async function completeLifecycle(repoPath: string) {
  const plan = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: validPlanContent("01")
  });
  const summary = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: validSummaryModel("01")
  });
  const verification = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: validVerificationContent()
  });
  const uat = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: validUatContent()
  });

  return { plan, summary, verification, uat };
}

test("lifecycle pilot integration tools stay registered and route the phase through the saved lifecycle artifacts", async (t) => {
  for (const toolName of [
    "blueprint_phase_plan_write",
    "blueprint_phase_summary_write",
    "blueprint_phase_validation_write",
    "blueprint_artifact_report_write"
  ]) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
  }

  const repoPath = await createLifecyclePilotRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const initialStatus = await blueprintProjectStatus({ cwd: repoPath });
  const planWrite = await blueprintPhasePlanWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    content: validPlanContent("01")
  });
  const planRead = await blueprintPhasePlanRead({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });
  const planIndex = await blueprintPhasePlanIndex({ cwd: repoPath, phase: "3" });
  const afterPlanStatus = await blueprintProjectStatus({ cwd: repoPath });
  const summaryWrite = await blueprintPhaseSummaryWrite({
    cwd: repoPath,
    phase: "3",
    planId: "01",
    model: validSummaryModel("01")
  });
  const summaryRead = await blueprintPhaseSummaryRead({
    cwd: repoPath,
    phase: "3",
    planId: "01"
  });
  const summaryIndex = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "3" });
  const afterSummaryStatus = await blueprintProjectStatus({ cwd: repoPath });
  const verificationWrite = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: validVerificationContent()
  });
  const verificationRead = await blueprintPhaseValidationRead({
    cwd: repoPath,
    phase: "3",
    artifact: "verification"
  });
  const afterVerificationStatus = await blueprintProjectStatus({ cwd: repoPath });
  const uatWrite = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: validUatContent()
  });
  const uatRead = await blueprintPhaseValidationRead({
    cwd: repoPath,
    phase: "3",
    artifact: "uat"
  });
  const finalStatus = await blueprintProjectStatus({ cwd: repoPath });
  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.match(initialStatus.nextAction, /\/blu-plan-phase 3/);
  assert.equal(planWrite.status, "created");
  assert.equal(planWrite.validation.valid, true);
  assert.equal(planRead.found, true);
  assert.equal(planRead.validation?.valid, true);
  assert.equal(planRead.metadata?.title, "Lifecycle Plan 01");
  assert.deepEqual(planIndex.plans.map((plan) => plan.planId), ["01"]);
  assert.match(afterPlanStatus.nextAction, /\/blu-execute-phase 3/);

  assert.equal(summaryWrite.status, "created");
  assert.equal(summaryRead.found, true);
  assert.equal(summaryRead.validation?.valid, true);
  assert.equal(
    summaryRead.metadata?.linkedPlanPath,
    ".blueprint/phases/03-lifecycle-pilot/03-01-PLAN.md"
  );
  assert.deepEqual(summaryIndex.completedPlans, ["01"]);
  assert.deepEqual(summaryIndex.pendingPlans, []);
  assert.match(afterSummaryStatus.nextAction, /\/blu-validate-phase 3/);

  assert.equal(verificationWrite.status, "created");
  assert.deepEqual(verificationWrite.summaryPaths, [
    ".blueprint/phases/03-lifecycle-pilot/03-01-SUMMARY.md"
  ]);
  assert.equal(verificationRead.found, true);
  assert.deepEqual(verificationRead.summaryPaths, [
    ".blueprint/phases/03-lifecycle-pilot/03-01-SUMMARY.md"
  ]);
  assert.equal(verificationRead.validation?.valid, true);
  assert.equal(verificationRead.verificationReadyForUat, true);
  assert.equal(verificationRead.complete, true);
  assert.match(afterVerificationStatus.nextAction, /\/blu-verify-work 3/);

  assert.equal(uatWrite.status, "created");
  assert.deepEqual(uatWrite.summaryPaths, [
    ".blueprint/phases/03-lifecycle-pilot/03-01-SUMMARY.md"
  ]);
  assert.equal(uatRead.found, true);
  assert.deepEqual(uatRead.summaryPaths, [
    ".blueprint/phases/03-lifecycle-pilot/03-01-SUMMARY.md"
  ]);
  assert.equal(uatRead.validation?.valid, true);
  assert.equal(uatRead.uatStatus, "PASS");
  assert.equal(uatRead.resumeState, "NEW");
  assert.equal(uatRead.checkpoint, "none");
  assert.equal(uatRead.complete, true);
  assert.match(finalStatus.nextAction, /\/blu-audit-milestone v1/);
  assert.match(roadmapBody, /- \[x\] \*\*Phase 3: Lifecycle Pilot\*\* - Prove lifecycle pilot coherence/);
  assert.match(roadmapBody, /### Phase 3: Lifecycle Pilot[\s\S]*\*\*Status\*\*: completed/);
});

test("add-tests follow-up stays report-backed and preserves lifecycle completion after verification refresh", async (t) => {
  const repoPath = await createLifecyclePilotRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await completeLifecycle(repoPath);

  const reportWrite = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "add-tests-3",
    model: await validAddTestsReportModel(repoPath)
  });
  const verificationUpdate = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: validVerificationContent({
      nextSafeAction: "Continue with `/blu-verify-work 3`.",
      extraCoverageNote:
        "The add-tests follow-up kept the refreshed verification note anchored to the same saved summary."
    }),
    overwrite: true
  });
  const artifactList = await blueprintArtifactList({ cwd: repoPath });
  const projectStatus = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });
  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(reportWrite.status, "created");
  assert.equal(reportWrite.path, ".blueprint/reports/add-tests-3.md");
  assert.equal(verificationUpdate.status, "updated");
  assert.deepEqual(verificationUpdate.summaryPaths, [
    ".blueprint/phases/03-lifecycle-pilot/03-01-SUMMARY.md"
  ]);
  assert.ok(artifactList.reports.includes(".blueprint/reports/add-tests-3.md"));
  assert.ok(
    artifactList.artifacts.phases.includes(
      ".blueprint/phases/03-lifecycle-pilot/03-VERIFICATION.md"
    )
  );
  assert.match(projectStatus.nextAction, /\/blu-audit-milestone v1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-audit-milestone v1/);
  assert.match(roadmapBody, /- \[x\] \*\*Phase 3: Lifecycle Pilot\*\* - Prove lifecycle pilot coherence/);
  assert.match(roadmapBody, /### Phase 3: Lifecycle Pilot[\s\S]*\*\*Status\*\*: completed/);
});

test("artifact report writes report blocking input issues and contract-gate model writes", async (t) => {
  const repoPath = await createLifecyclePilotRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const reportPath = path.join(repoPath, ".blueprint/reports/quick-run-latest.md");
  const missingInput = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "quick-run-latest"
  });
  const bothInputs = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "quick-run-latest",
    content: validAddTestsReportContent(),
    model: { taskSummary: ["Completed a focused quick run."] }
  });
  const markdownFallback = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "quick-run-latest",
    content: "# Quick Run Report\n\n## Task Summary\n\n- Completed a focused quick run.\n"
  });
  const modelOnly = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "quick-run-latest",
    model: { taskSummary: ["Completed a focused quick run."] }
  });
  const quickRunModel = {
    taskSummary: ["Completed a focused quick run."],
    changedSurfaces: [
      {
        surface: "docs/commands/quick.md",
        change: "Confirmed quick-run reporting behavior.",
        rationale: "The lifecycle pilot exercised the quick report gate."
      }
    ],
    evidenceUsed: [
      {
        source: "tests/lifecycle-pilot-integration.test.ts",
        summary: "The integration fixture exercises report-write input validation."
      }
    ],
    changesMade: ["Recorded quick-run report evidence through the model-backed writer."],
    verification: [
      {
        check: "blueprintArtifactReportWrite quick-run model",
        result: "pass",
        evidence: "The writer returned created for quick-run-latest."
      }
    ],
    followUps: ["none"],
    nextSafeAction: "/blu-progress"
  };
  const validatedQuickRun = await blueprintArtifactReportValidateModel({
    cwd: repoPath,
    reportName: "quick-run-latest",
    model: quickRunModel
  });
  const writtenQuickRun = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "quick-run-latest",
    model: quickRunModel
  });
  const nonStructuredContractModel = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "debug-latest",
    model: { problemStatement: ["Investigated a focused issue."] }
  });
  const genericReportModel = await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "custom-health-check",
    model: { summary: ["Checked custom health."] }
  });

  assert.equal(missingInput.status, "invalid");
  assert.match(missingInput.issues.join("\n"), /exactly one of content or model/i);
  assert.deepEqual(missingInput.warnings, []);
  assert.equal(bothInputs.status, "invalid");
  assert.match(bothInputs.issues.join("\n"), /exactly one of content or model/i);
  assert.deepEqual(bothInputs.warnings, []);
  assert.equal(markdownFallback.status, "invalid");
  assert.match(markdownFallback.issues.join("\n"), /model-only|Markdown content fallback/i);
  assert.equal(modelOnly.status, "invalid");
  assert.match(modelOnly.issues.join("\n"), /schema\.required|required property/i);
  assert.deepEqual(modelOnly.warnings, []);
  assert.equal(validatedQuickRun.status, "valid");
  assert.match(validatedQuickRun.renderPreview ?? "", /## Changed Surfaces/);
  assert.equal(writtenQuickRun.status, "created");
  assert.equal(nonStructuredContractModel.status, "invalid");
  assert.match(nonStructuredContractModel.issues.join("\n"), /report\.debug/i);
  assert.match(nonStructuredContractModel.issues.join("\n"), /does not expose a modelContract/i);
  assert.deepEqual(nonStructuredContractModel.warnings, []);
  assert.equal(genericReportModel.status, "invalid");
  assert.match(genericReportModel.issues.join("\n"), /known report contract/i);
  assert.deepEqual(genericReportModel.warnings, []);
  assert.equal(modelOnly.written, false);
  assert.match(await readFile(reportPath, "utf8"), /# Quick Run Report/);
});
