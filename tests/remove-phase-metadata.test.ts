import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("remove-phase manifest references roadmap removal tools, confirmation gate, and safe routing contract", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-remove-phase.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_read/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_list/);
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_remove_phase/);
  assert.match(commandFile, /mcp__blueprint__blueprint_state_update/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /future-phase guard|current or past phases/i);
  assert.match(commandFile, /\/blu-progress/);
});

test("roadmap-admin skill captures remove-phase guards and state follow-up", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-remove-phase/);
  assert.match(skillFile, /blueprint_roadmap_remove_phase/);
  assert.match(skillFile, /future-phase guard/i);
  assert.match(skillFile, /execution evidence/i);
  assert.match(skillFile, /\/blu-progress/);
});
