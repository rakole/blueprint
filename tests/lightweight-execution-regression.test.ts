import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("lightweight execution keeps quick as the only long-running visible-progress path", async () => {
  const [quickToml, quickDoc, executionSkill, quickRuntimeContract, runtimeReference] = await Promise.all([
    readRepoFile("commands/blu-quick.toml"),
    readRepoFile("docs/commands/quick.md"),
    readRepoFile("skills/blueprint-phase-execution/SKILL.md"),
    readRepoFile("skills/blueprint-phase-execution/references/quick-runtime-contract.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(quickToml, /Execution profile: `long-running-mutation`/);
  assert.match(quickToml, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(quickToml, /tracker-eligible/i);
  assert.match(quickToml, /quick-run-latest/);

  assert.match(quickDoc, /In-flight posture for non-trivial runs: keeps the resolved scope, active stage, pending gate, execution mode, and next safe action visible/i);
  assert.match(quickDoc, /Use `update_topic` to surface the active stage and `write_todos`/);
  assert.match(quickDoc, /Branchy quick work is tracker-eligible/i);
  assert.match(quickDoc, /Persist the durable quick-run report/i);

  assert.match(executionSkill, /references\/quick-runtime-contract\.md/);
  assert.match(executionSkill, /references\/long-running-execution-profile\.md/);
  assert.match(quickRuntimeContract, /tracker-backed branching is allowed only as session-local coordination/i);
  assert.match(quickRuntimeContract, /quick-run-latest/);
  assert.match(quickRuntimeContract, /\/blu-plan-phase/);
  assert.match(quickRuntimeContract, /\/blu-execute-phase/);

  assert.match(runtimeReference, /`quick`[\s\S]*Long-running-mutation profile for non-trivial bounded quick runs/i);
  assert.match(runtimeReference, /`quick`[\s\S]*tracker-eligible session-local coordination paired with visible todos/i);
  assert.match(runtimeReference, /`quick`[\s\S]*persist a durable `quick-run-latest` report/i);
});

test("lightweight execution keeps fast on the trivial inline path instead of merging quick's progress layer", async () => {
  const [fastToml, fastDoc, executionSkill, fastRuntimeContract, runtimeReference] = await Promise.all([
    readRepoFile("commands/blu-fast.toml"),
    readRepoFile("docs/commands/fast.md"),
    readRepoFile("skills/blueprint-phase-execution/SKILL.md"),
    readRepoFile("skills/blueprint-phase-execution/references/fast-runtime-contract.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(fastToml, /Execution profile: `interactive-read`/);
  assert.match(fastToml, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools for `\/blu-fast`\./);
  assert.match(fastToml, /Do not turn `\/blu-fast` into a long-running progress flow/i);
  assert.match(fastToml, /Do not create quick-run reports, phase artifacts, or other ad hoc persistence as side effects of `fast`\./);
  assert.match(fastToml, /Do not use subagents\./);
  assert.doesNotMatch(fastToml, /quick-run-latest/);
  assert.doesNotMatch(fastToml, /tracker-eligible/i);

  assert.match(fastDoc, /does not adopt tracker-backed branching or the long-running progress layer used by `quick` and lifecycle execution/i);
  assert.match(fastDoc, /Do not use `update_topic`, `write_todos`, or tracker tools to make a trivial run look long-running\./);
  assert.match(fastDoc, /In-flight posture: none beyond a concise inline summary or reroute/i);
  assert.match(fastDoc, /Does not create quick-run reports, phase artifacts, or subagent side effects\./);

  assert.match(executionSkill, /references\/fast-runtime-contract\.md/);
  assert.match(fastRuntimeContract, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(fastRuntimeContract, /Do not create quick-run reports, phase summaries, phase artifacts/i);
  assert.match(fastRuntimeContract, /no-subagent execution path/i);

  assert.match(runtimeReference, /`fast`[\s\S]*Interactive-read profile for trivial inline execution/i);
  assert.match(runtimeReference, /`fast`[\s\S]*explicitly exclude tracker-backed branching plus `update_topic` or `write_todos` long-running visibility/i);
  assert.match(runtimeReference, /`fast`[\s\S]*refuse to add report-backed or subagent depth/i);
});

test("lightweight execution keeps debug investigative with its own report and follow-up gate", async () => {
  const [debugToml, debugDoc, debugSkill, runtimeReference] = await Promise.all([
    readRepoFile("commands/blu-debug.toml"),
    readRepoFile("docs/commands/debug.md"),
    readRepoFile("skills/blueprint-debug/SKILL.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(
    debugToml,
    /Execution profile: start in `interactive-read`[\s\S]*escalate to `long-running-mutation` only when the investigation becomes non-trivial/i
  );
  assert.match(debugToml, /debug-latest/);
  assert.match(debugToml, /report-only, capture a todo, route to `\/blu-quick`, route to `\/blu-plan-phase`, or defer to `\/blu-progress`/);
  assert.match(debugToml, /must not silently create a todo/i);
  assert.doesNotMatch(debugToml, /tracker-eligible/i);
  assert.doesNotMatch(debugToml, /quick-run-latest/);

  assert.match(debugDoc, /`debug` does not imply tracker-backed branching, hidden fix execution, or silent todo capture\./);
  assert.match(debugDoc, /Persists a durable `debug-latest` report through MCP/i);
  assert.match(debugDoc, /stop on an explicit follow-up gate/i);
  assert.doesNotMatch(debugDoc, /Do not use `update_topic`, `write_todos`, or tracker tools to make a trivial run look long-running\./);

  assert.match(debugSkill, /Treat `--diagnose` as a hard diagnose-only boundary/i);
  assert.match(
    debugSkill,
    /Stop on an explicit follow-up gate after the diagnosis:[\s\S]*report-only,[\s\S]*capture a todo,[\s\S]*`\/blu-quick`,[\s\S]*`\/blu-plan-phase`,[\s\S]*`\/blu-progress`/
  );
  assert.match(debugSkill, /Keep `debug` investigative/i);
  assert.doesNotMatch(debugSkill, /tracker-eligible/i);

  assert.match(runtimeReference, /`debug`[\s\S]*Interactive-read profile for evidence-backed investigations/i);
  assert.match(runtimeReference, /`debug`[\s\S]*persist a durable `debug-latest` report/i);
  assert.match(runtimeReference, /`debug`[\s\S]*require an explicit follow-up gate before todo capture or fix attempts/i);
  assert.doesNotMatch(runtimeReference, /`debug`[\s\S]*tracker-eligible session-local coordination paired with visible todos/i);
});
