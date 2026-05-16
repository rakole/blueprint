import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  blueprintPhaseValidationRead,
  blueprintPhaseValidationWrite
} from "../src/mcp/tools/phase.js";
import { blueprintArtifactValidate } from "../src/mcp/tools/artifacts.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

function completedSummaryContent(): string {
  return `# Phase 04: Validation - Summary 01

**Plan:** \`04-01-PLAN.md\`
**Status:** COMPLETED
**Readiness:** ready-for-validation
**Completion State:** complete
**Next Safe Action:** /blu-validate-phase 4

## Outcome

- Execution completed and produced a summary artifact.

## Changes Made

- Captured the completed validation-plan execution in the phase summary.

## Verification

| Check | Command | Result | Evidence | Notes |
|-------|---------|--------|----------|-------|
| tests/verify-work-roadmap-sync.test.ts exits 0 | npx tsx --test tests/verify-work-roadmap-sync.test.ts | pass | Wrote the summary artifact at .blueprint/phases/04-phase-validation/04-01-SUMMARY.md. | The selected acceptance criterion passed. |

## Dependency Plans

| Plan | Status | Evidence |
|------|--------|----------|
| none | none | none |

## Manual / Deferred Work

| Item | Reason | Follow-Up | Status |
|------|--------|-----------|--------|
| none | none | none | NONE |

## Gap / Repair Routes

| Gap | Evidence | Repair | Status |
|-----|----------|--------|--------|
| none | none | none | NONE |

## Follow-Ups

- none

## Evidence

| Kind | Source | Summary |
|------|--------|---------|
| artifact | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | Saved summary artifact. |
`;
}

async function createRepoFixture(options: {
  verificationContent: string;
  uatContent: string;
}): Promise<string> {
  const repoPath = await createGitRepo("blueprint-verify-work-sync-");
  const phaseDir = path.join(repoPath, ".blueprint/phases/04-phase-validation");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Verification Fixture

## Milestone

- Active milestone: v2

## Phases

- [x] **Phase 4: Validation** - Persist verification and UAT evidence

## Phase Details

### Phase 4: Validation
**Goal**: Persist verification and UAT evidence.
**Requirements**: EXEC-01
**Status**: completed
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 4
- Active command: /blu-verify-work
- Next action: Run /blu-verify-work 4
- Last updated: 2026-04-11T00:00:00.000Z
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(phaseDir, "04-01-PLAN.md"),
    `---
phase: 4
plan_id: "01"
title: "Validation Plan 01"
wave: 1
status: done
objective: "Persist verification and UAT evidence."
depends_on: []
requirements:
  - EXEC-01
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/verify-work-roadmap-sync.test.ts exits 0
autonomous: true
---

# Phase 04: Validation - Plan 01

## Goal

Persist verification and UAT evidence.

## Scope

- Keep roadmap completion synced to saved verification and UAT outcomes.

## Tasks

### Task 1: Preserve roadmap sync from saved validation evidence

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Confirm invalid overwrite attempts still resync roadmap completion from the saved validation state.

#### Acceptance Criteria

- tests/verify-work-roadmap-sync.test.ts exits 0

## Verification

- Re-run the roadmap sync tests after exercising invalid overwrite flows.

## Must Haves

- Keep verification and UAT writes grounded in the saved summary artifact.

## Requirement Coverage

| Requirement | Planned Coverage | Evidence |
| --- | --- | --- |
| EXEC-01 | Preserve roadmap sync from saved verification and UAT evidence. | tests/verify-work-roadmap-sync.test.ts exits 0 |

## Evidence Coverage

| Evidence | How It Will Be Produced | Owner |
| --- | --- | --- |
| Verification and UAT artifacts | Write saved validation state before invalid overwrite checks. | Blueprint verify-work tests |

## File / Surface Coverage

| File / Surface | Expected Change | Verification |
| --- | --- | --- |
| src/mcp/tools/phase.ts | Roadmap sync reads saved validation evidence. | Focused verify-work roadmap sync tests |

## Unknowns And Deferrals

| Unknown / Deferral | Handling | Follow-Up |
| --- | --- | --- |
| Remaining UAT follow-up states | Exercise separately with partial UAT fixtures. | Resume verify-work after follow-up review. |
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-01-SUMMARY.md"),
    completedSummaryContent(),
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-VERIFICATION.md"),
    options.verificationContent,
    "utf8"
  );
  await writeFile(path.join(phaseDir, "04-UAT.md"), options.uatContent, "utf8");

  return repoPath;
}

const validVerification = `# Phase 04: Validation - Verification

**Coverage:** Reviewed \`04-01-SUMMARY.md\` for the completed validation plan.
**Gate State:** PASS
**Sign-off:** verified by the Blueprint verifier

## Validation Summary

- The validated feature set is ready for UAT.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| EXEC-01 | Persist verification and UAT evidence after execution. | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | PASS | Validation evidence is grounded in the saved summary. |

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md

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

- Continue with \`/blu-verify-work 4\`.
`;

const validUat = `# Phase 04: Validation - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- The user acceptance run passed against \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\` with ready verification evidence.

## Session State

- Resume source: \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\`
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
| 1 | Validation UAT smoke | Keep the validated summary-backed behavior stable. | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | pass | none |

## Result Summary

- Total: 1
- Passed: 1
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- Did the validated feature behave as expected for the saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\` with ready verification evidence.

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

const invalidVerification = `# Phase 04: Validation - Verification

## Validation Summary

- This verification content is missing the required contract sections.
`;

const weakUat = `# Phase 04: Validation - UAT

**Status:** PASS
**Resume State:** RESUMED
**Checkpoint:** pending

## UAT Summary

- The user acceptance run passed.

## Session State

- Resume source: pending
- Current session step: Resume the pass after a pause.
- Continuity notes: Keep the validated behavior stable between sessions.

## Questions Asked

- Did the validated feature behave as expected?

## Observed Behavior

- The observed behavior matched the saved execution summary.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- Return to \`/blu-progress\` for the next safe implemented action.
`;

const partialUat = validUat
  .replace("**Status:** PASS", "**Status:** PARTIAL")
  .replace("**Resume State:** NEW", "**Resume State:** RESUMED")
  .replace("**Checkpoint:** none", "**Checkpoint:** resume-gap-review")
  .replace("- Number: testing complete", "- Number: 1")
  .replace("- Name: none", "- Name: Validation UAT smoke")
  .replace("- Expected: Keep the validated summary-backed behavior stable.", "- Expected: Confirm the saved validation behavior still matches the summary evidence.")
  .replace("- Awaiting: none", "- Awaiting: review")
  .replace("| 1 | Validation UAT smoke | Keep the validated summary-backed behavior stable. | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | pass | none |", "| 1 | Validation UAT smoke | Confirm the saved validation behavior still matches the summary evidence. | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | issue | Follow-up review still open. |")
  .replace("- Passed: 1", "- Passed: 0")
  .replace("- Issues: 0", "- Issues: 1")
  .replace("- The observed behavior matched `.blueprint/phases/04-phase-validation/04-01-SUMMARY.md` with ready verification evidence.", "- The observed behavior exposed a remaining follow-up against `.blueprint/phases/04-phase-validation/04-01-SUMMARY.md` with ready verification evidence.")
  .replace("- none\n\n## Structured Gaps", "- Validation UAT still needs one follow-up review.\n\n## Structured Gaps")
  .replace("| none | none | none | none | none | none |", "| 1 | Confirm the saved validation behavior still matches the summary evidence. | partial | major | Follow-up review still open. | Resume `/blu-verify-work 4` after repair. |")
  .replace("- none\n\n## Follow-Up Fixes", "- Resume `/blu-verify-work 4` after the follow-up review is complete.\n\n## Follow-Up Fixes")
  .replace("- none\n\n## Next Safe Action", "- Repair the remaining validation follow-up, then resume `/blu-verify-work 4`.\n\n## Next Safe Action")
  .replace("- Return to `/blu-progress` for the next safe implemented action.", "- Continue with `/blu-verify-work 4`.");

test("invalid verification overwrite does not resync roadmap completion", async () => {
  const repoPath = await createRepoFixture({
    verificationContent: validVerification,
    uatContent: weakUat
  });

  try {
    const result = await blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "4",
      artifact: "verification",
      content: invalidVerification,
      overwrite: true
    });
    const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

    assert.equal(result.status, "invalid");
    assert.equal(result.written, false);
    assert.match(result.issues.join("\n"), /must declare \*\*Coverage:\*\*/);
    assert.equal(result.warnings.join("\n"), "");
    assert.match(roadmap, /- \[x\] \*\*Phase 4: Validation\*\* - Persist verification and UAT evidence/);
    assert.match(roadmap, /\*\*Status\*\*: completed/);
  } finally {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("invalid UAT overwrite does not resync roadmap completion", async () => {
  const repoPath = await createRepoFixture({
    verificationContent: validVerification,
    uatContent: validUat
  });

  try {
    const result = await blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "4",
      artifact: "uat",
      content: weakUat,
      overwrite: true
    });
    const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

    assert.equal(result.status, "invalid");
    assert.equal(result.written, false);
    assert.match(
      result.issues.join("\n"),
      /must cite at least one saved execution summary path or filename/
    );
    assert.equal(result.warnings.join("\n"), "");
    assert.match(roadmap, /- \[x\] \*\*Phase 4: Validation\*\* - Persist verification and UAT evidence/);
    assert.match(roadmap, /\*\*Status\*\*: completed/);
  } finally {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("partial UAT reopens roadmap completion and stays incomplete in typed validation reads", async () => {
  const repoPath = await createRepoFixture({
    verificationContent: validVerification,
    uatContent: validUat
  });

  try {
    const result = await blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "4",
      artifact: "uat",
      content: partialUat,
      overwrite: true
    });
    const read = await blueprintPhaseValidationRead({
      cwd: repoPath,
      phase: "4",
      artifact: "uat"
    });
    const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

    assert.equal(result.status, "updated");
    assert.equal(read.validation?.valid, true);
    assert.equal(read.uatStatus, "PARTIAL");
    assert.equal(read.resumeState, "RESUMED");
    assert.equal(read.checkpoint, "resume-gap-review");
    assert.equal(read.complete, false);
    assert.match(result.warnings.join("\n"), /cannot complete yet|incomplete/i);
    assert.match(roadmap, /- \[ \] \*\*Phase 4: Validation\*\* - Persist verification and UAT evidence/);
    assert.match(roadmap, /\*\*Status\*\*: in_progress/);
  } finally {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("reused UAT sync tolerates extra spacing in roadmap checklist lines", async () => {
  const repoPath = await createRepoFixture({
    verificationContent: validVerification,
    uatContent: validUat
  });

  try {
    await writeFile(
      path.join(repoPath, ".blueprint/ROADMAP.md"),
      `# Roadmap: Verification Fixture

## Milestone

- Active milestone: v2

## Phases

- [ ]  **Phase 4: Validation** - Persist verification and UAT evidence

## Phase Details

### Phase 4: Validation
**Goal**: Persist verification and UAT evidence.
**Requirements**: EXEC-01
**Status**: in_progress
`,
      "utf8"
    );

    const result = await blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "4",
      artifact: "uat",
      content: validUat
    });
    const roadmap = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

    assert.equal(result.status, "reused");
    assert.doesNotMatch(
      result.warnings.join("\n"),
      /ROADMAP completion sync could not find Phase 4/
    );
    assert.match(
      roadmap,
      /- \[x\]  \*\*Phase 4: Validation\*\* - Persist verification and UAT evidence/
    );
    assert.match(roadmap, /\*\*Status\*\*: completed/);
  } finally {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("resuming a valid incomplete UAT persists without overwrite confirmation", async () => {
  const repoPath = await createRepoFixture({
    verificationContent: validVerification,
    uatContent: partialUat
  });

  try {
    const resumedPass = partialUat
      .replace("**Status:** PARTIAL", "**Status:** PASS")
      .replace("**Resume State:** RESUMED", "**Resume State:** CONTINUED")
      .replace("**Checkpoint:** resume-gap-review", "**Checkpoint:** none")
      .replace("- Number: 1", "- Number: testing complete")
      .replace("- Name: Validation UAT smoke", "- Name: none")
      .replace("- Expected: Confirm the saved validation behavior still matches the summary evidence.", "- Expected: Keep the validated summary-backed behavior stable.")
      .replace("- Awaiting: review", "- Awaiting: none")
      .replace("| 1 | Validation UAT smoke | Confirm the saved validation behavior still matches the summary evidence. | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | issue | Follow-up review still open. |", "| 1 | Validation UAT smoke | Keep the validated summary-backed behavior stable. | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | pass | Follow-up review closed. |")
      .replace("- Passed: 0", "- Passed: 1")
      .replace("- Issues: 1", "- Issues: 0")
      .replace("- The observed behavior exposed a remaining follow-up against `.blueprint/phases/04-phase-validation/04-01-SUMMARY.md` with ready verification evidence.", "- The observed behavior matched `.blueprint/phases/04-phase-validation/04-01-SUMMARY.md` with ready verification evidence.")
      .replace("- Validation UAT still needs one follow-up review.", "- none")
      .replace("| 1 | Confirm the saved validation behavior still matches the summary evidence. | partial | major | Follow-up review still open. | Resume `/blu-verify-work 4` after repair. |", "| none | none | none | none | none | none |")
      .replace("- Resume `/blu-verify-work 4` after the follow-up review is complete.", "- none")
      .replace("- Continue with `/blu-verify-work 4`.", "- Return to `/blu-progress` for the next safe implemented action.");
    const result = await blueprintPhaseValidationWrite({
      cwd: repoPath,
      phase: "4",
      artifact: "uat",
      content: resumedPass
    });
    const read = await blueprintPhaseValidationRead({
      cwd: repoPath,
      phase: "4",
      artifact: "uat"
    });

    assert.equal(result.status, "updated");
    assert.equal(result.overwritten, true);
    assert.match(result.warnings.join("\n"), /without the replace path/i);
    assert.equal(read.validation?.valid, true);
    assert.equal(read.resumeState, "CONTINUED");
    assert.equal(read.complete, true);
  } finally {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("phase validation read surfaces invalid saved UAT and keeps artifact-scoped truth separate from global validation", async () => {
  const repoPath = await createRepoFixture({
    verificationContent: validVerification,
    uatContent: weakUat
  });

  try {
    const read = await blueprintPhaseValidationRead({
      cwd: repoPath,
      phase: "4",
      artifact: "uat"
    });
    const validation = await blueprintArtifactValidate({ cwd: repoPath });

    assert.equal(read.found, true);
    assert.equal(read.validation?.valid, false);
    assert.equal(read.uatStatus, "PASS");
    assert.equal(read.resumeState, "RESUMED");
    assert.equal(read.checkpoint, "pending");
    assert.equal(read.complete, false);
    assert.match(read.validation?.issues.join("\n") ?? "", /Current Test|Test Matrix|Result Summary|Structured Gaps/);
    assert.equal(validation.valid, false);
  } finally {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});
