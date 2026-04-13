export declare const BLUEPRINT_MCP_SERVER_NAME: "blueprint";
export declare const BLUEPRINT_SKILLS_DIRECTORY: "skills";
export declare const BLUEPRINT_SKILL_ENTRY_FILE: "SKILL.md";
export declare const BLUEPRINT_AGENTS_DIRECTORY: "agents";
export type BlueprintInternalToolName = `blueprint_${string}`;
export type BlueprintSkillResolution = {
    canonicalPath: string;
    legacyPath: string;
    resolvedPath: string | null;
    resolution: "discoverable" | "legacy" | "missing";
};
export declare function blueprintDiscoverableSkillPath(skillName: string): string;
export declare function blueprintLegacySkillPath(skillName: string): string;
export declare function blueprintAgentDefinitionPath(agentName: string): string;
export declare function blueprintRuntimeToolFqn(toolName: BlueprintInternalToolName): `mcp_${typeof BLUEPRINT_MCP_SERVER_NAME}_${BlueprintInternalToolName}`;
export declare function resolveBlueprintSkillPath(skillName: string, hasPath: (relativePath: string) => Promise<boolean>): Promise<BlueprintSkillResolution>;
