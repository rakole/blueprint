import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { createBlueprintActivationHooks } from "../src/opencode/activation.js";
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
  const stage = path.join(tempRoot, "package-stage");
  const packed = path.join(tempRoot, "packed");
  const prefix = path.join(tempRoot, "consumer");
  await Promise.all([mkdir(stage, { recursive: true }), mkdir(packed, { recursive: true })]);
  await Promise.all([
    cp(path.join(repoRoot, "package.json"), path.join(stage, "package.json")),
    cp(path.join(repoRoot, "dist"), path.join(stage, "dist"), { recursive: true }),
    cp(path.join(fixtureRoot, "registration", "commands"), path.join(stage, "commands"), { recursive: true }),
    cp(path.join(fixtureRoot, "registration", "agents"), path.join(stage, "agents"), { recursive: true }),
    cp(path.join(fixtureRoot, "registration", "skills"), path.join(stage, "skills"), { recursive: true })
  ]);

  const packedResult = run("npm", ["pack", stage, "--pack-destination", packed, "--json"], {
    cwd: tempRoot
  });
  assertSuccess(packedResult, "npm pack");
  const packOutput = JSON.parse(packedResult.stdout) as Array<{ filename: string }>;
  assert.equal(packOutput.length, 1);
  const tarball = path.join(packed, packOutput[0].filename);
  const installResult = run("npm", ["install", "--prefix", prefix, "--omit=dev", tarball], {
    cwd: tempRoot,
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

test("private helper activation is exact, correlated, revocable, and session isolated", async () => {
  const hooks = createBlueprintActivationHooks(new Set(["blueprint-project", "blueprint-god-review"]));
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
  assert.equal(config.agent["blueprint-executor"].permission.bash, "ask");
  assert.equal(config.agent.blueprint.permission.read["*.env"], "deny");
  assert.equal(config.skills.paths.length, 1);
  assert.equal(path.isAbsolute(config.skills.paths[0]), true);
  assert.equal(config.skills.paths[0], path.join(canonicalPackageRoot, "skills"));
  assert.equal(config.mcp.blueprint.cwd, canonicalProject);
  assert.equal(config.mcp.blueprint.environment.BLUEPRINT_GLOBAL_HOME, path.join(host.env.XDG_DATA_HOME!, "opencode", "blueprint"));
  assert.equal(config.mcp.blueprint.environment.BLUEPRINT_EXTENSION_PATH, canonicalPackageRoot);

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
      "google/gemini-2.5-flash-lite",
      ""
    ],
    {
      cwd: host.project,
      env: {
        ...host.env,
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GEMINI_API_KEY
      },
      timeout: 120_000
    }
  );
  assert.notEqual(alias.status, 0);
  assert.match(`${alias.stdout}\n${alias.stderr}`, /cannot run as slash commands|\/blu-help/);
});
