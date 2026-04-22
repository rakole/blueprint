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
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /status: "duplicate"/);
  assert.match(commandFile, /project-local note capture/i);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /Do not reintroduce global-note behavior/);
});

test("blueprint-capture skill captures shipped note behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /### `note`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /target: "note"/);
  assert.match(skillFile, /Do not reintroduce global-note behavior/i);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/);
  assert.match(skillFile, /implemented commands only/i);
  assert.doesNotMatch(
    skillFile,
    /`note`, `add-todo`, `check-todos`, and `review-backlog` stay documented contracts/
  );
});

test("note docs and runtime reference align to the interactive-read capture contract", async () => {
  const [docFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/note.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  assert.match(runtimeFile, /`note` .*Interactive-read profile for deterministic project-local note capture:/);
});
