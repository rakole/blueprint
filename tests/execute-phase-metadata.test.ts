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
  assert.match(commandFile, /`long-running-mutation`/);
  assert.match(commandFile, /Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route/);
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /`update_topic`/);
  assert.match(commandFile, /`write_todos`/);
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
  assert.match(commandFile, /one `XX-YY-SUMMARY\.md` artifact per plan/i);
  assert.match(commandFile, /lower-wave debt/i);
  assert.match(commandFile, /review, skip, or stop/i);
  assert.match(commandFile, /shared file set/i);
  assert.match(commandFile, /code-review, regression, or schema-drift/i);
  assert.match(commandFile, /pre-persistence gates/i);
  assert.match(commandFile, /post-execution checks/i);
  assert.match(commandFile, /disjoint write ownership/i);
  assert.match(commandFile, /single-agent fallback|execute sequentially inline/i);
  assert.match(commandFile, /test\/repair loop|repair loop/i);
  assert.match(commandFile, /PARTIAL` or `BLOCKED`/);
  assert.match(commandFile, /failed tests/i);
  assert.match(commandFile, /stale plan metadata|invalid saved plan/i);
  assert.match(commandFile, /rerun `mcp_blueprint_blueprint_phase_summary_index`/);
  assert.match(commandFile, /phase-level completion claim/i);
  assert.match(commandFile, /\/blu-validate-phase/);
  assert.match(commandFile, /\/blu-verify-work/);
  assert.match(commandFile, /gap-closure/i);
  assert.match(commandFile, /gapClosurePlans/);
  assert.match(commandFile, /Existing summaries only count as durable execution evidence when they are valid/i);
  assert.match(commandFile, /repair or replace target/i);
  assert.doesNotMatch(commandFile, /Existing summaries mean that plan already has durable execution evidence/i);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(docsFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docsFile, /## Shared Runtime Contract/);
  assert.match(docsFile, /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(
    docsFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docsFile, /shared long-running-mutation posture/i);
  assert.match(docsFile, /`update_topic`/);
  assert.match(docsFile, /`write_todos`/);
  assert.match(docsFile, /## In-Flight Progress Contract/);
  assert.match(docsFile, /Existing summary files only count as completed evidence when summary validation passes/i);
  assert.match(docsFile, /malformed summaries remain repair or replace targets/i);
  assert.match(docsFile, /Pre-persistence gates/i);
  assert.match(docsFile, /Ownership gates/i);
  assert.match(docsFile, /Verification gates/i);
  assert.match(docsFile, /State timing/i);
  assert.match(docsFile, /Subagent-capable runs/i);
  assert.match(docsFile, /Single-agent fallback runs/i);
  assert.match(docsFile, /`COMPLETED` is the only summary status that closes execution debt/i);
  assert.match(docsFile, /Verifier handoff/i);
  assert.match(docsFile, /phase-level completion claim/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md|agents\/blueprint-executor\.md/);
});

test("execute-phase skill captures wave-based execution and summary generation rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-execution/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-execute-phase/);
  assert.match(skillFile, /`long-running-mutation`/);
  assert.match(skillFile, /Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route/);
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(skillFile, /wave-aware order/i);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /`update_topic`/);
  assert.match(skillFile, /`write_todos`/);
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
  assert.match(skillFile, /Refuse to execute stale or invalid plans/i);
  assert.match(skillFile, /disjoint write ownership/i);
  assert.match(skillFile, /single-agent fallback/i);
  assert.match(skillFile, /summary\/checkpoint through MCP/i);
  assert.match(skillFile, /test\/repair loop/i);
  assert.match(skillFile, /PARTIAL` or `BLOCKED` summaries/i);
  assert.match(skillFile, /rerun `blueprint_phase_summary_index`/i);
  assert.match(skillFile, /failed tests/i);
  assert.match(skillFile, /pre-persistence gates/i);
  assert.match(skillFile, /post-execution checks/i);
  assert.match(skillFile, /phase-level completion claim/i);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /\/blu-verify-work/);
  assert.match(skillFile, /lower-wave debt/i);
  assert.match(skillFile, /gapClosurePlans/);
  assert.match(skillFile, /shared file set/i);
  assert.match(skillFile, /\/blu-progress/);
});
