import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("plan-phase manifest references the config gates, planner/checker loop, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-plan-phase.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-planning` skill/);
  assert.match(commandFile, /plan-phase-runtime-contract\.md/);
  assert.match(commandFile, /anti-shallow plan authoring rules/i);
  assert.match(commandFile, /no-subagent fallback/i);
  assert.match(commandFile, /validation repair behavior/i);
  assert.match(commandFile, /`long-running-mutation`/);
  assert.match(commandFile, /Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route/);
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /structured `add`, `revise`, or `replace` choice before drafting/i);
  assert.match(commandFile, /empty plan set may auto-assign the first slot/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /blueprint-planner/);
  assert.match(commandFile, /blueprint-checker/);
  assert.match(commandFile, /artifact_contract_read/);
  assert.match(commandFile, /artifactId: "phase\.plan"/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_context")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_research_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_artifact_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_load_findings")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_authoring_context")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_validate_model")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_validate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_load")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /workflow\.research/);
  assert.match(commandFile, /workflow\.ui_phase/);
  assert.match(commandFile, /workflow\.ui_safety_gate/);
  assert.match(commandFile, /workflow\.plan_check/);
  assert.match(commandFile, /phase_research_status\.planningReadiness/);
  assert.match(commandFile, /readyForPlanPhase=false[\s\S]*nextSafeAction/);
  assert.match(commandFile, /Do not draft or interpret `mcp_blueprint_blueprint_phase_plan_authoring_context\.taskSchema` for authoring until this gate is ready/i);
  assert.match(commandFile, /current `context` artifact|actual saved discovery content/i);
  assert.match(commandFile, /saved validation or review evidence/i);
  assert.match(commandFile, /saved plans already exist[\s\S]*`planId` is omitted[\s\S]*explicit `add`, `revise`, or `replace` choice before drafting/i);
  assert.match(commandFile, /explicit confirmation path/i);
  assert.match(commandFile, /requirements-aware review loop/i);
  assert.match(commandFile, /bounded/i);
  assert.match(commandFile, /base: "synced"/);
  assert.match(commandFile, /workflow\.plan_check=true[\s\S]*blueprint-checker[\s\S]*workflow\.plan_check=false[\s\S]*skip checker review entirely/i);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /Omit `planId` only when writing the first plan in an empty plan set or after an earlier explicit `add` choice selected a new slot/i);
  assert.match(commandFile, /numeric plan id when targeting a specific plan/i);
  assert.match(commandFile, /numeric value `planId: 1`/i);
  assert.match(commandFile, /double-encoded string/i);
  assert.match(commandFile, /taskSchema/);
  assert.match(commandFile, /contract\.modelContract\.schemaPath/);
  assert.match(commandFile, /`add`, `revise`, or `replace`|add\/revise\/replace/i);
  assert.match(commandFile, /Use saved research for unstable technical decisions/i);
  assert.match(commandFile, /route to `\/blu-research-phase` instead of browsing live web docs/i);
  assert.match(commandFile, /repair all diagnostics against the live task schema and contract/i);
  assert.match(commandFile, /Re-read `mcp_blueprint_blueprint_phase_plan_authoring_context` immediately before each model validation\/write/i);
  assert.match(commandFile, /previously saved plan files become intentional known evidence artifacts/i);
  assert.match(commandFile, /final `blueprint_phase_plan_validate` status must be `valid` before `mcp_blueprint_blueprint_state_update` or completion advances/i);
  assert.match(commandFile, /Incomplete roadmap coverage may still be saved incrementally, but it is not final completion/i);
  assert.match(commandFile, /validationMode: "strict"/);
  assert.match(commandFile, /authoringMode: "model-only"/);
  assert.match(commandFile, /validationMode: "warn"/);
  assert.doesNotMatch(commandFile, /artifact_report_write/);
  assert.doesNotMatch(commandFile, /blueprint_artifact_scaffold/);
  assert.doesNotMatch(commandFile, /blueprint_artifact_validate/);
  assert.doesNotMatch(
    commandFile,
    /--auto|--research|--skip-research|--gaps|--skip-verify|--prd|--reviews|--text/
  );
  assert.doesNotMatch(
    commandFile,
    /skills\/blueprint-phase-planning\.md|agents\/blueprint-(planner|checker)\.md/
  );
});

test("plan-phase skill captures the revision loop and safe follow-up rules", async () => {
  const [skillFile, runtimeContract] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-planning/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-plan-phase/);
  assert.match(skillFile, /input_bundles:/);
  assert.doesNotMatch(skillFile, /docs\/commands\/plan-phase\.md/);
  assert.match(skillFile, /plan-phase-runtime-contract\.md/);
  assert.match(skillFile, /`long-running-mutation`/);
  assert.match(skillFile, /Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route/);
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(skillFile, /structured `add`, `revise`, or `replace` gate before drafting/i);
  assert.match(skillFile, /empty plan set may auto-assign the first slot/i);
  assert.match(skillFile, /artifact_contract_read/);
  assert.match(skillFile, /workflow\.research/);
  assert.match(skillFile, /workflow\.ui_phase/);
  assert.match(skillFile, /workflow\.ui_safety_gate/);
  assert.match(skillFile, /workflow\.plan_check/);
  assert.match(skillFile, /planningReadiness/);
  assert.match(skillFile, /readyForPlanPhase=false[\s\S]*nextSafeAction/);
  assert.match(skillFile, /Do not interpret `blueprint_phase_plan_authoring_context\.taskSchema` for authoring until this readiness gate is satisfied/i);
  assert.match(skillFile, /blueprint-planner/);
  assert.match(skillFile, /blueprint-checker/);
  assert.match(skillFile, /explicit confirmation/i);
  assert.match(skillFile, /config-gated/i);
  assert.match(skillFile, /base: "synced"/);
  assert.match(skillFile, /\/blu-progress/);
  assert.match(skillFile, /Omit `planId` only when writing the first plan in an empty plan set or after an earlier explicit `add` choice selected a new slot/i);
  assert.match(skillFile, /numeric plan id when targeting a specific plan/i);
  assert.match(skillFile, /numeric value `planId: 1`/i);
  assert.match(skillFile, /double-encoded string/i);
  assert.match(skillFile, /taskSchema/);
  assert.match(skillFile, /add\/revise\/replace|add.*revise.*replace/i);
  assert.match(skillFile, /no-subagent fallback/i);
  assert.match(skillFile, /saved research for unstable technical decisions instead of browsing live web docs/i);
  assert.match(skillFile, /workflow\.plan_check=true[\s\S]*blueprint-checker[\s\S]*workflow\.plan_check=false[\s\S]*skip checker review entirely/i);
  assert.match(skillFile, /raw `\.blueprint\/` edits/i);
  assert.match(skillFile, /Re-read `blueprint_phase_plan_authoring_context` immediately before each model validation\/write/i);
  assert.match(skillFile, /previously saved plan files become intentional known evidence artifacts/i);
  assert.match(skillFile, /saved plans may land as incremental checkpoints, but completion advances only after final plan-set validation is truly valid/i);
  assert.match(skillFile, /saved plans already exist and `planId` is omitted[\s\S]*explicit `add`, `revise`, or `replace` choice before drafting/i);
  assert.match(skillFile, /final `status` to be `valid` before synced state update or completion advances/i);
  assert.match(skillFile, /Incomplete roadmap coverage may still be saved incrementally, but it is not final completion/i);
  assert.match(skillFile, /strict model-rendered heading set/i);
  assert.match(skillFile, /File \/ Surface Coverage/i);
  assert.match(skillFile, /Unknowns And Deferrals/i);
  assert.match(skillFile, /Top-level `requirements` lists only requirements this plan covers now/i);
  assert.match(skillFile, /`requirementCoverage` accounts for every known phase requirement exactly once/i);
  assert.match(skillFile, /`evidenceCoverage` as the current runtime-narrowed inventory/i);
  assert.match(skillFile, /validationMode: "strict"/);
  assert.match(skillFile, /authoringMode: "model-only"/);
  assert.doesNotMatch(skillFile, /docs\/COMMAND-CATALOG\.md|docs\/SKILLS-AND-AGENTS\.md|docs\/ARTIFACT-SCHEMA\.md/);
  assert.doesNotMatch(skillFile, /blueprint_artifact_scaffold/);
  assert.doesNotMatch(skillFile, /blueprint_artifact_validate/);
  assert.doesNotMatch(
    skillFile,
    /--auto|--research|--skip-research|--gaps|--skip-verify|--prd|--reviews|--text/
  );

  assert.match(runtimeContract, /## Stage Mapping/);
  assert.match(runtimeContract, /### Resolve/);
  assert.match(runtimeContract, /### Read/);
  assert.match(runtimeContract, /### Decide/);
  assert.match(runtimeContract, /### Execute/);
  assert.match(runtimeContract, /### Persist/);
  assert.match(runtimeContract, /### Validate/);
  assert.match(runtimeContract, /### Route/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_phase_locate/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_phase_validation_read/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_review_load_findings/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_phase_plan_write/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_phase_plan_authoring_context/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_phase_plan_validate_model/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_phase_plan_validate/);
  assert.match(runtimeContract, /validationMode:\s+"strict"/);
  assert.match(runtimeContract, /authoringMode:\s+"model-only"/);
  assert.match(runtimeContract, /Re-read `mcp_blueprint_blueprint_phase_plan_authoring_context` immediately/i);
  assert.match(runtimeContract, /saved `XX-YY-PLAN\.md` files are intentional known evidence artifacts/i);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_state_update/);
  assert.match(runtimeContract, /contract\.modelContract\.schemaPath/);
  assert.match(runtimeContract, /taskSchema/);
  assert.match(runtimeContract, /Use saved research for freshness-sensitive or unstable technical decisions/i);
  assert.match(runtimeContract, /planningReadiness/);
  assert.match(runtimeContract, /readyForPlanPhase=false[\s\S]*nextSafeAction/);
  assert.match(runtimeContract, /Do not\s+interpret `mcp_blueprint_blueprint_phase_plan_authoring_context\.taskSchema`\s+for drafting until this gate is satisfied/i);
  assert.match(
    runtimeContract,
    /route\s+to `\/blu-research-phase` instead of live browsing or ad hoc web-doc lookup/i
  );
  assert.match(runtimeContract, /saved plans already exist and `planId` is omitted[\s\S]*`add`, `revise`, or `replace` before drafting/i);
  assert.match(runtimeContract, /first slot may auto-assign without that gate/i);
  assert.match(runtimeContract, /workflow\.plan_check=true[\s\S]*blueprint-checker/i);
  assert.match(
    runtimeContract,
    /workflow\.plan_check=false[\s\S]*(checker review was skipped by|skip checker\s+review entirely)/i
  );
  assert.match(runtimeContract, /final `mcp_blueprint_blueprint_phase_plan_validate` status must be\s+`valid` before completion advances or `mcp_blueprint_blueprint_state_update`\s+is allowed to run/i);
  assert.match(runtimeContract, /Incomplete roadmap coverage may still be saved\s+incrementally, but it is not final completion/i);
  assert.match(runtimeContract, /Artifact Authoring Rules/);
  assert.match(runtimeContract, /`## Requirement Coverage`/);
  assert.match(runtimeContract, /`## Evidence Coverage`/);
  assert.match(runtimeContract, /`## File \/ Surface Coverage`/);
  assert.match(runtimeContract, /`## Unknowns And Deferrals`/);
  assert.match(runtimeContract, /Frontmatter\/top-level model `requirements` must list only requirements this\s+specific plan covers now/i);
  assert.match(runtimeContract, /`requirementCoverage` is the all-requirements ledger/i);
  assert.match(runtimeContract, /`evidenceCoverage` is runtime-narrowed and dynamic/i);
  assert.match(runtimeContract, /goal-backward must-haves/i);
  assert.match(runtimeContract, /observable truths, required\s+artifacts,\s+and\s+key links/i);
  assert.match(runtimeContract, /Subagent Path/);
  assert.match(runtimeContract, /No-Subagent Fallback/);
  assert.match(runtimeContract, /Do not use browser, web-search-only, or generic browsing agents/i);
  assert.match(runtimeContract, /Markdown fallback/i);
  assert.match(runtimeContract, /Max revision loop: three checker passes/i);
  assert.match(runtimeContract, /Output Quality Criteria/);
  assert.match(runtimeContract, /Completion Criteria/);
});

test("plan-phase runtime metadata owns the migrated catalog and runtime-reference facts", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("plan-phase");
  const contract = await buildBlueprintCommandRuntimeContractResource("plan-phase");

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#plan-phase");
  assert.equal(metadata.catalog.wave, 1);
  assert.equal(metadata.catalog.family, "Core Lifecycle");
  assert.equal(metadata.catalog.primarySkill, "blueprint-phase-planning");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(
    metadata.catalog.risk,
    "Medium: can replace plans and change downstream execution order."
  );
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.deepEqual(metadata.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_phase_research_status",
    "blueprint_phase_artifact_read",
    "blueprint_phase_validation_read",
    "blueprint_review_load_findings",
    "blueprint_artifact_contract_read",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_phase_plan_authoring_context",
    "blueprint_phase_plan_validate_model",
    "blueprint_phase_plan_write",
    "blueprint_phase_plan_validate",
    "blueprint_config_get",
    "blueprint_state_load",
    "blueprint_state_update"
  ]);
  assert.deepEqual(metadata.optionalAgents, [
    "blueprint-planner",
    "blueprint-checker"
  ]);
  assert.equal(metadata.spec.path, metadata.sourceId);
  assert.match(metadata.spec.purpose, /MCP-owned structured phase\.plan/i);
  assert.deepEqual(metadata.spec.writes, [
    "structured phase.plan JSON through blueprint_phase_plan_write",
    ".blueprint/phases/<phase>/<phase-prefix>-<plan-id>-PLAN.md (XX-YY-PLAN.md) through blueprint_phase_plan_write",
    ".blueprint/STATE.md through synced state update"
  ]);
  assert.equal(metadata.runtimeReference.path, metadata.sourceId);
  assert.equal(metadata.runtimeReference.waveTitle, "Core Lifecycle");
  assert.deepEqual(metadata.runtimeReference.exactMcpDestination, [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_phase_research_status",
    "blueprint_phase_artifact_read",
    "blueprint_phase_validation_read",
    "blueprint_review_load_findings",
    "blueprint_artifact_contract_read",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_phase_plan_authoring_context",
    "blueprint_phase_plan_validate_model",
    "blueprint_phase_plan_write",
    "blueprint_phase_plan_validate",
    "blueprint_config_get",
    "blueprint_state_load",
    "blueprint_state_update"
  ]);
  assert.deepEqual(metadata.runtimeReference.hookInvolvement, [
    "read-before-edit",
    ".blueprint write guard"
  ]);
  assert.deepEqual(metadata.runtimeReference.evidenceState, [
    "locked",
    "runtime-owned",
    "needs-behavior-audit"
  ]);
  assert.match(metadata.runtimeReference.contractNotes, /Long-running-mutation profile/i);
  assert.match(metadata.runtimeReference.contractNotes, /planningReadiness/i);
  assert.match(metadata.runtimeReference.contractNotes, /taskSchema/i);
  assert.match(metadata.runtimeReference.contractNotes, /re-read blueprint_phase_plan_authoring_context immediately before each model validation\/write/i);
  assert.match(metadata.runtimeReference.contractNotes, /saved plan files are intentional later-slot evidence artifacts/i);
  assert.match(metadata.runtimeReference.contractNotes, /validationMode: "strict"/);
  assert.match(metadata.runtimeReference.contractNotes, /authoringMode: "model-only"/);
  assert.match(metadata.runtimeReference.contractNotes, /additive new plan ids/i);
  assert.match(metadata.runtimeReference.contractNotes, /saved research instead of live browsing/i);
  assert.match(metadata.runtimeReference.contractNotes, /workflow\.plan_check/i);
  assert.match(metadata.runtimeReference.contractNotes, /blueprint-planner/i);
  assert.match(metadata.runtimeReference.contractNotes, /blueprint-checker/i);
  assert.match(metadata.runtimeReference.contractNotes, /no-subagent/i);
  assert.match(metadata.runtimeReference.contractNotes, /scaffold-placeholder/i);
  assert.match(metadata.runtimeReference.contractNotes, /Markdown fallback/i);
  assert.match(metadata.runtimeReference.contractNotes, /Repair MCP/i);
  assert.match(metadata.runtimeReference.contractNotes, /base: "synced"/);

  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...metadata.runtimeReference.exactMcpDestination
  ]);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("plan-phase planner and checker guidance stays tied to the live contract and bounded recovery loop", async () => {
  const [plannerFile, checkerFile, mcpToolsDoc, contractFile] = await Promise.all([
    readFile(path.join(repoRoot, "agents/blueprint-planner.md"), "utf8"),
    readFile(path.join(repoRoot, "agents/blueprint-checker.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/MCP-TOOLS.md"), "utf8"),
    readFile(path.join(repoRoot, "src/mcp/artifact-contracts/index.ts"), "utf8")
  ]);

  assert.match(plannerFile, /live phase\.plan contract/i);
  assert.match(plannerFile, /taskSchema/i);
  assert.match(plannerFile, /requirements-coverage map/i);
  assert.match(plannerFile, /too broad for one coherent plan|prioritize it|split it into smaller slices/i);
  assert.match(plannerFile, /bounded number of passes|stop and return the best coherent draft/i);
  assert.match(plannerFile, /parent command owns orchestration/i);
  assert.match(plannerFile, /visible stage narration/i);
  assert.match(plannerFile, /user\s+checkpoints/i);
  assert.match(plannerFile, /reuse\/revise\/replace or overwrite decision/i);
  assert.match(plannerFile, /ready for\s+`blueprint_phase_plan_validate_model` and `blueprint_phase_plan_write` by the\s+parent command/i);
  assert.match(plannerFile, /Do not own orchestration/i);
  assert.match(plannerFile, /user confirmations/i);
  assert.match(plannerFile, /MCP validation/i);
  assert.match(plannerFile, /any\s+persistence path/i);
  assert.match(plannerFile, /Do not persist plan files/i);
  assert.match(plannerFile, /update Blueprint state/i);
  assert.match(plannerFile, /accept\/revise\/route decision/i);
  assert.match(plannerFile, /full fidelity/i);
  assert.match(plannerFile, /`v1`, `simplified`, `static for now`, `placeholder`/i);
  assert.match(plannerFile, /usually 2-3\s+implementation tasks per plan/i);
  assert.match(plannerFile, /exact repo-relative paths/i);
  assert.match(plannerFile, /concrete target behavior and values/i);
  assert.match(plannerFile, /mechanically checkable/i);
  assert.match(plannerFile, /observable truths, required\s+artifacts,\s+and\s+key links/i);
  assert.match(plannerFile, /Top-level `requirements` is only the requirement-id subset this plan covers\s+now/i);
  assert.match(plannerFile, /saved plan files can become evidence rows for later\s+slots/i);
  assert.match(plannerFile, /File \/ Surface Coverage/i);
  assert.match(plannerFile, /Unknowns And Deferrals/i);

  assert.match(checkerFile, /live phase\.plan contract/i);
  assert.match(checkerFile, /task schema/i);
  assert.match(checkerFile, /## Review Modes/);
  assert.match(checkerFile, /Do not apply\s+the UI-specific six-dimension gate to ordinary plan reviews/i);
  assert.match(checkerFile, /coverage readiness/i);
  assert.match(checkerFile, /prioritized waves|narrower phase slice/i);
  assert.match(checkerFile, /bounded split|targeted revision/i);
  assert.match(checkerFile, /parent command owns all persistence/i);
  assert.match(checkerFile, /overwrite handling/i);
  assert.match(checkerFile, /follow-up routing after the checker returns a verdict/i);
  assert.match(checkerFile, /findings only/i);
  assert.match(checkerFile, /persist elsewhere if needed/i);
  assert.match(
    checkerFile,
    /`ACCEPT` is a review verdict, not a persistence or orchestration decision/
  );
  assert.match(checkerFile, /Do not own orchestration/i);
  assert.match(checkerFile, /user confirmations/i);
  assert.match(checkerFile, /revision checkpoints/i);
  assert.match(checkerFile, /MCP\s+persistence/i);
  assert.match(checkerFile, /final routing/i);
  assert.match(checkerFile, /Do not persist verdicts/i);
  assert.match(checkerFile, /advance checkpoints/i);
  assert.match(checkerFile, /update Blueprint state/i);
  assert.match(checkerFile, /Anti-shallow readiness/i);
  assert.match(checkerFile, /Scope reduction detection/i);
  assert.match(checkerFile, /Scope budget/i);
  assert.match(checkerFile, /Must-have derivation/i);
  assert.match(checkerFile, /v1`, `simplified`, `static for now`, `placeholder`/i);
  assert.match(checkerFile, /Top-level `requirements` should contain only requirements\s+covered by the reviewed plan now/i);
  assert.match(checkerFile, /`requirementCoverage` should account for\s+every known phase requirement exactly once/i);
  assert.match(checkerFile, /saved plan files can become later-slot\s+evidence/i);
  assert.match(checkerFile, /## UI-Spec Review Addendum/);

  assert.match(
    mcpToolsDoc,
    /`plan-phase` uses the canonical `phase\.plan` contract read, phase context and readiness status, discovery artifact reads, validation reads when evidence exists, saved review findings when present, plan index\/read tools, `blueprint_phase_plan_authoring_context`, `blueprint_phase_plan_validate_model`, plan write\/validate tools, config, and state update tools\./i
  );
  assert.match(mcpToolsDoc, /plan-phase-runtime-contract\.md/);
  assert.match(mcpToolsDoc, /schema-backed requirements\/evidence\/dependency coverage check before finalization/i);
  assert.match(mcpToolsDoc, /saved research rather than live browsing/i);
  assert.match(mcpToolsDoc, /gates reuse\/revise\/replace only for writes that would overwrite saved plans/i);
  assert.match(mcpToolsDoc, /treats checker review as config-gated/i);
  assert.match(mcpToolsDoc, /repairs model-validation\/write\/scoped-validation diagnostics through MCP/i);
  assert.match(mcpToolsDoc, /re-reads that authoring context immediately before each model validation\/write/i);
  assert.match(mcpToolsDoc, /saved plan files are intentional later-slot evidence artifacts/i);
  assert.match(mcpToolsDoc, /synced state recomputation/i);

  assert.match(contractFile, /Plan authoring should stay execution-ready/i);
  assert.match(contractFile, /grep\/test\/CLI\/file-read-verifiable `Acceptance Criteria`/i);
  assert.match(contractFile, /Do not silently reduce locked context decisions/i);
  assert.match(contractFile, /requiredHeadings: \[\.\.\.PHASE_PLAN_MODEL_CONTRACT\.renderedHeadings\]/);
  assert.match(contractFile, /Top-level `requirements` lists only requirements this plan covers now/i);
  assert.match(contractFile, /saved plans become evidence for later slots/i);
});
