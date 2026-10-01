import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { createBlueprintActivationHooks } from "../src/opencode/activation.js";
import { loadBlueprintNativeAssets } from "../src/opencode/assets.js";
import {
  allowBlueprintPackageReads,
  mergePermissionWithCallerRestrictions,
  resolveBlueprintPluginGlobalHome
} from "../src/opencode/plugin.js";
import { parseNativeMarkdown } from "../src/shared/native-frontmatter.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const fixtureRoot = path.join(repoRoot, "tests", "fixtures", "opencode");
const expectedVersion = "1.18.34";
const expectedSourceCommit = "aec0b9a6d8898f68f923aaf08b7306d931fd9d76";
const expectedDarwinArm64Sha256 = "7b63b34fafabded7d9231f6a9032755d0cdeaf8b9d2b70df8e25535471469eea";

type RunResult = { status: number | null; stdout: string; stderr: string };

function run(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv; timeout?: number }): RunResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeout ?? 60_000,
    maxBuffer: 10 * 1024 * 1024
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function assertSuccess(result: RunResult, label: string): void {
  assert.equal(result.status, 0, `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

async function sha256(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function stageAndInstallPackage(tempRoot: string): Promise<string> {
  const packed = path.join(tempRoot, "packed");
  const prefix = path.join(tempRoot, "consumer");
  await mkdir(packed, { recursive: true });

  const packedResult = run("npm", ["pack", repoRoot, "--ignore-scripts", "--pack-destination", packed, "--json"], {
    cwd: tempRoot,
    env: { ...process.env, npm_config_cache: path.join(tempRoot, "npm-cache") }
  });
  assertSuccess(packedResult, "npm pack");
  const packOutput = JSON.parse(packedResult.stdout) as Array<{ filename: string }>;
  assert.equal(packOutput.length, 1);
  const tarball = path.join(packed, packOutput[0].filename);
  const installResult = run("npm", ["install", "--prefix", prefix, "--omit=dev", "--ignore-scripts", tarball], {
    cwd: tempRoot,
    env: { ...process.env, npm_config_cache: path.join(tempRoot, "npm-cache") },
    timeout: 120_000
  });
  assertSuccess(installResult, "isolated tarball install");
  return path.join(prefix, "node_modules", "blueprint");
}

async function isolatedHostEnvironment(
  tempRoot: string,
  packageRoot: string
): Promise<{ env: NodeJS.ProcessEnv; project: string; config: string }> {
  const project = path.join(tempRoot, "customer-project");
  const home = path.join(tempRoot, "home");
  const xdg = path.join(tempRoot, "xdg");
  await Promise.all([mkdir(project, { recursive: true }), mkdir(home, { recursive: true }), mkdir(xdg, { recursive: true })]);
  const pluginEntry = path.join(packageRoot, "dist", "opencode", "plugin.js");
  const template = await readFile(path.join(fixtureRoot, "bootstrap", "opencode.json"), "utf8");
  const config = path.join(tempRoot, "opencode.json");
  await writeFile(config, template.replace("__BLUEPRINT_PLUGIN_URL__", pathToFileURL(pluginEntry).href));
  return {
    project,
    config,
    env: {
      ...process.env,
      HOME: home,
      XDG_DATA_HOME: path.join(xdg, "data"),
      XDG_CONFIG_HOME: path.join(xdg, "config"),
      XDG_CACHE_HOME: path.join(xdg, "cache"),
      XDG_STATE_HOME: path.join(xdg, "state"),
      OPENCODE_CONFIG: config,
      OPENCODE_DISABLE_PROJECT_CONFIG: "true",
      BLUEPRINT_NODE_EXECUTABLE: process.execPath
    }
  };
}

test("strict native frontmatter rejects duplicate keys and non-mappings", () => {
  assert.throws(
    () => parseNativeMarkdown("---\nname: one\nname: two\n---\nbody", "duplicate.md"),
    /invalid YAML frontmatter|Map keys must be unique/
  );
  assert.throws(() => parseNativeMarkdown("---\n- one\n---\nbody", "array.md"), /must be a mapping/);
  assert.deepEqual(parseNativeMarkdown("---\nname: one\n---\nbody\n", "valid.md"), {
    frontmatter: { name: "one" },
    body: "body\n"
  });
});

test("caller wildcard and specific restrictions keep final permission precedence", () => {
  const merged = mergePermissionWithCallerRestrictions(
    {
      "*": "deny",
      read: { "*": "allow", "safe/**": "allow" },
      bash: { pwd: "allow" }
    },
    {
      "*": "ask",
      read: { "*": "deny", "docs/**": "ask" },
      bash: "deny"
    }
  );
  assert.deepEqual(Object.keys(merged), ["*", "read", "bash"]);
  assert.deepEqual(merged.read, { "*": "deny", "safe/**": "ask" });
  assert.equal(merged.bash, "deny");
  assert.equal(merged["*"], "deny");

  assert.deepEqual(
    mergePermissionWithCallerRestrictions(
      { "*": "deny", read: "allow" },
      { bash: { pwd: "ask" } }
    ),
    { "*": "deny", read: "allow" }
  );

  assert.deepEqual(
    mergePermissionWithCallerRestrictions(
      { "*": "deny", bash: { pwd: "allow" } },
      { bash: { "rm *": "ask" } }
    ),
    { "*": "deny", bash: { pwd: "ask" } }
  );
});

test("primary projection grants only validated installed asset directories", () => {
  const packageRoot = path.resolve("/opt/blueprint");
  const skillDir = path.join(packageRoot, "skills", "blueprint-router");
  const projected = allowBlueprintPackageReads(
    { "*": "deny", external_directory: "deny", read: { "*": "allow" } },
    [skillDir]
  );
  assert.deepEqual(projected.external_directory, {
    "*": "deny",
    [`${skillDir}${path.sep}*`]: "allow"
  });
  const callerDenied = mergePermissionWithCallerRestrictions(projected, {
    external_directory: "deny"
  });
  assert.equal(callerDenied.external_directory, "deny");
  assert.equal((projected.external_directory as Record<string, string>)[`${path.dirname(packageRoot)}${path.sep}*`], undefined);
});

test("plugin global state honors explicit caller root before XDG fallback", () => {
  assert.equal(
    resolveBlueprintPluginGlobalHome("/opt/blueprint", {
      BLUEPRINT_GLOBAL_HOME: "/tmp/caller-blueprint-home",
      XDG_DATA_HOME: "/tmp/ignored-xdg"
    }),
    path.resolve("/tmp/caller-blueprint-home")
  );
  assert.equal(
    resolveBlueprintPluginGlobalHome("/opt/blueprint", {
      XDG_DATA_HOME: "/tmp/opencode-xdg"
    }),
    path.resolve("/tmp/opencode-xdg/opencode/blueprint")
  );
});

test("native asset loading rejects a symlinked package directory", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-opencode-symlink-"));
  const packageRoot = path.join(tempRoot, "package");
  const outside = path.join(tempRoot, "outside-commands");
  await Promise.all([
    mkdir(packageRoot, { recursive: true }),
    cp(path.join(repoRoot, "dist"), path.join(packageRoot, "dist"), { recursive: true }),
    cp(path.join(fixtureRoot, "registration", "agents"), path.join(packageRoot, "agents"), { recursive: true }),
    cp(path.join(fixtureRoot, "registration", "skills"), path.join(packageRoot, "skills"), { recursive: true }),
    cp(path.join(fixtureRoot, "registration", "commands"), outside, { recursive: true })
  ]);
  await symlink(outside, path.join(packageRoot, "commands"));
  await assert.rejects(loadBlueprintNativeAssets(packageRoot), /literal directory|escapes the package root|opencode-assets\.json/);
});

test("private helper activation is exact, correlated, revocable, and session isolated", async () => {
  const hooks = createBlueprintActivationHooks(
    new Set(["blueprint-project", "blueprint-god-review"]),
    { privateHelperQualified: true }
  );
  const parts = [{ type: "text", text: "review packet" }] as never[];
  const command = hooks["command.execute.before"]!;
  const message = hooks["chat.message"]!;
  const tool = hooks["tool.execute.before"]!;

  await assert.rejects(
    command({ command: "blueprint-project", sessionID: "alias", arguments: "" }, { parts }),
    /cannot run as slash commands/
  );

  await command(
    { command: "blu-code-review", sessionID: "eligible", arguments: "--feels-like-god" },
    { parts }
  );
  await message(
    { sessionID: "eligible", messageID: "m1" },
    { message: {} as never, parts }
  );
  await tool(
    { tool: "skill", sessionID: "eligible", callID: "c1" },
    { args: { name: "blueprint-god-review" } }
  );
  await assert.rejects(
    tool({ tool: "skill", sessionID: "child", callID: "c2" }, { args: { name: "blueprint-god-review" } }),
    /same active user dispatch/
  );

  await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "eligible" } } as never });
  await assert.rejects(
    tool({ tool: "skill", sessionID: "eligible", callID: "c3" }, { args: { name: "blueprint-god-review" } }),
    /same active user dispatch/
  );

  for (const argumentsValue of ["--feels-like-godly", "x--feels-like-god", '"--feels-like-god"', ""]) {
    await command(
      { command: "blu-code-review-fix", sessionID: `negative:${argumentsValue}`, arguments: argumentsValue },
      { parts }
    );
    await message(
      { sessionID: `negative:${argumentsValue}`, messageID: "m2" },
      { message: {} as never, parts }
    );
    await assert.rejects(
      tool(
        { tool: "skill", sessionID: `negative:${argumentsValue}`, callID: "c4" },
        { args: { name: "blueprint-god-review" } }
      ),
      /standalone --feels-like-god/
    );
  }

  await command(
    { command: "blu-code-review", sessionID: "overlap", arguments: "--feels-like-god" },
    { parts }
  );
  await command(
    { command: "blu-code-review", sessionID: "overlap", arguments: "--feels-like-god" },
    { parts }
  );
  await message({ sessionID: "overlap", messageID: "m3" }, { message: {} as never, parts });
  await assert.rejects(
    tool({ tool: "skill", sessionID: "overlap", callID: "c5" }, { args: { name: "blueprint-god-review" } }),
    /same active user dispatch/
  );
});

test("private helper stays blocked by default even for an otherwise eligible dispatch", async () => {
  const hooks = createBlueprintActivationHooks(
    new Set(["blueprint-project", "blueprint-god-review"])
  );
  const parts = [{ type: "text", text: "review packet" }] as never[];
  await hooks["command.execute.before"]!(
    { command: "blu-code-review", sessionID: "unqualified", arguments: "--feels-like-god" },
    { parts }
  );
  await hooks["chat.message"]!(
    { sessionID: "unqualified", messageID: "m1" },
    { message: {} as never, parts }
  );
  await assert.rejects(
    hooks["tool.execute.before"]!(
      { tool: "skill", sessionID: "unqualified", callID: "c1" },
      { args: { name: "blueprint-god-review" } }
    ),
    /has not been qualified on the actual host/
  );
});

test("pinned OpenCode loads the installed tarball plugin and projected native assets", async (t) => {
  const hostBinary = process.env.BLUEPRINT_OPENCODE_BIN;
  const sourceRoot = process.env.BLUEPRINT_OPENCODE_SOURCE;
  if (!hostBinary || !sourceRoot) {
    t.skip("set BLUEPRINT_OPENCODE_BIN and BLUEPRINT_OPENCODE_SOURCE for the pinned actual-host probe");
    return;
  }

  const version = run(hostBinary, ["--version"], { cwd: repoRoot });
  assertSuccess(version, "opencode --version");
  assert.equal(version.stdout.trim(), expectedVersion);
  const binaryTarget = await realpath(hostBinary);
  if (process.platform === "darwin" && process.arch === "arm64") {
    assert.equal(await sha256(binaryTarget), expectedDarwinArm64Sha256);
  }
  const sourceCommit = run("git", ["rev-parse", "HEAD"], { cwd: sourceRoot });
  assertSuccess(sourceCommit, "pinned source commit");
  assert.equal(sourceCommit.stdout.trim(), expectedSourceCommit);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-opencode-registration-"));
  const packageRoot = await stageAndInstallPackage(tempRoot);
  const canonicalPackageRoot = await realpath(packageRoot);
  const host = await isolatedHostEnvironment(tempRoot, packageRoot);
  const canonicalProject = await realpath(host.project);

  const debugConfig = run(hostBinary, ["debug", "config"], {
    cwd: host.project,
    env: host.env,
    timeout: 120_000
  });
  assertSuccess(debugConfig, "opencode debug config");
  const config = JSON.parse(debugConfig.stdout) as Record<string, any>;
  assert.equal(config.command.blu.agent, "blueprint");
  assert.equal(config.command.blu.subtask, false);
  assert.equal(config.agent.blueprint.mode, "primary");
  assert.equal(config.agent["blueprint-reviewer"].mode, "subagent");
  assert.equal(config.agent["blueprint-executor"].mode, "subagent");
  assert.deepEqual(config.agent.blueprint.permission.read, {
    "*": "allow",
    "*.env.*": "deny",
    "*.env.example": "allow",
    "mcp:*": "deny",
    "mcp:blueprint:*": "allow",
    "*.env": "deny"
  });
  assert.deepEqual(Object.keys(config.agent.blueprint.permission.read), [
    "*",
    "*.env.*",
    "*.env.example",
    "mcp:*",
    "mcp:blueprint:*",
    "*.env"
  ]);
  assert.equal(config.agent["blueprint-reviewer"].permission.read["mcp:*"], "deny");
  assert.deepEqual(config.agent["blueprint-executor"].permission.bash, {
    pwd: "ask",
    "git diff -- *": "ask"
  });
  assert.equal(config.agent.blueprint.permission.read["*.env"], "deny");
  assert.equal(config.skills.paths.length, 1);
  assert.equal(path.isAbsolute(config.skills.paths[0]), true);
  assert.equal(config.skills.paths[0], path.join(canonicalPackageRoot, "skills"));
  assert.equal(config.mcp.blueprint.cwd, canonicalProject);
  assert.equal(config.mcp.blueprint.environment.BLUEPRINT_GLOBAL_HOME, path.join(host.env.XDG_DATA_HOME!, "opencode", "blueprint"));
  assert.equal(config.mcp.blueprint.environment.BLUEPRINT_EXTENSION_PATH, canonicalPackageRoot);

  const reviewerProfileResult = run(hostBinary, ["debug", "agent", "blueprint-reviewer"], {
    cwd: host.project,
    env: host.env,
    timeout: 120_000
  });
  assertSuccess(reviewerProfileResult, "reviewer tool inventory");
  const reviewerProfile = JSON.parse(reviewerProfileResult.stdout) as {
    tools: Record<string, boolean>;
  };
  const editTools = ["edit", "write", "apply_patch"].filter((tool) =>
    Object.hasOwn(reviewerProfile.tools, tool)
  );
  assert.ok(editTools.length > 0, "pinned host must expose a semantic edit control");
  for (const tool of ["bash", "task", "question", "todowrite", "skill"]) {
    assert.equal(Object.hasOwn(reviewerProfile.tools, tool), true, `pinned host is missing native tool ${tool}`);
  }
  for (const tool of [
    "list_mcp_resources",
    "list_mcp_resource_templates",
    "read_mcp_resource",
    "blueprint_blueprint_project_status"
  ]) {
    assert.equal(
      Object.hasOwn(reviewerProfile.tools, tool),
      false,
      `${tool} unexpectedly entered the debug ToolRegistry; requalify this evidence`
    );
  }

  const deniedToolCases: Array<[string, Record<string, unknown>]> = [
    ["edit", { filePath: path.join(host.project, "denied.txt"), oldString: "", newString: "denied" }],
    ["write", { filePath: path.join(host.project, "denied.txt"), content: "denied" }],
    ["apply_patch", { patchText: "*** Begin Patch\n*** End Patch" }],
    ["bash", { command: "pwd" }],
    ["task", { description: "denied", prompt: "denied", subagent_type: "blueprint-reviewer" }],
    ["question", { questions: [{ header: "Gate", question: "Proceed?", options: [{ label: "No", description: "Stop" }] }] }],
    ["todowrite", { todos: [] }],
    ["skill", { name: "blueprint-project" }]
  ];
  for (const [tool, params] of deniedToolCases) {
    if (!Object.hasOwn(reviewerProfile.tools, tool)) continue;
    const denied = run(
      hostBinary,
      ["debug", "agent", "blueprint-reviewer", "--tool", tool, "--params", JSON.stringify(params)],
      { cwd: host.project, env: host.env, timeout: 120_000 }
    );
    assert.notEqual(denied.status, 0, `${tool} unexpectedly succeeded for the read-only reviewer`);
    assert.match(`${denied.stdout}\n${denied.stderr}`, /disabled for agent blueprint-reviewer/);
  }

  const executorProfileResult = run(hostBinary, ["debug", "agent", "blueprint-executor"], {
    cwd: host.project,
    env: host.env,
    timeout: 120_000
  });
  assertSuccess(executorProfileResult, "executor tool inventory");
  const executorProfile = JSON.parse(executorProfileResult.stdout) as {
    tools: Record<string, boolean>;
  };
  assert.equal(executorProfile.tools.edit, true);

  const executorFile = path.join(canonicalProject, "executor-fixture.txt");
  await writeFile(executorFile, "before\n");
  const executorEdit = run(
    hostBinary,
    [
      "debug",
      "agent",
      "blueprint-executor",
      "--tool",
      "edit",
      "--params",
      JSON.stringify({ filePath: executorFile, oldString: "before", newString: "after" })
    ],
    { cwd: host.project, env: host.env, timeout: 120_000 }
  );
  assertSuccess(executorEdit, "executor semantic edit");
  assert.equal(await readFile(executorFile, "utf8"), "after\n");

  const unrestrictedConfigPath = path.join(tempRoot, "opencode-executor.json");
  const unrestrictedConfig = JSON.parse(await readFile(host.config, "utf8")) as Record<string, any>;
  delete unrestrictedConfig.permission.bash;
  await writeFile(unrestrictedConfigPath, JSON.stringify(unrestrictedConfig));
  const executorBash = run(
    hostBinary,
    ["debug", "agent", "blueprint-executor", "--tool", "bash", "--params", JSON.stringify({ command: "pwd" })],
    {
      cwd: host.project,
      env: { ...host.env, OPENCODE_CONFIG: unrestrictedConfigPath },
      timeout: 120_000
    }
  );
  assertSuccess(executorBash, "executor controlled bash");
  assert.match(executorBash.stdout, new RegExp(canonicalProject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const foreignRoot = path.join(tempRoot, "foreign-skills");
  await mkdir(path.join(foreignRoot, "group", "substitute"), { recursive: true });
  await writeFile(
    path.join(foreignRoot, "group", "substitute", "SKILL.md"),
    "---\nname: blueprint-god-review\ndescription: Foreign collision\n---\nforeign\n"
  );
  const collisionConfigPath = path.join(tempRoot, "opencode-collision.json");
  const collisionConfig = JSON.parse(await readFile(host.config, "utf8")) as Record<string, unknown>;
  collisionConfig.skills = { paths: [foreignRoot] };
  await writeFile(collisionConfigPath, JSON.stringify(collisionConfig));
  const collisionProbe = run(hostBinary, ["--print-logs", "--log-level", "DEBUG", "debug", "config"], {
    cwd: host.project,
    env: { ...host.env, OPENCODE_CONFIG: collisionConfigPath },
    timeout: 120_000
  });
  assertSuccess(collisionProbe, "foreign skill collision probe");
  const collidedConfig = JSON.parse(collisionProbe.stdout) as Record<string, any>;
  assert.equal(collidedConfig.command?.blu, undefined);
  assert.equal(collidedConfig.agent?.blueprint, undefined);
  assert.equal(collidedConfig.mcp?.blueprint, undefined);
  assert.match(collisionProbe.stderr, /foreign skill collisions: blueprint-god-review/);

  const homeSkillRoot = path.join(host.env.HOME!, "foreign-skills");
  await mkdir(path.join(homeSkillRoot, "group", "substitute"), { recursive: true });
  await writeFile(
    path.join(homeSkillRoot, "group", "substitute", "SKILL.md"),
    "---\nname: blueprint-god-review\ndescription: Home path collision\n---\nforeign\n"
  );
  const homePathConfigPath = path.join(tempRoot, "opencode-home-skill.json");
  const homePathConfig = JSON.parse(await readFile(host.config, "utf8")) as Record<string, unknown>;
  homePathConfig.skills = { paths: ["~/foreign-skills"] };
  await writeFile(homePathConfigPath, JSON.stringify(homePathConfig));
  const homePathProbe = run(hostBinary, ["--print-logs", "--log-level", "DEBUG", "debug", "config"], {
    cwd: host.project,
    env: { ...host.env, OPENCODE_CONFIG: homePathConfigPath },
    timeout: 120_000
  });
  assertSuccess(homePathProbe, "home-relative skill collision probe");
  const homePathResult = JSON.parse(homePathProbe.stdout) as Record<string, any>;
  assert.equal(homePathResult.command?.blu, undefined);
  assert.equal(homePathResult.agent?.blueprint, undefined);
  assert.equal(homePathResult.mcp?.blueprint, undefined);
  assert.match(homePathProbe.stderr, /foreign skill collisions: blueprint-god-review/);

  const customConfigRoot = path.join(tempRoot, "custom-config");
  await mkdir(path.join(customConfigRoot, "skills", "group", "substitute"), { recursive: true });
  await writeFile(
    path.join(customConfigRoot, "skills", "group", "substitute", "SKILL.md"),
    "---\nname: blueprint-god-review\ndescription: Custom config collision\n---\nforeign\n"
  );
  const customConfigProbe = run(hostBinary, ["--print-logs", "--log-level", "DEBUG", "debug", "config"], {
    cwd: host.project,
    env: { ...host.env, OPENCODE_CONFIG_DIR: customConfigRoot },
    timeout: 120_000
  });
  assertSuccess(customConfigProbe, "custom config skill collision probe");
  const customConfigResult = JSON.parse(customConfigProbe.stdout) as Record<string, any>;
  assert.equal(customConfigResult.command?.blu, undefined);
  assert.equal(customConfigResult.agent?.blueprint, undefined);
  assert.equal(customConfigResult.mcp?.blueprint, undefined);
  assert.match(customConfigProbe.stderr, /foreign skill collisions: blueprint-god-review/);

  const remoteConfigPath = path.join(tempRoot, "opencode-remote-skill.json");
  const remoteConfig = JSON.parse(await readFile(host.config, "utf8")) as Record<string, unknown>;
  remoteConfig.skills = { urls: ["https://example.invalid/private-helper"] };
  await writeFile(remoteConfigPath, JSON.stringify(remoteConfig));
  const remoteProbe = run(hostBinary, ["--print-logs", "--log-level", "DEBUG", "debug", "config"], {
    cwd: host.project,
    env: { ...host.env, OPENCODE_CONFIG: remoteConfigPath },
    timeout: 120_000
  });
  assertSuccess(remoteProbe, "remote skill fail-closed probe");
  const remoteResult = JSON.parse(remoteProbe.stdout) as Record<string, any>;
  assert.equal(remoteResult.command?.blu, undefined);
  assert.equal(remoteResult.agent?.blueprint, undefined);
  assert.equal(remoteResult.mcp?.blueprint, undefined);
  assert.match(remoteProbe.stderr, /cannot verify remote skills\.urls/);

  const agents = run(hostBinary, ["agent", "list"], { cwd: host.project, env: host.env, timeout: 120_000 });
  assertSuccess(agents, "opencode agent list");
  assert.match(agents.stdout, /blueprint/);
  assert.match(agents.stdout, /blueprint-reviewer/);
  assert.match(agents.stdout, /blueprint-executor/);

  const skills = run(hostBinary, ["debug", "skill"], { cwd: host.project, env: host.env, timeout: 120_000 });
  assertSuccess(skills, "opencode debug skill");
  const skillList = JSON.parse(skills.stdout) as Array<{ name: string; location: string }>;
  const blueprintSkills = skillList.filter((skill) => skill.name.startsWith("blueprint-"));
  assert.deepEqual(
    blueprintSkills.map((skill) => skill.name).sort(),
    ["blueprint-god-review", "blueprint-project"]
  );
  assert.equal(blueprintSkills.every((skill) => path.isAbsolute(skill.location)), true);

  const alias = run(
    hostBinary,
    [
      "--print-logs",
      "--log-level",
      "DEBUG",
      "run",
      "--command",
      "blueprint-project",
      "--model",
      "opencode/big-pickle",
      ""
    ],
    {
      cwd: host.project,
      env: host.env,
      timeout: 120_000
    }
  );
  assert.notEqual(alias.status, 0);
  assert.match(`${alias.stdout}\n${alias.stderr}`, /cannot run as slash commands|\/blu-help/);
});
