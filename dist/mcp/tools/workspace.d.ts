import * as z from "zod/v4";
declare const WORKSPACE_STRATEGIES: readonly ["worktree", "clone"];
declare const PATCH_AUDIT_ACTIONS: readonly ["record", "preview", "reapply"];
declare const PATCH_OUTCOMES: readonly ["recorded", "applied", "conflict", "blocked"];
type WorkspaceStrategy = (typeof WORKSPACE_STRATEGIES)[number];
type PatchAuditAction = (typeof PATCH_AUDIT_ACTIONS)[number];
type PatchOutcome = (typeof PATCH_OUTCOMES)[number];
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
type WorkspaceRemoveArgs = {
    cwd?: string;
    name: string;
    path?: string;
};
type WorkspaceRemoveResult = {
    removedPath: string;
    manifestPath: string;
    registryPath: string;
    removedEntry: WorkspaceRegistryEntry;
    removedMembers: WorkspaceRepoMember[];
    skippedMembers: string[];
};
type PatchCompatibility = {
    host: string | null;
    repoRootName: string;
    remoteUrl: string | null;
};
type PatchListArgs = {
    cwd?: string;
    patchIds?: string[];
};
type PatchListResult = {
    registryPath: string;
    patches: Array<{
        patchId: string;
        label: string | null;
        createdAt: string;
        sourceVersion: string | null;
        trackedFiles: string[];
        manifestPath: string;
        patchPath: string;
        auditPath: string;
        lastAppliedAt: string | null;
        lastOutcome: PatchOutcome | null;
        compatibility: {
            status: "compatible" | "mismatch" | "unknown";
            reasons: string[];
        };
    }>;
};
type PatchRecordArgs = {
    cwd?: string;
    patchId: string;
    patch?: string;
    trackedFiles: string[];
    label?: string;
    sourceVersion?: string;
    compatibility?: Partial<PatchCompatibility>;
    audit?: {
        action?: PatchAuditAction;
        outcome?: PatchOutcome;
        conflicts?: string[];
        warnings?: string[];
        dryRun?: boolean;
        targetHead?: string | null;
    };
};
type PatchRecordResult = {
    patchId: string;
    registryPath: string;
    manifestPath: string;
    patchPath: string;
    auditPath: string;
    trackedFiles: string[];
    updated: boolean;
};
type PatchReapplyArgs = {
    cwd?: string;
    patchIds?: string[];
    dryRun?: boolean;
};
type PatchConflict = {
    patchId: string;
    message: string;
};
type PatchReapplyResult = {
    registryPath: string;
    appliedPatches: string[];
    skippedPatches: string[];
    conflicts: PatchConflict[];
    preview: boolean;
    targetHead: string | null;
};
export declare function blueprintWorkspaceRegistryGet(_args?: WorkspaceRegistryGetArgs): Promise<WorkspaceRegistryGetResult>;
export declare function blueprintWorkspaceCreate(args: WorkspaceCreateArgs): Promise<WorkspaceCreateResult>;
export declare function blueprintWorkspaceRemove(args: WorkspaceRemoveArgs): Promise<WorkspaceRemoveResult>;
export declare function blueprintPatchList(args?: PatchListArgs): Promise<PatchListResult>;
export declare function blueprintPatchRecord(args: PatchRecordArgs): Promise<PatchRecordResult>;
export declare function blueprintPatchReapply(args?: PatchReapplyArgs): Promise<PatchReapplyResult>;
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
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<WorkspaceRemoveResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        patchIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PatchListResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        patchId: z.ZodString;
        patch: z.ZodOptional<z.ZodString>;
        trackedFiles: z.ZodArray<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
        sourceVersion: z.ZodOptional<z.ZodString>;
        compatibility: z.ZodOptional<z.ZodObject<{
            host: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            repoRootName: z.ZodOptional<z.ZodString>;
            remoteUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>;
        audit: z.ZodOptional<z.ZodObject<{
            action: z.ZodOptional<z.ZodEnum<{
                record: "record";
                preview: "preview";
                reapply: "reapply";
            }>>;
            outcome: z.ZodOptional<z.ZodEnum<{
                recorded: "recorded";
                applied: "applied";
                conflict: "conflict";
                blocked: "blocked";
            }>>;
            conflicts: z.ZodOptional<z.ZodArray<z.ZodString>>;
            warnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
            dryRun: z.ZodOptional<z.ZodBoolean>;
            targetHead: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PatchRecordResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        patchIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        dryRun: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<PatchReapplyResult>;
})[];
export {};
