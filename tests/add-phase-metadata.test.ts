import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("add-phase manifest uses runtime skill and MCP identities for roadmap append flow", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-add-phase.toml"), "utf8");

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_add_phase/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /exact next integer phase number/i);
  assert.match(commandFile, /preview that computed phase number together with the description/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /expectedPhaseNumber/);
  assert.match(commandFile, /do not mutate anything until the computed next phase number has been previewed and confirmed through `ask_user`/i);
  assert.match(commandFile, /phase-number-confirmation/);
  assert.match(commandFile, /stale-phase-number/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /if the tool rejects because the live next phase changed/i);
  assert.match(commandFile, /\/blu-discuss-phase <phase>/);
});

test("add-phase docs, skill, and runtime reference align to the interactive-read roadmap-admin contract", async () => {
  const [docFile, skillFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/add-phase.md"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /phase-number-confirmation/);
  assert.match(docFile, /stale-phase-number/);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  assert.match(
    skillFile,
    /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/
  );
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(runtimeFile, /`add-phase` .*Interactive-read profile for bounded roadmap append:/);
});
