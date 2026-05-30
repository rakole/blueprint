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

test("new-workspace manifest references the maintenance skill, workspace MCP tools, and explicit preview gates", async () => {
  const commandFile = await readRepoFile("commands/blu-new-workspace.toml");

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(
    commandFile,
    /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /mcp_blueprint_blueprint_config_get/);
  assert.match(commandFile, /mcp_blueprint_blueprint_workspace_registry_get/);
  assert.match(commandFile, /mcp_blueprint_blueprint_workspace_create/);
  assert.match(commandFile, /maintenance\.workspace_root/);
  assert.match(commandFile, /~\/blueprint-workspaces/);
  assert.match(
    commandFile,
    /resolved workspace name, path, repo list, strategy, branch/i
  );
  assert.match(commandFile, /registry mutation plan/i);
  assert.match(commandFile, /new-workspace-confirmation/);
  assert.match(commandFile, /do not silently switch to `clone`/i);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("new-workspace runtime resource, local contract, and maintenance skill align to the shipped high-risk workspace contract", async () => {
  const [runtimeContract, skillDoc, runtimeReference] = await Promise.all([
    buildBlueprintCommandRuntimeContractResource("new-workspace"),
    readRepoFile("skills/blueprint-maintenance/SKILL.md"),
    readRepoFile("skills/blueprint-maintenance/references/new-workspace-runtime-contract.md")
  ]);

  assert.match(runtimeReference, /Stage Mapping/);
  assert.match(runtimeReference, /Resolve[\s\S]*Read[\s\S]*Decide[\s\S]*Execute[\s\S]*Persist[\s\S]*Validate[\s\S]*Route/);
  assert.match(runtimeReference, /manifest path/i);
  assert.match(runtimeReference, /registry path/i);
  assert.match(runtimeReference, /new-workspace-confirmation/);
  assert.match(runtimeReference, /Dirty working tree, invalid source repo, malformed registry, target conflict, or unsafe strategy is a hard stop/);
  assert.match(runtimeReference, /host-global registry mutation/i);

  assert.match(skillDoc, /\/blu-new-workspace/);
  assert.match(skillDoc, /blueprint_workspace_registry_get/);
  assert.match(skillDoc, /blueprint_workspace_create/);
  assert.match(skillDoc, /new-workspace-confirmation/);
  assert.doesNotMatch(
    skillDoc,
    /`new-workspace`, `remove-workspace`, `workstreams`, `update`, and `reapply-patches` remain documented maintenance commands, but they are not routable/
  );

  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /new-workspace-runtime-contract\.md/);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /derive workspace root from config or explicit input/i
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

test("repo-facing status docs treat new-workspace as a shipped Wave 5 command", async () => {
  const [progressFile, memoryFile, catalog] =
    await Promise.all([
      readRepoFile("PROGRESS.md"),
      readRepoFile("MEMORY.md"),
      blueprintCommandCatalog()
    ]);
  const entry = catalog.commands["new-workspace"];
  const metadata = getRuntimeOwnedCommandMetadata("new-workspace");
  const workspaceTools = workspaceToolDefinitions.map((definition) => definition.name);

  assert.ok(metadata);
  assert.equal(metadata.catalog.wave, 5);
  assert.equal(metadata.catalog.family, "Workspace And Maintenance");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.spec.executionProfile, "high-risk-maintenance");
  assert.equal(metadata.runtimeReference.waveTitle, "Workspace And Maintenance");
  assert.match(metadata.runtimeReference.contractNotes, /Docless manifest\+skill-owned runtime/i);
  assert.match(metadata.runtimeReference.contractNotes, /new-workspace-runtime-contract\.md/);
  assert.match(
    metadata.runtimeReference.contractNotes,
    /derive workspace root from config or explicit input/i
  );
  assert.match(
    progressFile,
    /\| [0-9]+ \| `new-workspace` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `new-workspace` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.match(memoryFile, /`new-workspace` shipped on 2026-04-22/);
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, metadata?.sourceId);
  assert.deepEqual(entry.requiredTools, [
    "blueprint_config_get",
    "blueprint_workspace_registry_get",
    "blueprint_workspace_create"
  ]);
  assert.ok(workspaceTools.includes("blueprint_workspace_registry_get"));
  assert.ok(workspaceTools.includes("blueprint_workspace_create"));
});
