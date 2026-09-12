import * as z from "zod/v4";
import type { ToolDefinition } from "../tool-types.js";
import { writeTextFile } from "./artifacts.js";
import { blueprintPhaseArtifactWrite } from "./phase-artifacts.js";
import { blueprintPhaseCheckpointDelete } from "./phase-checkpoints.js";
import { blueprintStateUpdate, blueprintStateLoad } from "./state.js";
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
}, z.core.$strip>;
declare const recordInput: z.ZodObject<{
    requestId: z.ZodString;
    expectedRevision: z.ZodNumber;
    candidate: z.ZodOptional<z.ZodUnknown>;
    corrections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodArray<z.ZodString>;
        value: z.ZodOptional<z.ZodUnknown>;
        operation: z.ZodDefault<z.ZodEnum<{
            set: "set";
            remove: "remove";
        }>>;
    }, z.core.$strip>>>;
    notes: z.ZodOptional<z.ZodString>;
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strip>;
declare const submitInput: z.ZodObject<{
    requestId: z.ZodString;
    expectedRevision: z.ZodNumber;
    candidate: z.ZodOptional<z.ZodUnknown>;
    overwrite: z.ZodOptional<z.ZodBoolean>;
    reuse: z.ZodOptional<z.ZodBoolean>;
    externalSourcesApproved: z.ZodOptional<z.ZodBoolean>;
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strip>;
export declare function blueprintResearchPrepare(raw?: z.input<typeof prepareInput>): Promise<{
    status: string;
    freshness: {
        status: "unknown" | "fresh" | "stale";
        stalePaths: string[];
        unknownPaths: string[];
    };
    nextAction: string;
} | {
    status: string;
    revision: number;
    nextAction: string;
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
    requirements: string[];
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
    evidence: ({
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    })[];
    readSet: ResearchReadSet;
    existing: {
        content?: string | null | undefined;
        path: string;
        hash: string | null;
        valid: boolean;
        freshness: {
            status: "unknown";
            stalePaths: string[];
            unknownPaths: string[];
            reason: string;
        } | {
            status: "stale";
            stalePaths: string[];
            unknownPaths: string[];
            reason: string;
        } | {
            reason: null;
            status: "unknown" | "fresh" | "stale";
            stalePaths: string[];
            unknownPaths: string[];
        } | null;
    };
    schema: Record<string, unknown> | undefined;
    checkpoint: import("./phase-tool-types.js").PhaseCheckpointGetResult;
    freshness?: undefined;
} | {
    status: string;
    revision: number;
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
    requirements: string[];
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
    evidence: ({
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    })[];
    readSet: ResearchReadSet;
    existing: {
        content?: string | null | undefined;
        path: string;
        hash: string | null;
        valid: boolean;
        freshness: {
            status: "unknown";
            stalePaths: string[];
            unknownPaths: string[];
            reason: string;
        } | {
            status: "stale";
            stalePaths: string[];
            unknownPaths: string[];
            reason: string;
        } | {
            reason: null;
            status: "unknown" | "fresh" | "stale";
            stalePaths: string[];
            unknownPaths: string[];
        } | null;
    };
    schema: Record<string, unknown> | undefined;
    checkpoint: import("./phase-tool-types.js").PhaseCheckpointGetResult;
    freshness?: undefined;
    nextAction?: undefined;
} | {
    status: string;
    revision: number;
    sessionPath: string;
    candidateSaved: boolean;
    diagnostics: import("./artifacts.js").PhaseArtifactValidationDiagnostic[];
    nextAction: string | null;
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
    requirements: string[];
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
    evidence: ({
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    })[];
    readSet: ResearchReadSet;
    existing: {
        content?: string | null | undefined;
        path: string;
        hash: string | null;
        valid: boolean;
        freshness: {
            status: "unknown";
            stalePaths: string[];
            unknownPaths: string[];
            reason: string;
        } | {
            status: "stale";
            stalePaths: string[];
            unknownPaths: string[];
            reason: string;
        } | {
            reason: null;
            status: "unknown" | "fresh" | "stale";
            stalePaths: string[];
            unknownPaths: string[];
        } | null;
    };
    schema: Record<string, unknown> | undefined;
    checkpoint: import("./phase-tool-types.js").PhaseCheckpointGetResult;
    freshness?: undefined;
} | {
    status: string;
    reason: string;
    nextAction: string | null;
}>;
export declare function blueprintResearchRecord(raw: z.input<typeof recordInput>): Promise<Record<string, unknown>>;
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
        status: "unknown" | "fresh" | "stale";
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
export declare function blueprintResearchSubmit(raw: z.input<typeof submitInput>): Promise<Record<string, unknown>>;
export declare const researchToolDefinitions: ToolDefinition[];
export {};
