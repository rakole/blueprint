import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("debug manifest references the debug skill, debugger agent, and report-backed MCP tools", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-debug.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-debug` skill/);
  assert.match(commandFile, /`blueprint-debugger` subagent/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-debug\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-debugger\.md/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_project_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_mutate_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /debug-latest/);
  assert.match(commandFile, /`--diagnose`/);
  assert.match(
    commandFile,
    /report-only,[\s\S]*capture a todo,[\s\S]*\/blu-quick[\s\S]*\/blu-plan-phase[\s\S]*\/blu-progress/i
  );
  assert.match(commandFile, /must not silently create a todo/i);
  assert.match(commandFile, /\/blu-quick/);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-progress/);
});

test("debug docs, skill, and runtime reference capture the explicit follow-up gate", async () => {
  const [commandDoc, skillFile, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/debug.md"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-debug/SKILL.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(commandDoc, /\| Execution profile \| `interactive-read` \|/);
  assert.match(commandDoc, /## Shared Runtime Contract/);
  assert.match(commandDoc, /## Diagnose-Only And Follow-Up Gates/);
  assert.match(commandDoc, /must not silently create a todo/i);
  assert.match(
    commandDoc,
    /report-only,[\s\S]*capture a todo,[\s\S]*\/blu-quick[\s\S]*\/blu-plan-phase[\s\S]*\/blu-progress/i
  );
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-debug/);
  assert.match(skillFile, /Execution profile: `interactive-read`/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /debug-latest/);
  assert.match(skillFile, /Treat `--diagnose` as a hard diagnose-only boundary/i);
  assert.match(
    skillFile,
    /report-only,[\s\S]*capture a todo,[\s\S]*\/blu-quick[\s\S]*\/blu-plan-phase[\s\S]*\/blu-progress/i
  );
  assert.match(skillFile, /Keep `debug` investigative/i);
  assert.match(skillFile, /\/blu-quick/);
  assert.match(skillFile, /\/blu-progress/);

  assert.match(runtimeReference, /`debug`[\s\S]*Interactive-read profile for evidence-backed investigations/i);
  assert.match(runtimeReference, /`debug`[\s\S]*explicit follow-up gate before todo capture or fix attempts/i);
});
