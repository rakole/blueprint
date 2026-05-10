import { type ErrorObject } from "ajv/dist/2020.js";
export type PhasePlanModelDiagnosticSource = "scope" | "schema" | "residual" | "markdown";
export type PhasePlanModelDiagnosticSeverity = "error" | "warning";
export type PhasePlanModelRepairAction = "add" | "remove" | "replace" | "dedupe" | "reroute" | "make-verifiable" | "re-read-context";
export type PhasePlanModelPatchHint = {
    op: "add" | "remove" | "replace";
    path: string;
    value?: unknown;
};
export type PhasePlanModelDiagnostic = {
    id?: string;
    severity?: PhasePlanModelDiagnosticSeverity;
    source: PhasePlanModelDiagnosticSource;
    path: string;
    modelPath?: string;
    jsonPointer?: string | null;
    markdownPath?: string;
    code: string;
    message: string;
    context: Record<string, unknown>;
    expected?: unknown;
    actual?: unknown;
    allowedValues?: unknown[];
    repairAction?: PhasePlanModelRepairAction;
    patchHint?: PhasePlanModelPatchHint;
    suggestion: string;
};
export type PhasePlanRepairSummary = {
    blockingCount: number;
    firstPassActions: string[];
    reReadAuthoringContext: boolean;
    retryInstruction: string;
};
export type PhasePlanDiagnosticCounts = {
    total: number;
    bySource: Record<PhasePlanModelDiagnosticSource, number>;
    byCode: Record<string, number>;
};
export declare function phasePlanDiagnostic(args: PhasePlanModelDiagnostic): PhasePlanModelDiagnostic;
export declare function emptyPhasePlanDiagnosticCounts(): PhasePlanDiagnosticCounts;
export declare function countPhasePlanDiagnostics(diagnostics: PhasePlanModelDiagnostic[]): PhasePlanDiagnosticCounts;
export declare function summarizePhasePlanRepairs(diagnostics: PhasePlanModelDiagnostic[]): PhasePlanRepairSummary;
export declare function formatPhasePlanDiagnostic(diagnostic: PhasePlanModelDiagnostic): string;
export declare function schemaDiagnosticFromPhasePlanAjvError(error: ErrorObject, taskSchema: Record<string, unknown>, model: unknown): PhasePlanModelDiagnostic;
export declare function phasePlanModelResidualDiagnostics(model: Record<string, unknown>): PhasePlanModelDiagnostic[];
