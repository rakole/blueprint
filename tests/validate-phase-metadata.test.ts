import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

function headingSection(markdown: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `Missing section: ${marker}`);
  const next = markdown.indexOf("\n## ", start + marker.length);
  return markdown.slice(start, next === -1 ? undefined : next);
}

function subheadingSection(markdown: string, heading: string): string {
  const marker = `#### ${heading}`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `Missing section: ${marker}`);
  const next = markdown.indexOf("\n#### ", start + marker.length);
  return markdown.slice(start, next === -1 ? undefined : next);
}

test("validate-phase manifest stays thin while referencing the validation tools and routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-validate-phase.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(
    commandFile,
    /skills\/blueprint-phase-validation\/references\/validate-phase-runtime-contract\.md/
  );
  assert.match(commandFile, /`blueprint-verifier` subagent/);
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
  const [skillFile, docFile, runtimeReference, validateReference] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/validate-phase.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md"
      ),
      "utf8"
    )
  ]);
  const requiredInputs = headingSection(skillFile, "Required Inputs");
  const validateInputs = subheadingSection(requiredInputs, "`validate-phase`");

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
  assert.match(skillFile, /references\/validate-phase-runtime-contract\.md/);
  assert.match(skillFile, /Load the shared validation inputs first, then load only the command-specific inputs/i);
  assert.match(requiredInputs, /### Shared validation inputs/);
  assert.match(requiredInputs, /### Command-specific inputs/);
  assert.match(validateInputs, /validate-phase-runtime-contract\.md/);
  assert.match(validateInputs, /docs\/commands\/validate-phase\.md/);
  assert.doesNotMatch(validateInputs, /verify-work-runtime-contract|add-tests-runtime-contract/);
  assert.match(skillFile, /State A\/B\/C handling/i);
  assert.match(skillFile, /saved-summary-first, phase-scoped, and MCP-owned/i);
  assert.match(skillFile, /Run post-write `blueprint_artifact_validate` only after a successful write or reuse outcome/i);
  assert.match(skillFile, /patch\.activeCommand: "\/blu-validate-phase"/);
  assert.match(skillFile, /Route explicit test-generation gaps to `\/blu-add-tests <phase>` and implementation\/behavior gaps to `\/blu-audit-fix <phase>`/i);
  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docFile, /## Shared Runtime Contract/);
  assert.match(docFile, /## In-Flight Progress Contract/);
  assert.match(docFile, /Detailed runtime reference: `skills\/blueprint-phase-validation\/references\/validate-phase-runtime-contract\.md`/);
  assert.match(docFile, /saved-summary-first contract explicit/i);
  assert.match(docFile, /pending gate, execution mode, and next safe action/i);
  assert.match(docFile, /required-tool derivation through `blueprint_artifact_contract_read`/i);
  assert.match(docFile, /State A\/B\/C/);
  assert.match(docFile, /blueprint_phase_validation_validate_model/);
  assert.match(docFile, /cite every completed saved summary under `## Evidence Reviewed`/i);
  assert.match(docFile, /Build the concrete requirement\/task coverage map[\s\S]*detailed runtime reference instead of duplicating that step-by-step contract/i);
  assert.match(docFile, /Run post-write `blueprint_artifact_validate` and `blueprint_state_update` only after a successful write or reuse outcome/i);
  assert.match(docFile, /no-subagent fallback/i);
  assert.match(docFile, /repair once through MCP/i);
  assert.match(docFile, /test-generation gaps.*\/blu-add-tests <phase>/i);
  assert.match(docFile, /implementation or behavior gaps.*\/blu-audit-fix <phase>/i);
  assert.match(docFile, /patch\.activeCommand: "\/blu-validate-phase"/);
  assert.match(docFile, /manual feedback on coverage, sign-off posture, or readiness to hand off into conversational UAT/i);
  assert.match(
    runtimeReference,
    /`validate-phase`[\s\S]*validate-phase-runtime-contract\.md[\s\S]*classify State A\/B\/C[\s\S]*sequential no-subagent fallback/i
  );
  assert.match(validateReference, /## Stage Mapping/);
  assert.match(validateReference, /## Required MCP Calls/);
  assert.match(validateReference, /## Input State Model/);
  assert.match(validateReference, /State A:/);
  assert.match(validateReference, /State B:/);
  assert.match(validateReference, /State C:/);
  assert.match(validateReference, /manual-only coverage,[\s\S]*UAT\s+readiness, or another structured gate/i);
  assert.match(validateReference, /## Capability-Gated Subagent Path/);
  assert.match(validateReference, /## No-Subagent Fallback/);
  assert.match(validateReference, /Do not substitute browser, web-search-only, shell-only, or generic agents/);
  assert.match(validateReference, /## Retry And Repair Behavior/);
  assert.match(validateReference, /retry once/i);
  assert.match(validateReference, /blueprint_phase_validation_validate_model/);
  assert.match(validateReference, /status: "valid"/);
  assert.match(validateReference, /Keep every completed saved summary path or filename under `## Evidence Reviewed`/i);
  assert.match(validateReference, /patch\.activeCommand: "\/blu-validate-phase"/);
  assert.match(
    validateReference,
    /post-write artifact validation or state sync until\s+the write succeeds/i
  );
  assert.match(validateReference, /## Output Quality Criteria/);
  assert.match(validateReference, /requirement\/task coverage/i);
  assert.match(validateReference, /blueprint_phase_validation_write/);
});

test("validate-phase verifier and MCP docs preserve contract-driven evidence expectations without placeholder scaffolds", async () => {
  const [agentFile, mcpTools] = await Promise.all([
    readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/MCP-TOOLS.md"), "utf8")
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
  assert.match(
    mcpTools,
    /validate-phase[\s\S]*validate-phase-runtime-contract\.md[\s\S]*State A\/B\/C[\s\S]*requirement\/task coverage map[\s\S]*sequential no-subagent fallback/i
  );
  assert.match(mcpTools, /browser\/web-search\/shell-only or generic agents as substitutes/i);
  assert.match(mcpTools, /validate the structured verification model/i);
});
