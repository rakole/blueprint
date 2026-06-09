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
import { createGitRepo } from "./helpers/git-fixtures.js";

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

  assert.deepEqual(result.updatedKeys, ["model_profile"]);
  assert.equal(result.profile, "budget");
  assert.equal(result.configPath, ".blueprint/config.json");
  assert.equal(afterConfig.model_profile, "budget");
  assert.deepEqual(afterConfig, expectedConfig);
  assert.equal(defaultsAfter, defaultsBefore);
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
