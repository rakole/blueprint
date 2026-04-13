import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("add-tests docs and runtime summaries mark the test-generation slice as shipped", async () => {
  const [commandDoc, catalogMarkdown, readme, gemini, memory] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/add-tests.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "README.md"), "utf8"),
    readFile(path.join(repoRoot, "GEMINI.md"), "utf8"),
    readFile(path.join(repoRoot, "MEMORY.md"), "utf8")
  ]);

  assert.match(commandDoc, /Blueprint ships it as an evidence-backed test-generation command/i);
  assert.match(commandDoc, /Primary skill: `blueprint-phase-validation`/);
  assert.match(commandDoc, /blueprint_phase_validation_write/);
  assert.match(commandDoc, /blueprint_artifact_report_write/);
  assert.match(commandDoc, /add-tests-<phase>\.md/);
  assert.match(
    catalogMarkdown,
    /\| `add-tests` \| 4 \| `Quality And Shipping` \| `blueprint-phase-validation` \| `implemented` \| `new or updated repo test files; phase XX-VERIFICATION\.md; \.blueprint\/reports\/add-tests-<phase>\.md; \.blueprint\/STATE\.md` \| `High: repo test mutation plus verification\/report updates\.` \|/
  );
  assert.match(readme, /\/blu-add-tests/);
  assert.match(gemini, /\/blu-add-tests/);
  assert.match(memory, /`add-tests` shipped on 2026-04-13/);
});

test("add-tests is exposed as an implemented validation follow-up command", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["add-tests"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-add-tests.toml");
  assert.equal(entry.primarySkill, "blueprint-phase-validation");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_validation_read",
    "blueprint_phase_validation_write",
    "blueprint_artifact_list",
    "blueprint_artifact_validate",
    "blueprint_artifact_report_write",
    "blueprint_state_load",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-executor",
    "blueprint-verifier"
  ]);
});
