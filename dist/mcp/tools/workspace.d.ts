import * as z from "zod/v4";
declare const WORKSPACE_STRATEGIES: readonly ["worktree", "clone"];
type WorkspaceStrategy = (typeof WORKSPACE_STRATEGIES)[number];
type WorkspaceRepoMember = {
    name: string;
    sourcePath: string;
    path: string;
    strategy: WorkspaceStrategy;
    branch: string | null;
    head: string;
    blueprintProject: boolean;
};
type WorkspaceRegistryEntry = {
    name: string;
    path: string;
    manifestPath: string;
    strategy: WorkspaceStrategy;
    branch: string | null;
    createdAt: string;
    repos: WorkspaceRepoMember[];
};
type WorkspaceRegistryGetArgs = {
    cwd?: string;
};
type WorkspaceRegistryGetResult = {
    registryPath: string;
    workspaces: WorkspaceRegistryEntry[];
};
type WorkspaceCreateArgs = {
    cwd?: string;
    name: string;
    repos?: string[];
    path?: string;
    strategy?: WorkspaceStrategy;
    branch?: string;
};
type WorkspaceCreateResult = {
    workspacePath: string;
    manifestPath: string;
    registryPath: string;
    registryEntry: WorkspaceRegistryEntry;
    repoMembers: WorkspaceRepoMember[];
};
export declare function blueprintWorkspaceRegistryGet(_args?: WorkspaceRegistryGetArgs): Promise<WorkspaceRegistryGetResult>;
export declare function blueprintWorkspaceCreate(args: WorkspaceCreateArgs): Promise<WorkspaceCreateResult>;
export declare const workspaceToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<WorkspaceRegistryGetResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        repos: z.ZodOptional<z.ZodArray<z.ZodString>>;
        path: z.ZodOptional<z.ZodString>;
        strategy: z.ZodOptional<z.ZodEnum<{
            worktree: "worktree";
            clone: "clone";
        }>>;
        branch: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<WorkspaceCreateResult>;
})[];
export {};
