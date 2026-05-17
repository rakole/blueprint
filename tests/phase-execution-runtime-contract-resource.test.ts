import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const PHASE_EXECUTION_COMMANDS = ["execute-phase", "quick", "fast"] as const;

function bundledRelativePath(value: unknown): string | null {
  const pathname = value instanceof URL ? value.pathname : String(value);
  const relativePath = path.relative(process.cwd(), pathname);

  if (relativePath.startsWith("..")) {
    return null;
  }

  return relativePath;
}

function makeBundledDocsUnavailable(t: TestContext): string[] {
  const attemptedDocs: string[] = [];
  const originalReadFile = fs.readFile;

  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const relativePath = bundledRelativePath(args[0]);

    if (
      relativePath === "docs/COMMAND-CATALOG.md" ||
      relativePath === "docs/RUNTIME-REFERENCE.md" ||
      /^docs\/commands\/.+\.md$/.test(relativePath ?? "")
    ) {
      attemptedDocs.push(relativePath);
      const error = new Error("ENOENT");
      (error as NodeJS.ErrnoException).code = "ENOENT";
      throw error;
    }

    return originalReadFile(...args);
  }) as typeof fs.readFile;

  t.after(() => {
    fs.readFile = originalReadFile;
  });

  return attemptedDocs;
}

function isDisallowedDocsRead(relativePath: string): boolean {
  if (relativePath === "docs/RUNTIME-REFERENCE.md") {
    return true;
  }

  return /^docs\/commands\/.+\.md$/.test(relativePath);
}

test("phase-execution runtime contracts do not read bundled docs command specs or runtime reference rows", async (t) => {
  const attemptedDocs = makeBundledDocsUnavailable(t);

  for (const commandName of PHASE_EXECUTION_COMMANDS) {
    const metadata = getRuntimeOwnedCommandMetadata(commandName);
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.ok(metadata, `Missing runtime metadata for ${commandName}`);
    assert.equal(contract.command, commandName);
    assert.equal(contract.catalog.status, "implemented");
    assert.equal(contract.catalog.specPath, metadata.sourceId);
    assert.equal(contract.spec.path, metadata.sourceId);
    assert.equal(contract.runtimeReference.path, metadata.sourceId);
    assert.equal(contract.runtimeReference.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.spec.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.spec.optionalSubagents, [...metadata.optionalAgents]);
    assert.deepEqual(contract.runtimeReference.exactMcpDestination, [
      ...metadata.requiredTools
    ]);
    assert.deepEqual(contract.runtimeReference.optionalAgents, [
      ...metadata.optionalAgents
    ]);
    assert.deepEqual(contract.skillInputs.shared, []);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );

    if (commandName === "execute-phase") {
      assert.match(
        contract.runtimeReference.contractNotes ?? "",
        /use blueprint_phase_execution_targets as the common read authority/i
      );
      assert.match(
        contract.runtimeReference.contractNotes ?? "",
        /read blueprint_phase_summary_read only when overwrite or repair reasoning truly needs existing summary body text/i
      );
      assert.match(
        contract.runtimeReference.contractNotes ?? "",
        /do not treat blueprint_artifact_validate or blueprint_state_load as default pre-write gates on the common path/i
      );
      assert.match(
        contract.runtimeReference.contractNotes ?? "",
        /blueprint_phase_summary_index followed by blueprint_artifact_validate and blueprint_state_update with base: "synced"/i
      );
    }
  }

  assert.deepEqual(attemptedDocs.filter(isDisallowedDocsRead), []);
});
