import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

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

test("remove-phase runtime-owned metadata exposes the interactive-read destructive gate contract", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("remove-phase");
  const contract = await buildBlueprintCommandRuntimeContractResource("remove-phase");

  assert.ok(metadata);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.spec?.executionProfile, "interactive-read");
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /future-phase-guard[\s\S]*force-remove-confirmation[\s\S]*force: true/
  );
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-remove-phase.toml"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});
