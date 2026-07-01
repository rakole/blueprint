import * as z from "zod/v4";
export declare const roadmapReadInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
};
export declare const roadmapAddPhaseInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    expectedPhaseNumber: z.ZodOptional<z.ZodString>;
    confirmed: z.ZodOptional<z.ZodBoolean>;
    goal: z.ZodOptional<z.ZodString>;
    requirementIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    successCriteria: z.ZodOptional<z.ZodArray<z.ZodString>>;
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
export declare const roadmapInsertPhaseInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    after: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    description: z.ZodString;
    confirmed: z.ZodOptional<z.ZodBoolean>;
    goal: z.ZodOptional<z.ZodString>;
    requirementIds: z.ZodArray<z.ZodString>;
    successCriteria: z.ZodOptional<z.ZodArray<z.ZodString>>;
};
export declare const roadmapRemovePhaseInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    confirmed: z.ZodOptional<z.ZodBoolean>;
    force: z.ZodOptional<z.ZodBoolean>;
};
export declare const roadmapPromoteBacklogInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    backlogIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    previewOnly: z.ZodOptional<z.ZodBoolean>;
};
export declare const phaseLookupInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
};
export declare const phaseArtifactInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    artifact: z.ZodEnum<{
        research: "research";
        context: "context";
        "discussion-log": "discussion-log";
        spec: "spec";
        "ui-spec": "ui-spec";
    }>;
};
export declare const phaseArtifactScaffoldInputSchema: {
    overwrite: z.ZodOptional<z.ZodBoolean>;
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    artifact: z.ZodEnum<{
        research: "research";
        context: "context";
        "discussion-log": "discussion-log";
        spec: "spec";
        "ui-spec": "ui-spec";
    }>;
};
export declare const phaseValidationArtifactInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    artifact: z.ZodEnum<{
        verification: "verification";
        uat: "uat";
    }>;
};
export declare const phaseValidationAuthoringContextInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    artifact: z.ZodEnum<{
        verification: "verification";
        uat: "uat";
    }>;
};
export declare const phasePlanInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
};
export declare const phaseExecutionTargetsInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    wave: z.ZodOptional<z.ZodNumber>;
    gapsOnly: z.ZodOptional<z.ZodBoolean>;
    includeConflicts: z.ZodOptional<z.ZodBoolean>;
    externalServiceConfirmed: z.ZodOptional<z.ZodBoolean>;
};
export declare const phaseArtifactWriteInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    artifact: z.ZodEnum<{
        research: "research";
        context: "context";
        "discussion-log": "discussion-log";
        spec: "spec";
        "ui-spec": "ui-spec";
    }>;
    content: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    overwrite: z.ZodOptional<z.ZodBoolean>;
    validationMode: z.ZodOptional<z.ZodEnum<{
        strict: "strict";
        warn: "warn";
    }>>;
};
export declare const phaseUiSkipWriteInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    skipRationale: z.ZodString;
    overwrite: z.ZodOptional<z.ZodBoolean>;
};
export declare const phaseValidationWriteInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    artifact: z.ZodEnum<{
        verification: "verification";
        uat: "uat";
    }>;
    content: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    authoringMode: z.ZodOptional<z.ZodEnum<{
        "content-compatible": "content-compatible";
        "model-only": "model-only";
    }>>;
    overwrite: z.ZodOptional<z.ZodBoolean>;
};
export declare const phaseValidationValidateModelInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    artifact: z.ZodEnum<{
        verification: "verification";
        uat: "uat";
    }>;
    model: z.ZodUnknown;
};
export declare const phaseValidationRenderInputSchema: {
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
export declare const phasePlanReadInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    planId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
};
export declare const phasePlanValidateInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
};
export declare const phasePlanAuthoringContextInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    planId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
};
export declare const phasePlanReadinessInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    planId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    readMode: z.ZodOptional<z.ZodEnum<{
        full: "full";
        "hashes-only": "hashes-only";
    }>>;
    bodyMode: z.ZodOptional<z.ZodEnum<{
        summary: "summary";
        bounded: "bounded";
    }>>;
    maxBodyBytes: z.ZodOptional<z.ZodNumber>;
    includeSavedPlanBodies: z.ZodOptional<z.ZodEnum<{
        target: "target";
        none: "none";
    }>>;
    includeReviewFindings: z.ZodOptional<z.ZodBoolean>;
    includeValidationEvidence: z.ZodOptional<z.ZodBoolean>;
    previousReadSet: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        kind: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strip>>>;
};
export declare const phasePlanValidateModelInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    planId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    model: z.ZodUnknown;
};
export declare const phasePlanWriteInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    planId: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    content: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodUnknown>;
    authoringMode: z.ZodOptional<z.ZodEnum<{
        "content-compatible": "content-compatible";
        "model-only": "model-only";
    }>>;
    overwrite: z.ZodOptional<z.ZodBoolean>;
    validationMode: z.ZodOptional<z.ZodEnum<{
        strict: "strict";
        warn: "warn";
    }>>;
    returnPlanSetValidation: z.ZodOptional<z.ZodBoolean>;
    returnNextAuthoringContext: z.ZodOptional<z.ZodBoolean>;
    expectedReadSet: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        kind: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strip>>>;
};
export declare const phaseSummaryReadInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    planId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
};
export declare const phaseSummaryAuthoringContextInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    planId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
};
export declare const phaseSummaryValidateModelInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    planId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    content: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodUnknown>;
};
export declare const phaseSummaryWriteInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    planId: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    content: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodUnknown>;
    authoringMode: z.ZodOptional<z.ZodEnum<{
        "content-compatible": "content-compatible";
        "model-only": "model-only";
    }>>;
    overwrite: z.ZodOptional<z.ZodBoolean>;
};
export declare const phaseCheckpointGetInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    expectedOwnerCommand: z.ZodOptional<z.ZodEnum<{
        "/blu-discuss-phase": "/blu-discuss-phase";
        "/blu-research-phase": "/blu-research-phase";
    }>>;
    expectedMode: z.ZodOptional<z.ZodEnum<{
        discuss: "discuss";
        research: "research";
    }>>;
};
export declare const phaseCheckpointPutInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    checkpoint: z.ZodUnion<readonly [z.ZodObject<{
        schemaVersion: z.ZodLiteral<2>;
        ownerCommand: z.ZodLiteral<"/blu-discuss-phase">;
        mode: z.ZodLiteral<"discuss">;
        progress: z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>;
        areaQueue: z.ZodArray<z.ZodObject<{
            areaId: z.ZodString;
            title: z.ZodString;
            state: z.ZodEnum<{
                blocked: "blocked";
                questioning: "questioning";
                assumed: "assumed";
                decided: "decided";
                "needs-revisit": "needs-revisit";
                unseen: "unseen";
            }>;
            decisionIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
            evidenceRefs: z.ZodOptional<z.ZodArray<z.ZodString>>;
            downstreamConsumers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            currentQuestion: z.ZodOptional<z.ZodString>;
            questionWhyItMatters: z.ZodOptional<z.ZodString>;
            lastUserAnswer: z.ZodOptional<z.ZodUnknown>;
            blockingReason: z.ZodOptional<z.ZodString>;
            resolutionCriterion: z.ZodOptional<z.ZodString>;
        }, z.core.$catchall<z.ZodUnknown>>>;
        carryForward: z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>;
        readSet: z.ZodArray<z.ZodUnknown>;
    }, z.core.$catchall<z.ZodUnknown>>, z.ZodObject<{
        schemaVersion: z.ZodLiteral<2>;
        ownerCommand: z.ZodLiteral<"/blu-research-phase">;
        mode: z.ZodLiteral<"research">;
        researchLedger: z.ZodObject<{
            schemaVersion: z.ZodLiteral<"research-ledger/v1">;
            strands: z.ZodArray<z.ZodObject<{}, z.core.$catchall<z.ZodUnknown>>>;
        }, z.core.$catchall<z.ZodUnknown>>;
    }, z.core.$catchall<z.ZodUnknown>>]>;
};
export declare const phaseCheckpointDeleteInputSchema: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    expectedOwnerCommand: z.ZodOptional<z.ZodEnum<{
        "/blu-discuss-phase": "/blu-discuss-phase";
        "/blu-research-phase": "/blu-research-phase";
    }>>;
    expectedMode: z.ZodOptional<z.ZodEnum<{
        discuss: "discuss";
        research: "research";
    }>>;
};
