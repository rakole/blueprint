export type BlueprintRuntimeHostId = "opencode" | "gemini" | "tabnine";
export type BlueprintRuntimeHost = {
    host: BlueprintRuntimeHostId;
    cliHomeDirName: ".config/opencode";
    contextFileName: "AGENTS.md";
    manifestFileName: "package.json";
    extensionPath: string | null;
    globalBlueprintDir: string;
    defaultsPath: string;
    patchRegistryPath: string;
    workspaceRegistryPath: string;
    updatesDir: string;
};
export declare function resolveBlueprintRuntimeHost(env?: NodeJS.ProcessEnv): BlueprintRuntimeHost;
export declare function getBlueprintRuntimeHost(): BlueprintRuntimeHost;
