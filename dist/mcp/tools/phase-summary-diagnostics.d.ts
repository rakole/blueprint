export type PhaseSummaryModelDiagnosticSource = "scope" | "schema" | "residual" | "markdown";
export type PhaseSummaryModelDiagnostic = {
    source: PhaseSummaryModelDiagnosticSource;
    path: string;
    code: string;
    message: string;
    context: Record<string, unknown>;
    suggestion: string;
};
export type PhaseSummaryDiagnosticCounts = {
    total: number;
    bySource: Record<PhaseSummaryModelDiagnosticSource, number>;
    byCode: Record<string, number>;
};
export declare function phaseSummaryDiagnostic(args: PhaseSummaryModelDiagnostic): PhaseSummaryModelDiagnostic;
export declare function emptyPhaseSummaryDiagnosticCounts(): PhaseSummaryDiagnosticCounts;
export declare function countPhaseSummaryDiagnostics(diagnostics: PhaseSummaryModelDiagnostic[]): PhaseSummaryDiagnosticCounts;
export declare function formatPhaseSummaryDiagnostic(diagnostic: PhaseSummaryModelDiagnostic): string;
