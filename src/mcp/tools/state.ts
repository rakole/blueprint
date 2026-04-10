import { promises as fs } from "node:fs";

import * as z from "zod/v4";

import {
  BLUEPRINT_DIR,
  blueprintPathExists,
  BLUEPRINT_STATE_PATH,
  ensureParentDirectory,
  ensureRepoRoot,
  inspectBlueprintArtifacts,
  resolveBlueprintPath,
  toRepoRelativePath
} from "./artifacts.js";

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
  patch?: Partial<BlueprintState>;
};

type StateUpdateResult = {
  updatedFields: string[];
  statePath: string;
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

async function readRoadmapSignals(projectRoot: string): Promise<{
  currentMilestone: string | null;
  currentPhase: string | null;
}> {
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);

  try {
    const raw = await fs.readFile(roadmapPath, "utf8");
    const milestoneMatch = raw.match(/Active milestone:\s*(.+)$/m);
    const phaseMatch = raw.match(/- \[[ xX]\] Phase\s+(\d+(?:\.\d+)?):/m);

    return {
      currentMilestone: milestoneMatch?.[1]?.trim() ?? null,
      currentPhase: phaseMatch?.[1]?.trim() ?? null
    };
  } catch {
    return {
      currentMilestone: null,
      currentPhase: null
    };
  }
}

function deriveNextAction(projectStatus: string, blockers: string[], currentPhase: string): string {
  if (projectStatus === "uninitialized") {
    return "Run /blu:new-project";
  }

  if (projectStatus === "partial") {
    return "Run /blu:health to inspect the partial .blueprint state";
  }

  if (blockers.length > 0) {
    return "Run /blu:health to inspect blockers and repair options";
  }

  return currentPhase
    ? `Run /blu:progress to review Phase ${currentPhase} and the next safe action`
    : "Run /blu:progress to review the next safe Blueprint action";
}

async function buildSyncedState(projectRoot: string): Promise<{
  state: BlueprintState;
  warnings: string[];
}> {
  const inspection = await inspectBlueprintArtifacts(projectRoot);
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
  const currentMilestone =
    roadmapSignals.currentMilestone ?? existingState.currentMilestone;
  const blockers =
    projectStatus === "partial"
      ? [
          ...new Set([
            ...existingState.blockers,
            ...inspection.core.missing.map((artifact) => `Missing ${artifact}`)
          ])
        ]
      : existingState.blockers;

  return {
    state: {
      projectStatus,
      currentMilestone,
      currentPhase,
      activeCommand:
        projectStatus === "partial" ? "/blu:health" : existingState.activeCommand,
      nextAction: deriveNextAction(projectStatus, blockers, currentPhase),
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
  const state = await loadBlueprintState(projectRoot);
  const currentPhase =
    inspection.readiness === "initialized" || inspection.readiness === "partial"
      ? state.currentPhase
      : null;
  const blockers =
    inspection.readiness === "partial" && inspection.core.missing.length > 0
      ? [...new Set([...state.blockers, ...inspection.core.missing.map((artifact) => `Missing ${artifact}`)])]
      : state.blockers;
  const nextAction = deriveNextAction(
    inspection.readiness,
    blockers,
    currentPhase ?? state.currentPhase
  );

  return {
    state: {
      ...state,
      projectStatus: inspection.readiness,
      nextAction
    },
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
  const currentState = await loadBlueprintState(projectRoot);
  const patch = args.patch ?? {};
  const nextState: BlueprintState = {
    ...currentState,
    ...patch,
    blockers: patch.blockers ?? currentState.blockers
  };
  const updatedFields = Object.keys(patch).filter((key) => {
    const field = key as keyof BlueprintState;
    return JSON.stringify(currentState[field]) !== JSON.stringify(nextState[field]);
  });

  await ensureParentDirectory(statePath);
  await fs.writeFile(statePath, renderStateDocument(nextState), "utf8");

  return {
    updatedFields,
    statePath: toRepoRelativePath(projectRoot, statePath)
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
