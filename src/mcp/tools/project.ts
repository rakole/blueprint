import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  BLUEPRINT_CONFIG_PATH,
  BLUEPRINT_DIR,
  BLUEPRINT_STATE_PATH,
  blueprintArtifactScaffold,
  ensureRepoRoot,
  getBlueprintRoot,
  resolveBlueprintPath,
  toRepoRelativePath
} from "./artifacts.js";
import {
  blueprintConfigGet,
  seedProjectConfig
} from "./config.js";
import { blueprintStateUpdate, loadBlueprintState } from "./state.js";

type CommandCatalogEntry = {
  command: string;
  route: string;
  wave: number;
  family: string;
  risk: string;
  primarySkill: string;
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

const CORE_PROJECT_ARTIFACTS = [
  `${BLUEPRINT_DIR}/PROJECT.md`,
  `${BLUEPRINT_DIR}/REQUIREMENTS.md`,
  `${BLUEPRINT_DIR}/ROADMAP.md`,
  BLUEPRINT_STATE_PATH,
  BLUEPRINT_CONFIG_PATH,
  `${BLUEPRINT_DIR}/phases/`
];

const FALLBACK_COMMAND_CATALOG: CommandCatalogResult = {
  commands: {
    "new-project": {
      command: "/blu:new-project",
      route: "/blu new-project",
      wave: 0,
      family: "Foundation",
      risk: "Medium",
      primarySkill: "blueprint-bootstrap"
    }
  },
  waves: {
    "0": ["new-project"]
  },
  aliases: {
    "new-project": ["/blu new-project"]
  }
};

async function pathExists(targetPath: string): Promise<boolean> {
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

async function readBundledCommandCatalog(): Promise<CommandCatalogResult> {
  const commandCatalogPath = new URL("../../../docs/COMMAND-CATALOG.md", import.meta.url);

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

      if (cells.length < 6) {
        continue;
      }

      const commandName = cells[0].replaceAll("`", "");
      const wave = Number.parseInt(cells[1], 10);
      const family = cells[2].replaceAll("`", "");
      const primarySkill = cells[3].replaceAll("`", "");
      const risk = cells[5].replaceAll("`", "");

      commands[commandName] = {
        command: `/blu:${commandName}`,
        route: `/blu ${commandName}`,
        wave,
        family,
        risk,
        primarySkill
      };

      const waveKey = String(wave);
      waves[waveKey] ??= [];
      waves[waveKey].push(commandName);
      aliases[commandName] = [`/blu ${commandName}`];
    }

    return Object.keys(commands).length > 0
      ? { commands, waves, aliases }
      : FALLBACK_COMMAND_CATALOG;
  } catch {
    return FALLBACK_COMMAND_CATALOG;
  }
}

async function getMissingArtifacts(projectRoot: string): Promise<string[]> {
  const missingArtifacts: string[] = [];

  for (const artifact of CORE_PROJECT_ARTIFACTS) {
    const artifactPath = resolveBlueprintPath(projectRoot, artifact);

    if (!(await pathExists(artifactPath))) {
      missingArtifacts.push(artifact);
    }
  }

  return missingArtifacts;
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
      nextAction: "Run /blu:discuss-phase 1",
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
  const missingArtifacts = await getMissingArtifacts(projectRoot);
  const initialized = missingArtifacts.length === 0;

  if (!initialized) {
    const nextAction =
      missingArtifacts.length === CORE_PROJECT_ARTIFACTS.length
        ? "Run /blu:new-project"
        : "Run /blu:health to repair the partial Blueprint state";

    return {
      initialized: false,
      currentPhase: null,
      currentMilestone: null,
      nextAction,
      health: {
        missingArtifacts,
        warnings: missingArtifacts.length > 0 ? ["Blueprint is partially initialized."] : []
      }
    };
  }

  const state = await loadBlueprintState(projectRoot);
  const effectiveConfig = await blueprintConfigGet({
    scope: "effective",
    cwd: projectRoot
  });

  return {
    initialized: true,
    currentPhase: state.currentPhase,
    currentMilestone: state.currentMilestone,
    nextAction: state.nextAction || "Run /blu:discuss-phase 1",
    health: {
      missingArtifacts,
      warnings: effectiveConfig.warnings
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
