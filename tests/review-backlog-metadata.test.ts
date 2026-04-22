import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("review-backlog manifest references preview, promotion, backlog updates, and discuss routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-review-backlog.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_promote_backlog/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /previewOnly: true/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /action: "update"/);
  assert.match(commandFile, /status: "promoted"/);
  assert.match(commandFile, /status: "archived"/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /Prefer Gemini CLI's built-in `ask_user` tool for structured promote or remove decisions/);
  assert.match(commandFile, /keep is the default safe path/i);
  assert.match(commandFile, /\/blu-discuss-phase <first promoted phase>/);
});

test("blueprint-capture skill captures review-backlog preview, promotion, and status-transition behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-review-backlog/);
  assert.match(skillFile, /### `review-backlog`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /blueprint_roadmap_promote_backlog/);
  assert.match(skillFile, /preview mode/i);
  assert.match(skillFile, /action: "update"/);
  assert.match(skillFile, /promoted/i);
  assert.match(skillFile, /archived/i);
  assert.match(skillFile, /Prefer Gemini's `ask_user` tool when a structured decision helps/);
  assert.match(skillFile, /keep is the default safe path/i);
  assert.match(skillFile, /\/blu-discuss-phase <first promoted phase>/);
});

test("review-backlog docs and runtime reference align to the interactive-read capture contract", async () => {
  const [docFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/review-backlog.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  assert.match(docFile, /Confirm each promote or remove decision\. Keep is the default safe path\./);
  const backlogRuntimeRow = runtimeFile
    .split("\n")
    .find((line) => line.startsWith("| `review-backlog` |"));
  assert.ok(backlogRuntimeRow, "runtime reference should include the review-backlog row");
  assert.match(backlogRuntimeRow, /Interactive-read profile for deterministic backlog review:/);
  assert.match(backlogRuntimeRow, /explicit promote or remove confirmations/i);
  assert.match(backlogRuntimeRow, /keep` as the default safe path/i);
});
