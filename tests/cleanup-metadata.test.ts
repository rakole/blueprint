import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource
} from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

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
  assert.match(commandFile, /mcp_blueprint_blueprint_cleanup_archive/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /cleanup-latest/);
  assert.match(commandFile, /`dirty-working-tree`, `missing-phase-root`, or `inconsistent-phase-layout`/);
  assert.match(commandFile, /cleanup-confirmation/);
  assert.match(commandFile, /archive-destination-confirmation/);
  assert.match(commandFile, /report-overwrite-confirmation/);
  assert.match(commandFile, /Gemini-native `ask_user`/);
  assert.match(commandFile, /If `ask_user` is unavailable for any confirmation, stop honestly with the named pending gate still visible/i);
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
  assert.match(skillFile, /blueprint_cleanup_archive/);
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
  assert.match(skillFile, /keep `report-overwrite-confirmation` visible until overwrite is explicitly approved/i);
  assert.match(skillFile, /protected scope explicit/i);
  assert.match(skillFile, /never the current phase/i);
  assert.match(skillFile, /actual archive outcome/i);
});

test("cleanup local runtime contract and runtime resource expose the protected-scope visibility and waiting-state contract", async () => {
  const [runtimeReference, runtimeContract] = await Promise.all([
    readFile(
      path.join(repoRoot, "skills/blueprint-maintenance/references/cleanup-runtime-contract.md"),
      "utf8"
    ),
    buildBlueprintCommandRuntimeContractResource("cleanup")
  ]);

  assert.match(
    runtimeReference,
    /Stage Mapping[\s\S]*Resolve[\s\S]*Read[\s\S]*Decide[\s\S]*Execute[\s\S]*Persist[\s\S]*Validate[\s\S]*Route/
  );
  assert.match(runtimeReference, /Dirty tree, missing phase root, or inconsistent phase layout is a hard stop/);
  assert.match(runtimeReference, /cleanup-confirmation/);
  assert.match(runtimeReference, /archive-destination-confirmation/);
  assert.match(runtimeReference, /report-overwrite-confirmation/);
  assert.match(runtimeReference, /blueprint_cleanup_archive/);
  assert.match(runtimeReference, /Require destructive confirmation and surface `cleanup-confirmation`/i);
  assert.match(runtimeReference, /current phase, active roadmap references, evidence-incomplete directories, and final kept directories/i);
  assert.match(runtimeReference, /manual cleanup follow-up/i);

  assert.equal(runtimeContract.runtimeReference?.path, runtimeContract.catalog.specPath);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /cleanup-runtime-contract\.md/);
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /preview and commit cleanup only through blueprint_cleanup_archive/i
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

test("repo-facing status docs treat cleanup as a shipped command", async () => {
  const [
    agentsFile,
    readmeFile,
    geminiFile,
    progressFile,
    memoryFile,
    catalog
  ] = await Promise.all([
    readFile(path.join(repoRoot, "AGENTS.md"), "utf8"),
    readFile(path.join(repoRoot, "README.md"), "utf8"),
    readFile(path.join(repoRoot, "GEMINI.md"), "utf8"),
    readFile(path.join(repoRoot, "PROGRESS.md"), "utf8"),
    readFile(path.join(repoRoot, "MEMORY.md"), "utf8"),
    blueprintCommandCatalog()
  ]);
  const metadata = getRuntimeOwnedCommandMetadata("cleanup");
  const entry = catalog.commands.cleanup;

  assert.ok(metadata);
  assert.equal(metadata.catalog.wave, 5);
  assert.equal(metadata.catalog.family, "Workspace And Maintenance");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.equal(metadata.spec.executionProfile, "high-risk-maintenance");
  assert.equal(metadata.runtimeReference.waveTitle, "Workspace And Maintenance");
  assert.match(metadata.runtimeReference.contractNotes, /Docless manifest\+skill-owned runtime/i);
  assert.match(metadata.runtimeReference.contractNotes, /cleanup-runtime-contract\.md/);
  assert.match(
    metadata.runtimeReference.contractNotes,
    /preview and commit cleanup only through blueprint_cleanup_archive/i
  );
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, metadata.sourceId);
  assert.match(agentsFile, /`cleanup`/i);
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
