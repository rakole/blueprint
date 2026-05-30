import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  MAP_CODEBASE_RUNTIME_METADATA,
  SPEC_PHASE_RUNTIME_METADATA,
  listRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

const REPRESENTATIVE_COMMANDS = [
  "new-project",
  "help",
  "map-codebase",
  "spec-phase",
  "plan-phase",
  "impact",
  "docs-update",
  "pr-branch",
  "ship",
  "undo",
  "cleanup",
  "update"
] as const;

function isBundledControlPlaneDocPath(value: string): boolean {
  return /^docs\//.test(value);
}

test("runtime-owned command metadata keeps command and runtime contract truth source-owned", () => {
  for (const metadata of listRuntimeOwnedCommandMetadata()) {
    assert.equal(metadata.spec.path, metadata.sourceId);
    assert.equal(metadata.runtimeReference.path, metadata.sourceId);
    assert.equal(isBundledControlPlaneDocPath(metadata.spec.path), false);
    assert.equal(isBundledControlPlaneDocPath(metadata.runtimeReference.path), false);
    assert.equal(
      (metadata.requiredInputPaths ?? []).some((input) => isBundledControlPlaneDocPath(input)),
      false
    );
  }
});

test("runtime contract resources stay docs-free when command runtime docs throw during lookup", async () => {
  for (const commandName of REPRESENTATIVE_COMMANDS) {
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName, {
      readRelativePath: async (relativePath) => {
        if (isBundledControlPlaneDocPath(relativePath)) {
          throw new Error(`simulated docs failure: ${relativePath}`);
        }

        return readFile(path.join(repoRoot, relativePath), "utf8");
      }
    });

    assert.equal(contract.command, commandName);
    assert.equal(contract.catalog.command, `/blu-${commandName}`);
    assert.equal(contract.catalog.implemented, true);
    assert.equal(contract.catalog.status, "implemented");
    assert.ok(contract.catalog.specPath);
    assert.ok(contract.spec?.path);
    assert.ok(contract.runtimeReference?.path);
    assert.equal(isBundledControlPlaneDocPath(contract.catalog.specPath), false);
    assert.equal(isBundledControlPlaneDocPath(contract.spec.path), false);
    assert.equal(isBundledControlPlaneDocPath(contract.runtimeReference.path), false);
    assert.equal(
      contract.skillInputs.effective.some((input) => isBundledControlPlaneDocPath(input)),
      false
    );
  }
});

test("runtime catalog exposes source-owned spec paths for metadata-backed commands", async () => {
  const catalog = await blueprintCommandCatalog();

  assert.equal(catalog.commands["map-codebase"].specPath, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.equal(catalog.commands["spec-phase"].specPath, SPEC_PHASE_RUNTIME_METADATA.sourceId);
  assert.equal(
    isBundledControlPlaneDocPath(catalog.commands["map-codebase"].specPath ?? ""),
    false
  );
  assert.equal(
    isBundledControlPlaneDocPath(catalog.commands["spec-phase"].specPath ?? ""),
    false
  );
});

test("runtime resources keep command-specific inputs anchored to manifests and skill references", async () => {
  const [planPhase, impact, docsUpdate] = await Promise.all([
    buildBlueprintCommandRuntimeContractResource("plan-phase"),
    buildBlueprintCommandRuntimeContractResource("impact"),
    buildBlueprintCommandRuntimeContractResource("docs-update")
  ]);

  assert.deepEqual(planPhase.skillInputs.commandSpecific, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.deepEqual(impact.skillInputs.commandSpecific, [
    "commands/blu-impact.toml",
    "skills/blueprint-impact/references/impact-runtime-contract.md"
  ]);
  assert.deepEqual(docsUpdate.skillInputs.commandSpecific, [
    "commands/blu-docs-update.toml",
    "skills/blueprint-docs/references/docs-update-runtime-contract.md"
  ]);
});
