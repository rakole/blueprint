import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintArtifactList, blueprintArtifactValidate } from "../src/mcp/tools/artifacts.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  blueprintPhaseContext,
  blueprintPhaseValidationRead,
  blueprintPhaseValidationWrite
} from "../src/mcp/tools/phase.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";

async function createValidationReadyRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-validate-phase-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
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
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Exercise validation routing.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"),
    `# Phase 03: Phase Discovery - Summary 01

**Plan:** \`03-01-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced durable summary evidence.

## Changes Made

- Captured the completed validation-plan execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`
`,
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
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 03: Phase Discovery - Plan 02
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"),
    `# Phase 03: Phase Discovery - Summary 02

**Plan:** \`03-02-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced durable summary evidence.

## Changes Made

- Captured the completed validation-plan execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`
`,
    "utf8"
  );

  return repoPath;
}

test("validate-phase tools are registered in the Blueprint server", () => {
  for (const toolName of [
    "blueprint_phase_validation_read",
    "blueprint_phase_validation_write"
  ]) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
  }
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

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

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

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

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
  const verificationBody = await readFile(path.join(repoPath, verificationPath), "utf8");

  assert.match(beforeStatus.nextAction, /\/blu-validate-phase 3/);
  assert.equal(created.status, "created");
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
  assert.match(invalid.issues.join("\n"), /Evidence Reviewed/);
  assert.match(invalid.issues.join("\n"), /Gaps Found/);
  assert.match(invalid.issues.join("\n"), /Suggested Repairs/);
  assert.match(invalid.issues.join("\n"), /Next Safe Action/);
  assert.equal(context.phase?.artifacts.verification, verificationPath);
  assert.ok(listed.artifacts.phases.includes(verificationPath));
  assert.equal(validation.valid, false);
  assert.doesNotMatch(validation.issues.join("\n"), /VERIFICATION artifacts exist without a SUMMARY artifact/i);
  assert.doesNotMatch(validation.issues.join("\n"), /UAT artifacts exist without a VERIFICATION artifact/i);
  assert.match(afterStatus.nextAction, /\/blu-verify-work 3/);
  assert.match(state.derivedStatus.nextAction, /\/blu-verify-work 3/);
  assert.match(verificationBody, /\*\*Coverage:\*\*/);
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

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

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

## UAT Summary

- UAT closed without blocking issues.

## Questions Asked

- Did the delivered behavior match the saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`.

## Unresolved Gaps

- none

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

## Validation Summary

- Concise readiness result grounded in the saved summaries.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

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
    content: `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with conversational UAT through \`/blu-verify-work 3\`.
`
  });

  const uatPlaceholder = `# Phase 03: Phase Discovery - UAT

**Status:** PASS

## UAT Summary

- Concise user-facing result grounded in the saved summaries and verification artifact.

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
    `# Phase 03: Phase Discovery - Summary 02

**Plan:** \`03-02-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced durable summary evidence.

## Changes Made

- Captured the completed validation-plan execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`
`,
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
    `# Phase 03: Phase Discovery - Summary 02

**Plan:** \`03-02-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced durable summary evidence.

## Changes Made

- Captured the completed validation-plan execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`
`,
    "utf8"
  );

  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with conversational UAT through \`/blu-verify-work 3\`.
`
  });
  await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "uat",
    content: `# Phase 03: Phase Discovery - UAT

**Status:** PASS

## UAT Summary

- UAT closed without blocking issues.

## Questions Asked

- Did the delivered behavior match the saved execution summary?

## Observed Behavior

- The observed behavior matched \`.blueprint/phases/03-phase-discovery/03-01-SUMMARY.md\`.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- Return to \`/blu-progress\` for the next safe implemented action.
`
  });

  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");
  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.match(roadmapBody, /- \[x\] \*\*Phase 3: Phase Discovery\*\* - Validate the completed plans/);
  assert.match(roadmapBody, /### Phase 3: Phase Discovery[\s\S]*\*\*Status\*\*: completed/);
  assert.match(status.nextAction, /\/blu-audit-milestone v1/);
  assert.match(state.derivedStatus.nextAction, /\/blu-audit-milestone v1/);
});

test("validation tools reopen stale completed roadmap details even when the checkbox is already unchecked", async (t) => {
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

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with conversational UAT through \`/blu-verify-work 3\`.
`
  });

  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(verification.status, "created");
  assert.match(verification.warnings.join("\n"), /Reopened Phase 3 in \.blueprint\/ROADMAP\.md/);
  assert.doesNotMatch(roadmapBody, /\*\*Status\*\*:\s*completed/);
  assert.match(roadmapBody, /\*\*Status\*\*:\s*in_progress/);
  assert.match(roadmapBody, /- \[ \] \*\*Phase 3: Phase Discovery\*\*/);
});

test("validation tools do not complete the roadmap when UAT evidence is invalid", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-02-SUMMARY.md"),
    `# Phase 03: Phase Discovery - Summary 02

**Plan:** \`03-02-PLAN.md\`
**Status:** COMPLETED

## Outcome

- Execution finished and produced durable summary evidence.

## Changes Made

- Captured the completed validation-plan execution in the phase summary.

## Verification

- Wrote the summary artifact at \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`.

## Follow-Ups

- none

## Evidence

- \`.blueprint/phases/03-phase-discovery/03-02-SUMMARY.md\`
`,
    "utf8"
  );

  const verificationContent = `# Phase 03: Phase Discovery - Verification

**Coverage:** Reviewed \`03-01-SUMMARY.md\` for completed execution evidence.

## Validation Summary

- Execution evidence matches the expected phase outcome.

## Evidence Reviewed

- .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- Continue with conversational UAT through \`/blu-verify-work 3\`.
`;

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
