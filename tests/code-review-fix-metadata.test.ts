import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("code-review-fix manifest references findings tools, canonical contracts, and safe follow-up routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-code-review-fix.toml"),
    "utf8"
  );

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(commandFile, /`blueprint-reviewer` subagent/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/
  );
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_review_load_findings"))
  );
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read"))
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /review\.review-fix/);
  assert.match(
    commandFile,
    /resolved scope, selected finding ids, active stage, pending gate, execution mode, remediation progress, verification progress/i
  );
  assert.match(commandFile, /Treat finding selection as an explicit gate before repo mutation/i);
  assert.match(commandFile, /`--auto` as bounded automatic finding selection only/i);
  assert.match(commandFile, /No auto-fixer behavior is shipped/i);
  assert.match(commandFile, /XX-REVIEW-FIX\.md/);
  assert.match(commandFile, /\/blu-code-review/);
  assert.match(commandFile, /\/blu-audit-fix/);
  assert.match(commandFile, /\/blu-validate-phase/);
  assert.match(commandFile, /\/blu-add-tests/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(
    commandFile,
    /skills\/blueprint-review\.md|agents\/blueprint-reviewer\.md|agents\/blueprint-fixer\.md/
  );
});

test("blueprint-review skill captures review-fix rules on top of the saved findings substrate", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-code-review-fix/);
  assert.match(skillFile, /### `code-review-fix`/);
  assert.match(skillFile, /Execution profile for `code-review-fix`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /In-flight status fields for `code-review-fix`: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /blueprint_review_load_findings/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /`--auto` as bounded finding selection only/i);
  assert.match(skillFile, /XX-REVIEW-FIX\.md/);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(
    skillFile,
    /resolved phase, resolved scope, selected finding ids,\s+remediation progress,\s+and\s+verification progress/i
  );
  assert.match(skillFile, /No auto-fixer behavior is shipped/i);
  assert.match(skillFile, /run stays inline,\s+uses the reviewer subagent/i);
  assert.match(skillFile, /\/blu-validate-phase <phase>/);
  assert.match(skillFile, /\/blu-add-tests <phase>/);
  assert.match(skillFile, /\/blu-progress/);
});
