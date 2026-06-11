import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("quick manifest references the execution skill, bounded depth agents, and report-backed MCP tools", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-quick.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-execution` skill/);
  assert.match(
    commandFile,
    /`blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` subagents/
  );
  assert.match(commandFile, /Use no subagents by default/i);
  assert.match(
    commandFile,
    /Keep the run inline unless a Blueprint subagent clearly earns its coordination cost/i
  );
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md/);
  assert.doesNotMatch(
    commandFile,
    /agents\/blueprint-(researcher|planner|executor|verifier)\.md/
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_lightweight_preflight")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /Preserve a cache-friendly prompt layout/i);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /`update_topic` to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /session-local, pair it with visible `write_todos`/i);
  assert.match(commandFile, /Show progress only at meaningful stage or gate transitions/i);
  assert.match(commandFile, /Do not spam stage narration or emit in-flight updates between transitions/i);
  assert.match(commandFile, /When the host lacks them, preserve the same compact progress in concise prose/i);
  assert.match(commandFile, /Never claim helper calls were made when they were unavailable/i);
  assert.match(commandFile, /When tracker support is unavailable, keep the same bounded quick flow linear/i);
  assert.match(commandFile, /`--discuss`/);
  assert.match(commandFile, /`--research`/);
  assert.match(commandFile, /`--validate`/);
  assert.match(commandFile, /`--full`/);
  assert.match(commandFile, /`--force`/);
  assert.match(commandFile, /pre-authorization for (?:a )?bounded non-destructive/i);
  assert.match(commandFile, /For code mutation, run cheap validation by default/i);
  assert.match(commandFile, /validation status/i);
  assert.match(commandFile, /skipped reason/i);
  assert.match(commandFile, /repair-attempt outcome/i);
  assert.match(commandFile, /report\.quick-run` model with `schemaVersion: 2`/i);
  assert.match(commandFile, /optional lightweight `runMetrics` counters/i);
  assert.match(commandFile, /Do not require exact token counts/i);
  assert.match(
    commandFile,
    /must include `task`, `classification`, `depthUsed`, `evidenceRead`, `changesMade`, `validation`, `gates`, `risks`, `deferredWork`, and `nextSafeAction`[\s\S]*optional lightweight `runMetrics` counters/i
  );
  assert.match(commandFile, /Record the quick report overwrite gate in `gates`/i);
  assert.match(commandFile, /Treat the returned `path` and `status` as authoritative/i);
  assert.match(commandFile, /Common path tool budget:[\s\S]*lightweight_preflight[\s\S]*validation shell or test commands[\s\S]*artifact_report_write[\s\S]*state_update/i);
  assert.match(commandFile, /Do not add redundant primitive MCP reads on the common path/i);
  assert.match(commandFile, /make at most one bounded repair attempt/i);
  assert.match(commandFile, /use `validation\.repairAttempt` to distinguish no repair attempt, repaired, or still-failing outcomes/i);
  assert.match(commandFile, /do not claim success unless validation actually passes/i);
  assert.match(
    commandFile,
    /Return a concise completion summary with the task, depth used, validation status[\s\S]*authoritative quick-run report `status` and `path`, warnings or deferred work, and the next safe implemented action/i
  );
  assert.match(commandFile, /Keep detailed evidence, file lists, validation logs, overwrite-gate detail, and tracker detail in the durable quick-run report/i);
  assert.match(commandFile, /Final response budget: max 12 lines by default/i);
  assert.doesNotMatch(commandFile, /whether tracker-backed branching was needed/i);
  assert.match(commandFile, /use `blueprint-researcher`[^\n]+unfamiliar repo area[^\n]+`workflow\.subagents` is enabled/i);
  assert.match(commandFile, /use `blueprint-planner`[^\n]+short bounded checklist[^\n]+multiple ordered steps[^\n]+`workflow\.subagents` is enabled/i);
  assert.match(commandFile, /use `blueprint-executor`[^\n]+write ownership is clear[^\n]+`workflow\.subagents` is enabled/i);
  assert.match(commandFile, /use `blueprint-verifier`[^\n]+`--validate` or `--full`[^\n]+greater than 2[^\n]+`workflow\.subagents` is enabled/i);
  assert.match(commandFile, /if `workflow\.subagents` is disabled or the Blueprint agents are unavailable, keep the quick run inline/i);
  assert.match(commandFile, /do not use generic helper agents, browser-only agents, shell-only agents, or web-search-only substitutes/i);
  assert.match(commandFile, /do not use tracker as a saved plan, and do not use subagents to widen scope/i);
  assert.match(commandFile, /compact handoff packet/i);
  assert.match(commandFile, /compact output packet/i);
  assert.match(commandFile, /command-specific runtime reference/i);
  assert.doesNotMatch(commandFile, /"quickTask": ""/);
  assert.doesNotMatch(commandFile, /"scopeHandled": \[\]/);
  assert.doesNotMatch(commandFile, /administrativeToolCalls\?: number/i);
  assert.doesNotMatch(commandFile, /```/);
  assert.match(commandFile, /quick-run-latest/);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(commandFile, /\/blu-progress/);
});

test("execution skill and local quick contract capture visibility, tracker eligibility, and report persistence", async () => {
  const [skillFile, quickRuntimeContract] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-execution/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-execution/references/quick-runtime-contract.md"
      ),
      "utf8"
    )
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
  assert.match(
    skillFile,
    /### `\/blu-quick`[\s\S]*blueprint_lightweight_preflight[\s\S]*validation shell or test commands outside[\s\S]*blueprint_artifact_report_write[\s\S]*blueprint_state_update/
  );

  assert.match(quickRuntimeContract, /mcp_blueprint_blueprint_lightweight_preflight/);
  assert.match(quickRuntimeContract, /static\s+prefix/i);
  assert.match(quickRuntimeContract, /effective\s+subagent config/);
  assert.match(quickRuntimeContract, /quick-run-latest/);
  assert.match(quickRuntimeContract, /tracker-backed branching is allowed only as session-local coordination/i);
  assert.match(quickRuntimeContract, /Use no subagents by default/i);
  assert.match(quickRuntimeContract, /Default: stay inline and use no subagents/i);
  assert.match(quickRuntimeContract, /unfamiliar repo area/i);
  assert.match(quickRuntimeContract, /short bounded checklist/i);
  assert.match(quickRuntimeContract, /write ownership is clear/i);
  assert.match(quickRuntimeContract, /touched files are greater than 2/i);
  assert.match(quickRuntimeContract, /workflow\.subagents` is enabled/i);
  assert.match(
    quickRuntimeContract,
    /If `workflow\.subagents` is disabled or the Blueprint agents are unavailable,[\s\S]*keep the quick run inline/i
  );
  assert.match(quickRuntimeContract, /Do not use tracker as a saved plan, and do not use subagents to widen scope/i);
  assert.match(quickRuntimeContract, /"quickTask": ""/);
  assert.match(quickRuntimeContract, /"allowedFilesOrAreas": \[\]/);
  assert.match(quickRuntimeContract, /"validationBudget": "cheap \| deep"/);
  assert.match(quickRuntimeContract, /"scopeHandled": \[\]/);
  assert.match(quickRuntimeContract, /"nextBoundedUnit": ""/);
  assert.match(quickRuntimeContract, /Show progress only at meaningful stage or gate transitions/i);
  assert.match(quickRuntimeContract, /Do not spam stage narration or emit in-flight updates between transitions/i);
  assert.match(quickRuntimeContract, /When helpers are unavailable, use concise prose/i);
  assert.match(quickRuntimeContract, /Never claim helper calls were made when unavailable/i);
  assert.match(quickRuntimeContract, /Common path tool budget:[\s\S]*lightweight_preflight[\s\S]*validation shell or test commands[\s\S]*artifact_report_write[\s\S]*state_update/i);
  assert.match(quickRuntimeContract, /Do not add redundant primitive MCP\s+reads on the common path/i);
  assert.match(quickRuntimeContract, /saved phase plan,\s+multi-wave execution/i);
  assert.match(quickRuntimeContract, /--discuss`, `--research`, `--validate`, and `--full`/);
  assert.match(quickRuntimeContract, /pre-authorization\s+for bounded non-destructive depth branches/i);
  assert.match(quickRuntimeContract, /run cheap validation by default/i);
  assert.match(quickRuntimeContract, /`schemaVersion: 2`/);
  assert.match(
    quickRuntimeContract,
    /must include `task`, `classification`, `depthUsed`,\s+`evidenceRead`, `changesMade`, `validation`, `gates`, `risks`,\s+`deferredWork`, and `nextSafeAction`, and may include(?::|\s+`runMetrics`)/i
  );
  assert.match(quickRuntimeContract, /represent that overwrite gate in the\s+model `gates`/i);
  assert.match(quickRuntimeContract, /Treat the returned report `path` and `status` as authoritative/i);
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
  assert.match(quickRuntimeContract, /Do not require exact token counts/i);
  assert.match(quickRuntimeContract, /at most one bounded repair attempt/i);
  assert.match(
    quickRuntimeContract,
    /Use `validation\.repairAttempt` to distinguish failed without repair,\s+repaired, or still-failing outcomes/i
  );
  assert.match(quickRuntimeContract, /Do not claim success if validation failed/i);
  assert.match(
    quickRuntimeContract,
    /Keep the final chat closeout high-signal only:[\s\S]*task, depth used, validation status[\s\S]*authoritative report `status` and `path`[\s\S]*warnings or deferred work[\s\S]*next safe implemented action/i
  );
  assert.match(quickRuntimeContract, /Keep detailed evidence, file lists, validation logs, gates, and tracker\s+detail in the durable report/i);
  assert.match(quickRuntimeContract, /The final response stayed within 12 lines by default/i);
  assert.match(quickRuntimeContract, /blueprint-researcher/);
  assert.match(quickRuntimeContract, /blueprint-planner/);
  assert.match(quickRuntimeContract, /blueprint-executor/);
  assert.match(quickRuntimeContract, /blueprint-verifier/);
  assert.match(quickRuntimeContract, /\/blu-progress/);
});

test("quick runtime contract resource is owned by runtime metadata, not docs", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("quick");

  assert.ok(metadata);
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-phase-execution/references/quick-runtime-contract.md",
    "skills/blueprint-phase-execution/references/long-running-execution-profile.md"
  ]);

  const contract = await buildBlueprintCommandRuntimeContractResource("quick");

  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.commandSpecPath, metadata.sourceId);
  assert.equal(contract.spec.primarySkill, "blueprint-phase-execution");
  assert.deepEqual(contract.spec.requiredTools, [...metadata.requiredTools]);
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.spec.optionalSubagents, [
    "blueprint-researcher",
    "blueprint-planner",
    "blueprint-executor",
    "blueprint-verifier"
  ]);
  assert.deepEqual(contract.runtimeReference.optionalAgents, [
    "blueprint-researcher",
    "blueprint-planner",
    "blueprint-executor",
    "blueprint-verifier"
  ]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "commands/blu-quick.toml",
    "skills/blueprint-phase-execution/references/quick-runtime-contract.md",
    "skills/blueprint-phase-execution/references/long-running-execution-profile.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /Long-running-mutation profile for non-trivial bounded quick runs/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /keep the static prompt prefix on command identity, hard contract, routing ladder, tool boundaries, and report schema expectations/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /Use blueprint_lightweight_preflight as the common read path/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /Use no subagents by default/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /Show progress only at meaningful stage or gate transitions/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /do not emit in-flight updates between transitions/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /confirmation is required unless --force is present/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /report overwrite unless --force is present/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /bounded non-destructive depth preauthorization/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /run cheap validation for code mutation when discoverable/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /common tool path to blueprint_lightweight_preflight first, optional validation shell or test commands outside Blueprint MCP before persistence when validation is needed, then blueprint_artifact_report_write and blueprint_state_update/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /without redundant primitive reads once preflight surfaced scope, health, config, route, and overwrite posture/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /never claim success after failed validation/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /allow at most one bounded repair attempt/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /use blueprint-researcher only when --research or --full is present, the task touches an unfamiliar repo area/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /use blueprint-planner only for a short bounded checklist with multiple ordered steps/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /use blueprint-executor only when implementation stays isolated inside agreed quick scope with clear write ownership/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /use blueprint-verifier only when --validate or --full is present, touched files exceed 2/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /Forbid generic helper, browser-only, shell-only, and web-search-only substitute agents/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /do not use tracker as a saved plan, and do not use subagents to widen scope/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /use concise prose when helper tools are unavailable and never claim helper calls occurred when they did not/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /tracker-eligible session-local coordination paired with visible todos/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /optional runMetrics limited to administrativeToolCalls, subagentCount, validationCommandCount, and finalSummaryBudget short or normal without exact token counts/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /do not let quick impersonate saved planning or broad lifecycle execution/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /schemaVersion 2 plus task, classification, depthUsed, evidenceRead, changesMade, validation, gates, risks, deferredWork, nextSafeAction, and optional runMetrics/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /overwrite confirmation gate and any --force bypass represented in the model gates/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /treat the returned report path and status as authoritative/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /default final response within 12 lines with task, depth used, validation status, authoritative report path and status, warnings or deferred work, and the next safe action/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /keep detailed evidence in the quick-run report/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /skills\/blueprint-phase-execution\/references\/quick-runtime-contract\.md/i
  );
});

test("quick generated catalog preserves the force overwrite bypass in runtime-owned metadata", async () => {
  const generatedCatalog = JSON.parse(
    await readFile(path.join(repoRoot, "generated/command-catalog.json"), "utf8")
  ) as {
    commands: Array<{
      name: string;
      runtimeReference?: {
        contractNotes?: string;
      };
    }>;
  };

  const quickEntry = generatedCatalog.commands.find((entry) => entry.name === "quick");

  assert.ok(quickEntry);
  assert.match(
    quickEntry.runtimeReference?.contractNotes ?? "",
    /confirmation is required unless --force is present/i
  );
  assert.match(
    quickEntry.runtimeReference?.contractNotes ?? "",
    /Use no subagents by default/i
  );
  assert.match(
    quickEntry.runtimeReference?.contractNotes ?? "",
    /use blueprint-verifier only when --validate or --full is present, touched files exceed 2/i
  );
  assert.match(
    quickEntry.runtimeReference?.contractNotes ?? "",
    /report overwrite unless --force is present/i
  );
  assert.match(
    quickEntry.runtimeReference?.contractNotes ?? "",
    /overwrite confirmation gate and any --force bypass represented in the model gates/i
  );
  assert.match(
    quickEntry.runtimeReference?.contractNotes ?? "",
    /default final response within 12 lines/i
  );
});

test("quick public docs use concrete task examples and avoid capture/planned-command drift", async () => {
  const docsFile = await readFile(path.join(repoRoot, "docs/commands/quick.md"), "utf8");

  assert.match(
    docsFile,
    /\/blu-quick "Rename BLUEPRINT_API_ENV references and update focused tests" --validate/
  );
  assert.match(
    docsFile,
    /\/blu quick "Update the quick command docs to clarify report overwrite handling" --research/
  );
  assert.match(docsFile, /blueprint_lightweight_preflight/);
  assert.match(docsFile, /Use no subagents by default/i);
  assert.match(docsFile, /Keep the run inline unless a Blueprint subagent clearly earns its coordination cost/i);
  assert.match(docsFile, /pre-authorization for bounded non-destructive depth branches/i);
  assert.match(docsFile, /Show progress only at meaningful stage or gate transitions/i);
  assert.match(docsFile, /Do not spam stage narration or emit in-flight updates between transitions/i);
  assert.match(
    docsFile,
    /Use this public ladder when choosing a route:[\s\S]*\/blu-fast[\s\S]*trivial inline path[\s\S]*\/blu-quick[\s\S]*bounded work with light progress\/reporting[\s\S]*\/blu-plan-phase` or `\/blu-execute-phase[\s\S]*saved-plan or broader lifecycle route/i
  );
  assert.match(
    docsFile,
    /Argument hint:\s*`\[task description\] \[--validate\] \[--discuss\] \[--research\] \[--force\] \[--full\]`/i
  );
  assert.match(docsFile, /`--full` is the uncommon all-depth branch/i);
  assert.match(docsFile, /use `blueprint-researcher` only when `--research` or `--full` is present, the task touches an unfamiliar repo area/i);
  assert.match(docsFile, /use `blueprint-planner` only when the task needs a short bounded checklist/i);
  assert.match(docsFile, /use `blueprint-verifier` only when `--validate` or `--full` is present, touched files exceed 2/i);
  assert.match(docsFile, /do not use generic helper agents, browser-only agents, shell-only agents, or web-search-only substitutes/i);
  assert.match(docsFile, /do not use tracker as a saved plan, and do not use subagents to widen scope/i);
  assert.match(docsFile, /cheap validation evidence by default/i);
  assert.match(docsFile, /Common path tool budget:[\s\S]*blueprint_lightweight_preflight[\s\S]*blueprint_artifact_report_write[\s\S]*blueprint_state_update/i);
  assert.match(docsFile, /Do not add redundant primitive Blueprint reads on the common path/i);
  assert.match(docsFile, /`quick-run-latest` through `blueprint_artifact_report_write`/);
  assert.match(docsFile, /`schemaVersion: 2`/);
  assert.match(
    docsFile,
    /must include `task`, `classification`, `depthUsed`, `evidenceRead`, `changesMade`, `validation`, `gates`, `risks`, `deferredWork`, and `nextSafeAction`[\s\S]*may include `runMetrics`/i
  );
  assert.match(docsFile, /Optional `runMetrics` stays lightweight; the command-specific runtime reference owns the exact optional counter names/i);
  assert.match(docsFile, /Do not require exact token counts/i);
  assert.match(docsFile, /Represent the quick report overwrite confirmation gate in the model `gates`/i);
  assert.match(docsFile, /do not claim success unless validation actually passes/i);
  assert.match(docsFile, /use `validation\.repairAttempt` to distinguish no repair attempt versus still-failing/i);
  assert.match(docsFile, /keep the handoff packet and return packet compact, bounded to the agreed scope, and aligned with the command-specific runtime reference/i);
  assert.doesNotMatch(docsFile, /"quickTask": ""/);
  assert.doesNotMatch(docsFile, /"scopeHandled": \[\]/);
  assert.match(
    docsFile,
    /Keep the final chat closeout concise:[\s\S]*task, depth used, validation status[\s\S]*authoritative report `status` and `path`[\s\S]*warnings or deferred work[\s\S]*next safe implemented action/i
  );
  assert.match(docsFile, /Keep detailed evidence in the quick-run report/i);
  assert.match(docsFile, /Final response budget: max 12 lines by default/i);
  assert.match(docsFile, /routes to `\/blu-new-project`/);
  assert.doesNotMatch(docsFile, /\/blu quick$/m);
  assert.doesNotMatch(docsFile, /\/blu-quick --full/);
  assert.doesNotMatch(
    docsFile,
    /Argument hint:\s*`\[task description\] \[--full\]/
  );
  assert.doesNotMatch(docsFile, /docs\/commands\/do\.md/);
  assert.doesNotMatch(docsFile, /note, todo, backlog/i);
  assert.doesNotMatch(docsFile, /promoted, completed, or archived/i);
  assert.doesNotMatch(docsFile, /malformed index files/i);
  assert.doesNotMatch(docsFile, /remove copied capture boilerplate/i);
});
