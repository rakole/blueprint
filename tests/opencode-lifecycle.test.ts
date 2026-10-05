import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, cp, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";

import {
  BLUEPRINT_STATE_COMPATIBILITY,
  runOpenCodeLifecycle,
  type LifecycleStep,
  type OpenCodeLifecycleDependencies,
  type OpenCodeLifecycleResult
} from "../src/opencode/lifecycle.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");
const pinnedOpenCodeVersion = "1.18.34";
const pinnedDarwinArm64Sha256 = "7b63b34fafabded7d9231f6a9032755d0cdeaf8b9d2b70df8e25535471469eea";

type Fixture = {
  configPath: string;
  customerCwd: string;
  env: NodeJS.ProcessEnv;
  originalConfig: string;
  root: string;
};

type PackageOverrides = {
  compatibility?: string;
  exports?: Record<string, string>;
  name?: string;
  pluginBody?: string;
};

function isolatedEnvironment(root: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^(?:BLUEPRINT_|OPENCODE_)/.test(key)
      || /^(?:ANTHROPIC|AZURE_OPENAI|GEMINI|GOOGLE_API|OPENAI|OPENROUTER|AWS_(?:ACCESS|PROFILE|SECRET|SESSION))/.test(key)
      || /(?:_API_KEY|_CREDENTIALS|_SECRET|_TOKEN)$/.test(key)
    ) {
      delete env[key];
    }
  }
  const isolated: NodeJS.ProcessEnv = {
    ...env,
    HOME: path.join(root, "home"),
    XDG_CONFIG_HOME: path.join(root, "xdg", "config"),
    XDG_DATA_HOME: path.join(root, "xdg", "data"),
    XDG_CACHE_HOME: path.join(root, "xdg", "cache"),
    XDG_STATE_HOME: path.join(root, "xdg", "state"),
    BLUEPRINT_GLOBAL_HOME: path.join(root, "blueprint-global"),
    npm_config_cache: path.join(root, "npm-cache")
  };
  isolated.npm_config_offline = "true";
  return isolated;
}

function npmCacheSeedPath(): string {
  const explicit = process.env.BLUEPRINT_NPM_CACHE_SEED;
  if (explicit) return path.resolve(explicit);
  const configuredCache = process.env.npm_config_cache?.trim();
  return path.join(configuredCache ? path.resolve(configuredCache) : path.join(os.homedir(), ".npm"), "_cacache");
}

async function seedIsolatedNpmCache(root: string): Promise<void> {
  const seed = npmCacheSeedPath();
  if (!(await exists(seed))) {
    throw new Error(
      `Packed lifecycle verification requires a populated read-only npm cache seed at ${seed}; run npm ci or set BLUEPRINT_NPM_CACHE_SEED`
    );
  }
  const destination = path.join(root, "npm-cache", "_cacache");
  if (await exists(destination)) return;
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(seed, destination, { recursive: true });
}

async function exists(candidate: string): Promise<boolean> {
  return access(candidate).then(
    () => true,
    () => false
  );
}

function isContainedFixturePath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function createFixture(t: TestContext, config = [
  "{",
  '  "theme": "system",',
  '  "provider": { "plugin": ["nested-provider-plugin"], "options": { "keep": true } },',
  '  "plu\\u0067in": [',
  '    "foreign-plugin@1.2.3"',
  "  ],",
  '  "mcp": { "foreign": { "type": "remote", "url": "https://example.invalid" } }',
  "}",
  ""
].join("\n")): Promise<Fixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-opencode-lifecycle-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const customerCwd = path.join(root, "customer-project");
  const configDir = path.join(root, "config");
  const configPath = path.join(configDir, "opencode.json");
  const home = path.join(root, "home");
  const xdg = path.join(root, "xdg");
  await Promise.all([
    mkdir(customerCwd, { recursive: true }),
    mkdir(configDir, { recursive: true }),
    mkdir(home, { recursive: true }),
    mkdir(xdg, { recursive: true })
  ]);
  await writeFile(configPath, config);
  return {
    configPath,
    customerCwd,
    originalConfig: config,
    root,
    env: isolatedEnvironment(root)
  };
}

async function writeFixturePackage(
  packageRoot: string,
  version: string,
  overrides: PackageOverrides = {}
): Promise<void> {
  await mkdir(path.join(packageRoot, "dist", "opencode"), { recursive: true });
  const pluginBody = overrides.pluginBody ?? `export const fixtureVersion = ${JSON.stringify(version)}; export default async () => ({});\n`;
  await writeFile(path.join(packageRoot, "dist", "opencode", "plugin.js"), pluginBody);
  await writeFile(path.join(packageRoot, "package.json"), `${JSON.stringify({
    name: overrides.name ?? "blueprint",
    version,
    type: "module",
    exports: overrides.exports ?? {
      ".": "./dist/opencode/plugin.js",
      "./server": "./dist/opencode/plugin.js"
    },
    bin: { "blueprint-opencode": "./dist/opencode/lifecycle-cli.js" },
    blueprint: {
      stateCompatibility: overrides.compatibility ?? BLUEPRINT_STATE_COMPATIBILITY
    }
  }, null, 2)}\n`);
}

function fixtureInstaller(
  versions: Record<string, { version: string; overrides?: PackageOverrides }>
): NonNullable<OpenCodeLifecycleDependencies["packageInstaller"]> {
  return async ({ packageSpec, stagingPrefix }) => {
    const selected = versions[packageSpec];
    assert.ok(selected, `unexpected package spec ${packageSpec}`);
    const packageRoot = path.join(stagingPrefix, "node_modules", "blueprint");
    await writeFixturePackage(packageRoot, selected.version, selected.overrides);
    return { packageRoot };
  };
}

function deps(
  packageInstaller: NonNullable<OpenCodeLifecycleDependencies["packageInstaller"]>,
  extra: Partial<OpenCodeLifecycleDependencies> = {}
): OpenCodeLifecycleDependencies {
  let sequence = 0;
  return {
    allowRegistryPackageSpec: true,
    packageInstaller,
    now: () => new Date("2026-10-05T00:00:00.000Z"),
    randomId: () => `fixture-${++sequence}`,
    ...extra
  };
}

async function install(
  fixture: Fixture,
  packageSpec: string,
  dependencies: OpenCodeLifecycleDependencies
): Promise<OpenCodeLifecycleResult> {
  return runOpenCodeLifecycle({
    action: "install",
    configPath: fixture.configPath,
    cwd: fixture.customerCwd,
    packageSpec
  }, { ...dependencies, env: fixture.env });
}

async function status(
  fixture: Fixture,
  dependencies: OpenCodeLifecycleDependencies = {}
): Promise<OpenCodeLifecycleResult> {
  return runOpenCodeLifecycle({ action: "status", configPath: fixture.configPath }, {
    ...dependencies,
    env: fixture.env
  });
}

function assertOwnedRegistration(configText: string, registration: string): void {
  const config = JSON.parse(configText) as { plugin: string[]; theme: string; mcp: unknown };
  assert.equal(config.theme, "system");
  assert.equal(config.plugin[0], "foreign-plugin@1.2.3");
  assert.equal(config.plugin.filter((entry) => entry === registration).length, 1);
  assert.deepEqual(config.mcp, {
    foreign: { type: "remote", url: "https://example.invalid" }
  });
  assert.match(configText, /  "mcp": \{ "foreign": \{ "type": "remote", "url": "https:\/\/example\.invalid" \} \}/);
}

test("install is repeatable and upgrade, rollback, and uninstall preserve the customer's config", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller({
    "blueprint@1.0.0": { version: "1.0.0" },
    "blueprint@2.0.0": { version: "2.0.0" }
  });
  const dependencies = deps(packageInstaller);

  const first = await install(fixture, "blueprint@1.0.0", dependencies);
  assert.equal(first.active?.version, "1.0.0");
  assert.equal(first.previous, null);
  assert.equal(await realpath(first.active!.packageRoot), first.active!.packageRoot);
  assertOwnedRegistration(await readFile(fixture.configPath, "utf8"), first.registration!);

  const repeat = await install(fixture, "blueprint@1.0.0", dependencies);
  assert.equal(repeat.active?.generationId, first.active?.generationId);
  assert.equal(repeat.registration, first.registration);
  assertOwnedRegistration(await readFile(fixture.configPath, "utf8"), first.registration!);

  const postInstallConfig = [
    "{",
    '  "theme": "dark",',
    '  "provider": { "plugin": ["nested-provider-plugin", "added-after-install"], "options": { "keep": true } },',
    '  "plu\\u0067in": [',
    '    "foreign-plugin@1.2.3",',
    `    ${JSON.stringify(first.registration)},`,
    '    "customer-added-after-install"',
    "  ],",
    '  "mcp": { "foreign": { "type": "remote", "url": "https://example.invalid" } },',
    '  "future-provider-setting": { "preserve": "byte-for-byte" }',
    "}",
    ""
  ].join("\n");
  await writeFile(fixture.configPath, postInstallConfig);

  const upgraded = await runOpenCodeLifecycle({
    action: "upgrade",
    configPath: fixture.configPath,
    cwd: fixture.customerCwd,
    packageSpec: "blueprint@2.0.0"
  }, { ...dependencies, env: fixture.env });
  assert.equal(upgraded.active?.version, "2.0.0");
  assert.equal(upgraded.previous?.generationId, first.active?.generationId);
  assert.notEqual(upgraded.active?.packageRoot, first.active?.packageRoot);
  assert.equal(await readFile(fixture.configPath, "utf8"), postInstallConfig);
  const retainedPackage = JSON.parse(await readFile(path.join(first.active!.packageRoot, "package.json"), "utf8"));
  assert.equal(retainedPackage.version, "1.0.0");

  const rolledBack = await runOpenCodeLifecycle({
    action: "rollback",
    configPath: fixture.configPath
  }, { ...dependencies, env: fixture.env });
  assert.equal(rolledBack.active?.generationId, first.active?.generationId);
  assert.equal(rolledBack.previous?.generationId, upgraded.active?.generationId);
  assert.equal(await readFile(fixture.configPath, "utf8"), postInstallConfig);

  const uninstalled = await runOpenCodeLifecycle({
    action: "uninstall",
    configPath: fixture.configPath
  }, { ...dependencies, env: fixture.env });
  assert.equal(uninstalled.active, null);
  assert.equal(uninstalled.previous, null);
  assert.equal(await readFile(fixture.configPath, "utf8"), postInstallConfig.replace(
    `    ${JSON.stringify(first.registration)},\n`,
    ""
  ));
});

test("three upgrades retain only the rollback generation and remain uninstallable after rollback then upgrade", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller(Object.fromEntries(
    ["1.0.0", "2.0.0", "3.0.0", "4.0.0"].map((version) => [
      `blueprint@${version}`,
      { version }
    ])
  ));
  const dependencies = deps(packageInstaller);
  const v1 = await install(fixture, "blueprint@1.0.0", dependencies);
  const upgrade = (version: string) => runOpenCodeLifecycle({
    action: "upgrade",
    configPath: fixture.configPath,
    cwd: fixture.customerCwd,
    packageSpec: `blueprint@${version}`
  }, { ...dependencies, env: fixture.env });
  const v2 = await upgrade("2.0.0");
  const v3 = await upgrade("3.0.0");
  assert.equal(v3.active?.version, "3.0.0");
  assert.equal(v3.previous?.version, "2.0.0");
  assert.equal(await exists(v1.active!.packageRoot), false, "superseded v1 generation must be removed");

  const rolledBack = await runOpenCodeLifecycle({ action: "rollback", configPath: fixture.configPath }, {
    ...dependencies,
    env: fixture.env
  });
  assert.equal(rolledBack.active?.version, "2.0.0");
  assert.equal(rolledBack.previous?.version, "3.0.0");
  const v4 = await upgrade("4.0.0");
  assert.equal(v4.active?.version, "4.0.0");
  assert.equal(v4.previous?.version, "2.0.0");
  assert.equal(await exists(v3.active!.packageRoot), false, "rolled-back v3 generation must be removed when v4 activates");
  const removed = await runOpenCodeLifecycle({ action: "uninstall", configPath: fixture.configPath }, {
    ...dependencies,
    env: fixture.env
  });
  assert.equal(removed.active, null);
});

test("semantic version precedence upgrades beta.2 to beta.10 and then to the stable release", async (t) => {
  const fixture = await createFixture(t);
  const versions = ["1.0.0-beta.2", "1.0.0-beta.10", "1.0.0"];
  const packageInstaller = fixtureInstaller(Object.fromEntries(
    versions.map((version) => [`blueprint@${version}`, { version }])
  ));
  const dependencies = deps(packageInstaller);
  await install(fixture, "blueprint@1.0.0-beta.2", dependencies);
  for (const version of versions.slice(1)) {
    const upgraded = await runOpenCodeLifecycle({
      action: "upgrade",
      configPath: fixture.configPath,
      cwd: fixture.customerCwd,
      packageSpec: `blueprint@${version}`
    }, { ...dependencies, env: fixture.env });
    assert.equal(upgraded.active?.version, version);
  }
});

test("config conflicts fail closed without touching customer bytes or creating an install root", async (t) => {
  const cases = [
    ['{"plugin": [], "plugin": []}\n', /duplicate|plugin/i],
    ['{"plugin": ["blueprint@1.0.0"]}\n', /foreign|Blueprint|plugin/i],
    ['{"plugin": [], "mcp": {"blueprint": {}}}\n', /mcp\.blueprint|namespace/i],
    ['{"plugin": [], "command": {"blu-help": {}}}\n', /command\.blu-help|namespace/i],
    ['{"plugin": [], "agent": {"blueprint-reviewer": {}}}\n', /agent\.blueprint-reviewer|namespace/i]
  ] as const;
  for (const [config, expected] of cases) {
    await t.test(expected.source, async (t) => {
      const fixture = await createFixture(t, config);
      const dependencies = deps(fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } }));
      await assert.rejects(install(fixture, "blueprint@1.0.0", dependencies), expected);
      assert.equal(await readFile(fixture.configPath, "utf8"), config);
      assert.equal(await exists(path.join(path.dirname(fixture.configPath), ".blueprint-install")), false);
    });
  }
});

test("a clean install owns creation and later removal of an initially absent config", async (t) => {
  const fixture = await createFixture(t);
  await rm(fixture.configPath);
  const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
  const dependencies = deps(packageInstaller);
  const installed = await install(fixture, "blueprint@1.0.0", dependencies);
  const createdConfig = JSON.parse(await readFile(fixture.configPath, "utf8")) as { plugin: string[] };
  assert.deepEqual(createdConfig.plugin, [installed.registration]);
  await runOpenCodeLifecycle({ action: "uninstall", configPath: fixture.configPath }, {
    ...dependencies,
    env: fixture.env
  });
  assert.equal(await exists(fixture.configPath), false);
});

test("status refuses missing or duplicate owned registrations without repairing customer config", async (t) => {
  for (const drift of ["missing", "duplicate"] as const) {
    await t.test(drift, async (t) => {
      const fixture = await createFixture(t);
      const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
      const dependencies = deps(packageInstaller);
      const installed = await install(fixture, "blueprint@1.0.0", dependencies);
      const config = JSON.parse(await readFile(fixture.configPath, "utf8")) as { plugin: string[] };
      config.plugin = drift === "missing"
        ? config.plugin.filter((entry) => entry !== installed.registration)
        : [...config.plugin, installed.registration!];
      const drifted = `${JSON.stringify(config, null, 2)}\n`;
      await writeFile(fixture.configPath, drifted);
      await assert.rejects(status(fixture, dependencies), /owned|registration|duplicat|missing|changed/i);
      assert.equal(await readFile(fixture.configPath, "utf8"), drifted);
    });
  }
});

test("later actions refuse a supplied cwd that differs from the installed customer repository", async (t) => {
  const fixture = await createFixture(t);
  const otherCwd = path.join(fixture.root, "other-customer");
  await mkdir(otherCwd);
  const packageInstaller = fixtureInstaller({
    "blueprint@1.0.0": { version: "1.0.0" },
    "blueprint@2.0.0": { version: "2.0.0" }
  });
  const dependencies = deps(packageInstaller);
  const installed = await install(fixture, "blueprint@1.0.0", dependencies);
  const configBefore = await readFile(fixture.configPath, "utf8");
  await assert.rejects(runOpenCodeLifecycle({
    action: "status",
    configPath: fixture.configPath,
    cwd: otherCwd
  }, { ...dependencies, env: fixture.env }), /cwd|customer|repository|different|match/i);

  let installerCalled = false;
  await assert.rejects(runOpenCodeLifecycle({
    action: "upgrade",
    configPath: fixture.configPath,
    cwd: otherCwd,
    packageSpec: "blueprint@2.0.0"
  }, {
    ...dependencies,
    env: fixture.env,
    packageInstaller: async (input) => {
      installerCalled = true;
      return packageInstaller(input);
    }
  }), /cwd|customer|repository|different|match/i);
  assert.equal(installerCalled, false);
  assert.equal(await readFile(fixture.configPath, "utf8"), configBefore);
  assert.equal((await status(fixture, dependencies)).active?.generationId, installed.active?.generationId);
});

test("package identity, exact versions, compatibility, exports, and literal paths are enforced before activation", async (t) => {
  const fixture = await createFixture(t);
  for (const [overrides, expected] of [
    [{ name: "not-blueprint" }, /name|blueprint/i],
    [{}, /version|requested|spec/i],
    [{ compatibility: "unknown-contract" }, /compatib/i],
    [{ exports: { ".": "./dist/opencode/plugin.js" } }, /\.\/server|export/i]
  ] as const) {
    const packageInstaller = fixtureInstaller({
      "blueprint@1.0.0": {
        version: Object.keys(overrides).length === 0 ? "2.0.0" : "1.0.0",
        overrides
      }
    });
    await assert.rejects(install(fixture, "blueprint@1.0.0", deps(packageInstaller)), expected);
    assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);
  }
  await assert.rejects(
    install(fixture, "blueprint@^1.0.0", deps(async () => assert.fail("range must fail before package installation"))),
    /exact|version|package/i
  );
  let publicInstallerCalled = false;
  await assert.rejects(runOpenCodeLifecycle({
    action: "install",
    configPath: fixture.configPath,
    cwd: fixture.customerCwd,
    packageSpec: "blueprint@1.0.0"
  }, {
    env: fixture.env,
    packageInstaller: async () => {
      publicInstallerCalled = true;
      throw new Error("must not install a private registry package");
    }
  }), /private|registry|publication|disabled|tarball/i);
  assert.equal(publicInstallerCalled, false, "registry refusal must happen before npm or the injected installer");

  const symlinkDependencies = deps(async ({ stagingPrefix }) => {
    const outside = path.join(fixture.root, "outside-package");
    await writeFixturePackage(outside, "1.0.0");
    const packageRoot = path.join(stagingPrefix, "node_modules", "blueprint");
    await mkdir(path.dirname(packageRoot), { recursive: true });
    await symlink(outside, packageRoot, "dir");
    return { packageRoot };
  });
  await assert.rejects(install(fixture, "blueprint@1.0.0", symlinkDependencies), /symbolic|symlink|literal|contain/i);
});

test("a pre-journal inventory failure removes its staging generation and permits a clean retry", async (t) => {
  const fixture = await createFixture(t);
  let injectUnexpectedSymlink = true;
  const packageInstaller: NonNullable<OpenCodeLifecycleDependencies["packageInstaller"]> = async ({ stagingPrefix }) => {
    const packageRoot = path.join(stagingPrefix, "node_modules", "blueprint");
    await writeFixturePackage(packageRoot, "1.0.0");
    if (injectUnexpectedSymlink) {
      await symlink(
        path.join(packageRoot, "dist", "opencode", "plugin.js"),
        path.join(packageRoot, "unexpected-link.js")
      );
    }
    return { packageRoot };
  };
  const dependencies = deps(packageInstaller);
  await assert.rejects(
    install(fixture, "blueprint@1.0.0", dependencies),
    /symbolic|symlink|inventory|unsupported/i
  );
  injectUnexpectedSymlink = false;
  const installed = await install(fixture, "blueprint@1.0.0", dependencies);
  assert.equal(installed.active?.version, "1.0.0");
  const generations = await readdir(path.join(path.dirname(fixture.configPath), ".blueprint-install", "generations"));
  assert.deepEqual(generations, [installed.active!.generationId]);
});

test("a journal-creation failure removes staging and permits a clean retry", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
  let failJournalCreation = true;
  const dependencies = deps(packageInstaller, {
    onStep: (step) => {
      if (step === "beforeJournalWrite" && failJournalCreation) {
        failJournalCreation = false;
        throw new Error("simulated journal creation failure");
      }
    }
  });
  await assert.rejects(
    install(fixture, "blueprint@1.0.0", dependencies),
    /simulated journal creation failure/
  );
  assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);
  const installed = await install(fixture, "blueprint@1.0.0", dependencies);
  assert.equal(installed.active?.version, "1.0.0");
  const generations = await readdir(path.join(path.dirname(fixture.configPath), ".blueprint-install", "generations"));
  assert.deepEqual(generations, [installed.active!.generationId]);
});

test("config edits made while a package is staged are preserved by install and upgrade", async (t) => {
  const fixture = await createFixture(t);
  const baseInstaller = fixtureInstaller({
    "blueprint@1.0.0": { version: "1.0.0" },
    "blueprint@2.0.0": { version: "2.0.0" }
  });
  const duringInstall = fixture.originalConfig
    .replace('"theme": "system"', '"theme": "customer-edit-during-install"')
    .replace('"keep": true', '"keep": true, "during-install": "preserve these bytes"');
  let duringUpgrade: string | undefined;
  const dependencies = deps(async (input) => {
    const stagedConfig = input.packageSpec === "blueprint@1.0.0" ? duringInstall : duringUpgrade;
    assert.ok(stagedConfig);
    await writeFile(fixture.configPath, stagedConfig);
    return baseInstaller(input);
  });
  const installed = await install(fixture, "blueprint@1.0.0", dependencies);
  const installedConfig = await readFile(fixture.configPath, "utf8");
  assert.match(installedConfig, /"theme": "customer-edit-during-install"/);
  assert.match(installedConfig, /"keep": true, "during-install": "preserve these bytes"/);
  assert.equal(JSON.parse(installedConfig).plugin.includes(installed.registration), true);

  duringUpgrade = installedConfig
    .replace('"customer-edit-during-install"', '"customer-edit-during-upgrade"')
    .replace('"preserve these bytes"', '"preserve these newer bytes"');
  const upgraded = await runOpenCodeLifecycle({
    action: "upgrade",
    configPath: fixture.configPath,
    cwd: fixture.customerCwd,
    packageSpec: "blueprint@2.0.0"
  }, { ...dependencies, env: fixture.env });
  assert.equal(upgraded.active?.version, "2.0.0");
  assert.equal(await readFile(fixture.configPath, "utf8"), duringUpgrade);
});

test("a customer config edit after journal creation is never overwritten", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
  const customerEdit = fixture.originalConfig.replace(
    '"theme": "system"',
    '"theme": "customer-edit-after-journal"'
  );
  await assert.rejects(install(fixture, "blueprint@1.0.0", deps(packageInstaller, {
    onStep: async (step) => {
      if (step === "afterJournalWrite") await writeFile(fixture.configPath, customerEdit);
    }
  })), /changed|conflict|drift|config/i);
  assert.equal(await readFile(fixture.configPath, "utf8"), customerEdit);
});

test("every post-journal interruption recovers the exact pre-operation state", async (t) => {
  for (const failureStep of [
    "afterConfigWrite",
    "afterLedgerWrite",
    "afterReceiptWrite",
    "afterActivation"
  ] satisfies LifecycleStep[]) {
    await t.test(failureStep, async (t) => {
      const fixture = await createFixture(t);
      const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
      const interrupted = deps(packageInstaller, {
        onStep: (step) => {
          if (step === failureStep) throw new Error(`simulated interruption at ${step}`);
        }
      });
      await assert.rejects(install(fixture, "blueprint@1.0.0", interrupted), /simulated interruption/);

      const recovered = await status(fixture, deps(packageInstaller));
      assert.equal(recovered.active, null);
      assert.equal(recovered.previous, null);
      assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);
    });
  }
});

test("recovery refuses unexpected config drift instead of overwriting later customer edits", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
  await assert.rejects(install(fixture, "blueprint@1.0.0", deps(packageInstaller, {
    onStep: (step) => {
      if (step === "afterConfigWrite") throw new Error("simulated crash after config write");
    }
  })), /simulated crash/);

  const interruptedConfig = await readFile(fixture.configPath, "utf8");
  const driftedConfig = interruptedConfig.replace('"theme": "system"', '"theme": "customer-edit-after-crash"');
  assert.notEqual(driftedConfig, interruptedConfig);
  await writeFile(fixture.configPath, driftedConfig);
  await assert.rejects(status(fixture, deps(packageInstaller)), /changed|conflict|drift|recover/i);
  assert.equal(await readFile(fixture.configPath, "utf8"), driftedConfig);
});

test("a directory lock excludes concurrent lifecycle writers and becomes usable after release", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller({
    "blueprint@1.0.0": { version: "1.0.0" },
    "blueprint@2.0.0": { version: "2.0.0" }
  });
  let release!: () => void;
  let reached!: () => void;
  const atJournal = new Promise<void>((resolve) => { reached = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const first = install(fixture, "blueprint@1.0.0", deps(packageInstaller, {
    onStep: async (step) => {
      if (step !== "afterJournalWrite") return;
      reached();
      await gate;
    }
  }));
  await atJournal;

  await assert.rejects(
    runOpenCodeLifecycle({
      action: "upgrade",
      configPath: fixture.configPath,
      cwd: fixture.customerCwd,
      packageSpec: "blueprint@2.0.0"
    }, {
      env: fixture.env,
      packageInstaller,
      lockOptions: { timeoutMs: 40, pollMs: 5, staleMs: 60_000 }
    }),
    /lock|another|timed out|busy/i
  );
  release();
  await first;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal((await status(fixture)).active?.version, "1.0.0");
});

test("uninstall cleanup remains serialized with a waiting install", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller({
    "blueprint@1.0.0": { version: "1.0.0" },
    "blueprint@2.0.0": { version: "2.0.0" }
  });
  const dependencies = deps(packageInstaller);
  await install(fixture, "blueprint@1.0.0", dependencies);
  let release!: () => void;
  let reached!: () => void;
  const atActivation = new Promise<void>((resolve) => { reached = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const uninstalling = runOpenCodeLifecycle({ action: "uninstall", configPath: fixture.configPath }, {
    ...dependencies,
    env: fixture.env,
    onStep: async (step) => {
      if (step !== "afterActivation") return;
      reached();
      await gate;
    }
  });
  await atActivation;

  let installSettled = false;
  const waitingInstall = install(fixture, "blueprint@2.0.0", deps(packageInstaller, {
    lockOptions: { timeoutMs: 2_000, pollMs: 5, staleMs: 60_000 }
  })).finally(() => { installSettled = true; });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(installSettled, false, "a competing install must remain behind uninstall cleanup");
  release();
  await uninstalling;
  const installed = await waitingInstall;
  assert.equal(installed.active?.version, "2.0.0");
  assert.equal((await status(fixture)).active?.generationId, installed.active?.generationId);
  assert.equal(await exists(installed.active!.packageRoot), true);
});

test("committed uninstall resumes idempotently after every destructive cleanup boundary", async (t) => {
  const cleanupKinds = [
    "generation",
    "receipt",
    "launcher",
    "ledger",
    "generationsDirectory",
    "receiptsDirectory",
    "installRoot"
  ] as const;
  for (const cleanupKind of cleanupKinds) {
    await t.test(cleanupKind, async (t) => {
      const fixture = await createFixture(t);
      const packageInstaller = fixtureInstaller({
        "blueprint@1.0.0": { version: "1.0.0" },
        "blueprint@2.0.0": { version: "2.0.0" }
      });
      const dependencies = deps(packageInstaller);
      await install(fixture, "blueprint@1.0.0", dependencies);
      await runOpenCodeLifecycle({
        action: "upgrade",
        configPath: fixture.configPath,
        cwd: fixture.customerCwd,
        packageSpec: "blueprint@2.0.0"
      }, { ...dependencies, env: fixture.env });
      let injected = false;
      const cleanupDependencies: OpenCodeLifecycleDependencies = {
        ...dependencies,
        env: fixture.env,
        beforeCleanup: (_targetPath, kind) => {
          if (!injected && kind === cleanupKind) {
            injected = true;
            const error = new Error(`simulated EACCES during ${kind}`) as NodeJS.ErrnoException;
            error.code = "EACCES";
            throw error;
          }
        }
      };
      await assert.rejects(runOpenCodeLifecycle({ action: "uninstall", configPath: fixture.configPath }, cleanupDependencies), /simulated EACCES/);
      assert.equal(injected, true, `cleanup kind ${cleanupKind} was not exercised`);
      assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);

      const finalized = await status(fixture, cleanupDependencies);
      assert.equal(finalized.active, null);
      assert.equal(finalized.previous, null);
      assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);
      assert.equal(await exists(path.join(path.dirname(fixture.configPath), ".blueprint-install")), false);
    });
  }
});

test("committed cleanup resumes after a generation was partially deleted", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
  const dependencies = deps(packageInstaller);
  const installed = await install(fixture, "blueprint@1.0.0", dependencies);
  let injected = false;
  const cleanupDependencies: OpenCodeLifecycleDependencies = {
    ...dependencies,
    env: fixture.env,
    beforeCleanup: async (targetPath, kind) => {
      if (injected || kind !== "generation") return;
      injected = true;
      await rm(path.join(installed.active!.packageRoot, "package.json"));
      const error = new Error("simulated partial generation deletion") as NodeJS.ErrnoException;
      error.code = "EACCES";
      throw error;
    }
  };
  await assert.rejects(
    runOpenCodeLifecycle({ action: "uninstall", configPath: fixture.configPath }, cleanupDependencies),
    /simulated partial generation deletion/
  );
  assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);
  const finalized = await status(fixture, cleanupDependencies);
  assert.equal(finalized.active, null);
  assert.equal(await exists(path.join(path.dirname(fixture.configPath), ".blueprint-install")), false);
});

test("cleanup rechecks generation contents after hooks and never deletes a new unknown file", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
  const dependencies = deps(packageInstaller);
  const installed = await install(fixture, "blueprint@1.0.0", dependencies);
  const sentinel = path.join(installed.active!.packageRoot, "customer-after-preflight.txt");
  let injected = false;
  const cleanupDependencies: OpenCodeLifecycleDependencies = {
    ...dependencies,
    env: fixture.env,
    beforeCleanup: async (_targetPath, kind) => {
      if (injected || kind !== "generation") return;
      injected = true;
      await writeFile(sentinel, "customer-owned\n");
    }
  };
  await assert.rejects(
    runOpenCodeLifecycle({ action: "uninstall", configPath: fixture.configPath }, cleanupDependencies),
    /unknown|unexpected|receipt|refus|inventory/i
  );
  assert.equal(await readFile(sentinel, "utf8"), "customer-owned\n");
  assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);
  await assert.rejects(status(fixture, cleanupDependencies), /unknown|unexpected|receipt|refus|inventory/i);
  assert.equal(await readFile(sentinel, "utf8"), "customer-owned\n");
  await rm(sentinel);
  assert.equal((await status(fixture, cleanupDependencies)).active, null);
});

test("tampering, unknown files, and incompatible rollback candidates never replace or delete the active runtime", async (t) => {
  const fixture = await createFixture(t);
  const packageInstaller = fixtureInstaller({
    "blueprint@1.0.0": { version: "1.0.0" },
    "blueprint@2.0.0": { version: "2.0.0" }
  });
  const dependencies = deps(packageInstaller);
  const first = await install(fixture, "blueprint@1.0.0", dependencies);
  const upgraded = await runOpenCodeLifecycle({
    action: "upgrade",
    configPath: fixture.configPath,
    cwd: fixture.customerCwd,
    packageSpec: "blueprint@2.0.0"
  }, { ...dependencies, env: fixture.env });
  const activeBefore = upgraded.active!;
  const configBefore = await readFile(fixture.configPath, "utf8");

  const previousPackageJsonPath = path.join(first.active!.packageRoot, "package.json");
  const previousPackageJsonRaw = await readFile(previousPackageJsonPath, "utf8");
  const previousPackageJson = JSON.parse(previousPackageJsonRaw);
  previousPackageJson.blueprint.stateCompatibility = "future-contract";
  await writeFile(previousPackageJsonPath, `${JSON.stringify(previousPackageJson, null, 2)}\n`);
  await assert.rejects(runOpenCodeLifecycle({
    action: "rollback",
    configPath: fixture.configPath
  }, { ...dependencies, env: fixture.env }), /compatib|tamper|integrity/i);
  await assert.rejects(status(fixture, dependencies), /compatib|tamper|integrity/i);
  const ledger = JSON.parse(await readFile(
    path.join(path.dirname(fixture.configPath), ".blueprint-install", "ledger.json"),
    "utf8"
  )) as { active: { generationId: string } };
  assert.equal(ledger.active.generationId, activeBefore.generationId);
  assert.equal(await readFile(fixture.configPath, "utf8"), configBefore);
  await writeFile(previousPackageJsonPath, previousPackageJsonRaw);

  const unknown = path.join(activeBefore.packageRoot, "customer-sentinel.txt");
  await writeFile(unknown, "must survive\n");
  await assert.rejects(runOpenCodeLifecycle({
    action: "uninstall",
    configPath: fixture.configPath
  }, { ...dependencies, env: fixture.env }), /unknown|unexpected|tamper|refus/i);
  assert.equal(await readFile(unknown, "utf8"), "must survive\n");
  assert.equal(await readFile(fixture.configPath, "utf8"), configBefore);
  assert.equal(await exists(activeBefore.packageRoot), true);
});

test("status validates active and retained rollback generations against their receipts", async (t) => {
  for (const damage of ["active-extra-asset", "previous-tamper", "previous-missing-receipt"] as const) {
    await t.test(damage, async (t) => {
      const fixture = await createFixture(t);
      const packageInstaller = fixtureInstaller({
        "blueprint@1.0.0": { version: "1.0.0" },
        "blueprint@2.0.0": { version: "2.0.0" }
      });
      const dependencies = deps(packageInstaller);
      await install(fixture, "blueprint@1.0.0", dependencies);
      const upgraded = await runOpenCodeLifecycle({
        action: "upgrade",
        configPath: fixture.configPath,
        cwd: fixture.customerCwd,
        packageSpec: "blueprint@2.0.0"
      }, { ...dependencies, env: fixture.env });
      const configBefore = await readFile(fixture.configPath, "utf8");
      if (damage === "active-extra-asset") {
        await writeFile(path.join(upgraded.active!.packageRoot, "unexpected.txt"), "unexpected\n");
      } else if (damage === "previous-tamper") {
        await writeFile(path.join(upgraded.previous!.packageRoot, "package.json"), "{}\n");
      } else {
        const receipt = path.join(
          path.dirname(fixture.configPath),
          ".blueprint-install",
          "receipts",
          `${upgraded.previous!.generationId}.json`
        );
        await rm(receipt);
      }
      await assert.rejects(status(fixture, dependencies), /receipt|tamper|unknown|unexpected|missing|ENOENT/i);
      assert.equal(await readFile(fixture.configPath, "utf8"), configBefore);
      assert.equal(await exists(upgraded.active!.packageRoot), true);
    });
  }
});

test("uninstall refuses unknown installer artifacts before changing config or deleting customer bytes", async (t) => {
  for (const relativeSentinel of [
    "customer-root-file.txt",
    "receipts/customer-receipt.json",
    "generations/customer-generation/file.txt"
  ]) {
    await t.test(relativeSentinel, async (t) => {
      const fixture = await createFixture(t);
      const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
      const dependencies = deps(packageInstaller);
      const installed = await install(fixture, "blueprint@1.0.0", dependencies);
      const configBefore = await readFile(fixture.configPath, "utf8");
      const sentinel = path.join(path.dirname(fixture.configPath), ".blueprint-install", relativeSentinel);
      await mkdir(path.dirname(sentinel), { recursive: true });
      await writeFile(sentinel, "customer-owned\n");
      await assert.rejects(runOpenCodeLifecycle({ action: "uninstall", configPath: fixture.configPath }, {
        ...dependencies,
        env: fixture.env
      }), /unknown|unexpected|owned|refus|inventory/i);
      assert.equal(await readFile(fixture.configPath, "utf8"), configBefore);
      assert.equal(await readFile(sentinel, "utf8"), "customer-owned\n");
    });
  }
});

test("corrupt journal and generation locators cannot escape the installer root", async (t) => {
  await t.test("journal createdGenerationRoot traversal", async (t) => {
    const fixture = await createFixture(t);
    const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
    await assert.rejects(install(fixture, "blueprint@1.0.0", deps(packageInstaller, {
      onStep: (step) => {
        if (step === "afterJournalWrite") throw new Error("leave journal");
      }
    })), /leave journal/);
    const installerRoot = path.join(path.dirname(fixture.configPath), ".blueprint-install");
    const journalPath = path.join(installerRoot, "transaction.json");
    const outside = path.join(fixture.root, "outside-must-survive");
    await mkdir(outside);
    await writeFile(path.join(outside, "sentinel.txt"), "outside\n");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    journal.createdGenerationRoot = outside;
    await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    await assert.rejects(status(fixture, deps(packageInstaller)), /journal|generation|path|contain|travers/i);
    assert.equal(await readFile(path.join(outside, "sentinel.txt"), "utf8"), "outside\n");
  });

  await t.test("ledger generationId traversal", async (t) => {
    const fixture = await createFixture(t);
    const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
    const dependencies = deps(packageInstaller);
    const installed = await install(fixture, "blueprint@1.0.0", dependencies);
    const installerRoot = path.join(path.dirname(fixture.configPath), ".blueprint-install");
    const outside = path.join(fixture.root, "outside-generation");
    await mkdir(outside);
    await writeFile(path.join(outside, "sentinel.txt"), "outside\n");
    const ledgerPath = path.join(installerRoot, "ledger.json");
    const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
    ledger.active.generationId = `../../${path.basename(outside)}`;
    await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    await assert.rejects(status(fixture, dependencies), /generation|path|contain|travers|malformed/i);
    assert.equal(await readFile(path.join(outside, "sentinel.txt"), "utf8"), "outside\n");
    assert.equal(await exists(installed.active!.packageRoot), true);
  });
});

test("runtime compatibility markers gate rollback while lifecycle changes preserve project and global state", async (t) => {
  const fixture = await createFixture(t);
  const projectState = path.join(fixture.customerCwd, ".blueprint");
  const globalState = fixture.env.BLUEPRINT_GLOBAL_HOME!;
  const projectConfig = path.join(projectState, "config.json");
  const stateDocument = path.join(projectState, "STATE.md");
  const globalDefaults = path.join(globalState, "defaults.json");
  const globalSentinel = path.join(globalState, "customer-sentinel.txt");
  await Promise.all([mkdir(projectState, { recursive: true }), mkdir(globalState, { recursive: true })]);
  await writeFile(projectConfig, '{\n  "version": 2\n}\n');
  const supportedStateDocument = '---\r\nblueprint_state_version: "1.0"\r\n---\r\n\r\n# State\r\n';
  await writeFile(stateDocument, supportedStateDocument);
  await writeFile(globalDefaults, '{\n  "version": 2\n}\n');
  await writeFile(globalSentinel, "preserve me\n");
  const packageInstaller = fixtureInstaller({
    "blueprint@1.0.0": { version: "1.0.0" },
    "blueprint@2.0.0": { version: "2.0.0" }
  });
  const dependencies = deps(packageInstaller);
  await install(fixture, "blueprint@1.0.0", dependencies);
  const upgraded = await runOpenCodeLifecycle({
    action: "upgrade",
    configPath: fixture.configPath,
    cwd: fixture.customerCwd,
    packageSpec: "blueprint@2.0.0"
  }, { ...dependencies, env: fixture.env });
  const configBefore = await readFile(fixture.configPath, "utf8");

  const refuseRollback = async (markerPath: string, contents: string): Promise<void> => {
    const before = await readFile(markerPath, "utf8");
    await writeFile(markerPath, contents);
    await assert.rejects(runOpenCodeLifecycle({
      action: "rollback",
      configPath: fixture.configPath
    }, { ...dependencies, env: fixture.env }), /compatib|version|newer|unsupported/i);
    assert.equal(await readFile(fixture.configPath, "utf8"), configBefore);
    await writeFile(markerPath, before);
    assert.equal((await status(fixture, dependencies)).active?.generationId, upgraded.active?.generationId);
  };

  await refuseRollback(projectConfig, '{\n  "version": 99\n}\n');
  await refuseRollback(stateDocument, "---\nblueprint_state_version: 99.0\n---\n\n# Future state\n");
  await refuseRollback(globalDefaults, '{\n  "version": 99\n}\n');

  await runOpenCodeLifecycle({ action: "uninstall", configPath: fixture.configPath }, {
    ...dependencies,
    env: fixture.env
  });
  assert.equal(await readFile(projectConfig, "utf8"), '{\n  "version": 2\n}\n');
  assert.equal(await readFile(stateDocument, "utf8"), supportedStateDocument);
  assert.equal(await readFile(globalDefaults, "utf8"), '{\n  "version": 2\n}\n');
  assert.equal(await readFile(globalSentinel, "utf8"), "preserve me\n");
});

test("installer and Blueprint global state roots may not contain or alias one another", async (t) => {
  const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
  for (const relation of ["installer-inside-global", "global-inside-installer", "symlink-alias"] as const) {
    await t.test(relation, async (t) => {
      const fixture = await createFixture(t);
      const installerRoot = path.join(path.dirname(fixture.configPath), ".blueprint-install");
      if (relation === "installer-inside-global") {
        fixture.env.BLUEPRINT_GLOBAL_HOME = path.dirname(fixture.configPath);
      } else if (relation === "global-inside-installer") {
        fixture.env.BLUEPRINT_GLOBAL_HOME = path.join(installerRoot, "global-state");
      } else {
        const alias = path.join(fixture.root, "global-alias");
        await symlink(path.dirname(fixture.configPath), alias, "dir");
        fixture.env.BLUEPRINT_GLOBAL_HOME = alias;
      }
      await assert.rejects(
        install(fixture, "blueprint@1.0.0", deps(packageInstaller)),
        /BLUEPRINT_GLOBAL_HOME|overlap|contain|alias|installer/i
      );
      assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);
    });
  }
});

test("unknown installer-root and sibling-lock artifacts are refused before config mutation", async (t) => {
  for (const target of ["root", "lock"] as const) {
    await t.test(target, async (t) => {
      const fixture = await createFixture(t);
      const installerRoot = path.join(path.dirname(fixture.configPath), ".blueprint-install");
      const opaqueRoot = target === "root" ? installerRoot : `${installerRoot}.lock`;
      const sentinel = path.join(opaqueRoot, "customer-sentinel.txt");
      await mkdir(opaqueRoot, { recursive: true, mode: 0o700 });
      await writeFile(sentinel, "customer-owned\n");
      const packageInstaller = fixtureInstaller({ "blueprint@1.0.0": { version: "1.0.0" } });
      await assert.rejects(install(fixture, "blueprint@1.0.0", deps(packageInstaller, {
        lockOptions: { timeoutMs: 40, pollMs: 5, staleMs: 60_000 }
      })), /unknown|owned|lock|opaque|refus|recover/i);
      assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);
      assert.equal(await readFile(sentinel, "utf8"), "customer-owned\n");
    });
  }
});

async function makePackablePackage(root: string, version: string, env: NodeJS.ProcessEnv): Promise<string> {
  await seedIsolatedNpmCache(root);
  const packageRoot = path.join(root, `blueprint-${version}`);
  await Promise.all([
    cp(path.join(repoRoot, "agents"), path.join(packageRoot, "agents"), { recursive: true }),
    cp(path.join(repoRoot, "commands"), path.join(packageRoot, "commands"), { recursive: true }),
    cp(path.join(repoRoot, "dist"), path.join(packageRoot, "dist"), { recursive: true }),
    cp(path.join(repoRoot, "generated"), path.join(packageRoot, "generated"), { recursive: true }),
    cp(path.join(repoRoot, "skills"), path.join(packageRoot, "skills"), { recursive: true })
  ]);
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  packageJson.version = version;
  await writeFile(path.join(packageRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  const packDir = path.join(root, "packed");
  await mkdir(packDir, { recursive: true });
  const packed = await execFileAsync("npm", ["pack", packageRoot, "--ignore-scripts", "--json", "--pack-destination", packDir], {
    cwd: root,
    env: { ...env, npm_config_cache: path.join(root, "npm-cache") }
  });
  const metadata = JSON.parse(packed.stdout) as Array<{ filename: string }>;
  assert.equal(metadata.length, 1);
  return path.join(packDir, metadata[0]!.filename);
}

async function runCli(
  fixture: Fixture,
  action: string,
  args: string[] = [],
  cli = path.join(repoRoot, "dist", "opencode", "lifecycle-cli.js")
): Promise<OpenCodeLifecycleResult> {
  const windowsShim = cli.endsWith(".cmd");
  const result = await execFileAsync(windowsShim ? cli : process.execPath, [
    ...(windowsShim ? [] : [cli]),
    action,
    "--config",
    fixture.configPath,
    "--json",
    ...args
  ], {
    cwd: fixture.customerCwd,
    env: fixture.env,
    maxBuffer: 10 * 1024 * 1024
  });
  return JSON.parse(result.stdout) as OpenCodeLifecycleResult;
}

test("built CLI installs exact local tarballs and transitions between fixture versions", async (t) => {
  const fixture = await createFixture(t);
  assert.equal(fixture.env.npm_config_offline, "true");
  assert.equal(fixture.env.npm_config_cache, path.join(fixture.root, "npm-cache"));
  assert.equal(isContainedFixturePath(fixture.root, fixture.env.npm_config_cache!), true);
  if (!(await exists(path.join(repoRoot, "dist", "opencode", "lifecycle-cli.js")))) {
    assert.fail("Packed lifecycle verification requires a fresh npm run build");
  }
  const v1 = await makePackablePackage(fixture.root, "1.0.0", fixture.env);
  const v2 = await makePackablePackage(fixture.root, "2.0.0", fixture.env);
  const customerPackageJson = '{"name":"customer-project","private":true,"scripts":{"preinstall":"exit 99"}}\n';
  const customerNpmrc = "registry=https://customer-project.invalid/\noffline=false\n";
  await writeFile(path.join(fixture.customerCwd, "package.json"), customerPackageJson);
  await writeFile(path.join(fixture.customerCwd, ".npmrc"), customerNpmrc);
  const bootstrapPrefix = path.join(fixture.root, "cli-bootstrap");
  await execFileAsync("npm", ["install", "--prefix", bootstrapPrefix, "--omit=dev", "--ignore-scripts", v1], {
    cwd: fixture.root,
    env: { ...fixture.env, npm_config_cache: path.join(fixture.root, "npm-cache") }
  });
  const installedCli = path.join(
    bootstrapPrefix,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "blueprint-opencode.cmd" : "blueprint-opencode"
  );
  const installedCliStat = await lstat(installedCli);
  assert.equal(installedCliStat.isFile() || installedCliStat.isSymbolicLink(), true);
  const runInstalledCliRaw = (args: string[]) => execFileAsync(
    process.platform === "win32" ? installedCli : process.execPath,
    [...(process.platform === "win32" ? [] : [installedCli]), ...args],
    { cwd: fixture.customerCwd, env: fixture.env, maxBuffer: 10 * 1024 * 1024 }
  );
  const help = await runInstalledCliRaw(["--help"]);
  assert.match(help.stdout, /Usage: blueprint-opencode/);
  const assertCliFailure = async (args: string[], expected: RegExp): Promise<void> => {
    await assert.rejects(runInstalledCliRaw(args), (error: any) => {
      assert.match(String(error.stderr ?? error.message), expected);
      return true;
    });
  };
  await assertCliFailure(["install", "--config", fixture.configPath, "--cwd", fixture.customerCwd], /requires --package/i);
  await assertCliFailure(["install", "--config", fixture.configPath, "--package", v1], /requires .*cwd|absolute cwd/i);
  await assertCliFailure(["upgrade", "--config", fixture.configPath, "--cwd", fixture.customerCwd], /requires --package/i);
  for (const action of ["rollback", "uninstall", "status"]) {
    await assertCliFailure([action, "--config", fixture.configPath, "--package", v1], /does not accept --package|unexpected --package/i);
  }

  const installed = await runCli(fixture, "install", ["--package", v1, "--cwd", fixture.customerCwd], installedCli);
  assert.equal(installed.active?.version, "1.0.0");
  assert.equal(installed.active?.sourceSpec, v1);
  assertOwnedRegistration(await readFile(fixture.configPath, "utf8"), installed.registration!);

  const installedConfig = await readFile(fixture.configPath, "utf8");
  const repeated = await runCli(fixture, "install", ["--package", v1, "--cwd", fixture.customerCwd], installedCli);
  assert.equal(repeated.active?.generationId, installed.active?.generationId);
  assert.equal(repeated.active?.packageRoot, installed.active?.packageRoot);
  assert.equal(await readFile(fixture.configPath, "utf8"), installedConfig);

  const upgraded = await runCli(fixture, "upgrade", ["--package", v2, "--cwd", fixture.customerCwd], installedCli);
  assert.equal(upgraded.active?.version, "2.0.0");
  assert.equal(upgraded.previous?.version, "1.0.0");
  assert.equal((await runCli(fixture, "status", [], installedCli)).active?.packageRoot, upgraded.active?.packageRoot);
  assert.equal((await runCli(fixture, "rollback", [], installedCli)).active?.version, "1.0.0");
  assert.equal((await runCli(fixture, "uninstall", [], installedCli)).active, null);
  assert.equal(await readFile(fixture.configPath, "utf8"), fixture.originalConfig);
  assert.equal(await readFile(path.join(fixture.customerCwd, "package.json"), "utf8"), customerPackageJson);
  assert.equal(await readFile(path.join(fixture.customerCwd, ".npmrc"), "utf8"), customerNpmrc);
});

test("pinned OpenCode resolves each installed lifecycle generation without a model invocation", async (t) => {
  const hostBinary = process.env.BLUEPRINT_OPENCODE_BIN;
  if (!hostBinary) {
    t.skip("set BLUEPRINT_OPENCODE_BIN for the registration-only lifecycle probe");
    return;
  }
  const fixture = await createFixture(t, '{\n  "plugin": []\n}\n');
  const version = await execFileAsync(hostBinary, ["--version"], {
    cwd: fixture.customerCwd,
    env: fixture.env
  });
  assert.equal(version.stdout.trim(), pinnedOpenCodeVersion);
  if (process.platform === "darwin" && process.arch === "arm64") {
    const digest = createHash("sha256").update(await readFile(await realpath(hostBinary))).digest("hex");
    assert.equal(digest, pinnedDarwinArm64Sha256);
  }
  const v1 = await makePackablePackage(fixture.root, "1.0.0", fixture.env);
  const v2 = await makePackablePackage(fixture.root, "2.0.0", fixture.env);
  const bootstrapPrefix = path.join(fixture.root, "host-probe-cli");
  await execFileAsync("npm", ["install", "--prefix", bootstrapPrefix, "--omit=dev", "--ignore-scripts", v1], {
    cwd: fixture.root,
    env: { ...fixture.env, npm_config_cache: path.join(fixture.root, "npm-cache") }
  });
  const installedCli = path.join(
    bootstrapPrefix,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "blueprint-opencode.cmd" : "blueprint-opencode"
  );
  const hostEnv = {
    ...fixture.env,
    OPENCODE_CONFIG: fixture.configPath,
    OPENCODE_DISABLE_PROJECT_CONFIG: "true",
    BLUEPRINT_NODE_EXECUTABLE: process.execPath
  };
  let debugSequence = 0;
  const debugConfig = async (): Promise<Record<string, any>> => {
    const outputPath = path.join(fixture.root, `debug-config-${++debugSequence}.json`);
    const output = await open(outputPath, "w", 0o600);
    let result: ReturnType<typeof spawnSync>;
    try {
      result = spawnSync(hostBinary, ["debug", "config"], {
        cwd: fixture.customerCwd,
        env: hostEnv,
        encoding: "utf8",
        stdio: ["ignore", output.fd, "pipe"],
        maxBuffer: 10 * 1024 * 1024
      });
    } finally {
      await output.close();
    }
    assert.equal(result.status, 0, `opencode debug config failed\nstderr:\n${result.stderr}`);
    return JSON.parse(await readFile(outputPath, "utf8")) as Record<string, any>;
  };
  const assertResolvedGeneration = async (lifecycle: OpenCodeLifecycleResult): Promise<void> => {
    const activeRoot = await realpath(lifecycle.active!.packageRoot);
    const config = await debugConfig();
    assert.equal(config.command.blu.agent, "blueprint");
    assert.equal(config.mcp.blueprint.cwd, await realpath(fixture.customerCwd));
    assert.equal(config.mcp.blueprint.environment.BLUEPRINT_EXTENSION_PATH, activeRoot);
    assert.equal(config.mcp.blueprint.environment.BLUEPRINT_GLOBAL_HOME, fixture.env.BLUEPRINT_GLOBAL_HOME);
    assert.deepEqual(config.skills.paths, [path.join(activeRoot, "skills")]);
  };

  const installed = await runCli(fixture, "install", ["--package", v1, "--cwd", fixture.customerCwd], installedCli);
  assert.equal((await runCli(fixture, "status", [], installedCli)).active?.packageRoot, installed.active?.packageRoot);
  await assertResolvedGeneration(installed);
  const upgraded = await runCli(fixture, "upgrade", ["--package", v2, "--cwd", fixture.customerCwd], installedCli);
  assert.notEqual(upgraded.active?.packageRoot, installed.active?.packageRoot);
  await assertResolvedGeneration(upgraded);
  const rolledBack = await runCli(fixture, "rollback", [], installedCli);
  assert.equal(rolledBack.active?.packageRoot, installed.active?.packageRoot);
  await assertResolvedGeneration(rolledBack);

  await runCli(fixture, "uninstall", [], installedCli);
  assert.equal((await runCli(fixture, "status", [], installedCli)).active, null);
  const afterUninstall = await debugConfig();
  assert.equal(afterUninstall.mcp?.blueprint, undefined);
  assert.equal(afterUninstall.command?.blu, undefined);
});
