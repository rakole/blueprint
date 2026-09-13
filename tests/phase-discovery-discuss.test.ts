import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import {
  blueprintArtifactScaffold,
  blueprintArtifactList,
  validatePhaseArtifactContent
} from "../src/mcp/tools/artifacts.js";
import {
  blueprintPhaseArtifactWrite,
  blueprintPhaseCheckpointDelete,
  blueprintPhaseCheckpointGet,
  blueprintPhaseCheckpointPut,
  blueprintPhaseContext
} from "../src/mcp/tools/phase.js";
import { blueprintStateLoad, blueprintStateUpdate } from "../src/mcp/tools/state.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();
const discussRuntimeContractPath =
  "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md";
const discussCommandPath = "commands/blu-discuss-phase.toml";
const discussSkillPath = "skills/blueprint-phase-discovery/SKILL.md";
function readRepoText(relativePath: string): string { return readFileSync(path.join(repoRoot, relativePath), "utf8"); }

test("discuss active bundle is bounded and uses registered prepare/record/finalize persistence", async () => {
  const contract = await buildBlueprintCommandRuntimeContractResource("discuss-phase");
  const tools = ["blueprint_discuss_prepare", "blueprint_discuss_record", "blueprint_discuss_read", "blueprint_discuss_finalize"];
  assert.deepEqual(contract.catalog.requiredTools, tools);
  for (const tool of tools) {
    assert.ok(blueprintToolNames.includes(tool));
    assert.ok(readRepoText(discussCommandPath).includes(blueprintRuntimeToolFqn(tool as `blueprint_${string}`)));
  }
  assert.deepEqual(contract.skillInputs.effective, [discussRuntimeContractPath]);
  const bytes = [discussCommandPath, discussSkillPath, discussRuntimeContractPath].reduce((n, p) => n + Buffer.byteLength(readRepoText(p)), 0);
  assert.ok(bytes < 13000, `Active discuss prompt bytes: ${bytes}`);
  const runtime = readRepoText(discussRuntimeContractPath);
  for (const rule of [/user pick areas/, /authoritative WHAT\/WHY/, /explicit user confirmation/, /missingEssentialFields/, /model, the current expectedRevision/, /Generated and rejected documents are not stored/, /downstreamOwner/, /record history/, /derivedStatus.nextAction/, /workflow.subagents/, /same.*requestId/s]) assert.match(runtime, rule);
  assert.doesNotMatch(runtime, /nine.read|checkpoint.per.area|prior.context sweep/i);
});

function discussCheckpoint(areaQueue: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    schemaVersion: 2,
    ownerCommand: "/blu-discuss-phase",
    mode: "discuss",
    progress: {
      activeStage: "Execute",
      pendingGate: "gray-area-question",
      executionMode: "discuss/resumed",
      areasDecided: areaQueue.filter((area) => area.state === "decided").length,
      areasTotal: areaQueue.length,
      nextActionPreview: "Resume the next discuss-phase area"
    },
    areaQueue,
    carryForward: {
      phaseBoundary: [],
      completedDecisions: [],
      openQuestions: [],
      deferredIdeas: [],
      canonicalReferences: [],
      contradictions: [],
      doNotInferBeyond: []
    },
    readSet: [".blueprint/ROADMAP.md"]
  };
}

function researchCheckpoint(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    ownerCommand: "/blu-research-phase",
    mode: "research",
    researchLedger: {
      schemaVersion: "research-ledger/v1",
      strands: [
        {
          id: "S1",
          type: "repo-map",
          status: "blocked",
          question: "Which recommendation should the research artifact preserve?"
        }
      ],
      nextAction: {
        stage: "Execute",
        pendingGate: "research-continuation",
        safeCommand: "/blu-research-phase 3"
      }
    }
  };
}

async function createPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-discuss-phase-");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
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

async function createEarlierSelectedDiscussPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-discuss-earlier-phase-");

  await mkdir(path.join(repoPath, ".blueprint/phases/02-earlier-discovery"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/03-later-delivery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Explicit Earlier Phase Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 2: Earlier Discovery**
- [ ] **Phase 3: Later Delivery**
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
    JSON.stringify(
      {
        version: 2,
        workflow: {
          research: false,
          ui_phase: true
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-later-delivery/03-CONTEXT.md"),
    `# Phase 03: Later Delivery - Context

## Decisions
- The later roadmap phase is already ready for planning once it becomes the active phase again.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-later-delivery/03-UI-SPEC.md"),
    `# Phase 03: Later Delivery - UI Spec

## Decisions
- The later roadmap phase already has its UI contract.
`,
    "utf8"
  );

  return repoPath;
}

function buildValidDiscussContext(openQuestionsSection: string): string {
  return `# Phase 03: Phase Discovery - Context

## Phase Boundary
- Phase goal - keep discuss-phase context durable and phase-scoped.
- Included work - persist discovery decisions that planning can consume directly.
- Excluded work - rewriting later lifecycle artifacts during discovery.
- Success target - saved context preserves boundaries, dependencies, and next-step inputs.

## Discovery Grounding
- Product brief - Blueprint keeps phase discovery artifacts under .blueprint/phases/.
- Requirements trace - discovery output must remain usable by research, UI, and planning commands.
- Workflow stance - discuss-phase owns context authoring and repair before downstream work begins.
- Locked decisions - persistent writes stay MCP-owned and phase-scoped.

## Implementation Decisions
- Decision: Allow Open Questions to use an exact empty-state sentinel when no unresolved questions remain.
- Tradeoff or constraint: Only the explicit contract-owned sentinel should bypass the usual substantive-content rule.

## Specific Ideas
- Specific idea 1: Keep the authoring template explicit so the model does not invent filler prose.
- Specific idea 2: Preserve exact sentinel behavior through validation and repair loops.
- Later follow-up: Reuse the same section-level pattern for future contracts only when needed.

## Existing Code Insights
- Existing code insight 1: Phase artifact validation already centralizes section-level checks.
- Reusable pattern: Artifact contracts can carry opt-in metadata for individual headings.
- Known gap or caution: Fuzzy empty-state prose must not pass as substantive content.

## Dependencies
- Prior phase artifacts: .blueprint/phases/03-phase-discovery/03-CONTEXT.md when it already exists.
- External constraints: Discuss-phase must not weaken downstream planning detail requirements.
- Required follow-up reads: src/mcp/artifact-contracts/index.ts and src/mcp/tools/artifacts.ts.

## Open Questions
${openQuestionsSection}

## Deferred Ideas
- Scope creep or later follow-up: Apply the same sentinel pattern to other artifacts only after a concrete need appears.
- Ideas to revisit after this phase: Evaluate whether model-backed phase.context writes should also enforce the same sentinel semantics.

## Canonical References
- Source 1: src/mcp/artifact-contracts/index.ts
- Source 2: src/mcp/tools/artifacts.ts`;
}

function backendOnlyNoUiContextContent(phaseNumber: string, phaseName: string): string {
  const prefix = phaseNumber.padStart(2, "0");

  return `# Phase ${prefix}: ${phaseName} - Context

## Phase Boundary
- Backend-only API phase with no user-facing work in scope.
- Included work - persist discovery outputs for the explicitly selected phase only.
- Excluded work - letting later roadmap phases override selected-phase routing.
- Success target - downstream commands continue on the same selected phase.

## Discovery Grounding
- Project brief - This phase is purely backend and not user-facing.
- Requirements grounding - downstream research and planning work must stay phase-scoped.
- Workflow posture - synced state refresh should preserve an explicit earlier-phase selection.
- Locked decisions - MCP-owned state writes are the only persistence path.

## Implementation Decisions
- Decision: preserve the resolved selected phase during synced state refresh.
- Tradeoff or constraint: roadmap-derived current phase alone is not enough when the user selected an earlier phase.

## Specific Ideas
- Specific idea 1: keep the phase selection explicit in the final sync patch.
- Specific idea 2: make regression coverage assert earlier-phase routing.

## Existing Code Insights
- Existing code insight 1: state sync recomputes routing from artifacts and the current phase.
- Reusable pattern: patch currentPhase during synced updates when a command resolved a different selected phase.
- Known gap or caution: roadmap-only sync can drift to a later phase.

## Dependencies
- Prior phase artifacts: selected phase context and research stay under the same phase directory.
- External constraints: no host-global state writes.
- Required follow-up reads: src/mcp/tools/state.ts

## Open Questions
- none

## Deferred Ideas
- Scope creep or later follow-up: generalize this regression shape for later lifecycle commands if needed.

## Canonical References
- Source 1: src/mcp/tools/state.ts`;
}

// Product orchestration is covered by discuss-prepare and discuss-persistence runtime tests.
// Keep primitive artifact/checkpoint compatibility checks below for downstream consumers.

test("discuss-phase context validation accepts the exact Open Questions none sentinel", () => {
  const validation = validatePhaseArtifactContent(buildValidDiscussContext("- none"), "context");

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test("discuss-phase context validation allows intentional placeholder token prose", () => {
  const content = buildValidDiscussContext("- none").replace(
    "## Deferred Ideas\n- Scope creep or later follow-up: Apply the same sentinel pattern to other artifacts only after a concrete need appears.",
    "## Deferred Ideas\n- Scope creep or later follow-up: Keep placeholder {url}.{portNumber} documented until the endpoint wiring phase replaces it."
  );
  const validation = validatePhaseArtifactContent(content, "context");

  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.doesNotMatch(validation.issues.join("\n"), /placeholder scaffold text/i);
});

test("discuss-phase context validation accepts varied Open Questions empty-state variants", () => {
  const invalidSections = [
    "none",
    "- None that block this fixture.",
    "- no open questions currently"
  ];

  for (const invalidSection of invalidSections) {
    const validation = validatePhaseArtifactContent(
      buildValidDiscussContext(invalidSection),
      "context"
    );

    assert.equal(validation.valid, true, validation.issues.join("\n"));
  }
});

test("discuss-phase context validation accepts varied Deferred Ideas none sentinel", () => {
  const baseContext = buildValidDiscussContext("- none").replace(
    "- Later follow-up: Reuse the same section-level pattern for future contracts only when needed.",
    "- Implementation note: Keep section-level validation deterministic for current contracts."
  );
  const valid = validatePhaseArtifactContent(
    baseContext.replace(
      "## Deferred Ideas\n- Scope creep or later follow-up: Apply the same sentinel pattern to other artifacts only after a concrete need appears.\n- Ideas to revisit after this phase: Evaluate whether model-backed phase.context writes should also enforce the same sentinel semantics.",
      "## Deferred Ideas\n- none"
    ),
    "context"
  );

  assert.equal(valid.valid, true, valid.issues.join("\n"));

  for (const invalidSection of ["none", "- no deferred ideas currently", "- nothing deferred"]) {
    const invalid = validatePhaseArtifactContent(
      baseContext.replace(
        "## Deferred Ideas\n- Scope creep or later follow-up: Apply the same sentinel pattern to other artifacts only after a concrete need appears.\n- Ideas to revisit after this phase: Evaluate whether model-backed phase.context writes should also enforce the same sentinel semantics.",
        `## Deferred Ideas\n${invalidSection}`
      ),
      "context"
    );

    assert.equal(invalid.valid, true, invalid.issues.join("\n"));
  }
});

test("discuss-phase context validation allows honest none in optional presentation sections", () => {
  const validation = validatePhaseArtifactContent(
    buildValidDiscussContext("- none").replace(
      "## Specific Ideas\n- Specific idea 1: Keep the authoring template explicit so the model does not invent filler prose.\n- Specific idea 2: Preserve exact sentinel behavior through validation and repair loops.\n- Later follow-up: Reuse the same section-level pattern for future contracts only when needed.",
      "## Specific Ideas\n- none"
    ),
    "context"
  );

  assert.equal(validation.valid, true);
  assert.doesNotMatch(validation.issues.join("\n"), /Specific Ideas/i);
  assert.doesNotMatch(validation.issues.join("\n"), /Open Questions/i);
});

test("discuss-phase context write preserves the exact Open Questions none sentinel", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const writeResult = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({ openQuestions: ["none"] }),
    overwrite: true
  });

  assert.equal(writeResult.status, "created");
  assert.equal(writeResult.written, true);

  const saved = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    "utf8"
  );

  assert.match(saved, /## Open Questions\n\n- none\n/);
  assert.doesNotMatch(saved, /None that block this phase|no open questions currently/i);
});

test("discuss-phase context write normalizes deferredIdeas none alias in the structured model", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const writeResult = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({ deferredIdeas: ["none"] }),
    overwrite: true
  });

  assert.equal(writeResult.status, "created");
  assert.equal(writeResult.written, true);
});

test("discuss-phase context write replaces starter handoff packet with carried-forward model content", async (t) => {
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
    `# Phase 03: Phase Discovery - Context

## Starter Handoff Packet
- Source refs: .blueprint/ROADMAP.md, .blueprint/REQUIREMENTS.md
- Deferred risks: UI applicability is still unclear until the discovery boundary is confirmed.
- Open gray areas: whether research should run before fresh questions.

---
*Generated by \`blueprint_artifact_scaffold\`*
`,
    "utf8"
  );

  const model = validPhaseContextModel({
    projectBrief: "Starter handoff should be consumed as seed evidence, not preserved verbatim.",
    openQuestions: ["Should research run before fresh questions for this phase?"],
    decision: "Replace starter handoff packet text with canonical phase.context sections."
  }) as Record<string, unknown>;
  model.deferredIdeas = [
    "Keep the UI applicability risk explicit until /blu-ui-phase confirms whether a real UI contract is needed."
  ];
  model.canonicalReferences = [
    {
      source: ".blueprint/ROADMAP.md",
      relevance: "Provides the selected phase objective and routing context."
    },
    {
      source: ".blueprint/REQUIREMENTS.md",
      relevance: "Provides the requirement grounding carried forward from the starter handoff."
    }
  ];

  const writeResult = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model,
    overwrite: true
  });

  const saved = await readFile(contextPath, "utf8");

  assert.equal(writeResult.written, true);
  assert.match(saved, /\.blueprint\/ROADMAP\.md/);
  assert.match(saved, /\.blueprint\/REQUIREMENTS\.md/);
  assert.match(saved, /Should research run before fresh questions/i);
  assert.match(saved, /UI applicability risk explicit/i);
  assert.doesNotMatch(saved, /^## Starter Handoff Packet$/im);
  assert.doesNotMatch(saved, /^- Source refs:/im);
  assert.doesNotMatch(saved, /^- Deferred risks:/im);
  assert.doesNotMatch(saved, /^- Open gray areas:/im);
  assert.doesNotMatch(saved, /Generated by `blueprint_artifact_scaffold`/i);
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
    checkpoint: discussCheckpoint([
      {
        areaId: "scope-boundaries",
        title: "Scope boundaries",
        state: "questioning",
        currentQuestion: "What scope boundary should be settled first?"
      },
      {
        areaId: "ui-expectations",
        title: "UI expectations",
        state: "unseen"
      }
    ])
  });
  const checkpointResumed = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "03"
  });
  const checkpointAreaRefreshed = await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint: discussCheckpoint([
      {
        areaId: "scope-boundaries",
        title: "Scope boundaries",
        state: "decided",
        decisionIds: ["D-scope-001"],
        evidenceRefs: [".blueprint/ROADMAP.md"],
        downstreamConsumers: ["/blu-research-phase", "/blu-plan-phase"]
      },
      {
        areaId: "ui-expectations",
        title: "UI expectations",
        state: "questioning",
        currentQuestion: "What UI expectations still need input?",
        questionWhyItMatters: "Controls whether UI-phase drafts UI work or skip rationale.",
        evidenceRefs: [".blueprint/ROADMAP.md"]
      }
    ])
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
    model: validPhaseContextModel({
      decision:
        "Refresh checkpoint-per-area state after each major gray area so the flow can resume cleanly.",
      openQuestions: [
        "Which gray area should be discussed next?",
        "What follow-up depends on the current phase checkpoint?"
      ],
      projectBrief: "Discovery should stay phase-scoped and resumable."
    }),
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
  assert.equal(checkpointResumed.safeToResume, false);
  assert.equal(checkpointResumed.freshness?.status, "unknown");
  assert.equal(checkpointResumed.checkpoint?.schemaVersion, 2);
  assert.equal(checkpointAreaRefreshed.updated, true);
  assert.equal(checkpointAreaLoaded.found, true);
  assert.equal(checkpointAreaLoaded.ownerCommand, "/blu-discuss-phase");
  assert.equal(checkpointAreaLoaded.resumeMode, "discuss");
  const loadedAreas = checkpointAreaLoaded.checkpoint?.areaQueue as Array<Record<string, unknown>>;
  assert.equal(loadedAreas[0]?.state, "decided");
  assert.equal(loadedAreas[1]?.state, "questioning");
  assert.equal(
    loadedAreas[1]?.currentQuestion,
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

test("discuss-phase synced state update stays on an explicitly selected earlier phase", async (t) => {
  const repoPath = await createEarlierSelectedDiscussPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const contextWrite = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "2",
    artifact: "context",
    model: validPhaseContextModel({
      phaseLabel: "phase 2",
      openQuestions: ["none"]
    }),
    overwrite: true
  });
  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-discuss-phase",
      currentPhase: "2",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  const stateBody = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.equal(contextWrite.written, true);
  assert.ok(stateUpdate.updatedFields.includes("activeCommand"));
  assert.ok(stateUpdate.updatedFields.includes("lastUpdated"));
  assert.equal(stateUpdate.statePath, ".blueprint/STATE.md");
  assert.match(
    stateUpdate.warnings.join("\n"),
    /requested phase 2 instead of the roadmap current phase 3/i
  );
  assert.equal(loadedState.state.activeCommand, "/blu-discuss-phase");
  assert.equal(loadedState.derivedStatus.currentPhase, "2");
  assert.match(loadedState.derivedStatus.nextAction, /\/blu-ui-phase 2/);
  assert.doesNotMatch(loadedState.derivedStatus.nextAction, /\/blu-plan-phase 3/);
  assert.match(stateBody, /- Current phase: 2/);
  assert.match(stateBody, /Run \/blu-ui-phase 2 to draft the phase UI contract/);
  assert.doesNotMatch(stateBody, /Run \/blu-plan-phase 3 to create execution-ready phase plans/);
});

test("discuss-phase synced state update skips ui-phase for explicit backend-only earlier phase", async (t) => {
  const repoPath = await createEarlierSelectedDiscussPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-earlier-discovery/02-CONTEXT.md"),
    backendOnlyNoUiContextContent("2", "Earlier Discovery"),
    "utf8"
  );

  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-discuss-phase",
      currentPhase: "2",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  const stateBody = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.ok(stateUpdate.updatedFields.includes("activeCommand"));
  assert.equal(loadedState.state.activeCommand, "/blu-discuss-phase");
  assert.equal(loadedState.derivedStatus.currentPhase, "2");
  assert.match(loadedState.derivedStatus.nextAction, /\/blu-ui-phase 2/);
  assert.match(loadedState.derivedStatus.nextAction, /explicit UI skip rationale/);
  assert.doesNotMatch(loadedState.derivedStatus.nextAction, /\/blu-plan-phase 2/);
  assert.match(stateBody, /Run \/blu-ui-phase 2 to record the explicit UI skip rationale/);
  assert.doesNotMatch(stateBody, /Run \/blu-plan-phase 2 to create execution-ready phase plans/);
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
      ...discussCheckpoint([
        {
          areaId: "scope-boundaries",
          title: "Scope boundaries",
          state: "decided",
          decisionIds: ["D-state-001"],
          evidenceRefs: [".blueprint/STATE.md"]
        },
        {
          areaId: "ui-expectations",
          title: "UI expectations",
          state: "questioning",
          currentQuestion: "What should resume after state sync is repaired?"
        }
      ]),
      progress: {
        activeStage: "Route",
        pendingGate: "state-sync-failure",
        resumeHint: "Repair STATE.md, then resume finalization."
      }
    }
  });
  await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({
      decision:
        "Keep the checkpoint if final state sync or state load fails.",
      openQuestions: [
        "What follow-up should resume if finalization fails?",
        "Which state repair should happen before checkpoint deletion?"
      ]
    }),
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
  const retainedAreas = retained.checkpoint?.areaQueue as Array<Record<string, unknown>>;
  assert.equal(retainedAreas[0]?.state, "decided");
  assert.equal(
    (retained.checkpoint?.progress as Record<string, unknown>)?.resumeHint,
    "Repair STATE.md, then resume finalization."
  );
});

test("discuss-phase context validation accepts product mode descriptions and preserves checkpoint", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint: discussCheckpoint([
      {
        areaId: "scope-boundaries",
        title: "Scope boundaries",
        state: "decided",
        decisionIds: ["D-validation-001"]
      },
      {
        areaId: "plan-inventory-warning",
        title: "Plan inventory warning",
        state: "questioning",
        currentQuestion: "Which warning must be preserved in repaired context?"
      }
    ])
  });

  const invalidContext = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({
      decision: "Auto mode is shipped and power mode is available for this command.",
      openQuestions: ["Which validation repair should happen before finalization?"]
    }),
    overwrite: true
  });

  const retained = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "3"
  });

  assert.equal(invalidContext.status, "created");
  assert.equal(invalidContext.written, true);
  assert.equal(retained.found, true);
  const validationAreas = retained.checkpoint?.areaQueue as Array<Record<string, unknown>>;
  assert.equal(validationAreas[1]?.title, "Plan inventory warning");
});

test("discuss-phase context validation allows future implementation planning text", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({
      decision: "Implement auto mode later after this phase.",
      openQuestions: ["Which validation repair should happen before finalization?"]
    }),
    overwrite: true
  });

  assert.equal(result.status, "created");
  assert.equal(result.written, true);
  assert.ok(
    !result.validation.diagnostics.some(
      (diagnostic) => diagnostic.code === "discuss.unsupported_mode_claim"
    )
  );
});

test("discuss-phase context validation accepts mode descriptions without keyword policing", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const implementedToday = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({
      decision: "Auto mode is implemented today.",
      openQuestions: ["Which validation repair should happen before finalization?"]
    }),
    overwrite: true
  });

  assert.equal(implementedToday.status, "created");
  assert.ok(
    !implementedToday.validation.diagnostics.some(
      (diagnostic) => diagnostic.code === "discuss.unsupported_mode_claim"
    )
  );

  const implementsClaim = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({
      decision: "Discuss-phase implements auto mode for this command.",
      openQuestions: ["Which validation repair should happen before finalization?"]
    }),
    overwrite: true
  });

  assert.equal(implementsClaim.status, "updated");
  assert.ok(
    !implementsClaim.validation.diagnostics.some(
      (diagnostic) => diagnostic.code === "discuss.unsupported_mode_claim"
    )
  );

  const futurePlanning = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({
      decision: "Implement auto mode later after this phase.",
      openQuestions: ["Which validation repair should happen before finalization?"]
    }),
    overwrite: true
  });

  assert.equal(futurePlanning.status, "updated");
  assert.ok(
    !futurePlanning.validation.diagnostics.some(
      (diagnostic) => diagnostic.code === "discuss.unsupported_mode_claim"
    )
  );
});

test("discuss-phase context validation accepts deferred risk prose from starter handoff", () => {
  const validation = validatePhaseArtifactContent(
    buildValidDiscussContext("- none")
      .replace(
        "## Dependencies\n- Prior phase artifacts: .blueprint/phases/03-phase-discovery/03-CONTEXT.md when it already exists.\n- External constraints: Discuss-phase must not weaken downstream planning detail requirements.\n- Required follow-up reads: src/mcp/artifact-contracts/index.ts and src/mcp/tools/artifacts.ts.",
        "## Dependencies\n- Prior phase artifacts: .blueprint/phases/03-phase-discovery/03-CONTEXT.md when it already exists.\n- External constraints: Starter handoff deferred risks still include UI applicability uncertainty and dependency review consequence-if-wrong notes.\n- Required follow-up reads: src/mcp/artifact-contracts/index.ts and src/mcp/tools/artifacts.ts."
      )
      .replace(
        "## Deferred Ideas\n- Scope creep or later follow-up: Apply the same sentinel pattern to other artifacts only after a concrete need appears.\n- Ideas to revisit after this phase: Evaluate whether model-backed phase.context writes should also enforce the same sentinel semantics.",
        "## Deferred Ideas\n- Scope creep or later follow-up: Revisit naming polish after the current phase is stable.\n- Ideas to revisit after this phase: Audit additional renderer wording only after the routing gate is settled."
      ),
    "context"
  );

  assert.equal(validation.valid, true);

});

test("discuss-phase context validation accepts useful starter handoff packet copy", () => {
  const validation = validatePhaseArtifactContent(
    buildValidDiscussContext("- none").replace(
      "## Specific Ideas\n- Specific idea 1: Keep the authoring template explicit so the model does not invent filler prose.\n- Specific idea 2: Preserve exact sentinel behavior through validation and repair loops.\n- Later follow-up: Reuse the same section-level pattern for future contracts only when needed.",
      "## Specific Ideas\n- Starter Handoff Packet\n- Source refs: .blueprint/ROADMAP.md, .blueprint/REQUIREMENTS.md\n- Deferred risks: UI applicability remains unresolved.\n- Open gray areas: research-before-questions ordering."
    ),
    "context"
  );

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.diagnostics, []);
});

test("discuss-phase context validation accepts follow-up prose without inferring omissions", () => {
  const validation = validatePhaseArtifactContent(
    buildValidDiscussContext("- none")
      .replace(
        "## Dependencies\n- Prior phase artifacts: .blueprint/phases/03-phase-discovery/03-CONTEXT.md when it already exists.\n- External constraints: Discuss-phase must not weaken downstream planning detail requirements.\n- Required follow-up reads: src/mcp/artifact-contracts/index.ts and src/mcp/tools/artifacts.ts.",
        "## Dependencies\n- Prior phase artifacts: .blueprint/phases/03-phase-discovery/03-CONTEXT.md when it already exists.\n- External constraints: Open gray areas from starter evidence still include research-before-questions ordering.\n- Required follow-up reads: src/mcp/artifact-contracts/index.ts and src/mcp/tools/artifacts.ts."
      )
      .replace(
        "## Deferred Ideas\n- Scope creep or later follow-up: Apply the same sentinel pattern to other artifacts only after a concrete need appears.\n- Ideas to revisit after this phase: Evaluate whether model-backed phase.context writes should also enforce the same sentinel semantics.",
        "## Deferred Ideas\n- none"
      ),
    "context"
  );

  assert.equal(validation.valid, true);

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
        model: validPhaseContextModel({
          decision: "Keep overwrite explicit for authored invalid artifacts.",
          openQuestions: ["Which details still need user confirmation?"]
        })
      }),
    /already exists/
  );
});

test("discuss-phase discussion-log validation accepts mode and follow-up prose without heuristics", async (t) => {
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

  assert.equal(invalidDiscussion.status, "created");
  assert.deepEqual(invalidDiscussion.validation.diagnostics, []);
});

test("discuss-phase checkpoint reads flag research-owned continuation state as unsafe", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint: researchCheckpoint()
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

test("discuss-phase checkpoint reads legacy foreign checkpoints as non-resumable evidence", async (t) => {
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
  assert.match(checkpoint.warnings.join("\n"), /not a valid checkpoint v2 object/i);
  assert.match(checkpoint.warnings.join("\n"), /non-resumable legacy checkpoint evidence/i);
  assert.match(checkpoint.warnings.join("\n"), /not "discuss"/i);
});

test("discuss-phase checkpoint reads legacy resumeMeta mode evidence without treating it as resumable", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const checkpointPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-DISCUSS-CHECKPOINT.json"
  );
  await writeFile(
    checkpointPath,
    `${JSON.stringify(
      {
        resumeMeta: {
          mode: "research",
          currentQuestion: "Which source remains unverified?"
        },
        pendingTopics: ["Recommendation synthesis"],
        updatedAt: "2026-04-19T00:00:04.000Z"
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const checkpoint = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "3",
    expectedOwnerCommand: "/blu-discuss-phase",
    expectedMode: "discuss"
  });

  assert.equal(checkpoint.found, true);
  assert.equal(checkpoint.ownerCommand, null);
  assert.equal(checkpoint.resumeMode, "research");
  assert.equal(checkpoint.safeToResume, false);
  assert.match(checkpoint.warnings.join("\n"), /not a valid checkpoint v2 object/i);
  assert.match(checkpoint.warnings.join("\n"), /non-resumable legacy checkpoint evidence/i);
  assert.match(checkpoint.warnings.join("\n"), /not "discuss"/i);
  assert.doesNotMatch(checkpoint.warnings.join("\n"), /does not declare a resumable mode/i);
});

test("checkpoint persistence rejects unknown resume modes and owner-mode mismatches", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const baseCheckpoint = {
    schemaVersion: 2,
    ownerCommand: "/blu-discuss-phase",
    mode: "discuss",
    progress: {},
    areaQueue: [
      {
        areaId: "scope-boundaries",
        title: "Scope boundaries",
        state: "questioning"
      }
    ],
    carryForward: {},
    readSet: []
  };

  await assert.rejects(
    blueprintPhaseCheckpointPut({
      cwd: repoPath,
      phase: "3",
      checkpoint: {
        ...baseCheckpoint,
        mode: "sidequest"
      } as Parameters<typeof blueprintPhaseCheckpointPut>[0]["checkpoint"]
    }),
    /Invalid option|structured checkpoint v2/i
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
    /structured checkpoint v2/i
  );
});


test("context validation preserves substantive questions beginning None or Nothing", () => {
  for (const question of [
    "None of the providers supports offline mode; which fallback should we choose?",
    "Nothing should migrate until export parity is proven."
  ]) {
    const validation = validatePhaseArtifactContent(buildValidDiscussContext(`- ${question}`), "context");
    assert.equal(validation.valid, true, validation.issues.join("\n"));
  }
});

test("typed context writes preserve substantive None and Nothing sentences", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(() => rm(path.dirname(repoPath), { recursive: true, force: true }));
  const openQuestions = [
    "None of the providers supports offline mode; which fallback should we choose?",
    "Nothing should migrate until export parity is proven."
  ];
  const result = await blueprintPhaseArtifactWrite({
    cwd: repoPath, phase: "3", artifact: "context", overwrite: true,
    model: validPhaseContextModel({ openQuestions })
  });
  assert.equal(result.written, true, JSON.stringify(result.validation));
  const saved = await readFile(path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"), "utf8");
  for (const question of openQuestions) assert.ok(saved.includes(question));
});
