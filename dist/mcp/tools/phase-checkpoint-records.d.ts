import * as z from "zod/v4";
export type PhaseCheckpointRecord = Record<string, unknown>;
type PhaseCheckpointDecisionRecord = {
    topic: string;
    decision: string;
    rationale?: string;
};
type PhaseCheckpointDeferredIdeaRecord = {
    idea: string;
    reason?: string;
    revisitWhen?: string;
};
type PhaseCheckpointReferenceRecord = {
    label: string;
    target: string;
    note?: string;
};
export type PhaseCheckpointOwnerCommand = "/blu-discuss-phase" | "/blu-research-phase";
export type PhaseCheckpointResumeMode = "discuss" | "research";
type PhaseCheckpointResumeMetaRecord = {
    mode: PhaseCheckpointResumeMode;
    pendingTopics: string[];
    completedTopics: string[];
    currentQuestion?: string;
    notes: string[];
    resumeHint?: string;
    updatedAt: string;
};
export type PhaseCheckpointWriteRecord = PhaseCheckpointRecord & {
    ownerCommand: PhaseCheckpointOwnerCommand;
    completedAreas: string[];
    remainingAreas: string[];
    decisions: PhaseCheckpointDecisionRecord[];
    deferredIdeas: PhaseCheckpointDeferredIdeaRecord[];
    canonicalReferences: PhaseCheckpointReferenceRecord[];
    resumeMeta: PhaseCheckpointResumeMetaRecord;
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
export declare const phaseCheckpointWriteSchema: z.ZodObject<{
    ownerCommand: z.ZodEnum<{
        "/blu-discuss-phase": "/blu-discuss-phase";
        "/blu-research-phase": "/blu-research-phase";
    }>;
    completedAreas: z.ZodArray<z.ZodString>;
    remainingAreas: z.ZodArray<z.ZodString>;
    decisions: z.ZodArray<z.ZodObject<{
        topic: z.ZodString;
        decision: z.ZodString;
        rationale: z.ZodOptional<z.ZodString>;
    }, z.core.$catchall<z.ZodUnknown>>>;
    deferredIdeas: z.ZodArray<z.ZodObject<{
        idea: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
        revisitWhen: z.ZodOptional<z.ZodString>;
    }, z.core.$catchall<z.ZodUnknown>>>;
    canonicalReferences: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        target: z.ZodString;
        note: z.ZodOptional<z.ZodString>;
    }, z.core.$catchall<z.ZodUnknown>>>;
    resumeMeta: z.ZodObject<{
        mode: z.ZodEnum<{
            research: "research";
            discuss: "discuss";
        }>;
        pendingTopics: z.ZodArray<z.ZodString>;
        completedTopics: z.ZodArray<z.ZodString>;
        currentQuestion: z.ZodOptional<z.ZodString>;
        notes: z.ZodArray<z.ZodString>;
        resumeHint: z.ZodOptional<z.ZodString>;
        updatedAt: z.ZodString;
    }, z.core.$catchall<z.ZodUnknown>>;
}, z.core.$catchall<z.ZodUnknown>>;
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
export {};
