import * as z from "zod/v4";
export type BlueprintState = {
    projectStatus: string;
    currentMilestone: string;
    currentPhase: string;
    activeCommand: string;
    nextAction: string;
    blockers: string[];
    roadmapEvolutionNotes: string[];
    lastUpdated: string;
};
type StateUpdateArgs = {
    cwd?: string;
    base?: "stored" | "synced";
    patch?: Partial<BlueprintState>;
};
type StateUpdateResult = {
    updatedFields: string[];
    statePath: string;
    warnings: string[];
};
type StateLoadArgs = {
    cwd?: string;
};
type StateLoadResult = {
    state: BlueprintState;
    blockers: string[];
    derivedStatus: {
        projectStatus: string;
        currentPhase: string | null;
        nextAction: string;
        hasBlockers: boolean;
    };
};
type PauseHandoffRecord = {
    reportType: "pause-work";
    schemaVersion: 1;
    status: "paused";
    timestamp: string;
    projectStatus: string;
    currentMilestone: string | null;
    currentPhase: string | null;
    activeCommand: string;
    currentState: string;
    completedWork: string[];
    remainingWork: string[];
    decisions: string[];
    blockers: string[];
    humanActionsPending: string[];
    modifiedFiles: string[];
    contextNotes: string;
    nextAction: string;
    artifactSnapshot: {
        core: string[];
        phaseArtifacts: string[];
        reports: string[];
        missing: string[];
    };
};
type PauseHandoffGetArgs = {
    cwd?: string;
};
type PauseHandoffWriteArgs = {
    cwd?: string;
    currentState: string;
    completedWork?: string[];
    remainingWork?: string[];
    decisions?: string[];
    blockers?: string[];
    humanActionsPending?: string[];
    modifiedFiles?: string[];
    contextNotes?: string;
    nextAction?: string;
    overwrite?: boolean;
};
type PauseHandoffGetResult = {
    found: boolean;
    path: string | null;
    handoff: PauseHandoffRecord | null;
    reason: string | null;
    warnings: string[];
};
type PauseHandoffWriteResult = {
    path: string;
    written: boolean;
    created: boolean;
    overwritten: boolean;
    status: "created" | "updated" | "reused";
    handoff: PauseHandoffRecord;
    warnings: string[];
};
type StateSyncArgs = {
    cwd?: string;
};
type StateSyncResult = {
    syncedFields: string[];
    warnings: string[];
    statePath: string;
};
export declare function blueprintPauseHandoffGet(args?: PauseHandoffGetArgs): Promise<PauseHandoffGetResult>;
export declare function blueprintPauseHandoffWrite(args: PauseHandoffWriteArgs): Promise<PauseHandoffWriteResult>;
export declare function loadBlueprintState(cwd?: string): Promise<BlueprintState>;
export declare function blueprintStateLoad(args?: StateLoadArgs): Promise<StateLoadResult>;
export declare function blueprintStateUpdate(args?: StateUpdateArgs): Promise<StateUpdateResult>;
export declare function blueprintStateSync(args?: StateSyncArgs): Promise<StateSyncResult>;
export declare const stateToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<StateLoadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        base: z.ZodOptional<z.ZodEnum<{
            stored: "stored";
            synced: "synced";
        }>>;
        patch: z.ZodOptional<z.ZodObject<{
            projectStatus: z.ZodOptional<z.ZodString>;
            currentMilestone: z.ZodOptional<z.ZodString>;
            currentPhase: z.ZodOptional<z.ZodString>;
            activeCommand: z.ZodOptional<z.ZodString>;
            nextAction: z.ZodOptional<z.ZodString>;
            blockers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            roadmapEvolutionNotes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            lastUpdated: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<StateUpdateResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<PauseHandoffGetResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        currentState: z.ZodString;
        completedWork: z.ZodOptional<z.ZodArray<z.ZodString>>;
        remainingWork: z.ZodOptional<z.ZodArray<z.ZodString>>;
        decisions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        blockers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        humanActionsPending: z.ZodOptional<z.ZodArray<z.ZodString>>;
        modifiedFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        contextNotes: z.ZodOptional<z.ZodString>;
        nextAction: z.ZodOptional<z.ZodString>;
        overwrite: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<PauseHandoffWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<StateSyncResult>;
})[];
export {};
