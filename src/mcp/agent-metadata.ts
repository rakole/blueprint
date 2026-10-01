export const BLUEPRINT_PRIMARY_AGENT_NAME = "blueprint" as const;

export const BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS = [
  "read",
  "glob",
  "grep"
] as const;

export const BLUEPRINT_EXECUTOR_AGENT_PERMISSION_KEYS = [
  ...BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "edit",
  "bash"
] as const;

export const BLUEPRINT_AGENT_PERMISSION_ALLOWLIST = {
  "blueprint-checker": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-debugger": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-doc-verifier": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-doc-writer": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-executor": BLUEPRINT_EXECUTOR_AGENT_PERMISSION_KEYS,
  "blueprint-mapper": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-planner": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-project-researcher": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-researcher": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-reviewer": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-roadmapper": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-security-auditor": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-ui-auditor": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-ui-designer": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS,
  "blueprint-verifier": BLUEPRINT_READ_ONLY_AGENT_PERMISSION_KEYS
} as const satisfies Record<string, readonly string[]>;

export type BlueprintAgentName = keyof typeof BLUEPRINT_AGENT_PERMISSION_ALLOWLIST;
export type BlueprintAgentAllowedPermissionName =
  (typeof BLUEPRINT_AGENT_PERMISSION_ALLOWLIST)[BlueprintAgentName][number];

export const BLUEPRINT_AGENT_TOOL_NAMES = Object.freeze(
  Object.keys(BLUEPRINT_AGENT_PERMISSION_ALLOWLIST).sort() as BlueprintAgentName[]
);

export const BLUEPRINT_WRITE_CAPABLE_AGENT_NAMES = [
  "blueprint-executor"
] as const satisfies readonly BlueprintAgentName[];

export function isBlueprintAgentName(value: string): value is BlueprintAgentName {
  return value in BLUEPRINT_AGENT_PERMISSION_ALLOWLIST;
}
