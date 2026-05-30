import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import {
  buildBlueprintCommandRuntimeContractResource
} from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { validateReportArtifactContent } from "../src/mcp/tools/artifacts.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("undo manifest references the maintenance skill, high-risk maintenance profile, and explicit revert confirmation guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-undo.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(
    commandFile,
    /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_phase_locate/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /undo-latest/);
  assert.match(commandFile, /`dirty-working-tree`, `detached-head`, `merge-in-progress`, or `missing-revert-target`/);
  assert.match(commandFile, /undo-confirmation/);
  assert.match(commandFile, /report-overwrite-confirmation/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /git revert/i);
  assert.match(commandFile, /git reset --hard/i);
  assert.match(commandFile, /After the revert attempt finishes, explicitly overwrite `undo-latest`/);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("maintenance skill captures undo visibility, report persistence, and destructive-git guardrails", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-undo/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_phase_locate/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(
    skillFile,
    /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /undo-latest/);
  assert.match(skillFile, /`dirty-working-tree`, `detached-head`, `merge-in-progress`, or `missing-revert-target`/);
  assert.match(skillFile, /undo-confirmation/);
  assert.match(skillFile, /report-overwrite-confirmation/);
  assert.match(skillFile, /git reset --hard/i);
  assert.match(skillFile, /report-before-mutate/i);
  assert.match(skillFile, /overwrite `undo-latest`[\s\S]*actual outcome, blockers, and stale-evidence fallout/i);
});

test("undo local runtime contract and runtime resource expose the destructive gate, waiting state, and next safe action contract", async () => {
  const [runtimeReference, runtimeContract] = await Promise.all([
    readFile(
      path.join(repoRoot, "skills/blueprint-maintenance/references/undo-runtime-contract.md"),
      "utf8"
    ),
    buildBlueprintCommandRuntimeContractResource("undo")
  ]);

  assert.match(runtimeReference, /Stage Mapping[\s\S]*Resolve[\s\S]*Read[\s\S]*Decide[\s\S]*Execute[\s\S]*Persist[\s\S]*Validate[\s\S]*Route/);
  assert.match(runtimeReference, /Dirty tree, detached HEAD, in-progress merge, or missing target is a hard stop/i);
  assert.match(runtimeReference, /undo-confirmation/);
  assert.match(runtimeReference, /report-overwrite-confirmation/);
  assert.match(runtimeReference, /`mcp_blueprint_blueprint_artifact_contract_read`/);
  assert.match(runtimeReference, /report\.undo/);
  assert.match(runtimeReference, /next safe action/i);

  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /undo-runtime-contract\.md/);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /hard-stop on dirty or unsafe git state/i);
  assert.ok(
    runtimeContract.runtimeReference?.exactMcpDestination.includes(
      "blueprint_artifact_contract_read"
    )
  );
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("undo canonical report contract requires populated contract-backed revert evidence", () => {
  const contract = readArtifactContract("report.undo");

  assert.deepEqual(contract.requiredHeadings, [
    "Requested Scope",
    "Branch State",
    "Affected Evidence And Digest Inputs",
    "Candidate Revert Set",
    "Dependency Impact",
    "Approved Revert Commands",
    "Mutation Outcome",
    "Next Safe Action"
  ]);
  assert.deepEqual(contract.lockedMarkers, [
    "**Scope:**",
    "**Reason:**",
    "**Execution mode:**",
    "**Pending gate:**",
    "**Current branch:**",
    "**HEAD:**",
    "**Working tree status:**",
    "**Merge state:**",
    "**Report overwrite status:**",
    "**Digest inputs used:**",
    "**Affected evidence:**",
    "**Stale evidence impact:**",
    "**Tracked files:**",
    "**Commit ledger:**",
    "**Dependency risk:**",
    "**Pending git commands:**",
    "**Approved git commands:**",
    "**Forbidden-command check:**",
    "**Revert outcome:**",
    "**Blockers:**"
  ]);
  assert.ok(
    contract.placeholderSignals.includes(
      "<requested undo scope such as commits|report overwrite|phase artifact>"
    )
  );
  assert.ok(contract.placeholderSignals.includes("<awaiting confirmation|approved|blocked>"));
  assert.ok(contract.placeholderSignals.includes("<commands awaiting approval or none>"));
  assert.ok(contract.placeholderSignals.includes("<passed|failed with blockers>"));
  assert.match(contract.authoringTemplate, /^# Undo Report$/m);
  assert.match(contract.authoringTemplate, /## Requested Scope/);
  assert.match(contract.authoringTemplate, /## Affected Evidence And Digest Inputs/);
  assert.match(contract.authoringTemplate, /## Candidate Revert Set/);
  assert.match(contract.authoringTemplate, /\| Commit \| Subject \| Scope \| Revert action \| Notes \|/);
  assert.match(contract.authoringTemplate, /\*\*Forbidden-command check:\*\*/);
  assert.match(contract.authoringTemplate, /<manual next action or \/blu-progress>/);

  const templateValidation = validateReportArtifactContent(
    contract.authoringTemplate,
    "undo-latest"
  );
  assert.equal(templateValidation.valid, false);
  assert.match(templateValidation.issues.join("\n"), /placeholder scaffold text/i);

  const legacyMinimalUndoReport = `# Undo Report

## Requested Scope

- Undo the latest revert.

## Branch State

- Branch looks clean.

## Mutation Outcome

- Not run.

## Next Safe Action

- /blu-progress
`;
  const legacyValidation = validateReportArtifactContent(
    legacyMinimalUndoReport,
    "undo-latest"
  );
  assert.equal(legacyValidation.valid, false);
  assert.match(
    legacyValidation.issues.join("\n"),
    /missing required section: Affected Evidence And Digest Inputs/i
  );
  assert.match(
    legacyValidation.issues.join("\n"),
    /missing required section: Candidate Revert Set/i
  );
  assert.match(
    legacyValidation.issues.join("\n"),
    /missing required section: Approved Revert Commands/i
  );

  const populatedUndoReport = `# Undo Report

## Requested Scope

- **Scope:** commits
- **Reason:** Revert the Wave 3 regression-only test commit after confirming the evidence package.
- **Execution mode:** confirmed-run
- **Pending gate:** approved

## Branch State

- **Current branch:** codex/bpbug-repair-run
- **HEAD:** def5678
- **Working tree status:** clean
- **Merge state:** not in progress
- **Report overwrite status:** new report

## Affected Evidence And Digest Inputs

- **Digest inputs used:** .blueprint/reports/ship-latest.md, .blueprint/phases/04-release-readiness/04-01-SUMMARY.md, tests/undo-metadata.test.ts
- **Affected evidence:** .blueprint/reports/ship-latest.md
- **Stale evidence impact:** Reverting the commit would invalidate the current ship report until it is regenerated.
- **Tracked files:** tests/undo-metadata.test.ts, tests/ship-metadata.test.ts

## Candidate Revert Set

- **Commit ledger:**

| Commit | Subject | Scope | Revert action | Notes |
|---|---|---|---|---|
| def5678 | test: cover ship undo report contracts | tests/ship-metadata.test.ts, tests/undo-metadata.test.ts | revert | Cleanly reverts the Wave 3 regression coverage if the shipping run must be backed out. |

## Dependency Impact

- **Dependency risk:** Reverting this commit removes the BPBUG-001 coverage that guards the stronger report contracts.

## Approved Revert Commands

- **Pending git commands:** none
- **Approved git commands:** git revert --no-edit def5678
- **Forbidden-command check:** passed

## Mutation Outcome

- **Revert outcome:** success
- **Blockers:** none

## Next Safe Action

- /blu-progress
`;
  const populatedValidation = validateReportArtifactContent(
    populatedUndoReport,
    "undo-latest"
  );

  assert.equal(populatedValidation.valid, true, populatedValidation.issues.join("\n"));

  const invalidSemanticValidation = validateReportArtifactContent(
    populatedUndoReport
      .replace("**Approved git commands:** git revert --no-edit def5678", "**Approved git commands:** git reset --hard HEAD~1")
      .replace("**Forbidden-command check:** passed", "**Forbidden-command check:** passed"),
    "undo-latest"
  );
  assert.equal(invalidSemanticValidation.valid, false);
  assert.match(
    invalidSemanticValidation.issues.join("\n"),
    /Undo report marker Approved git commands must not include destructive undo commands: git reset --hard\./
  );
  assert.match(
    invalidSemanticValidation.issues.join("\n"),
    /Undo report marker Forbidden-command check cannot be `passed` when destructive undo commands appear in the approved revert commands section\./
  );
});

test("repo-facing status docs treat undo as a shipped command", async () => {
  const [
    agentsFile,
    readmeFile,
    geminiFile,
    progressFile,
    memoryFile,
    catalog
  ] = await Promise.all([
    readFile(path.join(repoRoot, "AGENTS.md"), "utf8"),
    readFile(path.join(repoRoot, "README.md"), "utf8"),
    readFile(path.join(repoRoot, "GEMINI.md"), "utf8"),
    readFile(path.join(repoRoot, "PROGRESS.md"), "utf8"),
    readFile(path.join(repoRoot, "MEMORY.md"), "utf8"),
    blueprintCommandCatalog()
  ]);
  const metadata = getRuntimeOwnedCommandMetadata("undo");
  const entry = catalog.commands.undo;

  assert.ok(metadata);
  assert.equal(metadata.catalog.wave, 4);
  assert.equal(metadata.catalog.family, "Quality And Shipping");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.spec.executionProfile, "high-risk-maintenance");
  assert.equal(metadata.runtimeReference.waveTitle, "Quality And Shipping");
  assert.match(metadata.runtimeReference.contractNotes, /Docless manifest\+skill-owned runtime/i);
  assert.match(metadata.runtimeReference.contractNotes, /undo-runtime-contract\.md/);
  assert.match(metadata.runtimeReference.contractNotes, /hard-stop on dirty or unsafe git state/i);
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, metadata.sourceId);
  assert.match(agentsFile, /`undo`/i);
  assert.match(readmeFile, /`\/blu-undo`/);
  assert.match(geminiFile, /`\/blu-undo`/);
  assert.match(
    progressFile,
    /\| [0-9]+ \| `undo` \| ✅ \| `implemented` \| 4 \| `Quality And Shipping` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `undo` \| ❌ \| `planned` \| 4 \| `Quality And Shipping` \| High \|/
  );
  assert.match(memoryFile, /`undo` shipped on 2026-04-16/);
});
