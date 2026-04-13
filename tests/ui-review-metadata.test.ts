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
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, /XX-UI-REVIEW\.md/);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(commandFile, /\/blu-validate-phase/);
  assert.match(commandFile, /\/blu-verify-work/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-review\.md|agents\/blueprint-ui-auditor\.md/);
});

test("blueprint-review skill captures MCP-owned ui-review rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-ui-review/);
  assert.match(skillFile, /### `ui-review`/);
  assert.match(skillFile, /blueprint-ui-auditor/);
  assert.match(skillFile, /blueprint_review_record/);
  assert.match(skillFile, /XX-UI-REVIEW\.md/);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /\/blu-verify-work/);
  assert.match(skillFile, /\/blu-progress/);
});
