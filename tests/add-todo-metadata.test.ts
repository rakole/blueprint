import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("add-todo manifest uses runtime skill and capture MCP identities", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-add-todo.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /target: "todo"/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /status: "duplicate"/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /\/blu-progress/);
});

test("blueprint-capture skill captures todo append behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /name: blueprint-capture/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-add-todo/);
  assert.match(skillFile, /### `add-todo`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /target: "todo"/);
  assert.match(skillFile, /duplicate todo descriptions/i);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/);
  assert.match(skillFile, /implemented commands only/i);
  assert.doesNotMatch(
    skillFile,
    /`note`, `add-todo`, `check-todos`, and `review-backlog` stay documented contracts/
  );
});

test("add-todo docs and runtime reference align to the interactive-read capture contract", async () => {
  const [docFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/add-todo.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  assert.match(runtimeFile, /`add-todo` .*Interactive-read profile for short project-local todo capture:/);
});
