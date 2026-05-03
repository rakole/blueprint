import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource
} from "../src/mcp/command-resources.js";
import {
  getRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";
import { blueprintPrimaryManifestPath } from "../src/mcp/command-paths.js";

const repoRoot = process.cwd();
const MAINTENANCE_COMMANDS = [
  "pr-branch",
  "ship",
  "undo",
  "new-workspace",
  "remove-workspace",
  "workstreams",
  "cleanup",
  "update",
  "reapply-patches"
] as const;

async function readWithAbsentDocs(relativePath: string): Promise<string | null> {
  if (relativePath.startsWith("docs/")) {
    return null;
  }

  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}

test("maintenance runtime contract resources build from runtime metadata when docs reads are absent", async () => {
  for (const commandName of MAINTENANCE_COMMANDS) {
    const metadata = getRuntimeOwnedCommandMetadata(commandName);
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName, {
      readRelativePath: readWithAbsentDocs
    });
    const runtimeContractPath = metadata?.requiredInputPaths?.[0];

    assert.ok(metadata, `${commandName} should have runtime-owned metadata`);
    assert.ok(runtimeContractPath, `${commandName} should require a runtime contract input`);
    assert.equal(contract.catalog.status, "implemented");
    assert.equal(contract.catalog.implemented, true);
    assert.equal(contract.catalog.specPath, metadata.sourceId);
    assert.equal(contract.spec?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
      ...metadata.requiredTools
    ]);
    assert.deepEqual(contract.skillInputs.shared, []);
    assert.deepEqual(contract.skillInputs.commandSpecific, [
      blueprintPrimaryManifestPath(commandName),
      runtimeContractPath
    ]);
    assert.deepEqual(contract.skillInputs.effective, [
      blueprintPrimaryManifestPath(commandName),
      runtimeContractPath
    ]);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );
    assert.doesNotMatch(JSON.stringify(contract.skillInputs), /docs\//);
  }
});
