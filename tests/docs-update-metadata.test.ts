import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { DOCS_UPDATE_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { loadBlueprintSkillInputs } from "../src/mcp/skill-metadata.js";

const repoRoot = process.cwd();

test("docs-update manifest references the docs skill, evidence posture, and visible progress contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-docs-update.toml"), "utf8");

  assert.match(commandFile, /`blueprint-docs` skill/);
  assert.match(commandFile, /`blueprint-doc-writer` and `blueprint-doc-verifier` subagents/);
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
  assert.match(commandFile, /session-local progress tools only/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-docs\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-doc-writer\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-doc-verifier\.md/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_project_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_summary_digest")));
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /docFiles/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write")));
  assert.match(commandFile, /docs-update-latest/);
  assert.match(commandFile, /`--verify-only`/);
  assert.match(commandFile, /`--force`/);
  assert.match(commandFile, /repo truth/i);
  assert.match(commandFile, /external truth/i);
  assert.match(commandFile, /cited external truth/i);
  assert.match(commandFile, /broad-scope confirmation/i);
  assert.match(commandFile, /doc overwrite confirmation/i);
  assert.match(commandFile, /report overwrite confirmation/i);
  assert.match(commandFile, /\/blu-map-codebase/);
  assert.match(commandFile, /\/blu-progress/);
});

test("docs skill captures the long-running docs-update contract", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-docs/SKILL.md"),
    "utf8"
  );
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-docs",
    "/blu-docs-update",
    async (relativePath) => readFile(path.join(repoRoot, relativePath), "utf8").catch(() => null)
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-docs-update/);
  assert.match(skillFile, /input_bundles:/);
  assert.match(skillFile, /## Runtime Inputs/);
  assert.doesNotMatch(skillFile, /## Required Inputs/);
  assert.doesNotMatch(skillFile, /docs\/commands\/docs-update\.md/);
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, [
    "commands/blu-docs-update.toml",
    "skills/blueprint-docs/references/docs-update-runtime-contract.md"
  ]);
  assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
  assert.match(skillFile, /Execution profile for `docs-update`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /Stage vocabulary for visible docs-update posture: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    skillFile,
    /In-flight status fields for `docs-update`: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /### `docs-update`/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /same-named Gemini CLI agent tool \(`blueprint-doc-writer` or\s+`blueprint-doc-verifier`\)/);
  assert.match(skillFile, /active `\/blu-docs-update` command contract permits the selected agent/);
  assert.match(skillFile, /same-named Gemini agent tool is available/i);
  assert.match(skillFile, /bounded documentation task packet/i);
  assert.match(skillFile, /references\/docs-update-runtime-contract\.md/);
  assert.doesNotMatch(skillFile, /subagent_type/i);
  assert.doesNotMatch(skillFile, /agent definition/i);
  assert.doesNotMatch(skillFile, /agents\/blueprint-doc-/i);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /`--verify-only` as read-only/i);
  assert.match(skillFile, /docs-update-latest/);
  assert.match(skillFile, /repo truth/i);
  assert.match(skillFile, /external truth/i);
  assert.match(skillFile, /broad repo-doc refreshes confirmation-gated/i);
  assert.match(skillFile, /\/blu-map-codebase/);
  assert.match(skillFile, /\/blu-progress/);
  assert.match(skillFile, /Do not rewrite broad internal doc sets/i);
});

test("docs-update runtime metadata and local reference describe the docs spine", async () => {
  const [referenceFile, runtimeContract] = await Promise.all([
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-docs/references/docs-update-runtime-contract.md"
      ),
      "utf8"
    ),
    buildBlueprintCommandRuntimeContractResource("docs-update")
  ]);

  assert.equal(runtimeContract.catalog.specPath, DOCS_UPDATE_RUNTIME_METADATA.sourceId);
  assert.equal(runtimeContract.spec?.path, DOCS_UPDATE_RUNTIME_METADATA.sourceId);
  assert.equal(runtimeContract.spec?.executionProfile, "long-running-mutation");
  assert.deepEqual(runtimeContract.spec?.requiredTools, [
    ...DOCS_UPDATE_RUNTIME_METADATA.requiredTools
  ]);
  assert.equal(runtimeContract.runtimeReference?.path, DOCS_UPDATE_RUNTIME_METADATA.sourceId);
  assert.deepEqual(runtimeContract.runtimeReference?.evidenceState, [
    "locked",
    "runtime-owned",
    "needs-behavior-audit"
  ]);
  assert.deepEqual(runtimeContract.skillInputs.effective, [
    "commands/blu-docs-update.toml",
    "skills/blueprint-docs/references/docs-update-runtime-contract.md"
  ]);
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );

  assert.match(referenceFile, /# Docs Update Runtime Contract/);
  assert.match(
    referenceFile,
    /Keep `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and\s+`Route` visible/
  );
  assert.match(
    referenceFile,
    /Track resolved scope, active stage, pending gate, execution mode/
  );
  assert.match(referenceFile, /repo truth/i);
  assert.match(referenceFile, /cited external truth/i);
  assert.match(referenceFile, /returned `inputsUsed` as the authoritative digest scope/i);
  assert.match(referenceFile, /`--verify-only` mode, keep repo documentation read-only/i);
  assert.match(referenceFile, /Gemini CLI exposes an enabled delegated agent as a same-named tool/i);
  assert.match(referenceFile, /Do not\s+read, inline, or load any separate agent source before delegation/i);
  assert.match(referenceFile, /same-named `blueprint-doc-writer` Gemini agent tool with a bounded\s+documentation task packet/i);
  assert.match(referenceFile, /same-named `blueprint-doc-verifier` Gemini agent tool with a bounded\s+documentation task packet/i);
  assert.match(referenceFile, /active `\/blu-docs-update` command\s+contract permits it/i);
  assert.match(referenceFile, /tool is available in the current host session/i);
  assert.doesNotMatch(referenceFile, /subagent_type/i);
  assert.doesNotMatch(referenceFile, /agents\/blueprint-doc-/i);
  assert.match(referenceFile, /bare `reportName`\s+`docs-update-latest`/i);
  assert.match(referenceFile, /Pending gates are limited/i);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation profile for scoped repo documentation refresh or verification/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /skills\/blueprint-docs\/references\/docs-update-runtime-contract\.md/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /digest inputsUsed/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /bare reportName docs-update-latest/i
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /\/blu-map-codebase.*\/blu-progress/i
  );
});
