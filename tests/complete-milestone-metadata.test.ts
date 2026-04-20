import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("complete-milestone manifest references report-driven closeout tools and summary routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-complete-milestone.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_load/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /derivedStatus\.milestoneAudit/);
  assert.match(commandFile, /READY_TO_CLOSE/);
  assert.match(commandFile, /contract\.authoringTemplate/);
  assert.match(commandFile, /\/blu-plan-milestone-gaps/);
  assert.match(commandFile, /explicit overwrite confirmation/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /milestone-complete-<milestone>/);
  assert.match(commandFile, /\/blu-milestone-summary <milestone>/);
  assert.doesNotMatch(commandFile, /blueprint_phase_mark_complete/);
});

test("roadmap-admin skill captures report-driven milestone closeout behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-complete-milestone/);
  assert.match(skillFile, /report\.milestone-complete/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /blueprint_state_load/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /derivedStatus\.milestoneAudit/);
  assert.match(skillFile, /readyForCompletion/);
  assert.match(skillFile, /contract\.authoringTemplate/);
  assert.match(skillFile, /\/blu-plan-milestone-gaps/);
  assert.match(skillFile, /report-driven and state-driven/i);
  assert.match(skillFile, /\/blu-milestone-summary <milestone>/);
  assert.match(skillFile, /ask_user/);
});
