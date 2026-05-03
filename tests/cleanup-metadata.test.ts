import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("cleanup manifest references the maintenance skill, high-risk maintenance profile, and explicit protected-scope confirmation guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-cleanup.toml"),
    "utf8"
  );

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
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /cleanup-latest/);
  assert.match(commandFile, /`dirty-working-tree`, `missing-phase-root`, or `inconsistent-phase-layout`/);
  assert.match(commandFile, /cleanup-confirmation/);
  assert.match(commandFile, /archive-destination-confirmation/);
  assert.match(commandFile, /report-overwrite-confirmation/);
  assert.match(commandFile, /Gemini-native `ask_user`/);
  assert.match(commandFile, /If `ask_user` is unavailable for either confirmation, stop honestly with the named pending gate still visible/i);
  assert.match(commandFile, /If `ask_user` is unavailable, stop honestly with `report-overwrite-confirmation` still visible/i);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /active roadmap/i);
  assert.match(commandFile, /protected exclusions explicit/i);
  assert.match(commandFile, /Do not invent a new persistent archive schema/i);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("maintenance skill captures cleanup visibility, report persistence, and protected-scope safety", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-cleanup/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_roadmap_read/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(
    skillFile,
    /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, next safe action/i
  );
  assert.match(skillFile, /cleanup-latest/);
  assert.match(skillFile, /`dirty-working-tree`, `missing-phase-root`, or `inconsistent-phase-layout`/);
  assert.match(skillFile, /cleanup-confirmation/);
  assert.match(skillFile, /archive-destination-confirmation/);
  assert.match(skillFile, /report-overwrite-confirmation/);
  assert.match(skillFile, /Gemini-native `ask_user`/);
  assert.match(skillFile, /if `ask_user` is unavailable stop honestly with the named pending gate still visible/i);
  assert.match(skillFile, /stop honestly with that named pending gate still visible when `ask_user` is unavailable/i);
  assert.match(skillFile, /protected scope explicit/i);
  assert.match(skillFile, /never the current phase/i);
  assert.match(skillFile, /before filesystem mutation begins/i);
});

test("cleanup docs and runtime reference expose the protected-scope visibility and waiting-state contract", async () => {
  const [commandDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/cleanup.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
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
  assert.match(commandDoc, /`dirty-working-tree`, `missing-phase-root`, or `inconsistent-phase-layout`/);
  assert.match(commandDoc, /cleanup-confirmation/);
  assert.match(commandDoc, /archive-destination-confirmation/);
  assert.match(commandDoc, /report-overwrite-confirmation/);
  assert.match(commandDoc, /Gemini CLI's built-in `ask_user` interaction tool/i);
  assert.match(commandDoc, /`ask_user` is a Gemini CLI interaction surface, not Blueprint MCP persistence/i);
  assert.match(commandDoc, /if `ask_user` is unavailable, stop honestly with `cleanup-confirmation` still visible/i);
  assert.match(commandDoc, /stop honestly with that named pending gate still visible when `ask_user` is unavailable/i);
  assert.match(commandDoc, /protected exclusions/i);
  assert.match(commandDoc, /next safe action/i);

  assert.match(runtimeReference, /\| `cleanup` \| `docs\/commands\/cleanup\.md` \| `blueprint-maintenance` \|/);
  assert.match(runtimeReference, /High-risk-maintenance profile for protected-scope phase-directory archival/i);
  assert.match(
    runtimeReference,
    /resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(runtimeReference, /current phase, active roadmap references, evidence-incomplete directories, and final protected exclusions explicit/i);
  assert.match(runtimeReference, /`dirty-working-tree`, `missing-phase-root`, or `inconsistent-phase-layout`/);
  assert.match(runtimeReference, /cleanup-confirmation/);
  assert.match(runtimeReference, /archive-destination-confirmation/);
  assert.match(runtimeReference, /report-overwrite-confirmation/);
});

test("repo-facing status docs treat cleanup as a shipped command", async () => {
  const [
    agentsFile,
    handoffFile,
    architectureFile,
    readmeFile,
    geminiFile,
    progressFile,
    memoryFile
  ] = await Promise.all([
    readFile(path.join(repoRoot, "AGENTS.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/HANDOFF.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/ARCHITECTURE.md"), "utf8"),
    readFile(path.join(repoRoot, "README.md"), "utf8"),
    readFile(path.join(repoRoot, "GEMINI.md"), "utf8"),
    readFile(path.join(repoRoot, "PROGRESS.md"), "utf8"),
    readFile(path.join(repoRoot, "MEMORY.md"), "utf8")
  ]);

  assert.match(agentsFile, /`cleanup`/i);
  assert.match(handoffFile, /shipped Wave 5 cleanup command `cleanup`/i);
  assert.match(architectureFile, /shipped Wave 5 maintenance command, `cleanup`/i);
  assert.match(readmeFile, /`\/blu-cleanup`/);
  assert.match(geminiFile, /`\/blu-cleanup`/);
  assert.match(
    progressFile,
    /\| [0-9]+ \| `cleanup` \| ✅ \| `implemented` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `cleanup` \| ❌ \| `planned` \| 5 \| `Workspace And Maintenance` \| High \|/
  );
  assert.match(memoryFile, /`cleanup` shipped on 2026-04-13/);
});
