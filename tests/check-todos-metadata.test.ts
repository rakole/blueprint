import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("check-todos manifest uses runtime skill and todo-status MCP identities", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-check-todos.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp__blueprint__blueprint_project_status/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_mutate_index/);
  assert.match(commandFile, /action: "list"/);
  assert.match(commandFile, /action: "update"/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /\/blu-health/);
  assert.match(commandFile, /\/blu-add-todo/);
  assert.match(commandFile, /\/blu-progress/);
});

test("blueprint-capture skill captures shipped check-todos behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-check-todos/);
  assert.match(skillFile, /### `check-todos`/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /action: "list"/);
  assert.match(skillFile, /action: "update"/);
  assert.match(skillFile, /active` or `completed/);
  assert.doesNotMatch(
    skillFile,
    /`check-todos`, `review-backlog`, and `explore` stay documented contracts/
  );
});
