import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  loadBlueprintSkillInputs,
  resolveBlueprintSkillInputsFromContent
} from "../src/mcp/skill-metadata.js";

const repoRoot = process.cwd();

async function readRelativePath(relativePath: string): Promise<string | null> {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}

test("structured input bundles resolve command-specific discovery inputs", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-phase-discovery",
    "/blu-discuss-phase",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-phase-discovery");
  assert.deepEqual(inputs.shared, ["docs/ARTIFACT-SCHEMA.md", "docs/MCP-TOOLS.md"]);
  assert.deepEqual(inputs.commandSpecific, [
    "docs/commands/discuss-phase.md",
    "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
    "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md"
  ]);
  assert.deepEqual(inputs.effective, [
    "docs/ARTIFACT-SCHEMA.md",
    "docs/MCP-TOOLS.md",
    "docs/commands/discuss-phase.md",
    "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
    "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md"
  ]);
});

test("structured multi-command skills return shared-only inputs for unknown commands", async () => {
  const raw = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-discovery/SKILL.md"),
    "utf8"
  );
  const inputs = resolveBlueprintSkillInputsFromContent(
    "blueprint-phase-discovery",
    "/blu-unknown-discovery-command",
    raw
  );

  assert.deepEqual(inputs.shared, ["docs/ARTIFACT-SCHEMA.md", "docs/MCP-TOOLS.md"]);
  assert.deepEqual(inputs.commandSpecific, []);
  assert.deepEqual(inputs.effective, ["docs/ARTIFACT-SCHEMA.md", "docs/MCP-TOOLS.md"]);
});

test("legacy required-input sections remain the fallback for unmigrated skills", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-phase-planning",
    "/blu-plan-phase",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-phase-planning");
  assert.deepEqual(inputs.commandSpecific, []);
  assert.deepEqual(inputs.shared, [
    "docs/commands/plan-phase.md",
    "docs/COMMAND-CATALOG.md",
    "docs/SKILLS-AND-AGENTS.md",
    "docs/ARTIFACT-SCHEMA.md",
    "docs/MCP-TOOLS.md",
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.deepEqual(inputs.effective, inputs.shared);
});
