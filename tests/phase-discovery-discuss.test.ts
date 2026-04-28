import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
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
import { blueprintStateLoad, blueprintStateUpdate } from "../src/mcp/tools/state.js";

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
  const discussReference = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md"
    ),
    "utf8"
  );
  const researcherAgent = await readFile(
    path.join(repoRoot, "agents/blueprint-researcher.md"),
    "utf8"
  );
  const runtimeReference = await readFile(
    path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"),
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
    "blueprint_state_update",
    "blueprint_state_load"
  ] as const;

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  const sharedProfilePath =
    "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md";
  const runtimeContractPath =
    "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md";
  const sharedProfile = await readFile(path.join(repoRoot, sharedProfilePath), "utf8");

  const runtimeToolCalls = [...commandFile.matchAll(/mcp_blueprint_blueprint_[a-z_]+/g)]
    .map(([tool]) => tool)
    .sort();
  assert.deepEqual(
    [...new Set(runtimeToolCalls)],
    requiredTools.map((toolName) => blueprintRuntimeToolFqn(toolName)).sort()
  );

  assert.match(commandFile, /Use the `blueprint-phase-discovery` skill/);
  assert.match(commandFile, new RegExp(runtimeContractPath));
  assert.match(commandFile, new RegExp(sharedProfilePath));
  assert.match(commandFile, /contract\.authoringTemplate.*schema authority/i);
  assert.match(commandFile, /referenced runtime contract as the source of truth/i);
  assert.match(commandFile, /substantive user-authored artifacts/i);
  assert.match(commandFile, /host-supported structured choices/i);
  assert.match(commandFile, /Do not infer a direct `\/blu-plan-phase` handoff/i);
  assert.match(commandFile, /derivedStatus\.nextAction/);
  assert.doesNotMatch(commandFile, /type:\s*"choice"|2-4 labeled options|Type your own answer/i);
  assert.doesNotMatch(commandFile, /Follow this flow exactly/i);
  assert.doesNotMatch(commandFile, /\n1\. Resolve the target phase/i);
  assert.doesNotMatch(commandFile, /Map the discovery flow onto the shared stages/i);
  assert.doesNotMatch(commandFile, /power mode|chain mode|auto mode|auto-advance/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-discovery\.md|agents\/.+\.md/);

  assert.match(sharedProfile, /# Long-Running Phase Discovery Profile/);
  for (const stage of ["Resolve", "Read", "Decide", "Execute", "Persist", "Validate", "Route"]) {
    assert.match(sharedProfile, new RegExp(`\`${stage}\``));
  }
  assert.match(sharedProfile, /resolved scope/);
  assert.match(sharedProfile, /pending gate/);
  assert.match(sharedProfile, /`update_topic` and `write_todos`/);
  assert.match(sharedProfile, /host-supported structured choices/i);

  assert.match(skillFile, new RegExp(runtimeContractPath));
  assert.match(skillFile, new RegExp(sharedProfilePath));
  assert.match(skillFile, /contract\.authoringTemplate.*schema authority/i);
  assert.match(skillFile, /derivedStatus\.nextAction/);
  assert.match(skillFile, /Command-Scoped Required MCP Tools/i);
  const discussToolSection = skillFile.match(
    /### `\/blu-discuss-phase`\n([\s\S]*?)(?=\n### `\/blu-research-phase`)/
  )?.[1] ?? "";
  const skillDiscussTools = [...discussToolSection.matchAll(/`(blueprint_[a-z_]+)`/g)]
    .map(([, tool]) => tool)
    .sort();
  assert.deepEqual(skillDiscussTools, [...requiredTools].sort());
  assert.doesNotMatch(discussToolSection, /`blueprint_project_status`/);
  assert.doesNotMatch(discussToolSection, /`blueprint_phase_research_status`/);
  assert.doesNotMatch(discussToolSection, /`blueprint_command_catalog`/);

  assert.match(discussReference, /blueprint_state_update` with `base: "synced"/i);
  assert.match(discussReference, /blueprint_state_load[\s\S]*refreshed\s+next safe action/i);
  assert.match(discussReference, /Do not infer `\/blu-plan-phase`/i);
  assert.match(discussReference, /`derivedStatus\.nextAction`/);
  assert.match(
    discussReference,
    /Delete the checkpoint only after[\s\S]*context write[\s\S]*optional discussion-log[\s\S]*synced state update[\s\S]*state load/i
  );
  const contract = await buildBlueprintCommandRuntimeContractResource("discuss-phase");

  assert.deepEqual(contract.skillInputs.shared, [
    "docs/ARTIFACT-SCHEMA.md",
    "docs/MCP-TOOLS.md"
  ]);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "docs/commands/discuss-phase.md",
    runtimeContractPath,
    sharedProfilePath
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "docs/ARTIFACT-SCHEMA.md",
    "docs/MCP-TOOLS.md",
    "docs/commands/discuss-phase.md",
    runtimeContractPath,
    sharedProfilePath
  ]);
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/research-phase.md"),
    false
  );
  assert.equal(contract.skillInputs.effective.includes("docs/commands/ui-phase.md"), false);
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/list-phase-assumptions.md"),
    false
  );

  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docFile, new RegExp(sharedProfilePath));
  assert.match(docFile, new RegExp(runtimeContractPath));
  assert.match(docFile, /Writes only declared `\.blueprint\/` phase artifacts, checkpoints, and `STATE\.md`/);
  assert.match(docFile, /without inferring a direct `\/blu-plan-phase` handoff/i);
  assert.doesNotMatch(docFile, /may also mutate code or git state/i);

  const discussRuntimeRow = runtimeReference
    .split("\n")
    .find((line) => line.startsWith("| `discuss-phase` |"));
  assert.ok(discussRuntimeRow, "runtime reference should include the discuss-phase row");
  assert.match(discussRuntimeRow, new RegExp(sharedProfilePath));
  assert.match(discussRuntimeRow, new RegExp(runtimeContractPath));
  assert.match(discussRuntimeRow, /contract\.authoringTemplate/i);
  assert.match(discussRuntimeRow, /`blueprint_state_load`/);
  assert.match(discussRuntimeRow, /lightweight gray-area memo mode/i);
  assert.match(discussRuntimeRow, /single-agent fallback/i);
  assert.doesNotMatch(
    discussRuntimeRow,
    /use Gemini-native `update_topic` and `write_todos`[\s\S]*helpers are unavailable/i
  );

  assert.match(discussReference, /# Discuss Phase Runtime Contract/);
  assert.match(discussReference, new RegExp(sharedProfilePath));
  assert.match(discussReference, /schema authority/i);
  assert.match(discussReference, /Capability-Gated Agent Use/);
  assert.match(discussReference, /gray-area memo mode/i);
  assert.match(discussReference, /Do not ask it to populate `phase\.research` or draft\s+`XX-RESEARCH\.md`/i);
  assert.match(discussReference, /Single-Agent Fallback/);
  assert.match(discussReference, /compress carry-forward context/i);
  assert.match(discussReference, /Assumptions Mode/);
  assert.match(discussReference, /consequence if the assumption is wrong/i);
  assert.match(discussReference, /Artifact Authoring/);
  assert.match(discussReference, /Validation And Repair/);
  assert.match(discussReference, /status: "invalid"/);
  assert.match(discussReference, /Do not claim unshipped power, batch, chain, auto, or auto-advance behavior/i);
  assert.match(researcherAgent, /Output Mode Selection/);
  assert.match(researcherAgent, /gray-area memo mode/);
  assert.match(researcherAgent, /not a populated `phase\.research` or\s+`XX-RESEARCH\.md` body/i);
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
      ownerCommand: "/blu-discuss-phase",
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
      ownerCommand: "/blu-discuss-phase",
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
  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-discuss-phase",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  const checkpointDeleted = await blueprintPhaseCheckpointDelete({
    cwd: repoPath,
    phase: "3",
    expectedOwnerCommand: "/blu-discuss-phase",
    expectedMode: "discuss"
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
  assert.equal(checkpointResumed.safeToResume, true);
  assert.deepEqual(checkpointResumed.checkpoint?.resumeMeta?.pendingTopics, [
    "Scope boundaries",
    "UI expectations"
  ]);
  assert.equal(checkpointAreaRefreshed.updated, true);
  assert.equal(checkpointAreaLoaded.found, true);
  assert.equal(checkpointAreaLoaded.ownerCommand, "/blu-discuss-phase");
  assert.equal(checkpointAreaLoaded.resumeMode, "discuss");
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
  assert.deepEqual(stateUpdate.updatedFields.sort(), ["activeCommand", "lastUpdated"].sort());
  assert.equal(stateUpdate.statePath, ".blueprint/STATE.md");
  assert.equal(loadedState.state.activeCommand, "/blu-discuss-phase");
  assert.match(loadedState.derivedStatus.nextAction, /\/blu-research-phase 3/);
  assert.equal(
    context.phase?.artifacts.discussionLog,
    ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
  );
  assert.ok(
    listed.artifacts.phases.includes(".blueprint/phases/03-phase-discovery/03-CONTEXT.md")
  );
  assert.match(contextBody, /checkpoint-per-area/i);
  assert.notEqual(contextBody, scaffoldContextBody);
  assert.match(stateBody, /Run \/blu-research-phase 3 to capture phase research/);
});

test("discuss-phase keeps checkpoint when final synced state update fails", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint: {
      ownerCommand: "/blu-discuss-phase",
      completedAreas: ["Scope boundaries"],
      remainingAreas: ["UI expectations"],
      decisions: [
        {
          topic: "Scope boundaries",
          decision: "Keep checkpoint deletion gated on final state sync",
          rationale: "The command should remain resumable if finalization fails"
        }
      ],
      deferredIdeas: [],
      canonicalReferences: [
        {
          label: "STATE.md",
          target: ".blueprint/STATE.md",
          note: "Final routing state"
        }
      ],
      resumeMeta: {
        mode: "discuss",
        pendingTopics: ["UI expectations"],
        completedTopics: ["Scope boundaries"],
        currentQuestion: "What should resume after state sync is repaired?",
        notes: ["Do not delete before synced state update and state load complete."],
        resumeHint: "Repair STATE.md, then resume finalization.",
        updatedAt: "2026-04-11T00:00:02.000Z"
      }
    }
  });
  await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    content: `# Phase 03: Phase Discovery - Context

## Phase Boundary
- Keep discovery scoped to phase 3 and preserve resumability until final state sync succeeds.
- Capture durable context, not planning or execution detail.
- Leave the next safe action in STATE.md.

## Discovery Grounding
- Project brief - discovery should stay phase-scoped and resumable.
- Requirements grounding - keep the saved requirements visible in the context.
- Workflow posture - finalization should report routing from refreshed state.
- Prior-context sweep - review existing context, checkpoint state, and roadmap evidence before closing.

## Implementation Decisions
- Call state_update with base synced only after context and optional discussion-log writes succeed.
- Call state_load after state_update and use the loaded next action for the summary.
- Keep the checkpoint if final state sync or state load fails.

## Specific Ideas
- Gate checkpoint deletion on the full finalize sequence.
- Use the checkpoint resume hint to recover from a state write failure.
- Prefer /blu-progress if refreshed routing is unclear.

## Existing Code Insights
- STATE.md is the durable routing surface.
- The phase checkpoint carries the current question and completed areas.

## Dependencies
- Context writes, optional discussion logs, synced state update, and state load all precede checkpoint deletion.
- The command must not treat state_update.updatedFields as routing.
- Explicit overwrite confirmation is required before replacing substantive context.

## Open Questions
- What follow-up should resume if finalization fails?
- Which state repair should happen before checkpoint deletion?

## Deferred Ideas
- Revisit checkpoint deletion only after state routing is refreshed.
- Preserve follow-up ideas in the saved context.

## Canonical References
- STATE.md defines the refreshed next safe action.
- The discuss checkpoint defines resumability after a failed finalize attempt.
`,
    overwrite: true
  });

  await rm(path.join(repoPath, ".blueprint/STATE.md"), { force: true });
  await mkdir(path.join(repoPath, ".blueprint/STATE.md"));

  await assert.rejects(
    blueprintStateUpdate({
      cwd: repoPath,
      base: "synced",
      patch: {
        activeCommand: "/blu-discuss-phase"
      }
    }),
    /EISDIR|directory/i
  );

  const retained = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "3"
  });

  assert.equal(retained.found, true);
  assert.deepEqual(retained.checkpoint?.completedAreas, ["Scope boundaries"]);
  assert.equal(
    retained.checkpoint?.resumeMeta?.resumeHint,
    "Repair STATE.md, then resume finalization."
  );
});

test("discuss-phase context validation blocks runtime anti-patterns and preserves checkpoint", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint: {
      ownerCommand: "/blu-discuss-phase",
      completedAreas: ["Scope boundaries"],
      remainingAreas: ["Plan inventory warning"],
      decisions: [
        {
          topic: "Scope boundaries",
          decision: "Keep validation repair resumable",
          rationale: "The checkpoint must survive a failed artifact repair attempt."
        }
      ],
      deferredIdeas: [
        {
          idea: "Revisit plan inventory after context repair",
          revisitWhen: "After the validation issues are fixed"
        }
      ],
      canonicalReferences: [
        {
          label: "ROADMAP.md",
          target: ".blueprint/ROADMAP.md"
        }
      ],
      resumeMeta: {
        mode: "discuss",
        pendingTopics: ["Plan inventory warning"],
        completedTopics: ["Scope boundaries"],
        currentQuestion: "Which warning must be preserved in repaired context?",
        notes: ["Validation repair is still in progress."],
        updatedAt: "2026-04-20T00:00:00.000Z"
      }
    }
  });

  const invalidContext = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    content: `# Phase 03: Phase Discovery - Context

## Phase Boundary
- Keep discovery scoped to phase 3 and preserve resumability.

## Discovery Grounding
- Project brief and requirements grounding are available in saved Blueprint artifacts.

## Implementation Decisions
- Auto mode is shipped and power mode is available for this command.

## Specific Ideas
- Later follow-up: revisit plan inventory after the context is repaired.

## Existing Code Insights
- Artifact validation runs through the phase artifact write tool.

## Dependencies
- Existing plans already cover this phase and should be mentioned in the closeout.

## Open Questions
- Which validation repair should happen before finalization?

## Deferred Ideas
- No deferred ideas.

## Canonical References
- No canonical references identified yet.
`,
    overwrite: true
  });

  const retained = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "3"
  });

  assert.equal(invalidContext.status, "invalid");
  assert.equal(invalidContext.written, false);
  assert.match(invalidContext.validation.issues.join("\n"), /unsupported discuss-phase behavior/i);
  assert.match(invalidContext.validation.issues.join("\n"), /Canonical References/i);
  assert.match(invalidContext.validation.issues.join("\n"), /Deferred Ideas section/i);
  assert.match(invalidContext.validation.warnings.join("\n"), /\/blu-plan-phase refresh warning/i);
  assert.equal(retained.found, true);
  assert.deepEqual(retained.checkpoint?.remainingAreas, ["Plan inventory warning"]);
});

test("discuss-phase write keeps overwrite explicit for authored invalid artifacts", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const contextPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"
  );
  await writeFile(
    contextPath,
    `# Phase 03 Context

## Phase Boundary
- User-authored but incomplete context.
`,
    "utf8"
  );

  await assert.rejects(
    () =>
      blueprintPhaseArtifactWrite({
        cwd: repoPath,
        phase: "3",
        artifact: "context",
        content: `# Phase 03 Context

## Phase Boundary
- Repair the incomplete context after confirmation.

## Discovery Grounding
- Project brief - keep the repair phase scoped.
- Requirements grounding - preserve saved requirements.
- Workflow posture - use discuss-phase only.
- Confirmed decisions - repair after explicit confirmation.

## Implementation Decisions
- Decision 1 - keep overwrite explicit for authored invalid artifacts.
- Tradeoffs or constraints - scaffold replacement remains the only implicit replace path.

## Specific Ideas
- Specific idea 1 - retain validated repair behavior.

## Existing Code Insights
- Existing code insight 1 - the phase artifact writer owns overwrite protection.

## Dependencies
- Prior phase artifacts - existing context.
- External constraints - explicit confirmation.
- Required follow-up reads - roadmap and phase context.

## Open Questions
- Which details still need user confirmation?

## Deferred Ideas
- Later follow-up - revisit after planning.

## Canonical References
- .blueprint/ROADMAP.md
`
      }),
    /already exists/
  );
});

test("discuss-phase discussion-log validation blocks dropped follow-ups and mode claims", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalidDiscussion = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "discussion-log",
    content: `# Phase 03 Discussion Log

## Summary
- Chain mode is supported for this command.

## Notes
- The discussion raised a later follow-up for reviewer routing.

## Follow-Ups
- none
`,
    overwrite: true
  });

  assert.equal(invalidDiscussion.status, "invalid");
  assert.match(invalidDiscussion.validation.issues.join("\n"), /chain mode/i);
  assert.match(invalidDiscussion.validation.issues.join("\n"), /Follow-Ups section/i);
});

test("discuss-phase checkpoint reads flag research-owned continuation state as unsafe", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint: {
      ownerCommand: "/blu-research-phase",
      completedAreas: ["Dependency scan"],
      remainingAreas: ["Recommendation synthesis"],
      decisions: [
        {
          topic: "Research strand",
          decision: "Continue bounded research before drafting",
          rationale: "The evidence pass is not complete enough for the research artifact."
        }
      ],
      deferredIdeas: [],
      canonicalReferences: [
        {
          label: "Context",
          target: ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"
        }
      ],
      resumeMeta: {
        mode: "research",
        pendingTopics: ["Recommendation synthesis"],
        completedTopics: ["Dependency scan"],
        currentQuestion: "Which recommendation should the research artifact preserve?",
        notes: ["This is research continuation state, not discuss-phase state."],
        updatedAt: "2026-04-19T00:00:03.000Z"
      }
    }
  });

  const checkpoint = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "3",
    expectedOwnerCommand: "/blu-discuss-phase",
    expectedMode: "discuss"
  });

  assert.equal(checkpoint.found, true);
  assert.equal(checkpoint.ownerCommand, "/blu-research-phase");
  assert.equal(checkpoint.resumeMode, "research");
  assert.equal(checkpoint.safeToResume, false);
  assert.match(checkpoint.warnings.join("\n"), /belongs to \/blu-research-phase/i);
  assert.match(checkpoint.warnings.join("\n"), /not "discuss"/i);
});

test("discuss-phase checkpoint reads warn instead of crashing on legacy foreign checkpoints", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const checkpointPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json"
  );
  const legacyResearchCheckpoint = {
    mode: "research",
    pendingTopics: ["Recommendation synthesis"],
    currentQuestion: "Which source remains unverified?",
    updatedAt: "2026-04-19T00:00:04.000Z"
  };

  await writeFile(
    checkpointPath,
    `${JSON.stringify(legacyResearchCheckpoint, null, 2)}\n`,
    "utf8"
  );

  const checkpoint = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "3",
    expectedOwnerCommand: "/blu-discuss-phase",
    expectedMode: "discuss"
  });

  assert.equal(checkpoint.found, true);
  assert.deepEqual(checkpoint.checkpoint, legacyResearchCheckpoint);
  assert.equal(checkpoint.ownerCommand, null);
  assert.equal(checkpoint.resumeMode, "research");
  assert.equal(checkpoint.safeToResume, false);
  assert.match(checkpoint.warnings.join("\n"), /legacy checkpoint/i);
  assert.match(checkpoint.warnings.join("\n"), /not "discuss"/i);
});

test("checkpoint persistence rejects unknown resume modes and owner-mode mismatches", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const baseCheckpoint = {
    ownerCommand: "/blu-discuss-phase",
    completedAreas: [],
    remainingAreas: ["Scope boundaries"],
    decisions: [],
    deferredIdeas: [],
    canonicalReferences: [],
    resumeMeta: {
      mode: "discuss",
      pendingTopics: ["Scope boundaries"],
      completedTopics: [],
      notes: [],
      updatedAt: "2026-04-19T00:00:05.000Z"
    }
  };

  await assert.rejects(
    blueprintPhaseCheckpointPut({
      cwd: repoPath,
      phase: "3",
      checkpoint: {
        ...baseCheckpoint,
        resumeMeta: {
          ...baseCheckpoint.resumeMeta,
          mode: "sidequest"
        }
      } as Parameters<typeof blueprintPhaseCheckpointPut>[0]["checkpoint"]
    }),
    /Invalid option|structured discuss checkpoint/i
  );

  await assert.rejects(
    blueprintPhaseCheckpointPut({
      cwd: repoPath,
      phase: "3",
      checkpoint: {
        ...baseCheckpoint,
        ownerCommand: "/blu-research-phase"
      } as Parameters<typeof blueprintPhaseCheckpointPut>[0]["checkpoint"]
    }),
    /must use resumeMeta\.mode "research"/i
  );
});
