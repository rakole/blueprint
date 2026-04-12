import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("plan-milestone-gaps manifest references the audit-first gap-planning tools and confirmation gate", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu/plan-milestone-gaps.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.match(commandFile, /`blueprint-roadmapper` subagent/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-roadmapper\.md/);
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_read/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_list/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_add_phase/);
  assert.match(commandFile, /mcp__blueprint__blueprint_state_update/);
  assert.match(commandFile, /\/blu:audit-milestone/);
  assert.match(commandFile, /explicit confirmation gate/i);
  assert.match(commandFile, /\/blu:discuss-phase <first new phase number>/);
});

test("roadmap-admin skill captures grouped audit-follow-up planning behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu:plan-milestone-gaps/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /grouping reviewable/i);
  assert.match(skillFile, /one explicit confirmation/i);
  assert.match(skillFile, /\/blu:discuss-phase <phase>/);
});
