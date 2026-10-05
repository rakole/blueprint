import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateBundledBlueprintAgentDefinition } from "../src/mcp/agent-definition.js";
import {
  BLUEPRINT_AGENT_PERMISSION_ALLOWLIST,
  BLUEPRINT_AGENT_TOOL_NAMES,
  BLUEPRINT_WRITE_CAPABLE_AGENT_NAMES
} from "../src/mcp/agent-metadata.js";
import { listRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();
async function readRelativePath(relativePath: string): Promise<string | null> {
  try { return await readFile(path.join(repoRoot, relativePath), "utf8"); }
  catch { return null; }
}

test("runtime-owned metadata references only the 15 optional specialists", () => {
  const known = new Set(BLUEPRINT_AGENT_TOOL_NAMES);
  for (const metadata of listRuntimeOwnedCommandMetadata()) {
    for (const agentName of [...metadata.optionalAgents, ...metadata.runtimeReference.optionalAgents]) {
      assert.equal(known.has(agentName), true, `${metadata.commandName}: ${agentName}`);
      assert.notEqual(agentName, "blueprint");
    }
  }
});

test("canonical capability profiles match valid native specialist definitions", async () => {
  for (const agentName of BLUEPRINT_AGENT_TOOL_NAMES) {
    const validation = await validateBundledBlueprintAgentDefinition(agentName, readRelativePath);
    assert.equal(validation.valid, true, validation.issues.join("\n"));
    const permission = validation.frontmatter.permission as Record<string, unknown>;
    for (const key of BLUEPRINT_AGENT_PERMISSION_ALLOWLIST[agentName]) {
      assert.ok(key in permission, `${agentName} missing ${key}`);
      assert.notEqual(permission[key], "deny", `${agentName} denies expected capability ${key}`);
    }
  }
});

test("only blueprint-executor has native mutation and shell capability", async () => {
  const capable: string[] = [];
  for (const agentName of BLUEPRINT_AGENT_TOOL_NAMES) {
    const validation = await validateBundledBlueprintAgentDefinition(agentName, readRelativePath);
    const permission = validation.frontmatter.permission as Record<string, unknown>;
    if (permission.edit === "allow" || permission.bash === "ask") capable.push(agentName);
    if (agentName !== "blueprint-executor") {
      for (const key of ["edit", "write", "apply_patch", "bash"]) {
        assert.equal(permission[key], "deny", `${agentName} must deny ${key}`);
      }
    }
  }
  assert.deepEqual(capable, [...BLUEPRINT_WRITE_CAPABLE_AGENT_NAMES]);
});

test("executor uses semantic edit plus approval-controlled bash without control-plane grants", async () => {
  const validation = await validateBundledBlueprintAgentDefinition("blueprint-executor", readRelativePath);
  const permission = validation.frontmatter.permission as Record<string, unknown>;
  assert.equal(permission.edit, "allow");
  assert.equal(permission.bash, "ask");
  for (const key of ["task", "question", "todowrite", "skill", "blueprint_*", "list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource"]) {
    assert.equal(permission[key], "deny", key);
  }
});
