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
  "add-phase",
  "plan-phase",
  "execute-phase",
  "validate-phase",
  "verify-work",
  "pause-work",
  "resume-work",
  "audit-milestone"
] as const;

const BLOCKED_COMMANDS = ["do", "insert-phase"] as const;

test("runtime command catalog marks shipped commands as implemented once manifest, skill, and tools exist", async () => {
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

test("add-phase is implemented once manifest, skill, and roadmap MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["add-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_scaffold",
    "blueprint_roadmap_add_phase",
    "blueprint_roadmap_read",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
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
  assert.deepEqual(catalog.commands["verify-work"].availableOptionalAgents, [
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

test("validation slice commands are implemented once manifests, shared skill, and MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const command of ["validate-phase", "verify-work"] as const) {
    const entry = catalog.commands[command];

    assert.equal(entry.declaredStatus, "implemented");
    assert.equal(entry.status, "implemented");
    assert.equal(entry.implemented, true);
    assert.equal(entry.requiredToolsSatisfied, true);
    assert.ok(entry.manifestPath);
    assert.ok(entry.skillPath);
    assert.ok(entry.specPath);
    assert.deepEqual(entry.availableOptionalAgents, ["blueprint-verifier"]);
    assert.deepEqual(entry.blockedBy, []);
  }
});

test("resume-work is implemented once the governance manifest and handoff MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["resume-work"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu/resume-work.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("audit-milestone is implemented once manifest, skill, and milestone audit MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["audit-milestone"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-verifier"]);
  assert.deepEqual(entry.blockedBy, []);
});
