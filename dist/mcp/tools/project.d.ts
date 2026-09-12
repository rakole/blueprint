import { type BootstrapAuthoringModel } from "../bootstrap-authoring.js";
import * as z from "zod/v4";
import { type BootstrapArtifactDiagnostics, type BootstrapAssessment, type BootstrapSeed } from "./artifacts.js";
type CommandStatus = "planned" | "implemented" | "blocked" | "repairing";
type CommandCatalogEntry = {
    command: string;
    route: string;
    wave: number;
    family: string;
    risk: string;
    primarySkill: string;
    declaredStatus: CommandStatus;
    status: CommandStatus;
    implemented: boolean;
    blockedBy: string[];
    manifestPath: string | null;
    skillPath: string | null;
    specPath: string | null;
    requiredTools: string[];
    requiredToolsSatisfied: boolean;
    optionalAgents: string[];
    availableOptionalAgents: string[];
};
type CommandCatalogResult = {
    commands: Record<string, CommandCatalogEntry>;
    waves: Record<string, string[]>;
    aliases: Record<string, string[]>;
};
type ProjectInitArgs = {
    cwd?: string;
    defaultsPath?: string;
    savedDefaultsPolicy?: "apply" | "skip";
    overwrite?: boolean;
    projectName?: string;
    bootstrapMode?: "interactive" | "auto";
    bootstrapSeed?: BootstrapSeed;
    bootstrapModel?: BootstrapAuthoringModel;
    /** The user response to the first-run clarification, never an inferred answer. */
    clarification?: string;
};
type ProjectInitSuccessResult = {
    projectRoot: string;
    status?: never;
    written?: never;
    issues?: never;
    diagnostics?: never;
    suggestedRepairs?: never;
    createdPaths: string[];
    seededState: {
        updatedFields: string[];
        statePath: string;
    };
    configPath: string;
    configProvenance: {
        layersApplied: string[];
        defaultsPath: string | null;
        projectPath: string | null;
        defaultsApplied: boolean;
        projectApplied: boolean;
        defaultsSkipped?: boolean;
    };
    brownfield: BootstrapAssessment;
    bootstrapDiagnostics: BootstrapArtifactDiagnostics;
    nextAction: string;
    warnings: string[];
};
type ProjectInitDiagnostic = {
    path: string;
    code: string;
    message: string;
    repair: string;
    retryable: boolean;
    allowedValues?: string[];
    argsPatch?: unknown;
};
type ProjectInitInvalidResult = {
    projectRoot: string;
    status: "invalid";
    written: false;
    issues: string[];
    diagnostics: ProjectInitDiagnostic[];
    suggestedRepairs: string[];
};
type ProjectInitResult = ProjectInitSuccessResult | ProjectInitInvalidResult;
type ProjectStatusArgs = {
    cwd?: string;
};
type ProjectStatusResult = {
    status: "uninitialized" | "mapping-incomplete" | "mapped-only" | "partial" | "initialized";
    initialized: boolean;
    currentPhase: string | null;
    currentMilestone: string | null;
    nextAction: string;
    bootstrap: {
        repoShape: BootstrapAssessment["repoShape"];
        brownfieldDetected: boolean;
        codebaseMapped: boolean;
        placeholderArtifacts: string[];
        traceabilityWarnings: string[];
        recommendedNextAction: string;
    };
    health: {
        missingArtifacts: string[];
        warnings: string[];
    };
};
export declare function blueprintRuntimeOwnedCommandCatalog(): Promise<CommandCatalogResult>;
export declare function blueprintCommandCatalog(): Promise<CommandCatalogResult>;
export declare function blueprintProjectInit(args?: ProjectInitArgs): Promise<ProjectInitResult>;
export declare function blueprintProjectStatus(args?: ProjectStatusArgs): Promise<ProjectStatusResult>;
export declare function blueprintProjectPrepare(args?: {
    cwd?: string;
    auto?: boolean;
    defaultsPath?: string;
}): Promise<{
    status: string;
    project: ProjectStatusResult;
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
    bootstrapMode: string;
    clarificationRequired: boolean;
    nextAction: string;
    evidence: {
        repoSummary: string | null;
        codebaseMapped: boolean;
    };
    authoringSchema: z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{
        vision: z.ZodString;
        audience: z.ZodArray<z.ZodString>;
        milestone: z.ZodString;
        constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
        assumptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        phases: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            objective: z.ZodString;
            requirements: z.ZodArray<z.ZodString>;
            successCriteria: z.ZodArray<z.ZodString>;
            dependsOn: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        deferred: z.ZodOptional<z.ZodArray<z.ZodString>>;
        outOfScope: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>;
    authoringRules: string[];
}>;
export declare const projectToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        defaultsPath: z.ZodOptional<z.ZodString>;
        auto: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<{
        status: string;
        project: ProjectStatusResult;
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
        bootstrapMode: string;
        clarificationRequired: boolean;
        nextAction: string;
        evidence: {
            repoSummary: string | null;
            codebaseMapped: boolean;
        };
        authoringSchema: z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{
            vision: z.ZodString;
            audience: z.ZodArray<z.ZodString>;
            milestone: z.ZodString;
            constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
            assumptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            phases: z.ZodArray<z.ZodObject<{
                title: z.ZodString;
                objective: z.ZodString;
                requirements: z.ZodArray<z.ZodString>;
                successCriteria: z.ZodArray<z.ZodString>;
                dependsOn: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strict>>;
            deferred: z.ZodOptional<z.ZodArray<z.ZodString>>;
            outOfScope: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        authoringRules: string[];
    }>;
} | {
    name: string;
    description: string;
    inputSchema: {};
    handler: () => Promise<CommandCatalogResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        defaultsPath: z.ZodOptional<z.ZodString>;
        savedDefaultsPolicy: z.ZodOptional<z.ZodEnum<{
            apply: "apply";
            skip: "skip";
        }>>;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        projectName: z.ZodOptional<z.ZodString>;
        bootstrapMode: z.ZodOptional<z.ZodEnum<{
            auto: "auto";
            interactive: "interactive";
        }>>;
        clarification: z.ZodOptional<z.ZodString>;
        bootstrapModel: z.ZodOptional<z.ZodObject<{
            vision: z.ZodString;
            audience: z.ZodArray<z.ZodString>;
            milestone: z.ZodString;
            constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
            assumptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            phases: z.ZodArray<z.ZodObject<{
                title: z.ZodString;
                objective: z.ZodString;
                requirements: z.ZodArray<z.ZodString>;
                successCriteria: z.ZodArray<z.ZodString>;
                dependsOn: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strict>>;
            deferred: z.ZodOptional<z.ZodArray<z.ZodString>>;
            outOfScope: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strict>>;
        bootstrapSeed: z.ZodOptional<z.ZodObject<{
            vision: z.ZodOptional<z.ZodString>;
            audience: z.ZodOptional<z.ZodObject<{
                primary: z.ZodOptional<z.ZodArray<z.ZodString>>;
                secondary: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
            currentMilestone: z.ZodOptional<z.ZodString>;
            nonGoals: z.ZodOptional<z.ZodArray<z.ZodString>>;
            requirements: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                scope: z.ZodOptional<z.ZodEnum<{
                    deferred: "deferred";
                    committed: "committed";
                    out_of_scope: "out_of_scope";
                }>>;
                group: z.ZodOptional<z.ZodString>;
                requirement: z.ZodString;
                status: z.ZodString;
                notes: z.ZodString;
            }, z.core.$strip>>>;
            roadmapPhases: z.ZodOptional<z.ZodArray<z.ZodObject<{
                phase: z.ZodString;
                title: z.ZodString;
                status: z.ZodOptional<z.ZodEnum<{
                    done: "done";
                    planned: "planned";
                    in_progress: "in_progress";
                }>>;
                objective: z.ZodString;
                requirementIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
                successCriteria: z.ZodOptional<z.ZodArray<z.ZodString>>;
                notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
            brownfieldMode: z.ZodOptional<z.ZodEnum<{
                brownfield: "brownfield";
                greenfield: "greenfield";
                "scaffold-only": "scaffold-only";
            }>>;
            assumptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ProjectInitResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<ProjectStatusResult>;
})[];
export {};
