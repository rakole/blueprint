import { promises as fs } from "node:fs";

import * as z from "zod/v4";

import {
  BLUEPRINT_STATE_PATH,
  ensureParentDirectory,
  ensureRepoRoot,
  resolveBlueprintPath,
  toRepoRelativePath
} from "./artifacts.js";

type BlueprintState = {
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

export const stateToolDefinitions = [
  {
    name: "blueprint_state_update",
    description: "Patch Blueprint STATE.md deterministically and return the updated fields.",
    inputSchema: stateUpdateInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintStateUpdate(args as StateUpdateArgs)
  }
];
