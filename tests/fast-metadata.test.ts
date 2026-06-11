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
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_project_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /A task qualifies only when all are true/);
  assert.match(commandFile, /expected edit is obvious from the request/);
  assert.match(commandFile, /no repo\/domain research is needed/);
  assert.match(commandFile, /no multi-file blast-radius analysis is needed/);
  assert.match(commandFile, /no validation pass is needed beyond ordinary user review/);
  assert.match(commandFile, /Latency budget: project status only/);
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
  assert.match(fastRuntimeContract, /no-subagent execution path/i);
  assert.match(fastRuntimeContract, /\/blu-fast` qualifies only when all are true/i);
  assert.match(fastRuntimeContract, /\/blu-fast` latency budget/i);
  assert.match(fastRuntimeContract, /Do not create quick-run reports, phase summaries, phase artifacts/i);
  assert.match(fastRuntimeContract, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(fastRuntimeContract, /\/blu-health/);
  assert.match(fastRuntimeContract, /\/blu-quick/);
  assert.match(fastRuntimeContract, /\/blu-plan-phase/);
});

test("fast runtime contract resource is owned by runtime metadata, not docs", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("fast");

  assert.ok(metadata);

  const contract = await buildBlueprintCommandRuntimeContractResource("fast");

  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.commandSpecPath, metadata.sourceId);
  assert.equal(contract.spec.primarySkill, "blueprint-phase-execution");
  assert.deepEqual(contract.spec.reads, ["project status preflight through MCP"]);
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
    /skills\/blueprint-phase-execution\/references\/fast-runtime-contract\.md/i
  );
});

test("fast public docs require concrete task text and avoid capture boilerplate", async () => {
  const docsFile = await readFile(path.join(repoRoot, "docs/commands/fast.md"), "utf8");

  assert.match(docsFile, /\/blu-fast "Fix typo in README installation heading"/);
  assert.match(docsFile, /blueprint_project_status/);
  assert.doesNotMatch(docsFile, /^- none$/m);
  assert.doesNotMatch(docsFile, /\/blu fast$/m);
  assert.doesNotMatch(docsFile, /note, todo, backlog/i);
  assert.doesNotMatch(docsFile, /promoted, completed, or archived/i);
  assert.doesNotMatch(docsFile, /malformed index files/i);
  assert.doesNotMatch(docsFile, /Capture outputs/i);
  assert.doesNotMatch(docsFile, /Capture append fixture/i);
});
