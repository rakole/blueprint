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
  resolveBlueprintPath,
  type BootstrapSeed
} from "../src/mcp/tools/artifacts.js";
import { blueprintConfigSet } from "../src/mcp/tools/config.js";
import { blueprintProjectInit, blueprintProjectStatus } from "../src/mcp/tools/project.js";
import { blueprintStateLoad, blueprintStateUpdate, loadBlueprintState } from "../src/mcp/tools/state.js";
import {
  shippedExtensionHosts,
  type ExtensionHost
} from "./helpers/extension-hosts.ts";
import { createGitRepo } from "./helpers/git-fixtures.js";

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
  const repoPath = await createGitRepo("blueprint-phase-01-validation-");

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

function buildBootstrapSeed(): BootstrapSeed {
  return {
    vision: "Initialize a durable Blueprint planning fixture for Phase 1 validation tests.",
    currentMilestone: "v1",
    requirements: [
      {
        id: "BP-01",
        scope: "committed",
        group: "Fixture setup",
        requirement: "Create initialized Blueprint artifacts for config and state validation.",
        status: "Pending",
        notes: "Phase 1 validation fixture requirement."
      }
    ],
    roadmapPhases: [
      {
        phase: "1",
        title: "Initialize Fixture",
        objective: "Create deterministic bootstrap state for config and state tool tests.",
        requirementIds: ["BP-01"],
        successCriteria: [
          "The fixture has initialized Blueprint project artifacts.",
          "The first phase remains traceable to the fixture requirement."
        ]
      }
    ],
    assumptions: ["Fixture bootstrap exists only to exercise config and state tools."]
  };
}

test("root router and shipped host contexts stay aligned with the Phase 1 routing contract", async () => {
  const routerFile = await readFile(path.join(repoRoot, "commands/blu.toml"), "utf8");
  const requiredRouterTools = [
    "blueprint_project_status",
    "blueprint_command_catalog",
    "blueprint_config_get"
  ];
  const hosts = await shippedExtensionHosts(repoRoot);

  for (const toolName of requiredRouterTools) {
    assert.ok(
      blueprintToolNames.includes(toolName),
      `${toolName} should be registered in the MCP server`
    );
    assert.match(routerFile, new RegExp(toolName));
  }

  assert.match(routerFile, /slash-command chaining/i);
  assert.match(routerFile, /\/blu-new-project/);
  assert.ok(hosts.length > 0, "At least one extension host should ship a runtime context");

  for (const host of hosts) {
    await assertHostRuntimeContract(host);
  }
});

test("config_set persists normalized project patches and rejects reserved repo keys", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });
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

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });
  const result = await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      nextAction: "Run /blu-health",
      blockers: ["Need roadmap review"]
    }
  });
  const stateDocument = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.equal(result.statePath, ".blueprint/STATE.md");
  assert.ok(result.updatedFields.includes("nextAction"));
  assert.ok(result.updatedFields.includes("blockers"));
  assert.ok(result.updatedFields.includes("lastUpdated"));
  assert.deepEqual(result.warnings, []);
  assert.match(stateDocument, /- Next action: Run \/blu-health/);
  assert.match(stateDocument, /## Blockers/);
  assert.match(stateDocument, /- Need roadmap review/);
});

test("state_update normalizes directory-shaped currentPhase patches", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });
  const result = await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "02-lets-do-some-work"
    }
  });
  const stateDocument = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");
  const loaded = await loadBlueprintState(repoPath);

  assert.equal(result.statePath, ".blueprint/STATE.md");
  assert.ok(result.updatedFields.includes("currentPhase"));
  assert.equal(loaded.currentPhase, "2");
  assert.match(stateDocument, /- Current phase: 2/);
});

test("state_update preserves roadmap evolution notes for urgent decimal insertions", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });
  const result = await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      roadmapEvolutionNotes: [
        "Urgent insertion: Phase 2.1 added after Phase 2 to preserve delivery order"
      ]
    }
  });
  const stateDocument = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");
  const loaded = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(result.statePath, ".blueprint/STATE.md");
  assert.ok(result.updatedFields.includes("roadmapEvolutionNotes"));
  assert.match(stateDocument, /## Roadmap Evolution Notes/);
  assert.match(
    stateDocument,
    /- Urgent insertion: Phase 2\.1 added after Phase 2 to preserve delivery order/
  );
  assert.deepEqual(loaded.state.roadmapEvolutionNotes, [
    "Urgent insertion: Phase 2.1 added after Phase 2 to preserve delivery order"
  ]);
});

test("legacy STATE.md files without roadmap evolution notes still parse cleanly", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 1
- Active command: /blu-new-project
- Next action: Run /blu-progress
- Last updated: 2026-04-20T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );

  const parsed = await loadBlueprintState(repoPath);

  assert.deepEqual(parsed.roadmapEvolutionNotes, []);
  assert.deepEqual(parsed.blockers, []);
  assert.equal(parsed.currentPhase, "1");
});

test("loadBlueprintState normalizes directory-shaped current phase values from STATE.md", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 02-lets-do-some-work
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-04-20T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );

  const parsed = await loadBlueprintState(repoPath);

  assert.equal(parsed.currentPhase, "2");
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
  assert.match(status.nextAction, /\/blu-health/);
  assert.ok(status.health.missingArtifacts.includes(".blueprint/STATE.md"));
  assert.match(status.health.warnings.join("\n"), /partially initialized/i);
});

async function assertHostRuntimeContract(host: ExtensionHost): Promise<void> {
  const contextFile = await readFile(path.join(repoRoot, host.contextFile), "utf8");
  const manifest = await readJsonFile<{
    name: string;
    contextFileName: string;
    mcpServers: Record<string, { command?: string; args?: string[] }>;
  }>(path.join(repoRoot, host.manifestFile));

  assert.match(
    contextFile,
    /\/blu-new-project/,
    `${host.contextFile} should advertise the new-project entrypoint`
  );
  assert.match(contextFile, /\.blueprint\//);
  assert.match(
    contextFile,
    new RegExp(host.globalBlueprintRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${host.contextFile} should point at ${host.globalBlueprintRoot}`
  );
  assert.equal(manifest.name, "blueprint");
  assert.equal(manifest.contextFileName, host.contextFile);
  assert.equal(manifest.mcpServers.blueprint.command, "node");
  assert.equal(manifest.mcpServers.blueprint.args?.[0], "${extensionPath}/dist/mcp/server.js");
}
