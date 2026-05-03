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
export declare const PR_BRANCH_RUNTIME_METADATA: {
    readonly commandName: "pr-branch";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-maintenance";
        readonly declaredStatus: "implemented";
        readonly risk: "High: git branch mutation.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/pr-branch-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-pr-branch`";
        readonly executionProfile: "high-risk-maintenance";
        readonly rootRoutable: true;
        readonly purpose: "`pr-branch` prepares a clean review branch by filtering Blueprint bookkeeping scope and persists a durable report.";
        readonly reads: readonly ["Project health, effective git config, active diff, artifact digest scope, and report contract through MCP plus git inspection."];
        readonly writes: readonly [".blueprint/reports/pr-branch-latest.md", "confirmed git branch"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality And Shipping";
        readonly command: "pr-branch";
        readonly primarySkill: "blueprint-maintenance";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/pr-branch-runtime-contract.md, require a clean tree and review-branch confirmation before git mutation, default to excluding .blueprint/** bookkeeping when configured, persist only the durable report through blueprint_artifact_report_write, and route follow-ups only to implemented commands or manual git/PR steps.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const SHIP_RUNTIME_METADATA: {
    readonly commandName: "ship";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-maintenance";
        readonly declaredStatus: "implemented";
        readonly risk: "High: remote and git mutation path.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_phase_locate", "blueprint_config_get", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/ship-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-ship`";
        readonly executionProfile: "high-risk-maintenance";
        readonly rootRoutable: true;
        readonly purpose: "`ship` prepares a confirmation-gated shipping run from saved Blueprint evidence and records actual push or PR outcomes.";
        readonly reads: readonly ["Project health, optional phase metadata, effective config, saved evidence, artifact digest scope, and report contract through MCP plus git/gh inspection."];
        readonly writes: readonly [".blueprint/reports/ship-latest.md", ".blueprint/STATE.md when routing changes", "approved git remote or PR state"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality And Shipping";
        readonly command: "ship";
        readonly primarySkill: "blueprint-maintenance";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_phase_locate", "blueprint_config_get", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/ship-runtime-contract.md, keep local prep, push, and PR creation as separate approved steps, write the approved plan before mutation, overwrite ship-latest after actual outcomes, and keep manual fallback durable when remote tooling is unavailable.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const UNDO_RUNTIME_METADATA: {
    readonly commandName: "undo";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-maintenance";
        readonly declaredStatus: "implemented";
        readonly risk: "High: intentionally destructive history-rewrite-adjacent workflow using safe revert-style steps.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/undo-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-undo`";
        readonly executionProfile: "high-risk-maintenance";
        readonly rootRoutable: true;
        readonly purpose: "`undo` previews a bounded revert, persists a durable undo report, and runs only confirmed safe revert-style git steps.";
        readonly reads: readonly ["Project health, optional phase metadata, affected artifacts, artifact digest scope, and report contract through MCP plus git history inspection."];
        readonly writes: readonly [".blueprint/reports/undo-latest.md", ".blueprint/STATE.md when routing changes", "approved git revert commits"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality And Shipping";
        readonly command: "undo";
        readonly primarySkill: "blueprint-maintenance";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/undo-runtime-contract.md, hard-stop on dirty or unsafe git state, require undo confirmation, write undo-latest before mutation, run only safe git revert style steps, overwrite undo-latest with actual outcome, and update state only after a successful revert changes routing.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const NEW_WORKSPACE_RUNTIME_METADATA: {
    readonly commandName: "new-workspace";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 5;
        readonly family: "Workspace And Maintenance";
        readonly primarySkill: "blueprint-maintenance";
        readonly declaredStatus: "implemented";
        readonly risk: "High: filesystem and git worktree mutation outside the current repo.";
    };
    readonly requiredTools: readonly ["blueprint_config_get", "blueprint_workspace_registry_get", "blueprint_workspace_create"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/new-workspace-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-new-workspace`";
        readonly executionProfile: "high-risk-maintenance";
        readonly rootRoutable: true;
        readonly purpose: "`new-workspace` creates a confirmed multi-repo workspace and records it in host-global Blueprint workspace state.";
        readonly reads: readonly ["Effective config, host-global workspace registry, source repo status, and target path preflight."];
        readonly writes: readonly ["workspace manifest under the selected workspace", "~/.<host>/blueprint/workspaces registry"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Workspace And Maintenance";
        readonly command: "new-workspace";
        readonly primarySkill: "blueprint-maintenance";
        readonly exactMcpDestination: readonly ["blueprint_config_get", "blueprint_workspace_registry_get", "blueprint_workspace_create"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [];
        readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/new-workspace-runtime-contract.md, derive workspace root from config or explicit input, stop on dirty sources or conflicts, require new-workspace-confirmation, and persist only through blueprint_workspace_create and the host-global registry it owns.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const REMOVE_WORKSPACE_RUNTIME_METADATA: {
    readonly commandName: "remove-workspace";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 5;
        readonly family: "Workspace And Maintenance";
        readonly primarySkill: "blueprint-maintenance";
        readonly declaredStatus: "implemented";
        readonly risk: "High: confirmation-gated workspace teardown and registry cleanup.";
    };
    readonly requiredTools: readonly ["blueprint_workspace_registry_get", "blueprint_workspace_remove"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/remove-workspace-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-remove-workspace`";
        readonly executionProfile: "high-risk-maintenance";
        readonly rootRoutable: true;
        readonly purpose: "`remove-workspace` tears down an exact confirmed workspace and updates the host-global workspace registry.";
        readonly reads: readonly ["Host-global workspace registry, workspace manifest, recorded repo members, and dirty-tree preflight."];
        readonly writes: readonly ["workspace teardown on disk", "~/.<host>/blueprint/workspaces registry"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Workspace And Maintenance";
        readonly command: "remove-workspace";
        readonly primarySkill: "blueprint-maintenance";
        readonly exactMcpDestination: readonly ["blueprint_workspace_registry_get", "blueprint_workspace_remove"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [];
        readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/remove-workspace-runtime-contract.md, resolve a single registry-backed workspace target, stop on ambiguity, drift, or dirty members, require remove-workspace-confirmation, and persist teardown only through blueprint_workspace_remove.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const WORKSTREAMS_RUNTIME_METADATA: {
    readonly commandName: "workstreams";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 5;
        readonly family: "Workspace And Maintenance";
        readonly primarySkill: "blueprint-maintenance";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: project-local state mutation with switching semantics.";
    };
    readonly requiredTools: readonly ["blueprint_workstream_list", "blueprint_workstream_mutate", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/workstreams-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-workstreams`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`workstreams` lists, creates, switches, resumes, or completes project-local Blueprint workstreams through MCP-owned state.";
        readonly reads: readonly ["Project-local workstream index and saved per-stream state."];
        readonly writes: readonly [".blueprint/workstreams/WORKSTREAMS.md", ".blueprint/workstreams/<slug>/state.json", ".blueprint/STATE.md for returned resume patches"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Workspace And Maintenance";
        readonly command: "workstreams";
        readonly primarySkill: "blueprint-maintenance";
        readonly exactMcpDestination: readonly ["blueprint_workstream_list", "blueprint_workstream_mutate", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/workstreams-runtime-contract.md, keep read-only operations on blueprint_workstream_list, require explicit targets and switch/archive confirmation gates before mutation, persist workstream changes only through blueprint_workstream_mutate, and apply returned resume statePatch only through blueprint_state_update.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const CLEANUP_RUNTIME_METADATA: {
    readonly commandName: "cleanup";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 5;
        readonly family: "Workspace And Maintenance";
        readonly primarySkill: "blueprint-maintenance";
        readonly declaredStatus: "implemented";
        readonly risk: "High: confirmation-gated phase-directory archival and removal behavior.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/cleanup-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-cleanup`";
        readonly executionProfile: "high-risk-maintenance";
        readonly rootRoutable: true;
        readonly purpose: "`cleanup` archives completed Blueprint phase directories through a protected-scope confirmation flow and persists a durable cleanup report.";
        readonly reads: readonly ["Project health, roadmap references, artifact inventory, cleanup evidence digest, and filesystem preflight."];
        readonly writes: readonly [".blueprint/reports/cleanup-latest.md", ".blueprint/STATE.md when routing changes", "confirmed phase archive destination"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Workspace And Maintenance";
        readonly command: "cleanup";
        readonly primarySkill: "blueprint-maintenance";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/cleanup-runtime-contract.md, protect the current phase and active roadmap references, require cleanup and destination confirmations before filesystem mutation, write cleanup-latest before archival, and update state only after successful approved archival.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const UPDATE_RUNTIME_METADATA: {
    readonly commandName: "update";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 5;
        readonly family: "Workspace And Maintenance";
        readonly primarySkill: "blueprint-maintenance";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: advisory only; no in-session self-update.";
    };
    readonly requiredTools: readonly ["blueprint_update_check", "blueprint_update_plan"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/update-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-update`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`update` inspects the installed Blueprint extension and prepares an advisory out-of-band update checklist.";
        readonly reads: readonly ["Host, installed extension path, installed version, provenance, latest-version lookup status, and warnings."];
        readonly writes: readonly ["~/.<host>/blueprint/updates/ when checklist persistence is chosen"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Workspace And Maintenance";
        readonly command: "update";
        readonly primarySkill: "blueprint-maintenance";
        readonly exactMcpDestination: readonly ["blueprint_update_check", "blueprint_update_plan"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [];
        readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/update-runtime-contract.md, keep installed extension handling read-only, use update-mode-gate for saved checklist versus manual fallback, persist only through blueprint_update_plan under host-global update state, and always end with restart guidance.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const REAPPLY_PATCHES_RUNTIME_METADATA: {
    readonly commandName: "reapply-patches";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 5;
        readonly family: "Workspace And Maintenance";
        readonly primarySkill: "blueprint-maintenance";
        readonly declaredStatus: "implemented";
        readonly risk: "High: confirmation-gated patch replay across repo files.";
    };
    readonly requiredTools: readonly ["blueprint_patch_list", "blueprint_patch_reapply", "blueprint_patch_record"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/reapply-patches-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-reapply-patches`";
        readonly executionProfile: "high-risk-maintenance";
        readonly rootRoutable: true;
        readonly purpose: "`reapply-patches` previews, confirms, replays, and records host-global Blueprint patch reapplication.";
        readonly reads: readonly ["Host-global patch registry, selected patch manifests, target compatibility, and dry-run replay result."];
        readonly writes: readonly ["approved git patch replay", "~/.<host>/blueprint/patches replay audit"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Workspace And Maintenance";
        readonly command: "reapply-patches";
        readonly primarySkill: "blueprint-maintenance";
        readonly exactMcpDestination: readonly ["blueprint_patch_list", "blueprint_patch_reapply", "blueprint_patch_record"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [];
        readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/reapply-patches-runtime-contract.md, list patches first, dry-run the exact replay set through blueprint_patch_reapply, stop on dirty or incompatible targets, require reapply-patches-confirmation, replay only the previewed patch ids, and record the outcome through blueprint_patch_record.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
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
    readonly "pr-branch": {
        readonly commandName: "pr-branch";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-maintenance";
            readonly declaredStatus: "implemented";
            readonly risk: "High: git branch mutation.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/pr-branch-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-pr-branch`";
            readonly executionProfile: "high-risk-maintenance";
            readonly rootRoutable: true;
            readonly purpose: "`pr-branch` prepares a clean review branch by filtering Blueprint bookkeeping scope and persists a durable report.";
            readonly reads: readonly ["Project health, effective git config, active diff, artifact digest scope, and report contract through MCP plus git inspection."];
            readonly writes: readonly [".blueprint/reports/pr-branch-latest.md", "confirmed git branch"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality And Shipping";
            readonly command: "pr-branch";
            readonly primarySkill: "blueprint-maintenance";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/pr-branch-runtime-contract.md, require a clean tree and review-branch confirmation before git mutation, default to excluding .blueprint/** bookkeeping when configured, persist only the durable report through blueprint_artifact_report_write, and route follow-ups only to implemented commands or manual git/PR steps.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly ship: {
        readonly commandName: "ship";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-maintenance";
            readonly declaredStatus: "implemented";
            readonly risk: "High: remote and git mutation path.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_phase_locate", "blueprint_config_get", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/ship-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-ship`";
            readonly executionProfile: "high-risk-maintenance";
            readonly rootRoutable: true;
            readonly purpose: "`ship` prepares a confirmation-gated shipping run from saved Blueprint evidence and records actual push or PR outcomes.";
            readonly reads: readonly ["Project health, optional phase metadata, effective config, saved evidence, artifact digest scope, and report contract through MCP plus git/gh inspection."];
            readonly writes: readonly [".blueprint/reports/ship-latest.md", ".blueprint/STATE.md when routing changes", "approved git remote or PR state"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality And Shipping";
            readonly command: "ship";
            readonly primarySkill: "blueprint-maintenance";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_phase_locate", "blueprint_config_get", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/ship-runtime-contract.md, keep local prep, push, and PR creation as separate approved steps, write the approved plan before mutation, overwrite ship-latest after actual outcomes, and keep manual fallback durable when remote tooling is unavailable.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly undo: {
        readonly commandName: "undo";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-maintenance";
            readonly declaredStatus: "implemented";
            readonly risk: "High: intentionally destructive history-rewrite-adjacent workflow using safe revert-style steps.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/undo-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-undo`";
            readonly executionProfile: "high-risk-maintenance";
            readonly rootRoutable: true;
            readonly purpose: "`undo` previews a bounded revert, persists a durable undo report, and runs only confirmed safe revert-style git steps.";
            readonly reads: readonly ["Project health, optional phase metadata, affected artifacts, artifact digest scope, and report contract through MCP plus git history inspection."];
            readonly writes: readonly [".blueprint/reports/undo-latest.md", ".blueprint/STATE.md when routing changes", "approved git revert commits"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality And Shipping";
            readonly command: "undo";
            readonly primarySkill: "blueprint-maintenance";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_contract_read", "blueprint_artifact_report_write", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/undo-runtime-contract.md, hard-stop on dirty or unsafe git state, require undo confirmation, write undo-latest before mutation, run only safe git revert style steps, overwrite undo-latest with actual outcome, and update state only after a successful revert changes routing.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "new-workspace": {
        readonly commandName: "new-workspace";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 5;
            readonly family: "Workspace And Maintenance";
            readonly primarySkill: "blueprint-maintenance";
            readonly declaredStatus: "implemented";
            readonly risk: "High: filesystem and git worktree mutation outside the current repo.";
        };
        readonly requiredTools: readonly ["blueprint_config_get", "blueprint_workspace_registry_get", "blueprint_workspace_create"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/new-workspace-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-new-workspace`";
            readonly executionProfile: "high-risk-maintenance";
            readonly rootRoutable: true;
            readonly purpose: "`new-workspace` creates a confirmed multi-repo workspace and records it in host-global Blueprint workspace state.";
            readonly reads: readonly ["Effective config, host-global workspace registry, source repo status, and target path preflight."];
            readonly writes: readonly ["workspace manifest under the selected workspace", "~/.<host>/blueprint/workspaces registry"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Workspace And Maintenance";
            readonly command: "new-workspace";
            readonly primarySkill: "blueprint-maintenance";
            readonly exactMcpDestination: readonly ["blueprint_config_get", "blueprint_workspace_registry_get", "blueprint_workspace_create"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [];
            readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/new-workspace-runtime-contract.md, derive workspace root from config or explicit input, stop on dirty sources or conflicts, require new-workspace-confirmation, and persist only through blueprint_workspace_create and the host-global registry it owns.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "remove-workspace": {
        readonly commandName: "remove-workspace";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 5;
            readonly family: "Workspace And Maintenance";
            readonly primarySkill: "blueprint-maintenance";
            readonly declaredStatus: "implemented";
            readonly risk: "High: confirmation-gated workspace teardown and registry cleanup.";
        };
        readonly requiredTools: readonly ["blueprint_workspace_registry_get", "blueprint_workspace_remove"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/remove-workspace-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-remove-workspace`";
            readonly executionProfile: "high-risk-maintenance";
            readonly rootRoutable: true;
            readonly purpose: "`remove-workspace` tears down an exact confirmed workspace and updates the host-global workspace registry.";
            readonly reads: readonly ["Host-global workspace registry, workspace manifest, recorded repo members, and dirty-tree preflight."];
            readonly writes: readonly ["workspace teardown on disk", "~/.<host>/blueprint/workspaces registry"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Workspace And Maintenance";
            readonly command: "remove-workspace";
            readonly primarySkill: "blueprint-maintenance";
            readonly exactMcpDestination: readonly ["blueprint_workspace_registry_get", "blueprint_workspace_remove"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [];
            readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/remove-workspace-runtime-contract.md, resolve a single registry-backed workspace target, stop on ambiguity, drift, or dirty members, require remove-workspace-confirmation, and persist teardown only through blueprint_workspace_remove.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly workstreams: {
        readonly commandName: "workstreams";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 5;
            readonly family: "Workspace And Maintenance";
            readonly primarySkill: "blueprint-maintenance";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: project-local state mutation with switching semantics.";
        };
        readonly requiredTools: readonly ["blueprint_workstream_list", "blueprint_workstream_mutate", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/workstreams-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-workstreams`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`workstreams` lists, creates, switches, resumes, or completes project-local Blueprint workstreams through MCP-owned state.";
            readonly reads: readonly ["Project-local workstream index and saved per-stream state."];
            readonly writes: readonly [".blueprint/workstreams/WORKSTREAMS.md", ".blueprint/workstreams/<slug>/state.json", ".blueprint/STATE.md for returned resume patches"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Workspace And Maintenance";
            readonly command: "workstreams";
            readonly primarySkill: "blueprint-maintenance";
            readonly exactMcpDestination: readonly ["blueprint_workstream_list", "blueprint_workstream_mutate", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/workstreams-runtime-contract.md, keep read-only operations on blueprint_workstream_list, require explicit targets and switch/archive confirmation gates before mutation, persist workstream changes only through blueprint_workstream_mutate, and apply returned resume statePatch only through blueprint_state_update.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly cleanup: {
        readonly commandName: "cleanup";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 5;
            readonly family: "Workspace And Maintenance";
            readonly primarySkill: "blueprint-maintenance";
            readonly declaredStatus: "implemented";
            readonly risk: "High: confirmation-gated phase-directory archival and removal behavior.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/cleanup-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-cleanup`";
            readonly executionProfile: "high-risk-maintenance";
            readonly rootRoutable: true;
            readonly purpose: "`cleanup` archives completed Blueprint phase directories through a protected-scope confirmation flow and persists a durable cleanup report.";
            readonly reads: readonly ["Project health, roadmap references, artifact inventory, cleanup evidence digest, and filesystem preflight."];
            readonly writes: readonly [".blueprint/reports/cleanup-latest.md", ".blueprint/STATE.md when routing changes", "confirmed phase archive destination"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Workspace And Maintenance";
            readonly command: "cleanup";
            readonly primarySkill: "blueprint-maintenance";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/cleanup-runtime-contract.md, protect the current phase and active roadmap references, require cleanup and destination confirmations before filesystem mutation, write cleanup-latest before archival, and update state only after successful approved archival.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly update: {
        readonly commandName: "update";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 5;
            readonly family: "Workspace And Maintenance";
            readonly primarySkill: "blueprint-maintenance";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: advisory only; no in-session self-update.";
        };
        readonly requiredTools: readonly ["blueprint_update_check", "blueprint_update_plan"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/update-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-update`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`update` inspects the installed Blueprint extension and prepares an advisory out-of-band update checklist.";
            readonly reads: readonly ["Host, installed extension path, installed version, provenance, latest-version lookup status, and warnings."];
            readonly writes: readonly ["~/.<host>/blueprint/updates/ when checklist persistence is chosen"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Workspace And Maintenance";
            readonly command: "update";
            readonly primarySkill: "blueprint-maintenance";
            readonly exactMcpDestination: readonly ["blueprint_update_check", "blueprint_update_plan"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [];
            readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/update-runtime-contract.md, keep installed extension handling read-only, use update-mode-gate for saved checklist versus manual fallback, persist only through blueprint_update_plan under host-global update state, and always end with restart guidance.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "reapply-patches": {
        readonly commandName: "reapply-patches";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 5;
            readonly family: "Workspace And Maintenance";
            readonly primarySkill: "blueprint-maintenance";
            readonly declaredStatus: "implemented";
            readonly risk: "High: confirmation-gated patch replay across repo files.";
        };
        readonly requiredTools: readonly ["blueprint_patch_list", "blueprint_patch_reapply", "blueprint_patch_record"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-maintenance/references/reapply-patches-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-reapply-patches`";
            readonly executionProfile: "high-risk-maintenance";
            readonly rootRoutable: true;
            readonly purpose: "`reapply-patches` previews, confirms, replays, and records host-global Blueprint patch reapplication.";
            readonly reads: readonly ["Host-global patch registry, selected patch manifests, target compatibility, and dry-run replay result."];
            readonly writes: readonly ["approved git patch replay", "~/.<host>/blueprint/patches replay audit"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Workspace And Maintenance";
            readonly command: "reapply-patches";
            readonly primarySkill: "blueprint-maintenance";
            readonly exactMcpDestination: readonly ["blueprint_patch_list", "blueprint_patch_reapply", "blueprint_patch_record"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [];
            readonly contractNotes: "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/reapply-patches-runtime-contract.md, list patches first, dry-run the exact replay set through blueprint_patch_reapply, stop on dirty or incompatible targets, require reapply-patches-confirmation, replay only the previewed patch ids, and record the outcome through blueprint_patch_record.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
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
