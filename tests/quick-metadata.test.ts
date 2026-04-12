import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("quick manifest references the execution skill, bounded depth agents, and report-backed MCP tools", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu/quick.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-execution` skill/);
  assert.match(
    commandFile,
    /`blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` subagents/
  );
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md/);
  assert.doesNotMatch(
    commandFile,
    /agents\/blueprint-(researcher|planner|executor|verifier)\.md/
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_project_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_command_catalog")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /`--discuss`/);
  assert.match(commandFile, /`--research`/);
  assert.match(commandFile, /`--validate`/);
  assert.match(commandFile, /`--full`/);
  assert.match(commandFile, /`--force`/);
  assert.match(commandFile, /quick-run-latest/);
  assert.match(commandFile, /\/blu:plan-phase/);
  assert.match(commandFile, /\/blu:execute-phase/);
  assert.match(commandFile, /\/blu:progress/);
});

test("execution skill captures quick-run scope, report persistence, and implemented-only follow-up rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-execution/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu:execute-phase/);
  assert.match(skillFile, /\/blu:quick/);
  assert.match(skillFile, /\/blu:fast/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_command_catalog/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /quick-run-latest/);
  assert.match(skillFile, /bounded quick work stays report-backed/i);
  assert.match(skillFile, /implemented Blueprint surface/i);
  assert.match(skillFile, /\/blu:progress/);
});
