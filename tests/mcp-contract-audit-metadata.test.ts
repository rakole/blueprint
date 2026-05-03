import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("shared MCP contract docs lock the model-facing call rules for ids, paths, scope, and defaults", async () => {
  const mcpToolsDoc = await readRepoFile("docs/MCP-TOOLS.md");

  assert.match(mcpToolsDoc, /## Model-Facing Call Contracts/);
  assert.match(mcpToolsDoc, /`blueprint_artifact_scaffold` accepts only supported repo-relative Blueprint artifact paths/i);
  assert.match(mcpToolsDoc, /`blueprint_artifact_contract_read` returns the runtime-owned canonical authoring contract/i);
  assert.match(
    mcpToolsDoc,
    /Review-family commands must use runtime-owned contract context before drafting or updating/i
  );
  assert.match(mcpToolsDoc, /For code-review-fix, `blueprint_review_authoring_context\.authoringContext\.taskSchema` is the model-authoring authority/i);
  assert.match(mcpToolsDoc, /`blueprint_phase_summary_write` requires numeric `phase`, numeric `planId`, and a validated structured summary `model`/i);
  assert.match(mcpToolsDoc, /blueprint_phase_summary_authoring_context/);
  assert.match(mcpToolsDoc, /blueprint_phase_summary_validate_model/);
  assert.match(mcpToolsDoc, /`blueprint_review_scope` accepts repo-relative file paths only/i);
  assert.match(mcpToolsDoc, /`blueprint_config_set` defaults `scope` to `project`, and `patch` must be a JSON object/i);
  assert.match(mcpToolsDoc, /`blueprint_project_init` is the first persistent bootstrap write/i);
  assert.match(mcpToolsDoc, /`blueprint_pause_handoff_write` requires `currentState`/i);
  assert.match(mcpToolsDoc, /`blueprint_artifact_report_write` accepts a bare `reportName`/i);
  assert.match(
    mcpToolsDoc,
    /`validate-phase` and `verify-work` use summary index\/read, validation read\/write, `blueprint_phase_validation_authoring_context`, `blueprint_phase_validation_validate_model` for verification and UAT models, `blueprint_phase_validation_render` for lower-level compatibility render paths, `blueprint_artifact_contract_read`, config, artifact validation, and state update tools/i
  );
  assert.match(
    mcpToolsDoc,
    /`secure-phase` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, `blueprint_phase_summary_index`, `blueprint_phase_summary_read`, `blueprint_phase_execution_targets`, `blueprint_artifact_contract_read`, `blueprint_review_authoring_context`, `blueprint_review_validate_model`, and `blueprint_review_record`/i
  );
  assert.match(mcpToolsDoc, /secure-phase-runtime-contract\.md/i);
});

test("MCP resource docs keep the read-only contract, live command resources, and fallback path explicit", async () => {
  const [mcpToolsDoc, artifactSchema, runtimeReference] = await Promise.all([
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  for (const uri of [
    "blueprint://commands/catalog",
    "blueprint://commands/<command>/runtime-contract",
    "blueprint://phases/<phase>/bundle",
    "blueprint://codebase/bundle",
    "blueprint://reports/latest"
  ]) {
    const escapedUri = uri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    assert.match(mcpToolsDoc, new RegExp(escapedUri));
    assert.match(artifactSchema, new RegExp(escapedUri));
    assert.match(runtimeReference, new RegExp(escapedUri));
  }

  assert.match(
    mcpToolsDoc,
    /Blueprint now exposes the live read-only command resources and keeps the remaining resource contract documented for later grounding surfaces/i
  );
  assert.match(
    mcpToolsDoc,
    /\| `blueprint:\/\/commands\/catalog` \| Read the retained runtime command catalog as one resource view \| live `blueprint_command_catalog` truth \| read-only; never a write target \| call `blueprint_command_catalog` directly if the resource is unavailable \|/i
  );
  assert.match(
    mcpToolsDoc,
    /\| `blueprint:\/\/commands\/<command>\/runtime-contract` \| Read the runtime contract for one retained implemented command \| live command-catalog metadata plus the locked command spec and runtime-reference row for that implemented command \| read-only; never a write target \| read the command spec, runtime reference, and current tool docs directly when the resource is unavailable \|/i
  );
  assert.match(
    mcpToolsDoc,
    /\| `blueprint:\/\/phases\/<phase>\/bundle` \| Read a phase-grounding bundle for discovery-style workflows \| saved `\.blueprint\/` core docs plus the resolved phase artifact set \| read-only; never a write target \| use `blueprint_phase_context`, artifact reads, roadmap\/state reads, and local docs directly \|/i
  );
  assert.match(
    mcpToolsDoc,
    /\| `blueprint:\/\/codebase\/bundle` \| Read the saved seven-document codebase mapping bundle as one resource view \| `\.blueprint\/codebase\/\*\.md` plus existing artifact-contract truth \| read-only; never a write target \| use `blueprint_artifact_list`, `blueprint_artifact_contract_read`, and local files directly \|/i
  );
  assert.match(
    mcpToolsDoc,
    /\| `blueprint:\/\/reports\/latest` \| Read the latest-report index for durable Blueprint reports \| `\.blueprint\/reports\/` inventory and existing report metadata \| read-only; never a write target \| use `blueprint_artifact_list` and direct report reads \|/i
  );
  assert.match(
    mcpToolsDoc,
    /Resource views must mirror existing command\/tool truth; they do not get to invent new routing, status, or persistence semantics/i
  );

  assert.match(
    artifactSchema,
    /They are not stored as separate files under `\.blueprint\/`, they do not replace any artifact in this schema, and they must never become write targets/i
  );
  assert.match(
    artifactSchema,
    /`blueprint:\/\/commands\/catalog` is a read-only projection of the retained command registry and its runtime availability metadata; it does not widen implemented-only exposure rules/i
  );
  assert.match(
    artifactSchema,
    /`blueprint:\/\/commands\/<command>\/runtime-contract` is a read-only projection of one implemented command's locked runtime contract, derived from the command catalog plus the matching command spec and runtime-reference row\./i
  );
  assert.match(
    artifactSchema,
    /`blueprint:\/\/phases\/<phase>\/bundle` is a read-only projection over saved Blueprint phase-grounding inputs such as `PROJECT\.md`, `REQUIREMENTS\.md`, `ROADMAP\.md`, `STATE\.md`, and the resolved phase artifact set for the requested phase/i
  );
  assert.match(
    artifactSchema,
    /`blueprint:\/\/codebase\/bundle` is a read-only projection over the saved seven-document `\.blueprint\/codebase\/` bundle and its artifact-contract metadata/i
  );
  assert.match(
    artifactSchema,
    /`blueprint:\/\/reports\/latest` is a read-only projection over durable report inventory in `\.blueprint\/reports\/`; it is an index view, not a report authoring path/i
  );
  assert.match(
    artifactSchema,
    /Resource views are for discovery and grounding only\. Writes remain on the existing MCP tool surface for config, roadmap, phase, report, review, and capture persistence/i
  );

  assert.match(runtimeReference, /## Read-Only MCP Resource Contract/);
  assert.match(
    runtimeReference,
    /These resources are read-only context surfaces for discovery and grounding\. They do not own persistence, confirmation, routing, or write semantics/i
  );
  assert.match(
    runtimeReference,
    /`list_mcp_resources` and `read_mcp_resource` are the preferred read path for the live command resources today, with fallback to the existing direct docs\/tool reads when a resource is unavailable/i
  );
  assert.match(
    runtimeReference,
    /Router and progress commands use command manifests, `blueprint-router` input bundles, source-owned runtime metadata, and read-oriented MCP tools\. Docs remain control-plane history, not runtime inputs/i
  );
  assert.match(
    runtimeReference,
    /Until they are implemented, discovery-style commands must continue to use existing read-oriented MCP tools and control-plane history directly instead of pretending the resource path exists for the still-planned phase, codebase, and reports views/i
  );
  assert.match(
    runtimeReference,
    /`blueprint:\/\/commands\/catalog` may mirror the full retained catalog metadata, but `\/blu`, `help`, `progress`, and `next` must still recommend only commands whose catalog entry is `implemented`/i
  );
  assert.match(
    runtimeReference,
    /`blueprint:\/\/commands\/<command>\/runtime-contract` is exposed only for commands whose catalog entry is `implemented`, and it must mirror live command-catalog metadata plus the locked command spec and runtime-reference row for that command; it does not become a second command-status authority/i
  );
  assert.match(
    runtimeReference,
    /`blueprint:\/\/phases\/<phase>\/bundle` must mirror saved `\.blueprint\/` phase-grounding inputs and the resolved phase artifact set, with fallback to `blueprint_phase_context`, direct artifact reads, roadmap\/state reads, and local docs until the resource exists/i
  );
  assert.match(
    runtimeReference,
    /`blueprint:\/\/codebase\/bundle` must mirror the saved seven-document `\.blueprint\/codebase\/` bundle plus artifact-contract truth, with fallback to `blueprint_artifact_list`, `blueprint_artifact_contract_read`, and local files until the resource exists/i
  );
  assert.match(
    runtimeReference,
    /`blueprint:\/\/reports\/latest` is an index-only surface over saved reports\. Report authoring and overwrites remain on `blueprint_artifact_report_write`/i
  );
  assert.match(
    runtimeReference,
    /No writes move onto resource surfaces\. Config, roadmap, phase, report, review, and capture persistence remain on the existing Blueprint MCP tool surface/i
  );
});

test("discovery contracts stay explicit across discuss, research, and ui command surfaces", async () => {
  const [
    discussCommand,
    discussDoc,
    artifactSchema,
    discussRuntimeReference,
    discussMigration,
    mcpToolsDoc,
    researchCommand,
    researchDoc,
    researchRuntimeContract,
    uiCommand,
    uiDoc,
    discoverySkill,
    discussRuntimeContract
  ] = await Promise.all([
    readRepoFile("commands/blu-discuss-phase.toml"),
    readRepoFile("docs/commands/discuss-phase.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("docs/GSD-RUNTIME-MIGRATION.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("commands/blu-research-phase.toml"),
    readRepoFile("docs/commands/research-phase.md"),
    readRepoFile("skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"),
    readRepoFile("commands/blu-ui-phase.toml"),
    readRepoFile("docs/commands/ui-phase.md"),
    readRepoFile("skills/blueprint-phase-discovery/SKILL.md"),
    readRepoFile("skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md")
  ]);

  assert.match(discussCommand, /repo-relative Blueprint artifact paths such as `?\.blueprint\/phases\//i);
  assert.match(discussCommand, /discuss-phase-runtime-contract\.md/i);
  assert.match(discussCommand, /long-running-phase-discovery-profile\.md/i);
  assert.match(discussCommand, /referenced runtime contract as the source of truth/i);
  assert.match(discussCommand, /contract\.authoringTemplate[\s\S]*schema authority/i);
  assert.match(discussCommand, /substantive user-authored artifacts/i);
  assert.doesNotMatch(discussCommand, /Follow this flow exactly/i);
  assert.match(discussRuntimeContract, /structured checkpoint/i);
  assert.match(
    discussRuntimeContract,
    /`completedAreas`[\s\S]*`remainingAreas`[\s\S]*`decisions`[\s\S]*`deferredIdeas`[\s\S]*`canonicalReferences`[\s\S]*`resumeMeta`/i
  );
  assert.match(discussRuntimeContract, /`resumeMeta\.mode: "discuss"`/i);
  assert.match(discussRuntimeContract, /returned `path` as the authoritative saved filename/i);
  assert.match(discussRuntimeContract, /Normalize the draft to the live `authoringTemplate`/i);
  assert.match(discussRuntimeContract, /Self-check for placeholder text/i);
  assert.match(discussRuntimeContract, /Capability-Gated Agent Use/i);
  assert.match(discussRuntimeContract, /Single-Agent Fallback/i);
  assert.match(discussRuntimeContract, /status: "invalid"[\s\S]*repair/i);
  assert.match(discussRuntimeContract, /prior-context sweep/i);
  assert.match(discussRuntimeContract, /mapped codebase summaries/i);
  assert.match(discussRuntimeContract, /Assumptions Mode/i);
  assert.match(discussRuntimeContract, /checkpoint-per-area/i);
  assert.match(discussRuntimeContract, /state_update` with `base: "synced"/i);
  assert.match(discussDoc, /## Artifact Persistence Contract/);
  assert.match(discussDoc, /resolved numeric phase reference only/i);
  assert.match(discussDoc, /structured discuss checkpoint shape/i);
  assert.match(
    discussDoc,
    /`completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`/i
  );
  assert.match(discussDoc, /`resumeMeta` with fields such as `mode`, `pendingTopics`/i);
  assert.match(discussDoc, /normalized to the canonical `authoringTemplate` before write/i);
  assert.match(discussDoc, /self-checked against that contract/i);
  assert.match(discussDoc, /discuss-phase-runtime-contract\.md/i);
  assert.match(discussDoc, /long-running-phase-discovery-profile\.md/i);
  assert.match(discussDoc, /capability-gated[\s\S]*single-agent fallback/i);
  assert.match(discussDoc, /repair.*validation issues/i);
  assert.match(
    discussDoc,
    /blueprint_phase_context[\s\S]*projectBrief[\s\S]*requirementsGrounding[\s\S]*workflowPosture[\s\S]*codebase[\s\S]*requirements[\s\S]*missingArtifacts[\s\S]*warnings/i
  );
  assert.match(discussDoc, /prior-context sweeps/i);
  assert.match(discussDoc, /assumptions-mode analysis/i);
  assert.match(discussDoc, /checkpoint-per-area/i);
  assert.match(artifactSchema, /full discuss-phase context contract sections/i);
  assert.match(artifactSchema, /evidence-backed enough for downstream research and planning/i);
  assert.match(artifactSchema, /repair any returned write validation issues/i);
  assert.match(
    artifactSchema,
    /`Phase Boundary`, `Discovery Grounding`, `Implementation Decisions`, `Specific Ideas`, `Existing Code Insights`, `Dependencies`, `Open Questions`, `Deferred Ideas`, and `Canonical References`/i
  );
  assert.match(artifactSchema, /`resumeMeta` must carry durable resume metadata such as `mode`, `pendingTopics`, `completedTopics`, `currentQuestion`, `notes`, `resumeHint`, and `updatedAt`/i);
  assert.match(discussRuntimeReference, /prior-context sweep/i);
  assert.match(discussRuntimeReference, /dedicated todo\/backlog file crawl/i);
  assert.match(discussRuntimeReference, /codebase summaries/i);
  assert.match(
    discussRuntimeReference,
    /`discuss-phase`[\s\S]*`blueprint_phase_plan_index`[\s\S]*`blueprint_artifact_contract_read`/i
  );
  assert.match(discussRuntimeReference, /assumptions-mode analysis/i);
  assert.match(discussRuntimeReference, /progress recaps/i);
  assert.match(discussRuntimeReference, /checkpoint-per-area/i);
  assert.match(discussRuntimeReference, /`blueprint_state_update`[\s\S]*`blueprint_state_load`/i);
  assert.match(discussRuntimeReference, /discuss-phase-runtime-contract\.md/i);
  assert.match(discussRuntimeReference, /single-agent fallback/i);
  assert.match(discussRuntimeReference, /returned artifact validation issues/i);
  assert.match(discussMigration, /prior-context sweeps/i);
  assert.match(discussMigration, /dedicated todo\/backlog file crawl/i);
  assert.match(discussMigration, /codebase summaries/i);
  assert.match(
    discussMigration,
    /`discuss-phase`[\s\S]*`blueprint_phase_plan_index`[\s\S]*`blueprint_artifact_contract_read`/i
  );
  assert.match(discussMigration, /one-question ask_user branching/i);
  assert.match(discussMigration, /stronger assumptions-mode analysis/i);
  assert.match(discussMigration, /methodology lenses/i);
  assert.match(discussMigration, /progress recaps/i);
  assert.match(discussMigration, /checkpoint-per-area/i);
  assert.match(discussMigration, /end-of-run `STATE\.md` updates/i);
  assert.match(discussMigration, /single-agent fallback with carry-forward context compression/i);
  assert.match(discussMigration, /returned-validation repair/i);
  assert.match(discussMigration, /research-phase-runtime-contract\.md/i);
  assert.match(discussMigration, /single-agent topic fallback/i);
  assert.match(discussMigration, /validation repair/i);
  assert.match(
    mcpToolsDoc,
    /`discuss-phase` uses phase location\/context, `blueprint_phase_plan_index`, `blueprint_artifact_contract_read`/i
  );
  assert.match(mcpToolsDoc, /discuss-phase-runtime-contract\.md/i);
  assert.match(mcpToolsDoc, /long-running-phase-discovery-profile\.md/i);

  assert.match(researchCommand, /validation-failing research content/i);
  assert.match(researchCommand, /resolved numeric phase reference only/i);
  assert.match(researchCommand, /artifactId: "phase\.research"/);
  assert.match(researchCommand, /authoringTemplate/);
  assert.match(researchCommand, /research-phase-runtime-contract\.md/);
  assert.match(researchCommand, /single-agent fallback/i);
  assert.match(researchRuntimeContract, /strict mode[\s\S]*repair invalid results/i);
  assert.match(
    mcpToolsDoc,
    /Treat returned `path`, `written`, `created`, `overwritten`, and `status` fields as authoritative/i
  );
  assert.match(researchRuntimeContract, /browser-only, web-search-only, shell-only, or\s+generic agents/i);
  assert.match(researchDoc, /## Research Runtime Anchors/);
  assert.match(researchDoc, /artifactId: "phase\.research"/);
  assert.match(researchDoc, /deliberate placeholder/i);
  assert.match(researchDoc, /research-phase-runtime-contract\.md/);
  assert.match(researchRuntimeContract, /validation repair before completion/i);

  assert.match(uiCommand, /resolved numeric `phase`, `artifact: "ui-spec"`/i);
  assert.match(uiCommand, /mcp_blueprint_blueprint_artifact_contract_read/i);
  assert.match(uiCommand, /`blueprint-checker`/i);
  assert.match(uiCommand, /artifactId: "phase\.ui-spec"/i);
  assert.match(uiCommand, /authoringTemplate/i);
  assert.match(uiCommand, /ui-phase-runtime-contract\.md/i);
  assert.match(uiCommand, /artifact: "context"/i);
  assert.match(uiCommand, /artifact: "research"/i);
  assert.match(uiCommand, /no-subagent fallback/i);
  assert.match(uiCommand, /browser-only, web-search-only, shell-only, or generic agents/i);
  assert.match(uiCommand, /Do not create a second UI-skip artifact/i);
  assert.match(uiDoc, /## UI Persistence Contract/);
  assert.match(uiDoc, /canonical `phase\.ui-spec` contract/i);
  assert.match(uiDoc, /bounded checker review loop/i);
  assert.match(uiDoc, /single durable output/i);
  assert.match(uiDoc, /## UI Quality Contract/);
  assert.match(uiDoc, /saved context or research/i);
  assert.match(uiDoc, /six dimensions/i);
  assert.match(uiDoc, /retry through MCP once/i);

  assert.match(discoverySkill, /structured discuss checkpoint shape/i);
  assert.match(discoverySkill, /discuss-phase-runtime-contract\.md/i);
  assert.match(discoverySkill, /single-agent fallback/i);
  assert.match(
    discoverySkill,
    /`completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`/i
  );
  assert.match(discoverySkill, /`resumeMeta` carries the resumability fields/i);
  assert.match(discoverySkill, /The tool owns the final artifact `path`; use the returned `path` as authoritative/i);
  assert.match(discoverySkill, /Canonical Research Contract/);
  assert.match(discoverySkill, /research-phase-runtime-contract\.md/);
  assert.match(discoverySkill, /single-agent fallback/i);
  assert.match(discoverySkill, /repair the same normalized draft/i);
  assert.match(discoverySkill, /artifactId: "phase\.research"/);
  assert.match(discoverySkill, /artifactId: "phase\.ui-spec"/);
  assert.match(discoverySkill, /ui-phase-runtime-contract\.md/i);
  assert.match(discoverySkill, /six-dimension UI quality review/i);
  assert.match(discoverySkill, /no-subagent fallback/i);
  assert.match(discoverySkill, /blueprint-checker/i);
});

test("execution and validation contracts stay explicit across manifests, docs, skills, and agent guidance", async () => {
  const [
    executeCommand,
    executeDoc,
    executionSkill,
    executeRuntimeContract,
    executorAgent,
    validateCommand,
    validateDoc,
    verifyCommand,
    verifyDoc,
    addTestsCommand,
    addTestsDoc,
    validationSkill
  ] = await Promise.all([
    readRepoFile("commands/blu-execute-phase.toml"),
    readRepoFile("docs/commands/execute-phase.md"),
    readRepoFile("skills/blueprint-phase-execution/SKILL.md"),
    readRepoFile("skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md"),
    readRepoFile("agents/blueprint-executor.md"),
    readRepoFile("commands/blu-validate-phase.toml"),
    readRepoFile("docs/commands/validate-phase.md"),
    readRepoFile("commands/blu-verify-work.toml"),
    readRepoFile("docs/commands/verify-work.md"),
    readRepoFile("commands/blu-add-tests.toml"),
    readRepoFile("docs/commands/add-tests.md"),
    readRepoFile("skills/blueprint-phase-validation/SKILL.md")
  ]);

  assert.match(executeCommand, /numeric `planId` for the matching saved plan/i);
  assert.match(executeCommand, /returned `path` and `linkedPlanPath` as authoritative/i);
  assert.match(executeCommand, /pre-persistence gates/i);
  assert.match(executeCommand, /post-execution checks/i);
  assert.match(executeCommand, /phase-level completion claim/i);
  assert.match(executeDoc, /## Summary Persistence Contract/);
  assert.match(executeDoc, /Do not pass summary filenames, phase slugs, phase directories/i);
  assert.match(executeDoc, /Pre-persistence gates/i);
  assert.match(executeDoc, /Verifier handoff/i);
  assert.match(executionSkill, /references\/execute-phase-runtime-contract\.md/);
  assert.match(executeRuntimeContract, /matching plan must already exist/i);
  assert.match(executeRuntimeContract, /pre-persistence gates/i);
  assert.match(executeRuntimeContract, /post-execution checks/i);
  assert.match(executeRuntimeContract, /phase-level completion claim/i);
  assert.match(
    executorAgent,
    /resolved numeric phase,\s+the numeric\s+`planId` for the matching saved plan/i
  );
  assert.match(executorAgent, /## Progress Checkpoint Contract/);
  assert.match(
    executorAgent,
    /resolved scope,\s+active stage,\s+pending gate,\s+execution mode,\s+and next safe action/i
  );
  assert.match(executorAgent, /when scope is resolved/i);
  assert.match(executorAgent, /after each assigned plan or major task group/i);
  assert.match(executorAgent, /when a blocker or deviation appears/i);
  assert.match(executorAgent, /after verification finishes/i);
  assert.match(executorAgent, /user-facing orchestration and coordination/i);
  assert.match(executorAgent, /`update_topic`,[\s\S]*`write_todos`, and `ask_user`/i);
  assert.match(
    executorAgent,
    /bounded repo-local inspection,[\s\S]*verification,[\s\S]*build\/test support/i
  );
  assert.match(
    executorAgent,
    /Shell must not own Blueprint persistence,[\s\S]*MCP writes,[\s\S]*approvals,[\s\S]*routing,[\s\S]*phase-level orchestration/i
  );

  assert.match(validateCommand, /returned `path` plus `summaryPaths` are authoritative/i);
  assert.match(validateCommand, /artifactId: "phase\.verification"/);
  assert.match(validateCommand, /Execution profile: `long-running-mutation`/);
  assert.match(validateCommand, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(validateCommand, /current pending gate, and the next safe implemented action/i);
  assert.match(validateDoc, /## Validation Persistence Contract/);
  assert.match(validateDoc, /## Shared Runtime Contract/);
  assert.match(validateDoc, /## In-Flight Progress Contract/);
  assert.match(validateDoc, /saved-summary-first contract explicit/i);
  assert.match(validateDoc, /required-tool derivation through `blueprint_artifact_contract_read`/i);
  assert.match(validateDoc, /`uat` writes are a separate flow and additionally require an existing `XX-VERIFICATION\.md` artifact/i);

  assert.match(verifyCommand, /existing verification artifact are required/i);
  assert.match(verifyCommand, /artifactId: "phase\.uat"/);
  assert.match(verifyCommand, /Execution profile: `long-running-mutation`/);
  assert.match(verifyCommand, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(verifyCommand, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(verifyCommand, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(verifyCommand, /`review`, `skip`, or `stop`/i);
  assert.match(verifyCommand, /phase_validation_read` as the typed truth/i);
  assert.match(verifyCommand, /\.blueprint\/ROADMAP\.md/);
  assert.match(verifyDoc, /## UAT Persistence Contract/);
  assert.match(verifyDoc, /## Shared Runtime Contract/);
  assert.match(verifyDoc, /## In-Flight Progress Contract/);
  assert.match(verifyDoc, /shared long-running-mutation posture/i);
  assert.match(verifyDoc, /required-tool derivation through `blueprint_artifact_contract_read`/i);
  assert.match(verifyDoc, /returned `path` plus `summaryPaths` as authoritative/i);
  assert.match(verifyDoc, /focused structured decision[\s\S]*`view`[\s\S]*`resume`[\s\S]*`update`/i);
  assert.match(verifyDoc, /checkpoint decisions[\s\S]*`review`, `skip`, or `stop`/i);
  assert.match(verifyDoc, /next safe action stays on `\/blu-verify-work <phase>`/i);
  assert.match(verifyDoc, /separate `ask_user` confirmation path/i);

  assert.match(addTestsCommand, /Execution profile: `long-running-mutation`/);
  assert.match(addTestsCommand, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(addTestsCommand, /targeted test command or result/i);
  assert.match(addTestsCommand, /current verification status/i);
  assert.match(addTestsCommand, /report status/i);
  assert.match(addTestsCommand, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(addTestsCommand, /Prefer Gemini CLI's built-in `ask_user` tool/i);
  assert.match(addTestsCommand, /bare report name `add-tests-<phase>`/i);
  assert.match(addTestsCommand, /returned `path` plus `summaryPaths`, `written`, and `status` as authoritative/i);
  assert.match(addTestsCommand, /tool-owned result/i);
  assert.match(addTestsCommand, /returned `path`, `written`, and `status` as authoritative/i);
  assert.match(addTestsDoc, /## Validation And Report Contract/);
  assert.match(addTestsDoc, /## Shared Runtime Contract/);
  assert.match(addTestsDoc, /## In-Flight Progress Contract/);
  assert.match(addTestsDoc, /targeted test results, verification status, report status, and the next safe action explicit while add-tests is in flight/i);
  assert.match(addTestsDoc, /bare report name `add-tests-<phase>`/i);
  assert.match(addTestsDoc, /returned `path` plus `summaryPaths`, `written`, and `status` as authoritative/i);
  assert.match(addTestsDoc, /returned report `path`, `written`, and `status` as authoritative/i);
  assert.match(addTestsDoc, /Reports verification and report persistence outcomes from MCP return values/i);
  assert.match(validationSkill, /artifact enum `verification` or `uat`/i);
  assert.match(validationSkill, /Canonical Validation Contracts/);
  assert.match(validationSkill, /Execution profile for `validate-phase`, `verify-work`, and the long-running parts of `add-tests`: `long-running-mutation`/);
  assert.match(
    validationSkill,
    /keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/i
  );
  assert.match(validationSkill, /selected test scope, targeted test command or result, verification status, report status/i);
  assert.match(validationSkill, /verification status/i);
  assert.match(validationSkill, /reported report status aligned with the tool-owned `written` and `status` result/i);
  assert.match(validationSkill, /update_topic plus `write_todos`/i);
  assert.match(validationSkill, /ask_user/);
  assert.match(validationSkill, /review`, `skip`, or `stop`/i);
  assert.match(validationSkill, /artifactId: "phase\.verification"/);
  assert.match(validationSkill, /artifactId: "phase\.uat"/);
});

test("review contracts stay explicit across code-review, remediation, and reviewer surfaces", async () => {
  const [
    codeReviewCommand,
    codeReviewDoc,
    codeReviewFixCommand,
    codeReviewFixDoc,
    auditFixCommand,
    auditFixDoc,
    auditFixContract,
    reviewCommand,
    reviewDoc,
    reviewSkill,
    reviewerAgent
  ] = await Promise.all([
    readRepoFile("commands/blu-code-review.toml"),
    readRepoFile("docs/commands/code-review.md"),
    readRepoFile("commands/blu-code-review-fix.toml"),
    readRepoFile("docs/commands/code-review-fix.md"),
    readRepoFile("commands/blu-audit-fix.toml"),
    readRepoFile("docs/commands/audit-fix.md"),
    readRepoFile("skills/blueprint-review/references/audit-fix-runtime-contract.md"),
    readRepoFile("commands/blu-review.toml"),
    readRepoFile("docs/commands/review.md"),
    readRepoFile("skills/blueprint-review/SKILL.md"),
    readRepoFile("agents/blueprint-reviewer.md")
  ]);

  assert.match(codeReviewCommand, /`files` must be repo-relative file paths only/i);
  assert.match(codeReviewCommand, /do not pass directories, wildcards, `?\.blueprint\/\*\*`?, or absolute filesystem paths/i);
  assert.match(codeReviewCommand, /mcp_blueprint_blueprint_artifact_contract_read/i);
  assert.match(codeReviewCommand, /review\.code-review/i);
  assert.match(codeReviewCommand, /Execution profile: `long-running-mutation`/);
  assert.match(codeReviewCommand, /runtime contract's shared review posture/i);
  assert.match(codeReviewCommand, /`update_topic` tool to keep the active stage visible and `write_todos`/i);
  assert.match(codeReviewCommand, /returned repo file list as the deterministic review scope/i);
  assert.match(codeReviewDoc, /## Review Scope Contract/);
  assert.match(codeReviewDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(codeReviewDoc, /## Shared Runtime Contract/);
  assert.match(codeReviewDoc, /## In-Flight Progress Contract/);
  assert.match(codeReviewDoc, /shared review posture from the runtime contract/i);
  assert.match(codeReviewDoc, /Directories, wildcards, `?\.blueprint\/\*\*`?, and absolute paths are invalid/i);

  assert.match(codeReviewFixCommand, /authoritative remediation baseline/i);
  assert.match(codeReviewFixCommand, /mcp_blueprint_blueprint_review_authoring_context/i);
  assert.match(codeReviewFixCommand, /mcp_blueprint_blueprint_review_validate_model/i);
  assert.match(codeReviewFixCommand, /ask_user/i);
  assert.match(codeReviewFixCommand, /bounded automatic finding selection only/i);
  assert.match(codeReviewFixCommand, /returned `reportPath` as authoritative/i);
  assert.match(codeReviewFixDoc, /## Remediation Contract/);
  assert.match(codeReviewFixDoc, /`blueprint_review_authoring_context`/i);
  assert.match(codeReviewFixDoc, /`blueprint_review_validate_model`/i);
  assert.match(codeReviewFixDoc, /## In-Flight Progress Contract/);
  assert.match(codeReviewFixDoc, /Do not recreate finding ids or severity/i);

  assert.match(auditFixCommand, /bare canonical report name `audit-fix-<phase>`/i);
  assert.match(auditFixCommand, /auditFixContext \{source, severity, maxAttempts, dryRun, scopeFiles\}/i);
  assert.match(auditFixCommand, /returned `createdEntryIds` as authoritative/i);
  assert.match(auditFixCommand, /audit-fix-runtime-contract\.md/i);
  assert.match(auditFixCommand, /classification \(`auto-fixable`, `manual-only`, or `skip`\)/i);
  assert.match(auditFixDoc, /## Remediation Scope And Report Contract/);
  assert.match(auditFixDoc, /returned `createdEntryIds` as authoritative/i);
  assert.match(auditFixDoc, /classification table before mutation/i);
  assert.match(
    auditFixDoc,
    /repair the structured model against the canonical `report\.audit-fix` contract, the narrowed `taskSchema`, and returned diagnostics/i
  );
  assert.match(auditFixContract, /## No-Subagent Fallback/i);
  assert.match(auditFixContract, /Use `blueprint-reviewer` only as a bounded read-only classification helper/i);
  assert.match(auditFixContract, /Use `blueprint-verifier` only after a fix or dry-run plan/i);
  assert.match(auditFixContract, /No browser\/web\/search-only or generic agent was used as a substitute/i);
  assert.match(auditFixContract, /`blueprint-fixer` remained planned-only and non-routable/i);

  assert.match(reviewCommand, /artifact: "peer-review"/i);
  assert.match(reviewCommand, /returned `reportPath` as authoritative/i);
  assert.match(reviewDoc, /## Peer-Review Persistence Contract/);
  assert.match(reviewSkill, /`blueprint_artifact_contract_read`: read the canonical review and report contracts before drafting, updating, or validating review artifacts/i);
  assert.match(reviewSkill, /Read the canonical review contract through `blueprint_artifact_contract_read` before drafting the model that will render to `XX-REVIEW\.md`/i);
  assert.match(reviewSkill, /Validate through `blueprint_review_validate_model`/i);
  assert.match(reviewSkill, /Execution profile for `code-review`: `long-running-mutation`/i);
  assert.match(
    reviewSkill,
    /Each command-local runtime contract owns the detailed stage vocabulary, in-flight status fields, and waiting-state semantics/i
  );
  assert.match(reviewSkill, /update_topic plus `write_todos`/i);
  assert.match(reviewSkill, /Read the review-fix authoring context through\s+`blueprint_review_authoring_context` before drafting `XX-REVIEW-FIX\.md`/i);
  assert.match(reviewSkill, /read `blueprint_review_authoring_context` with `artifact: "peer-review"`\s+before drafting `XX-REVIEWS\.md`/i);
  assert.match(reviewSkill, /Directories, wildcards, absolute paths, and `?\.blueprint\/\*\*`? paths are invalid or skipped/i);
  assert.match(reviewSkill, /returned `findings` and `severityCounts` as the authoritative fix baseline/i);
  assert.match(reviewerAgent, /returned `blueprint_review_scope\.files` list as authoritative/i);
});

test("governance and bootstrap contracts stay explicit across config, pause, and bootstrap surfaces", async () => {
  const [
    settingsCommand,
    settingsReference,
    setProfileCommand,
    setProfileReference,
    pauseCommand,
    pauseReference,
    newProjectCommand,
    newProjectRuntimeContract,
    governanceSkill,
    bootstrapSkill,
    bootstrapContract,
    bootstrapGuardrails
  ] = await Promise.all([
    readRepoFile("commands/blu-settings.toml"),
    readRepoFile("skills/blueprint-governance/references/settings-runtime-contract.md"),
    readRepoFile("commands/blu-set-profile.toml"),
    readRepoFile("skills/blueprint-governance/references/set-profile-runtime-contract.md"),
    readRepoFile("commands/blu-pause-work.toml"),
    readRepoFile("skills/blueprint-governance/references/pause-work-runtime-contract.md"),
    readRepoFile("commands/blu-new-project.toml"),
    buildBlueprintCommandRuntimeContractResource("new-project"),
    readRepoFile("skills/blueprint-governance/SKILL.md"),
    readRepoFile("skills/blueprint-bootstrap/SKILL.md"),
    readRepoFile("skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md"),
    readRepoFile("skills/blueprint-bootstrap/references/runtime-guardrails.md")
  ]);

  assert.match(settingsCommand, /Pass a JSON-object `patch` only/i);
  assert.match(settingsCommand, /returned `configPath` as authoritative/i);
  assert.match(settingsReference, /## Write Boundaries/);
  assert.match(settingsReference, /Project settings writes go only through `mcp_blueprint_blueprint_config_set` with `scope: "project"`/i);

  assert.match(setProfileCommand, /Use this dedicated tool for `model_profile` changes/i);
  assert.match(setProfileReference, /## Write Boundaries/);
  assert.match(setProfileReference, /The only allowed write is `mcp_blueprint_blueprint_config_set_profile`/i);

  assert.match(pauseCommand, /`currentState` is required/i);
  assert.match(pauseCommand, /Omit `nextAction` when the safest resume action should be derived/i);
  assert.match(pauseReference, /## Write Boundaries/);
  assert.match(pauseReference, /Replacing an existing active handoff requires explicit overwrite confirmation/i);
  assert.match(governanceSkill, /`blueprint_pause_handoff_write`: `currentState` is required/i);

  assert.match(newProjectCommand, /thin command envelope/i);
  assert.match(newProjectCommand, /references\/bootstrap-runtime-contract\.md/);
  assert.match(newProjectCommand, /references\/runtime-guardrails\.md/);
  assert.match(newProjectCommand, /Do not require `docs\/commands\/new-project\.md`/i);
  assert.equal(newProjectRuntimeContract.catalog.specPath, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(newProjectRuntimeContract.spec?.path, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(newProjectRuntimeContract.spec?.executionProfile, "long-running-mutation");
  assert.deepEqual(newProjectRuntimeContract.skillInputs.shared, []);
  assert.deepEqual(newProjectRuntimeContract.skillInputs.commandSpecific, [
    "skills/blueprint-bootstrap/references/questioning.md",
    "skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md",
    "skills/blueprint-bootstrap/references/runtime-guardrails.md"
  ]);
  assert.deepEqual(newProjectRuntimeContract.skillInputs.effective, [
    "skills/blueprint-bootstrap/references/questioning.md",
    "skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md",
    "skills/blueprint-bootstrap/references/runtime-guardrails.md"
  ]);
  assert.equal(
    newProjectRuntimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    newProjectRuntimeContract.runtimeReference?.contractNotes ?? "",
    /map-first for brownfield repos/i
  );
  assert.match(bootstrapSkill, /first persistent bootstrap write/i);
  assert.match(bootstrapContract, /`bootstrapSeed`/);
  assert.match(bootstrapContract, /returned `createdPaths`, `configPath`, and `nextAction` as authoritative/i);
  assert.match(bootstrapContract, /`overwrite: true`/i);
  assert.match(bootstrapContract, /supported repo-relative Blueprint artifact paths/i);
  assert.match(bootstrapContract, /JSON-object `patch`/i);
  assert.match(bootstrapContract, /written bootstrap artifacts/i);
  assert.match(bootstrapGuardrails, /host CLI slash command, not a shell executable/i);
});

test("report-backed and digest-backed commands stay explicit about repo-relative inputs and tool-owned paths", async () => {
  const [
    debugCommand,
    debugDoc,
    quickCommand,
    quickDoc,
    docsUpdateCommand,
    docsUpdateReference,
    prBranchCommand,
    prBranchDoc,
    shipCommand,
    shipDoc,
    cleanupCommand,
    cleanupDoc,
    mapCodebaseCommand,
    mapCodebaseReference,
    mapSkill,
    healthCommand,
    healthReference
  ] = await Promise.all([
    readRepoFile("commands/blu-debug.toml"),
    readRepoFile("docs/commands/debug.md"),
    readRepoFile("commands/blu-quick.toml"),
    readRepoFile("docs/commands/quick.md"),
    readRepoFile("commands/blu-docs-update.toml"),
    readRepoFile("skills/blueprint-docs/references/docs-update-runtime-contract.md"),
    readRepoFile("commands/blu-pr-branch.toml"),
    readRepoFile("docs/commands/pr-branch.md"),
    readRepoFile("commands/blu-ship.toml"),
    readRepoFile("docs/commands/ship.md"),
    readRepoFile("commands/blu-cleanup.toml"),
    readRepoFile("docs/commands/cleanup.md"),
    readRepoFile("commands/blu-map-codebase.toml"),
    readRepoFile("skills/blueprint-map/references/map-runtime-contract.md"),
    readRepoFile("skills/blueprint-map/SKILL.md"),
    readRepoFile("commands/blu-health.toml"),
    readRepoFile("skills/blueprint-governance/references/health-runtime-contract.md")
  ]);

  assert.match(
    debugCommand,
    /Execution profile: start in `interactive-read`[\s\S]*escalate to `long-running-mutation` only when the investigation becomes non-trivial/i
  );
  assert.match(debugCommand, /resolved scope, active stage, pending gate, execution mode, and next safe implemented action/i);
  assert.match(debugCommand, /`update_topic` tool to keep the active stage visible and `write_todos`/i);
  assert.match(debugCommand, /session-local visibility tools only/i);
  assert.match(
    debugCommand,
    /report-only,[\s\S]*capture a todo only after an explicit user ask or confirmation,[\s\S]*\/blu-quick[\s\S]*\/blu-plan-phase[\s\S]*\/blu-validate-phase[\s\S]*\/blu-progress/i
  );
  assert.match(debugCommand, /bare canonical report name `debug-latest`/i);
  assert.match(debugCommand, /returned `createdEntryIds` as authoritative/i);
  assert.match(debugCommand, /must not silently create a todo/i);
  assert.match(debugDoc, /## Shared Runtime Contract/);
  assert.match(debugDoc, /## Report And Todo Contract/);
  assert.match(debugDoc, /## In-Flight Progress Contract/);
  assert.match(debugDoc, /## Diagnose-Only And Follow-Up Gates/);
  assert.match(debugDoc, /Use `update_topic` to surface the active stage and `write_todos`/i);
  assert.match(debugDoc, /session-local visibility only and do not replace Blueprint MCP persistence or explicit todo capture/i);
  assert.match(
    debugDoc,
    /report-only,[\s\S]*capture a todo only after an explicit user ask or confirmation,[\s\S]*\/blu-quick[\s\S]*\/blu-plan-phase[\s\S]*\/blu-validate-phase[\s\S]*\/blu-progress/i
  );

  assert.match(quickCommand, /Execution profile: `long-running-mutation`/i);
  assert.match(quickCommand, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/i);
  assert.match(quickCommand, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(quickCommand, /`update_topic` tool to keep the active stage visible and `write_todos`/i);
  assert.match(quickCommand, /tracker-eligible/i);
  assert.match(quickCommand, /do not let it impersonate a saved phase plan or broad lifecycle execution/i);
  assert.match(quickCommand, /bare canonical report name `quick-run-latest`/i);
  assert.match(quickDoc, /## Shared Runtime Contract/);
  assert.match(quickDoc, /## Quick Report Contract/);
  assert.match(quickDoc, /## In-Flight Progress Contract/);
  assert.match(quickDoc, /## Tracker Eligibility/);
  assert.match(quickDoc, /shared long-running-mutation posture/i);
  assert.match(quickDoc, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(quickDoc, /Use `update_topic` to surface the active stage and `write_todos`/i);
  assert.match(quickDoc, /When `update_topic` or `write_todos` are unavailable, preserve the same progress in prose/i);
  assert.match(quickDoc, /tracker-eligible/i);
  assert.match(quickDoc, /does not replace Blueprint MCP persistence/i);
  assert.match(quickDoc, /must not create a hidden saved plan, summary artifact, or lifecycle claim/i);
  assert.match(quickDoc, /When tracker support is unavailable, keep the same bounded quick flow linear/i);
  assert.match(quickDoc, /returned report `path`, `written`, and `status` as authoritative/i);

  assert.match(docsUpdateCommand, /explicit repo-relative `artifactPaths`, `docFiles`, `sourceFiles`, or `testFiles`/i);
  assert.match(docsUpdateCommand, /returned `inputsUsed` list as the authoritative digest scope/i);
  assert.match(docsUpdateCommand, /bare report name `docs-update-latest`/i);
  assert.match(docsUpdateReference, /## Evidence Truth/);
  assert.match(docsUpdateReference, /## Persistence Boundaries/);

  assert.match(prBranchCommand, /repo-relative `artifactPaths` and, when useful, repo-relative `trackedFiles`/i);
  assert.match(prBranchCommand, /returned `inputsUsed` list as the authoritative digest scope/i);
  assert.match(prBranchCommand, /mcp_blueprint_blueprint_artifact_contract_read/i);
  assert.match(prBranchCommand, /contract\.authoringTemplate/i);
  assert.match(prBranchCommand, /commit classification ledger/i);
  assert.match(prBranchCommand, /bare report name `pr-branch-latest`/i);
  assert.match(prBranchDoc, /## Digest And Report Contract/);
  assert.match(prBranchDoc, /## Commit Classification And Replay Contract/);

  assert.match(shipCommand, /repo-relative tracked-file inputs/i);
  assert.match(shipCommand, /returned `inputsUsed` list as the authoritative digest scope/i);
  assert.match(shipCommand, /mcp_blueprint_blueprint_artifact_contract_read/i);
  assert.match(shipCommand, /contract\.authoringTemplate/i);
  assert.match(shipCommand, /bare report name `ship-latest`/i);
  assert.match(shipDoc, /## Digest And Report Contract/);
  assert.match(shipDoc, /contract\.authoringTemplate/i);

  assert.match(cleanupCommand, /explicit repo-relative `artifactPaths`/i);
  assert.match(cleanupCommand, /returned `inputsUsed` list as the authoritative digest scope/i);
  assert.match(cleanupCommand, /bare report name `cleanup-latest`/i);
  assert.match(cleanupDoc, /## Digest And Report Contract/);

  assert.match(mapCodebaseCommand, /ask_user/i);
  assert.match(mapCodebaseCommand, /blueprint_artifact_contract_read/i);
  assert.match(mapCodebaseCommand, /blueprint_codebase_artifact_write/i);
  assert.match(mapCodebaseCommand, /blueprint_artifact_validate/i);
  assert.match(mapCodebaseCommand, /explicit repo-relative evidence inputs/i);
  assert.match(mapCodebaseCommand, /returned `inputsUsed` list as the authoritative digest scope/i);
  assert.match(mapCodebaseCommand, /skills\/blueprint-map\/references\/map-runtime-contract\.md/);
  assert.match(mapCodebaseCommand, /contract\.authoringTemplate/);
  assert.match(mapCodebaseCommand, /evidence-density/i);
  assert.match(mapCodebaseCommand, /one-document-at-a-time main-agent fallback/i);
  assert.match(mapCodebaseCommand, /status: "invalid"/);
  assert.match(mapCodebaseReference, /blueprint_artifact_contract_read/i);
  assert.match(mapCodebaseReference, /blueprint_codebase_artifact_write/i);
  assert.match(mapCodebaseReference, /blueprint_artifact_validate/i);
  assert.match(mapCodebaseReference, /reused by default/i);
  assert.match(mapCodebaseReference, /richness and evidence authority/i);
  assert.match(mapCodebaseReference, /path-backed analysis/i);
  assert.match(mapCodebaseReference, /one artifact at a time/i);
  assert.match(mapCodebaseReference, /status: "invalid"/);
  assert.match(mapSkill, /ask_user/i);
  assert.match(mapSkill, /blueprint_artifact_contract_read/i);
  assert.match(mapSkill, /blueprint_codebase_artifact_write/i);
  assert.match(mapSkill, /blueprint_artifact_validate/i);
  assert.match(mapSkill, /reuse-by-default behavior/i);
  assert.match(mapSkill, /returned `inputsUsed` list as the authoritative digest scope/i);
  assert.match(mapSkill, /references\/map-runtime-contract\.md/);
  assert.match(mapSkill, /rich canonical authoring/i);
  assert.match(mapSkill, /evidence-density/i);
  assert.match(mapSkill, /status: "invalid"/);

  assert.match(healthCommand, /Pass a JSON-object `patch` only/i);
  assert.match(healthCommand, /returned `configPath` as authoritative/i);
  assert.match(healthReference, /## Confirmation Gates/);
  assert.match(healthReference, /## Write Boundaries/);
});
