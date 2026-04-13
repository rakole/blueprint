import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

const repoRoot = process.cwd();
const liveGeminiApiKey = process.env.GEMINI_API_KEY ?? null;

const shippedPaths = [
  "gemini-extension.json",
  "GEMINI.md",
  "commands",
  "skills",
  "agents",
  "hooks",
  "dist",
  "package.json"
] as const;

const excludedStagePaths = [
  "src",
  "node_modules",
  ".planning",
  ".git"
] as const;

const requiredInstalledPaths = [
  "gemini-extension.json",
  "GEMINI.md",
  "commands/blu.toml",
  "commands/blu-help.toml",
  "skills/blueprint-router/SKILL.md",
  "agents/blueprint-planner.md",
  "hooks/hooks.json",
  "dist/mcp/server.js",
  "dist/hooks/read-before-edit.js",
  "dist/hooks/blueprint-write-guard.js",
  "dist/hooks/workflow-advisory.js",
  "package.json"
] as const;

type ExecContext = {
  allowedExitCodes?: number[];
  command: string;
  cwd?: string;
  env?: Record<string, string>;
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

async function stageShippedExtension(): Promise<{
  stageRoot: string;
  extensionDir: string;
}> {
  const stageRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-extension-stage-"));
  const extensionDir = path.join(stageRoot, "blueprint");
  const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8"
  })
    .split("\0")
    .filter(Boolean);

  await mkdir(extensionDir, { recursive: true });

  for (const relativePath of trackedFiles) {
    const isShippedPath = shippedPaths.some((shippedPath) => {
      return relativePath === shippedPath || relativePath.startsWith(`${shippedPath}/`);
    });
    const isExcludedPath = excludedStagePaths.some((excludedPath) => {
      return relativePath === excludedPath || relativePath.startsWith(`${excludedPath}/`);
    });

    if (!isShippedPath || isExcludedPath) {
      continue;
    }

    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(extensionDir, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }

  for (const relativePath of shippedPaths) {
    assert.equal(
      trackedFiles.some((trackedPath) => {
        return trackedPath === relativePath || trackedPath.startsWith(`${relativePath}/`);
      }),
      true,
      `${relativePath} must be tracked before staging the extension`
    );
  }

  for (const relativePath of excludedStagePaths) {
    assert.equal(
      await pathExists(path.join(extensionDir, relativePath)),
      false,
      `${relativePath} should not be present in the staged install bundle`
    );
  }

  return { stageRoot, extensionDir };
}

async function startContainer(extensionDir: string): Promise<StartedTestContainer> {
  return new GenericContainer("node:20-bookworm-slim")
    .withWorkingDir("/workspace")
    .withCopyDirectoriesToContainer([
      {
        source: extensionDir,
        target: "/workspace/blueprint"
      }
    ])
    .withCommand([
      "sh",
      "-lc",
      "echo blueprint-test-container-ready && tail -f /dev/null"
    ])
    .withWaitStrategy(Wait.forLogMessage("blueprint-test-container-ready"))
    .withStartupTimeout(180_000)
    .start();
}

async function execInContainer(
  container: StartedTestContainer,
  context: ExecContext
): Promise<{
  stdout: string;
  stderr: string;
}> {
  const allowedExitCodes = context.allowedExitCodes ?? [0];
  const exports = [
    "export CI=1",
    "export NO_COLOR=1"
  ];

  if (context.cwd) {
    exports.push(`cd ${shellQuote(context.cwd)}`);
  }

  for (const [key, value] of Object.entries(context.env ?? {})) {
    exports.push(`export ${key}=${shellQuote(value)}`);
  }

  const shellCommand = `${exports.join("\n")}\n${context.command}`;
  const result = await container.exec(["sh", "-lc", shellCommand]);

  assert.equal(
    allowedExitCodes.includes(result.exitCode),
    true,
    [
      `${context.command} failed inside the integration container`,
      `allowed exit codes: ${allowedExitCodes.join(", ")}`,
      `actual exit code: ${result.exitCode}`,
      `stdout:\n${result.stdout}`,
      `stderr:\n${result.stderr}`
    ].join("\n\n")
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
}

async function installGeminiCli(container: StartedTestContainer): Promise<void> {
  await execInContainer(container, {
    command: "npm install -g @google/gemini-cli"
  });

  const version = await execInContainer(container, {
    command: "gemini --version"
  });

  assert.match(version.stdout, /\d+\.\d+\.\d+/);
}

async function validateStagedExtension(container: StartedTestContainer): Promise<void> {
  await execInContainer(container, {
    command: "gemini extensions validate /workspace/blueprint"
  });
}

function bundleAssertionScript(): string {
  return `
import assert from "node:assert/strict";
import { access, lstat, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const installRoot = process.argv[1];
const bundleRoot = process.argv[2];
const metadataType = process.argv[3];
const requiredPaths = JSON.parse(process.argv[4]);
const forbiddenPaths = JSON.parse(process.argv[5]);

async function pathExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveExtensionPath(templatePath) {
  return templatePath
    .replaceAll("\${extensionPath}", bundleRoot)
    .replaceAll("\${/}", path.sep);
}

const installStat = await lstat(installRoot);
assert.equal(
  installStat.isDirectory() || installStat.isSymbolicLink(),
  true,
  "Installed extension root should be addressable as a directory"
);

const bundleStat = await lstat(bundleRoot);
assert.equal(
  bundleStat.isDirectory() || bundleStat.isSymbolicLink(),
  true,
  "Bundle root should be addressable as a directory"
);

const installMetadataPath = path.join(installRoot, ".gemini-extension-install.json");
assert.equal(await pathExists(installMetadataPath), true, "Gemini should record install metadata");

const installMetadata = JSON.parse(await readFile(installMetadataPath, "utf8"));
assert.equal(installMetadata?.type, metadataType, "Install metadata should match the requested mode");

for (const relativePath of requiredPaths) {
  assert.equal(
    await pathExists(path.join(bundleRoot, relativePath)),
    true,
    \`Missing required installed path: \${relativePath}\`
  );
}

for (const relativePath of forbiddenPaths) {
  assert.equal(
    await pathExists(path.join(bundleRoot, relativePath)),
    false,
    \`Unexpected repo-only path leaked into installed extension: \${relativePath}\`
  );
}

const manifest = JSON.parse(await readFile(path.join(bundleRoot, "gemini-extension.json"), "utf8"));
const mcpArg = manifest?.mcpServers?.blueprint?.args?.[0] ?? "";

assert.match(mcpArg, /dist[\\\\/]mcp[\\\\/]server\\.js$/);

const resolvedMcpPath = resolveExtensionPath(mcpArg);
const relativeMcpPath = path.relative(bundleRoot, resolvedMcpPath);

assert.equal(relativeMcpPath.startsWith(".."), false, "MCP entrypoint must resolve inside the extension root");
assert.equal(await pathExists(resolvedMcpPath), true, "Installed MCP entrypoint should exist");

const serverModule = await import(pathToFileURL(resolvedMcpPath).href);

assert.ok(Array.isArray(serverModule.blueprintToolNames), "Installed MCP server should export blueprintToolNames");
assert.ok(serverModule.blueprintToolNames.length > 0, "Installed MCP server should expose at least one tool");

const hookConfig = JSON.parse(await readFile(path.join(bundleRoot, "hooks/hooks.json"), "utf8"));
const beforeToolHooks = Array.isArray(hookConfig?.hooks?.BeforeTool) ? hookConfig.hooks.BeforeTool : [];
const flattenedHooks = beforeToolHooks.flatMap((entry) => Array.isArray(entry?.hooks) ? entry.hooks : []);

assert.ok(flattenedHooks.length > 0, "Installed extension should expose at least one hook");

for (const hook of flattenedHooks) {
  const command = String(hook?.command ?? "");
  assert.match(command, /^node\\s+\\$\\{extensionPath\\}/, "Hook command should be rooted at extensionPath");

  const resolvedHookCommand = resolveExtensionPath(command.replace(/^node\\s+/, ""));
  const relativeHookPath = path.relative(bundleRoot, resolvedHookCommand);

  assert.equal(relativeHookPath.startsWith(".."), false, \`Hook escaped extension root: \${command}\`);
  assert.equal(await pathExists(resolvedHookCommand), true, \`Installed hook target missing: \${resolvedHookCommand}\`);
}

console.log(JSON.stringify({
  installRoot,
  bundleRoot,
  metadataType,
  toolCount: serverModule.blueprintToolNames.length,
  hookCount: flattenedHooks.length
}));
`;
}

async function assertInstalledBundle(
  container: StartedTestContainer,
  installMode: "link" | "install",
  homeDir: string
): Promise<void> {
  const installedDir = path.posix.join(homeDir, ".gemini/extensions/blueprint");
  const bundleDir =
    installMode === "link" ? "/workspace/blueprint" : installedDir;
  const metadataType = installMode === "link" ? "link" : "local";

  await execInContainer(container, {
    command: [
      "node",
      "--input-type=module",
      "-e",
      shellQuote(bundleAssertionScript()),
      shellQuote(installedDir),
      shellQuote(bundleDir),
      shellQuote(metadataType),
      shellQuote(JSON.stringify(requiredInstalledPaths)),
      shellQuote(JSON.stringify(excludedStagePaths))
    ].join(" "),
    env: {
      HOME: homeDir
    }
  });
}

async function runInstallModeSmoke(
  container: StartedTestContainer,
  installMode: "link" | "install"
): Promise<void> {
  const homeDir = `/tmp/gemini-home-${installMode}`;
  const installedDir = path.posix.join(homeDir, ".gemini/extensions/blueprint");
  const installCommand =
    installMode === "link"
      ? "gemini extensions link /workspace/blueprint --consent"
      : "gemini extensions install /workspace/blueprint --consent";

  await execInContainer(container, {
    command: `rm -rf ${shellQuote(homeDir)} && mkdir -p ${shellQuote(homeDir)} ${shellQuote(path.posix.join(homeDir, ".gemini"))}`,
    env: {
      HOME: homeDir
    }
  });

  await execInContainer(container, {
    command: installCommand,
    env: {
      HOME: homeDir
    }
  });

  const extensionList = await execInContainer(container, {
    command: "gemini extensions list",
    env: {
      HOME: homeDir
    }
  });

  const extensionEnablement = await execInContainer(container, {
    command: `cat ${shellQuote(path.posix.join(homeDir, ".gemini/extensions/extension-enablement.json"))}`,
    env: {
      HOME: homeDir
    }
  });

  assert.match(
    extensionEnablement.stdout,
    /\bblueprint\b/i,
    `${installMode} mode should register the blueprint extension`
  );

  const debugList = await execInContainer(container, {
    command: "gemini --debug --list-extensions",
    // Gemini CLI may require auth before returning a clean exit status even
    // though the debug listing already surfaced the extension paths we need.
    allowedExitCodes: [0, 41],
    env: {
      HOME: homeDir,
      ...(liveGeminiApiKey ? { GEMINI_API_KEY: liveGeminiApiKey } : {})
    }
  });

  const combinedDebugOutput = `${debugList.stdout}\n${debugList.stderr}`;
  const expectedDebugPath =
    installMode === "install"
      ? path.posix.join(installedDir, "GEMINI.md")
      : "/workspace/blueprint/GEMINI.md";

  assert.equal(
    combinedDebugOutput.includes(expectedDebugPath),
    true,
    `${installMode} mode should surface Blueprint from a fresh Gemini CLI process`
  );

  void extensionList;
  await assertInstalledBundle(container, installMode, homeDir);
}

async function runLiveSmoke(container: StartedTestContainer): Promise<void> {
  const homeDir = "/tmp/gemini-home-live";

  await execInContainer(container, {
    command: `rm -rf ${shellQuote(homeDir)} && mkdir -p ${shellQuote(homeDir)}`,
    env: {
      HOME: homeDir
    }
  });

  await execInContainer(container, {
    command: `mkdir -p ${shellQuote(path.posix.join(homeDir, ".gemini"))} && cat <<'EOF' > ${shellQuote(path.posix.join(homeDir, ".gemini/settings.json"))}
{
  "security": {
    "folderTrust": {
      "enabled": true
    }
  }
}
EOF
cat <<'EOF' > ${shellQuote(path.posix.join(homeDir, ".gemini/trustedFolders.json"))}
{
  "/workspace": "TRUST_FOLDER",
  "/workspace/blueprint": "TRUST_FOLDER"
}
EOF`,
    env: {
      HOME: homeDir
    }
  });

  await execInContainer(container, {
    command: "gemini extensions install /workspace/blueprint",
    env: {
      HOME: homeDir
    }
  });

  const authBackedDebugList = await execInContainer(container, {
    command: "gemini --debug --list-extensions",
    env: {
      HOME: homeDir,
      GEMINI_API_KEY: liveGeminiApiKey ?? ""
    }
  });

  assert.match(
    `${authBackedDebugList.stdout}\n${authBackedDebugList.stderr}`,
    /blueprint\/GEMINI\.md/,
    "Auth-backed Gemini process should still surface the installed Blueprint extension"
  );

  const promptSmoke = await execInContainer(container, {
    command: 'gemini -p "Reply with exactly OK"',
    cwd: "/workspace/blueprint",
    env: {
      HOME: homeDir,
      GEMINI_API_KEY: liveGeminiApiKey ?? "",
      CI: "1",
      NO_COLOR: "1",
      TERM: "dumb"
    }
  });

  assert.match(promptSmoke.stdout, /\bOK\b/, "Live Gemini prompt smoke should return OK");
}

test(
  "containerized Gemini CLI smoke validates staged Blueprint installs",
  { timeout: 900_000 },
  async (t) => {
    const { stageRoot, extensionDir } = await stageShippedExtension();
    let container: StartedTestContainer | null = null;

    t.after(async () => {
      if (container) {
        await container.stop({ remove: true, removeVolumes: true });
      }
      await rm(stageRoot, { recursive: true, force: true });
    });

    container = await startContainer(extensionDir);

    await installGeminiCli(container);
    await validateStagedExtension(container);

    await t.test("link mode registers the extension and preserves the shipped bundle", async () => {
      await runInstallModeSmoke(container, "link");
    });

    await t.test("install mode copies the extension and preserves the shipped bundle", async () => {
      await runInstallModeSmoke(container, "install");
    });

    await t.test(
      "auth-backed Gemini smoke validates the installed extension and a real prompt",
      {
        skip: liveGeminiApiKey ? false : "GEMINI_API_KEY not set; skipping live Gemini smoke"
      },
      async () => {
        await runLiveSmoke(container);
      }
    );
  }
);
