import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("quick manifest references the execution skill, bounded depth agents, and report-backed MCP tools", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-quick.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-execution` skill/);
  assert.match(
    commandFile,
    /`blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` subagents/
  );
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md/);
  assert.doesNotMatch(
    commandFile,
    /agents\/blueprint-(researcher|planner|executor|verifier)\.md/
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_project_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_command_catalog")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /session-local, pair it with visible `write_todos`/i);
  assert.match(commandFile, /When the host lacks them, preserve the same progress in prose/i);
  assert.match(commandFile, /When tracker support is unavailable, keep the same bounded quick flow linear/i);
  assert.match(commandFile, /`--discuss`/);
  assert.match(commandFile, /`--research`/);
  assert.match(commandFile, /`--validate`/);
  assert.match(commandFile, /`--full`/);
  assert.match(commandFile, /`--force`/);
  assert.match(commandFile, /quick-run-latest/);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(commandFile, /\/blu-progress/);
});

test("execution skill and runtime reference capture quick-run visibility, tracker eligibility, and report persistence", async () => {
  const [skillFile, quickRuntimeContract, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-execution/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-execution/references/quick-runtime-contract.md"
      ),
      "utf8"
    ),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-quick/);
  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/quick-runtime-contract\.md/
  );
  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/long-running-execution-profile\.md/
  );

  assert.match(quickRuntimeContract, /quick-run-latest/);
  assert.match(quickRuntimeContract, /tracker-backed branching is allowed only as session-local coordination/i);
  assert.match(quickRuntimeContract, /saved phase plan,\s+multi-wave execution/i);
  assert.match(quickRuntimeContract, /--discuss`, `--research`, `--validate`, and `--full`/);
  assert.match(quickRuntimeContract, /blueprint-researcher/);
  assert.match(quickRuntimeContract, /blueprint-planner/);
  assert.match(quickRuntimeContract, /blueprint-executor/);
  assert.match(quickRuntimeContract, /blueprint-verifier/);
  assert.match(quickRuntimeContract, /\/blu-progress/);

  assert.match(runtimeReference, /`quick`[\s\S]*Long-running-mutation profile for non-trivial bounded quick runs/i);
  assert.match(runtimeReference, /`quick`[\s\S]*resolved scope, active stage, pending gate, execution mode, and next safe action visible/i);
  assert.match(runtimeReference, /`quick`[\s\S]*tracker-eligible session-local coordination paired with visible todos/i);
  assert.match(runtimeReference, /`quick`[\s\S]*do not let quick impersonate saved planning or broad lifecycle execution/i);
  assert.match(
    runtimeReference,
    /`quick`[\s\S]*skills\/blueprint-phase-execution\/references\/quick-runtime-contract\.md/i
  );
});
