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
  blueprintArtifactList,
  blueprintArtifactValidate
} from "../src/mcp/tools/artifacts.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import {
  blueprintStateLoad,
  blueprintStateSync
} from "../src/mcp/tools/state.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "tests/fixtures/help-progress-health");

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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-help-progress-health-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");

  const sourcePath = path.join(fixtureRoot, fixtureName);

  if (await pathExists(sourcePath)) {
    await copyFixtureContents(sourcePath, repoPath);
  }

  return repoPath;
}

test("read-path tools distinguish uninitialized Blueprint repos", async (t) => {
  const repoPath = await createRepoFromFixture("uninitialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });
  const artifacts = await blueprintArtifactList({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(status.status, "uninitialized");
  assert.equal(status.initialized, false);
  assert.match(status.nextAction, /\/blu:new-project/);
  assert.equal(state.derivedStatus.projectStatus, "uninitialized");
  assert.equal(state.derivedStatus.currentPhase, null);
  assert.match(state.derivedStatus.nextAction, /\/blu:new-project/);
  assert.deepEqual(artifacts.artifacts.core, []);
  assert.ok(artifacts.missing.includes(".blueprint/STATE.md"));
  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /Missing \.blueprint\/ directory/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu:new-project/);
});

test("read-path tools distinguish partial Blueprint repos and expose repair blockers", async (t) => {
  const repoPath = await createRepoFromFixture("partial-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });
  const artifacts = await blueprintArtifactList({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(status.status, "partial");
  assert.equal(status.initialized, false);
  assert.match(status.nextAction, /\/blu:health/);
  assert.equal(state.derivedStatus.projectStatus, "partial");
  assert.equal(state.derivedStatus.currentPhase, "2");
  assert.equal(state.derivedStatus.hasBlockers, true);
  assert.match(state.blockers.join("\n"), /Missing \.blueprint\/STATE\.md/);
  assert.ok(artifacts.missing.includes(".blueprint/REQUIREMENTS.md"));
  assert.ok(artifacts.missing.includes(".blueprint/config.json"));
  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /Missing core artifact: \.blueprint\/STATE\.md/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu:health --repair/);
});

test("state sync reconstructs STATE.md from surviving roadmap and artifact signals", async (t) => {
  const repoPath = await createRepoFromFixture("partial-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const syncResult = await blueprintStateSync({ cwd: repoPath });
  const syncedDocument = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");
  const loadedState = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(syncResult.statePath, ".blueprint/STATE.md");
  assert.ok(syncResult.syncedFields.includes("projectStatus"));
  assert.ok(syncResult.syncedFields.includes("currentPhase"));
  assert.ok(syncResult.syncedFields.includes("blockers"));
  assert.match(syncResult.warnings.join("\n"), /STATE\.md was missing/);
  assert.match(syncedDocument, /- Project status: partial/);
  assert.match(syncedDocument, /- Current phase: 2/);
  assert.match(syncedDocument, /- Active command: \/blu:health/);
  assert.match(loadedState.blockers.join("\n"), /Missing \.blueprint\/REQUIREMENTS\.md/);
});

test("initialized Blueprint repos report healthy read-path status and artifact coverage", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const status = await blueprintProjectStatus({ cwd: repoPath });
  const state = await blueprintStateLoad({ cwd: repoPath });
  const artifacts = await blueprintArtifactList({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(status.status, "initialized");
  assert.equal(status.initialized, true);
  assert.equal(status.currentPhase, "2");
  assert.equal(status.currentMilestone, "v2");
  assert.match(status.nextAction, /\/blu:ui-phase 2/);
  assert.equal(state.derivedStatus.projectStatus, "initialized");
  assert.equal(state.derivedStatus.currentPhase, "2");
  assert.equal(state.derivedStatus.hasBlockers, false);
  assert.match(state.derivedStatus.nextAction, /\/blu:ui-phase 2/);
  assert.ok(artifacts.artifacts.core.includes(".blueprint/STATE.md"));
  assert.equal(artifacts.artifacts.codebase.length, 7);
  assert.ok(artifacts.artifacts.codebase.includes(".blueprint/codebase/STRUCTURE.md"));
  assert.ok(artifacts.reports.includes(".blueprint/reports/health-report.md"));
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test("project status chooses the next implemented discovery command from current phase artifacts", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const phaseRoot = path.join(repoPath, ".blueprint/phases/02-router-health-and-mapping");
  const contextPath = path.join(phaseRoot, "02-CONTEXT.md");
  const researchPath = path.join(phaseRoot, "02-RESEARCH.md");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const uiStep = await blueprintProjectStatus({ cwd: repoPath });
  await rm(researchPath);
  const researchStep = await blueprintProjectStatus({ cwd: repoPath });
  await rm(contextPath);
  const discussStep = await blueprintProjectStatus({ cwd: repoPath });

  assert.match(uiStep.nextAction, /\/blu:ui-phase 2/);
  assert.match(researchStep.nextAction, /\/blu:research-phase 2/);
  assert.match(discussStep.nextAction, /\/blu:discuss-phase 2/);
});

test("project status prefers reconciled roadmap signals over stale STATE.md values", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const statePath = path.join(repoPath, ".blueprint/STATE.md");
  const roadmapPath = path.join(repoPath, ".blueprint/ROADMAP.md");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    statePath,
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 2
- Active command: /blu:progress
- Next action: Run /blu:progress to review Phase 2 and the next safe action
- Last updated: 2026-04-10T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );

  await writeFile(
    roadmapPath,
    `# Roadmap: initialized-repo

## Milestone

- Active milestone: v3

## Phases

- [x] Phase 1: Foundation bootstrap
- [ ] Phase 3: Discovery and definition
`,
    "utf8"
  );

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(status.status, "initialized");
  assert.equal(status.currentMilestone, "v3");
  assert.equal(status.currentPhase, "3");
  assert.match(status.nextAction, /\/blu:health/);
});

test("project status reports malformed config as a health warning instead of throwing", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const configPath = path.join(repoPath, ".blueprint/config.json");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(configPath, "{ invalid json", "utf8");

  const status = await blueprintProjectStatus({ cwd: repoPath });

  assert.equal(status.status, "initialized");
  assert.equal(status.initialized, true);
  assert.match(
    status.health.warnings.join("\n"),
    /Blueprint config could not be read:/
  );
});

test("state load clears stale structural blockers after the repo is healthy again", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const statePath = path.join(repoPath, ".blueprint/STATE.md");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    statePath,
    `# Blueprint State

- Project status: partial
- Current milestone: v2
- Current phase: 2
- Active command: /blu:health
- Next action: Run /blu:health to inspect blockers and repair options
- Last updated: 2026-04-10T00:00:00.000Z

## Blockers

- Missing .blueprint/REQUIREMENTS.md
`,
    "utf8"
  );

  const state = await blueprintStateLoad({ cwd: repoPath });

  assert.equal(state.derivedStatus.projectStatus, "initialized");
  assert.equal(state.derivedStatus.hasBlockers, false);
  assert.deepEqual(state.blockers, []);
  assert.match(state.derivedStatus.nextAction, /\/blu:ui-phase 2/);
});

test("artifact validation flags malformed legacy config and incomplete bundles with repair guidance", async (t) => {
  const repoPath = await createRepoFromFixture("legacy-config-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /Config warning: Migrated legacy config key commit_docs/);
  assert.match(validation.issues.join("\n"), /Config warning: Migrated legacy config key parallelization/);
  assert.match(validation.issues.join("\n"), /Config warning: Ignored disallowed config key: workflow\.use_workspaces/);
  assert.match(validation.issues.join("\n"), /Codebase artifact bundle is incomplete/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu:health --repair/);
});

test("artifact validation does not flag an in-progress discovery phase as structurally broken", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-discovery-validation-"));
  const repoPath = path.join(tempRoot, "repo");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Discovery Validation

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery**
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu:discuss-phase
- Next action: Run /blu:discuss-phase to finish discovery
- Last updated: 2026-04-11T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify({ version: 2 }, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    `# Phase 03 Context

## Decisions
- Discovery is still in progress.
`,
    "utf8"
  );

  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test("help progress and health command files reference registered MCP tool names", async () => {
  const commandFiles = [
    {
      file: "commands/blu/help.toml",
      tools: ["blueprint_command_catalog", "blueprint_project_status"]
    },
    {
      file: "commands/blu/progress.toml",
      tools: [
        "blueprint_project_status",
        "blueprint_config_get",
        "blueprint_state_load",
        "blueprint_artifact_list",
        "blueprint_command_catalog"
      ]
    },
    {
      file: "commands/blu/health.toml",
      tools: [
        "blueprint_project_status",
        "blueprint_config_get",
        "blueprint_config_set",
        "blueprint_state_load",
        "blueprint_artifact_list",
        "blueprint_artifact_validate",
        "blueprint_state_sync"
      ]
    }
  ];

  for (const command of commandFiles) {
    const raw = await readFile(path.join(repoRoot, command.file), "utf8");

    for (const toolName of command.tools) {
      assert.ok(
        blueprintToolNames.includes(toolName),
        `${toolName} should be registered in the MCP server`
      );
      assert.match(raw, new RegExp(toolName));
    }
  }

  const healthCommand = await readFile(path.join(repoRoot, "commands/blu/health.toml"), "utf8");
  assert.match(healthCommand, /--repair/);
  assert.match(healthCommand, /explicit confirmation-style response/i);
});

test("runtime-facing docs mention shipped command coverage instead of a docs-only runtime description", async () => {
  const geminiFile = await readFile(path.join(repoRoot, "GEMINI.md"), "utf8");
  const readmeFile = await readFile(path.join(repoRoot, "README.md"), "utf8");

  assert.match(geminiFile, /\/blu:settings/);
  assert.match(geminiFile, /\/blu:set-profile/);
  assert.match(geminiFile, /\/blu:help/);
  assert.match(geminiFile, /\/blu:progress/);
  assert.match(geminiFile, /\/blu:health/);
  assert.match(geminiFile, /\/blu:map-codebase/);
  assert.match(geminiFile, /\.planning\//);
  assert.match(readmeFile, /active implementation/i);
  assert.match(readmeFile, /## Current Runtime Layout/);
  assert.match(readmeFile, /commands\/blu\/help\.toml/);
  assert.match(readmeFile, /commands\/blu\/progress\.toml/);
  assert.match(readmeFile, /commands\/blu\/health\.toml/);
  assert.match(readmeFile, /commands\/blu\/map-codebase\.toml/);
  assert.match(readmeFile, /skills\/blueprint-router\.md/);
  assert.doesNotMatch(readmeFile, /## Planned Runtime Layout/);
});
