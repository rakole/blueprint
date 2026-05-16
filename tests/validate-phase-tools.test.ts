import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintArtifactList,
  blueprintArtifactValidate,
  validateUatArtifactContent,
  validateVerificationArtifactContent
} from "../src/mcp/tools/artifacts.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  blueprintPhaseContext,
  blueprintPhaseValidationAuthoringContext,
  blueprintPhaseValidationRender,
  blueprintPhaseValidationValidateModel,
  blueprintPhaseSummaryIndex,
  blueprintPhaseSummaryRead,
  blueprintPhaseValidationRead,
  blueprintPhaseValidationWrite
} from "../src/mcp/tools/phase.js";
import { blueprintStateLoad, blueprintStateUpdate } from "../src/mcp/tools/state.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

type PhaseValidationRenderInput = Parameters<typeof blueprintPhaseValidationRender>[0];

function validationSummaryContent(
  planId: "01" | "02" = "01",
  status: "COMPLETED" | "PARTIAL" = "COMPLETED"
): string {
  const isComplete = status === "COMPLETED";
  const readiness = isComplete ? "ready-for-validation" : "not-ready-for-validation";
  const completionState = isComplete ? "complete" : "pending";
  const nextSafeAction = isComplete ? "/blu-validate-phase 3" : "/blu-execute-phase 3";
  const verificationResult = isComplete ? "pass" : "fail";
  const manualRow = isComplete
    ? "| none | none | none | NONE |"
    : "| Validation follow-up | Verification still needs repair. | /blu-execute-phase 3 | DEFERRED |";
  const gapRow = isComplete
    ? "| none | none | none | NONE |"
    : "| Validation evidence incomplete | Targeted verification evidence is not passing. | Rerun execute-phase after repair. | OPEN |";
  const followUp = isComplete ? "none" : "Repair and rerun the targeted verification.";

  return `# Phase 03: Phase Discovery - Summary ${planId}

**Plan:** \`03-${planId}-PLAN.md\`
**Status:** ${status}
**Readiness:** ${readiness}
**Completion State:** ${completionState}
**Next Safe Action:** ${nextSafeAction}

## Outcome

- Execution ${isComplete ? "finished" : "made partial progress"} and produced durable summary evidence.

## Changes Made

- Captured the validation-plan execution in the phase summary.

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| tests/validate-phase-tools.test.ts exits 0 | npx tsx --test tests/validate-phase-tools.test.ts | ${verificationResult} | Wrote the summary artifact at .blueprint/phases/03-phase-discovery/03-${planId}-SUMMARY.md. | The selected acceptance criterion ${isComplete ? "passed" : "remains unresolved"}. |

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

async function createValidationReadyRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-validate-phase-");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Validation Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery** - Validate the completed plans

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Validate the completed plans.
**Requirements**: VAL-01
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
- Active command: /blu-execute-phase
- Next action: Run /blu-validate-phase 3
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

- Validation should remain summary-backed and phase-scoped.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    `# Phase 03: Phase Discovery - Research

**Researched:** 2026-04-11
**Domain:** validate-phase runtime
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VAL-01 | Audit completed execution evidence. | Validation should read saved summaries before writing durable verification notes. |

## Summary

- Completed summaries should become the source of truth for validation.

## Locked Decisions From Context

- Validation remains downstream of saved execution evidence, not discovery alone.

## User Constraints

- Keep writes inside .blueprint/.

## Standard Stack

- TypeScript on Node.js

## Installation And Setup

- Run validate-phase tests with saved discovery and execution artifacts present.

## Alternatives Considered

- Allowing validation to proceed without checking saved research quality was rejected.

## Architecture Patterns

- Commands stay thin; MCP tools own persistence.

## Don't Hand-Roll

- Use dedicated validation artifact writes instead of raw file edits.

## Anti-Patterns

- Treating malformed research as good enough for downstream planning and validation.

## State Of The Art

- Validation flows now rely on artifact-backed readiness checks across the lifecycle.

## Common Pitfalls

- Treating a fully executed phase as validated before a verification artifact exists.

## Open Questions

- Should validate-phase surface research repair hints more prominently in user summaries?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Validation prerequisites | HIGH | The test fixture exercises readiness against saved artifacts. |

## Code Examples

\`\`\`ts
await blueprintPhaseValidationWrite({ cwd: repoPath, phase: "3", artifact: "verification", content });
\`\`\`

## Recommendations

- Reconstruct validation from saved summaries when the verification artifact is missing.

## Sources

- \`src/mcp/tools/phase.ts\` - validation artifact persistence and readiness rules.
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
title: "Validation Plan 01"
wave: 1
status: done
objective: "Exercise validation routing."
depends_on: []
requirements:
  - VAL-01
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/validate-phase-tools.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Exercise validation routing.

## Scope

- Persist verification and UAT artifacts from completed execution evidence.

## Tasks

### Task 1: Validate the saved execution evidence

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Confirm the completed summary stays linked to the saved plan before writing validation artifacts.

#### Acceptance Criteria

- tests/validate-phase-tools.test.ts exits 0

## Verification

- Re-run the validation tool tests after writing verification and UAT artifacts.

## Must Haves

- Keep validation evidence grounded in the saved summary artifact.

## Requirement Coverage

| Requirement | Planned Coverage | Evidence |
| --- | --- | --- |
| VAL-01 | Validate completed execution evidence before writing downstream artifacts. | tests/validate-phase-tools.test.ts exits 0 |

## Evidence Coverage

| Evidence | How It Will Be Produced | Owner |
| --- | --- | --- |
| 03-01-SUMMARY.md | Use the completed summary as validation input. | Blueprint validation tests |

## File / Surface Coverage

| File / Surface | Expected Change | Verification |
| --- | --- | --- |
| src/mcp/tools/phase.ts | Validation routing consumes saved summary evidence. | Focused validation tool tests |

## Unknowns And Deferrals

| Unknown / Deferral | Handling | Follow-Up |
| --- | --- | --- |
| Additional validation plans | Keep out of this completed plan. | Cover with separate plan artifacts. |
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"),
    validationSummaryContent("01", "COMPLETED"),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    `---
phase: 3
plan_id: "02"
title: "Validation Plan 02"
wave: 1
status: planned
objective: "Exercise invalid summary indexing."
depends_on: []
requirements:
  - VAL-02
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/validate-phase-tools.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 02

## Goal

Exercise invalid summary indexing.

## Scope

- Keep incomplete execution evidence from closing validation readiness.

## Tasks

### Task 1: Preserve pending execution debt

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Leave the paired summary partial until the validation-ready flow explicitly completes it.

#### Acceptance Criteria

- tests/validate-phase-tools.test.ts exits 0

## Verification

- Re-run the validate-phase tool tests after preserving the partial summary.

## Must Haves

- Partial summaries must not close execution coverage.

## Requirement Coverage

| Requirement | Planned Coverage | Evidence |
| --- | --- | --- |
| VAL-02 | Preserve pending execution debt when the paired summary remains partial. | tests/validate-phase-tools.test.ts exits 0 |

## Evidence Coverage

| Evidence | How It Will Be Produced | Owner |
| --- | --- | --- |
| 03-02-SUMMARY.md | Keep the partial summary visible to validation readiness checks. | Blueprint validation tests |

## File / Surface Coverage

| File / Surface | Expected Change | Verification |
| --- | --- | --- |
| src/mcp/tools/phase.ts | Summary indexing keeps incomplete execution evidence open. | Focused validation tool tests |

## Unknowns And Deferrals

| Unknown / Deferral | Handling | Follow-Up |
| --- | --- | --- |
| Completion evidence | Defer until the summary is intentionally marked completed. | Resume validation after execution closes. |
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"),
    validationSummaryContent("02", "PARTIAL"),
    "utf8"
  );

  return repoPath;
}

async function markValidationPlanCompleted(repoPath: string, planId: string): Promise<void> {
  const planPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery",
    `03-${planId}-PLAN.md`
  );
  const raw = await readFile(planPath, "utf8");
  await writeFile(planPath, raw.replace("status: planned", "status: done"), "utf8");

  const summaryPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery",
    `03-${planId}-SUMMARY.md`
  );
  await writeFile(
    summaryPath,
    validationSummaryContent(planId === "02" ? "02" : "01", "COMPLETED"),
    "utf8"
  );
}

function renderVerificationArtifact(
  summaryPaths: string[],
  options: {
    gateState?: "PASS" | "PARTIAL" | "BLOCKED";
    coverageState?: string;
    manualStatus?: string;
    manualItem?: string;
    manualReason?: string;
    manualFollowUp?: string;
    gapClass?: string;
    gapScope?: string;
    gapEvidence?: string;
    gapRepair?: string;
    readiness?: "ready for UAT" | "not ready for UAT";
    signOff?: string;
    nextAction?: string;
    validationSummary?: string;
  } = {}
): string {
  const gateState = options.gateState ?? "PASS";
  const readiness = options.readiness ?? (gateState === "PASS" ? "ready for UAT" : "not ready for UAT");
  const coverageState = options.coverageState ?? (gateState === "PASS" ? "PASS" : "DEFERRED");
  const manualStatus = options.manualStatus ?? (gateState === "PASS" ? "NONE" : "DEFERRED");
  const manualItem = options.manualItem ?? "none";
  const manualReason = options.manualReason ?? "none";
  const manualFollowUp = options.manualFollowUp ?? "none";
  const gapClass = options.gapClass ?? (gateState === "PASS" ? "none" : "deferred-test");
  const signOff = options.signOff ?? (gateState === "PASS" ? "validation lead" : "pending");
  const nextAction =
    options.nextAction ??
    (gateState === "PASS" && readiness === "ready for UAT"
      ? "Continue with conversational UAT through `/blu-verify-work 3`."
      : "Repair the verification evidence through `/blu-validate-phase 3`.");
  const validationSummary =
    options.validationSummary ??
    (gateState === "PASS"
      ? "Execution evidence matches the expected phase outcome."
      : "Execution evidence still has a follow-up gap.");
  const coverageRows = summaryPaths
    .map(
      (summaryPath, index) =>
        `| VAL-0${index + 1} | Review completed execution evidence ${index + 1} | ${summaryPath} | ${coverageState} | Saved summary evidence remains authoritative. |`
    )
    .join("\n");
  const evidenceReviewed = summaryPaths.map((summaryPath) => `- ${summaryPath}`).join("\n");
  const gapScope = options.gapScope ?? (gateState === "PASS" ? "none" : "follow-up confirmation");
  const gapEvidence =
    options.gapEvidence ??
    (gateState === "PASS"
      ? "none"
      : summaryPaths[0] ?? ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md");
  const gapRepair = options.gapRepair ?? (gateState === "PASS" ? "none" : "Repair through /blu-validate-phase 3");

  return `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed ${summaryPaths.map((summaryPath) => `\`${summaryPath.split("/").pop() ?? summaryPath}\``).join(", ")} for completed execution evidence.
**Gate State:** ${gateState}
**Sign-off:** ${signOff}

## Validation Summary

- ${validationSummary}

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
${coverageRows}

## Evidence Reviewed

${evidenceReviewed}

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| ${manualItem} | ${manualReason} | ${manualFollowUp} | ${manualStatus} |

## Gate State

- Gate: ${gateState}
- Sign-off: ${signOff}
- Readiness: ${readiness}

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| ${gapClass} | ${gapScope} | ${gapEvidence} | ${gapRepair} |

## Gaps Found

- ${gateState === "PASS" ? "none" : "Follow-up confirmation still required."}

## Suggested Repairs

- ${gateState === "PASS" ? "none" : "Repair the verification evidence and rerun /blu-validate-phase 3."}

## Next Safe Action

- ${nextAction}
`;
}

function verificationRenderInput(
  summaryPaths: string[],
  overrides: Partial<Extract<PhaseValidationRenderInput, { artifact: "verification" }>> = {}
): Extract<PhaseValidationRenderInput, { artifact: "verification" }> {
  return {
    artifact: "verification",
    phase: "3",
    coverageSummary: `Reviewed ${summaryPaths.map((summaryPath) => `\`${summaryPath.split("/").pop() ?? summaryPath}\``).join(", ")} for completed execution evidence.`,
    status: "PASS",
    gateState: "PASS",
    signOff: "validation lead",
    validationSummary: ["Execution evidence matches the expected phase outcome."],
    requirementCoverage: summaryPaths.map((summaryPath, index) => ({
      requirement: `VAL-0${index + 1}`,
      taskOrCheck: `Review completed execution evidence ${index + 1}`,
      evidence: summaryPath,
      coverageState: "PASS",
      notes: "Saved summary evidence remains authoritative."
    })),
    evidenceMetadata: [
      "Harness: node:test",
      "Commands: npm test",
      "Evidence type: saved execution summary",
      "Test infrastructure status: available"
    ],
    manualOrDeferredCoverage: [
      {
        item: "none",
        whyManualOrDeferred: "none",
        followUp: "none",
        status: "NONE"
      }
    ],
    gapClassification: [
      {
        gapClass: "none",
        scope: "none",
        evidence: "none",
        repair: "none"
      }
    ],
    gapsFound: ["none"],
    suggestedRepairs: ["none"],
    nextSafeAction: "/blu-verify-work 3",
    ...overrides
  };
}

function uatRenderInput(
  summaryPath: string,
  overrides: Partial<Extract<PhaseValidationRenderInput, { artifact: "uat" }>> = {}
): Extract<PhaseValidationRenderInput, { artifact: "uat" }> {
  const verificationPath = ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md";

  return {
    artifact: "uat",
    phase: "3",
    status: "PASS",
    resumeState: "NEW",
    checkpoint: "none",
    uatSummary: [`User acceptance run passed for ${summaryPath} with ready verification evidence.`],
    sessionState: [`Resume source: ${summaryPath}`, "Current session step: testing complete", "Continuity notes: none"],
    currentTest: {
      number: "testing complete",
      name: "none",
      expected: "Saved execution behavior remains user-acceptable.",
      awaiting: "none"
    },
    testMatrix: [
      {
        number: "1",
        test: "Saved execution behavior",
        expectedBehavior: "Behavior described by the saved summary and ready verification evidence is acceptable.",
        evidence: summaryPath,
        result: "pass",
        notes: "User acceptance evidence confirmed."
      },
      {
        number: "2",
        test: "Ready verification provenance",
        expectedBehavior: "Behavior described by the ready verification artifact is acceptable.",
        evidence: verificationPath,
        result: "pass",
        notes: "Ready verification evidence confirmed."
      }
    ],
    resultSummary: {
      total: 2,
      passed: 2,
      issues: 0,
      pending: 0,
      skipped: 0,
      blocked: 0
    },
    questionsAsked: ["Did the delivered behavior match the saved execution summary?"],
    observedBehavior: [`Observed behavior matched ${summaryPath} and the ready verification evidence.`],
    unresolvedGaps: ["none"],
    structuredGaps: [
      {
        test: "none",
        truth: "none",
        status: "none",
        severity: "none",
        reason: "none",
        followUp: "none"
      }
    ],
    followUpFixes: ["none"],
    nextSafeAction: "/blu-progress",
    ...overrides
  };
}

test("validate-phase tools are registered in the Blueprint server", () => {
  for (const toolName of [
    "blueprint_phase_validation_read",
    "blueprint_phase_validation_authoring_context",
    "blueprint_phase_validation_render",
    "blueprint_phase_validation_validate_model",
    "blueprint_phase_validation_write"
  ]) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
  }
});

test("validation authoring context and render produce write-ready VERIFICATION content", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const context = await blueprintPhaseValidationAuthoringContext({
    cwd: repoPath,
    phase: "3",
    artifact: "verification"
  });
  const rendered = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...verificationRenderInput([summaryPath])
  });
  const written = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: rendered.content
  });

  assert.equal(context.readyForDraft, true);
  assert.equal(context.status, "ready");
  assert.deepEqual(context.summaryPaths, [summaryPath]);
  assert.equal(context.contract.id, "phase.verification");
  assert.equal(
    context.schemaPath,
    "src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json"
  );
  assert.match(JSON.stringify(context.taskSchema), /03-01-SUMMARY\.md/);
  assert.match(JSON.stringify(context.taskSchema), /x-blueprint-runtimeContext/);
  assert.deepEqual(context.allowedValues.verification.coverageStates, [
    "PASS",
    "COVERED",
    "covered",
    "MANUAL",
    "DEFERRED",
    "BLOCKED"
  ]);
  assert.equal(rendered.readyToWrite, true, JSON.stringify(rendered, null, 2));
  assert.equal(rendered.validation.valid, true);
  assert.deepEqual(rendered.summaryPaths, [summaryPath]);
  assert.deepEqual(rendered.referencedSummaryPaths, [summaryPath]);
  assert.doesNotMatch(rendered.content, /PASS\|PARTIAL\|BLOCKED|<Phase Name>|03\.1-YY-SUMMARY/);
  assert.equal(written.status, "created", JSON.stringify(written, null, 2));
});

test("verification model authoring blocks when completed summary context is missing", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const summaryAbsolutePath = path.join(repoPath, summaryPath);
  const summaryContent = await readFile(summaryAbsolutePath, "utf8");
  await writeFile(
    summaryAbsolutePath,
    summaryContent.replace("**Status:** COMPLETED", "**Status:** PARTIAL"),
    "utf8"
  );

  const context = await blueprintPhaseValidationAuthoringContext({
    cwd: repoPath,
    phase: "3",
    artifact: "verification"
  });
  const uatContext = await blueprintPhaseValidationAuthoringContext({
    cwd: repoPath,
    phase: "3",
    artifact: "uat"
  });
  const { artifact: _artifact, phase: _phase, ...emptySummaryModel } = verificationRenderInput(
    [],
    {
      evidenceReviewedSummaryPaths: [],
      requirementCoverage: [
        {
          requirement: "VAL-01",
          taskOrCheck: "Review completed execution evidence",
          evidence: summaryPath,
          coverageState: "PASS",
          notes: "Saved summary evidence remains authoritative."
        }
      ],
      gapClassification: [
        {
          gapClass: "none",
          scope: "none",
          evidence: "none",
          repair: "none"
        }
      ]
    }
  );
  const validatedEmpty = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: emptySummaryModel
  });
  const validatedInventedSummary = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...emptySummaryModel,
      evidenceReviewedSummaryPaths: [summaryPath]
    }
  });
  const { artifact: _uatArtifact, phase: _uatPhase, ...inventedUatModel } =
    uatRenderInput(summaryPath);
  const uatValidatedInventedSummary = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: inventedUatModel
  });
  const writeAttempt = blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: emptySummaryModel,
    authoringMode: "model-only"
  });

  assert.equal(context.status, "invalid");
  assert.equal(context.readyForDraft, false);
  assert.match(context.prerequisiteBlockers.join("\n"), /valid completed execution summaries/i);
  assert.match(JSON.stringify(context.taskSchema), /"evidenceReviewedSummaryPaths".*"maxItems":0/s);
  assert.equal(uatContext.status, "invalid");
  assert.equal(uatContext.readyForDraft, false);
  assert.match(uatContext.prerequisiteBlockers.join("\n"), /valid completed execution summaries/i);
  assert.match(JSON.stringify(uatContext.taskSchema), /"testMatrix".*"maxItems":0/s);
  assert.equal(validatedEmpty.status, "invalid");
  assert.deepEqual(validatedEmpty.warnings, []);
  assert.match(
    validatedEmpty.diagnostics.map((diagnostic) => diagnostic.code).join("\n"),
    /scope\.prerequisite_blocker/
  );
  assert.equal(validatedInventedSummary.status, "invalid");
  assert.match(
    validatedInventedSummary.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /more than 0 items|must NOT have more than 0 items/i
  );
  assert.equal(uatValidatedInventedSummary.status, "invalid");
  assert.match(
    uatValidatedInventedSummary.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /more than 0 items|must NOT have more than 0 items/i
  );
  await assert.rejects(writeAttempt, /valid execution summaries/);
});

test("validation write accepts a structured VERIFICATION model and rejects invalid model usage", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const { artifact: _artifact, phase: _phase, ...model } = verificationRenderInput(
    [summaryPath],
    {
      evidenceReviewedSummaryPaths: [summaryPath]
    }
  );
  const validated = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model
  });
  const written = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model,
    authoringMode: "model-only"
  });
  const savedContent = await readFile(path.join(repoPath, written.path), "utf8");
  const modelOnlyMarkdownFallback = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: savedContent,
    authoringMode: "model-only",
    overwrite: true
  });

  assert.equal(validated.status, "valid", JSON.stringify(validated.diagnostics, null, 2));
  assert.equal(validated.schemaPath, "src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json");
  assert.match(validated.renderPreview ?? "", /# Phase 03: Phase Discovery - Verification/);
  assert.equal(written.status, "created", JSON.stringify(written, null, 2));
  assert.match(savedContent, /## Requirement \/ Task Coverage/);
  assert.match(savedContent, /## Evidence Reviewed/);
  assert.match(savedContent, /## Gap Classification/);
  assert.equal(
    savedContent.includes("03-01-SUMMARY.md"),
    true,
    "rendered model should preserve saved summary evidence"
  );
  assert.equal(modelOnlyMarkdownFallback.status, "invalid");
  assert.match(modelOnlyMarkdownFallback.issues.join("\n"), /model-only writes must supply/i);

  const bothContentAndModel = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: savedContent,
    model
  });
  const leakedExample = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      validationSummary: [
        "Completed summary 03-01 shows implementation, verification command, and saved evidence for the phase objective."
      ]
    },
    overwrite: true
  });
  const modelWithIdentity = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      phase: "4"
    },
    overwrite: true
  });
  const {
    evidenceReviewedSummaryPaths: _evidenceReviewedSummaryPaths,
    ...missingLedgerModel
  } = model;
  const modelMissingRequiredLedger = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: missingLedgerModel,
    overwrite: true
  });
  const modelWithBlankCoverageRow = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      requirementCoverage: [{}]
    },
    overwrite: true
  });
  const modelWithOutOfScopeSummary = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      evidenceReviewedSummaryPaths: [
        ".blueprint/phases/03-phase-discovery/03-99-SUMMARY.md"
      ]
    }
  });
  const modelWithNewlineInjection = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      validationSummary: ["Execution evidence matches.\nInjected heading"]
    }
  });
  const modelWithTableDelimiterInjection = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      requirementCoverage: [
        {
          requirement: "VAL-01",
          taskOrCheck: "Review | break table",
          evidence: summaryPath,
          coverageState: "PASS",
          notes: "Saved summary evidence remains authoritative."
        }
      ]
    }
  });
  const uatModelWithBlankNestedObjects = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      status: "PASS",
      resumeState: "NEW",
      checkpoint: "none",
      uatSummary: [`User acceptance passed for ${summaryPath}.`],
      sessionState: [`Resume source: ${summaryPath}`],
      currentTest: {},
      testMatrix: [{}],
      resultSummary: {},
      questionsAsked: [],
      observedBehavior: [`Observed behavior matched ${summaryPath}.`],
      unresolvedGaps: ["none"],
      structuredGaps: [
        {
          test: "none",
          truth: "none",
          status: "none",
          severity: "none",
          reason: "none",
          followUp: "none"
        }
      ],
      followUpFixes: ["none"],
      nextSafeAction: "/blu-progress"
    },
    overwrite: true
  });

  assert.equal(bothContentAndModel.status, "invalid");
  assert.match(bothContentAndModel.issues.join("\n"), /exactly one of content or model/);
  assert.equal(leakedExample.status, "invalid");
  assert.match(leakedExample.issues.join("\n"), /copied example leakage signal/);
  assert.equal(modelWithIdentity.status, "invalid");
  assert.match(modelWithIdentity.issues.join("\n"), /schema\.additionalProperties|additional properties/i);
  assert.equal(modelMissingRequiredLedger.status, "invalid");
  assert.match(
    modelMissingRequiredLedger.issues.join("\n"),
    /schema\.required|required property/i
  );
  assert.equal(modelWithBlankCoverageRow.status, "invalid");
  assert.match(
    modelWithBlankCoverageRow.issues.join("\n"),
    /model\.requirementCoverage\[0\]\.requirement/
  );
  assert.equal(modelWithOutOfScopeSummary.status, "invalid");
  assert.match(
    modelWithOutOfScopeSummary.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /allowed values|must be equal to one of the allowed values|must be equal to constant/i
  );
  assert.equal(modelWithNewlineInjection.status, "invalid");
  assert.match(
    modelWithNewlineInjection.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /pattern/i
  );
  assert.equal(modelWithTableDelimiterInjection.status, "invalid");
  assert.match(
    modelWithTableDelimiterInjection.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /pattern/i
  );
  assert.equal(uatModelWithBlankNestedObjects.status, "invalid");
  assert.match(
    uatModelWithBlankNestedObjects.issues.join("\n"),
    /currentTest\.number/
  );
});

test("validation PASS task schema rejects manual coverage and non-empty none rows", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const { artifact: _artifact, phase: _phase, ...model } = verificationRenderInput([summaryPath], {
    evidenceReviewedSummaryPaths: [summaryPath]
  });
  const baseline = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model
  });
  const manualRequirementCoverage = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      requirementCoverage: (model.requirementCoverage ?? []).map((row) => ({
        ...row,
        coverageState: "MANUAL"
      }))
    }
  });
  const nonEmptyNoneRows = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      manualOrDeferredCoverage: [
        {
          item: "manual smoke test",
          whyManualOrDeferred: "manual work remains pending",
          followUp: "rerun manually before UAT",
          status: "NONE"
        }
      ],
      gapClassification: [
        {
          gapClass: "none",
          scope: "automation gap",
          evidence: summaryPath,
          repair: "add missing automation"
        }
      ]
    }
  });

  assert.equal(baseline.status, "valid", JSON.stringify(baseline.diagnostics, null, 2));
  assert.equal(manualRequirementCoverage.status, "invalid");
  assert.match(
    manualRequirementCoverage.diagnostics.map((diagnostic) => diagnostic.path).join("\n"),
    /model\.requirementCoverage\[0\]\.coverageState/
  );
  assert.equal(nonEmptyNoneRows.status, "invalid");
  assert.match(
    nonEmptyNoneRows.diagnostics.map((diagnostic) => diagnostic.path).join("\n"),
    /model\.manualOrDeferredCoverage\[0\]\.item/
  );
  assert.match(
    nonEmptyNoneRows.diagnostics.map((diagnostic) => diagnostic.path).join("\n"),
    /model\.gapClassification\[0\]\.scope/
  );
});

test("verification PASS nextSafeAction diagnostics point directly to verify-work", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const { artifact: _artifact, phase: _phase, ...model } = verificationRenderInput([summaryPath], {
    evidenceReviewedSummaryPaths: [summaryPath],
    nextSafeAction: "/blu-progress"
  });

  const validated = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model
  });
  const routeDiagnostic = validated.diagnostics.find(
    (diagnostic) => diagnostic.path === "model.nextSafeAction"
  );

  assert.equal(validated.status, "invalid");
  assert.ok(routeDiagnostic);
  assert.match(
    routeDiagnostic?.message ?? "",
    /When gateState is PASS, model\.nextSafeAction must be \/blu-verify-work 3\./
  );
  assert.match(
    routeDiagnostic?.suggestion ?? "",
    /Set model\.nextSafeAction to \/blu-verify-work 3\./
  );
});

test("verification model preserves status, covered normalization, scalar summary, empty PASS gaps, and extended evidence", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const { artifact: _artifact, phase: _phase, ...model } = verificationRenderInput(
    [summaryPath],
    {
      evidenceReviewedSummaryPaths: [summaryPath],
      validationSummary:
        "Scalar validation summary is normalized into the rendered bullet list.",
      requirementCoverage: [
        {
          requirement: "VAL-01",
          taskOrCheck: "Review completed execution evidence",
          evidence: summaryPath,
          coverageState: "covered",
          notes: "Lowercase covered is accepted for model ergonomics."
        }
      ],
      manualOrDeferredCoverage: [],
      gapClassification: [],
      gapsFound: [],
      suggestedRepairs: [],
      sessionState: [
        `Resume source: ${summaryPath}`,
        "Current validation step: schema-first verification complete"
      ],
      checkpoint: "none",
      testMatrix: [
        {
          number: "1",
          test: "Saved summary validation",
          expectedBehavior: "Completed summary evidence supports UAT handoff.",
          evidence: summaryPath,
          result: "pass",
          notes: "Validated through the phase verification model."
        }
      ],
      resultSummary: {
        total: 1,
        passed: 1,
        issues: 0,
        pending: 0,
        skipped: 0,
        blocked: 0
      },
      observedBehavior: [
        `Observed validation evidence remained grounded in ${summaryPath}.`
      ],
      unresolvedGaps: ["none"],
      structuredGaps: [
        {
          test: "none",
          truth: "none",
          status: "none",
          severity: "none",
          reason: "none",
          followUp: "none"
        }
      ],
      followUpFixes: ["none"]
    }
  );

  const validated = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model
  });
  const {
    manualOrDeferredCoverage: _manualOrDeferredCoverage,
    gapClassification: _gapClassification,
    gapsFound: _gapsFound,
    suggestedRepairs: _suggestedRepairs,
    ...omittedNoGapLedgerModel
  } = model;
  const validatedWithOmittedNoGapLedgers = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: omittedNoGapLedgerModel
  });
  const statusMismatch = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      status: "PARTIAL"
    }
  });
  const blockedWithoutGaps = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      status: "BLOCKED",
      gateState: "BLOCKED",
      requirementCoverage: [
        {
          ...model.requirementCoverage![0]!,
          coverageState: "BLOCKED",
          notes: "Blocked evidence remains unresolved."
        }
      ],
      nextSafeAction: "/blu-audit-fix 3"
    }
  });
  const passWithOptionalGapSignal = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: {
      ...model,
      resultSummary: {
        total: 1,
        passed: 0,
        issues: 1,
        pending: 0,
        skipped: 0,
        blocked: 0
      },
      unresolvedGaps: ["Verification still has an actionable unresolved gap."],
      structuredGaps: [
        {
          test: "Saved summary validation",
          truth: "A gap remains",
          status: "failed",
          severity: "major",
          reason: "The optional gap field still reports unresolved work.",
          followUp: "Repair before UAT."
        }
      ],
      followUpFixes: ["Repair the optional gap before UAT."]
    }
  });
  const written = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model,
    authoringMode: "model-only"
  });
  const saved = await readFile(path.join(repoPath, written.path), "utf8");
  const omittedLedgerWrite = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: omittedNoGapLedgerModel,
    overwrite: true
  });
  const omittedLedgerSaved = await readFile(path.join(repoPath, omittedLedgerWrite.path), "utf8");
  const normalizedVerification = validated.normalizedModel as {
    requirementCoverage: Array<{ coverageState: string }>;
    validationSummary: string[];
    manualOrDeferredCoverage: unknown[];
    gapClassification: unknown[];
    gapsFound: string[];
    suggestedRepairs: string[];
  } | null;
  const normalizedWithOmittedNoGapLedgers = validatedWithOmittedNoGapLedgers.normalizedModel as {
    manualOrDeferredCoverage: unknown[];
    gapClassification: unknown[];
    gapsFound: string[];
    suggestedRepairs: string[];
  } | null;

  assert.equal(validated.status, "valid", JSON.stringify(validated.diagnostics, null, 2));
  assert.equal(
    validatedWithOmittedNoGapLedgers.status,
    "valid",
    JSON.stringify(validatedWithOmittedNoGapLedgers.diagnostics, null, 2)
  );
  assert.equal(
    normalizedVerification?.requirementCoverage[0]?.coverageState,
    "COVERED"
  );
  assert.deepEqual(normalizedVerification?.validationSummary, [
    "Scalar validation summary is normalized into the rendered bullet list."
  ]);
  assert.deepEqual(normalizedWithOmittedNoGapLedgers?.manualOrDeferredCoverage, []);
  assert.deepEqual(normalizedWithOmittedNoGapLedgers?.gapClassification, []);
  assert.deepEqual(normalizedWithOmittedNoGapLedgers?.gapsFound, []);
  assert.deepEqual(normalizedWithOmittedNoGapLedgers?.suggestedRepairs, []);
  assert.equal(statusMismatch.status, "invalid");
  assert.match(
    statusMismatch.diagnostics.map((diagnostic) => diagnostic.path).join("\n"),
    /model\.gateState/
  );
  assert.equal(blockedWithoutGaps.status, "invalid");
  assert.match(
    blockedWithoutGaps.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must contain at least 1 valid item|must contain at least 1 valid item\(s\)|must contain/i
  );
  assert.equal(passWithOptionalGapSignal.status, "invalid");
  assert.match(
    passWithOptionalGapSignal.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must not declare PASS while unresolved coverage, gap, or repair signals remain/
  );
  assert.equal(written.status, "created", JSON.stringify(written, null, 2));
  assert.equal(omittedLedgerWrite.status, "reused", JSON.stringify(omittedLedgerWrite, null, 2));
  assert.match(saved, /\| VAL-01 \| Review completed execution evidence \| .* \| COVERED \|/);
  assert.match(saved, /## Session State/);
  assert.match(saved, /## Validation Test Matrix/);
  assert.match(saved, /## Result Summary/);
  assert.match(saved, /## Structured Gaps/);
  assert.match(saved, /## Follow-Up Fixes/);
  assert.match(omittedLedgerSaved, /\| none \| none \| none \| NONE \|/);
  assert.match(omittedLedgerSaved, /\| none \| none \| none \| none \|/);
  assert.match(omittedLedgerSaved, /## Gaps Found\n\n- none/);
  assert.match(omittedLedgerSaved, /## Suggested Repairs\n\n- none/);
});

test("validation write accepts a structured UAT model after ready verification evidence", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const verificationPath = ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md";
  const {
    artifact: _verificationArtifact,
    phase: _verificationPhase,
    ...verificationModel
  } = verificationRenderInput([summaryPath], {
    evidenceReviewedSummaryPaths: [summaryPath]
  });
  const verification = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    model: verificationModel
  });
  const { artifact: _artifact, phase: _phase, ...model } = uatRenderInput(summaryPath, {
    uatSummary: [
      `User acceptance passed for ${summaryPath} after reviewing ready verification evidence.`
    ],
    observedBehavior: [
      `Observed behavior matched ${summaryPath} and the ready verification artifact.`
    ]
  });
  const context = await blueprintPhaseValidationAuthoringContext({
    cwd: repoPath,
    phase: "3",
    artifact: "uat"
  });
  const validated = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model
  });
  const missingReadyVerificationEvidence = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      testMatrix: model.testMatrix.filter((row) => row.evidence !== verificationPath),
      resultSummary: {
        total: 1,
        passed: 1,
        issues: 0,
        pending: 0,
        skipped: 0,
        blocked: 0
      }
    }
  });
  const explicitNoQuestions = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      questionsAsked: ["none"]
    }
  });
  const emptyQuestionsRejected = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      questionsAsked: []
    }
  });
  const partialCheckpointedWithoutFollowUpFix = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      status: "PARTIAL",
      checkpoint: "external-blocker-checkpoint",
      uatSummary: [
        `User acceptance partially completed for ${summaryPath} and ready verification ${verificationPath}; an external blocker remains.`
      ],
      sessionState: [
        `Resume source: ${summaryPath}`,
        "Current session step: checkpointed on the external blocker.",
        `Continuity notes: ready verification artifact ${verificationPath} remains the validation baseline.`
      ],
      currentTest: {
        number: "2",
        name: "External dependency acceptance check",
        expected: "The user can confirm the remaining behavior after the external dependency is unblocked.",
        awaiting: "External dependency owner response."
      },
      testMatrix: [
        model.testMatrix[0],
        {
          ...model.testMatrix[1],
          result: "blocked",
          notes: "External dependency blocks final user confirmation."
        }
      ],
      resultSummary: {
        total: 2,
        passed: 1,
        issues: 0,
        pending: 0,
        skipped: 0,
        blocked: 1
      },
      observedBehavior: [
        `Observed accepted behavior for ${summaryPath}; final confirmation against ${verificationPath} is externally blocked.`
      ],
      unresolvedGaps: ["External dependency still blocks final user acceptance confirmation."],
      structuredGaps: [
        {
          test: "2",
          truth: "External dependency still blocks final user acceptance confirmation.",
          status: "blocked",
          severity: "major",
          reason: "The blocking dependency is outside this implementation pass.",
          followUp: "Resume /blu-verify-work 3 when the dependency is available."
        }
      ],
      followUpFixes: ["none"],
      nextSafeAction: "/blu-verify-work 3"
    }
  });
  const uat = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model,
    authoringMode: "model-only"
  });
  const savedUat = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UAT.md"),
    "utf8"
  );
  const modelOnlyMarkdownFallback = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: savedUat,
    authoringMode: "model-only",
    overwrite: true
  });
  const unsupportedField = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      phase: "4"
    }
  });
  const { testMatrix: _testMatrix, ...missingRequired } = model;
  const missingRequiredField = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: missingRequired
  });
  const outOfScopeEvidence = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      testMatrix: [
        {
          ...model.testMatrix[0],
          evidence: ".blueprint/phases/03-phase-discovery/03-99-SUMMARY.md"
        }
      ]
    }
  });
  const delimiterInjection = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      testMatrix: [
        {
          ...model.testMatrix[0],
          test: "Saved execution behavior | injected column"
        }
      ]
    }
  });
  const newlineInjection = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      observedBehavior: [`Observed behavior matched ${summaryPath}.\nInjected heading`]
    }
  });
  const genericLowEffort = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      uatSummary: ["none"]
    }
  });
  const contradictoryPass = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: {
      ...model,
      testMatrix: [
        {
          ...model.testMatrix[0],
          result: "issue",
          notes: "User reported a mismatch."
        }
      ],
      resultSummary: {
        total: 1,
        passed: 0,
        issues: 1,
        pending: 0,
        skipped: 0,
        blocked: 0
      },
      unresolvedGaps: ["User reported a mismatch."],
      structuredGaps: [
        {
          test: "1",
          truth: "User reported a mismatch.",
          status: "failed",
          severity: "major",
          reason: "User-reported issue remains active.",
          followUp: "Repair before returning to /blu-progress."
        }
      ]
    }
  });

  assert.equal(verification.status, "created", JSON.stringify(verification, null, 2));
  assert.equal(context.status, "ready");
  assert.equal(
    context.schemaPath,
    "src/mcp/artifact-contracts/schemas/phase.uat.model.schema.json"
  );
  assert.match(JSON.stringify(context.taskSchema), /03-01-SUMMARY\.md/);
  assert.match(JSON.stringify(context.taskSchema), /03-VERIFICATION\.md/);
  assert.match(JSON.stringify(context.taskSchema), /x-blueprint-runtimeContext/);
  assert.equal(validated.status, "valid", JSON.stringify(validated.diagnostics, null, 2));
  assert.equal(validated.schemaPath, "src/mcp/artifact-contracts/schemas/phase.uat.model.schema.json");
  assert.match(validated.renderPreview ?? "", /# Phase 03: Phase Discovery - UAT/);
  assert.match(validated.renderPreview ?? "", /03-VERIFICATION\.md/);
  assert.equal(missingReadyVerificationEvidence.status, "invalid");
  assert.match(
    missingReadyVerificationEvidence.diagnostics.map((diagnostic) => diagnostic.code).join("\n"),
    /schema\.contains/
  );
  assert.equal(explicitNoQuestions.status, "valid", JSON.stringify(explicitNoQuestions.diagnostics, null, 2));
  assert.equal(emptyQuestionsRejected.status, "invalid");
  assert.match(
    emptyQuestionsRejected.diagnostics.map((diagnostic) => diagnostic.path).join("\n"),
    /model\.questionsAsked/
  );
  assert.equal(
    partialCheckpointedWithoutFollowUpFix.status,
    "valid",
    JSON.stringify(partialCheckpointedWithoutFollowUpFix.diagnostics, null, 2)
  );
  assert.equal(uat.status, "created", JSON.stringify(uat, null, 2));
  assert.equal(uat.written, true);
  assert.deepEqual(uat.summaryPaths, [summaryPath]);
  assert.equal(modelOnlyMarkdownFallback.status, "invalid");
  assert.match(modelOnlyMarkdownFallback.issues.join("\n"), /model-only writes must supply/i);
  assert.equal(unsupportedField.status, "invalid");
  assert.match(
    unsupportedField.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /additional properties/i
  );
  assert.equal(missingRequiredField.status, "invalid");
  assert.match(
    missingRequiredField.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /required property/i
  );
  assert.equal(outOfScopeEvidence.status, "invalid");
  assert.match(
    outOfScopeEvidence.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /allowed values|must be equal to one of the allowed values|must be equal to constant/i
  );
  assert.equal(delimiterInjection.status, "invalid");
  assert.match(
    delimiterInjection.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /pattern/i
  );
  assert.equal(newlineInjection.status, "invalid");
  assert.match(
    newlineInjection.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /pattern/i
  );
  assert.equal(genericLowEffort.status, "invalid");
  assert.match(
    genericLowEffort.diagnostics.map((diagnostic) => diagnostic.code).join("\n"),
    /content\.generic_text/
  );
  assert.equal(contradictoryPass.status, "invalid");
  assert.match(
    contradictoryPass.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
    /must be equal to constant|must be equal to one of the allowed values/i
  );
  assert.match(savedUat, /## Test Matrix/);
  assert.match(savedUat, /## Structured Gaps/);
  assert.match(savedUat, /ready verification artifact/);
});

test("validation render rejects VERIFICATION summary, placeholder, enum, gap, and route mistakes before write", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await markValidationPlanCompleted(repoPath, "02");
  const summaryPaths = [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md",
    ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"
  ];
  const missingSummary = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...verificationRenderInput(summaryPaths, {
      evidenceReviewedSummaryPaths: [summaryPaths[0]]
    })
  });
  const placeholders = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...verificationRenderInput(summaryPaths, {
      coverageSummary: "Reviewed `03.1-YY-SUMMARY.md` and any other saved phase summaries for validation evidence.",
      signOff: "verified|pending|blocked"
    })
  });
  const badEnums = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...verificationRenderInput(summaryPaths, {
      requirementCoverage: [
        {
          requirement: "VAL-01",
          taskOrCheck: "Review completed execution evidence",
          evidence: summaryPaths[0],
          coverageState: "SKIPPED",
          notes: "Bad enum."
        }
      ],
      manualOrDeferredCoverage: [
        {
          item: "manual check",
          whyManualOrDeferred: "manual",
          followUp: "later",
          status: "LATER"
        }
      ],
      gapClassification: [
        {
          gapClass: "unknown-gap",
          scope: "validation",
          evidence: summaryPaths[0],
          repair: "none"
        }
      ]
    })
  });
  const passWithGap = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...verificationRenderInput(summaryPaths, {
      requirementCoverage: [
        {
          requirement: "VAL-01",
          taskOrCheck: "Review completed execution evidence",
          evidence: summaryPaths[0],
          coverageState: "DEFERRED",
          notes: "Deferred test remains open."
        }
      ],
      gapClassification: [
        {
          gapClass: "deferred-test",
          scope: "tests",
          evidence: summaryPaths[0],
          repair: "Run /blu-add-tests 3."
        }
      ],
      gapsFound: ["Deferred test gap remains."],
      suggestedRepairs: ["Run /blu-add-tests 3."]
    })
  });
  const partialVerifyRoute = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...verificationRenderInput(summaryPaths, {
      gateState: "PARTIAL",
      requirementCoverage: [
        {
          requirement: "VAL-01",
          taskOrCheck: "Review completed execution evidence",
          evidence: summaryPaths[0],
          coverageState: "DEFERRED",
          notes: "Deferred test remains open."
        }
      ],
      manualOrDeferredCoverage: [
        {
          item: "regression test",
          whyManualOrDeferred: "test not generated",
          followUp: "/blu-add-tests 3",
          status: "DEFERRED"
        }
      ],
      gapClassification: [
        {
          gapClass: "deferred-test",
          scope: "tests",
          evidence: summaryPaths[0],
          repair: "Run /blu-add-tests 3."
        }
      ],
      gapsFound: ["Deferred test gap remains."],
      suggestedRepairs: ["Run /blu-add-tests 3."],
      nextSafeAction: "Continue with conversational UAT through `/blu-verify-work 3`."
    })
  });

  assert.equal(missingSummary.readyToWrite, false);
  assert.match(missingSummary.issues.join("\n"), /cite every saved execution summary/i);
  assert.match(missingSummary.issues.join("\n"), /03-02-SUMMARY\.md/);
  assert.equal(placeholders.readyToWrite, false);
  assert.match(placeholders.issues.join("\n"), /03\.1-YY-SUMMARY\.md/);
  assert.match(placeholders.issues.join("\n"), /verified\|pending\|blocked/);
  assert.equal(badEnums.readyToWrite, false);
  assert.match(badEnums.issues.join("\n"), /unsupported coverage state: SKIPPED/);
  assert.match(badEnums.issues.join("\n"), /unsupported status: LATER/);
  assert.match(badEnums.issues.join("\n"), /unsupported gap class: unknown-gap/);
  assert.equal(passWithGap.readyToWrite, false);
  assert.match(passWithGap.issues.join("\n"), /must not declare PASS/i);
  assert.equal(partialVerifyRoute.readyToWrite, false);
  assert.match(partialVerifyRoute.issues.join("\n"), /must not route PARTIAL or BLOCKED validation/i);
});

test("validation render handles UAT prerequisites, summary citations, checkpoints, and one-shot writes", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const missingVerificationContext = await blueprintPhaseValidationAuthoringContext({
    cwd: repoPath,
    phase: "3",
    artifact: "uat"
  });
  const missingVerification = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath)
  });
  const { artifact: _missingArtifact, phase: _missingPhase, ...missingVerificationModel } =
    uatRenderInput(summaryPath);
  const missingVerificationModelValidation = await blueprintPhaseValidationValidateModel({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    model: missingVerificationModel
  });

  assert.equal(missingVerificationContext.status, "invalid");
  assert.equal(missingVerificationContext.readyForDraft, false);
  assert.match(missingVerificationContext.prerequisiteBlockers.join("\n"), /VERIFICATION artifact/i);
  assert.match(JSON.stringify(missingVerificationContext.taskSchema), /03-01-SUMMARY\.md/);
  assert.doesNotMatch(JSON.stringify(missingVerificationContext.taskSchema), /03-VERIFICATION\.md/);
  assert.equal(missingVerificationModelValidation.status, "invalid");
  assert.match(
    missingVerificationModelValidation.diagnostics.map((diagnostic) => diagnostic.code).join("\n"),
    /scope\.prerequisite_blocker/
  );
  assert.equal(missingVerification.readyToWrite, false);
  assert.match(missingVerification.issues.join("\n"), /VERIFICATION artifact before UAT/);

  const verification = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...verificationRenderInput([summaryPath])
  });
  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: verification.content
  });

  const missingCitation = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      uatSummary: ["User acceptance run passed."],
      sessionState: ["Resume source: none"],
      testMatrix: [
        {
          number: "1",
          test: "Ready verification behavior",
          expectedBehavior: "Behavior described by ready verification evidence is acceptable.",
          evidence: ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md",
          result: "pass",
          notes: "User acceptance evidence confirmed."
        }
      ],
      resultSummary: {
        total: 1,
        passed: 1,
        issues: 0,
        pending: 0,
        skipped: 0,
        blocked: 0
      },
      observedBehavior: ["Observed behavior matched expectations."]
    })
  });
  const incompleteCheckpoint = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      checkpoint: "test-1"
    })
  });
  const plannedCommandRoute = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      nextSafeAction: "Continue through `/blu-do`."
    })
  });
  const missingCommandRoute = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      nextSafeAction: "All acceptance evidence is saved."
    })
  });
  const invalidTestResult = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      testMatrix: [
        {
          number: "1",
          test: "Saved execution behavior",
          expectedBehavior: "Behavior described by saved evidence is acceptable.",
          evidence: summaryPath,
          result: "later",
          notes: "Unsupported result state."
        }
      ]
    })
  });
  const invalidGapEnums = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      structuredGaps: [
        {
          test: "1",
          truth: "User reported a mismatch.",
          status: "unknown",
          severity: "urgent",
          reason: "Unsupported gap state.",
          followUp: "Resume `/blu-verify-work 3`."
        }
      ]
    })
  });
  const inconsistentCounts = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      resultSummary: {
        total: 1,
        passed: 0,
        issues: 0,
        pending: 0,
        skipped: 0,
        blocked: 0
      }
    })
  });
  const passWithActiveGap = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      testMatrix: [
        {
          number: "1",
          test: "Saved execution behavior",
          expectedBehavior:
            "Behavior described by saved summary and ready verification evidence is acceptable.",
          evidence: summaryPath,
          result: "issue",
          notes: "User reported a mismatch."
        }
      ],
      resultSummary: {
        total: 1,
        passed: 0,
        issues: 1,
        pending: 0,
        skipped: 0,
        blocked: 0
      },
      unresolvedGaps: ["User reported a mismatch."],
      structuredGaps: [
        {
          test: "1",
          truth: "User reported a mismatch.",
          status: "failed",
          severity: "major",
          reason: "User-reported issue remains active.",
          followUp: "Repair before returning to `/blu-progress`."
        }
      ]
    })
  });
  const passWithUnresolvedGapOnly = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      unresolvedGaps: ["User still reports that the accepted flow misses the requested behavior."],
      structuredGaps: [
        {
          test: "none",
          truth: "none",
          status: "none",
          severity: "none",
          reason: "none",
          followUp: "none"
        }
      ]
    })
  });
  const blankTestMatrixCell = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      testMatrix: [
        {
          number: "1",
          test: "",
          expectedBehavior:
            "Behavior described by saved summary and ready verification evidence is acceptable.",
          evidence: summaryPath,
          result: "pass",
          notes: "User acceptance evidence confirmed."
        }
      ]
    })
  });
  const blankStructuredGapCell = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      structuredGaps: [
        {
          test: "none",
          truth: "",
          status: "none",
          severity: "none",
          reason: "none",
          followUp: "none"
        }
      ]
    })
  });
  const missingVerificationGrounding = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath, {
      uatSummary: [`User acceptance run passed for ${summaryPath}.`],
      sessionState: [
        `Resume source: ${summaryPath}`,
        "Current session step: testing complete",
        "Continuity notes: none"
      ],
      testMatrix: [
        {
          number: "1",
          test: "Saved execution behavior",
          expectedBehavior: "Behavior described by saved evidence is acceptable.",
          evidence: summaryPath,
          result: "pass",
          notes: "User acceptance evidence confirmed."
        }
      ],
      observedBehavior: [`Observed behavior matched ${summaryPath}.`]
    })
  });
  const uatModelExample = readArtifactContract("phase.uat").modelContract?.minimalValidExample;
  assert.ok(uatModelExample);
  const leakedExampleRender = await blueprintPhaseValidationRender({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    ...uatModelExample
  } as PhaseValidationRenderInput);
  const leakedExampleContentWrite = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: leakedExampleRender.content
  });
  const validUat = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(summaryPath)
  });
  const written = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: validUat.content
  });

  assert.equal(missingCitation.readyToWrite, false);
  assert.match(missingCitation.issues.join("\n"), /must cite at least one saved execution summary/i);
  assert.equal(incompleteCheckpoint.readyToWrite, false);
  assert.match(incompleteCheckpoint.issues.join("\n"), /checkpoint none when status is PASS/i);
  assert.equal(plannedCommandRoute.readyToWrite, false);
  assert.match(plannedCommandRoute.issues.join("\n"), /non-implemented Blueprint commands/i);
  assert.equal(missingCommandRoute.readyToWrite, false);
  assert.match(missingCommandRoute.issues.join("\n"), /implemented Blueprint command/);
  assert.equal(invalidTestResult.readyToWrite, false);
  assert.match(invalidTestResult.issues.join("\n"), /unsupported result: later/);
  assert.equal(invalidGapEnums.readyToWrite, false);
  assert.match(invalidGapEnums.issues.join("\n"), /unsupported status: unknown/);
  assert.match(invalidGapEnums.issues.join("\n"), /unsupported severity: urgent/);
  assert.equal(inconsistentCounts.readyToWrite, false);
  assert.match(inconsistentCounts.issues.join("\n"), /passed count 0 does not match Test Matrix count 2/);
  assert.equal(passWithActiveGap.readyToWrite, false);
  assert.match(passWithActiveGap.issues.join("\n"), /must not declare PASS/i);
  assert.equal(passWithUnresolvedGapOnly.readyToWrite, false);
  assert.match(passWithUnresolvedGapOnly.issues.join("\n"), /unresolved gap/i);
  assert.equal(blankTestMatrixCell.readyToWrite, false);
  assert.match(blankTestMatrixCell.issues.join("\n"), /Test Matrix.*cells non-empty/);
  assert.equal(blankStructuredGapCell.readyToWrite, false);
  assert.match(blankStructuredGapCell.issues.join("\n"), /Structured Gaps.*cells non-empty/);
  assert.equal(missingVerificationGrounding.readyToWrite, false);
  assert.match(missingVerificationGrounding.issues.join("\n"), /ready verification artifact or validation baseline/);
  assert.equal(leakedExampleRender.readyToWrite, false);
  assert.match(leakedExampleRender.issues.join("\n"), /copied model example text/);
  assert.equal(leakedExampleContentWrite.status, "invalid");
  assert.match(leakedExampleContentWrite.issues.join("\n"), /copied model example text/);
  assert.equal(validUat.readyToWrite, true, JSON.stringify(validUat, null, 2));
  assert.deepEqual(validUat.referencedSummaryPaths, [summaryPath]);
  assert.equal(written.status, "created", JSON.stringify(written, null, 2));
});

test("validation tools persist VERIFICATION artifacts and advance routing toward verify-work", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const beforeStatus = await blueprintProjectStatus({ cwd: repoPath });
  const created = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| VAL-01 | Confirm execution evidence exists | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | PASS | Saved summaries back the verification pass. |

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: validation lead
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

- Continue with conversational UAT through \`/blu-verify-work 3\`.
`
  });
  const read = await blueprintPhaseValidationRead({
    cwd: repoPath,
    phase: "3",
    artifact: "verification"
  });
  const reused = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| VAL-01 | Confirm execution evidence exists | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | PASS | Saved summaries back the verification pass. |

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: validation lead
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

- Continue with conversational UAT through \`/blu-verify-work 3\`.
`
  });
  const invalid = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: `# Phase 03: Phase Discovery - Verification

## Validation Summary

- Missing the coverage marker and the remaining required sections.
`,
    overwrite: true
  });

  const verificationPath = ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md";
  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });
  const listed = await blueprintArtifactList({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });
  const afterStatus = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(beforeStatus.nextAction, /\/blu-execute-phase 3/);
  assert.equal(created.status, "created", JSON.stringify(created, null, 2));
  assert.deepEqual(created.summaryPaths, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);
  assert.equal(read.found, true);
  assert.deepEqual(read.summaryPaths, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);
  assert.equal(reused.status, "reused");
  assert.deepEqual(reused.summaryPaths, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);
  assert.equal(invalid.status, "invalid");
  assert.match(invalid.issues.join("\n"), /\*\*Coverage:\*\*/);
  assert.match(invalid.issues.join("\n"), /Gate State/);
  assert.match(invalid.issues.join("\n"), /Sign-off/);
  assert.match(invalid.issues.join("\n"), /Requirement \/ Task Coverage/);
  assert.match(invalid.issues.join("\n"), /Evidence Reviewed/);
  assert.match(invalid.issues.join("\n"), /Gaps Found/);
  assert.match(invalid.issues.join("\n"), /Suggested Repairs/);
  assert.match(invalid.issues.join("\n"), /Next Safe Action/);
  assert.equal(context.phase?.artifacts.verification, verificationPath);
  assert.ok(listed.artifacts.phases.includes(verificationPath));
  assert.equal(validation.valid, false);
  assert.doesNotMatch(validation.issues.join("\n"), /VERIFICATION artifacts exist without a SUMMARY artifact/i);
  assert.doesNotMatch(validation.issues.join("\n"), /UAT artifacts exist without a VERIFICATION artifact/i);
  assert.match(afterStatus.nextAction, /\/blu-execute-phase 3/);
  assert.match(state.derivedStatus.nextAction, /\/blu-execute-phase 3/);
  const persistedVerification = await blueprintPhaseValidationRead({
    cwd: repoPath,
    phase: "3",
    artifact: "verification"
  });
  assert.equal(persistedVerification.found, true);
  assert.match(persistedVerification.content ?? "", /\*\*Coverage:\*\*/);
  assert.match(persistedVerification.content ?? "", /Gate State/);
});

test("invalid validation writes leave roadmap completion state unchanged", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const roadmapPath = path.join(repoPath, ".blueprint/ROADMAP.md");
  const beforeRoadmap = await readFile(roadmapPath, "utf8");
  const invalid = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: `# Phase 03: Phase Discovery - Verification

## Validation Summary

- Missing the evidence contract on purpose.
`
  });
  const afterRoadmap = await readFile(roadmapPath, "utf8");

  assert.equal(invalid.status, "invalid");
  assert.equal(afterRoadmap, beforeRoadmap);
  assert.match(afterRoadmap, /\*\*Status\*\*: planned/);
});

test("validation writes require every completed summary to be cited in verification evidence", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await markValidationPlanCompleted(repoPath, "02");

  const singleSummaryWrite = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: renderVerificationArtifact([
      ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
    ])
  });

  assert.equal(singleSummaryWrite.status, "invalid");
  assert.equal(singleSummaryWrite.written, false);
  assert.match(singleSummaryWrite.issues.join("\n"), /cite every saved execution summary/i);
  assert.match(singleSummaryWrite.issues.join("\n"), /03-02-SUMMARY\.md/);
});

test("validation read and UAT preflight reject stale verification missing current summaries", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await markValidationPlanCompleted(repoPath, "02");
  const completedSummaryPaths = [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md",
    ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"
  ];
  const staleVerification = renderVerificationArtifact([completedSummaryPaths[0]]);
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md"),
    staleVerification,
    "utf8"
  );

  const read = await blueprintPhaseValidationRead({
    cwd: repoPath,
    phase: "3",
    artifact: "verification"
  });
  const uatContext = await blueprintPhaseValidationAuthoringContext({
    cwd: repoPath,
    phase: "3",
    artifact: "uat"
  });
  const uatRender = await blueprintPhaseValidationRender({
    cwd: repoPath,
    ...uatRenderInput(completedSummaryPaths[0])
  });

  assert.equal(read.found, true);
  assert.equal(read.validation?.valid, false);
  assert.equal(read.verificationReadyForUat, false);
  assert.deepEqual(read.summaryPaths, completedSummaryPaths);
  assert.match(read.validation?.issues.join("\n") ?? "", /03-02-SUMMARY\.md/);
  assert.equal(uatContext.readyForDraft, false);
  assert.match(uatContext.prerequisiteBlockers.join("\n"), /valid VERIFICATION artifact/i);
  assert.equal(uatRender.readyToWrite, false);
  assert.match(uatRender.issues.join("\n"), /valid VERIFICATION artifact/i);
  await assert.rejects(
    blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "3",
      artifact: "uat",
      content: uatRender.content
    }),
    /valid VERIFICATION artifact/
  );
});

test("verification validation enforces semantic coverage enums, gap classes, and next-step routing", () => {
  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const enumValidation = validateVerificationArtifactContent(
    renderVerificationArtifact([summaryPath], {
      coverageState: "SKIPPED",
      manualStatus: "LATER",
      gapClass: "unknown-gap"
    }),
    [summaryPath]
  );
  const readyRouteMismatch = validateVerificationArtifactContent(
    renderVerificationArtifact([summaryPath], {
      nextAction: "Repair the verification evidence through `/blu-validate-phase 3`."
    }),
    [summaryPath]
  );
  const blockedRouteMismatch = validateVerificationArtifactContent(
    renderVerificationArtifact([summaryPath], {
      gateState: "PARTIAL",
      nextAction: "Continue with conversational UAT through `/blu-verify-work 3`."
    }),
    [summaryPath]
  );
  const manualCoveragePass = validateVerificationArtifactContent(
    renderVerificationArtifact([summaryPath], {
      coverageState: "MANUAL"
    }),
    [summaryPath]
  );
  const manualStatusPass = validateVerificationArtifactContent(
    renderVerificationArtifact([summaryPath], {
      manualStatus: "MANUAL"
    }),
    [summaryPath]
  );
  const contradictoryManualNone = validateVerificationArtifactContent(
    renderVerificationArtifact([summaryPath], {
      manualItem: "manual smoke test",
      manualReason: "manual work remains pending",
      manualFollowUp: "rerun manually before UAT",
      manualStatus: "NONE"
    }),
    [summaryPath]
  );
  const contradictoryGapNone = validateVerificationArtifactContent(
    renderVerificationArtifact([summaryPath], {
      gapClass: "none",
      gapScope: "automation gap",
      gapEvidence: summaryPath,
      gapRepair: "add missing automation"
    }),
    [summaryPath]
  );

  assert.equal(enumValidation.valid, false);
  assert.match(enumValidation.issues.join("\n"), /unsupported coverage state: SKIPPED/);
  assert.match(
    enumValidation.issues.join("\n"),
    /Manual-Only or Deferred Coverage uses an unsupported status: LATER/
  );
  assert.match(enumValidation.issues.join("\n"), /unsupported gap class: unknown-gap/);
  assert.equal(readyRouteMismatch.valid, false);
  assert.match(
    readyRouteMismatch.issues.join("\n"),
    /must route ready-for-UAT validation to \/blu-verify-work/
  );
  assert.equal(manualCoveragePass.valid, false);
  assert.match(manualCoveragePass.issues.join("\n"), /must not declare PASS/i);
  assert.equal(manualStatusPass.valid, false);
  assert.match(manualStatusPass.issues.join("\n"), /must not declare PASS/i);
  assert.equal(contradictoryManualNone.valid, false);
  assert.match(
    contradictoryManualNone.issues.join("\n"),
    /Manual-Only or Deferred Coverage must use literal none cells/i
  );
  assert.equal(contradictoryGapNone.valid, false);
  assert.match(
    contradictoryGapNone.issues.join("\n"),
    /Gap Classification must use literal none cells/i
  );
  assert.equal(blockedRouteMismatch.valid, false);
  assert.match(
    blockedRouteMismatch.issues.join("\n"),
    /must not route PARTIAL or BLOCKED validation to \/blu-verify-work/
  );
});

test("validate-phase manifest flow reads all completed summaries, repairs once, then syncs state from the saved artifact", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await markValidationPlanCompleted(repoPath, "02");

  const completedSummaryPaths = [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md",
    ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"
  ];
  const seedContent = renderVerificationArtifact(completedSummaryPaths);
  const revisedContent = renderVerificationArtifact(completedSummaryPaths, {
    validationSummary: "Execution evidence matches the expected phase outcome after the repair pass."
  });
  const invalidContent = renderVerificationArtifact([
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);

  const seeded = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: seedContent
  });
  const summaryIndex = await blueprintPhaseSummaryIndex({ cwd: repoPath, phase: "3" });
  const completedSummaries = summaryIndex.summaries.filter((summary) => summary.status === "COMPLETED");
  const completedReads = await Promise.all(
    completedSummaries.map((summary) =>
      blueprintPhaseSummaryRead({
        cwd: repoPath,
        phase: "3",
        planId: summary.planId
      })
    )
  );
  const baselineRead = await blueprintPhaseValidationRead({
    cwd: repoPath,
    phase: "3",
    artifact: "verification"
  });

  assert.equal(seeded.status, "created");
  assert.deepEqual(summaryIndex.completedPlans, ["01", "02"]);
  assert.equal(completedReads.length, 2);
  assert.ok(completedReads.every((summary) => summary.found));
  assert.equal(baselineRead.found, true);
  assert.deepEqual(baselineRead.summaryPaths, completedSummaryPaths);

  await assert.rejects(
    blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "3",
      artifact: "verification",
      content: revisedContent
    }),
    /explicit overwrite confirmation/
  );

  const invalidAttempt = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: invalidContent,
    overwrite: true
  });
  const afterInvalidRead = await blueprintPhaseValidationRead({
    cwd: repoPath,
    phase: "3",
    artifact: "verification"
  });

  assert.equal(invalidAttempt.status, "invalid");
  assert.equal(invalidAttempt.written, false);
  assert.equal(afterInvalidRead.content, seedContent);

  const repaired = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: revisedContent,
    overwrite: true
  });
  const artifactValidation = await blueprintArtifactValidate({ cwd: repoPath });
  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-validate-phase"
    }
  });
  const reloadedState = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(repaired.status, "updated");
  assert.deepEqual(repaired.summaryPaths, completedSummaryPaths);
  assert.doesNotMatch(
    artifactValidation.issues.join("\n"),
    /03-VERIFICATION\.md: .*Verification artifact/i
  );
  assert.ok(stateUpdate.updatedFields.includes("activeCommand"));
  assert.equal(reloadedState.state.activeCommand, "/blu-validate-phase");
  assert.match(reloadedState.derivedStatus.nextAction, /\/blu-verify-work 3/);
});

test("validation tools reject scaffold placeholder evidence for verification and UAT writes", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md";
  const verificationPlaceholderContent = `# Phase XX: <Phase Name> - Verification

**Coverage:** Reviewed \`03.1-YY-SUMMARY.md\` and any other saved phase summaries for validation evidence.
**Gate State:** PASS|PARTIAL|BLOCKED
**Sign-off:** verified|pending|blocked

## Validation Summary

- Concise readiness result grounded in the saved summaries.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| <requirement-id> | <task or check> | <summary path, command, or saved evidence> | PASS|MANUAL|DEFERRED|BLOCKED | <coverage note> |

## Evidence Reviewed

  - .blueprint/phases/<phase-dir>/03.1-YY-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness:
- Commands:
- Evidence type:
- Test infrastructure status:

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| <manual-only item> | <reason> | <follow-up> | MANUAL|DEFERRED|NONE |

## Gate State

- Gate: PASS|PARTIAL|BLOCKED
- Sign-off: <name or pending>
- Readiness: <ready for UAT or not ready>

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| <coverage gap class> | <scope> | <evidence> | <repair> |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work XX
`;

  const verificationValidation = validateVerificationArtifactContent(
    verificationPlaceholderContent,
    [summaryPath]
  );
  const verificationWrite = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: verificationPlaceholderContent,
    overwrite: true
  });

  assert.equal(verificationValidation.valid, false);
  assert.match(verificationValidation.issues.join("\n"), /Phase XX/);
  assert.match(verificationValidation.issues.join("\n"), /<Phase Name>/);
  assert.match(verificationValidation.issues.join("\n"), /03\.1-YY-SUMMARY\.md/);
  assert.match(verificationValidation.issues.join("\n"), /PASS\|MANUAL\|DEFERRED\|BLOCKED/);
  assert.match(verificationValidation.issues.join("\n"), /verified\|pending\|blocked/);
  assert.equal(verificationWrite.status, "invalid");
  assert.equal(verificationWrite.written, false);
  await assert.rejects(
    readFile(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md"), "utf8"),
    { code: "ENOENT" }
  );

  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`${summaryPath}\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| VAL-01 | Confirm execution evidence exists | \`${summaryPath}\` | PASS | Saved summaries back the verification pass. |

## Evidence Reviewed

- \`${summaryPath}\`

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: validation lead
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

- /blu-verify-work 3
`
  });

  const uatPlaceholderContent = `# Phase XX: <Phase Name> - UAT

**Status:** PASS|FAIL|PARTIAL
**Resume State:** RESUMED|NEW|CONTINUED
**Checkpoint:** <current checkpoint label or none>

## UAT Summary

- Concise user-facing result grounded in the saved summaries and verification artifact.

## Session State

- Resume source: <saved summary path, in-artifact checkpoint, or none>
- Current session step: <what is being resumed now>
- Continuity notes: <what must remain stable between sessions>

## Questions Asked

- Did the delivered behavior match \`03.1-YY-SUMMARY.md\`?

## Observed Behavior

- The observed behavior matched .blueprint/phases/<phase-dir>/03.1-YY-SUMMARY.md.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
`;

  const uatValidation = validateUatArtifactContent(uatPlaceholderContent, [summaryPath]);
  const uatWrite = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: uatPlaceholderContent,
    overwrite: true
  });

  assert.equal(uatValidation.valid, false);
  assert.match(uatValidation.issues.join("\n"), /Phase XX/);
  assert.match(uatValidation.issues.join("\n"), /PASS\|FAIL\|PARTIAL/);
  assert.match(uatValidation.issues.join("\n"), /Resume State/);
  assert.match(uatValidation.issues.join("\n"), /03\.1-YY-SUMMARY\.md/);
  assert.equal(uatWrite.status, "invalid");
  assert.equal(uatWrite.written, false);
  await assert.rejects(
    readFile(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UAT.md"), "utf8"),
    { code: "ENOENT" }
  );
});

test("validation tools do not re-check roadmap completion when a plan summary is still missing", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await rm(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"));

  const verification = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| VAL-01 | Confirm execution evidence exists | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | PASS | Saved summaries back the verification pass. |

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: validation lead
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

- Continue with conversational UAT through \`/blu-verify-work 3\`.
`
  });
  const uat = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: `# Phase 03: Phase Discovery - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- UAT closed without blocking issues against \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\` with ready verification evidence.

## Session State

- Resume source: \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`
- Current session step: Close the initial UAT pass.
- Continuity notes: Keep the validated summary-backed behavior stable if the session resumes.

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the validated summary-backed behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Discovery UAT smoke | Keep the validated summary-backed behavior stable. | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | pass | none |

## Result Summary

- Total: 1
- Passed: 1
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- Did the delivered behavior match the saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`.

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
`
  });

  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.deepEqual(verification.summaryPaths, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);
  assert.deepEqual(uat.summaryPaths, [
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"
  ]);
  assert.doesNotMatch(roadmapBody, /\*\*Status\*\*: completed/);
  assert.doesNotMatch(status.nextAction, /\/blu-audit-milestone/);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-audit-milestone/);
});

test("validation tools refuse unchanged invalid VERIFICATION artifacts", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const verificationPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-VERIFICATION.md"
  );
  const invalidContent = `# Phase 03: Phase Discovery - Verification

## Validation Summary

- Missing the coverage marker and the remaining required sections.
`;

  await writeFile(verificationPath, invalidContent, "utf8");

  const reused = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: invalidContent
  });

  assert.equal(reused.status, "invalid");
  assert.equal(reused.written, false);
  assert.match(reused.issues.join("\n"), /\*\*Coverage:\*\*/);
  assert.match(reused.issues.join("\n"), /Evidence Reviewed/);
});

test("validation tools reject template-grade verification and UAT placeholder bodies", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const verificationPlaceholder = `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` and any other saved phase summaries for validation evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Concise readiness result grounded in the saved summaries.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| VAL-01 | Confirm execution evidence exists | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | PASS | Saved summaries back the verification pass. |

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: validation lead
- Readiness: ready for UAT

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| none | none | none | none |

## Gaps Found

- Explicit blocker, follow-up, or \`none\`.

## Suggested Repairs

- Explicit next repair, follow-up, or \`none\`.

## Next Safe Action

- /blu-verify-work 3
`;

  const invalidVerification = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: verificationPlaceholder
  });

  assert.equal(invalidVerification.status, "invalid");
  assert.match(invalidVerification.issues.join("\n"), /placeholder scaffold text/i);

  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: renderVerificationArtifact([
      ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md",
      ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"
    ])
  });

  const uatPlaceholder = `# Phase 03: Phase Discovery - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- Concise user-facing result grounded in the saved summaries and verification artifact.

## Session State

- Resume source: \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`
- Current session step: Question asked during the UAT pass, or \`none\`.
- Continuity notes: Observed behavior tied to saved summary evidence such as \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`.

## Questions Asked

- Question asked during the UAT pass, or \`none\`.

## Observed Behavior

- Observed behavior tied to saved summary evidence such as \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`.

## Unresolved Gaps

- Explicit blocker, follow-up, or \`none\`.

## Follow-Up Fixes

- Explicit follow-up fix, acceptance note, or \`none\`.

## Next Safe Action

- /blu-progress
`;

  const invalidUat = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: uatPlaceholder
  });

  assert.equal(invalidUat.status, "invalid");
  assert.match(invalidUat.issues.join("\n"), /placeholder scaffold text/i);
});

test("validation tools reject orphan summaries when the matching plan artifact is missing", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"),
    validationSummaryContent("02", "PARTIAL"),
    "utf8"
  );
  await rm(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"));

  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /03-02-SUMMARY\.md/);
  assert.match(validation.issues.join("\n"), /no matching plan artifact exists for this summary/i);
});

test("validation tools mark ROADMAP phase completion after UAT closes", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"),
    validationSummaryContent("02", "COMPLETED"),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-PLAN.md"),
    `---
phase: 3
plan_id: "02"
title: "Validation Plan 02"
wave: 1
status: done
objective: "Capture the second completed validation summary."
depends_on: []
requirements:
  - VAL-01
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/validate-phase-tools.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 02

## Goal

Capture the second completed validation summary.

## Scope

- Keep additional completed execution evidence linked to a saved plan.

## Tasks

### Task 1: Preserve the second completed summary

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Persist the second saved execution summary against a matching plan artifact.

#### Acceptance Criteria

- tests/validate-phase-tools.test.ts exits 0

## Verification

- Re-run the validation tool tests after adding the second completed plan.

## Must Haves

- Keep every completed summary linked to a matching plan artifact.

## Requirement Coverage

| Requirement | Planned Coverage | Evidence |
| --- | --- | --- |
| VAL-01 | Validate the second completed summary alongside the first. | tests/validate-phase-tools.test.ts exits 0 |

## Evidence Coverage

| Evidence | How It Will Be Produced | Owner |
| --- | --- | --- |
| 03-02-SUMMARY.md | Persist a completed summary linked to plan 02. | Blueprint validation tests |

## File / Surface Coverage

| File / Surface | Expected Change | Verification |
| --- | --- | --- |
| src/mcp/tools/phase.ts | Roadmap completion checks include every completed summary. | Focused validation tool tests |

## Unknowns And Deferrals

| Unknown / Deferral | Handling | Follow-Up |
| --- | --- | --- |
| Extra phase summaries | Keep outside this fixture. | Add separate plans when needed. |
`,
    "utf8"
  );

  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: renderVerificationArtifact([
      ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md",
      ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"
    ])
  });
  const staleUat = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: `# Phase 03: Phase Discovery - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- UAT closed without blocking issues against \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\` with ready verification evidence.

## Session State

- Resume source: \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`
- Current session step: Close the initial UAT pass.
- Continuity notes: Keep the validated summary-backed behavior stable if the session resumes.

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the validated summary-backed behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Discovery UAT smoke | Keep the validated summary-backed behavior stable. | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | pass | none |

## Result Summary

- Total: 1
- Passed: 1
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- Did the delivered behavior match the saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`.

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
  `
  });

  let roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(staleUat.status, "invalid");
  assert.equal(staleUat.written, false);
  assert.match(staleUat.issues.join("\n"), /03-02-SUMMARY\.md/);
  assert.doesNotMatch(roadmapBody, /- \[x\] \*\*Phase 3: Phase Discovery\*\*/);

  const uat = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: `# Phase 03: Phase Discovery - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- UAT closed without blocking issues against \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\` and \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\` with ready verification evidence.

## Session State

- Resume source: \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\` and \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`
- Current session step: Close the full UAT pass.
- Continuity notes: Keep the validated summary-backed behavior stable if the session resumes.

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the validated summary-backed behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Discovery UAT smoke | Keep the first summary-backed behavior stable. | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | pass | none |
| 2 | Discovery UAT follow-up | Keep the second summary-backed behavior stable. | .blueprint/phases/03-phase-discovery/03-02-SUMMARY.md | pass | none |

## Result Summary

- Total: 2
- Passed: 2
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- Did the delivered behavior match every saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\` and \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`.

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
`
  });

  roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(uat.status, "created", JSON.stringify(uat, null, 2));
  assert.match(roadmapBody, /- \[x\] \*\*Phase 3: Phase Discovery\*\* - Validate the completed plans/);
  assert.match(roadmapBody, /### Phase 3: Phase Discovery[\s\S]*\*\*Status\*\*: completed/);
  assert.match(status.nextAction, /\/blu-audit-milestone v1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-audit-milestone v1/);
});

test("verification writes do not rewrite roadmap completion state before UAT closes", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Validation Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery** - Validate the completed plans

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Validate the completed plans.
**Requirements**: VAL-01
**Status**: completed
`,
    "utf8"
  );

  const verification = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| VAL-01 | Confirm execution evidence exists | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | PASS | Saved summaries back the verification pass. |

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: validation lead
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

- Continue with conversational UAT through \`/blu-verify-work 3\`.
`
  });

  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(verification.status, "created", JSON.stringify(verification, null, 2));
  assert.deepEqual(verification.warnings, []);
  assert.match(roadmapBody, /\*\*Status\*\*:\s*completed/);
  assert.match(roadmapBody, /- \[ \] \*\*Phase 3: Phase Discovery\*\*/);
});

test("validation tools do not complete the roadmap when UAT evidence is invalid", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"),
    validationSummaryContent("02", "COMPLETED"),
    "utf8"
  );

  const verificationContent = renderVerificationArtifact([
    ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md",
    ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"
  ]);

  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: verificationContent
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UAT.md"),
    `# Phase 03: Phase Discovery - UAT

## UAT Summary

- Missing the required status, observed behavior, and follow-up sections.
`,
    "utf8"
  );

  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: verificationContent
  });

  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.doesNotMatch(roadmapBody, /- \[x\] \*\*Phase 3: Phase Discovery\*\*/);
  assert.doesNotMatch(roadmapBody, /\*\*Status\*\*:\s*completed/);
  assert.match(status.nextAction, /\/blu-verify-work 3/);
});
