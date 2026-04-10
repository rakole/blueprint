import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintArtifactScaffold,
  resolveBlueprintPath
} from "../src/mcp/tools/artifacts.js";
import { blueprintConfigSet } from "../src/mcp/tools/config.js";
import { blueprintProjectInit, blueprintProjectStatus } from "../src/mcp/tools/project.js";
import { blueprintStateUpdate } from "../src/mcp/tools/state.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "tests/fixtures/new-project");

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyFixtureContents(sourcePath: string, targetPath: string): Promise<void> {
  const entries = await readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntry = path.join(sourcePath, entry.name);
    const targetEntry = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await mkdir(targetEntry, { recursive: true });
      await copyFixtureContents(sourceEntry, targetEntry);
      continue;
    }

    const sourceStats = await stat(sourceEntry);
    await mkdir(path.dirname(targetEntry), { recursive: true });
    await copyFile(sourceEntry, targetEntry);
    await import("node:fs/promises").then(({ chmod }) =>
      chmod(targetEntry, sourceStats.mode)
    );
  }
}

async function createRepoFromFixture(fixtureName: string): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-phase-01-validation-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");

  const sourcePath = path.join(fixtureRoot, fixtureName);

  if (await pathExists(sourcePath)) {
    await copyFixtureContents(sourcePath, repoPath);
  }

  return repoPath;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

test("root router and Gemini context stay aligned with the Phase 1 routing contract", async () => {
  const routerFile = await readFile(path.join(repoRoot, "commands/blu.toml"), "utf8");
  const geminiFile = await readFile(path.join(repoRoot, "GEMINI.md"), "utf8");
  const manifest = await readJsonFile<{
    name: string;
    contextFileName: string;
    mcpServers: Record<string, { command?: string; args?: string[] }>;
  }>(path.join(repoRoot, "gemini-extension.json"));
  const requiredRouterTools = [
    "blueprint_project_status",
    "blueprint_command_catalog",
    "blueprint_config_get"
  ];

  for (const toolName of requiredRouterTools) {
    assert.ok(
      blueprintToolNames.includes(toolName),
      `${toolName} should be registered in the MCP server`
    );
    assert.match(routerFile, new RegExp(toolName));
  }

  assert.match(routerFile, /slash-command chaining/i);
  assert.match(routerFile, /\/blu:new-project/);
  assert.match(geminiFile, /\/blu:new-project/);
  assert.match(geminiFile, /\.blueprint\//);
  assert.match(geminiFile, /~\/\.gemini\/blueprint\//);
  assert.equal(manifest.name, "blueprint");
  assert.equal(manifest.contextFileName, "GEMINI.md");
  assert.equal(manifest.mcpServers.blueprint.command, "node");
});

test("config_set persists normalized project patches and rejects reserved repo keys", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });
  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      mode: "auto",
      parallelization: {
        max_concurrent_agents: 4
      }
    }
  });
  const config = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.equal(result.config.version, 2);
  assert.equal(result.configPath, ".blueprint/config.json");
  assert.deepEqual(result.updatedKeys, ["mode", "parallelization.max_concurrent_agents"]);
  assert.equal(config.mode, "auto");
  assert.equal(
    (config.parallelization as Record<string, unknown>).max_concurrent_agents,
    4
  );

  await assert.rejects(
    blueprintConfigSet({
      cwd: repoPath,
      patch: {
        workflow: {
          use_workspaces: true
        }
      }
    }),
    /workflow\.use_workspaces/
  );
});

test("state_update patches STATE.md deterministically and reports updated fields", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });
  const result = await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      nextAction: "Run /blu:health",
      blockers: ["Need roadmap review"]
    }
  });
  const stateDocument = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.equal(result.statePath, ".blueprint/STATE.md");
  assert.deepEqual(result.updatedFields, ["nextAction", "blockers"]);
  assert.match(stateDocument, /- Next action: Run \/blu:health/);
  assert.match(stateDocument, /## Blockers/);
  assert.match(stateDocument, /- Need roadmap review/);
});

test("artifact scaffolding creates requested files, reuses them safely, and blocks path escapes", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const firstRun = await blueprintArtifactScaffold({
    cwd: repoPath,
    projectName: "Validation Demo",
    artifacts: [".blueprint/PROJECT.md", ".blueprint/phases/"]
  });
  const secondRun = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/PROJECT.md", ".blueprint/phases/"]
  });
  const projectDocument = await readFile(path.join(repoPath, ".blueprint/PROJECT.md"), "utf8");

  assert.deepEqual(firstRun.createdFiles, [".blueprint/PROJECT.md", ".blueprint/phases/"]);
  assert.deepEqual(firstRun.reusedFiles, []);
  assert.match(projectDocument, /^# Validation Demo/m);
  assert.deepEqual(secondRun.createdFiles, []);
  assert.deepEqual(secondRun.reusedFiles, [".blueprint/PROJECT.md", ".blueprint/phases/"]);
  assert.throws(
    () => resolveBlueprintPath(repoPath, ".blueprint/../escape.md"),
    /Path traversal is not allowed/
  );
});

test("project status flags partial Blueprint state instead of pretending the repo is ready", async (t) => {
  const repoPath = await createRepoFromFixture("partial-blueprint");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(status.initialized, false);
  assert.equal(status.currentPhase, null);
  assert.match(status.nextAction, /Re-run \/blu:new-project only after you decide/);
  assert.ok(status.health.missingArtifacts.includes(".blueprint/STATE.md"));
  assert.match(status.health.warnings.join("\n"), /partially initialized/i);
});
