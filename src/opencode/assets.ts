import { lstat, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseNativeMarkdown } from "../shared/native-frontmatter.js";

export type NativePermissionAction = "allow" | "ask" | "deny";
export type NativePermission = Record<
  string,
  NativePermissionAction | Record<string, NativePermissionAction>
>;
export type NativeCommand = {
  template: string;
  description: string;
  agent: "blueprint";
  subtask: false;
};
export type NativeAgent = {
  description: string;
  mode: "primary" | "subagent";
  steps: number;
  permission: NativePermission;
  prompt: string;
};

export type BlueprintNativeAssets = {
  packageRoot: string;
  command: Record<string, NativeCommand>;
  agent: Record<string, NativeAgent>;
  skillRoot: string;
  skillAliases: ReadonlySet<string>;
  mcpServerEntry: string;
};

const COMMAND_KEYS = new Set(["description", "agent", "subtask"]);
const AGENT_KEYS = new Set(["description", "mode", "steps", "permission"]);
const PERMISSION_ACTIONS = new Set(["allow", "ask", "deny"]);

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  source: string
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`${source}: unsupported frontmatter keys: ${unknown.sort().join(", ")}`);
  }
}

function requiredString(value: unknown, key: string, source: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${source}: ${key} must be a non-empty string`);
  }
  return value;
}

function validatePermissionRule(value: unknown, source: string, key: string): void {
  if (typeof value === "string") {
    if (!PERMISSION_ACTIONS.has(value)) {
      throw new Error(`${source}: permission.${key} has unsupported action ${JSON.stringify(value)}`);
    }
    return;
  }
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${source}: permission.${key} must be an action or pattern mapping`);
  }
  for (const [pattern, action] of Object.entries(value as Record<string, unknown>)) {
    if (pattern.length === 0 || typeof action !== "string" || !PERMISSION_ACTIONS.has(action)) {
      throw new Error(`${source}: permission.${key}.${pattern || "<empty>"} has an invalid action`);
    }
  }
}

function validatePermission(value: unknown, source: string): NativePermission {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${source}: permission must be a mapping`);
  }
  const result = value as Record<string, unknown>;
  for (const [key, rule] of Object.entries(result)) {
    validatePermissionRule(rule, source, key);
  }
  return result as NativePermission;
}

async function assertRegularFile(file: string): Promise<void> {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Native asset must be a literal regular file: ${file}`);
  }
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".md"))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

async function loadCommands(packageRoot: string): Promise<Record<string, NativeCommand>> {
  const result: Record<string, NativeCommand> = {};
  for (const file of await markdownFiles(path.join(packageRoot, "commands"))) {
    await assertRegularFile(file);
    const source = path.relative(packageRoot, file);
    const parsed = parseNativeMarkdown(await readFile(file, "utf8"), source);
    assertExactKeys(parsed.frontmatter, COMMAND_KEYS, source);
    const name = path.basename(file, ".md");
    if (name in result) throw new Error(`${source}: duplicate native command ${name}`);
    if (parsed.frontmatter.agent !== "blueprint") {
      throw new Error(`${source}: native command agent must be blueprint`);
    }
    if (parsed.frontmatter.subtask !== false) {
      throw new Error(`${source}: native command subtask must be false`);
    }
    const description = requiredString(parsed.frontmatter.description, "description", source);
    if (parsed.body.trim().length === 0) throw new Error(`${source}: command body must not be empty`);
    result[name] = {
      description,
      agent: "blueprint",
      subtask: false,
      template: parsed.body.trim()
    };
  }
  if (!("blu" in result)) throw new Error("commands/blu.md: required root command is missing");
  return result;
}

async function loadAgents(packageRoot: string): Promise<Record<string, NativeAgent>> {
  const result: Record<string, NativeAgent> = {};
  for (const file of await markdownFiles(path.join(packageRoot, "agents"))) {
    await assertRegularFile(file);
    const source = path.relative(packageRoot, file);
    const parsed = parseNativeMarkdown(await readFile(file, "utf8"), source);
    assertExactKeys(parsed.frontmatter, AGENT_KEYS, source);
    const name = path.basename(file, ".md");
    if (name in result) throw new Error(`${source}: duplicate native agent ${name}`);
    const description = requiredString(parsed.frontmatter.description, "description", source);
    const mode = parsed.frontmatter.mode;
    if (mode !== "primary" && mode !== "subagent") {
      throw new Error(`${source}: mode must be primary or subagent`);
    }
    if (name === "blueprint" ? mode !== "primary" : mode !== "subagent") {
      throw new Error(`${source}: ${name} has the wrong native mode`);
    }
    const steps = parsed.frontmatter.steps;
    if (typeof steps !== "number" || !Number.isInteger(steps) || steps <= 0) {
      throw new Error(`${source}: steps must be a positive integer`);
    }
    const permission = validatePermission(parsed.frontmatter.permission, source);
    if (parsed.body.trim().length === 0) throw new Error(`${source}: agent body must not be empty`);
    result[name] = {
      description,
      mode,
      steps,
      permission,
      prompt: parsed.body.trim()
    };
  }
  if (!("blueprint" in result)) throw new Error("agents/blueprint.md: required primary agent is missing");
  return result;
}

async function loadSkillAliases(packageRoot: string): Promise<{ root: string; aliases: Set<string> }> {
  const root = path.join(packageRoot, "skills");
  const aliases = new Set<string>();
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const file = path.join(root, entry.name, "SKILL.md");
    await assertRegularFile(file);
    const source = path.relative(packageRoot, file);
    const parsed = parseNativeMarkdown(await readFile(file, "utf8"), source);
    const name = requiredString(parsed.frontmatter.name, "name", source);
    requiredString(parsed.frontmatter.description, "description", source);
    if (name !== entry.name) throw new Error(`${source}: skill name must match its directory`);
    if (aliases.has(name)) throw new Error(`${source}: duplicate skill name ${name}`);
    aliases.add(name);
  }
  if (aliases.size === 0) throw new Error("skills: at least one native skill is required");
  return { root, aliases };
}

export function resolveBlueprintPackageRoot(moduleUrl = import.meta.url): string {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..", "..");
}

export function resolveOpenCodeDataRoot(env: NodeJS.ProcessEnv = process.env): string {
  const xdgData = env.XDG_DATA_HOME?.trim() || path.join(os.homedir(), ".local", "share");
  return path.resolve(xdgData, "opencode");
}

export async function loadBlueprintNativeAssets(
  packageRoot = resolveBlueprintPackageRoot()
): Promise<BlueprintNativeAssets> {
  const resolvedRoot = path.resolve(packageRoot);
  const [command, agent, skills] = await Promise.all([
    loadCommands(resolvedRoot),
    loadAgents(resolvedRoot),
    loadSkillAliases(resolvedRoot)
  ]);
  const mcpServerEntry = path.join(resolvedRoot, "dist", "mcp", "server.js");
  await assertRegularFile(mcpServerEntry);
  return {
    packageRoot: resolvedRoot,
    command,
    agent,
    skillRoot: skills.root,
    skillAliases: skills.aliases,
    mcpServerEntry
  };
}
