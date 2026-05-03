import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { blueprintPrimaryManifestPath } from "../src/mcp/command-paths.js";
import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const ROADMAP_ADMIN_COMMAND_INPUTS = {
  "add-phase": [
    "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
  ],
  "insert-phase": [
    "skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md"
  ],
  "remove-phase": ["commands/blu-remove-phase.toml"],
  "plan-milestone-gaps": ["commands/blu-plan-milestone-gaps.toml"],
  "audit-milestone": ["commands/blu-audit-milestone.toml"],
  "complete-milestone": ["commands/blu-complete-milestone.toml"],
  "milestone-summary": ["commands/blu-milestone-summary.toml"],
  "new-milestone": ["commands/blu-new-milestone.toml"]
} as const;

test("roadmap-admin implemented commands stay docless when docs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);
  const attemptedDocs = new Set<string>();

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? filePath.pathname : path.resolve(String(filePath));
    const docsIndex = normalizedPath.indexOf("/docs/");

    if (docsIndex >= 0) {
      attemptedDocs.add(normalizedPath.slice(docsIndex + 1));
      const error = new Error("simulated docs absence") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return realReadFile(
      filePath as Parameters<typeof fs.readFile>[0],
      options as Parameters<typeof fs.readFile>[1]
    );
  });

  const catalog = await blueprintCommandCatalog();

  for (const [commandName, expectedInputs] of Object.entries(
    ROADMAP_ADMIN_COMMAND_INPUTS
  )) {
    const metadata = getRuntimeOwnedCommandMetadata(commandName);
    const entry = catalog.commands[commandName];
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.ok(metadata, `${commandName} should have runtime-owned metadata`);
    assert.equal(entry.status, "implemented");
    assert.equal(entry.implemented, true);
    assert.equal(entry.specPath, metadata.sourceId);
    assert.equal(entry.manifestPath, blueprintPrimaryManifestPath(commandName));
    assert.deepEqual(entry.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(entry.optionalAgents, [...metadata.optionalAgents]);
    assert.deepEqual(contract.catalog, entry);
    assert.equal(contract.spec?.path, metadata.sourceId);
    assert.deepEqual(contract.spec?.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.spec?.optionalSubagents, [...metadata.optionalAgents]);
    assert.equal(contract.runtimeReference?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
      ...metadata.requiredTools
    ]);
    assert.deepEqual(contract.runtimeReference?.optionalAgents, [
      ...metadata.optionalAgents
    ]);
    assert.deepEqual(contract.skillInputs.shared, []);
    assert.deepEqual(contract.skillInputs.commandSpecific, [...expectedInputs]);
    assert.deepEqual(contract.skillInputs.effective, [...expectedInputs]);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );
    assert.doesNotMatch(JSON.stringify(contract), /docs\//);
  }

  assert.ok(attemptedDocs.has("docs/COMMAND-CATALOG.md"));
});
