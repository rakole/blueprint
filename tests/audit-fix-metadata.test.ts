import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("audit-fix manifest references the remediation tools, agents, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-audit-fix.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(commandFile, /`blueprint-reviewer` subagent/);
  assert.match(commandFile, /`blueprint-verifier` subagent/);
  assert.match(commandFile, /Treat `blueprint-fixer` as planned-only inventory/);
  assert.match(commandFile, /`--source <review\|security\|verification\|uat\|all>`/);
  assert.match(commandFile, /`--severity <medium\|high\|all>`/);
  assert.match(commandFile, /`--max <N>`/);
  assert.match(commandFile, /`--dry-run`/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /Stop on the first failed mutation or failed required verification/);
  assert.match(commandFile, /commit traceability/i);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_scope")));
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write"))
  );
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_mutate_index"))
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /audit-fix-<phase>/);
  assert.match(commandFile, /\/blu-code-review/);
  assert.match(commandFile, /\/blu-verify-work/);
  assert.match(commandFile, /\/blu-add-tests/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(
    commandFile,
    /skills\/blueprint-review\.md|agents\/blueprint-reviewer\.md|agents\/blueprint-verifier\.md/
  );
});

test("blueprint-review skill captures audit-fix report-backed remediation rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-audit-fix/);
  assert.match(skillFile, /### `audit-fix`/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /--source/);
  assert.match(skillFile, /--severity/);
  assert.match(skillFile, /--max/);
  assert.match(skillFile, /--dry-run/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /stop-on-first-failure/i);
  assert.match(skillFile, /planned `blueprint-fixer` is not a shipped[\s\S]*runtime path/);
  assert.match(skillFile, /audit-fix-<phase>/);
  assert.match(skillFile, /\/blu-validate-phase <phase>/);
  assert.match(skillFile, /\/blu-add-tests <phase>/);
  assert.match(skillFile, /\/blu-progress/);
});
