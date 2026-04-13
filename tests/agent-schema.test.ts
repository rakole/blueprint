import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();
const agentsDir = path.join(repoRoot, "agents");

const EXPECTED_AGENTS = {
  "blueprint-checker": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 10,
    timeoutMins: 10
  },
  "blueprint-doc-verifier": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 16,
    timeoutMins: 15
  },
  "blueprint-debugger": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 18,
    timeoutMins: 20
  },
  "blueprint-doc-writer": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 16,
    timeoutMins: 15
  },
  "blueprint-executor": {
    tools: [
      "list_directory",
      "read_file",
      "glob",
      "grep_search",
      "replace",
      "write_file",
      "run_shell_command"
    ],
    maxTurns: 20,
    timeoutMins: 20
  },
  "blueprint-mapper": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 16,
    timeoutMins: 15
  },
  "blueprint-planner": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 16,
    timeoutMins: 12
  },
  "blueprint-project-researcher": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 12,
    timeoutMins: 10
  },
  "blueprint-researcher": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 18,
    timeoutMins: 15
  },
  "blueprint-roadmapper": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 12,
    timeoutMins: 10
  },
  "blueprint-security-auditor": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 16,
    timeoutMins: 15
  },
  "blueprint-ui-designer": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 14,
    timeoutMins: 12
  },
  "blueprint-verifier": {
    tools: ["list_directory", "read_file", "glob", "grep_search"],
    maxTurns: 16,
    timeoutMins: 15
  }
} as const;

type AgentName = keyof typeof EXPECTED_AGENTS;

type FrontmatterValue = string | string[];

const VALID_BUILTIN_TOOLS = new Set([
  "list_directory",
  "read_file",
  "write_file",
  "glob",
  "grep_search",
  "replace",
  "run_shell_command"
]);

function extractFrontmatterBlock(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  assert.ok(match, "Agent file must start with YAML frontmatter fenced by ---");

  return {
    frontmatter: match[1],
    body: match[2]
  };
}

function parseFrontmatter(frontmatter: string): Record<string, FrontmatterValue> {
  const result: Record<string, FrontmatterValue> = {};
  const lines = frontmatter.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim()) {
      continue;
    }

    const match = line.match(/^([a-zA-Z_]+):\s*(.*)$/);

    assert.ok(match, `Unsupported frontmatter line: ${line}`);

    const [, key, rawValue] = match;

    if (rawValue === ">" || rawValue === "|") {
      const blockLines: string[] = [];

      for (index += 1; index < lines.length; index += 1) {
        const blockLine = lines[index];

        if (blockLine.startsWith("  ")) {
          blockLines.push(blockLine.slice(2).trim());
          continue;
        }

        index -= 1;
        break;
      }

      result[key] = blockLines.join(" ").trim();
      continue;
    }

    if (!rawValue) {
      const items: string[] = [];

      for (index += 1; index < lines.length; index += 1) {
        const itemLine = lines[index];
        const itemMatch = itemLine.match(/^  - (.+)$/);

        if (!itemMatch) {
          index -= 1;
          break;
        }

        items.push(itemMatch[1].trim());
      }

      result[key] = items;
      continue;
    }

    result[key] = rawValue.trim();
  }

  return result;
}

function isValidToolName(toolName: string): boolean {
  return (
    VALID_BUILTIN_TOOLS.has(toolName) ||
    toolName === "*" ||
    toolName === "mcp_*" ||
    /^mcp_[a-z0-9-]+_\*$/.test(toolName)
  );
}

async function loadAgent(agentName: AgentName) {
  const content = await readFile(path.join(agentsDir, `${agentName}.md`), "utf8");
  const { frontmatter, body } = extractFrontmatterBlock(content);

  return {
    content,
    body,
    frontmatter: parseFrontmatter(frontmatter)
  };
}

test("shipped Blueprint agents match the expected workstream-1 file set", async () => {
  const files = (await readdir(agentsDir))
    .filter((entry) => entry.endsWith(".md"))
    .sort();

  assert.deepEqual(
    files,
    Object.keys(EXPECTED_AGENTS)
      .map((agentName) => `${agentName}.md`)
      .sort()
  );
});

test("every shipped Blueprint agent is a valid Gemini subagent definition with conservative routing metadata", async () => {
  for (const [agentName, expected] of Object.entries(EXPECTED_AGENTS) as Array<
    [AgentName, (typeof EXPECTED_AGENTS)[AgentName]]
  >) {
    const { body, frontmatter } = await loadAgent(agentName);

    assert.equal(frontmatter.name, agentName);
    assert.equal(frontmatter.kind, "local");
    assert.equal(typeof frontmatter.description, "string");
    assert.match(frontmatter.description as string, /Use this agent when/i);
    assert.match(frontmatter.description as string, /Example scenarios:/i);
    assert.ok((frontmatter.description as string).length >= 120);
    assert.deepEqual(frontmatter.tools, expected.tools);
    assert.equal(frontmatter.max_turns, String(expected.maxTurns));
    assert.equal(frontmatter.timeout_mins, String(expected.timeoutMins));
    assert.ok(!("model" in frontmatter), `${agentName} should inherit the session model`);
    assert.ok(
      !("temperature" in frontmatter),
      `${agentName} should not override temperature without a strong reason`
    );
    assert.ok(body.startsWith("# "), `${agentName} body should remain markdown after frontmatter`);
    assert.match(body, /## Purpose/);

    for (const toolName of frontmatter.tools as string[]) {
      assert.ok(isValidToolName(toolName), `${agentName} declares an unknown tool: ${toolName}`);
      assert.notEqual(toolName, "*", `${agentName} should not use the all-tools wildcard`);
      assert.notEqual(toolName, "mcp_*", `${agentName} should not use the all-MCP wildcard`);
    }

    if (agentName === "blueprint-executor") {
      assert.ok(
        (frontmatter.tools as string[]).includes("replace"),
        "blueprint-executor must be able to edit existing files"
      );
      assert.ok(
        (frontmatter.tools as string[]).includes("write_file"),
        "blueprint-executor must be able to create files when a plan requires it"
      );
      continue;
    }

    assert.ok(
      !(frontmatter.tools as string[]).includes("replace"),
      `${agentName} should remain read-only at the tool layer`
    );
    assert.ok(
      !(frontmatter.tools as string[]).includes("write_file"),
      `${agentName} should remain read-only at the tool layer`
    );
    assert.ok(
      !(frontmatter.tools as string[]).includes("run_shell_command"),
      `${agentName} should stay off shell access unless the role truly executes work`
    );
  }
});

test("command-catalog optional agents always point at valid Gemini subagent files", async () => {
  const catalog = await blueprintCommandCatalog();
  const availableAgents = new Set(
    Object.values(catalog.commands).flatMap((entry) => entry.availableOptionalAgents)
  );

  for (const agentName of availableAgents) {
    assert.ok(
      agentName in EXPECTED_AGENTS,
      `Command catalog exposes optional agent without a schema contract: ${agentName}`
    );

    const { frontmatter } = await loadAgent(agentName as AgentName);

    assert.equal(frontmatter.name, agentName);
    assert.equal(frontmatter.kind, "local");
    assert.equal(Array.isArray(frontmatter.tools), true);
    assert.ok((frontmatter.tools as string[]).length > 0);
  }
});
