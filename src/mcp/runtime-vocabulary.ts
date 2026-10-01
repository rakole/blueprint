export const BLUEPRINT_MCP_SERVER_NAME = "blueprint" as const;
export const BLUEPRINT_SKILLS_DIRECTORY = "skills" as const;
export const BLUEPRINT_SKILL_ENTRY_FILE = "SKILL.md" as const;
export const BLUEPRINT_AGENTS_DIRECTORY = "agents" as const;

export type BlueprintInternalToolName = `blueprint_${string}`;

export type BlueprintSkillResolution = {
  canonicalPath: string;
  resolvedPath: string | null;
  resolution: "discoverable" | "missing";
};

export function blueprintDiscoverableSkillPath(skillName: string): string {
  return `${BLUEPRINT_SKILLS_DIRECTORY}/${skillName}/${BLUEPRINT_SKILL_ENTRY_FILE}`;
}

export function blueprintAgentDefinitionPath(agentName: string): string {
  return `${BLUEPRINT_AGENTS_DIRECTORY}/${agentName}.md`;
}

export function blueprintRuntimeToolFqn(
  toolName: BlueprintInternalToolName
): `${typeof BLUEPRINT_MCP_SERVER_NAME}_${BlueprintInternalToolName}` {
  return `${BLUEPRINT_MCP_SERVER_NAME}_${toolName}`;
}

export async function resolveBlueprintSkillPath(
  skillName: string,
  hasPath: (relativePath: string) => Promise<boolean>
): Promise<BlueprintSkillResolution> {
  const canonicalPath = blueprintDiscoverableSkillPath(skillName);

  if (await hasPath(canonicalPath)) {
    return {
      canonicalPath,
      resolvedPath: canonicalPath,
      resolution: "discoverable"
    };
  }

  return {
    canonicalPath,
    resolvedPath: null,
    resolution: "missing"
  };
}
