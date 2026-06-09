import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  getRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("router pilot surfaces remain implemented-only in the live command catalog", async () => {
  const catalog = await blueprintCommandCatalog();
  const expected = {
    help: ["blueprint_command_catalog", "blueprint_project_status"],
    progress: [
      "blueprint_project_status",
      "blueprint_config_get",
      "blueprint_state_load",
      "blueprint_artifact_list",
      "blueprint_command_catalog"
    ],
    next: [
      "blueprint_project_status",
      "blueprint_config_get",
      "blueprint_state_load",
      "blueprint_artifact_list",
      "blueprint_command_catalog"
    ]
  } as const;

  for (const [command, requiredTools] of Object.entries(expected)) {
    const entry = catalog.commands[command];

    assert.ok(entry, `Missing catalog entry for ${command}`);
    assert.equal(entry.implemented, true, `${command} should stay implemented`);
    assert.equal(entry.status, "implemented", `${command} should stay implemented`);
    assert.equal(entry.declaredStatus, "implemented", `${command} should stay implemented`);
    assert.deepEqual(entry.blockedBy, [], `${command} should have no blockers`);
    assert.deepEqual(
      entry.requiredTools,
      requiredTools,
      `${command} should keep its read-oriented router tool set`
    );
  }

  assert.equal(catalog.commands.workstreams.implemented, true);
  assert.equal(catalog.commands.workstreams.status, "implemented");
});

test("/blu root router manifest keeps implemented-only routing and waiting-state reporting explicit", async () => {
  const rootRouter = await readFile(path.join(repoRoot, "commands/blu.toml"), "utf8");

  assert.match(rootRouter, /Only recommend or route commands whose `mcp_blueprint_blueprint_command_catalog` entry is `implemented: true`/);
  assert.match(rootRouter, /surface the waiting state explicitly: missing artifact, approval gate, verification debt, or blocked substrate/i);
});

test("router pilot manifests and docs keep waiting-state reporting explicit", async () => {
  const [helpToml, progressToml, nextToml, routerSkill] =
    await Promise.all([
      readFile(path.join(repoRoot, "commands/blu-help.toml"), "utf8"),
      readFile(path.join(repoRoot, "commands/blu-progress.toml"), "utf8"),
      readFile(path.join(repoRoot, "commands/blu-next.toml"), "utf8"),
      readFile(path.join(repoRoot, "skills/blueprint-router/SKILL.md"), "utf8")
    ]);

  assert.match(helpToml, /Return concise routing guidance for the commands that are safe and relevant in the current repo state, including what Blueprint is waiting on and the next safe action\./);
  assert.match(helpToml, /partial repo repair, missing artifact, verification debt, or blocked substrate/i);
  assert.match(progressToml, /Summarize Blueprint repo status, blockers, warnings, and the next safe action from real state\./);
  assert.match(progressToml, /missing artifact, partial repo repair, verification debt, or blocked substrate/i);
  assert.match(nextToml, /Return the next safe direct command for the current repo state, plus a concise explanation of why that step is next\./);
  assert.match(nextToml, /waiting state is present, keep the pending gate explicit and prefer the safest implemented follow-up command/i);

  assert.match(routerSkill, /input_bundles:/);
  assert.match(routerSkill, /commands\/blu-help\.toml/);
  assert.match(routerSkill, /commands\/blu-progress\.toml/);
  assert.match(routerSkill, /commands\/blu-next\.toml/);
  assert.match(routerSkill, /\/blu-next[\s\S]*mcp_blueprint_blueprint_config_get/);
  assert.match(
    routerSkill,
    /workflow\.code_review=false[\s\S]*never makes `?\/blu-secure-phase <phase>`? mandatory/i
  );
  assert.match(
    routerSkill,
    /workflow\.code_review=true[\s\S]*workflow\.secure_phase=false[\s\S]*mandatory code review but not secure-phase/i
  );
  assert.match(
    routerSkill,
    /workflow\.code_review=true[\s\S]*workflow\.secure_phase=true[\s\S]*\/blu-code-review <phase>[\s\S]*before[\s\S]*\/blu-secure-phase <phase>/i
  );
  assert.match(routerSkill, /waiting state/i);
  assert.match(routerSkill, /pending gate|missing artifact, approval gate/i);
  assert.match(routerSkill, /next safe action/i);
  assert.doesNotMatch(routerSkill, /## Required Inputs/);
});

test("router pilot runtime-owned metadata keeps the waiting-state contract aligned", async () => {
  const [helpMetadata, progressMetadata, nextMetadata] = [
    getRuntimeOwnedCommandMetadata("help"),
    getRuntimeOwnedCommandMetadata("progress"),
    getRuntimeOwnedCommandMetadata("next")
  ];
  const [helpContract, progressContract, nextContract] = await Promise.all([
    buildBlueprintCommandRuntimeContractResource("help"),
    buildBlueprintCommandRuntimeContractResource("progress"),
    buildBlueprintCommandRuntimeContractResource("next")
  ]);

  assert.ok(helpMetadata);
  assert.equal(helpMetadata.sourceId, "src/mcp/command-runtime-metadata.ts#help");
  assert.equal(helpMetadata.catalog.primarySkill, "blueprint-router");
  assert.deepEqual(helpMetadata.requiredTools, [
    "blueprint_command_catalog",
    "blueprint_project_status"
  ]);
  assert.match(
    helpMetadata.runtimeReference.contractNotes,
    /report the waiting state from project status/i
  );
  assert.match(helpMetadata.runtimeReference.contractNotes, /never present planned or blocked commands as runnable/i);
  assert.deepEqual(helpMetadata.requiredInputPaths, [
    "commands/blu-help.toml"
  ]);
  assert.deepEqual(helpContract.skillInputs.effective, ["commands/blu-help.toml"]);
  assert.equal(helpContract.skillInputs.effective.some((input) => input.startsWith("docs/")), false);

  assert.ok(progressMetadata);
  assert.equal(progressMetadata.sourceId, "src/mcp/command-runtime-metadata.ts#progress");
  assert.equal(progressMetadata.catalog.primarySkill, "blueprint-router");
  assert.deepEqual(progressMetadata.requiredTools, [
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_state_load",
    "blueprint_artifact_list",
    "blueprint_command_catalog"
  ]);
  assert.match(
    progressMetadata.runtimeReference.contractNotes,
    /preserve read-only next-step guidance/i
  );
  assert.match(progressMetadata.runtimeReference.contractNotes, /pending gates/i);
  assert.deepEqual(progressMetadata.requiredInputPaths, [
    "commands/blu-progress.toml"
  ]);
  assert.deepEqual(progressContract.skillInputs.effective, ["commands/blu-progress.toml"]);
  assert.equal(
    progressContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );

  assert.ok(nextMetadata);
  assert.equal(nextMetadata.sourceId, "src/mcp/command-runtime-metadata.ts#next");
  assert.equal(nextMetadata.catalog.primarySkill, "blueprint-router");
  assert.deepEqual(nextMetadata.requiredTools, [
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_state_load",
    "blueprint_artifact_list",
    "blueprint_command_catalog"
  ]);
  assert.match(
    nextMetadata.runtimeReference.contractNotes,
    /report waiting state and the next safe follow-up explicitly/i
  );
  assert.match(nextMetadata.runtimeReference.contractNotes, /never hide destructive behavior behind implicit routing/i);
  assert.deepEqual(nextMetadata.requiredInputPaths, [
    "commands/blu-next.toml"
  ]);
  assert.deepEqual(nextContract.skillInputs.effective, ["commands/blu-next.toml"]);
  assert.equal(nextContract.skillInputs.effective.some((input) => input.startsWith("docs/")), false);
});
