import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  loadOpenCodeAssetManifest,
  parseOpenCodeAssetManifest,
  validateManifestAsset
} from "../src/opencode/asset-manifest.js";

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");

function fixtureManifest(assetHash = hash("command")) {
  return {
    schemaVersion: 1,
    generatedBy: "scripts/generate-opencode-assets.ts",
    assets: {
      "agents/blueprint.md": hash("agent"),
      "commands/blu.md": assetHash,
      "skills/blueprint-router/SKILL.md": hash("skill")
    },
    commands: {
      blu: {
        path: "commands/blu.md",
        primarySkill: "blueprint-router",
        effectiveInputs: []
      }
    },
    agents: { blueprint: { path: "agents/blueprint.md" } },
    skillAliases: ["blueprint-router"],
    referenceClosure: ["skills/blueprint-router/SKILL.md"]
  };
}

test("OpenCode asset manifest rejects traversal and non-canonical ordering", () => {
  assert.throws(
    () => parseOpenCodeAssetManifest({ ...fixtureManifest(), referenceClosure: ["skills/z.md", "../escape.md"] }),
    /normalized package-relative path/
  );
  assert.throws(
    () => parseOpenCodeAssetManifest({ ...fixtureManifest(), skillAliases: ["z", "a"] }),
    /unique and sorted/
  );
});

test("OpenCode packaged assets are literal contained files with exact hashes", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-opencode-assets-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "commands"), { recursive: true });
  await mkdir(path.join(root, "generated"), { recursive: true });
  await writeFile(path.join(root, "commands", "blu.md"), "command");
  await writeFile(path.join(root, "generated", "opencode-assets.json"), `${JSON.stringify(fixtureManifest())}\n`);

  const manifest = await loadOpenCodeAssetManifest(root);
  assert.equal(await validateManifestAsset(root, "commands/blu.md", manifest.assets["commands/blu.md"]), await realpath(path.join(root, "commands", "blu.md")));
  await writeFile(path.join(root, "commands", "blu.md"), "corrupt");
  await assert.rejects(
    validateManifestAsset(root, "commands/blu.md", manifest.assets["commands/blu.md"]),
    /hash mismatch/
  );
});

test("package metadata exposes only the explicit native runtime allowlist", async () => {
  const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.exports["."], "./dist/opencode/plugin.js");
  assert.deepEqual(packageJson.files, [
    "agents",
    "commands",
    "dist",
    "generated/command-catalog.json",
    "generated/opencode-assets.json",
    "skills"
  ]);
  for (const forbidden of ["src", "tests", ".git", ".blueprint", "node_modules", ".planning"]) {
    assert.equal(packageJson.files.includes(forbidden), false);
  }
});
