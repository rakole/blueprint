export type BlueprintRuntimeHostId = "gemini" | "tabnine";
export type BlueprintRuntimeHost = {
    host: BlueprintRuntimeHostId;
    cliHomeDirName: ".gemini" | ".tabnine";
    contextFileName: "GEMINI.md" | "TABNINE.md";
    manifestFileName: "gemini-extension.json" | "tabnine-extension.json";
    extensionPath: string | null;
    globalBlueprintDir: string;
    defaultsPath: string;
    patchRegistryPath: string;
    workspaceRegistryPath: string;
    updatesDir: string;
};
export declare function resolveBlueprintRuntimeHost(env?: NodeJS.ProcessEnv): BlueprintRuntimeHost;
export declare function getBlueprintRuntimeHost(): BlueprintRuntimeHost;
