import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import os from "node:os";

import { blueprintProjectInit, blueprintProjectStatus } from "../src/mcp/tools/project.js";

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

async function createRepoFromFixture(fixtureName: string): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-new-project-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");

  const sourcePath = path.join(fixtureRoot, fixtureName);

  if (await pathExists(sourcePath)) {
    await cpFixtureContents(sourcePath, repoPath);
  }

  return repoPath;
}

async function cpFixtureContents(sourcePath: string, targetPath: string): Promise<void> {
  const { readdir, stat, copyFile, mkdir: makeDir } = await import("node:fs/promises");
  const entries = await readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntry = path.join(sourcePath, entry.name);
    const targetEntry = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await makeDir(targetEntry, { recursive: true });
      await cpFixtureContents(sourceEntry, targetEntry);
      continue;
    }

    const sourceStats = await stat(sourceEntry);
    await makeDir(path.dirname(targetEntry), { recursive: true });
    await copyFile(sourceEntry, targetEntry);
    await import("node:fs/promises").then(({ chmod }) =>
      chmod(targetEntry, sourceStats.mode)
    );
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

test("new-project initializes deterministic .blueprint artifacts", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintProjectInit({ cwd: repoPath });
  const config = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  for (const relativePath of [
    ".blueprint/PROJECT.md",
    ".blueprint/REQUIREMENTS.md",
    ".blueprint/ROADMAP.md",
    ".blueprint/STATE.md",
    ".blueprint/config.json",
    ".blueprint/phases"
  ]) {
    assert.equal(
      await pathExists(path.join(repoPath, relativePath)),
      true,
      `${relativePath} should exist`
    );
  }

  assert.deepEqual(result.createdPaths, [
    ".blueprint/PROJECT.md",
    ".blueprint/REQUIREMENTS.md",
    ".blueprint/ROADMAP.md",
    ".blueprint/phases/",
    ".blueprint/STATE.md",
    ".blueprint/config.json"
  ]);
  assert.equal(config.version, 2);
  assert.ok("workflow" in config);
  assert.ok("parallelization" in config);
  assert.ok("safety" in config);
  assert.ok("maintenance" in config);
  assert.equal("hooks" in config, false);
});

test("new-project fails from a nested directory with a precise repo-root error", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  const nestedPath = path.join(repoPath, "nested");
  await mkdir(nestedPath, { recursive: true });
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({ cwd: nestedPath }),
    /must run from the repository root/i
  );
});

test("new-project protects partial .blueprint trees from accidental overwrite", async (t) => {
  const repoPath = await createRepoFromFixture("partial-blueprint");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintProjectInit({ cwd: repoPath }),
    /already exist at \.blueprint/i
  );
});

test("new-project applies valid saved defaults and reports provenance", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  const defaultsPath = path.join(
    fixtureRoot,
    "saved-defaults/valid-defaults.json"
  );
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintProjectInit({
    cwd: repoPath,
    defaultsPath
  });
  const config = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.equal(result.configProvenance.defaultsApplied, true);
  assert.equal(result.configProvenance.defaultsPath, defaultsPath);
  assert.equal(config.mode, "auto");
  assert.equal(
    (config.parallelization as Record<string, unknown>).max_concurrent_agents,
    5
  );
});

test("new-project falls back to hardcoded defaults when saved defaults are malformed", async (t) => {
  const repoPath = await createRepoFromFixture("fresh-repo");
  const defaultsPath = path.join(
    fixtureRoot,
    "saved-defaults/malformed-defaults.json"
  );
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintProjectInit({
    cwd: repoPath,
    defaultsPath
  });
  const config = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.equal(result.configProvenance.defaultsApplied, false);
  assert.equal(config.mode, "interactive");
  assert.match(result.warnings.join("\n"), /falling back to hardcoded defaults/i);
});
