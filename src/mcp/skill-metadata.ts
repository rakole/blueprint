import path from "node:path";

import { parseNativeMarkdown } from "../shared/native-frontmatter.js";
import { blueprintDiscoverableSkillPath } from "./runtime-vocabulary.js";

type RelativePathReader = (relativePath: string) => Promise<string | null>;

export type BlueprintSkillResolvedInputs = {
  skill: string;
  shared: string[];
  commandSpecific: string[];
  effective: string[];
};

type BlueprintSkillMetadata = {
  name: string;
  description: string;
  status?: string;
  commands: string[];
  shared: string[];
  commandBundles: Record<string, string[]>;
};

const BLUEPRINT_METADATA_KEYS = new Set([
  "name",
  "description",
  "status",
  "commands",
  "input_bundles"
]);

function expectString(value: unknown, source: string, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${source}: ${key} must be a non-empty string`);
  }
  return value.trim();
}

function expectStringArray(value: unknown, source: string, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${source}: ${key} must be an array of strings`);
  }
  const normalized = value.map((item) => item.trim());
  if (normalized.some((item) => item.length === 0)) {
    throw new Error(`${source}: ${key} must not contain empty values`);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${source}: ${key} must not contain duplicates`);
  }
  return normalized;
}

function expectObject(value: unknown, source: string, key: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${source}: ${key} must be a mapping`);
  }
  return value as Record<string, unknown>;
}

function assertPackageRelativePath(value: string, source: string, key: string): void {
  if (
    path.posix.isAbsolute(value) ||
    value.includes("\\") ||
    value.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
    (!value.startsWith("commands/") && !value.startsWith("skills/"))
  ) {
    throw new Error(`${source}: ${key} must stay within packaged commands/ or skills/: ${JSON.stringify(value)}`);
  }
}

function parseBlueprintSkillMetadata(skillName: string, content: string): BlueprintSkillMetadata {
  const source = `skill ${skillName}`;
  const { frontmatter } = parseNativeMarkdown(content, source);

  for (const key of Object.keys(frontmatter)) {
    if (!BLUEPRINT_METADATA_KEYS.has(key)) {
      throw new Error(`${source}: unsupported frontmatter key ${JSON.stringify(key)}`);
    }
  }

  const name = expectString(frontmatter.name, source, "name");
  if (name !== skillName) {
    throw new Error(`${source}: frontmatter name must equal ${JSON.stringify(skillName)}`);
  }
  const description = expectString(frontmatter.description, source, "description");
  const status = frontmatter.status === undefined
    ? undefined
    : expectString(frontmatter.status, source, "status");
  if (status !== undefined && status !== "implemented") {
    throw new Error(`${source}: status must be \"implemented\" when present`);
  }

  const commands = frontmatter.commands === undefined
    ? []
    : expectStringArray(frontmatter.commands, source, "commands");
  for (const command of commands) {
    if (command !== "/blu" && !/^\/blu-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(command)) {
      throw new Error(`${source}: commands contains an invalid Blueprint command ${JSON.stringify(command)}`);
    }
  }

  if (frontmatter.input_bundles === undefined) {
    return { name, description, status, commands, shared: [], commandBundles: {} };
  }

  const bundles = expectObject(frontmatter.input_bundles, source, "input_bundles");
  for (const key of Object.keys(bundles)) {
    if (key !== "shared" && key !== "commands") {
      throw new Error(`${source}: unsupported input_bundles key ${JSON.stringify(key)}`);
    }
  }
  const shared = expectStringArray(bundles.shared ?? [], source, "input_bundles.shared");
  const rawCommandBundles = expectObject(
    bundles.commands ?? {},
    source,
    "input_bundles.commands"
  );
  const commandBundles: Record<string, string[]> = {};
  for (const [command, value] of Object.entries(rawCommandBundles)) {
    if (!commands.includes(command)) {
      throw new Error(`${source}: input_bundles.commands has unrecognized command key ${JSON.stringify(command)}`);
    }
    commandBundles[command] = expectStringArray(
      value,
      source,
      `input_bundles.commands[${JSON.stringify(command)}]`
    );
  }

  for (const [key, values] of [["input_bundles.shared", shared], ...Object.entries(commandBundles)] as const) {
    for (const value of values) {
      assertPackageRelativePath(value, source, key);
    }
  }

  return { name, description, status, commands, shared, commandBundles };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function activeCommandAsset(commandPath: string): string | null {
  if (commandPath === "/blu") {
    return "commands/blu.md";
  }
  if (/^\/blu-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(commandPath)) {
    return `commands/${commandPath.slice(1)}.md`;
  }
  return null;
}

export function resolveBlueprintSkillInputsFromContent(
  skillName: string,
  commandPath: string,
  content: string
): BlueprintSkillResolvedInputs {
  const metadata = parseBlueprintSkillMetadata(skillName, content);
  const shared = metadata.shared;
  const commandSpecific = metadata.commandBundles[commandPath] ?? [];
  const suppliedCommand = activeCommandAsset(commandPath);

  return {
    skill: skillName,
    shared,
    commandSpecific,
    effective: unique([...shared, ...commandSpecific]).filter((input) => input !== suppliedCommand)
  };
}

export async function loadBlueprintSkillInputs(
  skillName: string,
  commandPath: string,
  readRelativePath: RelativePathReader,
  preferredPath?: string | null
): Promise<BlueprintSkillResolvedInputs> {
  const canonicalPath = preferredPath ?? blueprintDiscoverableSkillPath(skillName);
  assertPackageRelativePath(canonicalPath, `skill ${skillName}`, "skill path");
  const content = await readRelativePath(canonicalPath);

  if (content === null) {
    return { skill: skillName, shared: [], commandSpecific: [], effective: [] };
  }

  const resolved = resolveBlueprintSkillInputsFromContent(skillName, commandPath, content);
  for (const input of unique([...resolved.shared, ...resolved.commandSpecific])) {
    if (await readRelativePath(input) === null) {
      throw new Error(`skill ${skillName}: input bundle path is missing: ${input}`);
    }
  }
  return resolved;
}
