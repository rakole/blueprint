import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("lightweight execution keeps quick as the only long-running visible-progress path", async () => {
  const [quickToml, executionSkill, quickRuntimeContract] = await Promise.all([
    readRepoFile("commands/blu-quick.toml"),
    readRepoFile("skills/blueprint-phase-execution/SKILL.md"),
    readRepoFile("skills/blueprint-phase-execution/references/quick-runtime-contract.md")
  ]);
  const quickMetadata = getRuntimeOwnedCommandMetadata("quick");

  assert.ok(quickMetadata);

  assert.match(quickToml, /Execution profile: `long-running-mutation`/);
  assert.match(quickToml, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(quickToml, /tracker-eligible/i);
  assert.match(quickToml, /pre-authorization for (?:a )?bounded non-destructive/i);
  assert.match(quickToml, /run cheap validation by default/i);
  assert.match(quickToml, /use `blueprint-planner`[^\n]+`workflow\.subagents` is enabled/);
  assert.match(quickToml, /use `blueprint-executor`[^\n]+`workflow\.subagents` is enabled/);
  assert.match(quickToml, /quick-run-latest/);
  assert.match(
    quickToml,
    /do not hand-address `\.blueprint\/reports\/quick-run-latest\.md`/i
  );

  assert.match(executionSkill, /references\/quick-runtime-contract\.md/);
  assert.match(executionSkill, /references\/long-running-execution-profile\.md/);
  assert.match(
    executionSkill,
    /Start from `blueprint_lightweight_preflight` before optional subagent\s+decisions/i
  );
  assert.match(
    executionSkill,
    /effective config, health\/new-project routing, implemented routes,\s+and overwrite gates/i
  );
  assert.match(quickRuntimeContract, /tracker-backed branching is allowed only as session-local coordination/i);
  assert.match(quickRuntimeContract, /pre-authorization\s+for bounded non-destructive depth branches/i);
  assert.match(quickRuntimeContract, /Cheap means a focused test, lint, typecheck, or build/i);
  assert.match(quickRuntimeContract, /quick-run-latest/);
  assert.match(quickRuntimeContract, /\/blu-plan-phase/);
  assert.match(quickRuntimeContract, /\/blu-execute-phase/);
  assert.equal(quickMetadata.spec.executionProfile, "long-running-mutation");
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /Long-running-mutation profile for non-trivial bounded quick runs/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /use blueprint_lightweight_preflight as the common read path/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /run cheap validation for code mutation when discoverable/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /tracker-eligible session-local coordination paired with visible todos/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /persist durable quick-run evidence[\s\S]*canonical quick-run-latest report name/i
  );
  assert.deepEqual(quickMetadata.spec.writes, [
    "quick-run-latest report through blueprint_artifact_report_write",
    ".blueprint/STATE.md"
  ]);
});

test("lightweight execution keeps fast on the trivial inline path instead of merging quick's progress layer", async () => {
  const [fastToml, executionSkill, fastRuntimeContract] = await Promise.all([
    readRepoFile("commands/blu-fast.toml"),
    readRepoFile("skills/blueprint-phase-execution/SKILL.md"),
    readRepoFile("skills/blueprint-phase-execution/references/fast-runtime-contract.md")
  ]);
  const fastMetadata = getRuntimeOwnedCommandMetadata("fast");

  assert.ok(fastMetadata);

  assert.match(fastToml, /Execution profile: `interactive-read`/);
  assert.match(fastToml, /A task qualifies only when all are true/);
  assert.match(fastToml, /Latency budget: lightweight preflight only/);
  assert.match(fastToml, /Do not use\s+`update_topic`, `write_todos`, or task tracker tools for `\/blu-fast`\./);
  assert.match(fastToml, /Do not turn `\/blu-fast` into a long-running progress flow/i);
  assert.match(fastToml, /Do not create quick-run reports, phase artifacts, or other ad hoc persistence as side effects of `fast`\./);
  assert.match(fastToml, /Do not use subagents\./);
  assert.doesNotMatch(fastToml, /quick-run-latest/);
  assert.doesNotMatch(fastToml, /tracker-eligible/i);

  assert.match(executionSkill, /references\/fast-runtime-contract\.md/);
  assert.match(executionSkill, /Start from `blueprint_lightweight_preflight`/);
  assert.match(fastRuntimeContract, /\/blu-fast` qualifies only when all are true/i);
  assert.match(fastRuntimeContract, /\/blu-fast` latency budget/i);
  assert.match(fastRuntimeContract, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(fastRuntimeContract, /Do not create quick-run reports, phase summaries, phase artifacts/i);
  assert.match(fastRuntimeContract, /no-subagent execution path/i);
  assert.equal(fastMetadata.spec.executionProfile, "interactive-read");
  assert.match(
    fastMetadata.runtimeReference.contractNotes,
    /Interactive-read profile for trivial inline execution/i
  );
  assert.match(
    fastMetadata.runtimeReference.contractNotes,
    /qualify only explicit obvious tasks with no research, multi-file blast-radius analysis/i
  );
  assert.match(
    fastMetadata.runtimeReference.contractNotes,
    /explicitly exclude tracker-backed branching plus update_topic or write_todos long-running visibility/i
  );
  assert.match(
    fastMetadata.runtimeReference.contractNotes,
    /refuse report-backed or subagent depth/i
  );
});

test("lightweight execution keeps debug investigative with its own report and follow-up gate", async () => {
  const [debugToml, debugSkill, debugRuntimeContract] = await Promise.all([
    readRepoFile("commands/blu-debug.toml"),
    readRepoFile("skills/blueprint-debug/SKILL.md"),
    readRepoFile("skills/blueprint-debug/references/debug-runtime-contract.md")
  ]);

  assert.match(
    debugToml,
    /Execution profile: start in `interactive-read`[\s\S]*escalate to `long-running-mutation` only when the investigation becomes non-trivial/i
  );
  assert.match(debugToml, /debug-latest/);
  assert.match(
    debugToml,
    /explicit follow-up gate after the diagnosis:[\s\S]*report-only,[\s\S]*capture a todo only after an explicit user ask or confirmation,[\s\S]*`\/blu-quick`[\s\S]*`\/blu-plan-phase`[\s\S]*`\/blu-validate-phase`[\s\S]*`\/blu-progress`/i
  );
  assert.doesNotMatch(
    debugToml,
    /report-only, capture a todo, route to `\/blu-quick`, route to `\/blu-plan-phase`, or defer to `\/blu-progress`/
  );
  assert.match(debugToml, /must not silently create a todo/i);
  assert.doesNotMatch(debugToml, /tracker-eligible/i);
  assert.doesNotMatch(debugToml, /quick-run-latest/);

  assert.match(debugSkill, /input_bundles:/);
  assert.match(debugSkill, /commands\/blu-debug\.toml/);
  assert.match(debugSkill, /references\/debug-runtime-contract\.md/);
  assert.doesNotMatch(debugSkill, /## Required Inputs/);
  assert.match(
    debugSkill,
    /Execution profile: start in `interactive-read`[\s\S]*escalate to\s+`long-running-mutation` only when the investigation becomes non-trivial/i
  );
  assert.doesNotMatch(debugSkill, /Execution profile: `long-running-mutation`/);
  assert.match(debugSkill, /Treat `--diagnose` as a hard diagnose-only boundary/i);
  assert.match(
    debugSkill,
    /Stop on an explicit follow-up gate after the diagnosis:[\s\S]*report-only,[\s\S]*capture a todo[\s\S]*`\/blu-quick`[\s\S]*`\/blu-plan-phase`[\s\S]*`\/blu-validate-phase`[\s\S]*`\/blu-progress`/
  );
  assert.match(debugSkill, /Keep `debug` investigative/i);
  assert.doesNotMatch(debugSkill, /tracker-eligible/i);

  assert.match(debugRuntimeContract, /Require a concrete issue statement/i);
  assert.match(debugRuntimeContract, /Persist: write the durable report/i);
  assert.match(debugRuntimeContract, /bare canonical report name `debug-latest`/i);
  assert.match(debugRuntimeContract, /stop at an explicit follow-up gate/i);
  assert.doesNotMatch(debugRuntimeContract, /tracker-eligible/i);
});
