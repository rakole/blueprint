import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("note manifest uses runtime skill and capture MCP identities", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-note.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_mutate_index/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /status: "duplicate"/);
  assert.match(commandFile, /project-local note capture/i);
  assert.match(commandFile, /Do not reintroduce upstream global-note behavior/);
});

test("blueprint-capture skill captures shipped note behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /### `note`/);
  assert.match(skillFile, /target: "note"/);
  assert.match(skillFile, /Do not reintroduce upstream global-note behavior/i);
  assert.match(skillFile, /implemented commands only/i);
  assert.doesNotMatch(
    skillFile,
    /`note`, `add-todo`, `check-todos`, and `review-backlog` stay documented contracts/
  );
});
