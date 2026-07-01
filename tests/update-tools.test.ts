import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  blueprintToolNames,
  blueprintToolRegistry,
  isMutationTool
} from "../src/mcp/server.js";
import {
  blueprintUpdateCheck,
  blueprintUpdatePlan,
  updateToolTestHooks
} from "../src/mcp/tools/update.js";

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

async function assertStillPending<T>(
  promise: Promise<T>,
  label: string,
  delayMs = 80
): Promise<void> {
  const pending = Symbol("pending");
  const result = await Promise.race([
    promise,
    sleep(delayMs).then(() => pending)
  ]);

  assert.equal(result, pending, `${label} should still be pending`);
}

async function withUpdateEnv<T>(
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

async function createExtensionFixture(
  tempRoot: string,
  host: "gemini" | "tabnine" = "gemini"
): Promise<string> {
  const extensionPath = path.join(tempRoot, "installed-extension");
  const manifestFileName = host === "gemini" ? "gemini-extension.json" : "tabnine-extension.json";
  const contextFileName = host === "gemini" ? "GEMINI.md" : "TABNINE.md";

  await fs.mkdir(extensionPath, { recursive: true });
  await fs.writeFile(
    path.join(extensionPath, "package.json"),
    JSON.stringify(
      {
        name: "blueprint",
        version: "0.1.0"
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.writeFile(
    path.join(extensionPath, manifestFileName),
    JSON.stringify(
      {
        name: "blueprint",
        version: "0.1.0",
        contextFileName
      },
      null,
      2
    ),
    "utf8"
  );

  return extensionPath;
}

async function listRelativeFiles(rootPath: string): Promise<string[]> {
  const entries: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const directoryEntries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of directoryEntries) {
      const absolutePath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      entries.push(path.relative(rootPath, absolutePath));
    }
  }

  await walk(rootPath);
  return entries.sort();
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("update tools register the advisory check plus mutating plan entries", () => {
  assert.ok(
    blueprintToolNames.includes("blueprint_update_check"),
    "blueprint_update_check should be registered"
  );
  assert.ok(
    blueprintToolNames.includes("blueprint_update_plan"),
    "blueprint_update_plan should be registered"
  );
  assert.equal(isMutationTool("blueprint_update_check"), false);
  assert.equal(isMutationTool("blueprint_update_plan"), true);
  assert.equal(
    blueprintToolRegistry.blueprint_update_plan.inputSchema.mode.safeParse("ask_user").success,
    true
  );
  assert.equal(
    blueprintToolRegistry.blueprint_update_plan.inputSchema.mode.safeParse("manual").success,
    true
  );
});

test("blueprint_update_check returns advisory manual fallback metadata when remote lookup is unavailable", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-check-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createExtensionFixture(tempRoot, "gemini");

  const result = await withUpdateEnv(
    {
      BLUEPRINT_HOST: "gemini",
      BLUEPRINT_GLOBAL_HOME: globalHome,
      BLUEPRINT_EXTENSION_PATH: extensionPath
    },
    () => blueprintUpdateCheck()
  );

  assert.equal(result.host, "gemini");
  assert.equal(result.extensionPath, extensionPath);
  assert.equal(result.extensionManifestPath, path.join(extensionPath, "gemini-extension.json"));
  assert.equal(result.installedVersion, "0.1.0");
  assert.equal(result.installProvenance.kind, "extension-path-only");
  assert.equal(result.installProvenance.source, extensionPath);
  assert.equal(result.latestVersionLookupStatus, "manual_only");
  assert.equal(result.latestVersion, null);
  assert.equal(result.latestVersionSource, null);
  assert.equal(result.updateAvailable, null);
  assert.match(result.warnings.join("\n"), /manual update checklist/i);
});

test("blueprint_update_check converts malformed installed metadata into warnings instead of throwing", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-malformed-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createExtensionFixture(tempRoot, "gemini");

  await fs.writeFile(path.join(extensionPath, "gemini-extension.json"), "{\n", "utf8");
  await fs.writeFile(path.join(extensionPath, "package.json"), "{\n", "utf8");

  const result = await withUpdateEnv(
    {
      BLUEPRINT_HOST: "gemini",
      BLUEPRINT_GLOBAL_HOME: globalHome,
      BLUEPRINT_EXTENSION_PATH: extensionPath
    },
    () => blueprintUpdateCheck()
  );

  assert.equal(result.extensionPath, extensionPath);
  assert.equal(result.extensionManifestPath, path.join(extensionPath, "gemini-extension.json"));
  assert.equal(result.installedVersion, null);
  assert.equal(result.installProvenance.kind, "extension-path-only");
  assert.equal(result.latestVersionLookupStatus, "manual_only");
  assert.equal(result.updateAvailable, null);
  assert.match(
    result.warnings.join("\n"),
    /Unable to read Blueprint metadata from .*gemini-extension\.json/i
  );
  assert.match(
    result.warnings.join("\n"),
    /Unable to read Blueprint metadata from .*package\.json/i
  );
  assert.match(result.warnings.join("\n"), /Unable to determine the installed Blueprint version/i);
});

test("blueprint_update_check treats a missing configured extension path as not installed", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-missing-path-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = path.join(tempRoot, "missing-extension");

  const result = await withUpdateEnv(
    {
      BLUEPRINT_HOST: "gemini",
      BLUEPRINT_GLOBAL_HOME: globalHome,
      BLUEPRINT_EXTENSION_PATH: extensionPath
    },
    () => blueprintUpdateCheck()
  );

  assert.equal(result.extensionPath, extensionPath);
  assert.equal(result.extensionManifestPath, path.join(extensionPath, "gemini-extension.json"));
  assert.equal(result.installedVersion, null);
  assert.equal(result.installProvenance.kind, "unknown");
  assert.equal(result.installProvenance.source, null);
  assert.equal(result.latestVersionLookupStatus, "not_installed");
  assert.equal(result.latestVersion, null);
  assert.equal(result.latestVersionSource, null);
  assert.equal(result.updateAvailable, null);
  assert.match(result.warnings.join("\n"), /Configured extension path does not exist/i);
  assert.match(
    result.warnings.join("\n"),
    /cannot resolve a latest version because no installed extension was found/i
  );
});

test("blueprint_update_plan persists only under the host-global updates directory and leaves the install untouched", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-plan-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createExtensionFixture(tempRoot, "tabnine");
  const filesBefore = await listRelativeFiles(extensionPath);

  const result = await withUpdateEnv(
    {
      BLUEPRINT_HOST: "tabnine",
      BLUEPRINT_GLOBAL_HOME: globalHome,
      BLUEPRINT_EXTENSION_PATH: extensionPath
    },
    () => blueprintUpdatePlan({ mode: "manual" })
  );

  assert.equal(result.host, "tabnine");
  assert.equal(result.mode, "manual");
  assert.equal(result.requiresRestart, true);
  assert.equal(result.status, "created");
  assert.equal(result.persistenceStatus, "saved");
  assert.equal(result.savedPaths.updatesDir, path.join(globalHome, "updates"));
  assert.equal(result.savedPaths.metadataPath, path.join(globalHome, "updates", "update-plan-latest.json"));
  assert.equal(result.savedPaths.checklistPath, path.join(globalHome, "updates", "update-plan-latest.md"));
  assert.equal(result.intendedPath, result.savedPaths.metadataPath);
  assert.equal(result.path, result.savedPaths.metadataPath);
  assert.equal(result.steps.length, 7);
  assert.match(result.notes.join("\n"), /manual fallback/i);

  const metadata = JSON.parse(
    await fs.readFile(result.savedPaths.metadataPath, "utf8")
  ) as {
    mode: string;
    requiresRestart: boolean;
    savedPaths: { updatesDir: string };
    intendedPath: string;
    path: string;
    persistenceStatus: string;
  };
  const checklist = await fs.readFile(result.savedPaths.checklistPath, "utf8");
  const filesAfter = await listRelativeFiles(extensionPath);

  assert.equal(metadata.mode, "manual");
  assert.equal(metadata.requiresRestart, true);
  assert.equal(metadata.savedPaths.updatesDir, result.savedPaths.updatesDir);
  assert.equal(metadata.intendedPath, result.savedPaths.metadataPath);
  assert.equal(metadata.path, result.savedPaths.metadataPath);
  assert.equal(metadata.persistenceStatus, "saved");
  assert.match(checklist, /Restart Gemini CLI or Tabnine CLI/i);
  assert.match(checklist, /Install provenance: extension-path-only/i);
  assert.match(checklist, new RegExp(`Install source: ${escapeRegExp(extensionPath)}`));
  assert.deepEqual(filesAfter, filesBefore);
  await assert.rejects(fs.access(path.join(extensionPath, "updates")));
});

test("blueprint_update_plan defaults checklist mode to the active host", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-plan-defaults-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const tabnineHome = path.join(tempRoot, "tabnine-home");
  const tabnineExtensionPath = await createExtensionFixture(path.join(tempRoot, "tabnine"), "tabnine");

  const tabnineResult = await withUpdateEnv(
    {
      BLUEPRINT_HOST: "tabnine",
      BLUEPRINT_GLOBAL_HOME: tabnineHome,
      BLUEPRINT_EXTENSION_PATH: tabnineExtensionPath
    },
    () => blueprintUpdatePlan()
  );

  const tabnineChecklist = await fs.readFile(tabnineResult.savedPaths.checklistPath, "utf8");

  assert.equal(tabnineResult.mode, "manual");
  assert.doesNotMatch(tabnineChecklist, /Use Gemini CLI `ask_user`/i);
  assert.match(tabnineChecklist, /structured `ask_user` is unavailable or not desired/i);

  const geminiHome = path.join(tempRoot, "gemini-home");
  const geminiExtensionPath = await createExtensionFixture(path.join(tempRoot, "gemini"), "gemini");

  const geminiResult = await withUpdateEnv(
    {
      BLUEPRINT_HOST: "gemini",
      BLUEPRINT_GLOBAL_HOME: geminiHome,
      BLUEPRINT_EXTENSION_PATH: geminiExtensionPath
    },
    () => blueprintUpdatePlan()
  );

  const geminiChecklist = await fs.readFile(geminiResult.savedPaths.checklistPath, "utf8");

  assert.equal(geminiResult.mode, "ask_user");
  assert.match(geminiChecklist, /Use Gemini CLI `ask_user`/i);
});

test("blueprint_update_plan falls back cleanly when checklist persistence fails", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-plan-write-failure-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createExtensionFixture(tempRoot, "gemini");
  const realWriteFile = fs.writeFile.bind(fs);
  let simulatedFailureTriggered = false;

  t.mock.method(fs, "writeFile", async (filePath, data, options) => {
    const normalizedPath =
      typeof filePath === "string" ? filePath : path.resolve(String(filePath));

    if (normalizedPath.includes("update-plan-latest.md.tmp-")) {
      simulatedFailureTriggered = true;
      throw new Error("simulated checklist write failure");
    }

    return realWriteFile(
      filePath as Parameters<typeof fs.writeFile>[0],
      data as Parameters<typeof fs.writeFile>[1],
      options as Parameters<typeof fs.writeFile>[2]
    );
  });

  const result = await withUpdateEnv(
    {
      BLUEPRINT_HOST: "gemini",
      BLUEPRINT_GLOBAL_HOME: globalHome,
      BLUEPRINT_EXTENSION_PATH: extensionPath
    },
    () => blueprintUpdatePlan({ mode: "manual" })
  );

  assert.equal(simulatedFailureTriggered, true);
  assert.equal(result.persistenceStatus, "not_saved");
  assert.equal(result.path, null);
  assert.equal(result.intendedPath, result.savedPaths.metadataPath);
  assert.match(result.warnings.join("\n"), /Unable to persist Blueprint update artifacts/i);
  await assert.rejects(fs.access(result.savedPaths.metadataPath));
  await assert.rejects(fs.access(result.savedPaths.checklistPath));
});

test("blueprint_update_plan serializes concurrent saves and reports created then updated", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-plan-lock-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createExtensionFixture(tempRoot, "gemini");
  const updatesDir = path.join(globalHome, "updates");
  const metadataPath = path.join(updatesDir, "update-plan-latest.json");
  const checklistPath = path.join(updatesDir, "update-plan-latest.md");
  const env = {
    ...process.env,
    BLUEPRINT_HOST: "gemini",
    BLUEPRINT_GLOBAL_HOME: globalHome,
    BLUEPRINT_EXTENSION_PATH: extensionPath
  };
  const realRename = fs.rename.bind(fs);
  let releaseMetadataPromotion!: () => void;
  let metadataPromotionReached!: () => void;
  let delayedFirstMetadataPromotion = false;
  const metadataPromotionRelease = new Promise<void>((resolve) => {
    releaseMetadataPromotion = resolve;
  });
  const metadataPromotionStarted = new Promise<void>((resolve) => {
    metadataPromotionReached = resolve;
  });

  t.mock.method(fs, "rename", async (oldPath, newPath) => {
    const destination = typeof newPath === "string" ? newPath : path.resolve(String(newPath));

    if (destination === metadataPath && !delayedFirstMetadataPromotion) {
      delayedFirstMetadataPromotion = true;
      metadataPromotionReached();
      await metadataPromotionRelease;
    }

    return realRename(
      oldPath as Parameters<typeof fs.rename>[0],
      newPath as Parameters<typeof fs.rename>[1]
    );
  });

  const firstPlan = blueprintUpdatePlan({ mode: "manual" }, env);
  await metadataPromotionStarted;
  const secondPlan = blueprintUpdatePlan({ mode: "manual" }, env);

  releaseMetadataPromotion();
  const [firstResult, secondResult] = await Promise.all([firstPlan, secondPlan]);

  assert.equal(firstResult.persistenceStatus, "saved");
  assert.equal(secondResult.persistenceStatus, "saved");
  assert.equal(firstResult.status, "created");
  assert.equal(secondResult.status, "updated");
  assert.equal(firstResult.path, metadataPath);
  assert.equal(secondResult.path, metadataPath);

  const finalMetadata = JSON.parse(await fs.readFile(metadataPath, "utf8")) as {
    generatedAt: string;
    status: string;
    persistenceStatus: string;
  };
  const finalChecklist = await fs.readFile(checklistPath, "utf8");

  assert.equal(finalMetadata.status, "updated");
  assert.equal(finalMetadata.persistenceStatus, "saved");
  assert.match(finalChecklist, new RegExp(`Generated: ${escapeRegExp(finalMetadata.generatedAt)}`));
  assert.deepEqual((await fs.readdir(updatesDir)).sort(), [
    "update-plan-latest.json",
    "update-plan-latest.md"
  ]);
});

test("blueprint_update_plan serializes waiters recovering an abandoned lock", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-plan-stale-lock-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createExtensionFixture(tempRoot, "gemini");
  const updatesDir = path.join(globalHome, "updates");
  const lockPath = path.join(updatesDir, "update-plan-latest.lock");
  const env = {
    ...process.env,
    BLUEPRINT_HOST: "gemini",
    BLUEPRINT_GLOBAL_HOME: globalHome,
    BLUEPRINT_EXTENSION_PATH: extensionPath
  };

  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner"), "abandoned-owner\n", "utf8");
  await fs.writeFile(path.join(lockPath, "lease"), "abandoned-owner\n", "utf8");

  const restoreTiming = updateToolTestHooks.setUpdatePlanLockTimingForTest({
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

  const restoreRecoveryHooks = updateToolTestHooks.setUpdatePlanLockRecoveryHooksForTest({
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
    updateToolTestHooks.setUpdatePlanLockCallbackObserverForTest(
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

  const firstPlan = blueprintUpdatePlan({ mode: "manual" }, env);
  const secondPlan = blueprintUpdatePlan({ mode: "manual" }, env);
  const waiters = Promise.all([firstPlan, secondPlan]);
  let preReleaseError: unknown;

  try {
    await waitFor(firstCallbackEntered.promise, "first recovered update-plan callback");
    await sleep(80);
    assert.equal(maxActiveCallbacks, 1);
    assert.equal(events.filter((entry) => entry === "enter").length, 1);
  } catch (error) {
    preReleaseError = error;
  } finally {
    releaseFirstCallback.resolve();
  }

  const [firstResult, secondResult] = await waitFor(waiters, "update-plan stale waiters");

  if (preReleaseError !== undefined) {
    throw preReleaseError;
  }

  assert.equal(staleRecoveryAttempts, 2);
  assert.equal(maxActiveCallbacks, 1);
  assert.equal(activeCallbacks, 0);
  assert.deepEqual(
    [firstResult.status, secondResult.status].sort(),
    ["created", "updated"]
  );
  assert.equal(firstResult.persistenceStatus, "saved");
  assert.equal(secondResult.persistenceStatus, "saved");
  assert.equal(await pathExists(lockPath), false);
  assert.deepEqual(
    (await fs.readdir(updatesDir)).filter((entry) =>
      entry.includes("update-plan-latest.lock")
    ),
    []
  );
});

test("blueprint_update_plan preserves a replacement owner acquired during stale quarantine", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-plan-replacement-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createExtensionFixture(tempRoot, "gemini");
  const updatesDir = path.join(globalHome, "updates");
  const lockPath = path.join(updatesDir, "update-plan-latest.lock");
  const env = {
    ...process.env,
    BLUEPRINT_HOST: "gemini",
    BLUEPRINT_GLOBAL_HOME: globalHome,
    BLUEPRINT_EXTENSION_PATH: extensionPath
  };

  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, "owner"), "abandoned-owner\n", "utf8");
  await fs.writeFile(path.join(lockPath, "lease"), "abandoned-owner\n", "utf8");

  const restoreTiming = updateToolTestHooks.setUpdatePlanLockTimingForTest({
    retryMs: 5,
    staleMs: 80,
    heartbeatMs: 20
  });
  t.after(() => {
    restoreTiming();
  });
  await sleep(130);

  const replacementEntered = deferred();
  const releaseReplacement = deferred();
  let replacementPlan: Promise<unknown> | null = null;
  let callbackEntries = 0;
  let quarantineAttempts = 0;

  t.after(() => {
    releaseReplacement.resolve();
  });

  const restoreCallbackObserver =
    updateToolTestHooks.setUpdatePlanLockCallbackObserverForTest(
      async (event, observedLockPath) => {
        assert.equal(observedLockPath, lockPath);

        if (event === "enter") {
          callbackEntries += 1;

          if (callbackEntries === 1) {
            replacementEntered.resolve();
            await releaseReplacement.promise;
          }
        }
      }
    );
  t.after(() => {
    restoreCallbackObserver();
  });

  const restoreRecoveryHooks = updateToolTestHooks.setUpdatePlanLockRecoveryHooksForTest({
    beforeStaleLockQuarantine: async (observedLockPath) => {
      assert.equal(observedLockPath, lockPath);
      quarantineAttempts += 1;
      assert.equal(quarantineAttempts, 1);

      await fs.rm(lockPath, { recursive: true, force: true });
      replacementPlan = blueprintUpdatePlan({ mode: "manual" }, env);
      await replacementEntered.promise;
    }
  });
  t.after(() => {
    restoreRecoveryHooks();
  });

  const originalPlan = blueprintUpdatePlan({ mode: "manual" }, env);

  await waitFor(replacementEntered.promise, "replacement update-plan callback");
  await assertStillPending(originalPlan, "original update-plan while replacement lock is active", 40);

  assert.notEqual(
    (await fs.readFile(path.join(lockPath, "owner"), "utf8")).trim(),
    "abandoned-owner"
  );

  releaseReplacement.resolve();
  await waitFor(replacementPlan ?? Promise.resolve(), "replacement update-plan release");
  const originalResult = await waitFor(originalPlan, "original update-plan after replacement");

  assert.equal(quarantineAttempts, 1);
  assert.equal(originalResult.persistenceStatus, "saved");
  assert.equal(callbackEntries, 2);
  assert.equal(await pathExists(lockPath), false);
});

test("blueprint_update_plan restores the previous metadata and checklist generation when promotion fails", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-update-plan-rollback-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const globalHome = path.join(tempRoot, "global-home");
  const extensionPath = await createExtensionFixture(tempRoot, "gemini");
  const env = {
    ...process.env,
    BLUEPRINT_HOST: "gemini",
    BLUEPRINT_GLOBAL_HOME: globalHome,
    BLUEPRINT_EXTENSION_PATH: extensionPath
  };
  const firstResult = await blueprintUpdatePlan({ mode: "manual" }, env);
  const originalMetadata = await fs.readFile(firstResult.savedPaths.metadataPath, "utf8");
  const originalChecklist = await fs.readFile(firstResult.savedPaths.checklistPath, "utf8");
  const realRename = fs.rename.bind(fs);
  let simulatedFailureTriggered = false;

  t.mock.method(fs, "rename", async (oldPath, newPath) => {
    const source = typeof oldPath === "string" ? oldPath : path.resolve(String(oldPath));
    const destination = typeof newPath === "string" ? newPath : path.resolve(String(newPath));

    if (
      destination === firstResult.savedPaths.checklistPath &&
      source.includes("update-plan-latest.md.tmp-")
    ) {
      simulatedFailureTriggered = true;
      throw new Error("simulated checklist promotion failure");
    }

    return realRename(
      oldPath as Parameters<typeof fs.rename>[0],
      newPath as Parameters<typeof fs.rename>[1]
    );
  });

  const failedResult = await blueprintUpdatePlan({ mode: "manual" }, env);

  assert.equal(simulatedFailureTriggered, true);
  assert.equal(failedResult.status, "updated");
  assert.equal(failedResult.persistenceStatus, "not_saved");
  assert.equal(failedResult.path, null);
  assert.equal(failedResult.intendedPath, firstResult.savedPaths.metadataPath);
  assert.match(
    failedResult.warnings.join("\n"),
    /Unable to persist Blueprint update artifacts/i
  );
  assert.equal(
    await fs.readFile(firstResult.savedPaths.metadataPath, "utf8"),
    originalMetadata
  );
  assert.equal(
    await fs.readFile(firstResult.savedPaths.checklistPath, "utf8"),
    originalChecklist
  );
  assert.deepEqual((await fs.readdir(firstResult.savedPaths.updatesDir)).sort(), [
    "update-plan-latest.json",
    "update-plan-latest.md"
  ]);
});
