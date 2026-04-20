import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("add-phase manifest uses runtime skill and MCP identities for roadmap append flow", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-add-phase.toml"), "utf8");

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_add_phase/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /exact next integer phase number/i);
  assert.match(commandFile, /preview that computed phase number together with the description/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /expectedPhaseNumber/);
  assert.match(commandFile, /do not mutate anything until the computed next phase number has been previewed and confirmed through `ask_user`/i);
  assert.match(commandFile, /if the tool rejects because the live next phase changed/i);
  assert.match(commandFile, /\/blu-discuss-phase <phase>/);
});
