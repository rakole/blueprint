import * as z from "zod/v4";
import type { ToolDefinition } from "../tool-types.js";
import { writeTextFile } from "./artifacts.js";
import { validatePhasePlanCandidateSet } from "./phase.js";
import { compilePlanCandidate } from "./plan-model.js";
import { blueprintStateLoad, blueprintStateUpdate } from "./state.js";
import { type PlanSession } from "./plan-session.js";
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
    model: z.ZodOptional<z.ZodUnknown>;
    overwrite: z.ZodOptional<z.ZodBoolean>;
    review: z.ZodOptional<z.ZodObject<{
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
    publication: import("./plan-publication.js").PlanPublicationStatus;
    nextAction: string;
    revision: number;
    sessionPath: string;
    status: string;
} | {
    freshness: {
        status: string;
        stalePaths: string[];
        unknownPaths: string[];
    };
    nextAction: string;
    revision: number;
    sessionPath: string;
    status: string;
} | {
    reason: string;
    revision: number;
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
    grounding: {
        lockedDecisions: string;
        phaseBoundary: string;
        dependencies: string;
        discoveryGrounding: string;
        projectConstraints: string[];
    };
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
    schema: Record<string, unknown>;
    example: {
        plans: {
            title: string;
            goal: string;
            tasks: {
                title: string;
                filesModified: string[];
                requirements: string[];
                action: string[];
                acceptanceCriteria: string[];
                id?: string | undefined;
                readFirst?: string[] | undefined;
            }[];
            key?: string | undefined;
            scope?: string[] | undefined;
            dependsOn?: string[] | undefined;
            mustHaves?: string[] | undefined;
            autonomous?: boolean | undefined;
            gapClosure?: boolean | undefined;
            externalServicePrerequisites?: {
                service: string;
                category: string;
                purpose: string;
                userSetup: string;
                readinessCheck: string;
                canAgentProceedWithoutIt: boolean;
            }[] | undefined;
            verification?: {
                item: string;
                method: "test" | "command" | "grep" | "file-read" | "artifact-validation";
                evidence: string;
            }[] | undefined;
            evidence?: {
                artifact: string;
                rationale: string;
            }[] | undefined;
            unknownsAndDeferrals?: {
                item: string;
                disposition: "unknown" | "none" | "deferred" | "blocked";
                rationale: string;
                followUp: string;
            }[] | undefined;
        }[];
        deferrals?: {
            requirement: string;
            rationale: string;
            followUp: string;
        }[] | undefined;
    };
    validationRules: {
        reject: string[];
        advisory: string[];
        normalize: string[];
    };
    derivedFields: string[];
    exampleNote: string;
} | {
    nextAction: string;
    revision: number;
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
    grounding: {
        lockedDecisions: string;
        phaseBoundary: string;
        dependencies: string;
        discoveryGrounding: string;
        projectConstraints: string[];
    };
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
    schema: Record<string, unknown>;
    example: {
        plans: {
            title: string;
            goal: string;
            tasks: {
                title: string;
                filesModified: string[];
                requirements: string[];
                action: string[];
                acceptanceCriteria: string[];
                id?: string | undefined;
                readFirst?: string[] | undefined;
            }[];
            key?: string | undefined;
            scope?: string[] | undefined;
            dependsOn?: string[] | undefined;
            mustHaves?: string[] | undefined;
            autonomous?: boolean | undefined;
            gapClosure?: boolean | undefined;
            externalServicePrerequisites?: {
                service: string;
                category: string;
                purpose: string;
                userSetup: string;
                readinessCheck: string;
                canAgentProceedWithoutIt: boolean;
            }[] | undefined;
            verification?: {
                item: string;
                method: "test" | "command" | "grep" | "file-read" | "artifact-validation";
                evidence: string;
            }[] | undefined;
            evidence?: {
                artifact: string;
                rationale: string;
            }[] | undefined;
            unknownsAndDeferrals?: {
                item: string;
                disposition: "unknown" | "none" | "deferred" | "blocked";
                rationale: string;
                followUp: string;
            }[] | undefined;
        }[];
        deferrals?: {
            requirement: string;
            rationale: string;
            followUp: string;
        }[] | undefined;
    };
    validationRules: {
        reject: string[];
        advisory: string[];
        normalize: string[];
    };
    derivedFields: string[];
    exampleNote: string;
} | {
    mode: "replace" | "add" | "revise";
    targetPlanIds: string[];
    knownRequirements: string[];
    knownEvidenceArtifacts: string[];
    nextAction: string | null;
    revision: number;
    sessionPath: string;
    schema: Record<string, unknown>;
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
    grounding: {
        lockedDecisions: string;
        phaseBoundary: string;
        dependencies: string;
        discoveryGrounding: string;
        projectConstraints: string[];
    };
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
    example: {
        plans: {
            title: string;
            goal: string;
            tasks: {
                title: string;
                filesModified: string[];
                requirements: string[];
                action: string[];
                acceptanceCriteria: string[];
                id?: string | undefined;
                readFirst?: string[] | undefined;
            }[];
            key?: string | undefined;
            scope?: string[] | undefined;
            dependsOn?: string[] | undefined;
            mustHaves?: string[] | undefined;
            autonomous?: boolean | undefined;
            gapClosure?: boolean | undefined;
            externalServicePrerequisites?: {
                service: string;
                category: string;
                purpose: string;
                userSetup: string;
                readinessCheck: string;
                canAgentProceedWithoutIt: boolean;
            }[] | undefined;
            verification?: {
                item: string;
                method: "test" | "command" | "grep" | "file-read" | "artifact-validation";
                evidence: string;
            }[] | undefined;
            evidence?: {
                artifact: string;
                rationale: string;
            }[] | undefined;
            unknownsAndDeferrals?: {
                item: string;
                disposition: "unknown" | "none" | "deferred" | "blocked";
                rationale: string;
                followUp: string;
            }[] | undefined;
        }[];
        deferrals?: {
            requirement: string;
            rationale: string;
            followUp: string;
        }[] | undefined;
    };
    validationRules: {
        reject: string[];
        advisory: string[];
        normalize: string[];
    };
    derivedFields: string[];
    exampleNote: string;
} | {
    status: string;
    reason: string;
    nextAction: string | null;
}>;
export declare function blueprintPlanRead(raw: z.input<typeof lookupSchema>): Promise<{
    status: string;
    sessionPath: string;
    session: PlanSession | null;
    published: {
        content: string | null;
        path: string;
        hash: string | null;
    }[];
    publication: import("./plan-publication.js").PlanPublicationStatus;
    freshness: {
        status: string;
        stalePaths: string[];
        unknownPaths: string[];
    } | null;
}>;
export declare const planDependencies: {
    compile: typeof compilePlanCandidate;
    validate: typeof validatePhasePlanCandidateSet;
    writeText: typeof writeTextFile;
    remove: (path: string) => Promise<void>;
    stateUpdate: typeof blueprintStateUpdate;
    stateLoad: typeof blueprintStateLoad;
};
export declare function blueprintPlanSubmit(raw: z.input<typeof submitInput>): Promise<{
    status: "published";
    saved: true;
    ready: true;
    revision: number;
    sessionPath: string;
    paths: string[];
    plans: {
        planId: string;
        wave: number;
        taskCount: number;
        path: string;
    }[];
    removedPaths: string[];
    stages: Partial<Record<"files" | "state" | "routing" | "commit", "complete" | "intent">>;
    nextAction: string;
} | {
    revision: number;
    sessionPath: string;
    status: string;
    saved: boolean;
    ready: boolean;
    outcome: string;
} | {
    status: string;
    saved: boolean;
    nextAction: string;
} | {
    reason: string;
    nextAction: string;
    revision: number;
    sessionPath: string;
    status: string;
    saved: boolean;
    ready: boolean;
} | {
    stages: Partial<Record<"files" | "state" | "routing" | "commit", "complete" | "intent">>;
    reason: string;
    nextAction: string;
    revision: number;
    sessionPath: string;
    status: string;
    saved: boolean;
    ready: boolean;
}>;
export declare const planningToolDefinitions: ToolDefinition[];
export {};
