import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
  assert.match(commandFile, /structured `reuse`, `revise`, or `replace` gate/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /`blueprint-planner` and `blueprint-checker` subagents/);
  assert.match(commandFile, /artifact_contract_read/);
  assert.match(commandFile, /artifactId: "phase\.plan"/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_context")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_research_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_artifact_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_validate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_load")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /workflow\.research/);
  assert.match(commandFile, /workflow\.ui_phase/);
  assert.match(commandFile, /workflow\.ui_safety_gate/);
  assert.match(commandFile, /workflow\.plan_check/);
  assert.match(commandFile, /actual saved context content|current context artifact content/i);
  assert.match(commandFile, /relevant discovery artifacts/i);
  assert.match(commandFile, /explicit confirmation path/i);
  assert.match(commandFile, /requirements-coverage check|requirements coverage/i);
  assert.match(commandFile, /too broad for one coherent plan|split it into prioritized dependency-aware waves/i);
  assert.match(commandFile, /bounded number of passes|stop the loop/i);
  assert.match(commandFile, /base: "synced"/);
  assert.match(commandFile, /planner\/checker revision loop|re-run the checker/i);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /Omit `planId` to auto-assign the next available slot/i);
  assert.match(commandFile, /numeric plan id when targeting a specific plan/i);
  assert.match(commandFile, /numeric inputs such as `1` are accepted/i);
  assert.match(commandFile, /contract\.authoringTemplate/);
  assert.match(commandFile, /reuse, revise, or replace/i);
  assert.match(commandFile, /concrete target state/i);
  assert.match(commandFile, /mechanically checkable acceptance criteria/i);
  assert.match(commandFile, /goal-backward must-haves/i);
  assert.match(commandFile, /full-fidelity context decision coverage/i);
  assert.match(commandFile, /no silent `v1`/i);
  assert.match(commandFile, /browser, web-search-only, or generic browsing agents/i);
  assert.match(commandFile, /repair the content against the live contract and retry through MCP/i);
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
  const [skillFile, runtimeReference, runtimeContract] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-planning/SKILL.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
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
  assert.match(skillFile, /`long-running-mutation`/);
  assert.match(skillFile, /Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route/);
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(skillFile, /structured `reuse`, `revise`, or `replace` gate/i);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /artifact_contract_read/);
  assert.match(skillFile, /artifactId: "phase\.plan"/);
  assert.match(skillFile, /workflow\.research/);
  assert.match(skillFile, /workflow\.ui_phase/);
  assert.match(skillFile, /workflow\.ui_safety_gate/);
  assert.match(skillFile, /workflow\.plan_check/);
  assert.match(skillFile, /blueprint-planner/);
  assert.match(skillFile, /blueprint-checker/);
  assert.match(skillFile, /explicit overwrite confirmation/i);
  assert.match(skillFile, /revision loop/i);
  assert.match(skillFile, /requirements-coverage check|requirements coverage/i);
  assert.match(skillFile, /too broad for one coherent plan|split it into prioritized dependency-aware waves/i);
  assert.match(skillFile, /bounded number of passes|stop the loop/i);
  assert.match(skillFile, /base: "synced"/);
  assert.match(skillFile, /\/blu-progress/);
  assert.match(skillFile, /Omit `planId` to auto-assign the next slot/i);
  assert.match(skillFile, /numeric plan id when targeting a specific plan/i);
  assert.match(skillFile, /numeric inputs such as `1` are accepted/i);
  assert.match(skillFile, /contract\.authoringTemplate/);
  assert.match(skillFile, /reuse\/revise\/replace|reuse.*revise.*replace/i);
  assert.match(skillFile, /plan-phase-runtime-contract\.md/);
  assert.match(skillFile, /anti-shallow artifact authoring/i);
  assert.match(skillFile, /no-subagent fallback/i);
  assert.match(skillFile, /browser, web-search-only, or generic browsing agents/i);
  assert.match(skillFile, /raw `\.blueprint\/` edits/i);
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
  assert.match(runtimeContract, /mcp_blueprint_blueprint_phase_plan_write/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_artifact_validate/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_state_update/);
  assert.match(runtimeContract, /contract\.authoringTemplate/);
  assert.match(runtimeContract, /Artifact Authoring Rules/);
  assert.match(runtimeContract, /goal-backward must-haves/i);
  assert.match(runtimeContract, /observable truths, required\s+artifacts,\s+and\s+key links/i);
  assert.match(runtimeContract, /Subagent Path/);
  assert.match(runtimeContract, /No-Subagent Fallback/);
  assert.match(runtimeContract, /Do not use browser, web-search-only, or generic browsing agents/i);
  assert.match(runtimeContract, /Invalid write: repair the content/i);
  assert.match(runtimeContract, /Max revision loop: three checker passes/i);
  assert.match(runtimeContract, /Output Quality Criteria/);
  assert.match(runtimeContract, /Completion Criteria/);

  assert.match(
    runtimeReference,
    /\| `plan-phase` \| `docs\/commands\/plan-phase\.md` \| `blueprint-phase-planning` \| `blueprint_phase_locate`<br>`blueprint_artifact_contract_read`<br>`blueprint_phase_context`<br>`blueprint_phase_research_status`<br>`blueprint_phase_artifact_read`<br>`blueprint_phase_plan_index`<br>`blueprint_phase_plan_read`<br>`blueprint_phase_plan_write`<br>`blueprint_config_get`<br>`blueprint_artifact_scaffold`<br>`blueprint_artifact_validate`<br>`blueprint_state_load`<br>`blueprint_state_update` \|/
  );
  assert.match(
    runtimeReference,
    /use `skills\/blueprint-phase-planning\/references\/plan-phase-runtime-contract\.md` as the rich behavior contract/
  );
  assert.match(runtimeReference, /anti-shallow plan authoring/i);
  assert.match(runtimeReference, /one-plan-at-a-time no-subagent fallback/i);
  assert.match(runtimeReference, /browser\/web-search-only agents as substitutes/i);
  assert.match(runtimeReference, /repair invalid writes or validation failures through MCP/i);
});

test("plan-phase command doc explains the plan write contract for planId", async () => {
  const docFile = await readFile(path.join(repoRoot, "docs/commands/plan-phase.md"), "utf8");

  assert.match(docFile, /ask_user/);
  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docFile, /## Shared Runtime Contract/);
  assert.match(
    docFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docFile, /shared long-running-mutation posture/i);
  assert.match(docFile, /Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route/);
  assert.match(docFile, /plan-phase-runtime-contract\.md/);
  assert.match(docFile, /anti-shallow plan authoring rules/i);
  assert.match(docFile, /no-subagent fallback/i);
  assert.match(docFile, /validation repair behavior/i);
  assert.match(
    docFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(docFile, /structured `reuse`, `revise`, or `replace` gate/i);
  assert.match(docFile, /## Plan Persistence Contract/);
  assert.match(docFile, /artifact_contract_read/);
  assert.match(docFile, /artifactId: "phase\.plan"/);
  assert.match(docFile, /contract\.authoringTemplate/);
  assert.match(docFile, /requirements-coverage check|requirements coverage/i);
  assert.match(docFile, /too broad for one coherent plan|split\/prioritize/i);
  assert.match(docFile, /bounded number of passes|stop the loop/i);
  assert.match(docFile, /base: "synced"/);
  assert.match(docFile, /Omit `planId` to let Blueprint auto-assign the next available plan slot/i);
  assert.match(docFile, /If targeting a specific plan, pass only the numeric plan id/i);
  assert.match(docFile, /numeric inputs such as `1` are also accepted/i);
  assert.match(docFile, /do not derive `planId` manually from a scaffold path/i);
  assert.match(docFile, /actual current `XX-CONTEXT\.md` content/i);
  assert.match(docFile, /relevant discovery artifacts/i);
  assert.match(docFile, /execution-prompt quality/i);
  assert.match(docFile, /goal-backward must-haves/i);
  assert.match(docFile, /browser, web-search-only, or generic browsing agents/i);
  assert.match(docFile, /repair against the live contract and retry through MCP/i);
  assert.doesNotMatch(
    docFile,
    /--auto|--research|--skip-research|--gaps|--skip-verify|--prd|--reviews|--text/
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
  assert.match(plannerFile, /authoringTemplate/i);
  assert.match(plannerFile, /requirements-coverage map/i);
  assert.match(plannerFile, /too broad for one coherent plan|prioritize it|split it into smaller slices/i);
  assert.match(plannerFile, /bounded number of passes|stop and return the best coherent draft/i);
  assert.match(plannerFile, /parent command owns orchestration/i);
  assert.match(plannerFile, /visible stage narration/i);
  assert.match(plannerFile, /user\s+checkpoints/i);
  assert.match(plannerFile, /reuse\/revise\/replace or overwrite decision/i);
  assert.match(plannerFile, /ready for\s+`blueprint_phase_plan_write` by the parent command/i);
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

  assert.match(checkerFile, /live phase\.plan contract/i);
  assert.match(checkerFile, /authoringTemplate/i);
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

  assert.match(
    mcpToolsDoc,
    /`plan-phase` uses the canonical `phase\.plan` contract read, plan index, plan read and write tools, config, artifact validation, and state update tools\./i
  );
  assert.match(mcpToolsDoc, /plan-phase-runtime-contract\.md/);
  assert.match(mcpToolsDoc, /requirements-coverage check before finalization/i);
  assert.match(mcpToolsDoc, /prioritized waves when needed/i);
  assert.match(mcpToolsDoc, /anti-shallow authoring rules/i);
  assert.match(mcpToolsDoc, /one-plan-at-a-time no-subagent fallback/i);
  assert.match(mcpToolsDoc, /browser\/web-search-only agents as substitutes/i);
  assert.match(mcpToolsDoc, /repairs invalid writes or validation failures through MCP/i);
  assert.match(mcpToolsDoc, /synced state recomputation/i);

  assert.match(contractFile, /Plan authoring should stay execution-ready/i);
  assert.match(contractFile, /grep\/test\/CLI\/file-read-verifiable `Acceptance Criteria`/i);
  assert.match(contractFile, /Do not silently reduce locked context decisions/i);
});
