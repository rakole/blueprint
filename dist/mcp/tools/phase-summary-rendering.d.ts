type PhaseSummaryRenderResolvedPhase = {
    phasePrefix: string;
    phaseName: string;
};
type PhaseSummaryStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type PhaseSummaryReadiness = "ready-for-validation" | "not-ready-for-validation" | "blocked";
type PhaseSummaryCompletionState = "complete" | "pending" | "blocked";
type PhaseSummaryVerificationResult = "pass" | "fail" | "blocked" | "not-run";
type PhaseSummaryManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type PhaseSummaryGapStatus = "OPEN" | "BLOCKED" | "NONE";
type PhaseSummaryEvidenceKind = "artifact" | "repo-path" | "command" | "test" | "other";
export type PhaseSummaryStructuredModel = {
    status: PhaseSummaryStatus;
    readiness: PhaseSummaryReadiness;
    completionState: PhaseSummaryCompletionState;
    outcome: string[];
    changesMade: string[];
    targetedVerification: Array<{
        check: string;
        command: string;
        result: PhaseSummaryVerificationResult;
        evidence: string;
        notes: string;
    }>;
    dependencyPlans: Array<{
        planId: string;
        path: string;
        status: "satisfied";
        evidence: string;
    }>;
    manualOrDeferredWork: Array<{
        item: string;
        reason: string;
        followUp: string;
        status: PhaseSummaryManualStatus;
    }>;
    gapRoutes: Array<{
        gap: string;
        evidence: string;
        repair: string;
        status: PhaseSummaryGapStatus;
    }>;
    followUps: string[];
    evidence: Array<{
        kind: PhaseSummaryEvidenceKind;
        source: string;
        summary: string;
    }>;
    nextSafeAction: string;
};
export declare function normalizePhaseSummaryModel(model: Record<string, unknown>): PhaseSummaryStructuredModel | null;
export declare function renderPhaseSummaryModelContent(args: {
    model: PhaseSummaryStructuredModel;
    resolved: PhaseSummaryRenderResolvedPhase;
    planId: string;
    linkedPlanPath: string;
    summaryPath: string;
}): string;
export {};
