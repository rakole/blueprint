import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("add-tests runtime metadata is source-owned and docs-free", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("add-tests");
  const catalog = await blueprintCommandCatalog();
  const runtimeContract = await buildBlueprintCommandRuntimeContractResource("add-tests");
  const runtimeContractPath =
    "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md";

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#add-tests");
  assert.deepEqual(metadata.requiredInputPaths, [runtimeContractPath]);
  assert.equal(catalog.commands["add-tests"].specPath, metadata.sourceId);
  assert.deepEqual(catalog.commands["add-tests"].requiredTools, [
    ...metadata.requiredTools
  ]);
  assert.equal(runtimeContract.catalog.specPath, metadata.sourceId);
  assert.equal(runtimeContract.spec?.path, metadata.sourceId);
  assert.equal(runtimeContract.runtimeReference?.path, metadata.sourceId);
  assert.equal(runtimeContract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(runtimeContract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(runtimeContract.skillInputs, {
    skill: "blueprint-phase-validation",
    shared: [],
    commandSpecific: [runtimeContractPath],
    effective: [runtimeContractPath]
  });
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.doesNotMatch(JSON.stringify(runtimeContract), /docs\//);
});

test("add-tests manifest references visibility, validation/report tools, bounded agents, and safe follow-up routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-add-tests.toml"),
    "utf8"
  );

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(
    commandFile,
    /skills\/blueprint-phase-validation\/references\/add-tests-runtime-contract\.md/
  );
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /classification approval/i);
  assert.match(commandFile, /test-plan approval/i);
  assert.match(commandFile, /Build a classification table before writing/i);
  assert.match(commandFile, /Unit \/ TDD/);
  assert.match(commandFile, /Integration \/ API/);
  assert.match(commandFile, /E2E \/ UI/);
  assert.match(commandFile, /Present a concrete test plan before mutation/i);
  assert.match(commandFile, /Distinguish generated tests that pass/i);
  assert.match(commandFile, /targeted test command or result/i);
  assert.match(commandFile, /current verification status/i);
  assert.match(commandFile, /report status/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /Prefer\s+`ask_user` tool/i);
  assert.match(commandFile, /`blueprint-executor` subagent/);
  assert.match(commandFile, /`blueprint-verifier` subagent/);

  for (const toolName of [
    "blueprint_phase_locate",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_validation_read",
    "blueprint_phase_validation_authoring_context",
    "blueprint_phase_validation_render",
    "blueprint_artifact_contract_read",
    "blueprint_phase_validation_write",
    "blueprint_artifact_list",
    "blueprint_artifact_validate",
    "blueprint_artifact_report_authoring_context",
    "blueprint_artifact_report_validate_model",
    "blueprint_artifact_report_write",
    "blueprint_state_load",
    "blueprint_state_update"
  ] as const) {
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.match(commandFile, /XX-VERIFICATION\.md/);
  assert.match(commandFile, /artifactId: "report\.add-tests"/);
  assert.match(commandFile, /add-tests-<phase>/);
  assert.match(commandFile, /`path` plus `summaryPaths`, `written`, and `status` as authoritative/i);
  assert.match(commandFile, /`path`, `written`, and `status` as authoritative/i);
  assert.match(commandFile, /mcp_blueprint_blueprint_phase_validation_render/);
  assert.match(commandFile, /readyToWrite: true/i);
  assert.match(commandFile, /\/blu-execute-phase <phase>/);
  assert.match(commandFile, /\/blu-validate-phase <phase>/);
  assert.match(commandFile, /\/blu-code-review <phase>/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(
    commandFile,
    /skills\/blueprint-phase-validation\.md|agents\/blueprint-executor\.md|agents\/blueprint-verifier\.md/
  );
});

test("phase-validation skill captures the shipped add-tests contract", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-add-tests/);
  assert.match(skillFile, /### `add-tests`/);
  assert.match(skillFile, /references\/add-tests-runtime-contract\.md/);
  assert.match(skillFile, /classification gates, test-plan approval/i);
  assert.match(skillFile, /Build a file-by-file classification table before writing/i);
  assert.match(skillFile, /Unit \/ TDD/);
  assert.match(skillFile, /Integration \/ API/);
  assert.match(skillFile, /E2E \/ UI/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /blueprint_phase_validation_authoring_context/);
  assert.match(skillFile, /blueprint_phase_validation_render/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint-executor/);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /selected test scope, targeted test command or result, verification status, report status/i);
  assert.match(skillFile, /verification status/i);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /Use `ask_user` for structured classification, scope, test-plan, or breadth decisions/i);
  assert.match(skillFile, /one summary and candidate area at a time/i);
  assert.match(skillFile, /Never substitute browser, web-search-only, shell-only, or generic agents/i);
  assert.match(skillFile, /report\.add-tests/);
  assert.match(skillFile, /generated\/passing\/failing\/blocked counts/i);
  assert.match(skillFile, /reported report status aligned with the tool-owned `written` and `status` result/i);
  assert.match(skillFile, /repair the model against the canonical contract and retry once/i);
  assert.match(skillFile, /add-tests-<phase>/);
  assert.match(skillFile, /\/blu-code-review <phase>/);
  assert.match(skillFile, /report\.add-tests.*without a public `authoringTemplate`/i);
});

test("add-tests runtime contract preserves GSD-inspired richness without script-owned persistence", async () => {
  const runtimeContract = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md"
    ),
    "utf8"
  );

  for (const stage of ["Resolve", "Read", "Decide", "Execute", "Persist", "Validate", "Route"]) {
    assert.match(runtimeContract, new RegExp(`\\| ${stage} \\|`));
  }

  for (const toolName of [
    "blueprint_phase_locate",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_validation_read",
    "blueprint_phase_validation_authoring_context",
    "blueprint_phase_validation_render",
    "blueprint_phase_validation_write",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_artifact_validate",
    "blueprint_artifact_report_authoring_context",
    "blueprint_artifact_report_validate_model",
    "blueprint_artifact_report_write",
    "blueprint_state_load",
    "blueprint_state_update"
  ] as const) {
    assert.match(runtimeContract, new RegExp(toolName));
  }

  assert.match(runtimeContract, /artifactId: "phase\.verification"/);
  assert.match(runtimeContract, /blueprint_phase_validation_render/);
  assert.match(runtimeContract, /artifactId: "report\.add-tests"/);
  assert.match(runtimeContract, /Classification And Scope Decision/);
  assert.match(runtimeContract, /Unit \/ TDD/);
  assert.match(runtimeContract, /Integration \/ API/);
  assert.match(runtimeContract, /E2E \/ UI/);
  assert.match(runtimeContract, /do not classify by filename\s+alone/i);
  assert.match(runtimeContract, /Present a concrete test plan/i);
  assert.match(runtimeContract, /generated\/passing\/failing\/\s*blocked counts/i);
  assert.match(runtimeContract, /implementation bug/i);
  assert.match(runtimeContract, /blueprint-executor/);
  assert.match(runtimeContract, /blueprint-verifier/);
  assert.match(runtimeContract, /instead of a public `contract\.authoringTemplate`/i);
  assert.match(runtimeContract, /Do not substitute browser, web-search-only, shell-only, or generic agents/i);
  assert.match(runtimeContract, /No-Subagent Fallback/);
  assert.match(runtimeContract, /one approved test file or scenario group at a time/i);
  assert.match(runtimeContract, /repair the report model against\s+the `report\.add-tests` task schema and retry once/i);
});

test("add-tests runtime contract resource keeps bounded visibility explicit", async () => {
  const runtimeContract = await buildBlueprintCommandRuntimeContractResource("add-tests");
  const serializedContract = JSON.stringify(runtimeContract);

  assert.equal(runtimeContract.spec?.executionProfile, "long-running-mutation");
  assert.equal(runtimeContract.runtimeReference?.primarySkill, "blueprint-phase-validation");
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /evidence-backed test generation/i);
  assert.deepEqual(runtimeContract.skillInputs.shared, []);
  assert.deepEqual(runtimeContract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md"
  ]);
  assert.deepEqual(runtimeContract.skillInputs.effective, [
    "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md"
  ]);
  assert.doesNotMatch(serializedContract, /docs\//);
});

test("add-tests agents and report contract include output-quality expectations", async () => {
  const [executor, verifier, contractSource] = await Promise.all([
    readFile(path.join(repoRoot, "agents/blueprint-executor.md"), "utf8"),
    readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8"),
    readFile(path.join(repoRoot, "src/mcp/artifact-contracts/index.ts"), "utf8")
  ]);

  assert.match(executor, /\/blu-add-tests/);
  assert.match(executor, /approved classification table/);
  assert.match(executor, /Test Plan Executed/);
  assert.match(executor, /Targeted Test Evidence/);
  assert.match(executor, /generated\/passing\/\s*failing\/blocked counts/i);
  assert.match(executor, /do not mutate product implementation to make tests\s+pass/i);

  assert.match(verifier, /Add-tests coverage review mode/);
  assert.match(verifier, /approved classification table/);
  assert.match(verifier, /changed test files/);
  assert.match(verifier, /targeted command output/);
  assert.match(verifier, /do not declare `READY` from the existence\s+of test files alone/i);
  assert.match(verifier, /generated, passing, failing, blocked, and\s+skipped\/manual-only coverage/i);

  assert.match(contractSource, /function renderAddTestsTemplate/);
  assert.match(contractSource, /## Classification And Test Plan/);
  assert.match(contractSource, /Result counts: generated <N>, passing <N>, failing <N>, blocked <N>/);
  assert.match(contractSource, /Verification write status/);
  assert.match(contractSource, /Report write status/);
  assert.match(contractSource, /report\.add-tests/);
});
