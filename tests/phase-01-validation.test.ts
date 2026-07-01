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
  blueprintCodebaseArtifactWrite,
  blueprintArtifactScaffold,
  resolveBlueprintPath,
  type BootstrapSeed
} from "../src/mcp/tools/artifacts.js";
import { blueprintConfigSet } from "../src/mcp/tools/config.js";
import { blueprintProjectInit, blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  blueprintStateLoad,
  blueprintStateSync,
  blueprintStateUpdate,
  loadBlueprintState
} from "../src/mcp/tools/state.js";
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

async function writeMappedCodebaseBundle(repoPath: string): Promise<void> {
  type CodebaseArtifactId = Parameters<typeof blueprintCodebaseArtifactWrite>[0]["artifactId"];
  const authoredBundle: Record<CodebaseArtifactId, string> = {
    "codebase.stack": "# Stack\n\nTypeScript runtime with MCP-facing tooling.\n",
    "codebase.architecture":
      "# Architecture\n\nMCP tools and command manifests anchor the runtime layout.\n",
    "codebase.structure":
      "# Structure\n\nBlueprint runtime code lives in src/, with tests under tests/.\n",
    "codebase.conventions":
      "# Conventions\n\nBlueprint keeps runtime tool names explicit and persistence inside MCP.\n",
    "codebase.testing":
      "# Testing\n\nThe repo uses node:test via tsx and fixture-backed integration coverage.\n",
    "codebase.integrations":
      "# Integrations\n\nThe runtime integrates through @modelcontextprotocol/sdk and related command surfaces.\n",
    "codebase.concerns":
      "# Concerns\n\nPlaceholder codebase docs should not be treated as authoritative mapped context.\n"
  };

  for (const [artifactId, content] of Object.entries(authoredBundle) as Array<[CodebaseArtifactId, string]>) {
    const result = await blueprintCodebaseArtifactWrite({
      cwd: repoPath,
      artifactId,
      content
    });

    assert.notEqual(result.status, "invalid", JSON.stringify(result));
  }
}

function countStateFrontmatterDelimiters(content: string): number {
  return content.match(/^---$/gm)?.length ?? 0;
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
  assert.match(stateDocument, /^---\nblueprint_state_version: 1\.0/m);
  assert.match(stateDocument, /^milestone: v1$/m);
  assert.match(stateDocument, /^status: initialized$/m);
  assert.match(stateDocument, /^current_phase: "1"$/m);
  assert.match(stateDocument, /^next_action: "Run \/blu-health"$/m);
  assert.match(stateDocument, /^  total_phases: 1$/m);
  assert.match(stateDocument, /^  completed_phases: 0$/m);
  assert.match(stateDocument, /^  percent: 0$/m);
  assert.equal(countStateFrontmatterDelimiters(stateDocument), 2);
  assert.match(stateDocument, /- Next action: Run \/blu-health/);
  assert.match(stateDocument, /## Blockers/);
  assert.match(stateDocument, /- Need roadmap review/);
});

test("state_update rejects phase-mismatched and unknown nextAction commands without writing", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });
  const statePath = path.join(repoPath, ".blueprint/STATE.md");
  const beforeStateDocument = await readFile(statePath, "utf8");

  await assert.rejects(
    blueprintStateUpdate({
      cwd: repoPath,
      patch: {
        currentPhase: "1",
        nextAction: "Run /blu-validate-phase 999"
      }
    }),
    /current phase 1.*\/blu-validate-phase 999/
  );

  await assert.rejects(
    blueprintStateUpdate({
      cwd: repoPath,
      patch: {
        currentPhase: "2"
      }
    }),
    /current phase 2.*\/blu-discuss-phase 1/
  );

  await assert.rejects(
    blueprintStateUpdate({
      cwd: repoPath,
      patch: {
        currentPhase: "1",
        nextAction: "Run /blu-teleport-phase 1"
      }
    }),
    /not an implemented Blueprint command/
  );

  await assert.rejects(
    blueprintStateUpdate({
      cwd: repoPath,
      patch: {
        currentPhase: "1",
        nextAction: "Run /blu-progress, then /blu-do"
      }
    }),
    /next action references \/blu-do.*not an implemented Blueprint command/
  );

  await assert.rejects(
    blueprintStateUpdate({
      cwd: repoPath,
      patch: {
        activeCommand: "/blu-do"
      }
    }),
    /active command references \/blu-do.*not an implemented Blueprint command/
  );

  assert.equal(await readFile(statePath, "utf8"), beforeStateDocument);
});

test("state_sync writes STATE.md frontmatter from roadmap phase progress", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });

  const result = await blueprintStateSync({ cwd: repoPath });
  const stateDocument = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.equal(result.statePath, ".blueprint/STATE.md");
  assert.ok(Array.isArray(result.warnings));
  assert.match(stateDocument, /^---\nblueprint_state_version: 1\.0/m);
  assert.match(stateDocument, /^milestone: v1$/m);
  assert.match(stateDocument, /^status: initialized$/m);
  assert.match(stateDocument, /^current_phase: "1"$/m);
  assert.match(stateDocument, /^  total_phases: 1$/m);
  assert.match(stateDocument, /^  completed_phases: 0$/m);
  assert.match(stateDocument, /^  percent: 0$/m);
  assert.match(stateDocument, /\n# Blueprint State\n/);
  assert.equal(countStateFrontmatterDelimiters(stateDocument), 2);
});

test("state_sync rejects uninitialized repos without creating Blueprint runtime state", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintStateSync({ cwd: repoPath }),
    /Cannot sync Blueprint state before \.blueprint\/ exists/
  );

  assert.equal(await pathExists(path.join(repoPath, ".blueprint")), false);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/locks")), false);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/STATE.md")), false);
});

test("state_update rejects bootstrap-ineligible repos without creating locks or STATE.md", async (t) => {
  const uninitializedRepo = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(uninitializedRepo), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintStateUpdate({
      cwd: uninitializedRepo,
      patch: {
        nextAction: "Run /blu-health"
      }
    }),
    /Cannot update Blueprint state before core \.blueprint\/ project artifacts exist.*\/blu-new-project/
  );
  assert.equal(await pathExists(path.join(uninitializedRepo, ".blueprint")), false);
  assert.equal(await pathExists(path.join(uninitializedRepo, ".blueprint/locks")), false);
  assert.equal(await pathExists(path.join(uninitializedRepo, ".blueprint/STATE.md")), false);

  const mappingIncompleteRepo = await createGitRepo("blueprint-state-update-mapping-");
  t.after(async () => {
    await rm(path.dirname(mappingIncompleteRepo), { recursive: true, force: true });
  });
  await mkdir(path.join(mappingIncompleteRepo, "src"), { recursive: true });
  await writeFile(
    path.join(mappingIncompleteRepo, "package.json"),
    JSON.stringify({ name: "state-update-mapping", private: true }, null, 2),
    "utf8"
  );
  await mkdir(path.join(mappingIncompleteRepo, ".blueprint/codebase"), { recursive: true });
  await writeFile(
    path.join(mappingIncompleteRepo, ".blueprint/codebase/STACK.md"),
    "# Stack\n\nPartial codebase map.\n",
    "utf8"
  );
  assert.equal(
    (await blueprintProjectStatus({ cwd: mappingIncompleteRepo })).status,
    "mapping-incomplete"
  );

  await assert.rejects(
    blueprintStateUpdate({
      cwd: mappingIncompleteRepo,
      patch: {
        nextAction: "Run /blu-health"
      }
    }),
    /Cannot update Blueprint state before core \.blueprint\/ project artifacts exist.*\/blu-map-codebase/
  );
  assert.equal(await pathExists(path.join(mappingIncompleteRepo, ".blueprint/locks")), false);
  assert.equal(await pathExists(path.join(mappingIncompleteRepo, ".blueprint/STATE.md")), false);

  const mappedOnlyRepo = await createGitRepo("blueprint-state-update-mapped-");
  t.after(async () => {
    await rm(path.dirname(mappedOnlyRepo), { recursive: true, force: true });
  });
  await mkdir(path.join(mappedOnlyRepo, "src"), { recursive: true });
  await writeFile(
    path.join(mappedOnlyRepo, "package.json"),
    JSON.stringify({ name: "state-update-mapped", private: true }, null, 2),
    "utf8"
  );
  await writeFile(path.join(mappedOnlyRepo, "src/index.ts"), "export const value = 1;\n", "utf8");
  await writeMappedCodebaseBundle(mappedOnlyRepo);
  assert.equal((await blueprintProjectStatus({ cwd: mappedOnlyRepo })).status, "mapped-only");

  await assert.rejects(
    blueprintStateUpdate({
      cwd: mappedOnlyRepo,
      patch: {
        nextAction: "Run /blu-health"
      }
    }),
    /Cannot update Blueprint state before core \.blueprint\/ project artifacts exist.*\/blu-new-project/
  );
  assert.equal(await pathExists(path.join(mappedOnlyRepo, ".blueprint/locks")), false);
  assert.equal(await pathExists(path.join(mappedOnlyRepo, ".blueprint/STATE.md")), false);
});

test("state_sync returns persistence warnings from the atomic write layer", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });

  const statePath = path.join(repoPath, ".blueprint/STATE.md");
  const stateDocument = await readFile(statePath, "utf8");

  await writeFile(
    statePath,
    `${stateDocument.trimEnd()}\n\n## Roadmap Evolution Notes\n\n- Keep this note but remove the warning-only control character:\u0007\n`,
    "utf8"
  );

  const result = await blueprintStateSync({ cwd: repoPath });
  const syncedStateDocument = await readFile(statePath, "utf8");

  assert.match(
    result.warnings.join("\n"),
    /Removed 1 invisible or control character\(s\) before persistence/
  );
  assert.doesNotMatch(syncedStateDocument, /\u0007/);
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
  await mkdir(path.join(repoPath, ".blueprint/phases/02-lets-do-some-work"), {
    recursive: true
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-lets-do-some-work/02-CONTEXT.md"),
    "# Phase 2 Context\n",
    "utf8"
  );
  const result = await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "02-lets-do-some-work",
      nextAction: "Run /blu-discuss-phase 2"
    }
  });
  const stateDocument = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");
  const loaded = await loadBlueprintState(repoPath);

  assert.equal(result.statePath, ".blueprint/STATE.md");
  assert.ok(result.updatedFields.includes("currentPhase"));
  assert.ok(result.updatedFields.includes("nextAction"));
  assert.equal(loaded.currentPhase, "2");
  assert.match(stateDocument, /- Current phase: 2/);
  assert.match(stateDocument, /- Next action: Run \/blu-discuss-phase 2/);
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

test("stale STATE.md frontmatter is ignored when body fields disagree", async (t) => {
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
    `---
blueprint_state_version: 1.0
milestone: stale
status: partial
current_phase: "99"
active_command: /blu-health
next_action: "Run /blu-health"
last_updated: "1999-01-01T00:00:00.000Z"
progress:
  total_phases: 99
  completed_phases: 99
  percent: 100
---

# Blueprint State

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

  assert.equal(parsed.projectStatus, "initialized");
  assert.equal(parsed.currentMilestone, "v1");
  assert.equal(parsed.currentPhase, "2");
  assert.equal(parsed.activeCommand, "/blu-progress");
  assert.equal(parsed.nextAction, "Run /blu-progress");
  assert.equal(parsed.lastUpdated, "2026-04-20T00:00:00.000Z");
});

test("repeated state update and sync keep a single STATE.md frontmatter block", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({
    cwd: repoPath,
    bootstrapMode: "auto",
    bootstrapSeed: buildBootstrapSeed()
  });
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      activeCommand: "/blu-progress"
    }
  });
  await blueprintStateSync({ cwd: repoPath });

  const stateDocument = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.equal(countStateFrontmatterDelimiters(stateDocument), 2);
  assert.equal(stateDocument.match(/blueprint_state_version:/g)?.length, 1);
  assert.match(stateDocument, /^---\nblueprint_state_version: 1\.0/m);
  assert.match(stateDocument, /\n# Blueprint State\n/);
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
