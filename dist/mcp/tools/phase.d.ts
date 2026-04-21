import * as z from "zod/v4";
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
type PhaseCheckpointResumeMetaRecord = {
    mode: string;
    pendingTopics: string[];
    completedTopics: string[];
    currentQuestion?: string;
    notes: string[];
    resumeHint?: string;
    updatedAt: string;
};
type PhaseCheckpointWriteRecord = PhaseCheckpointRecord & {
    completedAreas: string[];
    remainingAreas: string[];
    decisions: PhaseCheckpointDecisionRecord[];
    deferredIdeas: PhaseCheckpointDeferredIdeaRecord[];
    canonicalReferences: PhaseCheckpointReferenceRecord[];
    resumeMeta: PhaseCheckpointResumeMetaRecord;
};
type PhaseCheckpointPutArgs = PhaseLookupArgs & {
    checkpoint: PhaseCheckpointWriteRecord;
};
type PhasePlanReadArgs = PhaseLookupArgs & {
    planId: NumericInput;
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
type PhaseContextResult = {
    phase: {
        phaseNumber: string;
        phasePrefix: string;
        phaseName: string;
        phaseDir: string;
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
    contextPath: string | null;
    researchPath: string | null;
    uiSpecPath: string | null;
    researchValid: boolean | null;
    researchIssues: string[];
    suggestedRepairs: string[];
    warnings: string[];
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
        requirements: string[];
        phaseDir: string | null;
    }>;
};
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
export declare function blueprintPhasePlanWrite(args: PhasePlanWriteArgs): Promise<PhasePlanWriteResult>;
export declare function blueprintPhaseSummaryIndex(args?: PlanIndexArgs): Promise<PhaseSummaryIndexResult>;
export declare function blueprintPhaseSummaryRead(args: PhaseSummaryReadArgs): Promise<PhaseSummaryReadResult>;
export declare function blueprintPhaseSummaryWrite(args: PhaseSummaryWriteArgs): Promise<PhaseSummaryWriteResult>;
export declare function blueprintPhaseCheckpointGet(args?: PhaseLookupArgs): Promise<PhaseCheckpointGetResult>;
export declare function blueprintPhaseCheckpointPut(args: PhaseCheckpointPutArgs): Promise<PhaseCheckpointPutResult>;
export declare function blueprintPhaseCheckpointDelete(args?: PhaseLookupArgs): Promise<PhaseCheckpointDeleteResult>;
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
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseCheckpointGetResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        checkpoint: z.ZodObject<{
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
                mode: z.ZodString;
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
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseCheckpointDeleteResult>;
})[];
export {};
