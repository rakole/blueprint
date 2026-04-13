import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("debug manifest references the debug skill, debugger agent, and report-backed MCP tools", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-debug.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-debug` skill/);
  assert.match(commandFile, /`blueprint-debugger` subagent/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-debug\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-debugger\.md/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_project_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_mutate_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /debug-latest/);
  assert.match(commandFile, /`--diagnose`/);
  assert.match(commandFile, /\/blu-quick/);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-progress/);
});

test("debug skill captures report persistence, diagnose-only rules, and bounded follow-up routing", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-debug/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-debug/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /debug-latest/);
  assert.match(skillFile, /Treat `--diagnose` as a hard diagnose-only boundary/i);
  assert.match(skillFile, /Keep `debug` investigative/i);
  assert.match(skillFile, /\/blu-quick/);
  assert.match(skillFile, /\/blu-progress/);
});
