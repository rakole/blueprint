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

export const RUNTIME_OWNED_COMMAND_METADATA = {
  [NEW_PROJECT_RUNTIME_METADATA.commandName]: NEW_PROJECT_RUNTIME_METADATA
} as const;

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
