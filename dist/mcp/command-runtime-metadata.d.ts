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
