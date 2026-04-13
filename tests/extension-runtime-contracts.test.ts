import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintDirectCommand
} from "../src/mcp/command-paths.js";
import {
  blueprintDiscoverableSkillPath,
  blueprintRuntimeToolFqn,
  resolveBlueprintSkillPath
} from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);

// Covers the command batches repaired in DF-008, DF-009, and DF-010, plus the
// shipped note/add-todo/check-todos/add-backlog/review-backlog/explore capture
// slice, the debug slice, and the shipped code-review, code-review-fix,
// audit-fix, secure-phase, review, ui-review, add-tests, pr-branch, ship, and cleanup slices.
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
  "debug",
  "validate-phase",
  "verify-work",
  "add-tests",
  "note",
  "add-todo",
  "check-todos",
  "add-backlog",
  "review-backlog",
  "explore",
  "review",
  "code-review",
  "code-review-fix",
  "audit-fix",
  "secure-phase",
  "ui-review",
  "add-phase",
  "insert-phase",
  "remove-phase",
  "plan-milestone-gaps",
  "audit-milestone",
  "complete-milestone",
  "milestone-summary",
  "new-milestone",
  "pr-branch",
  "ship",
  "cleanup"
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

async function assertGitTracksPath(relativePath: string): Promise<void> {
  try {
    await execFileAsync("git", ["ls-files", "--error-unmatch", relativePath], {
      cwd: repoRoot
    });
  } catch {
    assert.fail(
      `${relativePath} must be tracked because Git-installed Gemini extensions do not build Blueprint before launching runtime entrypoints.`
    );
  }
}

async function activeCommandDocs(): Promise<string[]> {
  return (await readdir(path.join(repoRoot, "docs/commands")))
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => `docs/commands/${entry}`)
    .sort();
}

async function implementedSkillNames(): Promise<string[]> {
  const catalog = await blueprintCommandCatalog();
  const skillNames = new Set<string>(["blueprint-router"]);

  for (const entry of Object.values(catalog.commands)) {
    if (entry.implemented) {
      skillNames.add(entry.primarySkill);
    }
  }

  return [...skillNames].sort();
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
  return markdown.replace(/`mcp_blueprint_blueprint_[a-z0-9_]+`/g, "`<runtime-tool>`");
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

test("git-installed extension bundle includes the built runtime assets", async () => {
  for (const relativePath of [
    "dist/mcp/server.js",
    "dist/hooks/read-before-edit.js",
    "dist/hooks/blueprint-write-guard.js",
    "dist/hooks/workflow-advisory.js"
  ]) {
    await assertGitTracksPath(relativePath);
  }
});

test("implemented Blueprint skills resolve to discoverable Gemini bundles with metadata", async () => {
  for (const skillName of await implementedSkillNames()) {
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

test("implemented Blueprint skills include runtime tool and slash-command guardrails", async () => {
  for (const skillName of await implementedSkillNames()) {
    const raw = await readRelativePath(blueprintDiscoverableSkillPath(skillName));

    assert.match(
      raw,
      /## Runtime Call Rules/,
      `${skillName} should document runtime call guardrails`
    );
    assert.match(
      raw,
      /`mcp_blueprint_blueprint_project_status`/,
      `${skillName} should include a runtime FQN example`
    );
    assert.match(
      raw,
      /Translate any shorthand tool ids like `blueprint_project_status`/,
      `${skillName} should explain shorthand-to-FQN translation`
    );
    assert.match(
      raw,
      /Treat Blueprint skills as loaded guidance, not callable tools\./,
      `${skillName} should block skill-as-tool confusion`
    );
    assert.match(
      raw,
      /Never run `\/blu-\*` in the shell\./,
      `${skillName} should forbid shelling slash commands`
    );
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

test("new-project manifest forbids shell execution and tool-name drift", async () => {
  const raw = await readRelativePath("commands/blu-new-project.toml");

  assert.match(
    raw,
    /When you name a Blueprint MCP tool explicitly in Gemini CLI, use the runtime FQN form `mcp_blueprint_<toolName>`\./
  );
  assert.match(
    raw,
    /Translate any shorthand `blueprint_\*` ids from older docs into their `mcp_blueprint_\*` runtime FQNs before calling them\./
  );
  assert.match(
    raw,
    /Never try to invoke Blueprint MCP tools through shell commands such as `mcp use`, `blueprint-mcp`, or ad-hoc `node -e` MCP SDK scripts\./
  );
  assert.match(
    raw,
    /Do not try to re-activate Blueprint skills as tools inside this command/
  );
  assert.match(
    raw,
    /do not run `\/blu-new-project` in the shell; it is a Gemini slash command, not a shell executable\./i
  );
});

test("shipped direct commands no longer include deprecated compatibility manifests", async () => {
  for (const commandName of REPAIRED_DIRECT_COMMANDS) {
    assert.equal(
      await pathExists(`commands/blu/${commandName}.toml`),
      false,
      `${commandName} should not ship a deprecated colon-form compatibility manifest`
    );
    assert.equal(await pathExists(`commands/blu-${commandName}.toml`), true);
  }
});

test("active docs and runtime prompts do not mention colon-form direct commands", async () => {
  const paths = [
    "README.md",
    "GEMINI.md",
    "AGENTS.md",
    "MEMORY.md",
    "commands/blu.toml",
    "docs/ARCHITECTURE.md",
    "docs/DECISIONS.md",
    "skills/blueprint-router/SKILL.md",
    ...(await activeCommandDocs())
  ];

  for (const relativePath of paths) {
    const raw = await readRelativePath(relativePath);

    assert.doesNotMatch(
      raw,
      /\/blu:/,
      `${relativePath} should not mention removed colon-form direct commands`
    );
  }
});
