import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

test("reapply-patches docs, runtime reference, and maintenance skill align to the shipped patch-replay contract", async () => {
  const [commandDoc, runtimeReference, skillDoc, mcpToolsDoc, artifactSchemaDoc] =
    await Promise.all([
      readRepoFile("docs/commands/reapply-patches.md"),
      readRepoFile("docs/RUNTIME-REFERENCE.md"),
      readRepoFile("skills/blueprint-maintenance/SKILL.md"),
      readRepoFile("docs/MCP-TOOLS.md"),
      readRepoFile("docs/ARTIFACT-SCHEMA.md")
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
  assert.match(commandDoc, /~\/.<host>\/blueprint\/patches\//);
  assert.match(commandDoc, /reapply-patches-confirmation/);
  assert.match(commandDoc, /dirty-working-tree/);
  assert.match(commandDoc, /compatibility-mismatch/);
  assert.match(commandDoc, /installed-extension-target/);
  assert.match(commandDoc, /preflight -> preview -> confirm -> replay -> record/);

  assert.match(skillDoc, /\/blu-reapply-patches/);
  assert.match(skillDoc, /blueprint_patch_list/);
  assert.match(skillDoc, /blueprint_patch_reapply/);
  assert.match(skillDoc, /blueprint_patch_record/);
  assert.match(skillDoc, /reapply-patches-confirmation/);

  assert.match(
    runtimeReference,
    /\| `reapply-patches` \| `docs\/commands\/reapply-patches\.md` \| `blueprint-maintenance` \|/
  );
  assert.match(runtimeReference, /High-risk-maintenance profile for confirmation-gated patch replay/i);
  assert.match(runtimeReference, /malformed-patch-registry/);
  assert.match(runtimeReference, /installed-extension-target/);
  assert.match(runtimeReference, /preflight -> preview -> confirm -> replay -> record/);

  assert.match(mcpToolsDoc, /`blueprint_patch_list`/);
  assert.match(mcpToolsDoc, /`blueprint_patch_reapply`/);
  assert.match(mcpToolsDoc, /`blueprint_patch_record`/);
  assert.match(
    mcpToolsDoc,
    /`reapply-patches` uses `blueprint_patch_list`, `blueprint_patch_reapply`, and `blueprint_patch_record`/
  );

  assert.match(artifactSchemaDoc, /### `patches\/index\.json`/);
  assert.match(artifactSchemaDoc, /### `patches\/<patch-id>\.json`/);
  assert.match(artifactSchemaDoc, /### `patches\/<patch-id>\.audit\.ndjson`/);
});

test("repo-facing status docs treat reapply-patches as a shipped command", async () => {
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

  assert.match(architectureFile, /shipped Wave 5 maintenance commands, `new-workspace`, `workstreams`, `cleanup`, and `reapply-patches`/i);
  assert.match(handoffFile, /shipped Wave 5 maintenance commands `new-workspace`, `workstreams`, `cleanup`, and `reapply-patches`/i);
  assert.match(
    progressFile,
    /\| [0-9]+ \| `reapply-patches` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `reapply-patches` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.match(memoryFile, /`reapply-patches` shipped on 2026-04-22/);
  assert.match(catalogFile, /\| `reapply-patches` \| 5 \| `Workspace And Maintenance` \| `blueprint-maintenance` \| `implemented` \|/);
  assert.match(readmeFile, /`\/blu-reapply-patches`/);
  assert.match(geminiFile, /`\/blu-reapply-patches`/);
});
