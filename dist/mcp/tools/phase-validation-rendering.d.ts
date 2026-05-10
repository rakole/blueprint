import { type NumericInput } from "./phase-numbering.js";
type PhaseValidationRenderLookupArgs = {
    cwd?: string;
    phase?: NumericInput;
    phaseNumber?: NumericInput;
    phaseName?: string;
};
type PhaseValidationRenderResolvedPhase = {
    phasePrefix: string;
    phaseName: string;
};
export type VerificationRenderCoverageRow = {
    requirement?: string;
    taskOrCheck?: string;
    evidence?: string;
    coverageState?: string;
    notes?: string;
};
export type VerificationManualCoverageRow = {
    item?: string;
    whyManualOrDeferred?: string;
    followUp?: string;
    status?: string;
};
export type VerificationGapClassificationRow = {
    gapClass?: string;
    scope?: string;
    evidence?: string;
    repair?: string;
};
export type VerificationCoverageState = "PASS" | "COVERED" | "MANUAL" | "DEFERRED" | "BLOCKED";
export type VerificationTestMatrixRow = {
    number?: string;
    test?: string;
    expectedBehavior?: string;
    evidence?: string;
    result?: "pending" | "pass" | "issue" | "skipped" | "blocked";
    notes?: string;
};
export type VerificationResultSummary = {
    total?: number;
    passed?: number;
    issues?: number;
    pending?: number;
    skipped?: number;
    blocked?: number;
};
export type VerificationStructuredGapRow = {
    test?: string;
    truth?: string;
    status?: "failed" | "partial" | "blocked" | "none";
    severity?: "blocker" | "major" | "minor" | "cosmetic" | "none";
    reason?: string;
    followUp?: string;
};
export type VerificationRenderArgs = PhaseValidationRenderLookupArgs & {
    artifact: "verification";
    coverageSummary?: string;
    status?: string;
    gateState?: string;
    signOff?: string;
    validationSummary?: string | string[];
    requirementCoverage?: VerificationRenderCoverageRow[];
    evidenceReviewedSummaryPaths?: string[];
    evidenceMetadata?: string[];
    manualOrDeferredCoverage?: VerificationManualCoverageRow[];
    gapClassification?: VerificationGapClassificationRow[];
    gapsFound?: string[];
    suggestedRepairs?: string[];
    sessionState?: string[];
    checkpoint?: string;
    testMatrix?: VerificationTestMatrixRow[];
    resultSummary?: VerificationResultSummary;
    observedBehavior?: string[];
    unresolvedGaps?: string[];
    structuredGaps?: VerificationStructuredGapRow[];
    followUpFixes?: string[];
    nextSafeAction?: string;
};
export type PhaseVerificationStructuredModel = {
    coverageSummary: string;
    status: "PASS" | "PARTIAL" | "BLOCKED";
    gateState: "PASS" | "PARTIAL" | "BLOCKED";
    signOff: string;
    validationSummary: string | string[];
    requirementCoverage: Array<{
        requirement: string;
        taskOrCheck: string;
        evidence: string;
        coverageState: VerificationCoverageState | "covered";
        notes: string;
    }>;
    evidenceReviewedSummaryPaths: string[];
    evidenceMetadata: string[];
    manualOrDeferredCoverage: Array<{
        item: string;
        whyManualOrDeferred: string;
        followUp: string;
        status: "MANUAL" | "DEFERRED" | "NONE";
    }>;
    gapClassification: Array<{
        gapClass: "missing-evidence" | "partial-coverage" | "manual-only" | "deferred-test" | "contradiction" | "none";
        scope: string;
        evidence: string;
        repair: string;
    }>;
    gapsFound: string[];
    suggestedRepairs: string[];
    sessionState?: string[];
    checkpoint?: string;
    testMatrix?: Array<Required<VerificationTestMatrixRow>>;
    resultSummary?: Required<VerificationResultSummary>;
    observedBehavior?: string[];
    unresolvedGaps?: string[];
    structuredGaps?: Array<Required<VerificationStructuredGapRow>>;
    followUpFixes?: string[];
    nextSafeAction: string;
};
export type PhaseUatStructuredModel = {
    status: "PASS" | "FAIL" | "PARTIAL";
    resumeState: "RESUMED" | "NEW" | "CONTINUED";
    checkpoint: string;
    uatSummary: string[];
    sessionState: string[];
    currentTest: {
        number: string;
        name: string;
        expected: string;
        awaiting: string;
    };
    testMatrix: Array<{
        number: string;
        test: string;
        expectedBehavior: string;
        evidence: string;
        result: "pending" | "pass" | "issue" | "skipped" | "blocked";
        notes: string;
    }>;
    resultSummary: {
        total: number;
        passed: number;
        issues: number;
        pending: number;
        skipped: number;
        blocked: number;
    };
    questionsAsked: string[];
    observedBehavior: string[];
    unresolvedGaps: string[];
    structuredGaps: Array<{
        test: string;
        truth: string;
        status: "failed" | "partial" | "blocked" | "none";
        severity: "blocker" | "major" | "minor" | "cosmetic" | "none";
        reason: string;
        followUp: string;
    }>;
    followUpFixes: string[];
    nextSafeAction: string;
};
type UatRenderCurrentTest = {
    number?: string;
    name?: string;
    expected?: string;
    awaiting?: string;
};
type UatRenderTestMatrixRow = {
    number?: string;
    test?: string;
    expectedBehavior?: string;
    evidence?: string;
    result?: string;
    notes?: string;
};
type UatRenderResultSummary = {
    total?: number;
    passed?: number;
    issues?: number;
    pending?: number;
    skipped?: number;
    blocked?: number;
};
type UatRenderStructuredGapRow = {
    test?: string;
    truth?: string;
    status?: string;
    severity?: string;
    reason?: string;
    followUp?: string;
};
export type UatRenderArgs = PhaseValidationRenderLookupArgs & {
    artifact: "uat";
    status?: string;
    resumeState?: string;
    checkpoint?: string;
    uatSummary?: string[];
    sessionState?: string[];
    currentTest?: UatRenderCurrentTest;
    testMatrix?: UatRenderTestMatrixRow[];
    resultSummary?: UatRenderResultSummary;
    questionsAsked?: string[];
    observedBehavior?: string[];
    unresolvedGaps?: string[];
    structuredGaps?: UatRenderStructuredGapRow[];
    followUpFixes?: string[];
    nextSafeAction?: string;
};
export type PhaseValidationRenderArgs = VerificationRenderArgs | UatRenderArgs;
export declare function normalizeVerificationStructuredModel(model: PhaseVerificationStructuredModel): PhaseVerificationStructuredModel;
export declare function renderVerificationContent(args: VerificationRenderArgs, resolved: PhaseValidationRenderResolvedPhase, summaryPaths: string[], readinessByGate: Record<string, string>): string;
export declare function renderUatContent(args: UatRenderArgs, resolved: PhaseValidationRenderResolvedPhase): string;
export declare function verificationPayloadIssues(args: VerificationRenderArgs): string[];
export declare function uatPayloadIssues(args: UatRenderArgs): string[];
export {};
