type RelativePathReader = (relativePath: string) => Promise<string | null>;
export type BlueprintSkillResolvedInputs = {
    skill: string;
    shared: string[];
    commandSpecific: string[];
    effective: string[];
};
export declare function resolveBlueprintSkillInputsFromContent(skillName: string, commandPath: string, content: string): BlueprintSkillResolvedInputs;
export declare function loadBlueprintSkillInputs(skillName: string, commandPath: string, readRelativePath: RelativePathReader, preferredPath?: string | null): Promise<BlueprintSkillResolvedInputs>;
export {};
