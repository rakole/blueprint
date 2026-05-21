import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("audit-fix runtime metadata is source-owned and docs-free", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("audit-fix");
  const catalog = await blueprintCommandCatalog();
  const contract = await buildBlueprintCommandRuntimeContractResource("audit-fix");

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#audit-fix");
  assert.equal(metadata.spec.path, metadata.sourceId);
  assert.equal(metadata.runtimeReference.path, metadata.sourceId);
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-review/references/audit-fix-runtime-contract.md"
  ]);

  assert.equal(catalog.commands["audit-fix"].specPath, metadata.sourceId);
  assert.deepEqual(catalog.commands["audit-fix"].requiredTools, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(catalog.commands["audit-fix"].optionalAgents, [
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
      "commands/blu-audit-fix.toml",
      "skills/blueprint-review/references/audit-fix-runtime-contract.md"
    ],
    effective: [
      "commands/blu-audit-fix.toml",
      "skills/blueprint-review/references/audit-fix-runtime-contract.md"
    ]
  });
  assert.doesNotMatch(JSON.stringify(contract), /docs\//);
});

test("audit-fix manifest references the remediation tools, agents, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-audit-fix.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(
    commandFile,
    /skills\/blueprint-review\/references\/audit-fix-runtime-contract\.md/
  );
  assert.match(commandFile, /same-named Gemini CLI agent tools/);
  assert.match(commandFile, /`blueprint-reviewer` with a bounded findings-classification task packet/);
  assert.match(commandFile, /`blueprint-verifier` with a bounded post-fix verification task packet/);
  assert.match(commandFile, /Treat `blueprint-fixer` as planned-only inventory/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/
  );
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /session-local coordination only, pair it with visible `write_todos`/i);
  assert.match(
    commandFile,
    /keep the same bounded flow linear with an explicit next safe step/i
  );
  assert.match(commandFile, /`--source <review\|security\|verification\|uat\|all>`/);
  assert.match(commandFile, /`--severity <medium\|high\|all>`/);
  assert.match(commandFile, /`--max <N>`/);
  assert.match(commandFile, /`--dry-run`/);
  assert.match(commandFile, /ask_user/);
  assert.match(
    commandFile,
    /pending gate \(`none`, non-trivial mutation confirmation, report overwrite confirmation, or todo capture confirmation\)/i
  );
  assert.match(
    commandFile,
    /execution mode \(`dry-run` versus mutation, inline versus reviewer\/verifier-assisted\)/i
  );
  assert.match(commandFile, /verification progress, report status, next safe action/i);
  assert.match(commandFile, /Stop on the first failed mutation or failed required verification/);
  assert.match(commandFile, /early-stop reason/i);
  assert.match(commandFile, /commit traceability/i);
  assert.match(commandFile, /classification \(`auto-fixable`, `manual-only`, or `skip`\)/i);
  assert.match(commandFile, /no-subagent fallback/i);
  assert.match(commandFile, /auditFixContext \{source, severity, maxAttempts, dryRun, scopeFiles\}/i);
  assert.match(
    commandFile,
    /`status`, `readiness`, `completionState`, `remediationSummary`, `summaryEvidence`, `classification`, `changesApplied`, `verification`, `pendingPlans`, `dependencyPlans`, `manualOrDeferredWork`, `gapRoutes`, `followUpFixes`, `evidence`, `commitTraceability`, `todoCapture`, and `nextSafeAction`/i
  );
  assert.match(commandFile, /Do not duplicate `auditFixContext` or rendered marker values inside the model/i);
  assert.match(
    commandFile,
    /repair the structured model against the returned structured diagnostics and retry the MCP flow once/i
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_scope")));
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read"))
  );
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_authoring_context"))
  );
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_validate_model"))
  );
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write"))
  );
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_mutate_index"))
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /audit-fix-<phase>/);
  assert.match(commandFile, /\/blu-code-review/);
  assert.match(commandFile, /\/blu-verify-work/);
  assert.match(commandFile, /\/blu-add-tests/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(
    commandFile,
    /skills\/blueprint-review\.md|agents\/blueprint-reviewer\.md|agents\/blueprint-verifier\.md/
  );
});

test("blueprint-review skill captures audit-fix report-backed remediation rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-audit-fix/);
  assert.match(skillFile, /### `audit-fix`/);
  assert.match(skillFile, /skills\/blueprint-review\/references\/audit-fix-runtime-contract\.md/);
  assert.match(skillFile, /stage mapping, required MCP call controls, report\s+authoring richness/i);
  assert.match(skillFile, /Execution profile for `audit-fix`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /Each command-local runtime contract owns the detailed stage vocabulary, in-flight status fields, and waiting-state semantics/
  );
  assert.match(skillFile, /blueprint_artifact_report_authoring_context/);
  assert.match(skillFile, /blueprint_artifact_report_validate_model/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /--source/);
  assert.match(skillFile, /--severity/);
  assert.match(skillFile, /--max/);
  assert.match(skillFile, /--dry-run/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /classification table before mutation/i);
  assert.match(skillFile, /`auto-fixable`, `manual-only`, or `skip`/);
  assert.match(skillFile, /Reject browser-only, web-search-only, shell-only, or generic agents/i);
  assert.match(skillFile, /no-subagent fallback from the runtime\s+contract/i);
  assert.match(skillFile, /auditFixContext \{source, severity, maxAttempts, dryRun, scopeFiles\}/i);
  assert.match(
    skillFile,
    /`status`, `readiness`, `completionState`, `remediationSummary`, `summaryEvidence`, `classification`, `changesApplied`, `verification`, `pendingPlans`, `dependencyPlans`, `manualOrDeferredWork`, `gapRoutes`, `followUpFixes`, `evidence`, `commitTraceability`, `todoCapture`, and `nextSafeAction`/i
  );
  assert.match(
    skillFile,
    /repair the structured report against the canonical `report\.audit-fix`\s+contract, the narrowed task schema, and returned diagnostics/i
  );
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /tracker-eligible/i);
  assert.match(skillFile, /session-local coordination only/i);
  assert.match(skillFile, /report overwrite handling/i);
  assert.match(
    skillFile,
    /candidate count, attempt index \(`i\/N`\), remediation progress,\s+verification progress,\s+report status/i
  );
  assert.match(skillFile, /dry-run versus mutation plus inline versus\s+reviewer\/verifier-assisted remediation/i);
  assert.match(skillFile, /stop-on-first-failure/i);
  assert.match(skillFile, /planned `blueprint-fixer` is not a shipped[\s\S]*runtime path/);
  assert.match(skillFile, /audit-fix-<phase>/);
  assert.match(skillFile, /\/blu-validate-phase <phase>/);
  assert.match(skillFile, /\/blu-add-tests <phase>/);
  assert.match(skillFile, /\/blu-progress/);
});

test("audit-fix runtime contract preserves retained classification, fallback, and repair behavior", async () => {
  const runtimeContract = await readFile(
    path.join(repoRoot, "skills/blueprint-review/references/audit-fix-runtime-contract.md"),
    "utf8"
  );

  for (const heading of ["Resolve", "Read", "Decide", "Execute", "Persist", "Validate", "Route"]) {
    assert.match(runtimeContract, new RegExp(`### ${heading}`));
  }

  for (const tool of [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_review_scope",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_report_authoring_context",
    "blueprint_artifact_report_validate_model",
    "blueprint_artifact_report_write",
    "blueprint_artifact_mutate_index",
    "blueprint_state_update"
  ]) {
    assert.match(runtimeContract, new RegExp(`- \`${tool}\``));
  }

  assert.match(runtimeContract, /Classification values are `auto-fixable`, `manual-only`, or `skip`/);
  assert.match(runtimeContract, /Produce a classification table before mutation/i);
  assert.match(runtimeContract, /When uncertain, prefer `manual-only`/);
  assert.match(runtimeContract, /Process one capped `auto-fixable` finding at a time/);
  assert.match(runtimeContract, /Stop on the first failed mutation or failed required verification/);
  assert.match(runtimeContract, /`--dry-run` mode, do not mutate repo files/);
  assert.match(runtimeContract, /Commit traceability must include the pre-fix HEAD reference/i);
  assert.match(runtimeContract, /`Evidence Used`/);
  assert.match(runtimeContract, /`Fix Scope`/);
  assert.match(runtimeContract, /`Changes Applied`/);
  assert.match(runtimeContract, /`Remaining Gaps`/);
  assert.match(runtimeContract, /`Next Safe Action`/);
  assert.match(runtimeContract, /`Source`/);
  assert.match(runtimeContract, /`Severity Filter`/);
  assert.match(runtimeContract, /`Max Attempts`/);
  assert.match(runtimeContract, /`Dry Run`/);
  assert.match(runtimeContract, /auditFixContext \{source, severity, maxAttempts,\s+dryRun, scopeFiles\}/i);
  assert.match(
    runtimeContract,
    /`remediationSummary`, `summaryEvidence`,\s+`classification`, `changesApplied`, `verification`, `pendingPlans`,\s+`dependencyPlans`, `manualOrDeferredWork`, `gapRoutes`, `followUpFixes`,\s+`evidence`, `commitTraceability`, `todoCapture`, and `nextSafeAction`/i
  );
  assert.match(runtimeContract, /same-named tools/i);
  assert.match(runtimeContract, /bounded read-only classification task packet/i);
  assert.match(runtimeContract, /bounded post-fix verification task packet/i);
  assert.match(runtimeContract, /## No-Subagent Fallback/);
  assert.match(
    runtimeContract,
    /1\. Read selected saved evidence and scoped files\.[\s\S]*2\. Classify findings into `auto-fixable`, `manual-only`, or `skip`\.[\s\S]*3\. Present the classification table[\s\S]*4\. Process one capped finding at a time\./
  );
  assert.match(
    runtimeContract,
    /Invalid report model or write: repair once against `report\.audit-fix`/i
  );
  assert.match(
    runtimeContract,
    /`contract\.modelContract\.schemaPath`, the narrowed `taskSchema`,\s+`repairSummary`, and structured MCP diagnostics/i
  );
  assert.match(runtimeContract, /Failed retry: stop with the top three diagnostics plus `suggestedRepairs`/i);
  assert.match(runtimeContract, /No browser\/web\/search-only or generic agent was used as a substitute/i);
  assert.match(runtimeContract, /`blueprint-fixer` remained planned-only and non-routable/);
});

test("audit-fix agents include classification and post-fix verification quality expectations", async () => {
  const [reviewerAgent, verifierAgent] = await Promise.all([
    readFile(path.join(repoRoot, "agents/blueprint-reviewer.md"), "utf8"),
    readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8")
  ]);

  assert.match(reviewerAgent, /\/blu-code-review/);
  assert.match(reviewerAgent, /non-code-review reuse contract/i);
  assert.match(reviewerAgent, /Do not act as a fixer or executor agent/i);
  assert.doesNotMatch(reviewerAgent, /\/blu-audit-fix|auto-fixable\/manual-only\/skip|mutation-safe candidate table/i);

  assert.match(verifierAgent, /\/blu-audit-fix/);
  assert.match(verifierAgent, /Audit-fix verification mode/i);
  assert.match(verifierAgent, /`VERIFIED`, `GAPS`, or `BLOCKED`/);
  assert.match(verifierAgent, /do not declare `VERIFIED` from intent\s+alone/i);
  assert.match(verifierAgent, /audit-fix verification rows with finding id, changed files, check result/i);
});
