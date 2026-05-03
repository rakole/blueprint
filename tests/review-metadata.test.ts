import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("review runtime metadata is source-owned and docs-free", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("review");
  const catalog = await blueprintCommandCatalog();
  const contract = await buildBlueprintCommandRuntimeContractResource("review");

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#review");
  assert.equal(metadata.spec.path, metadata.sourceId);
  assert.equal(metadata.runtimeReference.path, metadata.sourceId);
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-review/references/review-runtime-contract.md"
  ]);

  assert.equal(catalog.commands.review.specPath, metadata.sourceId);
  assert.deepEqual(catalog.commands.review.requiredTools, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(catalog.commands.review.optionalAgents, [
    ...metadata.optionalAgents
  ]);
  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, [
    ...metadata.optionalAgents
  ]);
  assert.deepEqual(contract.skillInputs, {
    skill: "blueprint-review",
    shared: [],
    commandSpecific: [
      "commands/blu-review.toml",
      "skills/blueprint-review/references/review-runtime-contract.md"
    ],
    effective: [
      "commands/blu-review.toml",
      "skills/blueprint-review/references/review-runtime-contract.md"
    ]
  });
  assert.doesNotMatch(JSON.stringify(contract), /docs\//);
});

test("review manifest references plan-backed peer-review tools and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-review.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(
    commandFile,
    /Load `skills\/blueprint-review\/references\/review-runtime-contract\.md`/
  );
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /`update_topic` tool/);
  assert.match(commandFile, /`write_todos`/);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /one focused question per `ask_user` call/i);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_execution_targets")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_authoring_context")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_validate_model")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, /artifact: "peer-review"/);
  assert.match(commandFile, /XX-REVIEWS\.md/);
  assert.match(commandFile, /review\.peer-review/);
  assert.match(commandFile, /contract\.modelContract/);
  assert.match(commandFile, /blueprint-reviewer/);
  assert.match(commandFile, /no-subagent fallback/i);
  assert.match(commandFile, /Reject browser-only, web-search-only, shell-only, or generic helpers/i);
  assert.match(commandFile, /reviewer-availability/i);
  assert.match(commandFile, /requested reviewers/i);
  assert.match(commandFile, /reviewer disagreement status/i);
  assert.match(commandFile, /partial fan-out results/i);
  assert.match(commandFile, /next safe action on `\/blu-review <phase>`/i);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(commandFile, /\/blu-code-review/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-review\.md|agents\/blueprint-reviewer\.md/);
});

test("blueprint-review skill captures MCP-owned peer-review rules", async () => {
  const [skillFile, runtimeContract, agentFile] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-review/SKILL.md"), "utf8"),
    readFile(
      path.join(repoRoot, "skills/blueprint-review/references/review-runtime-contract.md"),
      "utf8"
    ),
    readFile(path.join(repoRoot, "agents/blueprint-reviewer.md"), "utf8")
  ]);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-review/);
  assert.match(skillFile, /skills\/blueprint-review\/references\/review-runtime-contract\.md/);
  assert.match(skillFile, /Execution profile for `review`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /Each command-local runtime contract owns the detailed stage vocabulary, in-flight status fields, and waiting-state semantics/
  );
  assert.match(skillFile, /### `review`/);
  assert.match(skillFile, /blueprint_phase_plan_index/);
  assert.match(skillFile, /blueprint_phase_plan_read/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_review_authoring_context/);
  assert.match(skillFile, /blueprint_review_validate_model/);
  assert.match(skillFile, /blueprint_review_record/);
  assert.match(skillFile, /review\.peer-review/);
  assert.match(skillFile, /modelContract/);
  assert.match(skillFile, /blueprint-reviewer/);
  assert.match(skillFile, /no-subagent\s+fallback/i);
  assert.match(skillFile, /Reject browser-only, web-search-only, shell-only, or generic agents/i);
  assert.match(skillFile, /XX-REVIEWS\.md/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /reviewer disagreement status/i);
  assert.match(skillFile, /reviewer-availability/i);
  assert.match(skillFile, /next safe action on\s+`\/blu-review <phase>`/i);
  assert.match(skillFile, /\/blu-plan-phase <phase>/);
  assert.match(skillFile, /\/blu-execute-phase <phase>/);
  assert.match(skillFile, /\/blu-code-review <phase>/);

  assert.match(runtimeContract, /## Stage Mapping/);
  assert.match(runtimeContract, /## Required MCP Calls/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_review_authoring_context/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_review_validate_model/);
  assert.match(runtimeContract, /review\.peer-review/);
  assert.match(runtimeContract, /contract\.modelContract/);
  assert.match(runtimeContract, /## Artifact Authoring Rules/);
  assert.match(runtimeContract, /Reviewer Coverage/);
  assert.match(runtimeContract, /Consensus/);
  assert.match(runtimeContract, /Disagreements/);
  assert.match(runtimeContract, /## Capability-Gated Subagent Path/);
  assert.match(runtimeContract, /blueprint-reviewer/);
  assert.match(runtimeContract, /## No-Subagent Fallback/);
  assert.match(runtimeContract, /browser-only, web-search-only, shell-only, or generic helpers/i);
  assert.match(runtimeContract, /Invalid peer-review model/i);

  assert.match(agentFile, /parent command owns any non-code-review reuse contract/i);
  assert.match(agentFile, /Do not invoke external reviewer CLIs/i);
  assert.doesNotMatch(agentFile, /peer-review packet or synthesis mode|reviewer coverage gaps/i);
});

test("review manifest and runtime resource describe the long-running peer-review spine", async () => {
  const [commandFile, contract] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-review.toml"), "utf8"),
    buildBlueprintCommandRuntimeContractResource("review")
  ]);

  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /skills\/blueprint-review\/references\/review-runtime-contract\.md/);
  assert.match(commandFile, /blueprint_artifact_contract_read/);
  assert.match(commandFile, /blueprint_review_authoring_context/);
  assert.match(commandFile, /blueprint_review_validate_model/);
  assert.match(commandFile, /review\.peer-review/);
  assert.match(commandFile, /contract\.modelContract/);
  assert.match(commandFile, /blueprint-reviewer/);
  assert.match(commandFile, /no-subagent fallback/i);
  assert.match(commandFile, /requested reviewers/i);
  assert.match(commandFile, /reviewer availability/i);
  assert.match(commandFile, /disagreement/i);
  assert.match(commandFile, /`update_topic` tool/);
  assert.match(commandFile, /`write_todos`/i);
  assert.match(commandFile, /session-local visibility only/i);
  assert.match(commandFile, /reviewer-availability/i);
  assert.match(commandFile, /next safe action on `\/blu-review <phase>`/i);

  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation profile for saved-plan peer review/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /active stage, and next safe action explicit/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /reviewer-availability gates/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /preserve partial reviewer coverage honestly/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /blueprint-reviewer only for bounded packet and synthesis quality checks/i
  );
  assert.match(
    contract.skillInputs.effective.join("\n"),
    /skills\/blueprint-review\/references\/review-runtime-contract\.md/i
  );
});
