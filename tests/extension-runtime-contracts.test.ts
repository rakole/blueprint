import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintCompatibilityDirectCommand,
  blueprintCompatibilityManifestPath,
  blueprintDirectCommand
} from "../src/mcp/command-paths.js";
import {
  blueprintDiscoverableSkillPath,
  blueprintRuntimeToolFqn,
  resolveBlueprintSkillPath
} from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

// Covers the command batches repaired in DF-008, DF-009, and DF-010, plus the
// shipped note/add-todo/add-backlog capture slice and secure-phase review slice.
const REPAIRED_DIRECT_COMMANDS = [
  "help",
  "progress",
  "next",
  "new-project",
  "settings",
  "set-profile",
  "health",
  "pause-work",
  "resume-work",
  "discuss-phase",
  "research-phase",
  "ui-phase",
  "list-phase-assumptions",
  "plan-phase",
  "execute-phase",
  "fast",
  "quick",
  "validate-phase",
  "verify-work",
  "note",
  "add-todo",
  "add-backlog",
  "secure-phase",
  "add-phase",
  "insert-phase",
  "remove-phase",
  "plan-milestone-gaps",
  "audit-milestone",
  "complete-milestone",
  "milestone-summary",
  "new-milestone"
] as const;

type RuntimePromptContract = {
  commandName: string;
  manifestPath: string;
  primarySkill: string;
  requiredTools: readonly string[];
  optionalAgents: readonly string[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readRelativePath(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function repairedPromptContracts(): Promise<RuntimePromptContract[]> {
  const catalog = await blueprintCommandCatalog();

  return [
    {
      commandName: "blu",
      manifestPath: "commands/blu.toml",
      primarySkill: "blueprint-router",
      requiredTools: [
        "blueprint_project_status",
        "blueprint_command_catalog",
        "blueprint_config_get"
      ],
      optionalAgents: []
    },
    ...REPAIRED_DIRECT_COMMANDS.map((commandName) => {
      const entry = catalog.commands[commandName];

      assert.ok(entry, `Missing command catalog entry for ${commandName}`);
      assert.equal(
        entry.implemented,
        true,
        `${commandName} should stay implemented in the runtime catalog`
      );
      assert.ok(entry.manifestPath, `${commandName} should resolve a manifest path`);

      return {
        commandName,
        manifestPath: entry.manifestPath!,
        primarySkill: entry.primarySkill,
        requiredTools: entry.requiredTools,
        optionalAgents: entry.optionalAgents
      };
    })
  ];
}

function stripRuntimeToolFqns(markdown: string): string {
  return markdown.replace(/`mcp__blueprint__blueprint_[a-z0-9_]+`/g, "`<runtime-tool>`");
}

test("gemini extension discovery points at the built Blueprint MCP server", async () => {
  const raw = await readRelativePath("gemini-extension.json");
  const manifest = JSON.parse(raw) as {
    name: string;
    description: string;
    contextFileName: string;
    mcpServers?: {
      blueprint?: {
        command?: string;
        args?: string[];
      };
    };
  };

  assert.equal(manifest.name, "blueprint");
  assert.equal(manifest.contextFileName, "GEMINI.md");
  assert.match(manifest.description, /Blueprint/i);
  assert.doesNotMatch(manifest.description, /scaffold/i);
  assert.equal(manifest.mcpServers?.blueprint?.command, "node");
  assert.deepEqual(manifest.mcpServers?.blueprint?.args, [
    "${extensionPath}/dist/mcp/server.js"
  ]);
});

test("implemented Blueprint skills resolve to discoverable Gemini bundles with metadata", async () => {
  const catalog = await blueprintCommandCatalog();
  const skillNames = new Set<string>(["blueprint-router"]);

  for (const entry of Object.values(catalog.commands)) {
    if (entry.implemented) {
      skillNames.add(entry.primarySkill);
    }
  }

  for (const skillName of [...skillNames].sort()) {
    const resolution = await resolveBlueprintSkillPath(skillName, pathExists);

    assert.equal(
      resolution.resolution,
      "discoverable",
      `${skillName} should resolve through skills/${skillName}/SKILL.md`
    );
    assert.equal(resolution.resolvedPath, blueprintDiscoverableSkillPath(skillName));

    const raw = await readRelativePath(resolution.resolvedPath!);

    assert.match(raw, /^---\n/);
    assert.match(raw, new RegExp(`name: ${escapeRegExp(skillName)}`));
    assert.match(raw, /\ndescription:\s*(>|)?/);
    assert.match(raw, /\nstatus: implemented\b/);
  }
});

test("repaired command manifests stay path-free and runtime-name consistent", async () => {
  const contracts = await repairedPromptContracts();

  for (const contract of contracts) {
    const raw = await readRelativePath(contract.manifestPath);

    assert.match(
      raw,
      new RegExp(`Use the \`${escapeRegExp(contract.primarySkill)}\` skill`),
      `${contract.commandName} should reference its runtime skill name`
    );
    assert.doesNotMatch(
      raw,
      /skills\/[a-z0-9-]+\.md/,
      `${contract.commandName} should not reference legacy skill file paths`
    );
    assert.doesNotMatch(
      raw,
      /agents\/[a-z0-9-]+\.md/,
      `${contract.commandName} should not reference agent markdown paths`
    );

    for (const toolName of contract.requiredTools) {
      assert.ok(
        blueprintToolNames.includes(toolName),
        `${contract.commandName} depends on an unregistered tool: ${toolName}`
      );
      assert.match(
        raw,
        new RegExp(
          escapeRegExp(`\`${blueprintRuntimeToolFqn(toolName as `blueprint_${string}`)}\``)
        ),
        `${contract.commandName} should reference ${toolName} through its runtime FQN`
      );
    }

    for (const agentName of contract.optionalAgents) {
      assert.match(
        raw,
        new RegExp(escapeRegExp(`\`${agentName}\``)),
        `${contract.commandName} should reference ${agentName} by runtime name`
      );
    }

    assert.doesNotMatch(
      stripRuntimeToolFqns(raw),
      /`blueprint_[a-z0-9_]+`/,
      `${contract.commandName} should not fall back to raw internal tool names`
    );
  }
});

test("deprecated compatibility manifests redirect to the canonical dash-form direct commands", async () => {
  for (const commandName of REPAIRED_DIRECT_COMMANDS) {
    const manifestPath = blueprintCompatibilityManifestPath(commandName);
    const raw = await readRelativePath(manifestPath);

    assert.match(
      raw,
      new RegExp(
        escapeRegExp(
          `You are the deprecated \`${blueprintCompatibilityDirectCommand(commandName)}\` compatibility command`
        )
      )
    );
    assert.match(
      raw,
      new RegExp(
        escapeRegExp(
          `Canonical direct command path: \`${blueprintDirectCommand(commandName)}\``
        )
      )
    );
  }
});
