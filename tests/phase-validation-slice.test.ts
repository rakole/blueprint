import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintArtifactList } from "../src/mcp/tools/artifacts.js";
import {
  blueprintCommandCatalog,
  blueprintProjectStatus
} from "../src/mcp/tools/project.js";
import {
  blueprintPhaseLocate,
  blueprintPhaseValidationRead,
  blueprintPhaseValidationWrite
} from "../src/mcp/tools/phase.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";

const repoRoot = process.cwd();

async function createValidationRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-validation-slice-"));
  const repoPath = path.join(tempRoot, "repo");
  const completedPhaseDir = path.join(repoPath, ".blueprint/phases/03-execution");
  const phaseDir = path.join(repoPath, ".blueprint/phases/04-phase-validation");

  await mkdir(completedPhaseDir, { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Validation Fixture

## Milestone

- Active milestone: v2

## Phases

- [x] **Phase 3: Execution** - Produce summaries for the completed plans
- [ ] **Phase 4: Validation** - Persist verification and UAT evidence

## Phase Details

### Phase 4: Validation
**Goal**: Persist verification and UAT evidence.
**Requirements**: EXEC-01
**Status**: planned
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 4
- Active command: /blu-execute-phase
- Next action: Run /blu-execute-phase 4
- Last updated: 2026-04-11T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(completedPhaseDir, "03-01-PLAN.md"),
    `---
phase: 3
plan_id: "01"
title: "Execution Plan 01"
wave: 1
status: done
objective: "Exercise verification and UAT handoff."
depends_on: []
requirements:
  - EXEC-01
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/phase-validation-slice.test.ts exits 0
autonomous: true
---

# Phase 03: Execution - Plan 01

## Goal

Exercise verification and UAT handoff.

## Scope

- Preserve completed execution evidence for downstream validation and UAT writes.

## Tasks

### Task 1: Keep completed execution evidence durable

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Confirm the saved execution summary remains usable input for validation and UAT artifacts.

#### Acceptance Criteria

- tests/phase-validation-slice.test.ts exits 0

## Verification

- Re-run the validation slice after persisting verification and UAT artifacts.

## Must Haves

- Keep downstream validation grounded in the completed execution summary.
`,
    "utf8"
  );
  await writeFile(
    path.join(completedPhaseDir, "03-01-SUMMARY.md"),
    `# Phase 03: Execution - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution completed and produced a summary artifact.

## Changes Made

- Captured the completed execution-plan work in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`
`,
    "utf8"
  );
  await writeFile(
    path.join(completedPhaseDir, "03-VERIFICATION.md"),
    `# Phase 03: Execution - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- Phase 3 already has completed validation evidence.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| EXEC-00 | Preserve earlier validation evidence | .blueprint/phases/03-execution/03-01-SUMMARY.md | PASS | Earlier execution evidence remains durable. |

## Evidence Reviewed

- .blueprint/phases/03-execution/03-01-SUMMARY.md

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
| none | none | .blueprint/phases/03-execution/03-01-SUMMARY.md | none |

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
    path.join(completedPhaseDir, "03-UAT.md"),
    `# Phase 03: Execution - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- Phase 3 already has completed UAT evidence from \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`.

## Session State

- Resume source: \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`
- Current session step: none
- Continuity notes: none

## Current Test

- Number: testing complete
- Name: none
- Expected: Keep the accepted behavior stable.
- Awaiting: none

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
| 1 | Execution UAT smoke | Keep the accepted behavior stable. | .blueprint/phases/03-execution/03-01-SUMMARY.md | pass | none |

## Result Summary

- Total: 1
- Passed: 1
- Issues: 0
- Pending: 0
- Skipped: 0
- Blocked: 0

## Questions Asked

- none

## Observed Behavior

- The accepted behavior matched \`.blueprint/phases/03-execution/03-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
| none | none | none | none | none | none |

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-01-PLAN.md"),
    `---
phase: 4
plan_id: "01"
title: "Validation Plan 01"
wave: 1
status: planned
objective: "Exercise validation artifact routing."
depends_on: []
requirements:
  - EXEC-01
files_modified:
  - src/mcp/tools/phase.ts
read_first:
  - src/mcp/tools/phase.ts
acceptance_criteria:
  - tests/phase-validation-slice.test.ts exits 0
autonomous: true
---

# Phase 04: Validation - Plan 01

## Goal

Exercise validation artifact routing.

## Scope

- Persist verification and UAT artifacts for the validation phase.

## Tasks

### Task 1: Write validation artifacts from saved summaries

#### Read First

- src/mcp/tools/phase.ts

#### Action

- Confirm the validation phase can persist verification and UAT artifacts from saved summary evidence.

#### Acceptance Criteria

- tests/phase-validation-slice.test.ts exits 0

## Verification

- Re-run the validation slice after persisting the phase 4 artifacts.

## Must Haves

- Keep the validation routing grounded in saved summary evidence.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-01-SUMMARY.md"),
    `# Phase 04: Validation - Summary 01

**Plan:** \`04-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution completed and produced a summary artifact.

## Changes Made

- Captured the completed validation-plan execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\`
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-02-SUMMARY.md"),
    `# Phase 04: Validation - Summary 02

**Plan:** \`04-99-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution completed and produced a summary artifact.

## Changes Made

- Captured the completed validation-plan execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/04-phase-validation/04-02-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/04-phase-validation/04-02-SUMMARY.md\`
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-CONTEXT.md"),
    [
      "# Phase 04: Validation - Context",
      "",
      "## Phase Boundary",
      "- Keep validation evidence durable and summary-backed.",
      "- Cover verification, UAT, and gap closure artifacts.",
      "- Exclude replanning completed execution work.",
      "- Downstream validation should trace back to saved summaries.",
      "",
      "## Discovery Grounding",
      "- Project brief - this phase validates completed execution evidence.",
      "- Requirements grounding - preserve the summary-aware lifecycle contract.",
      "- Workflow posture - validate from saved artifacts rather than prompt memory.",
      "- Confirmed decisions - validation follows execution summaries.",
      "",
      "## Dependencies",
      "- Prior phase artifacts - execution summaries and roadmap state.",
      "- External constraints - repository writes stay inside `.blueprint/`.",
      "- Required follow-up reads - the saved summary and verification evidence.",
      "",
      "## Open Questions",
      "- Which gaps remain manual-only or deferred?",
      "",
      "## Deferred Ideas",
      "- Later follow-up: revisit any validation gap that needs a dedicated repair.",
      "- Reusable evidence: keep the next audit pass and any deferred evidence nearby.",
      "",
      "## Canonical References",
      "- Saved execution summaries and validation fixtures."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-RESEARCH.md"),
    [
      "# Phase 04: Validation - Research",
      "",
      "**Researched:** 2026-04-11",
      "**Domain:** validation slice routing",
      "**Confidence:** HIGH",
      "",
      "## Phase Requirements",
      "",
      "| ID | Description | Research Support |",
      "|----|-------------|------------------|",
      "| EXEC-01 | Persist verification and UAT evidence after execution. | Use dedicated validation writes for verification and UAT. |",
      "",
      "## Summary",
      "",
      "- The phase is ready for validation once summaries exist.",
      "",
      "## Locked Decisions From Context",
      "",
      "- Preserve summary-aware validation before any UAT step.",
      "",
      "## User Constraints",
      "",
      "- Keep validation writes inside .blueprint/.",
      "",
      "## Standard Stack",
      "",
      "- TypeScript on Node.js",
      "",
      "## Installation And Setup",
      "",
      "- Run the saved summary and verification fixtures through the standard test harness.",
      "",
      "## Alternatives Considered",
      "",
      "- Direct prompt-only validation was rejected in favor of artifact-backed evidence reads.",
      "",
      "## Architecture Patterns",
      "",
      "- MCP tools own durable artifact writes.",
      "",
      "## Don't Hand-Roll",
      "",
      "- Don't write verification or UAT artifacts outside the phase tool surface.",
      "",
      "## Anti-Patterns",
      "",
      "- Treating verification as complete without durable summary evidence.",
      "",
      "## State Of The Art",
      "",
      "- Summary-aware validation is the current lifecycle substrate for this runtime slice.",
      "",
      "## Common Pitfalls",
      "",
      "- Treating validation evidence as optional noise.",
      "",
      "## Open Questions",
      "",
      "- Should validation also require explicit evidence for skipped checks?",
      "",
      "## Confidence Breakdown",
      "",
      "| Topic | Confidence | Why |",
      "|-------|------------|-----|",
      "| Validation routing | HIGH | The test fixture controls the saved summary and verification inputs. |",
      "",
      "## Code Examples",
      "",
      "```ts",
      'await blueprintPhaseValidationWrite({ cwd: repoPath, phase: "4", artifact: "verification", content });',
      "```",
      "",
      "## Recommendations",
      "",
      "- Route to /blu-validate-phase after execution summaries are present.",
      "",
      "## Sources",
      "",
      "- `src/mcp/tools/phase.ts` - phase validation reads and writes for this lifecycle slice."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-UI-SPEC.md"),
    [
      "# Phase 04: Validation - UI Spec",
      "",
      "## Outcome Mode",
      "",
      "- Explicit skip rationale"
    ].join("\n"),
    "utf8"
  );

  return repoPath;
}

test("phase validation docs and catalog metadata promote validate-phase and verify-work to implemented", async () => {
  const [catalogMarkdown, skillsMarkdown] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/SKILLS-AND-AGENTS.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `validate-phase` \| 1 \| `Core Lifecycle` \| `blueprint-phase-validation` \| `implemented` \| `phase XX-VERIFICATION\.md; \.blueprint\/STATE\.md` \| `Low: writes summary-aware verification evidence and updates follow-up state\.` \|/
  );
  assert.match(
    catalogMarkdown,
    /\| `verify-work` \| 1 \| `Core Lifecycle` \| `blueprint-phase-validation` \| `implemented` \| `phase XX-UAT\.md; \.blueprint\/ROADMAP\.md when completion evidence closes; \.blueprint\/STATE\.md; optional explicit follow-up fix capture` \| `Medium: writes resumable UAT artifacts, can close or reopen roadmap completion, and records follow-up state\.` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-phase-validation` \| `implemented` \| Verification, UAT, tests, and gap closure \| `validate-phase`, `verify-work`, `add-tests` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-verifier` \| `implemented` \| Verify execution results and UAT evidence \|/
  );
});

test("validate-phase and verify-work manifests reference registered validation tools and safe routing text", async () => {
  const [validateManifest, verifyManifest, skillFile] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-validate-phase.toml"), "utf8"),
    readFile(path.join(repoRoot, "commands/blu-verify-work.toml"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8")
  ]);

  for (const toolName of [
    "blueprint_phase_locate",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_validation_read",
    "blueprint_phase_validation_write",
    "blueprint_config_get",
    "blueprint_artifact_validate",
    "blueprint_state_load",
    "blueprint_state_update"
  ] as const) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(validateManifest, new RegExp(blueprintRuntimeToolFqn(toolName)));
    assert.match(verifyManifest, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.match(validateManifest, /Use the `blueprint-phase-validation` skill/);
  assert.match(verifyManifest, /Use the `blueprint-phase-validation` skill/);
  assert.match(validateManifest, /`blueprint-verifier` subagent/);
  assert.match(verifyManifest, /`blueprint-verifier` subagent/);
  assert.match(validateManifest, /artifact: "verification"/);
  assert.match(verifyManifest, /artifact: "uat"/);
  assert.match(validateManifest, /\/blu-validate-phase <phase>/);
  assert.match(verifyManifest, /\/blu-progress/);
  assert.doesNotMatch(validateManifest, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
  assert.doesNotMatch(verifyManifest, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /resumable through `XX-UAT\.md`/);
  assert.match(skillFile, /blueprint-verifier/);
});

test("validation phase artifacts can be written, read, and discovered alongside the validate-phase router handoff", async (t) => {
  const repoPath = await createValidationRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const beforeValidationStatus = await blueprintProjectStatus({ cwd: repoPath });
  const beforeValidationState = await blueprintStateLoad({ cwd: repoPath });
  const verificationCreated = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "4",
    artifact: "verification",
    content: `# Phase 04: Validation - Verification

**Coverage:** Reviewed \`04-01-SUMMARY.md\` and \`04-02-SUMMARY.md\` for completed validation evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- The validated feature set is ready for UAT.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| EXEC-01 | Confirm validation evidence exists | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | PASS | Execution summaries back the validation pass. |

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md
- .blueprint/phases/04-phase-validation/04-02-SUMMARY.md

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
| none | none | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with \`/blu-verify-work 4\`.
`,
    overwrite: true
  });
  const verificationRead = await blueprintPhaseValidationRead({
    cwd: repoPath,
    phase: "04",
    artifact: "verification"
  });
  const verificationReused = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "4",
    artifact: "verification",
    content: `# Phase 04: Validation - Verification

**Coverage:** Reviewed \`04-01-SUMMARY.md\` and \`04-02-SUMMARY.md\` for completed validation evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- The validated feature set is ready for UAT.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| EXEC-01 | Confirm validation evidence exists | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | PASS | Execution summaries back the validation pass. |

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md
- .blueprint/phases/04-phase-validation/04-02-SUMMARY.md

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
| none | none | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with \`/blu-verify-work 4\`.
`
  });
  const verificationUpdated = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "4",
    artifact: "verification",
    content: `# Phase 04: Validation - Verification

**Coverage:** Reviewed \`04-01-SUMMARY.md\` and \`04-02-SUMMARY.md\` for completed validation evidence.
**Gate State:** PARTIAL
**Sign-off:** pending

## Validation Summary

- The validated feature set has a follow-up note.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| EXEC-01 | Reconfirm validation evidence and follow-up note | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | MANUAL | Follow-up note still needs confirmation. |

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md
- .blueprint/phases/04-phase-validation/04-02-SUMMARY.md

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| Follow-up note confirmation | Requires manual confirmation during UAT | Reconfirm during /blu-verify-work 4 | MANUAL |

## Gate State

- Gate: PARTIAL
- Sign-off: pending
- Readiness: not ready for UAT

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| manual-only | Follow-up note confirmation | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | Repair through /blu-validate-phase 4 |

## Gaps Found

- Capture the follow-up note during UAT.

## Suggested Repairs

- Repair the verification evidence through \`/blu-validate-phase 4\`.

## Next Safe Action

- Continue with \`/blu-validate-phase 4\`.
`,
    overwrite: true
  });
  const beforeUatStatus = await blueprintProjectStatus({ cwd: repoPath });
  const beforeUatState = await blueprintStateLoad({ cwd: repoPath });
  assert.equal(verificationCreated.status, "created", JSON.stringify(verificationCreated, null, 2));
  assert.equal(verificationReused.status, "reused", JSON.stringify(verificationReused, null, 2));
  assert.equal(verificationUpdated.status, "updated", JSON.stringify(verificationUpdated, null, 2));
  const verificationRestored = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "4",
    artifact: "verification",
    content: `# Phase 04: Validation - Verification

**Coverage:** Reviewed \`04-01-SUMMARY.md\` and \`04-02-SUMMARY.md\` for completed validation evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- The validated feature set is ready for UAT.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| EXEC-01 | Confirm validation evidence exists | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | PASS | Execution summaries back the validation pass. |

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md
- .blueprint/phases/04-phase-validation/04-02-SUMMARY.md

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
| none | none | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with \`/blu-verify-work 4\`.
`,
    overwrite: true
  });
  assert.ok(["updated", "reused"].includes(verificationRestored.status));
  const invalidUat = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "4",
    artifact: "uat",
    content: `# Phase 04: Validation - UAT

## UAT Summary

- Missing the required status line and the remaining UAT sections.
`,
    overwrite: true
  });
  const uatCreated = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "4",
    artifact: "uat",
    content: `# Phase 04: Validation - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- The user acceptance run passed against \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\`.

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

- The observed behavior matched \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\`.

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
`,
    overwrite: true
  });
  const uatRead = await blueprintPhaseValidationRead({
    cwd: repoPath,
    phase: "4",
    artifact: "uat"
  });
  const phaseLocate = await blueprintPhaseLocate({ cwd: repoPath, phase: "4" });
  const artifactList = await blueprintArtifactList({ cwd: repoPath });
  const afterUatStatus = await blueprintProjectStatus({ cwd: repoPath });
  const afterUatState = await blueprintStateLoad({ cwd: repoPath });
  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.match(beforeValidationStatus.nextAction, /\/blu-validate-phase 4/);
  assert.match(beforeValidationState.derivedStatus.nextAction, /\/blu-validate-phase 4/);
  assert.equal(verificationCreated.status, "created");
  assert.equal(verificationRead.found, true);
  assert.match(verificationRead.content ?? "", /ready for UAT/);
  assert.deepEqual(verificationCreated.summaryPaths, [
    ".blueprint/phases/04-phase-validation/04-01-SUMMARY.md",
    ".blueprint/phases/04-phase-validation/04-02-SUMMARY.md"
  ]);
  assert.deepEqual(verificationRead.summaryPaths, [
    ".blueprint/phases/04-phase-validation/04-01-SUMMARY.md",
    ".blueprint/phases/04-phase-validation/04-02-SUMMARY.md"
  ]);
  assert.equal(verificationRead.validation?.valid, true);
  assert.equal(verificationRead.verificationReadyForUat, true);
  assert.equal(verificationRead.complete, true);
  assert.match(verificationRead.content ?? "", /Requirement \/ Task Coverage/);
  assert.match(verificationRead.content ?? "", /Gate State/);
  assert.equal(verificationReused.status, "reused");
  assert.equal(verificationUpdated.status, "updated");
  assert.match(beforeUatStatus.nextAction, /\/blu-validate-phase 4/);
  assert.match(beforeUatState.derivedStatus.nextAction, /\/blu-validate-phase 4/);
  assert.equal(invalidUat.status, "invalid");
  assert.match(invalidUat.issues.join("\n"), /\*\*Status:\*\*/);
  assert.match(invalidUat.issues.join("\n"), /Resume State/);
  assert.match(invalidUat.issues.join("\n"), /Checkpoint/);
  assert.match(invalidUat.issues.join("\n"), /Session State/);
  assert.match(invalidUat.issues.join("\n"), /Questions Asked/);
  assert.match(invalidUat.issues.join("\n"), /Observed Behavior/);
  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "4",
    artifact: "verification",
    content: `# Phase 04: Validation - Verification

**Coverage:** Reviewed \`04-01-SUMMARY.md\` and \`04-02-SUMMARY.md\` for completed validation evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- The validated feature set is ready for UAT.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| EXEC-01 | Confirm validation evidence exists | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | PASS | Execution summaries back the validation pass. |

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md
- .blueprint/phases/04-phase-validation/04-02-SUMMARY.md

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
| none | none | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with \`/blu-verify-work 4\`.
`,
    overwrite: true
  });
  assert.equal(uatCreated.status, "created");
  assert.equal(uatRead.found, true);
  assert.match(uatRead.content ?? "", /user acceptance run passed/i);
  assert.equal(uatRead.validation?.valid, true);
  assert.equal(uatRead.uatStatus, "PASS");
  assert.equal(uatRead.resumeState, "NEW");
  assert.equal(uatRead.checkpoint, "none");
  assert.equal(uatRead.complete, true);
  assert.equal(phaseLocate.found, true);
  assert.ok(
    phaseLocate.artifacts.includes(".blueprint/phases/04-phase-validation/04-VERIFICATION.md")
  );
  assert.ok(phaseLocate.artifacts.includes(".blueprint/phases/04-phase-validation/04-UAT.md"));
  assert.ok(
    artifactList.artifacts.phases.includes(".blueprint/phases/04-phase-validation/04-VERIFICATION.md")
  );
  assert.ok(
    artifactList.artifacts.phases.includes(".blueprint/phases/04-phase-validation/04-UAT.md")
  );
  assert.match(
    roadmapBody,
    /- \[x\] \*\*Phase 4: Validation\*\* - Persist verification and UAT evidence/
  );
  assert.match(roadmapBody, /### Phase 4: Validation[\s\S]*\*\*Status\*\*: completed/);
  assert.match(afterUatStatus.nextAction, /\/blu-audit-milestone v2/);
  assert.match(afterUatState.derivedStatus.nextAction, /\/blu-audit-milestone v2/);
});

test("verify-work refuses to persist UAT when the verification artifact is invalid", async (t) => {
  const repoPath = await createValidationRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "4",
    artifact: "verification",
    content: `# Phase 04: Validation - Verification

## Validation Summary

- This verification artifact is malformed.
`,
    overwrite: true
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/04-phase-validation/04-VERIFICATION.md"),
    `# Phase 04: Validation - Verification

## Validation Summary

- This verification artifact is malformed.
`,
    "utf8"
  );

  await assert.rejects(
    () =>
      blueprintPhaseValidationWrite({
        cwd: repoPath,
        phase: "4",
        artifact: "uat",
        content: `# Phase 04: Validation - UAT

**Status:** PASS

## UAT Summary

- The user acceptance run passed.

## Questions Asked

- Did the validated feature behave as expected for the saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- Return to \`/blu-progress\` for the next safe implemented action.
`,
        overwrite: true
      }),
    /must have a valid VERIFICATION artifact before UAT/
  );
});

test("verify-work refuses to persist UAT when the verification artifact is valid but not ready for UAT", async (t) => {
  const repoPath = await createValidationRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const readyVerification = `# Phase 04: Validation - Verification

**Coverage:** Reviewed \`04-01-SUMMARY.md\` and \`04-02-SUMMARY.md\` for completed validation evidence.
**Gate State:** PASS
**Sign-off:** validation lead

## Validation Summary

- The validated feature set is ready for UAT.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| EXEC-01 | Confirm validation evidence exists | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | PASS | Execution summaries back the validation pass. |

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md
- .blueprint/phases/04-phase-validation/04-02-SUMMARY.md

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
| none | none | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with \`/blu-verify-work 4\`.
`;

  const notReadyVerification = readyVerification
    .replace("**Gate State:** PASS", "**Gate State:** PARTIAL")
    .replace("- Gate: PASS", "- Gate: PARTIAL")
    .replace("- Readiness: ready for UAT", "- Readiness: not ready for UAT")
    .replace("- The validated feature set is ready for UAT.", "- The validated feature set needs a final repair pass before UAT.")
    .replace("- Continue with `/blu-verify-work 4`.", "- Continue with `/blu-validate-phase 4`.");

  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "4",
    artifact: "verification",
    content: notReadyVerification,
    overwrite: true
  });

  await assert.rejects(
    () =>
      blueprintPhaseValidationWrite({
        cwd: repoPath,
        phase: "4",
        artifact: "uat",
        content: `# Phase 04: Validation - UAT

**Status:** PASS

## UAT Summary

- The user acceptance run passed.

## Questions Asked

- Did the validated feature behave as expected for the saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- Return to \`/blu-progress\` for the next safe implemented action.
`,
        overwrite: true
      }),
    /ready for UAT/
  );
});

test("validate-phase and verify-work command docs keep the validation skill and MCP contracts explicit", async () => {
  const [validateDoc, verifyDoc] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/validate-phase.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/verify-work.md"), "utf8")
  ]);

  assert.match(validateDoc, /Primary skill: `blueprint-phase-validation`/);
  assert.match(validateDoc, /`blueprint-verifier`/);
  assert.match(validateDoc, /blueprint_phase_locate/);
  assert.match(validateDoc, /blueprint_phase_summary_index/);
  assert.match(validateDoc, /blueprint_phase_summary_read/);
  assert.match(validateDoc, /blueprint_phase_validation_read/);
  assert.match(validateDoc, /blueprint_phase_validation_write/);
  assert.match(validateDoc, /blueprint_config_get/);
  assert.match(validateDoc, /blueprint_artifact_validate/);
  assert.match(validateDoc, /blueprint_state_update/);
  assert.match(validateDoc, /blueprint_artifact_contract_read/);
  assert.match(validateDoc, /self-check the normalized draft against the returned contract before calling `blueprint_phase_validation_write`/i);
  assert.match(validateDoc, /phase XX-VERIFICATION\.md/);
  assert.match(validateDoc, /Direct `validate-phase` happy-path fixture\./);
  assert.match(verifyDoc, /Primary skill: `blueprint-phase-validation`/);
  assert.match(verifyDoc, /`blueprint-verifier`/);
  assert.match(verifyDoc, /blueprint_phase_locate/);
  assert.match(verifyDoc, /blueprint_phase_summary_index/);
  assert.match(verifyDoc, /blueprint_phase_summary_read/);
  assert.match(verifyDoc, /blueprint_phase_validation_read/);
  assert.match(verifyDoc, /blueprint_phase_validation_write/);
  assert.match(verifyDoc, /blueprint_config_get/);
  assert.match(verifyDoc, /blueprint_state_update/);
  assert.match(verifyDoc, /phase XX-UAT\.md/);
  assert.match(verifyDoc, /Direct `verify-work` happy-path fixture\./);
});

test("validation contract docs keep the published verification schema aligned with the runtime contract", async () => {
  const [artifactSchema, addTestsDoc, validateDoc] = await Promise.all([
    readFile(path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/add-tests.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/validate-phase.md"), "utf8")
  ]);

  assert.match(artifactSchema, /### `XX-VERIFICATION\.md`/);
  assert.match(artifactSchema, /\*\*Coverage:\*\*/);
  assert.match(artifactSchema, /\*\*Gate State:\*\*/);
  assert.match(artifactSchema, /\*\*Sign-off:\*\*/);
  assert.match(artifactSchema, /## Validation Summary/);
  assert.match(artifactSchema, /## Requirement \/ Task Coverage/);
  assert.match(artifactSchema, /## Evidence Reviewed/);
  assert.match(artifactSchema, /## Test Infrastructure \/ Evidence Metadata/);
  assert.match(artifactSchema, /## Manual-Only or Deferred Coverage/);
  assert.match(artifactSchema, /## Gate State/);
  assert.match(artifactSchema, /## Gap Classification/);
  assert.match(artifactSchema, /should only route the next safe action to `\/blu-verify-work` when the saved gate state is `PASS`/i);

  assert.match(addTestsDoc, /blueprint_artifact_contract_read/);
  assert.match(addTestsDoc, /normalize the final verification draft to the returned `authoringTemplate`/i);
  assert.match(addTestsDoc, /self-check the normalized verification draft against the returned contract before writing/i);
  assert.match(validateDoc, /blueprint_artifact_contract_read/);
  assert.match(validateDoc, /normalize the final verification draft to the returned `authoringTemplate`/i);
  assert.match(validateDoc, /self-check the normalized draft against the returned contract before calling `blueprint_phase_validation_write`/i);
});
