import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  copyFile,
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

import { blueprintCodebaseArtifactWrite } from "../src/mcp/tools/artifacts.js";
import { blueprintLightweightPreflight } from "../src/mcp/tools/lightweight.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

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
  const repoPath = await createGitRepo("blueprint-lightweight-preflight-");
  const sourcePath = path.join(fixtureRoot, fixtureName);

  if (await pathExists(sourcePath)) {
    await copyFixtureContents(sourcePath, repoPath);
  }

  return repoPath;
}

async function writeMappedCodebaseBundle(repoPath: string): Promise<void> {
  const authoredBundle: Record<
    | "codebase.stack"
    | "codebase.architecture"
    | "codebase.structure"
    | "codebase.conventions"
    | "codebase.testing"
    | "codebase.integrations"
    | "codebase.concerns",
    string
  > = {
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

  for (const [artifactId, content] of Object.entries(authoredBundle)) {
    const result = await blueprintCodebaseArtifactWrite({
      cwd: repoPath,
      artifactId: artifactId as keyof typeof authoredBundle,
      content
    });

    assert.notEqual(result.status, "invalid", JSON.stringify(result));
  }
}

async function snapshotRepoTree(repoPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === ".git") {
        continue;
      }

      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(repoPath, absolutePath);

      if (entry.isDirectory()) {
        results.push(`${relativePath}/`);
        await walk(absolutePath);
        continue;
      }

      const [fileStat, content] = await Promise.all([
        stat(absolutePath),
        readFile(absolutePath, "utf8")
      ]);
      results.push(`${relativePath}:${fileStat.mtimeMs}:${content}`);
    }
  }

  await walk(repoPath);
  return results.sort();
}

test("initialized healthy fast tiny task routes to fast without a quick report gate", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "fast",
    taskText: "Fix typo in README heading"
  });

  assert.equal(result.mode, "fast");
  assert.equal(result.projectStatus.initialized, true);
  assert.equal(result.projectStatus.health, "healthy");
  assert.equal(result.classification.route, "fast");
  assert.equal(result.classification.confidence, "high");
  assert.deepEqual(result.classification.allowedWrites, [
    "repo files",
    ".blueprint/STATE.md through blueprint_state_update"
  ]);
  assert.equal(result.gates.healthGate, "pass");
  assert.equal(result.gates.overwriteGate, "none");
  assert.equal(result.gates.clarityGate, "pass");
  assert.equal(result.nextSafeAction, "/blu-fast");
  assert.equal(result.quickReport, undefined);
});

test("initialized healthy quick bounded task routes to quick", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "quick",
    taskText: "Rename BLUEPRINT_API_ENV references and update focused tests",
    flags: ["--validate"]
  });

  assert.equal(result.mode, "quick");
  assert.equal(result.projectStatus.health, "healthy");
  assert.equal(result.classification.route, "quick");
  assert.equal(result.classification.validationBudget, "cheap");
  assert.ok(result.classification.requiredGates.includes("cheap-validation"));
  assert.equal(result.gates.healthGate, "pass");
  assert.equal(result.gates.overwriteGate, "none");
  assert.equal(result.nextSafeAction, "/blu-quick");
  assert.deepEqual(result.quickReport, {
    name: "quick-run-latest",
    exists: false,
    path: ".blueprint/reports/quick-run-latest.md"
  });
  assert.equal(typeof result.effectiveConfig?.workflow?.subagents, "boolean");
});

test("quick with an existing quick-run report requires overwrite confirmation without --force", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const reportPath = path.join(repoPath, ".blueprint/reports/quick-run-latest.md");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, "# Quick Run Latest\n", "utf8");

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "quick",
    taskText: "Rename BLUEPRINT_API_ENV references and update focused tests",
    flags: ["--validate"]
  });

  assert.equal(result.quickReport?.exists, true);
  assert.equal(result.gates.overwriteGate, "requires-confirmation");
  assert.equal(result.nextSafeAction, "/blu-quick");
});

test("quick with --force bypasses the overwrite confirmation gate", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const reportPath = path.join(repoPath, ".blueprint/reports/quick-run-latest.md");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, "# Quick Run Latest\n", "utf8");

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "quick",
    taskText: "Rename BLUEPRINT_API_ENV references and update focused tests",
    flags: ["--validate", "--force"]
  });

  assert.equal(result.quickReport?.exists, true);
  assert.equal(result.gates.overwriteGate, "force-bypassed");
  assert.equal(result.nextSafeAction, "/blu-quick");
});

test("partial project routes through health before mutation", async (t) => {
  const repoPath = await createRepoFromFixture("partial-repo");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "quick",
    taskText: "Add the missing phase report summary"
  });

  assert.equal(result.projectStatus.initialized, false);
  assert.equal(result.projectStatus.health, "partial");
  assert.equal(result.gates.healthGate, "route-health");
  assert.equal(result.nextSafeAction, "/blu-health");
});

test("mapping-incomplete preflight routes to map-codebase instead of health", async (t) => {
  const repoPath = await createGitRepo("blueprint-lightweight-mapping-incomplete-");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await writeFile(
    path.join(repoPath, "package.json"),
    JSON.stringify({ name: "mapping-incomplete-preflight", private: true }, null, 2),
    "utf8"
  );
  await writeFile(path.join(repoPath, "src/index.ts"), "export const value = 1;\n", "utf8");
  await mkdir(path.join(repoPath, ".blueprint"), { recursive: true });

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "quick",
    taskText: "Add the missing phase report summary"
  });

  assert.equal(result.projectStatus.initialized, false);
  assert.equal(result.projectStatus.health, "mapping-incomplete");
  assert.equal(result.gates.healthGate, "route-map-codebase");
  assert.equal(result.classification.route, "map-codebase");
  assert.equal(result.nextSafeAction, "/blu-map-codebase");
  assert.ok(result.implementedRoutes.includes("/blu-map-codebase"));
  assert.doesNotMatch(result.nextSafeAction, /\/blu-health/);
});

test("mapped-only preflight routes to new-project instead of health", async (t) => {
  const repoPath = await createGitRepo("blueprint-lightweight-mapped-only-");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await writeFile(
    path.join(repoPath, "package.json"),
    JSON.stringify({ name: "mapped-only-preflight", private: true }, null, 2),
    "utf8"
  );
  await writeFile(path.join(repoPath, "src/index.ts"), "export const value = 1;\n", "utf8");
  await writeMappedCodebaseBundle(repoPath);

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "quick",
    taskText: "Add the initial project plan"
  });

  assert.equal(result.projectStatus.initialized, false);
  assert.equal(result.projectStatus.health, "mapped-only");
  assert.equal(result.gates.healthGate, "route-new-project");
  assert.equal(result.classification.route, "new-project");
  assert.equal(result.nextSafeAction, "/blu-new-project");
  assert.ok(result.implementedRoutes.includes("/blu-new-project"));
  assert.doesNotMatch(result.nextSafeAction, /\/blu-health/);
});

test("uninitialized quick routes to new-project", async (t) => {
  const repoPath = await createRepoFromFixture("uninitialized-repo");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "quick",
    taskText: "Create a quick fix for the first bootstrap issue"
  });

  assert.equal(result.projectStatus.initialized, false);
  assert.equal(result.projectStatus.health, "uninitialized");
  assert.equal(result.gates.healthGate, "route-new-project");
  assert.equal(result.nextSafeAction, "/blu-new-project");
});

test("uninitialized fast allows inline routing with a no-persistence warning", async (t) => {
  const repoPath = await createRepoFromFixture("uninitialized-repo");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "fast",
    taskText: "Fix typo in the install note"
  });

  assert.equal(result.projectStatus.initialized, false);
  assert.equal(result.projectStatus.health, "uninitialized");
  assert.equal(result.gates.healthGate, "pass");
  assert.equal(result.nextSafeAction, "/blu-fast");
  assert.deepEqual(result.classification.allowedWrites, ["repo files"]);
  assert.ok(result.classification.requiredGates.includes("no-blueprint-persistence"));
  assert.match(result.warnings.join("\n"), /must not persist Blueprint state/i);
});

test("initialized warning-only preflight keeps warnings visible without routing health", async (t) => {
  const repoPath = await createRepoFromFixture("legacy-config-repo");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "fast",
    taskText: "Fix typo in README heading"
  });

  assert.equal(result.projectStatus.initialized, true);
  assert.equal(result.projectStatus.health, "healthy");
  assert.equal(result.gates.healthGate, "pass");
  assert.equal(result.classification.route, "fast");
  assert.equal(result.nextSafeAction, "/blu-fast");
  assert.match(result.warnings.join("\n"), /Migrated legacy config key commit_docs/);
  assert.match(result.warnings.join("\n"), /workflow\.use_workspaces/);
  assert.match(result.warnings.join("\n"), /no valid execution summaries/);
});

test("initialized malformed config preflight still routes through health", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{ invalid json", "utf8");

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "fast",
    taskText: "Fix typo in README heading"
  });

  assert.equal(result.projectStatus.initialized, true);
  assert.equal(result.projectStatus.health, "unhealthy");
  assert.equal(result.gates.healthGate, "route-health");
  assert.equal(result.classification.route, "health");
  assert.equal(result.nextSafeAction, "/blu-health");
  assert.match(result.warnings.join("\n"), /Blueprint config could not be read/);
});

test("uninitialized fast reroutes non-trivial work directly to new-project", async (t) => {
  const repoPath = await createRepoFromFixture("uninitialized-repo");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "fast",
    taskText: "Rename env var and update focused tests"
  });

  assert.equal(result.projectStatus.health, "uninitialized");
  assert.equal(result.gates.healthGate, "route-new-project");
  assert.equal(result.classification.route, "new-project");
  assert.deepEqual(result.classification.allowedWrites, []);
  assert.equal(result.nextSafeAction, "/blu-new-project");
  assert.match(result.warnings.join("\n"), /must not persist Blueprint state/i);
});

test("implementedRoutes excludes planned commands", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "fast",
    taskText: "Fix typo in README heading"
  });

  assert.ok(result.implementedRoutes.includes("/blu-fast"));
  assert.ok(result.implementedRoutes.includes("/blu-quick"));
  assert.ok(!result.implementedRoutes.includes("/blu-do"));
});

test("preflight stays read-only and does not create Blueprint state or quick reports", async (t) => {
  const repoPath = await createGitRepo("blueprint-lightweight-preflight-readonly-");
  t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

  await writeFile(
    path.join(repoPath, "package.json"),
    JSON.stringify({ name: "readonly-preflight-repo", version: "1.0.0" }, null, 2),
    "utf8"
  );

  const before = await snapshotRepoTree(repoPath);
  const result = await blueprintLightweightPreflight({
    cwd: repoPath,
    mode: "quick",
    taskText: "Investigate the first task"
  });
  const after = await snapshotRepoTree(repoPath);

  assert.deepEqual(after, before);
  assert.equal(result.gates.healthGate, "route-new-project");
  assert.equal(await pathExists(path.join(repoPath, ".blueprint")), false);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/STATE.md")), false);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/reports/quick-run-latest.md")),
    false
  );
});
