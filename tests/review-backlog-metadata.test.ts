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
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_promote_backlog/);
  assert.match(commandFile, /previewOnly: true/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_mutate_index/);
  assert.match(commandFile, /action: "update"/);
  assert.match(commandFile, /status: "promoted"/);
  assert.match(commandFile, /status: "archived"/);
  assert.match(commandFile, /mcp__blueprint__blueprint_state_update/);
  assert.match(commandFile, /\/blu-discuss-phase <first promoted phase>/);
});

test("blueprint-capture skill captures review-backlog preview, promotion, and status-transition behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-review-backlog/);
  assert.match(skillFile, /### `review-backlog`/);
  assert.match(skillFile, /blueprint_roadmap_promote_backlog/);
  assert.match(skillFile, /preview mode/i);
  assert.match(skillFile, /action: "update"/);
  assert.match(skillFile, /promoted/i);
  assert.match(skillFile, /archived/i);
  assert.match(skillFile, /\/blu-discuss-phase <first promoted phase>/);
});
