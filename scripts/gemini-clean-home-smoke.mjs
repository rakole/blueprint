#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  extensionHostPath,
  getExtensionHost
} from "./lib/extension-hosts.mjs";

const EXTENSION_NAME = "blueprint";

function usage(exitCode = 0) {
  const text = `
Usage:
  node scripts/gemini-clean-home-smoke.mjs [--host gemini|tabnine] [--repo PATH] [--home PATH] [--cli PATH] [--keep-home]

Runs a repeatable clean-home Blueprint smoke flow for the selected CLI host:
  1. <host-cli> extensions validate <repo> --debug
  2. HOME=<clean> <host-cli> extensions link <repo> --consent
  3. HOME=<clean> <host-cli> extensions list --output-format json
`;

  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${text.trim()}\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help" || token === "-h") {
      usage(0);
    }

    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  if (args._.length > 0) {
    throw new Error(`Unexpected positional arguments: ${args._.join(" ")}`);
  }

  return args;
}

function resolvePath(value, fallback) {
  if (typeof value === "string" && value.trim().length > 0) {
    return path.resolve(value.trim());
  }

  return path.resolve(fallback);
}

function resolveCliBinary(args, host) {
  const explicitBinary =
    typeof args.cli === "string" && args.cli.trim().length > 0
      ? args.cli.trim()
      : typeof args[host.id] === "string" && args[host.id].trim().length > 0
        ? args[host.id].trim()
        : host.id === "gemini" &&
            typeof args.gemini === "string" &&
            args.gemini.trim().length > 0
          ? args.gemini.trim()
          : undefined;

  if (explicitBinary) {
    return explicitBinary;
  }

  return host.binaryName;
}

function buildCleanHomeEnv(homeRoot) {
  return {
    ...process.env,
    HOME: homeRoot,
    USERPROFILE: homeRoot,
    XDG_CONFIG_HOME: path.join(homeRoot, ".config"),
    XDG_CACHE_HOME: path.join(homeRoot, ".cache"),
    XDG_STATE_HOME: path.join(homeRoot, ".local", "state")
  };
}

async function ensureRepoLooksRunnable(repoRoot, host) {
  await access(path.join(repoRoot, host.manifestFile));
  await access(path.join(repoRoot, "dist", "mcp", "server.js"));
}

async function prepareCleanHome(homeRoot, host) {
  await mkdir(extensionHostPath(homeRoot, host), { recursive: true });
  await mkdir(path.join(homeRoot, ".config"), { recursive: true });
  await mkdir(path.join(homeRoot, ".cache"), { recursive: true });
  await mkdir(path.join(homeRoot, ".local", "state"), { recursive: true });
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function runCommand(command, args, options = {}) {
  const { cwd, env, inheritStdin = false } = options;

  process.stdout.write(`\n==> ${formatCommand(command, args)}\n`);

  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: inheritStdin ? ["inherit", "pipe", "pipe"] : undefined
  });

  if (result.error) {
    throw result.error;
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    throw new Error(
      `${formatCommand(command, args)} failed with exit code ${result.status}`
    );
  }

  return result.stdout ?? "";
}

function hasPtyWrapper() {
  if (!process.stdin.isTTY) {
    return false;
  }

  const probe = spawnSync(
    "script",
    ["-q", "/dev/null", "/bin/echo", "pty-ok"],
    {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"]
    }
  );

  return !probe.error && probe.status === 0;
}

function extractJsonArray(raw, host) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `${host.binaryName} extensions list did not return a JSON array. Re-run the smoke with a TTY-capable environment.`
    );
  }

  return raw.slice(start, end + 1);
}

function verifyListedExtension(listOutput, repoRoot, host) {
  const payload = JSON.parse(extractJsonArray(listOutput, host));

  if (!Array.isArray(payload)) {
    throw new Error(`${host.binaryName} extensions list JSON payload was not an array.`);
  }

  const match = payload.find((entry) => {
    return (
      entry &&
      typeof entry === "object" &&
      entry.name === EXTENSION_NAME &&
      entry.path === repoRoot
    );
  });

  if (!match) {
    throw new Error(
      `${host.binaryName} extensions list did not report ${EXTENSION_NAME} at ${repoRoot}.`
    );
  }

  return match;
}

async function runSmoke(args) {
  const repoRoot = resolvePath(args.repo, process.cwd());
  const host = getExtensionHost(args.host);
  const cliBinary = resolveCliBinary(args, host);
  const explicitHome = typeof args.home === "string" && args.home.trim().length > 0;
  const homeRoot = explicitHome
    ? resolvePath(args.home, process.cwd())
    : await mkdtemp(path.join(os.tmpdir(), `blueprint-${host.id}-home-`));
  const keepHome = Boolean(args["keep-home"]);
  const cleanHomeEnv = buildCleanHomeEnv(homeRoot);
  let succeeded = false;

  await ensureRepoLooksRunnable(repoRoot, host);
  await prepareCleanHome(homeRoot, host);

  process.stdout.write(`Repo: ${repoRoot}\n`);
  process.stdout.write(`Host: ${host.displayName}\n`);
  process.stdout.write(`CLI binary: ${cliBinary}\n`);
  process.stdout.write(`Clean host home: ${homeRoot}\n`);

  try {
    runCommand(cliBinary, ["extensions", "validate", repoRoot, "--debug"], {
      cwd: repoRoot
    });

    runCommand(cliBinary, ["extensions", "link", repoRoot, "--consent"], {
      cwd: repoRoot,
      env: cleanHomeEnv
    });

    await access(extensionHostPath(homeRoot, host, "extensions", EXTENSION_NAME));

    const listCommand = ["extensions", "list", "--output-format", "json"];
    const listOutput = hasPtyWrapper()
      ? runCommand("script", ["-q", "/dev/null", cliBinary, ...listCommand], {
          cwd: repoRoot,
          env: cleanHomeEnv,
          inheritStdin: true
        })
      : runCommand(cliBinary, listCommand, {
          cwd: repoRoot,
          env: cleanHomeEnv
        });

    verifyListedExtension(listOutput, repoRoot, host);
    succeeded = true;

    process.stdout.write(
      `\nBlueprint ${host.id} clean-home smoke passed for ${repoRoot}.\n`
    );
  } finally {
    if (!explicitHome && !keepHome && succeeded) {
      await rm(homeRoot, { recursive: true, force: true });
    } else if (!succeeded) {
      process.stderr.write(`\nSmoke home preserved at ${homeRoot}\n`);
    }
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    await runSmoke(args);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

const isCliEntrypoint =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliEntrypoint) {
  void main();
}
