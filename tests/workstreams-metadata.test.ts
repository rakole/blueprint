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

test("workstreams docs, runtime resource, and maintenance skill align to the shipped interactive workstream contract", async () => {
  const [commandDoc, runtimeContract, skillDoc] = await Promise.all([
    readRepoFile("docs/commands/workstreams.md"),
    buildBlueprintCommandRuntimeContractResource("workstreams"),
    readRepoFile("skills/blueprint-maintenance/SKILL.md")
  ]);

  assert.match(commandDoc, /\| Execution profile \| `interactive-read` \|/);
  assert.match(
    commandDoc,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Persist`, `Route`/
  );
  assert.match(
    commandDoc,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(commandDoc, /`ask_user`/);
  assert.match(commandDoc, /\.blueprint\/workstreams\/WORKSTREAMS\.md/);
  assert.match(commandDoc, /\.blueprint\/workstreams\/<slug>\/state\.json/);
  assert.match(commandDoc, /workstream-switch-confirmation/);
  assert.match(commandDoc, /missing-resume-snapshot/);
  assert.match(commandDoc, /corrupt-workstream-index/);

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
  const [architectureFile, handoffFile, progressFile, memoryFile, catalogFile, mcpToolsFile] =
    await Promise.all([
      readRepoFile("docs/ARCHITECTURE.md"),
      readRepoFile("docs/HANDOFF.md"),
      readRepoFile("PROGRESS.md"),
      readRepoFile("MEMORY.md"),
      readRepoFile("docs/COMMAND-CATALOG.md"),
      readRepoFile("docs/MCP-TOOLS.md")
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
    /\| [0-9]+ \| `workstreams` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| Medium \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `workstreams` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| Medium \|/
  );
  assert.match(memoryFile, /`workstreams` shipped on 2026-04-23/);
  assert.match(
    catalogFile,
    /\| `workstreams` \| 5 \| `Workspace And Maintenance` \| `blueprint-maintenance` \| `implemented` \|/
  );
  assert.match(mcpToolsFile, /`blueprint_workstream_list`/);
  assert.match(mcpToolsFile, /`blueprint_workstream_mutate`/);
});
