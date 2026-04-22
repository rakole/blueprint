import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("add-backlog manifest uses runtime skill and capture MCP identities", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-add-backlog.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /status: "duplicate"/);
  assert.match(commandFile, /999\.x/);
  assert.match(commandFile, /\/blu-add-phase/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
});

test("blueprint-capture skill captures backlog parking-lot behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /name: blueprint-capture/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-add-backlog/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_artifact_scaffold/);
  assert.match(skillFile, /reserve a `999\.x` phase stub/i);
  assert.match(skillFile, /Prefer Gemini's `ask_user` tool when a structured confirmation helps/);
  assert.match(skillFile, /implemented commands only/i);
});

test("add-backlog docs and runtime reference align to the interactive-read capture contract", async () => {
  const [docFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/add-backlog.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  assert.match(runtimeFile, /`add-backlog` .*Interactive-read profile for parking-lot capture:/);
});
