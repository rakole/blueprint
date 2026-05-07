import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { DEBUG_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";
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
  assert.match(
    commandFile,
    /Execution profile: start in `interactive-read`[\s\S]*escalate to `long-running-mutation` only when the investigation becomes non-trivial/i
  );
  assert.match(commandFile, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe implemented action/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /session-local visibility tools only/i);
  assert.match(commandFile, /debug-latest/);
  assert.match(commandFile, /`--diagnose`/);
  assert.match(
    commandFile,
    /report-only,[\s\S]*capture a todo only after an explicit user ask or confirmation,[\s\S]*\/blu-quick[\s\S]*\/blu-plan-phase[\s\S]*\/blu-validate-phase[\s\S]*\/blu-progress/i
  );
  assert.match(commandFile, /must not silently create a todo/i);
  assert.match(commandFile, /\/blu-quick/);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-validate-phase/);
  assert.match(commandFile, /\/blu-progress/);
});

test("debug runtime-owned metadata, skill, and local contract capture the explicit follow-up gate", async () => {
  const [skillFile, runtimeContract] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-debug/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-debug/references/debug-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  assert.equal(DEBUG_RUNTIME_METADATA.commandName, "debug");
  assert.equal(DEBUG_RUNTIME_METADATA.catalog.primarySkill, "blueprint-debug");
  assert.equal(DEBUG_RUNTIME_METADATA.catalog.declaredStatus, "implemented");
  assert.equal(DEBUG_RUNTIME_METADATA.catalog.wave, 3);
  assert.equal(
    DEBUG_RUNTIME_METADATA.catalog.family,
    "Capture And Lightweight Execution"
  );
  assert.equal(
    DEBUG_RUNTIME_METADATA.catalog.risk,
    "Medium: exploratory shell commands and test runs are likely."
  );
  assert.deepEqual([...DEBUG_RUNTIME_METADATA.requiredTools], [
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_artifact_report_write",
    "blueprint_artifact_mutate_index",
    "blueprint_state_update"
  ]);
  assert.deepEqual([...DEBUG_RUNTIME_METADATA.optionalAgents], [
    "blueprint-debugger"
  ]);
  assert.deepEqual([...(DEBUG_RUNTIME_METADATA.requiredInputPaths ?? [])], [
    "commands/blu-debug.toml",
    "skills/blueprint-debug/references/debug-runtime-contract.md"
  ]);

  assert.match(skillFile, /input_bundles:/);
  assert.match(skillFile, /commands\/blu-debug\.toml/);
  assert.match(skillFile, /skills\/blueprint-debug\/references\/debug-runtime-contract\.md/);
  assert.doesNotMatch(skillFile, /## Required Inputs/);
  assert.doesNotMatch(skillFile, /docs\/commands\/debug\.md/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-debug/);
  assert.match(
    skillFile,
    /Execution profile: start in `interactive-read`[\s\S]*escalate to\s+`long-running-mutation` only when the investigation becomes non-trivial/i
  );
  assert.doesNotMatch(skillFile, /Execution profile: `long-running-mutation`/);
  assert.match(skillFile, /`update_topic` tool/i);
  assert.match(skillFile, /`write_todos` tool/i);
  assert.match(skillFile, /session-local coordination only/i);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /debug-latest/);
  assert.match(skillFile, /Treat `--diagnose` as a hard diagnose-only boundary/i);
  assert.match(
    skillFile,
    /report-only,[\s\S]*capture a todo only after an explicit user ask or confirmation,[\s\S]*\/blu-quick[\s\S]*\/blu-plan-phase[\s\S]*\/blu-validate-phase[\s\S]*\/blu-progress/i
  );
  assert.match(skillFile, /Keep `debug` investigative/i);
  assert.match(skillFile, /\/blu-quick/);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /\/blu-progress/);

  assert.match(runtimeContract, /Require a concrete issue statement/i);
  assert.match(runtimeContract, /repo is not initialized/i);
  assert.match(runtimeContract, /`--diagnose` as a hard diagnose-only boundary/i);
  assert.match(runtimeContract, /bare canonical report name `debug-latest`/i);
  assert.match(runtimeContract, /returned `path` as\s+authoritative/i);
  assert.match(runtimeContract, /explicit user ask or confirmation/i);
  assert.match(runtimeContract, /session-local visibility only/i);
  assert.match(runtimeContract, /\/blu-quick/);
  assert.match(runtimeContract, /\/blu-plan-phase/);
  assert.match(runtimeContract, /\/blu-validate-phase/);
  assert.match(runtimeContract, /\/blu-progress/);
});
