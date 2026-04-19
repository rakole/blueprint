import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("plan-phase manifest references the config gates, planner/checker loop, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-plan-phase.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-planning` skill/);
  assert.match(commandFile, /`blueprint-planner` and `blueprint-checker` subagents/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_context")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_research_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_artifact_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_validate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_load")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /workflow\.research/);
  assert.match(commandFile, /workflow\.ui_phase/);
  assert.match(commandFile, /workflow\.ui_safety_gate/);
  assert.match(commandFile, /workflow\.plan_check/);
  assert.match(commandFile, /actual saved context content|current context artifact content/i);
  assert.match(commandFile, /relevant discovery artifacts/i);
  assert.match(commandFile, /explicit confirmation path/i);
  assert.match(commandFile, /planner\/checker revision loop|re-run the checker/i);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /Omit `planId` to auto-assign the next available slot/i);
  assert.match(commandFile, /numeric plan id when targeting a specific plan/i);
  assert.match(commandFile, /numeric inputs such as `1` are accepted/i);
  assert.doesNotMatch(
    commandFile,
    /skills\/blueprint-phase-planning\.md|agents\/blueprint-(planner|checker)\.md/
  );
});

test("plan-phase skill captures the revision loop and safe follow-up rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-planning/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-plan-phase/);
  assert.match(skillFile, /workflow\.research/);
  assert.match(skillFile, /workflow\.ui_phase/);
  assert.match(skillFile, /workflow\.ui_safety_gate/);
  assert.match(skillFile, /workflow\.plan_check/);
  assert.match(skillFile, /blueprint-planner/);
  assert.match(skillFile, /blueprint-checker/);
  assert.match(skillFile, /explicit overwrite confirmation/i);
  assert.match(skillFile, /revision loop/i);
  assert.match(skillFile, /\/blu-progress/);
  assert.match(skillFile, /Omit `planId` to auto-assign the next slot/i);
  assert.match(skillFile, /numeric plan id when targeting a specific plan/i);
  assert.match(skillFile, /numeric inputs such as `1` are accepted/i);
});

test("plan-phase command doc explains the plan write contract for planId", async () => {
  const docFile = await readFile(path.join(repoRoot, "docs/commands/plan-phase.md"), "utf8");

  assert.match(docFile, /## Plan Persistence Contract/);
  assert.match(docFile, /Omit `planId` to let Blueprint auto-assign the next available plan slot/i);
  assert.match(docFile, /If targeting a specific plan, pass only the numeric plan id/i);
  assert.match(docFile, /numeric inputs such as `1` are also accepted/i);
  assert.match(docFile, /do not derive `planId` manually from a scaffold path/i);
  assert.match(docFile, /actual current `XX-CONTEXT\.md` content/i);
  assert.match(docFile, /relevant discovery artifacts/i);
});
