import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintRuntimeToolFqn,
  resolveBlueprintSkillPath
} from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await access(relativePath);
    return true;
  } catch {
    return false;
  }
}

test("list-phase-assumptions manifest references only registered read-oriented discovery tools", async () => {
  const raw = await readFile(
    path.join(repoRoot, "commands/blu-list-phase-assumptions.toml"),
    "utf8"
  );
  const expectedTools = [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_roadmap_read",
    "blueprint_project_status"
  ] as const;

  for (const toolName of expectedTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(raw, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.doesNotMatch(
    raw,
    /blueprint_phase_artifact_write|blueprint_artifact_scaffold|blueprint_state_update|blueprint_config_set/
  );
});

test("list-phase-assumptions manifest preserves the read-only assumptions review contract", async () => {
  const raw = await readFile(
    path.join(repoRoot, "commands/blu-list-phase-assumptions.toml"),
    "utf8"
  );

  assert.match(raw, /Use the `blueprint-phase-discovery` skill/);
  assert.match(raw, /`blueprint-researcher` subagent/);
  assert.match(raw, /five areas/);
  assert.match(raw, /What do you think\?/);
  assert.match(raw, /Do not mutate files, config, roadmap entries, or phase artifacts/);
  assert.match(raw, /Do not guess a nearest replacement phase/);
  assert.match(raw, /do not present planned or blocked commands as runnable/i);
  assert.doesNotMatch(raw, /skills\/blueprint-phase-discovery\.md|agents\/blueprint-researcher\.md/);
});

test("list-phase-assumptions is exposed as an implemented read-only discovery command", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["list-phase-assumptions"];
  const skillResolution = await resolveBlueprintSkillPath(
    "blueprint-phase-discovery",
    pathExists
  );

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-list-phase-assumptions.toml");
  assert.equal(skillResolution.resolution, "discoverable");
  assert.equal(entry.skillPath, skillResolution.canonicalPath);
  assert.equal(entry.specPath, "docs/commands/list-phase-assumptions.md");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_roadmap_read",
    "blueprint_project_status"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-researcher"]);
  assert.deepEqual(entry.blockedBy, []);
});
