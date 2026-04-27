import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("verify-work manifest references the UAT template, validation tools, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-verify-work.toml"), "utf8");
  const docsFile = await readFile(path.join(repoRoot, "docs/commands/verify-work.md"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(commandFile, /`blueprint-verifier` subagent/);
  assert.match(commandFile, /verify-work-runtime-contract\.md/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
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
  assert.match(commandFile, /XX-UAT\.md/);
  assert.match(commandFile, /artifactId: "phase\.uat"/);
  assert.match(commandFile, /authoringTemplate/);
  assert.match(commandFile, /review`, `skip`, or `stop`/i);
  assert.match(commandFile, /\*\*Resume State:\*\*` and `\*\*Checkpoint:\*\*/i);
  assert.match(commandFile, /Self-check the normalized draft against the returned contract before writing/);
  assert.match(commandFile, /Call `mcp_blueprint_blueprint_artifact_validate` after the write path/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /structured decision.*`view`.*`resume`.*`update`/is);
  assert.match(commandFile, /checkpointed,? created, or updated/i);
  assert.match(commandFile, /follow-up-fix capture/i);
  assert.match(commandFile, /locked markers and required section names unchanged/i);
  assert.match(commandFile, /Build a concrete UAT test queue/i);
  assert.match(
    commandFile,
    /empty response[\s\S]*explicit response[\s\S]*`pass`, `skipped`, `blocked`, or `issue`/i
  );
  assert.match(commandFile, /no-subagent fallback/i);
  assert.match(commandFile, /Do not substitute browser, web-search-only, shell-only, or generic agents/i);
  assert.match(commandFile, /repair the draft against the canonical contract and retry once/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
  assert.match(docsFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docsFile, /## Shared Runtime Contract/);
  assert.match(docsFile, /## In-Flight Progress Contract/);
  assert.match(docsFile, /verify-work-runtime-contract\.md/);
  assert.match(docsFile, /## UAT Test Loop/);
  assert.match(docsFile, /shared long-running-mutation posture/i);
  assert.match(
    docsFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docsFile, /`review` \/ `skip` \/ `stop` checkpoints are the pending gates/i);
  assert.match(docsFile, /`update_topic`/);
  assert.match(docsFile, /`write_todos`/);
  assert.match(docsFile, /checkpointed and bounded/i);
  assert.match(docsFile, /checkpoint decisions[\s\S]*`review`, `skip`, or `stop`/i);
});

test("verify-work skill captures the canonical UAT contract and verifier usage rules", async () => {
  const [skillFile, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-verify-work/);
  assert.match(skillFile, /conversational UAT is resumable/i);
  assert.match(skillFile, /verify-work-runtime-contract\.md/);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /workflow\.verifier/);
  assert.match(skillFile, /workflow\.nyquist_validation/);
  assert.match(skillFile, /artifactId: "phase\.uat"/);
  assert.match(skillFile, /blueprint_artifact_validate/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /review`, `skip`, or `stop`/i);
  assert.match(skillFile, /\*\*Resume State:\*\*` and `\*\*Checkpoint:\*\*/i);
  assert.match(skillFile, /next safe action on `\/blu-verify-work <phase>`/i);
  assert.match(skillFile, /follow-up-fix capture/i);
  assert.match(skillFile, /locked markers and required section names unchanged/i);
  assert.match(skillFile, /concrete user-observable test queue/i);
  assert.match(
    skillFile,
    /empty response[\s\S]*explicit response[\s\S]*`pass`, `skipped`, `blocked`, or `issue`/i
  );
  assert.match(skillFile, /no-subagent fallback/i);
  assert.match(skillFile, /Never substitute browser, web-search-only, shell-only, or generic agents/i);
  assert.match(
    runtimeReference,
    /`verify-work`[\s\S]*Long-running-mutation profile; keep Resolve\/Read\/Decide\/Execute\/Persist\/Validate\/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(runtimeReference, /verify-work-runtime-contract\.md/i);
  assert.match(runtimeReference, /concrete user-observable UAT test queue/i);
  assert.match(runtimeReference, /pass\/skipped\/blocked\/issue/i);
  assert.match(
    runtimeReference,
    /current test, test matrix, result counts, structured gaps, and in-artifact checkpoint state/i
  );
});

test("verify-work docs and verifier agent describe the resumable UAT write-and-validate contract", async () => {
  const commandDoc = await readFile(path.join(repoRoot, "docs/commands/verify-work.md"), "utf8");
  const schemaDoc = await readFile(path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"), "utf8");
  const agentFile = await readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8");

  assert.match(commandDoc, /normalizes the final body to the canonical UAT template before persistence/i);
  assert.match(commandDoc, /validates the written artifact before updating state/i);
  assert.match(commandDoc, /only leaves roadmap completion green when the saved evidence remains valid/i);
  assert.match(commandDoc, /focused structured decision when an existing UAT artifact is present/i);
  assert.match(commandDoc, /review`, `skip`, and `stop` choices/i);
  assert.match(commandDoc, /next safe action stays on `\/blu-verify-work <phase>`/i);
  assert.match(commandDoc, /`\*\*Resume State:\*\*`[\s\S]*`\*\*Checkpoint:\*\*`/i);
  assert.match(commandDoc, /follow-up-fix capture/i);
  assert.match(commandDoc, /test matrix/i);
  assert.match(commandDoc, /structured gaps/i);
  assert.match(commandDoc, /inferred severity/i);
  assert.match(schemaDoc, /`\*\*Resume State:\*\* RESUMED\|NEW\|CONTINUED`/);
  assert.match(schemaDoc, /`\*\*Checkpoint:\*\* <current checkpoint label or none>`/);
  assert.match(schemaDoc, /`## Session State`/);
  assert.match(schemaDoc, /`## Test Matrix`/);
  assert.match(schemaDoc, /`## Result Summary`/);
  assert.match(schemaDoc, /`## Structured Gaps`/);
  assert.match(schemaDoc, /should be normalized to the canonical `phase\.uat` authoring template before persistence/i);
  assert.match(schemaDoc, /should be validated after write so schema drift or heading drift is caught before the next state update/i);
  assert.match(agentFile, /phase\.uat` contract returned by `blueprint_artifact_contract_read`/);
  assert.match(agentFile, /only[\s\S]*heading and locked-marker authority for `XX-UAT\.md`/i);
  assert.match(
    agentFile,
    /prepare queue rows and pending-state scaffold content without inventing[\s\S]*observed behavior/i
  );
  assert.match(agentFile, /leave result counts and questions-asked sections for the parent to fill/i);
  assert.match(agentFile, /separate confirmation before persistence/i);
});

test("verify-work runtime contract locks GSD-grade UAT richness without changing persistence ownership", async () => {
  const [
    commandFile,
    skillFile,
    runtimeContract,
    agentFile,
    artifactContracts,
    schemaDoc,
    mcpToolsDoc,
    runtimeReference
  ] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-verify-work.toml"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-validation/references/verify-work-runtime-contract.md"
      ),
      "utf8"
    ),
    readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8"),
    readFile(path.join(repoRoot, "src/mcp/artifact-contracts/index.ts"), "utf8"),
    readFile(path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/MCP-TOOLS.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(commandFile, /verify-work-runtime-contract\.md/);
  assert.match(commandFile, /test queue[\s\S]*result counts[\s\S]*structured gaps/i);
  assert.match(commandFile, /repair the draft against the canonical contract and retry once/i);

  assert.match(skillFile, /Load `references\/verify-work-runtime-contract\.md`/);
  assert.match(skillFile, /cold-start smoke test/i);
  assert.match(skillFile, /structured gap rows/i);

  for (const heading of [
    "## Stage Mapping",
    "## Required MCP Calls",
    "## Test Queue Construction",
    "## Conversational UAT Loop",
    "## Artifact Authoring Rules",
    "## Capability-Gated Subagent Path",
    "## No-Subagent Fallback",
    "## Retry And Repair Behavior",
    "## Output Quality Criteria",
    "## Completion Criteria"
  ]) {
    assert.match(runtimeContract, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(runtimeContract, /blueprint_phase_validation_write` with `artifact: "uat"`/);
  assert.match(runtimeContract, /plain and specific; do not interrogate the user for\s+severity/i);
  assert.match(runtimeContract, /Blocked tests are prerequisite gates, not code gaps/i);
  assert.match(runtimeContract, /Do not substitute browser, web-search-only, shell-only, or generic agents/i);
  assert.match(runtimeContract, /read one completed summary at a time/i);
  assert.match(runtimeContract, /compress each summary into carry-forward test rows/i);
  assert.match(runtimeContract, /retry once/i);

  assert.match(agentFile, /UAT test queue rows/i);
  assert.match(agentFile, /initial pending UAT queue state and saved-evidence-only gap notes/i);
  assert.match(agentFile, /do not invent observed user behavior, completed pass\/fail counts/i);

  assert.match(artifactContracts, /## Current Test/);
  assert.match(artifactContracts, /## Test Matrix/);
  assert.match(artifactContracts, /## Result Summary/);
  assert.match(artifactContracts, /## Structured Gaps/);
  assert.match(
    artifactContracts,
    /Saved UAT must include the richer current-test, test-matrix, result-summary, and structured-gap sections before it can count as completion evidence/i
  );

  assert.match(schemaDoc, /Richer authoring template sections/i);
  assert.match(schemaDoc, /structured gaps that can feed later explicit follow-up capture/i);
  assert.match(mcpToolsDoc, /verify-work-runtime-contract\.md/i);
  assert.match(mcpToolsDoc, /current test state, test matrix, result counts/i);
  assert.match(runtimeReference, /verify-work-runtime-contract\.md/i);
  assert.match(runtimeReference, /sequential no-subagent fallback/i);
});
