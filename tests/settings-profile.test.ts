import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintConfigGet,
  blueprintConfigSet,
  blueprintConfigSetProfile,
  configToolTestHooks,
  seedProjectConfig
} from "../src/mcp/tools/config.js";
import { blueprintArtifactsTestHooks } from "../src/mcp/tools/artifacts.js";
import { resolveBlueprintRuntimeHost } from "../src/mcp/runtime-host.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "tests/fixtures/settings-profile");

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(error: unknown): void;
};

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function waitFor<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = 1_500
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out waiting for ${label}`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

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
  const repoPath = await createGitRepo("blueprint-settings-profile-");

  const sourcePath = path.join(fixtureRoot, fixtureName);

  if (await pathExists(sourcePath)) {
    await copyFixtureContents(sourcePath, repoPath);
  }

  return repoPath;
}

async function createDefaultsFile(fixtureName: string, tempRoot: string): Promise<string> {
  const sourcePath = path.join(fixtureRoot, "saved-defaults", fixtureName);
  const defaultsPath = path.join(tempRoot, "defaults.json");

  await copyFile(sourcePath, defaultsPath);

  return defaultsPath;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function withEnvOverrides<T>(
  overrides: Record<string, string | undefined>,
  callback: () => Promise<T>
): Promise<T> {
  const previousEntries = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, process.env[key]])
  );

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previousEntries)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function writeInitializedBlueprintArtifacts(repoPath: string): Promise<void> {
  const blueprintDir = path.join(repoPath, ".blueprint");
  const phasesDir = path.join(blueprintDir, "phases");

  await mkdir(blueprintDir, { recursive: true });
  await mkdir(phasesDir, { recursive: true });
  await writeFile(path.join(blueprintDir, "PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(blueprintDir, "REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(path.join(blueprintDir, "ROADMAP.md"), "# Roadmap\n", "utf8");
  await writeFile(path.join(blueprintDir, "STATE.md"), "# State\n", "utf8");
}

test("runtime host resolves built-in and override global paths to absolute filesystem paths", () => {
  const geminiHost = resolveBlueprintRuntimeHost({
    BLUEPRINT_HOST: "gemini"
  });
  const tabnineHost = resolveBlueprintRuntimeHost({
    BLUEPRINT_HOST: "tabnine"
  });
  const overrideHost = resolveBlueprintRuntimeHost({
    BLUEPRINT_HOST: "gemini",
    BLUEPRINT_GLOBAL_HOME: "~/blueprint-test-global"
  });

  assert.equal(geminiHost.globalBlueprintDir, path.join(os.homedir(), ".gemini", "blueprint"));
  assert.equal(geminiHost.defaultsPath, path.join(os.homedir(), ".gemini", "blueprint", "defaults.json"));
  assert.equal(tabnineHost.globalBlueprintDir, path.join(os.homedir(), ".tabnine", "blueprint"));
  assert.equal(overrideHost.globalBlueprintDir, path.join(os.homedir(), "blueprint-test-global"));
  assert.ok(path.isAbsolute(geminiHost.patchRegistryPath));
  assert.ok(path.isAbsolute(geminiHost.workspaceRegistryPath));
  assert.ok(path.isAbsolute(geminiHost.updatesDir));
  assert.doesNotMatch(geminiHost.defaultsPath, /^~/);
  assert.doesNotMatch(overrideHost.defaultsPath, /^~/);
});

test("defaults-scope writes use the resolved host-global defaults path", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const globalHome = path.join(tempRoot, "global-home");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await withEnvOverrides({ BLUEPRINT_GLOBAL_HOME: globalHome }, async () => {
    const result = await blueprintConfigSet({
      cwd: repoPath,
      scope: "defaults",
      patch: {
        model_profile: "budget"
      }
    });
    const defaultsPath = path.join(globalHome, "defaults.json");
    const savedDefaults = await readJsonFile<Record<string, unknown>>(defaultsPath);

    assert.equal(result.configPath, defaultsPath);
    assert.equal(result.provenance.defaultsPath, defaultsPath);
    assert.equal(savedDefaults.model_profile, "budget");
    assert.ok(path.isAbsolute(result.configPath));
    assert.doesNotMatch(result.configPath, /^~/);
  });
});

test("public defaultsPath overrides must stay inside the host-global Blueprint directory", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const globalHome = path.join(tempRoot, "global-home");
  const outsideDefaultsPath = path.join(tempRoot, "outside-defaults.json");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await withEnvOverrides({ BLUEPRINT_GLOBAL_HOME: globalHome }, async () => {
    await assert.rejects(
      blueprintConfigSet({
        cwd: repoPath,
        scope: "defaults",
        defaultsPath: outsideDefaultsPath,
        patch: {
          model_profile: "budget"
        }
      }),
      /defaultsPath must resolve inside the Blueprint host-global directory/
    );
  });

  assert.equal(await pathExists(outsideDefaultsPath), false);
});

test("public defaultsPath overrides reject traversal and home-relative escapes", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const globalHome = path.join(tempRoot, "global-home");
  const homeDir = path.join(tempRoot, "home");
  const traversalDefaultsPath = path.join(globalHome, "..", "traversal-defaults.json");
  const homeRelativeDefaultsPath = "~/home-defaults.json";
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await mkdir(globalHome, { recursive: true });
  await mkdir(homeDir, { recursive: true });

  await withEnvOverrides(
    { BLUEPRINT_GLOBAL_HOME: globalHome, HOME: homeDir },
    async () => {
      await assert.rejects(
        blueprintConfigSet({
          cwd: repoPath,
          scope: "defaults",
          defaultsPath: traversalDefaultsPath,
          patch: {
            model_profile: "budget"
          }
        }),
        /defaultsPath must resolve inside the Blueprint host-global directory/
      );
      await assert.rejects(
        blueprintConfigSet({
          cwd: repoPath,
          scope: "defaults",
          defaultsPath: homeRelativeDefaultsPath,
          patch: {
            model_profile: "budget"
          }
        }),
        /defaultsPath must resolve inside the Blueprint host-global directory/
      );
    }
  );

  assert.equal(await pathExists(path.join(tempRoot, "traversal-defaults.json")), false);
  assert.equal(await pathExists(path.join(homeDir, "home-defaults.json")), false);
});

test("public defaultsPath overrides reject symlink-parent escapes", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const globalHome = path.join(tempRoot, "global-home");
  const outsideDir = path.join(tempRoot, "outside");
  const linkedParent = path.join(globalHome, "linked-outside");
  const escapedDefaultsPath = path.join(linkedParent, "defaults.json");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await mkdir(globalHome, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await symlink(outsideDir, linkedParent);

  await withEnvOverrides({ BLUEPRINT_GLOBAL_HOME: globalHome }, async () => {
    await assert.rejects(
      blueprintConfigSet({
        cwd: repoPath,
        scope: "defaults",
        defaultsPath: escapedDefaultsPath,
        patch: {
          model_profile: "budget"
        }
      }),
      /defaultsPath must resolve inside the Blueprint host-global directory/
    );
  });

  assert.equal(await pathExists(escapedDefaultsPath), false);
  assert.equal(await pathExists(path.join(outsideDir, "defaults.json")), false);
});

test("config_set persists normalized version 2 config for initialized repos", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeInitializedBlueprintArtifacts(repoPath);

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      planning: {
        commit_docs: false
      },
      workflow: {
        verifier: false
      }
    }
  });
  const configPath = path.join(repoPath, ".blueprint/config.json");
  const normalizedConfigText = await readFile(configPath, "utf8");
  const config = JSON.parse(normalizedConfigText) as Record<string, unknown>;

  assert.equal(result.config.version, 2);
  assert.equal(result.configPath, ".blueprint/config.json");
  assert.match(normalizedConfigText, /"version": 2/);
  assert.equal((config.planning as Record<string, unknown>).commit_docs, false);
  assert.equal((config.workflow as Record<string, unknown>).verifier, false);
  assert.equal(config.model_profile, "balanced");
  assert.equal(result.config.workflow.secure_phase, false);
  assert.equal(result.config.workflow.no_uat, false);
  assert.equal(result.config.workflow.subagents, true);
  assert.deepEqual(result.config.ux, {
    progress_mode: "quiet",
    structured_confirmations: "auto",
    user_checkpoints: "off"
  });
  assert.deepEqual(result.config.orchestration, {
    task_tracker: "off"
  });
  assert.deepEqual(result.config.research, {
    external_sources: "off"
  });
  assert.equal("no_uat" in (config.workflow as Record<string, unknown>), false);
  assert.equal("subagents" in (config.workflow as Record<string, unknown>), false);
  assert.equal("secure_phase" in (config.workflow as Record<string, unknown>), false);
  assert.equal("ux" in config, false);
  assert.equal("orchestration" in config, false);
  assert.equal("research" in config, false);
});

test("config_set_profile changes only model_profile and leaves saved defaults unchanged", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const defaultsPath = await createDefaultsFile("valid-defaults.json", tempRoot);
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });
  await writeInitializedBlueprintArtifacts(repoPath);

  await withEnvOverrides({ BLUEPRINT_GLOBAL_HOME: tempRoot }, async () => {
    const configPath = path.join(repoPath, ".blueprint/config.json");
    const defaultsBefore = await readFile(defaultsPath, "utf8");
    const beforeConfig = await readJsonFile<Record<string, unknown>>(configPath);

    const result = await blueprintConfigSetProfile({
      cwd: repoPath,
      defaultsPath,
      profile: "budget"
    });

    const afterConfig = await readJsonFile<Record<string, unknown>>(configPath);
    const defaultsAfter = await readFile(defaultsPath, "utf8");
    const expectedConfig = structuredClone(beforeConfig);
    expectedConfig.model_profile = "budget";
    (expectedConfig.maintenance as Record<string, unknown>).patch_registry = path.join(
      tempRoot,
      "patches"
    );

    assert.deepEqual(result.updatedKeys, ["model_profile"]);
    assert.equal(result.profile, "budget");
    assert.equal(result.configPath, ".blueprint/config.json");
    assert.equal(afterConfig.model_profile, "budget");
    assert.deepEqual(afterConfig, expectedConfig);
    assert.equal(defaultsAfter, defaultsBefore);
  });
});

test("config_set_profile reports no updated keys when the requested profile is already active", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeInitializedBlueprintArtifacts(repoPath);

  const result = await blueprintConfigSetProfile({
    cwd: repoPath,
    profile: "balanced"
  });

  assert.equal(result.profile, "balanced");
  assert.deepEqual(result.updatedKeys, []);
  assert.equal(result.configPath, ".blueprint/config.json");
});

test("config_set_profile rejects partial repos that only have .blueprint/config.json", async (t) => {
  const repoPath = await createRepoFromFixture("missing-config-repo");
  const tempRoot = path.dirname(repoPath);
  const configPath = path.join(repoPath, ".blueprint/config.json");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify(
      {
        version: 2,
        model_profile: "balanced"
      },
      null,
      2
    ),
    "utf8"
  );

  await assert.rejects(
    blueprintConfigSetProfile({
      cwd: repoPath,
      profile: "budget"
    }),
    /Initialize the repo first/
  );
});

test("config_set_profile changes only model_profile without materializing inherited defaults", async (t) => {
  const repoPath = await createRepoFromFixture("missing-config-repo");
  const tempRoot = path.dirname(repoPath);
  const defaultsPath = await createDefaultsFile("valid-defaults.json", tempRoot);
  const configPath = path.join(repoPath, ".blueprint/config.json");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await writeInitializedBlueprintArtifacts(repoPath);
  await writeFile(
    configPath,
    JSON.stringify(
      {
        version: 2,
        workflow: {
          subagents: false
        },
        model_profile: "balanced"
      },
      null,
      2
    ),
    "utf8"
  );

  await withEnvOverrides({ BLUEPRINT_GLOBAL_HOME: tempRoot }, async () => {
    const defaultsBefore = await readFile(defaultsPath, "utf8");

    const result = await blueprintConfigSetProfile({
      cwd: repoPath,
      defaultsPath,
      profile: "budget"
    });

    const afterConfig = await readJsonFile<Record<string, unknown>>(configPath);
    const effectiveConfig = await blueprintConfigGet({
      cwd: repoPath,
      defaultsPath,
      scope: "effective"
    });
    const defaultsAfter = await readFile(defaultsPath, "utf8");

    assert.deepEqual(result.updatedKeys, ["model_profile"]);
    assert.equal(result.profile, "budget");
    assert.deepEqual(afterConfig, {
      version: 2,
      workflow: {
        subagents: false
      },
      model_profile: "budget"
    });
    assert.equal(effectiveConfig.config.model_profile, "budget");
    assert.equal(effectiveConfig.config.mode, "auto");
    assert.equal(effectiveConfig.config.workflow.secure_phase, false);
    assert.equal(effectiveConfig.config.workflow.subagents, false);
    assert.equal(effectiveConfig.config.workflow.verifier, true);
    assert.equal("planning" in afterConfig, false);
    assert.equal("parallelization" in afterConfig, false);
    assert.equal(defaultsAfter, defaultsBefore);
  });
});

test("config_set_profile rejects repos without initialized project config", async (t) => {
  const repoPath = await createRepoFromFixture("missing-config-repo");
  const tempRoot = path.dirname(repoPath);
  const configPath = path.join(repoPath, ".blueprint/config.json");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintConfigSetProfile({
      cwd: repoPath,
      profile: "budget"
    }),
    /Blueprint project is not initialized/
  );

  assert.equal(await pathExists(configPath), false);
});

test("config_set rejects reserved repo keys for hooks and removed workflow flags", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeInitializedBlueprintArtifacts(repoPath);

  await assert.rejects(
    blueprintConfigSet({
      cwd: repoPath,
      patch: {
        workflow: {
          use_workspaces: true
        }
      }
    }),
    /workflow\.use_workspaces/
  );

  await assert.rejects(
    blueprintConfigSet({
      cwd: repoPath,
      patch: {
        workflow: {
          use_workstreams: true
        }
      }
    }),
    /workflow\.use_workstreams/
  );

  await assert.rejects(
    blueprintConfigSet({
      cwd: repoPath,
      patch: {
        hooks: {
          context_warnings: true
        }
      }
    }),
    /hooks/
  );
});

test("legacy and minimal config inputs are upgraded to the full schema on write", async (t) => {
  const repoPath = await createRepoFromFixture("legacy-minimal-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      mode: "auto"
    }
  });
  const configPath = path.join(repoPath, ".blueprint/config.json");
  const normalizedConfigText = await readFile(configPath, "utf8");
  const config = JSON.parse(normalizedConfigText) as Record<string, unknown>;
  const workflow = config.workflow as Record<string, unknown>;

  assert.equal(result.config.version, 2);
  assert.equal(result.config.mode, "auto");
  assert.match(normalizedConfigText, /"version": 2/);
  assert.equal((config.planning as Record<string, unknown>).commit_docs, false);
  assert.equal((config.planning as Record<string, unknown>).search_gitignored, true);
  assert.equal((config.parallelization as Record<string, unknown>).enabled, false);
  assert.equal(workflow.research, false);
  assert.equal(result.config.workflow.secure_phase, false);
  assert.equal(result.config.workflow.no_uat, false);
  assert.equal("use_workspaces" in workflow, false);
  assert.equal("use_workstreams" in workflow, false);
  assert.equal("hooks" in config, false);
  assert.equal("gates" in config, false);
  assert.equal("safety" in config, false);
  assert.equal("maintenance" in config, false);
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("Migrated legacy config key commit_docs")
    )
  );
  assert.equal(result.config.workflow.subagents, true);
});

test("config_set reports only keys that actually changed", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      unknown_top: true,
      model_profile: "quality"
    } as Record<string, unknown>
  });

  assert.deepEqual(result.updatedKeys, ["model_profile"]);
  assert.match(result.warnings.join("\n"), /Ignored unknown config key: unknown_top/);
});

test("concurrent project-scope config patches serialize without losing either patch", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  await writeInitializedBlueprintArtifacts(repoPath);

  const [profileResult, parallelResult] = await withEnvOverrides(
    {
      BLUEPRINT_TEST_CONFIG_SET_BEFORE_WRITE_DELAY_MS: "75"
    },
    () =>
      Promise.all([
        blueprintConfigSet({
          cwd: repoPath,
          patch: {
            model_profile: "quality"
          }
        }),
        blueprintConfigSet({
          cwd: repoPath,
          patch: {
            parallelization: {
              max_concurrent_agents: 5
            }
          }
        })
      ])
  );
  const savedConfig = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.deepEqual(profileResult.updatedKeys, ["model_profile"]);
  assert.deepEqual(parallelResult.updatedKeys, ["parallelization.max_concurrent_agents"]);
  assert.equal(savedConfig.model_profile, "quality");
  assert.equal(
    (savedConfig.parallelization as Record<string, unknown>).max_concurrent_agents,
    5
  );
});

test("seedProjectConfig shares the project config lock with config_set", async (t) => {
  const repoPath = await createRepoFromFixture("missing-config-repo");
  const tempRoot = path.dirname(repoPath);
  const configPath = path.join(repoPath, ".blueprint/config.json");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });
  await writeInitializedBlueprintArtifacts(repoPath);

  const seedRenamePaused = deferred();
  const releaseSeedRename = deferred();
  let pausedSeedRename = false;

  const restoreJsonFileSystem = blueprintArtifactsTestHooks.setJsonFileSystemForTest({
    writeFile: async (filePath, contents, encoding) =>
      writeFile(filePath, contents, encoding),
    rename: async (oldPath, newPath) => {
      if (newPath === configPath && !pausedSeedRename) {
        pausedSeedRename = true;
        seedRenamePaused.resolve();
        await releaseSeedRename.promise;
      }

      return rename(oldPath, newPath);
    },
    rm: async (filePath, options) => rm(filePath, options)
  });
  t.after(() => {
    restoreJsonFileSystem();
  });

  const seedWrite = seedProjectConfig({ cwd: repoPath });
  await waitFor(seedRenamePaused.promise, "seed project config rename");

  const configSetWrite = blueprintConfigSet({
    cwd: repoPath,
    patch: {
      workflow: {
        subagents: false
      }
    }
  });

  await sleep(80);
  releaseSeedRename.resolve();

  const [seedResult, setResult] = await Promise.all([seedWrite, configSetWrite]);
  const savedConfig = await readJsonFile<Record<string, unknown>>(configPath);

  assert.equal(seedResult.config.workflow.subagents, true);
  assert.deepEqual(setResult.updatedKeys, ["workflow.subagents"]);
  assert.equal(setResult.config.workflow.subagents, false);
  assert.equal((savedConfig.workflow as Record<string, unknown>).subagents, false);
});

test("concurrent defaults-scope config patches serialize without losing either patch", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const defaultsPath = await createDefaultsFile("valid-defaults.json", tempRoot);
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  const [profileResult, workflowResult] = await withEnvOverrides(
    {
      BLUEPRINT_GLOBAL_HOME: tempRoot,
      BLUEPRINT_TEST_CONFIG_SET_BEFORE_WRITE_DELAY_MS: "75"
    },
    () =>
      Promise.all([
        blueprintConfigSet({
          cwd: repoPath,
          defaultsPath,
          scope: "defaults",
          patch: {
            model_profile: "budget"
          }
        }),
        blueprintConfigSet({
          cwd: repoPath,
          defaultsPath,
          scope: "defaults",
          patch: {
            workflow: {
              subagents: false
            }
          }
        })
      ])
  );
  const savedDefaults = await readJsonFile<Record<string, unknown>>(defaultsPath);

  assert.deepEqual(profileResult.updatedKeys, ["model_profile"]);
  assert.deepEqual(workflowResult.updatedKeys, ["workflow.subagents"]);
  assert.equal(savedDefaults.model_profile, "budget");
  assert.equal((savedDefaults.workflow as Record<string, unknown>).subagents, false);
});

test("defaults-scope config writes serialize waiters recovering an abandoned lock", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const globalHome = path.join(tempRoot, "global-home");
  await mkdir(globalHome, { recursive: true });
  const defaultsPath = await createDefaultsFile("valid-defaults.json", globalHome);
  const lockPath = path.join(globalHome, "locks", "defaults-config.lock");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await mkdir(lockPath, { recursive: true });
  await writeFile(path.join(lockPath, "owner"), "abandoned-owner\n", "utf8");
  await writeFile(path.join(lockPath, "lease"), "abandoned-owner\n", "utf8");

  const restoreTiming = configToolTestHooks.setConfigDefaultsLockTimingForTest({
    retryMs: 5,
    staleMs: 30,
    heartbeatMs: 10
  });
  t.after(() => {
    restoreTiming();
  });
  await sleep(70);

  const bothWaitersObservedStale = deferred();
  const firstCallbackEntered = deferred();
  const releaseFirstCallback = deferred();
  let staleRecoveryAttempts = 0;

  const restoreRecoveryHooks = configToolTestHooks.setConfigDefaultsLockRecoveryHooksForTest({
    beforeStaleRecoveryClaim: async (observedLockPath) => {
      assert.equal(observedLockPath, lockPath);

      const attempt = ++staleRecoveryAttempts;

      if (attempt === 2) {
        bothWaitersObservedStale.resolve();
      }

      await bothWaitersObservedStale.promise;

      if (attempt > 1) {
        await firstCallbackEntered.promise;
      }
    }
  });
  t.after(() => {
    restoreRecoveryHooks();
  });

  let activeCallbacks = 0;
  let maxActiveCallbacks = 0;
  const events: string[] = [];

  const restoreCallbackObserver =
    configToolTestHooks.setConfigDefaultsLockCallbackObserverForTest(
      async (event, observedLockPath) => {
        assert.equal(observedLockPath, lockPath);

        if (event === "enter") {
          activeCallbacks += 1;
          maxActiveCallbacks = Math.max(maxActiveCallbacks, activeCallbacks);
          events.push("enter");

          if (events.filter((entry) => entry === "enter").length === 1) {
            firstCallbackEntered.resolve();
            await releaseFirstCallback.promise;
          }

          return;
        }

        events.push("exit");
        activeCallbacks -= 1;
      }
    );
  t.after(() => {
    restoreCallbackObserver();
  });

  const [profileResult, workflowResult] = await withEnvOverrides(
    {
      BLUEPRINT_GLOBAL_HOME: globalHome
    },
    async () => {
      const profileWrite = blueprintConfigSet({
        cwd: repoPath,
        defaultsPath,
        scope: "defaults",
        patch: {
          model_profile: "budget"
        }
      });
      const workflowWrite = blueprintConfigSet({
        cwd: repoPath,
        defaultsPath,
        scope: "defaults",
        patch: {
          workflow: {
            subagents: false
          }
        }
      });
      const waiters = Promise.all([profileWrite, workflowWrite]);
      let preReleaseError: unknown;

      try {
        await waitFor(firstCallbackEntered.promise, "first recovered defaults callback");
        await sleep(80);
        assert.equal(maxActiveCallbacks, 1);
        assert.equal(events.filter((entry) => entry === "enter").length, 1);
      } catch (error) {
        preReleaseError = error;
      } finally {
        releaseFirstCallback.resolve();
      }

      const results = await waitFor(waiters, "defaults stale waiters");

      if (preReleaseError !== undefined) {
        throw preReleaseError;
      }

      return results;
    }
  );
  const savedDefaults = await readJsonFile<Record<string, unknown>>(defaultsPath);

  assert.equal(staleRecoveryAttempts, 2);
  assert.equal(maxActiveCallbacks, 1);
  assert.equal(activeCallbacks, 0);
  assert.deepEqual(profileResult.updatedKeys, ["model_profile"]);
  assert.deepEqual(workflowResult.updatedKeys, ["workflow.subagents"]);
  assert.equal(savedDefaults.model_profile, "budget");
  assert.equal((savedDefaults.workflow as Record<string, unknown>).subagents, false);
  assert.equal(await pathExists(lockPath), false);
  assert.deepEqual(
    (await readdir(path.dirname(lockPath))).filter((entry) =>
      entry.includes("defaults-config.lock")
    ),
    []
  );
});

test("config_set project patches do not freeze inherited defaults into project config", async (t) => {
  const repoPath = await createRepoFromFixture("missing-config-repo");
  const tempRoot = path.dirname(repoPath);
  const defaultsPath = await createDefaultsFile("valid-defaults.json", tempRoot);
  const configPath = path.join(repoPath, ".blueprint/config.json");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await writeInitializedBlueprintArtifacts(repoPath);
  await writeFile(
    configPath,
    JSON.stringify(
      {
        version: 2,
        model_profile: "balanced"
      },
      null,
      2
    ),
    "utf8"
  );

  await withEnvOverrides({ BLUEPRINT_GLOBAL_HOME: tempRoot }, async () => {
    const result = await blueprintConfigSet({
      cwd: repoPath,
      defaultsPath,
      patch: {
        workflow: {
          subagents: false
        }
      }
    });
    const afterConfig = await readJsonFile<Record<string, unknown>>(configPath);
    const effectiveConfig = await blueprintConfigGet({
      cwd: repoPath,
      defaultsPath,
      scope: "effective"
    });

    assert.deepEqual(result.updatedKeys, ["workflow.subagents"]);
    assert.deepEqual(afterConfig, {
      version: 2,
      model_profile: "balanced",
      workflow: {
        subagents: false
      }
    });
    assert.equal(effectiveConfig.config.model_profile, "balanced");
    assert.equal(effectiveConfig.config.mode, "auto");
    assert.equal(effectiveConfig.config.workflow.secure_phase, false);
    assert.equal(effectiveConfig.config.workflow.subagents, false);
    assert.equal(effectiveConfig.config.workflow.verifier, true);
    assert.equal("planning" in afterConfig, false);
    assert.equal("parallelization" in afterConfig, false);
  });
});

test("config_set preserves migrated legacy parallelization overrides during unrelated writes", async (t) => {
  const repoPath = await createRepoFromFixture("missing-config-repo");
  const tempRoot = path.dirname(repoPath);
  const configPath = path.join(repoPath, ".blueprint/config.json");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await writeInitializedBlueprintArtifacts(repoPath);
  await writeFile(
    configPath,
    JSON.stringify(
      {
        version: 2,
        model_profile: "balanced",
        parallelization: false
      },
      null,
      2
    ),
    "utf8"
  );

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      workflow: {
        subagents: false
      }
    }
  });
  const afterConfig = await readJsonFile<Record<string, unknown>>(configPath);

  assert.deepEqual(result.updatedKeys, ["workflow.subagents"]);
  assert.deepEqual(afterConfig, {
    version: 2,
    model_profile: "balanced",
    parallelization: {
      enabled: false
    },
    workflow: {
      subagents: false
    }
  });
  assert.equal(
    (result.config.parallelization as Record<string, unknown>).enabled,
    false
  );
});

test("config_get defaults workflow.subagents to true and project patches can disable it", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const before = await blueprintConfigGet({
    cwd: repoPath,
    scope: "effective"
  });

  assert.equal(before.config.workflow.subagents, true);

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      workflow: {
        subagents: false
      }
    }
  });
  const savedConfig = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.equal(result.config.workflow.subagents, false);
  assert.deepEqual(result.updatedKeys, ["workflow.subagents"]);
  assert.equal((savedConfig.workflow as Record<string, unknown>).subagents, false);
});

test("config_get defaults workflow.no_uat to false and project patches can enable it", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const before = await blueprintConfigGet({
    cwd: repoPath,
    scope: "effective"
  });

  assert.equal(before.config.workflow.no_uat, false);

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      workflow: {
        no_uat: true
      }
    }
  });
  const savedConfig = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.equal(result.config.workflow.no_uat, true);
  assert.deepEqual(result.updatedKeys, ["workflow.no_uat"]);
  assert.equal((savedConfig.workflow as Record<string, unknown>).no_uat, true);
});

test("config_get defaults workflow.secure_phase to false and project patches can enable it", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const before = await blueprintConfigGet({
    cwd: repoPath,
    scope: "effective"
  });

  assert.equal(before.config.workflow.secure_phase, false);

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      workflow: {
        secure_phase: true
      }
    }
  });
  const savedConfig = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.equal(result.config.workflow.secure_phase, true);
  assert.deepEqual(result.updatedKeys, ["workflow.secure_phase"]);
  assert.equal((savedConfig.workflow as Record<string, unknown>).secure_phase, true);
  assert.equal("no_uat" in (savedConfig.workflow as Record<string, unknown>), false);
  assert.equal("subagents" in (savedConfig.workflow as Record<string, unknown>), false);
});

test("config_set ignores invalid workflow.subagents values and warns", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      workflow: {
        subagents: "disabled"
      }
    }
  });

  assert.equal(result.config.workflow.subagents, true);
  assert.equal(result.updatedKeys.includes("workflow.subagents"), false);
  assert.match(result.warnings.join("\n"), /Ignored invalid config type for workflow\.subagents/);
});

test("config_set ignores invalid workflow.no_uat values and warns", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      workflow: {
        no_uat: "enabled"
      }
    }
  });

  assert.equal(result.config.workflow.no_uat, false);
  assert.equal(result.updatedKeys.includes("workflow.no_uat"), false);
  assert.match(result.warnings.join("\n"), /Ignored invalid config type for workflow\.no_uat/);
});

test("config_set ignores invalid workflow.secure_phase values and warns", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      workflow: {
        secure_phase: "required"
      }
    }
  });
  const savedConfig = await readJsonFile<Record<string, unknown>>(
    path.join(repoPath, ".blueprint/config.json")
  );

  assert.equal(result.config.workflow.secure_phase, false);
  assert.equal(result.updatedKeys.includes("workflow.secure_phase"), false);
  assert.equal("secure_phase" in (savedConfig.workflow as Record<string, unknown>), false);
  assert.match(
    result.warnings.join("\n"),
    /Ignored invalid config type for workflow\.secure_phase/
  );
});

test("config_set ignores invalid workflow.secure_phase values without materializing inherited defaults", async (t) => {
  const repoPath = await createRepoFromFixture("missing-config-repo");
  const tempRoot = path.dirname(repoPath);
  const configPath = path.join(repoPath, ".blueprint/config.json");
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await writeInitializedBlueprintArtifacts(repoPath);
  assert.equal(await pathExists(configPath), false);

  const result = await blueprintConfigSet({
    cwd: repoPath,
    patch: {
      workflow: {
        secure_phase: "required"
      }
    }
  });
  const savedConfig = await readJsonFile<Record<string, unknown>>(configPath);

  assert.equal(result.config.workflow.secure_phase, false);
  assert.equal(result.updatedKeys.includes("workflow.secure_phase"), false);
  assert.match(
    result.warnings.join("\n"),
    /Ignored invalid config type for workflow\.secure_phase/
  );
  assert.deepEqual(savedConfig, {
    version: 2
  });
  assert.equal("workflow" in savedConfig, false);
  assert.equal("secure_phase" in savedConfig, false);
});

test("defaults-scope writes for effectiveness-spine keys participate in effective precedence until project override", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const defaultsPath = await createDefaultsFile("valid-defaults.json", tempRoot);
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await withEnvOverrides({ BLUEPRINT_GLOBAL_HOME: tempRoot }, async () => {
    await blueprintConfigSet({
      cwd: repoPath,
      defaultsPath,
      scope: "defaults",
      patch: {
        ux: {
          progress_mode: "stage",
          structured_confirmations: "required",
          user_checkpoints: "plan"
        },
        orchestration: {
          task_tracker: "auto"
        },
        research: {
          external_sources: "ask"
        },
        workflow: {
          subagents: false,
          secure_phase: true
        }
      }
    });

    const effectiveBeforeProjectOverride = await blueprintConfigGet({
      cwd: repoPath,
      defaultsPath,
      scope: "effective"
    });

    assert.deepEqual(effectiveBeforeProjectOverride.config.ux, {
      progress_mode: "stage",
      structured_confirmations: "required",
      user_checkpoints: "plan"
    });
    assert.deepEqual(effectiveBeforeProjectOverride.config.orchestration, {
      task_tracker: "auto"
    });
    assert.deepEqual(effectiveBeforeProjectOverride.config.research, {
      external_sources: "ask"
    });
    assert.equal(effectiveBeforeProjectOverride.config.workflow.secure_phase, true);
    assert.equal(effectiveBeforeProjectOverride.config.workflow.subagents, false);

    const projectOverride = await blueprintConfigSet({
      cwd: repoPath,
      defaultsPath,
      patch: {
        ux: {
          progress_mode: "checklist"
        },
        orchestration: {
          task_tracker: "off"
        },
        research: {
          external_sources: "auto"
        },
        workflow: {
          subagents: true,
          secure_phase: false
        }
      }
    });

    assert.deepEqual(projectOverride.config.ux, {
      progress_mode: "checklist",
      structured_confirmations: "required",
      user_checkpoints: "plan"
    });
    assert.deepEqual(projectOverride.config.orchestration, {
      task_tracker: "off"
    });
    assert.deepEqual(projectOverride.config.research, {
      external_sources: "auto"
    });
    assert.equal(projectOverride.config.workflow.secure_phase, false);
    assert.equal(projectOverride.config.workflow.subagents, true);

    const effectiveAfterProjectOverride = await blueprintConfigGet({
      cwd: repoPath,
      defaultsPath,
      scope: "effective"
    });

    assert.deepEqual(effectiveAfterProjectOverride.config.ux, {
      progress_mode: "checklist",
      structured_confirmations: "required",
      user_checkpoints: "plan"
    });
    assert.deepEqual(effectiveAfterProjectOverride.config.orchestration, {
      task_tracker: "off"
    });
    assert.deepEqual(effectiveAfterProjectOverride.config.research, {
      external_sources: "auto"
    });
    assert.equal(effectiveAfterProjectOverride.config.workflow.secure_phase, false);
    assert.equal(effectiveAfterProjectOverride.config.workflow.subagents, true);
  });
});

test("settings and set-profile command contracts reference the registered MCP tools", async () => {
  const settingsCommand = await readFile(
    path.join(repoRoot, "commands/blu-settings.toml"),
    "utf8"
  );
  const setProfileCommand = await readFile(
    path.join(repoRoot, "commands/blu-set-profile.toml"),
    "utf8"
  );
  const settingsTools = [
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_config_set"
  ];
  const setProfileTools = [
    "blueprint_config_get",
    "blueprint_config_set_profile"
  ];

  for (const toolName of settingsTools) {
    assert.ok(
      blueprintToolNames.includes(toolName),
      `${toolName} should be registered in the MCP server`
    );
    assert.match(settingsCommand, new RegExp(toolName));
  }

  for (const toolName of setProfileTools) {
    assert.ok(
      blueprintToolNames.includes(toolName),
      `${toolName} should be registered in the MCP server`
    );
    assert.match(setProfileCommand, new RegExp(toolName));
  }

  assert.match(setProfileCommand, /quality\|balanced\|budget\|inherit/);
  assert.match(setProfileCommand, /defaults\.json/);
});
