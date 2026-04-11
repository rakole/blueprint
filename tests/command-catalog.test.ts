import test from "node:test";
import assert from "node:assert/strict";

import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const IMPLEMENTED_COMMANDS = [
  "new-project",
  "settings",
  "set-profile",
  "help",
  "progress",
  "health",
  "map-codebase",
  "discuss-phase",
  "research-phase",
  "ui-phase",
  "next",
  "plan-phase",
  "execute-phase",
  "validate-phase",
  "pause-work"
] as const;

const BLOCKED_COMMANDS = ["do", "insert-phase"] as const;

test("runtime command catalog only marks shipped Wave 0 commands as implemented", async () => {
  const catalog = await blueprintCommandCatalog();
  const implemented = Object.entries(catalog.commands)
    .filter(([, entry]) => entry.implemented)
    .map(([command]) => command)
    .sort();

  assert.deepEqual(implemented, [...IMPLEMENTED_COMMANDS].sort());

  for (const command of IMPLEMENTED_COMMANDS) {
    const entry = catalog.commands[command];

    assert.equal(entry.status, "implemented");
    assert.equal(entry.declaredStatus, "implemented");
    assert.equal(entry.requiredToolsSatisfied, true);
    assert.ok(entry.manifestPath);
    assert.ok(entry.skillPath);
    assert.ok(entry.specPath);
    assert.deepEqual(entry.blockedBy, []);
  }
});

test("implemented commands expose their declared optional agent contracts when shipped", async () => {
  const catalog = await blueprintCommandCatalog();

  assert.deepEqual(catalog.commands["new-project"].availableOptionalAgents.sort(), [
    "blueprint-project-researcher",
    "blueprint-roadmapper"
  ]);
  assert.deepEqual(catalog.commands["map-codebase"].availableOptionalAgents, [
    "blueprint-mapper"
  ]);
  assert.deepEqual(catalog.commands["discuss-phase"].availableOptionalAgents, [
    "blueprint-researcher"
  ]);
  assert.deepEqual(catalog.commands["research-phase"].availableOptionalAgents, [
    "blueprint-researcher"
  ]);
  assert.deepEqual(catalog.commands["ui-phase"].availableOptionalAgents, [
    "blueprint-ui-designer"
  ]);
  assert.deepEqual(catalog.commands["validate-phase"].availableOptionalAgents, [
    "blueprint-verifier"
  ]);
});

test("blocked lifecycle and roadmap commands stay unroutable until substrate exists", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const command of BLOCKED_COMMANDS) {
    const entry = catalog.commands[command];

    assert.equal(entry.implemented, false);
    assert.notEqual(entry.status, "implemented");
    assert.ok(entry.blockedBy.length > 0);
  }
});

test("plan-phase is implemented once manifest, skill, and plan MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["plan-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-checker",
    "blueprint-planner"
  ]);
  assert.deepEqual(entry.blockedBy, []);
});

test("execute-phase is implemented once manifest, skill, and execution summary MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["execute-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.availableOptionalAgents.sort(), ["blueprint-executor"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("validate-phase is implemented once manifest, skill, and validation MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["validate-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.availableOptionalAgents.sort(), ["blueprint-verifier"]);
  assert.deepEqual(entry.blockedBy, []);
});
