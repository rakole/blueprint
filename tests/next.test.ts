import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("next command manifest references only registered read-oriented router tools", async () => {
  const raw = await readFile(path.join(repoRoot, "commands/blu-next.toml"), "utf8");
  const expectedTools = [
    "blueprint_project_status",
    "blueprint_state_load",
    "blueprint_artifact_list",
    "blueprint_command_catalog"
  ];

  for (const toolName of expectedTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(raw, new RegExp(toolName));
  }

  assert.doesNotMatch(raw, /blueprint_state_update|blueprint_config_set|blueprint_artifact_scaffold/);
});

test("next command manifest preserves safe fallback and routing guarantees", async () => {
  const raw = await readFile(path.join(repoRoot, "commands/blu-next.toml"), "utf8");

  assert.match(raw, /\/blu-new-project/);
  assert.match(raw, /\/blu-health/);
  assert.match(raw, /implemented: true/);
  assert.match(raw, /waiting-state reporting/);
  assert.match(raw, /next safe follow-up/);
  assert.match(raw, /Do not write files, mutate config, or call write-oriented MCP tools/);
  assert.match(raw, /Never rely on slash-command chaining, hidden aliases, or implicit destructive behavior/);
});

test("next command docs and runtime reference preserve waiting-state alignment", async () => {
  const [commandDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/next.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(commandDoc, /Execution profile \| `router`/);
  assert.match(commandDoc, /waiting state/i);
  assert.match(commandDoc, /next safe follow-up command/i);
  assert.match(
    runtimeReference,
    /`next`[\s\S]*report waiting state and the next safe follow-up explicitly/i
  );
});

test("next is exposed as an implemented router command with no blockers", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["next"];

  assert.equal(entry.implemented, true);
  assert.equal(entry.status, "implemented");
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-next.toml");
  assert.deepEqual(entry.blockedBy, []);
});
