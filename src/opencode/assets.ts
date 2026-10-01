import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseNativeMarkdown } from "../shared/native-frontmatter.js";
import { loadBlueprintSkillInputs } from "../mcp/skill-metadata.js";
import {
  loadOpenCodeAssetManifest,
  validateManifestAsset,
  type OpenCodeAssetManifest
} from "./asset-manifest.js";

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
  diagnostics: string[];
  packageReadDirectories: string[];
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

function assertContained(packageRoot: string, candidate: string): void {
  const relative = path.relative(packageRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Native asset escapes the package root: ${candidate}`);
  }
}

async function assertLiteralDirectory(packageRoot: string, directory: string): Promise<void> {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Native asset directory must be a literal directory: ${directory}`);
  }
  assertContained(packageRoot, await realpath(directory));
}

async function assertRegularFile(packageRoot: string, file: string): Promise<void> {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Native asset must be a literal regular file: ${file}`);
  }
  assertContained(packageRoot, await realpath(file));
}

async function markdownFiles(packageRoot: string, directory: string): Promise<string[]> {
  await assertLiteralDirectory(packageRoot, directory);
  const entries = await readdir(directory, { withFileTypes: true });
  const linkedMarkdown = entries.find((entry) => entry.isSymbolicLink() && entry.name.endsWith(".md"));
  if (linkedMarkdown) {
    throw new Error(`Native asset must not be a symbolic link: ${path.join(directory, linkedMarkdown.name)}`);
  }
  return entries
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".md"))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function commandPacket(primarySkill: string, effectiveInputs: string[]): string {
  const inputs = effectiveInputs.length > 0
    ? effectiveInputs.map((input) => `- ${input}`).join("\n")
    : "- none";
  return [
    "",
    "Blueprint native loading contract:",
    `1. Load the \`${primarySkill}\` skill exactly once with the native skill tool.`,
    "2. Read only these already-resolved active package inputs (absolute paths):",
    inputs,
    "Do not rediscover skill metadata, load sibling bundles, or reread this active command."
  ].join("\n");
}

async function loadCommands(packageRoot: string, manifest: OpenCodeAssetManifest): Promise<Record<string, NativeCommand>> {
  const result: Record<string, NativeCommand> = {};
  for (const file of await markdownFiles(packageRoot, path.join(packageRoot, "commands"))) {
    await assertRegularFile(packageRoot, file);
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
    const manifestEntry = manifest.commands[name];
    if (!manifestEntry || manifestEntry.path !== source) throw new Error(`${source}: command is missing or mismatched in generated/opencode-assets.json`);
    result[name] = {
      description,
      agent: "blueprint",
      subtask: false,
      template: `${parsed.body.trim()}${commandPacket(
        manifestEntry.primarySkill,
        manifestEntry.effectiveInputs.map((input) => path.join(packageRoot, input))
      )}`
    };
  }
  if (!("blu" in result)) throw new Error("commands/blu.md: required root command is missing");
  const actual = Object.keys(result).sort();
  const expected = Object.keys(manifest.commands).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Native command files do not exactly match generated/opencode-assets.json");
  return result;
}

async function loadAgents(packageRoot: string, manifest: OpenCodeAssetManifest): Promise<{ agents: Record<string, NativeAgent>; diagnostics: string[] }> {
  const result: Record<string, NativeAgent> = {};
  const diagnostics: string[] = [];
  const packagedAgentFiles = (await markdownFiles(packageRoot, path.join(packageRoot, "agents")))
    .map((file) => path.relative(packageRoot, file))
    .sort();
  const declaredAgentFiles = Object.values(manifest.agents).map((entry) => entry.path).sort();
  const unlistedAgentFiles = packagedAgentFiles.filter((file) => !declaredAgentFiles.includes(file));
  if (unlistedAgentFiles.length > 0) throw new Error(`Native agent files are absent from generated/opencode-assets.json: ${unlistedAgentFiles.join(", ")}`);
  for (const [name, entry] of Object.entries(manifest.agents)) {
    const source = entry.path;
    try {
      await validateManifestAsset(packageRoot, source, manifest.assets[source]!);
    } catch (error) {
      if (name === "blueprint") throw error;
      diagnostics.push(`Optional agent ${name} unavailable: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const file = path.join(packageRoot, source);
    try {
    const parsed = parseNativeMarkdown(await readFile(file, "utf8"), source);
    assertExactKeys(parsed.frontmatter, AGENT_KEYS, source);
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
    } catch (error) {
      if (name === "blueprint") throw error;
      diagnostics.push(`Optional agent ${name} unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!("blueprint" in result)) throw new Error("agents/blueprint.md: required primary agent is missing");
  return { agents: result, diagnostics };
}

async function loadSkillAliases(packageRoot: string): Promise<{ root: string; aliases: Set<string> }> {
  const root = path.join(packageRoot, "skills");
  await assertLiteralDirectory(packageRoot, root);
  const aliases = new Set<string>();
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Native skill directory must not be a symbolic link: ${path.join(root, entry.name)}`);
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const file = path.join(root, entry.name, "SKILL.md");
    await assertLiteralDirectory(packageRoot, path.join(root, entry.name));
    await assertRegularFile(packageRoot, file);
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
  const resolvedRoot = await realpath(path.resolve(packageRoot));
  const manifest = await loadOpenCodeAssetManifest(resolvedRoot);
  const optionalAgentPaths = new Set(Object.entries(manifest.agents).filter(([name]) => name !== "blueprint").map(([, entry]) => entry.path));
  for (const [relative, hash] of Object.entries(manifest.assets)) {
    if (!optionalAgentPaths.has(relative)) await validateManifestAsset(resolvedRoot, relative, hash);
  }
  const readPackagedPath = async (relative: string): Promise<string | null> => {
    try { return await readFile(path.join(resolvedRoot, relative), "utf8"); } catch { return null; }
  };
  for (const [commandId, entry] of Object.entries(manifest.commands)) {
    const commandPath = commandId === "blu" ? "/blu" : `/${commandId}`;
    const resolved = await loadBlueprintSkillInputs(
      entry.primarySkill,
      commandPath,
      readPackagedPath,
      `skills/${entry.primarySkill}/SKILL.md`
    );
    if (JSON.stringify(resolved.effective) !== JSON.stringify(entry.effectiveInputs)) {
      throw new Error(`OpenCode asset manifest has stale effectiveInputs for ${commandId}`);
    }
  }
  const [command, loadedAgents, skills] = await Promise.all([
    loadCommands(resolvedRoot, manifest),
    loadAgents(resolvedRoot, manifest),
    loadSkillAliases(resolvedRoot)
  ]);
  if (JSON.stringify([...skills.aliases].sort()) !== JSON.stringify(manifest.skillAliases)) throw new Error("Native skill aliases do not exactly match generated/opencode-assets.json");
  const mcpServerEntry = path.join(resolvedRoot, "dist", "mcp", "server.js");
  await assertLiteralDirectory(resolvedRoot, path.join(resolvedRoot, "dist"));
  await assertLiteralDirectory(resolvedRoot, path.join(resolvedRoot, "dist", "mcp"));
  await assertLiteralDirectory(resolvedRoot, path.join(resolvedRoot, "dist", "opencode"));
  await assertRegularFile(resolvedRoot, mcpServerEntry);
  return {
    packageRoot: resolvedRoot,
    command,
    agent: loadedAgents.agents,
    skillRoot: skills.root,
    skillAliases: skills.aliases,
    mcpServerEntry,
    diagnostics: loadedAgents.diagnostics,
    packageReadDirectories: [...new Set([
      ...manifest.skillAliases.map((skill) => path.join(resolvedRoot, "skills", skill)),
      ...Object.values(manifest.commands).flatMap((entry) =>
        entry.effectiveInputs.map((input) => path.dirname(path.join(resolvedRoot, input)))
      )
    ])].sort()
  };
}
