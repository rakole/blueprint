import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
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
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_lightweight_preflight")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /A task qualifies only when all are true/);
  assert.match(commandFile, /expected edit is obvious from the request/);
  assert.match(commandFile, /no repo\/domain research is needed/);
  assert.match(commandFile, /no multi-file blast-radius analysis is needed/);
  assert.match(commandFile, /no validation pass is needed beyond ordinary user review/);
  assert.match(commandFile, /only update it when Blueprint is initialized and healthy/);
  assert.match(commandFile, /Preserve a cache-friendly prompt layout/i);
  assert.match(commandFile, /Common path tool budget:[\s\S]*lightweight_preflight[\s\S]*state_update/i);
  assert.match(commandFile, /Do not add redundant primitive MCP reads on the common path/i);
  assert.match(commandFile, /Never write a report from `\/blu-fast`/i);
  assert.match(commandFile, /Latency budget: lightweight preflight only/);
  assert.match(commandFile, /Final response budget: max 8 lines/i);
  assert.match(commandFile, /qualification reason, state update or no-write status, any reroute or warning, and the next safe implemented action/i);
  assert.match(commandFile, /\/blu-quick/);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-health/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /Do not use\s+`update_topic`, `write_todos`, or task tracker tools for `\/blu-fast`\./);
  assert.match(commandFile, /Do not turn `\/blu-fast` into a long-running progress flow with stage narration, visible todos, or tracker-backed branching\./);
  assert.doesNotMatch(commandFile, /`update_topic` tool to keep the active stage visible/);
  assert.doesNotMatch(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /Do not use subagents\./);
  assert.match(commandFile, /STATE\.md`? records `\/blu-fast`/);
});

test("fast skill and local runtime contract keep the trivial path off the tracker and long-running progress layer", async () => {
  const [skillFile, fastRuntimeContract] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-execution/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-execution/references/fast-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/fast-runtime-contract\.md/
  );
  assert.match(skillFile, /Execution profile: `interactive-read`/);
  assert.match(skillFile, /Keep `\/blu-fast` and `\/blu-quick` cache-friendly/i);
  assert.match(fastRuntimeContract, /no-subagent execution path/i);
  assert.match(fastRuntimeContract, /\/blu-fast` qualifies only when all are true/i);
  assert.match(fastRuntimeContract, /static\s+prefix/i);
  assert.match(fastRuntimeContract, /Common path tool budget:[\s\S]*lightweight_preflight[\s\S]*state_update/i);
  assert.match(fastRuntimeContract, /Never write a report from `\/blu-fast`/i);
  assert.match(fastRuntimeContract, /\/blu-fast` latency budget/i);
  assert.match(fastRuntimeContract, /final response:\s+concise inline summary, max 8 lines/i);
  assert.match(fastRuntimeContract, /The response stays within 8 lines/i);
  assert.match(fastRuntimeContract, /Do not create quick-run reports, phase summaries, phase artifacts/i);
  assert.match(fastRuntimeContract, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(fastRuntimeContract, /\/blu-health/);
  assert.match(fastRuntimeContract, /\/blu-quick/);
  assert.match(fastRuntimeContract, /\/blu-plan-phase/);
});

test("fast runtime contract resource is owned by runtime metadata, not docs", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("fast");

  assert.ok(metadata);
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-phase-execution/references/fast-runtime-contract.md"
  ]);

  const contract = await buildBlueprintCommandRuntimeContractResource("fast");

  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.commandSpecPath, metadata.sourceId);
  assert.equal(contract.spec.primarySkill, "blueprint-phase-execution");
  assert.deepEqual(contract.spec.reads, [
    "lightweight preflight classification and project status through MCP"
  ]);
  assert.deepEqual(contract.spec.requiredTools, [...metadata.requiredTools]);
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.spec.optionalSubagents, []);
  assert.deepEqual(contract.runtimeReference.optionalAgents, []);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "commands/blu-fast.toml",
    "skills/blueprint-phase-execution/references/fast-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /qualify only explicit obvious tasks with no research, multi-file blast-radius analysis, useful durable report, validation pass beyond ordinary user review, or subagent value/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /keep the static prompt prefix on command identity, hard contract, routing ladder, tool boundaries, and response schema expectations/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /common tool path to blueprint_lightweight_preflight plus optional blueprint_state_update only after a successful initialized and healthy run/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /avoid redundant primitive reads once preflight surfaced classification, health, and next action/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /final response within 8 lines with qualification reason, state-update or no-write status, any reroute or warning, and the next safe implemented action/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /skills\/blueprint-phase-execution\/references\/fast-runtime-contract\.md/i
  );
});
