export type OpenCodeAssetManifest = {
    schemaVersion: 1;
    generatedBy: "scripts/generate-opencode-assets.ts";
    assets: Record<string, string>;
    commands: Record<string, {
        path: string;
        primarySkill: string;
        effectiveInputs: string[];
    }>;
    agents: Record<string, {
        path: string;
    }>;
    skillAliases: string[];
    referenceClosure: string[];
};
export declare function parseOpenCodeAssetManifest(value: unknown): OpenCodeAssetManifest;
export declare function validateManifestAsset(packageRoot: string, relative: string, expectedHash: string): Promise<string>;
export declare function loadOpenCodeAssetManifest(packageRoot: string): Promise<OpenCodeAssetManifest>;
