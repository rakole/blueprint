import * as z from "zod/v4";
import type { ToolDefinition } from "../tool-types.js";
import { writeTextFile } from "./artifacts.js";
import { blueprintPhaseArtifactWrite } from "./phase-artifacts.js";
import { blueprintPhaseCheckpointDelete } from "./phase-checkpoints.js";
import { blueprintStateUpdate, blueprintStateLoad } from "./state.js";
import { type PortableProviderEvidenceBasis } from "../codebase-index/provider-evidence.js";
import { type ResearchReadSet } from "./research-evidence.js";
import { type ResearchSession } from "./research-session.js";
declare const prepareInput: z.ZodObject<{
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    evidencePaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    expectedRevision: z.ZodOptional<z.ZodNumber>;
    acknowledgeChangedInputs: z.ZodOptional<z.ZodBoolean>;
    reconcile: z.ZodOptional<z.ZodObject<{
        confirmed: z.ZodLiteral<true>;
        researchHash: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
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
}, z.core.$strip>;
declare const submitInput: z.ZodObject<{
    requestId: z.ZodString;
    expectedRevision: z.ZodNumber;
    model: z.ZodOptional<z.ZodUnknown>;
    candidate: z.ZodOptional<z.ZodUnknown>;
    overwrite: z.ZodOptional<z.ZodBoolean>;
    reuse: z.ZodOptional<z.ZodBoolean>;
    externalSourcesApproved: z.ZodOptional<z.ZodBoolean>;
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strip>;
export declare function blueprintResearchPrepare(raw?: z.input<typeof prepareInput>): Promise<{
    nextAction: string;
    scopeReduction?: {
        selectedCount: number;
        suggestedMaxCount?: number;
        omittedBodyCount: number;
        omittedPathCount?: number;
    } | undefined;
    counts?: import("../evidence-delivery.js").EvidenceDeliveryCounts | undefined;
    diagnostics?: readonly unknown[] | undefined;
    code?: string | undefined;
    status: "invalid" | "not-found" | "fallback" | "reread_required" | "evidence_limit";
    saved: boolean;
    ready: boolean;
    reason: string;
    paths: readonly string[];
} | {
    status: "evidence_limit";
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
    freshness?: undefined;
} | {
    status: string;
    freshness: {
        status: "unknown" | "stale" | "fresh";
        stalePaths: string[];
        unknownPaths: string[];
    };
    nextAction: string;
    saved?: undefined;
    ready?: undefined;
    counts?: undefined;
    scopeReduction?: undefined;
    reason?: undefined;
} | {
    status: string;
    revision: number;
    reason: string;
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
        binding: import("../evidence-delivery.js").PriorEvidenceBinding;
        counts: import("../evidence-delivery.js").EvidenceDeliveryCounts;
        mode: "full" | "delta" | "register";
    } | undefined;
    phase: any;
    context: {
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    };
    spec: {
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    };
    requirements: any;
    projectBrief: any;
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
    codebase: any;
    evidence: ({
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    } | {
        path: string;
        hash: string;
    })[];
    readSet: ResearchReadSet;
    existing: {
        content?: string | null | undefined;
        path: string;
        hash: string | null;
        valid: boolean;
        freshness: {
            status: "fresh" | "stale" | "unknown";
            stalePaths: string[];
            unknownPaths: string[];
            reason: string | null;
            planningReady?: boolean;
        } | null;
    };
    schema: Record<string, unknown> | undefined;
    example: Record<string, unknown> | undefined;
    grounding: {
        lockedDecisions: string[];
        userConstraints: string[];
        requirements: {
            id: string;
            description: string;
        }[];
    };
    validationRules: {
        reject: string[];
        planningOnly: string[];
        advisory: string[];
        normalize: string[];
    };
    checkpoint: import("./phase-tool-types.js").PhaseCheckpointGetResult;
    saved?: undefined;
    ready?: undefined;
    counts?: undefined;
    scopeReduction?: undefined;
    nextAction?: undefined;
    freshness?: undefined;
} | {
    status: string;
    revision: number;
    nextAction: string;
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
        binding: import("../evidence-delivery.js").PriorEvidenceBinding;
        counts: import("../evidence-delivery.js").EvidenceDeliveryCounts;
        mode: "full" | "delta" | "register";
    } | undefined;
    phase: any;
    context: {
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    };
    spec: {
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    };
    requirements: any;
    projectBrief: any;
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
    codebase: any;
    evidence: ({
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    } | {
        path: string;
        hash: string;
    })[];
    readSet: ResearchReadSet;
    existing: {
        content?: string | null | undefined;
        path: string;
        hash: string | null;
        valid: boolean;
        freshness: {
            status: "fresh" | "stale" | "unknown";
            stalePaths: string[];
            unknownPaths: string[];
            reason: string | null;
            planningReady?: boolean;
        } | null;
    };
    schema: Record<string, unknown> | undefined;
    example: Record<string, unknown> | undefined;
    grounding: {
        lockedDecisions: string[];
        userConstraints: string[];
        requirements: {
            id: string;
            description: string;
        }[];
    };
    validationRules: {
        reject: string[];
        planningOnly: string[];
        advisory: string[];
        normalize: string[];
    };
    checkpoint: import("./phase-tool-types.js").PhaseCheckpointGetResult;
    saved?: undefined;
    ready?: undefined;
    counts?: undefined;
    scopeReduction?: undefined;
    reason?: undefined;
    freshness?: undefined;
} | {
    status: string;
    revision: number;
    sessionPath: string;
    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
    nextAction: string | null;
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
        binding: import("../evidence-delivery.js").PriorEvidenceBinding;
        counts: import("../evidence-delivery.js").EvidenceDeliveryCounts;
        mode: "full" | "delta" | "register";
    } | undefined;
    phase: any;
    context: {
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    };
    spec: {
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    };
    requirements: any;
    projectBrief: any;
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
    codebase: any;
    evidence: ({
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    } | {
        path: string;
        hash: string;
    })[];
    readSet: ResearchReadSet;
    existing: {
        content?: string | null | undefined;
        path: string;
        hash: string | null;
        valid: boolean;
        freshness: {
            status: "fresh" | "stale" | "unknown";
            stalePaths: string[];
            unknownPaths: string[];
            reason: string | null;
            planningReady?: boolean;
        } | null;
    };
    schema: Record<string, unknown> | undefined;
    example: Record<string, unknown> | undefined;
    grounding: {
        lockedDecisions: string[];
        userConstraints: string[];
        requirements: {
            id: string;
            description: string;
        }[];
    };
    validationRules: {
        reject: string[];
        planningOnly: string[];
        advisory: string[];
        normalize: string[];
    };
    checkpoint: import("./phase-tool-types.js").PhaseCheckpointGetResult;
    saved?: undefined;
    ready?: undefined;
    counts?: undefined;
    scopeReduction?: undefined;
    reason?: undefined;
    freshness?: undefined;
} | {
    status: string;
    reason: string;
    nextAction: string | null;
}>;
export declare function blueprintResearchRead(args: {
    cwd?: string;
    phase: string | number;
}): Promise<{
    status: string;
    sessionPath: string;
    session: ResearchSession | null;
    published: {
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    } | {
        path: string;
        hash: string | null;
        content: null;
        error: string;
    };
    freshness: {
        status: "unknown" | "stale" | "fresh";
        stalePaths: string[];
        unknownPaths: string[];
    } | null;
}>;
export declare const researchSubmitDependencies: {
    artifactWrite: typeof blueprintPhaseArtifactWrite;
    stateUpdate: typeof blueprintStateUpdate;
    stateLoad: typeof blueprintStateLoad;
    checkpointDelete: typeof blueprintPhaseCheckpointDelete;
    writeText: typeof writeTextFile;
};
export declare function blueprintResearchSubmit(raw: z.input<typeof submitInput>): Promise<{
    status: "reused" | "published";
    saved: true;
    ready: boolean;
    planningReady: boolean;
    revision: number;
    path: string;
    sessionPath: string;
    provenancePath: string;
    contentHash: string;
    provenanceHash: string;
    nextAction: string;
} | {
    status: string;
    saved: boolean;
    ready: boolean;
    outcome: string;
    revision: number;
} | {
    status: string;
    saved: boolean;
    nextAction: string;
    ready?: undefined;
    revision?: undefined;
    path?: undefined;
    stages?: undefined;
    reason?: undefined;
} | {
    warnings: string[];
    stages: {
        artifact?: "complete" | "intent" | undefined;
        provenance?: "complete" | "intent" | undefined;
        cleanup?: "complete" | "intent" | undefined;
        state?: "complete" | "intent" | undefined;
        routing?: "complete" | "intent" | undefined;
    };
    status: "reused" | "published";
    saved: true;
    ready: boolean;
    planningReady: boolean;
    revision: number;
    path: string;
    sessionPath: string;
    provenancePath: string;
    contentHash: string;
    provenanceHash: string;
    nextAction: string;
    reason?: undefined;
} | {
    status: string;
    saved: boolean;
    ready: boolean;
    revision: number;
    path: string | null;
    stages: Partial<Record<"artifact" | "provenance" | "cleanup" | "state" | "routing", "complete" | "intent">>;
    reason: string;
    nextAction: string;
}>;
export declare const researchToolDefinitions: ToolDefinition[];
export {};
