import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

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
  assert.match(commandFile, /authoringTemplate` as renderer preview only/i);
  assert.match(commandFile, /contract\.modelContract\.jsonSchema/);
  assert.match(commandFile, /Do not repair toward rendered Markdown headings or `authoringTemplate`/i);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(
    commandFile,
    /If effective config has `workflow\.code_review=true`, `workflow\.secure_phase=true`, and the phase does not yet have `XX-SECURITY\.md`, use `\/blu-secure-phase <phase>` as the primary `nextSafeAction`\./
  );
  assert.match(
    commandFile,
    /If effective config has `workflow\.code_review=false`, never make `\/blu-secure-phase <phase>` mandatory through code-review routing, even when `workflow\.secure_phase=true`\./
  );
  assert.match(
    commandFile,
    /When security still routes first, keep `code-review-fix` visible as the secondary queued follow-up instead of hiding it\./
  );
  assert.match(
    commandFile,
    /Keep `\/blu-secure-phase` manually runnable even when config-gated routing prefers another implemented next step\./
  );
  assert.match(commandFile, /\/blu-code-review-fix/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /secondary queued recommendation/i);
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
  assert.match(skillFile, /input_bundles:/);
  assert.match(skillFile, /"\/blu-code-review":/);
  assert.match(skillFile, /commands\/blu-code-review\.toml/);
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
  assert.match(
    skillFile,
    /workflow\.code_review=false`, code-review routing must\s+never make `\/blu-secure-phase <phase>` mandatory, even when\s+`workflow\.secure_phase=true`\./
  );
  assert.match(
    skillFile,
    /workflow\.code_review=true`, `workflow\.secure_phase=true`, and the phase\s+still lacks a security artifact, prefer `\/blu-secure-phase <phase>`\./
  );
  assert.match(
    skillFile,
    /Keep `\/blu-secure-phase` manually runnable even\s+when it is not the preferred routed next step\./
  );
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

  assert.match(runtimeContract, /## Required MCP Calls/);
  assert.match(runtimeContract, /## Visible Code-Review Progress/);
  assert.match(
    runtimeContract,
    /resolve review phase[\s\S]*load review contract and scope[\s\S]*confirm review gates[\s\S]*inspect scoped files[\s\S]*validate review model[\s\S]*persist review artifact[\s\S]*route follow-up/i
  );
  assert.match(
    runtimeContract,
    /Gemini-native progress helpers are presentation mirrors only[\s\S]*do not\s+expand the MCP tool allowlist, persistence authority, reviewer authority,\s+scope authority, validation authority, routing authority, or user confirmation\s+authority/i
  );
  assert.match(
    runtimeContract,
    /Emit exceptional updates for\s+invalid phase resolution, disabled review, invalid explicit file scope,\s+scope-confirmation waits/i
  );
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
  assert.match(runtimeContract, /retry validation\s+once before persistence/i);
  assert.match(runtimeContract, /confirmationRecommended/);
  assert.match(runtimeContract, /scopeSource/);
  assert.match(runtimeContract, /reviewMode\.source/);
  assert.match(runtimeContract, /renderer preview only/i);
  assert.match(runtimeContract, /contract\.modelContract\.jsonSchema/);
  assert.match(
    runtimeContract,
    /when effective config has `workflow\.code_review=false`, code-review routing\s+never makes `\/blu-secure-phase <phase>` mandatory even when\s+`workflow\.secure_phase=true`/
  );
  assert.match(
    runtimeContract,
    /when effective config has `workflow\.code_review=true`,\s+`workflow\.secure_phase=true`, and security is still missing/
  );
  assert.match(
    runtimeContract,
    /`\/blu-secure-phase <phase>` stays primary/
  );
  assert.match(
    runtimeContract,
    /when effective config has `workflow\.code_review=true`,\s+`workflow\.secure_phase=true`, security is still missing, and concrete\s+follow-up fixes remain/
  );
  assert.match(
    runtimeContract,
    /`\/blu-code-review-fix <phase>` remains visible as\s+the secondary queued follow-up/
  );
  assert.match(
    runtimeContract,
    /`\/blu-secure-phase` remains manually runnable even when code-review does not\s+choose it as the preferred routed follow-up/
  );
  assert.match(
    runtimeContract,
    /when effective config has `workflow\.code_review=true` and\s+`workflow\.secure_phase=false`, concrete follow-up findings route to\s+`\/blu-code-review-fix <phase>` and otherwise the command routes to\s+`\/blu-progress` or another implemented validation-safe or progress-safe\s+action/
  );
  assert.match(
    runtimeContract,
    /secondary queued code-review-fix recommendation when security still routes first/i
  );
  assert.match(runtimeContract, /scoped file:line or\s+line-range location, evidence, impact, and recommendation/i);

  assert.match(reviewerAgent, /## Depth-Aware Review Expectations/);
  assert.match(reviewerAgent, /## Explicit Review-Fix Reuse Contract/);
  assert.match(reviewerAgent, /\/blu-code-review-fix/);
  assert.match(reviewerAgent, /`fix`, `defer`, or `skip`/);
  assert.match(reviewerAgent, /staleEvidence/);
  assert.match(reviewerAgent, /Do not persist review-fix selections/i);
  assert.match(reviewerAgent, /severity is\s+`critical\|high\|medium\|low\|unknown`/i);
  assert.match(reviewerAgent, /scoped file:line evidence, impact, and concrete fix or\s+verification guidance/i);
  assert.doesNotMatch(reviewerAgent, /\/blu-audit-fix|peer-review/i);
});

test("code-review runtime metadata is source-owned and docs-free", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("code-review");
  const catalog = await blueprintCommandCatalog();
  const contract = await buildBlueprintCommandRuntimeContractResource("code-review");

  assert.ok(metadata);
  assert.equal(metadata.spec.path, "src/mcp/command-runtime-metadata.ts#code-review");
  assert.equal(metadata.runtimeReference.path, "src/mcp/command-runtime-metadata.ts#code-review");
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-review/references/code-review-runtime-contract.md"
  ]);
  assert.deepEqual(metadata.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_config_get",
    "blueprint_artifact_contract_read",
    "blueprint_review_scope",
    "blueprint_review_load_findings",
    "blueprint_review_validate_model",
    "blueprint_review_record"
  ]);

  assert.equal(catalog.commands["code-review"].specPath, metadata.spec.path);
  assert.equal(contract.catalog.specPath, metadata.spec.path);
  assert.equal(contract.spec?.path, metadata.spec.path);
  assert.equal(contract.runtimeReference?.path, metadata.runtimeReference.path);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.spec.path);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, metadata.requiredTools);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, ["blueprint-reviewer"]);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation profile for deterministic phase-scoped review/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /let blueprint_review_scope own review enablement, config-gated secure-phase routing posture, normalized depth defaults, saved evidence inventory, deterministic repo-file scoping, authoring context, and narrowed task schema/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /When workflow\.code_review=false, code-review routing must never make \/blu-secure-phase <phase> mandatory even if workflow\.secure_phase=true/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /when workflow\.code_review=true and workflow\.secure_phase=true and security is still missing, \/blu-secure-phase <phase> is the primary routed next action/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /when workflow\.code_review=true and workflow\.secure_phase=false, route concrete findings to code-review-fix and otherwise prefer progress-safe implemented next actions/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /\/blu-secure-phase remains manually runnable even when config-gated routing prefers another implemented next step/i
  );
  assert.match(contract.runtimeReference?.contractNotes ?? "", /modelContract\.jsonSchema/);
  assert.match(contract.runtimeReference?.contractNotes ?? "", /secondary queued follow-up/i);
  assert.deepEqual(contract.skillInputs, {
    skill: "blueprint-review",
    shared: [],
    commandSpecific: [
      "commands/blu-code-review.toml",
      "skills/blueprint-review/references/code-review-runtime-contract.md"
    ],
    effective: [
      "commands/blu-code-review.toml",
      "skills/blueprint-review/references/code-review-runtime-contract.md"
    ]
  });
  assert.doesNotMatch(JSON.stringify(contract), /docs\//);
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
