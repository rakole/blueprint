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
const longRunningProfilePath =
  "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md";
const wave0RuntimeBundleByteBaseline = [
  {
    path: discussCommandPath,
    observedBytes: 6204,
    maxBytes: 10000,
    role: "command manifest prompt and tool allowlist"
  },
  {
    path: discussSkillPath,
    observedBytes: 32481,
    maxBytes: 40000,
    role: "shared phase-discovery skill body"
  },
  {
    path: discussRuntimeContractPath,
    observedBytes: 37574,
    maxBytes: 45000,
    role: "discuss-specific runtime contract"
  },
  {
    path: longRunningProfilePath,
    observedBytes: 3522,
    maxBytes: 6000,
    role: "shared long-running discovery profile"
  }
] as const;
const wave0RuntimeBundleObservedTotal = 79781;
const wave0RuntimeBundleMaxTotal = 101000;
const discussRuntimeBundleCurrentBudget = {
  // Includes the deliberate list-phase-assumptions config parity line in the shared skill.
  skillBytes: 21077,
  // Includes explicit phaseSelection recovery wording to avoid redundant locate fallback calls.
  runtimeContractBytes: 37534,
  // Includes the simple gray-area fast path while keeping the full taxonomy fallback.
  totalBytes: 66614
} as const;
const discussPhaseNoDilutionMatrix = [
  {
    invariant: "selected phase distinct from ambient state phase",
    guardFile: "tests/phase-discovery-discuss.test.ts",
    guardTest: "discuss-phase synced state update stays on an explicitly selected earlier phase"
  },
  {
    invariant: "docs-free discuss input bundle",
    guardFile: "tests/skill-metadata.test.ts",
    guardTest: "structured input bundles resolve command-specific discovery inputs"
  },
  {
    invariant: "context model-only write",
    guardFile: "tests/phase-discovery-discuss.test.ts",
    guardTest: "discuss-phase context write preserves the exact Open Questions none sentinel"
  },
  {
    invariant: "checkpoint v2 owner/mode safety",
    guardFile: "tests/phase-discovery-discuss.test.ts",
    guardTest: "checkpoint persistence rejects unknown resume modes and owner-mode mismatches"
  },
  {
    invariant: "starter handoff seed-only",
    guardFile: "tests/phase-discovery-discuss.test.ts",
    guardTest: "discuss-phase context write replaces starter handoff packet with carried-forward model content"
  },
  {
    invariant: "final route copied from refreshed state",
    guardFile: "tests/phase-discovery-discuss.test.ts",
    guardTest: "final routing copies refreshed state and forbids alternate routes"
  }
] as const;

function readRepoText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludesAll(content: string, expectedParts: readonly string[]) {
  for (const part of expectedParts) {
    assert.ok(content.includes(part), `expected content to include "${part}"`);
  }
}

function assertOrdered(content: string, orderedParts: readonly string[]) {
  let previousIndex = -1;

  for (const part of orderedParts) {
    const currentIndex = content.indexOf(part);

    assert.ok(currentIndex >= 0, `expected content to include "${part}"`);
    assert.ok(
      currentIndex > previousIndex,
      `expected "${part}" to appear after "${orderedParts[Math.max(0, orderedParts.indexOf(part) - 1)]}"`
    );
    previousIndex = currentIndex;
  }
}

test("discuss-phase runtime bundle records Wave 0 byte baseline without enforcing shrink yet", () => {
  const actualContributors = wave0RuntimeBundleByteBaseline.map((entry) => ({
    ...entry,
    actualBytes: Buffer.byteLength(readRepoText(entry.path), "utf8")
  }));
  const actualTotal = actualContributors.reduce(
    (total, contributor) => total + contributor.actualBytes,
    0
  );

  assert.equal(wave0RuntimeBundleObservedTotal, 79781);
  assert.deepEqual(
    wave0RuntimeBundleByteBaseline.map(({ path, observedBytes, role }) => ({
      path,
      observedBytes,
      role
    })),
    [
      {
        path: "commands/blu-discuss-phase.toml",
        observedBytes: 6204,
        role: "command manifest prompt and tool allowlist"
      },
      {
        path: "skills/blueprint-phase-discovery/SKILL.md",
        observedBytes: 32481,
        role: "shared phase-discovery skill body"
      },
      {
        path: "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
        observedBytes: 37574,
        role: "discuss-specific runtime contract"
      },
      {
        path: "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md",
        observedBytes: 3522,
        role: "shared long-running discovery profile"
      }
    ]
  );
  for (const contributor of actualContributors) {
    assert.ok(
      contributor.actualBytes <= contributor.maxBytes,
      `${contributor.path} is ${contributor.actualBytes} bytes; Wave 0 ceiling is ${contributor.maxBytes}`
    );
  }
  assert.ok(
    actualTotal <= wave0RuntimeBundleMaxTotal,
    `discuss runtime bundle is ${actualTotal} bytes; Wave 0 ceiling is ${wave0RuntimeBundleMaxTotal}`
  );
});

test("shared phase-discovery skill is deflated while discuss runtime contract keeps rich details", () => {
  const skill = readRepoText(discussSkillPath);
  const contract = readRepoText(discussRuntimeContractPath);
  const skillBytes = Buffer.byteLength(skill, "utf8");
  const discussSection = skill.match(
    /### `discuss-phase`\n([\s\S]*?)(?=\n### `research-phase`)/
  )?.[1] ?? "";

  assert.ok(
    skillBytes < 28000,
    `shared phase-discovery skill should stay materially below the Wave 0 baseline; got ${skillBytes} bytes`
  );
  assert.ok(
    skillBytes < wave0RuntimeBundleByteBaseline[1].observedBytes,
    `shared phase-discovery skill should shrink below ${wave0RuntimeBundleByteBaseline[1].observedBytes} bytes`
  );
  assert.equal(
    skillBytes,
    discussRuntimeBundleCurrentBudget.skillBytes,
    "shared skill size changed; update the current budget only with an intentional shrink/growth rationale"
  );

  assert.match(discussSection, new RegExp(discussRuntimeContractPath));
  assert.match(discussSection, new RegExp(longRunningProfilePath));
  assert.match(discussSection, /runtime contract owns the discuss-specific behavior/i);
  assert.match(discussSection, /persistent writes MCP-owned, phase-scoped/i);
  assert.match(discussSection, /command-scoped MCP tools/i);
  assert.match(discussSection, /no-subagent fallback[\s\S]*artifact quality/i);

  assert.doesNotMatch(
    skill,
    /"ownerCommand":\s*"\/blu-discuss-phase"[\s\S]*"areaQueue":\s*\[/i
  );
  assert.doesNotMatch(
    skill,
    /`areaId`[\s\S]*`slot`[\s\S]*`defect`[\s\S]*`lens`[\s\S]*`evidence`[\s\S]*`downstreamImpact`[\s\S]*`decisionValue`[\s\S]*`resolutionCriterion`[\s\S]*`candidateQuestion`/i
  );
  assert.doesNotMatch(
    discussSection,
    /Do not infer a direct `\/blu-plan-phase` handoff[\s\S]*enabled research or UI gates/i
  );

  assert.ok(
    Buffer.byteLength(contract, "utf8") < wave0RuntimeBundleByteBaseline[2].observedBytes,
    "discuss runtime contract should shrink below the Wave 0 byte baseline"
  );
  assert.equal(
    Buffer.byteLength(contract, "utf8"),
    discussRuntimeBundleCurrentBudget.runtimeContractBytes,
    "runtime contract size changed; update the current budget only with an intentional shrink/growth rationale"
  );
  assert.equal(
    wave0RuntimeBundleByteBaseline.reduce(
      (total, contributor) => total + Buffer.byteLength(readRepoText(contributor.path), "utf8"),
      0
    ),
    discussRuntimeBundleCurrentBudget.totalBytes,
    "discuss runtime bundle total changed; update the current budget only with an intentional shrink/growth rationale"
  );
  assert.match(contract, /Required checkpoint fields:/);
  assert.match(contract, /Tiny schematic:/);
  assert.doesNotMatch(contract, /Sample v2 checkpoint:/);
  assert.match(
    contract,
    /simple gray-area\s+fast path[\s\S]*`areaId`[\s\S]*`title`[\s\S]*`state`[\s\S]*`candidateQuestion`[\s\S]*`decisionValue`[\s\S]*`downstreamImpact`\s+or\s+`resolutionCriterion`[\s\S]*`evidence`\s+only/i
  );
  assert.match(
    contract,
    /full gray-area taxonomy[\s\S]*`slot`[\s\S]*`defect`[\s\S]*`lens`[\s\S]*`evidence`[\s\S]*`downstreamImpact`[\s\S]*`decisionValue`[\s\S]*`resolutionCriterion`[\s\S]*`candidateQuestion`/i
  );
  assert.match(
    contract,
    /Do not infer `\/blu-plan-phase`[\s\S]*Route only from the post-write/i
  );
});

test("discuss-phase no-dilution matrix points at existing behavior guards", () => {
  for (const row of discussPhaseNoDilutionMatrix) {
    const testFile = readRepoText(row.guardFile);
    const escapedGuardName = row.guardTest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    assert.match(testFile, new RegExp(`test\\("${escapedGuardName}`));
  }
  assert.deepEqual(
    discussPhaseNoDilutionMatrix.map(({ invariant }) => invariant),
    [
      "selected phase distinct from ambient state phase",
      "docs-free discuss input bundle",
      "context model-only write",
      "checkpoint v2 owner/mode safety",
      "starter handoff seed-only",
      "final route copied from refreshed state"
    ]
  );
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
  assert.match(commandFile, /phase\.context` `modelContract`/i);
  assert.match(commandFile, /phase\.discussion-log` `contract\.authoringTemplate`/i);
  assert.match(commandFile, /schema authorities/i);
  assert.match(commandFile, /runtime contract as the behavior authority/i);
  assert.match(commandFile, /substantive user-authored artifacts/i);
  assert.match(commandFile, /host-supported structured choices/i);
  assert.match(
    commandFile,
    /phase resolution, selected-phase read packets, checkpointing, starter handoff intake, authoring, validation repair, state refresh, cleanup, and routing/i
  );
  assert.match(commandFile, /resolve the phase through `mcp_blueprint_blueprint_phase_context\.phaseSelection`/i);
  assert.match(commandFile, /Keep the selected phase distinct from ambient state phase/i);
  assert.match(commandFile, /Ask only for missing, contradictory, uncertain, or high-impact details/i);
  assert.doesNotMatch(commandFile, /just scaffolded by `\/blu-new-project`, `\/blu-add-phase`, `\/blu-insert-phase`/i);
  assert.doesNotMatch(commandFile, /source refs, deferred risks, and open gray areas/i);
  assert.match(
    commandFile,
    /Use only the MCP tools listed in the response requirements/i
  );
  assert.doesNotMatch(commandFile, /mcp_blueprint_blueprint_phase_context` first[\s\S]*`phaseSelection` fields[\s\S]*phaseSelection\.found` is false/i);
  assert.doesNotMatch(commandFile, /request independent read-only MCP calls together in the same model response\/tool-call turn/i);
  assert.doesNotMatch(commandFile, /Do not batch mutating writes, confirmation prompts, validation repair[\s\S]*checkpoint deletion/i);
  assert.doesNotMatch(commandFile, /packet headings, scaffold footers, placeholder labels, unsupported claims, or raw handoff text verbatim/i);
  assert.doesNotMatch(commandFile, /Do not infer a direct `\/blu-plan-phase` handoff/i);
  assert.doesNotMatch(commandFile, /derivedStatus\.nextAction/);
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
  assert.match(skillFile, /phase\.context\.modelContract.*schema authority/i);
  assert.match(skillFile, /contract\.authoringTemplate.*freehand discovery artifacts/i);
  assert.match(skillFile, /runtime contract owns the discuss-specific behavior/i);
  assert.match(skillFile, /persistent writes MCP-owned, phase-scoped/i);
  assert.match(skillFile, /long-running profile/i);
  assert.match(skillFile, /no-subagent fallback[\s\S]*artifact quality/i);
  const skillDiscussSection = skillFile.match(
    /### `discuss-phase`\n([\s\S]*?)(?=\n### `research-phase`)/
  )?.[1] ?? "";
  assert.match(skillDiscussSection, /runtime contract owns the discuss-specific behavior/i);
  assert.match(skillDiscussSection, /long-running profile owns visible stage/i);
  assert.match(skillDiscussSection, /command-scoped MCP tools/i);
  assert.doesNotMatch(skillDiscussSection, /blueprint_state_load\.derivedStatus\.nextAction/);
  assert.doesNotMatch(skillFile, /starter handoff inside the starter context/i);
  assert.doesNotMatch(skillFile, /source refs, deferred risks, and open gray areas/i);
  assert.doesNotMatch(skillFile, /missing, contradictory, uncertain, or high-impact details/i);
  assert.match(
    skillFile,
    /active command's runtime-contract checkpoint shape/i
  );
  assert.doesNotMatch(
    skillFile,
    /packet headings, scaffold footers, placeholder labels, unsupported claims, or raw handoff text/i
  );
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
  assert.match(discussReference, /patch\.currentPhase/i);
  assert.match(discussReference, /blueprint_state_load[\s\S]*refreshed\s+next safe action/i);
  assert.match(discussReference, /Do not infer `\/blu-plan-phase`/i);
  assert.match(discussReference, /`derivedStatus\.nextAction`/);
  assert.match(discussReference, /openQuestions: \[\][\s\S]*exactly `- none`/i);
  assert.match(discussReference, /\["none"\].*compatibility-only/i);
  assert.match(discussReference, /do\s+not pass scalar `openQuestions: "none"`/i);
  assert.match(discussReference, /Starter Handoff Intake/);
  assert.match(
    discussReference,
    /selected phase was just scaffolded by `\/blu-new-project`,[\s\S]*`\/blu-add-phase`, or `\/blu-insert-phase`/i
  );
  assert.match(discussReference, /Map source refs[\s\S]*`canonicalReferences`/i);
  assert.match(discussReference, /deferred\s+risks, consequence-if-wrong notes/i);
  assert.match(discussReference, /open gray areas[\s\S]*`openQuestions`/i);
  assert.match(discussReference, /missing, contradictory, uncertain, or high-impact details/i);
  assert.match(discussReference, /starter packet heading/i);
  assert.match(discussReference, /scaffold footer/i);
  assert.match(discussReference, /placeholder labels/i);
  assert.match(discussReference, /unsupported claims/i);
  assert.match(discussReference, /raw handoff text verbatim/i);
  assert.match(
    discussReference,
    /Delete the checkpoint only after[\s\S]*context write[\s\S]*optional discussion-log[\s\S]*synced state update[\s\S]*state load/i
  );
  const contract = await buildBlueprintCommandRuntimeContractResource("discuss-phase");
  const metadata = getRuntimeOwnedCommandMetadata("discuss-phase");

  assert.ok(metadata);
  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    runtimeContractPath,
    sharedProfilePath
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    runtimeContractPath,
    sharedProfilePath
  ]);
  assert.equal(contract.skillInputs.effective.some((input) => input.startsWith("docs/")), false);
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
  assert.match(
    discussRuntimeRow,
    /`phase\.context` model contract as context schema authority[\s\S]*`phase\.discussion-log` `contract\.authoringTemplate` as discussion-log authority/i
  );
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
  assert.match(discussReference, /Ask for gray-area memo mode,\s+not `phase\.research` or an `XX-RESEARCH\.md` draft/i);
  assert.match(discussReference, /Single-Agent Fallback/);
  assert.match(discussReference, /compress carry-forward context/i);
  assert.match(discussReference, /Assumptions Mode/);
  assert.match(discussReference, /consequence if the assumption is wrong/i);
  assert.match(discussReference, /Either confirm it with the user/i);
  assert.match(discussReference, /evidence-backed `implementationDecisions` entry/i);
  assert.match(discussReference, /explicit in `Open Questions` or `Deferred Ideas`/i);
  assert.match(discussReference, /Artifact Authoring/);
  assert.match(discussReference, /Validation And Repair/);
  assert.match(discussReference, /status: "invalid"/);
  assert.match(discussReference, /Do not describe same-turn read batching as a power, chain, auto, or\s+auto-advance mode/i);
  assert.match(researcherAgent, /Output Mode Selection/);
  assert.match(researcherAgent, /gray-area memo mode/);
  assert.match(researcherAgent, /not a populated `phase\.research` or\s+`XX-RESEARCH\.md` body/i);
});

test("discuss runtime contract defines selected phase read packet", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Selected Phase Read Packet",
    "phaseSelection",
    "selectedPhase",
    "stateCurrentPhase",
    "selectedPhaseResolvedFrom",
    "found: false"
  ]);
  assert.match(contract, /found:\s*false[\s\S]*stop/i);
});

test("discuss runtime contract treats starter handoff as seed evidence only", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Starter Handoff Intake",
    "seed evidence",
    "source refs",
    "deferred risks",
    "open gray areas"
  ]);
  assert.match(contract, /do not preserve the starter packet heading/i);
  assert.match(contract, /scaffold footer/i);
  assert.match(contract, /placeholder labels/i);
  assert.match(contract, /unsupported claims/i);
  assert.match(contract, /raw handoff text verbatim/i);
});

test("discuss runtime contract requires artifact status classification", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "missing",
    "scaffold-starter",
    "authored-substantive",
    "validation-suspect",
    "safe-checkpoint",
    "foreign-checkpoint",
    "stale-plan-inventory"
  ]);
});

test("discuss runtime contract allows only same-turn independent read batching", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Same-Turn Read Batching",
    "same model response/tool-call turn",
    "independent read-only calls",
    "using runtime FQNs",
    "Before selected phase is known",
    "After `phase_context.phaseSelection` is usable",
    "If the host cannot batch tool calls",
    "Dependent reads stay in later turns"
  ]);
  assert.match(contract, /Do not narrate\s+between independent read calls/i);
  assert.match(
    contract,
    /Do not batch writes, user\s+confirmations, validation\s+repair, state updates, or checkpoint deletion/i
  );
  assert.match(contract, /Minimum Read Order[\s\S]*Call `blueprint_phase_context` first/i);
  assert.match(
    contract,
    /phaseSelection` is not usable but includes `reason` plus `recovery`[\s\S]*Otherwise call `blueprint_phase_locate` as the\s+fallback[\s\S]*stop when locate cannot identify one phase/i
  );
  assert.match(contract, /same model response\/tool-call\s+turn[\s\S]*Using `selectedPhase`/i);
  assert.match(
    contract,
    /prior result chooses[\s\S]*selected\s+phase[\s\S]*write\s+payload[\s\S]*routing state/i
  );
  assert.doesNotMatch(contract, /Call `blueprint_phase_locate`\.\n2\./i);
  assert.doesNotMatch(contract, /batch writes as independent/i);
  assert.doesNotMatch(contract, /batch dependent reads/i);
});

test("discuss runtime contract replaces vague speed-killer phrases with concrete rules", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assert.doesNotMatch(contract, /materially relevant prior context/i);
  assert.doesNotMatch(contract, /materially relevant earlier/i);
  assert.doesNotMatch(contract, /minimum useful packet/i);
  assert.doesNotMatch(contract, /when likely/i);
  assert.doesNotMatch(contract, /materially improve the options/i);
  assert.match(
    contract,
    /shared roadmap requirement id[\s\S]*Default maximum: the nearest prior\s+matching phase plus any phase explicitly named by ROADMAP or saved context/i
  );
  assert.match(
    contract,
    /Minimum Evidence Packet[\s\S]*selected phase[\s\S]*artifact inventory status[\s\S]*artifact-contract status/i
  );
  assert.match(
    contract,
    /phase\.discussion-log` contract only after a trigger in\s+Discussion Log Triggers is present or the user requests a durable log/i
  );
  assert.match(
    contract,
    /at least two viable options remain[\s\S]*an option changes scope\s+or downstream\s+routing[\s\S]*add citations\s+before the next user question/i
  );
});

test("discuss runtime contract defines gray area queue fast path and taxonomy fallback", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "grayAreaQueue",
    "simple gray-area",
    "fast path",
    "areaId",
    "title",
    "state",
    "decisionValue",
    "resolutionCriterion",
    "candidateQuestion",
    "downstreamImpact",
    "full gray-area taxonomy",
    "actor",
    "action-task",
    "object-concept",
    "attribute",
    "goal",
    "event",
    "constraint",
    "exception",
    "external-interface",
    "quality-attribute",
    "acceptance-verification",
    "ambiguous",
    "incomplete",
    "inconsistent",
    "unverifiable",
    "tradeoff"
  ]);
  assert.match(
    contract,
    /Do not\s+require `slot`, `defect`, or `lens` classification for\s+every simple\s+queue entry/i
  );
  assert.match(
    contract,
    /Use the full gray-area taxonomy for complex sessions:[\s\S]*multiple ambiguous areas[\s\S]*unclear boundaries[\s\S]*high downstream risk[\s\S]*routing\s+uncertainty/i
  );
  assert.doesNotMatch(contract, /Classify every gray area by requirement slot/i);
  assert.match(contract, /For complex sessions, classify each gray area/i);
});

test("discuss runtime contract has anti-generic-question rule", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assert.match(contract, /(anti-example|warning)[\s\S]*Any other requirements\?/i);
  assert.match(contract, /(anti-example|warning)[\s\S]*What should we consider\?/i);
});

test("questioning rules require decision value and resolved-when format", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Question:",
    "Why it matters:",
    "Known evidence:",
    "Recommended option:",
    "Other options:",
    "Resolved when:"
  ]);
});

test("assumptions mode defines confidence labels and ask threshold", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Assumption record",
    "Evidence grade",
    "Competing interpretations",
    "Contradictions checked",
    "Consequence if wrong",
    "Downstream status",
    "Confident",
    "Likely",
    "Unclear",
    "Ask instead of assuming",
    "scope",
    "public behavior",
    "data/contracts",
    "security/privacy"
  ]);
  assert.match(contract, /Confident[\s\S]*evidence[\s\S]*consequence/i);
  assert.match(contract, /Likely[\s\S]*evidence[\s\S]*consequence/i);
  assert.match(contract, /Unclear[\s\S]*evidence[\s\S]*consequence/i);
});

test("skip discuss uses assumptions safety rules", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assert.match(contract, /workflow\.skip_discuss\s*=\s*true/i);
  assert.match(contract, /workflow\.skip_discuss[\s\S]*evidence-backed context/i);
  assert.match(contract, /workflow\.skip_discuss[\s\S]*(high-impact|stop\/ask|stop and ask)/i);
});

test("checkpoint contract preserves area queue as semantic source", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Persist after every user answer",
    "areaQueue",
    "schemaVersion",
    "carryForward",
    "readSet",
    "unseen",
    "questioning",
    "assumed",
    "decided",
    "blocked",
    "needs-revisit"
  ]);
});

test("resume ordering is deterministic", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertOrdered(contract, ["questioning", "blocked", "needs-revisit", "unseen"]);
  assertIncludesAll(contract, [
    'expectedOwnerCommand: "/blu-discuss-phase"',
    'expectedMode: "discuss"'
  ]);
});

test("context readiness ledger and discussion log triggers are present", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Context Model Readiness",
    "readiness ledger",
    "source basis",
    "confidence",
    "unresolved risk",
    "downstream consumer",
    "multi-area",
    "assumptions corrections",
    "user direction changes",
    "contradictions"
  ]);
});

test("downstream handoff substance maps to existing context fields", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Downstream Context Mapping",
    "intermediate labels only",
    "Do not create a",
    "handoff schema field",
    "implementationDecisions",
    "dependencies",
    "openQuestions",
    "deferredIdeas",
    "canonicalReferences",
    "specificIdeas",
    "existingCodeInsights",
    "phaseBoundary"
  ]);
  assert.doesNotMatch(contract, /### Required Packet Fields/);
  assert.doesNotMatch(
    contract,
    /Final response shape:[\s\S]*researchBrief[\s\S]*uiBrief[\s\S]*planBrief[\s\S]*planInventory/i
  );
  assert.match(
    contract,
    /saved plan IDs\/paths[\s\S]*`dependencies`[\s\S]*`canonicalReferences`[\s\S]*`openQuestions`/i
  );
});

test("final routing copies refreshed state and forbids alternate routes", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assert.match(contract, /Route only from the post-write/i);
  assertIncludesAll(contract, [
    "derivedStatus.nextAction",
    "Do not include secondary runnable routes",
    "/blu-progress"
  ]);
  assert.match(contract, /(missing|blocked)[\s\S]*\/blu-progress/i);
});

test("state warning preservation surfaces only non-empty routing-relevant warnings", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assert.match(
    contract,
    /Surface non-empty routing-relevant warnings returned by `blueprint_state_update`[\s\S]*final `blueprint_state_load`/i
  );
  assert.match(contract, /do not invent warning categories or audit\s+state warning families/i);
  assert.doesNotMatch(contract, /requested-phase preservation warnings/i);
  assert.doesNotMatch(contract, /invalid research warnings/i);
  assert.doesNotMatch(contract, /missing\s+plan dependency warnings/i);
  assert.doesNotMatch(contract, /quality-gate debt warnings/i);
});

test("allowlist remains stable", () => {
  const commandFile = readRepoText(discussCommandPath);

  assert.doesNotMatch(commandFile, /blueprint_command_catalog/);
  assert.match(
    commandFile,
    /Treat the runtime contract as the behavior authority[\s\S]*selected-phase read packets/i
  );
  assert.match(
    commandFile,
    /resolve the phase through `mcp_blueprint_blueprint_phase_context\.phaseSelection`/i
  );
});

test("long running profile has fallback progress line", () => {
  const profile = readRepoText(longRunningProfilePath);

  assert.match(profile, /Progress:\s*phase=/i);
});

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

test("discuss-phase context validation rejects malformed Open Questions empty-state variants", () => {
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

    assert.equal(validation.valid, false);
    assert.match(validation.issues.join("\n"), /Open Questions/i);
    assert.match(validation.issues.join("\n"), /exactly `- none`|substantive downstream-planning detail or use exactly `- none`/i);
  }
});

test("discuss-phase context validation accepts only exact Deferred Ideas none sentinel", () => {
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

    assert.equal(invalid.valid, false);
    assert.match(invalid.issues.join("\n"), /Deferred Ideas/i);
    assert.ok(
      invalid.diagnostics.some((diagnostic) => diagnostic.code === "context.inexact_empty_sentinel")
    );
  }
});

test("discuss-phase context validation does not allow the none sentinel in other required sections", () => {
  const validation = validatePhaseArtifactContent(
    buildValidDiscussContext("- none").replace(
      "## Specific Ideas\n- Specific idea 1: Keep the authoring template explicit so the model does not invent filler prose.\n- Specific idea 2: Preserve exact sentinel behavior through validation and repair loops.\n- Later follow-up: Reuse the same section-level pattern for future contracts only when needed.",
      "## Specific Ideas\n- none"
    ),
    "context"
  );

  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /Specific Ideas/i);
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

test("discuss-phase context write rejects deferredIdeas none alias in the structured model", async (t) => {
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

  assert.equal(writeResult.status, "invalid");
  assert.equal(writeResult.written, false);
  assert.match(writeResult.validation.issues.join("\n"), /model\.deferredIdeas/i);
  assert.match(writeResult.validation.issues.join("\n"), /Open Questions compatibility only/i);
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
  assert.equal(checkpointResumed.safeToResume, true);
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

test("discuss-phase context validation blocks runtime anti-patterns and preserves checkpoint", async (t) => {
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

  assert.equal(invalidContext.status, "invalid");
  assert.equal(invalidContext.written, false);
  assert.match(invalidContext.validation.issues.join("\n"), /unsupported discuss-phase behavior/i);
  assert.ok(
    invalidContext.validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "discuss.unsupported_mode_claim" &&
        diagnostic.path === "content.unsupportedModeClaims"
    )
  );
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

test("discuss-phase context validation blocks implemented-mode claims but not bare future planning verbs", async (t) => {
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

  assert.equal(implementedToday.status, "invalid");
  assert.ok(
    implementedToday.validation.diagnostics.some(
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

  assert.equal(implementsClaim.status, "invalid");
  assert.ok(
    implementsClaim.validation.diagnostics.some(
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

  assert.equal(futurePlanning.status, "created");
  assert.ok(
    !futurePlanning.validation.diagnostics.some(
      (diagnostic) => diagnostic.code === "discuss.unsupported_mode_claim"
    )
  );
});

test("discuss-phase context validation blocks dropped deferred risks from starter handoff", () => {
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

  assert.equal(validation.valid, false);
  assert.ok(
    validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "context.dropped_risk_carry_forward" &&
        diagnostic.path === "content.sections.Open Questions"
    )
  );
  assert.match(
    validation.issues.join("\n"),
    /deferred risks or consequence-if-wrong notes[\s\S]*Open Questions or Deferred Ideas/i
  );
});

test("discuss-phase context validation blocks verbatim starter handoff packet copy", () => {
  const validation = validatePhaseArtifactContent(
    buildValidDiscussContext("- none").replace(
      "## Specific Ideas\n- Specific idea 1: Keep the authoring template explicit so the model does not invent filler prose.\n- Specific idea 2: Preserve exact sentinel behavior through validation and repair loops.\n- Later follow-up: Reuse the same section-level pattern for future contracts only when needed.",
      "## Specific Ideas\n- Starter Handoff Packet\n- Source refs: .blueprint/ROADMAP.md, .blueprint/REQUIREMENTS.md\n- Deferred risks: UI applicability remains unresolved.\n- Open gray areas: research-before-questions ordering."
    ),
    "context"
  );

  assert.equal(validation.valid, false);
  assert.ok(
    validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "context.raw_handoff_label" &&
        diagnostic.path === "content.rawHandoffLabels"
    )
  );
  assert.match(
    validation.issues.join("\n"),
    /raw starter or handoff packet headings\/labels/i
  );
});

test("discuss-phase context validation points dropped follow-up signals at canonical sections", () => {
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

  assert.equal(validation.valid, false);
  assert.ok(
    validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "context.dropped_deferred_ideas" &&
        diagnostic.path === "content.sections.Deferred Ideas"
    )
  );
  assert.ok(
    validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "context.dropped_open_questions" &&
        diagnostic.path === "content.sections.Open Questions"
    )
  );
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
  assert.ok(
    invalidDiscussion.validation.diagnostics.some(
      (diagnostic) => diagnostic.code === "discuss.unsupported_mode_claim"
    )
  );
  assert.ok(
    invalidDiscussion.validation.diagnostics.some(
      (diagnostic) => diagnostic.code === "discussion-log.dropped_follow_ups"
    )
  );
  assert.match(
    invalidDiscussion.suggestedRepairs?.join("\n") ?? "",
    /Remove shipped\/available claims[\s\S]*Move deferred or later follow-up ideas/i
  );
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
