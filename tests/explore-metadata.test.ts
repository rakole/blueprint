import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("explore manifest references capture skill, ideation-routing tools, and confirmation gates", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-explore.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_add_phase/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /route to `\/blu-quick` or `\/blu-plan-phase`/);
  assert.match(commandFile, /require explicit confirmation before writing anything/i);
  assert.match(commandFile, /Prefer Gemini CLI's built-in `ask_user` tool for the final routing confirmation/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /\/blu-health/);
  assert.match(commandFile, /\/blu-check-todos/);
  assert.match(commandFile, /\/blu-review-backlog/);
  assert.match(commandFile, /\/blu-discuss-phase <phase>/);
});

test("blueprint-capture skill captures explore classification and confirmation behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-explore/);
  assert.match(skillFile, /### `explore`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_roadmap_add_phase/);
  assert.match(skillFile, /blueprint_artifact_scaffold/);
  assert.match(skillFile, /`note`, `todo`, `backlog`, `roadmap`, or `no-write`/);
  assert.match(skillFile, /Confirm the final routing target and normalized text before any write/);
  assert.match(skillFile, /Gemini's `ask_user` tool is preferred when a structured confirmation helps/);
  assert.match(skillFile, /\/blu-check-todos/);
  assert.match(skillFile, /\/blu-review-backlog/);
  assert.match(skillFile, /\/blu-discuss-phase <phase>/);
  assert.doesNotMatch(skillFile, /explore stays documented until its own manifest/i);
});

test("explore docs and runtime reference align to the interactive-read capture contract", async () => {
  const [docFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/explore.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  const exploreRuntimeRow = runtimeFile
    .split("\n")
    .find((line) => line.startsWith("| `explore` |"));
  assert.ok(exploreRuntimeRow, "runtime reference should include the explore row");
  assert.match(exploreRuntimeRow, /blueprint_artifact_scaffold/);
  assert.match(exploreRuntimeRow, /Interactive-read profile for short ideation routing:/);
});
