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
const longRunningProfilePath =
  "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md";

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
  assert.match(
    commandFile,
    /just scaffolded by `\/blu-new-project`, `\/blu-add-phase`, `\/blu-insert-phase`[\s\S]*starter handoff[\s\S]*seed evidence/i
  );
  assert.match(commandFile, /source refs, deferred risks, and open gray areas/i);
  assert.match(commandFile, /Ask only for missing, contradictory, uncertain, or high-impact details/i);
  assert.match(
    commandFile,
    /packet headings, scaffold footers, placeholder labels, unsupported claims, or raw handoff text verbatim/i
  );
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
  assert.match(skillFile, /starter handoff inside the starter context/i);
  assert.match(skillFile, /source refs, deferred risks, and open gray areas/i);
  assert.match(skillFile, /missing, contradictory, uncertain, or high-impact details/i);
  assert.match(
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
  assert.match(discussReference, /exactly `- none`/i);
  assert.match(discussReference, /Starter Handoff Intake/);
  assert.match(
    discussReference,
    /selected phase was just scaffolded by `\/blu-new-project`,[\s\S]*`\/blu-add-phase`, or `\/blu-insert-phase`/i
  );
  assert.match(discussReference, /source refs into `canonicalReferences`/i);
  assert.match(discussReference, /deferred risks or consequence-if-wrong notes/i);
  assert.match(discussReference, /open gray areas into `openQuestions`/i);
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
  assert.match(discussReference, /Either confirm it with the user/i);
  assert.match(discussReference, /evidence-backed `implementationDecisions` entry/i);
  assert.match(discussReference, /explicit in `Open Questions` or `Deferred Ideas`/i);
  assert.match(discussReference, /Artifact Authoring/);
  assert.match(discussReference, /Validation And Repair/);
  assert.match(discussReference, /status: "invalid"/);
  assert.match(discussReference, /Do not claim unshipped power, batch, chain, auto, or auto-advance behavior/i);
  assert.match(researcherAgent, /Output Mode Selection/);
  assert.match(researcherAgent, /gray-area memo mode/);
  assert.match(researcherAgent, /not a populated `phase\.research` or\s+`XX-RESEARCH\.md` body/i);
});

test("discuss runtime contract defines selected phase read packet", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Selected Phase Read Packet",
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

test("discuss runtime contract defines gray area queue", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "grayAreaQueue",
    "areaId",
    "decisionValue",
    "resolutionCriterion",
    "candidateQuestion",
    "downstreamImpact",
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

test("downstream handoff packet is required", () => {
  const contract = readRepoText(discussRuntimeContractPath);

  assertIncludesAll(contract, [
    "Downstream Handoff Packet",
    "researchBrief",
    "uiBrief",
    "planBrief",
    "planInventory",
    "routingGates"
  ]);
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

test("allowlist remains stable", () => {
  const commandFile = readRepoText(discussCommandPath);

  assert.doesNotMatch(commandFile, /blueprint_command_catalog/);
  assert.match(
    commandFile,
    /Before any user question or sidecar decision, resolve the phase and build the selected-phase read packet/i
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
  assert.equal(retained.found, true);
  assert.deepEqual(retained.checkpoint?.remainingAreas, ["Plan inventory warning"]);
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
  assert.match(
    validation.issues.join("\n"),
    /raw starter or handoff packet headings\/labels/i
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
