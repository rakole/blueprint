import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

const planPhaseTools = [
  "blueprint_phase_locate",
  "blueprint_artifact_contract_read",
  "blueprint_phase_context",
  "blueprint_phase_research_status",
  "blueprint_phase_artifact_read",
  "blueprint_phase_validation_read",
  "blueprint_review_load_findings",
  "blueprint_phase_plan_index",
  "blueprint_phase_plan_read",
  "blueprint_phase_plan_readiness",
  "blueprint_phase_plan_authoring_context",
  "blueprint_phase_plan_validate_model",
  "blueprint_phase_plan_write",
  "blueprint_phase_plan_validate",
  "blueprint_config_get",
  "blueprint_state_load",
  "blueprint_state_update"
] as const;

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludesAll(content: string, expected: readonly string[]): void {
  for (const item of expected) {
    assert.ok(content.includes(item), `expected content to include "${item}"`);
  }
}

function assertAgentToolsReadOnly(content: string, agentPath: string): void {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
  assert.ok(frontmatterMatch, `${agentPath} should have frontmatter`);

  const toolsBlockMatch = /^tools:\n((?:  - .+\n)+)/m.exec(frontmatterMatch[1]);
  assert.ok(toolsBlockMatch, `${agentPath} should declare tools in frontmatter`);

  const tools = toolsBlockMatch[1]
    .trim()
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim());

  assert.deepEqual(
    tools,
    ["list_directory", "read_file", "glob", "grep_search"],
    `${agentPath} must keep read-only tools only`
  );
  assert.deepEqual(
    tools.filter((tool) => /(?:write|replace|edit|delete|mcp_|blueprint_)/i.test(tool)),
    [],
    `${agentPath} must not gain write or MCP persistence tools`
  );
}

test("plan-phase manifest is a thin runtime-contract entrypoint with hard safety rules", async () => {
  const commandFile = await readRepoFile("commands/blu-plan-phase.toml");
  const commandSize = (await stat(path.join(repoRoot, "commands/blu-plan-phase.toml"))).size;

  assert.ok(commandSize < 9000, `expected thin command manifest, got ${commandSize} bytes`);
  assertIncludesAll(commandFile, [
    "Use the `blueprint-phase-planning` skill",
    "plan-phase-runtime-contract.md",
    "docs-only command pages",
    "`long-running-mutation`",
    "`Resolve`",
    "`Read`",
    "`Decide`",
    "`Execute`",
    "`Persist`",
    "`Validate`",
    "`Route`",
    "resolved scope, active stage, pending gate, execution mode, and next safe action",
    "ask_user",
    "mcp_blueprint_blueprint_phase_plan_readiness",
    "readyForPlanPhase=false",
    "expectedReadSet",
    "phase_plan_validate_model` remains available for dry-run previews",
    "Final completion still requires `mcp_blueprint_blueprint_phase_plan_validate`",
    "mcp_blueprint_blueprint_state_update` with `base: \"synced\"` only after final scoped validation is valid",
    "No raw `.blueprint/` writes",
    "validationMode: \"warn\"",
    "Downstream Execution Handoff"
  ]);

  for (const tool of planPhaseTools) {
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(tool)));
  }

  assert.doesNotMatch(commandFile, /artifact_report_write/);
  assert.doesNotMatch(commandFile, /blueprint_artifact_scaffold/);
  assert.doesNotMatch(commandFile, /Immediately before final model validation\/write/);
  assert.doesNotMatch(commandFile, /Validate the structured model through `blueprint_phase_plan_validate_model`, then persist/);
});

test("plan-phase skill is compact and delegates detailed behavior to the runtime contract", async () => {
  const skillFile = await readRepoFile("skills/blueprint-phase-planning/SKILL.md");
  const skillSize = (await stat(path.join(repoRoot, "skills/blueprint-phase-planning/SKILL.md"))).size;

  assert.ok(skillSize < 9000, `expected compact skill, got ${skillSize} bytes`);
  assertIncludesAll(skillFile, [
    "status: implemented",
    "/blu-plan-phase",
    "input_bundles:",
    "plan-phase-runtime-contract.md",
    "docs under `docs/commands/` as user-facing documentation",
    "blueprint_phase_plan_readiness",
    "existing saved plans plus omitted `planId` require an explicit `add`,",
    "expectedReadSet",
    "blueprint_phase_plan_validate_model` only for dry-run preview",
    "Run final `blueprint_phase_plan_validate` before synced state update",
    "No raw `.blueprint/` writes",
    "No `validationMode: \"warn\"`",
    "Completion Criteria",
    "Downstream Execution Handoff",
    "same-named Gemini CLI agent tools",
    "Do not read, inline, or\n  load separate agent source",
    "Give planner/checker tools compact\ntask packets by",
    "full bodies only",
    "read-only\n`read_file` on supplied paths",
    "must not write files\nor call MCP persistence"
  ]);

  for (const tool of planPhaseTools) {
    assert.match(skillFile, new RegExp(tool));
  }

  assert.doesNotMatch(skillFile, /docs\/COMMAND-CATALOG\.md|docs\/SKILLS-AND-AGENTS\.md|docs\/ARTIFACT-SCHEMA\.md/);
  assert.doesNotMatch(skillFile, /strict model-rendered heading set/i);
  assert.doesNotMatch(skillFile, /Immediately before final model validation\/write/);
});

test("plan-phase runtime contract owns detailed behavior and fresh-read semantics", async () => {
  const runtimeContract = await readRepoFile(
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  );

  assertIncludesAll(runtimeContract, [
    "## Visible Planning Progress",
    "read planning readiness",
    "choose plan action",
    "draft structured plan model",
    "persist plan model",
    "validate plan set",
    "sync state and hand off",
    "## Stage Mapping",
    "### Resolve",
    "### Read",
    "### Decide",
    "### Execute",
    "### Persist",
    "### Validate",
    "### Route",
    "Planning Investigation Trace",
    "Pre-Draft Readiness Assessment",
    "Planning Decision Record",
    "Post-Draft Semantic Self-Check",
    "Artifact Authoring Rules",
    "No-Subagent Fallback",
    "Output Quality Criteria",
    "Completion Criteria",
    "Downstream Execution Handoff",
    "expectedReadSet` from the fresh\n  readiness `readSet`",
    "not\n  mandatory before every write",
    "returnNextAuthoringContext: true",
    "Explicit additive intent may proceed without an overwrite confirmation",
    "Do not write raw `.blueprint/` files",
    "validationMode:\n  \"warn\" is not part of this command's write contract",
    "separate final scoped validation remains authoritative",
    "not read, inline, or load separate agent source",
    "Planner task packets should be compact by default",
    "task schema path/hash",
    "existing plan bodies only when revising or replacing",
    "Checker task packets should be compact by default",
    "saved plan paths/hashes",
    "read-only `read_file` for supplied plan paths"
  ]);
  assert.match(
    runtimeContract,
    /Gemini-native progress helpers are presentation mirrors only[\s\S]*do not\s+expand the MCP tool allowlist, persistence authority, model-validation\s+authority, checker authority, state-sync authority, routing authority, or user\s+confirmation authority/i
  );
  assert.match(
    runtimeContract,
    /Emit exceptional updates for\s+readiness blockers, saved-plan add\/revise\/replace waits, overwrite waits,\s+stale read-set repair/i
  );

  assert.doesNotMatch(runtimeContract, /fresh readiness or authoring packet/);
  assert.doesNotMatch(runtimeContract, /GSD's retained quality bar/);
});

test("plan-phase runtime metadata owns the migrated catalog and runtime-reference facts", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("plan-phase");
  const contract = await buildBlueprintCommandRuntimeContractResource("plan-phase");

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#plan-phase");
  assert.equal(metadata.catalog.wave, 1);
  assert.equal(metadata.catalog.family, "Core Lifecycle");
  assert.equal(metadata.catalog.primarySkill, "blueprint-phase-planning");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(
    metadata.catalog.risk,
    "Medium: can replace plans and change downstream execution order."
  );
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.deepEqual(metadata.requiredTools, [...planPhaseTools]);
  assert.deepEqual(metadata.optionalAgents, [
    "blueprint-planner",
    "blueprint-checker"
  ]);
  assert.deepEqual(metadata.spec.writes, [
    "structured phase.plan JSON through blueprint_phase_plan_write",
    ".blueprint/phases/<phase>/<phase-prefix>-<plan-id>-PLAN.md (XX-YY-PLAN.md) through blueprint_phase_plan_write",
    ".blueprint/STATE.md through synced state update"
  ]);
  assert.deepEqual(metadata.runtimeReference.exactMcpDestination, [...planPhaseTools]);
  assert.deepEqual(metadata.runtimeReference.hookInvolvement, [
    "read-before-edit",
    ".blueprint write guard"
  ]);
  assert.deepEqual(metadata.runtimeReference.evidenceState, [
    "locked",
    "runtime-owned",
    "needs-behavior-audit"
  ]);
  assert.match(metadata.runtimeReference.contractNotes, /blueprint_phase_plan_readiness/i);
  assert.match(metadata.runtimeReference.contractNotes, /read-set freshness metadata/i);
  assert.match(metadata.runtimeReference.contractNotes, /expectedReadSet from the readiness readSet/i);
  assert.match(metadata.runtimeReference.contractNotes, /returnNextAuthoringContext: true/i);
  assert.match(metadata.runtimeReference.contractNotes, /dry-run preview, repair loops, or checker convergence/i);
  assert.match(metadata.runtimeReference.contractNotes, /Existing saved plans plus omitted planId require an add\/revise\/replace decision/i);
  assert.match(metadata.runtimeReference.contractNotes, /validationMode: "strict"/);
  assert.match(metadata.runtimeReference.contractNotes, /authoringMode: "model-only"/);
  assert.match(metadata.runtimeReference.contractNotes, /saved research instead of live browsing/i);
  assert.match(metadata.runtimeReference.contractNotes, /workflow\.plan_check/i);
  assert.match(metadata.runtimeReference.contractNotes, /blueprint-planner/i);
  assert.match(metadata.runtimeReference.contractNotes, /blueprint-checker/i);
  assert.match(metadata.runtimeReference.contractNotes, /no-subagent/i);
  assert.match(metadata.runtimeReference.contractNotes, /scaffold-placeholder/i);
  assert.match(metadata.runtimeReference.contractNotes, /Markdown fallback/i);
  assert.match(metadata.runtimeReference.contractNotes, /base: "synced"/);
  assert.match(metadata.runtimeReference.contractNotes, /never infer final completion/i);

  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [...planPhaseTools]);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("plan-phase docs and MCP notes are user-facing and aligned to the runtime contract", async () => {
  const [commandDoc, mcpToolsDoc, runtimeReferenceDoc] = await Promise.all([
    readRepoFile("docs/commands/plan-phase.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assertIncludesAll(commandDoc, [
    "This page is user-facing documentation",
    "The runtime prompt authority is the\ncommand manifest",
    "blueprint_phase_plan_readiness",
    "expectedReadSet",
    "blueprint_phase_plan_validate_model` remains available for dry-run previews",
    "Final\ncompletion still depends on `blueprint_phase_plan_validate`",
    "Downstream Execution Handoff"
  ]);
  assert.doesNotMatch(commandDoc, /Validate the structured model through `blueprint_phase_plan_validate_model`, then persist/);
  assert.doesNotMatch(commandDoc, /Re-read `blueprint_phase_plan_authoring_context` immediately before each model validation\/write/);

  assert.match(
    mcpToolsDoc,
    /`plan-phase` uses `blueprint_phase_plan_readiness` as the preferred compact read-only read packet/i
  );
  assert.match(mcpToolsDoc, /expectedReadSet` from the readiness `readSet`/i);
  assert.match(mcpToolsDoc, /completionReady/);
  assert.match(mcpToolsDoc, /incrementalCheckpoint/);
  assert.match(mcpToolsDoc, /blueprint_phase_plan_validate` before treating planning as complete/i);
  assert.match(mcpToolsDoc, /requires an explicit add\/revise\/replace decision when saved plans exist and `planId` is omitted/i);
  assert.match(mcpToolsDoc, /lets explicit additive intent select a new slot without an overwrite gate/i);
  assert.match(mcpToolsDoc, /always confirms revise, replace, overwrite, or saved-plan-set replacement/i);

  assert.match(runtimeReferenceDoc, /src\/mcp\/command-runtime-metadata\.ts#plan-phase/);
  assert.match(runtimeReferenceDoc, /blueprint_phase_plan_readiness/);
  assert.match(runtimeReferenceDoc, /server-checked `expectedReadSet`/);
  assert.match(runtimeReferenceDoc, /existing saved plans plus omitted `planId` require an explicit add\/revise\/replace decision/);
  assert.match(runtimeReferenceDoc, /explicit additive new plan ids may proceed without an overwrite gate/);
  assert.match(runtimeReferenceDoc, /never infer completion from `blueprint_phase_plan_write\.validation\.valid`, `completionReady`, or `incrementalCheckpoint` alone/);
});

test("planner and checker guidance stays bounded and parent-owned", async () => {
  const [plannerFile, checkerFile] = await Promise.all([
    readRepoFile("agents/blueprint-planner.md"),
    readRepoFile("agents/blueprint-checker.md")
  ]);

  assertIncludesAll(plannerFile, [
    "taskSchema",
    "parent command owns orchestration",
    "Do not persist plan files",
    "update Blueprint state",
    "compact structured planning packet",
    "schema path/hash",
    "paths, kinds, hashes, and short excerpts",
    "read-only `read_file` on supplied paths"
  ]);
  assert.match(plannerFile, /live\s+phase\.plan contract/i);
  assert.match(plannerFile, /plan bodies only\s+when revising or replacing/i);
  assert.match(
    plannerFile,
    /ready for\s+`blueprint_phase_plan_validate_model` and `blueprint_phase_plan_write` by the\s+parent command/i
  );
  assertIncludesAll(checkerFile, [
    "live phase.plan contract",
    "parent command owns all persistence",
    "Do not persist verdicts",
    "update Blueprint state",
    "compact checker packet",
    "saved plan paths, hashes, validation status",
    "completionReady",
    "incrementalCheckpoint",
    "read-only `read_file` on supplied paths"
  ]);
  assert.match(checkerFile, /MCP\s+persistence/i);
  assertAgentToolsReadOnly(plannerFile, "agents/blueprint-planner.md");
  assertAgentToolsReadOnly(checkerFile, "agents/blueprint-checker.md");
});
