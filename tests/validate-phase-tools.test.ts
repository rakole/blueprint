import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
    `# Phase 03: Phase Discovery - Summary

## Result

- Execution finished and produced durable summary evidence.
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
| none | none | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | none |

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
| none | none | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | none |

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
  assert.equal(read.found, true);
  assert.deepEqual(read.summaryPaths, [".blueprint/phases/03-phase-discovery/03-01-SUMMARY.md"]);
  assert.equal(reused.status, "reused");
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
  assert.doesNotMatch(validation.issues.join("\n"), /VERIFICATION artifacts exist without a SUMMARY artifact/i);
  assert.doesNotMatch(validation.issues.join("\n"), /UAT artifacts exist without a VERIFICATION artifact/i);
  assert.match(afterStatus.nextAction, /\/blu-verify-work 3/);
  assert.match(state.derivedStatus.nextAction, /\/blu-verify-work 3/);
  assert.match(verificationBody, /\*\*Coverage:\*\*/);
  assert.match(verificationBody, /Gate State/);
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

**Coverage:** Reviewed \`${summaryPath}\` and any other saved phase summaries for validation evidence.
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
| none | none | \`${summaryPath}\` | none |

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

## UAT Summary

- Concise user-facing result grounded in the saved summaries and verification artifact.

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
  assert.match(uatValidation.issues.join("\n"), /03\.1-YY-SUMMARY\.md/);
  assert.equal(uatWrite.status, "invalid");
  assert.equal(uatWrite.written, false);
  await assert.rejects(
    readFile(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UAT.md"), "utf8"),
    { code: "ENOENT" }
  );
});

test("validation tools mark ROADMAP phase completion after UAT closes", async (t) => {
  const repoPath = await createValidationReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseValidationWrite({
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
| none | none | .blueprint/phases/03-phase-discovery/03-01-SUMMARY.md | none |

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
