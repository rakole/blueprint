import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { TOOL_DEFINITIONS } from "../src/mcp/tool-definitions.js";

const tools = ["blueprint_plan_prepare", "blueprint_plan_submit", "blueprint_plan_read"] as const;
const runtimePath = "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md";
const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

test("plan-phase catalog and live runtime expose the direct publication lifecycle", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("plan-phase");
  const contract = await buildBlueprintCommandRuntimeContractResource("plan-phase");
  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#plan-phase");
  assert.equal(metadata.catalog.primarySkill, "blueprint-phase-planning");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.spec.executionProfile, "long-running-mutation");
  assert.deepEqual(metadata.requiredTools, [...tools]);
  assert.deepEqual(metadata.runtimeReference.exactMcpDestination, [...tools]);
  assert.deepEqual(metadata.optionalAgents, ["blueprint-planner", "blueprint-checker"]);
  assert.deepEqual(metadata.requiredInputPaths, [runtimePath]);
  assert.deepEqual(contract.skillInputs.commandSpecific, [runtimePath]);
  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  for (const name of tools) assert.ok(TOOL_DEFINITIONS.some(tool => tool.name === name), name);
  assert.equal(contract.skillInputs.effective.some(input => input.startsWith("docs/")), false);
  assert.match(metadata.spec.writes.join("\n"), /metadata[\s\S]*blueprint_plan_submit[\s\S]*STATE\.md/);
  assert.equal(TOOL_DEFINITIONS.some(tool => tool.name === "blueprint_plan_finalize"), false);
  assert.match(metadata.runtimeReference.contractNotes, /Rejected documents[\s\S]*never retained/);
  assert.match(metadata.runtimeReference.contractNotes, /state-aware routing to implemented follow-ups/);
});

test("thin command and skill keep persistence, readiness and completion ownership in MCP", async () => {
  const [manifest, skill] = await Promise.all([read("commands/blu-plan-phase.toml"), read("skills/blueprint-phase-planning/SKILL.md")]);
  assert.ok(Buffer.byteLength(manifest) < 4000);
  assert.ok(Buffer.byteLength(skill) < 4000);
  for (const name of tools) {
    assert.ok(manifest.includes(blueprintRuntimeToolFqn(name)));
    assert.ok(skill.includes(name));
  }
  for (const source of [manifest, skill]) {
    assert.match(source, /plan-phase-runtime-contract\.md/);
    assert.match(source, /missing XX-SPEC\.md.{0,20}nonblocking/i);
    assert.match(source, /workflow\.plan_check/);
    assert.match(source, /No raw .*\.blueprint/);
    assert.match(source, /Downstream Execution Handoff/);
    assert.doesNotMatch(source, /blueprint_phase_plan_write|blueprint_state_update|blueprint_artifact_scaffold/);
  }
  assert.match(manifest, /add\/revise\/replace[\s\S]*overwrite confirmation/);
  assert.match(manifest, /Never claim completion without a published receipt/);
  assert.match(skill, /inline\s+review when that agent is unavailable/);
});

test("planner and checker remain bounded read-only workers with reviewed model output", async () => {
  for (const file of ["agents/blueprint-planner.md", "agents/blueprint-checker.md"]) {
    const source = await read(file);
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source)?.[1];
    assert.ok(frontmatter);
    const block = /^tools:\n((?:  - .+\n)+)/m.exec(frontmatter)?.[1];
    assert.ok(block);
    assert.deepEqual(block.trim().split("\n").map(line => line.replace(/^\s*-\s*/, "")),
      ["list_directory", "read_file", "glob", "grep_search"]);
    assert.match(source, /parent command owns/i);
    assert.match(source, /revision/);
    assert.doesNotMatch(source, /blueprint_phase_plan_write/);
  }
  const checker = await read("agents/blueprint-checker.md");
  assert.match(checker, /actual reviewed model/);
  assert.match(checker, /ACCEPT/);
  assert.match(checker, /resolved[\s\S]*recurring[\s\S]*new[\s\S]*regressed/);
  assert.match(checker, /UI-Spec Six-Dimension Gate/);
});
