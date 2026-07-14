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

test("ship manifest references the maintenance skill, runtime-owned executor, and explicit remote confirmation guards", async () => {
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
  assert.match(
    commandFile,
    /executor owns the underlying `mcp_blueprint_blueprint_artifact_report_write` and `mcp_blueprint_blueprint_state_update` calls/
  );
  assert.match(commandFile, /mcp_blueprint_blueprint_ship_preview/);
  assert.match(commandFile, /mcp_blueprint_blueprint_ship_execute/);
  assert.match(commandFile, /mcp_blueprint_blueprint_ship_persist/);
  assert.match(commandFile, /Never run model-authored git or `gh` mutation commands/);
  assert.match(commandFile, /`workflow\.secure_phase` defaults to `false`/);
  assert.match(commandFile, /`\/blu-secure-phase` remains manually runnable and implemented/i);
  assert.match(commandFile, /`workflow\.code_review=false`/);
  assert.match(commandFile, /never make security evidence mandatory regardless of `workflow\.secure_phase`/);
  assert.match(commandFile, /`workflow\.code_review=true` and `workflow\.secure_phase=false`/);
  assert.match(commandFile, /review evidence may still be mandatory while security evidence is not/);
  assert.match(commandFile, /require code-review evidence first and secure-phase or security evidence after that before ready shipping/);
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

test("ship local runtime contract, maintenance skill, and runtime resource capture ship visibility, tracker eligibility, and remote fallback safety", async () => {
  const [runtimeReference, skillFile, runtimeContract] = await Promise.all([
    readFile(
      path.join(repoRoot, "skills/blueprint-maintenance/references/ship-runtime-contract.md"),
      "utf8"
    ),
    readFile(path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"), "utf8"),
    buildBlueprintCommandRuntimeContractResource("ship")
  ]);

  assert.match(runtimeReference, /Stage Mapping[\s\S]*Resolve[\s\S]*Read[\s\S]*Decide[\s\S]*Execute[\s\S]*Persist[\s\S]*Validate[\s\S]*Route/);
  assert.match(runtimeReference, /Resolve the shipping scope explicitly/i);
  assert.match(runtimeReference, /Treat effective `workflow\.code_review` and `workflow\.secure_phase` as the shipping gate authority/i);
  assert.match(runtimeReference, /`workflow\.code_review=false`/);
  assert.match(runtimeReference, /security evidence is never mandatory regardless of `workflow\.secure_phase`/);
  assert.match(runtimeReference, /`workflow\.code_review=true` and `workflow\.secure_phase=false`/);
  assert.match(runtimeReference, /review evidence may still be mandatory while security evidence is not/);
  assert.match(runtimeReference, /require code-review evidence first and secure-phase or security evidence after that before ready shipping/);
  assert.match(runtimeReference, /Missing config-required review or security evidence blocks ready shipping/i);
  assert.match(runtimeReference, /next safe action/i);
  assert.match(runtimeReference, /`update_topic`, `write_todos`, and tracker state are session-local only/);
  assert.match(runtimeReference, /If `gh` is missing, unauthenticated, or declined, skip PR creation and preserve manual fallback guidance/);
  assert.match(runtimeReference, /`mcp_blueprint_blueprint_artifact_contract_read`/);
  assert.match(runtimeReference, /report\.ship/);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-ship/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_phase_locate/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /blueprint_ship_preview/);
  assert.match(skillFile, /blueprint_ship_execute/);
  assert.match(skillFile, /blueprint_ship_persist/);
  assert.match(skillFile, /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/i);
  assert.match(skillFile, /`update_topic` tool/i);
  assert.match(skillFile, /`write_todos`/);
  assert.match(skillFile, /tracker-eligible/i);
  assert.match(skillFile, /session-local coordination only/i);
  assert.match(skillFile, /dirty working tree/i);
  assert.match(skillFile, /optional push, and optional PR creation are separate steps/i);
  assert.match(skillFile, /`workflow\.secure_phase` defaults to `false`/);
  assert.match(skillFile, /`\/blu-secure-phase` remains manually runnable and implemented/i);
  assert.match(skillFile, /`workflow\.code_review=false`/);
  assert.match(skillFile, /security evidence is never mandatory regardless of `workflow\.secure_phase`/);
  assert.match(skillFile, /`workflow\.code_review=true` and `workflow\.secure_phase=false`/);
  assert.match(skillFile, /review evidence may still be mandatory while security evidence is not/);
  assert.match(skillFile, /require code-review evidence first and secure-phase or security evidence before ready shipping/);
  assert.match(skillFile, /ship-latest/);
  assert.match(skillFile, /missing or unauthenticated/i);
  assert.match(skillFile, /overwrite `ship-latest`/i);
  assert.match(skillFile, /actual outcomes, fallback notes, post-mutation evidence, and the config-aware gate posture/i);

  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.ok(runtimeContract.catalog.requiredTools.includes("blueprint_ship_preview"));
  assert.ok(runtimeContract.catalog.requiredTools.includes("blueprint_ship_execute"));
  assert.ok(runtimeContract.catalog.requiredTools.includes("blueprint_ship_persist"));
  assert.deepEqual(
    runtimeContract.runtimeReference?.exactMcpDestination,
    runtimeContract.catalog.requiredTools
  );
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /ship-runtime-contract\.md/);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /local prep, push, and PR creation as separate approved steps/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /workflow\.secure_phase defaults false/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /workflow\.code_review=false[\s\S]*security evidence is never mandatory regardless of workflow\.secure_phase/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /workflow\.code_review=true and workflow\.secure_phase=false[\s\S]*review evidence may be mandatory while security evidence is not/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /workflow\.code_review=true and workflow\.secure_phase=true[\s\S]*require code-review evidence first/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /\/blu-secure-phase remains manually runnable and implemented/i
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
    "**gh detail:**",
    "**Push outcome:**",
    "**PR outcome:**",
    "**Outcome blockers:**",
    "**Outcome recovery:**",
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
  assert.ok(contract.placeholderSignals.includes("<not-requested|ready|gh-missing|gh-unauthenticated|gh-repository-unavailable|pr-view-unavailable|pr-create-failed>"));
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
  assert.match(contract.authoringTemplate, /\*\*Push outcome:\*\* <not-run\|success\|failed\|blocked\|outcome-unknown>/);
  assert.match(contract.authoringTemplate, /\*\*PR outcome:\*\* <not-run\|created\|updated\|failed\|blocked\|outcome-unknown>/);
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
- **gh availability and auth:** ready
- **gh detail:** none

## Push Or PR Outcome

- **Push outcome:** success
- **PR outcome:** created
- **Outcome blockers:** none
- **Outcome recovery:** none
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
