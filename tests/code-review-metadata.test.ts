import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("code-review manifest references the review tools, canonical contract, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-code-review.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(commandFile, /`blueprint-reviewer` subagent/);
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
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read"))
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_scope")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, /review\.code-review/);
  assert.match(commandFile, /XX-REVIEW\.md/);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(commandFile, /\/blu-secure-phase/);
  assert.match(commandFile, /\/blu-code-review-fix/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /scope source, file count, selected review depth, pending gate, execution mode/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-review\.md|agents\/blueprint-reviewer\.md/);
});

test("blueprint-review skill captures MCP-owned code-review rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-code-review/);
  assert.match(skillFile, /Execution profile for `code-review`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /Stage vocabulary for visible review posture: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /### `code-review`/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_review_scope/);
  assert.match(skillFile, /update_topic plus `write_todos`/);
  assert.match(skillFile, /blueprint-reviewer/);
  assert.match(skillFile, /XX-REVIEW\.md/);
  assert.match(skillFile, /\/blu-secure-phase <phase>/);
  assert.match(skillFile, /\/blu-code-review-fix <phase>/);
  assert.match(skillFile, /\/blu-progress/);
});
