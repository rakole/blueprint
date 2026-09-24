import * as z from "zod/v4";
import { type PhaseTopologyFingerprint } from "./phase-topology-lock.js";
import { blueprintPhaseArtifactWrite } from "./phase-artifacts.js";
import { blueprintPhaseCheckpointDelete } from "./phase-checkpoints.js";
import { type PhaseContextModelDefaults } from "./phase-context-model.js";
import { blueprintStateUpdate, blueprintStateLoad } from "./state.js";
import { type DiscussOrdinaryDelivery, type DiscussPortableMetadata } from "./discuss-evidence.js";
import type { ToolDefinition } from "../tool-types.js";
declare const recordSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        deferred: "deferred";
        decision: "decision";
        "open-question": "open-question";
    }>;
    value: z.ZodString;
    rationale: z.ZodDefault<z.ZodString>;
    evidence: z.ZodDefault<z.ZodArray<z.ZodString>>;
    rejectedOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    blocking: z.ZodOptional<z.ZodBoolean>;
    downstreamOwner: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        deferred: "deferred";
        resolved: "resolved";
        open: "open";
        accepted: "accepted";
    }>>;
}, z.core.$strip>;
export type DiscussRecord = z.infer<typeof recordSchema>;
type Basis = {
    readSet: Array<{
        path: string;
        hash: string | null;
    }>;
    prepared: boolean;
    evidencePaths?: string[];
    portable?: DiscussPortableMetadata;
    ordinaryDelivery?: DiscussOrdinaryDelivery;
};
type Event = {
    revision: number;
    requestId: string;
    records?: DiscussRecord[];
    kind: string;
    basis?: Basis;
    baseline?: DiscussSession["baseline"];
};
type Journal = {
    requestId: string;
    requestHash: string;
    revision: number;
    context: {
        path: string;
        hash: string;
    };
    log?: {
        path: string;
        hash: string;
    };
    stages: Record<string, "intent" | "complete">;
    complete?: boolean;
    modelHash?: string;
};
export type DiscussSession = {
    version: 2;
    phase: string;
    topology: PhaseTopologyFingerprint;
    revision: number;
    basis: Basis;
    baseline: {
        context: string | null;
        log: string | null;
    };
    records: DiscussRecord[];
    history: Event[];
    requests: Record<string, {
        hash: string;
        revision: number;
    }>;
    journal?: Journal;
};
type Lookup = {
    cwd?: string;
    phase: string | number;
};
declare const recordInput: z.ZodObject<{
    requestId: z.ZodString;
    expectedRevision: z.ZodNumber;
    records: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            deferred: "deferred";
            decision: "decision";
            "open-question": "open-question";
        }>;
        value: z.ZodString;
        rationale: z.ZodDefault<z.ZodString>;
        evidence: z.ZodDefault<z.ZodArray<z.ZodString>>;
        rejectedOptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        blocking: z.ZodOptional<z.ZodBoolean>;
        downstreamOwner: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<{
            deferred: "deferred";
            resolved: "resolved";
            open: "open";
            accepted: "accepted";
        }>>;
    }, z.core.$strip>>>;
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strict>;
declare const finalizeInput: z.ZodObject<{
    requestId: z.ZodString;
    expectedRevision: z.ZodNumber;
    model: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    overwrite: z.ZodOptional<z.ZodBoolean>;
    includeLog: z.ZodOptional<z.ZodBoolean>;
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strip>;
/** Runtime-only prepare hook. Call only after resolving/reading the authoritative input packet.
 * No model-facing flag can assert freshness. Changed evidence requires a new prepare packet. */
export declare function prepareDiscussInputBasis(args: Lookup & {
    readSet: Array<{
        path: string;
        hash: string | null;
    }>;
    evidencePaths?: string[];
    portable?: DiscussPortableMetadata;
    ordinaryDelivery?: DiscussOrdinaryDelivery;
    expectedRevision?: number;
    acknowledgeChangedInputs?: boolean;
    targetHashes?: {
        context: string | null;
        log: string | null;
    };
    reconcile?: {
        confirmed: true;
        contextHash: string | null;
        logHash: string | null;
    };
}): Promise<{
    status: string;
    reason: string;
    revision?: undefined;
    affectedRecordIds?: undefined;
    freshness?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    status: string;
    revision: number;
    reason: string;
    affectedRecordIds: string[];
    freshness?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    status: string;
    freshness: {
        status: string;
        stalePaths: string[];
        unknownPaths: string[];
        warnings: string[];
    };
    reason?: undefined;
    revision?: undefined;
    affectedRecordIds?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    status: string;
    revision: number;
    changedPaths: string[];
    affectedRecordIds: string[];
    nextAction: string;
    reason?: undefined;
    freshness?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    status: string;
    revision: number;
    path: string;
    reused: boolean;
    reason?: undefined;
    affectedRecordIds?: undefined;
    freshness?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
} | {
    status: string;
    nextAction: string;
    reason?: undefined;
    revision?: undefined;
    affectedRecordIds?: undefined;
    freshness?: undefined;
    changedPaths?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    status: string;
    revision: number;
    path: string;
    reason?: undefined;
    affectedRecordIds?: undefined;
    freshness?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
    reused?: undefined;
}>;
export declare function blueprintDiscussRecord(raw: z.input<typeof recordInput>): Promise<{
    status: string;
    reason: string;
    revision: number;
    currentRevision?: undefined;
    path?: undefined;
    nextAction?: undefined;
} | {
    status: string;
    revision: number;
    currentRevision: number;
    path: string;
    reason?: undefined;
    nextAction?: undefined;
} | {
    status: string;
    nextAction: string;
    reason?: undefined;
    revision?: undefined;
    currentRevision?: undefined;
    path?: undefined;
} | {
    status: string;
    revision: number;
    path: string;
    reason?: undefined;
    currentRevision?: undefined;
    nextAction?: undefined;
}>;
export declare function blueprintDiscussRead(args: Lookup): Promise<{
    status: string;
    path: string;
    session: DiscussSession | null;
}>;
export declare const discussFinalizeDependencies: {
    artifactWrite: typeof blueprintPhaseArtifactWrite;
    stateUpdate: typeof blueprintStateUpdate;
    stateLoad: typeof blueprintStateLoad;
    checkpointDelete: typeof blueprintPhaseCheckpointDelete;
};
export declare function blueprintDiscussFinalize(raw: z.input<typeof finalizeInput>): Promise<{
    saved: boolean;
    outcome: string;
    status: string;
    revision: number;
    path: string;
    stages: {
        [x: string]: "complete" | "intent";
    };
    contextPath: string;
    logPath: string | null;
    coveredRecordIds: string[];
    state: {
        state: import("./state.js").BlueprintState;
        metadata: import("./state.js").BlueprintStateMetadata;
        blockers: string[];
        warnings?: string[];
        derivedStatus: {
            projectStatus: string;
            currentPhase: string | null;
            nextAction: string;
            hasBlockers: boolean;
            milestoneAudit: {
                found: boolean;
                verdict: "READY_TO_CLOSE" | "FOLLOW_UP" | "BLOCKED" | null;
                gapSections: {
                    requirement: {
                        gapId: string;
                        surface: string;
                        evidence: string;
                        repair: string;
                    }[];
                    integration: {
                        gapId: string;
                        surface: string;
                        evidence: string;
                        repair: string;
                    }[];
                    flow: {
                        gapId: string;
                        surface: string;
                        evidence: string;
                        repair: string;
                    }[];
                    optional: {
                        gapId: string;
                        surface: string;
                        evidence: string;
                        repair: string;
                    }[];
                };
                hasActionableGaps: boolean;
                hasArchivalBlockers: boolean;
                nextSafeAction: string | null;
                readyForCompletion: boolean;
            };
        };
    };
    warnings: string[];
    nextAction: string;
} | {
    status: string;
    saved: boolean;
    outcome: string;
    nextAction: string;
    reason?: undefined;
    revision?: undefined;
    diagnostics?: undefined;
    blockers?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    status: string;
    saved: boolean;
    outcome: string;
    reason: string;
    nextAction?: undefined;
    revision?: undefined;
    diagnostics?: undefined;
    blockers?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    status: string;
    saved: boolean;
    outcome: string;
    reason: string;
    revision: number;
    nextAction?: undefined;
    diagnostics?: undefined;
    blockers?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    status: string;
    saved: boolean;
    outcome: string;
    reason: string;
    nextAction: string;
    revision?: undefined;
    diagnostics?: undefined;
    blockers?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    saved: boolean;
    status: "blocked";
    selection: import("./phase-tool-types.js").PhaseLocateResult;
    reason: string | null;
    changedPaths?: undefined;
    outcome?: undefined;
    nextAction?: undefined;
    revision?: undefined;
    diagnostics?: undefined;
    blockers?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    saved: boolean;
    status: "blocked";
    reason: string;
    selection?: undefined;
    changedPaths?: undefined;
    outcome?: undefined;
    nextAction?: undefined;
    revision?: undefined;
    diagnostics?: undefined;
    blockers?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    saved: boolean;
    status: "stale";
    reason: string;
    changedPaths: string[];
    selection?: undefined;
    outcome?: undefined;
    nextAction?: undefined;
    revision?: undefined;
    diagnostics?: undefined;
    blockers?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    saved: boolean;
    root: string;
    phase: string;
    changedPaths: readonly string[];
    status: "fallback" | "invalid" | "not-found" | "reread_required" | "evidence_limit";
    code: string;
    reason: string;
    paths: readonly string[];
    diagnostics?: readonly unknown[];
    counts?: import("../evidence-delivery.js").EvidenceDeliverySuccess["counts"];
    scopeReduction?: import("../evidence-delivery.js").EvidenceDeliveryFailure["scopeReduction"];
    selection?: undefined;
    outcome?: undefined;
    nextAction?: undefined;
    revision?: undefined;
    blockers?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    saved: boolean;
    status: "invalid";
    reason: string;
    changedPaths: string[];
    selection?: undefined;
    outcome?: undefined;
    nextAction?: undefined;
    revision?: undefined;
    diagnostics?: undefined;
    blockers?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    status: string;
    saved: boolean;
    outcome: string;
    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
    blockers: string[];
    nextAction: string;
    reason?: undefined;
    revision?: undefined;
    freshness?: undefined;
    stages?: undefined;
} | {
    status: string;
    saved: boolean;
    outcome: string;
    freshness: {
        status: string;
        stalePaths: string[];
        unknownPaths: string[];
        warnings: string[];
    };
    nextAction: string;
    reason?: undefined;
    revision?: undefined;
    diagnostics?: undefined;
    blockers?: undefined;
    stages?: undefined;
} | {
    status: string;
    saved: boolean;
    outcome: string;
    revision: number;
    stages: Record<string, "complete" | "intent">;
    reason: string;
    nextAction: string;
    diagnostics?: undefined;
    blockers?: undefined;
    freshness?: undefined;
} | {
    status: string;
    saved: boolean;
    outcome: string;
    diagnostics: {
        path: string;
        message: string;
    }[];
}>;
declare const prepareInput: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    evidencePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
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
    }, z.core.$strict>>;
    expectedRevision: z.ZodOptional<z.ZodNumber>;
    acknowledgeChangedInputs: z.ZodOptional<z.ZodBoolean>;
    reconcile: z.ZodOptional<z.ZodObject<{
        confirmed: z.ZodLiteral<true>;
        contextHash: z.ZodNullable<z.ZodString>;
        logHash: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare function blueprintDiscussPrepare(raw: z.input<typeof prepareInput>): Promise<{
    status: "blocked";
    selection: import("./phase-tool-types.js").PhaseLocateResult;
    reason: string | null;
    changedPaths?: undefined;
} | {
    status: "blocked";
    reason: string;
    selection?: undefined;
    changedPaths?: undefined;
} | {
    status: "stale";
    reason: string;
    changedPaths: string[];
    selection?: undefined;
} | {
    root: string;
    phase: string;
    changedPaths: readonly string[];
    status: "fallback" | "invalid" | "not-found" | "reread_required" | "evidence_limit";
    code: string;
    reason: string;
    paths: readonly string[];
    diagnostics?: readonly unknown[];
    counts?: import("../evidence-delivery.js").EvidenceDeliverySuccess["counts"];
    scopeReduction?: import("../evidence-delivery.js").EvidenceDeliveryFailure["scopeReduction"];
    selection?: undefined;
} | {
    status: "invalid";
    reason: string;
    changedPaths: string[];
    selection?: undefined;
} | {
    packet: {
        sources: ({
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        } | {
            content: undefined;
            path: string;
            hash: string;
        } | {
            content: undefined;
            path: string;
            hash: null;
        })[];
        priorContextPaths: string[];
        omittedPriorPhases: string[];
        checkpoint: {
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        };
        planInventory: string[];
        warnings: string[];
        portableEvidence?: import("../evidence-delivery.js").EvidencePacket | undefined;
        selectedPhase: {
            phaseNumber: string;
            phasePrefix: string;
            phaseName: string;
            completed: boolean;
            summary: string | null;
            goal: string | null;
            successCriteria: string | null;
            requirements: string[];
            phaseDir: string;
        };
        ambientCurrentPhase: string;
        config: {
            scope: "project" | "defaults" | "effective";
            config: {
                version: number;
                mode: string;
                granularity: string;
                model_profile: "quality" | "balanced" | "budget" | "inherit";
                project_code: string | null;
                phase_naming: string;
                response_language: string | null;
                planning: {
                    commit_docs: boolean;
                    search_gitignored: boolean;
                };
                ux: {
                    progress_mode: "quiet" | "stage" | "checklist";
                    structured_confirmations: "required" | "auto";
                    user_checkpoints: "phase" | "off" | "plan";
                };
                orchestration: {
                    task_tracker: "auto" | "off";
                };
                research: {
                    external_sources: "ask" | "auto" | "off";
                };
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
                parallelization: {
                    enabled: boolean;
                    plan_level: boolean;
                    task_level: boolean;
                    skip_checkpoints: boolean;
                    max_concurrent_agents: number;
                    min_plans_for_parallel: number;
                };
                git: {
                    branching_strategy: string;
                    base_branch: string | null;
                    phase_branch_template: string;
                    milestone_branch_template: string;
                    quick_branch_template: string | null;
                };
                gates: {
                    confirm_project: boolean;
                    confirm_phases: boolean;
                    confirm_roadmap: boolean;
                    confirm_breakdown: boolean;
                    confirm_plan: boolean;
                    execute_next_plan: boolean;
                    issues_review: boolean;
                    confirm_transition: boolean;
                };
                safety: {
                    always_confirm_destructive: boolean;
                    always_confirm_external_services: boolean;
                };
                maintenance: {
                    patch_registry: string;
                    workspace_root: string;
                };
                agent_skills: Record<string, unknown>;
            };
            provenance: {
                layersApplied: string[];
                defaultsPath: string | null;
                projectPath: string | null;
                defaultsApplied: boolean;
                projectApplied: boolean;
                defaultsSkipped?: boolean;
            };
            sourcePath: string | null;
            warnings: string[];
        };
        artifacts: {
            context: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            spec: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            log: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
        };
    };
    authoring: {
        schema: z.core.ZodStandardJSONSchemaPayload<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        defaults: PhaseContextModelDefaults;
        missingEssentialFields: string[];
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        examples: ({
            phaseBoundary: {
                goal: string;
                inScope: string[];
                successCriteria: string[];
                outOfScope?: undefined;
            };
            implementationDecisions?: undefined;
            openQuestions?: undefined;
            canonicalReferences?: undefined;
        } | {
            phaseBoundary: {
                goal: string;
                inScope: string[];
                outOfScope: string[];
                successCriteria: string[];
            };
            implementationDecisions: {
                decision: string;
            }[];
            openQuestions: string[];
            canonicalReferences: {
                source: string;
            }[];
        })[];
    };
    readSet: {
        path: string;
        hash: string | null;
    }[];
    session: {
        revision: number;
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        publication: {
            requestId: string;
            stages: Record<string, "complete" | "intent">;
            complete: boolean | undefined;
        } | null;
    } | null;
    status: string;
    reason: string;
    revision?: undefined;
    affectedRecordIds?: undefined;
    freshness?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    packet: {
        sources: ({
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        } | {
            content: undefined;
            path: string;
            hash: string;
        } | {
            content: undefined;
            path: string;
            hash: null;
        })[];
        priorContextPaths: string[];
        omittedPriorPhases: string[];
        checkpoint: {
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        };
        planInventory: string[];
        warnings: string[];
        portableEvidence?: import("../evidence-delivery.js").EvidencePacket | undefined;
        selectedPhase: {
            phaseNumber: string;
            phasePrefix: string;
            phaseName: string;
            completed: boolean;
            summary: string | null;
            goal: string | null;
            successCriteria: string | null;
            requirements: string[];
            phaseDir: string;
        };
        ambientCurrentPhase: string;
        config: {
            scope: "project" | "defaults" | "effective";
            config: {
                version: number;
                mode: string;
                granularity: string;
                model_profile: "quality" | "balanced" | "budget" | "inherit";
                project_code: string | null;
                phase_naming: string;
                response_language: string | null;
                planning: {
                    commit_docs: boolean;
                    search_gitignored: boolean;
                };
                ux: {
                    progress_mode: "quiet" | "stage" | "checklist";
                    structured_confirmations: "required" | "auto";
                    user_checkpoints: "phase" | "off" | "plan";
                };
                orchestration: {
                    task_tracker: "auto" | "off";
                };
                research: {
                    external_sources: "ask" | "auto" | "off";
                };
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
                parallelization: {
                    enabled: boolean;
                    plan_level: boolean;
                    task_level: boolean;
                    skip_checkpoints: boolean;
                    max_concurrent_agents: number;
                    min_plans_for_parallel: number;
                };
                git: {
                    branching_strategy: string;
                    base_branch: string | null;
                    phase_branch_template: string;
                    milestone_branch_template: string;
                    quick_branch_template: string | null;
                };
                gates: {
                    confirm_project: boolean;
                    confirm_phases: boolean;
                    confirm_roadmap: boolean;
                    confirm_breakdown: boolean;
                    confirm_plan: boolean;
                    execute_next_plan: boolean;
                    issues_review: boolean;
                    confirm_transition: boolean;
                };
                safety: {
                    always_confirm_destructive: boolean;
                    always_confirm_external_services: boolean;
                };
                maintenance: {
                    patch_registry: string;
                    workspace_root: string;
                };
                agent_skills: Record<string, unknown>;
            };
            provenance: {
                layersApplied: string[];
                defaultsPath: string | null;
                projectPath: string | null;
                defaultsApplied: boolean;
                projectApplied: boolean;
                defaultsSkipped?: boolean;
            };
            sourcePath: string | null;
            warnings: string[];
        };
        artifacts: {
            context: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            spec: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            log: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
        };
    };
    authoring: {
        schema: z.core.ZodStandardJSONSchemaPayload<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        defaults: PhaseContextModelDefaults;
        missingEssentialFields: string[];
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        examples: ({
            phaseBoundary: {
                goal: string;
                inScope: string[];
                successCriteria: string[];
                outOfScope?: undefined;
            };
            implementationDecisions?: undefined;
            openQuestions?: undefined;
            canonicalReferences?: undefined;
        } | {
            phaseBoundary: {
                goal: string;
                inScope: string[];
                outOfScope: string[];
                successCriteria: string[];
            };
            implementationDecisions: {
                decision: string;
            }[];
            openQuestions: string[];
            canonicalReferences: {
                source: string;
            }[];
        })[];
    };
    readSet: {
        path: string;
        hash: string | null;
    }[];
    session: {
        revision: number;
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        publication: {
            requestId: string;
            stages: Record<string, "complete" | "intent">;
            complete: boolean | undefined;
        } | null;
    } | null;
    status: string;
    revision: number;
    reason: string;
    affectedRecordIds: string[];
    freshness?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    packet: {
        sources: ({
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        } | {
            content: undefined;
            path: string;
            hash: string;
        } | {
            content: undefined;
            path: string;
            hash: null;
        })[];
        priorContextPaths: string[];
        omittedPriorPhases: string[];
        checkpoint: {
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        };
        planInventory: string[];
        warnings: string[];
        portableEvidence?: import("../evidence-delivery.js").EvidencePacket | undefined;
        selectedPhase: {
            phaseNumber: string;
            phasePrefix: string;
            phaseName: string;
            completed: boolean;
            summary: string | null;
            goal: string | null;
            successCriteria: string | null;
            requirements: string[];
            phaseDir: string;
        };
        ambientCurrentPhase: string;
        config: {
            scope: "project" | "defaults" | "effective";
            config: {
                version: number;
                mode: string;
                granularity: string;
                model_profile: "quality" | "balanced" | "budget" | "inherit";
                project_code: string | null;
                phase_naming: string;
                response_language: string | null;
                planning: {
                    commit_docs: boolean;
                    search_gitignored: boolean;
                };
                ux: {
                    progress_mode: "quiet" | "stage" | "checklist";
                    structured_confirmations: "required" | "auto";
                    user_checkpoints: "phase" | "off" | "plan";
                };
                orchestration: {
                    task_tracker: "auto" | "off";
                };
                research: {
                    external_sources: "ask" | "auto" | "off";
                };
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
                parallelization: {
                    enabled: boolean;
                    plan_level: boolean;
                    task_level: boolean;
                    skip_checkpoints: boolean;
                    max_concurrent_agents: number;
                    min_plans_for_parallel: number;
                };
                git: {
                    branching_strategy: string;
                    base_branch: string | null;
                    phase_branch_template: string;
                    milestone_branch_template: string;
                    quick_branch_template: string | null;
                };
                gates: {
                    confirm_project: boolean;
                    confirm_phases: boolean;
                    confirm_roadmap: boolean;
                    confirm_breakdown: boolean;
                    confirm_plan: boolean;
                    execute_next_plan: boolean;
                    issues_review: boolean;
                    confirm_transition: boolean;
                };
                safety: {
                    always_confirm_destructive: boolean;
                    always_confirm_external_services: boolean;
                };
                maintenance: {
                    patch_registry: string;
                    workspace_root: string;
                };
                agent_skills: Record<string, unknown>;
            };
            provenance: {
                layersApplied: string[];
                defaultsPath: string | null;
                projectPath: string | null;
                defaultsApplied: boolean;
                projectApplied: boolean;
                defaultsSkipped?: boolean;
            };
            sourcePath: string | null;
            warnings: string[];
        };
        artifacts: {
            context: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            spec: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            log: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
        };
    };
    authoring: {
        schema: z.core.ZodStandardJSONSchemaPayload<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        defaults: PhaseContextModelDefaults;
        missingEssentialFields: string[];
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        examples: ({
            phaseBoundary: {
                goal: string;
                inScope: string[];
                successCriteria: string[];
                outOfScope?: undefined;
            };
            implementationDecisions?: undefined;
            openQuestions?: undefined;
            canonicalReferences?: undefined;
        } | {
            phaseBoundary: {
                goal: string;
                inScope: string[];
                outOfScope: string[];
                successCriteria: string[];
            };
            implementationDecisions: {
                decision: string;
            }[];
            openQuestions: string[];
            canonicalReferences: {
                source: string;
            }[];
        })[];
    };
    readSet: {
        path: string;
        hash: string | null;
    }[];
    session: {
        revision: number;
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        publication: {
            requestId: string;
            stages: Record<string, "complete" | "intent">;
            complete: boolean | undefined;
        } | null;
    } | null;
    status: string;
    freshness: {
        status: string;
        stalePaths: string[];
        unknownPaths: string[];
        warnings: string[];
    };
    reason?: undefined;
    revision?: undefined;
    affectedRecordIds?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    packet: {
        sources: ({
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        } | {
            content: undefined;
            path: string;
            hash: string;
        } | {
            content: undefined;
            path: string;
            hash: null;
        })[];
        priorContextPaths: string[];
        omittedPriorPhases: string[];
        checkpoint: {
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        };
        planInventory: string[];
        warnings: string[];
        portableEvidence?: import("../evidence-delivery.js").EvidencePacket | undefined;
        selectedPhase: {
            phaseNumber: string;
            phasePrefix: string;
            phaseName: string;
            completed: boolean;
            summary: string | null;
            goal: string | null;
            successCriteria: string | null;
            requirements: string[];
            phaseDir: string;
        };
        ambientCurrentPhase: string;
        config: {
            scope: "project" | "defaults" | "effective";
            config: {
                version: number;
                mode: string;
                granularity: string;
                model_profile: "quality" | "balanced" | "budget" | "inherit";
                project_code: string | null;
                phase_naming: string;
                response_language: string | null;
                planning: {
                    commit_docs: boolean;
                    search_gitignored: boolean;
                };
                ux: {
                    progress_mode: "quiet" | "stage" | "checklist";
                    structured_confirmations: "required" | "auto";
                    user_checkpoints: "phase" | "off" | "plan";
                };
                orchestration: {
                    task_tracker: "auto" | "off";
                };
                research: {
                    external_sources: "ask" | "auto" | "off";
                };
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
                parallelization: {
                    enabled: boolean;
                    plan_level: boolean;
                    task_level: boolean;
                    skip_checkpoints: boolean;
                    max_concurrent_agents: number;
                    min_plans_for_parallel: number;
                };
                git: {
                    branching_strategy: string;
                    base_branch: string | null;
                    phase_branch_template: string;
                    milestone_branch_template: string;
                    quick_branch_template: string | null;
                };
                gates: {
                    confirm_project: boolean;
                    confirm_phases: boolean;
                    confirm_roadmap: boolean;
                    confirm_breakdown: boolean;
                    confirm_plan: boolean;
                    execute_next_plan: boolean;
                    issues_review: boolean;
                    confirm_transition: boolean;
                };
                safety: {
                    always_confirm_destructive: boolean;
                    always_confirm_external_services: boolean;
                };
                maintenance: {
                    patch_registry: string;
                    workspace_root: string;
                };
                agent_skills: Record<string, unknown>;
            };
            provenance: {
                layersApplied: string[];
                defaultsPath: string | null;
                projectPath: string | null;
                defaultsApplied: boolean;
                projectApplied: boolean;
                defaultsSkipped?: boolean;
            };
            sourcePath: string | null;
            warnings: string[];
        };
        artifacts: {
            context: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            spec: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            log: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
        };
    };
    authoring: {
        schema: z.core.ZodStandardJSONSchemaPayload<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        defaults: PhaseContextModelDefaults;
        missingEssentialFields: string[];
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        examples: ({
            phaseBoundary: {
                goal: string;
                inScope: string[];
                successCriteria: string[];
                outOfScope?: undefined;
            };
            implementationDecisions?: undefined;
            openQuestions?: undefined;
            canonicalReferences?: undefined;
        } | {
            phaseBoundary: {
                goal: string;
                inScope: string[];
                outOfScope: string[];
                successCriteria: string[];
            };
            implementationDecisions: {
                decision: string;
            }[];
            openQuestions: string[];
            canonicalReferences: {
                source: string;
            }[];
        })[];
    };
    readSet: {
        path: string;
        hash: string | null;
    }[];
    session: {
        revision: number;
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        publication: {
            requestId: string;
            stages: Record<string, "complete" | "intent">;
            complete: boolean | undefined;
        } | null;
    } | null;
    status: string;
    revision: number;
    changedPaths: string[];
    affectedRecordIds: string[];
    nextAction: string;
    reason?: undefined;
    freshness?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    packet: {
        sources: ({
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        } | {
            content: undefined;
            path: string;
            hash: string;
        } | {
            content: undefined;
            path: string;
            hash: null;
        })[];
        priorContextPaths: string[];
        omittedPriorPhases: string[];
        checkpoint: {
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        };
        planInventory: string[];
        warnings: string[];
        portableEvidence?: import("../evidence-delivery.js").EvidencePacket | undefined;
        selectedPhase: {
            phaseNumber: string;
            phasePrefix: string;
            phaseName: string;
            completed: boolean;
            summary: string | null;
            goal: string | null;
            successCriteria: string | null;
            requirements: string[];
            phaseDir: string;
        };
        ambientCurrentPhase: string;
        config: {
            scope: "project" | "defaults" | "effective";
            config: {
                version: number;
                mode: string;
                granularity: string;
                model_profile: "quality" | "balanced" | "budget" | "inherit";
                project_code: string | null;
                phase_naming: string;
                response_language: string | null;
                planning: {
                    commit_docs: boolean;
                    search_gitignored: boolean;
                };
                ux: {
                    progress_mode: "quiet" | "stage" | "checklist";
                    structured_confirmations: "required" | "auto";
                    user_checkpoints: "phase" | "off" | "plan";
                };
                orchestration: {
                    task_tracker: "auto" | "off";
                };
                research: {
                    external_sources: "ask" | "auto" | "off";
                };
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
                parallelization: {
                    enabled: boolean;
                    plan_level: boolean;
                    task_level: boolean;
                    skip_checkpoints: boolean;
                    max_concurrent_agents: number;
                    min_plans_for_parallel: number;
                };
                git: {
                    branching_strategy: string;
                    base_branch: string | null;
                    phase_branch_template: string;
                    milestone_branch_template: string;
                    quick_branch_template: string | null;
                };
                gates: {
                    confirm_project: boolean;
                    confirm_phases: boolean;
                    confirm_roadmap: boolean;
                    confirm_breakdown: boolean;
                    confirm_plan: boolean;
                    execute_next_plan: boolean;
                    issues_review: boolean;
                    confirm_transition: boolean;
                };
                safety: {
                    always_confirm_destructive: boolean;
                    always_confirm_external_services: boolean;
                };
                maintenance: {
                    patch_registry: string;
                    workspace_root: string;
                };
                agent_skills: Record<string, unknown>;
            };
            provenance: {
                layersApplied: string[];
                defaultsPath: string | null;
                projectPath: string | null;
                defaultsApplied: boolean;
                projectApplied: boolean;
                defaultsSkipped?: boolean;
            };
            sourcePath: string | null;
            warnings: string[];
        };
        artifacts: {
            context: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            spec: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            log: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
        };
    };
    authoring: {
        schema: z.core.ZodStandardJSONSchemaPayload<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        defaults: PhaseContextModelDefaults;
        missingEssentialFields: string[];
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        examples: ({
            phaseBoundary: {
                goal: string;
                inScope: string[];
                successCriteria: string[];
                outOfScope?: undefined;
            };
            implementationDecisions?: undefined;
            openQuestions?: undefined;
            canonicalReferences?: undefined;
        } | {
            phaseBoundary: {
                goal: string;
                inScope: string[];
                outOfScope: string[];
                successCriteria: string[];
            };
            implementationDecisions: {
                decision: string;
            }[];
            openQuestions: string[];
            canonicalReferences: {
                source: string;
            }[];
        })[];
    };
    readSet: {
        path: string;
        hash: string | null;
    }[];
    session: {
        revision: number;
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        publication: {
            requestId: string;
            stages: Record<string, "complete" | "intent">;
            complete: boolean | undefined;
        } | null;
    } | null;
    status: string;
    revision: number;
    path: string;
    reused: boolean;
    reason?: undefined;
    affectedRecordIds?: undefined;
    freshness?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
} | {
    packet: {
        sources: ({
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        } | {
            content: undefined;
            path: string;
            hash: string;
        } | {
            content: undefined;
            path: string;
            hash: null;
        })[];
        priorContextPaths: string[];
        omittedPriorPhases: string[];
        checkpoint: {
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        };
        planInventory: string[];
        warnings: string[];
        portableEvidence?: import("../evidence-delivery.js").EvidencePacket | undefined;
        selectedPhase: {
            phaseNumber: string;
            phasePrefix: string;
            phaseName: string;
            completed: boolean;
            summary: string | null;
            goal: string | null;
            successCriteria: string | null;
            requirements: string[];
            phaseDir: string;
        };
        ambientCurrentPhase: string;
        config: {
            scope: "project" | "defaults" | "effective";
            config: {
                version: number;
                mode: string;
                granularity: string;
                model_profile: "quality" | "balanced" | "budget" | "inherit";
                project_code: string | null;
                phase_naming: string;
                response_language: string | null;
                planning: {
                    commit_docs: boolean;
                    search_gitignored: boolean;
                };
                ux: {
                    progress_mode: "quiet" | "stage" | "checklist";
                    structured_confirmations: "required" | "auto";
                    user_checkpoints: "phase" | "off" | "plan";
                };
                orchestration: {
                    task_tracker: "auto" | "off";
                };
                research: {
                    external_sources: "ask" | "auto" | "off";
                };
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
                parallelization: {
                    enabled: boolean;
                    plan_level: boolean;
                    task_level: boolean;
                    skip_checkpoints: boolean;
                    max_concurrent_agents: number;
                    min_plans_for_parallel: number;
                };
                git: {
                    branching_strategy: string;
                    base_branch: string | null;
                    phase_branch_template: string;
                    milestone_branch_template: string;
                    quick_branch_template: string | null;
                };
                gates: {
                    confirm_project: boolean;
                    confirm_phases: boolean;
                    confirm_roadmap: boolean;
                    confirm_breakdown: boolean;
                    confirm_plan: boolean;
                    execute_next_plan: boolean;
                    issues_review: boolean;
                    confirm_transition: boolean;
                };
                safety: {
                    always_confirm_destructive: boolean;
                    always_confirm_external_services: boolean;
                };
                maintenance: {
                    patch_registry: string;
                    workspace_root: string;
                };
                agent_skills: Record<string, unknown>;
            };
            provenance: {
                layersApplied: string[];
                defaultsPath: string | null;
                projectPath: string | null;
                defaultsApplied: boolean;
                projectApplied: boolean;
                defaultsSkipped?: boolean;
            };
            sourcePath: string | null;
            warnings: string[];
        };
        artifacts: {
            context: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            spec: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            log: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
        };
    };
    authoring: {
        schema: z.core.ZodStandardJSONSchemaPayload<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        defaults: PhaseContextModelDefaults;
        missingEssentialFields: string[];
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        examples: ({
            phaseBoundary: {
                goal: string;
                inScope: string[];
                successCriteria: string[];
                outOfScope?: undefined;
            };
            implementationDecisions?: undefined;
            openQuestions?: undefined;
            canonicalReferences?: undefined;
        } | {
            phaseBoundary: {
                goal: string;
                inScope: string[];
                outOfScope: string[];
                successCriteria: string[];
            };
            implementationDecisions: {
                decision: string;
            }[];
            openQuestions: string[];
            canonicalReferences: {
                source: string;
            }[];
        })[];
    };
    readSet: {
        path: string;
        hash: string | null;
    }[];
    session: {
        revision: number;
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        publication: {
            requestId: string;
            stages: Record<string, "complete" | "intent">;
            complete: boolean | undefined;
        } | null;
    } | null;
    status: string;
    nextAction: string;
    reason?: undefined;
    revision?: undefined;
    affectedRecordIds?: undefined;
    freshness?: undefined;
    changedPaths?: undefined;
    path?: undefined;
    reused?: undefined;
} | {
    packet: {
        sources: ({
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        } | {
            content: undefined;
            path: string;
            hash: string;
        } | {
            content: undefined;
            path: string;
            hash: null;
        })[];
        priorContextPaths: string[];
        omittedPriorPhases: string[];
        checkpoint: {
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
        };
        planInventory: string[];
        warnings: string[];
        portableEvidence?: import("../evidence-delivery.js").EvidencePacket | undefined;
        selectedPhase: {
            phaseNumber: string;
            phasePrefix: string;
            phaseName: string;
            completed: boolean;
            summary: string | null;
            goal: string | null;
            successCriteria: string | null;
            requirements: string[];
            phaseDir: string;
        };
        ambientCurrentPhase: string;
        config: {
            scope: "project" | "defaults" | "effective";
            config: {
                version: number;
                mode: string;
                granularity: string;
                model_profile: "quality" | "balanced" | "budget" | "inherit";
                project_code: string | null;
                phase_naming: string;
                response_language: string | null;
                planning: {
                    commit_docs: boolean;
                    search_gitignored: boolean;
                };
                ux: {
                    progress_mode: "quiet" | "stage" | "checklist";
                    structured_confirmations: "required" | "auto";
                    user_checkpoints: "phase" | "off" | "plan";
                };
                orchestration: {
                    task_tracker: "auto" | "off";
                };
                research: {
                    external_sources: "ask" | "auto" | "off";
                };
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
                parallelization: {
                    enabled: boolean;
                    plan_level: boolean;
                    task_level: boolean;
                    skip_checkpoints: boolean;
                    max_concurrent_agents: number;
                    min_plans_for_parallel: number;
                };
                git: {
                    branching_strategy: string;
                    base_branch: string | null;
                    phase_branch_template: string;
                    milestone_branch_template: string;
                    quick_branch_template: string | null;
                };
                gates: {
                    confirm_project: boolean;
                    confirm_phases: boolean;
                    confirm_roadmap: boolean;
                    confirm_breakdown: boolean;
                    confirm_plan: boolean;
                    execute_next_plan: boolean;
                    issues_review: boolean;
                    confirm_transition: boolean;
                };
                safety: {
                    always_confirm_destructive: boolean;
                    always_confirm_external_services: boolean;
                };
                maintenance: {
                    patch_registry: string;
                    workspace_root: string;
                };
                agent_skills: Record<string, unknown>;
            };
            provenance: {
                layersApplied: string[];
                defaultsPath: string | null;
                projectPath: string | null;
                defaultsApplied: boolean;
                projectApplied: boolean;
                defaultsSkipped?: boolean;
            };
            sourcePath: string | null;
            warnings: string[];
        };
        artifacts: {
            context: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            spec: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
            log: {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: string;
                content: string;
            } | {
                status: string;
                validation: {
                    valid: boolean;
                    issues: string[];
                    warnings: string[];
                    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
                } | null;
                path: string;
                hash: null;
                content: null;
            };
        };
    };
    authoring: {
        schema: z.core.ZodStandardJSONSchemaPayload<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        defaults: PhaseContextModelDefaults;
        missingEssentialFields: string[];
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        examples: ({
            phaseBoundary: {
                goal: string;
                inScope: string[];
                successCriteria: string[];
                outOfScope?: undefined;
            };
            implementationDecisions?: undefined;
            openQuestions?: undefined;
            canonicalReferences?: undefined;
        } | {
            phaseBoundary: {
                goal: string;
                inScope: string[];
                outOfScope: string[];
                successCriteria: string[];
            };
            implementationDecisions: {
                decision: string;
            }[];
            openQuestions: string[];
            canonicalReferences: {
                source: string;
            }[];
        })[];
    };
    readSet: {
        path: string;
        hash: string | null;
    }[];
    session: {
        revision: number;
        records: {
            id: string;
            type: "deferred" | "decision" | "open-question";
            value: string;
            rationale: string;
            evidence: string[];
            rejectedOptions?: string[] | undefined;
            blocking?: boolean | undefined;
            downstreamOwner?: string | undefined;
            status?: "deferred" | "resolved" | "open" | "accepted" | undefined;
        }[];
        publication: {
            requestId: string;
            stages: Record<string, "complete" | "intent">;
            complete: boolean | undefined;
        } | null;
    } | null;
    status: string;
    revision: number;
    path: string;
    reason?: undefined;
    affectedRecordIds?: undefined;
    freshness?: undefined;
    changedPaths?: undefined;
    nextAction?: undefined;
    reused?: undefined;
}>;
export declare const discussToolDefinitions: ToolDefinition[];
export {};
