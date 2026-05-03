import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import {
  buildBlueprintCommandRuntimeContractResource
} from "../src/mcp/command-resources.js";
import { validateReportArtifactContent } from "../src/mcp/tools/artifacts.js";

const repoRoot = process.cwd();

test("ship manifest references the maintenance skill, report tool, and explicit remote confirmation guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-ship.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_phase_locate/);
  assert.match(commandFile, /mcp_blueprint_blueprint_config_get/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(commandFile, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /pair it with visible `write_todos`/i);
  assert.match(commandFile, /When tracker support is unavailable, keep the same shipping flow linear/i);
  assert.match(commandFile, /ship-latest/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /draft versus ready PR mode/i);
  assert.match(commandFile, /gh/i);
  assert.match(commandFile, /manual fallback/i);
  assert.match(commandFile, /After the approved push or PR attempt finishes, explicitly overwrite `ship-latest`/);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("ship doc, maintenance skill, and runtime resource capture ship visibility, tracker eligibility, and remote fallback safety", async () => {
  const docFile = await readFile(path.join(repoRoot, "docs/commands/ship.md"), "utf8");
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"),
    "utf8"
  );
  const runtimeContract = await buildBlueprintCommandRuntimeContractResource("ship");

  assert.match(docFile, /Execution profile \| `high-risk-maintenance`/);
  assert.match(docFile, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(docFile, /resolved scope, active stage, pending gate, execution mode, next safe action/i);
  assert.match(docFile, /`update_topic` tool/i);
  assert.match(docFile, /`write_todos`/);
  assert.match(docFile, /tracker-eligible/i);
  assert.match(docFile, /session-local coordination only and must be paired with visible `write_todos`/i);
  assert.match(docFile, /When tracker support is unavailable, keep the same shipping flow linear/i);
  assert.match(docFile, /`blueprint_artifact_contract_read` -> `\{artifactId, contract\}`/);
  assert.match(docFile, /contract\.authoringTemplate/);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-ship/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_phase_locate/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/i);
  assert.match(skillFile, /`update_topic` tool/i);
  assert.match(skillFile, /`write_todos`/);
  assert.match(skillFile, /tracker-eligible/i);
  assert.match(skillFile, /session-local coordination only/i);
  assert.match(skillFile, /dirty working tree/i);
  assert.match(skillFile, /optional push, and optional PR creation are separate steps/i);
  assert.match(skillFile, /ship-latest/);
  assert.match(skillFile, /missing or unauthenticated/i);
  assert.match(skillFile, /overwrite `ship-latest`[\s\S]*actual outcomes, fallback notes, and post-mutation evidence/i);

  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.deepEqual(
    runtimeContract.runtimeReference?.exactMcpDestination,
    runtimeContract.catalog.requiredTools
  );
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /ship-runtime-contract\.md/);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /local prep, push, and PR creation as separate approved steps/i
  );
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("ship canonical report contract requires populated contract-backed evidence", () => {
  const contract = readArtifactContract("report.ship");

  assert.deepEqual(contract.requiredHeadings, [
    "Selected Scope",
    "Saved Evidence",
    "Branch Plan",
    "Remote Actions",
    "Push Or PR Outcome",
    "Manual Fallback Guidance",
    "Next Safe Action"
  ]);
  assert.deepEqual(contract.lockedMarkers, [
    "**Scope:**",
    "**Source branch:**",
    "**Source HEAD:**",
    "**Base branch:**",
    "**Execution mode:**",
    "**Draft or ready mode:**",
    "**Config used:**",
    "**Current branch:**",
    "**Digest inputs used:**",
    "**Saved evidence paths:**",
    "**Tracked files:**",
    "**Draft PR body source:**",
    "**Push requested:**",
    "**PR requested:**",
    "**Git commands approved:**",
    "**gh commands approved:**",
    "**gh availability and auth:**",
    "**Push outcome:**",
    "**PR outcome:**",
    "**gh fallback notes:**",
    "**Manual checklist:**"
  ]);
  assert.ok(
    contract.placeholderSignals.includes("<selected scope such as review-branch|current-branch|commits>")
  );
  assert.ok(contract.placeholderSignals.includes("<draft|ready>"));
  assert.ok(
    contract.placeholderSignals.includes("<base branch value>")
  );
  assert.ok(contract.placeholderSignals.includes("<branching strategy value>"));
  assert.ok(
    contract.placeholderSignals.includes(
      "<available and authenticated|available but unauthenticated|unavailable>"
    )
  );
  assert.ok(contract.placeholderSignals.includes("<manual step one>"));
  assert.match(contract.authoringTemplate, /^# Ship Report$/m);
  assert.match(contract.authoringTemplate, /## Selected Scope/);
  assert.match(contract.authoringTemplate, /## Saved Evidence/);
  assert.match(contract.authoringTemplate, /## Remote Actions/);
  assert.match(contract.authoringTemplate, /\*\*Draft PR body source:\*\*/);
  assert.match(
    contract.authoringTemplate,
    /\*\*Config used:\*\* git\.base_branch=<base branch value>; git\.branching_strategy=<branching strategy value>; planning\.commit_docs=<true\|false>/
  );
  assert.match(contract.authoringTemplate, /\*\*Manual checklist:\*\*/);
  assert.match(contract.authoringTemplate, /<manual next action or \/blu-progress>/);

  const templateValidation = validateReportArtifactContent(
    contract.authoringTemplate,
    "ship-latest"
  );
  assert.equal(templateValidation.valid, false);
  assert.match(templateValidation.issues.join("\n"), /placeholder scaffold text/i);

  const legacyMinimalShipReport = `# Ship Report

## Selected Scope

- Shipping the current branch.

## Branch Plan

- Push requested: yes.

## Push Or PR Outcome

- Not run yet.

## Next Safe Action

- /blu-progress
`;
  const legacyValidation = validateReportArtifactContent(
    legacyMinimalShipReport,
    "ship-latest"
  );
  assert.equal(legacyValidation.valid, false);
  assert.match(legacyValidation.issues.join("\n"), /missing required section: Saved Evidence/i);
  assert.match(legacyValidation.issues.join("\n"), /missing required section: Remote Actions/i);
  assert.match(
    legacyValidation.issues.join("\n"),
    /missing required section: Manual Fallback Guidance/i
  );

  const populatedShipReport = `# Ship Report

## Selected Scope

- **Scope:** review-branch
- **Source branch:** codex/bpbug-repair-run
- **Source HEAD:** abc1234
- **Base branch:** main
- **Execution mode:** confirmed-run
- **Draft or ready mode:** draft
- **Config used:** git.base_branch=main; git.branching_strategy=phase; planning.commit_docs=true
- **Current branch:** codex/bpbug-repair-run

## Saved Evidence

- **Digest inputs used:** .blueprint/ROADMAP.md, .blueprint/reports/pr-branch-latest.md, tests/ship-metadata.test.ts
- **Saved evidence paths:** .blueprint/reports/pr-branch-latest.md
- **Tracked files:** tests/ship-metadata.test.ts, tests/undo-metadata.test.ts
- **Draft PR body source:** generated body

## Branch Plan

- **Push requested:** true
- **PR requested:** true
- **Git commands approved:** git push origin codex/bpbug-repair-run

## Remote Actions

- **gh commands approved:** gh pr create --draft --base main --head codex/bpbug-repair-run
- **gh availability and auth:** available and authenticated

## Push Or PR Outcome

- **Push outcome:** success
- **PR outcome:** created
- **gh fallback notes:** none

## Manual Fallback Guidance

- **Manual checklist:**
  1. Confirm the pushed branch matches the approved scope.
  2. Open the draft PR and verify the generated body cites the saved evidence.
  3. Route the next reviewer to the PR and saved ship report.

## Next Safe Action

- /blu-progress
`;
  const populatedValidation = validateReportArtifactContent(
    populatedShipReport,
    "ship-latest"
  );

  assert.equal(populatedValidation.valid, true, populatedValidation.issues.join("\n"));

  const invalidConfigPlaceholderValidation = validateReportArtifactContent(
    populatedShipReport.replace(
      "git.base_branch=main; git.branching_strategy=phase; planning.commit_docs=true",
      "git.base_branch=<base branch value>; git.branching_strategy=phase; planning.commit_docs=true"
    ),
    "ship-latest"
  );
  assert.equal(invalidConfigPlaceholderValidation.valid, false);
  assert.match(
    invalidConfigPlaceholderValidation.issues.join("\n"),
    /placeholder scaffold text: <base branch value>/i
  );

  const invalidSemanticValidation = validateReportArtifactContent(
    populatedShipReport
      .replace("**Execution mode:** confirmed-run", "**Execution mode:** yolo")
      .replace("**Push requested:** true", "**Push requested:** maybe"),
    "ship-latest"
  );
  assert.equal(invalidSemanticValidation.valid, false);
  assert.match(
    invalidSemanticValidation.issues.join("\n"),
    /Ship report marker Execution mode must use one of: preview-only, confirmed-run, blocked\./
  );
  assert.match(
    invalidSemanticValidation.issues.join("\n"),
    /Ship report marker Push requested must use one of: true, false\./
  );
});
