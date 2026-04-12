import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("execute-phase manifest references the execution gates, summary tools, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-execute-phase.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-execution` skill/);
  assert.match(commandFile, /`blueprint-executor` subagent/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_validate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_load")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /workflow\.use_worktrees/);
  assert.match(commandFile, /parallelization\./);
  assert.match(commandFile, /git\.branching_strategy/);
  assert.match(commandFile, /one `XX-YY-SUMMARY\.md` artifact per completed plan/i);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md|agents\/blueprint-executor\.md/);
});

test("execute-phase skill captures wave-based execution and summary generation rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-execution/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-execute-phase/);
  assert.match(skillFile, /wave-aware order/i);
  assert.match(skillFile, /blueprint-executor/);
  assert.match(skillFile, /summary/i);
  assert.match(skillFile, /blueprint_phase_summary_write/);
  assert.match(skillFile, /workflow\.use_worktrees/);
  assert.match(skillFile, /git\.branching_strategy/);
  assert.match(skillFile, /\/blu-progress/);
});
