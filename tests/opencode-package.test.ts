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
  const customerProject = path.join(temp, "customer-project");
  const explicitGlobalHome = path.join(temp, "explicit-global-home");
  const isolatedHome = path.join(temp, "home");
  const isolatedConfig = path.join(temp, "xdg-config");
  const isolatedData = path.join(temp, "xdg-data");
  const isolatedOpenCodeConfig = path.join(temp, "opencode-config");
  await Promise.all([
    mkdir(customerProject, { recursive: true }),
    mkdir(isolatedHome, { recursive: true }),
    mkdir(isolatedConfig, { recursive: true }),
    mkdir(isolatedData, { recursive: true }),
    mkdir(isolatedOpenCodeConfig, { recursive: true })
  ]);
  const pluginEntry = path.join(temp, "package", "dist", "opencode", "plugin.js");
  const probe = `
    import assert from "node:assert/strict";
    import path from "node:path";
    import { realpath } from "node:fs/promises";
    import pluginFactory from ${JSON.stringify((await import("node:url")).pathToFileURL(pluginEntry).href)};
    const customer = process.argv[1];
    const packageRoot = await realpath(process.argv[2]);
    const expectedGlobal = process.argv[3];
    const plugin = await pluginFactory({ directory: customer, worktree: customer, client: {}, serverUrl: new URL("http://127.0.0.1") });
    const config = {
      command: { foreign: { template: "foreign" } },
      agent: { foreign: { description: "foreign" } },
      mcp: { foreign: { type: "remote", url: "https://example.invalid" } }
    };
    await plugin.config(config);
    assert.equal(Object.keys(config.command).filter((name) => name.startsWith("blu")).length, 56);
    assert.equal(Object.keys(config.agent).filter((name) => name.startsWith("blueprint")).length, 16);
    assert.equal(config.command.foreign.template, "foreign");
    assert.equal(config.agent.foreign.description, "foreign");
    assert.equal(config.mcp.foreign.url, "https://example.invalid");
    assert.deepEqual(config.skills.paths, [path.join(packageRoot, "skills")]);
    assert.equal(config.mcp.blueprint.cwd, customer);
    assert.equal(config.mcp.blueprint.environment.BLUEPRINT_GLOBAL_HOME, expectedGlobal);
    assert.equal(config.mcp.blueprint.environment.BLUEPRINT_EXTENSION_PATH, packageRoot);
  `;
  await execFileAsync(process.execPath, ["--input-type=module", "-e", probe, customerProject, path.join(temp, "package"), explicitGlobalHome], {
    cwd: customerProject,
    env: {
      ...process.env,
      HOME: isolatedHome,
      XDG_CONFIG_HOME: isolatedConfig,
      XDG_DATA_HOME: isolatedData,
      OPENCODE_CONFIG_DIR: isolatedOpenCodeConfig,
      OPENCODE_DISABLE_PROJECT_CONFIG: "true",
      BLUEPRINT_GLOBAL_HOME: explicitGlobalHome
    }
  });
});
