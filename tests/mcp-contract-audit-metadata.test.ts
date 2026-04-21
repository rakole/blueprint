import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
    /Review-family commands must use `blueprint_artifact_contract_read` to fetch the canonical review artifact contract/i
  );
  assert.match(mcpToolsDoc, /`blueprint_phase_summary_write` requires numeric `phase`, numeric `planId`, and full summary `content`/i);
  assert.match(mcpToolsDoc, /`blueprint_review_scope` accepts repo-relative file paths only/i);
  assert.match(mcpToolsDoc, /`blueprint_config_set` defaults `scope` to `project`, and `patch` must be a JSON object/i);
  assert.match(mcpToolsDoc, /`blueprint_project_init` is the first persistent bootstrap write/i);
  assert.match(mcpToolsDoc, /`blueprint_pause_handoff_write` requires `currentState`/i);
  assert.match(mcpToolsDoc, /`blueprint_artifact_report_write` accepts a bare `reportName`/i);
  assert.match(
    mcpToolsDoc,
    /`validate-phase` and `verify-work` use summary index\/read, validation read\/write, `blueprint_artifact_contract_read`, config, artifact validation, and state update tools/i
  );
  assert.match(
    mcpToolsDoc,
    /`secure-phase` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, `blueprint_artifact_contract_read`, and `blueprint_review_record`/i
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
    uiCommand,
    uiDoc,
    discoverySkill
  ] = await Promise.all([
    readRepoFile("commands/blu-discuss-phase.toml"),
    readRepoFile("docs/commands/discuss-phase.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("docs/GSD-RUNTIME-MIGRATION.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("commands/blu-research-phase.toml"),
    readRepoFile("docs/commands/research-phase.md"),
    readRepoFile("commands/blu-ui-phase.toml"),
    readRepoFile("docs/commands/ui-phase.md"),
    readRepoFile("skills/blueprint-phase-discovery/SKILL.md")
  ]);

  assert.match(discussCommand, /repo-relative Blueprint artifact paths such as `?\.blueprint\/phases\//i);
  assert.match(discussCommand, /structured discuss checkpoint shape/i);
  assert.match(
    discussCommand,
    /`completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`/i
  );
  assert.match(discussCommand, /`resumeMeta` must carry the resumability details/i);
  assert.match(discussCommand, /returned `path` as the authoritative saved filename/i);
  assert.match(discussCommand, /normalize the final context and discussion drafts to the returned `authoringTemplate`/i);
  assert.match(discussCommand, /self-check the normalized body against the contract/i);
  assert.match(discussCommand, /prior-context sweep/i);
  assert.match(discussCommand, /codebase scout/i);
  assert.match(discussCommand, /stronger assumptions-mode analysis/i);
  assert.match(discussCommand, /checkpoint-per-area/i);
  assert.match(discussCommand, /end-of-run `STATE\.md` update/i);
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
  assert.match(
    discussDoc,
    /blueprint_phase_context[\s\S]*projectBrief[\s\S]*requirementsGrounding[\s\S]*workflowPosture[\s\S]*codebase[\s\S]*requirements[\s\S]*missingArtifacts[\s\S]*warnings/i
  );
  assert.match(discussDoc, /prior-context sweeps/i);
  assert.match(discussDoc, /dedicated todo\/backlog file crawl/i);
  assert.match(discussDoc, /codebase scout summaries/i);
  assert.match(discussDoc, /stronger assumptions-mode analysis/i);
  assert.match(discussDoc, /progress recaps/i);
  assert.match(discussDoc, /checkpoint-per-area/i);
  assert.match(discussDoc, /end-of-run `STATE\.md` update/i);
  assert.match(artifactSchema, /full discuss-phase context contract sections/i);
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
  assert.match(discussRuntimeReference, /stronger assumptions-mode analysis/i);
  assert.match(discussRuntimeReference, /progress recaps/i);
  assert.match(discussRuntimeReference, /checkpoint-per-area/i);
  assert.match(discussRuntimeReference, /end-of-run `STATE\.md` updates/i);
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
  assert.match(
    mcpToolsDoc,
    /`discuss-phase` uses phase location\/context, `blueprint_phase_plan_index`, `blueprint_artifact_contract_read`/i
  );

  assert.match(researchCommand, /default strict mode/i);
  assert.match(researchCommand, /returned `path` as authoritative/i);
  assert.match(researchCommand, /artifactId: "phase\.research"/);
  assert.match(researchCommand, /authoringTemplate/);
  assert.match(researchDoc, /## Research Persistence Contract/);
  assert.match(researchDoc, /artifactId: "phase\.research"/);
  assert.match(researchDoc, /Bare names such as `RESEARCH` and absolute paths are invalid/i);

  assert.match(uiCommand, /resolved numeric `phase`, `artifact: "ui-spec"`/i);
  assert.match(uiCommand, /mcp_blueprint_blueprint_artifact_contract_read/i);
  assert.match(uiCommand, /`blueprint-checker`/i);
  assert.match(uiCommand, /artifactId: "phase\.ui-spec"/i);
  assert.match(uiCommand, /authoringTemplate/i);
  assert.match(uiCommand, /Do not create a second UI-skip artifact/i);
  assert.match(uiDoc, /## UI Persistence Contract/);
  assert.match(uiDoc, /canonical `phase\.ui-spec` contract/i);
  assert.match(uiDoc, /bounded checker review loop/i);
  assert.match(uiDoc, /single durable output/i);

  assert.match(discoverySkill, /structured discuss checkpoint shape/i);
  assert.match(
    discoverySkill,
    /`completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`/i
  );
  assert.match(discoverySkill, /`resumeMeta` carries the resumability fields/i);
  assert.match(discoverySkill, /The tool owns the final artifact `path`; use the returned `path` as authoritative/i);
  assert.match(discoverySkill, /Canonical Research Contract/);
  assert.match(discoverySkill, /artifactId: "phase\.research"/);
  assert.match(discoverySkill, /artifactId: "phase\.ui-spec"/);
  assert.match(discoverySkill, /blueprint-checker/i);
});

test("execution and validation contracts stay explicit across manifests, docs, skills, and agent guidance", async () => {
  const [
    executeCommand,
    executeDoc,
    executionSkill,
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
  assert.match(executeDoc, /## Summary Persistence Contract/);
  assert.match(executeDoc, /Do not pass summary filenames, phase slugs, phase directories/i);
  assert.match(executionSkill, /matching plan must already exist/i);
  assert.match(
    executorAgent,
    /resolved numeric phase,\s+the numeric\s+`planId` for the matching saved plan/i
  );

  assert.match(validateCommand, /returned `path` plus `summaryPaths` are authoritative/i);
  assert.match(validateCommand, /artifactId: "phase\.verification"/);
  assert.match(validateDoc, /## Validation Persistence Contract/);
  assert.match(validateDoc, /required-tool derivation through `blueprint_artifact_contract_read`/i);
  assert.match(validateDoc, /`uat` writes are a separate flow and additionally require an existing `XX-VERIFICATION\.md` artifact/i);

  assert.match(verifyCommand, /existing verification artifact are required/i);
  assert.match(verifyCommand, /artifactId: "phase\.uat"/);
  assert.match(verifyDoc, /## UAT Persistence Contract/);
  assert.match(verifyDoc, /required-tool derivation through `blueprint_artifact_contract_read`/i);
  assert.match(verifyDoc, /returned `path` plus `summaryPaths` as authoritative/i);
  assert.match(verifyDoc, /focused structured decision[\s\S]*`view`[\s\S]*`resume`[\s\S]*`update`/i);
  assert.match(verifyDoc, /separate `ask_user` confirmation path/i);

  assert.match(addTestsCommand, /bare report name `add-tests-<phase>`/i);
  assert.match(addTestsCommand, /returned `path` plus `summaryPaths` as authoritative/i);
  assert.match(addTestsDoc, /## Validation And Report Contract/);
  assert.match(addTestsDoc, /bare report name `add-tests-<phase>`/i);
  assert.match(validationSkill, /artifact enum `verification` or `uat`/i);
  assert.match(validationSkill, /Canonical Validation Contracts/);
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
    readRepoFile("commands/blu-review.toml"),
    readRepoFile("docs/commands/review.md"),
    readRepoFile("skills/blueprint-review/SKILL.md"),
    readRepoFile("agents/blueprint-reviewer.md")
  ]);

  assert.match(codeReviewCommand, /`files` must be repo-relative file paths only/i);
  assert.match(codeReviewCommand, /do not pass directories, wildcards, `?\.blueprint\/\*\*`?, or absolute filesystem paths/i);
  assert.match(codeReviewCommand, /mcp_blueprint_blueprint_artifact_contract_read/i);
  assert.match(codeReviewCommand, /review\.code-review/i);
  assert.match(codeReviewCommand, /returned repo file list as the deterministic review scope/i);
  assert.match(codeReviewDoc, /## Review Scope Contract/);
  assert.match(codeReviewDoc, /Directories, wildcards, `?\.blueprint\/\*\*`?, and absolute paths are invalid/i);

  assert.match(codeReviewFixCommand, /authoritative remediation baseline/i);
  assert.match(codeReviewFixCommand, /mcp_blueprint_blueprint_artifact_contract_read/i);
  assert.match(codeReviewFixCommand, /ask_user/i);
  assert.match(codeReviewFixCommand, /bounded automatic finding selection only/i);
  assert.match(codeReviewFixCommand, /returned `reportPath` as authoritative/i);
  assert.match(codeReviewFixDoc, /## Remediation Contract/);
  assert.match(codeReviewFixDoc, /`blueprint_artifact_contract_read`/i);
  assert.match(codeReviewFixDoc, /## In-Flight Progress Contract/);
  assert.match(codeReviewFixDoc, /Do not recreate finding ids or severity/i);

  assert.match(auditFixCommand, /bare canonical report name `audit-fix-<phase>`/i);
  assert.match(auditFixCommand, /returned `createdEntryIds` as authoritative/i);
  assert.match(auditFixDoc, /## Remediation Scope And Report Contract/);
  assert.match(auditFixDoc, /returned `createdEntryIds` as authoritative/i);

  assert.match(reviewCommand, /artifact: "peer-review"/i);
  assert.match(reviewCommand, /returned `reportPath` as authoritative/i);
  assert.match(reviewDoc, /## Peer-Review Persistence Contract/);
  assert.match(reviewSkill, /`blueprint_artifact_contract_read`: read the canonical review and report contracts before drafting, updating, or validating review artifacts/i);
  assert.match(reviewSkill, /Read the canonical review contract through `blueprint_artifact_contract_read` before drafting `XX-REVIEW\.md`/i);
  assert.match(reviewSkill, /Read the canonical review-fix contract through\s+`blueprint_artifact_contract_read` before drafting `XX-REVIEW-FIX\.md`/i);
  assert.match(reviewSkill, /Read the canonical review contract through `blueprint_artifact_contract_read` before drafting `XX-REVIEWS\.md`/i);
  assert.match(reviewSkill, /Directories, wildcards, absolute paths, and `?\.blueprint\/\*\*`? paths are invalid or skipped/i);
  assert.match(reviewSkill, /returned `findings` and `severityCounts` as the authoritative fix baseline/i);
  assert.match(reviewerAgent, /returned `blueprint_review_scope\.files` list as authoritative/i);
});

test("governance and bootstrap contracts stay explicit across config, pause, and bootstrap surfaces", async () => {
  const [
    settingsCommand,
    settingsDoc,
    setProfileCommand,
    setProfileDoc,
    pauseCommand,
    pauseDoc,
    newProjectCommand,
    newProjectDoc,
    governanceSkill,
    bootstrapSkill
  ] = await Promise.all([
    readRepoFile("commands/blu-settings.toml"),
    readRepoFile("docs/commands/settings.md"),
    readRepoFile("commands/blu-set-profile.toml"),
    readRepoFile("docs/commands/set-profile.md"),
    readRepoFile("commands/blu-pause-work.toml"),
    readRepoFile("docs/commands/pause-work.md"),
    readRepoFile("commands/blu-new-project.toml"),
    readRepoFile("docs/commands/new-project.md"),
    readRepoFile("skills/blueprint-governance/SKILL.md"),
    readRepoFile("skills/blueprint-bootstrap/SKILL.md")
  ]);

  assert.match(settingsCommand, /Pass a JSON-object `patch` only/i);
  assert.match(settingsCommand, /returned `configPath` as authoritative/i);
  assert.match(settingsDoc, /## Config Mutation Contract/);
  assert.match(settingsDoc, /defaults to `scope: "project"`/i);

  assert.match(setProfileCommand, /Use this dedicated tool for `model_profile` changes/i);
  assert.match(setProfileDoc, /## Profile Mutation Contract/);

  assert.match(pauseCommand, /`currentState` is required/i);
  assert.match(pauseCommand, /Omit `nextAction` when the safest resume action should be derived/i);
  assert.match(pauseDoc, /## Pause Handoff Contract/);
  assert.match(governanceSkill, /`blueprint_pause_handoff_write`: `currentState` is required/i);

  assert.match(newProjectCommand, /returned `createdPaths`, `configPath`, and `nextAction` as authoritative/i);
  assert.match(newProjectCommand, /supported repo-relative Blueprint artifact paths/i);
  assert.match(newProjectCommand, /Pass a JSON-object `patch` only/i);
  assert.match(newProjectDoc, /## Bootstrap Contract/);
  assert.match(newProjectDoc, /Treat scaffold output as seeding, not final authored persistence/i);
  assert.match(bootstrapSkill, /first persistent bootstrap write/i);
});

test("report-backed and digest-backed commands stay explicit about repo-relative inputs and tool-owned paths", async () => {
  const [
    debugCommand,
    debugDoc,
    quickCommand,
    quickDoc,
    docsUpdateCommand,
    docsUpdateDoc,
    prBranchCommand,
    prBranchDoc,
    shipCommand,
    shipDoc,
    cleanupCommand,
    cleanupDoc,
    mapCodebaseCommand,
    mapCodebaseDoc,
    mapSkill,
    healthCommand,
    healthDoc
  ] = await Promise.all([
    readRepoFile("commands/blu-debug.toml"),
    readRepoFile("docs/commands/debug.md"),
    readRepoFile("commands/blu-quick.toml"),
    readRepoFile("docs/commands/quick.md"),
    readRepoFile("commands/blu-docs-update.toml"),
    readRepoFile("docs/commands/docs-update.md"),
    readRepoFile("commands/blu-pr-branch.toml"),
    readRepoFile("docs/commands/pr-branch.md"),
    readRepoFile("commands/blu-ship.toml"),
    readRepoFile("docs/commands/ship.md"),
    readRepoFile("commands/blu-cleanup.toml"),
    readRepoFile("docs/commands/cleanup.md"),
    readRepoFile("commands/blu-map-codebase.toml"),
    readRepoFile("docs/commands/map-codebase.md"),
    readRepoFile("skills/blueprint-map/SKILL.md"),
    readRepoFile("commands/blu-health.toml"),
    readRepoFile("docs/commands/health.md")
  ]);

  assert.match(debugCommand, /bare canonical report name `debug-latest`/i);
  assert.match(debugCommand, /returned `createdEntryIds` as authoritative/i);
  assert.match(debugDoc, /## Report And Todo Contract/);

  assert.match(quickCommand, /bare canonical report name `quick-run-latest`/i);
  assert.match(quickDoc, /## Quick Report Contract/);

  assert.match(docsUpdateCommand, /explicit repo-relative `artifactPaths`, `docFiles`, `sourceFiles`, or `testFiles`/i);
  assert.match(docsUpdateCommand, /returned `inputsUsed` list as the authoritative digest scope/i);
  assert.match(docsUpdateCommand, /bare report name `docs-update-latest`/i);
  assert.match(docsUpdateDoc, /## Digest And Report Contract/);

  assert.match(prBranchCommand, /repo-relative `artifactPaths` and, when useful, repo-relative `trackedFiles`/i);
  assert.match(prBranchCommand, /returned `inputsUsed` list as the authoritative digest scope/i);
  assert.match(prBranchCommand, /bare report name `pr-branch-latest`/i);
  assert.match(prBranchDoc, /## Digest And Report Contract/);

  assert.match(shipCommand, /repo-relative tracked-file inputs/i);
  assert.match(shipCommand, /returned `inputsUsed` list as the authoritative digest scope/i);
  assert.match(shipCommand, /bare report name `ship-latest`/i);
  assert.match(shipDoc, /## Digest And Report Contract/);

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
  assert.match(mapCodebaseDoc, /ask_user/i);
  assert.match(mapCodebaseDoc, /blueprint_artifact_contract_read/i);
  assert.match(mapCodebaseDoc, /blueprint_codebase_artifact_write/i);
  assert.match(mapCodebaseDoc, /blueprint_artifact_validate/i);
  assert.match(mapCodebaseDoc, /Existing codebase docs should be reused by default\./i);
  assert.match(mapCodebaseDoc, /## Mapping Artifact Contract/);
  assert.match(mapSkill, /ask_user/i);
  assert.match(mapSkill, /blueprint_artifact_contract_read/i);
  assert.match(mapSkill, /blueprint_codebase_artifact_write/i);
  assert.match(mapSkill, /blueprint_artifact_validate/i);
  assert.match(mapSkill, /reuse-by-default behavior/i);
  assert.match(mapSkill, /returned `inputsUsed` list as the authoritative digest scope/i);

  assert.match(healthCommand, /Pass a JSON-object `patch` only/i);
  assert.match(healthCommand, /returned `configPath` as authoritative/i);
  assert.match(healthDoc, /## Repair Contract/);
});
