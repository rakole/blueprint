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
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/
  );
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /session-local coordination only, pair it with visible `write_todos`/i);
  assert.match(
    commandFile,
    /keep the same bounded flow linear with an explicit next safe step/i
  );
  assert.match(commandFile, /`--source <review\|security\|verification\|uat\|all>`/);
  assert.match(commandFile, /`--severity <medium\|high\|all>`/);
  assert.match(commandFile, /`--max <N>`/);
  assert.match(commandFile, /`--dry-run`/);
  assert.match(commandFile, /ask_user/);
  assert.match(
    commandFile,
    /pending gate \(`none`, non-trivial mutation confirmation, report overwrite confirmation, or todo capture confirmation\)/i
  );
  assert.match(
    commandFile,
    /execution mode \(`dry-run` versus mutation, inline versus reviewer\/verifier-assisted\)/i
  );
  assert.match(commandFile, /verification progress, report status, next safe action/i);
  assert.match(commandFile, /Stop on the first failed mutation or failed required verification/);
  assert.match(commandFile, /early-stop reason/i);
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
  assert.match(skillFile, /Execution profile for `audit-fix`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /In-flight status fields for `audit-fix`: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /--source/);
  assert.match(skillFile, /--severity/);
  assert.match(skillFile, /--max/);
  assert.match(skillFile, /--dry-run/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /tracker-eligible/i);
  assert.match(skillFile, /session-local coordination only/i);
  assert.match(skillFile, /report overwrite handling/i);
  assert.match(
    skillFile,
    /candidate count, attempt index \(`i\/N`\), remediation progress,\s+verification progress,\s+report status/i
  );
  assert.match(skillFile, /dry-run versus mutation plus inline versus\s+reviewer\/verifier-assisted remediation/i);
  assert.match(skillFile, /stop-on-first-failure/i);
  assert.match(skillFile, /planned `blueprint-fixer` is not a shipped[\s\S]*runtime path/);
  assert.match(skillFile, /audit-fix-<phase>/);
  assert.match(skillFile, /\/blu-validate-phase <phase>/);
  assert.match(skillFile, /\/blu-add-tests <phase>/);
  assert.match(skillFile, /\/blu-progress/);
});
