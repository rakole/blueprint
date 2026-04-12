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

## User Constraints

- Keep writes inside .blueprint/.

## Standard Stack

- TypeScript

## Architecture Patterns

- Commands stay thin; MCP tools own persistence.

## Don't Hand-Roll

- Use dedicated validation artifact writes instead of raw file edits.

## Common Pitfalls

- Treating a fully executed phase as validated before a verification artifact exists.

## Code Examples

\`\`\`ts
await blueprintPhaseValidationWrite({ cwd: repoPath, phase: "3", artifact: "verification", content });
\`\`\`

## Recommendations

- Reconstruct validation from saved summaries when the verification artifact is missing.

## Sources

- \`src/mcp/tools/phase.ts\`
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

## Coverage Summary

- Audited the saved summary evidence for implementation completeness.

## Remaining Gaps

- Continue with conversational UAT through verify-work.
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

## Coverage Summary

- Audited the saved summary evidence for implementation completeness.

## Remaining Gaps

- Continue with conversational UAT through verify-work.
`
  });
  const invalid = await blueprintPhaseValidationWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "verification",
    content: "   ",
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
  assert.match(invalid.issues.join("\n"), /must not be empty/i);
  assert.equal(context.phase?.artifacts.verification, verificationPath);
  assert.ok(listed.artifacts.phases.includes(verificationPath));
  assert.doesNotMatch(validation.issues.join("\n"), /VERIFICATION artifacts exist without a SUMMARY artifact/i);
  assert.doesNotMatch(validation.issues.join("\n"), /UAT artifacts exist without a VERIFICATION artifact/i);
  assert.match(afterStatus.nextAction, /\/blu-verify-work 3/);
  assert.match(state.derivedStatus.nextAction, /\/blu-verify-work 3/);
  assert.match(verificationBody, /Coverage Summary/);
});
