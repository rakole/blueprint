import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("fast manifest references the execution skill and trivial inline MCP tools without subagents", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-fast.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-execution` skill/);
  assert.doesNotMatch(
    commandFile,
    /`blueprint-(researcher|planner|executor|verifier)`/,
    "fast should stay subagent-free"
  );
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-[a-z-]+\.md/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_project_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /\/blu-quick/);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-health/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /Do not use subagents\./);
  assert.match(commandFile, /STATE\.md`? records `\/blu-fast`/);
});
