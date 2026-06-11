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
  assert.match(quickToml, /Preserve a cache-friendly prompt layout/i);
  assert.match(quickToml, /Use no subagents by default/i);
  assert.match(quickToml, /Keep the run inline unless a Blueprint subagent clearly earns its coordination cost/i);
  assert.match(quickToml, /`update_topic` to keep the active stage visible and `write_todos`/);
  assert.match(quickToml, /tracker-eligible/i);
  assert.match(quickToml, /Show progress only at meaningful stage or gate transitions/i);
  assert.match(quickToml, /Do not spam stage narration or emit in-flight updates between transitions/i);
  assert.match(quickToml, /Never claim helper calls were made when they were unavailable/i);
  assert.match(quickToml, /pre-authorization for (?:a )?bounded non-destructive/i);
  assert.match(quickToml, /run cheap validation by default/i);
  assert.match(quickToml, /report\.quick-run` model with `schemaVersion: 2`/i);
  assert.match(quickToml, /optional lightweight `runMetrics` counters/i);
  assert.match(
    quickToml,
    /must include `task`, `classification`, `depthUsed`, `evidenceRead`, `changesMade`, `validation`, `gates`, `risks`, `deferredWork`, and `nextSafeAction`[\s\S]*optional lightweight `runMetrics` counters/i
  );
  assert.match(quickToml, /Record the quick report overwrite gate in `gates`/i);
  assert.match(quickToml, /Treat the returned `path` and `status` as authoritative/i);
  assert.match(quickToml, /Common path tool budget:[\s\S]*lightweight_preflight[\s\S]*validation shell or test commands[\s\S]*artifact_report_write[\s\S]*state_update/i);
  assert.match(quickToml, /Do not add redundant primitive MCP reads on the common path/i);
  assert.match(quickToml, /make at most one bounded repair attempt/i);
  assert.match(quickToml, /use `validation\.repairAttempt` to distinguish no repair attempt, repaired, or still-failing outcomes/i);
  assert.match(
    quickToml,
    /Return a concise completion summary with the task, depth used, validation status[\s\S]*authoritative quick-run report `status` and `path`, warnings or deferred work, and the next safe implemented action/i
  );
  assert.match(quickToml, /Keep detailed evidence, file lists, validation logs, overwrite-gate detail, and tracker detail in the durable quick-run report/i);
  assert.match(quickToml, /Final response budget: max 12 lines by default/i);
  assert.match(quickToml, /use `blueprint-researcher`[^\n]+unfamiliar repo area[^\n]+`workflow\.subagents` is enabled/i);
  assert.match(quickToml, /use `blueprint-planner`[^\n]+short bounded checklist[^\n]+multiple ordered steps[^\n]+`workflow\.subagents` is enabled/i);
  assert.match(quickToml, /use `blueprint-executor`[^\n]+write ownership is clear[^\n]+`workflow\.subagents` is enabled/i);
  assert.match(quickToml, /use `blueprint-verifier`[^\n]+greater than 2[^\n]+`workflow\.subagents` is enabled/i);
  assert.match(quickToml, /if `workflow\.subagents` is disabled or the Blueprint agents are unavailable, keep the quick run inline/i);
  assert.match(quickToml, /do not use generic helper agents, browser-only agents, shell-only agents, or web-search-only substitutes/i);
  assert.match(quickToml, /do not use tracker as a saved plan, and do not use subagents to widen scope/i);
  assert.match(quickToml, /compact handoff packet/i);
  assert.match(quickToml, /compact output packet/i);
  assert.doesNotMatch(quickToml, /"quickTask": ""/);
  assert.doesNotMatch(quickToml, /"scopeHandled": \[\]/);
  assert.doesNotMatch(quickToml, /```/);
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
  assert.match(executionSkill, /For `\/blu-quick`, default inline and use optional agents only when the local\s+decision table says the bounded value outweighs the coordination cost/i);
  assert.match(
    executionSkill,
    /effective config, health\/new-project routing, implemented routes,\s+and overwrite gates/i
  );
  assert.match(
    executionSkill,
    /Keep the common quick path to `blueprint_lightweight_preflight` first[\s\S]*validation shell or test commands outside[\s\S]*`blueprint_artifact_report_write` and `blueprint_state_update`/i
  );
  assert.match(executionSkill, /Keep the default final quick closeout within 12 lines/i);
  assert.match(quickRuntimeContract, /tracker-backed branching is allowed only as session-local coordination/i);
  assert.match(quickRuntimeContract, /Use no subagents by default/i);
  assert.match(quickRuntimeContract, /Default: stay inline and use no subagents/i);
  assert.match(quickRuntimeContract, /workflow\.subagents` is enabled/i);
  assert.match(
    quickRuntimeContract,
    /If `workflow\.subagents` is disabled or the Blueprint agents are unavailable,[\s\S]*keep the quick run inline/i
  );
  assert.match(quickRuntimeContract, /Show progress only at meaningful stage or gate transitions/i);
  assert.match(quickRuntimeContract, /Do not spam stage narration or emit in-flight updates between transitions/i);
  assert.match(quickRuntimeContract, /When helpers are unavailable, use concise prose/i);
  assert.match(quickRuntimeContract, /Do not use tracker as a saved plan, and do not use subagents to widen scope/i);
  assert.match(quickRuntimeContract, /"quickTask": ""/);
  assert.match(quickRuntimeContract, /"nextBoundedUnit": ""/);
  assert.match(quickRuntimeContract, /pre-authorization\s+for bounded non-destructive depth branches/i);
  assert.match(quickRuntimeContract, /Cheap means a focused test, lint, typecheck, or build/i);
  assert.match(quickRuntimeContract, /`schemaVersion: 2`/);
  assert.match(quickRuntimeContract, /model `gates`/i);
  assert.match(quickRuntimeContract, /administrativeToolCalls\?: number/i);
  assert.match(quickRuntimeContract, /subagentCount\?: number/i);
  assert.match(quickRuntimeContract, /validationCommandCount\?: number/i);
  assert.match(quickRuntimeContract, /finalSummaryBudget\?: "short" \| "normal"/i);
  assert.match(quickRuntimeContract, /When validation is needed, finish validation before[\s\S]*artifact_report_write/i);
  assert.match(
    quickRuntimeContract,
    /For `\/blu-quick`, treat\s+the shared `Validate` stage as pre-report verification[\s\S]*before `mcp_blueprint_blueprint_artifact_report_write`/i
  );
  assert.doesNotMatch(quickRuntimeContract, /post-write checks/i);
  assert.doesNotMatch(quickRuntimeContract, /after persistence[\s\S]*quick-run report/i);
  assert.match(quickRuntimeContract, /at most one bounded repair attempt/i);
  assert.match(
    quickRuntimeContract,
    /Use `validation\.repairAttempt` to distinguish failed without repair,\s+repaired, or still-failing outcomes/i
  );
  assert.match(
    quickRuntimeContract,
    /Keep the final chat closeout high-signal only:[\s\S]*task, depth used, validation status[\s\S]*authoritative report `status` and `path`[\s\S]*warnings or deferred work[\s\S]*next safe implemented action/i
  );
  assert.match(quickRuntimeContract, /Keep detailed evidence, file lists, validation logs, gates, and tracker\s+detail in the durable report/i);
  assert.match(quickRuntimeContract, /The final response stayed within 12 lines by default/i);
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
    /Use no subagents by default/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /Show progress only at meaningful stage or gate transitions/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /Use blueprint_lightweight_preflight as the common read path/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /confirmation is required unless --force is present/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /report overwrite unless --force is present/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /run cheap validation for code mutation when discoverable/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /common tool path to blueprint_lightweight_preflight first, optional validation shell or test commands outside Blueprint MCP before persistence when validation is needed, then blueprint_artifact_report_write and blueprint_state_update/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /without redundant primitive reads once preflight surfaced scope, health, config, route, and overwrite posture/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /never claim success after failed validation/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /allow at most one bounded repair attempt/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /use blueprint-researcher only when --research or --full is present, the task touches an unfamiliar repo area/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /use blueprint-planner only for a short bounded checklist with multiple ordered steps/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /use blueprint-executor only when implementation stays isolated inside agreed quick scope with clear write ownership/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /use blueprint-verifier only when --validate or --full is present, touched files exceed 2/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /Forbid generic helper, browser-only, shell-only, and web-search-only substitute agents/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /do not use tracker as a saved plan, and do not use subagents to widen scope/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /use concise prose when helper tools are unavailable and never claim helper calls occurred when they did not/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /tracker-eligible session-local coordination paired with visible todos/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /persist durable quick-run evidence[\s\S]*canonical quick-run-latest report name/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /schemaVersion 2 plus task, classification, depthUsed, evidenceRead, changesMade, validation, gates, risks, deferredWork, nextSafeAction, and optional runMetrics/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /optional runMetrics limited to administrativeToolCalls, subagentCount, validationCommandCount, and finalSummaryBudget short or normal without exact token counts/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /overwrite confirmation gate and any --force bypass represented in the model gates/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /treat the returned report path and status as authoritative/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /default final response within 12 lines with task, depth used, validation status, authoritative report path and status, warnings or deferred work, and the next safe action/i
  );
  assert.match(
    quickMetadata.runtimeReference.contractNotes,
    /keep detailed evidence in the quick-run report/i
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
  assert.match(fastToml, /Preserve a cache-friendly prompt layout/i);
  assert.match(fastToml, /A task qualifies only when all are true/);
  assert.match(fastToml, /Common path tool budget:[\s\S]*lightweight_preflight[\s\S]*state_update/i);
  assert.match(fastToml, /Do not add redundant primitive MCP reads on the common path/i);
  assert.match(fastToml, /Latency budget: lightweight preflight only/);
  assert.match(fastToml, /Final response budget: max 8 lines/i);
  assert.match(fastToml, /Do not use\s+`update_topic`, `write_todos`, or task tracker tools for `\/blu-fast`\./);
  assert.match(fastToml, /Do not turn `\/blu-fast` into a long-running progress flow/i);
  assert.match(fastToml, /Do not create quick-run reports, phase artifacts, or other ad hoc persistence as side effects of `fast`\./);
  assert.match(fastToml, /Do not use subagents\./);
  assert.doesNotMatch(fastToml, /quick-run-latest/);
  assert.doesNotMatch(fastToml, /tracker-eligible/i);

  assert.match(executionSkill, /references\/fast-runtime-contract\.md/);
  assert.match(executionSkill, /Start from `blueprint_lightweight_preflight`/);
  assert.match(executionSkill, /Keep the final fast closeout within 8 lines/i);
  assert.match(fastRuntimeContract, /\/blu-fast` qualifies only when all are true/i);
  assert.match(fastRuntimeContract, /Common path tool budget:[\s\S]*lightweight_preflight[\s\S]*state_update/i);
  assert.match(fastRuntimeContract, /\/blu-fast` latency budget/i);
  assert.match(fastRuntimeContract, /final response:\s+concise inline summary, max 8 lines/i);
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
    /common tool path to blueprint_lightweight_preflight plus optional blueprint_state_update only after a successful initialized and healthy run/i
  );
  assert.match(
    fastMetadata.runtimeReference.contractNotes,
    /avoid redundant primitive reads once preflight surfaced classification, health, and next action/i
  );
  assert.match(
    fastMetadata.runtimeReference.contractNotes,
    /explicitly exclude tracker-backed branching plus update_topic or write_todos long-running visibility/i
  );
  assert.match(
    fastMetadata.runtimeReference.contractNotes,
    /refuse report-backed or subagent depth/i
  );
  assert.match(
    fastMetadata.runtimeReference.contractNotes,
    /final response within 8 lines with qualification reason, state-update or no-write status, any reroute or warning, and the next safe implemented action/i
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
