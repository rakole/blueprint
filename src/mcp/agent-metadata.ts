export const BLUEPRINT_AGENT_READ_ONLY_TOOLS = [
  "list_directory",
  "read_file",
  "glob",
  "grep_search"
] as const;

export const BLUEPRINT_EXECUTOR_AGENT_TOOLS = [
  ...BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "replace",
  "write_file",
  "run_shell_command"
] as const;

export const BLUEPRINT_AGENT_TOOL_ALLOWLIST = {
  "blueprint-checker": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-debugger": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-doc-verifier": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-doc-writer": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-executor": BLUEPRINT_EXECUTOR_AGENT_TOOLS,
  "blueprint-mapper": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-planner": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-project-researcher": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-researcher": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-reviewer": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-roadmapper": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-security-auditor": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-ui-auditor": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-ui-designer": BLUEPRINT_AGENT_READ_ONLY_TOOLS,
  "blueprint-verifier": BLUEPRINT_AGENT_READ_ONLY_TOOLS
} as const satisfies Record<string, readonly string[]>;

export type BlueprintAgentName = keyof typeof BLUEPRINT_AGENT_TOOL_ALLOWLIST;
export type BlueprintAgentAllowedToolName =
  (typeof BLUEPRINT_AGENT_TOOL_ALLOWLIST)[BlueprintAgentName][number];

export const BLUEPRINT_AGENT_TOOL_NAMES = Object.freeze(
  Object.keys(BLUEPRINT_AGENT_TOOL_ALLOWLIST).sort() as BlueprintAgentName[]
);

export const BLUEPRINT_WRITE_CAPABLE_AGENT_NAMES = [
  "blueprint-executor"
] as const satisfies readonly BlueprintAgentName[];

export function isBlueprintAgentName(value: string): value is BlueprintAgentName {
  return value in BLUEPRINT_AGENT_TOOL_ALLOWLIST;
}
