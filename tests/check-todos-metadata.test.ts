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
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /action: "list"/);
  assert.match(commandFile, /action: "update"/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /\/blu-health/);
  assert.match(commandFile, /\/blu-add-todo/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /Prefer Gemini CLI's built-in `ask_user` tool for status-change confirmation/);
});

test("blueprint-capture skill captures shipped check-todos behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-check-todos/);
  assert.match(skillFile, /### `check-todos`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /action: "list"/);
  assert.match(skillFile, /action: "update"/);
  assert.match(skillFile, /active` or `completed/);
  assert.match(skillFile, /Prefer Gemini's `ask_user` tool when a structured confirmation helps/);
  assert.doesNotMatch(
    skillFile,
    /`check-todos` and `review-backlog` stay documented contracts/
  );
});

test("check-todos docs and runtime reference align to the interactive-read capture contract", async () => {
  const [docFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/check-todos.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  assert.match(
    docFile,
    /Confirm active or completed status changes before writing them unless the user's intent is already unmistakably explicit\./
  );
  assert.match(runtimeFile, /`check-todos` .*Interactive-read profile for deterministic todo inspection plus bounded status change:/);
});
