import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("undo manifest references the maintenance skill, high-risk maintenance profile, and explicit revert confirmation guards", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-undo.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-maintenance` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-maintenance\.md/);
  assert.match(commandFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(
    commandFile,
    /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_phase_locate/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /undo-latest/);
  assert.match(commandFile, /`dirty-working-tree`, `detached-head`, `merge-in-progress`, or `missing-revert-target`/);
  assert.match(commandFile, /undo-confirmation/);
  assert.match(commandFile, /report-overwrite-confirmation/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /git revert/i);
  assert.match(commandFile, /git reset --hard/i);
  assert.match(commandFile, /Do not present planned-only commands as runnable/i);
});

test("maintenance skill captures undo visibility, report persistence, and destructive-git guardrails", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-undo/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_phase_locate/);
  assert.match(skillFile, /blueprint_artifact_list/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_state_update/);
  assert.match(skillFile, /Execution profile: `high-risk-maintenance`/);
  assert.match(
    skillFile,
    /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /undo-latest/);
  assert.match(skillFile, /`dirty-working-tree`, `detached-head`, `merge-in-progress`, or `missing-revert-target`/);
  assert.match(skillFile, /undo-confirmation/);
  assert.match(skillFile, /report-overwrite-confirmation/);
  assert.match(skillFile, /git reset --hard/i);
  assert.match(skillFile, /report-before-mutate/i);
});

test("undo docs and runtime reference expose the destructive gate, waiting state, and next safe action contract", async () => {
  const [commandDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/undo.md"), "utf8"),
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
  assert.match(commandDoc, /`dirty-working-tree`, `detached-head`, `merge-in-progress`, or `missing-revert-target`/);
  assert.match(commandDoc, /undo-confirmation/);
  assert.match(commandDoc, /report-overwrite-confirmation/);
  assert.match(commandDoc, /next safe action/i);

  assert.match(runtimeReference, /\| `undo` \| `docs\/commands\/undo\.md` \| `blueprint-maintenance` \|/);
  assert.match(runtimeReference, /High-risk-maintenance profile for confirmation-gated revert flow/);
  assert.match(
    runtimeReference,
    /`Resolve`\/`Read`\/`Decide`\/`Execute`\/`Persist`\/`Validate`\/`Route` narration/
  );
  assert.match(
    runtimeReference,
    /resolved scope, active stage, pending gate, execution mode, and next safe action visible/
  );
  assert.match(
    runtimeReference,
    /`dirty-working-tree`, `detached-head`, `merge-in-progress`, or `missing-revert-target`/
  );
  assert.match(runtimeReference, /undo-confirmation/);
  assert.match(runtimeReference, /report-overwrite-confirmation/);
});

test("repo-facing status docs treat undo as a shipped command", async () => {
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

  assert.match(agentsFile, /`undo`/i);
  assert.match(handoffFile, /shipped Wave 4 maintenance commands `pr-branch`, `ship`, and `undo`/i);
  assert.match(architectureFile, /shipped Wave 4 maintenance commands, `pr-branch`, `ship`, and `undo`/i);
  assert.match(readmeFile, /`\/blu-undo`/);
  assert.match(geminiFile, /`\/blu-undo`/);
  assert.match(
    progressFile,
    /\| [0-9]+ \| `undo` \| ✅ \| `implemented` \| 4 \| `Quality And Shipping` \| High \|/
  );
  assert.doesNotMatch(
    progressFile,
    /\| [0-9]+ \| `undo` \| ❌ \| `planned` \| 4 \| `Quality And Shipping` \| High \|/
  );
  assert.match(memoryFile, /`undo` shipped on 2026-04-16/);
});
