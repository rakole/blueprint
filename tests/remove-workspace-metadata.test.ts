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

test("remove-workspace manifest references the maintenance skill, workspace MCP tools, and explicit teardown confirmation guards", async () => {
  const commandFile = await readRepoFile("commands/blu-remove-workspace.toml");

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.match(commandFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(
    commandFile,
    /stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/i
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /mcp_blueprint_blueprint_workspace_registry_get/);
  assert.match(commandFile, /mcp_blueprint_blueprint_workspace_remove/);
  assert.match(commandFile, /workspace-not-found/);
  assert.match(commandFile, /workspace-path-ambiguity/);
  assert.match(commandFile, /registry-drift/);
  assert.match(commandFile, /remove-workspace-confirmation/);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("remove-workspace local runtime contract, runtime resource, and maintenance skill align to the shipped workspace-teardown contract", async () => {
  const [runtimeReference, runtimeContract, skillDoc] = await Promise.all([
    readRepoFile("skills/blueprint-maintenance/references/remove-workspace-runtime-contract.md"),
    buildBlueprintCommandRuntimeContractResource("remove-workspace"),
    readRepoFile("skills/blueprint-maintenance/SKILL.md")
  ]);

  assert.match(runtimeReference, /Stage Mapping/);
  assert.match(runtimeReference, /Resolve[\s\S]*Read[\s\S]*Decide[\s\S]*Execute[\s\S]*Persist[\s\S]*Validate[\s\S]*Route/);
  assert.match(runtimeReference, /`mcp_blueprint_blueprint_workspace_registry_get`/);
  assert.match(runtimeReference, /`mcp_blueprint_blueprint_workspace_remove`/);
  assert.match(runtimeReference, /remove-workspace-confirmation/);
  assert.match(runtimeReference, /workspace-path-ambiguity/);
  assert.match(runtimeReference, /registry-drift/);

  assert.match(skillDoc, /### `remove-workspace`/);
  assert.match(skillDoc, /blueprint_workspace_remove/);
  assert.match(skillDoc, /remove-workspace-confirmation/);

  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /remove-workspace-runtime-contract\.md/);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /resolve a single registry-backed workspace target/i
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

test("repo-facing status docs treat remove-workspace as a shipped command", async () => {
  const [progressFile, memoryFile, catalog, readmeFile, geminiFile] =
    await Promise.all([
      readRepoFile("PROGRESS.md"),
      readRepoFile("MEMORY.md"),
      blueprintCommandCatalog(),
      readRepoFile("README.md"),
      readRepoFile("GEMINI.md")
    ]);
  const entry = catalog.commands["remove-workspace"];
  const metadata = getRuntimeOwnedCommandMetadata("remove-workspace");
  const workspaceTools = workspaceToolDefinitions.map((definition) => definition.name);

  assert.ok(metadata);
  assert.equal(metadata.catalog.wave, 5);
  assert.equal(metadata.catalog.family, "Workspace And Maintenance");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.spec.executionProfile, "high-risk-maintenance");
  assert.equal(metadata.runtimeReference.waveTitle, "Workspace And Maintenance");
  assert.match(metadata.runtimeReference.contractNotes, /Docless manifest\+skill-owned runtime/i);
  assert.match(metadata.runtimeReference.contractNotes, /remove-workspace-runtime-contract\.md/);
  assert.match(
    metadata.runtimeReference.contractNotes,
    /resolve a single registry-backed workspace target/i
  );
  assert.match(
    progressFile,
    /\| [0-9]+ \| `remove-workspace` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `remove-workspace` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.match(memoryFile, /`remove-workspace` shipped on 2026-04-23/);
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, metadata?.sourceId);
  assert.deepEqual(entry.requiredTools, [
    "blueprint_workspace_registry_get",
    "blueprint_workspace_remove"
  ]);
  assert.ok(workspaceTools.includes("blueprint_workspace_registry_get"));
  assert.ok(workspaceTools.includes("blueprint_workspace_remove"));
  assert.match(readmeFile, /`\/blu-remove-workspace`/);
  assert.match(geminiFile, /`\/blu-remove-workspace`/);
});
