import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
  assert.match(commandFile, /Never write into the installed extension directory/i);
  assert.match(commandFile, /restart guidance/i);
});

test("update docs, maintenance skill, and runtime reference align to the shipped advisory update contract", async () => {
  const [commandDoc, skillDoc, runtimeReference] = await Promise.all([
    readRepoFile("docs/commands/update.md"),
    readRepoFile("skills/blueprint-maintenance/SKILL.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(commandDoc, /\| Execution profile \| `interactive-read` \|/);
  assert.match(
    commandDoc,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    commandDoc,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(commandDoc, /`blueprint_update_check`/);
  assert.match(commandDoc, /`blueprint_update_plan`/);
  assert.match(commandDoc, /`ask_user`/);
  assert.match(commandDoc, /update-mode-gate/);
  assert.match(commandDoc, /~\/.<host>\/blueprint\/updates\/update-plan-latest\.json/);
  assert.match(commandDoc, /manual fallback/i);
  assert.match(commandDoc, /restart guidance/i);
  assert.match(commandDoc, /never write into the installed extension directory/i);

  assert.match(skillDoc, /\/blu-update/);
  assert.match(skillDoc, /blueprint_update_check/);
  assert.match(skillDoc, /blueprint_update_plan/);
  assert.match(skillDoc, /Execution profile: `interactive-read`/);
  assert.match(skillDoc, /update-mode-gate/);
  assert.match(skillDoc, /Keep all Blueprint-owned update persistence under `~\/.<host>\/blueprint\/updates\/`/i);
  assert.doesNotMatch(
    skillDoc,
    /`remove-workspace`, `workstreams`, `update`, and `reapply-patches` remain documented maintenance commands, but they are not routable/
  );

  assert.match(
    runtimeReference,
    /\| `update` \| `docs\/commands\/update\.md` \| `blueprint-maintenance` \| `blueprint_update_check`<br>`blueprint_update_plan` \|/
  );
  assert.match(runtimeReference, /`update`[\s\S]*Interactive-read advisory profile/i);
  assert.match(
    runtimeReference,
    /`update`[\s\S]*resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(runtimeReference, /`update`[\s\S]*`ask_user` only for the saved-checklist versus manual-fallback mode gate/i);
  assert.match(runtimeReference, /`update`[\s\S]*~\/.<host>\/blueprint\/updates\//i);
  assert.match(runtimeReference, /`update`[\s\S]*restart guidance/i);
});

test("repo-facing status docs treat update as a shipped Wave 5 command", async () => {
  const [catalogFile, progressFile, mcpToolsFile, architectureFile, handoffFile, memoryFile, skillsFile] =
    await Promise.all([
      readRepoFile("docs/COMMAND-CATALOG.md"),
      readRepoFile("PROGRESS.md"),
      readRepoFile("docs/MCP-TOOLS.md"),
      readRepoFile("docs/ARCHITECTURE.md"),
      readRepoFile("docs/HANDOFF.md"),
      readRepoFile("MEMORY.md"),
      readRepoFile("docs/SKILLS-AND-AGENTS.md")
    ]);

  assert.match(
    catalogFile,
    /\| `update` \| 5 \| `Workspace And Maintenance` \| `blueprint-maintenance` \| `implemented` \| `~\/.<host>\/blueprint\/updates\/update-plan-latest\.json; ~\/.<host>\/blueprint\/updates\/update-plan-latest\.md` \| `Low: advisory only; no in-session self-update\.` \|/
  );
  assert.match(
    progressFile,
    /\| 49 \| `update` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| Low \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `update` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| Low \|/
  );
  assert.match(mcpToolsFile, /### Maintenance/);
  assert.match(mcpToolsFile, /`blueprint_update_check`/);
  assert.match(mcpToolsFile, /`blueprint_update_plan`/);
  assert.match(mcpToolsFile, /`update` uses `blueprint_update_check` and `blueprint_update_plan`/);
  assert.match(architectureFile, /shipped Wave 5 maintenance commands, `new-workspace`, `cleanup`, and `update`/i);
  assert.match(handoffFile, /shipped Wave 5 maintenance commands `new-workspace`, `cleanup`, and `update`/i);
  assert.match(memoryFile, /`update` shipped on 2026-04-22/);
  assert.match(
    skillsFile,
    /`update` remains skill-led on `blueprint-maintenance`, uses no dedicated subagents, keeps extension-path handling read-only, and routes host-global advisory checklist persistence through the dedicated update MCP tools\./
  );
});
