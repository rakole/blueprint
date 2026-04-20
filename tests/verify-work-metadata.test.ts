import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("verify-work manifest references the UAT template, validation tools, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-verify-work.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(commandFile, /`blueprint-verifier` subagent/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_validate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_load")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /workflow\.verifier/);
  assert.match(commandFile, /workflow\.nyquist_validation/);
  assert.match(commandFile, /XX-UAT\.md/);
  assert.match(commandFile, /artifactId: "phase\.uat"/);
  assert.match(commandFile, /authoringTemplate/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /structured decision: `view`, `resume`, or `update`/i);
  assert.match(commandFile, /locked markers and required section names unchanged/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
});

test("verify-work skill captures the canonical UAT contract and verifier usage rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-verify-work/);
  assert.match(skillFile, /conversational UAT is resumable/i);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /workflow\.verifier/);
  assert.match(skillFile, /workflow\.nyquist_validation/);
  assert.match(skillFile, /artifactId: "phase\.uat"/);
  assert.match(skillFile, /locked markers and required section names unchanged/i);
});
