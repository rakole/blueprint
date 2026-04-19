import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  blueprintPauseHandoffGet,
  blueprintPauseHandoffWrite,
  blueprintStateLoad,
  blueprintStateUpdate
} from "../src/mcp/tools/state.js";

const repoRoot = process.cwd();

async function createExecutionReadyRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-pause-work-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Pause Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 2: Discovery**
- [ ] **Phase 3: Phase Discovery** - Execute the prepared plans
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
- Next action: Run /blu-progress
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

- Execution should resume from the existing plan inventory.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    `# Phase 03: Phase Discovery - Research

**Researched:** 2026-04-11
**Domain:** pause-work runtime
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PW-01 | Persist a resumable pause handoff. | Use MCP-owned report writes. |

## Summary

- The phase is execution-ready and should normally route to execute-phase.

## Locked Decisions From Context

- Resume should reconstruct from saved Blueprint artifacts rather than chat history alone.

## User Constraints

- Keep writes inside .blueprint/.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Installation And Setup

- Exercise pause-work against a repo fixture with saved discovery artifacts.

## Alternatives Considered

- A chat-only handoff was rejected because it would lose durable project context.

## Architecture Patterns

- Commands stay thin; MCP tools own persistence.

## Don't Hand-Roll

- Reuse Blueprint state and artifact helpers.

## Anti-Patterns

- Assuming research can be dropped from the handoff because it is "just discovery."

## State Of The Art

- Pause-work now treats saved research as durable state for later recovery.

## Common Pitfalls

- Letting a stale handoff permanently override later commands.

## Open Questions

- Should future pause reports summarize research validity explicitly?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Pause recovery | HIGH | The fixture includes the saved research artifact used during resume. |

## Code Examples

\`\`\`ts
await blueprintPauseHandoffWrite({ cwd: repoPath, currentState: "Paused." });
\`\`\`

## Recommendations

- Route to /blu-execute-phase when plans exist and no active pause handoff is newer.

## Sources

- \`src/mcp/tools/state.ts\` - pause handoff persistence and resumed routing logic.
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
title: "Execution Plan 01"
wave: 1
status: planned
objective: "Exercise the pause-work router."
depends_on: []
requirements: []
files_modified: []
read_first: []
acceptance_criteria: []
autonomous: true
---

# Phase 03: Phase Discovery - Plan 01

## Goal

Exercise the pause-work router.

## Scope

- Persist a handoff.

## Tasks

- Write the pause report.

## Verification

- Confirm routing and report content.

## Must Haves

- Keep writes inside .blueprint/.
`,
    "utf8"
  );

  return repoPath;
}

test("pause-work manifest references the handoff tools, overwrite gate, and safe follow-up routing", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-pause-work.toml"), "utf8");
  const requiredTools = [
    "blueprint_state_load",
    "blueprint_artifact_list",
    "blueprint_pause_handoff_get",
    "blueprint_pause_handoff_write",
    "blueprint_state_update"
  ];

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(toolName));
  }

  assert.match(commandFile, /explicit overwrite confirmation/i);
  assert.match(commandFile, /\.blueprint\/reports\/|pause handoff/i);
  assert.match(commandFile, /do not create an automatic git commit/i);
  assert.match(commandFile, /\/blu-resume-work/);
});

test("pause handoff tools create, reuse, update, and influence routed state while active", async (t) => {
  const repoPath = await createExecutionReadyRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const before = await blueprintProjectStatus({ cwd: repoPath });
  const missing = await blueprintPauseHandoffGet({ cwd: repoPath });

  assert.match(before.nextAction, /\/blu-execute-phase 3/);
  assert.equal(missing.found, false);

  const created = await blueprintPauseHandoffWrite({
    cwd: repoPath,
    currentState: "Paused after reviewing the execution-ready plan and before starting code changes.",
    completedWork: ["Confirmed the phase is execution-ready.", "Reviewed the existing plan artifact."],
    remainingWork: ["Run /blu-execute-phase 3 once work resumes."],
    decisions: ["Keep the handoff as a single canonical report in .blueprint/reports/."],
    blockers: ["Waiting for the next implementation session to continue execution work."],
    humanActionsPending: ["Decide when to resume execution for Phase 3."],
    modifiedFiles: ["src/mcp/tools/state.ts", "commands/blu-pause-work.toml"],
    contextNotes: "Resume by reviewing the handoff first, then continue with the queued execution step.",
    nextAction: "Start by reading .blueprint/reports/pause-work-latest.md and then run /blu-resume-work."
  });
  await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-pause-work",
      nextAction:
        "Run /blu-resume-work to restore the saved pause handoff and recover the next safe implemented action"
    }
  });
  const reportBody = await readFile(
    path.join(repoPath, ".blueprint/reports/pause-work-latest.md"),
    "utf8"
  );
  const afterCreate = await blueprintPauseHandoffGet({ cwd: repoPath });
  const pausedState = await blueprintStateLoad({ cwd: repoPath });
  const pausedStatus = await blueprintProjectStatus({ cwd: repoPath });

  const reused = await blueprintPauseHandoffWrite({
    cwd: repoPath,
    currentState: "Paused after reviewing the execution-ready plan and before starting code changes.",
    completedWork: ["Confirmed the phase is execution-ready.", "Reviewed the existing plan artifact."],
    remainingWork: ["Run /blu-execute-phase 3 once work resumes."],
    decisions: ["Keep the handoff as a single canonical report in .blueprint/reports/."],
    blockers: ["Waiting for the next implementation session to continue execution work."],
    humanActionsPending: ["Decide when to resume execution for Phase 3."],
    modifiedFiles: ["src/mcp/tools/state.ts", "commands/blu-pause-work.toml"],
    contextNotes: "Resume by reviewing the handoff first, then continue with the queued execution step.",
    nextAction: "Start by reading .blueprint/reports/pause-work-latest.md and then run /blu-resume-work."
  });
  const updated = await blueprintPauseHandoffWrite({
    cwd: repoPath,
    currentState: "Paused after a second review pass with a tighter resume note.",
    completedWork: ["Confirmed the phase is execution-ready.", "Reviewed the existing plan artifact."],
    remainingWork: ["Run /blu-execute-phase 3 once work resumes."],
    decisions: ["Keep the handoff as a single canonical report in .blueprint/reports/."],
    blockers: ["Waiting for the next implementation session to continue execution work."],
    humanActionsPending: ["Decide when to resume execution for Phase 3."],
    modifiedFiles: ["src/mcp/tools/state.ts", "commands/blu-pause-work.toml"],
    contextNotes: "The next session can jump straight to execution after reviewing this updated note.",
    nextAction: "Start by reading .blueprint/reports/pause-work-latest.md and then run /blu-resume-work.",
    overwrite: true
  });

  const resumeTimestamp = new Date(Date.parse(updated.handoff.timestamp) + 60_000).toISOString();
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      activeCommand: "/blu-progress",
      lastUpdated: resumeTimestamp
    }
  });
  const resumedState = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(created.status, "created");
  assert.equal(created.path, ".blueprint/reports/pause-work-latest.md");
  assert.match(reportBody, /# Pause Work Handoff/);
  assert.match(reportBody, /## Completed Work/);
  assert.match(reportBody, /commands\/blu-pause-work\.toml/);
  assert.equal(afterCreate.found, true);
  assert.equal(afterCreate.handoff?.currentPhase, "3");
  assert.deepEqual(afterCreate.handoff?.modifiedFiles, [
    "src/mcp/tools/state.ts",
    "commands/blu-pause-work.toml"
  ]);
  assert.equal(pausedState.state.activeCommand, "/blu-pause-work");
  assert.match(pausedState.derivedStatus.nextAction, /\/blu-resume-work/);
  assert.match(pausedState.blockers.join("\n"), /Paused handoff is active/);
  assert.match(pausedStatus.nextAction, /\/blu-resume-work/);
  assert.equal(reused.status, "reused");
  assert.equal(updated.status, "updated");
  assert.match(resumedState.derivedStatus.nextAction, /\/blu-execute-phase 3/);
  assert.doesNotMatch(resumedState.blockers.join("\n"), /Paused handoff is active/);
});
