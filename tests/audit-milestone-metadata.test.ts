import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

test("audit-milestone manifest references the roadmap audit tools, overwrite gate, and safe routing contract", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-audit-milestone.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.match(commandFile, /`blueprint-verifier` subagent/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-verifier\.md/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(
    commandFile,
    /Use the exact `mcp_blueprint_blueprint_roadmap_read\.milestone` value as `<milestone>` and let `mcp_blueprint_blueprint_artifact_report_write` own normalization\./
  );
  assert.match(commandFile, /mcp_blueprint_blueprint_phase_summary_index/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /explicit overwrite confirmation/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /milestone-audit-overwrite-confirmation/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /grouped requirement, integration, flow, and optional gap sections/i);
  assert.match(commandFile, /traceability notes/i);
  assert.match(commandFile, /\.blueprint\/reports\//);
  assert.match(commandFile, /\/blu-plan-milestone-gaps/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(commandFile, /may also mutate code or git state/i);
});

test("audit-milestone skill captures milestone-evidence digest rules and report persistence", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-audit-milestone/);
  assert.match(skillFile, /report\.milestone-audit/);
  assert.match(
    skillFile,
    /Use the exact `blueprint_roadmap_read\.milestone` value as `<milestone>` and let `blueprint_artifact_report_write` own normalization\./
  );
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /explicit overwrite confirmation/i);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(skillFile, /traceability repair/i);
});

test("audit-milestone runtime-owned metadata aligns to the interactive-read report contract", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("audit-milestone");
  const contract = await buildBlueprintCommandRuntimeContractResource("audit-milestone");

  assert.ok(metadata);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.spec?.executionProfile, "interactive-read");
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, [
    "blueprint-verifier"
  ]);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /report\.milestone-audit[\s\S]*milestone-audit-overwrite-confirmation[\s\S]*\.blueprint\/reports\//
  );
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-audit-milestone.toml"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});
