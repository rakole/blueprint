import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource
} from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { updateToolDefinitions } from "../src/mcp/tools/update.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("update manifest references the maintenance skill, update MCP tools, and the ask_user mode gate", async () => {
  const commandFile = await readRepoFile("commands/blu-update.toml");

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_update_check/);
  assert.match(commandFile, /mcp_blueprint_blueprint_update_plan/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(
    commandFile,
    /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /`ask_user` mode gate/i);
  assert.match(commandFile, /update-mode-gate/);
  assert.match(commandFile, /manual fallback/i);
  assert.match(commandFile, /~\/.<host>\/blueprint\/updates\//);
  assert.match(commandFile, /persistenceStatus === "saved"/);
  assert.match(commandFile, /non-null `path`/);
  assert.match(commandFile, /`persistenceStatus === "not_saved"`/);
  assert.match(commandFile, /Never write into the installed extension directory/i);
  assert.match(commandFile, /restart guidance/i);
});

test("update local runtime contract, maintenance skill, and runtime resource align to the shipped advisory update contract", async () => {
  const [runtimeReference, skillDoc, runtimeContract] = await Promise.all([
    readRepoFile("skills/blueprint-maintenance/references/update-runtime-contract.md"),
    readRepoFile("skills/blueprint-maintenance/SKILL.md"),
    buildBlueprintCommandRuntimeContractResource("update")
  ]);

  assert.match(runtimeReference, /Stage Mapping/);
  assert.match(runtimeReference, /`mcp_blueprint_blueprint_update_check`/);
  assert.match(runtimeReference, /`mcp_blueprint_blueprint_update_plan`/);
  assert.match(runtimeReference, /update-mode-gate/);
  assert.match(runtimeReference, /manual fallback/i);
  assert.match(runtimeReference, /persistenceStatus === "saved"/);
  assert.match(runtimeReference, /non-null `path`/);
  assert.match(runtimeReference, /`persistenceStatus === "not_saved"`/);
  assert.match(runtimeReference, /`savedPaths` and `intendedPath` as attempted targets/i);
  assert.match(runtimeReference, /restart guidance/i);
  assert.match(runtimeReference, /installed extension directory/i);

  assert.match(skillDoc, /\/blu-update/);
  assert.match(skillDoc, /blueprint_update_check/);
  assert.match(skillDoc, /blueprint_update_plan/);
  assert.match(skillDoc, /Execution profile: `interactive-read`/);
  assert.match(skillDoc, /update-mode-gate/);
  assert.match(skillDoc, /Keep all Blueprint-owned update persistence under `~\/.<host>\/blueprint\/updates\/`/i);
  assert.match(skillDoc, /persistenceStatus === "saved"/);
  assert.match(skillDoc, /non-null `path`/);
  assert.match(skillDoc, /`savedPaths` and `intendedPath` as attempted targets/i);
  assert.doesNotMatch(
    skillDoc,
    /`remove-workspace`, `workstreams`, `update`, and `reapply-patches` remain documented maintenance commands, but they are not routable/
  );

  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /update-runtime-contract\.md/);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /update-mode-gate for saved checklist versus manual fallback/i
  );
  assert.deepEqual(
    runtimeContract.runtimeReference?.exactMcpDestination,
    runtimeContract.catalog.requiredTools
  );
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("repo-facing status docs treat update as a shipped Wave 5 command", async () => {
  const [catalog, progressFile, memoryFile] =
    await Promise.all([
      blueprintCommandCatalog(),
      readRepoFile("PROGRESS.md"),
      readRepoFile("MEMORY.md")
    ]);
  const entry = catalog.commands["update"];
  const metadata = getRuntimeOwnedCommandMetadata("update");

  assert.ok(metadata);
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, metadata?.sourceId);
  assert.deepEqual(entry.requiredTools, ["blueprint_update_check", "blueprint_update_plan"]);
  assert.equal(metadata.catalog.wave, 5);
  assert.equal(metadata.catalog.family, "Workspace And Maintenance");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.spec.executionProfile, "interactive-read");
  assert.equal(metadata.runtimeReference.waveTitle, "Workspace And Maintenance");
  assert.match(metadata.runtimeReference.contractNotes, /Docless manifest\+skill-owned runtime/i);
  assert.match(metadata.runtimeReference.contractNotes, /update-runtime-contract\.md/);
  assert.match(
    metadata.runtimeReference.contractNotes,
    /update-mode-gate for saved checklist versus manual fallback/i
  );
  assert.match(
    progressFile,
    /\| [0-9]+ \| `update` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| Low \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `update` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| Low \|/
  );
  assert.match(memoryFile, /`update` shipped on 2026-04-22/);
});

test("live update tool exports and source-owned result shapes match the shipped field contract", async () => {
  const updateSource = await readRepoFile("src/mcp/tools/update.ts");
  const toolNames = updateToolDefinitions.map((definition) => definition.name);

  assert.deepEqual(toolNames, ["blueprint_update_check", "blueprint_update_plan"]);
  assert.match(updateSource, /type UpdateCheckResult = \{[\s\S]*host:[\s\S]*extensionPath:[\s\S]*extensionManifestPath:[\s\S]*installedVersion:[\s\S]*installProvenance:[\s\S]*latestVersionLookupStatus:[\s\S]*latestVersion:[\s\S]*latestVersionSource:[\s\S]*updateAvailable:[\s\S]*warnings:/);
  assert.doesNotMatch(updateSource, /type UpdateCheckResult = \{[\s\S]*installSource:[\s\S]*jsonPath:[\s\S]*markdownPath:/);
  assert.match(updateSource, /type UpdatePlanResult = UpdateCheckResult & \{[\s\S]*mode:[\s\S]*steps:[\s\S]*notes:[\s\S]*requiresRestart:[\s\S]*savedPaths:[\s\S]*updatesDir:[\s\S]*metadataPath:[\s\S]*checklistPath:[\s\S]*intendedPath:[\s\S]*path:[\s\S]*status:[\s\S]*persistenceStatus:/);
  assert.doesNotMatch(updateSource, /type UpdatePlanResult = UpdateCheckResult & \{[\s\S]*installSource:[\s\S]*jsonPath:[\s\S]*markdownPath:/);
});
