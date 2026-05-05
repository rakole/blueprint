import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { blueprintToolNames } from "../src/mcp/server.js";

const repoRoot = process.cwd();

test("audit-fix docs and catalog metadata promote the remediation slice to implemented", async () => {
  const [catalogMarkdown, implementationOrder, auditFixDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/IMPLEMENTATION-ORDER.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/audit-fix.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `audit-fix` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `\.blueprint\/reports\/audit-fix-<phase>\.md; optional \.blueprint\/todos\/TODO\.md; repo code changes when not dry-running; \.blueprint\/STATE\.md` \| `High: bounded remediation plus report\/state updates\.` \|/
  );
  assert.match(
    implementationOrder,
    /Shipped in this wave: `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `docs-update`, `add-tests`, `pr-branch`, `ship`, and `undo`\./
  );
  assert.match(auditFixDoc, /--source <review\|security\|verification\|uat\|all>/);
  assert.match(auditFixDoc, /--severity <medium\|high\|all>/);
  assert.match(auditFixDoc, /--max N/);
  assert.match(auditFixDoc, /--dry-run/);
  assert.match(auditFixDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(auditFixDoc, /## Shared Runtime Contract/);
  assert.match(auditFixDoc, /ask_user/);
  assert.match(auditFixDoc, /## In-Flight Progress Contract/);
  assert.match(
    auditFixDoc,
    /skills\/blueprint-review\/references\/audit-fix-runtime-contract\.md/
  );
  assert.match(auditFixDoc, /classification table before mutation/i);
  assert.match(auditFixDoc, /`auto-fixable`, `manual-only`, or `skip`/);
  assert.match(auditFixDoc, /auditFixContext \{source, severity, maxAttempts, dryRun, scopeFiles\}/i);
  assert.match(
    auditFixDoc,
    /`status`, `readiness`, `completionState`, `remediationSummary`, `summaryEvidence`, `classification`, `changesApplied`, `verification`, `pendingPlans`, `dependencyPlans`, `manualOrDeferredWork`, `gapRoutes`, `followUpFixes`, `evidence`, `commitTraceability`, `todoCapture`, and `nextSafeAction`/i
  );
  assert.match(
    auditFixDoc,
    /repair the structured model against the canonical `report\.audit-fix` contract, the narrowed `taskSchema`, `repairSummary`, and returned diagnostics by exact `path`, `code`, `repair`, `allowedValues`, `missing`, and `argsPatch`/i
  );
  assert.match(auditFixDoc, /Browser-only, web-search-only, shell-only, or generic agents are not substitutes/i);
  assert.match(auditFixDoc, /resolved scope, active stage, pending gate, execution mode, next safe action/i);
  assert.match(auditFixDoc, /`update_topic` tool and keep a compact remediation checklist with `write_todos`/i);
  assert.match(auditFixDoc, /report overwrite confirmation/i);
  assert.match(auditFixDoc, /verification progress, early-stop status, report status/i);
  assert.match(auditFixDoc, /## Tracker Eligibility/);
  assert.match(auditFixDoc, /tracker-eligible/i);
  assert.match(auditFixDoc, /session-local coordination only and must be paired with visible `write_todos`/i);
  assert.match(runtimeReference, /The planned `blueprint-fixer` remains unshipped and is not an active required runtime path\./);
  assert.match(runtimeReference, /`audit-fix`[\s\S]*Long-running-mutation profile for bounded audit-driven remediation/i);
  assert.match(runtimeReference, /`audit-fix`[\s\S]*resolved scope, active stage, pending gate, execution mode, and next safe action visible/i);
  assert.match(runtimeReference, /`audit-fix`[\s\S]*`update_topic` and `write_todos` for non-trivial audit-fix runs/i);
  assert.match(runtimeReference, /`audit-fix`[\s\S]*tracker-eligible session-local coordination paired with visible todos/i);
  assert.match(runtimeReference, /`audit-fix`[\s\S]*report overwrite or todo capture explicit/i);
  assert.match(runtimeReference, /`audit-fix`[\s\S]*verification progress, report status, and early-stop state explicit/i);
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*load `skills\/blueprint-review\/references\/audit-fix-runtime-contract\.md`/i
  );
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*classify from saved evidence selected by `--source` into `auto-fixable`, `manual-only`, and `skip` rows before mutation/i
  );
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*pass `auditFixContext \{source, severity, maxAttempts, dryRun, scopeFiles\}` through the report tool flow/i
  );
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*author only the model fields `status`, `readiness`, `completionState`, `remediationSummary`/i
  );
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*preserve the single-agent no-subagent fallback that processes one finding at a time with carry-forward compression/i
  );
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*reject browser\/web-search\/shell-only or generic agents as substitutes/i
  );
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*repair invalid models by exact diagnostic `path`, `code`, `repair`, `allowedValues`, `missing`, `argsPatch`, and `repairSummary` guidance/i
  );
});

test("audit-fix is exposed as an implemented remediation command with the registered tools", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["audit-fix"];

  assert.ok(blueprintToolNames.includes("blueprint_review_scope"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_contract_read"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_report_authoring_context"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_report_validate_model"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_report_write"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_mutate_index"));
  assert.ok(blueprintToolNames.includes("blueprint_state_update"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-audit-fix.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_review_scope",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_report_authoring_context",
    "blueprint_artifact_report_validate_model",
    "blueprint_artifact_report_write",
    "blueprint_artifact_mutate_index",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-reviewer",
    "blueprint-verifier"
  ]);
});
