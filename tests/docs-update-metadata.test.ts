import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("docs-update manifest references the docs skill, doc agents, report tool, and scope guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-docs-update.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-docs` skill/);
  assert.match(commandFile, /`blueprint-doc-writer` and `blueprint-doc-verifier` subagents/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-docs\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-doc-writer\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-doc-verifier\.md/);
  assert.match(commandFile, /mcp__blueprint__blueprint_project_status/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_list/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_summary_digest/);
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /docFiles/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_report_write/);
  assert.match(commandFile, /docs-update-latest/);
  assert.match(commandFile, /`--verify-only`/);
  assert.match(commandFile, /`--force`/);
  assert.match(commandFile, /\/blu-map-codebase/);
  assert.match(commandFile, /\/blu-progress/);
});

test("docs skill captures narrow-scope updates, verify-only mode, and report persistence", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-docs/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-docs-update/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /`--verify-only` as read-only/i);
  assert.match(skillFile, /docs-update-latest/);
  assert.match(skillFile, /Do not rewrite broad internal doc sets/i);
});
