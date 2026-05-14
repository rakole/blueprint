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
  assert.match(commandFile, /\.blueprint\/phases\/<NN>-<slug>\/<NN-CONTEXT\.md>/);
  assert.match(commandFile, /\/blu-discuss-phase <first phase>/);
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
    "requirementTransitions",
    "starter-seed evidence only",
    "sourceRefs",
    "self-derived",
    "uncertain",
    "Preserve historical phase directories",
    "next whole-number phase",
    "/blu-discuss-phase <first phase>",
    "ask_user",
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
    /blueprint_config_get[\s\S]*missing-milestone-summary[\s\S]*carry-forward-confirmation[\s\S]*starter-doc-overwrite-confirmation/
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
  assert.match(newMilestoneDoc, /named in-flight receipt/i);
  assert.match(newMilestoneDoc, /stop without writing\. When a safe route is needed, point to `\/blu-progress`/i);
});
