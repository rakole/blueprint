import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource
} from "../src/mcp/command-resources.js";

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

test("remove-workspace docs, runtime resource, and maintenance skill align to the shipped workspace-teardown contract", async () => {
  const [commandDoc, runtimeContract, skillDoc, mcpToolsDoc] = await Promise.all([
    readRepoFile("docs/commands/remove-workspace.md"),
    buildBlueprintCommandRuntimeContractResource("remove-workspace"),
    readRepoFile("skills/blueprint-maintenance/SKILL.md"),
    readRepoFile("docs/MCP-TOOLS.md")
  ]);

  assert.match(commandDoc, /\| Execution profile \| `high-risk-maintenance` \|/);
  assert.match(commandDoc, /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(commandDoc, /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/);
  assert.match(commandDoc, /`blueprint_workspace_registry_get`/);
  assert.match(commandDoc, /`blueprint_workspace_remove`/);
  assert.match(commandDoc, /remove-workspace-confirmation/);
  assert.match(commandDoc, /workspace-path-ambiguity/);
  assert.match(commandDoc, /registry-drift/);

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

  assert.match(mcpToolsDoc, /`blueprint_workspace_remove`/);
  assert.match(
    mcpToolsDoc,
    /`remove-workspace` uses `blueprint_workspace_registry_get` and `blueprint_workspace_remove`/
  );
});

test("repo-facing status docs treat remove-workspace as a shipped command", async () => {
  const [architectureFile, handoffFile, progressFile, memoryFile, catalogFile, readmeFile, geminiFile] =
    await Promise.all([
      readRepoFile("docs/ARCHITECTURE.md"),
      readRepoFile("docs/HANDOFF.md"),
      readRepoFile("PROGRESS.md"),
      readRepoFile("MEMORY.md"),
      readRepoFile("docs/COMMAND-CATALOG.md"),
      readRepoFile("README.md"),
      readRepoFile("GEMINI.md")
    ]);

  assert.match(
    architectureFile,
    /shipped Wave 5 maintenance commands, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, and `reapply-patches`/i
  );
  assert.match(
    handoffFile,
    /shipped Wave 5 maintenance commands `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, and `reapply-patches`/i
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
  assert.match(
    catalogFile,
    /\| `remove-workspace` \| 5 \| `Workspace And Maintenance` \| `blueprint-maintenance` \| `implemented` \|/
  );
  assert.match(readmeFile, /`\/blu-remove-workspace`/);
  assert.match(geminiFile, /`\/blu-remove-workspace`/);
});
