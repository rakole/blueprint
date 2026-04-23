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
  blueprintUpdatePlan
} from "../src/mcp/tools/update.js";

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
  assert.equal(result.savedPaths.updatesDir, path.join(globalHome, "updates"));
  assert.equal(result.savedPaths.metadataPath, path.join(globalHome, "updates", "update-plan-latest.json"));
  assert.equal(result.savedPaths.checklistPath, path.join(globalHome, "updates", "update-plan-latest.md"));
  assert.equal(result.path, result.savedPaths.metadataPath);
  assert.equal(result.steps.length, 7);
  assert.match(result.notes.join("\n"), /manual fallback/i);

  const metadata = JSON.parse(
    await fs.readFile(result.savedPaths.metadataPath, "utf8")
  ) as { mode: string; requiresRestart: boolean; savedPaths: { updatesDir: string } };
  const checklist = await fs.readFile(result.savedPaths.checklistPath, "utf8");
  const filesAfter = await listRelativeFiles(extensionPath);

  assert.equal(metadata.mode, "manual");
  assert.equal(metadata.requiresRestart, true);
  assert.equal(metadata.savedPaths.updatesDir, result.savedPaths.updatesDir);
  assert.match(checklist, /Restart Gemini CLI or Tabnine CLI/i);
  assert.match(checklist, /Install provenance: extension-path-only/i);
  assert.match(checklist, new RegExp(`Install source: ${extensionPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
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
  assert.match(result.warnings.join("\n"), /Unable to persist Blueprint update artifacts/i);
  await assert.rejects(fs.access(result.savedPaths.metadataPath));
  await assert.rejects(fs.access(result.savedPaths.checklistPath));
});
