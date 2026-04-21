import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
});

test("/blu root router manifest keeps implemented-only routing and waiting-state reporting explicit", async () => {
  const rootRouter = await readFile(path.join(repoRoot, "commands/blu.toml"), "utf8");

  assert.match(rootRouter, /Only recommend or route commands whose `mcp_blueprint_blueprint_command_catalog` entry is `implemented: true`/);
  assert.match(rootRouter, /surface the waiting state explicitly: missing artifact, approval gate, verification debt, or blocked substrate/i);
});

test("router pilot manifests and docs keep waiting-state reporting explicit", async () => {
  const [helpToml, progressToml, nextToml, helpDoc, progressDoc, nextDoc] =
    await Promise.all([
      readFile(path.join(repoRoot, "commands/blu-help.toml"), "utf8"),
      readFile(path.join(repoRoot, "commands/blu-progress.toml"), "utf8"),
      readFile(path.join(repoRoot, "commands/blu-next.toml"), "utf8"),
      readFile(path.join(repoRoot, "docs/commands/help.md"), "utf8"),
      readFile(path.join(repoRoot, "docs/commands/progress.md"), "utf8"),
      readFile(path.join(repoRoot, "docs/commands/next.md"), "utf8")
    ]);

  assert.match(helpToml, /Return concise routing guidance for the commands that are safe and relevant in the current repo state, including what Blueprint is waiting on and the next safe action\./);
  assert.match(helpToml, /partial repo repair, missing artifact, verification debt, or blocked substrate/i);
  assert.match(progressToml, /Summarize Blueprint repo status, blockers, warnings, and the next safe action from real state\./);
  assert.match(progressToml, /missing artifact, partial repo repair, verification debt, or blocked substrate/i);
  assert.match(nextToml, /Return the next safe direct command for the current repo state, plus a concise explanation of why that step is next\./);
  assert.match(nextToml, /waiting state is present, keep the pending gate explicit and prefer the safest implemented follow-up command/i);

  assert.match(helpDoc, /waiting state/i);
  assert.match(helpDoc, /pending gate/i);
  assert.match(helpDoc, /next safe action/i);
  assert.match(progressDoc, /waiting on a prerequisite/i);
  assert.match(progressDoc, /pending gate/i);
  assert.match(progressDoc, /next safe action/i);
  assert.match(nextDoc, /waiting state/i);
  assert.match(nextDoc, /pending gate/i);
  assert.match(nextDoc, /next safe follow-up command/i);
});

test("router pilot runtime reference rows keep the waiting-state contract aligned", async () => {
  const runtimeReference = await readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8");

  assert.match(
    runtimeReference,
    /\| `\/blu` \| `docs\/commands\/root-router\.md` \| `blueprint-router` \| `blueprint_command_catalog`<br>`blueprint_project_status`<br>`blueprint_config_get` \|/
  );
  assert.match(
    runtimeReference,
    /Host-native root router; when routing is blocked or incomplete, explain the missing prerequisite or blocked-command reason and keep recommendations inside the implemented command surface only\./
  );
  assert.match(
    runtimeReference,
    /\| `help` \| `docs\/commands\/help\.md` \| `blueprint-router` \| `blueprint_command_catalog`<br>`blueprint_project_status` \|/
  );
  assert.match(
    runtimeReference,
    /Router profile; report the waiting state from project status, keep the next safe action explicit, and never present planned or blocked commands as runnable\./
  );
  assert.match(
    runtimeReference,
    /\| `progress` \| `docs\/commands\/progress\.md` \| `blueprint-router` \| `blueprint_project_status`<br>`blueprint_config_get`<br>`blueprint_state_load`<br>`blueprint_artifact_list`<br>`blueprint_command_catalog` \|/
  );
  assert.match(
    runtimeReference,
    /Router profile; preserve read-only next-step guidance while surfacing active profile, branching mode, blockers, pending gates, and config warnings from normalized config, and keep recommendations inside the implemented runtime surface\./
  );
  assert.match(
    runtimeReference,
    /\| `next` \| `docs\/commands\/next\.md` \| `blueprint-router` \| `blueprint_project_status`<br>`blueprint_state_load`<br>`blueprint_artifact_list`<br>`blueprint_command_catalog` \|/
  );
  assert.match(
    runtimeReference,
    /Host-native router flow; report waiting state and the next safe follow-up explicitly, and never hide destructive behavior behind implicit routing\./
  );
});
