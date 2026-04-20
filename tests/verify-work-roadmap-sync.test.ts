import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintPhaseValidationWrite } from "../src/mcp/tools/phase.js";

async function createRepoFixture(options: {
  verificationContent: string;
  uatContent: string;
}): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-verify-work-sync-"));
  const repoPath = path.join(tempRoot, "repo");
  const phaseDir = path.join(repoPath, ".blueprint/phases/04-phase-validation");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
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
    path.join(phaseDir, "04-01-SUMMARY.md"),
    `# Phase 04: Validation - Summary 01

## Result

- Execution completed and produced a summary artifact.
`,
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
| EXEC-01 | Persist verification and UAT evidence after execution. | .blueprint/phases/04-phase-validation/04-01-SUMMARY.md | COVERED | Validation evidence is grounded in the saved summary. |

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
| none | none | none | COMPLETE |

## Gate State

- Gate: PASS
- Sign-off: verified
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

const validUat = `# Phase 04: Validation - UAT

**Status:** PASS
**Resume State:** NEW
**Checkpoint:** none

## UAT Summary

- The user acceptance run passed against \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\`.

## Session State

- Resume source: \`.blueprint/phases/04-phase-validation/04-01-SUMMARY.md\`
- Current session step: Close the initial UAT pass.
- Continuity notes: Keep the validated summary-backed behavior stable if the session resumes.

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

test("invalid verification overwrite still resyncs roadmap completion", async () => {
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
    assert.match(result.warnings.join("\n"), /Reopened Phase 4 in \.blueprint\/ROADMAP\.md/);
    assert.match(roadmap, /- \[ \] \*\*Phase 4: Validation\*\* - Persist verification and UAT evidence/);
    assert.match(roadmap, /\*\*Status\*\*: in_progress/);
  } finally {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});

test("invalid UAT overwrite still resyncs roadmap completion", async () => {
  const repoPath = await createRepoFixture({
    verificationContent: invalidVerification,
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
    assert.match(result.warnings.join("\n"), /Reopened Phase 4 in \.blueprint\/ROADMAP\.md/);
    assert.match(roadmap, /- \[ \] \*\*Phase 4: Validation\*\* - Persist verification and UAT evidence/);
    assert.match(roadmap, /\*\*Status\*\*: in_progress/);
  } finally {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  }
});
