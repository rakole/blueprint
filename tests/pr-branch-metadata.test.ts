import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  readArtifactContract
} from "../src/mcp/artifact-contracts/index.js";
import {
  buildBlueprintCommandRuntimeContractResource
} from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import {
  validateReportArtifactContent
} from "../src/mcp/tools/artifacts.js";

const repoRoot = process.cwd();

test("pr-branch manifest references the maintenance skill, report tool, and git confirmation guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-pr-branch.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_config_get/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /skills\/blueprint-maintenance\/references\/pr-branch-runtime-contract\.md/);
  assert.match(commandFile, /pr-branch-latest/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /\.blueprint\/\*\*/);
  assert.match(commandFile, /planning\.commit_docs/);
  assert.match(commandFile, /contract\.authoringTemplate/);
  assert.match(commandFile, /commit classification ledger/i);
  assert.match(commandFile, /`code-only`, `blueprint-only`, `mixed`, or `empty-after-filter`/);
  assert.match(commandFile, /verification counts/i);
  assert.match(commandFile, /uncommitted changes/i);
  assert.match(commandFile, /pending gate `clean-working-tree`/);
  assert.match(commandFile, /pending gate as `review-branch-confirmation`/);
  assert.match(commandFile, /`report-overwrite-confirmation`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("maintenance skill captures pr-branch filtering, report persistence, and source-branch safety", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-pr-branch/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_config_get/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /pr-branch-runtime-contract\.md/);
  assert.match(skillFile, /commit classification/i);
  assert.match(skillFile, /`code-only`, `blueprint-only`, `mixed`, and `empty-after-filter`/);
  assert.match(skillFile, /canonical authoring template/i);
  assert.match(skillFile, /repair once/i);
  assert.match(skillFile, /excluding `?\.blueprint\/\*\*`? bookkeeping paths/i);
  assert.match(skillFile, /dirty working tree/i);
  assert.match(skillFile, /pending gate `clean-working-tree`/);
  assert.match(skillFile, /`review-branch-confirmation`/);
  assert.match(skillFile, /report overwrite confirmation/i);
  assert.match(skillFile, /without rewriting or deleting the source branch in place/i);
  assert.match(skillFile, /clean status, retained file count, retained commit count/i);
  assert.match(skillFile, /pr-branch-latest/);
});

test("pr-branch runtime contract locks commit classification, fallback, and report repair behavior", async () => {
  const runtimeContract = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-maintenance/references/pr-branch-runtime-contract.md"
    ),
    "utf8"
  );

  assert.match(runtimeContract, /## Stage Mapping/);
  assert.match(runtimeContract, /### Resolve/);
  assert.match(runtimeContract, /### Read/);
  assert.match(runtimeContract, /### Decide/);
  assert.match(runtimeContract, /### Execute/);
  assert.match(runtimeContract, /### Persist/);
  assert.match(runtimeContract, /### Validate/);
  assert.match(runtimeContract, /### Route/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_project_status/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_config_get/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(runtimeContract, /`code-only`/);
  assert.match(runtimeContract, /`blueprint-only`/);
  assert.match(runtimeContract, /`mixed`/);
  assert.match(runtimeContract, /`empty-after-filter`/);
  assert.match(runtimeContract, /contract\.authoringTemplate/);
  assert.match(runtimeContract, /repair the report once/i);
  assert.match(runtimeContract, /No-subagent fallback is the canonical behavior/i);
  assert.match(runtimeContract, /Browser, web-search-only, shell-only, and generic agents are forbidden/i);
  assert.match(runtimeContract, /clean branch state/i);
  assert.match(runtimeContract, /retained file\/commit counts/i);
});

test("pr-branch local runtime contract, runtime resource, and artifact contract expose the richer review-branch contract", async () => {
  const [runtimeReference, artifactContract, runtimeContract] = await Promise.all([
    readFile(
      path.join(repoRoot, "skills/blueprint-maintenance/references/pr-branch-runtime-contract.md"),
      "utf8"
    ),
    Promise.resolve(readArtifactContract("report.pr-branch")),
    buildBlueprintCommandRuntimeContractResource("pr-branch")
  ]);

  assert.match(runtimeReference, /Stage Mapping/);
  assert.match(runtimeReference, /report\.pr-branch/);
  assert.match(runtimeReference, /contract\.authoringTemplate/);
  assert.match(runtimeReference, /commit classification ledger/i);
  assert.match(
    runtimeReference,
    /`code-only`[\s\S]*`blueprint-only`[\s\S]*`mixed`[\s\S]*`empty-after-filter`/
  );
  assert.match(runtimeReference, /zero entries when `\.blueprint\/\*\*` was excluded/i);
  assert.match(runtimeReference, /No-subagent fallback is the canonical behavior/i);
  assert.match(runtimeReference, /`clean-working-tree`/);
  assert.match(runtimeReference, /report-overwrite-confirmation/);
  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /pr-branch-runtime-contract\.md/);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /clean tree and review-branch confirmation/i);
  assert.ok(
    runtimeContract.runtimeReference?.exactMcpDestination.includes(
      "blueprint_artifact_contract_read"
    )
  );
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(artifactContract.canonicalFilePattern, /\.blueprint\/reports\/pr-branch-latest\.md/);
  assert.match(artifactContract.notes.join("\n"), /commit classification ledger/i);
  assert.match(artifactContract.authoringTemplate, /Commit \| Subject \| Classification \| Action/);
});

test("pr-branch canonical report contract requires a populated replay ledger", () => {
  const contract = readArtifactContract("report.pr-branch");

  assert.deepEqual(contract.requiredHeadings, [
    "Source Branch",
    "Review Branch",
    "Filtered Scope",
    "Verification",
    "Next Safe Action"
  ]);
  assert.match(contract.authoringTemplate, /Commit \| Subject \| Classification \| Action/);
  assert.match(contract.authoringTemplate, /Digest inputs used/);
  assert.match(contract.authoringTemplate, /Excluded \.blueprint file count/i);
  assert.ok(contract.placeholderSignals.includes("<code-only|blueprint-only|mixed|empty-after-filter>"));

  const invalidTemplate = validateReportArtifactContent(
    contract.authoringTemplate,
    "pr-branch-latest"
  );
  assert.equal(invalidTemplate.valid, false);
  assert.match(invalidTemplate.issues.join("\n"), /placeholder scaffold text/i);

  const populatedReport = `# PR Branch Report

## Source Branch

- Base branch: main
- Source branch: feature/runtime-repair
- Source HEAD: abc1234
- Config used: git.base_branch=main; git.branching_strategy=phase; planning.commit_docs=true

## Review Branch

- Candidate branch: feature/runtime-repair-pr
- Created branch: feature/runtime-repair-pr
- Current branch after run: feature/runtime-repair
- Execution mode: confirmed-replay
- Git commands approved: git checkout -b feature/runtime-repair-pr main; git cherry-pick abc1234

## Filtered Scope

- .blueprint policy: excluded because planning.commit_docs is true and user did not request artifacts.
- Digest inputs used: .blueprint/ROADMAP.md, src/mcp/tools/project.ts
- Included paths: src/mcp/tools/project.ts
- Excluded paths: .blueprint/STATE.md

| Commit | Subject | Classification | Action | Filtered paths | Reason |
|---|---|---|---|---|---|
| abc1234 | Repair pr branch contract | mixed | include | .blueprint/STATE.md | Retained code changes and filtered Blueprint bookkeeping. |

## Verification

- Clean review branch status: git status --short returned no output.
- Excluded .blueprint file count in review diff: 0
- Total files in review diff: 1
- Review branch commits ahead of base: 1
- Recovery or blocker: none

## Next Safe Action

- git push origin feature/runtime-repair-pr
`;
  const validReport = validateReportArtifactContent(populatedReport, "pr-branch-latest");

  assert.equal(validReport.valid, true);
});

test("repo-facing status docs treat pr-branch as a shipped command", async () => {
  const [agentsFile, readmeFile, geminiFile, progressFile] =
    await Promise.all([
      readFile(path.join(repoRoot, "AGENTS.md"), "utf8"),
      readFile(path.join(repoRoot, "README.md"), "utf8"),
      readFile(path.join(repoRoot, "GEMINI.md"), "utf8"),
      readFile(path.join(repoRoot, "PROGRESS.md"), "utf8")
    ]);
  const metadata = getRuntimeOwnedCommandMetadata("pr-branch");

  assert.ok(metadata);
  assert.equal(metadata.catalog.wave, 4);
  assert.equal(metadata.catalog.family, "Quality And Shipping");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.spec.executionProfile, "high-risk-maintenance");
  assert.equal(metadata.runtimeReference.waveTitle, "Quality And Shipping");
  assert.match(metadata.runtimeReference.contractNotes, /Docless manifest\+skill-owned runtime/i);
  assert.match(metadata.runtimeReference.contractNotes, /pr-branch-runtime-contract\.md/);
  assert.match(metadata.runtimeReference.contractNotes, /clean tree and review-branch confirmation/i);
  assert.match(agentsFile, /`pr-branch` are also shipped|`pr-branch`/i);
  assert.match(readmeFile, /The review-branch command `\/blu-pr-branch` is now shipped/i);
  assert.match(geminiFile, /`\/blu-pr-branch`/);
  assert.match(
    progressFile,
    /\| [0-9]+ \| `pr-branch` \| ✅ \| `implemented` \| 4 \| `Quality And Shipping` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `pr-branch` \| ❌ \| `planned` \| 4 \| `Quality And Shipping` \| High \|/
  );
});
