import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  validateBundledBlueprintAgentDefinition
} from "../src/mcp/agent-definition.js";
import {
  BLUEPRINT_AGENT_TOOL_ALLOWLIST,
  BLUEPRINT_AGENT_TOOL_NAMES,
  BLUEPRINT_WRITE_CAPABLE_AGENT_NAMES
} from "../src/mcp/agent-metadata.js";
import { listRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();
const BUILTIN_AGENT_TOOL_NAMES = new Set([
  "list_directory",
  "read_file",
  "glob",
  "grep_search",
  "replace",
  "write_file",
  "run_shell_command"
]);
const WRITE_CAPABLE_TOOL_NAMES = new Set([
  "replace",
  "write_file",
  "run_shell_command"
]);

async function readRelativePath(relativePath: string): Promise<string | null> {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function mentionedBuiltinAgentTools(body: string): string[] {
  const mentioned = new Set<string>();
  const toolReferencePattern = /`([a-z][a-z0-9_]+)`/g;

  for (const match of body.matchAll(toolReferencePattern)) {
    const toolName = match[1];

    if (BUILTIN_AGENT_TOOL_NAMES.has(toolName)) {
      mentioned.add(toolName);
    }
  }

  return [...mentioned].sort();
}

test("canonical Blueprint agent allowlist matches the shipped agent files", async () => {
  const shippedAgentNames = (await readdir(path.join(repoRoot, "agents")))
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => entry.replace(/\.md$/, ""))
    .sort();

  assert.deepEqual(shippedAgentNames, [...BLUEPRINT_AGENT_TOOL_NAMES]);

  for (const agentName of BLUEPRINT_AGENT_TOOL_NAMES) {
    const validation = await validateBundledBlueprintAgentDefinition(
      agentName,
      readRelativePath
    );

    assert.equal(validation.valid, true, validation.issues.join("\n"));
    assert.deepEqual(
      validation.frontmatter.tools ?? [],
      [...BLUEPRINT_AGENT_TOOL_ALLOWLIST[agentName]],
      `${agentName} should keep its frontmatter tools aligned with the canonical allowlist`
    );
  }
});

test("runtime-owned command metadata only references shipped Blueprint optional agents", () => {
  const knownAgentNames = new Set(BLUEPRINT_AGENT_TOOL_NAMES);

  for (const metadata of listRuntimeOwnedCommandMetadata()) {
    for (const agentName of metadata.optionalAgents) {
      assert.equal(
        knownAgentNames.has(agentName),
        true,
        `${metadata.commandName} references unknown optional agent ${agentName}`
      );
    }

    for (const agentName of metadata.runtimeReference.optionalAgents) {
      assert.equal(
        knownAgentNames.has(agentName),
        true,
        `${metadata.commandName} runtime reference exposes unknown optional agent ${agentName}`
      );
    }
  }
});

test("only blueprint-executor remains write-capable", () => {
  const writeCapableAgents = Object.entries(BLUEPRINT_AGENT_TOOL_ALLOWLIST)
    .filter(([, toolNames]) => toolNames.some((toolName) => WRITE_CAPABLE_TOOL_NAMES.has(toolName)))
    .map(([agentName]) => agentName)
    .sort();

  assert.deepEqual(writeCapableAgents, [...BLUEPRINT_WRITE_CAPABLE_AGENT_NAMES]);
});

test("agent bodies do not rely on ungranted built-in tools", async () => {
  for (const agentName of BLUEPRINT_AGENT_TOOL_NAMES) {
    const validation = await validateBundledBlueprintAgentDefinition(
      agentName,
      readRelativePath
    );

    assert.equal(validation.valid, true, validation.issues.join("\n"));

    const raw = await readRelativePath(`agents/${agentName}.md`);

    assert.ok(raw, `Missing agent file for ${agentName}`);

    const grantedTools = new Set((validation.frontmatter.tools as string[] | undefined) ?? []);
    const referencedTools = mentionedBuiltinAgentTools(stripFrontmatter(raw));

    for (const toolName of referencedTools) {
      assert.equal(
        grantedTools.has(toolName),
        true,
        `${agentName} references ${toolName} in its body without granting it in frontmatter`
      );
    }
  }
});
