import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import { withBuiltAssetLock } from "./helpers/built-assets.ts";

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

async function listDirtyDistEntries(): Promise<string[]> {
  const status = await execFileAsync(
    "git",
    ["status", "--short", "--untracked-files=no", "--", "dist"],
    {
      cwd: repoRoot
    }
  );

  return status.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

type DistDiffSnapshot = {
  hash: string;
  byteLength: number;
  stat: string;
};

async function readTrackedDistDiffSnapshot(): Promise<DistDiffSnapshot> {
  const stat = await execFileAsync("git", ["diff", "--stat", "--no-ext-diff", "--", "dist"], {
    cwd: repoRoot
  });

  const summary = stat.stdout.trimEnd();

  return await new Promise((resolve, reject) => {
    const child = spawn("git", ["diff", "--no-ext-diff", "--", "dist"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const hash = createHash("sha256");
    let byteLength = 0;
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      hash.update(chunk);
      byteLength += chunk.length;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `git diff --no-ext-diff -- dist exited with code ${code}: ${stderr.trim()}`
          )
        );
        return;
      }

      resolve({
        hash: hash.digest("hex"),
        byteLength,
        stat: summary
      });
    });
  });
}

function formatDiffStatPreview(stat: string): string {
  if (stat.length === 0) {
    return "(clean)";
  }

  const lines = stat.split("\n");

  if (lines.length <= 80) {
    return stat;
  }

  return [...lines.slice(0, 80), `... (${lines.length - 80} more lines)`].join("\n");
}

test("tracked dist schema inventory mirrors source artifact-contract schemas", async () => {
  await withBuiltAssetLock(async () => {
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
});

test("tracked dist outputs stay committed after build refreshes generated assets", async () => {
  await withBuiltAssetLock(async () => {
    const beforeBuild = await listDirtyDistEntries();
    const beforeBuildDiff = await readTrackedDistDiffSnapshot();

    await execFileAsync("npm", ["run", "build"], {
      cwd: repoRoot
    });

    const afterBuild = await listDirtyDistEntries();
    const afterBuildDiff = await readTrackedDistDiffSnapshot();

    assert.deepEqual(
      afterBuild,
      beforeBuild,
      [
        "Running `npm run build` must not introduce additional tracked dist drift.",
        "Refresh dist before committing any source changes that affect the checked-in bundle.",
        "Dirty dist entries before build:",
        ...beforeBuild,
        "Dirty dist entries after build:",
        ...afterBuild
      ].join("\n")
    );

    assert.equal(
      afterBuildDiff.hash,
      beforeBuildDiff.hash,
      [
        "Running `npm run build` must not change tracked dist diff content, even when dist is already dirty before the build starts.",
        "This keeps generated-asset drift detectable in already-dirty worktrees instead of only comparing path names.",
        "Dirty dist entries before build:",
        ...(beforeBuild.length > 0 ? beforeBuild : ["(none)"]),
        `Tracked dist diff fingerprint before build: ${beforeBuildDiff.hash} (${beforeBuildDiff.byteLength} bytes)`,
        formatDiffStatPreview(beforeBuildDiff.stat),
        `Tracked dist diff fingerprint after build: ${afterBuildDiff.hash} (${afterBuildDiff.byteLength} bytes)`,
        formatDiffStatPreview(afterBuildDiff.stat)
      ].join("\n")
    );
  });
});
