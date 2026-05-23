export type PhaseQualityGateMissingGate = "review" | "security" | null;
export type PhaseQualityGateArtifactKind = "plan" | "summary" | "review" | "review-fix" | "security" | "other";
export type PhaseQualityGateArtifactInput = string | {
    path: string;
    content?: string;
    kind?: PhaseQualityGateArtifactKind;
};
export type PhaseQualityGateScopedArtifacts = {
    all?: PhaseQualityGateArtifactInput[];
    plans?: PhaseQualityGateArtifactInput[];
    summaries?: PhaseQualityGateArtifactInput[];
    review?: PhaseQualityGateArtifactInput | null;
    reviewFix?: PhaseQualityGateArtifactInput | null;
    security?: PhaseQualityGateArtifactInput | null;
};
export type PhaseQualityGateArtifactCollection = PhaseQualityGateArtifactInput[] | PhaseQualityGateScopedArtifacts;
export type PhaseQualityGateEvaluationArgs = {
    projectRoot: string;
    phaseNumber: string;
    phasePrefix?: string;
    phaseDir?: string;
    artifacts?: PhaseQualityGateArtifactCollection;
};
export type PhaseQualityGateEvaluation = {
    reviewPath: string | null;
    securityPath: string | null;
    hasReview: boolean;
    hasSecurity: boolean;
    reviewableFiles: string[];
    codeReviewEnabled: boolean;
    requiresCodeReview: boolean;
    gatesSatisfied: boolean;
    missingGate: PhaseQualityGateMissingGate;
    warnings: string[];
    reviewNextSafeAction: string | null;
    reviewDebtKind: "remediation" | "follow-up" | null;
};
export type PhaseQualityGateRoutingArgs = {
    implementedCommandNames: Set<string>;
    phaseNumber: string;
    evaluation: Pick<PhaseQualityGateEvaluation, "missingGate" | "requiresCodeReview" | "gatesSatisfied" | "hasSecurity" | "reviewNextSafeAction" | "reviewDebtKind">;
};
export declare function isReviewableRepoFile(relativePath: string): boolean;
export declare function evaluatePhaseQualityGates(args: PhaseQualityGateEvaluationArgs): Promise<PhaseQualityGateEvaluation>;
export declare function formatPhaseQualityGateDebtReason(args: Pick<PhaseQualityGateEvaluation, "requiresCodeReview" | "missingGate" | "reviewableFiles" | "reviewNextSafeAction" | "hasSecurity" | "reviewDebtKind">): string | null;
export declare function buildPhaseQualityGateNextAction(args: PhaseQualityGateRoutingArgs): string | null;
