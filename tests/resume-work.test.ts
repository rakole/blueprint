import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintPauseHandoffGet,
  blueprintPauseHandoffWrite,
  blueprintStateLoad,
  blueprintStateUpdate
} from "../src/mcp/tools/state.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();
const noExternalServicesSection = `## External Service Prerequisites

| Service | Category | Purpose | User Setup / Startup | Readiness Check | Can Agent Proceed Without It |
|---------|----------|---------|----------------------|-----------------|------------------------------|
| none | none | No external services are required for this plan. | No user setup required. | Repo-local execution only. | yes |`;

async function createResumeWorkFixtureRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-resume-work-");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Resume Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 2: Discovery**
- [ ] **Phase 3: Phase Discovery** - Execute the prepared plans

## Phase Details

### Phase 3: Phase Discovery
**Goal**: Execute the prepared plans.
**Requirements**: RW-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-progress
- Next action: Run /blu-execute-phase 3
- Last updated: 2026-04-10T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify(
      {
        version: 2,
        workflow: {
          research: false,
          ui_phase: false
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-01-PLAN.md"),
    `---
phase: 3
plan_id: "01"
title: "Execution Plan 01"
wave: 1
status: planned
objective: "Exercise the pause/resume handoff flow."
depends_on: []
requirements: ["RW-01"]
files_modified:
  - .blueprint/STATE.md
read_first:
  - .blueprint/phases/03-phase-discovery/03-CONTEXT.md
acceptance_criteria:
  - tests/resume-work.test.ts exits 0
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Exercise the pause/resume handoff flow.

## Scope

- Resume from the saved handoff context.

## Tasks

### Task 1: Restore handoff context

#### Read First

- .blueprint/phases/03-phase-discovery/03-CONTEXT.md

#### Action

- Keep resume routing attached to the saved phase plan.

#### Acceptance Criteria

- tests/resume-work.test.ts exits 0

${noExternalServicesSection}

## Verification

- Run the focused resume-work test.

## Must Haves

- Resume-work keeps the existing phase plan as the active context.

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
| resume-work fixture route | covered | task-1 | tests/resume-work.test.ts | The fixture covers resuming from saved handoff context. |

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | used | The context artifact anchors the resume flow. |

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
| .blueprint/phases/03-phase-discovery/03-CONTEXT.md | task-1 | tests/resume-work.test.ts exits 0 | The focused test covers resume context loading. |

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
| No open unknowns for the resume-work fixture. | none | The fixture has the saved context needed for resume. | No follow-up required after the focused test passes. |
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    `# Phase 03: Phase Discovery - Context

## Decisions

- Keep the resume workflow attached to the existing phase plan.
`,
    "utf8"
  );

  return repoPath;
}

test("resume-work spec metadata references the governance handoff contract and registered tools", async () => {
  const [manifestDoc, referenceDoc, catalogDoc, runtimeContract] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-resume-work.toml"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-governance/references/resume-work-runtime-contract.md"
      ),
      "utf8"
    ),
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    buildBlueprintCommandRuntimeContractResource("resume-work")
  ]);

  assert.match(manifestDoc, /Restore the latest Blueprint pause handoff/);
  assert.match(manifestDoc, /blueprint_project_status/);
  assert.match(manifestDoc, /blueprint_state_load/);
  assert.match(manifestDoc, /blueprint_artifact_list/);
  assert.match(manifestDoc, /blueprint_pause_handoff_get/);
  assert.match(manifestDoc, /blueprint_state_update/);
  assert.match(manifestDoc, /\/blu-new-project/);
  assert.match(manifestDoc, /\/blu-health/);
  assert.match(manifestDoc, /\/blu-progress/);
  assert.match(manifestDoc, /\/blu-resume-work/);
  assert.match(manifestDoc, /Keep persistent writes limited to `\.blueprint\/STATE\.md`/);
  assert.match(
    manifestDoc,
    /Preserve the canonical pause handoff report; do not rewrite or delete `\.blueprint\/reports\/pause-work-latest\.md`/
  );
  assert.match(referenceDoc, /# \/blu-resume-work Runtime Contract/);
  assert.match(referenceDoc, /## Write Boundaries/);
  assert.match(
    referenceDoc,
    /Restore context from the canonical pause handoff, re-anchor `STATE\.md` on live Blueprint state/i
  );
  assert.equal(runtimeContract.catalog.specPath, "src/mcp/command-runtime-metadata.ts#resume-work");
  assert.equal(runtimeContract.spec?.path, "src/mcp/command-runtime-metadata.ts#resume-work");
  assert.deepEqual(runtimeContract.skillInputs.effective, [
    "skills/blueprint-governance/references/resume-work-runtime-contract.md"
  ]);
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    catalogDoc,
    /\| `resume-work` \| 1 \| `Core Lifecycle` \| `blueprint-governance` \| `implemented` \| `\.blueprint\/STATE\.md` \| `Low: restores state from the canonical pause handoff and updates the next safe action\.` \|/
  );

  for (const toolName of [
    "blueprint_project_status",
    "blueprint_state_load",
    "blueprint_artifact_list",
    "blueprint_pause_handoff_get",
    "blueprint_state_update"
  ] as const) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
  }
});

test("pause and resume state flow surfaces /blu-resume-work while the handoff is active", async (t) => {
  const repoPath = await createResumeWorkFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const before = await blueprintStateLoad({ cwd: repoPath });
  assert.match(before.derivedStatus.nextAction, /\/blu-execute-phase 3/);

  const created = await blueprintPauseHandoffWrite({
    cwd: repoPath,
    currentState: "Paused after preparing the execution-ready plan and before resuming the next session.",
    completedWork: ["Reviewed the execution-ready plan.", "Confirmed the next phase artifacts are present."],
    remainingWork: ["Resume the saved work with the active handoff before continuing implementation."],
    decisions: ["Keep the handoff as the single source of pause context."],
    blockers: ["Waiting for the next implementation session to continue."],
    humanActionsPending: ["Choose when to resume the saved session."],
    modifiedFiles: ["src/mcp/tools/state.ts", "docs/commands/resume-work.md"],
    contextNotes: "The next session should restore the pause handoff first, then continue from the saved phase context.",
    nextAction: "Start by restoring the saved handoff and then continue with /blu-resume-work."
  });

  const paused = await blueprintStateLoad({ cwd: repoPath });
  const handoff = await blueprintPauseHandoffGet({ cwd: repoPath });
  const resumeTimestamp = new Date(Date.parse(created.handoff.timestamp) + 60_000).toISOString();

  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      activeCommand: "/blu-progress",
      lastUpdated: resumeTimestamp
    }
  });

  const resumed = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(created.status, "created");
  assert.equal(handoff.found, true);
  assert.equal(handoff.handoff?.currentPhase, "3");
  assert.equal(paused.state.activeCommand, "/blu-pause-work");
  assert.match(paused.blockers.join("\n"), /Paused handoff is active/);
  assert.match(paused.derivedStatus.nextAction, /\/blu-resume-work/);
  assert.match(paused.derivedStatus.nextAction, /restore the saved pause handoff for Phase 3/);
  assert.doesNotMatch(resumed.blockers.join("\n"), /Paused handoff is active/);
  assert.match(resumed.derivedStatus.nextAction, /\/blu-execute-phase 3/);
});
