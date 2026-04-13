import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("pr-branch manifest references the maintenance skill, report tool, and git confirmation guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-pr-branch.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /mcp__blueprint__blueprint_project_status/);
  assert.match(commandFile, /mcp__blueprint__blueprint_config_get/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_report_write/);
  assert.match(commandFile, /pr-branch-latest/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /\.blueprint\/\*\*/);
  assert.match(commandFile, /planning\.commit_docs/);
  assert.match(commandFile, /uncommitted changes/i);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("maintenance skill captures pr-branch filtering, report persistence, and source-branch safety", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-pr-branch/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_config_get/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /excluding `?\.blueprint\/\*\*`? bookkeeping paths/i);
  assert.match(skillFile, /dirty working tree/i);
  assert.match(skillFile, /without rewriting or deleting the source branch in place/i);
  assert.match(skillFile, /pr-branch-latest/);
});
