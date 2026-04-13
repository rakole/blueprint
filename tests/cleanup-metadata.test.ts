import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("cleanup manifest references the maintenance skill, cleanup report, and explicit archival confirmation guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-cleanup.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /mcp__blueprint__blueprint_project_status/);
  assert.match(commandFile, /mcp__blueprint__blueprint_roadmap_read/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_list/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp__blueprint__blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp__blueprint__blueprint_state_update/);
  assert.match(commandFile, /cleanup-latest/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /active roadmap/i);
  assert.match(commandFile, /Do not invent a new persistent archive schema/i);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("maintenance skill captures cleanup gating, report persistence, and active-phase safety", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-cleanup/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_roadmap_read/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /cleanup-latest/);
  assert.match(skillFile, /never the current phase/i);
  assert.match(skillFile, /before filesystem mutation begins/i);
});

test("repo-facing status docs treat cleanup as a shipped command", async () => {
  const [
    agentsFile,
    handoffFile,
    architectureFile,
    readmeFile,
    geminiFile,
    progressFile,
    memoryFile
  ] = await Promise.all([
    readFile(path.join(repoRoot, "AGENTS.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/HANDOFF.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/ARCHITECTURE.md"), "utf8"),
    readFile(path.join(repoRoot, "README.md"), "utf8"),
    readFile(path.join(repoRoot, "GEMINI.md"), "utf8"),
    readFile(path.join(repoRoot, "PROGRESS.md"), "utf8"),
    readFile(path.join(repoRoot, "MEMORY.md"), "utf8")
  ]);

  assert.match(agentsFile, /`cleanup`/i);
  assert.match(handoffFile, /shipped Wave 5 cleanup command `cleanup`/i);
  assert.match(architectureFile, /shipped Wave 5 maintenance command, `cleanup`/i);
  assert.match(readmeFile, /`\/blu-cleanup`/);
  assert.match(geminiFile, /`\/blu-cleanup`/);
  assert.match(
    progressFile,
    /\| [0-9]+ \| `cleanup` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `cleanup` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.match(memoryFile, /`cleanup` shipped on 2026-04-13/);
});
