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
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md/);
  assert.doesNotMatch(
    commandFile,
    /agents\/blueprint-(researcher|planner|executor|verifier)\.md/
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_lightweight_preflight")));
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
  assert.match(commandFile, /pre-authorization for (?:a )?bounded non-destructive/i);
  assert.match(commandFile, /For code mutation, run cheap validation by default/i);
  assert.match(commandFile, /validation outcome including any skipped reason or repair-attempt outcome/i);
  assert.match(commandFile, /report\.quick-run` model with `schemaVersion: 2`/i);
  assert.match(
    commandFile,
    /must include `task`, `classification`, `depthUsed`, `evidenceRead`, `changesMade`, `validation`, `gates`, `risks`, `deferredWork`, and `nextSafeAction`, and may include `runMetrics`/i
  );
  assert.match(commandFile, /Record the quick report overwrite gate in `gates`/i);
  assert.match(commandFile, /Treat the returned `path` and `status` as authoritative/i);
  assert.match(commandFile, /make at most one bounded repair attempt/i);
  assert.match(commandFile, /use `validation\.repairAttempt` to distinguish no repair attempt, repaired, or still-failing outcomes/i);
  assert.match(commandFile, /do not claim success unless validation actually passes/i);
  assert.match(
    commandFile,
    /Return a concise completion summary with only the bounded task outcome, the validation outcome[\s\S]*authoritative quick-run report `status` and `path`, and the next safe implemented action/i
  );
  assert.match(commandFile, /Leave report-depth detail, tracker usage, gates, risks, and deferred work in the durable report/i);
  assert.doesNotMatch(commandFile, /whether tracker-backed branching was needed/i);
  assert.doesNotMatch(commandFile, /warnings or deferred follow-up work/i);
  assert.match(commandFile, /use `blueprint-researcher`[^\n]+`workflow\.subagents` is enabled/);
  assert.match(commandFile, /use `blueprint-planner`[^\n]+`workflow\.subagents` is enabled/);
  assert.match(commandFile, /use `blueprint-executor`[^\n]+`workflow\.subagents` is enabled/);
  assert.match(commandFile, /use `blueprint-verifier`[^\n]+`workflow\.subagents` is enabled/);
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
    /### `\/blu-quick`[\s\S]*blueprint_lightweight_preflight[\s\S]*blueprint_artifact_report_write[\s\S]*blueprint_state_update/
  );

  assert.match(quickRuntimeContract, /mcp_blueprint_blueprint_lightweight_preflight/);
  assert.match(quickRuntimeContract, /effective\s+subagent config/);
  assert.match(quickRuntimeContract, /quick-run-latest/);
  assert.match(quickRuntimeContract, /tracker-backed branching is allowed only as session-local coordination/i);
  assert.match(quickRuntimeContract, /saved phase plan,\s+multi-wave execution/i);
  assert.match(quickRuntimeContract, /--discuss`, `--research`, `--validate`, and `--full`/);
  assert.match(quickRuntimeContract, /pre-authorization\s+for bounded non-destructive depth branches/i);
  assert.match(quickRuntimeContract, /run cheap validation by default/i);
  assert.match(quickRuntimeContract, /`schemaVersion: 2`/);
  assert.match(
    quickRuntimeContract,
    /must include `task`, `classification`, `depthUsed`,\s+`evidenceRead`, `changesMade`, `validation`, `gates`, `risks`,\s+`deferredWork`, and `nextSafeAction`, and may include `runMetrics`/i
  );
  assert.match(quickRuntimeContract, /represent that overwrite gate in the\s+model `gates`/i);
  assert.match(quickRuntimeContract, /Treat the returned report `path` and `status` as authoritative/i);
  assert.match(quickRuntimeContract, /at most one bounded repair attempt/i);
  assert.match(
    quickRuntimeContract,
    /Use `validation\.repairAttempt` to distinguish failed without repair,\s+repaired, or still-failing outcomes/i
  );
  assert.match(quickRuntimeContract, /Do not claim success if validation failed/i);
  assert.match(
    quickRuntimeContract,
    /Keep the final chat closeout high-signal only:[\s\S]*authoritative report `status` and `path`[\s\S]*next safe implemented action/i
  );
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
    /use blueprint_lightweight_preflight as the common read path/i
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
    /never claim success after failed validation/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /allow at most one bounded repair attempt/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /tracker-eligible session-local coordination paired with visible todos/i
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
    /report overwrite unless --force is present/i
  );
  assert.match(
    quickEntry.runtimeReference?.contractNotes ?? "",
    /overwrite confirmation gate and any --force bypass represented in the model gates/i
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
  assert.match(docsFile, /pre-authorization for bounded non-destructive depth branches/i);
  assert.match(docsFile, /cheap validation evidence by default/i);
  assert.match(docsFile, /`quick-run-latest` through `blueprint_artifact_report_write`/);
  assert.match(docsFile, /`schemaVersion: 2`/);
  assert.match(
    docsFile,
    /must include `task`, `classification`, `depthUsed`, `evidenceRead`, `changesMade`, `validation`, `gates`, `risks`, `deferredWork`, and `nextSafeAction`, and may include `runMetrics`/i
  );
  assert.match(docsFile, /Represent the quick report overwrite confirmation gate in the model `gates`/i);
  assert.match(docsFile, /do not claim success unless validation actually passes/i);
  assert.match(docsFile, /use `validation\.repairAttempt` to distinguish no repair attempt versus still-failing/i);
  assert.match(
    docsFile,
    /Keep the final chat closeout concise:[\s\S]*authoritative report `status` and `path`[\s\S]*next safe implemented action/i
  );
  assert.match(docsFile, /routes to `\/blu-new-project`/);
  assert.doesNotMatch(docsFile, /\/blu quick$/m);
  assert.doesNotMatch(docsFile, /\/blu-quick --full/);
  assert.doesNotMatch(docsFile, /docs\/commands\/do\.md/);
  assert.doesNotMatch(docsFile, /note, todo, backlog/i);
  assert.doesNotMatch(docsFile, /promoted, completed, or archived/i);
  assert.doesNotMatch(docsFile, /malformed index files/i);
  assert.doesNotMatch(docsFile, /remove copied capture boilerplate/i);
});
