import * as z from "zod/v4";
type ReviewArtifactKind = "code-review" | "peer-review" | "review-fix" | "security" | "ui-review";
type NumericInput = string | number;
type ReviewFindingSeverity = "critical" | "high" | "medium" | "low" | "unknown";
type ReviewFindingDisposition = "follow-up" | "observation" | "blocked" | "accepted-risk";
type ReviewFixTargetClassification = "fixable" | "test-gap" | "validation-only" | "routing-note" | "no-op" | "blocked" | "observation" | "accepted-risk";
type CodeReviewEvidenceCoverageStatus = "used" | "deferred" | "irrelevant";
type ReviewFixStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type ReviewFixReadiness = "ready-for-validation" | "not-ready-for-validation" | "blocked";
type ReviewFixCompletionState = "complete" | "pending" | "blocked";
type ReviewFixFindingStatus = "fixed" | "deferred" | "skipped";
type ReviewFixVerificationResult = "pass" | "fail" | "blocked" | "not-run";
type ReviewFixDependencyStatus = "satisfied" | "pending" | "blocked";
type ReviewFixManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type ReviewFixGapStatus = "OPEN" | "BLOCKED" | "NONE";
type ReviewFixEvidenceKind = "review" | "summary" | "plan" | "repo-path" | "command" | "test" | "other";
type ReviewFixExecutionDebt = {
    pendingPlans: string[];
    lowerWavePendingPlanIds: string[];
    missingCompletedSummaries: boolean;
    unsatisfiedDependencyPlans: Array<{
        planId: string;
        path: string;
    }>;
    blockers: string[];
};
type PeerReviewStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type PeerReviewReadiness = "ready-for-routing" | "not-ready-for-routing" | "blocked";
type PeerReviewCompletionState = "complete" | "pending" | "blocked";
type PeerReviewReviewerStatus = "completed" | "unavailable" | "failed" | "blocked";
type PeerReviewPlanFit = "achieves-goal" | "needs-revision" | "blocked";
type PeerReviewFindingStatus = "OPEN" | "BLOCKED" | "NONE";
type PeerReviewManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type PeerReviewGapStatus = "OPEN" | "BLOCKED" | "NONE";
type PeerReviewEvidenceCoverageStatus = "used" | "deferred" | "unavailable";
type ReviewFindingLocation = {
    display: string;
    file: string;
    startLine: number;
    endLine: number | null;
};
type ReviewFinding = {
    id: string;
    visibleId: string | null;
    stableId: string | null;
    legacyDerived: boolean;
    severity: ReviewFindingSeverity;
    summary: string;
    sourceSection: string | null;
    disposition: ReviewFindingDisposition | null;
    location: ReviewFindingLocation | null;
    file: string | null;
    startLine: number | null;
    endLine: number | null;
    evidence: string | null;
    impact: string | null;
    recommendation: string | null;
    classification: ReviewFixTargetClassification | null;
    defaultEligible: boolean;
};
type ReviewRecordArgs = {
    cwd?: string;
    phase?: NumericInput;
    artifact: ReviewArtifactKind;
    content?: string;
    model?: unknown;
    overwrite?: boolean;
    scopeFiles?: string[];
    scopeSource?: ReviewModeSource;
    depth?: ReviewDepth;
    targetIds?: string[];
};
type ReviewRecordResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    artifact: ReviewArtifactKind;
    reportPath: string;
    written: boolean;
    created: boolean;
    overwritten: boolean;
    status: "created" | "updated" | "reused" | "invalid";
    counts: {
        sections: number;
        findings: number;
        followUps: number;
    };
    followUps: string[];
    diagnostics?: ReviewModelDiagnostic[];
    diagnosticCounts?: ReviewValidateModelResult["diagnosticCounts"];
    repairSummary?: ReviewModelRepairSummary;
    taskSchema?: Record<string, unknown> | null;
    warnings: string[];
};
type ReviewDepth = "quick" | "standard" | "deep";
type ReviewModeSource = "explicit-files" | "phase-plans" | "phase-summaries" | "phase-evidence";
type ReviewScopeConfirmation = {
    recommended: boolean;
    pendingGate: "none" | "scope-confirmation";
    reasons: string[];
    thresholds: {
        broadFileCount: number;
        multiPlanCount: number;
        deepFileCount: number;
    };
    signals: {
        fileCount: number;
        summaryCount: number;
        matchedPlanCount: number;
        depth: ReviewDepth;
        source: ReviewModeSource;
    };
};
type ReviewScopeArgs = {
    cwd?: string;
    phase?: NumericInput;
    files?: string[];
    depth?: ReviewDepth;
    includeAuthoringContext?: boolean;
};
type ReviewScopePhase = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    resolvedFrom: "explicit" | "state" | "roadmap";
};
type CodeReviewAuthoringContext = {
    phase: ReviewScopePhase;
    files: string[];
    reviewMode: {
        depth: ReviewDepth;
        source: ReviewModeSource;
    };
    hasSecurityArtifact: boolean;
    knownEvidenceArtifacts: string[];
    allowedNextActions: string[];
    preferredNextSafeAction: string | null;
    secondaryNextSafeAction: string | null;
    schemaPath: string;
    baseSchema: Record<string, unknown>;
    taskSchema: Record<string, unknown>;
};
type ReviewScopeResult = {
    status: "ready" | "invalid";
    phase: ReviewScopePhase | null;
    files: string[];
    reviewMode: {
        depth: ReviewDepth;
        source: ReviewModeSource;
    };
    confirmationRecommended: ReviewScopeConfirmation;
    artifacts: {
        plans: string[];
        summaries: string[];
        verification: string | null;
        uat: string | null;
        existingReview: string | null;
        security: string | null;
    };
    authoringContext?: CodeReviewAuthoringContext;
    reason: string | null;
    warnings: string[];
};
type ReviewLoadFindingsArgs = {
    cwd?: string;
    phase?: NumericInput;
    artifact?: ReviewArtifactKind;
};
type ReviewLoadFindingsResult = {
    phaseFound: boolean;
    found: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    artifact: ReviewArtifactKind;
    path: string | null;
    findings: ReviewFinding[];
    severityCounts: Record<ReviewFindingSeverity, number>;
    followUps: string[];
    followUpTargets: ReviewFixTarget[];
    reason: string | null;
    warnings: string[];
};
type CodeReviewStructuredModel = {
    verdict: "PASS" | "FOLLOW_UP" | "BLOCKED";
    reviewSummary: string[];
    positiveSignals: string[];
    findings: Array<{
        severity: ReviewFindingSeverity;
        disposition: ReviewFindingDisposition;
        location: string;
        evidence: string;
        impact: string;
        recommendation: string;
    }>;
    evidenceCoverage: Record<string, {
        status: CodeReviewEvidenceCoverageStatus;
        rationale: string;
    }>;
    followUps: string[];
    nextSafeAction: string;
};
type ReviewFixTarget = {
    targetId: string;
    visibleId: string | null;
    stableId: string | null;
    legacyDerived: boolean;
    source: "finding" | "follow-up";
    severity: ReviewFindingSeverity;
    summary: string;
    sourceSection: string | null;
    disposition: ReviewFindingDisposition | null;
    location: string | null;
    file: string | null;
    startLine: number | null;
    endLine: number | null;
    evidence: string | null;
    impact: string | null;
    recommendation: string | null;
    classification: ReviewFixTargetClassification;
    defaultEligible: boolean;
};
type ReviewFixStructuredModel = {
    status: ReviewFixStatus;
    readiness: ReviewFixReadiness;
    completionState: ReviewFixCompletionState;
    remediationSummary: string[];
    findingsAddressed: Array<{
        findingId: string;
        status: ReviewFixFindingStatus;
        evidence: string;
        disposition: string;
    }>;
    changesMade: Array<{
        file: string;
        summary: string;
    }>;
    verification: Array<{
        check: string;
        command: string;
        result: ReviewFixVerificationResult;
        evidence: string;
    }>;
    dependencyPlans: Array<{
        planId: string;
        path: string;
        status: ReviewFixDependencyStatus;
        evidence: string;
    }>;
    manualOrDeferredWork: Array<{
        item: string;
        reason: string;
        followUp: string;
        status: ReviewFixManualStatus;
    }>;
    gapRoutes: Array<{
        gap: string;
        evidence: string;
        repair: string;
        status: ReviewFixGapStatus;
    }>;
    followUps: string[];
    evidence: Array<{
        kind: ReviewFixEvidenceKind;
        source: string;
        summary: string;
    }>;
    nextSafeAction: string;
};
type ReviewFixAuthoringContext = {
    phase: ReviewScopePhase;
    path: string;
    sourceReviewPath: string;
    targets: ReviewFixTarget[];
    selectedTargetIds: string[];
    completedSummaries: string[];
    dependencyPlans: Array<{
        planId: string;
        path: string;
    }>;
    executionDebt: ReviewFixExecutionDebt;
    knownEvidenceArtifacts: string[];
    existingReviewFix: string | null;
    allowCompleted: boolean;
    completedNextSafeAction: string;
    partialNextSafeActions: string[];
    blockedNextSafeActions: string[];
    blockedRequiredNextSafeAction: string | null;
    allowedNextActions: string[];
    schemaPath: string;
    baseSchema: Record<string, unknown>;
    taskSchema: Record<string, unknown>;
};
type PeerReviewStructuredModel = {
    status: PeerReviewStatus;
    readiness: PeerReviewReadiness;
    completionState: PeerReviewCompletionState;
    reviewSummary: string[];
    reviewerCoverage: Array<{
        reviewer: string;
        status: PeerReviewReviewerStatus;
        summary: string;
    }>;
    planReviews: Array<{
        planId: string;
        path: string;
        goalFit: PeerReviewPlanFit;
        summary: string;
    }>;
    findings: Array<{
        severity: ReviewFindingSeverity;
        source: string;
        evidence: string;
        recommendation: string;
        status: PeerReviewFindingStatus;
    }>;
    consensus: string[];
    disagreements: string[];
    riskAssessment: {
        level: "LOW" | "MEDIUM" | "HIGH";
        summary: string;
    };
    manualOrDeferredWork: Array<{
        item: string;
        reason: string;
        followUp: string;
        status: PeerReviewManualStatus;
    }>;
    gapRoutes: Array<{
        gap: string;
        evidence: string;
        repair: string;
        status: PeerReviewGapStatus;
    }>;
    followUps: string[];
    evidenceCoverage: Record<string, {
        status: PeerReviewEvidenceCoverageStatus;
        rationale: string;
    }>;
    nextSafeAction: string;
};
type PeerReviewAuthoringContext = {
    phase: ReviewScopePhase;
    path: string;
    plans: Array<{
        planId: string;
        path: string;
        title: string | null;
    }>;
    knownEvidenceArtifacts: string[];
    pendingPlans: string[];
    existingPeerReview: string | null;
    completedNextSafeActions: string[];
    partialNextSafeActions: string[];
    blockedNextSafeActions: string[];
    allowedNextActions: string[];
    schemaPath: string;
    baseSchema: Record<string, unknown>;
    taskSchema: Record<string, unknown>;
};
type SecurityReviewStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type SecurityReviewReadiness = "ready-for-routing" | "needs-follow-up" | "blocked";
type SecurityReviewCompletionState = "complete" | "partial" | "blocked";
type SecurityThreatStatus = "closed" | "accepted" | "open" | "none";
type SecurityEvidenceCoverageStatus = "used" | "deferred" | "unavailable";
type SecurityManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type SecurityGapStatus = "OPEN" | "BLOCKED" | "NONE";
type UiReviewVerdict = "PASS" | "FOLLOW_UP" | "BLOCKED";
type UiReviewReadiness = "ready-for-routing" | "needs-follow-up" | "blocked";
type UiReviewCompletionState = "complete" | "partial" | "blocked";
type UiReviewPillar = "Copywriting" | "Visual Hierarchy" | "Color" | "Typography" | "Spacing" | "Experience Design";
type UiReviewEvidenceCoverageStatus = "used" | "unavailable";
type UiReviewPriorityFixStatus = "OPEN" | "NONE";
type UiReviewFindingStatus = "OPEN" | "BLOCKED" | "NONE";
type UiReviewFindingSeverity = "high" | "medium" | "low" | "none";
type SecurityDeclaredThreat = {
    threatId: string;
    sourcePlan: string;
    category: string;
    component: string;
    disposition: string;
    mitigation: string;
};
type SecuritySummaryThreatFlag = {
    flagId: string;
    sourceSummary: string;
    threatId: string | null;
    evidence: string;
};
type SecurityThreatRegisterRow = {
    threatId: string;
    status: SecurityThreatStatus;
    evidence: string;
    verifierNote: string;
};
type SecurityStructuredModel = {
    status: SecurityReviewStatus;
    readiness: SecurityReviewReadiness;
    completionState: SecurityReviewCompletionState;
    securitySummary: string[];
    evidenceCoverage: Record<string, {
        status: SecurityEvidenceCoverageStatus;
        rationale: string;
    }>;
    threatRegister: SecurityThreatRegisterRow[];
    acceptedRisks: Array<{
        threatId: string;
        rationale: string;
        acceptedBy: string;
        acceptedAt: string;
        evidence: string;
    }>;
    findings: Array<{
        kind: "open-threat" | "missing-control" | "unregistered-flag" | "suspicious-artifact" | "hardening-follow-up" | "none";
        severity: ReviewFindingSeverity | "none";
        threatId: string;
        evidence: string;
        recommendation: string;
        status: "open" | "follow-up" | "accepted" | "closed" | "none";
    }>;
    manualOrDeferredWork: Array<{
        item: string;
        reason: string;
        followUp: string;
        status: SecurityManualStatus;
    }>;
    gapRoutes: Array<{
        gap: string;
        evidence: string;
        repair: string;
        status: SecurityGapStatus;
    }>;
    followUps: string[];
    auditTrail: {
        auditDate: string;
        executionMode: "inline" | "security-auditor-assisted";
        overwriteGate: "none" | "confirmed" | "reused" | "not-needed";
        verifyOrAcceptDecision: "none" | "verified" | "accepted" | "pending";
        pendingOpenThreatStatus: "none" | "verifying" | "accepted" | "still-open";
        verifierNote: string;
    };
    nextSafeAction: string;
};
type SecurityAuthoringContext = {
    phase: ReviewScopePhase;
    path: string;
    completedSummaries: string[];
    pendingPlans: string[];
    declaredThreats: SecurityDeclaredThreat[];
    summaryThreatFlags: SecuritySummaryThreatFlag[];
    knownEvidenceArtifacts: string[];
    existingSecurity: string | null;
    allowedNextActions: string[];
    completedNextSafeAction: string;
    partialNextSafeAction: string;
    blockedNextSafeAction: string;
    schemaPath: string;
    baseSchema: Record<string, unknown>;
    taskSchema: Record<string, unknown>;
};
type UiReviewStructuredModel = {
    verdict: UiReviewVerdict;
    readiness: UiReviewReadiness;
    completionState: UiReviewCompletionState;
    uiReviewSummary: string[];
    overallScore: number;
    evidenceCoverage: Record<string, {
        status: UiReviewEvidenceCoverageStatus;
        rationale: string;
    }>;
    pillarScores: Array<{
        pillar: UiReviewPillar;
        score: number;
        evidence: string;
        keyFinding: string;
    }>;
    priorityFixes: Array<{
        item: string;
        userImpact: string;
        repair: string;
        status: UiReviewPriorityFixStatus;
    }>;
    findings: Array<{
        pillar: UiReviewPillar | "none";
        severity: UiReviewFindingSeverity;
        evidence: string;
        userImpact: string;
        recommendation: string;
        status: UiReviewFindingStatus;
    }>;
    followUps: string[];
    auditTrail: {
        auditDate: string;
        executionMode: "inline" | "ui-auditor-assisted";
        existingReviewPosture: "none" | "reused" | "overwrite-confirmed";
        visualEvidence: "captured" | "supplied" | "not-supplied";
        auditorPath: "blueprint-ui-auditor" | "no-subagent-fallback";
        scoreConsistencyNote: string;
        confidenceLimitations: string;
    };
    nextSafeAction: string;
};
type UiReviewAuthoringContext = {
    phase: ReviewScopePhase;
    path: string;
    completedPlans: Array<{
        planId: string;
        path: string;
    }>;
    completedSummaries: string[];
    dependencyPlans: Array<{
        planId: string;
        path: string;
    }>;
    pendingPlans: string[];
    lowerWavePendingPlanIds: string[];
    verification: string | null;
    uat: string | null;
    knownEvidenceArtifacts: string[];
    existingUiReview: string | null;
    optionalEvidenceArtifacts: string[];
    allowedExistingReviewPostures: UiReviewStructuredModel["auditTrail"]["existingReviewPosture"][];
    completedNextSafeAction: string;
    followUpNextSafeAction: string;
    blockedNextSafeAction: string;
    allowedNextActions: string[];
    schemaPath: string;
    baseSchema: Record<string, unknown>;
    taskSchema: Record<string, unknown>;
};
type ReviewDiagnosticSource = "scope" | "schema" | "residual" | "markdown";
type ReviewModelDiagnostic = {
    source: ReviewDiagnosticSource;
    path: string;
    code: string;
    message: string;
    context: Record<string, unknown>;
    suggestion: string;
    received?: unknown;
    expected?: unknown;
    allowedValues?: unknown[];
    missing?: string[];
    repair?: string;
    retryable?: boolean;
    argsPatch?: Record<string, unknown>;
};
type ReviewModelRepairSummary = {
    topBlockers: string[];
    fieldsToChange: string[];
    firstPassActions: string[];
    action: "none" | "reread_authoring_context" | "retry_validation" | "stop";
    retryable: boolean;
    retryInstruction: string;
};
type ReviewValidateModelArgs = {
    cwd?: string;
    phase?: NumericInput;
    artifact?: "code-review" | "peer-review" | "review-fix" | "security" | "ui-review";
    files?: string[];
    scopeSource?: ReviewModeSource;
    depth?: ReviewDepth;
    targetIds?: string[];
    model: unknown;
};
type ReviewValidateModelResult = {
    status: "valid" | "invalid";
    valid: boolean;
    phase: ReviewScopeResult["phase"];
    files: string[];
    reviewMode: ReviewScopeResult["reviewMode"];
    schemaPath: string | null;
    taskSchema: Record<string, unknown> | null;
    diagnostics: ReviewModelDiagnostic[];
    diagnosticCounts: {
        total: number;
        bySource: Record<ReviewDiagnosticSource, number>;
        byCode: Record<string, number>;
    };
    repairSummary: ReviewModelRepairSummary;
    normalizedModel: CodeReviewStructuredModel | PeerReviewStructuredModel | ReviewFixStructuredModel | SecurityStructuredModel | UiReviewStructuredModel | null;
    renderPreview: string | null;
    warnings: string[];
};
type PublicReviewValidateModelResult = Omit<ReviewValidateModelResult, "taskSchema" | "normalizedModel" | "renderPreview">;
type PublicReviewRecordResult = Omit<ReviewRecordResult, "taskSchema"> & {
    taskSchema?: ReviewRecordResult["taskSchema"];
};
type ReviewAuthoringContextArgs = {
    cwd?: string;
    phase?: NumericInput;
    artifact: "code-review" | "peer-review" | "review-fix" | "security" | "ui-review";
    files?: string[];
    depth?: ReviewDepth;
    targetIds?: string[];
};
type ReviewAuthoringContextResult = {
    status: "ready" | "invalid";
    artifact: "code-review" | "peer-review" | "review-fix" | "security" | "ui-review";
    phase: ReviewScopePhase | null;
    files: string[];
    reviewMode: ReviewScopeResult["reviewMode"] | null;
    schemaPath: string | null;
    baseSchema: Record<string, unknown> | null;
    taskSchema: Record<string, unknown> | null;
    modelOnly: boolean;
    authoringContext: CodeReviewAuthoringContext | PeerReviewAuthoringContext | ReviewFixAuthoringContext | SecurityAuthoringContext | UiReviewAuthoringContext | null;
    prerequisiteBlockers: string[];
    reason: string | null;
    warnings: string[];
};
export declare function blueprintReviewScope(args: ReviewScopeArgs): Promise<ReviewScopeResult>;
export declare function blueprintReviewAuthoringContext(args: ReviewAuthoringContextArgs): Promise<ReviewAuthoringContextResult>;
export declare function blueprintReviewValidateModel(args: ReviewValidateModelArgs): Promise<ReviewValidateModelResult>;
export declare function blueprintReviewRecord(args: ReviewRecordArgs): Promise<ReviewRecordResult>;
export declare function blueprintReviewLoadFindings(args: ReviewLoadFindingsArgs): Promise<ReviewLoadFindingsResult>;
export declare const reviewToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        files: z.ZodOptional<z.ZodArray<z.ZodString>>;
        depth: z.ZodOptional<z.ZodEnum<{
            quick: "quick";
            standard: "standard";
            deep: "deep";
        }>>;
        includeAuthoringContext: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<ReviewScopeResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodOptional<z.ZodEnum<{
            "code-review": "code-review";
            "ui-review": "ui-review";
            "peer-review": "peer-review";
            "review-fix": "review-fix";
            security: "security";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ReviewLoadFindingsResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodOptional<z.ZodEnum<{
            "code-review": "code-review";
            "ui-review": "ui-review";
            "peer-review": "peer-review";
            "review-fix": "review-fix";
            security: "security";
        }>>;
        files: z.ZodOptional<z.ZodArray<z.ZodString>>;
        scopeSource: z.ZodOptional<z.ZodEnum<{
            "explicit-files": "explicit-files";
            "phase-plans": "phase-plans";
            "phase-summaries": "phase-summaries";
            "phase-evidence": "phase-evidence";
        }>>;
        depth: z.ZodOptional<z.ZodEnum<{
            quick: "quick";
            standard: "standard";
            deep: "deep";
        }>>;
        targetIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        model: z.ZodUnknown;
    };
    handler: (args: Record<string, unknown>) => Promise<PublicReviewValidateModelResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodEnum<{
            "code-review": "code-review";
            "ui-review": "ui-review";
            "peer-review": "peer-review";
            "review-fix": "review-fix";
            security: "security";
        }>;
        files: z.ZodOptional<z.ZodArray<z.ZodString>>;
        depth: z.ZodOptional<z.ZodEnum<{
            quick: "quick";
            standard: "standard";
            deep: "deep";
        }>>;
        targetIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ReviewAuthoringContextResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodEnum<{
            "code-review": "code-review";
            "ui-review": "ui-review";
            "peer-review": "peer-review";
            "review-fix": "review-fix";
            security: "security";
        }>;
        content: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodUnknown>;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        scopeFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        scopeSource: z.ZodOptional<z.ZodEnum<{
            "explicit-files": "explicit-files";
            "phase-plans": "phase-plans";
            "phase-summaries": "phase-summaries";
            "phase-evidence": "phase-evidence";
        }>>;
        depth: z.ZodOptional<z.ZodEnum<{
            quick: "quick";
            standard: "standard";
            deep: "deep";
        }>>;
        targetIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PublicReviewRecordResult>;
})[];
export {};
