import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("code-review manifest references the review tools, canonical contract, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-code-review.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(
    commandFile,
    /skills\/blueprint-review\/references\/code-review-runtime-contract\.md/
  );
  assert.match(commandFile, /`blueprint-reviewer` subagent/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /runtime contract's shared review posture/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read"))
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_scope")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_load_findings")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_validate_model")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, /review\.code-review/);
  assert.match(commandFile, /XX-REVIEW\.md/);
  assert.match(commandFile, /confirmationRecommended/);
  assert.match(commandFile, /scopeFiles/);
  assert.match(commandFile, /scopeSource/);
  assert.match(commandFile, /reviewMode\.source/);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(commandFile, /\/blu-secure-phase/);
  assert.match(commandFile, /\/blu-code-review-fix/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /scope source, file count, selected review depth, pending gate, execution mode/);
  assert.match(commandFile, /no-subagent fallback/i);
  assert.match(commandFile, /invalid-write repair/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-review\.md|agents\/blueprint-reviewer\.md/);
});

test("blueprint-review skill captures MCP-owned code-review rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-code-review/);
  assert.match(skillFile, /Execution profile for `code-review`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /Each command-local runtime contract owns the detailed stage vocabulary, in-flight status fields, and waiting-state semantics/
  );
  assert.match(skillFile, /### `code-review`/);
  assert.match(skillFile, /references\/code-review-runtime-contract\.md/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_review_scope/);
  assert.match(skillFile, /blueprint_review_validate_model/);
  assert.match(skillFile, /confirmationRecommended/);
  assert.match(skillFile, /update_topic plus `write_todos`/);
  assert.match(skillFile, /blueprint-reviewer/);
  assert.match(skillFile, /no-subagent fallback/i);
  assert.match(skillFile, /retry once\s+through MCP/i);
  assert.match(skillFile, /XX-REVIEW\.md/);
  assert.match(skillFile, /scopeFiles/);
  assert.match(skillFile, /scopeSource/);
  assert.match(skillFile, /\/blu-secure-phase <phase>/);
  assert.match(skillFile, /\/blu-code-review-fix <phase>/);
  assert.match(skillFile, /\/blu-progress/);
});

test("code-review runtime contract preserves depth semantics, fallback, and repair behavior", async () => {
  const runtimeContract = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-review/references/code-review-runtime-contract.md"
    ),
    "utf8"
  );
  const reviewerAgent = await readFile(
    path.join(repoRoot, "agents/blueprint-reviewer.md"),
    "utf8"
  );
  const commandDoc = await readFile(
    path.join(repoRoot, "docs/commands/code-review.md"),
    "utf8"
  );
  const runtimeReference = await readFile(
    path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"),
    "utf8"
  );
  const mcpToolsDoc = await readFile(path.join(repoRoot, "docs/MCP-TOOLS.md"), "utf8");

  assert.match(runtimeContract, /## Required MCP Calls/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_phase_locate/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_review_scope/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_review_load_findings/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_review_validate_model/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_review_record/);
  assert.match(runtimeContract, /## Depth Semantics/);
  assert.match(runtimeContract, /`quick`/);
  assert.match(runtimeContract, /`standard`/);
  assert.match(runtimeContract, /`deep`/);
  assert.match(runtimeContract, /## Capability-Gated Subagent Path/);
  assert.match(runtimeContract, /Browser, web-search-only, shell-only, or generic page-inspection helpers are not\s+acceptable substitutes/i);
  assert.match(runtimeContract, /## No-Subagent Fallback/);
  assert.match(runtimeContract, /review one file group at a time/i);
  assert.match(runtimeContract, /compress carry-forward context/i);
  assert.match(runtimeContract, /## Retry And Repair/);
  assert.match(runtimeContract, /retry validation once before persistence/i);
  assert.match(runtimeContract, /confirmationRecommended/);
  assert.match(runtimeContract, /scopeSource/);
  assert.match(runtimeContract, /reviewMode\.source/);
  assert.match(runtimeContract, /scoped file:line or\s+line-range location, evidence, impact, and recommendation/i);

  assert.match(reviewerAgent, /## Depth-Aware Review Expectations/);
  assert.match(reviewerAgent, /severity is\s+`critical\|high\|medium\|low\|unknown`/i);
  assert.match(reviewerAgent, /scoped file:line evidence, impact, and concrete fix or\s+verification guidance/i);
  assert.doesNotMatch(reviewerAgent, /\/blu-code-review-fix|\/blu-audit-fix|peer-review/i);

  assert.match(commandDoc, /skills\/blueprint-review\/references\/code-review-runtime-contract\.md/);
  assert.match(commandDoc, /## Depth And Output Quality Contract/);
  assert.match(commandDoc, /## Subagent And Fallback Contract/);
  assert.match(commandDoc, /`blueprint_artifact_contract_read` ->/);
  assert.match(commandDoc, /confirmationRecommended/);
  assert.match(commandDoc, /`blueprint_review_validate_model`/);
  assert.match(mcpToolsDoc, /confirmationRecommended/);
  assert.match(runtimeReference, /code-review[\s\S]*code-review-runtime-contract\.md/);
  assert.match(mcpToolsDoc, /code-review-runtime-contract\.md/);
});

test("code-review authoring contract requires line-backed fix guidance", () => {
  const contract = readArtifactContract("review.code-review");

  assert.equal(contract.modelContract?.schemaId, "blueprint.review.code-review.model");
  assert.equal(
    contract.modelContract?.schemaPath,
    "src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json"
  );
  assert.ok(contract.modelContract?.contextBindings.some((binding) => /blueprint_review_scope/i.test(binding)));
  assert.match(JSON.stringify(contract.modelContract?.jsonSchema), /evidenceCoverage/);
  assert.match(
    contract.notes.join("\n"),
    /model-only|Scope Reviewed must list every repo-relative file|repo-relative file:line evidence, impact, and concrete fix or verification guidance|Severity Summary counts must match/i
  );
});
