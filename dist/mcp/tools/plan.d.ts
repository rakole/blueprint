import * as z from "zod/v4";
import type { ToolDefinition } from "../tool-types.js";
import { writeTextFile } from "./artifacts.js";
import { blueprintPhasePlanReadiness, validatePhasePlanCandidateSet } from "./phase.js";
import { compilePlanCandidate } from "./plan-model.js";
import { blueprintStateLoad, blueprintStateUpdate } from "./state.js";
declare const prepareInput: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    mode: z.ZodOptional<z.ZodEnum<{
        replace: "replace";
        add: "add";
        revise: "revise";
    }>>;
    targetPlanIds: z.ZodOptional<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    evidencePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    expectedRevision: z.ZodOptional<z.ZodNumber>;
    acknowledgeChangedInputs: z.ZodOptional<z.ZodBoolean>;
    reconcile: z.ZodOptional<z.ZodObject<{
        confirmed: z.ZodLiteral<true>;
        targetHashes: z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const submitInput: z.ZodObject<{
    requestId: z.ZodString;
    expectedRevision: z.ZodNumber;
    candidate: z.ZodOptional<z.ZodUnknown>;
    corrections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodArray<z.ZodString>;
        operation: z.ZodDefault<z.ZodEnum<{
            set: "set";
            remove: "remove";
        }>>;
        value: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>>;
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strip>;
declare const finalizeInput: z.ZodObject<{
    requestId: z.ZodString;
    expectedRevision: z.ZodNumber;
    overwrite: z.ZodOptional<z.ZodBoolean>;
    review: z.ZodOptional<z.ZodObject<{
        revision: z.ZodNumber;
        candidateHash: z.ZodString;
        verdict: z.ZodEnum<{
            revise: "revise";
            accept: "accept";
        }>;
        summary: z.ZodString;
    }, z.core.$strip>>;
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strip>;
declare const lookupSchema: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strip>;
export declare function blueprintPlanPrepare(raw?: z.input<typeof prepareInput>): Promise<{
    targetHashes: {
        [k: string]: string | null;
    };
    reason: string;
    saved: boolean;
    revision: number;
    candidateHash: string | null;
    sessionPath: string;
    status: string;
} | {
    targetHashes: {
        [k: string]: string | null;
    };
    nextAction: string;
    saved: boolean;
    revision: number;
    candidateHash: string | null;
    sessionPath: string;
    status: string;
} | {
    reason: string | null;
    nextAction: string;
    saved: boolean;
    revision: number;
    candidateHash: string | null;
    sessionPath: string;
    status: string;
} | {
    freshness: {
        status: string;
        stalePaths: string[];
        unknownPaths: string[];
    };
    nextAction: string;
    saved: boolean;
    revision: number;
    candidateHash: string | null;
    sessionPath: string;
    status: string;
} | {
    mode: "replace" | "add" | "revise";
    targetPlanIds: string[];
    knownRequirements: string[];
    knownEvidenceArtifacts: string[];
    nextAction: string | null;
    saved: boolean;
    revision: number;
    candidateHash: string | null;
    sessionPath: string;
    status: string;
    phase: import("./phase-tool-types.js").PhaseSelectionResult;
    gates: {
        ready: boolean;
        blockers: string[];
        checkerRequired: boolean;
    };
    config: {
        workflow: {
            research: boolean;
            plan_check: boolean;
            secure_phase: boolean;
            verifier: boolean;
            nyquist_validation: boolean;
            ui_phase: boolean;
            ui_safety_gate: boolean;
            no_uat: boolean;
            code_review: boolean;
            code_review_depth: string;
            auto_advance: boolean;
            research_before_questions: boolean;
            discuss_mode: string;
            use_worktrees: boolean;
            subagents: boolean;
            subagent_timeout: number;
        };
    };
    requirements: {
        found: boolean;
        path: string | null;
        canonicalRequirementIds: string[];
        roadmapRequirementIds: string[];
        traceabilityNotes: string[];
        acceptanceNotes: string[];
        deferredItems: string[];
        summary: string;
        warnings: string[];
    } | undefined;
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
    } | undefined;
    evidence: ({
        content: string | null;
        truncated: boolean;
        path: string;
        hash: string;
    } | {
        content: string | null;
        truncated: boolean;
        path: string;
        hash: null;
    })[];
    existingPlans: {
        planId: string;
        path: string;
        title: string | null;
        wave: number | null;
        dependsOn: string[];
        requirements: string[];
        status: string | null;
    }[];
    targetHashes: {
        [k: string]: string | null;
    };
    planningCandidateJsonSchema: Record<string, unknown>;
} | {
    status: string;
    reason: string;
    nextAction: string | null;
}>;
export declare function blueprintPlanSubmit(raw: z.input<typeof submitInput>): Promise<Record<string, unknown>>;
export declare function blueprintPlanRead(raw: z.input<typeof lookupSchema>): Promise<{
    status: string;
    sessionPath: string;
    session: {
        version: 1;
        phase: string;
        topology: import("./phase-topology-lock.js").PhaseTopologyFingerprint;
        revision: number;
        prepared: boolean;
        needsIntent: boolean;
        mode: "replace" | "add" | "revise";
        targetPlanIds: string[];
        readSet: {
            path: string;
            hash: string | null;
        }[];
        evidencePaths: string[];
        targets: {
            path: string;
            hash: string | null;
        }[];
        existingPlans: {
            planId: string;
            wave: number;
            dependsOn: string[];
            requirements: string[];
        }[];
        knownRequirements: string[];
        knownEvidenceArtifacts: string[];
        checkerRequired: boolean;
        candidateHash: string | null;
        history: {
            revision: number;
            kind: string;
            candidate?: unknown;
            readSet?: {
                path: string;
                hash: string | null;
            }[] | undefined;
            targets?: {
                path: string;
                hash: string | null;
            }[] | undefined;
            journal?: {
                requestId: string;
                requestHash: string;
                revision: number;
                candidateHash: string;
                baselineMarker: string | null;
                files: {
                    planId: string;
                    title: string;
                    wave: number;
                    taskCount: number;
                    path: string;
                    hash: string;
                    content: string;
                    baselineHash: string | null;
                    backup: string | null;
                }[];
                removed: {
                    path: string;
                    baselineHash: string;
                    backup: string;
                }[];
                stages: Partial<Record<"files" | "state" | "routing" | "commit", "complete" | "intent">>;
                review?: {
                    revision: number;
                    candidateHash: string;
                    verdict: "revise" | "accept";
                    summary: string;
                } | undefined;
                receipt?: Record<string, unknown> | undefined;
            } | undefined;
        }[];
        requests: Record<string, {
            hash: string;
            operation: "submit" | "finalize";
            revision: number;
            receipt?: Record<string, unknown> | undefined;
        }>;
        candidate?: unknown;
        journal?: {
            requestId: string;
            requestHash: string;
            revision: number;
            candidateHash: string;
            baselineMarker: string | null;
            files: {
                planId: string;
                title: string;
                wave: number;
                taskCount: number;
                path: string;
                hash: string;
                content: string;
                baselineHash: string | null;
                backup: string | null;
            }[];
            removed: {
                path: string;
                baselineHash: string;
                backup: string;
            }[];
            stages: Partial<Record<"files" | "state" | "routing" | "commit", "complete" | "intent">>;
            review?: {
                revision: number;
                candidateHash: string;
                verdict: "revise" | "accept";
                summary: string;
            } | undefined;
            receipt?: Record<string, unknown> | undefined;
        } | undefined;
    } | null;
    freshness: {
        status: string;
        stalePaths: string[];
        unknownPaths: string[];
    } | null;
    publication: import("./plan-publication.js").PlanPublicationStatus;
}>;
export declare const planDependencies: {
    compile: typeof compilePlanCandidate;
    validate: typeof validatePhasePlanCandidateSet;
    readiness: typeof blueprintPhasePlanReadiness;
    writeText: typeof writeTextFile;
    remove: (path: string) => Promise<void>;
    stateUpdate: typeof blueprintStateUpdate;
    stateLoad: typeof blueprintStateLoad;
};
export declare function blueprintPlanFinalize(raw: z.input<typeof finalizeInput>): Promise<Record<string, unknown>>;
export declare const planningToolDefinitions: ToolDefinition[];
export {};
