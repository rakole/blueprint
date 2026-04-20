import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  blueprintArtifactValidate,
  validateUatArtifactContent,
  validateVerificationArtifactContent
} from "../src/mcp/tools/artifacts.js";

async function createVerifyWorkFixtureRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-verify-work-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-validation"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "# Roadmap\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/STATE.md"), "# Blueprint State\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-validation/03-CONTEXT.md"),
    `# Phase 03: Validation - Context

## Decisions

- Validation keeps saved evidence and resumable session state explicit.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-validation/03-01-SUMMARY.md"),
    `# Phase 03: Validation - Summary

## Result

- Saved execution evidence exists for validate-phase and verify-work.
`,
    "utf8"
  );

  return repoPath;
}

test("blueprint artifact validation inspects UAT and verification content and proposes repairs", async (t) => {
  const repoPath = await createVerifyWorkFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const summaryPath = ".blueprint/phases/03-phase-validation/03-01-SUMMARY.md";
  const verificationContent = `# Phase 03: Validation - Verification

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

- none

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm test
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | none |

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
`;
  const uatContent = `# Phase 03: Validation - UAT

**Status:** PASS
**Resume State:** RESUMED
**Checkpoint:** pending

## UAT Summary

- The user acceptance run passed.

## Session State

- Resume source: pending
- Current session step: Confirm the saved behavior still matches the approved outcome.
- Continuity notes: Keep the verified behavior stable between sessions.

## Questions Asked

- Did the validated feature behave as expected for the saved execution summary?

## Observed Behavior

- The observed behavior matched the saved verification artifact.

## Unresolved Gaps

- none

## Follow-Up Fixes

- none

## Next Safe Action

- /blu-progress
`;

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-validation/03-VERIFICATION.md"),
    verificationContent,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-validation/03-UAT.md"),
    uatContent,
    "utf8"
  );

  const verificationValidation = validateVerificationArtifactContent(verificationContent, [
    summaryPath
  ]);
  const uatValidation = validateUatArtifactContent(uatContent, [summaryPath]);
  const runtimeValidation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(verificationValidation.valid, false);
  assert.match(
    verificationValidation.issues.join("\n"),
    /must cite at least one saved execution summary path or filename/
  );
  assert.equal(uatValidation.valid, false);
  assert.match(
    uatValidation.issues.join("\n"),
    /must cite at least one saved execution summary path or filename/
  );
  assert.equal(uatValidation.warnings.length, 0);
  assert.equal(runtimeValidation.valid, false);
  assert.match(
    runtimeValidation.issues.join("\n"),
    /03-VERIFICATION\.md: Verification artifact must cite at least one saved execution summary path or filename/
  );
  assert.match(
    runtimeValidation.issues.join("\n"),
    /03-UAT\.md: UAT artifact must cite at least one saved execution summary path or filename/
  );
  assert.match(runtimeValidation.suggestedRepairs.join("\n"), /\/blu-validate-phase/);
  assert.match(runtimeValidation.suggestedRepairs.join("\n"), /\/blu-verify-work/);
});
