import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveAvailableOptionalAgents,
  validateBlueprintAgentDefinitionContent
} from "../src/mcp/agent-definition.js";

const VALID_AGENT_CONTENT = `---
name: blueprint-planner
description: >
  Planner description that is long enough to look like a real bundled agent.
kind: local
tools:
  - read_file
  - glob
max_turns: 10
timeout_mins: 10
---
# Blueprint Planner
`;

test("agent definition validator accepts valid bundled metadata", () => {
  const validation = validateBlueprintAgentDefinitionContent(
    "blueprint-planner",
    VALID_AGENT_CONTENT,
    "agents/blueprint-planner.md"
  );

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
  assert.equal(validation.frontmatter.name, "blueprint-planner");
  assert.equal(validation.frontmatter.description, "Planner description that is long enough to look like a real bundled agent.");
  assert.equal(validation.frontmatter.kind, "local");
  assert.deepEqual(validation.frontmatter.tools, ["read_file", "glob"]);
});

test("available optional agents exclude malformed bundled agent fixtures", async () => {
  const fixtures = new Map<string, string>([
    ["agents/blueprint-planner.md", VALID_AGENT_CONTENT],
    [
      "agents/blueprint-checker.md",
      `---
name: blueprint-checker
kind: local
tools:
  - read_file
---
# Blueprint Checker
`
    ],
    [
      "agents/blueprint-verifier.md",
      `---
name: wrong-name
description: >
  Verifier description that still should not pass because the slug is wrong.
kind: local
tools:
  - read_file
---
# Blueprint Verifier
`
    ]
  ]);

  const available = await resolveAvailableOptionalAgents(
    ["blueprint-planner", "blueprint-checker", "blueprint-verifier", "blueprint-mapper"],
    async (relativePath) => fixtures.get(relativePath) ?? null
  );

  assert.deepEqual(available, ["blueprint-planner"]);
});
