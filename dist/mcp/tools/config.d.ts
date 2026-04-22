import * as z from "zod/v4";
type ConfigScope = "project" | "defaults" | "effective";
type ModelProfile = "quality" | "balanced" | "budget" | "inherit";
type ProgressMode = "quiet" | "stage" | "checklist";
type StructuredConfirmationsMode = "auto" | "required";
type UserCheckpointMode = "off" | "phase" | "plan";
type TaskTrackerMode = "off" | "auto";
type ExternalSourcesMode = "off" | "ask" | "auto";
type BlueprintConfig = {
    version: number;
    mode: string;
    granularity: string;
    model_profile: ModelProfile;
    project_code: string | null;
    phase_naming: string;
    response_language: string | null;
    planning: {
        commit_docs: boolean;
        search_gitignored: boolean;
    };
    ux: {
        progress_mode: ProgressMode;
        structured_confirmations: StructuredConfirmationsMode;
        user_checkpoints: UserCheckpointMode;
    };
    orchestration: {
        task_tracker: TaskTrackerMode;
    };
    research: {
        external_sources: ExternalSourcesMode;
    };
    workflow: {
        research: boolean;
        plan_check: boolean;
        verifier: boolean;
        nyquist_validation: boolean;
        ui_phase: boolean;
        ui_safety_gate: boolean;
        code_review: boolean;
        code_review_depth: string;
        auto_advance: boolean;
        research_before_questions: boolean;
        discuss_mode: string;
        skip_discuss: boolean;
        use_worktrees: boolean;
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
type ConfigProvenance = {
    layersApplied: string[];
    defaultsPath: string | null;
    projectPath: string | null;
    defaultsApplied: boolean;
    projectApplied: boolean;
};
type ConfigGetArgs = {
    scope?: ConfigScope;
    cwd?: string;
    defaultsPath?: string;
};
type ConfigSetArgs = {
    scope?: Exclude<ConfigScope, "effective">;
    cwd?: string;
    defaultsPath?: string;
    patch?: Record<string, unknown>;
};
type ConfigSetProfileArgs = {
    cwd?: string;
    defaultsPath?: string;
    profile: ModelProfile;
};
type SeedProjectConfigArgs = {
    cwd?: string;
    defaultsPath?: string;
};
type ConfigGetResult = {
    scope: ConfigScope;
    config: BlueprintConfig;
    provenance: ConfigProvenance;
    sourcePath: string | null;
    warnings: string[];
};
type ConfigSetResult = {
    scope: Exclude<ConfigScope, "effective">;
    updatedKeys: string[];
    config: BlueprintConfig;
    provenance: ConfigProvenance;
    configPath: string;
    warnings: string[];
};
type ConfigSetProfileResult = {
    profile: ModelProfile;
    updatedKeys: ["model_profile"];
    configPath: string;
};
type SeedProjectConfigResult = {
    config: BlueprintConfig;
    configPath: string;
    provenance: ConfigProvenance;
    warnings: string[];
};
export declare function blueprintConfigGet(args?: ConfigGetArgs): Promise<ConfigGetResult>;
export declare function blueprintConfigSet(args?: ConfigSetArgs): Promise<ConfigSetResult>;
export declare function blueprintConfigSetProfile(args: ConfigSetProfileArgs): Promise<ConfigSetProfileResult>;
export declare function seedProjectConfig(args?: SeedProjectConfigArgs): Promise<SeedProjectConfigResult>;
export declare const configToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        scope: z.ZodOptional<z.ZodEnum<{
            project: "project";
            defaults: "defaults";
            effective: "effective";
        }>>;
        cwd: z.ZodOptional<z.ZodString>;
        defaultsPath: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<ConfigGetResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        scope: z.ZodOptional<z.ZodEnum<{
            project: "project";
            defaults: "defaults";
        }>>;
        cwd: z.ZodOptional<z.ZodString>;
        defaultsPath: z.ZodOptional<z.ZodString>;
        patch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ConfigSetResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        defaultsPath: z.ZodOptional<z.ZodString>;
        profile: z.ZodEnum<{
            quality: "quality";
            balanced: "balanced";
            budget: "budget";
            inherit: "inherit";
        }>;
    };
    handler: (args: Record<string, unknown>) => Promise<ConfigSetProfileResult>;
})[];
export {};
