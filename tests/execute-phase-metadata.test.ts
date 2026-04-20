import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("execute-phase manifest references the execution gates, summary tools, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-execute-phase.toml"), "utf8");
  const docsFile = await readFile(path.join(repoRoot, "docs/commands/execute-phase.md"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-execution` skill/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /`blueprint-executor` subagent/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_validate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_load")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /artifactId: "phase\.summary"/);
  assert.match(commandFile, /workflow\.use_worktrees/);
  assert.match(commandFile, /parallelization\./);
  assert.match(commandFile, /git\.branching_strategy/);
  assert.match(commandFile, /one `XX-YY-SUMMARY\.md` artifact per completed plan/i);
  assert.match(commandFile, /lower-wave debt/i);
  assert.match(commandFile, /review, skip, or stop/i);
  assert.match(commandFile, /shared file set/i);
  assert.match(commandFile, /code-review, regression, or schema-drift/i);
  assert.match(commandFile, /gap-closure/i);
  assert.match(commandFile, /gapClosurePlans/);
  assert.match(commandFile, /Existing summaries only count as durable execution evidence when they are valid/i);
  assert.match(commandFile, /repair or replace target/i);
  assert.doesNotMatch(commandFile, /Existing summaries mean that plan already has durable execution evidence/i);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(docsFile, /Existing summary files only count as completed evidence when summary validation passes/i);
  assert.match(docsFile, /malformed summaries remain repair or replace targets/i);
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
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /blueprint-executor/);
  assert.match(skillFile, /summary/i);
  assert.match(skillFile, /blueprint_phase_summary_write/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /workflow\.use_worktrees/);
  assert.match(skillFile, /git\.branching_strategy/);
  assert.match(skillFile, /sequential and checkpointed/i);
  assert.match(skillFile, /review, skip, or stop/i);
  assert.match(skillFile, /valid durable summary artifact/i);
  assert.match(skillFile, /malformed summaries are repair or replace targets/i);
  assert.match(skillFile, /plans without valid summaries are pending work/i);
  assert.match(skillFile, /Existing valid summaries require explicit overwrite confirmation/i);
  assert.match(skillFile, /lower-wave debt/i);
  assert.match(skillFile, /gapClosurePlans/);
  assert.match(skillFile, /shared file set/i);
  assert.match(skillFile, /\/blu-progress/);
});
