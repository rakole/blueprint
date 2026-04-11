import { promises as fs } from "node:fs";

import * as z from "zod/v4";

import {
  BLUEPRINT_DIR,
  blueprintPathExists,
  BLUEPRINT_STATE_PATH,
  ensureParentDirectory,
  ensureRepoRoot,
  inspectBlueprintArtifacts,
  inspectBootstrapArtifacts,
  resolveBlueprintPath,
  toRepoRelativePath,
  validatePlanArtifactContent,
  validateResearchArtifactContent
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";

export type BlueprintState = {
  projectStatus: string;
  currentMilestone: string;
  currentPhase: string;
  activeCommand: string;
  nextAction: string;
  blockers: string[];
  lastUpdated: string;
};

type StateUpdateArgs = {
  cwd?: string;
  base?: "stored" | "synced";
  patch?: Partial<BlueprintState>;
};

type StateUpdateResult = {
  updatedFields: string[];
  statePath: string;
  warnings: string[];
};

type StateLoadArgs = {
  cwd?: string;
};

type StateLoadResult = {
  state: BlueprintState;
  blockers: string[];
  derivedStatus: {
    projectStatus: string;
    currentPhase: string | null;
    nextAction: string;
    hasBlockers: boolean;
  };
};

type StateSyncArgs = {
  cwd?: string;
};

type StateSyncResult = {
  syncedFields: string[];
  warnings: string[];
  statePath: string;
};

type CommandCatalogEntry = {
  implemented: boolean;
};

type CommandCatalogResult = {
  commands: Record<string, CommandCatalogEntry>;
};

type CurrentPhaseArtifactStatus = {
  currentPhase: string | null;
  phaseDir: string | null;
  phasePrefix: string | null;
  contextPath: string | null;
  researchPath: string | null;
  uiSpecPath: string | null;
  verificationPath: string | null;
  uatPath: string | null;
  planIds: string[];
  summaryIds: string[];
  hasContext: boolean;
  hasResearch: boolean;
  hasUiSpec: boolean;
  hasVerification: boolean;
  hasUat: boolean;
  hasPlans: boolean;
  hasSummaries: boolean;
  hasPendingExecution: boolean;
  researchValid: boolean | null;
  blockers: string[];
  warnings: string[];
};

type BootstrapRoutingSignals = {
  brownfieldDetected: boolean;
  codebaseMapped: boolean;
};

type WorkflowRoutingSignals = {
  researchEnabled: boolean;
  uiPhaseEnabled: boolean;
};

const DEFAULT_STATE: BlueprintState = {
  projectStatus: "uninitialized",
  currentMilestone: "v1",
  currentPhase: "1",
  activeCommand: "/blu:new-project",
  nextAction: "Run /blu:new-project",
  blockers: [],
  lastUpdated: new Date(0).toISOString()
};

const stateUpdateInputSchema = {
  cwd: z.string().optional(),
  base: z.enum(["stored", "synced"]).optional(),
  patch: z
    .object({
      projectStatus: z.string().optional(),
      currentMilestone: z.string().optional(),
      currentPhase: z.string().optional(),
      activeCommand: z.string().optional(),
      nextAction: z.string().optional(),
      blockers: z.array(z.string()).optional(),
      lastUpdated: z.string().optional()
    })
    .optional()
};
const stateLoadInputSchema = {
  cwd: z.string().optional()
};
const stateSyncInputSchema = {
  cwd: z.string().optional()
};

let implementedCommandNamesPromise: Promise<Set<string>> | null = null;

function renderStateDocument(state: BlueprintState): string {
  const blockers =
    state.blockers.length === 0 ? "- none" : state.blockers.map((item) => `- ${item}`).join("\n");

  return `# Blueprint State

- Project status: ${state.projectStatus}
- Current milestone: ${state.currentMilestone}
- Current phase: ${state.currentPhase}
- Active command: ${state.activeCommand}
- Next action: ${state.nextAction}
- Last updated: ${state.lastUpdated}

## Blockers

${blockers}
`;
}

function parseStateDocument(raw: string): BlueprintState {
  const getLineValue = (label: string): string | null => {
    const match = raw.match(new RegExp(`^- ${label}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : null;
  };

  const blockersSection = raw.match(/## Blockers\s+([\s\S]*)$/m)?.[1] ?? "";
  const blockers = blockersSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line && line !== "none");

  return {
    projectStatus: getLineValue("Project status") ?? DEFAULT_STATE.projectStatus,
    currentMilestone:
      getLineValue("Current milestone") ?? DEFAULT_STATE.currentMilestone,
    currentPhase: getLineValue("Current phase") ?? DEFAULT_STATE.currentPhase,
    activeCommand: getLineValue("Active command") ?? DEFAULT_STATE.activeCommand,
    nextAction: getLineValue("Next action") ?? DEFAULT_STATE.nextAction,
    lastUpdated: getLineValue("Last updated") ?? DEFAULT_STATE.lastUpdated,
    blockers
  };
}

function normalizePhaseNumber(value: string): string {
  return value
    .split(".")
    .map((segment) => {
      const trimmed = segment.trim().replace(/^0+(?=\d)/, "");
      return trimmed.length > 0 ? trimmed : "0";
    })
    .join(".");
}

function formatPhasePrefix(value: string): string {
  const normalized = normalizePhaseNumber(value);
  const [head, ...rest] = normalized.split(".");

  return [head.padStart(2, "0"), ...rest].join(".");
}

function extractPhasePlanIds(artifacts: Iterable<string>, phasePrefix: string, kind: "PLAN" | "SUMMARY"): string[] {
  const suffix = kind === "PLAN" ? "PLAN" : "SUMMARY";
  const matcher = new RegExp(`/${phasePrefix.replace(".", "\\.")}-(\\d+)-${suffix}\\.md$`);

  return [...new Set(
    [...artifacts]
      .map((artifact) => artifact.match(matcher)?.[1]?.padStart(2, "0") ?? null)
      .filter((value): value is string => value !== null)
  )].sort();
}

async function listImmediateDirectories(rootPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function extractPhaseNumberFromDirectory(phaseDir: string): string | null {
  return phaseDir.match(/^(\d+(?:\.\d+)?)/)?.[1] ?? null;
}

async function getImplementedCommandNames(): Promise<Set<string>> {
  if (!implementedCommandNamesPromise) {
    implementedCommandNamesPromise = (async () => {
      try {
        const projectModule = (await import("./project.js")) as {
          blueprintCommandCatalog: () => Promise<CommandCatalogResult>;
        };
        const catalog = await projectModule.blueprintCommandCatalog();

        return new Set(
          Object.entries(catalog.commands)
            .filter(([, entry]) => entry.implemented)
            .map(([commandName]) => `/blu:${commandName}`)
        );
      } catch {
        return new Set();
      }
    })();
  }

  return implementedCommandNamesPromise;
}

async function inspectCurrentPhaseArtifacts(
  projectRoot: string,
  inspectionPhases: string[],
  currentPhase: string | null
): Promise<CurrentPhaseArtifactStatus> {
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!currentPhase) {
    warnings.push("No current phase could be determined; Blueprint will fall back to progress.");

    return {
      currentPhase: null,
      phaseDir: null,
      phasePrefix: null,
      contextPath: null,
      researchPath: null,
      uiSpecPath: null,
      verificationPath: null,
      uatPath: null,
      planIds: [],
      summaryIds: [],
      hasContext: false,
      hasResearch: false,
      hasUiSpec: false,
      hasVerification: false,
      hasUat: false,
      hasPlans: false,
      hasSummaries: false,
      hasPendingExecution: false,
      researchValid: null,
      blockers,
      warnings
    };
  }

  const normalizedPhase = normalizePhaseNumber(currentPhase);
  const phaseDirs = await listImmediateDirectories(
    resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/phases`)
  );
  const matchingPhaseDirs = phaseDirs.filter((phaseDir) => {
    const phaseNumber = extractPhaseNumberFromDirectory(phaseDir);

    return phaseNumber !== null && normalizePhaseNumber(phaseNumber) === normalizedPhase;
  });

  if (matchingPhaseDirs.length === 0) {
    if (inspectionPhases.length === 0) {
      warnings.push(
        `Current phase ${currentPhase} does not have a phase directory yet; Blueprint will fall back to the safest next implemented command until discovery artifacts exist.`
      );
    } else {
      blockers.push(
        `Current phase ${currentPhase} is missing a matching directory under ${BLUEPRINT_DIR}/phases/.`
      );
      warnings.push(
        `Blueprint could not resolve a current-phase directory for ${currentPhase}; next action will stay on health until the phase tree is repaired.`
      );
    }

    return {
      currentPhase,
      phaseDir: null,
      phasePrefix: formatPhasePrefix(normalizedPhase),
      contextPath: null,
      researchPath: null,
      uiSpecPath: null,
      verificationPath: null,
      uatPath: null,
      planIds: [],
      summaryIds: [],
      hasContext: false,
      hasResearch: false,
      hasUiSpec: false,
      hasVerification: false,
      hasUat: false,
      hasPlans: false,
      hasSummaries: false,
      hasPendingExecution: false,
      researchValid: null,
      blockers,
      warnings
    };
  }

  if (matchingPhaseDirs.length > 1) {
    blockers.push(
      `Current phase ${currentPhase} has multiple matching directories under ${BLUEPRINT_DIR}/phases/: ${matchingPhaseDirs
        .map((phaseDir) => `${BLUEPRINT_DIR}/phases/${phaseDir}/`)
        .join(", ")}.`
    );
    warnings.push(
      `Blueprint could not choose a single current-phase directory for ${currentPhase}; next action will stay on health until the ambiguity is resolved.`
    );

    return {
      currentPhase,
      phaseDir: null,
      phasePrefix: formatPhasePrefix(normalizedPhase),
      contextPath: null,
      researchPath: null,
      uiSpecPath: null,
      verificationPath: null,
      uatPath: null,
      planIds: [],
      summaryIds: [],
      hasContext: false,
      hasResearch: false,
      hasUiSpec: false,
      hasVerification: false,
      hasUat: false,
      hasPlans: false,
      hasSummaries: false,
      hasPendingExecution: false,
      researchValid: null,
      blockers,
      warnings
    };
  }

  const phaseDir = matchingPhaseDirs[0];
  const phasePrefix = formatPhasePrefix(normalizedPhase);
  const phaseRoot = `${BLUEPRINT_DIR}/phases/${phaseDir}`;
  const phaseArtifacts = new Set(
    inspectionPhases.filter((artifact) => artifact.startsWith(`${phaseRoot}/`))
  );
  const contextPath = `${phaseRoot}/${phasePrefix}-CONTEXT.md`;
  const researchPath = `${phaseRoot}/${phasePrefix}-RESEARCH.md`;
  const uiSpecPath = `${phaseRoot}/${phasePrefix}-UI-SPEC.md`;
  const verificationPath = `${phaseRoot}/${phasePrefix}-VERIFICATION.md`;
  const uatPath = `${phaseRoot}/${phasePrefix}-UAT.md`;
  const hasContext = phaseArtifacts.has(contextPath);
  const hasResearch = phaseArtifacts.has(researchPath);
  const hasUiSpec = phaseArtifacts.has(uiSpecPath);
  const hasVerification = phaseArtifacts.has(verificationPath);
  const hasUat = phaseArtifacts.has(uatPath);
  const planPaths = [...phaseArtifacts].filter((artifact) => artifact.endsWith("-PLAN.md"));
  const summaryPaths = [...phaseArtifacts].filter((artifact) => artifact.endsWith("-SUMMARY.md"));
  const planIds = extractPhasePlanIds(phaseArtifacts, phasePrefix, "PLAN");
  const summaryIds = extractPhasePlanIds(phaseArtifacts, phasePrefix, "SUMMARY");
  const hasPlans = planPaths.length > 0;
  const hasSummaries = summaryPaths.length > 0;
  const hasPendingExecution = planIds.some((planId) => !summaryIds.includes(planId));
  const hasLaterArtifacts = [...phaseArtifacts].some(
    (artifact) =>
      artifact.endsWith(`${phasePrefix}-DISCUSSION-LOG.md`) ||
      artifact.endsWith(`${phasePrefix}-DISCUSS-CHECKPOINT.json`) ||
      artifact.endsWith(`${phasePrefix}-RESEARCH.md`) ||
      artifact.endsWith(`${phasePrefix}-UI-SPEC.md`) ||
      artifact.endsWith(`${phasePrefix}-VERIFICATION.md`) ||
      artifact.endsWith(`${phasePrefix}-UAT.md`) ||
      artifact.endsWith("-PLAN.md") ||
      artifact.endsWith("-SUMMARY.md")
  );
  let researchValid: boolean | null = null;

  if (hasResearch) {
    try {
      const raw = await fs.readFile(resolveBlueprintPath(projectRoot, researchPath), "utf8");
      const validation = validateResearchArtifactContent(raw);
      researchValid = validation.valid;

      for (const issue of validation.issues) {
        warnings.push(`${researchPath}: ${issue}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${researchPath}: ${message}`);
      researchValid = false;
    }
  }

  if (!hasContext && hasLaterArtifacts) {
    warnings.push(
      `Current phase ${currentPhase} has later discovery artifacts without a CONTEXT artifact; run /blu:discuss-phase ${currentPhase} to repair the phase scaffold.`
    );
  }

  for (const planPath of planPaths) {
    try {
      const raw = await fs.readFile(resolveBlueprintPath(projectRoot, planPath), "utf8");
      const validation = validatePlanArtifactContent(raw, normalizedPhase);

      for (const issue of validation.issues) {
        warnings.push(`${planPath}: ${issue}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${planPath}: ${message}`);
    }
  }

  if (hasVerification && !hasSummaries) {
    warnings.push(
      `Current phase ${currentPhase} has a VERIFICATION artifact without execution summaries; validate the summary trail before trusting completion state.`
    );
  }

  if (hasUat && !hasVerification) {
    warnings.push(
      `Current phase ${currentPhase} has a UAT artifact without a VERIFICATION artifact; confirm validation evidence is not missing.`
    );
  }

  return {
    currentPhase,
    phaseDir,
    phasePrefix,
    contextPath,
    researchPath,
    uiSpecPath,
    verificationPath,
    uatPath,
    planIds,
    summaryIds,
    hasContext,
    hasResearch,
    hasUiSpec,
    hasVerification,
    hasUat,
    hasPlans,
    hasSummaries,
    hasPendingExecution,
    researchValid,
    blockers,
    warnings
  };
}

async function readRoadmapSignals(projectRoot: string): Promise<{
  currentMilestone: string | null;
  currentPhase: string | null;
}> {
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);

  try {
    const raw = await fs.readFile(roadmapPath, "utf8");
    const milestoneMatch = raw.match(/Active milestone:\s*(.+)$/m);
    const phaseMatches = [...raw.matchAll(/- \[([ xX])\] Phase\s+(\d+(?:\.\d+)?):/g)];
    const currentPhase =
      phaseMatches.find((match) => match[1] === " ")?.[2] ??
      phaseMatches.at(-1)?.[2] ??
      null;

    return {
      currentMilestone: milestoneMatch?.[1]?.trim() ?? null,
      currentPhase
    };
  } catch {
    return {
      currentMilestone: null,
      currentPhase: null
    };
  }
}

async function deriveNextAction(args: {
  projectStatus: string;
  blockers: string[];
  currentPhase: string | null;
  phaseArtifacts: CurrentPhaseArtifactStatus;
  bootstrapRouting: BootstrapRoutingSignals;
  workflow: WorkflowRoutingSignals;
}): Promise<string> {
  if (args.projectStatus === "uninitialized") {
    return "Run /blu:new-project";
  }

  if (args.projectStatus === "partial") {
    return "Run /blu:health to inspect the partial .blueprint state";
  }

  if (args.blockers.length > 0) {
    return "Run /blu:health to inspect blockers and repair options";
  }

  if (args.bootstrapRouting.brownfieldDetected && !args.bootstrapRouting.codebaseMapped) {
    return "Run /blu:map-codebase before treating the roadmap as durable";
  }

  const implementedCommands = await getImplementedCommandNames();
  const discussPhaseCommand = "/blu:discuss-phase";
  const researchPhaseCommand = "/blu:research-phase";
  const uiPhaseCommand = "/blu:ui-phase";
  const planPhaseCommand = "/blu:plan-phase";
  const executePhaseCommand = "/blu:execute-phase";
  const validatePhaseCommand = "/blu:validate-phase";
  const verifyWorkCommand = "/blu:verify-work";

  if (!args.currentPhase || !args.phaseArtifacts.phaseDir) {
    return "Run /blu:progress to review the next safe Blueprint action";
  }

  if (!args.phaseArtifacts.hasContext && implementedCommands.has(discussPhaseCommand)) {
    return `Run ${discussPhaseCommand} ${args.currentPhase} to rebuild the current phase context`;
  }

  if (
    args.workflow.researchEnabled &&
    args.phaseArtifacts.hasContext &&
    !args.phaseArtifacts.hasResearch &&
    implementedCommands.has(researchPhaseCommand)
  ) {
    return `Run ${researchPhaseCommand} ${args.currentPhase} to capture phase research`;
  }

  if (
    args.phaseArtifacts.hasResearch &&
    args.phaseArtifacts.researchValid === false &&
    implementedCommands.has(researchPhaseCommand)
  ) {
    return `Run ${researchPhaseCommand} ${args.currentPhase} to repair invalid phase research`;
  }

  if (
    args.phaseArtifacts.hasResearch &&
    args.phaseArtifacts.researchValid === true &&
    args.workflow.uiPhaseEnabled &&
    !args.phaseArtifacts.hasUiSpec &&
    implementedCommands.has(uiPhaseCommand)
  ) {
    return `Run ${uiPhaseCommand} ${args.currentPhase} to draft the phase UI contract`;
  }

  const researchReady =
    !args.workflow.researchEnabled ||
    (args.phaseArtifacts.hasResearch && args.phaseArtifacts.researchValid !== false);
  const uiReady = !args.workflow.uiPhaseEnabled || args.phaseArtifacts.hasUiSpec;

  if (
    args.phaseArtifacts.hasContext &&
    researchReady &&
    uiReady &&
    !args.phaseArtifacts.hasPlans &&
    implementedCommands.has(planPhaseCommand)
  ) {
    return `Run ${planPhaseCommand} ${args.currentPhase} to create execution-ready phase plans`;
  }

  if (
    args.phaseArtifacts.hasPlans &&
    args.phaseArtifacts.hasPendingExecution &&
    implementedCommands.has(executePhaseCommand)
  ) {
    return `Run ${executePhaseCommand} ${args.currentPhase} to execute the remaining phase plans`;
  }

  if (
    args.phaseArtifacts.hasPlans &&
    !args.phaseArtifacts.hasPendingExecution &&
    !args.phaseArtifacts.hasVerification &&
    implementedCommands.has(validatePhaseCommand)
  ) {
    return `Run ${validatePhaseCommand} ${args.currentPhase} to validate the completed phase execution`;
  }

  if (
    args.phaseArtifacts.hasVerification &&
    !args.phaseArtifacts.hasUat &&
    implementedCommands.has(verifyWorkCommand)
  ) {
    return `Run ${verifyWorkCommand} ${args.currentPhase} to capture conversational UAT evidence`;
  }

  return args.currentPhase
    ? `Run /blu:progress to review Phase ${args.currentPhase} and the next safe action`
    : "Run /blu:progress to review the next safe Blueprint action";
}

async function buildSyncedState(projectRoot: string): Promise<{
  state: BlueprintState;
  warnings: string[];
}> {
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const bootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);
  const existingState = await loadBlueprintState(projectRoot);
  const roadmapSignals = await readRoadmapSignals(projectRoot);
  const warnings: string[] = [];

  if (!inspection.blueprintRootExists) {
    throw new Error(
      "Cannot sync Blueprint state before .blueprint/ exists. Run /blu:new-project instead."
    );
  }

  if (!(await blueprintPathExists(resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH)))) {
    warnings.push("STATE.md was missing and has been reconstructed from surviving artifacts.");
  }

  if (!(await blueprintPathExists(resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`)))) {
    warnings.push("ROADMAP.md is missing; state sync fell back to the last known milestone and phase.");
  }

  const projectStatus = inspection.readiness;
  const currentPhase = roadmapSignals.currentPhase ?? existingState.currentPhase;
  const currentMilestone = roadmapSignals.currentMilestone ?? existingState.currentMilestone;
  const structuralBlockers = inspection.core.missing.map(
    (artifact) => `Missing ${artifact}`
  );
  const nonStructuralBlockers = existingState.blockers.filter(
    (blocker) => !blocker.startsWith("Missing .blueprint/")
  );
  const currentPhaseArtifacts = await inspectCurrentPhaseArtifacts(
    projectRoot,
    inspection.phases,
    currentPhase
  );
  const bootstrapRouting: BootstrapRoutingSignals = {
    brownfieldDetected: bootstrapDiagnostics.brownfield.repoShape === "brownfield",
    codebaseMapped: bootstrapDiagnostics.brownfield.codebaseMapped
  };
  let workflowRouting: WorkflowRoutingSignals = {
    researchEnabled: true,
    uiPhaseEnabled: true
  };

  try {
    const effectiveConfig = await blueprintConfigGet({
      scope: "effective",
      cwd: projectRoot
    });
    workflowRouting = {
      researchEnabled: effectiveConfig.config.workflow.research,
      uiPhaseEnabled: effectiveConfig.config.workflow.ui_phase
    };
  } catch {
    // Keep the hard-coded Blueprint defaults when config cannot be read.
  }
  const blockers =
    projectStatus === "partial"
      ? [
          ...new Set([
            ...nonStructuralBlockers,
            ...structuralBlockers,
            ...currentPhaseArtifacts.blockers
          ])
        ]
      : [...new Set([...nonStructuralBlockers, ...currentPhaseArtifacts.blockers])];

  warnings.push(...currentPhaseArtifacts.warnings);

  return {
    state: {
      projectStatus,
      currentMilestone,
      currentPhase,
      activeCommand:
        projectStatus === "partial" ? "/blu:health" : existingState.activeCommand,
      nextAction: await deriveNextAction({
        projectStatus,
        blockers,
        currentPhase,
        phaseArtifacts: currentPhaseArtifacts,
        bootstrapRouting,
        workflow: workflowRouting
      }),
      blockers,
      lastUpdated: new Date().toISOString()
    },
    warnings
  };
}

export async function loadBlueprintState(cwd?: string): Promise<BlueprintState> {
  const projectRoot = await ensureRepoRoot(cwd);
  const statePath = resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH);

  try {
    const raw = await fs.readFile(statePath, "utf8");
    return parseStateDocument(raw);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function blueprintStateLoad(
  args: StateLoadArgs = {}
): Promise<StateLoadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const state =
    inspection.readiness === "uninitialized"
      ? await loadBlueprintState(projectRoot)
      : (await buildSyncedState(projectRoot)).state;
  const currentPhase = inspection.readiness === "uninitialized" ? null : state.currentPhase;
  const blockers = state.blockers;
  const nextAction = state.nextAction;

  return {
    state,
    blockers,
    derivedStatus: {
      projectStatus: inspection.readiness,
      currentPhase,
      nextAction,
      hasBlockers: blockers.length > 0
    }
  };
}

export async function blueprintStateUpdate(
  args: StateUpdateArgs = {}
): Promise<StateUpdateResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const statePath = resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH);
  const useSyncedBase = args.base === "synced";
  const synced = useSyncedBase ? await buildSyncedState(projectRoot) : null;
  const currentState = synced?.state ?? (await loadBlueprintState(projectRoot));
  const patch = args.patch ?? {};
  const nextState: BlueprintState = {
    ...currentState,
    ...patch,
    blockers: patch.blockers ?? currentState.blockers,
    lastUpdated: patch.lastUpdated ?? new Date().toISOString()
  };
  const updatedFields = [
    ...new Set([
      ...Object.keys(patch),
      ...(patch.lastUpdated ? [] : ["lastUpdated"])
    ])
  ].filter((key) => {
    const field = key as keyof BlueprintState;
    return JSON.stringify(currentState[field]) !== JSON.stringify(nextState[field]);
  });

  await ensureParentDirectory(statePath);
  await fs.writeFile(statePath, renderStateDocument(nextState), "utf8");

  return {
    updatedFields,
    statePath: toRepoRelativePath(projectRoot, statePath),
    warnings: synced?.warnings ?? []
  };
}

export async function blueprintStateSync(
  args: StateSyncArgs = {}
): Promise<StateSyncResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const statePath = resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH);
  const currentState = await loadBlueprintState(projectRoot);
  const synced = await buildSyncedState(projectRoot);
  const nextState = synced.state;
  const syncedFields = (Object.keys(nextState) as (keyof BlueprintState)[]).filter(
    (field) =>
      JSON.stringify(currentState[field]) !== JSON.stringify(nextState[field])
  );

  await ensureParentDirectory(statePath);
  await fs.writeFile(statePath, renderStateDocument(nextState), "utf8");

  return {
    syncedFields,
    warnings: synced.warnings,
    statePath: toRepoRelativePath(projectRoot, statePath)
  };
}

export const stateToolDefinitions = [
  {
    name: "blueprint_state_load",
    description: "Load Blueprint STATE.md together with derived project status signals.",
    inputSchema: stateLoadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintStateLoad(args as StateLoadArgs)
  },
  {
    name: "blueprint_state_update",
    description: "Patch Blueprint STATE.md deterministically and return the updated fields.",
    inputSchema: stateUpdateInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintStateUpdate(args as StateUpdateArgs)
  },
  {
    name: "blueprint_state_sync",
    description:
      "Rebuild Blueprint STATE.md from surviving state, roadmap, and artifact signals.",
    inputSchema: stateSyncInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintStateSync(args as StateSyncArgs)
  }
];
