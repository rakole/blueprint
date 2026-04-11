import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("validate-phase manifest references the validation tools, config gates, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu/validate-phase.toml"), "utf8");

  assert.match(commandFile, /skills\/blueprint-phase-validation\.md/);
  assert.match(commandFile, /blueprint_phase_locate/);
  assert.match(commandFile, /blueprint_phase_summary_index/);
  assert.match(commandFile, /blueprint_phase_summary_read/);
  assert.match(commandFile, /blueprint_phase_validation_read/);
  assert.match(commandFile, /blueprint_phase_validation_write/);
  assert.match(commandFile, /blueprint_config_get/);
  assert.match(commandFile, /blueprint_artifact_validate/);
  assert.match(commandFile, /blueprint_state_load/);
  assert.match(commandFile, /blueprint_state_update/);
  assert.match(commandFile, /workflow\.verifier/);
  assert.match(commandFile, /workflow\.nyquist_validation/);
  assert.match(commandFile, /XX-VERIFICATION\.md/);
  assert.match(commandFile, /\/blu:progress/);
});

test("validate-phase skill captures summary-backed validation and verifier usage rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-validation.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu:validate-phase/);
  assert.match(skillFile, /execution summaries remain the source of truth/i);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /workflow\.verifier/);
  assert.match(skillFile, /workflow\.nyquist_validation/);
  assert.match(skillFile, /\/blu:progress/);
});
