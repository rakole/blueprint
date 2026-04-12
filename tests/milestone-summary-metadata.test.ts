import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("milestone-summary manifest references saved report evidence and new-milestone routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu/milestone-summary.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_read/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_list/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_summary_digest/);
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp__blueprint__blueprint_state_update/);
  assert.match(commandFile, /explicit overwrite confirmation/i);
  assert.match(commandFile, /milestone-summary-<milestone>/);
  assert.match(commandFile, /\/blu:new-milestone/);
  assert.doesNotMatch(commandFile, /blueprint-doc-writer/);
});

test("roadmap-admin skill keeps milestone-summary skill-led and Wave 2 local", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu:milestone-summary/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /Do not pull in `blueprint-doc-writer`/);
  assert.match(skillFile, /\/blu:new-milestone/);
});
