import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_phase_summary_index/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /explicit overwrite confirmation/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /\.blueprint\/reports\//);
  assert.match(commandFile, /\/blu-plan-milestone-gaps/);
  assert.match(commandFile, /\/blu-progress/);
});

test("audit-milestone skill captures milestone-evidence digest rules and report persistence", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-audit-milestone/);
  assert.match(skillFile, /report\.milestone-audit/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /explicit overwrite confirmation/i);
  assert.match(skillFile, /ask_user/);
});
