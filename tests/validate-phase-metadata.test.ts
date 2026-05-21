import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

function headingSection(markdown: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `Missing section: ${marker}`);
  const next = markdown.indexOf("\n## ", start + marker.length);
  return markdown.slice(start, next === -1 ? undefined : next);
}

test("validate-phase manifest stays thin while referencing the validation tools and routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-validate-phase.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(
    commandFile,
    /skills\/blueprint-phase-validation\/references\/validate-phase-runtime-contract\.md/
  );
  assert.match(commandFile, /same-named Gemini CLI agent tool `blueprint-verifier`/);
  assert.match(commandFile, /bounded validation task packet/);
  assert.match(commandFile, /no-subagent fallback/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_authoring_context")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_validate_model")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_validate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_load")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /workflow\.verifier/);
  assert.match(commandFile, /workflow\.nyquist_validation/);
  assert.match(commandFile, /State A\/B\/C input model/);
  assert.match(commandFile, /browser, web-search-only, shell-only, or generic agents/);
  assert.match(commandFile, /XX-VERIFICATION\.md/);
  assert.match(commandFile, /artifactId: "phase\.verification"/);
  assert.match(commandFile, /patch\.activeCommand: "\/blu-validate-phase"/);
  assert.match(commandFile, /explicit test-generation gaps[\s\S]*\/blu-add-tests <phase>/i);
  assert.match(commandFile, /implementation\/behavior gaps[\s\S]*\/blu-audit-fix <phase>/i);
  assert.match(commandFile, /if gateState == PASS[\s\S]*\/blu-verify-work <phase>/i);
  assert.match(commandFile, /else if explicit deferred-test or test-generation gaps remain[\s\S]*\/blu-add-tests <phase>/i);
  assert.match(commandFile, /else if implementation or behavior gaps remain[\s\S]*\/blu-audit-fix <phase>/i);
  assert.match(commandFile, /else -> keep nextSafeAction on \/blu-validate-phase <phase>/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /manual validation feedback, UAT-readiness confirmation/i);
  assert.match(
    commandFile,
    /manual-feedback or UAT-handoff gate that needs a user decision/i
  );
  assert.match(commandFile, /saved-summary-first/i);
  assert.match(commandFile, /Route only to implemented commands/i);
  assert.doesNotMatch(commandFile, /Follow this flow exactly:/);
  assert.doesNotMatch(commandFile, /every completed saved summary citation inside the contract's evidence section/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
});

test("validate-phase skill scopes required inputs to the active command and keeps detailed validation rules in the runtime contract", async () => {
  const [skillFile, validateReference] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md"
      ),
      "utf8"
    )
  ]);
  const metadata = getRuntimeOwnedCommandMetadata("validate-phase");
  const catalog = await blueprintCommandCatalog();
  const runtimeContract = await buildBlueprintCommandRuntimeContractResource("validate-phase");
  const runtimeContractPath =
    "skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md";
  const requiredInputs = headingSection(skillFile, "Required Inputs");

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#validate-phase");
  assert.deepEqual(metadata.requiredInputPaths, [runtimeContractPath]);
  assert.equal(catalog.commands["validate-phase"].specPath, metadata.sourceId);
  assert.deepEqual(catalog.commands["validate-phase"].requiredTools, [
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
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /execution summaries remain the source of truth/i);
  assert.match(skillFile, /Execution profile for `validate-phase`, `verify-work`, and the long-running parts of `add-tests`: `long-running-mutation`/);
  assert.match(skillFile, /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(skillFile, /resolved scope, active stage, pending gate, execution mode, next safe action/i);
  assert.match(
    skillFile,
    /keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/i
  );
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /blueprint_phase_validation_authoring_context/);
  assert.match(skillFile, /blueprint_phase_validation_render/);
  assert.match(skillFile, /blueprint_phase_validation_validate_model/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /workflow\.verifier/);
  assert.match(skillFile, /workflow\.nyquist_validation/);
  assert.match(skillFile, /artifactId: "phase\.verification"/);
  assert.match(skillFile, /locked markers and required section names unchanged/i);
  assert.match(skillFile, /phase\.verification.*expose `modelContract` without a public `authoringTemplate`/i);
  assert.match(skillFile, /references\/validate-phase-runtime-contract\.md/);
  assert.match(requiredInputs, /Runtime input resolution is structured and command-scoped/i);
  assert.match(requiredInputs, /input_bundles\.commands/);
  assert.match(requiredInputs, /shared validation bundle is intentionally empty/i);
  assert.match(requiredInputs, /active local runtime contract as the only skill-authored input bundle file/i);
  assert.match(requiredInputs, /command runtime metadata\/catalog/i);
  assert.match(requiredInputs, /blueprint:\/\/commands\/\{command\}\/runtime-contract/);
  assert.match(requiredInputs, /artifact contracts read through MCP/i);
  assert.doesNotMatch(requiredInputs, /docs\//);
  assert.doesNotMatch(requiredInputs, /verify-work-runtime-contract|add-tests-runtime-contract/);
  assert.match(validateReference, /## Visible Validation Progress/);
  assert.match(
    validateReference,
    /resolve validation phase[\s\S]*read saved execution evidence[\s\S]*classify validation state[\s\S]*analyze coverage and gaps[\s\S]*write verification model[\s\S]*validate saved artifacts[\s\S]*sync state and route/i
  );
  assert.match(
    validateReference,
    /Gemini-native progress helpers are presentation mirrors only[\s\S]*do not\s+expand the MCP tool allowlist, persistence authority, verifier authority,\s+coverage authority, validation authority, state-sync authority, routing\s+authority, or user confirmation authority/i
  );
  assert.match(
    validateReference,
    /Emit exceptional updates for\s+missing summaries, overwrite waits, manual-feedback or UAT-readiness waits,\s+verifier unavailable fallback/i
  );
  assert.match(skillFile, /State A\/B\/C handling/i);
  assert.match(skillFile, /saved-summary-first, phase-scoped, and MCP-owned/i);
  assert.match(skillFile, /Run post-write `blueprint_artifact_validate` only after a successful write or reuse outcome/i);
  assert.match(skillFile, /patch\.activeCommand: "\/blu-validate-phase"/);
  assert.match(skillFile, /Route explicit test-generation gaps to `\/blu-add-tests <phase>` and implementation\/behavior gaps to `\/blu-audit-fix <phase>`/i);
  assert.match(skillFile, /if gateState == PASS[\s\S]*\/blu-verify-work <phase>/i);
  assert.match(skillFile, /else if explicit deferred-test or test-generation gaps remain[\s\S]*\/blu-add-tests <phase>/i);
  assert.match(skillFile, /else if implementation or behavior gaps remain[\s\S]*\/blu-audit-fix <phase>/i);
  assert.match(skillFile, /else -> keep nextSafeAction on \/blu-validate-phase <phase>/i);
  assert.match(validateReference, /## Stage Mapping/);
  assert.match(validateReference, /## Required MCP Calls/);
  assert.match(validateReference, /## Input State Model/);
  assert.match(validateReference, /State A:/);
  assert.match(validateReference, /State B:/);
  assert.match(validateReference, /State C:/);
  assert.match(validateReference, /manual-only coverage,[\s\S]*UAT\s+readiness, or another structured gate/i);
  assert.match(validateReference, /## Capability-Gated Subagent Path/);
  assert.match(validateReference, /same-named\s+`blueprint-verifier` tool/i);
  assert.match(validateReference, /Do not read, inline, or load separate agent source/i);
  assert.match(validateReference, /## No-Subagent Fallback/);
  assert.match(validateReference, /Do not substitute browser, web-search-only, shell-only, or generic agents/);
  assert.match(validateReference, /## Retry And Repair Behavior/);
  assert.match(validateReference, /retry once/i);
  assert.match(validateReference, /blueprint_phase_validation_validate_model/);
  assert.match(validateReference, /status: "valid"/);
  assert.match(validateReference, /Keep every completed saved summary path or filename under `## Evidence Reviewed`/i);
  assert.match(
    validateReference,
    /taskSchema[\s\S]*schema authority[\s\S]*renderPreview[\s\S]*canonical rendered preview/i
  );
  assert.match(validateReference, /patch\.activeCommand: "\/blu-validate-phase"/);
  assert.match(validateReference, /## Pre-Write Routing Shorthand/);
  assert.match(validateReference, /if gateState == PASS[\s\S]*\/blu-verify-work <phase>/i);
  assert.match(validateReference, /else if explicit deferred-test or test-generation gaps remain[\s\S]*\/blu-add-tests <phase>/i);
  assert.match(validateReference, /else if implementation or behavior gaps remain[\s\S]*\/blu-audit-fix <phase>/i);
  assert.match(validateReference, /else -> keep nextSafeAction on \/blu-validate-phase <phase>/i);
  assert.match(
    validateReference,
    /post-write artifact validation or state sync until\s+the write succeeds/i
  );
  assert.match(validateReference, /## Output Quality Criteria/);
  assert.match(validateReference, /requirement\/task coverage/i);
  assert.match(validateReference, /blueprint_phase_validation_write/);
});

test("validate-phase verifier and artifact contract preserve evidence expectations without placeholder scaffolds", async () => {
  const [agentFile, contractSource] = await Promise.all([
    readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8"),
    readFile(path.join(repoRoot, "src/mcp/artifact-contracts/index.ts"), "utf8")
  ]);

  assert.match(agentFile, /requirement\/task coverage map/i);
  assert.match(agentFile, /manual-only, deferred, partial, and blocked coverage/i);
  assert.match(agentFile, /live `phase\.verification` contract returned by[\s\S]*`blueprint_artifact_contract_read`/i);
  assert.match(agentFile, /never emit scaffold literals or placeholder-grade text/i);
  assert.match(
    agentFile,
    /structured[\s\S]*draft-ready section content instead of inventing a full[\s\S]*markdown artifact/i
  );
  assert.doesNotMatch(agentFile, /# Phase XX: <Phase Name> - Verification/);
  assert.match(contractSource, /"phase\.verification": \{/);
  assert.match(contractSource, /PHASE_VERIFICATION_MODEL_CONTRACT/);
  assert.match(contractSource, /renderVerificationTemplate/);
  assert.match(contractSource, /"Evidence Reviewed"/);
});
