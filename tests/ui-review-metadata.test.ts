import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

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
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, /contract\.authoringTemplate/);
  assert.match(commandFile, /Copywriting, Visual Hierarchy, Color, Typography, Spacing, and Experience Design/);
  assert.match(commandFile, /overall score out of 24/);
  assert.match(commandFile, /no-subagent fallback/);
  assert.match(commandFile, /repair the body once against the `review\.ui-review` authoring template/);
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
    /Stage vocabulary for visible review posture: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    skillFile,
    /In-flight status fields for `ui-review`: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /### `ui-review`/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /contract\.authoringTemplate/);
  assert.match(skillFile, /blueprint-ui-auditor/);
  assert.match(skillFile, /blueprint_review_record/);
  assert.match(skillFile, /scored six-pillar audit/i);
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
  assert.match(runtimeContract, /contract\.authoringTemplate/);
  assert.match(runtimeContract, /Pillar Scores/);
  assert.match(runtimeContract, /Priority Fixes/);
  assert.match(runtimeContract, /overall score out of 24/);
  assert.match(runtimeContract, /Capability-Gated Subagent Path/);
  assert.match(runtimeContract, /No-Subagent Fallback/);
  assert.match(runtimeContract, /audit one pillar at a time/i);
  assert.match(runtimeContract, /Browser-only, web-search-only, shell-only, or generic helpers/);
  assert.match(runtimeContract, /Invalid UI-review write/);
  assert.match(runtimeContract, /retry through\s+  `blueprint_review_record`/);

  assert.match(agentFile, /Score each pillar from `1\/4` through `4\/4`/);
  assert.match(agentFile, /overall score out of 24/);
  assert.match(agentFile, /screenshot or visual-evidence posture/);
  assert.match(agentFile, /up to three priority fixes/);
  assert.match(agentFile, /Do not act as a browser-only, web-search-only, shell-only, or generic helper/);
});
