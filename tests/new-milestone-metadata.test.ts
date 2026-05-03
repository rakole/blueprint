import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

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
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /carry-forward as the default/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /missing-milestone-summary/);
  assert.match(commandFile, /carry-forward-confirmation/);
  assert.match(commandFile, /starter-doc-overwrite-confirmation/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.ok(
    commandFile.indexOf("If the milestone summary report is missing") <
      commandFile.indexOf("Build carry-forward context through `mcp_blueprint_blueprint_artifact_summary_digest`")
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

  assert.match(skillFile, /\/blu-new-milestone/);
  assert.match(skillFile, /report\.milestone-summary/);
  assert.match(skillFile, /phase\.context/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /carry-forward as the default/i);
  assert.match(skillFile, /Preserve historical phase directories/i);
  assert.match(skillFile, /next whole-number phase/i);
  assert.match(skillFile, /\/blu-discuss-phase <first phase>/);
  assert.match(skillFile, /ask_user/);
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
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /missing-milestone-summary[\s\S]*carry-forward-confirmation[\s\S]*starter-doc-overwrite-confirmation/
  );
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-new-milestone.toml"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});
