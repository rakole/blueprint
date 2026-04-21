import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("add-tests manifest references visibility, validation/report tools, bounded agents, and safe follow-up routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-add-tests.toml"),
    "utf8"
  );

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /current verification status/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /Prefer Gemini CLI's built-in `ask_user` tool/i);
  assert.match(commandFile, /`blueprint-executor` subagent/);
  assert.match(commandFile, /`blueprint-verifier` subagent/);

  for (const toolName of [
    "blueprint_phase_locate",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_validation_read",
    "blueprint_artifact_contract_read",
    "blueprint_phase_validation_write",
    "blueprint_artifact_list",
    "blueprint_artifact_validate",
    "blueprint_artifact_report_write",
    "blueprint_state_load",
    "blueprint_state_update"
  ] as const) {
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.match(commandFile, /XX-VERIFICATION\.md/);
  assert.match(commandFile, /add-tests-<phase>/);
  assert.match(commandFile, /\/blu-execute-phase <phase>/);
  assert.match(commandFile, /\/blu-validate-phase <phase>/);
  assert.match(commandFile, /\/blu-code-review <phase>/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(
    commandFile,
    /skills\/blueprint-phase-validation\.md|agents\/blueprint-executor\.md|agents\/blueprint-verifier\.md/
  );
});

test("phase-validation skill captures the shipped add-tests contract", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-add-tests/);
  assert.match(skillFile, /### `add-tests`/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint-executor/);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /verification status/i);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /Use `ask_user` for structured scope or breadth decisions/i);
  assert.match(skillFile, /add-tests-<phase>/);
  assert.match(skillFile, /\/blu-code-review <phase>/);
});
