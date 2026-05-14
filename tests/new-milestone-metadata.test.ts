import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

function assertContainsAll(text: string, snippets: string[]) {
  for (const snippet of snippets) {
    assert.ok(text.includes(snippet), `expected to find ${snippet}`);
  }
}

test("new-milestone manifest references carry-forward seed generation and discuss-phase routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-new-milestone.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.match(commandFile, /`blueprint-roadmapper` subagent/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-roadmapper\.md/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_config_get/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /carry-forward as the default/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /source milestone summary path/i);
  assert.match(commandFile, /inputsUsed/);
  assert.match(commandFile, /affected starter paths/i);
  assert.match(commandFile, /overwrite risk/i);
  assert.match(commandFile, /Safe default: stop without writing/);
  assert.match(commandFile, /New Milestone First-Phase Handoff Packet/);
  assert.match(commandFile, /digestInputsUsed/);
  assert.match(commandFile, /retainedDecisions/);
  assert.match(commandFile, /activeRequirementTransitions/);
  assert.match(commandFile, /openForDiscuss/);
  assert.match(commandFile, /riskWatchlist/);
  assert.match(commandFile, /deferredNotDoingNow/);
  assert.match(commandFile, /canonicalReferences/);
  assert.match(commandFile, /routeReceipt/);
  assert.match(commandFile, /roughly 12-18 bullets total/i);
  assert.match(commandFile, /confidence plus consequence/i);
  assert.match(commandFile, /unverified claims as assumptions/i);
  assert.match(commandFile, /Treat the handoff packet as starter seed material/i);
  assert.match(commandFile, /missing-milestone-summary/);
  assert.match(commandFile, /carry-forward-confirmation/);
  assert.match(commandFile, /starter-doc-overwrite-confirmation/);
  assert.match(commandFile, /named in-flight receipt/i);
  assert.match(commandFile, /bind the approved preview packet fields to the later scaffold and state-update arguments/i);
  assert.match(commandFile, /If the user declines either confirmation gate, stop without writing/i);
  assert.match(commandFile, /point to `\/blu-progress`/);
  assert.match(commandFile, /Do not use\s+`update_topic`, `write_todos`, or task tracker tools/);
  assert.match(
    commandFile,
    /1\. Resolve[\s\S]*mcp_blueprint_blueprint_roadmap_read[\s\S]*then read `mcp_blueprint_blueprint_config_get` with `scope: "effective"`/
  );
  assert.match(commandFile, /next integer after the highest base phase number/i);
  assert.match(commandFile, /Preserve historical phase directories/i);
  assert.match(commandFile, /highestBasePhaseNumber/);
  assert.match(commandFile, /firstPhaseNumber/);
  assert.match(commandFile, /firstContextPath/);
  assert.match(commandFile, /deletedPhaseDirectories/);
  assert.match(commandFile, /renamedPhaseDirectories/);
  assert.match(commandFile, /\.blueprint\/phases\/<NN>-<slug>\/<NN-CONTEXT\.md>/);
  assert.match(commandFile, /\/blu-discuss-phase <first phase>/);
  assert.doesNotMatch(commandFile, /\/blu-plan-phase/);
  assert.doesNotMatch(commandFile, /\/blu-execute-phase/);
});

test("roadmap-admin skill captures carry-forward new-milestone behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assertContainsAll(skillFile, [
    "/blu-new-milestone",
    "blueprint_config_get",
    'scope: "effective"',
    "report.milestone-summary",
    "phase.context",
    "carry-forward as the default",
    "New Milestone First-Phase Handoff Packet",
    "digestInputsUsed",
    "retainedDecisions",
    "activeRequirementTransitions",
    "openForDiscuss",
    "riskWatchlist",
    "deferredNotDoingNow",
    "canonicalReferences",
    "routeReceipt",
    "roughly 12-18 bullets",
    "confidence and consequence",
    "assumptions",
    "requirementTransitions",
    "starter-seed evidence only",
    "sourceRefs",
    "self-derived",
    "uncertain",
    "Preserve historical phase directories",
    "next whole-number phase",
    "firstPhaseNumber",
    "firstContextPath",
    "renamedPhaseDirectories",
    "/blu-discuss-phase <first phase>",
    "ask_user",
    "new typed `.blueprint/` write surface",
  ]);
  assert.match(skillFile, /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
});

test("new-milestone runtime-owned metadata aligns to the interactive-read carry-forward contract", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("new-milestone");
  const contract = await buildBlueprintCommandRuntimeContractResource("new-milestone");

  assert.ok(metadata);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.spec?.executionProfile, "interactive-read");
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, [
    "blueprint-roadmapper"
  ]);
  assert.ok(metadata.requiredTools.includes("blueprint_config_get"));
  assert.ok(contract.spec?.reads.some((read) => read.includes("blueprint_config_get")));
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /blueprint_config_get[\s\S]*missing-milestone-summary[\s\S]*carry-forward-confirmation[\s\S]*starter-doc-overwrite-confirmation[\s\S]*firstPhaseNumber/
  );
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-new-milestone.toml"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("new-milestone docs keep requirementTransitions as starter-seed evidence only", async () => {
  const newMilestoneDoc = await readFile(
    path.join(repoRoot, "docs/commands/new-milestone.md"),
    "utf8"
  );

  assert.match(newMilestoneDoc, /requirementTransitions/);
  assert.match(
    newMilestoneDoc,
    /starter-seed evidence[\s\S]*do not become a competing `?\.blueprint\/REQUIREMENTS\.md`? write path/i
  );
  assert.match(
    newMilestoneDoc,
    /`decision` values `carry`, `modify`, `defer`, `retire`, `new`, `self-derived`, or `uncertain`/
  );
  assert.match(newMilestoneDoc, /sourceRefs/);
  assert.match(newMilestoneDoc, /rationale/);
  assert.match(newMilestoneDoc, /uncertainty explicitly/i);
  assert.match(newMilestoneDoc, /Safe default: stop without writing/);
  assert.match(newMilestoneDoc, /New Milestone First-Phase Handoff Packet/);
  assert.match(newMilestoneDoc, /openForDiscuss/);
  assert.match(newMilestoneDoc, /riskWatchlist/);
  assert.match(newMilestoneDoc, /deferredNotDoingNow/);
  assert.match(newMilestoneDoc, /canonicalReferences/);
  assert.match(newMilestoneDoc, /routeReceipt/);
  assert.match(newMilestoneDoc, /12-18 bullets/i);
  assert.match(newMilestoneDoc, /starter-only seed material/i);
  assert.match(newMilestoneDoc, /openForDiscuss.*confidence plus consequence/is);
  assert.match(newMilestoneDoc, /unverified claims as assumptions/i);
  assert.match(newMilestoneDoc, /named in-flight receipt/i);
  assert.match(newMilestoneDoc, /firstPhaseNumber/);
  assert.match(newMilestoneDoc, /firstContextPath/);
  assert.match(newMilestoneDoc, /renamedPhaseDirectories/);
  assert.match(newMilestoneDoc, /stop without writing\. When a safe route is needed, point to `\/blu-progress`/i);
  assert.match(newMilestoneDoc, /Does not route directly to `\/blu-plan-phase` or `\/blu-execute-phase`/);
});

test("new-milestone runtime docs expose scaffold first-phase receipt fields", async () => {
  const mcpTools = await readFile(path.join(repoRoot, "docs/MCP-TOOLS.md"), "utf8");
  const runtimeReference = await readFile(
    path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"),
    "utf8"
  );
  const artifactSchema = await readFile(
    path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"),
    "utf8"
  );

  for (const field of [
    "highestBasePhaseNumber",
    "firstPhaseNumber",
    "firstPhasePrefix",
    "firstPhaseDir",
    "firstContextPath",
    "deletedPhaseDirectories",
    "renamedPhaseDirectories"
  ]) {
    assert.match(mcpTools, new RegExp(field));
    assert.match(runtimeReference, new RegExp(field));
  }

  assert.match(mcpTools, /stale previews, conflicting first-phase directories, ambiguous first-phase directories, and missing first context paths block/i);
  assert.match(artifactSchema, /stale previews, conflicting first-phase directories, or ambiguous first-phase directories/i);
  assert.match(artifactSchema, /deletedPhaseDirectories: \[\]/);
  assert.match(artifactSchema, /renamedPhaseDirectories: \[\]/);
  assert.match(artifactSchema, /New Milestone First-Phase Handoff Packet/);
  assert.match(artifactSchema, /starter-only material for `\/blu-discuss-phase`/);
  assert.match(artifactSchema, /not a new typed `\.blueprint\/` write surface/i);
  assert.match(artifactSchema, /do not create a separate schema field or durable artifact class/i);
});
