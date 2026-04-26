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
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools for `\/blu-fast`\./);
  assert.match(commandFile, /Do not turn `\/blu-fast` into a long-running progress flow with stage narration, visible todos, or tracker-backed branching\./);
  assert.doesNotMatch(commandFile, /`update_topic` tool to keep the active stage visible/);
  assert.doesNotMatch(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /Do not use subagents\./);
  assert.match(commandFile, /STATE\.md`? records `\/blu-fast`/);
});

test("fast skill and runtime reference keep the trivial path off the tracker and long-running progress layer", async () => {
  const [skillFile, fastRuntimeContract, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-execution/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-execution/references/fast-runtime-contract.md"
      ),
      "utf8"
    ),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/fast-runtime-contract\.md/
  );
  assert.match(skillFile, /Execution profile: `interactive-read`/);
  assert.match(fastRuntimeContract, /no-subagent execution path/i);
  assert.match(fastRuntimeContract, /Do not create quick-run reports, phase summaries, phase artifacts/i);
  assert.match(fastRuntimeContract, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(fastRuntimeContract, /\/blu-health/);
  assert.match(fastRuntimeContract, /\/blu-quick/);
  assert.match(fastRuntimeContract, /\/blu-plan-phase/);
  assert.match(
    runtimeReference,
    /`fast`[\s\S]*Interactive-read profile for trivial inline execution: keep the ask genuinely small, explicitly exclude tracker-backed branching plus `update_topic` or `write_todos` long-running visibility/i
  );
  assert.match(
    runtimeReference,
    /`fast`[\s\S]*skills\/blueprint-phase-execution\/references\/fast-runtime-contract\.md/i
  );
});
