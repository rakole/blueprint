import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("secure-phase manifest references the review tools, agent, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-secure-phase.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(commandFile, /`blueprint-security-auditor` subagent/);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /one focused question per `ask_user` call/i);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_read")));
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read"))
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, /XX-SECURITY\.md/);
  assert.match(commandFile, /phase_plan_index/i);
  assert.match(commandFile, /phase_plan_read/i);
  assert.match(commandFile, /artifact_contract_read/i);
  assert.match(commandFile, /build the bounded threat register/i);
  assert.match(commandFile, /verify (?:those )?threats or explicitly accept them/i);
  assert.match(commandFile, /Report in-flight progress/i);
  assert.match(commandFile, /threat-register coverage/i);
  assert.match(commandFile, /do not emit next-step routing when any threat remains open/i);
  assert.match(commandFile, /\/blu-validate-phase/);
  assert.match(commandFile, /\/blu-verify-work/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-review\.md|agents\/blueprint-security-auditor\.md/);
});

test("secure-phase review skill captures MCP-owned security audit rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-secure-phase/);
  assert.match(skillFile, /blueprint-security-auditor/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /blueprint_phase_plan_index/);
  assert.match(skillFile, /blueprint_phase_plan_read/);
  assert.match(skillFile, /blueprint_review_record/);
  assert.match(skillFile, /XX-SECURITY\.md/);
  assert.match(skillFile, /blueprint_phase_plan_index/);
  assert.match(skillFile, /blueprint_phase_plan_read/);
  assert.match(skillFile, /build a threat\s+register/i);
  assert.match(skillFile, /verify open threats or explicitly accept\s+them/i);
  assert.match(skillFile, /Report in-flight progress/i);
  assert.match(skillFile, /verify-versus-accept state/i);
  assert.match(skillFile, /block\s+advancement when any threat remains open/i);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /\/blu-progress/);
});
