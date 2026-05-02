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

test("tracked dist schema inventory mirrors source artifact-contract schemas", async () => {
  const sourceSchemaDir = path.join(repoRoot, "src", "mcp", "artifact-contracts", "schemas");
  const distSchemaDir = path.join(repoRoot, "dist", "mcp", "artifact-contracts", "schemas");
  const sourceSchemaFiles = (await readdir(sourceSchemaDir))
    .filter((entry) => entry.endsWith(".json"))
    .sort();

  assert.ok(sourceSchemaFiles.length > 0, "source artifact-contract schemas should exist");

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
