import * as z from "zod/v4";
import type { ToolDefinition } from "../tool-types.js";
import { writeTextFile } from "./artifacts.js";
import { validatePhasePlanCandidateSet } from "./phase.js";
import { compilePlanCandidate } from "./plan-model.js";
import { blueprintStateLoad, blueprintStateUpdate } from "./state.js";
import { type PortableProviderEvidenceBasis } from "../codebase-index/provider-evidence.js";
export declare const PLAN_ORDINARY_EVIDENCE_BODY_BYTES: number;
export declare const PLAN_READ_BODY_PAGE_BYTES: number;
export declare const PLAN_READ_TIME_EVIDENCE_BYTES: number;
export declare const PLAN_READ_TIME_EVIDENCE_ITEM_BYTES: number;
export declare const PLAN_READ_TIME_EVIDENCE_MAX_ITEMS = 33;
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
    portableSelections: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        kind: z.ZodLiteral<"page">;
        path: z.ZodString;
        mode: z.ZodLiteral<"discovery">;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodEnum<{
            symbol: "symbol";
            file: "file";
            import: "import";
            relationship: "relationship";
            detail: "detail";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodEnum<{
            alias: "alias";
            capability: "capability";
            claim: "claim";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"structural">;
        recordKind: z.ZodEnum<{
            symbol: "symbol";
            file: "file";
            import: "import";
            relationship: "relationship";
            detail: "detail";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"semantic">;
        recordKind: z.ZodEnum<{
            alias: "alias";
            capability: "capability";
            claim: "claim";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>]>>>;
    evidenceDelivery: z.ZodOptional<z.ZodObject<{
        mode: z.ZodEnum<{
            full: "full";
            delta: "delta";
            register: "register";
        }>;
        readTimeEvidence: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            hash: z.ZodOptional<z.ZodString>;
            bytes: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>>;
        continuations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            offsetBytes: z.ZodNumber;
            totalBytes: z.ZodNumber;
            hash: z.ZodString;
            revision: z.ZodNumber;
            basisHash: z.ZodString;
            seal: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
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
    bodyMode: z.ZodOptional<z.ZodEnum<{
        metadata: "metadata";
        page: "page";
    }>>;
    planIds: z.ZodOptional<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    bodyCursor: z.ZodOptional<z.ZodObject<{
        planId: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        offsetBytes: z.ZodNumber;
        totalBytes: z.ZodNumber;
        planHash: z.ZodString;
        publicationToken: z.ZodString;
        filterHash: z.ZodString;
        seal: z.ZodString;
    }, z.core.$strict>>;
    bodyByteLimit: z.ZodOptional<z.ZodNumber>;
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
    saved?: undefined;
    ready?: undefined;
    paths?: undefined;
    reason?: undefined;
    counts?: undefined;
    scopeReduction?: undefined;
} | {
    reason: string;
    revision: number;
    sessionPath: string;
    status: string;
    saved?: undefined;
    ready?: undefined;
    paths?: undefined;
    nextAction?: undefined;
    counts?: undefined;
    scopeReduction?: undefined;
} | {
    status: string;
    saved: boolean;
    ready: boolean;
    paths: string[];
    reason: string;
    nextAction: string;
    counts?: undefined;
    scopeReduction?: undefined;
} | {
    nextAction: string;
    scopeReduction?: {
        selectedCount: number;
        suggestedMaxCount?: number;
        omittedBodyCount: number;
        omittedPathCount?: number;
    } | undefined;
    counts?: import("../evidence-delivery.js").EvidenceDeliveryCounts | undefined;
    code?: string | undefined;
    status: "reread_required" | "evidence_limit" | "fallback" | "invalid" | "not-found";
    saved: boolean;
    ready: boolean;
    reason: string;
    paths: readonly string[];
} | {
    status: string;
    saved: boolean;
    ready: boolean;
    counts: {
        selectedCount: number;
        sourceCount: number;
        readSetCount: number;
        deliveredCount: number;
        omittedCount: number;
        packetBytes: number;
    };
    scopeReduction: {
        selectedCount: number;
        suggestedMaxCount: number;
        omittedBodyCount: number;
        omittedPathCount: number;
    };
    reason: string;
    nextAction: string;
    paths?: undefined;
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
    saved?: undefined;
    ready?: undefined;
    paths?: undefined;
    reason?: undefined;
    counts?: undefined;
    scopeReduction?: undefined;
} | {
    nextAction: string;
    revision: number;
    sessionPath: string;
    status: string;
    portable?: {
        selections: ({
            kind: "page";
            path: string;
            mode: "discovery";
        } | {
            kind: "symbol" | "file" | "import" | "relationship" | "detail";
            recordId: string;
        } | {
            kind: "alias" | "capability" | "claim";
            recordId: string;
        } | {
            kind: "structural";
            recordKind: "symbol" | "file" | "import" | "relationship" | "detail";
            recordId: string;
        } | {
            kind: "semantic";
            recordKind: "alias" | "capability" | "claim";
            recordId: string;
        })[];
        basis: PortableProviderEvidenceBasis;
        next: {
            readSet: import("../codebase-index/provider-evidence.js").PortableProviderEvidenceReadSet;
            schemaVersion: 1;
            bound: readonly import("../evidence-delivery.js").EvidenceIdentity[];
            bindingHash: string;
            delivered: readonly import("../evidence-delivery.js").EvidenceIdentity[];
            registered: readonly import("../evidence-delivery.js").EvidenceIdentity[];
        };
        packet: import("../evidence-delivery.js").EvidencePacket;
        binding: import("../evidence-delivery.js").PriorEvidenceBinding;
        counts: import("../evidence-delivery.js").EvidenceDeliveryCounts;
        mode: "full" | "delta" | "register";
    } | undefined;
    evidence: {
        [x: string]: unknown;
    }[];
    evidenceBudget: {
        ordinary: {
            continuations: {
                seal: string;
                path: string;
                offsetBytes: number;
                totalBytes: number;
                hash: string;
                revision: number;
                basisHash: string;
            }[];
            maxBodyBytes: number;
            deliveredBodyBytes: number;
        };
        portable: {
            maxPacketBytes: number;
            deliveredPacketBytes: number;
        };
        aggregate: {
            maxPayloadBytes: number;
            deliveredPayloadBytes: number;
        };
    };
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
                method: "grep" | "test" | "command" | "file-read" | "artifact-validation";
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
    saved?: undefined;
    ready?: undefined;
    paths?: undefined;
    reason?: undefined;
    counts?: undefined;
    scopeReduction?: undefined;
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
    portable?: {
        selections: ({
            kind: "page";
            path: string;
            mode: "discovery";
        } | {
            kind: "symbol" | "file" | "import" | "relationship" | "detail";
            recordId: string;
        } | {
            kind: "alias" | "capability" | "claim";
            recordId: string;
        } | {
            kind: "structural";
            recordKind: "symbol" | "file" | "import" | "relationship" | "detail";
            recordId: string;
        } | {
            kind: "semantic";
            recordKind: "alias" | "capability" | "claim";
            recordId: string;
        })[];
        basis: PortableProviderEvidenceBasis;
        next: import("../codebase-index/provider-evidence.js").PortableProviderEvidenceNext;
        packet: import("../evidence-delivery.js").EvidencePacket;
        binding: {
            pinnedGeneration: string;
            identities: {
                path: string;
                hash: string;
                generation: string;
            }[];
            hash: string;
        };
        counts: import("../evidence-delivery.js").EvidenceDeliveryCounts;
        mode: "full" | "delta" | "register";
    } | {
        selections: ({
            kind: "page";
            path: string;
            mode: "discovery";
        } | {
            kind: "symbol" | "file" | "import" | "relationship" | "detail";
            recordId: string;
        } | {
            kind: "alias" | "capability" | "claim";
            recordId: string;
        } | {
            kind: "structural";
            recordKind: "symbol" | "file" | "import" | "relationship" | "detail";
            recordId: string;
        } | {
            kind: "semantic";
            recordKind: "alias" | "capability" | "claim";
            recordId: string;
        })[];
        basis: PortableProviderEvidenceBasis;
        next: {
            readSet: import("../codebase-index/provider-evidence.js").PortableProviderEvidenceReadSet;
            schemaVersion: 1;
            bound: readonly import("../evidence-delivery.js").EvidenceIdentity[];
            bindingHash: string;
            delivered: readonly import("../evidence-delivery.js").EvidenceIdentity[];
            registered: readonly import("../evidence-delivery.js").EvidenceIdentity[];
        };
        packet: import("../evidence-delivery.js").EvidencePacket;
        binding: import("../evidence-delivery.js").PriorEvidenceBinding;
        counts: import("../evidence-delivery.js").EvidenceDeliveryCounts;
        mode: "full" | "delta" | "register";
    } | undefined;
    evidence: {
        [x: string]: unknown;
    }[];
    evidenceBudget: {
        ordinary: {
            continuations: {
                seal: string;
                path: string;
                offsetBytes: number;
                totalBytes: number;
                hash: string;
                revision: number;
                basisHash: string;
            }[];
            maxBodyBytes: number;
            deliveredBodyBytes: number;
        };
        portable: {
            maxPacketBytes: number;
            deliveredPacketBytes: number;
        };
        aggregate: {
            maxPayloadBytes: number;
            deliveredPayloadBytes: number;
        };
    };
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
                method: "grep" | "test" | "command" | "file-read" | "artifact-validation";
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
    saved?: undefined;
    ready?: undefined;
    paths?: undefined;
    reason?: undefined;
    counts?: undefined;
    scopeReduction?: undefined;
} | {
    status: string;
    reason: string;
    nextAction: string | null;
}>;
export declare function blueprintPlanRead(raw: z.input<typeof lookupSchema>): Promise<{
    status: string;
    sessionPath: string;
    session: {
        legacyPublication?: {
            markerToken: string;
        } | undefined;
        journal?: {
            receipt?: {
                status: "published";
                saved: true;
                ready: true;
                revision: number;
                pathCount: number;
                planCount: number;
                removedPathCount: number;
            } | undefined;
            requestId: string;
            revision: number;
            stages: Partial<Record<"files" | "state" | "routing" | "commit", "complete" | "intent">>;
        } | undefined;
        delivery?: {
            deliveredCount: number;
            registeredCount: number;
        } | undefined;
        portable?: {
            selectionCount: number;
            generationId: string;
            bindingHash: string;
        } | undefined;
        version: 2;
        phase: string;
        revision: number;
        prepared: boolean;
        needsIntent: boolean;
        publicationOwned: boolean;
        mode: "replace" | "add" | "revise";
        targetPlanIds: string[];
        checkerRequired: boolean;
        existingPlans: {
            planId: string;
            wave: number;
            dependsOn: string[];
            requirements: string[];
            counts: {
                dependsOn: number;
                requirements: number;
            };
        }[];
        metadataScope: {
            filtered: boolean;
            planIds: string[];
            truncated: boolean;
        };
        counts: {
            readSet: number;
            evidencePaths: number;
            targets: number;
            knownRequirements: number;
            knownEvidenceArtifacts: number;
            requests: number;
            targetPlanIds: number;
            scopedTargetPlanIds: number;
            existingPlans: number;
            scopedExistingPlans: number;
        };
    } | null;
    published: ({
        contentOffsetBytes?: number | undefined;
        contentComplete?: boolean | undefined;
        content: string | null;
        path: string;
        hash: string;
    } | {
        contentOffsetBytes?: number | undefined;
        contentComplete?: boolean | undefined;
        content: string | null;
        path: string;
        hash: string | null;
    })[];
    publication: {
        status: "invalid" | "absent" | "pending" | "committed";
        token: string;
        reason: string | null;
    };
    bodyPage: {
        mode: "metadata" | "page";
        maxBytes: number;
        deliveredBytes: number;
        nextCursor: {
            planId: string;
            offsetBytes: number;
            totalBytes: number;
            planHash: string;
            publicationToken: string;
            filterHash: string;
            seal: string;
        } | null;
    };
    freshness: {
        status: string;
        stalePaths: string[];
        unknownPaths: string[];
        stalePathCount: number;
        unknownPathCount: number;
        truncated: boolean;
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
