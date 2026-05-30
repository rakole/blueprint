import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { AUDIT_FIX_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { blueprintToolNames } from "../src/mcp/server.js";

const repoRoot = process.cwd();

test("audit-fix runtime metadata, manifest, and local contract stay source-owned", async () => {
  const [catalog, contract, commandFile, skillFile, referenceFile] = await Promise.all([
    blueprintCommandCatalog(),
    buildBlueprintCommandRuntimeContractResource("audit-fix"),
    readFile(path.join(repoRoot, "commands/blu-audit-fix.toml"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-review/SKILL.md"), "utf8"),
    readFile(
      path.join(repoRoot, "skills/blueprint-review/references/audit-fix-runtime-contract.md"),
      "utf8"
    )
  ]);
  const entry = catalog.commands["audit-fix"];

  assert.equal(entry.specPath, AUDIT_FIX_RUNTIME_METADATA.sourceId);
  assert.deepEqual(entry.requiredTools, [...AUDIT_FIX_RUNTIME_METADATA.requiredTools]);
  assert.equal(contract.catalog.specPath, AUDIT_FIX_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.executionProfile, "long-running-mutation");
  assert.deepEqual(contract.spec?.writes, [...AUDIT_FIX_RUNTIME_METADATA.spec.writes]);
  assert.equal(contract.runtimeReference?.path, AUDIT_FIX_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...AUDIT_FIX_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-audit-fix.toml",
    "skills/blueprint-review/references/audit-fix-runtime-contract.md"
  ]);
  assert.match(commandFile, /--source <review\|security\|verification\|uat\|all>/);
  assert.match(commandFile, /--severity <medium\|high\|all>/);
  assert.match(commandFile, /--max <N>/);
  assert.match(commandFile, /--dry-run/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /`update_topic` tool/);
  assert.match(commandFile, /`write_todos`/);
  assert.match(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /blueprint-fixer` as planned-only inventory/i);
  assert.match(skillFile, /Execution profile for `audit-fix`: `long-running-mutation`/);
  assert.match(
    referenceFile,
    /classification table before mutation[\s\S]*`auto-fixable`, `manual-only`, or `skip`/i
  );
  assert.match(referenceFile, /auditFixContext \{source, severity, maxAttempts,\s+dryRun, scopeFiles\}/i);
  assert.match(
    referenceFile,
    /`status`, `readiness`,[\s\S]*`nextSafeAction`/i
  );
  assert.match(
    referenceFile,
    /repair the model[\s\S]*`contract\.modelContract\.schemaPath`, the narrowed `taskSchema`/i
  );
  assert.match(
    referenceFile,
    /No browser\/web\/search-only or generic agent was used as a substitute/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation profile for bounded saved-evidence remediation/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /--source, --severity, --max, --dry-run, mutation confirmation, report overwrite, optional todo capture, active stage, and early-stop state explicit/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /repair invalid diagnostics by exact path, code, repair, allowedValues, missing, argsPatch, and repairSummary guidance/i
  );
});

test("audit-fix is exposed as an implemented remediation command with the registered tools", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["audit-fix"];

  assert.ok(blueprintToolNames.includes("blueprint_review_scope"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_contract_read"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_report_authoring_context"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_report_validate_model"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_report_write"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_mutate_index"));
  assert.ok(blueprintToolNames.includes("blueprint_state_update"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-audit-fix.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_review_scope",
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_artifact_report_authoring_context",
    "blueprint_artifact_report_validate_model",
    "blueprint_artifact_report_write",
    "blueprint_artifact_mutate_index",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-reviewer",
    "blueprint-verifier"
  ]);
});
