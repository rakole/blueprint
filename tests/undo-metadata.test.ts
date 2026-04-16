import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("undo manifest references the maintenance skill, undo report, and explicit revert confirmation guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-undo.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_phase_locate/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /undo-latest/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /git revert/i);
  assert.match(commandFile, /git reset --hard/i);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("maintenance skill captures undo gating, report persistence, and destructive-git guardrails", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-undo/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_phase_locate/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /undo-latest/);
  assert.match(skillFile, /git reset --hard/i);
  assert.match(skillFile, /report-before-mutate/i);
});

test("repo-facing status docs treat undo as a shipped command", async () => {
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

  assert.match(agentsFile, /`undo`/i);
  assert.match(handoffFile, /shipped Wave 4 maintenance commands `pr-branch`, `ship`, and `undo`/i);
  assert.match(architectureFile, /shipped Wave 4 maintenance commands, `pr-branch`, `ship`, and `undo`/i);
  assert.match(readmeFile, /`\/blu-undo`/);
  assert.match(geminiFile, /`\/blu-undo`/);
  assert.match(
    progressFile,
    /\| [0-9]+ \| `undo` \| ✅ \| `implemented` \| 4 \| `Quality And Shipping` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `undo` \| ❌ \| `planned` \| 4 \| `Quality And Shipping` \| High \|/
  );
  assert.match(memoryFile, /`undo` shipped on 2026-04-16/);
});
