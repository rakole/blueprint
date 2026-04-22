import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

test("new-workspace docs, runtime reference, and maintenance skill align to the shipped high-risk workspace contract", async () => {
  const [commandDoc, runtimeReference, skillDoc] = await Promise.all([
    readRepoFile("docs/commands/new-workspace.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("skills/blueprint-maintenance/SKILL.md")
  ]);

  assert.match(commandDoc, /\| Execution profile \| `high-risk-maintenance` \|/);
  assert.match(
    commandDoc,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    commandDoc,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(commandDoc, /<workspace>\/\.blueprint-workspace\.json/);
  assert.match(commandDoc, /~\/.<host>\/blueprint\/workspaces\.json/);
  assert.match(commandDoc, /new-workspace-confirmation/);
  assert.match(commandDoc, /dirty-working-tree/);
  assert.match(commandDoc, /transactional/i);

  assert.match(skillDoc, /\/blu-new-workspace/);
  assert.match(skillDoc, /blueprint_workspace_registry_get/);
  assert.match(skillDoc, /blueprint_workspace_create/);
  assert.match(skillDoc, /new-workspace-confirmation/);
  assert.doesNotMatch(
    skillDoc,
    /`new-workspace`, `remove-workspace`, `workstreams`, `update`, and `reapply-patches` remain documented maintenance commands, but they are not routable/
  );

  assert.match(
    runtimeReference,
    /\| `new-workspace` \| `docs\/commands\/new-workspace\.md` \| `blueprint-maintenance` \|/
  );
  assert.match(runtimeReference, /High-risk-maintenance profile for confirmation-gated workspace creation/i);
  assert.match(
    runtimeReference,
    /resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(runtimeReference, /workspace name, path, repo members, strategy, branch, manifest path, and registry mutation plan/i);
  assert.match(runtimeReference, /transactional/i);
});

test("repo-facing status docs treat new-workspace as a shipped Wave 5 command", async () => {
  const [architectureFile, handoffFile, progressFile, memoryFile, catalogFile, mcpToolsFile] =
    await Promise.all([
      readRepoFile("docs/ARCHITECTURE.md"),
      readRepoFile("docs/HANDOFF.md"),
      readRepoFile("PROGRESS.md"),
      readRepoFile("MEMORY.md"),
      readRepoFile("docs/COMMAND-CATALOG.md"),
      readRepoFile("docs/MCP-TOOLS.md")
    ]);

  assert.match(architectureFile, /shipped Wave 5 maintenance commands, `new-workspace` and `cleanup`/i);
  assert.match(handoffFile, /shipped Wave 5 maintenance commands `new-workspace` and `cleanup`/i);
  assert.match(
    progressFile,
    /\| [0-9]+ \| `new-workspace` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `new-workspace` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.match(memoryFile, /`new-workspace` shipped on 2026-04-22/);
  assert.match(catalogFile, /\| `new-workspace` \| 5 \| `Workspace And Maintenance` \| `blueprint-maintenance` \| `implemented` \|/);
  assert.match(mcpToolsFile, /### Workspace/);
  assert.match(mcpToolsFile, /`blueprint_workspace_registry_get`/);
  assert.match(mcpToolsFile, /`blueprint_workspace_create`/);
});
