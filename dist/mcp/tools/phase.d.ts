export { blueprintPhaseCheckpointDelete, blueprintPhaseCheckpointGet, blueprintPhaseCheckpointPut } from "./phase-checkpoints.js";
export { resolvePhaseTopologySnapshot, type PhaseTopologySnapshot } from "./phase-resolution.js";
export { blueprintPhaseArtifactRead, blueprintPhaseArtifactScaffold, blueprintPhaseArtifactWrite, blueprintPhaseUiSkipWrite } from "./phase-artifacts.js";
import { type PhaseValidationRenderArgs } from "./phase-validation-rendering.js";
import type { PhaseArtifactReadResult, PhaseArtifactScaffoldResult, PhaseArtifactWriteResult, PhaseContextResult, PhaseExecutionTargetsArgs, PhaseExecutionTargetsResult, PhaseLocateResult, PhaseLookupArgs, PhasePlanAuthoringContextArgs, PhasePlanAuthoringContextResult, PhasePlanIndexResult, PhasePlanReadArgs, PhasePlanReadResult, PhasePlanReadinessArgs, PhasePlanReadinessResult, PhasePlanStandaloneValidateModelResult, PhasePlanValidateArgs, PhasePlanValidateModelArgs, PhasePlanValidationResult, PhasePlanWriteArgs, PhasePlanWriteResult, PhaseResearchStatusResult, PhaseSummaryAuthoringContextArgs, PhaseSummaryAuthoringContextResult, PhaseSummaryIndexResult, PhaseSummaryReadArgs, PhaseSummaryReadResult, PhaseSummaryStandaloneValidateModelResult, PhaseSummaryValidateModelArgs, PhaseSummaryValidateModelResult, PhaseSummaryWriteArgs, PhaseSummaryWriteResult, PhaseValidationAuthoringContextArgs, PhaseValidationAuthoringContextResult, PhaseValidationReadArgs, PhaseValidationReadResult, PhaseValidationRenderResult, PhaseValidationStandaloneValidateModelResult, PhaseValidationValidateModelArgs, PhaseValidationValidateModelResult, PhaseValidationWriteArgs, PhaseValidationWriteResult, PlanIndexArgs, RoadmapAddPhaseArgs, RoadmapAddPhaseResult, RoadmapInsertPhaseArgs, RoadmapInsertPhaseResult, RoadmapPromoteBacklogArgs, RoadmapPromoteBacklogResult, RoadmapReadArgs, RoadmapReadResult, RoadmapRemovePhaseArgs, RoadmapRemovePhaseResult } from "./phase-tool-types.js";
export { buildBlueprintPhaseDirectoryPath } from "./phase-roadmap-mutations.js";
export declare function blueprintPhaseValidationAuthoringContext(args: PhaseValidationAuthoringContextArgs): Promise<PhaseValidationAuthoringContextResult>;
export declare function blueprintPhaseValidationValidateModel(args: PhaseValidationValidateModelArgs): Promise<PhaseValidationValidateModelResult>;
export declare function blueprintPhaseValidationRender(args: PhaseValidationRenderArgs): Promise<PhaseValidationRenderResult>;
export declare function blueprintRoadmapRead(args?: RoadmapReadArgs): Promise<RoadmapReadResult>;
export declare function blueprintRoadmapAddPhase(args: RoadmapAddPhaseArgs): Promise<RoadmapAddPhaseResult>;
export declare function blueprintRoadmapInsertPhase(args: RoadmapInsertPhaseArgs): Promise<RoadmapInsertPhaseResult>;
export declare function blueprintRoadmapRemovePhase(args: RoadmapRemovePhaseArgs): Promise<RoadmapRemovePhaseResult>;
export declare function blueprintRoadmapPromoteBacklog(args?: RoadmapPromoteBacklogArgs): Promise<RoadmapPromoteBacklogResult>;
export declare function blueprintPhaseLocate(args?: PhaseLookupArgs): Promise<PhaseLocateResult>;
export declare function blueprintPhaseContext(args?: PhaseLookupArgs): Promise<PhaseContextResult>;
export declare function blueprintPhaseResearchStatus(args?: PhaseLookupArgs): Promise<PhaseResearchStatusResult>;
export declare function blueprintPhaseValidationRead(args: PhaseValidationReadArgs): Promise<PhaseValidationReadResult>;
export declare function blueprintPhaseValidationWrite(args: PhaseValidationWriteArgs): Promise<PhaseValidationWriteResult>;
export declare function blueprintPhasePlanIndex(args?: PlanIndexArgs): Promise<PhasePlanIndexResult>;
export declare function blueprintPhasePlanRead(args: PhasePlanReadArgs): Promise<PhasePlanReadResult>;
export declare function blueprintPhasePlanValidate(args?: PhasePlanValidateArgs): Promise<PhasePlanValidationResult>;
export declare function blueprintPhasePlanAuthoringContext(args?: PhasePlanAuthoringContextArgs): Promise<PhasePlanAuthoringContextResult>;
export declare function blueprintPhasePlanReadiness(args?: PhasePlanReadinessArgs): Promise<PhasePlanReadinessResult>;
export declare function blueprintPhasePlanValidateModel(args: PhasePlanValidateModelArgs): Promise<PhasePlanStandaloneValidateModelResult>;
export declare function blueprintPhasePlanWrite(args: PhasePlanWriteArgs): Promise<PhasePlanWriteResult>;
export declare function blueprintPhaseSummaryIndex(args?: PlanIndexArgs): Promise<PhaseSummaryIndexResult>;
export declare function blueprintPhaseSummaryAuthoringContext(args: PhaseSummaryAuthoringContextArgs): Promise<PhaseSummaryAuthoringContextResult>;
export declare function blueprintPhaseSummaryValidateModel(args: PhaseSummaryValidateModelArgs): Promise<PhaseSummaryValidateModelResult>;
export declare function blueprintPhaseSummaryRead(args: PhaseSummaryReadArgs): Promise<PhaseSummaryReadResult>;
export declare function blueprintPhaseExecutionTargets(args?: PhaseExecutionTargetsArgs): Promise<PhaseExecutionTargetsResult>;
export declare function blueprintPhaseSummaryWrite(args: PhaseSummaryWriteArgs): Promise<PhaseSummaryWriteResult>;
export declare const phaseToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        description: import("zod/v4").ZodString;
        expectedPhaseNumber: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        confirmed: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        goal: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        requirementIds: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        successCriteria: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        auditBackedDetails: import("zod/v4").ZodOptional<import("zod/v4").ZodObject<{
            sourceReportPath: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            goal: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            successCriteria: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            repairRequirementIds: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
            gapGroups: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
                category: import("zod/v4").ZodEnum<{
                    optional: "optional";
                    requirement: "requirement";
                    integration: "integration";
                    flow: "flow";
                }>;
                rows: import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
                    gapId: import("zod/v4").ZodString;
                    surface: import("zod/v4").ZodString;
                    evidence: import("zod/v4").ZodString;
                    repair: import("zod/v4").ZodString;
                }, import("zod/v4/core").$strip>>;
            }, import("zod/v4/core").$strip>>>;
        }, import("zod/v4/core").$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapAddPhaseResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        after: import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>;
        description: import("zod/v4").ZodString;
        confirmed: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        goal: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        requirementIds: import("zod/v4").ZodArray<import("zod/v4").ZodString>;
        successCriteria: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapInsertPhaseResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>;
        confirmed: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        force: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapRemovePhaseResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        backlogIds: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        previewOnly: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<RoadmapPromoteBacklogResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseLocateResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseContextResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseResearchStatusResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanIndexResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        wave: import("zod/v4").ZodOptional<import("zod/v4").ZodNumber>;
        gapsOnly: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        includeConflicts: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        externalServiceConfirmed: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseExecutionTargetsResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        artifact: import("zod/v4").ZodEnum<{
            research: "research";
            context: "context";
            "discussion-log": "discussion-log";
            spec: "spec";
            "ui-spec": "ui-spec";
        }>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseArtifactReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        overwrite: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        artifact: import("zod/v4").ZodEnum<{
            research: "research";
            context: "context";
            "discussion-log": "discussion-log";
            spec: "spec";
            "ui-spec": "ui-spec";
        }>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseArtifactScaffoldResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        artifact: import("zod/v4").ZodEnum<{
            research: "research";
            context: "context";
            "discussion-log": "discussion-log";
            spec: "spec";
            "ui-spec": "ui-spec";
        }>;
        content: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        model: import("zod/v4").ZodOptional<import("zod/v4").ZodRecord<import("zod/v4").ZodString, import("zod/v4").ZodUnknown>>;
        overwrite: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        validationMode: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            strict: "strict";
            warn: "warn";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseArtifactWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        skipRationale: import("zod/v4").ZodString;
        overwrite: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseArtifactWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        artifact: import("zod/v4").ZodEnum<{
            verification: "verification";
            uat: "uat";
        }>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseValidationReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        artifact: import("zod/v4").ZodEnum<{
            verification: "verification";
            uat: "uat";
        }>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseValidationAuthoringContextResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        artifact: import("zod/v4").ZodEnum<{
            verification: "verification";
            uat: "uat";
        }>;
        coverageSummary: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        gateState: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        signOff: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        validationSummary: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodArray<import("zod/v4").ZodString>]>>;
        requirementCoverage: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
            requirement: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            taskOrCheck: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            evidence: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            coverageState: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            notes: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        }, import("zod/v4/core").$strip>>>;
        evidenceReviewedSummaryPaths: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        evidenceMetadata: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        manualOrDeferredCoverage: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
            item: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            whyManualOrDeferred: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            followUp: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            status: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        }, import("zod/v4/core").$strip>>>;
        gapClassification: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
            gapClass: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            scope: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            evidence: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            repair: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        }, import("zod/v4/core").$strip>>>;
        gapsFound: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        suggestedRepairs: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        nextSafeAction: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        status: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        resumeState: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        checkpoint: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        uatSummary: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        sessionState: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        currentTest: import("zod/v4").ZodOptional<import("zod/v4").ZodObject<{
            number: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            name: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            expected: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            awaiting: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        }, import("zod/v4/core").$strip>>;
        testMatrix: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
            number: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            test: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            expectedBehavior: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            evidence: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            result: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            notes: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        }, import("zod/v4/core").$strip>>>;
        resultSummary: import("zod/v4").ZodOptional<import("zod/v4").ZodObject<{
            total: import("zod/v4").ZodOptional<import("zod/v4").ZodNumber>;
            passed: import("zod/v4").ZodOptional<import("zod/v4").ZodNumber>;
            issues: import("zod/v4").ZodOptional<import("zod/v4").ZodNumber>;
            pending: import("zod/v4").ZodOptional<import("zod/v4").ZodNumber>;
            skipped: import("zod/v4").ZodOptional<import("zod/v4").ZodNumber>;
            blocked: import("zod/v4").ZodOptional<import("zod/v4").ZodNumber>;
        }, import("zod/v4/core").$strip>>;
        questionsAsked: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        observedBehavior: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        unresolvedGaps: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
        structuredGaps: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
            test: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            truth: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            status: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            severity: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            reason: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            followUp: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        }, import("zod/v4/core").$strip>>>;
        followUpFixes: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseValidationRenderResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        artifact: import("zod/v4").ZodEnum<{
            verification: "verification";
            uat: "uat";
        }>;
        model: import("zod/v4").ZodUnknown;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseValidationStandaloneValidateModelResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        artifact: import("zod/v4").ZodEnum<{
            verification: "verification";
            uat: "uat";
        }>;
        content: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        model: import("zod/v4").ZodOptional<import("zod/v4").ZodRecord<import("zod/v4").ZodString, import("zod/v4").ZodUnknown>>;
        authoringMode: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            "content-compatible": "content-compatible";
            "model-only": "model-only";
        }>>;
        overwrite: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseValidationWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        planId: import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanValidationResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        planId: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanAuthoringContextResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        planId: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        readMode: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            full: "full";
            "hashes-only": "hashes-only";
        }>>;
        bodyMode: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            summary: "summary";
            bounded: "bounded";
        }>>;
        maxBodyBytes: import("zod/v4").ZodOptional<import("zod/v4").ZodNumber>;
        includeSavedPlanBodies: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            target: "target";
            none: "none";
        }>>;
        includeReviewFindings: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        includeValidationEvidence: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        previousReadSet: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
            path: import("zod/v4").ZodString;
            kind: import("zod/v4").ZodString;
            hash: import("zod/v4").ZodString;
        }, import("zod/v4/core").$strip>>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanReadinessResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        planId: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        model: import("zod/v4").ZodUnknown;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanStandaloneValidateModelResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        planId: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        content: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        model: import("zod/v4").ZodOptional<import("zod/v4").ZodUnknown>;
        authoringMode: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            "content-compatible": "content-compatible";
            "model-only": "model-only";
        }>>;
        overwrite: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        validationMode: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            strict: "strict";
            warn: "warn";
        }>>;
        returnPlanSetValidation: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        returnNextAuthoringContext: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
        expectedReadSet: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
            path: import("zod/v4").ZodString;
            kind: import("zod/v4").ZodString;
            hash: import("zod/v4").ZodString;
        }, import("zod/v4/core").$strip>>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhasePlanWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseSummaryIndexResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        planId: import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseSummaryReadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        planId: import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseSummaryAuthoringContextResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        planId: import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>;
        content: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        model: import("zod/v4").ZodOptional<import("zod/v4").ZodUnknown>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseSummaryStandaloneValidateModelResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        planId: import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>;
        content: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        model: import("zod/v4").ZodOptional<import("zod/v4").ZodUnknown>;
        authoringMode: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            "content-compatible": "content-compatible";
            "model-only": "model-only";
        }>>;
        overwrite: import("zod/v4").ZodOptional<import("zod/v4").ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<PhaseSummaryWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        expectedOwnerCommand: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            "/blu-discuss-phase": "/blu-discuss-phase";
            "/blu-research-phase": "/blu-research-phase";
        }>>;
        expectedMode: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            discuss: "discuss";
            research: "research";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<import("./phase-tool-types.js").PhaseCheckpointGetResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        checkpoint: import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodObject<{
            schemaVersion: import("zod/v4").ZodLiteral<2>;
            ownerCommand: import("zod/v4").ZodLiteral<"/blu-discuss-phase">;
            mode: import("zod/v4").ZodLiteral<"discuss">;
            progress: import("zod/v4").ZodObject<{}, import("zod/v4/core").$catchall<import("zod/v4").ZodUnknown>>;
            areaQueue: import("zod/v4").ZodArray<import("zod/v4").ZodObject<{
                areaId: import("zod/v4").ZodString;
                title: import("zod/v4").ZodString;
                state: import("zod/v4").ZodEnum<{
                    blocked: "blocked";
                    questioning: "questioning";
                    assumed: "assumed";
                    decided: "decided";
                    "needs-revisit": "needs-revisit";
                    unseen: "unseen";
                }>;
                decisionIds: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
                evidenceRefs: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
                downstreamConsumers: import("zod/v4").ZodOptional<import("zod/v4").ZodArray<import("zod/v4").ZodString>>;
                currentQuestion: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
                questionWhyItMatters: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
                lastUserAnswer: import("zod/v4").ZodOptional<import("zod/v4").ZodUnknown>;
                blockingReason: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
                resolutionCriterion: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
            }, import("zod/v4/core").$catchall<import("zod/v4").ZodUnknown>>>;
            carryForward: import("zod/v4").ZodObject<{}, import("zod/v4/core").$catchall<import("zod/v4").ZodUnknown>>;
            readSet: import("zod/v4").ZodArray<import("zod/v4").ZodUnknown>;
        }, import("zod/v4/core").$catchall<import("zod/v4").ZodUnknown>>, import("zod/v4").ZodObject<{
            schemaVersion: import("zod/v4").ZodLiteral<2>;
            ownerCommand: import("zod/v4").ZodLiteral<"/blu-research-phase">;
            mode: import("zod/v4").ZodLiteral<"research">;
            researchLedger: import("zod/v4").ZodObject<{
                schemaVersion: import("zod/v4").ZodLiteral<"research-ledger/v1">;
                strands: import("zod/v4").ZodArray<import("zod/v4").ZodObject<{}, import("zod/v4/core").$catchall<import("zod/v4").ZodUnknown>>>;
            }, import("zod/v4/core").$catchall<import("zod/v4").ZodUnknown>>;
        }, import("zod/v4/core").$catchall<import("zod/v4").ZodUnknown>>]>;
    };
    handler: (args: Record<string, unknown>) => Promise<import("./phase-tool-types.js").PhaseCheckpointPutResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: import("zod/v4").ZodOptional<import("zod/v4").ZodString>;
        phase: import("zod/v4").ZodOptional<import("zod/v4").ZodUnion<readonly [import("zod/v4").ZodString, import("zod/v4").ZodNumber]>>;
        expectedOwnerCommand: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            "/blu-discuss-phase": "/blu-discuss-phase";
            "/blu-research-phase": "/blu-research-phase";
        }>>;
        expectedMode: import("zod/v4").ZodOptional<import("zod/v4").ZodEnum<{
            discuss: "discuss";
            research: "research";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<import("./phase-tool-types.js").PhaseCheckpointDeleteResult>;
})[];
