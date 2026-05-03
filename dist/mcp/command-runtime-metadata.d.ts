import type { BlueprintInternalToolName } from "./runtime-vocabulary.js";
type RuntimeOwnedCommandStatus = "planned" | "implemented" | "blocked" | "repairing";
export type RuntimeOwnedCommandMetadata = {
    commandName: string;
    sourceId: string;
    catalog: {
        wave: number;
        family: string;
        primarySkill: string;
        declaredStatus: RuntimeOwnedCommandStatus;
        risk: string;
    };
    requiredTools: readonly BlueprintInternalToolName[];
    optionalAgents: readonly string[];
    requiredInputPaths?: readonly string[];
    spec: {
        path: string;
        title: string;
        executionProfile: string;
        rootRoutable: boolean;
        purpose: string;
        reads: readonly string[];
        writes: readonly string[];
    };
    runtimeReference: {
        path: string;
        waveTitle: string;
        command: string;
        primarySkill: string;
        exactMcpDestination: readonly BlueprintInternalToolName[];
        optionalAgents: readonly string[];
        hookInvolvement: readonly string[];
        contractNotes: string;
        evidenceState: readonly string[];
    };
};
export declare const NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID = "src/mcp/command-runtime-metadata.ts#new-project";
export declare const NEW_PROJECT_RUNTIME_METADATA: {
    readonly commandName: "new-project";
    readonly sourceId: "src/mcp/command-runtime-metadata.ts#new-project";
    readonly catalog: {
        readonly wave: 0;
        readonly family: "Foundation";
        readonly primarySkill: "blueprint-bootstrap";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: deep-questioning bootstrap that creates the initial planning tree, seeds normalized repo config, and leaves a traceable first roadmap.";
    };
    readonly requiredTools: readonly ["blueprint_project_init", "blueprint_project_status", "blueprint_config_get", "blueprint_config_set", "blueprint_state_update", "blueprint_artifact_contract_read", "blueprint_artifact_validate"];
    readonly optionalAgents: readonly ["blueprint-project-researcher", "blueprint-roadmapper"];
    readonly spec: {
        readonly path: "src/mcp/command-runtime-metadata.ts#new-project";
        readonly title: "`/blu-new-project`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "new-project initializes a Blueprint project with deep context gathering and PROJECT.md. It stays host-native and delegates durable persistence to Blueprint MCP tools while preserving the richer bootstrap flow.";
        readonly reads: readonly ["~/.<host>/blueprint/defaults.json when present"];
        readonly writes: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/STATE.md", ".blueprint/config.json", ".blueprint/phases/"];
    };
    readonly runtimeReference: {
        readonly path: "src/mcp/command-runtime-metadata.ts#new-project";
        readonly waveTitle: "Foundation";
        readonly command: "new-project";
        readonly primarySkill: "blueprint-bootstrap";
        readonly exactMcpDestination: readonly ["blueprint_project_init", "blueprint_project_status", "blueprint_config_get", "blueprint_config_set", "blueprint_state_update", "blueprint_artifact_contract_read", "blueprint_artifact_validate"];
        readonly optionalAgents: readonly ["blueprint-project-researcher", "blueprint-roadmapper"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation Gemini-native bootstrap. The detailed runtime contract lives in skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md, with host-entrypoint, MCP FQN, approval-surface, and Gemini-helper guardrails centralized in skills/blueprint-bootstrap/references/runtime-guardrails.md. The live contract stays map-first for brownfield repos: unmapped or mapping-incomplete states route to map-codebase; valid mapped-only states may run new-project while preserving .blueprint/codebase/*.md.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const ADD_PHASE_RUNTIME_METADATA_SOURCE_ID = "src/mcp/command-runtime-metadata.ts#add-phase";
export declare const ADD_PHASE_RUNTIME_METADATA: {
    readonly commandName: "add-phase";
    readonly sourceId: "src/mcp/command-runtime-metadata.ts#add-phase";
    readonly catalog: {
        readonly wave: 2;
        readonly family: "Roadmap And Milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: appends the next whole-number phase, scaffolds the matching phase directory, and updates the next-step signal.";
    };
    readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly spec: {
        readonly path: "src/mcp/command-runtime-metadata.ts#add-phase";
        readonly title: "`/blu-add-phase`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "Append a new whole-number phase to an initialized Blueprint roadmap through MCP-owned roadmap and scaffold writes.";
        readonly reads: readonly [".blueprint/ROADMAP.md"];
        readonly writes: readonly [".blueprint/ROADMAP.md", ".blueprint/phases/<phase-slug>/<phase-prefix>-CONTEXT.md", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: "src/mcp/command-runtime-metadata.ts#add-phase";
        readonly waveTitle: "Roadmap And Milestone";
        readonly command: "add-phase";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Interactive-read profile for bounded roadmap append: load skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md, keep the command grounded in the live roadmap, preview the next integer phase while ignoring decimal suffixes, prefer ask_user for the exact phase-number confirmation gate, pass the confirmed number as expectedPhaseNumber, keep the waiting state explicit as phase-number-confirmation or stale-phase-number, persist the append only through the roadmap and scaffold MCP tools, scaffold ${phaseDir}/${phasePrefix}-CONTEXT.md from returned metadata without treating scaffold text as finished context, preserve the no-subagent fallback, reject browser/web-search/shell-only or generic agents as substitutes, and route the next safe action to /blu-discuss-phase <phase> without adopting long-running progress tools.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const PROGRESS_RUNTIME_METADATA: {
    readonly commandName: "progress";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 0;
        readonly family: "Foundation";
        readonly primarySkill: "blueprint-router";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: read-only status inspection.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_state_load", "blueprint_artifact_list", "blueprint_command_catalog"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["commands/blu-progress.toml"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-progress`";
        readonly executionProfile: "router";
        readonly rootRoutable: true;
        readonly purpose: "`progress` summarizes Blueprint repo status, blockers, warnings, and next safe implemented guidance from MCP-owned state.";
        readonly reads: readonly [".blueprint/ state, config, artifacts, project status, and command catalog through MCP tools."];
        readonly writes: readonly [];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Foundation";
        readonly command: "progress";
        readonly primarySkill: "blueprint-router";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_state_load", "blueprint_artifact_list", "blueprint_command_catalog"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [];
        readonly contractNotes: "Router profile; preserve read-only next-step guidance from MCP-owned project status, config, state, artifact inventory, and implemented command catalog.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const SETTINGS_RUNTIME_METADATA: {
    readonly commandName: "settings";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 0;
        readonly family: "Foundation";
        readonly primarySkill: "blueprint-governance";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: config-only mutation inside repo config plus optional user defaults.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_config_set"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/settings-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-settings`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`settings` inspects and updates Blueprint repo or default configuration through governance MCP tools.";
        readonly reads: readonly ["Project status and current Blueprint configuration through MCP."];
        readonly writes: readonly [".blueprint/config.json or host defaults when explicitly requested"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Foundation";
        readonly command: "settings";
        readonly primarySkill: "blueprint-governance";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_config_set"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for bounded configuration inspection and mutation: load skills/blueprint-governance/references/settings-runtime-contract.md, read status and config through MCP first, mutate only explicit repo/defaults settings through blueprint_config_set, and route follow-ups only to implemented commands.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const SET_PROFILE_RUNTIME_METADATA: {
    readonly commandName: "set-profile";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 0;
        readonly family: "Foundation";
        readonly primarySkill: "blueprint-governance";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: single-setting mutation for project model profile selection.";
    };
    readonly requiredTools: readonly ["blueprint_config_get", "blueprint_config_set_profile"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/set-profile-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-set-profile`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`set-profile` changes the current project model_profile through the governance MCP config substrate.";
        readonly reads: readonly ["Current Blueprint configuration through MCP."];
        readonly writes: readonly [".blueprint/config.json model_profile"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Foundation";
        readonly command: "set-profile";
        readonly primarySkill: "blueprint-governance";
        readonly exactMcpDestination: readonly ["blueprint_config_get", "blueprint_config_set_profile"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for one-field project profile mutation: load skills/blueprint-governance/references/set-profile-runtime-contract.md, inspect current config first, update only model_profile through blueprint_config_set_profile, and route follow-ups only to implemented commands.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const HEALTH_RUNTIME_METADATA: {
    readonly commandName: "health";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 0;
        readonly family: "Foundation";
        readonly primarySkill: "blueprint-governance";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: repair mode can normalize config and rewrite malformed planning artifacts.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_config_set", "blueprint_state_load", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_state_sync"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/health-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-health`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`health` checks Blueprint project health and can run explicit repair-mode normalization through MCP-owned tools.";
        readonly reads: readonly ["Project status, config, state, artifact inventory, and validation results through MCP."];
        readonly writes: readonly [".blueprint/config.json and malformed planning artifacts only in explicit repair mode"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Foundation";
        readonly command: "health";
        readonly primarySkill: "blueprint-governance";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_config_set", "blueprint_state_load", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_state_sync"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for health inspection and explicit repair: load skills/blueprint-governance/references/health-runtime-contract.md, gather project/config/state/artifact evidence through MCP, validate artifacts before reporting, run blueprint_config_set and blueprint_state_sync only for requested repair mode, and route follow-ups only to implemented commands.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const DISCUSS_PHASE_RUNTIME_METADATA: {
    readonly commandName: "discuss-phase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-phase-discovery";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: can replace or extend phase context artifacts.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_phase_plan_index", "blueprint_artifact_list", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_phase_checkpoint_get", "blueprint_phase_checkpoint_put", "blueprint_phase_checkpoint_delete", "blueprint_artifact_scaffold", "blueprint_state_update", "blueprint_state_load"];
    readonly optionalAgents: readonly ["blueprint-researcher"];
    readonly requiredInputPaths: readonly ["skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md", "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-discuss-phase`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`discuss-phase` gathers durable phase context through adaptive discovery, capability-gated gray-area research sidecars, checkpointed resumability, validation repair, and MCP-owned phase artifact writes.";
        readonly reads: readonly ["Phase resolution, roadmap state, artifact inventory, effective config, saved phase artifacts, plan inventory, artifact contracts, checkpoints, and refreshed state through MCP."];
        readonly writes: readonly ["phase XX-CONTEXT.md", "optional phase XX-DISCUSSION-LOG.md", "optional shared phase XX-DISCUSS-CHECKPOINT.json during in-progress discovery", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "discuss-phase";
        readonly primarySkill: "blueprint-phase-discovery";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_phase_plan_index", "blueprint_artifact_list", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_phase_checkpoint_get", "blueprint_phase_checkpoint_put", "blueprint_phase_checkpoint_delete", "blueprint_artifact_scaffold", "blueprint_state_update", "blueprint_state_load"];
        readonly optionalAgents: readonly ["blueprint-researcher"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation phase discovery uses the shared profile in skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md and the command-specific behavior contract in skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md. It does a prior-context sweep before asking questions, keeps host-supported structured choices and checkpoint resume-versus-discard gates explicit, supports assumptions-mode analysis, uses capability-gated blueprint-researcher sidecars only for one gray area or assumptions pass in lightweight gray-area memo mode, preserves a one-area-at-a-time single-agent fallback with checkpoint-per-area resumability, keeps contract.authoringTemplate as schema authority, reads plan-index and artifact-contract guidance before persistence, repairs returned artifact validation issues, folds deferred ideas into the saved record, calls blueprint_state_update with synced state followed by blueprint_state_load, and does not promise a dedicated todo/backlog file crawl.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const RESEARCH_PHASE_RUNTIME_METADATA: {
    readonly commandName: "research-phase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-phase-discovery";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: writes research artifacts only.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_phase_research_status", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_phase_checkpoint_get", "blueprint_phase_checkpoint_put", "blueprint_phase_checkpoint_delete", "blueprint_artifact_contract_read", "blueprint_artifact_scaffold", "blueprint_config_get", "blueprint_state_load", "blueprint_command_catalog", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-researcher"];
    readonly requiredInputPaths: readonly ["skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-research-phase`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`research-phase` gathers phase-scoped implementation guidance from saved Blueprint artifacts, repo evidence, and approved external references, then persists validated research through MCP-owned state paths.";
        readonly reads: readonly ["Phase resolution, context, research status, saved phase artifacts, checkpoints, artifact contracts, effective config, command catalog, and refreshed state through MCP."];
        readonly writes: readonly ["phase XX-RESEARCH.md", "optional shared phase checkpoint JSON owned by research-phase", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "research-phase";
        readonly primarySkill: "blueprint-phase-discovery";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_phase_research_status", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_phase_checkpoint_get", "blueprint_phase_checkpoint_put", "blueprint_phase_checkpoint_delete", "blueprint_artifact_contract_read", "blueprint_artifact_scaffold", "blueprint_config_get", "blueprint_state_load", "blueprint_command_catalog", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-researcher"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for topic-strand phase research: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial multi-strand research without turning them into persistence, and when those helpers are unavailable fall back to short progress recaps plus MCP-backed checkpoints and STATE.md. Ground repo truth first in phase context, actual saved context content, existing research, and saved codebase summaries, stop on missing XX-CONTEXT.md instead of drafting from status-only signals, read blueprint_config_get before any official-doc or external verification, honor research.external_sources as off/ask/auto, use official docs or explicitly supplied external references only when the repo cannot settle a claim, keep repo-derived evidence distinct from external truth in the finished research, require explicit source dates or a clear not externally checked marker for State Of The Art, use skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md as the rich behavior contract, keep contract.authoringTemplate as schema authority, reserve blueprint_artifact_scaffold for deliberate placeholder creation only, use capability-gated blueprint-researcher only when suitable Blueprint research or code-analysis agents are available, require the parent to supply any official-doc or external evidence packet instead of asking the subagent to fetch it, preserve the single-agent topic-strand fallback when they are not, reject browser/web-search/shell-only or generic agents as substitutes, force repair when existing research is invalid, sync STATE.md even on valid non-writing reuse paths, repair invalid writes or validation failures before completion, checkpoint inconclusive strands instead of bluffing a final artifact, delete only research-owned shared checkpoints, and keep routing limited to implemented commands only.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const UI_PHASE_RUNTIME_METADATA: {
    readonly commandName: "ui-phase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-phase-discovery";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: writes a UI contract or documented skip rationale only.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_research_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_artifact_scaffold", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-ui-designer", "blueprint-checker"];
    readonly requiredInputPaths: readonly ["skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-ui-phase`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`ui-phase` creates or reuses the single phase-scoped UI artifact, writing either a UI design contract or an explicit skip rationale through MCP-owned phase artifact persistence.";
        readonly reads: readonly ["Phase resolution, research status, effective config, canonical UI-spec contract, saved context/research/UI artifacts, and state through MCP."];
        readonly writes: readonly ["phase XX-UI-SPEC.md for either a UI contract or an explicit UI-skip rationale", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "ui-phase";
        readonly primarySkill: "blueprint-phase-discovery";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_research_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_artifact_scaffold", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-ui-designer", "blueprint-checker"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for bounded UI-contract drafting: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, keep contract-versus-skip posture, workflow.ui_safety_gate rationale confirmation, overwrite confirmation, checker-requested revision, and MCP validation repair explicit as visible gates, read the canonical phase.ui-spec contract before drafting or persisting, read actual saved context and research bodies when status reports them, load skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md as the richness, evidence, fallback, and retry authority, keep contract.authoringTemplate as heading/schema authority, use capability-gated blueprint-ui-designer and blueprint-checker for design-system evidence plus six-dimension UI quality review, preserve the no-subagent section-by-section fallback, reject browser/web-search/shell-only or generic substitute agents, repair invalid writes or checker-blocked dimensions before completion, and use XX-UI-SPEC.md as the single durable output for either a UI contract or an explicit skip rationale.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const LIST_PHASE_ASSUMPTIONS_RUNTIME_METADATA: {
    readonly commandName: "list-phase-assumptions";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 2;
        readonly family: "Roadmap And Milestone";
        readonly primarySkill: "blueprint-phase-discovery";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: read-only analysis.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_project_status"];
    readonly optionalAgents: readonly ["blueprint-researcher"];
    readonly requiredInputPaths: readonly ["skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-list-phase-assumptions`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`list-phase-assumptions` surfaces read-only pre-planning assumptions about a phase so users can correct misunderstandings before discovery or planning.";
        readonly reads: readonly ["Phase resolution, phase context, roadmap state, and project status through MCP."];
        readonly writes: readonly [];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Roadmap And Milestone";
        readonly command: "list-phase-assumptions";
        readonly primarySkill: "blueprint-phase-discovery";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_project_status"];
        readonly optionalAgents: readonly ["blueprint-researcher"];
        readonly hookInvolvement: readonly [];
        readonly contractNotes: "Interactive-read profile for read-only pre-planning synthesis: load skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md, keep the response grounded in saved phase and roadmap state, preserve the five explicit assumption areas plus uncertainty language, surface missing or blocked phase resolution as a waiting state with valid roadmap phases and the next safe implemented follow-up, and do not widen into writes, hidden planning, or tracker-backed progress behavior.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const VALIDATE_PHASE_RUNTIME_METADATA: {
    readonly commandName: "validate-phase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-phase-validation";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: writes summary-aware verification evidence and updates follow-up state.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_validate_model", "blueprint_phase_validation_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-verifier"];
    readonly requiredInputPaths: readonly ["skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-validate-phase`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`validate-phase` audits saved execution summaries and persists phase verification evidence through the validation MCP substrate.";
        readonly reads: readonly ["Saved phase summaries, validation baselines, config, artifact health, and state through MCP tools."];
        readonly writes: readonly ["phase XX-VERIFICATION.md", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "validate-phase";
        readonly primarySkill: "blueprint-phase-validation";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_validate_model", "blueprint_phase_validation_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-verifier"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile; validate saved summary evidence through the phase validation MCP substrate and route only to implemented follow-up commands.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const VERIFY_WORK_RUNTIME_METADATA: {
    readonly commandName: "verify-work";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-phase-validation";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: writes resumable UAT artifacts, can close or reopen roadmap completion, and records follow-up state.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_validate_model", "blueprint_phase_validation_render", "blueprint_phase_validation_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-verifier"];
    readonly requiredInputPaths: readonly ["skills/blueprint-phase-validation/references/verify-work-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-verify-work`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`verify-work` runs summary-backed UAT and persists resumable phase UAT evidence through the validation MCP substrate.";
        readonly reads: readonly ["Saved phase summaries, verification and UAT state, config, artifact health, and state through MCP tools."];
        readonly writes: readonly ["phase XX-UAT.md", ".blueprint/ROADMAP.md", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "verify-work";
        readonly primarySkill: "blueprint-phase-validation";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_validate_model", "blueprint_phase_validation_render", "blueprint_phase_validation_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-verifier"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile; keep conversational UAT phase-scoped, summary-aware, and persisted through the validation MCP substrate.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const CODE_REVIEW_RUNTIME_METADATA: {
    readonly commandName: "code-review";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-review";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: review artifact generation only.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_contract_read", "blueprint_review_scope", "blueprint_review_load_findings", "blueprint_review_validate_model", "blueprint_review_record"];
    readonly optionalAgents: readonly ["blueprint-reviewer"];
    readonly requiredInputPaths: readonly ["skills/blueprint-review/references/code-review-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-code-review`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`code-review` reviews source files changed during a Blueprint phase, resolves deterministic scope from executed plan metadata or explicit file paths, honors review settings, audits saved phase evidence, and persists the result through review MCP tools instead of prompt-only file writes.";
        readonly reads: readonly [".blueprint/config.json", "Phase resolution, artifact inventory, review scoping, saved execution summaries, matching plans, validation or UAT evidence, and any existing review findings through MCP tools and read-only repo access."];
        readonly writes: readonly ["phase XX-REVIEW.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
        readonly command: "code-review";
        readonly primarySkill: "blueprint-review";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_contract_read", "blueprint_review_scope", "blueprint_review_load_findings", "blueprint_review_validate_model", "blueprint_review_record"];
        readonly optionalAgents: readonly ["blueprint-reviewer"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for deterministic phase-scoped review: keep Resolve/Read/Decide/Execute/Validate/Persist/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial review runs without turning them into persistence, let blueprint_review_scope own review enablement, normalized depth defaults, saved evidence inventory, deterministic repo-file scoping, authoring context, and narrowed task schema, load skills/blueprint-review/references/code-review-runtime-contract.md for model-only JSON authoring, depth semantics, evidence richness, capability-gated reviewer use, no-subagent fallback, and MCP retry/repair behavior, keep explicit scope or overwrite confirmation when broad scope or existing review evidence needs approval, fail any invalid explicit --files scope instead of silently narrowing it, load saved XX-REVIEW.md findings before overwrite decisions, validate the authored model through blueprint_review_validate_model, and persist the model through blueprint_review_record so MCP renders canonical XX-REVIEW.md without Markdown fallback.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const CODE_REVIEW_FIX_RUNTIME_METADATA: {
    readonly commandName: "code-review-fix";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-review";
        readonly declaredStatus: "implemented";
        readonly risk: "High: selected findings can trigger bounded repo remediation plus review-fix/state updates.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_review_load_findings", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-reviewer"];
    readonly requiredInputPaths: readonly ["skills/blueprint-review/references/code-review-fix-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-code-review-fix`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`code-review-fix` applies bounded fixes from saved code-review findings and persists review-fix evidence plus state through MCP tools.";
        readonly reads: readonly ["Saved code-review findings, phase evidence, and review-fix authoring context through MCP tools."];
        readonly writes: readonly ["phase XX-REVIEW-FIX.md", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
        readonly command: "code-review-fix";
        readonly primarySkill: "blueprint-review";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_review_load_findings", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-reviewer"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Long-running-mutation profile for bounded saved-finding remediation; keep repo mutation scoped to selected findings, validate review.review-fix, persist through review MCP tools, and route follow-up through implemented validation or progress commands only.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const SECURE_PHASE_RUNTIME_METADATA: {
    readonly commandName: "secure-phase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-review";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: audit artifact only.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_artifact_contract_read", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
    readonly optionalAgents: readonly ["blueprint-security-auditor"];
    readonly requiredInputPaths: readonly ["skills/blueprint-review/references/secure-phase-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-secure-phase`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`secure-phase` verifies declared saved-plan threats against completed execution evidence and persists phase security evidence through review MCP tools.";
        readonly reads: readonly ["Saved plans, summaries, threat evidence, artifact inventory, and security authoring context through MCP tools."];
        readonly writes: readonly ["phase XX-SECURITY.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
        readonly command: "secure-phase";
        readonly primarySkill: "blueprint-review";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_artifact_contract_read", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
        readonly optionalAgents: readonly ["blueprint-security-auditor"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for bounded threat verification; persist review.security through review MCP tools and route only after open threats are closed or accepted.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const AUDIT_FIX_RUNTIME_METADATA: {
    readonly commandName: "audit-fix";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-review";
        readonly declaredStatus: "implemented";
        readonly risk: "High: bounded remediation plus report/state updates.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_review_scope", "blueprint_artifact_contract_read", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-reviewer", "blueprint-verifier"];
    readonly requiredInputPaths: readonly ["skills/blueprint-review/references/audit-fix-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-audit-fix`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`audit-fix` classifies saved review, security, verification, and UAT evidence, applies bounded remediation when not dry-running, persists a durable audit-fix report, and updates state through MCP tools.";
        readonly reads: readonly ["Saved phase evidence, artifact inventory, deterministic review scope, audit-fix report authoring context, and state through MCP tools plus bounded repo inspection."];
        readonly writes: readonly [".blueprint/reports/audit-fix-<phase>.md", "optional .blueprint/todos/TODO.md", "repo code changes when not dry-running", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
        readonly command: "audit-fix";
        readonly primarySkill: "blueprint-review";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_review_scope", "blueprint_artifact_contract_read", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-reviewer", "blueprint-verifier"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Long-running-mutation profile for bounded saved-evidence remediation: load skills/blueprint-review/references/audit-fix-runtime-contract.md, resolve the phase and artifact inventory, let blueprint_review_scope own the repo-file scope, classify only selected saved evidence, keep --source, --severity, --max, --dry-run, mutation confirmation, report overwrite, optional todo capture, active stage, and early-stop state explicit, use blueprint-reviewer only for bounded read-only classification and blueprint-verifier only for bounded post-fix verification, validate the structured report.audit-fix model through blueprint_artifact_report_validate_model, persist it through blueprint_artifact_report_write, append confirmed todo follow-ups through blueprint_artifact_mutate_index, update state through blueprint_state_update, and stop rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const REVIEW_RUNTIME_METADATA: {
    readonly commandName: "review";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-review";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: external reviewer orchestration without default repo mutation.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
    readonly optionalAgents: readonly ["blueprint-reviewer"];
    readonly requiredInputPaths: readonly ["skills/blueprint-review/references/review-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-review`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`review` orchestrates bounded peer review from saved phase plans and evidence, preserves reviewer availability and disagreement honestly, and persists the peer-review artifact through review MCP tools.";
        readonly reads: readonly ["Phase resolution, artifact inventory, saved phase plans, saved execution summaries, execution targets, and peer-review authoring context through MCP tools."];
        readonly writes: readonly ["phase XX-REVIEWS.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
        readonly command: "review";
        readonly primarySkill: "blueprint-review";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
        readonly optionalAgents: readonly ["blueprint-reviewer"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for saved-plan peer review: load skills/blueprint-review/references/review-runtime-contract.md, resolve the phase and artifact inventory, read only selected phase plans and related summaries through MCP, keep requested reviewers, available and unavailable reviewers, reviewer-availability gates, overwrite confirmation, disagreement posture, execution mode, active stage, and next safe action explicit, use blueprint-reviewer only for bounded packet and synthesis quality checks, validate the structured review.peer-review model through blueprint_review_validate_model, persist it through blueprint_review_record, preserve partial reviewer coverage honestly, and stop rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const UI_REVIEW_RUNTIME_METADATA: {
    readonly commandName: "ui-review";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-review";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: review artifact only.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
    readonly optionalAgents: readonly ["blueprint-ui-auditor"];
    readonly requiredInputPaths: readonly ["skills/blueprint-review/references/ui-review-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-ui-review`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`ui-review` audits shipped UI work against saved execution and UI-spec evidence, optionally delegates bounded six-pillar analysis, and persists the UI-review artifact through review MCP tools.";
        readonly reads: readonly ["Phase resolution, artifact inventory, saved execution and UI-spec evidence, and UI-review authoring context through MCP tools."];
        readonly writes: readonly ["phase XX-UI-REVIEW.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
        readonly command: "ui-review";
        readonly primarySkill: "blueprint-review";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
        readonly optionalAgents: readonly ["blueprint-ui-auditor"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for phase-scoped UI audit: load skills/blueprint-review/references/ui-review-runtime-contract.md, resolve the phase and artifact inventory, read review.ui-review through blueprint_artifact_contract_read, keep saved execution evidence, UI-spec coverage, visual-evidence limits, overwrite confirmation, inline versus blueprint-ui-auditor execution mode, scored findings posture, active stage, and next safe action explicit, use blueprint-ui-auditor only for bounded UI/code analysis when available, validate the structured review.ui-review model through blueprint_review_validate_model, persist it through blueprint_review_record, and stop rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const ADD_TESTS_RUNTIME_METADATA: {
    readonly commandName: "add-tests";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-phase-validation";
        readonly declaredStatus: "implemented";
        readonly risk: "High: repo test mutation plus verification/report updates.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_render", "blueprint_artifact_contract_read", "blueprint_phase_validation_write", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_state_load", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-executor", "blueprint-verifier"];
    readonly requiredInputPaths: readonly ["skills/blueprint-phase-validation/references/add-tests-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-add-tests`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`add-tests` generates focused repo tests from saved phase evidence and persists validation plus report artifacts through MCP tools.";
        readonly reads: readonly ["Saved summaries, validation or UAT evidence, artifact inventory, report authoring context, and state through MCP tools."];
        readonly writes: readonly ["repo test files", "phase XX-VERIFICATION.md", ".blueprint/reports/add-tests-<phase>.md", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
        readonly command: "add-tests";
        readonly primarySkill: "blueprint-phase-validation";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_render", "blueprint_artifact_contract_read", "blueprint_phase_validation_write", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-executor", "blueprint-verifier"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Long-running-mutation profile for evidence-backed test generation; keep repo mutation scoped to selected tests and persist validation/report evidence through MCP tools.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const PAUSE_WORK_RUNTIME_METADATA: {
    readonly commandName: "pause-work";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-governance";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: writes handoff and state artifacts only.";
    };
    readonly requiredTools: readonly ["blueprint_state_load", "blueprint_artifact_list", "blueprint_pause_handoff_get", "blueprint_pause_handoff_write", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/pause-work-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-pause-work`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`pause-work` records a canonical handoff from current Blueprint state and artifact inventory.";
        readonly reads: readonly ["Current state, artifact inventory, and existing pause handoff state through MCP."];
        readonly writes: readonly [".blueprint/reports/pause-work-latest.md", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "pause-work";
        readonly primarySkill: "blueprint-governance";
        readonly exactMcpDestination: readonly ["blueprint_state_load", "blueprint_artifact_list", "blueprint_pause_handoff_get", "blueprint_pause_handoff_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for canonical handoff capture: load skills/blueprint-governance/references/pause-work-runtime-contract.md, read state and artifact inventory through MCP, compare existing handoff state before overwrite where relevant, persist only through blueprint_pause_handoff_write and blueprint_state_update, and route follow-ups only to implemented commands.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const RESUME_WORK_RUNTIME_METADATA: {
    readonly commandName: "resume-work";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-governance";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: restores state from the canonical pause handoff and updates the next safe action.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_state_load", "blueprint_artifact_list", "blueprint_pause_handoff_get", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/resume-work-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-resume-work`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`resume-work` restores working context from the canonical pause handoff and records the next safe action.";
        readonly reads: readonly ["Project status, current state, artifact inventory, and canonical pause handoff through MCP."];
        readonly writes: readonly [".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "resume-work";
        readonly primarySkill: "blueprint-governance";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_state_load", "blueprint_artifact_list", "blueprint_pause_handoff_get", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for handoff restoration: load skills/blueprint-governance/references/resume-work-runtime-contract.md, read project status, state, artifacts, and canonical pause handoff through MCP, restore only from the canonical handoff, persist next safe action through blueprint_state_update, and route follow-ups only to implemented commands.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const NOTE_RUNTIME_METADATA: {
    readonly commandName: "note";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 3;
        readonly family: "Capture And Lightweight Execution";
        readonly primarySkill: "blueprint-capture";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: note capture only.";
    };
    readonly requiredTools: readonly ["blueprint_artifact_mutate_index"];
    readonly optionalAgents: readonly [];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-note`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`note` appends explicit project-local notes through the capture index MCP tool while keeping unsupported list, promote, and global-note asks in safe suggestion mode.";
        readonly reads: readonly ["User-provided note text and duplicate state through MCP."];
        readonly writes: readonly [".blueprint/notes/NOTES.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Capture And Lightweight Execution";
        readonly command: "note";
        readonly primarySkill: "blueprint-capture";
        readonly exactMcpDestination: readonly ["blueprint_artifact_mutate_index"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for deterministic project-local note capture: require explicit note text, persist only through blueprint_artifact_mutate_index, treat duplicate results and returned ids as authoritative, keep unsupported list, promote, and global-note behavior in safe suggestion mode, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const ADD_TODO_RUNTIME_METADATA: {
    readonly commandName: "add-todo";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 3;
        readonly family: "Capture And Lightweight Execution";
        readonly primarySkill: "blueprint-capture";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: todo index update only.";
    };
    readonly requiredTools: readonly ["blueprint_artifact_mutate_index"];
    readonly optionalAgents: readonly [];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-add-todo`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`add-todo` appends explicit project-local todo items through the capture index MCP tool.";
        readonly reads: readonly ["User-provided todo text and duplicate state through MCP."];
        readonly writes: readonly [".blueprint/todos/TODO.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Capture And Lightweight Execution";
        readonly command: "add-todo";
        readonly primarySkill: "blueprint-capture";
        readonly exactMcpDestination: readonly ["blueprint_artifact_mutate_index"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for short project-local todo capture: require an explicit description, persist append-only todo entries through blueprint_artifact_mutate_index, report duplicates using returned matching ids instead of creating a second copy, route missing projects and follow-ups only through implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const CHECK_TODOS_RUNTIME_METADATA: {
    readonly commandName: "check-todos";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 3;
        readonly family: "Capture And Lightweight Execution";
        readonly primarySkill: "blueprint-capture";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: todo selection and status update only.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_artifact_mutate_index"];
    readonly optionalAgents: readonly [];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-check-todos`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`check-todos` inspects pending project-local todos and can mark one active or completed through bounded MCP updates.";
        readonly reads: readonly ["Project readiness and todo queue state through Blueprint MCP tools."];
        readonly writes: readonly [".blueprint/todos/TODO.md when status changes are confirmed"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Capture And Lightweight Execution";
        readonly command: "check-todos";
        readonly primarySkill: "blueprint-capture";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_artifact_mutate_index"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for deterministic todo inspection and bounded status changes: read blueprint_project_status first, list or update todos only through blueprint_artifact_mutate_index, require explicit confirmation before marking active or completed unless intent is unmistakable, prefer exact ids for updates, report duplicate or reopened-active behavior from MCP results, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const ADD_BACKLOG_RUNTIME_METADATA: {
    readonly commandName: "add-backlog";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 3;
        readonly family: "Capture And Lightweight Execution";
        readonly primarySkill: "blueprint-capture";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: backlog append plus optional stub scaffold.";
    };
    readonly requiredTools: readonly ["blueprint_artifact_mutate_index", "blueprint_artifact_scaffold"];
    readonly optionalAgents: readonly [];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-add-backlog`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`add-backlog` appends explicit parking-lot ideas and can reserve a confirmed 999.x phase stub through MCP-owned capture and scaffold writes.";
        readonly reads: readonly ["User-provided backlog text and duplicate state through MCP."];
        readonly writes: readonly [".blueprint/backlog/BACKLOG.md", "optional .blueprint/phases/999.x-*/ context stub"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Capture And Lightweight Execution";
        readonly command: "add-backlog";
        readonly primarySkill: "blueprint-capture";
        readonly exactMcpDestination: readonly ["blueprint_artifact_mutate_index", "blueprint_artifact_scaffold"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for parking-lot capture: require explicit backlog text, persist append-only entries through blueprint_artifact_mutate_index, reserve a 999.x phase stub only behind an explicit confirmation gate, scaffold only returned reserved paths through blueprint_artifact_scaffold, report duplicate backlog ids instead of creating a second copy, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const REVIEW_BACKLOG_RUNTIME_METADATA: {
    readonly commandName: "review-backlog";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 3;
        readonly family: "Capture And Lightweight Execution";
        readonly primarySkill: "blueprint-capture";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: can promote backlog items into active roadmap scope.";
    };
    readonly requiredTools: readonly ["blueprint_roadmap_promote_backlog", "blueprint_artifact_mutate_index", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-review-backlog`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`review-backlog` previews canonical backlog entries, promotes or archives confirmed items, and records the next safe state through MCP-owned transitions.";
        readonly reads: readonly ["Canonical backlog preview through Blueprint MCP tools."];
        readonly writes: readonly [".blueprint/backlog/BACKLOG.md", ".blueprint/ROADMAP.md", ".blueprint/phases/<phase>/", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Capture And Lightweight Execution";
        readonly command: "review-backlog";
        readonly primarySkill: "blueprint-capture";
        readonly exactMcpDestination: readonly ["blueprint_roadmap_promote_backlog", "blueprint_artifact_mutate_index", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for deterministic backlog review: preview through blueprint_roadmap_promote_backlog before decisions, require explicit promote or archive confirmation while keep remains the safe default, promote only confirmed ids through roadmap MCP, persist promoted or archived status transitions through blueprint_artifact_mutate_index instead of deleting history, update state with implemented-only follow-ups, preserve reserved-stub reuse from MCP results, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const EXPLORE_RUNTIME_METADATA: {
    readonly commandName: "explore";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 3;
        readonly family: "Capture And Lightweight Execution";
        readonly primarySkill: "blueprint-capture";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: ideation-first, but confirmed roadmap promotion can append a new active phase.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_artifact_mutate_index", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold"];
    readonly optionalAgents: readonly ["blueprint-researcher"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-explore`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`explore` briefly classifies an idea into note, todo, backlog, roadmap, or no-write and persists only the explicitly confirmed target through MCP tools.";
        readonly reads: readonly ["Project readiness, user-provided idea text, and optional bounded researcher context."];
        readonly writes: readonly ["confirmed target only: .blueprint/notes/NOTES.md, .blueprint/todos/TODO.md, .blueprint/backlog/BACKLOG.md, or .blueprint/ROADMAP.md plus scaffolded phase context"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Capture And Lightweight Execution";
        readonly command: "explore";
        readonly primarySkill: "blueprint-capture";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_artifact_mutate_index", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold"];
        readonly optionalAgents: readonly ["blueprint-researcher"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for short ideation routing: require explicit idea text, read blueprint_project_status first, classify exactly one target among note, todo, backlog, roadmap, and no-write, use blueprint-researcher only for bounded context checks that materially affect routing, require explicit routing confirmation before persistence, write note/todo/backlog targets through blueprint_artifact_mutate_index with duplicate handling, append roadmap work through blueprint_roadmap_add_phase and scaffold only returned context paths, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const RUNTIME_OWNED_COMMAND_METADATA: {
    readonly "new-project": {
        readonly commandName: "new-project";
        readonly sourceId: "src/mcp/command-runtime-metadata.ts#new-project";
        readonly catalog: {
            readonly wave: 0;
            readonly family: "Foundation";
            readonly primarySkill: "blueprint-bootstrap";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: deep-questioning bootstrap that creates the initial planning tree, seeds normalized repo config, and leaves a traceable first roadmap.";
        };
        readonly requiredTools: readonly ["blueprint_project_init", "blueprint_project_status", "blueprint_config_get", "blueprint_config_set", "blueprint_state_update", "blueprint_artifact_contract_read", "blueprint_artifact_validate"];
        readonly optionalAgents: readonly ["blueprint-project-researcher", "blueprint-roadmapper"];
        readonly spec: {
            readonly path: "src/mcp/command-runtime-metadata.ts#new-project";
            readonly title: "`/blu-new-project`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "new-project initializes a Blueprint project with deep context gathering and PROJECT.md. It stays host-native and delegates durable persistence to Blueprint MCP tools while preserving the richer bootstrap flow.";
            readonly reads: readonly ["~/.<host>/blueprint/defaults.json when present"];
            readonly writes: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/STATE.md", ".blueprint/config.json", ".blueprint/phases/"];
        };
        readonly runtimeReference: {
            readonly path: "src/mcp/command-runtime-metadata.ts#new-project";
            readonly waveTitle: "Foundation";
            readonly command: "new-project";
            readonly primarySkill: "blueprint-bootstrap";
            readonly exactMcpDestination: readonly ["blueprint_project_init", "blueprint_project_status", "blueprint_config_get", "blueprint_config_set", "blueprint_state_update", "blueprint_artifact_contract_read", "blueprint_artifact_validate"];
            readonly optionalAgents: readonly ["blueprint-project-researcher", "blueprint-roadmapper"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation Gemini-native bootstrap. The detailed runtime contract lives in skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md, with host-entrypoint, MCP FQN, approval-surface, and Gemini-helper guardrails centralized in skills/blueprint-bootstrap/references/runtime-guardrails.md. The live contract stays map-first for brownfield repos: unmapped or mapping-incomplete states route to map-codebase; valid mapped-only states may run new-project while preserving .blueprint/codebase/*.md.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "add-phase": {
        readonly commandName: "add-phase";
        readonly sourceId: "src/mcp/command-runtime-metadata.ts#add-phase";
        readonly catalog: {
            readonly wave: 2;
            readonly family: "Roadmap And Milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: appends the next whole-number phase, scaffolds the matching phase directory, and updates the next-step signal.";
        };
        readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly spec: {
            readonly path: "src/mcp/command-runtime-metadata.ts#add-phase";
            readonly title: "`/blu-add-phase`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "Append a new whole-number phase to an initialized Blueprint roadmap through MCP-owned roadmap and scaffold writes.";
            readonly reads: readonly [".blueprint/ROADMAP.md"];
            readonly writes: readonly [".blueprint/ROADMAP.md", ".blueprint/phases/<phase-slug>/<phase-prefix>-CONTEXT.md", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: "src/mcp/command-runtime-metadata.ts#add-phase";
            readonly waveTitle: "Roadmap And Milestone";
            readonly command: "add-phase";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Interactive-read profile for bounded roadmap append: load skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md, keep the command grounded in the live roadmap, preview the next integer phase while ignoring decimal suffixes, prefer ask_user for the exact phase-number confirmation gate, pass the confirmed number as expectedPhaseNumber, keep the waiting state explicit as phase-number-confirmation or stale-phase-number, persist the append only through the roadmap and scaffold MCP tools, scaffold ${phaseDir}/${phasePrefix}-CONTEXT.md from returned metadata without treating scaffold text as finished context, preserve the no-subagent fallback, reject browser/web-search/shell-only or generic agents as substitutes, and route the next safe action to /blu-discuss-phase <phase> without adopting long-running progress tools.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly progress: {
        readonly commandName: "progress";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 0;
            readonly family: "Foundation";
            readonly primarySkill: "blueprint-router";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: read-only status inspection.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_state_load", "blueprint_artifact_list", "blueprint_command_catalog"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["commands/blu-progress.toml"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-progress`";
            readonly executionProfile: "router";
            readonly rootRoutable: true;
            readonly purpose: "`progress` summarizes Blueprint repo status, blockers, warnings, and next safe implemented guidance from MCP-owned state.";
            readonly reads: readonly [".blueprint/ state, config, artifacts, project status, and command catalog through MCP tools."];
            readonly writes: readonly [];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Foundation";
            readonly command: "progress";
            readonly primarySkill: "blueprint-router";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_state_load", "blueprint_artifact_list", "blueprint_command_catalog"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [];
            readonly contractNotes: "Router profile; preserve read-only next-step guidance from MCP-owned project status, config, state, artifact inventory, and implemented command catalog.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly settings: {
        readonly commandName: "settings";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 0;
            readonly family: "Foundation";
            readonly primarySkill: "blueprint-governance";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: config-only mutation inside repo config plus optional user defaults.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_config_set"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/settings-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-settings`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`settings` inspects and updates Blueprint repo or default configuration through governance MCP tools.";
            readonly reads: readonly ["Project status and current Blueprint configuration through MCP."];
            readonly writes: readonly [".blueprint/config.json or host defaults when explicitly requested"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Foundation";
            readonly command: "settings";
            readonly primarySkill: "blueprint-governance";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_config_set"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for bounded configuration inspection and mutation: load skills/blueprint-governance/references/settings-runtime-contract.md, read status and config through MCP first, mutate only explicit repo/defaults settings through blueprint_config_set, and route follow-ups only to implemented commands.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "set-profile": {
        readonly commandName: "set-profile";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 0;
            readonly family: "Foundation";
            readonly primarySkill: "blueprint-governance";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: single-setting mutation for project model profile selection.";
        };
        readonly requiredTools: readonly ["blueprint_config_get", "blueprint_config_set_profile"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/set-profile-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-set-profile`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`set-profile` changes the current project model_profile through the governance MCP config substrate.";
            readonly reads: readonly ["Current Blueprint configuration through MCP."];
            readonly writes: readonly [".blueprint/config.json model_profile"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Foundation";
            readonly command: "set-profile";
            readonly primarySkill: "blueprint-governance";
            readonly exactMcpDestination: readonly ["blueprint_config_get", "blueprint_config_set_profile"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for one-field project profile mutation: load skills/blueprint-governance/references/set-profile-runtime-contract.md, inspect current config first, update only model_profile through blueprint_config_set_profile, and route follow-ups only to implemented commands.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly health: {
        readonly commandName: "health";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 0;
            readonly family: "Foundation";
            readonly primarySkill: "blueprint-governance";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: repair mode can normalize config and rewrite malformed planning artifacts.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_config_set", "blueprint_state_load", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_state_sync"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/health-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-health`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`health` checks Blueprint project health and can run explicit repair-mode normalization through MCP-owned tools.";
            readonly reads: readonly ["Project status, config, state, artifact inventory, and validation results through MCP."];
            readonly writes: readonly [".blueprint/config.json and malformed planning artifacts only in explicit repair mode"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Foundation";
            readonly command: "health";
            readonly primarySkill: "blueprint-governance";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_config_set", "blueprint_state_load", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_state_sync"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for health inspection and explicit repair: load skills/blueprint-governance/references/health-runtime-contract.md, gather project/config/state/artifact evidence through MCP, validate artifacts before reporting, run blueprint_config_set and blueprint_state_sync only for requested repair mode, and route follow-ups only to implemented commands.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "discuss-phase": {
        readonly commandName: "discuss-phase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-phase-discovery";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: can replace or extend phase context artifacts.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_phase_plan_index", "blueprint_artifact_list", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_phase_checkpoint_get", "blueprint_phase_checkpoint_put", "blueprint_phase_checkpoint_delete", "blueprint_artifact_scaffold", "blueprint_state_update", "blueprint_state_load"];
        readonly optionalAgents: readonly ["blueprint-researcher"];
        readonly requiredInputPaths: readonly ["skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md", "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-discuss-phase`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`discuss-phase` gathers durable phase context through adaptive discovery, capability-gated gray-area research sidecars, checkpointed resumability, validation repair, and MCP-owned phase artifact writes.";
            readonly reads: readonly ["Phase resolution, roadmap state, artifact inventory, effective config, saved phase artifacts, plan inventory, artifact contracts, checkpoints, and refreshed state through MCP."];
            readonly writes: readonly ["phase XX-CONTEXT.md", "optional phase XX-DISCUSSION-LOG.md", "optional shared phase XX-DISCUSS-CHECKPOINT.json during in-progress discovery", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "discuss-phase";
            readonly primarySkill: "blueprint-phase-discovery";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_phase_plan_index", "blueprint_artifact_list", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_phase_checkpoint_get", "blueprint_phase_checkpoint_put", "blueprint_phase_checkpoint_delete", "blueprint_artifact_scaffold", "blueprint_state_update", "blueprint_state_load"];
            readonly optionalAgents: readonly ["blueprint-researcher"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation phase discovery uses the shared profile in skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md and the command-specific behavior contract in skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md. It does a prior-context sweep before asking questions, keeps host-supported structured choices and checkpoint resume-versus-discard gates explicit, supports assumptions-mode analysis, uses capability-gated blueprint-researcher sidecars only for one gray area or assumptions pass in lightweight gray-area memo mode, preserves a one-area-at-a-time single-agent fallback with checkpoint-per-area resumability, keeps contract.authoringTemplate as schema authority, reads plan-index and artifact-contract guidance before persistence, repairs returned artifact validation issues, folds deferred ideas into the saved record, calls blueprint_state_update with synced state followed by blueprint_state_load, and does not promise a dedicated todo/backlog file crawl.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "research-phase": {
        readonly commandName: "research-phase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-phase-discovery";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: writes research artifacts only.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_phase_research_status", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_phase_checkpoint_get", "blueprint_phase_checkpoint_put", "blueprint_phase_checkpoint_delete", "blueprint_artifact_contract_read", "blueprint_artifact_scaffold", "blueprint_config_get", "blueprint_state_load", "blueprint_command_catalog", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-researcher"];
        readonly requiredInputPaths: readonly ["skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-research-phase`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`research-phase` gathers phase-scoped implementation guidance from saved Blueprint artifacts, repo evidence, and approved external references, then persists validated research through MCP-owned state paths.";
            readonly reads: readonly ["Phase resolution, context, research status, saved phase artifacts, checkpoints, artifact contracts, effective config, command catalog, and refreshed state through MCP."];
            readonly writes: readonly ["phase XX-RESEARCH.md", "optional shared phase checkpoint JSON owned by research-phase", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "research-phase";
            readonly primarySkill: "blueprint-phase-discovery";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_phase_research_status", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_phase_checkpoint_get", "blueprint_phase_checkpoint_put", "blueprint_phase_checkpoint_delete", "blueprint_artifact_contract_read", "blueprint_artifact_scaffold", "blueprint_config_get", "blueprint_state_load", "blueprint_command_catalog", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-researcher"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for topic-strand phase research: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial multi-strand research without turning them into persistence, and when those helpers are unavailable fall back to short progress recaps plus MCP-backed checkpoints and STATE.md. Ground repo truth first in phase context, actual saved context content, existing research, and saved codebase summaries, stop on missing XX-CONTEXT.md instead of drafting from status-only signals, read blueprint_config_get before any official-doc or external verification, honor research.external_sources as off/ask/auto, use official docs or explicitly supplied external references only when the repo cannot settle a claim, keep repo-derived evidence distinct from external truth in the finished research, require explicit source dates or a clear not externally checked marker for State Of The Art, use skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md as the rich behavior contract, keep contract.authoringTemplate as schema authority, reserve blueprint_artifact_scaffold for deliberate placeholder creation only, use capability-gated blueprint-researcher only when suitable Blueprint research or code-analysis agents are available, require the parent to supply any official-doc or external evidence packet instead of asking the subagent to fetch it, preserve the single-agent topic-strand fallback when they are not, reject browser/web-search/shell-only or generic agents as substitutes, force repair when existing research is invalid, sync STATE.md even on valid non-writing reuse paths, repair invalid writes or validation failures before completion, checkpoint inconclusive strands instead of bluffing a final artifact, delete only research-owned shared checkpoints, and keep routing limited to implemented commands only.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "ui-phase": {
        readonly commandName: "ui-phase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-phase-discovery";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: writes a UI contract or documented skip rationale only.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_research_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_artifact_scaffold", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-ui-designer", "blueprint-checker"];
        readonly requiredInputPaths: readonly ["skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-ui-phase`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`ui-phase` creates or reuses the single phase-scoped UI artifact, writing either a UI design contract or an explicit skip rationale through MCP-owned phase artifact persistence.";
            readonly reads: readonly ["Phase resolution, research status, effective config, canonical UI-spec contract, saved context/research/UI artifacts, and state through MCP."];
            readonly writes: readonly ["phase XX-UI-SPEC.md for either a UI contract or an explicit UI-skip rationale", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "ui-phase";
            readonly primarySkill: "blueprint-phase-discovery";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_research_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_artifact_scaffold", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-ui-designer", "blueprint-checker"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for bounded UI-contract drafting: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, keep contract-versus-skip posture, workflow.ui_safety_gate rationale confirmation, overwrite confirmation, checker-requested revision, and MCP validation repair explicit as visible gates, read the canonical phase.ui-spec contract before drafting or persisting, read actual saved context and research bodies when status reports them, load skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md as the richness, evidence, fallback, and retry authority, keep contract.authoringTemplate as heading/schema authority, use capability-gated blueprint-ui-designer and blueprint-checker for design-system evidence plus six-dimension UI quality review, preserve the no-subagent section-by-section fallback, reject browser/web-search/shell-only or generic substitute agents, repair invalid writes or checker-blocked dimensions before completion, and use XX-UI-SPEC.md as the single durable output for either a UI contract or an explicit skip rationale.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "list-phase-assumptions": {
        readonly commandName: "list-phase-assumptions";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 2;
            readonly family: "Roadmap And Milestone";
            readonly primarySkill: "blueprint-phase-discovery";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: read-only analysis.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_project_status"];
        readonly optionalAgents: readonly ["blueprint-researcher"];
        readonly requiredInputPaths: readonly ["skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-list-phase-assumptions`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`list-phase-assumptions` surfaces read-only pre-planning assumptions about a phase so users can correct misunderstandings before discovery or planning.";
            readonly reads: readonly ["Phase resolution, phase context, roadmap state, and project status through MCP."];
            readonly writes: readonly [];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Roadmap And Milestone";
            readonly command: "list-phase-assumptions";
            readonly primarySkill: "blueprint-phase-discovery";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_project_status"];
            readonly optionalAgents: readonly ["blueprint-researcher"];
            readonly hookInvolvement: readonly [];
            readonly contractNotes: "Interactive-read profile for read-only pre-planning synthesis: load skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md, keep the response grounded in saved phase and roadmap state, preserve the five explicit assumption areas plus uncertainty language, surface missing or blocked phase resolution as a waiting state with valid roadmap phases and the next safe implemented follow-up, and do not widen into writes, hidden planning, or tracker-backed progress behavior.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "validate-phase": {
        readonly commandName: "validate-phase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-phase-validation";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: writes summary-aware verification evidence and updates follow-up state.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_validate_model", "blueprint_phase_validation_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-verifier"];
        readonly requiredInputPaths: readonly ["skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-validate-phase`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`validate-phase` audits saved execution summaries and persists phase verification evidence through the validation MCP substrate.";
            readonly reads: readonly ["Saved phase summaries, validation baselines, config, artifact health, and state through MCP tools."];
            readonly writes: readonly ["phase XX-VERIFICATION.md", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "validate-phase";
            readonly primarySkill: "blueprint-phase-validation";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_validate_model", "blueprint_phase_validation_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-verifier"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile; validate saved summary evidence through the phase validation MCP substrate and route only to implemented follow-up commands.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "verify-work": {
        readonly commandName: "verify-work";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-phase-validation";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: writes resumable UAT artifacts, can close or reopen roadmap completion, and records follow-up state.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_validate_model", "blueprint_phase_validation_render", "blueprint_phase_validation_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-verifier"];
        readonly requiredInputPaths: readonly ["skills/blueprint-phase-validation/references/verify-work-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-verify-work`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`verify-work` runs summary-backed UAT and persists resumable phase UAT evidence through the validation MCP substrate.";
            readonly reads: readonly ["Saved phase summaries, verification and UAT state, config, artifact health, and state through MCP tools."];
            readonly writes: readonly ["phase XX-UAT.md", ".blueprint/ROADMAP.md", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "verify-work";
            readonly primarySkill: "blueprint-phase-validation";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_validate_model", "blueprint_phase_validation_render", "blueprint_phase_validation_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-verifier"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile; keep conversational UAT phase-scoped, summary-aware, and persisted through the validation MCP substrate.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "code-review": {
        readonly commandName: "code-review";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-review";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: review artifact generation only.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_contract_read", "blueprint_review_scope", "blueprint_review_load_findings", "blueprint_review_validate_model", "blueprint_review_record"];
        readonly optionalAgents: readonly ["blueprint-reviewer"];
        readonly requiredInputPaths: readonly ["skills/blueprint-review/references/code-review-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-code-review`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`code-review` reviews source files changed during a Blueprint phase, resolves deterministic scope from executed plan metadata or explicit file paths, honors review settings, audits saved phase evidence, and persists the result through review MCP tools instead of prompt-only file writes.";
            readonly reads: readonly [".blueprint/config.json", "Phase resolution, artifact inventory, review scoping, saved execution summaries, matching plans, validation or UAT evidence, and any existing review findings through MCP tools and read-only repo access."];
            readonly writes: readonly ["phase XX-REVIEW.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
            readonly command: "code-review";
            readonly primarySkill: "blueprint-review";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_contract_read", "blueprint_review_scope", "blueprint_review_load_findings", "blueprint_review_validate_model", "blueprint_review_record"];
            readonly optionalAgents: readonly ["blueprint-reviewer"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for deterministic phase-scoped review: keep Resolve/Read/Decide/Execute/Validate/Persist/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial review runs without turning them into persistence, let blueprint_review_scope own review enablement, normalized depth defaults, saved evidence inventory, deterministic repo-file scoping, authoring context, and narrowed task schema, load skills/blueprint-review/references/code-review-runtime-contract.md for model-only JSON authoring, depth semantics, evidence richness, capability-gated reviewer use, no-subagent fallback, and MCP retry/repair behavior, keep explicit scope or overwrite confirmation when broad scope or existing review evidence needs approval, fail any invalid explicit --files scope instead of silently narrowing it, load saved XX-REVIEW.md findings before overwrite decisions, validate the authored model through blueprint_review_validate_model, and persist the model through blueprint_review_record so MCP renders canonical XX-REVIEW.md without Markdown fallback.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "code-review-fix": {
        readonly commandName: "code-review-fix";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-review";
            readonly declaredStatus: "implemented";
            readonly risk: "High: selected findings can trigger bounded repo remediation plus review-fix/state updates.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_review_load_findings", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-reviewer"];
        readonly requiredInputPaths: readonly ["skills/blueprint-review/references/code-review-fix-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-code-review-fix`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`code-review-fix` applies bounded fixes from saved code-review findings and persists review-fix evidence plus state through MCP tools.";
            readonly reads: readonly ["Saved code-review findings, phase evidence, and review-fix authoring context through MCP tools."];
            readonly writes: readonly ["phase XX-REVIEW-FIX.md", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
            readonly command: "code-review-fix";
            readonly primarySkill: "blueprint-review";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_review_load_findings", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-reviewer"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Long-running-mutation profile for bounded saved-finding remediation; keep repo mutation scoped to selected findings, validate review.review-fix, persist through review MCP tools, and route follow-up through implemented validation or progress commands only.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "secure-phase": {
        readonly commandName: "secure-phase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-review";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: audit artifact only.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_artifact_contract_read", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
        readonly optionalAgents: readonly ["blueprint-security-auditor"];
        readonly requiredInputPaths: readonly ["skills/blueprint-review/references/secure-phase-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-secure-phase`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`secure-phase` verifies declared saved-plan threats against completed execution evidence and persists phase security evidence through review MCP tools.";
            readonly reads: readonly ["Saved plans, summaries, threat evidence, artifact inventory, and security authoring context through MCP tools."];
            readonly writes: readonly ["phase XX-SECURITY.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
            readonly command: "secure-phase";
            readonly primarySkill: "blueprint-review";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_artifact_contract_read", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
            readonly optionalAgents: readonly ["blueprint-security-auditor"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for bounded threat verification; persist review.security through review MCP tools and route only after open threats are closed or accepted.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "audit-fix": {
        readonly commandName: "audit-fix";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-review";
            readonly declaredStatus: "implemented";
            readonly risk: "High: bounded remediation plus report/state updates.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_review_scope", "blueprint_artifact_contract_read", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-reviewer", "blueprint-verifier"];
        readonly requiredInputPaths: readonly ["skills/blueprint-review/references/audit-fix-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-audit-fix`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`audit-fix` classifies saved review, security, verification, and UAT evidence, applies bounded remediation when not dry-running, persists a durable audit-fix report, and updates state through MCP tools.";
            readonly reads: readonly ["Saved phase evidence, artifact inventory, deterministic review scope, audit-fix report authoring context, and state through MCP tools plus bounded repo inspection."];
            readonly writes: readonly [".blueprint/reports/audit-fix-<phase>.md", "optional .blueprint/todos/TODO.md", "repo code changes when not dry-running", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
            readonly command: "audit-fix";
            readonly primarySkill: "blueprint-review";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_review_scope", "blueprint_artifact_contract_read", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-reviewer", "blueprint-verifier"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Long-running-mutation profile for bounded saved-evidence remediation: load skills/blueprint-review/references/audit-fix-runtime-contract.md, resolve the phase and artifact inventory, let blueprint_review_scope own the repo-file scope, classify only selected saved evidence, keep --source, --severity, --max, --dry-run, mutation confirmation, report overwrite, optional todo capture, active stage, and early-stop state explicit, use blueprint-reviewer only for bounded read-only classification and blueprint-verifier only for bounded post-fix verification, validate the structured report.audit-fix model through blueprint_artifact_report_validate_model, persist it through blueprint_artifact_report_write, append confirmed todo follow-ups through blueprint_artifact_mutate_index, update state through blueprint_state_update, and stop rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly review: {
        readonly commandName: "review";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-review";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: external reviewer orchestration without default repo mutation.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
        readonly optionalAgents: readonly ["blueprint-reviewer"];
        readonly requiredInputPaths: readonly ["skills/blueprint-review/references/review-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-review`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`review` orchestrates bounded peer review from saved phase plans and evidence, preserves reviewer availability and disagreement honestly, and persists the peer-review artifact through review MCP tools.";
            readonly reads: readonly ["Phase resolution, artifact inventory, saved phase plans, saved execution summaries, execution targets, and peer-review authoring context through MCP tools."];
            readonly writes: readonly ["phase XX-REVIEWS.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
            readonly command: "review";
            readonly primarySkill: "blueprint-review";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
            readonly optionalAgents: readonly ["blueprint-reviewer"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for saved-plan peer review: load skills/blueprint-review/references/review-runtime-contract.md, resolve the phase and artifact inventory, read only selected phase plans and related summaries through MCP, keep requested reviewers, available and unavailable reviewers, reviewer-availability gates, overwrite confirmation, disagreement posture, execution mode, active stage, and next safe action explicit, use blueprint-reviewer only for bounded packet and synthesis quality checks, validate the structured review.peer-review model through blueprint_review_validate_model, persist it through blueprint_review_record, preserve partial reviewer coverage honestly, and stop rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "ui-review": {
        readonly commandName: "ui-review";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-review";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: review artifact only.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
        readonly optionalAgents: readonly ["blueprint-ui-auditor"];
        readonly requiredInputPaths: readonly ["skills/blueprint-review/references/ui-review-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-ui-review`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`ui-review` audits shipped UI work against saved execution and UI-spec evidence, optionally delegates bounded six-pillar analysis, and persists the UI-review artifact through review MCP tools.";
            readonly reads: readonly ["Phase resolution, artifact inventory, saved execution and UI-spec evidence, and UI-review authoring context through MCP tools."];
            readonly writes: readonly ["phase XX-UI-REVIEW.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
            readonly command: "ui-review";
            readonly primarySkill: "blueprint-review";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
            readonly optionalAgents: readonly ["blueprint-ui-auditor"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for phase-scoped UI audit: load skills/blueprint-review/references/ui-review-runtime-contract.md, resolve the phase and artifact inventory, read review.ui-review through blueprint_artifact_contract_read, keep saved execution evidence, UI-spec coverage, visual-evidence limits, overwrite confirmation, inline versus blueprint-ui-auditor execution mode, scored findings posture, active stage, and next safe action explicit, use blueprint-ui-auditor only for bounded UI/code analysis when available, validate the structured review.ui-review model through blueprint_review_validate_model, persist it through blueprint_review_record, and stop rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "add-tests": {
        readonly commandName: "add-tests";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-phase-validation";
            readonly declaredStatus: "implemented";
            readonly risk: "High: repo test mutation plus verification/report updates.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_render", "blueprint_artifact_contract_read", "blueprint_phase_validation_write", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-executor", "blueprint-verifier"];
        readonly requiredInputPaths: readonly ["skills/blueprint-phase-validation/references/add-tests-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-add-tests`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`add-tests` generates focused repo tests from saved phase evidence and persists validation plus report artifacts through MCP tools.";
            readonly reads: readonly ["Saved summaries, validation or UAT evidence, artifact inventory, report authoring context, and state through MCP tools."];
            readonly writes: readonly ["repo test files", "phase XX-VERIFICATION.md", ".blueprint/reports/add-tests-<phase>.md", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality, Shipping, Docs, And Maintenance";
            readonly command: "add-tests";
            readonly primarySkill: "blueprint-phase-validation";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_render", "blueprint_artifact_contract_read", "blueprint_phase_validation_write", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_state_load", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-executor", "blueprint-verifier"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Long-running-mutation profile for evidence-backed test generation; keep repo mutation scoped to selected tests and persist validation/report evidence through MCP tools.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "pause-work": {
        readonly commandName: "pause-work";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-governance";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: writes handoff and state artifacts only.";
        };
        readonly requiredTools: readonly ["blueprint_state_load", "blueprint_artifact_list", "blueprint_pause_handoff_get", "blueprint_pause_handoff_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/pause-work-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-pause-work`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`pause-work` records a canonical handoff from current Blueprint state and artifact inventory.";
            readonly reads: readonly ["Current state, artifact inventory, and existing pause handoff state through MCP."];
            readonly writes: readonly [".blueprint/reports/pause-work-latest.md", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "pause-work";
            readonly primarySkill: "blueprint-governance";
            readonly exactMcpDestination: readonly ["blueprint_state_load", "blueprint_artifact_list", "blueprint_pause_handoff_get", "blueprint_pause_handoff_write", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for canonical handoff capture: load skills/blueprint-governance/references/pause-work-runtime-contract.md, read state and artifact inventory through MCP, compare existing handoff state before overwrite where relevant, persist only through blueprint_pause_handoff_write and blueprint_state_update, and route follow-ups only to implemented commands.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "resume-work": {
        readonly commandName: "resume-work";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-governance";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: restores state from the canonical pause handoff and updates the next safe action.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_state_load", "blueprint_artifact_list", "blueprint_pause_handoff_get", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-governance/references/resume-work-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-resume-work`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`resume-work` restores working context from the canonical pause handoff and records the next safe action.";
            readonly reads: readonly ["Project status, current state, artifact inventory, and canonical pause handoff through MCP."];
            readonly writes: readonly [".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "resume-work";
            readonly primarySkill: "blueprint-governance";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_state_load", "blueprint_artifact_list", "blueprint_pause_handoff_get", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for handoff restoration: load skills/blueprint-governance/references/resume-work-runtime-contract.md, read project status, state, artifacts, and canonical pause handoff through MCP, restore only from the canonical handoff, persist next safe action through blueprint_state_update, and route follow-ups only to implemented commands.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly note: {
        readonly commandName: "note";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 3;
            readonly family: "Capture And Lightweight Execution";
            readonly primarySkill: "blueprint-capture";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: note capture only.";
        };
        readonly requiredTools: readonly ["blueprint_artifact_mutate_index"];
        readonly optionalAgents: readonly [];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-note`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`note` appends explicit project-local notes through the capture index MCP tool while keeping unsupported list, promote, and global-note asks in safe suggestion mode.";
            readonly reads: readonly ["User-provided note text and duplicate state through MCP."];
            readonly writes: readonly [".blueprint/notes/NOTES.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Capture And Lightweight Execution";
            readonly command: "note";
            readonly primarySkill: "blueprint-capture";
            readonly exactMcpDestination: readonly ["blueprint_artifact_mutate_index"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for deterministic project-local note capture: require explicit note text, persist only through blueprint_artifact_mutate_index, treat duplicate results and returned ids as authoritative, keep unsupported list, promote, and global-note behavior in safe suggestion mode, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "add-todo": {
        readonly commandName: "add-todo";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 3;
            readonly family: "Capture And Lightweight Execution";
            readonly primarySkill: "blueprint-capture";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: todo index update only.";
        };
        readonly requiredTools: readonly ["blueprint_artifact_mutate_index"];
        readonly optionalAgents: readonly [];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-add-todo`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`add-todo` appends explicit project-local todo items through the capture index MCP tool.";
            readonly reads: readonly ["User-provided todo text and duplicate state through MCP."];
            readonly writes: readonly [".blueprint/todos/TODO.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Capture And Lightweight Execution";
            readonly command: "add-todo";
            readonly primarySkill: "blueprint-capture";
            readonly exactMcpDestination: readonly ["blueprint_artifact_mutate_index"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for short project-local todo capture: require an explicit description, persist append-only todo entries through blueprint_artifact_mutate_index, report duplicates using returned matching ids instead of creating a second copy, route missing projects and follow-ups only through implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "check-todos": {
        readonly commandName: "check-todos";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 3;
            readonly family: "Capture And Lightweight Execution";
            readonly primarySkill: "blueprint-capture";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: todo selection and status update only.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_artifact_mutate_index"];
        readonly optionalAgents: readonly [];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-check-todos`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`check-todos` inspects pending project-local todos and can mark one active or completed through bounded MCP updates.";
            readonly reads: readonly ["Project readiness and todo queue state through Blueprint MCP tools."];
            readonly writes: readonly [".blueprint/todos/TODO.md when status changes are confirmed"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Capture And Lightweight Execution";
            readonly command: "check-todos";
            readonly primarySkill: "blueprint-capture";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_artifact_mutate_index"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for deterministic todo inspection and bounded status changes: read blueprint_project_status first, list or update todos only through blueprint_artifact_mutate_index, require explicit confirmation before marking active or completed unless intent is unmistakable, prefer exact ids for updates, report duplicate or reopened-active behavior from MCP results, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "add-backlog": {
        readonly commandName: "add-backlog";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 3;
            readonly family: "Capture And Lightweight Execution";
            readonly primarySkill: "blueprint-capture";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: backlog append plus optional stub scaffold.";
        };
        readonly requiredTools: readonly ["blueprint_artifact_mutate_index", "blueprint_artifact_scaffold"];
        readonly optionalAgents: readonly [];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-add-backlog`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`add-backlog` appends explicit parking-lot ideas and can reserve a confirmed 999.x phase stub through MCP-owned capture and scaffold writes.";
            readonly reads: readonly ["User-provided backlog text and duplicate state through MCP."];
            readonly writes: readonly [".blueprint/backlog/BACKLOG.md", "optional .blueprint/phases/999.x-*/ context stub"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Capture And Lightweight Execution";
            readonly command: "add-backlog";
            readonly primarySkill: "blueprint-capture";
            readonly exactMcpDestination: readonly ["blueprint_artifact_mutate_index", "blueprint_artifact_scaffold"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for parking-lot capture: require explicit backlog text, persist append-only entries through blueprint_artifact_mutate_index, reserve a 999.x phase stub only behind an explicit confirmation gate, scaffold only returned reserved paths through blueprint_artifact_scaffold, report duplicate backlog ids instead of creating a second copy, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "review-backlog": {
        readonly commandName: "review-backlog";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 3;
            readonly family: "Capture And Lightweight Execution";
            readonly primarySkill: "blueprint-capture";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: can promote backlog items into active roadmap scope.";
        };
        readonly requiredTools: readonly ["blueprint_roadmap_promote_backlog", "blueprint_artifact_mutate_index", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-review-backlog`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`review-backlog` previews canonical backlog entries, promotes or archives confirmed items, and records the next safe state through MCP-owned transitions.";
            readonly reads: readonly ["Canonical backlog preview through Blueprint MCP tools."];
            readonly writes: readonly [".blueprint/backlog/BACKLOG.md", ".blueprint/ROADMAP.md", ".blueprint/phases/<phase>/", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Capture And Lightweight Execution";
            readonly command: "review-backlog";
            readonly primarySkill: "blueprint-capture";
            readonly exactMcpDestination: readonly ["blueprint_roadmap_promote_backlog", "blueprint_artifact_mutate_index", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for deterministic backlog review: preview through blueprint_roadmap_promote_backlog before decisions, require explicit promote or archive confirmation while keep remains the safe default, promote only confirmed ids through roadmap MCP, persist promoted or archived status transitions through blueprint_artifact_mutate_index instead of deleting history, update state with implemented-only follow-ups, preserve reserved-stub reuse from MCP results, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly explore: {
        readonly commandName: "explore";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 3;
            readonly family: "Capture And Lightweight Execution";
            readonly primarySkill: "blueprint-capture";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: ideation-first, but confirmed roadmap promotion can append a new active phase.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_artifact_mutate_index", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold"];
        readonly optionalAgents: readonly ["blueprint-researcher"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-explore`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`explore` briefly classifies an idea into note, todo, backlog, roadmap, or no-write and persists only the explicitly confirmed target through MCP tools.";
            readonly reads: readonly ["Project readiness, user-provided idea text, and optional bounded researcher context."];
            readonly writes: readonly ["confirmed target only: .blueprint/notes/NOTES.md, .blueprint/todos/TODO.md, .blueprint/backlog/BACKLOG.md, or .blueprint/ROADMAP.md plus scaffolded phase context"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Capture And Lightweight Execution";
            readonly command: "explore";
            readonly primarySkill: "blueprint-capture";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_artifact_mutate_index", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold"];
            readonly optionalAgents: readonly ["blueprint-researcher"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for short ideation routing: require explicit idea text, read blueprint_project_status first, classify exactly one target among note, todo, backlog, roadmap, and no-write, use blueprint-researcher only for bounded context checks that materially affect routing, require explicit routing confirmation before persistence, write note/todo/backlog targets through blueprint_artifact_mutate_index with duplicate handling, append roadmap work through blueprint_roadmap_add_phase and scaffold only returned context paths, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
};
export declare function listRuntimeOwnedCommandMetadata(): RuntimeOwnedCommandMetadata[];
export declare function getRuntimeOwnedCommandMetadata(commandName: string): RuntimeOwnedCommandMetadata | null;
export declare function getRuntimeOwnedCommandMetadataBySourceId(sourceId: string | null): RuntimeOwnedCommandMetadata | null;
export {};
