import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("validate-phase manifest references the validation tools, config gates, and safe routing contract", async () => {
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
  assert.match(commandFile, /authoringTemplate/);
  assert.match(commandFile, /Read every completed execution summary/i);
  assert.match(commandFile, /every completed saved summary citation inside the contract's evidence section/i);
  assert.match(commandFile, /patch\.activeCommand: "\/blu-validate-phase"/);
  assert.match(commandFile, /explicit test-generation gaps.*\/blu-add-tests <phase>/i);
  assert.match(
    commandFile,
    /only after .*written: true.*status: "reused".*or after the single repair retry succeeds/i
  );
  assert.match(commandFile, /locked markers and required section names unchanged/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
});

test("validate-phase skill captures summary-backed validation and verifier usage rules", async () => {
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
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /workflow\.verifier/);
  assert.match(skillFile, /workflow\.nyquist_validation/);
  assert.match(skillFile, /artifactId: "phase\.verification"/);
  assert.match(skillFile, /locked markers and required section names unchanged/i);
  assert.match(skillFile, /references\/validate-phase-runtime-contract\.md/);
  assert.match(skillFile, /State A\/B\/C model/);
  assert.match(skillFile, /requirement\/task coverage map/i);
  assert.match(skillFile, /every completed summary artifact first/i);
  assert.match(skillFile, /every completed summary filename or path in the contract-defined evidence section/i);
  assert.match(skillFile, /Run post-write `blueprint_artifact_validate` only after a successful write or reuse outcome/i);
  assert.match(skillFile, /patch\.activeCommand: "\/blu-validate-phase"/);
  assert.match(skillFile, /no-subagent fallback/i);
  assert.match(skillFile, /browser, web-search-only, shell-only, or generic agents/i);
  assert.match(skillFile, /retry once before stopping/i);
  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docFile, /## Shared Runtime Contract/);
  assert.match(docFile, /## In-Flight Progress Contract/);
  assert.match(docFile, /saved-summary-first contract explicit/i);
  assert.match(docFile, /pending gate, execution mode, and next safe action/i);
  assert.match(docFile, /required-tool derivation through `blueprint_artifact_contract_read`/i);
  assert.match(docFile, /State A\/B\/C/);
  assert.match(docFile, /requirement\/task coverage map/i);
  assert.match(docFile, /cite every completed saved summary under `## Evidence Reviewed`/i);
  assert.match(docFile, /Run post-write `blueprint_artifact_validate` and `blueprint_state_update` only after a successful write or reuse outcome/i);
  assert.match(docFile, /no-subagent fallback/i);
  assert.match(docFile, /retry once/i);
  assert.match(docFile, /test-generation gaps.*\/blu-add-tests <phase>/i);
  assert.match(docFile, /patch\.activeCommand: "\/blu-validate-phase"/);
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
  assert.match(validateReference, /## Capability-Gated Subagent Path/);
  assert.match(validateReference, /## No-Subagent Fallback/);
  assert.match(validateReference, /Do not substitute browser, web-search-only, shell-only, or generic agents/);
  assert.match(validateReference, /## Retry And Repair Behavior/);
  assert.match(validateReference, /retry once/i);
  assert.match(validateReference, /Keep every completed saved summary path or filename under `## Evidence Reviewed`/i);
  assert.match(validateReference, /patch\.activeCommand: "\/blu-validate-phase"/);
  assert.match(
    validateReference,
    /Do not\s+run post-write artifact validation or state sync until the write succeeds/i
  );
  assert.match(validateReference, /## Output Quality Criteria/);
  assert.match(validateReference, /requirement\/task coverage/i);
  assert.match(validateReference, /blueprint_phase_validation_write/);
});

test("validate-phase verifier and MCP docs preserve richer evidence expectations", async () => {
  const [agentFile, mcpTools] = await Promise.all([
    readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/MCP-TOOLS.md"), "utf8")
  ]);

  assert.match(agentFile, /requirement\/task coverage map/i);
  assert.match(agentFile, /manual-only, deferred, partial, and blocked coverage/i);
  assert.match(agentFile, /## Requirement \/ Task Coverage/);
  assert.match(agentFile, /## Test Infrastructure \/ Evidence Metadata/);
  assert.match(agentFile, /## Manual-Only or Deferred Coverage/);
  assert.match(agentFile, /## Gap Classification/);
  assert.match(agentFile, /Gate: PASS\|PARTIAL\|BLOCKED/);
  assert.match(agentFile, /Readiness: <ready for UAT or not ready>/);
  assert.match(
    mcpTools,
    /validate-phase[\s\S]*validate-phase-runtime-contract\.md[\s\S]*State A\/B\/C[\s\S]*requirement\/task coverage map[\s\S]*sequential no-subagent fallback/i
  );
  assert.match(mcpTools, /browser\/web-search\/shell-only or generic agents as substitutes/i);
  assert.match(mcpTools, /repair invalid writes or validation failures once through MCP/i);
});
