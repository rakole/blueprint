import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  BLUEPRINT_DIR,
  artifactToolDefinitions,
  blueprintArtifactScaffold,
  ensureRepoRoot,
  getBlueprintRoot,
  inspectBlueprintArtifacts
} from "./artifacts.js";
import {
  configToolDefinitions,
  blueprintConfigGet,
  seedProjectConfig
} from "./config.js";
import {
  stateToolDefinitions,
  blueprintStateLoad,
  blueprintStateUpdate
} from "./state.js";

type CommandStatus = "planned" | "implemented" | "blocked" | "repairing";

type CommandCatalogEntry = {
  command: string;
  route: string;
  wave: number;
  family: string;
  risk: string;
  primarySkill: string;
  declaredStatus: CommandStatus;
  status: CommandStatus;
  implemented: boolean;
  blockedBy: string[];
  manifestPath: string | null;
  skillPath: string | null;
  specPath: string | null;
  requiredTools: string[];
  requiredToolsSatisfied: boolean;
  optionalAgents: string[];
  availableOptionalAgents: string[];
};

type CommandCatalogResult = {
  commands: Record<string, CommandCatalogEntry>;
  waves: Record<string, string[]>;
  aliases: Record<string, string[]>;
};

type ProjectInitArgs = {
  cwd?: string;
  defaultsPath?: string;
  overwrite?: boolean;
  projectName?: string;
};

type ProjectInitResult = {
  projectRoot: string;
  createdPaths: string[];
  seededState: {
    updatedFields: string[];
    statePath: string;
  };
  configPath: string;
  configProvenance: {
    layersApplied: string[];
    defaultsPath: string | null;
    projectPath: string | null;
    defaultsApplied: boolean;
    projectApplied: boolean;
  };
  warnings: string[];
};

type ProjectStatusArgs = {
  cwd?: string;
};

type ProjectStatusResult = {
  status: "uninitialized" | "partial" | "initialized";
  initialized: boolean;
  currentPhase: string | null;
  currentMilestone: string | null;
  nextAction: string;
  health: {
    missingArtifacts: string[];
    warnings: string[];
  };
};

const commandCatalogInputSchema = {};
const projectInitInputSchema = {
  cwd: z.string().optional(),
  defaultsPath: z.string().optional(),
  overwrite: z.boolean().optional(),
  projectName: z.string().optional()
};
const projectStatusInputSchema = {
  cwd: z.string().optional()
};

const ROOT_COMMAND_MANIFEST = "commands/blu.toml";
const COMMAND_SPEC_PREFIX = "docs/commands";
const PROJECT_TOOL_NAMES = [
  "blueprint_command_catalog",
  "blueprint_project_init",
  "blueprint_project_status"
] as const;
const AVAILABLE_TOOL_NAMES = new Set([
  ...PROJECT_TOOL_NAMES,
  ...configToolDefinitions.map((definition) => definition.name),
  ...stateToolDefinitions.map((definition) => definition.name),
  ...artifactToolDefinitions.map((definition) => definition.name)
]);

const FALLBACK_COMMAND_CATALOG: CommandCatalogResult = {
  commands: {
    "new-project": {
      command: "/blu:new-project",
      route: "/blu new-project",
      wave: 0,
      family: "Foundation",
      risk: "Medium",
      primarySkill: "blueprint-bootstrap",
      declaredStatus: "implemented",
      status: "implemented",
      implemented: true,
      blockedBy: [],
      manifestPath: "commands/blu/new-project.toml",
      skillPath: "skills/blueprint-bootstrap.md",
      specPath: "docs/commands/new-project.md",
      requiredTools: [
        "blueprint_project_init",
        "blueprint_project_status",
        "blueprint_config_get",
        "blueprint_config_set",
        "blueprint_state_update",
        "blueprint_artifact_scaffold"
      ],
      requiredToolsSatisfied: true,
      optionalAgents: ["blueprint-project-researcher", "blueprint-roadmapper"],
      availableOptionalAgents: ["blueprint-project-researcher", "blueprint-roadmapper"]
    }
  },
  waves: {
    "0": ["new-project"]
  },
  aliases: {
    "new-project": ["/blu new-project"]
  }
};

function bundledUrl(relativePath: string): URL {
  return new URL(`../../../${relativePath}`, import.meta.url);
}

async function pathExists(targetPath: string | URL): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readPackageProjectName(projectRoot: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : null;
  } catch {
    return null;
  }
}

async function inferProjectName(
  projectRoot: string,
  requestedName?: string
): Promise<string> {
  const explicit = requestedName?.trim();

  if (explicit) {
    return explicit;
  }

  return (await readPackageProjectName(projectRoot)) ?? path.basename(projectRoot);
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`(?:^|\\n)## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  );

  return match?.[1] ?? "";
}

function parseRequiredTools(markdown: string): string[] {
  const section = extractMarkdownSection(markdown, "Required MCP Tools");

  return [...section.matchAll(/`(blueprint_[a-z0-9_]+)`/g)].map((match) => match[1]);
}

function parseOptionalAgents(markdown: string, primarySkill: string): string[] {
  const section = extractMarkdownSection(markdown, "Skills And Subagents");
  const values = [...section.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]);

  return values.filter((value) => value !== primarySkill);
}

function commandManifestPath(commandName: string): string {
  return `commands/blu/${commandName}.toml`;
}

function commandSkillPath(primarySkill: string): string {
  return `skills/${primarySkill}.md`;
}

function commandAgentPath(agentName: string): string {
  return `agents/${agentName}.md`;
}

type ParsedCatalogRow = {
  commandName: string;
  wave: number;
  family: string;
  primarySkill: string;
  declaredStatus: CommandStatus;
  risk: string;
};

function parseCatalogRow(cells: string[]): ParsedCatalogRow | null {
  if (cells.length < 7) {
    return null;
  }

  const commandName = cells[0].replaceAll("`", "");
  const wave = Number.parseInt(cells[1], 10);
  const family = cells[2].replaceAll("`", "");
  const primarySkill = cells[3].replaceAll("`", "");
  const declaredStatus = cells[4].replaceAll("`", "") as CommandStatus;
  const risk = cells[6].replaceAll("`", "");

  if (
    !commandName ||
    Number.isNaN(wave) ||
    !["planned", "implemented", "blocked", "repairing"].includes(declaredStatus)
  ) {
    return null;
  }

  return {
    commandName,
    wave,
    family,
    primarySkill,
    declaredStatus,
    risk
  };
}

async function buildCommandCatalogEntry(parsedRow: ParsedCatalogRow): Promise<CommandCatalogEntry> {
  const specPath = `${COMMAND_SPEC_PREFIX}/${parsedRow.commandName}.md`;
  const manifestPath = commandManifestPath(parsedRow.commandName);
  const skillPath = commandSkillPath(parsedRow.primarySkill);
  const specUrl = bundledUrl(specPath);
  const manifestUrl = bundledUrl(manifestPath);
  const skillUrl = bundledUrl(skillPath);
  const manifestExists = await pathExists(manifestUrl);
  const skillExists = await pathExists(skillUrl);
  const specExists = await pathExists(specUrl);
  const specMarkdown = specExists ? await fs.readFile(specUrl, "utf8") : "";
  const requiredTools = parseRequiredTools(specMarkdown);
  const optionalAgents = parseOptionalAgents(specMarkdown, parsedRow.primarySkill);
  const availableOptionalAgents: string[] = [];
  const blockedBy: string[] = [];

  if (!specExists) {
    blockedBy.push(`Missing command spec: ${specPath}`);
  }

  if (!manifestExists) {
    blockedBy.push(`Missing command manifest: ${manifestPath}`);
  }

  if (!skillExists) {
    blockedBy.push(`Missing primary skill: ${skillPath}`);
  }

  const missingTools = requiredTools.filter((toolName) => !AVAILABLE_TOOL_NAMES.has(toolName));
  const requiredToolsSatisfied = missingTools.length === 0;

  for (const toolName of missingTools) {
    blockedBy.push(`Missing required MCP tool: ${toolName}`);
  }

  for (const agentName of optionalAgents) {
    if (await pathExists(bundledUrl(commandAgentPath(agentName)))) {
      availableOptionalAgents.push(agentName);
    }
  }

  let status = parsedRow.declaredStatus;

  if (manifestExists && skillExists && requiredToolsSatisfied) {
    status = "implemented";
  } else if (manifestExists || skillExists) {
    status = "repairing";
  } else if (blockedBy.length > 0) {
    status = "blocked";
  }

  return {
    command: `/blu:${parsedRow.commandName}`,
    route: `/blu ${parsedRow.commandName}`,
    wave: parsedRow.wave,
    family: parsedRow.family,
    risk: parsedRow.risk,
    primarySkill: parsedRow.primarySkill,
    declaredStatus: parsedRow.declaredStatus,
    status,
    implemented: status === "implemented",
    blockedBy,
    manifestPath: manifestExists ? manifestPath : null,
    skillPath: skillExists ? skillPath : null,
    specPath: specExists ? specPath : null,
    requiredTools,
    requiredToolsSatisfied,
    optionalAgents,
    availableOptionalAgents
  };
}

async function readBundledCommandCatalog(): Promise<CommandCatalogResult> {
  const commandCatalogPath = bundledUrl("docs/COMMAND-CATALOG.md");

  try {
    const markdown = await fs.readFile(commandCatalogPath, "utf8");
    const commands: Record<string, CommandCatalogEntry> = {};
    const waves: Record<string, string[]> = {};
    const aliases: Record<string, string[]> = {};

    for (const line of markdown.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed.startsWith("| `")) {
        continue;
      }

      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());

      const parsedRow = parseCatalogRow(cells);

      if (!parsedRow) {
        continue;
      }

      const entry = await buildCommandCatalogEntry(parsedRow);

      commands[parsedRow.commandName] = entry;

      const waveKey = String(parsedRow.wave);
      waves[waveKey] ??= [];
      waves[waveKey].push(parsedRow.commandName);
      aliases[parsedRow.commandName] = [`/blu ${parsedRow.commandName}`];
    }

    return Object.keys(commands).length > 0
      ? { commands, waves, aliases }
      : FALLBACK_COMMAND_CATALOG;
  } catch {
    return FALLBACK_COMMAND_CATALOG;
  }
}

export async function blueprintCommandCatalog(): Promise<CommandCatalogResult> {
  return readBundledCommandCatalog();
}

export async function blueprintProjectInit(
  args: ProjectInitArgs = {}
): Promise<ProjectInitResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const blueprintRoot = getBlueprintRoot(projectRoot);
  const overwrite = args.overwrite ?? false;

  if ((await pathExists(blueprintRoot)) && !overwrite) {
    throw new Error(
      "Blueprint artifacts already exist at .blueprint/. Re-run only after explicit overwrite confirmation."
    );
  }

  const projectName = await inferProjectName(projectRoot, args.projectName);
  const scaffold = await blueprintArtifactScaffold({
    cwd: projectRoot,
    overwrite,
    projectName,
    artifacts: [
      `${BLUEPRINT_DIR}/PROJECT.md`,
      `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
      `${BLUEPRINT_DIR}/ROADMAP.md`,
      `${BLUEPRINT_DIR}/phases/`
    ]
  });
  const seededConfig = await seedProjectConfig({
    cwd: projectRoot,
    defaultsPath: args.defaultsPath
  });
  const seededState = await blueprintStateUpdate({
    cwd: projectRoot,
    patch: {
      projectStatus: "initialized",
      currentMilestone: "v1",
      currentPhase: "1",
      activeCommand: "/blu:new-project",
      nextAction: "Run /blu for the next Blueprint step",
      blockers: [],
      lastUpdated: new Date().toISOString()
    }
  });
  const createdPaths = [
    ...scaffold.createdFiles,
    seededState.statePath,
    seededConfig.configPath
  ];

  return {
    projectRoot,
    createdPaths,
    seededState,
    configPath: seededConfig.configPath,
    configProvenance: seededConfig.provenance,
    warnings: [...scaffold.warnings, ...seededConfig.warnings]
  };
}

export async function blueprintProjectStatus(
  args: ProjectStatusArgs = {}
): Promise<ProjectStatusResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const initialized = inspection.readiness === "initialized";
  const partial = inspection.readiness === "partial";

  if (!initialized) {
    const nextAction =
      inspection.readiness === "uninitialized"
        ? "Run /blu:new-project"
        : "Re-run /blu:new-project only after you decide how to handle the partial .blueprint state, or run /blu:health to inspect and repair it";

    return {
      status: inspection.readiness,
      initialized: false,
      currentPhase: null,
      currentMilestone: null,
      nextAction,
      health: {
        missingArtifacts: inspection.core.missing,
        warnings:
          partial
            ? ["Blueprint is partially initialized."]
            : ["Blueprint has not been initialized yet."]
      }
    };
  }

  const stateResult = await blueprintStateLoad({ cwd: projectRoot });
  let configWarnings: string[] = [];

  try {
    const effectiveConfig = await blueprintConfigGet({
      scope: "effective",
      cwd: projectRoot
    });
    configWarnings = effectiveConfig.warnings;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    configWarnings = [`Blueprint config could not be read: ${message}`];
  }

  return {
    status: inspection.readiness,
    initialized: true,
    currentPhase: stateResult.derivedStatus.currentPhase,
    currentMilestone: stateResult.state.currentMilestone,
    nextAction:
      stateResult.derivedStatus.nextAction || "Run /blu for the next Blueprint step",
    health: {
      missingArtifacts: inspection.core.missing,
      warnings: configWarnings
    }
  };
}

export const projectToolDefinitions = [
  {
    name: "blueprint_command_catalog",
    description: "Return the retained Blueprint command registry and router metadata.",
    inputSchema: commandCatalogInputSchema,
    handler: async () => blueprintCommandCatalog()
  },
  {
    name: "blueprint_project_init",
    description:
      "Create the initial .blueprint/ scaffold and seed normalized repo config from defaults.",
    inputSchema: projectInitInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintProjectInit(args as ProjectInitArgs)
  },
  {
    name: "blueprint_project_status",
    description: "Summarize Blueprint readiness and the next safe action for the repo.",
    inputSchema: projectStatusInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintProjectStatus(args as ProjectStatusArgs)
  }
];
