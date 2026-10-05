#!/usr/bin/env node

import process from "node:process";

import {
  runOpenCodeLifecycle,
  type LifecycleAction,
  type OpenCodeLifecycleInput
} from "./lifecycle.js";

const actions = new Set<LifecycleAction>(["install", "upgrade", "rollback", "uninstall", "status"]);

const usageText = "Usage: blueprint-opencode install|upgrade|rollback|uninstall|status --config /absolute/opencode.json [--package /absolute/blueprint.tgz|blueprint@exact-semver] [--cwd /absolute/customer-project] [--json]";

function usage(): never { throw new Error(usageText); }

function parseArguments(argv: string[]): { input: OpenCodeLifecycleInput; json: boolean } {
  const [actionValue, ...rest] = argv;
  if (!actionValue || !actions.has(actionValue as LifecycleAction)) usage();
  const values = new Map<string, string>();
  let jsonOutput = false;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]!;
    if (argument === "--json") {
      if (jsonOutput) throw new Error("--json may only be provided once");
      jsonOutput = true;
      continue;
    }
    if (!["--config", "--package", "--cwd"].includes(argument)) usage();
    if (values.has(argument)) throw new Error(`${argument} may only be provided once`);
    const value = rest[++index];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    values.set(argument, value);
  }
  const configPath = values.get("--config");
  if (!configPath) throw new Error("--config is required");
  return {
    input: {
      action: actionValue as LifecycleAction,
      configPath,
      ...(values.has("--package") ? { packageSpec: values.get("--package") } : {}),
      ...(values.has("--cwd") ? { cwd: values.get("--cwd") } : {})
    },
    json: jsonOutput
  };
}

try {
  if (process.argv.slice(2).length === 1 && ["--help", "-h"].includes(process.argv[2]!)) {
    process.stdout.write(`${usageText}\n\n--cwd is required for install and upgrade.\n`);
    process.exit(0);
  }
  const parsed = parseArguments(process.argv.slice(2));
  const result = await runOpenCodeLifecycle(parsed.input);
  if (parsed.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else process.stdout.write(`Blueprint OpenCode lifecycle: ${result.status}${result.active ? ` (${result.active.version})` : ""}\n`);
} catch (error) {
  if (process.argv.includes("--json")) process.stderr.write(`${JSON.stringify({ code: "LIFECYCLE_ERROR", message: (error as Error).message })}\n`);
  else process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
}
