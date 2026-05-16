import { type ErrorObject } from "ajv/dist/2020.js";
import { type ArtifactContractReadResult } from "../artifact-contracts/index.js";
import { type PhaseValidationArtifactKind } from "./phase-locations.js";
export type PhaseValidationDiagnosticSource = "scope" | "schema" | "residual" | "markdown";
export type PhaseValidationModelDiagnostic = {
    source: PhaseValidationDiagnosticSource;
    path: string;
    code: string;
    message: string;
    context: Record<string, unknown>;
    suggestion: string;
};
export type PhaseValidationDiagnosticCounts = {
    total: number;
    bySource: Record<PhaseValidationDiagnosticSource, number>;
    byCode: Record<string, number>;
};
export declare function phaseValidationDiagnostic(args: PhaseValidationModelDiagnostic): PhaseValidationModelDiagnostic;
export declare function emptyPhaseValidationDiagnosticCounts(): PhaseValidationDiagnosticCounts;
export declare function countPhaseValidationDiagnostics(diagnostics: PhaseValidationModelDiagnostic[]): PhaseValidationDiagnosticCounts;
export declare function formatPhaseValidationDiagnostic(diagnostic: PhaseValidationModelDiagnostic): string;
export declare function schemaDiagnosticFromPhaseValidationAjvError(error: ErrorObject, taskSchema: Record<string, unknown>, model: unknown): PhaseValidationModelDiagnostic;
export declare function phaseValidationResidualDiagnostics(model: Record<string, unknown>, modelContract: ArtifactContractReadResult["modelContract"], artifact: PhaseValidationArtifactKind): PhaseValidationModelDiagnostic[];
