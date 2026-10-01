import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveAvailableOptionalAgents,
  validateBlueprintAgentDefinitionContent
} from "../src/mcp/agent-definition.js";

const permission = `permission:
  "*": deny
  read:
    "*": allow
    "mcp:*": deny
  glob: allow
  grep: allow`;

function agent(mode = "subagent", extra = "") {
  return `---
description: Native Blueprint specialist fixture
mode: ${mode}
steps: 10
${permission}
${extra}---
# Fixture
`;
}

test("validator accepts strict native YAML with filename identity", () => {
  const validation = validateBlueprintAgentDefinitionContent(
    "blueprint-planner",
    agent(),
    "agents/blueprint-planner.md"
  );
  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.equal(validation.frontmatter.mode, "subagent");
  assert.equal(validation.frontmatter.steps, 10);
  assert.equal("name" in validation.frontmatter, false);
});

test("required primary must be native primary mode and malformed required metadata fails", () => {
  assert.equal(validateBlueprintAgentDefinitionContent("blueprint", agent("primary")).valid, true);
  const wrongMode = validateBlueprintAgentDefinitionContent("blueprint", agent());
  assert.equal(wrongMode.valid, false);
  assert.match(wrongMode.issues.join("\n"), /expected primary/);
  const unknown = validateBlueprintAgentDefinitionContent("blueprint", agent("primary", "name: blueprint\n"));
  assert.equal(unknown.valid, false);
  assert.match(unknown.issues.join("\n"), /Unrecognized key/);
});

test("optional specialist validation rejects legacy fields, wrong mode, malformed YAML, and empty bodies", () => {
  const cases = [
    agent("primary"),
    agent("subagent", "max_turns: 10\n"),
    agent("subagent", "permission:\n  read: allow\npermission:\n  read: deny\n"),
    agent().replace("# Fixture\n", "")
  ];
  for (const content of cases) {
    assert.equal(validateBlueprintAgentDefinitionContent("blueprint-planner", content).valid, false);
  }
});

test("missing or invalid optional specialists fall back while valid definitions remain available", async () => {
  const fixtures = new Map([
    ["agents/blueprint-planner.md", agent()],
    ["agents/blueprint-checker.md", agent("primary")],
    ["agents/blueprint-verifier.md", agent("subagent", "tools: [read]\n")]
  ]);
  const available = await resolveAvailableOptionalAgents(
    ["blueprint-planner", "blueprint-checker", "blueprint-verifier", "blueprint-mapper"],
    async (relativePath) => fixtures.get(relativePath) ?? null
  );
  assert.deepEqual(available, ["blueprint-planner"]);
});

test("strict parser accepts CRLF native frontmatter", () => {
  const content = agent().replaceAll("\n", "\r\n");
  const validation = validateBlueprintAgentDefinitionContent("blueprint-planner", content);
  assert.equal(validation.valid, true, validation.issues.join("\n"));
});
