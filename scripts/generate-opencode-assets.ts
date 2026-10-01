#!/usr/bin/env tsx

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { loadBlueprintSkillInputs } from "../src/mcp/skill-metadata.js";
import { parseNativeMarkdown } from "../src/shared/native-frontmatter.js";
import type { OpenCodeAssetManifest } from "../src/opencode/asset-manifest.js";
import { BLUEPRINT_AGENT_TOOL_NAMES } from "../src/mcp/agent-metadata.js";
import { validateBundledBlueprintAgentDefinition } from "../src/mcp/agent-definition.js";
import { validateBundledBlueprintCommandDefinition } from "../src/mcp/command-definition.js";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "generated", "opencode-assets.json");

async function read(relative: string): Promise<string | null> {
  try { return await fs.readFile(path.join(repoRoot, relative), "utf8"); } catch { return null; }
}

async function listFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  const visit = async (relative: string): Promise<void> => {
    for (const entry of await fs.readdir(path.join(repoRoot, relative), { withFileTypes: true })) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link in native package assets: ${child}`);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) result.push(child);
    }
  };
  await visit(root);
  return result.sort();
}

async function main(): Promise<void> {
  const catalog = await blueprintCommandCatalog();
  const allSkillFiles = await listFiles("skills");
  const skillFiles = allSkillFiles.filter((file) => file.endsWith("/SKILL.md"));
  const skillAliases: string[] = [];
  const referenceClosure = new Set<string>(allSkillFiles);
  for (const skillPath of skillFiles) {
    const content = (await read(skillPath))!;
    const parsed = parseNativeMarkdown(content, skillPath);
    const name = parsed.frontmatter.name;
    if (typeof name !== "string" || path.posix.dirname(skillPath) !== `skills/${name}`) throw new Error(`${skillPath}: invalid skill identity`);
    skillAliases.push(name);
    referenceClosure.add(skillPath);
    const bundles = parsed.frontmatter.input_bundles as { shared?: unknown; commands?: unknown } | undefined;
    for (const value of [bundles?.shared, ...Object.values((bundles?.commands ?? {}) as Record<string, unknown>)]) {
      if (Array.isArray(value)) for (const input of value) if (typeof input === "string") referenceClosure.add(input);
    }
  }
  skillAliases.sort();
  if (skillAliases.length !== 17) throw new Error(`Expected exactly 17 canonical skills; found ${skillAliases.length}`);
  const commands: OpenCodeAssetManifest["commands"] = {};
  const rootInputs = await loadBlueprintSkillInputs("blueprint-router", "/blu", read);
  const rootValidation = await validateBundledBlueprintCommandDefinition("blu", read);
  if (!rootValidation.valid) throw new Error(`Invalid root command: ${rootValidation.issues.join("; ")}`);
  commands.blu = { path: "commands/blu.md", primarySkill: "blueprint-router", effectiveInputs: [...rootInputs.effective] };
  const catalogNames = Object.keys(catalog.commands).sort();
  if (catalogNames.length !== 56 || catalog.commands.do?.implemented !== false) throw new Error("Expected 56 catalog rows with unavailable do");
  for (const [name, entry] of Object.entries(catalog.commands).sort(([a], [b]) => a.localeCompare(b))) {
    if (name === "do") continue;
    if (!entry.implemented || !entry.manifestPath || !entry.skillPath) throw new Error(`Expected implemented native command ${name}`);
    const validation = await validateBundledBlueprintCommandDefinition(name, read);
    if (!validation.valid) throw new Error(`Invalid native command ${name}: ${validation.issues.join("; ")}`);
    const id = `blu-${name}`;
    const inputs = await loadBlueprintSkillInputs(entry.primarySkill, `/${id}`, read, entry.skillPath);
    commands[id] = { path: entry.manifestPath, primarySkill: entry.primarySkill, effectiveInputs: [...inputs.effective] };
  }
  if (Object.keys(commands).length !== 56) throw new Error(`Expected root plus 55 direct native commands; found ${Object.keys(commands).length}`);
  const agents: OpenCodeAssetManifest["agents"] = {};
  const expectedAgents = ["blueprint", ...BLUEPRINT_AGENT_TOOL_NAMES].sort();
  const agentFiles = (await listFiles("agents")).filter((file) => file.endsWith(".md"));
  const actualAgents = agentFiles.map((agentPath) => path.basename(agentPath, ".md")).sort();
  if (JSON.stringify(actualAgents) !== JSON.stringify(expectedAgents)) throw new Error(`Expected exact 16 native agents; found ${actualAgents.join(", ")}`);
  for (const agentName of expectedAgents) {
    const validation = await validateBundledBlueprintAgentDefinition(agentName, read);
    if (!validation.valid) throw new Error(`Invalid canonical agent ${agentName}: ${validation.issues.join("; ")}`);
    agents[agentName] = { path: `agents/${agentName}.md` };
  }
  const required = new Set<string>([
    ...Object.values(commands).flatMap((entry) => [entry.path, `skills/${entry.primarySkill}/SKILL.md`, ...entry.effectiveInputs]),
    ...Object.values(agents).map((entry) => entry.path),
    ...referenceClosure
  ]);
  const assets: Record<string, string> = {};
  for (const relative of [...required].sort()) {
    const content = await fs.readFile(path.join(repoRoot, relative));
    assets[relative] = createHash("sha256").update(content).digest("hex");
  }
  const manifest: OpenCodeAssetManifest = { schemaVersion: 1, generatedBy: "scripts/generate-opencode-assets.ts", assets, commands, agents: Object.fromEntries(Object.entries(agents).sort()), skillAliases, referenceClosure: [...referenceClosure].sort() };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await main();
