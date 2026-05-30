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

test("workstreams manifest references the maintenance skill, workstream MCP tools, and ask_user confirmation gates", async () => {
  const commandFile = await readRepoFile("commands/blu-workstreams.toml");

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /`Resolve`, `Read`, `Decide`, `Persist`, and `Route`/);
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /mcp_blueprint_blueprint_workstream_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_workstream_mutate/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /workstream-switch-confirmation/);
  assert.match(commandFile, /workstream-archive-confirmation/);
  assert.match(commandFile, /missing-resume-snapshot/);
  assert.match(commandFile, /workflow\.use_workstreams/);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("workstreams local runtime contract, runtime resource, and maintenance skill align to the shipped interactive workstream contract", async () => {
  const [runtimeReference, runtimeContract, skillDoc] = await Promise.all([
    readRepoFile("skills/blueprint-maintenance/references/workstreams-runtime-contract.md"),
    buildBlueprintCommandRuntimeContractResource("workstreams"),
    readRepoFile("skills/blueprint-maintenance/SKILL.md")
  ]);

  assert.match(runtimeReference, /Stage Mapping/);
  assert.match(runtimeReference, /Resolve[\s\S]*Read[\s\S]*Decide[\s\S]*Execute[\s\S]*Persist[\s\S]*Validate[\s\S]*Route/);
  assert.match(runtimeReference, /\.blueprint\/workstreams\//);
  assert.match(runtimeReference, /`WORKSTREAMS\.md` regeneration and per-stream `state\.json` writes/);
  assert.match(runtimeReference, /workstream-switch-confirmation/);
  assert.match(runtimeReference, /missing-resume-snapshot/);
  assert.match(runtimeReference, /corrupt-workstream-index/);

  assert.match(skillDoc, /\/blu-workstreams/);
  assert.match(skillDoc, /blueprint_workstream_list/);
  assert.match(skillDoc, /blueprint_workstream_mutate/);
  assert.match(skillDoc, /workstream-switch-confirmation/);
  assert.match(skillDoc, /workstream-archive-confirmation/);
  assert.match(skillDoc, /workflow\.use_workstreams/);
  assert.doesNotMatch(
    skillDoc,
    /`remove-workspace`, `workstreams`, and `update` remain documented maintenance commands, but they are not routable/
  );

  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /workstreams-runtime-contract\.md/);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /switch\/archive confirmation gates before mutation/i
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

test("repo-facing status docs treat workstreams as a shipped Wave 5 command", async () => {
  const [progressFile, memoryFile, catalog] =
    await Promise.all([
      readRepoFile("PROGRESS.md"),
      readRepoFile("MEMORY.md"),
      blueprintCommandCatalog()
    ]);
  const entry = catalog.commands["workstreams"];
  const metadata = getRuntimeOwnedCommandMetadata("workstreams");
  const workspaceTools = workspaceToolDefinitions.map((definition) => definition.name);

  assert.ok(metadata);
  assert.equal(metadata.catalog.wave, 5);
  assert.equal(metadata.catalog.family, "Workspace And Maintenance");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.spec.executionProfile, "interactive-read");
  assert.equal(metadata.runtimeReference.waveTitle, "Workspace And Maintenance");
  assert.match(metadata.runtimeReference.contractNotes, /Docless manifest\+skill-owned runtime/i);
  assert.match(metadata.runtimeReference.contractNotes, /workstreams-runtime-contract\.md/);
  assert.match(
    metadata.runtimeReference.contractNotes,
    /switch\/archive confirmation gates before mutation/i
  );
  assert.match(
    progressFile,
    /\| [0-9]+ \| `workstreams` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| Medium \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `workstreams` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| Medium \|/
  );
  assert.match(memoryFile, /`workstreams` shipped on 2026-04-23/);
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, metadata?.sourceId);
  assert.deepEqual(entry.requiredTools, [
    "blueprint_workstream_list",
    "blueprint_workstream_mutate",
    "blueprint_state_update"
  ]);
  assert.ok(workspaceTools.includes("blueprint_workstream_list"));
  assert.ok(workspaceTools.includes("blueprint_workstream_mutate"));
});
