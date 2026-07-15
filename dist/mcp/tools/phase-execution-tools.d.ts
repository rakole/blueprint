import type { ToolDefinition } from "../tool-types.js";
import { blueprintArtifactValidate } from "./artifacts.js";
import { type PhaseExecutionPlanProgress, type PhaseExecutionSession } from "./phase-execution-control.js";
import { type PhaseExecutionFileMutation, type PhaseExecutionMutationReceipt, type PhaseExecutionProcessRunner, type PhaseExecutionVerificationReceipt } from "./phase-execution-runtime.js";
import { blueprintPhaseSummaryIndex, blueprintPhaseSummaryWrite } from "./phase.js";
import { prepareBlueprintStateUpdate, writePreparedBlueprintStateUpdate } from "./state.js";
export type PhaseExecutionApplyResult = {
    status: "mutated" | "recovered" | "blocked";
    sessionId: string;
    planId: string;
    attempt: number;
    receipts: PhaseExecutionMutationReceipt[];
    failure: string | null;
};
export declare function blueprintPhaseExecutionApply(args: {
    cwd?: string;
    sessionId: string;
    planId: string;
    mutations: PhaseExecutionFileMutation[];
}): Promise<PhaseExecutionApplyResult>;
export type PhaseExecutionVerifyResult = {
    status: "verified" | "awaiting-repair" | "blocked";
    sessionId: string;
    planId: string;
    attempt: number;
    commands: string[];
    receipts: PhaseExecutionVerificationReceipt[];
    failure: string | null;
};
export declare function blueprintPhaseExecutionVerify(args: {
    cwd?: string;
    sessionId: string;
    planId: string;
}, dependencies?: {
    processRunner?: PhaseExecutionProcessRunner;
    timeoutMs?: number;
}): Promise<PhaseExecutionVerifyResult>;
type PhaseExecutionFinalizeDependencies = {
    summaryWrite: typeof blueprintPhaseSummaryWrite;
    summaryIndex: typeof blueprintPhaseSummaryIndex;
    artifactValidate: typeof blueprintArtifactValidate;
    statePrepare: typeof prepareBlueprintStateUpdate;
    stateWrite: typeof writePreparedBlueprintStateUpdate;
    afterStage?: (stage: PhaseExecutionPlanProgress["persistenceStage"], session: PhaseExecutionSession) => Promise<void> | void;
};
export type PhaseExecutionFinalizeResult = {
    status: "completed" | "blocked" | "advanced";
    sessionId: string;
    planId: string;
    summaryPath: string;
    persistenceStage: "done";
    nextPlanId: string | null;
    failure: string | null;
};
export declare function blueprintPhaseExecutionFinalize(args: {
    cwd?: string;
    sessionId: string;
    planId: string;
}, dependencyOverrides?: Partial<PhaseExecutionFinalizeDependencies>): Promise<PhaseExecutionFinalizeResult>;
export declare const phaseExecutionToolDefinitions: ToolDefinition[];
export {};
