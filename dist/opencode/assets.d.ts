export type NativePermissionAction = "allow" | "ask" | "deny";
export type NativePermission = Record<string, NativePermissionAction | Record<string, NativePermissionAction>>;
export type NativeCommand = {
    template: string;
    description: string;
    agent: "blueprint";
    subtask: false;
};
export type NativeAgent = {
    description: string;
    mode: "primary" | "subagent";
    steps: number;
    permission: NativePermission;
    prompt: string;
};
export type BlueprintNativeAssets = {
    packageRoot: string;
    command: Record<string, NativeCommand>;
    agent: Record<string, NativeAgent>;
    skillRoot: string;
    skillAliases: ReadonlySet<string>;
    mcpServerEntry: string;
};
export declare function resolveBlueprintPackageRoot(moduleUrl?: string): string;
export declare function resolveOpenCodeDataRoot(env?: NodeJS.ProcessEnv): string;
export declare function loadBlueprintNativeAssets(packageRoot?: string): Promise<BlueprintNativeAssets>;
