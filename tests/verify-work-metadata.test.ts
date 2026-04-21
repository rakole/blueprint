import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("verify-work manifest references the UAT template, validation tools, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-verify-work.toml"), "utf8");
  const docsFile = await readFile(path.join(repoRoot, "docs/commands/verify-work.md"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(commandFile, /`blueprint-verifier` subagent/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
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
  assert.match(commandFile, /XX-UAT\.md/);
  assert.match(commandFile, /artifactId: "phase\.uat"/);
  assert.match(commandFile, /authoringTemplate/);
  assert.match(commandFile, /review`, `skip`, or `stop`/i);
  assert.match(commandFile, /\*\*Resume State:\*\*` and `\*\*Checkpoint:\*\*/i);
  assert.match(commandFile, /Self-check the normalized draft against the returned contract before writing/);
  assert.match(commandFile, /Call `mcp_blueprint_blueprint_artifact_validate` after the write path/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /structured decision.*`view`.*`resume`.*`update`/is);
  assert.match(commandFile, /checkpointed,? created, or updated/i);
  assert.match(commandFile, /confirm any follow-up-fix capture/i);
  assert.match(commandFile, /locked markers and required section names unchanged/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
  assert.match(docsFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docsFile, /## Shared Runtime Contract/);
  assert.match(docsFile, /## In-Flight Progress Contract/);
  assert.match(docsFile, /shared long-running-mutation posture/i);
  assert.match(
    docsFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docsFile, /`review` \/ `skip` \/ `stop` checkpoints are the pending gates/i);
  assert.match(docsFile, /`update_topic`/);
  assert.match(docsFile, /`write_todos`/);
  assert.match(docsFile, /checkpointed and bounded/i);
  assert.match(docsFile, /checkpoint decisions[\s\S]*`review`, `skip`, or `stop`/i);
});

test("verify-work skill captures the canonical UAT contract and verifier usage rules", async () => {
  const [skillFile, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-verify-work/);
  assert.match(skillFile, /conversational UAT is resumable/i);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /workflow\.verifier/);
  assert.match(skillFile, /workflow\.nyquist_validation/);
  assert.match(skillFile, /artifactId: "phase\.uat"/);
  assert.match(skillFile, /blueprint_artifact_validate/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /review`, `skip`, or `stop`/i);
  assert.match(skillFile, /\*\*Resume State:\*\*` and `\*\*Checkpoint:\*\*/i);
  assert.match(skillFile, /next safe action on `\/blu-verify-work <phase>`/i);
  assert.match(skillFile, /confirm any follow-up-fix capture/i);
  assert.match(skillFile, /locked markers and required section names unchanged/i);
  assert.match(
    runtimeReference,
    /`verify-work`[\s\S]*Long-running-mutation profile; keep Resolve\/Read\/Decide\/Execute\/Persist\/Validate\/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(runtimeReference, /review\/skip\/stop checkpoints explicit/i);
  assert.match(runtimeReference, /resumable `XX-UAT\.md` checkpoint state/i);
});

test("verify-work docs and verifier agent describe the resumable UAT write-and-validate contract", async () => {
  const commandDoc = await readFile(path.join(repoRoot, "docs/commands/verify-work.md"), "utf8");
  const schemaDoc = await readFile(path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"), "utf8");
  const agentFile = await readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8");

  assert.match(commandDoc, /normalizes the final body to the canonical UAT template before persistence/i);
  assert.match(commandDoc, /validates the written artifact before updating state/i);
  assert.match(commandDoc, /only leaves roadmap completion green when the saved evidence remains valid/i);
  assert.match(commandDoc, /focused structured decision when an existing UAT artifact is present/i);
  assert.match(commandDoc, /review`, `skip`, and `stop` choices/i);
  assert.match(commandDoc, /next safe action stays on `\/blu-verify-work <phase>`/i);
  assert.match(commandDoc, /`\*\*Resume State:\*\*`[\s\S]*`\*\*Checkpoint:\*\*`/i);
  assert.match(commandDoc, /confirm any follow-up-fix capture/i);
  assert.match(schemaDoc, /`\*\*Resume State:\*\* RESUMED\|NEW\|CONTINUED`/);
  assert.match(schemaDoc, /`\*\*Checkpoint:\*\* <saved checkpoint path or none>`/);
  assert.match(schemaDoc, /`## Session State`/);
  assert.match(schemaDoc, /should be normalized to the canonical `phase\.uat` authoring template before persistence/i);
  assert.match(schemaDoc, /should be validated after write so schema drift or heading drift is caught before the next state update/i);
  assert.match(agentFile, /\*\*Resume State:\*\* RESUMED\|NEW\|CONTINUED/);
  assert.match(agentFile, /\*\*Checkpoint:\*\* <saved checkpoint path or none>/);
  assert.match(agentFile, /## Session State/);
  assert.match(agentFile, /keep the draft resumable, summary-aware, and aligned to the canonical UAT[\s\S]*template[\s\S]*before the parent persists it/i);
  assert.match(agentFile, /separate confirmation before persistence/i);
});
