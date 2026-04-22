import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintConfigGet,
  blueprintConfigSet,
  blueprintConfigSetProfile
} from "../src/mcp/tools/config.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(repoRoot, "tests/fixtures/settings-profile");

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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-settings-profile-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");

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

test("config_set persists normalized version 2 config for initialized repos", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

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
  assert.deepEqual(config.ux, {
    progress_mode: "quiet",
    structured_confirmations: "auto",
    user_checkpoints: "off"
  });
  assert.deepEqual(config.orchestration, {
    task_tracker: "off"
  });
  assert.deepEqual(config.research, {
    external_sources: "off"
  });
});

test("config_set_profile changes only model_profile and leaves saved defaults unchanged", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const defaultsPath = await createDefaultsFile("valid-defaults.json", tempRoot);
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

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
  expectedConfig.ux = {
    progress_mode: "quiet",
    structured_confirmations: "auto",
    user_checkpoints: "off"
  };
  expectedConfig.orchestration = {
    task_tracker: "off"
  };
  expectedConfig.research = {
    external_sources: "off"
  };

  assert.deepEqual(result.updatedKeys, ["model_profile"]);
  assert.equal(result.profile, "budget");
  assert.equal(result.configPath, ".blueprint/config.json");
  assert.equal(afterConfig.model_profile, "budget");
  assert.deepEqual(afterConfig, expectedConfig);
  assert.equal(defaultsAfter, defaultsBefore);
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
    /Blueprint project config is missing/
  );

  assert.equal(await pathExists(configPath), false);
});

test("config_set rejects reserved repo keys for hooks and removed workflow flags", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

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
  assert.equal("use_workspaces" in workflow, false);
  assert.equal("use_workstreams" in workflow, false);
  assert.equal("hooks" in config, false);
  assert.ok("gates" in config);
  assert.ok("safety" in config);
  assert.ok("maintenance" in config);
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("Migrated legacy config key commit_docs")
    )
  );
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

test("defaults-scope writes for effectiveness-spine keys participate in effective precedence until project override", async (t) => {
  const repoPath = await createRepoFromFixture("initialized-repo");
  const tempRoot = path.dirname(repoPath);
  const defaultsPath = await createDefaultsFile("valid-defaults.json", tempRoot);
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

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
