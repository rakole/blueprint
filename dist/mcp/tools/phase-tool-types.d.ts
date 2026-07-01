import type { ArtifactContractReadResult } from "../artifact-contracts/index.js";
import type { PhaseArtifactValidationDiagnostic, validatePlanArtifactContent } from "./artifacts.js";
import type { blueprintConfigGet } from "./config.js";
import type { PhaseCheckpointOwnerCommand, PhaseCheckpointResumeMode, PhaseCheckpointWriteRecord } from "./phase-checkpoint-records.js";
import type { PhaseExecutionTargetConflictSurface } from "./phase-execution-surfaces.js";
import type { ParsedRoadmap, PhaseArtifactKind, PhaseValidationArtifactKind } from "./phase-locations.js";
import type { NumericInput } from "./phase-numbering.js";
import type { PhasePlanDiagnosticCounts, PhasePlanModelDiagnostic, PhasePlanRepairSummary } from "./phase-plan-diagnostics.js";
import type { PhasePlanExternalServicePrerequisite, PhasePlanStructuredModel } from "./phase-plan-rendering.js";
import type { ParsedRoadmapPhase } from "./phase-roadmap-parser.js";
import type { PhaseSummaryDiagnosticCounts, PhaseSummaryModelDiagnostic } from "./phase-summary-diagnostics.js";
import type { PhaseSummaryStructuredModel } from "./phase-summary-rendering.js";
import type { PhaseUatStructuredModel, PhaseVerificationStructuredModel } from "./phase-validation-rendering.js";
import type { PhaseValidationAllowedValues } from "./phase-validation-contracts.js";
import type { PhaseValidationDiagnosticCounts, PhaseValidationModelDiagnostic } from "./phase-validation-diagnostics.js";
export type RoadmapReadArgs = {
    cwd?: string;
};
export type AuditBackedGapCategory = "requirement" | "integration" | "flow" | "optional";
export type AuditBackedGapRow = {
    gapId: string;
    surface: string;
    evidence: string;
    repair: string;
};
export type AuditBackedGapGroup = {
    category: AuditBackedGapCategory;
    rows: AuditBackedGapRow[];
};
export type RoadmapAuditBackedDetails = {
    sourceReportPath?: string;
    goal?: string;
    successCriteria?: string;
    repairRequirementIds?: string[];
    gapGroups?: AuditBackedGapGroup[];
};
export type RoadmapAddPhaseArgs = {
    cwd?: string;
    description: string;
    expectedPhaseNumber?: string;
    confirmed?: boolean;
    goal?: string;
    requirementIds?: string[];
    successCriteria?: string[];
    auditBackedDetails?: RoadmapAuditBackedDetails;
};
export type RoadmapInsertPhaseArgs = {
    cwd?: string;
    after: NumericInput;
    description: string;
    confirmed?: boolean;
    goal?: string;
    requirementIds?: string[];
    successCriteria?: string[];
};
export type RoadmapRemovePhaseArgs = {
    cwd?: string;
    phase: NumericInput;
    confirmed?: boolean;
    force?: boolean;
};
export type RoadmapPromoteBacklogArgs = {
    cwd?: string;
    backlogIds?: string[];
    previewOnly?: boolean;
};
export type PhaseLookupArgs = {
    cwd?: string;
    phase?: NumericInput;
};
export type PlanIndexArgs = PhaseLookupArgs;
export type PhaseArtifactReadArgs = PhaseLookupArgs & {
    artifact: PhaseArtifactKind;
};
export type PhaseArtifactScaffoldArgs = PhaseLookupArgs & {
    artifact: PhaseArtifactKind;
    overwrite?: boolean;
};
export type PhaseArtifactWriteArgs = PhaseLookupArgs & {
    artifact: PhaseArtifactKind;
    content?: string;
    model?: Record<string, unknown>;
    overwrite?: boolean;
    validationMode?: "strict" | "warn";
};
export type PhaseUiSkipWriteArgs = PhaseLookupArgs & {
    skipRationale: string;
    overwrite?: boolean;
};
export type PhaseValidationReadArgs = PhaseLookupArgs & {
    artifact: PhaseValidationArtifactKind;
};
export type PhaseValidationWriteArgs = PhaseLookupArgs & {
    artifact: PhaseValidationArtifactKind;
    content?: string;
    model?: Record<string, unknown>;
    authoringMode?: "content-compatible" | "model-only";
    overwrite?: boolean;
};
export type PhaseValidationAuthoringContextArgs = PhaseLookupArgs & {
    artifact: PhaseValidationArtifactKind;
};
export type PhaseValidationSummaryEvidence = {
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
export type PhaseValidationAuthoringContextResult = {
    status: "ready" | "invalid";
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
    schemaPath: string | null;
    baseSchema: Record<string, unknown> | null;
    taskSchema: Record<string, unknown> | null;
    allowedValues: PhaseValidationAllowedValues;
    routingRules: string[];
    warnings: string[];
    reason: string | null;
};
export type PhaseValidationValidateModelArgs = PhaseValidationAuthoringContextArgs & {
    model: unknown;
};
export type PhaseValidationValidateModelResult = {
    status: "valid" | "invalid";
    valid: boolean;
    phase: ResolvedPhaseLocation | null;
    artifact: PhaseValidationArtifactKind;
    path: string | null;
    schemaPath: string | null;
    taskSchema: Record<string, unknown> | null;
    diagnostics: PhaseValidationModelDiagnostic[];
    diagnosticCounts: PhaseValidationDiagnosticCounts;
    normalizedModel: PhaseVerificationStructuredModel | PhaseUatStructuredModel | null;
    renderPreview: string | null;
    warnings: string[];
};
export type PhaseValidationStandaloneValidateModelResult = Omit<PhaseValidationValidateModelResult, "taskSchema" | "normalizedModel" | "renderPreview">;
export type PhaseValidationRenderResult = {
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
export type PhaseCheckpointGetArgs = PhaseLookupArgs & {
    expectedOwnerCommand?: PhaseCheckpointOwnerCommand;
    expectedMode?: PhaseCheckpointResumeMode;
};
export type PhaseCheckpointPutArgs = PhaseLookupArgs & {
    checkpoint: PhaseCheckpointWriteRecord;
};
export type PhaseCheckpointDeleteArgs = PhaseLookupArgs & {
    expectedOwnerCommand?: PhaseCheckpointOwnerCommand;
    expectedMode?: PhaseCheckpointResumeMode;
};
export type PhasePlanReadArgs = PhaseLookupArgs & {
    planId: NumericInput;
};
export type PhasePlanValidateArgs = PhaseLookupArgs;
export type PhaseExecutionTargetsArgs = PhaseLookupArgs & {
    wave?: number;
    gapsOnly?: boolean;
    includeConflicts?: boolean;
    externalServiceConfirmed?: boolean;
};
export type PhasePlanWriteArgs = PhaseLookupArgs & {
    planId?: NumericInput;
    content?: string;
    model?: unknown;
    authoringMode?: "content-compatible" | "model-only";
    overwrite?: boolean;
    validationMode?: "strict" | "warn";
    returnPlanSetValidation?: boolean;
    returnNextAuthoringContext?: boolean;
    expectedReadSet?: Array<{
        path: string;
        kind: string;
        hash: string;
    }>;
};
export type PhasePlanAuthoringContextArgs = PhaseLookupArgs & {
    planId?: NumericInput;
};
export type PhasePlanReadinessArgs = PhaseLookupArgs & {
    planId?: NumericInput;
    readMode?: "full" | "hashes-only";
    bodyMode?: "summary" | "bounded";
    maxBodyBytes?: number;
    includeSavedPlanBodies?: "none" | "target";
    includeReviewFindings?: boolean;
    includeValidationEvidence?: boolean;
    previousReadSet?: Array<{
        path: string;
        kind: string;
        hash: string;
    }>;
};
export type PhasePlanValidateModelArgs = PhasePlanAuthoringContextArgs & {
    model: unknown;
};
export type PhaseSummaryReadArgs = PhaseLookupArgs & {
    planId: NumericInput;
};
export type PhaseSummaryWriteArgs = PhaseLookupArgs & {
    planId: NumericInput;
    content?: string;
    model?: unknown;
    authoringMode?: "content-compatible" | "model-only";
    overwrite?: boolean;
};
export type PhaseSummaryAuthoringContextArgs = PhaseLookupArgs & {
    planId: NumericInput;
};
export type PhaseSummaryValidateModelArgs = PhaseSummaryAuthoringContextArgs & {
    content?: string;
    model?: unknown;
};
export type ResolvedPhaseLocation = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
};
export type ResolvedPhaseRuntimeSnapshot = {
    projectRoot: string;
    roadmap: ParsedRoadmap | null;
    located: PhaseLocateResult;
    resolved: ResolvedPhaseLocation | null;
    matchedPhase: ParsedRoadmapPhase | null;
    artifacts: string[];
};
export type PhasePlanIndexBuildInput = {
    projectRoot: string;
    resolved: ResolvedPhaseLocation;
    artifacts: string[];
    warnings?: string[];
};
export type PhasePlanAuthoringContextBuildInput = {
    snapshot: ResolvedPhaseRuntimeSnapshot;
    planId?: NumericInput;
};
export type RoadmapAddPhaseRequirementValidationStatus = "declared" | "traceability-repaired";
export type RoadmapAddPhaseIdempotencyStatus = "created" | "reused-existing-phase";
export type RoadmapAddPhaseResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    slug: string;
    phaseDir: string;
    contextPath: string;
    roadmapPath: string;
    milestone: string | null;
    requirementValidationStatus: RoadmapAddPhaseRequirementValidationStatus;
    createdPhaseDir: boolean;
    idempotencyStatus: RoadmapAddPhaseIdempotencyStatus;
    written: boolean;
    warnings: string[];
};
export type RoadmapInsertPhaseRequirementMappingStatus = "updated" | "unchanged";
export type RoadmapInsertPhaseResult = {
    afterPhaseNumber: string;
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    slug: string;
    phaseDir: string;
    contextPath: string;
    roadmapPath: string;
    milestone: string | null;
    requirementMappingStatus: RoadmapInsertPhaseRequirementMappingStatus;
    createdPhaseDir: boolean;
    written: boolean;
    warnings: string[];
};
export type RoadmapRemovePhaseResult = {
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
export type RoadmapPromotionPreviewItem = {
    backlogId: string;
    description: string;
    status: string | null;
    reservedPhase: string | null;
};
export type RoadmapPromoteBacklogResult = {
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
export type PhaseLocateResult = {
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
export type PhaseSelectionResult = Pick<PhaseLocateResult, "found" | "phaseNumber" | "phasePrefix" | "phaseName" | "phaseDir" | "resolvedFrom" | "reason" | "recovery" | "warnings">;
export type ResearchExternalSourcesMode = "off" | "ask" | "auto";
export type PhaseContextResult = {
    phaseSelection: PhaseSelectionResult;
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
            spec: string | null;
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
            securePhase: boolean;
            securePhaseRequired: boolean;
            autoAdvance: boolean;
            researchBeforeQuestions: boolean;
            discussMode: string;
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
export type PhaseResearchStatusResult = {
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
    contextDiagnostics: PhaseArtifactValidationDiagnostic[];
    researchValid: boolean | null;
    researchIssues: string[];
    researchDiagnostics: PhaseArtifactValidationDiagnostic[];
    uiSpecValid: boolean | null;
    uiSpecIssues: string[];
    uiSpecDiagnostics: PhaseArtifactValidationDiagnostic[];
    suggestedRepairs: string[];
    planningReadiness: PhasePlanningReadiness;
    warnings: string[];
};
export type PhasePlanningReadiness = {
    workflowResearchRequired: boolean;
    workflowUiPhaseRequired: boolean;
    workflowUiSafetyGateEnabled: boolean;
    readyForPlanPhase: boolean;
    nextSafeAction: string;
    blockers: string[];
    diagnostics?: PhaseArtifactValidationDiagnostic[];
};
export type PhaseArtifactReadResult = {
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
export type PhaseArtifactWriteResult = {
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
        diagnostics?: PhaseArtifactValidationDiagnostic[];
        retryPlan?: PhaseArtifactRetryPlan | null;
    } | null;
    diagnostics?: PhaseArtifactValidationDiagnostic[];
    suggestedRepairs?: string[];
    retryPlan?: PhaseArtifactRetryPlan | null;
    warnings: string[];
};
export type PhaseArtifactScaffoldResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    artifact: PhaseArtifactKind;
    path: string;
    createdFiles: string[];
    reusedFiles: string[];
    warnings: string[];
};
export type PhaseArtifactRetryPlan = {
    retryable: boolean;
    nextTool: string;
    steps: string[];
};
export type PhaseValidationReadResult = {
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
export type PhaseValidationWriteResult = {
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
export type PhaseCheckpointGetResult = {
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
export type PhaseCheckpointPutResult = {
    phaseNumber: string;
    phasePrefix: string;
    phaseName: string;
    phaseDir: string;
    path: string;
    updated: boolean;
    warnings: string[];
};
export type PhaseCheckpointDeleteResult = {
    phaseFound: boolean;
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    path: string | null;
    deleted: boolean;
    reason: string | null;
};
export type PhasePlanRecord = {
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
    externalServicePrerequisites: PhasePlanExternalServicePrerequisite[];
    autonomous: boolean | null;
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export type PhasePlanIndexResult = {
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
export type PhasePlanReadResult = {
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
export type PhasePlanValidationResult = {
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
export type PhasePlanSetValidationSummary = {
    status: "valid" | "invalid";
    issueCount: number;
    warningCount: number;
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
export type PhasePlanWriteResult = {
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
    modelValidation?: PhasePlanWriteModelValidationResult | null;
    planSetValidationSummary?: PhasePlanSetValidationSummary | null;
    completionReady?: boolean;
    incrementalCheckpoint?: boolean;
    freshness?: {
        checked: boolean;
        fresh: boolean;
        stalePaths: string[];
    };
    nextAuthoringContext?: PhasePlanAuthoringContextResult | null;
    warnings: string[];
};
export type PhasePlanAuthoringContextResult = {
    status: "ready" | "invalid";
    phase: ResolvedPhaseLocation | null;
    planId: string | null;
    path: string | null;
    schemaPath: string | null;
    baseSchema: Record<string, unknown> | null;
    taskSchema: Record<string, unknown> | null;
    knownRequirements: string[];
    knownEvidenceArtifacts: string[];
    allowedDependencyPlanIds: string[];
    planningReadiness: PhasePlanningReadiness;
    modelOnly: boolean;
    reason: string | null;
    warnings: string[];
};
export type PhasePlanReadSetEntry = {
    path: string;
    kind: string;
    hash: string;
    sizeBytes: number;
    truncated: boolean;
    included: boolean;
    reason?: string;
};
export type PhasePlanReadinessBody = {
    path: string | null;
    content?: string;
    summary: string | null;
    hash: string | null;
    sizeBytes: number;
    truncated: boolean;
    omittedReason?: string;
    warnings: string[];
};
export type PhasePlanReadinessResult = {
    status: "ready" | "blocked" | "invalid";
    phaseSelection: PhaseSelectionResult;
    context: PhaseContextResult | null;
    researchStatus: PhaseResearchStatusResult | null;
    planIndex: PhasePlanIndexResult | null;
    authoringContext: PhasePlanAuthoringContextResult;
    effectiveConfig: Awaited<ReturnType<typeof blueprintConfigGet>>["config"];
    stateSnapshot: {
        projectStatus: string | null;
        currentMilestone: string | null;
        currentPhase: string | null;
        activeCommand: string | null;
        nextAction: string | null;
        blockers: string[];
    };
    contract: {
        artifactId: "phase.plan";
        schemaPath: string | null;
        modelContract: {
            schemaPath: string | null;
            jsonSchema: Record<string, unknown> | null;
        };
        authoringTemplate?: string;
        contractHash: string;
    };
    artifactBodies: {
        context?: PhasePlanReadinessBody;
        research?: PhasePlanReadinessBody;
        spec?: PhasePlanReadinessBody;
        uiSpec?: PhasePlanReadinessBody;
    };
    validationEvidence: {
        found: boolean;
        reason?: string;
        paths: string[];
        summaryPaths: string[];
        contentHash?: string;
        content?: string;
    };
    reviewFindings: {
        found: boolean;
        reason?: string;
        path: string | null;
        severityCounts: Record<string, number>;
        findingIds: string[];
        findings?: string[];
    };
    savedPlanBodies: Array<{
        planId: string;
        path: string;
        content: string;
        hash: string;
        validation: PhasePlanRecord["valid"] extends boolean ? {
            valid: boolean;
            issues: string[];
            warnings: string[];
        } : never;
    }>;
    readSet: PhasePlanReadSetEntry[];
    freshness: {
        checked: boolean;
        fresh: boolean;
        stalePaths: string[];
    };
    nextSafeAction: string;
    warnings: string[];
};
export type PhasePlanValidateModelTarget = {
    artifact: "phase.plan";
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    planId: string | null;
    path: string | null;
    schemaPath: string | null;
};
export type PhasePlanValidateModelResult = {
    status: "valid" | "invalid";
    valid: boolean;
    target: PhasePlanValidateModelTarget;
    repairBudget: {
        maxAttempts: 2;
        recommendedStrategy: "repair-all-diagnostics-before-retry";
    };
    repairSummary: PhasePlanRepairSummary;
    phase: ResolvedPhaseLocation | null;
    planId: string | null;
    path: string | null;
    schemaPath: string | null;
    taskSchema: Record<string, unknown> | null;
    diagnostics: PhasePlanModelDiagnostic[];
    diagnosticCounts: PhasePlanDiagnosticCounts;
    normalizedModel: PhasePlanStructuredModel | null;
    renderPreview: string | null;
    warnings: string[];
};
export type PhasePlanStandaloneValidateModelResult = Omit<PhasePlanValidateModelResult, "taskSchema" | "normalizedModel" | "renderPreview">;
export type PhasePlanWriteModelValidationResult = Omit<PhasePlanValidateModelResult, "taskSchema" | "normalizedModel" | "renderPreview">;
export type PhaseSummaryRecord = {
    planId: string;
    path: string;
    linkedPlanPath: string | null;
    status: "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
    title: string | null;
    summary: string | null;
};
export type LoadedPhaseSummaryInventoryRecord = {
    planId: string;
    path: string;
    content: string;
    record: PhaseSummaryRecord;
    status: PhaseSummaryRecord["status"];
    completedEvidence: boolean;
    legacyCompletedEvidence: boolean;
    strictValidation: {
        valid: boolean;
        issues: string[];
        warnings: string[];
    };
    validation: {
        valid: boolean;
        issues: string[];
        warnings: string[];
    };
    linkedPlan: PhasePlanRecord | null;
    dependencyPlanIds: string[];
};
export type PhaseSummaryIndexResult = {
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
export type PhaseSummaryInventory = {
    summaryIndex: PhaseSummaryIndexResult;
    summariesByPlanId: Map<string, LoadedPhaseSummaryInventoryRecord>;
};
export type PhaseSummaryReadResult = {
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
export type PhaseSummaryAuthoringContextResult = {
    status: "ready" | "invalid";
    phase: ResolvedPhaseLocation | null;
    planId: string | null;
    path: string | null;
    linkedPlanPath: string | null;
    plan: PhasePlanRecord | null;
    existing: PhaseSummaryReadResult | null;
    dependencyPlans: Array<{
        planId: string;
        path: string;
    }>;
    acceptanceCriteria: string[];
    allowedNextActions: string[];
    schemaPath: string | null;
    baseSchema: Record<string, unknown> | null;
    taskSchema: Record<string, unknown> | null;
    modelOnly: boolean;
    prerequisiteBlockers: string[];
    reason: string | null;
    warnings: string[];
};
export type PhaseSummaryValidateModelResult = {
    status: "valid" | "invalid";
    valid: boolean;
    phase: ResolvedPhaseLocation | null;
    planId: string | null;
    path: string | null;
    linkedPlanPath: string | null;
    schemaPath: string | null;
    taskSchema: Record<string, unknown> | null;
    diagnostics: PhaseSummaryModelDiagnostic[];
    diagnosticCounts: PhaseSummaryDiagnosticCounts;
    normalizedModel: PhaseSummaryStructuredModel | null;
    renderPreview: string | null;
    warnings: string[];
};
export type PhaseSummaryStandaloneValidateModelResult = Omit<PhaseSummaryValidateModelResult, "taskSchema" | "normalizedModel" | "renderPreview">;
export type PhaseSummaryWriteResult = {
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
export type LoadedPhasePlanArtifact = {
    path: string;
    planIdFromPath: string;
    content: string;
    heading: string | null;
    metadata: ReturnType<typeof validatePlanArtifactContent>["metadata"];
    validation: ReturnType<typeof validatePlanArtifactContent>;
    normalizedFrontmatterPlanId: string | null;
};
export type PhaseExecutionTargetSummary = {
    found: boolean;
    path: string;
    linkedPlanPath: string | null;
    status: "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
    valid: boolean | null;
    issues: string[];
    warnings: string[];
    overwriteCandidate: boolean;
};
export type PhaseExecutionTargetPlan = PhasePlanRecord & {
    missingDependencyPlans: string[];
    summary: PhaseExecutionTargetSummary;
};
export type PhaseExecutionExternalServicePrerequisite = PhasePlanExternalServicePrerequisite & {
    planId: string;
    planPath: string;
    wave: number | null;
};
export type PhaseExecutionTargetConflictGroup = {
    planIds: string[];
    planPaths: string[];
    selectedPlanIds: string[];
    sharedSurfaces: PhaseExecutionTargetConflictSurface[];
    existingSummaryPaths: string[];
    warnings: string[];
};
export type PhaseExecutionTargetsResult = {
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
    externalServicePreflight: {
        confirmationRequired: boolean;
        confirmed: boolean;
        blocking: boolean;
        declaredPrerequisites: PhaseExecutionExternalServicePrerequisite[];
        blockingPrerequisites: PhaseExecutionExternalServicePrerequisite[];
        reasons: string[];
    };
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
export type RoadmapReadResult = {
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
