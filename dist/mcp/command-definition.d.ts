export type BlueprintCommandDefinitionValidation = {
    commandName: string;
    relativePath: string;
    valid: boolean;
    issues: string[];
};
type RelativePathReader = (relativePath: string) => Promise<string | null>;
export declare function validateBlueprintCommandDefinitionContent(commandName: string, content: string, relativePath?: string): BlueprintCommandDefinitionValidation;
export declare function validateBundledBlueprintCommandDefinition(commandName: string, readRelativePath: RelativePathReader): Promise<BlueprintCommandDefinitionValidation>;
export {};
