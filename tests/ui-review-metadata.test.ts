import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("ui-review manifest references the review tools, UI auditor, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-ui-review.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
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
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
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
  assert.match(
    skillFile,
    /Stage vocabulary for visible review posture: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    skillFile,
    /In-flight status fields for `ui-review`: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /### `ui-review`/);
  assert.match(skillFile, /blueprint-ui-auditor/);
  assert.match(skillFile, /blueprint_review_record/);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /XX-UI-REVIEW\.md/);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /\/blu-verify-work/);
  assert.match(skillFile, /\/blu-progress/);
});
