import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("add-tests runtime-owned contract and manifests mark the test-generation slice as shipped", async () => {
  const [manifest, skillFile, runtimeContract, readme, gemini] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-add-tests.toml"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md"
      ),
      "utf8"
    ),
    readFile(path.join(repoRoot, "README.md"), "utf8"),
    readFile(path.join(repoRoot, "GEMINI.md"), "utf8")
  ]);
  const metadata = getRuntimeOwnedCommandMetadata("add-tests");
  const contract = await buildBlueprintCommandRuntimeContractResource("add-tests");

  assert.ok(metadata);
  assert.equal(metadata.catalog.wave, 4);
  assert.equal(metadata.catalog.family, "Quality And Shipping");
  assert.equal(metadata.catalog.primarySkill, "blueprint-phase-validation");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#add-tests");
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md"
  ]);
  assert.match(
    metadata.spec.purpose,
    /evidence and persists validation plus report artifacts through MCP tools/i
  );
  assert.deepEqual(metadata.spec.writes, [
    "repo test files",
    "phase XX-VERIFICATION.md",
    ".blueprint/reports/add-tests-<phase>.md",
    ".blueprint/STATE.md"
  ]);
  assert.match(
    metadata.runtimeReference.contractNotes,
    /evidence-backed test generation/i
  );

  assert.match(manifest, /Use the `blueprint-phase-validation` skill/);
  assert.match(
    manifest,
    /skills\/blueprint-phase-validation\/references\/add-tests-runtime-contract\.md/
  );
  assert.match(manifest, /blueprint_artifact_contract_read/);
  assert.match(manifest, /blueprint_config_get/);
  assert.match(manifest, /blueprint_phase_validation_authoring_context/);
  assert.match(manifest, /blueprint_phase_validation_render/);
  assert.match(manifest, /readyToWrite: true/i);
  assert.match(manifest, /artifactId: "report\.add-tests"/);
  assert.match(
    manifest,
    /Author the durable (?:outcome )?report as structured `report\.add-tests` JSON/i
  );
  assert.match(manifest, /classification/i);
  assert.match(manifest, /test plan/i);
  assert.match(manifest, /blueprint_phase_validation_write/);
  assert.match(manifest, /blueprint_artifact_report_validate_model/);
  assert.match(manifest, /blueprint_artifact_report_write/);
  assert.match(manifest, /add-tests-<phase>/);

  assert.match(skillFile, /Execution profile for `validate-phase`, `verify-work`, and the long-running parts of `add-tests`: `long-running-mutation`/);
  assert.match(skillFile, /`blueprint_artifact_report_authoring_context`/);
  assert.match(skillFile, /`blueprint_artifact_report_validate_model`/);
  assert.match(skillFile, /`blueprint_artifact_report_write`/);

  assert.match(runtimeContract, /report\.add-tests/);
  assert.match(runtimeContract, /classification/i);
  assert.match(runtimeContract, /approved test plan/i);
  assert.match(runtimeContract, /blueprint_artifact_report_validate_model/);
  assert.match(runtimeContract, /blueprint_artifact_report_write/);

  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md"
  ]);
  assert.equal(contract.skillInputs.effective.some((input) => input.startsWith("docs/")), false);

  assert.match(readme, /\/blu-add-tests/);
  assert.match(gemini, /\/blu-add-tests/);
});

test("add-tests is exposed as an implemented validation follow-up command", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["add-tests"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-add-tests.toml");
  assert.equal(entry.primarySkill, "blueprint-phase-validation");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_validation_read",
    "blueprint_phase_validation_authoring_context",
    "blueprint_phase_validation_render",
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_phase_validation_write",
    "blueprint_artifact_list",
    "blueprint_artifact_validate",
    "blueprint_artifact_report_authoring_context",
    "blueprint_artifact_report_validate_model",
    "blueprint_artifact_report_write",
    "blueprint_state_load",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-executor",
    "blueprint-verifier"
  ]);
});
