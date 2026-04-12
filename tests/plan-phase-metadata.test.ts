import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("plan-phase manifest references the config gates, planner/checker loop, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu/plan-phase.toml"), "utf8");

  assert.match(commandFile, /skills\/blueprint-phase-planning\.md/);
  assert.match(commandFile, /blueprint_phase_locate/);
  assert.match(commandFile, /blueprint_phase_context/);
  assert.match(commandFile, /blueprint_phase_research_status/);
  assert.match(commandFile, /blueprint_phase_plan_index/);
  assert.match(commandFile, /blueprint_phase_plan_read/);
  assert.match(commandFile, /blueprint_phase_plan_write/);
  assert.match(commandFile, /blueprint_config_get/);
  assert.match(commandFile, /blueprint_artifact_validate/);
  assert.match(commandFile, /blueprint_state_load/);
  assert.match(commandFile, /blueprint_state_update/);
  assert.match(commandFile, /workflow\.research/);
  assert.match(commandFile, /workflow\.ui_phase/);
  assert.match(commandFile, /workflow\.ui_safety_gate/);
  assert.match(commandFile, /workflow\.plan_check/);
  assert.match(commandFile, /explicit confirmation path/i);
  assert.match(commandFile, /planner\/checker revision loop|re-run the checker/i);
  assert.match(commandFile, /\/blu:progress/);
});

test("plan-phase skill captures the revision loop and safe follow-up rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-planning/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu:plan-phase/);
  assert.match(skillFile, /workflow\.research/);
  assert.match(skillFile, /workflow\.ui_phase/);
  assert.match(skillFile, /workflow\.ui_safety_gate/);
  assert.match(skillFile, /workflow\.plan_check/);
  assert.match(skillFile, /blueprint-planner/);
  assert.match(skillFile, /blueprint-checker/);
  assert.match(skillFile, /explicit overwrite confirmation/i);
  assert.match(skillFile, /revision loop/i);
  assert.match(skillFile, /\/blu:progress/);
});
