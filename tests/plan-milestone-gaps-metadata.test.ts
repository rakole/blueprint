import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

test("plan-milestone-gaps manifest references the audit-first gap-planning tools and confirmation gate", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-plan-milestone-gaps.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.match(commandFile, /`blueprint-roadmapper` subagent/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-roadmapper\.md/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_add_phase/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /\/blu-audit-milestone/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /missing-milestone-audit/);
  assert.match(commandFile, /no-actionable-gaps/);
  assert.match(commandFile, /gap-plan-confirmation/);
  assert.match(commandFile, /Do not use\s+`update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /structured gap sections/i);
  assert.match(commandFile, /\/blu-discuss-phase <first new phase number>/);
  assert.doesNotMatch(commandFile, /may also mutate code or git state/i);
});

test("roadmap-admin skill captures grouped audit-follow-up planning behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-plan-milestone-gaps/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /grouping reviewable/i);
  assert.match(skillFile, /one explicit confirmation/i);
  assert.match(skillFile, /requirements traceability repair/i);
  assert.match(skillFile, /ask_user/i);
  assert.match(skillFile, /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(skillFile, /\/blu-discuss-phase <phase>/);
});

test("plan-milestone-gaps runtime-owned metadata aligns to the interactive-read roadmap-admin contract", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("plan-milestone-gaps");
  const contract =
    await buildBlueprintCommandRuntimeContractResource("plan-milestone-gaps");

  assert.ok(metadata);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.spec?.executionProfile, "interactive-read");
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, [
    "blueprint-roadmapper"
  ]);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /missing-milestone-audit[\s\S]*gap-plan-confirmation[\s\S]*\/blu-discuss-phase <first new phase>/
  );
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-plan-milestone-gaps.toml"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});
