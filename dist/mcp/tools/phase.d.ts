import * as z from "zod/v4";
import { type ArtifactContractReadResult } from "../artifact-contracts/index.js";
type RoadmapReadArgs = {
    cwd?: string;
};
type NumericInput = string | number;
type AuditBackedGapCategory = "requirement" | "integration" | "flow" | "optional";
type AuditBackedGapRow = {
    gapId: string;
    surface: string;
    evidence: string;
    repair: string;
};
type AuditBackedGapGroup = {
    category: AuditBackedGapCategory;
    rows: AuditBackedGapRow[];
};
type RoadmapAuditBackedDetails = {
    sourceReportPath?: string;
    goal?: string;
    successCriteria?: string;
    repairRequirementIds?: string[];
    gapGroups?: AuditBackedGapGroup[];
};
type RoadmapAddPhaseArgs = {
    cwd?: string;
    description: string;
    expectedPhaseNumber?: string;
    auditBackedDetails?: RoadmapAuditBackedDetails;
};
type RoadmapInsertPhaseArgs = {
    cwd?: string;
    after: NumericInput;
    description: string;
};
type RoadmapRemovePhaseArgs = {
    cwd?: string;
    phase: NumericInput;
    force?: boolean;
};
type RoadmapPromoteBacklogArgs = {
    cwd?: string;
    backlogIds?: string[];
    previewOnly?: boolean;
};
type PhaseLookupArgs = {
    cwd?: string;
    phase?: NumericInput;
};
type PhaseArtifactKind = "context" | "discussion-log" | "research" | "ui-spec";
type PhaseValidationArtifactKind = "verification" | "uat";
type PlanIndexArgs = PhaseLookupArgs;
type PhaseArtifactReadArgs = PhaseLookupArgs & {
    artifact: PhaseArtifactKind;
};
type PhaseArtifactWriteArgs = PhaseLookupArgs & {
    artifact: PhaseArtifactKind;
    content: string;
    overwrite?: boolean;
    validationMode?: "strict" | "warn";
};
type PhaseValidationReadArgs = PhaseLookupArgs & {
    artifact: PhaseValidationArtifactKind;
};
type PhaseValidationWriteArgs = PhaseLookupArgs & {
    artifact: PhaseValidationArtifactKind;
    content: string;
    overwrite?: boolean;
};
type PhaseValidationAuthoringContextArgs = PhaseLookupArgs & {
    artifact: PhaseValidationArtifactKind;
};
type PhaseValidationSummaryEvidence = {
    planId: string;
    path: string;
    linkedPlanPath: string | null;
    status: "COMPLETED";
    title: string | null;
    summary: string | null;
    outcome: string[];
    changesMade: string[];
    verification: string[];
    followUps: string[];
    evidence: string[];
};
type PhaseValidationAllowedValues = {
    verification: {
        gateStates: string[];
        coverageStates: string[];
        manualCoverageStatuses: string[];
        gapClasses: string[];
        readinessByGate: Record<string, string>;
        readyForUatCommand: string;
        repairCommands: string[];
    };
    uat: {
        statuses: string[];
        resumeStates: string[];
        completeCheckpoint: string;
        testResults: string[];
        structuredGapStatuses: string[];
        structuredGapSeverities: string[];
    };
};
type PhaseValidationAuthoringContextResult = {
    phaseFound: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    artifact: PhaseValidationArtifactKind;
    path: string | null;
    contract: ArtifactContractReadResult;
    summaryPaths: string[];
    summaryEvidence: PhaseValidationSummaryEvidence[];
    existing: PhaseValidationReadResult | null;
    verification: PhaseValidationReadResult | null;
    prerequisiteBlockers: string[];
    readyForDraft: boolean;
    allowedValues: PhaseValidationAllowedValues;
    routingRules: string[];
    warnings: string[];
    reason: string | null;
};
type VerificationRenderCoverageRow = {
    requirement?: string;
    taskOrCheck?: string;
    evidence?: string;
    coverageState?: string;
    notes?: string;
};
type VerificationManualCoverageRow = {
    item?: string;
    whyManualOrDeferred?: string;
    followUp?: string;
    status?: string;
};
type VerificationGapClassificationRow = {
    gapClass?: string;
    scope?: string;
    evidence?: string;
    repair?: string;
};
type VerificationRenderArgs = PhaseLookupArgs & {
    artifact: "verification";
    coverageSummary?: string;
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
    nextSafeAction?: string;
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
type UatRenderArgs = PhaseLookupArgs & {
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
type PhaseValidationRenderArgs = VerificationRenderArgs | UatRenderArgs;
type PhaseValidationRenderResult = {
    phaseFound: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    artifact: PhaseValidationArtifactKind;
    path: string | null;
    content: string;
    validation: {
        valid: boolean;
        issues: string[];
        warnings: string[];
    };
    summaryPaths: string[];
    referencedSummaryPaths: string[];
    prerequisiteBlockers: string[];
    readyToWrite: boolean;
    issues: string[];
    warnings: string[];
};
type PhaseCheckpointRecord = Record<string, unknown>;
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
type PhaseCheckpointOwnerCommand = "/blu-discuss-phase" | "/blu-research-phase";
type PhaseCheckpointResumeMode = "discuss" | "research";
type PhaseCheckpointResumeMetaRecord = {
    mode: PhaseCheckpointResumeMode;
    pendingTopics: string[];
    completedTopics: string[];
    currentQuestion?: string;
    notes: string[];
    resumeHint?: string;
    updatedAt: string;
};
type PhaseCheckpointWriteRecord = PhaseCheckpointRecord & {
    ownerCommand: PhaseCheckpointOwnerCommand;
    completedAreas: string[];
    remainingAreas: string[];
    decisions: PhaseCheckpointDecisionRecord[];
    deferredIdeas: PhaseCheckpointDeferredIdeaRecord[];
    canonicalReferences: PhaseCheckpointReferenceRecord[];
    resumeMeta: PhaseCheckpointResumeMetaRecord;
};
type PhaseCheckpointGetArgs = PhaseLookupArgs & {
    expectedOwnerCommand?: PhaseCheckpointOwnerCommand;
    expectedMode?: PhaseCheckpointResumeMode;
};
type PhaseCheckpointPutArgs = PhaseLookupArgs & {
    checkpoint: PhaseCheckpointWriteRecord;
};
type PhaseCheckpointDeleteArgs = PhaseLookupArgs & {
    expectedOwnerCommand?: PhaseCheckpointOwnerCommand;
    expectedMode?: PhaseCheckpointResumeMode;
};
type PhasePlanReadArgs = PhaseLookupArgs & {
    planId: NumericInput;
};
type PhasePlanValidateArgs = PhaseLookupArgs;
type PhaseExecutionTargetsArgs = PhaseLookupArgs & {
    wave?: number;
    gapsOnly?: boolean;
    includeConflicts?: boolean;
};
type PhasePlanWriteArgs = PhaseLookupArgs & {
    planId?: NumericInput;
    content: string;
    overwrite?: boolean;
    validationMode?: "strict" | "warn";
};
type PhaseSummaryReadArgs = PhaseLookupArgs & {
    planId: NumericInput;
};
type PhaseSummaryWriteArgs = PhaseLookupArgs & {
    planId: NumericInput;
    content: string;
    overwrite?: boolean;
};
type RoadmapAddPhaseResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    slug: string;
    phaseDir: string;
    roadmapPath: string;
    milestone: string | null;
    written: boolean;
    warnings: string[];
};
type RoadmapInsertPhaseResult = {
    afterPhaseNumber: string;
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    slug: string;
    phaseDir: string;
    roadmapPath: string;
    milestone: string | null;
    written: boolean;
    warnings: string[];
};
type RoadmapRemovePhaseResult = {
    removedPhase: {
        phaseNumber: string;
        phasePrefix: string;
        phaseName: string;
        phaseDir: string;
        removedArtifacts: string[];
    };
    renumberedPhases: Array<{
        previousPhaseNumber: string;
        newPhaseNumber: string;
        previousPhasePrefix: string;
        newPhasePrefix: string;
        phaseName: string;
        previousPhaseDir: string;
        newPhaseDir: string;
        renamedArtifacts: Array<{
            from: string;
            to: string;
        }>;
    }>;
    roadmapPath: string;
    milestone: string | null;
    written: boolean;
    warnings: string[];
};
type RoadmapPromotionPreviewItem = {
    backlogId: string;
    description: string;
    status: string | null;
    reservedPhase: string | null;
};
type RoadmapPromoteBacklogResult = {
    status: "preview" | "updated" | "project_missing" | "invalid";
    backlogPath: string;
    roadmapPath: string;
    backlogItems: RoadmapPromotionPreviewItem[];
    selectedBacklogIds: string[];
    promotedItems: Array<{
        backlogId: string;
        phaseNumber: string;
        phasePrefix: string;
        phaseName: string;
        reservedPhase: string | null;
        phaseDir: string;
        createdPhaseDir: boolean;
        reusedReservedPhaseDir: boolean;
    }>;
    createdPhaseDirs: string[];
    warnings: string[];
};
type PhaseLocateResult = {
    found: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    artifacts: string[];
    milestone: string | null;
    resolvedFrom: "explicit" | "state" | "roadmap";
    reason: string | null;
    recovery: string[];
    warnings: string[];
};
type ResearchExternalSourcesMode = "off" | "ask" | "auto";
type PhaseContextResult = {
    phase: {
        phaseNumber: string;
        phasePrefix: string;
        phaseName: string;
        phaseDir: string;
        roadmap: {
            completed: boolean;
            summary: string | null;
            goal: string | null;
            successCriteria: string | null;
        };
        artifacts: {
            all: string[];
            context: string | null;
            discussionLog: string | null;
            research: string | null;
            uiSpec: string | null;
            verification: string | null;
            uat: string | null;
            plans: string[];
            summaries: string[];
        };
    } | null;
    projectBrief: {
        found: boolean;
        path: string | null;
        title: string | null;
        summary: string;
        vision: string[];
        audience: string[];
        constraints: string[];
        currentMilestone: string | null;
        nonGoals: string[];
        warnings: string[];
    };
    requirementsGrounding: {
        found: boolean;
        path: string | null;
        canonicalRequirementIds: string[];
        roadmapRequirementIds: string[];
        traceabilityNotes: string[];
        acceptanceNotes: string[];
        deferredItems: string[];
        summary: string;
        warnings: string[];
    };
    workflowPosture: {
        path: string | null;
        projectStatus: string | null;
        currentMilestone: string | null;
        currentPhase: string | null;
        activeCommand: string | null;
        nextAction: string | null;
        blockers: string[];
        workflow: {
            research: boolean;
            planCheck: boolean;
            verifier: boolean;
            nyquistValidation: boolean;
            uiPhase: boolean;
            uiSafetyGate: boolean;
            codeReview: boolean;
            autoAdvance: boolean;
            researchBeforeQuestions: boolean;
            discussMode: string;
            skipDiscuss: boolean;
            useWorktrees: boolean;
        };
        research: {
            externalSources: ResearchExternalSourcesMode;
        };
        summary: string;
        warnings: string[];
    };
    codebase: {
        mapped: boolean;
        artifacts: string[];
        missingArtifacts: string[];
        digest: Array<{
            artifact: string;
            title: string;
            summary: string;
        }>;
        warnings: string[];
    };
    requirements: string[];
    missingArtifacts: string[];
    warnings: string[];
};
type PhaseResearchStatusResult = {
    hasContext: boolean;
    hasResearch: boolean;
    hasUiSpec: boolean;
    hasUsableContext: boolean;
    hasUsableResearch: boolean;
    hasUsableUiSpec: boolean;
    contextPath: string | null;
    researchPath: string | null;
    uiSpecPath: string | null;
    contextValid: boolean | null;
    contextIssues: string[];
    researchValid: boolean | null;
    researchIssues: string[];
    uiSpecValid: boolean | null;
    uiSpecIssues: string[];
    suggestedRepairs: string[];
    planningReadiness: PhasePlanningReadiness;
    warnings: string[];
};
type PhasePlanningReadiness = {
    workflowResearchRequired: boolean;
    workflowUiPhaseRequired: boolean;
    workflowUiSafetyGateEnabled: boolean;
    readyForPlanPhase: boolean;
    nextSafeAction: string;
    blockers: string[];
};
type PhaseArtifactReadResult = {
    phaseFound: boolean;
    found: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    artifact: PhaseArtifactKind;
    path: string | null;
    content: string | null;
    reason: string | null;
};
type PhaseArtifactWriteResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    artifact: PhaseArtifactKind;
    path: string;
    written: boolean;
    created: boolean;
    overwritten: boolean;
    status: "created" | "updated" | "reused" | "invalid";
    validation: {
        valid: boolean;
        issues: string[];
        warnings: string[];
        suggestedRepairs: string[];
    } | null;
    warnings: string[];
};
type PhaseValidationReadResult = {
    phaseFound: boolean;
    found: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    artifact: PhaseValidationArtifactKind;
    path: string | null;
    content: string | null;
    validation: {
        valid: boolean;
        issues: string[];
        warnings: string[];
    } | null;
    verificationReadyForUat: boolean;
    uatStatus: "PASS" | "FAIL" | "PARTIAL" | null;
    resumeState: "RESUMED" | "NEW" | "CONTINUED" | null;
    checkpoint: string | null;
    complete: boolean;
    summaryPaths: string[];
    reason: string | null;
};
type PhaseValidationWriteResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    artifact: PhaseValidationArtifactKind;
    path: string;
    summaryPaths: string[];
    written: boolean;
    created: boolean;
    overwritten: boolean;
    status: "created" | "updated" | "reused" | "invalid";
    issues: string[];
    warnings: string[];
};
type PhaseCheckpointGetResult = {
    phaseFound: boolean;
    found: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    path: string | null;
    checkpoint: Record<string, unknown> | null;
    ownerCommand: string | null;
    resumeMode: string | null;
    safeToResume: boolean;
    warnings: string[];
    reason: string | null;
};
type PhaseCheckpointPutResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    path: string;
    updated: boolean;
    warnings: string[];
};
type PhaseCheckpointDeleteResult = {
    phaseFound: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    path: string | null;
    deleted: boolean;
    reason: string | null;
};
type PhasePlanRecord = {
    planId: string;
    path: string;
    title: string | null;
    wave: number | null;
    gapClosure: boolean;
    status: string | null;
    objective: string | null;
    dependsOn: string[];
    requirements: string[];
    filesModified: string[];
    readFirst: string[];
    acceptanceCriteria: string[];
    autonomous: boolean | null;
    valid: boolean;
    issues: string[];
    warnings: string[];
};
type PhasePlanIndexResult = {
    phaseFound: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    plans: PhasePlanRecord[];
    waves: Record<string, string[]>;
    missingPlans: string[];
    gapClosurePlans: string[];
    warnings: string[];
};
type PhasePlanReadResult = {
    phaseFound: boolean;
    found: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    planId: string | null;
    path: string | null;
    content: string | null;
    metadata: Omit<PhasePlanRecord, "path" | "valid" | "issues" | "warnings" | "planId"> | null;
    validation: {
        valid: boolean;
        issues: string[];
        warnings: string[];
    } | null;
    reason: string | null;
};
type PhasePlanValidationResult = {
    phaseFound: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    status: "valid" | "invalid";
    issues: string[];
    warnings: string[];
    planCount: number;
    planIds: string[];
    roadmapRequirementIds: string[];
    coveredRequirementIds: string[];
    uncoveredRequirementIds: string[];
    unexpectedRequirementIds: string[];
    missingDependencyIds: string[];
    cyclicDependencyPlanIds: string[][];
};
type PhasePlanWriteResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    planId: string;
    path: string;
    written: boolean;
    created: boolean;
    overwritten: boolean;
    status: "created" | "updated" | "reused" | "invalid";
    validation: {
        valid: boolean;
        issues: string[];
        warnings: string[];
    };
    warnings: string[];
};
type PhaseSummaryRecord = {
    planId: string;
    path: string;
    linkedPlanPath: string | null;
    status: "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
    title: string | null;
    summary: string | null;
};
type PhaseSummaryIndexResult = {
    phaseFound: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    summaries: PhaseSummaryRecord[];
    completedPlans: string[];
    pendingPlans: string[];
    warnings: string[];
};
type PhaseSummaryReadResult = {
    phaseFound: boolean;
    found: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    planId: string | null;
    path: string | null;
    content: string | null;
    metadata: Omit<PhaseSummaryRecord, "path" | "planId"> | null;
    validation: {
        valid: boolean;
        issues: string[];
        warnings: string[];
    } | null;
    reason: string | null;
};
type PhaseSummaryWriteResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    planId: string;
    path: string;
    linkedPlanPath: string;
    written: boolean;
    created: boolean;
    overwritten: boolean;
    status: "created" | "updated" | "reused" | "invalid";
    issues: string[];
    warnings: string[];
};
type PhaseExecutionTargetSummary = {
    found: boolean;
    path: string;
    linkedPlanPath: string | null;
    status: "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
    valid: boolean | null;
    issues: string[];
    warnings: string[];
    overwriteCandidate: boolean;
};
type PhaseExecutionTargetPlan = PhasePlanRecord & {
    missingDependencyPlans: string[];
    summary: PhaseExecutionTargetSummary;
};
type PhaseExecutionTargetConflictSurface = {
    value: string;
    kinds: Array<"files_modified" | "read_first" | "generated_artifact" | "other">;
};
type PhaseExecutionTargetConflictGroup = {
    planIds: string[];
    planPaths: string[];
    selectedPlanIds: string[];
    sharedSurfaces: PhaseExecutionTargetConflictSurface[];
    existingSummaryPaths: string[];
    warnings: string[];
};
type PhaseExecutionTargetsResult = {
    phaseFound: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    requestedWave: number | null;
    gapsOnly: boolean;
    includeConflicts: boolean;
    pendingPlanIds: string[];
    gapClosurePlans: string[];
    candidatePlanIds: string[];
    candidatePlanPaths: string[];
    selectedPlanIds: string[];
    selectedPlanPaths: string[];
    selectedWave: number | null;
    lowerWavePendingPlans: Array<{
        planId: string;
        path: string;
        wave: number | null;
    }>;
    overwriteCandidatePlanIds: string[];
    overlapPlanIds: string[];
    candidatePlans: PhaseExecutionTargetPlan[];
    selectedPlans: PhaseExecutionTargetPlan[];
    overlapPlans: PhaseExecutionTargetPlan[];
    existingSummaries: Array<{
        planId: string;
        path: string;
        linkedPlanPath: string | null;
        status: "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
        valid: boolean | null;
        issues: string[];
        warnings: string[];
        overwriteCandidate: boolean;
    }>;
    blockers: {
        executionBlocked: boolean;
        reasons: string[];
        invalidPlanIds: string[];
        stalePlanIds: string[];
        lowerWavePendingPlanIds: string[];
        missingPlanPaths: string[];
        planIndexWarnings: string[];
        summaryIndexWarnings: string[];
    };
    conflicts: {
        groups: PhaseExecutionTargetConflictGroup[];
        warnings: string[];
    } | null;
    warnings: string[];
};
type RoadmapReadResult = {
    roadmap: {
        path: string;
        phaseCount: number;
    };
    milestone: string | null;
    warnings: string[];
    recovery: string[];
    phases: Array<{
        phaseNumber: string;
        phasePrefix: string;
        phaseName: string;
        completed: boolean;
        summary: string | null;
        goal: string | null;
        successCriteria: string | null;
        requirements: string[];
        phaseDir: string | null;
    }>;
};
export declare function blueprintPhaseValidationAuthoringContext(args: PhaseValidationAuthoringContextArgs): Promise<PhaseValidationAuthoringContextResult>;
export declare function blueprintPhaseValidationRender(args: PhaseValidationRenderArgs): Promise<PhaseValidationRenderResult>;
export declare function blueprintRoadmapRead(args?: RoadmapReadArgs): Promise<RoadmapReadResult>;
export declare function blueprintRoadmapAddPhase(args: RoadmapAddPhaseArgs): Promise<RoadmapAddPhaseResult>;
export declare function blueprintRoadmapInsertPhase(args: RoadmapInsertPhaseArgs): Promise<RoadmapInsertPhaseResult>;
export declare function blueprintRoadmapRemovePhase(args: RoadmapRemovePhaseArgs): Promise<RoadmapRemovePhaseResult>;
export declare function blueprintRoadmapPromoteBacklog(args?: RoadmapPromoteBacklogArgs): Promise<RoadmapPromoteBacklogResult>;
export declare function blueprintPhaseLocate(args?: PhaseLookupArgs): Promise<PhaseLocateResult>;
export declare function blueprintPhaseContext(args?: PhaseLookupArgs): Promise<PhaseContextResult>;
export declare function blueprintPhaseResearchStatus(args?: PhaseLookupArgs): Promise<PhaseResearchStatusResult>;
export declare function blueprintPhaseArtifactRead(args: PhaseArtifactReadArgs): Promise<PhaseArtifactReadResult>;
export declare function blueprintPhaseArtifactWrite(args: PhaseArtifactWriteArgs): Promise<PhaseArtifactWriteResult>;
export declare function blueprintPhaseValidationRead(args: PhaseValidationReadArgs): Promise<PhaseValidationReadResult>;
export declare function blueprintPhaseValidationWrite(args: PhaseValidationWriteArgs): Promise<PhaseValidationWriteResult>;
export declare function blueprintPhasePlanIndex(args?: PlanIndexArgs): Promise<PhasePlanIndexResult>;
export declare function blueprintPhasePlanRead(args: PhasePlanReadArgs): Promise<PhasePlanReadResult>;
export declare function blueprintPhasePlanValidate(args?: PhasePlanValidateArgs): Promise<PhasePlanValidationResult>;
export declare function blueprintPhasePlanWrite(args: PhasePlanWriteArgs): Promise<PhasePlanWriteResult>;
export declare function blueprintPhaseSummaryIndex(args?: PlanIndexArgs): Promise<PhaseSummaryIndexResult>;
export declare function blueprintPhaseSummaryRead(args: PhaseSummaryReadArgs): Promise<PhaseSummaryReadResult>;
export declare function blueprintPhaseExecutionTargets(args?: PhaseExecutionTargetsArgs): Promise<PhaseExecutionTargetsResult>;
export declare function blueprintPhaseSummaryWrite(args: PhaseSummaryWriteArgs): Promise<PhaseSummaryWriteResult>;
export declare function blueprintPhaseCheckpointGet(args?: PhaseCheckpointGetArgs): Promise<PhaseCheckpointGetResult>;
export declare function blueprintPhaseCheckpointPut(args: PhaseCheckpointPutArgs): Promise<PhaseCheckpointPutResult>;
export declare function blueprintPhaseCheckpointDelete(args?: PhaseCheckpointDeleteArgs): Promise<PhaseCheckpointDeleteResult>;
export declare const phaseToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        description: z.ZodString;
        expectedPhaseNumber: z.ZodOptional<z.ZodString>;
        auditBackedDetails: z.ZodOptional<z.ZodObject<{
            sourceReportPath: z.ZodOptional<z.ZodString>;
            goal: z.ZodOptional<z.ZodString>;
            successCriteria: z.ZodOptional<z.ZodString>;
            repairRequirementIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
            gapGroups: z.ZodOptional<z.ZodArray<z.ZodObject<{
                category: z.ZodEnum<{
                    optional: "optional";
                    requirement: "requirement";
                    integration: "integration";
                    flow: "flow";
                }>;
                rows: z.ZodArray<z.ZodObject<{
                    gapId: z.ZodString;
                    surface: z.ZodString;
                    evidence: z.ZodString;
                    repair: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapAddPhaseResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        after: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        description: z.ZodString;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapInsertPhaseResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        force: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapRemovePhaseResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        backlogIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        previewOnly: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapPromoteBacklogResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseLocateResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseContextResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseResearchStatusResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanIndexResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        wave: z.ZodOptional<z.ZodNumber>;
        gapsOnly: z.ZodOptional<z.ZodBoolean>;
        includeConflicts: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseExecutionTargetsResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodEnum<{
            context: "context";
            "discussion-log": "discussion-log";
            research: "research";
            "ui-spec": "ui-spec";
        }>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseArtifactReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodEnum<{
            context: "context";
            "discussion-log": "discussion-log";
            research: "research";
            "ui-spec": "ui-spec";
        }>;
        content: z.ZodString;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        validationMode: z.ZodOptional<z.ZodEnum<{
            strict: "strict";
            warn: "warn";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseArtifactWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodEnum<{
            verification: "verification";
            uat: "uat";
        }>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseValidationReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodEnum<{
            verification: "verification";
            uat: "uat";
        }>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseValidationAuthoringContextResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodEnum<{
            verification: "verification";
            uat: "uat";
        }>;
        coverageSummary: z.ZodOptional<z.ZodString>;
        gateState: z.ZodOptional<z.ZodString>;
        signOff: z.ZodOptional<z.ZodString>;
        validationSummary: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        requirementCoverage: z.ZodOptional<z.ZodArray<z.ZodObject<{
            requirement: z.ZodOptional<z.ZodString>;
            taskOrCheck: z.ZodOptional<z.ZodString>;
            evidence: z.ZodOptional<z.ZodString>;
            coverageState: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        evidenceReviewedSummaryPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
        evidenceMetadata: z.ZodOptional<z.ZodArray<z.ZodString>>;
        manualOrDeferredCoverage: z.ZodOptional<z.ZodArray<z.ZodObject<{
            item: z.ZodOptional<z.ZodString>;
            whyManualOrDeferred: z.ZodOptional<z.ZodString>;
            followUp: z.ZodOptional<z.ZodString>;
            status: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        gapClassification: z.ZodOptional<z.ZodArray<z.ZodObject<{
            gapClass: z.ZodOptional<z.ZodString>;
            scope: z.ZodOptional<z.ZodString>;
            evidence: z.ZodOptional<z.ZodString>;
            repair: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        gapsFound: z.ZodOptional<z.ZodArray<z.ZodString>>;
        suggestedRepairs: z.ZodOptional<z.ZodArray<z.ZodString>>;
        nextSafeAction: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodString>;
        resumeState: z.ZodOptional<z.ZodString>;
        checkpoint: z.ZodOptional<z.ZodString>;
        uatSummary: z.ZodOptional<z.ZodArray<z.ZodString>>;
        sessionState: z.ZodOptional<z.ZodArray<z.ZodString>>;
        currentTest: z.ZodOptional<z.ZodObject<{
            number: z.ZodOptional<z.ZodString>;
            name: z.ZodOptional<z.ZodString>;
            expected: z.ZodOptional<z.ZodString>;
            awaiting: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        testMatrix: z.ZodOptional<z.ZodArray<z.ZodObject<{
            number: z.ZodOptional<z.ZodString>;
            test: z.ZodOptional<z.ZodString>;
            expectedBehavior: z.ZodOptional<z.ZodString>;
            evidence: z.ZodOptional<z.ZodString>;
            result: z.ZodOptional<z.ZodString>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        resultSummary: z.ZodOptional<z.ZodObject<{
            total: z.ZodOptional<z.ZodNumber>;
            passed: z.ZodOptional<z.ZodNumber>;
            issues: z.ZodOptional<z.ZodNumber>;
            pending: z.ZodOptional<z.ZodNumber>;
            skipped: z.ZodOptional<z.ZodNumber>;
            blocked: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        questionsAsked: z.ZodOptional<z.ZodArray<z.ZodString>>;
        observedBehavior: z.ZodOptional<z.ZodArray<z.ZodString>>;
        unresolvedGaps: z.ZodOptional<z.ZodArray<z.ZodString>>;
        structuredGaps: z.ZodOptional<z.ZodArray<z.ZodObject<{
            test: z.ZodOptional<z.ZodString>;
            truth: z.ZodOptional<z.ZodString>;
            status: z.ZodOptional<z.ZodString>;
            severity: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            followUp: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        followUpFixes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseValidationRenderResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        artifact: z.ZodEnum<{
            verification: "verification";
            uat: "uat";
        }>;
        content: z.ZodString;
        overwrite: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseValidationWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        planId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanValidationResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        planId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        content: z.ZodString;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        validationMode: z.ZodOptional<z.ZodEnum<{
            strict: "strict";
            warn: "warn";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseSummaryIndexResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        planId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseSummaryReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        planId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        content: z.ZodString;
        overwrite: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseSummaryWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        expectedOwnerCommand: z.ZodOptional<z.ZodEnum<{
            "/blu-discuss-phase": "/blu-discuss-phase";
            "/blu-research-phase": "/blu-research-phase";
        }>>;
        expectedMode: z.ZodOptional<z.ZodEnum<{
            research: "research";
            discuss: "discuss";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseCheckpointGetResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        checkpoint: z.ZodObject<{
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
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseCheckpointPutResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        expectedOwnerCommand: z.ZodOptional<z.ZodEnum<{
            "/blu-discuss-phase": "/blu-discuss-phase";
            "/blu-research-phase": "/blu-research-phase";
        }>>;
        expectedMode: z.ZodOptional<z.ZodEnum<{
            research: "research";
            discuss: "discuss";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseCheckpointDeleteResult>;
})[];
export {};
