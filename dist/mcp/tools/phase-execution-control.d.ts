import { blueprintConfigGet } from "./config.js";
import { blueprintPhaseExecutionTargets } from "./phase.js";
import type { PhaseExecutionFileMutation, PhaseExecutionMutationReceipt, PhaseExecutionVerificationReceipt } from "./phase-execution-runtime.js";
import type { PhaseExecutionTargetsArgs, PhaseExecutionTargetsResult } from "./phase-tool-types.js";
import type { PreparedStateUpdate } from "./state.js";
export declare const EXECUTE_PHASE_CLAIM_CONFIRMATION = "CLAIM BLUEPRINT PHASE EXECUTION";
export type PhaseExecutionPrepareMode = "preview" | "claim" | "resume";
export type PhaseExecutionPrepareArgs = PhaseExecutionTargetsArgs & {
    mode?: PhaseExecutionPrepareMode;
    confirmation?: string;
    previewFingerprint?: string;
    sessionId?: string;
    defaultsPath?: string;
    overwriteConfirmedPlanIds?: string[];
};
export type PhaseExecutionControlProcessResult = {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
};
export type PhaseExecutionControlProcessRunner = (command: "git", argv: readonly string[], cwd: string) => Promise<PhaseExecutionControlProcessResult>;
export type PhaseExecutionControlDependencies = {
    processRunner: PhaseExecutionControlProcessRunner;
    targetResolver: typeof blueprintPhaseExecutionTargets;
    configReader: typeof blueprintConfigGet;
    now: () => string;
    createSessionId: () => string;
    afterSessionPersisted?: (session: PhaseExecutionSession) => Promise<void> | void;
    beforeAuthorityRecheck?: () => Promise<void> | void;
};
type ArtifactDigest = {
    path: string;
    sha256: string | null;
    sizeBytes: number | null;
    mode: number | null;
};
type WorkingTreeDigest = ArtifactDigest & {
    status: string;
};
export type SelectedPlanPacket = {
    planId: string;
    path: string;
    title: string | null;
    wave: number | null;
    dependsOn: string[];
    requirements: string[];
    allowedFiles: string[];
    readFirst: string[];
    verificationCriteria: string[];
    verificationCommands: string[];
    content: string;
    contentSha256: string;
    ownedFilePreimages: ArtifactDigest[];
    readFirstArtifacts: ArtifactDigest[];
};
export type PhaseExecutionControlPacket = {
    schemaVersion: 1;
    command: "execute-phase";
    repository: {
        canonicalRoot: string;
        head: string;
        porcelainV1Z: string;
        porcelainSha256: string;
        workingTree: WorkingTreeDigest[];
    };
    options: {
        phase: string | number | null;
        wave: number | null;
        gapsOnly: boolean;
        includeConflicts: boolean;
        externalServiceConfirmed: boolean;
        overwriteConfirmedPlanIds: string[];
    };
    selection: {
        phaseNumber: string | null;
        phasePrefix: string | null;
        phaseName: string | null;
        phaseDir: string | null;
        selectedWave: number | null;
        selectedPlanIds: string[];
        selectedPlanPaths: string[];
        pendingPlanIds: string[];
        candidatePlanIds: string[];
        overlapPlanIds: string[];
    };
    selectedPlans: SelectedPlanPacket[];
    planSetValidation: PhaseExecutionTargetsResult["planSetValidation"];
    externalServicePreflight: PhaseExecutionTargetsResult["externalServicePreflight"];
    conflicts: PhaseExecutionTargetsResult["conflicts"];
    existingSummaries: PhaseExecutionTargetsResult["existingSummaries"];
    artifacts: ArtifactDigest[];
    effectiveConfig: Awaited<ReturnType<typeof blueprintConfigGet>>;
};
export type PhaseExecutionSession = {
    schemaVersion: 1;
    sessionId: string;
    status: "claimed" | "executing" | "blocked" | "completed";
    fingerprint: string;
    createdAt: string;
    lastResumedAt: string | null;
    resumeCount: number;
    prepareArgs: {
        phase: string | number | null;
        wave: number | null;
        gapsOnly: boolean;
        includeConflicts: boolean;
        externalServiceConfirmed: boolean;
        overwriteConfirmedPlanIds: string[];
        defaultsPath: string | null;
    };
    packet: PhaseExecutionControlPacket;
    execution: PhaseExecutionProgress;
};
export type PhaseExecutionPlanProgress = {
    planId: string;
    status: "pending" | "applying" | "mutated" | "awaiting-repair" | "repairing" | "verifying" | "verified" | "blocked" | "summary-written" | "persisted";
    applyAttempts: number;
    verificationAttempts: number;
    pendingMutations: PhaseExecutionPendingMutation[];
    mutationReceipts: PhaseExecutionMutationReceipt[];
    mutationGitStatusReceipts: Array<{
        path: string;
        status: string | null;
    }>;
    verificationReceipts: PhaseExecutionVerificationReceipt[][];
    failure: string | null;
    summaryReceipt: ArtifactDigest | null;
    stateReceipt: ArtifactDigest | null;
    pendingStateUpdate: PhaseExecutionPreparedStateUpdate | null;
    persistenceStage: "none" | "summary-write" | "summary-index" | "artifact-validate" | "state-update" | "done";
};
export type PhaseExecutionPendingMutation = PhaseExecutionFileMutation & {
    expectedMode: number | null;
    expectedAfterMode: number | null;
};
export type PhaseExecutionPreparedStateUpdate = {
    prepared: PreparedStateUpdate;
    preimage: ArtifactDigest;
    postimage: ArtifactDigest;
};
export type PhaseExecutionProgress = {
    schemaVersion: 1;
    currentPlanIndex: number;
    plans: Record<string, PhaseExecutionPlanProgress>;
};
export type PhaseExecutionPrepareResult = {
    status: "preview" | "claimed" | "resumed" | "blocked" | "stale";
    mode: PhaseExecutionPrepareMode;
    ready: boolean;
    reused: boolean;
    projectRoot: string | null;
    fingerprint: string | null;
    packet: PhaseExecutionControlPacket | null;
    session: PhaseExecutionSession | null;
    blockers: string[];
    warnings: string[];
};
export declare function capturePhaseExecutionRepositorySnapshot(projectRoot: string): Promise<PhaseExecutionControlPacket["repository"]>;
export declare function isValidPhaseExecutionVerificationReceipt(value: unknown, command: string): value is PhaseExecutionVerificationReceipt;
export declare function hasPassingBoundPhaseExecutionVerification(commands: readonly string[], receipts: readonly PhaseExecutionVerificationReceipt[] | undefined): boolean;
export type PhaseExecutionSessionMutationContext = {
    projectRoot: string;
    checkpoint: (session: PhaseExecutionSession) => Promise<void>;
};
export declare function mutatePhaseExecutionSession<T>(args: {
    cwd?: string;
    sessionId: string;
    mutate: (session: PhaseExecutionSession, context: PhaseExecutionSessionMutationContext) => Promise<{
        session: PhaseExecutionSession;
        result: T;
    }>;
}): Promise<{
    session: PhaseExecutionSession;
    result: T;
    projectRoot: string;
}>;
export declare function blueprintPhaseExecutionPrepare(args?: PhaseExecutionPrepareArgs, dependencyOverrides?: Partial<PhaseExecutionControlDependencies>): Promise<PhaseExecutionPrepareResult>;
export {};
