export type BlueprintAgentFrontmatterValue = string | string[];
export type BlueprintAgentDefinitionValidation = {
    agentName: string;
    relativePath: string;
    valid: boolean;
    frontmatter: Record<string, BlueprintAgentFrontmatterValue>;
    issues: string[];
};
type RelativePathReader = (relativePath: string) => Promise<string | null>;
export declare function validateBlueprintAgentDefinitionContent(expectedAgentName: string, content: string, relativePath?: string): BlueprintAgentDefinitionValidation;
export declare function validateBundledBlueprintAgentDefinition(agentName: string, readRelativePath: RelativePathReader): Promise<BlueprintAgentDefinitionValidation>;
export declare function resolveAvailableOptionalAgents(agentNames: string[], readRelativePath: RelativePathReader): Promise<string[]>;
export {};
