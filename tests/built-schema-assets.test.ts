import test from "node:test";
import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);

async function assertGitTracksPath(relativePath: string): Promise<void> {
  try {
    await execFileAsync("git", ["ls-files", "--error-unmatch", relativePath], {
      cwd: repoRoot
    });
  } catch {
    assert.fail(
      `${relativePath} must be tracked because Git-installed Blueprint extension hosts launch the checked-in dist bundle directly.`
    );
  }
}

async function assertTrackedDistIsCommittedCleanly(): Promise<void> {
  const status = await execFileAsync(
    "git",
    ["status", "--short", "--untracked-files=no", "--", "dist"],
    {
      cwd: repoRoot
    }
  );
  const dirtyEntries = status.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  assert.deepEqual(
    dirtyEntries,
    [],
    [
      "Tracked dist outputs changed after build and must be committed cleanly.",
      "Git-installed Blueprint extension hosts launch the checked-in dist bundle directly.",
      "Dirty dist entries:",
      ...dirtyEntries
    ].join("\n")
  );
}

test("tracked dist schema inventory mirrors source artifact-contract schemas", async () => {
  const sourceSchemaDir = path.join(repoRoot, "src", "mcp", "artifact-contracts", "schemas");
  const distSchemaDir = path.join(repoRoot, "dist", "mcp", "artifact-contracts", "schemas");
  const sourceSchemaFiles = (await readdir(sourceSchemaDir))
    .filter((entry) => entry.endsWith(".json"))
    .sort();

  assert.ok(sourceSchemaFiles.length > 0, "source artifact-contract schemas should exist");
  assert.ok(
    sourceSchemaFiles.includes("bootstrap.roadmap.model.schema.json"),
    "bootstrap.roadmap must expose a source model schema so roadmap authoring can be validated against the same contract as other structured artifacts."
  );

  for (const schemaFile of sourceSchemaFiles) {
    const distRelativePath = path.join(
      "dist",
      "mcp",
      "artifact-contracts",
      "schemas",
      schemaFile
    );

    await access(path.join(distSchemaDir, schemaFile)).catch(() => {
      assert.fail(
        `${distRelativePath} is missing even though src/mcp/artifact-contracts/schemas/${schemaFile} exists and Git-installed hosts depend on the checked-in dist bundle.`
      );
    });
    await assertGitTracksPath(distRelativePath);
  }
});

test("tracked dist outputs stay committed after build refreshes generated assets", async () => {
  await assertTrackedDistIsCommittedCleanly();
});
