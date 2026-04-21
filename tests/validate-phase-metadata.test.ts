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
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
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
  assert.match(commandFile, /XX-VERIFICATION\.md/);
  assert.match(commandFile, /artifactId: "phase\.verification"/);
  assert.match(commandFile, /authoringTemplate/);
  assert.match(commandFile, /locked markers and required section names unchanged/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
});

test("validate-phase skill captures summary-backed validation and verifier usage rules", async () => {
  const [skillFile, docFile, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/validate-phase.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /execution summaries remain the source of truth/i);
  assert.match(skillFile, /Execution profile for `validate-phase`, `verify-work`, and the long-running parts of `add-tests`: `long-running-mutation`/);
  assert.match(skillFile, /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(skillFile, /resolved scope, active stage, pending gate, execution mode, next safe action/i);
  assert.match(
    skillFile,
    /keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/i
  );
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /workflow\.verifier/);
  assert.match(skillFile, /workflow\.nyquist_validation/);
  assert.match(skillFile, /artifactId: "phase\.verification"/);
  assert.match(skillFile, /locked markers and required section names unchanged/i);
  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docFile, /## Shared Runtime Contract/);
  assert.match(docFile, /## In-Flight Progress Contract/);
  assert.match(docFile, /saved-summary-first contract explicit/i);
  assert.match(docFile, /pending gate, execution mode, and next safe action/i);
  assert.match(docFile, /required-tool derivation through `blueprint_artifact_contract_read`/i);
  assert.match(runtimeReference, /`validate-phase`[\s\S]*Long-running-mutation profile; keep Resolve\/Read\/Decide\/Execute\/Persist\/Validate\/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible/i);
});
