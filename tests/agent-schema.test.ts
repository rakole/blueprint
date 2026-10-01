import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { validateBlueprintAgentDefinitionContent } from "../src/mcp/agent-definition.js";
import { BLUEPRINT_AGENT_TOOL_NAMES, BLUEPRINT_PRIMARY_AGENT_NAME } from "../src/mcp/agent-metadata.js";
import { parseNativeMarkdown } from "../src/shared/native-frontmatter.js";

const repoRoot = process.cwd();
const expectedSteps = {
  "blueprint-checker": 15, "blueprint-debugger": 27,
  "blueprint-doc-verifier": 24, "blueprint-doc-writer": 24,
  "blueprint-executor": 30, "blueprint-mapper": 24,
  "blueprint-planner": 24, "blueprint-project-researcher": 18,
  "blueprint-researcher": 27, "blueprint-reviewer": 24,
  "blueprint-roadmapper": 18, "blueprint-security-auditor": 24,
  "blueprint-ui-auditor": 24, "blueprint-ui-designer": 21,
  "blueprint-verifier": 24
} as const;
const removedKeys = ["name", "kind", "tools", "display_name", "max_turns", "timeout_mins", "model"] as const;
const expectedSkills = [
  "blueprint-bootstrap", "blueprint-capture", "blueprint-debug", "blueprint-docs",
  "blueprint-god-review", "blueprint-governance", "blueprint-impact",
  "blueprint-maintenance", "blueprint-map", "blueprint-phase-discovery",
  "blueprint-phase-execution", "blueprint-phase-planning",
  "blueprint-phase-validation", "blueprint-plan-run", "blueprint-review",
  "blueprint-roadmap-admin", "blueprint-router"
].sort();

async function load(agentName: string) {
  const relativePath = `agents/${agentName}.md`;
  const content = await readFile(path.join(repoRoot, relativePath), "utf8");
  const validation = validateBlueprintAgentDefinitionContent(agentName, content, relativePath);
  const parsed = parseNativeMarkdown(content, relativePath);
  return { validation, ...parsed };
}

test("shipped native agents contain the required primary plus 15 optional specialists", async () => {
  const files = (await readdir(path.join(repoRoot, "agents"))).filter((entry) => entry.endsWith(".md")).sort();
  assert.deepEqual(files, [`${BLUEPRINT_PRIMARY_AGENT_NAME}.md`, ...BLUEPRINT_AGENT_TOOL_NAMES.map((name) => `${name}.md`)].sort());
});

test("specialists use filename identity, native mode, preserved steps, and strict permissions", async () => {
  for (const agentName of BLUEPRINT_AGENT_TOOL_NAMES) {
    const { body, frontmatter, validation } = await load(agentName);
    assert.equal(validation.valid, true, validation.issues.join("\n"));
    assert.equal(frontmatter.mode, "subagent");
    assert.equal(frontmatter.steps, expectedSteps[agentName]);
    assert.ok(typeof frontmatter.description === "string" && frontmatter.description.length >= 80);
    assert.ok(body.startsWith("# "));
    assert.match(body, /## Purpose/);
    for (const key of removedKeys) assert.equal(key in frontmatter, false, `${agentName}: ${key}`);
    const permission = frontmatter.permission as Record<string, unknown>;
    const read = permission.read as Record<string, unknown>;
    assert.equal(permission["*"], "deny");
    assert.equal(read["*"], "allow");
    assert.equal(read["*.env"], "deny");
    assert.equal(read["*.env.*"], "deny");
    assert.equal(read["*.env.example"], "allow");
    assert.equal(read["mcp:*"], "deny");
    assert.equal(permission.glob, "allow");
    assert.equal(permission.grep, "allow");
    for (const key of ["external_directory", "task", "question", "todowrite", "skill", "blueprint_*", "list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource"]) {
      assert.equal(permission[key], "deny", `${agentName}: ${key}`);
    }
    if (agentName === "blueprint-executor") {
      assert.equal(permission.edit, "allow");
      assert.equal(permission.bash, "ask");
    } else {
      for (const key of ["edit", "write", "apply_patch", "bash"]) assert.equal(permission[key], "deny", `${agentName}: ${key}`);
    }
  }
});

test("required primary owns only the locked task, skill, interaction, source, and Blueprint MCP surface", async () => {
  const { body, frontmatter, validation } = await load(BLUEPRINT_PRIMARY_AGENT_NAME);
  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.equal(frontmatter.mode, "primary");
  assert.equal(frontmatter.steps, 40);
  const permission = frontmatter.permission as Record<string, unknown>;
  const read = permission.read as Record<string, unknown>;
  const tasks = permission.task as Record<string, unknown>;
  const skills = permission.skill as Record<string, unknown>;
  assert.equal(permission["*"], "deny");
  assert.equal(permission.edit, "allow");
  assert.equal(permission.bash, "ask");
  assert.equal(permission.question, "allow");
  assert.equal(permission.todowrite, "allow");
  assert.equal(permission["blueprint_*"], "allow");
  assert.equal(read["mcp:*"], "deny");
  assert.equal(read["mcp:blueprint:*"], "allow");
  assert.deepEqual(Object.keys(tasks).sort(), [...BLUEPRINT_AGENT_TOOL_NAMES]);
  assert.ok(Object.values(tasks).every((value) => value === "allow"));
  assert.deepEqual(Object.keys(skills).sort(), expectedSkills);
  assert.ok(Object.values(skills).every((value) => value === "allow"));
  assert.match(body, /self-contained packet/i);
  assert.match(body, /returned `task_id`/);
  assert.match(body, /Do not assume intermediate child narration/i);
  assert.match(body, /steps.*wall-clock deadline/i);
  assert.match(body, /must never dispatch `blueprint-executor`/i);
});
