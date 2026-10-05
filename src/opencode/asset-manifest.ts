import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

export type OpenCodeAssetManifest = {
  schemaVersion: 1;
  generatedBy: "scripts/generate-opencode-assets.ts";
  assets: Record<string, string>;
  commands: Record<string, {
    path: string;
    primarySkill: string;
    effectiveInputs: string[];
  }>;
  agents: Record<string, { path: string }>;
  skillAliases: string[];
  referenceClosure: string[];
};

const TOP_LEVEL_KEYS = new Set([
  "schemaVersion", "generatedBy", "assets", "commands", "agents",
  "skillAliases", "referenceClosure"
]);
const COMMAND_KEYS = new Set(["path", "primarySkill", "effectiveInputs"]);
const AGENT_KEYS = new Set(["path"]);
const SHA256 = /^[a-f0-9]{64}$/;

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`OpenCode asset manifest ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>, label: string): void {
  const unknown = Object.keys(value).filter((key) => !keys.has(key));
  const missing = [...keys].filter((key) => !(key in value));
  if (unknown.length || missing.length) {
    throw new Error(`OpenCode asset manifest ${label} has invalid keys (missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"})`);
  }
}

function relativePath(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || path.posix.isAbsolute(value) || value.includes("\\") || value.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`OpenCode asset manifest ${label} must be a normalized package-relative path`);
  }
  return value;
}

function stringArray(value: unknown, label: string, paths = false, sorted = true): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`OpenCode asset manifest ${label} must be an array of non-empty strings`);
  }
  const result = paths ? value.map((item) => relativePath(item, label)) : [...value] as string[];
  if (new Set(result).size !== result.length || (sorted && [...result].sort().some((item, index) => item !== result[index]))) {
    throw new Error(`OpenCode asset manifest ${label} must be unique${sorted ? " and sorted" : ""}`);
  }
  return result;
}

export function parseOpenCodeAssetManifest(value: unknown): OpenCodeAssetManifest {
  const root = object(value, "root");
  exactKeys(root, TOP_LEVEL_KEYS, "root");
  if (root.schemaVersion !== 1 || root.generatedBy !== "scripts/generate-opencode-assets.ts") {
    throw new Error("OpenCode asset manifest has an unsupported schemaVersion or generatedBy value");
  }
  const rawAssets = object(root.assets, "assets");
  const assets: Record<string, string> = {};
  for (const key of Object.keys(rawAssets).sort()) {
    const assetPath = relativePath(key, `assets.${key}`);
    const hash = rawAssets[key];
    if (typeof hash !== "string" || !SHA256.test(hash)) throw new Error(`OpenCode asset manifest assets.${key} must be a SHA-256 digest`);
    assets[assetPath] = hash;
  }
  const commands: OpenCodeAssetManifest["commands"] = {};
  for (const key of Object.keys(object(root.commands, "commands")).sort()) {
    if (!/^blu(?:-[a-z0-9]+)*$/.test(key)) throw new Error(`OpenCode asset manifest has invalid command identity ${key}`);
    const entry = object((root.commands as Record<string, unknown>)[key], `commands.${key}`);
    exactKeys(entry, COMMAND_KEYS, `commands.${key}`);
    if (typeof entry.primarySkill !== "string" || !/^blueprint-[a-z0-9-]+$/.test(entry.primarySkill)) throw new Error(`OpenCode asset manifest commands.${key}.primarySkill is invalid`);
    commands[key] = { path: relativePath(entry.path, `commands.${key}.path`), primarySkill: entry.primarySkill, effectiveInputs: stringArray(entry.effectiveInputs, `commands.${key}.effectiveInputs`, true, false) };
  }
  const agents: OpenCodeAssetManifest["agents"] = {};
  for (const key of Object.keys(object(root.agents, "agents")).sort()) {
    if (!/^blueprint(?:-[a-z0-9]+)*$/.test(key)) throw new Error(`OpenCode asset manifest has invalid agent identity ${key}`);
    const entry = object((root.agents as Record<string, unknown>)[key], `agents.${key}`);
    exactKeys(entry, AGENT_KEYS, `agents.${key}`);
    agents[key] = { path: relativePath(entry.path, `agents.${key}.path`) };
  }
  const skillAliases = stringArray(root.skillAliases, "skillAliases");
  const referenceClosure = stringArray(root.referenceClosure, "referenceClosure", true);
  for (const [name, command] of Object.entries(commands)) {
    for (const required of [command.path, `skills/${command.primarySkill}/SKILL.md`, ...command.effectiveInputs]) {
      if (!(required in assets)) throw new Error(`OpenCode asset manifest command ${name} references unhashed asset ${required}`);
    }
    if (!skillAliases.includes(command.primarySkill)) throw new Error(`OpenCode asset manifest command ${name} references unknown primary skill ${command.primarySkill}`);
  }
  for (const [name, agent] of Object.entries(agents)) {
    if (!(agent.path in assets)) throw new Error(`OpenCode asset manifest agent ${name} references unhashed asset ${agent.path}`);
  }
  for (const reference of referenceClosure) {
    if (!(reference in assets)) throw new Error(`OpenCode asset manifest referenceClosure contains unhashed asset ${reference}`);
  }
  return { schemaVersion: 1, generatedBy: "scripts/generate-opencode-assets.ts", assets, commands, agents, skillAliases, referenceClosure };
}

function assertContained(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`OpenCode packaged asset escapes package root: ${candidate}`);
}

export async function validateManifestAsset(packageRoot: string, relative: string, expectedHash: string): Promise<string> {
  const canonicalRoot = await realpath(packageRoot);
  const candidate = path.join(canonicalRoot, relative);
  const stat = await lstat(candidate);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`OpenCode packaged asset must be a literal regular file: ${relative}`);
  assertContained(canonicalRoot, await realpath(candidate));
  const actual = createHash("sha256").update(await readFile(candidate)).digest("hex");
  if (actual !== expectedHash) throw new Error(`OpenCode packaged asset hash mismatch: ${relative}`);
  return candidate;
}

export async function loadOpenCodeAssetManifest(packageRoot: string): Promise<OpenCodeAssetManifest> {
  const canonicalRoot = await realpath(packageRoot);
  const manifestPath = path.join(canonicalRoot, "generated", "opencode-assets.json");
  const stat = await lstat(manifestPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("generated/opencode-assets.json must be a literal regular file");
  assertContained(canonicalRoot, await realpath(manifestPath));
  return parseOpenCodeAssetManifest(JSON.parse(await readFile(manifestPath, "utf8")));
}
