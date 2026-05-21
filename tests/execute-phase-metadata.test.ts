import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertMatchesAll(content: string, patterns: RegExp[]): void {
  for (const pattern of patterns) {
    assert.match(content, pattern);
  }
}

test("execute-phase manifest stays thin while keeping the core execution invariants explicit", async () => {
  const commandFile = await readRepoFile("commands/blu-execute-phase.toml");

  assert.match(commandFile, /Use the `blueprint-phase-execution` skill/);
  assert.match(commandFile, /`long-running-mutation`/);
  assert.match(commandFile, /Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route/);
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /`update_topic` tool plus `write_todos`/);
  assert.match(commandFile, /`blueprint-executor` subagent/);

  const requiredTools = [
    "blueprint_phase_locate",
    "blueprint_phase_plan_index",
    "blueprint_phase_execution_targets",
    "blueprint_phase_plan_read",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_summary_authoring_context",
    "blueprint_phase_summary_validate_model",
    "blueprint_phase_summary_write",
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_artifact_validate",
    "blueprint_state_load",
    "blueprint_state_update"
  ];

  for (const tool of requiredTools) {
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(tool)));
  }

  assertMatchesAll(commandFile, [
    /gapClosurePlans/,
    /lowerWavePendingPlans/,
    /externalServicePreflight/,
    /externalServiceConfirmed/,
    /always_confirm_external_services/,
    /shared file set/i,
    /artifactId: "phase\.summary"/,
    /parallelization\.\*/,
    /workflow\.use_worktrees/,
    /git\.branching_strategy/,
    /base: "synced"/,
    /PARTIAL` or `BLOCKED`/,
    /Do not persist execute-phase reports/i,
    /phase-level completion claim/i,
    /\/blu-validate-phase/,
    /\/blu-verify-work/,
    /\/blu-progress/
  ]);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md|agents\/blueprint-executor\.md/);
});

test("execute-phase skill bundle points the command at execute-specific references instead of quick or fast detail", async () => {
  const skillFile = await readRepoFile("skills/blueprint-phase-execution/SKILL.md");

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /input_bundles:/);
  assert.match(skillFile, /"\/blu-execute-phase":/);
  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/execute-phase-runtime-contract\.md/
  );
  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/long-running-execution-profile\.md/
  );
  assert.match(
    skillFile,
    /not inline[\s\S]*`\/blu-quick`[\s\S]*`\/blu-fast`[\s\S]*`\/blu-execute-phase` context/i
  );
  assert.match(
    skillFile,
    /If a selected plan depends on another plan whose summary is not yet[\s\S]*Use `PARTIAL`[\s\S]*`BLOCKED`[\s\S]*dependency summary exists/i
  );
  assert.match(
    skillFile,
    /Warning-only Markdown shape[\s\S]*does not require[\s\S]*another repair loop/i
  );
  assert.match(skillFile, /externalServicePreflight/i);
});

test("execute-phase command docs point at the rich runtime contract and keep the important invariants concise", async () => {
  const docsFile = await readRepoFile("docs/commands/execute-phase.md");

  assert.match(docsFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docsFile, /## Shared Runtime Contract/);
  assert.match(
    docsFile,
    /skills\/blueprint-phase-execution\/references\/execute-phase-runtime-contract\.md/
  );
  assertMatchesAll(docsFile, [
    /blueprint_phase_execution_targets/i,
    /gapClosurePlans/,
    /common metadata and[\s\S]*target-selection authority[\s\S]*default runs[\s\S]*`--wave`[\s\S]*`--gaps-only`/i,
    /lowerWavePendingPlans/,
    /externalServicePreflight/,
    /Pre-persistence gates/i,
    /Post-execution checks/i,
    /Verifier handoff/i,
    /does not persist reports/i,
    /## Summary Persistence Contract/,
    /blueprint_phase_summary_authoring_context/,
    /blueprint_phase_summary_validate_model/,
    /Markdown-first/i,
    /explicit `Status`/,
    /Do not pass summary filenames, phase slugs, phase directories/i,
    /`COMPLETED` is the only summary status that closes execution debt/i,
    /authoring template is a safe `PARTIAL` carry-forward seed/i,
    /warning-only Markdown shape[\s\S]*does not require another repair loop/i,
    /downgrade to `PARTIAL` or `BLOCKED`[\s\S]*Readiness[\s\S]*Completion State[\s\S]*Next Safe Action[\s\S]*Gap \/ Repair Routes[\s\S]*Follow-Ups/i,
    /base: "synced"/
  ]);
  assert.doesNotMatch(
    docsFile,
    /gapClosurePlans` from `blueprint_phase_plan_index` is the source of truth[\s\S]*`--gaps-only`/i
  );
  assert.doesNotMatch(
    docsFile,
    /Pre-persistence gates:[\s\S]*selected plan index, summary index[\s\S]*before any summary write/i
  );
});

test("execute-phase runtime contract carries the rich execution sequencing and carry-forward rules", async () => {
  const runtimeContract = await readRepoFile(
    "skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md"
  );

  assertMatchesAll(runtimeContract, [
    /This reference is the rich behavior contract for `\/blu-execute-phase`/i,
    /## Visible Execution Progress/,
    /resolve execution phase[\s\S]*select executable targets[\s\S]*confirm execution mode[\s\S]*execute selected plan work[\s\S]*write execution summary[\s\S]*run post-execution checks[\s\S]*sync state and route/i,
    /Gemini-native progress helpers are presentation mirrors only[\s\S]*do not\s+expand the MCP tool allowlist, persistence authority, executor authority,\s+verification authority, state-sync authority, routing authority, or user\s+confirmation authority/i,
    /Emit exceptional updates for[\s\S]*missing or stale plans, lower-wave blockers, external-service waits, overwrite\s+waits, overlapping write ownership/i,
    /blueprint_phase_execution_targets/,
    /gapClosurePlans/,
    /lowerWavePendingPlans/,
    /externalServicePreflight/,
    /absolute\s+blocker/i,
    /PARTIAL` and `BLOCKED` summaries/i,
    /If a dependency plan summary is still missing or not yet `COMPLETED`[\s\S]*Downgrade to `PARTIAL` or[\s\S]*`BLOCKED`[\s\S]*dependency summary exists/i,
    /authoring template is a safe `PARTIAL`[\s\S]*Switch it to `COMPLETED`[\s\S]*only after execution evidence/i,
    /Warning-only Markdown shape[\s\S]*should not start[\s\S]*another repair loop/i,
    /carry-forward evidence/i,
    /one `XX-YY-SUMMARY\.md` artifact per executed plan/i,
    /phase_summary_authoring_context/,
    /phase_summary_validate_model/,
    /Do not persist execute-phase reports/i,
    /code-review, regression, or schema-drift warnings/i,
    /post-execution checks/i,
    /base: "synced"/,
    /summary-backed carry-forward evidence/i,
    /one-plan-at-a-time\s+inline execution/i,
    /phase-level completion claim/i,
    /external service/i,
    /\/blu-validate-phase/,
    /\/blu-verify-work/
  ]);
});

test("execute-phase runtime contract resource is owned by runtime metadata, not docs", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("execute-phase");

  assert.ok(metadata);

  const contract = await buildBlueprintCommandRuntimeContractResource("execute-phase");

  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.commandSpecPath, metadata.sourceId);
  assert.equal(contract.spec.primarySkill, "blueprint-phase-execution");
  assert.deepEqual(contract.spec.requiredTools, [...metadata.requiredTools]);
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.spec.optionalSubagents, ["blueprint-executor"]);
  assert.deepEqual(contract.runtimeReference.optionalAgents, ["blueprint-executor"]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "commands/blu-execute-phase.toml",
    "skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md",
    "skills/blueprint-phase-execution/references/long-running-execution-profile.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /use blueprint_phase_execution_targets as the common read authority/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /selectedPlans, existingSummaries, blockers, and conflicts as the default public metadata source/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /read plan bodies through blueprint_phase_plan_read only for the selected plans/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /read blueprint_phase_summary_read only when overwrite or repair reasoning truly needs existing summary body text/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /do not treat blueprint_artifact_validate or blueprint_state_load as default pre-write gates on the common path/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /keep the post-write sequence as blueprint_phase_summary_index followed by blueprint_artifact_validate and blueprint_state_update with base: "synced"/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /never persist execute-phase reports/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /never claim phase completion before validation and verification evidence exists/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /skills\/blueprint-phase-execution\/references\/execute-phase-runtime-contract\.md/i
  );
});
