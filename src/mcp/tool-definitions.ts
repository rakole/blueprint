import type { ToolDefinition } from "./tool-types.js";
import { artifactToolDefinitions } from "./tools/artifacts.js";
import { configToolDefinitions } from "./tools/config.js";
import { impactToolDefinitions } from "./tools/impact.js";
import { phaseToolDefinitions } from "./tools/phase.js";
import { projectToolDefinitions } from "./tools/project.js";
import { reviewToolDefinitions } from "./tools/review.js";
import { stateToolDefinitions } from "./tools/state.js";
import { updateToolDefinitions } from "./tools/update.js";
import { workspaceToolDefinitions } from "./tools/workspace.js";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...projectToolDefinitions,
  ...configToolDefinitions,
  ...stateToolDefinitions,
  ...phaseToolDefinitions,
  ...reviewToolDefinitions,
  ...artifactToolDefinitions,
  ...impactToolDefinitions,
  ...updateToolDefinitions,
  ...workspaceToolDefinitions
];

const REQUIRED_CONFIG_TOOL_NAMES = [
  "blueprint_config_get",
  "blueprint_config_set",
  "blueprint_config_set_profile"
] as const;
const REQUIRED_READ_PATH_TOOL_NAMES = [
  "blueprint_project_status",
  "blueprint_state_load",
  "blueprint_state_sync",
  "blueprint_artifact_list",
  "blueprint_artifact_validate"
] as const;
const REQUIRED_MAPPING_TOOL_NAMES = [
  "blueprint_artifact_summary_digest",
  "blueprint_codebase_artifact_write"
] as const;
for (const toolName of REQUIRED_CONFIG_TOOL_NAMES) {
  if (!TOOL_DEFINITIONS.some((definition) => definition.name === toolName)) {
    throw new Error(`Missing required config tool registration: ${toolName}`);
  }
}

for (const toolName of REQUIRED_READ_PATH_TOOL_NAMES) {
  if (!TOOL_DEFINITIONS.some((definition) => definition.name === toolName)) {
    throw new Error(`Missing required read-path tool registration: ${toolName}`);
  }
}

for (const toolName of REQUIRED_MAPPING_TOOL_NAMES) {
  if (!TOOL_DEFINITIONS.some((definition) => definition.name === toolName)) {
    throw new Error(`Missing required mapping tool registration: ${toolName}`);
  }
}

export const blueprintToolRegistry = Object.fromEntries(
  TOOL_DEFINITIONS.map((definition) => [definition.name, definition])
);

export const blueprintToolNames = TOOL_DEFINITIONS.map(
  (definition) => definition.name
);
