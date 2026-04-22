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
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_phase_locate/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_remove_phase/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /future-phase-guard/);
  assert.match(commandFile, /remove-phase-confirmation/);
  assert.match(commandFile, /force-remove-confirmation/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /force: true/);
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
  assert.match(skillFile, /blueprint_phase_locate/);
  assert.match(skillFile, /blueprint_roadmap_remove_phase/);
  assert.match(skillFile, /future-phase guard/i);
  assert.match(skillFile, /execution evidence/i);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(skillFile, /force: true/);
  assert.match(skillFile, /\/blu-progress/);
});

test("remove-phase docs and runtime reference expose the interactive-read destructive gate contract", async () => {
  const [docFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/remove-phase.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /future-phase-guard/);
  assert.match(docFile, /force-remove-confirmation/);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  assert.match(runtimeFile, /`remove-phase` .*Interactive-read profile for bounded roadmap removal:/);
});
