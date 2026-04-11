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
  CODEBASE_ARTIFACTS,
  blueprintArtifactList,
  blueprintArtifactScaffold,
  blueprintArtifactSummaryDigest,
  blueprintArtifactValidate
} from "../src/mcp/tools/artifacts.js";
import { blueprintProjectInit } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "tests/fixtures/map-codebase");

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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-map-codebase-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await copyFixtureContents(path.join(fixtureRoot, fixtureName), repoPath);

  return repoPath;
}

async function listRelativeFiles(rootPath: string, projectRoot: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(absolutePath, projectRoot)));
      continue;
    }

    files.push(path.relative(projectRoot, absolutePath).split(path.sep).join("/"));
  }

  return files.sort();
}

async function collectRepoEvidence(repoPath: string): Promise<{
  sourceFiles: string[];
  testFiles: string[];
  docFiles: string[];
  trackedFiles: string[];
}> {
  const sourceFiles = await listRelativeFiles(path.join(repoPath, "src"), repoPath);
  const testFiles = await listRelativeFiles(path.join(repoPath, "tests"), repoPath);
  const docFiles = await listRelativeFiles(path.join(repoPath, "docs"), repoPath);
  const trackedFiles = await listRelativeFiles(repoPath, repoPath);

  return {
    sourceFiles,
    testFiles,
    docFiles,
    trackedFiles: trackedFiles.filter((file) => !file.startsWith(".blueprint/"))
  };
}

test("map-codebase scaffolds the stable codebase bundle and builds deterministic digests", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });
  const scaffold = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });
  const artifacts = await blueprintArtifactList({ cwd: repoPath });
  const evidence = await collectRepoEvidence(repoPath);
  const digest = await blueprintArtifactSummaryDigest({
    cwd: repoPath,
    focusArea: "mcp",
    packageJsonPath: "package.json",
    readmePath: "README.md",
    sourceFiles: evidence.sourceFiles,
    testFiles: evidence.testFiles,
    docFiles: evidence.docFiles,
    trackedFiles: evidence.trackedFiles
  });

  assert.deepEqual(scaffold.createdFiles, [...CODEBASE_ARTIFACTS]);

  for (const artifact of CODEBASE_ARTIFACTS) {
    assert.equal(
      await pathExists(path.join(repoPath, artifact)),
      true,
      `${artifact} should exist`
    );
  }

  assert.deepEqual(artifacts.artifacts.codebase, [...CODEBASE_ARTIFACTS]);
  assert.equal(digest.digest.length, CODEBASE_ARTIFACTS.length);
  assert.deepEqual(
    digest.digest.map((section) => section.artifact),
    [...CODEBASE_ARTIFACTS]
  );
  assert.ok(digest.inputsUsed.includes("package.json"));
  assert.ok(digest.inputsUsed.includes("README.md"));
  assert.ok(digest.inputsUsed.includes("docs/architecture.md"));

  const summaries = digest.digest.map((section) => section.summary).join("\n");
  assert.match(summaries, /TypeScript/);
  assert.match(summaries, /node:test/);
  assert.match(summaries, /docs\//);
  assert.match(summaries, /@octokit\/rest|src\/integrations\/github\.ts/);
});

test("map-codebase reuses edited codebase docs by default and warns before replace", async (t) => {
  const repoPath = await createRepoFromFixture("brownfield-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintProjectInit({ cwd: repoPath });
  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });

  const stackPath = path.join(repoPath, ".blueprint/codebase/STACK.md");
  await writeFile(stackPath, "# Stack\n\nHand-edited notes.\n", "utf8");

  const reuseResult = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS]
  });
  const reusedStack = await readFile(stackPath, "utf8");
  const listedArtifacts = await blueprintArtifactList({ cwd: repoPath });
  const validation = await blueprintArtifactValidate({ cwd: repoPath });
  const replaceResult = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [...CODEBASE_ARTIFACTS],
    overwrite: true
  });
  const replacedStack = await readFile(stackPath, "utf8");

  assert.equal(reusedStack, "# Stack\n\nHand-edited notes.\n");
  assert.ok(reuseResult.reusedFiles.includes(".blueprint/codebase/STACK.md"));
  assert.match(reuseResult.warnings.join("\n"), /Preserved existing codebase artifact/);
  assert.match(listedArtifacts.warnings.join("\n"), /reused unless replace is explicitly confirmed/i);
  assert.match(validation.warnings.join("\n"), /reused unless replace is explicitly confirmed/i);
  assert.match(replaceResult.warnings.join("\n"), /Replaced existing codebase artifact/);
  assert.notEqual(replacedStack, "# Stack\n\nHand-edited notes.\n");
  assert.match(replacedStack, /Generated by `\/blu:map-codebase`/);
});

test("map-codebase command file references the registered mapping tool names", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu/map-codebase.toml"),
    "utf8"
  );
  const requiredTools = [
    "blueprint_project_status",
    "blueprint_artifact_scaffold",
    "blueprint_artifact_list",
    "blueprint_artifact_summary_digest"
  ];

  for (const toolName of requiredTools) {
    assert.ok(
      blueprintToolNames.includes(toolName),
      `${toolName} should be registered in the MCP server`
    );
    assert.match(commandFile, new RegExp(toolName));
  }

  assert.match(commandFile, /STACK\.md/);
  assert.match(commandFile, /ARCHITECTURE\.md/);
  assert.match(commandFile, /STRUCTURE\.md/);
  assert.match(commandFile, /CONCERNS\.md/);
  assert.match(commandFile, /heavily edited/i);
  assert.match(commandFile, /replace/);
});
