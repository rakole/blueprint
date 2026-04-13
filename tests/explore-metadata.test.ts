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
  assert.match(commandFile, /mcp__blueprint__blueprint_project_status/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_mutate_index/);
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_add_phase/);
  assert.match(commandFile, /route to `\/blu-quick` or `\/blu-plan-phase`/);
  assert.match(commandFile, /require explicit confirmation before writing anything/i);
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
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_roadmap_add_phase/);
  assert.match(skillFile, /`note`, `todo`, `backlog`, `roadmap`, or `no-write`/);
  assert.match(skillFile, /Confirm the final routing target and normalized text before any write/);
  assert.match(skillFile, /\/blu-check-todos/);
  assert.match(skillFile, /\/blu-review-backlog/);
  assert.match(skillFile, /\/blu-discuss-phase <phase>/);
  assert.doesNotMatch(skillFile, /explore stays documented until its own manifest/i);
});
