export declare const evidenceDigest: (value: string | Buffer) => string;
export declare const stableEvidence: (value: unknown) => string;
export declare function readDiscussEvidence(root: string, relative: string): Promise<{
    path: string;
    hash: string;
    content: string;
} | {
    path: string;
    hash: null;
    content: null;
}>;
export declare function discussPlanInventory(root: string, phaseDir: string): Promise<string[]>;
/** Controlled runtime projections; never accept arbitrary virtual fingerprints from the model. */
export declare function discussEvidenceHash(root: string, relative: string): Promise<string | null>;
export declare function collectDiscussEvidence(args: {
    cwd?: string;
    phase?: string | number;
    evidencePaths?: string[];
    resolveEvidencePaths?: (root: string, sessionPath: string) => Promise<string[]>;
}): Promise<{
    status: "blocked";
    selection: import("./phase-tool-types.js").PhaseLocateResult;
    reason: string | null;
    changedPaths?: undefined;
    root?: undefined;
    phase?: undefined;
    readSet?: undefined;
    packet?: undefined;
} | {
    status: "blocked";
    reason: string;
    selection?: undefined;
    changedPaths?: undefined;
    root?: undefined;
    phase?: undefined;
    readSet?: undefined;
    packet?: undefined;
} | {
    status: "stale";
    reason: string;
    changedPaths: string[];
    selection?: undefined;
    root?: undefined;
    phase?: undefined;
    readSet?: undefined;
    packet?: undefined;
} | {
    status: "collected";
    root: string;
    phase: string;
    readSet: {
        path: string;
        hash: string | null;
    }[];
    packet: {
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
        sources: ({
            path: string;
            hash: string;
            content: string;
        } | {
            path: string;
            hash: null;
            content: null;
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
    };
    selection?: undefined;
    reason?: undefined;
    changedPaths?: undefined;
}>;
