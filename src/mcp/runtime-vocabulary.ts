export const BLUEPRINT_MCP_SERVER_NAME = "blueprint" as const;
export const BLUEPRINT_SKILLS_DIRECTORY = "skills" as const;
export const BLUEPRINT_SKILL_ENTRY_FILE = "SKILL.md" as const;
export const BLUEPRINT_AGENTS_DIRECTORY = "agents" as const;

export type BlueprintInternalToolName = `blueprint_${string}`;

export type BlueprintSkillResolution = {
  canonicalPath: string;
  legacyPath: string;
  resolvedPath: string | null;
  resolution: "discoverable" | "legacy" | "missing";
};

export function blueprintDiscoverableSkillPath(skillName: string): string {
  return `${BLUEPRINT_SKILLS_DIRECTORY}/${skillName}/${BLUEPRINT_SKILL_ENTRY_FILE}`;
}

export function blueprintLegacySkillPath(skillName: string): string {
  return `${BLUEPRINT_SKILLS_DIRECTORY}/${skillName}.md`;
}

export function blueprintAgentDefinitionPath(agentName: string): string {
  return `${BLUEPRINT_AGENTS_DIRECTORY}/${agentName}.md`;
}

export function blueprintRuntimeToolFqn(
  toolName: BlueprintInternalToolName
): `mcp_${typeof BLUEPRINT_MCP_SERVER_NAME}_${BlueprintInternalToolName}` {
  return `mcp_${BLUEPRINT_MCP_SERVER_NAME}_${toolName}`;
}

export async function resolveBlueprintSkillPath(
  skillName: string,
  hasPath: (relativePath: string) => Promise<boolean>
): Promise<BlueprintSkillResolution> {
  const canonicalPath = blueprintDiscoverableSkillPath(skillName);

  if (await hasPath(canonicalPath)) {
    return {
      canonicalPath,
      legacyPath: blueprintLegacySkillPath(skillName),
      resolvedPath: canonicalPath,
      resolution: "discoverable"
    };
  }

  const legacyPath = blueprintLegacySkillPath(skillName);

  if (await hasPath(legacyPath)) {
    return {
      canonicalPath,
      legacyPath,
      resolvedPath: legacyPath,
      resolution: "legacy"
    };
  }

  return {
    canonicalPath,
    legacyPath,
    resolvedPath: null,
    resolution: "missing"
  };
}
