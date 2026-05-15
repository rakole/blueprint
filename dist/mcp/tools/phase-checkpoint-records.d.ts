import * as z from "zod/v4";
export type PhaseCheckpointRecord = Record<string, unknown>;
export type PhaseCheckpointOwnerCommand = "/blu-discuss-phase" | "/blu-research-phase";
export type PhaseCheckpointResumeMode = "discuss" | "research";
export type PhaseCheckpointWriteRecord = PhaseCheckpointRecord & {
    schemaVersion: 2;
    ownerCommand: PhaseCheckpointOwnerCommand;
    mode: PhaseCheckpointResumeMode;
};
export declare const PHASE_CHECKPOINT_OWNER_MODES: Record<PhaseCheckpointOwnerCommand, PhaseCheckpointResumeMode>;
export declare const phaseCheckpointOwnerCommandSchema: z.ZodEnum<{
    "/blu-discuss-phase": "/blu-discuss-phase";
    "/blu-research-phase": "/blu-research-phase";
}>;
export declare const phaseCheckpointResumeModeSchema: z.ZodEnum<{
    research: "research";
    discuss: "discuss";
}>;
export declare const phaseCheckpointWriteSchema: z.ZodUnion<readonly [z.ZodObject<{
    schemaVersion: z.ZodLiteral<2>;
    ownerCommand: z.ZodLiteral<"/blu-discuss-phase">;
    mode: z.ZodLiteral<"discuss">;
    progress: z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>;
    areaQueue: z.ZodArray<z.ZodObject<{
        areaId: z.ZodString;
        title: z.ZodString;
        state: z.ZodEnum<{
            blocked: "blocked";
            questioning: "questioning";
            assumed: "assumed";
            decided: "decided";
            "needs-revisit": "needs-revisit";
            unseen: "unseen";
        }>;
        decisionIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        evidenceRefs: z.ZodOptional<z.ZodArray<z.ZodString>>;
        downstreamConsumers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        currentQuestion: z.ZodOptional<z.ZodString>;
        questionWhyItMatters: z.ZodOptional<z.ZodString>;
        lastUserAnswer: z.ZodOptional<z.ZodUnknown>;
        blockingReason: z.ZodOptional<z.ZodString>;
        resolutionCriterion: z.ZodOptional<z.ZodString>;
    }, z.core.$catchall<z.ZodUnknown>>>;
    carryForward: z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>;
    readSet: z.ZodArray<z.ZodUnknown>;
}, z.core.$catchall<z.ZodUnknown>>, z.ZodObject<{
    schemaVersion: z.ZodLiteral<2>;
    ownerCommand: z.ZodLiteral<"/blu-research-phase">;
    mode: z.ZodLiteral<"research">;
    researchLedger: z.ZodObject<{
        schemaVersion: z.ZodLiteral<"research-ledger/v1">;
        strands: z.ZodArray<z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>>;
    }, z.core.$catchall<z.ZodUnknown>>;
}, z.core.$catchall<z.ZodUnknown>>]>;
export declare function ensureCheckpointObject(checkpoint: unknown, checkpointPath: string): PhaseCheckpointRecord;
export declare function ensureCheckpointForPersistence(checkpoint: unknown, checkpointPath: string): PhaseCheckpointWriteRecord;
export declare function checkpointExpectedOwnerFromMode(value: string | null): PhaseCheckpointOwnerCommand | null;
export declare function checkpointOwnershipBlockerReason(checkpointPath: string, warnings: string[], action: "overwrite" | "delete"): string;
export declare function evaluateCheckpointResumeSafety(checkpoint: Record<string, unknown>, checkpointPath: string, expectedOwnerCommand?: PhaseCheckpointOwnerCommand, expectedMode?: PhaseCheckpointResumeMode): {
    ownerCommand: string | null;
    resumeMode: string | null;
    safeToResume: boolean;
    warnings: string[];
};
