import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  loadOpenCodeAssetManifest,
  parseOpenCodeAssetManifest,
  validateManifestAsset
} from "../src/opencode/asset-manifest.js";

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const execFileAsync = promisify(execFile);

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

test("exact local tarball contains only the native package closure and loads its export", async (t) => {
  const repoRoot = process.cwd();
  try {
    await Promise.all([
      readFile(path.join(repoRoot, "generated", "opencode-assets.json")),
      readFile(path.join(repoRoot, "dist", "opencode", "plugin.js"))
    ]);
  } catch {
    assert.fail("Exact local tarball verification requires a fresh npm run build");
  }
  const temp = await mkdtemp(path.join(os.tmpdir(), "blueprint-opencode-pack-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const packed = await execFileAsync("npm", ["pack", repoRoot, "--ignore-scripts", "--json", "--pack-destination", temp], {
    cwd: temp,
    env: { ...process.env, npm_config_cache: path.join(temp, "npm-cache") }
  });
  const metadata = JSON.parse(packed.stdout) as Array<{ filename: string; files: Array<{ path: string }> }>;
  assert.equal(metadata.length, 1);
  const tarball = path.join(temp, metadata[0]!.filename);
  const names = metadata[0]!.files.map((entry) => entry.path);
  for (const forbidden of ["src/", "tests/", ".git/", ".blueprint/", "node_modules/", ".planning/"]) {
    assert.equal(names.some((name) => name.startsWith(forbidden)), false, `tarball must exclude ${forbidden}`);
  }
  for (const required of ["package.json", "dist/opencode/plugin.js", "dist/mcp/server.js", "generated/opencode-assets.json", "generated/command-catalog.json"]) {
    assert.equal(names.includes(required), true, `tarball must contain ${required}`);
  }
  await execFileAsync("tar", ["-xzf", tarball, "-C", temp]);
  const imported = await import(`${(await import("node:url")).pathToFileURL(path.join(temp, "package", "dist", "opencode", "plugin.js")).href}?test=${Date.now()}`);
  assert.equal(typeof imported.default, "function");
  const customerProject = path.join(temp, "customer-project");
  const explicitGlobalHome = path.join(temp, "explicit-global-home");
  await mkdir(customerProject, { recursive: true });
  const previousGlobalHome = process.env.BLUEPRINT_GLOBAL_HOME;
  process.env.BLUEPRINT_GLOBAL_HOME = explicitGlobalHome;
  try {
    const plugin = await (imported.default as (input: Record<string, unknown>) => Promise<Record<string, unknown>>)({
      directory: customerProject,
      worktree: customerProject,
      client: {},
      serverUrl: new URL("http://127.0.0.1")
    });
    const config: Record<string, any> = {};
    await (plugin.config as (value: Record<string, unknown>) => Promise<void>)(config);
    assert.equal(Object.keys(config.command).length, 56);
    assert.equal(Object.keys(config.agent).length, 16);
    assert.deepEqual(config.skills.paths, [path.join(temp, "package", "skills")]);
    assert.equal(config.mcp.blueprint.cwd, customerProject);
    assert.equal(config.mcp.blueprint.environment.BLUEPRINT_GLOBAL_HOME, explicitGlobalHome);
    assert.equal(config.mcp.blueprint.environment.BLUEPRINT_EXTENSION_PATH, path.join(temp, "package"));
  } finally {
    if (previousGlobalHome === undefined) delete process.env.BLUEPRINT_GLOBAL_HOME;
    else process.env.BLUEPRINT_GLOBAL_HOME = previousGlobalHome;
  }
});
