import test from "node:test";
import assert from "node:assert/strict";

import {
  blueprintAgentDefinitionPath,
  blueprintDiscoverableSkillPath,
  blueprintLegacySkillPath,
  blueprintRuntimeToolFqn,
  resolveBlueprintSkillPath
} from "../src/mcp/runtime-vocabulary.js";

test("runtime vocabulary exposes canonical discoverable skill and agent paths", () => {
  assert.equal(
    blueprintDiscoverableSkillPath("blueprint-router"),
    "skills/blueprint-router/SKILL.md"
  );
  assert.equal(blueprintLegacySkillPath("blueprint-router"), "skills/blueprint-router.md");
  assert.equal(
    blueprintAgentDefinitionPath("blueprint-planner"),
    "agents/blueprint-planner.md"
  );
});

test("runtime vocabulary maps internal Blueprint tools to MCP runtime FQNs", () => {
  assert.equal(
    blueprintRuntimeToolFqn("blueprint_command_catalog"),
    "mcp_blueprint_blueprint_command_catalog"
  );
  assert.equal(
    blueprintRuntimeToolFqn("blueprint_phase_plan_write"),
    "mcp_blueprint_blueprint_phase_plan_write"
  );
});

test("runtime vocabulary prefers discoverable skill bundles when both layouts exist", async () => {
  const resolution = await resolveBlueprintSkillPath("blueprint-router", async (candidate) =>
    candidate === "skills/blueprint-router/SKILL.md" ||
    candidate === "skills/blueprint-router.md"
  );

  assert.equal(resolution.resolvedPath, "skills/blueprint-router/SKILL.md");
  assert.equal(resolution.resolution, "discoverable");
});

test("runtime vocabulary falls back to the legacy flat skill file during migration", async () => {
  const resolution = await resolveBlueprintSkillPath("blueprint-router", async (candidate) =>
    candidate === "skills/blueprint-router.md"
  );

  assert.equal(resolution.resolvedPath, "skills/blueprint-router.md");
  assert.equal(resolution.resolution, "legacy");
});

test("runtime vocabulary reports missing skills against the canonical discoverable path", async () => {
  const resolution = await resolveBlueprintSkillPath("blueprint-router", async () => false);

  assert.equal(resolution.resolvedPath, null);
  assert.equal(resolution.canonicalPath, "skills/blueprint-router/SKILL.md");
  assert.equal(resolution.resolution, "missing");
});
