import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("code-review-fix runtime metadata is source-owned and docs-free", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("code-review-fix");
  const catalog = await blueprintCommandCatalog();
  const contract = await buildBlueprintCommandRuntimeContractResource("code-review-fix");

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#code-review-fix");
  assert.equal(metadata.spec.path, metadata.sourceId);
  assert.equal(metadata.runtimeReference.path, metadata.sourceId);
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-review/references/code-review-fix-runtime-contract.md"
  ]);

  assert.equal(catalog.commands["code-review-fix"].specPath, metadata.sourceId);
  assert.deepEqual(catalog.commands["code-review-fix"].requiredTools, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(catalog.commands["code-review-fix"].optionalAgents, [
    ...metadata.optionalAgents
  ]);
  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, [
    ...metadata.optionalAgents
  ]);
  assert.deepEqual(contract.skillInputs, {
    skill: "blueprint-review",
    shared: [],
    commandSpecific: [
      "commands/blu-code-review-fix.toml",
      "skills/blueprint-review/references/code-review-fix-runtime-contract.md"
    ],
    effective: [
      "commands/blu-code-review-fix.toml",
      "skills/blueprint-review/references/code-review-fix-runtime-contract.md"
    ]
  });
  assert.doesNotMatch(JSON.stringify(contract), /docs\//);
});

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
    new RegExp(blueprintRuntimeToolFqn("blueprint_review_authoring_context"))
  );
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_review_validate_model"))
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
  assert.match(commandFile, /Author a `review\.review-fix` JSON model only/i);
  assert.match(commandFile, /same `targetIds` array used for authoring context/i);
  assert.match(commandFile, /Markdown `content` fallback is invalid for `review\.review-fix`/i);
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
    /Each command-local runtime contract owns the detailed stage vocabulary, in-flight status fields, and waiting-state semantics/
  );
  assert.match(skillFile, /blueprint_review_load_findings/);
  assert.match(skillFile, /blueprint_review_authoring_context/);
  assert.match(skillFile, /blueprint_review_validate_model/);
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
  assert.match(skillFile, /Author only the `review\.review-fix` JSON model/i);
  assert.match(skillFile, /same `targetIds` array used for authoring context/i);
  assert.match(skillFile, /Markdown `content`\s+fallback is invalid/i);
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
    "blueprint_review_authoring_context",
    "blueprint_review_validate_model",
    "blueprint_review_record",
    "blueprint_state_update"
  ]) {
    assert.ok(referenceFile.includes(`\`${tool}\``));
  }

  assert.match(referenceFile, /`review\.review-fix`/);
  assert.match(referenceFile, /Author only the `review\.review-fix` JSON model/i);
  assert.match(referenceFile, /Markdown `content` fallback is\s+invalid/i);
  assert.match(referenceFile, /`COMPLETED`, `PARTIAL`, or `BLOCKED`/);
  assert.match(referenceFile, /`Status`, `Readiness`, `Completion State`, and\s+`Next Safe Action`/);
  assert.match(referenceFile, /`Remediation Summary`/);
  assert.match(referenceFile, /`Findings Addressed`/);
  assert.match(referenceFile, /`Changes Made`/);
  assert.match(referenceFile, /`Verification`/);
  assert.match(referenceFile, /`Dependency Plans`/);
  assert.match(referenceFile, /`Manual \/ Deferred Work`/);
  assert.match(referenceFile, /`Gap \/ Repair Routes`/);
  assert.match(referenceFile, /`Follow-Ups`/);
  assert.match(referenceFile, /`Evidence`/);
  assert.match(referenceFile, /`Next Safe Action`/);
  assert.match(referenceFile, /same selected `targetIds` used for\s+authoring/i);
  assert.match(referenceFile, /Use `blueprint-reviewer` only as a bounded analysis helper/i);
  assert.match(referenceFile, /must stay read-only/i);
  assert.match(referenceFile, /must not apply fixes/i);
  assert.match(referenceFile, /browser\/web\/search-only tools as substitutes/i);
  assert.match(referenceFile, /## No-Subagent Fallback/);
  assert.match(referenceFile, /Work one finding at a time/i);
  assert.match(referenceFile, /Reread the implicated source and test files before editing/i);
  assert.match(referenceFile, /Compress carry-forward context/i);
  assert.match(referenceFile, /Model validation failure: repair against the narrowed task schema and retry\s+once/i);
  assert.match(referenceFile, /Every fixed, skipped, or deferred finding ties back to a saved finding id/i);
  assert.match(referenceFile, /No public command surface, catalog status semantics, hook ownership, hidden git\s+automation, or `.planning\/` runtime dependency was introduced/i);
});

test("blueprint-reviewer agent stays code-review-focused while remaining safe for explicit reuse", async () => {
  const agentFile = await readFile(
    path.join(repoRoot, "agents/blueprint-reviewer.md"),
    "utf8"
  );

  assert.match(agentFile, /\/blu-code-review/);
  assert.match(agentFile, /non-code-review reuse contract/i);
  assert.match(agentFile, /follow[\s\S]*parent-provided output contract[\s\S]*stay read-only/i);
  assert.match(agentFile, /Do not act as a fixer or executor agent/i);
  assert.match(agentFile, /browser-only\s+analysis/i);
  assert.doesNotMatch(agentFile, /\/blu-code-review-fix|fix\/defer\/skip|selected finding ids or summaries/i);
});
