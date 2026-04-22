import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("ship manifest references the maintenance skill, report tool, and explicit remote confirmation guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-ship.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_phase_locate/);
  assert.match(commandFile, /mcp_blueprint_blueprint_config_get/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(commandFile, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /pair it with visible `write_todos`/i);
  assert.match(commandFile, /When tracker support is unavailable, keep the same shipping flow linear/i);
  assert.match(commandFile, /ship-latest/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /draft versus ready PR mode/i);
  assert.match(commandFile, /gh/i);
  assert.match(commandFile, /manual fallback/i);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("ship doc, maintenance skill, and runtime reference capture ship visibility, tracker eligibility, and remote fallback safety", async () => {
  const docFile = await readFile(path.join(repoRoot, "docs/commands/ship.md"), "utf8");
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"),
    "utf8"
  );
  const runtimeReference = await readFile(
    path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"),
    "utf8"
  );

  assert.match(docFile, /Execution profile \| `high-risk-maintenance`/);
  assert.match(docFile, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(docFile, /resolved scope, active stage, pending gate, execution mode, next safe action/i);
  assert.match(docFile, /`update_topic` tool/i);
  assert.match(docFile, /`write_todos`/);
  assert.match(docFile, /tracker-eligible/i);
  assert.match(docFile, /session-local coordination only and must be paired with visible `write_todos`/i);
  assert.match(docFile, /When tracker support is unavailable, keep the same shipping flow linear/i);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-ship/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_phase_locate/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/i);
  assert.match(skillFile, /`update_topic` tool/i);
  assert.match(skillFile, /`write_todos`/);
  assert.match(skillFile, /tracker-eligible/i);
  assert.match(skillFile, /session-local coordination only/i);
  assert.match(skillFile, /dirty working tree/i);
  assert.match(skillFile, /optional push, and optional PR creation are separate steps/i);
  assert.match(skillFile, /ship-latest/);
  assert.match(skillFile, /missing or unauthenticated/i);

  assert.match(runtimeReference, /`ship`[\s\S]*High-risk-maintenance profile for branchy shipping flows/i);
  assert.match(runtimeReference, /`ship`[\s\S]*resolved scope, active stage, pending gate, execution mode, and next safe action visible/i);
  assert.match(runtimeReference, /`ship`[\s\S]*`update_topic` and `write_todos` for non-trivial shipping runs/i);
  assert.match(runtimeReference, /`ship`[\s\S]*tracker-eligible session-local coordination paired with visible todos/i);
  assert.match(runtimeReference, /`ship`[\s\S]*local prep plus optional push plus optional PR creation explicit/i);
});
