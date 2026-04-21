import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import {
  blueprintArtifactScaffold,
  blueprintArtifactList
} from "../src/mcp/tools/artifacts.js";
import {
  blueprintPhaseArtifactWrite,
  blueprintPhaseCheckpointDelete,
  blueprintPhaseCheckpointGet,
  blueprintPhaseCheckpointPut,
  blueprintPhaseContext
} from "../src/mcp/tools/phase.js";

const repoRoot = process.cwd();

async function createPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-discuss-phase-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery**
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
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");

  return repoPath;
}

test("discuss-phase command references only registered phase-discovery tool names", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-discuss-phase.toml"),
    "utf8"
  );
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-discovery/SKILL.md"),
    "utf8"
  );
  const docFile = await readFile(
    path.join(repoRoot, "docs/commands/discuss-phase.md"),
    "utf8"
  );
  const requiredTools = [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_roadmap_read",
    "blueprint_artifact_list",
    "blueprint_config_get",
    "blueprint_phase_artifact_read",
    "blueprint_phase_plan_index",
    "blueprint_artifact_contract_read",
    "blueprint_phase_artifact_write",
    "blueprint_phase_checkpoint_get",
    "blueprint_phase_checkpoint_put",
    "blueprint_phase_checkpoint_delete",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ] as const;

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.match(commandFile, /Use the `blueprint-phase-discovery` skill/);
  assert.match(commandFile, /explicit overwrite confirmation/i);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /one focused question per `ask_user` call/i);
  assert.match(commandFile, /workflow\.discuss_mode/);
  assert.match(commandFile, /workflow\.skip_discuss/);
  assert.match(commandFile, /workflow\.research_before_questions/);
  assert.match(commandFile, /phase\.context/);
  assert.match(commandFile, /phase\.discussion-log/);
  assert.match(commandFile, /normalize the final context and discussion drafts to the returned `authoringTemplate`/i);
  assert.match(commandFile, /blocking anti-pattern check/i);
  assert.match(commandFile, /PROJECT\.md/);
  assert.match(commandFile, /REQUIREMENTS\.md/);
  assert.match(commandFile, /STATE\.md/);
  assert.match(commandFile, /existing plans.*\/blu-plan-phase|plan inventory.*\/blu-plan-phase/i);
  assert.match(commandFile, /gray areas/i);
  assert.match(commandFile, /next area|more questions/i);
  assert.match(commandFile, /canonical references/i);
  assert.match(commandFile, /deferred ideas/i);
  assert.match(commandFile, /structured gray-area/i);
  assert.match(commandFile, /answer is vague|retry the question/i);
  assert.match(commandFile, /power mode|chain mode|auto mode|auto-advance/i);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-discovery\.md|agents\/.+\.md/);

  assert.match(skillFile, /blocking anti-pattern check/i);
  assert.match(skillFile, /focused follow-up or retry the question/i);
  assert.match(skillFile, /fold deferred ideas into the saved context or discussion log/i);
  assert.match(skillFile, /Blueprint-friendly lenses/i);

  assert.match(docFile, /not a claim of full GSD parity/i);
  assert.match(docFile, /answer validation and retry/i);
  assert.match(docFile, /reuse of prior context and discussion artifacts/i);
  assert.match(docFile, /structured gray-area analysis/i);
  assert.match(docFile, /blocking anti-pattern check before save/i);
  assert.match(docFile, /folding deferred ideas into the saved record/i);
});

test("discuss-phase artifact flow seeds placeholders, persists real decisions, and clears checkpoints", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const first = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [
      ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
      ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
    ]
  });
  const second = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [
      ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
      ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
    ]
  });
  const checkpointCreated = await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint: {
      mode: "discuss",
      pendingTopics: ["Scope boundaries", "UI expectations"]
    }
  });
  const checkpointResumed = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "03"
  });
  const contextWrite = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    content: `# Phase 03: Phase Discovery - Context

## Phase Boundary
- Persist the durable discovery record for this phase.
- Keep decisions, dependencies, and open follow-ups available for later planning.
- Exclude execution plans and implementation details.
- Make it possible for the next phase to reuse the saved context without re-asking basics.

## Discovery Grounding
- Project brief - discovery should stay phase-scoped and resumable.
- Requirements grounding - keep the saved requirements visible in the context.
- Workflow posture - prefer evidence-backed questions and checkpointed follow-up.
- Confirmed decisions - discovery commands should persist real decisions, not only scaffold text.

## Dependencies
- Prior phase artifacts - the roadmap and any earlier context already on disk.
- External constraints - overwrite confirmation stays explicit.
- Follow-up reads - resume from saved checkpoints before restarting long discussions.

## Open Questions
- Which gray areas still need more user input?

## Deferred Ideas
- Scope creep or later follow-up - preserve unresolved discussion branches for the next pass.
- Ideas to revisit after this phase - canonical references that should be reused instead of re-elicited.

## Canonical References
- Source 1 - the saved roadmap, requirements, and phase artifacts that frame the discussion.
`,
    overwrite: true
  });
  const discussionWrite = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "03",
    artifact: "discussion-log",
    content: `# Phase 03 Discussion Log

## Notes
- Confirmed that overwrite stays explicit.
- Confirmed that checkpoint cleanup happens after successful context capture.
`,
    overwrite: true
  });
  const checkpointDeleted = await blueprintPhaseCheckpointDelete({
    cwd: repoPath,
    phase: "3"
  });
  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });
  const listed = await blueprintArtifactList({ cwd: repoPath });
  const contextBody = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    "utf8"
  );

  assert.deepEqual(first.createdFiles.sort(), [
    ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
    ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
  ]);
  assert.deepEqual(second.reusedFiles.sort(), [
    ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
    ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
  ]);
  assert.equal(checkpointCreated.updated, true);
  assert.equal(checkpointResumed.found, true);
  assert.deepEqual(checkpointResumed.checkpoint?.pendingTopics, [
    "Scope boundaries",
    "UI expectations"
  ]);
  assert.equal(contextWrite.written, true);
  assert.equal(discussionWrite.written, true);
  assert.equal(checkpointDeleted.deleted, true);
  assert.equal(
    context.phase?.artifacts.discussionLog,
    ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
  );
  assert.ok(
    listed.artifacts.phases.includes(".blueprint/phases/03-phase-discovery/03-CONTEXT.md")
  );
  assert.match(contextBody, /persist real decisions, not only scaffold text/i);
});
