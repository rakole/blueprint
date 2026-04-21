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
import { blueprintStateUpdate } from "../src/mcp/tools/state.js";

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
  assert.match(commandFile, /prior-context sweep/i);
  assert.match(commandFile, /dedicated todo\/backlog file crawl/i);
  assert.match(commandFile, /codebase scout/i);
  assert.match(commandFile, /stronger assumptions-mode analysis/i);
  assert.match(commandFile, /progress recap|session legibility/i);
  assert.match(commandFile, /checkpoint-per-area|checkpoint per area/i);
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
  assert.match(skillFile, /saved-artifact sweep, not a dedicated todo\/backlog file crawl/i);
  assert.match(skillFile, /Blueprint-friendly lenses/i);
  assert.match(skillFile, /prior-context sweep/i);
  assert.match(skillFile, /deferred-idea folding/i);
  assert.match(skillFile, /methodology/i);
  assert.match(skillFile, /codebase-scout reuse/i);
  assert.match(skillFile, /stronger assumptions-mode analysis/i);
  assert.match(skillFile, /progress recaps/i);
  assert.match(skillFile, /checkpoint-per-area/i);
  assert.match(skillFile, /end-of-run `STATE\.md` updates/i);

  assert.match(docFile, /not a claim of full GSD parity/i);
  assert.match(docFile, /answer validation and retry/i);
  assert.match(docFile, /prior-context sweeps across saved phase artifacts/i);
  assert.match(docFile, /methodology-shaped gray-area lenses/i);
  assert.match(docFile, /blocking anti-pattern check before save/i);
  assert.match(docFile, /folding deferred ideas into the saved record/i);
  assert.match(docFile, /prior-context sweeps/i);
  assert.match(docFile, /dedicated todo\/backlog file crawl/i);
  assert.match(docFile, /codebase scout summaries/i);
  assert.match(docFile, /stronger assumptions-mode analysis/i);
  assert.match(docFile, /checkpoint-per-area/i);
  assert.match(docFile, /progress recaps/i);
  assert.match(docFile, /end-of-run `STATE\.md` update/i);
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
      completedAreas: [],
      remainingAreas: ["Scope boundaries", "UI expectations"],
      decisions: [],
      deferredIdeas: [],
      canonicalReferences: [],
      resumeMeta: {
        mode: "discuss",
        pendingTopics: ["Scope boundaries", "UI expectations"],
        completedTopics: [],
        notes: [],
        updatedAt: "2026-04-11T00:00:00.000Z"
      }
    }
  });
  const checkpointResumed = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "03"
  });
  const checkpointAreaRefreshed = await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint: {
      completedAreas: ["Scope boundaries"],
      remainingAreas: ["UI expectations"],
      decisions: [
        {
          topic: "Scope boundaries",
          decision: "Keep the discussion scoped to phase 3",
          rationale: "Checkpoint per area for the discovery contract"
        }
      ],
      deferredIdeas: [
        {
          idea: "Revisit UI expectations after the scope boundary recap",
          revisitWhen: "After the next progress recap"
        }
      ],
      canonicalReferences: [
        {
          label: "ROADMAP.md",
          target: ".blueprint/ROADMAP.md",
          note: "Phase discovery anchor"
        }
      ],
      resumeMeta: {
        mode: "discuss",
        pendingTopics: ["UI expectations"],
        completedTopics: ["Scope boundaries"],
        currentQuestion: "What UI expectations still need input?",
        notes: ["Resume after the progress recap"],
        resumeHint: "Resume after the progress recap",
        updatedAt: "2026-04-11T00:00:01.000Z"
      }
    }
  });
  const checkpointAreaLoaded = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "3"
  });
  const scaffoldContextBody = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    "utf8"
  );
  assert.match(scaffoldContextBody, /<implementation decision 1>/i);
  assert.match(scaffoldContextBody, /<specific idea 1>/i);
  assert.match(scaffoldContextBody, /<existing code insight 1>/i);
  assert.match(scaffoldContextBody, /<source 1>/i);
  const contextWrite = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    content: `# Phase 03: Phase Discovery - Context

## Phase Boundary
- Keep discovery scoped to phase 3 and the saved artifacts in .blueprint/phases/03-phase-discovery/.
- Capture durable context, not planning or execution detail.
- Leave the next safe action in STATE.md.

## Discovery Grounding
- Project brief - discovery should stay phase-scoped and resumable.
- Requirements grounding - keep the saved requirements visible in the context.
- Workflow posture - prefer evidence-backed questions, progress recaps, and checkpointed follow-up.
- Prior-context sweep - review existing context, discussion log, and codebase scout notes before asking fresh questions.

## Implementation Decisions
- Use one-question ask_user branching for gray areas and resume/discard decisions.
- Record stronger assumptions-mode analysis when the workflow posture asks for evidence-first corrections.
- Refresh checkpoint-per-area state after each major gray area so the flow can resume cleanly.
- End with an explicit STATE.md update that points to /blu-progress.

## Specific Ideas
- Keep a short progress recap after each area so the session stays legible.
- Fold deferred ideas into the saved record.
- Reuse canonical references instead of re-eliciting them.

## Existing Code Insights
- The codebase scout notes are the right place for brownfield constraints and reusable patterns.
- Existing artifacts already identify the phase directory and the current roadmap anchor.

## Dependencies
- Prior phase artifacts, the roadmap, and saved checkpoint state all constrain the next questions.
- The command must not advertise power, chain, or auto behavior as shipped.
- Explicit overwrite confirmation is required before replacing substantive context.

## Open Questions
- Which gray area should be discussed next?
- What follow-up depends on the current phase checkpoint?

## Deferred Ideas
- Revisit any follow-up ideas that were already captured in the context after the current area closes.
- Preserve later follow-up ideas in the discussion log rather than dropping them.

## Canonical References
- ROADMAP.md and STATE.md define the current phase boundary and follow-up routing.
- Prior phase context and discussion-log artifacts hold the saved discovery history.
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
  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      activeCommand: "/blu-progress",
      nextAction: "Run /blu-progress to review the saved discovery context",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });
  const listed = await blueprintArtifactList({ cwd: repoPath });
  const contextBody = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    "utf8"
  );
  const stateBody = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

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
  assert.deepEqual(checkpointResumed.checkpoint?.resumeMeta?.pendingTopics, [
    "Scope boundaries",
    "UI expectations"
  ]);
  assert.equal(checkpointAreaRefreshed.updated, true);
  assert.equal(checkpointAreaLoaded.found, true);
  assert.deepEqual(checkpointAreaLoaded.checkpoint?.completedAreas, ["Scope boundaries"]);
  assert.deepEqual(checkpointAreaLoaded.checkpoint?.resumeMeta?.completedTopics, ["Scope boundaries"]);
  assert.equal(
    checkpointAreaLoaded.checkpoint?.resumeMeta?.currentQuestion,
    "What UI expectations still need input?"
  );
  assert.equal(contextWrite.written, true);
  assert.equal(contextWrite.overwritten, true);
  assert.equal(discussionWrite.written, true);
  assert.equal(checkpointDeleted.deleted, true);
  assert.deepEqual(stateUpdate.updatedFields.sort(), ["lastUpdated", "nextAction"].sort());
  assert.equal(stateUpdate.statePath, ".blueprint/STATE.md");
  assert.equal(
    context.phase?.artifacts.discussionLog,
    ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
  );
  assert.ok(
    listed.artifacts.phases.includes(".blueprint/phases/03-phase-discovery/03-CONTEXT.md")
  );
  assert.match(contextBody, /checkpoint-per-area/i);
  assert.notEqual(contextBody, scaffoldContextBody);
  assert.match(stateBody, /Run \/blu-progress to review the saved discovery context/);
});
