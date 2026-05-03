import type { BlueprintInternalToolName } from "./runtime-vocabulary.js";

export type RuntimeOwnedCommandMetadata = {
  commandName: string;
  sourceId: string;
  catalog: {
    wave: number;
    family: string;
    primarySkill: string;
    declaredStatus: "planned" | "implemented" | "blocked" | "repairing";
    risk: string;
  };
  requiredTools: readonly BlueprintInternalToolName[];
  optionalAgents: readonly string[];
  spec: {
    path: string;
    title: string;
    executionProfile: string;
    rootRoutable: boolean;
    purpose: string;
    reads: readonly string[];
    writes: readonly string[];
  };
  runtimeReference: {
    path: string;
    waveTitle: string;
    command: string;
    primarySkill: string;
    exactMcpDestination: readonly BlueprintInternalToolName[];
    optionalAgents: readonly string[];
    hookInvolvement: readonly string[];
    contractNotes: string;
    evidenceState: readonly string[];
  };
};

export const NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID =
  "src/mcp/command-runtime-metadata.ts#new-project";

export const NEW_PROJECT_RUNTIME_METADATA = {
  commandName: "new-project",
  sourceId: NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID,
  catalog: {
    wave: 0,
    family: "Foundation",
    primarySkill: "blueprint-bootstrap",
    declaredStatus: "implemented",
    risk:
      "Medium: deep-questioning bootstrap that creates the initial planning tree, seeds normalized repo config, and leaves a traceable first roadmap."
  },
  requiredTools: [
    "blueprint_project_init",
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_config_set",
    "blueprint_state_update",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_validate"
  ],
  optionalAgents: ["blueprint-project-researcher", "blueprint-roadmapper"],
  spec: {
    path: NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID,
    title: "`/blu-new-project`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "new-project initializes a Blueprint project with deep context gathering and PROJECT.md. It stays host-native and delegates durable persistence to Blueprint MCP tools while preserving the richer bootstrap flow.",
    reads: ["~/.<host>/blueprint/defaults.json when present"],
    writes: [
      ".blueprint/PROJECT.md",
      ".blueprint/REQUIREMENTS.md",
      ".blueprint/ROADMAP.md",
      ".blueprint/STATE.md",
      ".blueprint/config.json",
      ".blueprint/phases/"
    ]
  },
  runtimeReference: {
    path: NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID,
    waveTitle: "Foundation",
    command: "new-project",
    primarySkill: "blueprint-bootstrap",
    exactMcpDestination: [
      "blueprint_project_init",
      "blueprint_project_status",
      "blueprint_config_get",
      "blueprint_config_set",
      "blueprint_state_update",
      "blueprint_artifact_contract_read",
      "blueprint_artifact_validate"
    ],
    optionalAgents: ["blueprint-project-researcher", "blueprint-roadmapper"],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation Gemini-native bootstrap. The detailed runtime contract lives in skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md, with host-entrypoint, MCP FQN, approval-surface, and Gemini-helper guardrails centralized in skills/blueprint-bootstrap/references/runtime-guardrails.md. The live contract stays map-first for brownfield repos: unmapped or mapping-incomplete states route to map-codebase; valid mapped-only states may run new-project while preserving .blueprint/codebase/*.md.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const ADD_PHASE_RUNTIME_METADATA_SOURCE_ID =
  "src/mcp/command-runtime-metadata.ts#add-phase";

export const ADD_PHASE_RUNTIME_METADATA = {
  commandName: "add-phase",
  sourceId: ADD_PHASE_RUNTIME_METADATA_SOURCE_ID,
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-roadmap-admin",
    declaredStatus: "implemented",
    risk:
      "Medium: appends the next whole-number phase, scaffolds the matching phase directory, and updates the next-step signal."
  },
  requiredTools: [
    "blueprint_roadmap_read",
    "blueprint_roadmap_add_phase",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ],
  optionalAgents: [],
  spec: {
    path: ADD_PHASE_RUNTIME_METADATA_SOURCE_ID,
    title: "`/blu-add-phase`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "Append a new whole-number phase to an initialized Blueprint roadmap through MCP-owned roadmap and scaffold writes.",
    reads: [".blueprint/ROADMAP.md"],
    writes: [
      ".blueprint/ROADMAP.md",
      ".blueprint/phases/<phase-slug>/<phase-prefix>-CONTEXT.md",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: ADD_PHASE_RUNTIME_METADATA_SOURCE_ID,
    waveTitle: "Roadmap And Milestone",
    command: "add-phase",
    primarySkill: "blueprint-roadmap-admin",
    exactMcpDestination: [
      "blueprint_roadmap_read",
      "blueprint_roadmap_add_phase",
      "blueprint_artifact_scaffold",
      "blueprint_state_update"
    ],
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Interactive-read profile for bounded roadmap append: load skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md, keep the command grounded in the live roadmap, preview the next integer phase while ignoring decimal suffixes, prefer ask_user for the exact phase-number confirmation gate, pass the confirmed number as expectedPhaseNumber, keep the waiting state explicit as phase-number-confirmation or stale-phase-number, persist the append only through the roadmap and scaffold MCP tools, scaffold ${phaseDir}/${phasePrefix}-CONTEXT.md from returned metadata without treating scaffold text as finished context, preserve the no-subagent fallback, reject browser/web-search/shell-only or generic agents as substitutes, and route the next safe action to /blu-discuss-phase <phase> without adopting long-running progress tools.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const RUNTIME_OWNED_COMMAND_METADATA = {
  [NEW_PROJECT_RUNTIME_METADATA.commandName]: NEW_PROJECT_RUNTIME_METADATA,
  [ADD_PHASE_RUNTIME_METADATA.commandName]: ADD_PHASE_RUNTIME_METADATA
} as const;

export function listRuntimeOwnedCommandMetadata(): RuntimeOwnedCommandMetadata[] {
  return Object.values(RUNTIME_OWNED_COMMAND_METADATA);
}

export function getRuntimeOwnedCommandMetadata(
  commandName: string
): RuntimeOwnedCommandMetadata | null {
  return (
    RUNTIME_OWNED_COMMAND_METADATA[
      commandName as keyof typeof RUNTIME_OWNED_COMMAND_METADATA
    ] ?? null
  );
}

export function getRuntimeOwnedCommandMetadataBySourceId(
  sourceId: string | null
): RuntimeOwnedCommandMetadata | null {
  if (!sourceId) {
    return null;
  }

  return (
    Object.values(RUNTIME_OWNED_COMMAND_METADATA).find(
      (metadata) => metadata.sourceId === sourceId
    ) ?? null
  );
}
