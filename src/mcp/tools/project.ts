import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import {
  BLUEPRINT_DIR,
  DURABLE_REQUIREMENT_ID_PATTERN,
  artifactToolDefinitions,
  blueprintArtifactScaffold,
  ensureRepoRoot,
  getBlueprintRoot,
  inspectBlueprintArtifacts,
  inspectBootstrapArtifacts,
  type BootstrapArtifactDiagnostics,
  type BootstrapAssessment,
  type BootstrapRequirementRow,
  type BootstrapRoadmapPhase,
  type BootstrapSeed
} from "./artifacts.js";
import { safeJsonParseObject } from "../../shared/security.js";
import {
  configToolDefinitions,
  blueprintConfigGet,
  seedProjectConfig
} from "./config.js";
import { phaseToolDefinitions } from "./phase.js";
import {
  stateToolDefinitions,
  blueprintStateLoad,
  blueprintStateUpdate
} from "./state.js";
import { reviewToolDefinitions } from "./review.js";
import { impactToolDefinitions } from "./impact.js";
import { updateToolDefinitions } from "./update.js";
import { workspaceToolDefinitions } from "./workspace.js";
import {
  blueprintDiscoverableSkillPath,
  resolveBlueprintSkillPath,
  type BlueprintInternalToolName
} from "../runtime-vocabulary.js";
import {
  blueprintDirectCommand,
  blueprintDirectCommandAliases,
  blueprintPrimaryManifestPath,
  blueprintRootCommand,
  blueprintRouterCommand,
  blueprintRunCommand,
  blueprintRunDirectCommand
} from "../command-paths.js";
import { resolveAvailableOptionalAgents } from "../agent-definition.js";

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
  bootstrapMode?: "interactive" | "auto";
  bootstrapSeed?: BootstrapSeed;
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
  brownfield: BootstrapAssessment;
  bootstrapDiagnostics: BootstrapArtifactDiagnostics;
  nextAction: string;
  warnings: string[];
};

type ProjectStatusArgs = {
  cwd?: string;
};

type ProjectStatusResult = {
  status: "uninitialized" | "mapping-incomplete" | "mapped-only" | "partial" | "initialized";
  initialized: boolean;
  currentPhase: string | null;
  currentMilestone: string | null;
  nextAction: string;
  bootstrap: {
    repoShape: BootstrapAssessment["repoShape"];
    brownfieldDetected: boolean;
    codebaseMapped: boolean;
    placeholderArtifacts: string[];
    traceabilityWarnings: string[];
    recommendedNextAction: string;
  };
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
  projectName: z.string().optional(),
  bootstrapMode: z.enum(["interactive", "auto"]).optional(),
  bootstrapSeed: z
    .object({
      vision: z.string().optional(),
      audience: z
        .object({
          primary: z.array(z.string()).optional(),
          secondary: z.array(z.string()).optional()
        })
        .optional(),
      constraints: z.array(z.string()).optional(),
      currentMilestone: z.string().optional(),
      nonGoals: z.array(z.string()).optional(),
      requirements: z
        .array(
          z.object({
            id: z
              .string()
              .trim()
              .min(1)
              .refine((value) => DURABLE_REQUIREMENT_ID_PATTERN.test(value), {
                message:
                  "Requirement IDs must use a durable format like RQ-01 or BP-03."
              }),
            scope: z.enum(["committed", "deferred", "out_of_scope"]).optional(),
            group: z.string().optional(),
            requirement: z.string(),
            status: z.string(),
            notes: z.string()
          })
        )
        .optional(),
      roadmapPhases: z
        .array(
          z.object({
            phase: z.string(),
            title: z.string(),
            status: z.enum(["planned", "in_progress", "done"]).optional(),
            objective: z.string(),
            requirementIds: z.array(z.string()).optional(),
            successCriteria: z.array(z.string()).optional(),
            notes: z.array(z.string()).optional()
          })
        )
        .optional(),
      brownfieldMode: z.enum(["greenfield", "scaffold-only", "brownfield"]).optional(),
      assumptions: z.array(z.string()).optional()
    })
    .optional()
};
const projectStatusInputSchema = {
  cwd: z.string().optional()
};

const COMMAND_SPEC_PREFIX = "docs/commands";
const PROJECT_TOOL_NAMES = [
  "blueprint_command_catalog",
  "blueprint_project_init",
  "blueprint_project_status"
 ] as const satisfies readonly BlueprintInternalToolName[];
const AVAILABLE_TOOL_NAMES = new Set([
  ...PROJECT_TOOL_NAMES,
  ...configToolDefinitions.map((definition) => definition.name),
  ...stateToolDefinitions.map((definition) => definition.name),
  ...phaseToolDefinitions.map((definition) => definition.name),
  ...reviewToolDefinitions.map((definition) => definition.name),
  ...artifactToolDefinitions.map((definition) => definition.name),
  ...impactToolDefinitions.map((definition) => definition.name),
  ...updateToolDefinitions.map((definition) => definition.name),
  ...workspaceToolDefinitions.map((definition) => definition.name)
]);

const FALLBACK_COMMAND_CATALOG: CommandCatalogResult = {
  commands: {
    "new-project": {
      command: blueprintDirectCommand("new-project"),
      route: blueprintRouterCommand("new-project"),
      wave: 0,
      family: "Foundation",
      risk: "Medium",
      primarySkill: "blueprint-bootstrap",
      declaredStatus: "implemented",
      status: "implemented",
      implemented: true,
      blockedBy: [],
      manifestPath: blueprintPrimaryManifestPath("new-project"),
      skillPath: blueprintDiscoverableSkillPath("blueprint-bootstrap"),
      specPath: "docs/commands/new-project.md",
      requiredTools: [
        "blueprint_project_init",
        "blueprint_project_status",
        "blueprint_config_get",
        "blueprint_config_set",
        "blueprint_state_update",
        "blueprint_artifact_contract_read",
        "blueprint_artifact_validate",
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
    "new-project": blueprintDirectCommandAliases("new-project")
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
    const parsed = safeJsonParseObject<{ name?: unknown }>(raw, {
      label: "package.json",
      maxBytes: 1024 * 1024
    });
    return typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : null;
  } catch {
    return null;
  }
}

async function readPackageDescription(projectRoot: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
    const parsed = safeJsonParseObject<{ description?: unknown }>(raw, {
      label: "package.json",
      maxBytes: 1024 * 1024
    });
    return typeof parsed.description === "string" && parsed.description.trim().length > 0
      ? parsed.description.trim()
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

async function readRepoSummary(projectRoot: string): Promise<string | null> {
  const readmePaths = ["README.md", "README"];

  for (const candidate of readmePaths) {
    try {
      const raw = await fs.readFile(path.join(projectRoot, candidate), "utf8");
      const summary = raw
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0 && !line.startsWith("#"));

      if (summary) {
        return summary;
      }
    } catch {
      continue;
    }
  }

  return readPackageDescription(projectRoot);
}

function mergeBootstrapSeed(
  synthesized: BootstrapSeed,
  explicit?: BootstrapSeed
): BootstrapSeed {
  if (!explicit) {
    return synthesized;
  }

  return {
    vision: explicit.vision ?? synthesized.vision,
    audience: {
      primary: explicit.audience?.primary ?? synthesized.audience?.primary,
      secondary: explicit.audience?.secondary ?? synthesized.audience?.secondary
    },
    constraints: explicit.constraints ?? synthesized.constraints,
    currentMilestone: explicit.currentMilestone ?? synthesized.currentMilestone,
    nonGoals: explicit.nonGoals ?? synthesized.nonGoals,
    requirements: explicit.requirements ?? synthesized.requirements,
    roadmapPhases: explicit.roadmapPhases ?? synthesized.roadmapPhases,
    brownfieldMode: explicit.brownfieldMode ?? synthesized.brownfieldMode,
    assumptions: explicit.assumptions ?? synthesized.assumptions
  };
}

function bootstrapSeedIsSufficient(seed: BootstrapSeed | undefined): boolean {
  return Boolean(
    seed?.vision?.trim() &&
    seed.currentMilestone?.trim() &&
    seed.requirements &&
    seed.requirements.length > 0 &&
    seed.roadmapPhases &&
    seed.roadmapPhases.length > 0
  );
}

function assertBootstrapCanWrite(args: {
  inspection: Awaited<ReturnType<typeof inspectBlueprintArtifacts>>;
  bootstrapAssessment: BootstrapAssessment;
  overwrite: boolean;
  bootstrapMode: "interactive" | "auto";
  bootstrapSeed?: BootstrapSeed;
}): void {
  if (args.inspection.readiness === "partial") {
    throw new Error(
      `Core .blueprint artifacts are partially initialized. Run ${blueprintRunDirectCommand("health")} to inspect and repair the partial bootstrap before running ${blueprintDirectCommand("new-project")}.`
    );
  }

  if (args.inspection.readiness === "mapping-incomplete") {
    throw new Error(
      `Codebase mapping is incomplete or invalid. Run ${blueprintRunDirectCommand("map-codebase")} to finish the seven-document map before running ${blueprintDirectCommand("new-project")}.`
    );
  }

  if (
    args.inspection.readiness === "initialized" &&
    !args.overwrite
  ) {
    throw new Error(
      "Blueprint artifacts already exist at .blueprint/. Re-run only after explicit overwrite confirmation."
    );
  }

  if (
    args.bootstrapAssessment.repoShape === "brownfield" &&
    !args.bootstrapAssessment.codebaseMapped
  ) {
    throw new Error(
      `Brownfield repos must be mapped before project bootstrap writes. Run ${blueprintRunDirectCommand("map-codebase")} first, then re-run ${blueprintDirectCommand("new-project")}.`
    );
  }

  if (
    args.bootstrapMode === "interactive" &&
    !bootstrapSeedIsSufficient(args.bootstrapSeed)
  ) {
    throw new Error(
      "Interactive project bootstrap requires a sufficient bootstrapSeed with vision, currentMilestone, requirements, and roadmapPhases before any writes. Provide the seed or use bootstrapMode: \"auto\" only when synthesis is explicitly requested."
    );
  }
}

function buildBootstrapSeed(
  projectName: string,
  assessment: BootstrapAssessment,
  repoSummary: string | null
): BootstrapSeed {
  const brownfieldNeedsMapping =
    assessment.repoShape === "brownfield" && !assessment.codebaseMapped;
  const summarySentence =
    repoSummary && repoSummary.length > 0
      ? repoSummary
      : `Bootstrap ${projectName} with durable planning artifacts and explicit next-step guidance.`;
  const currentMilestone =
    assessment.repoShape === "brownfield" ? "v1-existing-repo-alignment" : "v1";
  const requirements: BootstrapRequirementRow[] =
    assessment.repoShape === "brownfield"
      ? [
          {
            id: "RQ-01",
            scope: "committed",
            group: "Repo alignment",
            requirement:
              "Capture the current repo intent, boundaries, and maintenance constraints before deeper lifecycle work.",
            status: "Pending",
            notes: "Derived from brownfield bootstrap."
          },
          {
            id: "RQ-02",
            scope: "committed",
            group: "Traceability",
            requirement:
              "Preserve requirement-to-roadmap traceability as Blueprint takes ownership of planning artifacts.",
            status: "Pending",
            notes: "Bootstrap traceability requirement."
          },
          {
            id: "RQ-03",
            scope: brownfieldNeedsMapping ? "deferred" : "committed",
            group: brownfieldNeedsMapping
              ? "Codebase mapping follow-through"
              : "Mapped baseline",
            requirement:
              brownfieldNeedsMapping
                ? "Map the existing codebase before later roadmap phases are treated as durable implementation commitments."
                : "Use the saved codebase mapping bundle as bootstrap evidence for requirements and roadmap scope.",
            status: "Pending",
            notes: brownfieldNeedsMapping
              ? `Routes brownfield repos to \`${blueprintDirectCommand("map-codebase")}\`.`
              : "Map-first bootstrap has already produced the codebase bundle."
          },
          {
            id: "RQ-04",
            scope: "out_of_scope",
            group: "Future expansion cuts",
            requirement:
              "Do not promote implementation work or long-horizon automation until the mapped baseline is understood.",
            status: "Pending",
            notes: "Keeps brownfield bootstrap narrower than execution planning."
          }
        ]
      : [
          {
            id: "RQ-01",
            scope: "committed",
            group: "Product direction",
            requirement: `Clarify the product direction and first milestone for ${projectName}.`,
            status: "Pending",
            notes: "Bootstrap project requirement."
          },
          {
            id: "RQ-02",
            scope: "committed",
            group: "Delivery boundaries",
            requirement:
              "Record constraints, non-goals, and success boundaries before later planning commands run.",
            status: "Pending",
            notes: "Bootstrap discovery requirement."
          },
          {
            id: "RQ-03",
            scope: "deferred",
            group: "Follow-through planning",
            requirement:
              "Create planning artifacts that later commands can trust without relying on scaffold-only placeholders.",
            status: "Pending",
            notes: "Traceability requirement."
          },
          {
            id: "RQ-04",
            scope: "out_of_scope",
            group: "Explicit bootstrap cuts",
            requirement:
              "Do not turn the bootstrap draft into a full implementation backlog or execution plan.",
            status: "Pending",
            notes: "Keeps the bootstrap narrower than later work streams."
          }
        ];
  const roadmapPhases: BootstrapRoadmapPhase[] =
    brownfieldNeedsMapping
      ? [
          {
            phase: "1",
            title: "Map Existing Codebase",
            objective:
              "Capture the current repo structure and risks before later phases are treated as durable.",
            requirementIds: ["RQ-01", "RQ-03"],
            successCriteria: [
              "The existing repo structure, risks, and constraints are documented clearly enough to support later planning.",
              `The bootstrap handoff points directly to \`${blueprintRunDirectCommand("map-codebase")}\` before later phases are treated as durable.`
            ],
            notes: [`${blueprintRunDirectCommand("map-codebase")} immediately after bootstrap.`]
          },
          {
            phase: "2",
            title: "Align Requirements And Scope",
            objective:
              "Refine milestone scope once codebase evidence is available.",
            requirementIds: ["RQ-02", "RQ-03"],
            successCriteria: [
              "Requirement coverage and roadmap scope are aligned with mapped codebase evidence.",
              "Later execution planning can continue without losing requirement traceability."
            ]
          }
        ]
      : assessment.repoShape === "brownfield"
        ? [
            {
              phase: "1",
              title: "Align Requirements With Mapped Codebase",
              objective:
                "Convert the saved codebase map into durable project intent, requirements, and first-milestone scope.",
              requirementIds: ["RQ-01", "RQ-02", "RQ-03"],
              successCriteria: [
                "The saved codebase mapping remains preserved and referenced by bootstrap artifacts.",
                "The roadmap starts from mapped repo evidence instead of provisional mapping follow-up."
              ]
            },
            {
              phase: "2",
              title: "Plan First Brownfield Delivery Slice",
              objective:
                "Shape the first implementation slice from mapped repo constraints and durable requirements.",
              requirementIds: ["RQ-02", "RQ-03"],
              successCriteria: [
                "Later lifecycle commands can plan against the mapped baseline without redoing bootstrap.",
                "Requirement traceability stays intact as brownfield work moves toward execution."
              ]
            }
          ]
      : [
          {
            phase: "1",
            title: "Discovery And Definition",
            objective:
              "Confirm project intent, users, and milestone scope from the bootstrap draft.",
            requirementIds: ["RQ-01", "RQ-02"],
            successCriteria: [
              "The product direction and first milestone are explicit enough to guide downstream planning.",
              "Requirements remain traceable into the roadmap without renumbering."
            ]
          },
          {
            phase: "2",
            title: "Foundation Bootstrap",
            objective:
              "Prepare durable planning inputs for the next implemented Blueprint commands.",
            requirementIds: ["RQ-02", "RQ-03"],
            successCriteria: [
              "The bootstrap draft is ready to support later discovery and execution planning.",
              "Requirement traceability stays intact as the roadmap moves toward implementation."
            ]
          }
        ];

  return {
    vision: summarySentence,
    audience: {
      primary: [
        assessment.repoShape === "brownfield"
          ? "Maintainers aligning an existing repository with Blueprint-managed planning."
          : "Maintainers shaping the first useful milestone for the repository."
      ],
      secondary: [
        "Future contributors who need durable project context before they plan or implement work."
      ]
    },
    constraints: [
      "Project state lives in `.blueprint/`.",
      "Persistent mutations must flow through Blueprint MCP tools.",
      assessment.repoShape === "brownfield"
        ? "Existing implementation behavior should be preserved while the repo is mapped and aligned."
        : "Bootstrap artifacts should stay explicit about assumptions until later discovery confirms them."
    ],
    currentMilestone,
    nonGoals: [
      "Hidden runtime conventions.",
      "Undocumented aliases.",
      brownfieldNeedsMapping
        ? "Treating an unmapped brownfield roadmap as a final execution plan."
        : assessment.repoShape === "brownfield"
          ? "Replacing or ignoring the saved `.blueprint/codebase/` mapping during bootstrap."
        : "Leaving the initial planning artifacts as placeholder shells."
    ],
    requirements,
    roadmapPhases,
    brownfieldMode: assessment.repoShape,
    assumptions: [
      brownfieldNeedsMapping
        ? `Later roadmap phases stay provisional until \`${blueprintDirectCommand("map-codebase")}\` captures the current codebase.`
        : assessment.repoShape === "brownfield"
          ? "The saved codebase mapping is the baseline for bootstrap scope."
        : "The first milestone should stay small enough to validate Blueprint's lifecycle on this repo."
    ]
  };
}

function buildBootstrapStatus(
  diagnostics: BootstrapArtifactDiagnostics
): ProjectStatusResult["bootstrap"] {
  return {
    repoShape: diagnostics.brownfield.repoShape,
    brownfieldDetected: diagnostics.brownfield.repoShape === "brownfield",
    codebaseMapped: diagnostics.brownfield.codebaseMapped,
    placeholderArtifacts: diagnostics.placeholderArtifacts,
    traceabilityWarnings: diagnostics.traceabilityWarnings,
    recommendedNextAction: diagnostics.brownfield.recommendedNextAction
  };
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
  const manifestPath = blueprintPrimaryManifestPath(parsedRow.commandName);
  const specUrl = bundledUrl(specPath);
  const manifestExists = await pathExists(bundledUrl(manifestPath));
  const specExists = await pathExists(specUrl);
  const specMarkdown = specExists ? await fs.readFile(specUrl, "utf8") : "";
  const requiredTools = parseRequiredTools(specMarkdown);
  const optionalAgents = parseOptionalAgents(specMarkdown, parsedRow.primarySkill);
  const availableOptionalAgents: string[] = [];
  const blockedBy: string[] = [];
  const skillResolution = await resolveBlueprintSkillPath(parsedRow.primarySkill, async (skillPath) =>
    pathExists(bundledUrl(skillPath))
  );
  const skillExists = skillResolution.resolvedPath !== null;

  if (!specExists) {
    blockedBy.push(`Missing command spec: ${specPath}`);
  }

  if (!manifestExists) {
    blockedBy.push(`Missing command manifest: ${manifestPath}`);
  }

  if (!skillExists) {
    blockedBy.push(`Missing primary skill: ${skillResolution.canonicalPath}`);
  }

  const missingTools = requiredTools.filter((toolName) => !AVAILABLE_TOOL_NAMES.has(toolName));
  const requiredToolsSatisfied = missingTools.length === 0;

  for (const toolName of missingTools) {
    blockedBy.push(`Missing required MCP tool: ${toolName}`);
  }

  availableOptionalAgents.push(
    ...(await resolveAvailableOptionalAgents(optionalAgents, async (relativePath) => {
      try {
        return await fs.readFile(bundledUrl(relativePath), "utf8");
      } catch {
        return null;
      }
    }))
  );

  let status = parsedRow.declaredStatus;

  if (!(manifestExists && skillExists && requiredToolsSatisfied)) {
    if (manifestExists || skillExists) {
      status = "repairing";
    } else if (blockedBy.length > 0) {
      status = "blocked";
    }
  } else if (parsedRow.declaredStatus === "blocked") {
    status = "blocked";
  } else if (parsedRow.declaredStatus === "planned") {
    status = "planned";
  } else if (parsedRow.declaredStatus === "repairing") {
    status = "repairing";
  }

  return {
    command: blueprintDirectCommand(parsedRow.commandName),
    route: blueprintRouterCommand(parsedRow.commandName),
    wave: parsedRow.wave,
    family: parsedRow.family,
    risk: parsedRow.risk,
    primarySkill: parsedRow.primarySkill,
    declaredStatus: parsedRow.declaredStatus,
    status,
    implemented: status === "implemented",
    blockedBy,
    manifestPath: manifestExists ? manifestPath : null,
    skillPath: skillResolution.resolvedPath,
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
      aliases[parsedRow.commandName] = blueprintDirectCommandAliases(parsedRow.commandName);
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
  const overwrite = args.overwrite ?? false;
  const bootstrapMode = args.bootstrapMode ?? "interactive";
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const initialBootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);

  assertBootstrapCanWrite({
    inspection,
    bootstrapAssessment: initialBootstrapDiagnostics.brownfield,
    overwrite,
    bootstrapMode,
    bootstrapSeed: args.bootstrapSeed
  });

  const projectName = await inferProjectName(projectRoot, args.projectName);
  const bootstrapAssessment = initialBootstrapDiagnostics.brownfield;
  const repoSummary = await readRepoSummary(projectRoot);
  const bootstrapSeed =
    bootstrapMode === "auto"
      ? mergeBootstrapSeed(
          buildBootstrapSeed(projectName, bootstrapAssessment, repoSummary),
          args.bootstrapSeed
        )
      : args.bootstrapSeed!;
  const scaffold = await blueprintArtifactScaffold({
    cwd: projectRoot,
    overwrite,
    projectName,
    bootstrapSeed,
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
      currentMilestone: bootstrapSeed.currentMilestone ?? "v1",
      currentPhase: bootstrapSeed.roadmapPhases?.[0]?.phase ?? "1",
      activeCommand: blueprintDirectCommand("new-project"),
      nextAction:
        bootstrapAssessment.provisionalRoadmap
          ? `${blueprintRunDirectCommand("map-codebase")} before treating the roadmap as durable`
          : `${blueprintRunDirectCommand("progress")} to review the next safe Blueprint action`,
      blockers: [],
      lastUpdated: new Date().toISOString()
    }
  });
  const bootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);
  const createdPaths = [
    ...scaffold.createdFiles,
    seededState.statePath,
    seededConfig.configPath
  ];
  const warnings = [
    ...scaffold.warnings,
    ...seededConfig.warnings,
    ...bootstrapDiagnostics.traceabilityWarnings
  ];

  return {
    projectRoot,
    createdPaths,
    seededState,
    configPath: seededConfig.configPath,
    configProvenance: seededConfig.provenance,
    brownfield: bootstrapDiagnostics.brownfield,
    bootstrapDiagnostics,
    nextAction:
      bootstrapDiagnostics.brownfield.provisionalRoadmap
        ? `${blueprintRunDirectCommand("map-codebase")} before treating the roadmap as durable`
        : `${blueprintRunDirectCommand("progress")} to review the next safe Blueprint action`,
    warnings: [...new Set(warnings)]
  };
}

export async function blueprintProjectStatus(
  args: ProjectStatusArgs = {}
): Promise<ProjectStatusResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const bootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);
  const bootstrap = buildBootstrapStatus(bootstrapDiagnostics);
  const initialized = inspection.readiness === "initialized";

  if (!initialized) {
    let nextAction = blueprintRunDirectCommand("new-project");
    let warnings = ["Blueprint has not been initialized yet."];

    if (
      inspection.readiness === "uninitialized" &&
      bootstrapDiagnostics.brownfield.repoShape === "brownfield" &&
      !bootstrapDiagnostics.brownfield.codebaseMapped
    ) {
      nextAction = `${blueprintRunDirectCommand("map-codebase")} before ${blueprintDirectCommand("new-project")} so brownfield bootstrap starts from a mapped baseline`;
      warnings = [
        "Brownfield repo is unmapped; map-codebase is the first safe Blueprint write."
      ];
    } else if (inspection.readiness === "mapping-incomplete") {
      nextAction = `${blueprintRunDirectCommand("map-codebase")} to finish the interrupted codebase-only mapping bundle`;
      warnings = [
        "Codebase-only Blueprint state is mapping-incomplete, not a core bootstrap.",
        ...inspection.codebase.warnings
      ];
    } else if (inspection.readiness === "mapped-only") {
      nextAction = `${blueprintRunDirectCommand("new-project")} to bootstrap project artifacts while preserving the mapped codebase docs`;
      warnings = [
        "Codebase mapping is complete and project bootstrap has not been written yet."
      ];
    } else if (inspection.readiness === "partial") {
      nextAction = `${blueprintRunDirectCommand("health")} to inspect and repair the partial .blueprint state`;
      warnings = [
        "Blueprint is partially initialized.",
        ...bootstrapDiagnostics.traceabilityWarnings
      ];
    }

    return {
      status: inspection.readiness,
      initialized: false,
      currentPhase: null,
      currentMilestone: null,
      nextAction,
      bootstrap,
      health: {
        missingArtifacts:
          inspection.readiness === "mapping-incomplete" || inspection.readiness === "mapped-only"
            ? []
            : inspection.core.missing,
        warnings
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
      stateResult.derivedStatus.nextAction || blueprintRunCommand(blueprintRootCommand(), "for the next Blueprint step"),
    bootstrap,
    health: {
      missingArtifacts: inspection.core.missing,
      warnings: [
        ...configWarnings,
        ...bootstrapDiagnostics.placeholderArtifacts.map(
          (artifact) => `Bootstrap artifact still looks like a placeholder: ${artifact}`
        ),
        ...bootstrapDiagnostics.traceabilityWarnings
      ]
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
