import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource
} from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { workspaceToolDefinitions } from "../src/mcp/tools/workspace.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("reapply-patches manifest references the maintenance skill, patch MCP tools, and explicit replay confirmation guards", async () => {
  const commandFile = await readRepoFile("commands/blu-reapply-patches.toml");

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.match(commandFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(
    commandFile,
    /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(commandFile, /mcp_blueprint_blueprint_patch_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_patch_reapply/);
  assert.match(commandFile, /mcp_blueprint_blueprint_patch_record/);
  assert.match(commandFile, /dirty-working-tree/);
  assert.match(commandFile, /malformed-patch-registry/);
  assert.match(commandFile, /missing-patch-target/);
  assert.match(commandFile, /compatibility-mismatch/);
  assert.match(commandFile, /installed-extension-target/);
  assert.match(commandFile, /reapply-patches-confirmation/);
  assert.match(commandFile, /preflight -> preview -> confirm -> replay -> record/);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("reapply-patches local runtime contract, runtime resource, and maintenance skill align to the shipped patch-replay contract", async () => {
  const [runtimeReference, runtimeContract, skillDoc, workspaceSource] =
    await Promise.all([
      readRepoFile("skills/blueprint-maintenance/references/reapply-patches-runtime-contract.md"),
      buildBlueprintCommandRuntimeContractResource("reapply-patches"),
      readRepoFile("skills/blueprint-maintenance/SKILL.md"),
      readRepoFile("src/mcp/tools/workspace.ts")
    ]);

  assert.match(runtimeReference, /Stage Mapping/);
  assert.match(runtimeReference, /Resolve[\s\S]*Read[\s\S]*Decide[\s\S]*Execute[\s\S]*Persist[\s\S]*Validate[\s\S]*Route/);
  assert.match(runtimeReference, /~\/.<host>\/blueprint\/patches\//);
  assert.match(runtimeReference, /reapply-patches-confirmation/);
  assert.match(runtimeReference, /dirty tree/i);
  assert.match(runtimeReference, /compatibility mismatch/i);
  assert.match(runtimeReference, /installed-extension target/i);
  assert.match(runtimeReference, /preflight -> preview -> confirm -> replay -> record/);

  assert.match(skillDoc, /\/blu-reapply-patches/);
  assert.match(skillDoc, /blueprint_patch_list/);
  assert.match(skillDoc, /blueprint_patch_reapply/);
  assert.match(skillDoc, /blueprint_patch_record/);
  assert.match(skillDoc, /reapply-patches-confirmation/);

  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /reapply-patches-runtime-contract\.md/);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /dry-run the exact replay set/i
  );
  assert.deepEqual(
    runtimeContract.runtimeReference?.exactMcpDestination,
    runtimeContract.catalog.requiredTools
  );
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );

  assert.match(workspaceSource, /function patchIndexPath\(registryPath: string\)[\s\S]*"index\.json"/);
  assert.match(workspaceSource, /function patchManifestPath\(registryPath: string, patchId: string\)[\s\S]*`\$\{patchId\}\.json`/);
  assert.match(workspaceSource, /function patchAuditPath\(registryPath: string, patchId: string\)[\s\S]*`\$\{patchId\}\.audit\.ndjson`/);
});

test("repo-facing status docs treat reapply-patches as a shipped command", async () => {
  const [progressFile, memoryFile, catalog, readmeFile, geminiFile] =
    await Promise.all([
      readRepoFile("PROGRESS.md"),
      readRepoFile("MEMORY.md"),
      blueprintCommandCatalog(),
      readRepoFile("README.md"),
      readRepoFile("GEMINI.md")
    ]);
  const entry = catalog.commands["reapply-patches"];
  const metadata = getRuntimeOwnedCommandMetadata("reapply-patches");
  const workspaceTools = workspaceToolDefinitions.map((definition) => definition.name);

  assert.ok(metadata);
  assert.equal(metadata.catalog.wave, 5);
  assert.equal(metadata.catalog.family, "Workspace And Maintenance");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.spec.executionProfile, "high-risk-maintenance");
  assert.equal(metadata.runtimeReference.waveTitle, "Workspace And Maintenance");
  assert.match(metadata.runtimeReference.contractNotes, /Docless manifest\+skill-owned runtime/i);
  assert.match(metadata.runtimeReference.contractNotes, /reapply-patches-runtime-contract\.md/);
  assert.match(metadata.runtimeReference.contractNotes, /dry-run the exact replay set/i);
  assert.match(
    progressFile,
    /\| [0-9]+ \| `reapply-patches` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `reapply-patches` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.match(memoryFile, /`reapply-patches` shipped on 2026-04-22/);
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, metadata?.sourceId);
  assert.deepEqual(entry.requiredTools, [
    "blueprint_patch_list",
    "blueprint_patch_reapply",
    "blueprint_patch_record"
  ]);
  assert.ok(workspaceTools.includes("blueprint_patch_list"));
  assert.ok(workspaceTools.includes("blueprint_patch_reapply"));
  assert.ok(workspaceTools.includes("blueprint_patch_record"));
  assert.match(readmeFile, /`\/blu-reapply-patches`/);
  assert.match(geminiFile, /`\/blu-reapply-patches`/);
});
