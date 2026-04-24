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
  assert.match(
    commandFile,
    /skills\/blueprint-review\/references\/code-review-fix-runtime-contract\.md/
  );
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
  assert.match(commandFile, /process one selected finding at a time/i);
  assert.match(commandFile, /repair the markdown against the `review\.review-fix` template/i);
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
  assert.match(
    skillFile,
    /skills\/blueprint-review\/references\/code-review-fix-runtime-contract\.md/
  );
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
  assert.match(skillFile, /subagent stays read-only/i);
  assert.match(skillFile, /process one selected finding at a time/i);
  assert.match(skillFile, /repair against the `review\.review-fix` authoring template\s+and retry once/i);
  assert.match(skillFile, /browser\/web\/search-only\s+substitute for codebase analysis/i);
  assert.match(skillFile, /No auto-fixer behavior is shipped/i);
  assert.match(skillFile, /run stays inline,\s+uses the reviewer subagent/i);
  assert.match(skillFile, /\/blu-validate-phase <phase>/);
  assert.match(skillFile, /\/blu-add-tests <phase>/);
  assert.match(skillFile, /\/blu-progress/);
});

test("code-review-fix local runtime contract locks richer saved-finding remediation behavior", async () => {
  const referenceFile = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-review/references/code-review-fix-runtime-contract.md"
    ),
    "utf8"
  );

  for (const stage of ["Resolve", "Read", "Decide", "Execute", "Persist", "Validate", "Route"]) {
    assert.match(referenceFile, new RegExp(`### ${stage}`));
  }

  for (const tool of [
    "blueprint_phase_locate",
    "blueprint_review_load_findings",
    "blueprint_artifact_contract_read",
    "blueprint_review_record",
    "blueprint_state_update"
  ]) {
    assert.ok(referenceFile.includes(`\`${tool}\``));
  }

  assert.match(referenceFile, /`review\.review-fix`/);
  assert.match(referenceFile, /canonical `review\.review-fix` template/i);
  assert.match(referenceFile, /## Findings Addressed/);
  assert.match(referenceFile, /## Changes Made/);
  assert.match(referenceFile, /## Verification/);
  assert.match(referenceFile, /## Follow-Ups/);
  assert.match(referenceFile, /## Next Safe Action/);
  assert.match(referenceFile, /Use `blueprint-reviewer` only as a bounded analysis helper/i);
  assert.match(referenceFile, /must stay read-only/i);
  assert.match(referenceFile, /must not apply fixes/i);
  assert.match(referenceFile, /browser\/web\/search-only tools as substitutes/i);
  assert.match(referenceFile, /## No-Subagent Fallback/);
  assert.match(referenceFile, /Work one finding at a time/i);
  assert.match(referenceFile, /Reread the implicated source and test files before editing/i);
  assert.match(referenceFile, /Compress carry-forward context/i);
  assert.match(referenceFile, /MCP write validation failure: repair against the canonical template and retry\s+once/i);
  assert.match(referenceFile, /Every fixed, skipped, or deferred finding ties back to a saved finding id/i);
  assert.match(referenceFile, /No public command surface, catalog status semantics, hook ownership, hidden git\s+automation, or `.planning\/` runtime dependency was introduced/i);
});

test("blueprint-reviewer agent supports read-only code-review-fix reclassification without becoming a fixer", async () => {
  const agentFile = await readFile(
    path.join(repoRoot, "agents/blueprint-reviewer.md"),
    "utf8"
  );

  assert.match(agentFile, /\/blu-code-review-fix/);
  assert.match(agentFile, /read-only\s+reclassification/i);
  assert.match(agentFile, /fix\/defer\/skip\s+recommendations/i);
  assert.match(agentFile, /selected finding ids or summaries/i);
  assert.match(agentFile, /defer\/skip reasons/i);
  assert.match(agentFile, /suggested narrow verification/i);
  assert.match(agentFile, /Do not act as a fixer agent/i);
  assert.match(agentFile, /no source edits, no commits, no rollback steps/i);
  assert.match(agentFile, /browser-only\s+analysis/i);
});
