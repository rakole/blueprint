import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("ui-review runtime metadata is source-owned and docs-free", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("ui-review");
  const catalog = await blueprintCommandCatalog();
  const contract = await buildBlueprintCommandRuntimeContractResource("ui-review");

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#ui-review");
  assert.equal(metadata.spec.path, metadata.sourceId);
  assert.equal(metadata.runtimeReference.path, metadata.sourceId);
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-review/references/ui-review-runtime-contract.md"
  ]);

  assert.equal(catalog.commands["ui-review"].specPath, metadata.sourceId);
  assert.deepEqual(catalog.commands["ui-review"].requiredTools, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(catalog.commands["ui-review"].optionalAgents, [
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
      "commands/blu-ui-review.toml",
      "skills/blueprint-review/references/ui-review-runtime-contract.md"
    ],
    effective: [
      "commands/blu-ui-review.toml",
      "skills/blueprint-review/references/ui-review-runtime-contract.md"
    ]
  });
  assert.doesNotMatch(JSON.stringify(contract), /docs\//);
});

test("ui-review manifest references the review tools, UI auditor, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-ui-review.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(commandFile, /ui-review-runtime-contract\.md/);
  assert.match(commandFile, /`blueprint-ui-auditor` subagent/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/
  );
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_authoring_context")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_validate_model")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, /contract\.modelContract\.schemaPath/);
  assert.match(commandFile, /Copywriting, Visual Hierarchy, Color, Typography, Spacing, and Experience Design/);
  assert.match(commandFile, /overall score out of 24/);
  assert.match(commandFile, /no-subagent fallback/);
  assert.match(commandFile, /repair the model once against `review\.ui-review`/);
  assert.match(commandFile, /minimal explicit skip rationale/i);
  assert.match(commandFile, /do not misread the skip form as a malformed contract/i);
  assert.match(commandFile, /XX-UI-REVIEW\.md/);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(commandFile, /\/blu-validate-phase/);
  assert.match(commandFile, /\/blu-verify-work/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(
    commandFile,
    /saved execution and UI-spec coverage, active stage, pending gate, execution mode/
  );
  assert.doesNotMatch(commandFile, /skills\/blueprint-review\.md|agents\/blueprint-ui-auditor\.md/);
});

test("blueprint-review skill captures MCP-owned ui-review rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-ui-review/);
  assert.match(skillFile, /Execution profile for `ui-review`: `long-running-mutation`/);
  assert.match(skillFile, /ui-review-runtime-contract\.md/);
  assert.match(
    skillFile,
    /Each command-local runtime contract owns the detailed stage vocabulary, in-flight status fields, and waiting-state semantics/
  );
  assert.match(skillFile, /### `ui-review`/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /contract\.modelContract\.schemaPath/);
  assert.match(skillFile, /blueprint_review_authoring_context/);
  assert.match(skillFile, /blueprint_review_validate_model/);
  assert.match(skillFile, /blueprint-ui-auditor/);
  assert.match(skillFile, /blueprint_review_record/);
  assert.match(skillFile, /scored six-pillar JSON model/i);
  assert.match(skillFile, /overall `\/24` score/);
  assert.match(skillFile, /no-subagent fallback/);
  assert.match(skillFile, /audit one pillar at\s+    a time/);
  assert.match(skillFile, /Reject browser-only, web-search-only, shell-only, or generic agents/);
  assert.match(skillFile, /retry once through MCP/);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /XX-UI-REVIEW\.md/);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /\/blu-verify-work/);
  assert.match(skillFile, /\/blu-progress/);
});

test("ui-review runtime contract captures rich artifact authoring and recovery", async () => {
  const [runtimeContract, agentFile] = await Promise.all([
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-review/references/ui-review-runtime-contract.md"
      ),
      "utf8"
    ),
    readFile(path.join(repoRoot, "agents/blueprint-ui-auditor.md"), "utf8")
  ]);

  assert.match(runtimeContract, /## Stage Mapping/);
  assert.match(runtimeContract, /### Resolve/);
  assert.match(runtimeContract, /### Persist/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(runtimeContract, /contract\.modelContract\.schemaPath/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_review_authoring_context/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_review_validate_model/);
  assert.match(runtimeContract, /Pillar Scores/);
  assert.match(runtimeContract, /Priority Fixes/);
  assert.match(runtimeContract, /overall score out of 24/);
  assert.match(runtimeContract, /Capability-Gated Subagent Path/);
  assert.match(runtimeContract, /No-Subagent Fallback/);
  assert.match(runtimeContract, /first-class valid artifact shape/i);
  assert.match(runtimeContract, /do not misread the skip form as a\s+malformed contract/i);
  assert.match(runtimeContract, /audit one pillar at a time/i);
  assert.match(runtimeContract, /Browser-only, web-search-only, shell-only, or generic helpers/);
  assert.match(runtimeContract, /Invalid UI-review model or write/);
  assert.match(runtimeContract, /blueprint_review_validate_model[\s\S]*blueprint_review_record/);

  assert.match(agentFile, /Score each pillar from `1\/4` through `4\/4`/);
  assert.match(agentFile, /overall score out of 24/);
  assert.match(agentFile, /screenshot or visual-evidence posture/);
  assert.match(agentFile, /up to three priority fixes/);
  assert.match(agentFile, /Do not act as a browser-only, web-search-only, shell-only, or generic helper/);
});
