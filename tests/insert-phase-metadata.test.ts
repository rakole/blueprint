import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("insert-phase manifest references roadmap insertion tools, confirmation gate, and discuss-phase routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-insert-phase.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_read/);
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_insert_phase/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_scaffold/);
  assert.match(commandFile, /mcp__blueprint__blueprint_state_update/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /Do not accept decimal insertion targets/i);
  assert.match(commandFile, /\/blu-discuss-phase <phase>/);
});

test("roadmap-admin skill captures insert-phase numbering, drift, and discuss-phase follow-up", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-insert-phase/);
  assert.match(skillFile, /blueprint_roadmap_insert_phase/);
  assert.match(skillFile, /reject decimal targets/i);
  assert.match(skillFile, /roadmap-driven/i);
  assert.match(skillFile, /conflicting decimal directory/i);
  assert.match(skillFile, /\/blu-discuss-phase <phase>/);
});
