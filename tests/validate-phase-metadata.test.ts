import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("validate-phase manifest references the validation tools, config gates, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-validate-phase.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(commandFile, /`blueprint-verifier` subagent/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_validate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_load")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /workflow\.verifier/);
  assert.match(commandFile, /workflow\.nyquist_validation/);
  assert.match(commandFile, /XX-VERIFICATION\.md/);
  assert.match(commandFile, /\*\*Coverage:\*\*/);
  assert.match(commandFile, /## Validation Summary/);
  assert.match(commandFile, /## Evidence Reviewed/);
  assert.match(commandFile, /## Gaps Found/);
  assert.match(commandFile, /## Suggested Repairs/);
  assert.match(commandFile, /## Next Safe Action/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
});

test("validate-phase skill captures summary-backed validation and verifier usage rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /execution summaries remain the source of truth/i);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /workflow\.verifier/);
  assert.match(skillFile, /workflow\.nyquist_validation/);
  assert.match(skillFile, /\*\*Coverage:\*\*/);
  assert.match(skillFile, /## Validation Summary/);
  assert.match(skillFile, /## Evidence Reviewed/);
  assert.match(skillFile, /## Gaps Found/);
  assert.match(skillFile, /## Suggested Repairs/);
  assert.match(skillFile, /## Next Safe Action/);
  assert.match(skillFile, /\/blu-progress/);
});
