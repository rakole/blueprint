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
  const phaseDir = path.join(repoPath, ".blueprint/phases/04-phase-validation");

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
    path.join(phaseDir, "04-01-PLAN.md"),
    `---
phase: 4
plan_id: "01"
title: "Validation Plan 01"
wave: 1
status: planned
objective: "Exercise validation artifact routing."
depends_on: []
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 04: Validation - Plan 01
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-01-SUMMARY.md"),
    `# Phase 04: Validation - Summary 01

## Result

- Execution completed and produced a summary artifact.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-CONTEXT.md"),
    `# Phase 04: Validation - Context

## Decisions
- Validation follows execution summaries.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-RESEARCH.md"),
    `# Phase 04: Validation - Research

**Researched:** 2026-04-11
**Domain:** validation slice routing
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXEC-01 | Persist verification and UAT evidence after execution. | Use dedicated validation writes for verification and UAT. |

## Summary

- The phase is ready for validation once summaries exist.

## User Constraints

- Keep validation writes inside .blueprint/.

## Standard Stack

- TypeScript

## Architecture Patterns

- MCP tools own durable artifact writes.

## Don't Hand-Roll

- Don't write verification or UAT artifacts outside the phase tool surface.

## Common Pitfalls

- Treating validation evidence as optional noise.

## Code Examples

\`\`\`ts
await blueprintPhaseValidationWrite({ cwd: repoPath, phase: "4", artifact: "verification", content });
\`\`\`

## Recommendations

- Route to /blu-validate-phase after execution summaries are present.

## Sources

- \`src/mcp/tools/phase.ts\`
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "04-UI-SPEC.md"),
    `# Phase 04: Validation - UI Spec

## Outcome Mode

- Explicit skip rationale
`,
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
    /\| `validate-phase` \| 1 \| `Core Lifecycle` \| `blueprint-phase-validation` \| `implemented` \| `phase XX-VERIFICATION\.md; \.blueprint\/STATE\.md` \| `Low: writes summary-aware validation artifacts and gap reports\.` \|/
  );
  assert.match(
    catalogMarkdown,
    /\| `verify-work` \| 1 \| `Core Lifecycle` \| `blueprint-phase-validation` \| `implemented` \| `phase XX-UAT\.md; \.blueprint\/STATE\.md; optional explicit follow-up fix capture` \| `Low: writes resumable UAT artifacts and follow-up state\.` \|/
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
  assert.match(validateManifest, /\/blu-progress/);
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

**Coverage:** Reviewed \`04-01-SUMMARY.md\` for the completed validation plan.

## Validation Summary

- The validated feature set is ready for UAT.

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md

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

**Coverage:** Reviewed \`04-01-SUMMARY.md\` for the completed validation plan.

## Validation Summary

- The validated feature set is ready for UAT.

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md

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

**Coverage:** Reviewed \`04-01-SUMMARY.md\` for the completed validation plan.

## Validation Summary

- The validated feature set has a follow-up note.

## Evidence Reviewed

- .blueprint/phases/04-phase-validation/04-01-SUMMARY.md

## Gaps Found

- Capture the follow-up note during UAT.

## Suggested Repairs

- Reconfirm the follow-up note during \`/blu-verify-work 4\`.

## Next Safe Action

- Continue with \`/blu-verify-work 4\`.
`,
    overwrite: true
  });
  const beforeUatStatus = await blueprintProjectStatus({ cwd: repoPath });
  const beforeUatState = await blueprintStateLoad({ cwd: repoPath });
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

  assert.match(beforeValidationStatus.nextAction, /\/blu-validate-phase 4/);
  assert.match(beforeValidationState.derivedStatus.nextAction, /\/blu-validate-phase 4/);
  assert.equal(verificationCreated.status, "created");
  assert.equal(verificationRead.found, true);
  assert.match(verificationRead.content ?? "", /ready for UAT/);
  assert.equal(verificationReused.status, "reused");
  assert.equal(verificationUpdated.status, "updated");
  assert.match(beforeUatStatus.nextAction, /\/blu-verify-work 4/);
  assert.match(beforeUatState.derivedStatus.nextAction, /\/blu-verify-work 4/);
  assert.equal(invalidUat.status, "invalid");
  assert.match(invalidUat.issues.join("\n"), /\*\*Status:\*\*/);
  assert.match(invalidUat.issues.join("\n"), /Questions Asked/);
  assert.match(invalidUat.issues.join("\n"), /Observed Behavior/);
  assert.equal(uatCreated.status, "created");
  assert.equal(uatRead.found, true);
  assert.match(uatRead.content ?? "", /user acceptance run passed/i);
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
  assert.match(afterUatStatus.nextAction, /\/blu-progress/);
  assert.match(afterUatState.derivedStatus.nextAction, /\/blu-progress/);
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
