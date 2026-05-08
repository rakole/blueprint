import type { BlueprintInternalToolName } from "./runtime-vocabulary.js";
import { type BlueprintAgentName } from "./agent-metadata.js";
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
    optionalAgents: readonly BlueprintAgentName[];
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
        optionalAgents: readonly BlueprintAgentName[];
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
    readonly requiredInputPaths: readonly ["skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"];
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
export declare const INSERT_PHASE_RUNTIME_METADATA: {
    readonly commandName: "insert-phase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 2;
        readonly family: "Roadmap And Milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: inserts the next decimal phase after an integer phase without renumbering later roadmap entries.";
    };
    readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_roadmap_insert_phase", "blueprint_artifact_scaffold", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-insert-phase`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`insert-phase` inserts urgent work as a decimal phase between existing phases, scaffolds the matching phase context starter, records roadmap evolution state, and routes back to discovery without renumbering later phases.";
        readonly reads: readonly ["The current roadmap and milestone inventory through blueprint_roadmap_read."];
        readonly writes: readonly [".blueprint/ROADMAP.md", ".blueprint/phases/<phasePrefix>-<phaseSlug>/", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Roadmap And Milestone";
        readonly command: "insert-phase";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_roadmap_insert_phase", "blueprint_artifact_scaffold", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Interactive-read profile for bounded roadmap insertion: use skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md as the rich behavior contract, require a confirmed integer anchor plus non-empty description, keep decimal numbering roadmap-driven, scaffold only starter phase.context content from the returned phasePrefix, prefer ask_user for the insert confirmation gate, keep the waiting state explicit as phase-insert-confirmation, invalid-insertion-anchor, or conflicting-decimal-directory, preserve the no-subagent fallback and reject browser/web-search/shell-only or generic agents as substitutes, report partial MCP-write failures without hand-editing .blueprint/, record the inserted decimal in STATE.md through roadmapEvolutionNotes, and route to /blu-discuss-phase <decimal> without adopting long-running progress tools.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const REMOVE_PHASE_RUNTIME_METADATA: {
    readonly commandName: "remove-phase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 2;
        readonly family: "Roadmap And Milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly declaredStatus: "implemented";
        readonly risk: "High: deletes a future phase and renumbers later roadmap references plus phase artifacts.";
    };
    readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_phase_locate", "blueprint_roadmap_remove_phase", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["commands/blu-remove-phase.toml"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-remove-phase`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`remove-phase` removes a future roadmap phase, deletes its phase directory, renumbers subsequent roadmap and phase artifacts, and re-anchors state on the safest implemented follow-up.";
        readonly reads: readonly ["The current roadmap and milestone inventory through blueprint_roadmap_read.", "Existing target-phase artifacts and drift through blueprint_phase_locate."];
        readonly writes: readonly [".blueprint/ROADMAP.md", "renamed phase directories and phase-scoped artifact filenames under .blueprint/phases/", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Roadmap And Milestone";
        readonly command: "remove-phase";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_phase_locate", "blueprint_roadmap_remove_phase", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Interactive-read profile for bounded roadmap removal: preview the target phase through phase location, prefer ask_user for the destructive confirmation gates, keep the waiting state explicit as future-phase-guard, remove-phase-confirmation, or force-remove-confirmation, allow force: true only after execution evidence triggers the second explicit approval path, and re-anchor state on /blu-progress without adopting long-running progress tools.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const PLAN_MILESTONE_GAPS_RUNTIME_METADATA: {
    readonly commandName: "plan-milestone-gaps";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 2;
        readonly family: "Roadmap And Milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: can add multiple phases in one pass.";
    };
    readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_roadmap_add_phase", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-roadmapper"];
    readonly requiredInputPaths: readonly ["commands/blu-plan-milestone-gaps.toml"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-plan-milestone-gaps`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`plan-milestone-gaps` creates grouped roadmap phases to close actionable gaps identified by the saved milestone audit, keeping persistence on roadmap and state MCP tools.";
        readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_artifact_list -> {artifacts, reports, missing}", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
        readonly writes: readonly [".blueprint/ROADMAP.md", "new phase directories for approved gaps", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Roadmap And Milestone";
        readonly command: "plan-milestone-gaps";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_roadmap_add_phase", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-roadmapper"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Interactive-read profile for bounded audit-follow-up planning: locate the matching milestone audit, preserve grouped requirement, integration, flow, and optional sections with traceability repair notes, prefer ask_user for the grouped plan confirmation gate, keep the waiting state explicit as missing-milestone-audit, no-actionable-gaps, or gap-plan-confirmation, append coherent phases through repeated roadmap-add-phase calls, and route to /blu-discuss-phase <first new phase> without adopting long-running progress tools.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const AUDIT_MILESTONE_RUNTIME_METADATA: {
    readonly commandName: "audit-milestone";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 2;
        readonly family: "Roadmap And Milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: report generation only.";
    };
    readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_phase_summary_index", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_artifact_report_write"];
    readonly optionalAgents: readonly ["blueprint-verifier"];
    readonly requiredInputPaths: readonly ["commands/blu-audit-milestone.toml"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-audit-milestone`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`audit-milestone` compares original milestone intent against saved phase evidence and writes a durable milestone audit report with grouped gaps and traceability notes.";
        readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_phase_summary_index -> phase summary evidence", "blueprint_artifact_list -> {artifacts, reports, missing}", "blueprint_artifact_contract_read -> report.milestone-audit contract", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
        readonly writes: readonly ["milestone audit report in .blueprint/reports/"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Roadmap And Milestone";
        readonly command: "audit-milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_phase_summary_index", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_artifact_report_write"];
        readonly optionalAgents: readonly ["blueprint-verifier"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Interactive-read profile for bounded milestone auditing: compare original milestone intent against completed phase evidence, read report.milestone-audit before drafting, keep grouped gap sections plus traceability notes for downstream repair, prefer ask_user for overwrite confirmation, keep the waiting state explicit as milestone-audit-overwrite-confirmation, and stay report-local in .blueprint/reports/ without adopting long-running progress tools.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const COMPLETE_MILESTONE_RUNTIME_METADATA: {
    readonly commandName: "complete-milestone";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 2;
        readonly family: "Roadmap And Milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: writes milestone closeout evidence and advances archival routing.";
    };
    readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_state_load", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["commands/blu-complete-milestone.toml"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-complete-milestone`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`complete-milestone` performs a report-driven closeout gated by saved milestone audit readiness, writes a durable completion report, and routes to milestone summary.";
        readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_artifact_list -> {artifacts, reports, missing}", "blueprint_state_load -> derivedStatus.milestoneAudit readiness", "blueprint_artifact_contract_read -> report.milestone-complete contract", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
        readonly writes: readonly [".blueprint/reports/milestone-complete-<version>.md", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Roadmap And Milestone";
        readonly command: "complete-milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_state_load", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Interactive-read profile for bounded milestone closeout: require the saved milestone audit and derivedStatus.milestoneAudit.readyForCompletion, read report.milestone-complete before drafting, prefer ask_user for overwrite confirmation, keep the waiting state explicit as missing-milestone-audit, milestone-not-ready, or milestone-complete-overwrite-confirmation, write milestone-complete-<version>.md, and route to /blu-milestone-summary <milestone> without adopting long-running progress tools.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const MILESTONE_SUMMARY_RUNTIME_METADATA: {
    readonly commandName: "milestone-summary";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 2;
        readonly family: "Roadmap And Milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: report generation and routing only.";
    };
    readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["commands/blu-milestone-summary.toml"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-milestone-summary`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`milestone-summary` builds a durable milestone summary from saved roadmap, audit, and completion evidence and routes toward the next milestone-start action.";
        readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_artifact_list -> {artifacts, reports, missing}", "blueprint_artifact_contract_read -> report.milestone-summary contract", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
        readonly writes: readonly [".blueprint/reports/milestone-summary-<version>.md", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Roadmap And Milestone";
        readonly command: "milestone-summary";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Interactive-read profile for bounded milestone summarization: use saved audit and completion evidence, read report.milestone-summary before drafting, prefer ask_user for overwrite confirmation, keep the waiting state explicit as missing-milestone-audit, missing-milestone-complete, or milestone-summary-overwrite-confirmation, write milestone-summary-<version>.md, and route to /blu-new-milestone without pulling in later-wave docs agents or adopting long-running progress tools.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const NEW_MILESTONE_RUNTIME_METADATA: {
    readonly commandName: "new-milestone";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 2;
        readonly family: "Roadmap And Milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: rewrites milestone starter docs through carry-forward scaffolding and advances state without deleting historical phase artifacts.";
    };
    readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_artifact_scaffold", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-roadmapper"];
    readonly requiredInputPaths: readonly ["commands/blu-new-milestone.toml"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-new-milestone`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`new-milestone` starts a new milestone cycle by deriving carry-forward context from the saved milestone summary, scaffolding starter docs and the first phase context, and preserving historical phase artifacts.";
        readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_artifact_contract_read -> report.milestone-summary and phase.context contracts", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
        readonly writes: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/phases/<next-phase-slug>/<NN-CONTEXT.md>", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Roadmap And Milestone";
        readonly command: "new-milestone";
        readonly primarySkill: "blueprint-roadmap-admin";
        readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_artifact_scaffold", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-roadmapper"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Interactive-read profile for bounded milestone restart: use the saved milestone summary as durable carry-forward input, read report.milestone-summary before seeding, read phase.context before scaffolding the first carried-forward phase, prefer ask_user for reset-versus-carry-forward and overwrite confirmations, keep the waiting state explicit as missing-milestone-summary, carry-forward-confirmation, or starter-doc-overwrite-confirmation, preserve historical phase artifacts, and route to /blu-discuss-phase <first phase> without adopting long-running progress tools.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const HELP_RUNTIME_METADATA: {
    readonly commandName: "help";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 0;
        readonly family: "Foundation";
        readonly primarySkill: "blueprint-router";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: read-only router guidance from project status and the live command catalog.";
    };
    readonly requiredTools: readonly ["blueprint_command_catalog", "blueprint_project_status"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["commands/blu-help.toml"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-help`";
        readonly executionProfile: "router";
        readonly rootRoutable: true;
        readonly purpose: "`help` shows safe Blueprint router guidance from project readiness and the implemented command catalog.";
        readonly reads: readonly ["Project status and command availability through Blueprint MCP tools."];
        readonly writes: readonly [];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Foundation";
        readonly command: "help";
        readonly primarySkill: "blueprint-router";
        readonly exactMcpDestination: readonly ["blueprint_command_catalog", "blueprint_project_status"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [];
        readonly contractNotes: "Router profile; report the waiting state from project status, keep the next safe action explicit, and never present planned or blocked commands as runnable. This includes map-first waiting states: brownfield uninitialized and mapping-incomplete route to /blu-map-codebase, while mapped-only routes to /blu-new-project.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
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
        readonly contractNotes: "Router profile; preserve read-only next-step guidance while surfacing active profile, branching mode, blockers, pending gates, and config warnings from normalized config, and keep recommendations inside the implemented runtime surface. Brownfield uninitialized and mapping-incomplete states point to /blu-map-codebase; mapped-only points to /blu-new-project. Planned or blocked commands are not runnable.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const NEXT_RUNTIME_METADATA: {
    readonly commandName: "next";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-router";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: read-only next-step routing from project status, state, artifacts, and the live command catalog.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_state_load", "blueprint_artifact_list", "blueprint_command_catalog"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["commands/blu-next.toml"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-next`";
        readonly executionProfile: "router";
        readonly rootRoutable: true;
        readonly purpose: "`next` returns the next safe direct Blueprint command for the current repo state without widening beyond implemented commands.";
        readonly reads: readonly [".blueprint/ state, artifact inventory, project status, and command catalog through MCP tools."];
        readonly writes: readonly [];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "next";
        readonly primarySkill: "blueprint-router";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_state_load", "blueprint_artifact_list", "blueprint_command_catalog"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [];
        readonly contractNotes: "Host-native router flow; report waiting state and the next safe follow-up explicitly, and never hide destructive behavior behind implicit routing. This includes /blu-map-codebase for unmapped brownfield or mapping-incomplete and /blu-new-project for mapped-only. Planned or blocked commands are not runnable.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const MAP_CODEBASE_RUNTIME_METADATA: {
    readonly commandName: "map-codebase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 0;
        readonly family: "Foundation";
        readonly primarySkill: "blueprint-map";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: refresh mode can replace existing codebase-mapping artifacts.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_artifact_scaffold", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_codebase_artifact_write", "blueprint_artifact_validate"];
    readonly optionalAgents: readonly ["blueprint-mapper"];
    readonly requiredInputPaths: readonly ["commands/blu-map-codebase.toml", "skills/blueprint-map/references/map-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-map-codebase`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`map-codebase` analyzes a brownfield codebase with mapper-style passes and produces the stable seven-document Blueprint codebase bundle. Focus areas deepen the same bundle instead of creating a separate suffix-only mode.";
        readonly reads: readonly [];
        readonly writes: readonly [".blueprint/codebase/STACK.md", ".blueprint/codebase/ARCHITECTURE.md", ".blueprint/codebase/STRUCTURE.md", ".blueprint/codebase/CONVENTIONS.md", ".blueprint/codebase/TESTING.md", ".blueprint/codebase/INTEGRATIONS.md", ".blueprint/codebase/CONCERNS.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Foundation";
        readonly command: "map-codebase";
        readonly primarySkill: "blueprint-map";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_artifact_scaffold", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_codebase_artifact_write", "blueprint_artifact_validate"];
        readonly optionalAgents: readonly ["blueprint-mapper"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for read-heavy brownfield mapping: load the local map runtime contract at skills/blueprint-map/references/map-runtime-contract.md, keep reuse as the default posture, treat supplied focus areas as targeted deepening across the same seven-document bundle, require ask_user confirmation for refresh or replace paths before any overwrite, read the canonical codebase contract before scaffold or refresh decisions, use contract.authoringTemplate as the heading authority, pass digest inputs as repo-relative paths and treat returned inputsUsed as authoritative, persist substantive mapping content through blueprint_codebase_artifact_write, repair invalid write results from returned issues before moving on, validate the resulting bundle, and route a successful map-first brownfield repo to /blu-new-project.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
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
export declare const PLAN_PHASE_RUNTIME_METADATA: {
    readonly commandName: "plan-phase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-phase-planning";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: can replace plans and change downstream execution order.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_phase_research_status", "blueprint_phase_artifact_read", "blueprint_phase_validation_read", "blueprint_review_load_findings", "blueprint_artifact_contract_read", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_plan_authoring_context", "blueprint_phase_plan_validate_model", "blueprint_phase_plan_write", "blueprint_phase_plan_validate", "blueprint_config_get", "blueprint_state_load", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-planner", "blueprint-checker"];
    readonly requiredInputPaths: readonly ["skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-plan-phase`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`plan-phase` creates or extends execution-ready phase plans through MCP-owned structured phase.plan model validation and plan writes.";
        readonly reads: readonly ["Phase resolution, context, planning readiness, saved discovery artifacts, validation and review evidence, plan inventory, plan authoring schema, effective config, and state through MCP."];
        readonly writes: readonly ["structured phase.plan JSON through blueprint_phase_plan_write", ".blueprint/phases/<phase>/<phase-prefix>-<plan-id>-PLAN.md (XX-YY-PLAN.md) through blueprint_phase_plan_write", ".blueprint/STATE.md through synced state update"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "plan-phase";
        readonly primarySkill: "blueprint-phase-planning";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_phase_research_status", "blueprint_phase_artifact_read", "blueprint_phase_validation_read", "blueprint_review_load_findings", "blueprint_artifact_contract_read", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_plan_authoring_context", "blueprint_phase_plan_validate_model", "blueprint_phase_plan_write", "blueprint_phase_plan_validate", "blueprint_config_get", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-planner", "blueprint-checker"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile; keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible. Load skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md as the local runtime contract, respect blueprint_phase_research_status.planningReadiness as the config-aware pre-draft handoff gate, consume saved research instead of live browsing for freshness-sensitive technical decisions, and route to /blu-research-phase when research evidence is required. Author phase.plan as structured JSON against blueprint_phase_plan_authoring_context.taskSchema and contract.modelContract.schemaPath, re-read blueprint_phase_plan_authoring_context immediately before each model validation/write after any successful plan write because saved plan files are intentional later-slot evidence artifacts, validate with blueprint_phase_plan_validate_model, persist the same model through blueprint_phase_plan_write with validationMode: \"strict\" and authoringMode: \"model-only\", and reject scaffold-placeholder seeding, Markdown fallback, raw .blueprint edits, or warn-mode writes from /blu-plan-phase. Gate reuse/revise/replace only for writes that revise or replace saved plan ids, while additive new plan ids may proceed without an overwrite gate. Use blueprint-planner when suitable, preserve the one-plan-at-a-time no-subagent fallback, run blueprint-checker only when workflow.plan_check is enabled, and keep the checker/fallback loop bounded. Repair MCP validation, write, or scoped plan diagnostics against the live task schema before retrying, run blueprint_phase_plan_validate after persistence, then call blueprint_state_update with base: \"synced\" followed by state-aware routing to implemented follow-ups.";
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
        readonly contractNotes: "Long-running-mutation profile for topic-strand phase research: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial multi-strand research without turning them into persistence, and when those helpers are unavailable fall back to short progress recaps plus MCP-backed checkpoints and STATE.md. Ground repo truth first in phase context, actual saved context content, existing research, and saved codebase summaries, stop on missing XX-CONTEXT.md instead of drafting from status-only signals, read blueprint_config_get before any official-doc or external verification, honor research.external_sources as off/ask/auto, use official docs or explicitly supplied external references only when the repo cannot settle a claim, keep repo-derived evidence distinct from external truth in the finished research, treat State Of The Art freshness wording as runtime-contract guidance rather than an MCP validation gate, use skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md as the rich behavior contract, keep contract.authoringTemplate as schema authority, reserve blueprint_artifact_scaffold for deliberate placeholder creation only, use capability-gated blueprint-researcher only when suitable Blueprint research or code-analysis agents are available, require the parent to supply any official-doc or external evidence packet instead of asking the subagent to fetch it, preserve the single-agent topic-strand fallback when they are not, reject browser/web-search/shell-only or generic agents as substitutes, force repair when existing research is invalid, sync STATE.md even on valid non-writing reuse paths, repair invalid writes or validation failures before completion, checkpoint inconclusive strands instead of bluffing a final artifact, delete only research-owned shared checkpoints, and keep routing limited to implemented commands only.";
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
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_research_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_artifact_scaffold", "blueprint_state_load", "blueprint_command_catalog", "blueprint_state_update"];
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
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_research_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_artifact_scaffold", "blueprint_state_load", "blueprint_command_catalog", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-ui-designer", "blueprint-checker"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for bounded UI-contract drafting: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, keep contract-versus-skip posture, workflow.ui_safety_gate rationale confirmation, overwrite confirmation, checker-requested revision, and MCP validation repair explicit as visible gates, read the canonical phase.ui-spec contract before drafting or persisting, read actual saved context and research bodies when status reports them, load skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md as the richness, evidence, fallback, and retry authority, keep contract.authoringTemplate as heading/schema authority, use capability-gated blueprint-ui-designer and blueprint-checker for design-system evidence plus six-dimension UI quality review, preserve the no-subagent section-by-section fallback, reject browser/web-search/shell-only or generic substitute agents, repair invalid writes or checker-blocked dimensions before completion, call blueprint_state_update with base: \"synced\" while preserving patch.currentPhase and patch.activeCommand, then re-load blueprint_state_load.derivedStatus.nextAction and keep final routing constrained by blueprint_command_catalog, and use XX-UI-SPEC.md as the single durable output for either a UI contract or an explicit skip rationale.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const EXECUTE_PHASE_RUNTIME_METADATA: {
    readonly commandName: "execute-phase";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 1;
        readonly family: "Core Lifecycle";
        readonly primarySkill: "blueprint-phase-execution";
        readonly declaredStatus: "implemented";
        readonly risk: "High: drives real repo mutation during implementation and records execution summaries.";
    };
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_plan_index", "blueprint_phase_execution_targets", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_summary_authoring_context", "blueprint_phase_summary_validate_model", "blueprint_phase_summary_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-executor"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-execute-phase`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`execute-phase` executes saved phase plans in deterministic target order, records plan-linked execution summaries, and syncs Blueprint state without claiming phase completion.";
        readonly reads: readonly [".blueprint/config.json", ".blueprint/STATE.md", "selected plan and summary files through MCP", "phase.summary contract"];
        readonly writes: readonly ["one or more XX-YY-SUMMARY.md files", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Core Lifecycle";
        readonly command: "execute-phase";
        readonly primarySkill: "blueprint-phase-execution";
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_plan_index", "blueprint_phase_execution_targets", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_summary_authoring_context", "blueprint_phase_summary_validate_model", "blueprint_phase_summary_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-executor"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Long-running-mutation profile; keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, pair Gemini-native update_topic and write_todos for long execution runs without turning them into persistence, read the canonical phase.summary contract plus the Markdown-first summary authoring context before any summary write or replacement, use blueprint_phase_execution_targets for deterministic target selection plus overwrite and overlap warnings, refuse stale or invalid saved plans, preserve wave order and lower-wave blockers, use bounded blueprint-executor agents only with explicit disjoint write ownership, fall back to one-plan-at-a-time inline execution when agents are unavailable or unsafe, persist PARTIAL or BLOCKED summaries as durable carry-forward evidence, run targeted verification plus bounded repair before COMPLETED summaries, rerun the summary index before synced state update, never persist execute-phase reports, and never claim phase completion before validation and verification evidence exists. The rich command-local contract lives in skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md.";
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
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_project_status", "blueprint_config_get"];
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
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_project_status", "blueprint_config_get"];
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
        readonly contractNotes: "Long-running-mutation profile; validate saved summary evidence through the phase validation MCP substrate, use schema/evidence-rich MCP text from the validation and contract tools when host structured content is hidden, author the phase.verification 1.1.0 model with status equal to gateState, normalize covered coverage to COVERED, preserve extended validation evidence fields, and route only to implemented follow-up commands.";
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
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_review_scope", "blueprint_review_load_findings", "blueprint_review_validate_model", "blueprint_review_record"];
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
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_review_scope", "blueprint_review_load_findings", "blueprint_review_validate_model", "blueprint_review_record"];
        readonly optionalAgents: readonly ["blueprint-reviewer"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for deterministic phase-scoped review: keep Resolve/Read/Decide/Execute/Validate/Persist/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial review runs without turning them into persistence, let blueprint_review_scope own review enablement, normalized depth defaults, saved evidence inventory, deterministic repo-file scoping, authoring context, and narrowed task schema, load skills/blueprint-review/references/code-review-runtime-contract.md for model-only JSON authoring, depth semantics, evidence richness, capability-gated reviewer use, no-subagent fallback, and MCP retry/repair behavior, repair invalid models against modelContract.jsonSchema, the narrowed task schema, and returned diagnostics instead of rendered Markdown shape, keep explicit scope or overwrite confirmation when broad scope or existing review evidence needs approval, fail any invalid explicit --files scope instead of silently narrowing it, load saved XX-REVIEW.md findings before overwrite decisions, validate the authored model through blueprint_review_validate_model, and persist the model through blueprint_review_record so MCP renders canonical XX-REVIEW.md without Markdown fallback. When security still routes first, keep code-review-fix visible as the secondary queued follow-up if concrete follow-up fixes remain.";
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
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_config_get", "blueprint_review_load_findings", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record", "blueprint_state_update"];
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
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_config_get", "blueprint_review_load_findings", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-reviewer"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Long-running-mutation profile for bounded saved-finding remediation: default unscoped remediation to saved follow-up findings, keep repo mutation scoped to selected findings, use blueprint-reviewer only for read-only selected-target fix/defer/skip reclassification plus stale-evidence notes, keep the inline fallback on the same one-target-at-a-time decision contract, author only the review.review-fix schema's camelCase JSON fields while forbidding rendered-heading or locked-marker keys, validate through blueprint_review_validate_model, persist through review MCP tools, and update STATE.md through blueprint_state_update with base synced plus explicit activeCommand/currentPhase/nextAction patch fields before routing follow-up through implemented validation or progress commands only.";
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
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_review_scope", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
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
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_review_scope", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-reviewer", "blueprint-verifier"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Long-running-mutation profile for bounded saved-evidence remediation: load skills/blueprint-review/references/audit-fix-runtime-contract.md, resolve the phase and artifact inventory, let blueprint_review_scope own the repo-file scope, classify only selected saved evidence, keep --source, --severity, --max, --dry-run, mutation confirmation, report overwrite, optional todo capture, active stage, and early-stop state explicit, use blueprint-reviewer only for bounded read-only classification and blueprint-verifier only for bounded post-fix verification, validate the structured report.audit-fix model through blueprint_artifact_report_validate_model, repair invalid diagnostics by exact path, code, repair, allowedValues, missing, argsPatch, and repairSummary guidance, reread authoring context when runtime context is stale or incomplete, persist it through blueprint_artifact_report_write, append confirmed todo follow-ups through blueprint_artifact_mutate_index, update state through blueprint_state_update, and stop with top diagnostics plus suggestedRepairs rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.";
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
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
    readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_render", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_phase_validation_write", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_state_load", "blueprint_state_update"];
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
        readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_render", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_phase_validation_write", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-executor", "blueprint-verifier"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Long-running-mutation profile for evidence-backed test generation; keep repo mutation scoped to selected tests and persist validation/report evidence through MCP tools.";
        readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
    };
};
export declare const DOCS_UPDATE_RUNTIME_METADATA: {
    readonly commandName: "docs-update";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-docs";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: writes selected repo documentation files and a durable docs-update report.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write"];
    readonly optionalAgents: readonly ["blueprint-doc-writer", "blueprint-doc-verifier"];
    readonly requiredInputPaths: readonly ["skills/blueprint-docs/references/docs-update-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-docs-update`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`docs-update` refreshes or verifies selected repo documentation against saved Blueprint and repo evidence, optionally checks current external truth, and persists the durable docs-update report through MCP.";
        readonly reads: readonly ["Project health, artifact inventory, selected repo documentation, source files, tests, saved Blueprint artifacts, digest inputsUsed, and optional cited external truth."];
        readonly writes: readonly ["selected repo documentation files when not verify-only", ".blueprint/reports/docs-update-latest.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality And Shipping";
        readonly command: "docs-update";
        readonly primarySkill: "blueprint-docs";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write"];
        readonly optionalAgents: readonly ["blueprint-doc-writer", "blueprint-doc-verifier"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for scoped repo documentation refresh or verification: load commands/blu-docs-update.toml and skills/blueprint-docs/references/docs-update-runtime-contract.md, resolve a narrow doc scope before drafting, keep repo truth from selected docs, source files, tests, saved Blueprint artifacts, digest inputsUsed, and optional cited external truth separate, keep --verify-only read-only for repo docs while still allowing the durable report, gate broad scope, doc replacement, and report replacement unless --force already supplies approval, use blueprint-doc-writer and blueprint-doc-verifier only for bounded docs passes when available, persist the report through blueprint_artifact_report_write with bare reportName docs-update-latest, keep Blueprint persistence inside .blueprint/reports/, and route only to implemented follow-ups such as /blu-map-codebase or /blu-progress.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const IMPACT_RUNTIME_METADATA: {
    readonly commandName: "impact";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 4;
        readonly family: "Quality And Shipping";
        readonly primarySkill: "blueprint-impact";
        readonly declaredStatus: "implemented";
        readonly risk: "Low: advisory blast-radius report writes only under .blueprint/impact/.";
    };
    readonly requiredTools: readonly ["blueprint_impact_config_get", "blueprint_impact_scope_resolve", "blueprint_impact_context_load", "blueprint_impact_analyze", "blueprint_impact_report_write", "blueprint_impact_output_render"];
    readonly optionalAgents: readonly [];
    readonly requiredInputPaths: readonly ["skills/blueprint-impact/references/impact-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-impact`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`impact` performs advisory blast-radius analysis for a resolved change scope, persists an impact report bundle when writing is enabled, and renders the requested output format through the impact MCP substrate.";
        readonly reads: readonly ["impact config, resolved scope, source files, runtime metadata, Blueprint artifacts, ownership or dependency metadata, PR or deployment context, and command catalog state as read-only evidence"];
        readonly writes: readonly [".blueprint/impact/<impact-id>/ only through blueprint_impact_report_write when writing is enabled"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Quality And Shipping";
        readonly command: "impact";
        readonly primarySkill: "blueprint-impact";
        readonly exactMcpDestination: readonly ["blueprint_impact_config_get", "blueprint_impact_scope_resolve", "blueprint_impact_context_load", "blueprint_impact_analyze", "blueprint_impact_report_write", "blueprint_impact_output_render"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly [".blueprint write guard"];
        readonly contractNotes: "Long-running-mutation profile for advisory blast-radius analysis with no subagents. Load skills/blueprint-impact/references/impact-runtime-contract.md, resolve scope through the impact MCP tools, keep source files, runtime files, PR metadata, deployment state, and command-catalog state read-only, persist impact bundles only through blueprint_impact_report_write under .blueprint/impact/<impact-id>/, render final human, JSON, Markdown, PR-comment, or summary output only through blueprint_impact_output_render, treat BLOCK as advisory rather than permission to mutate non-impact state, and route follow-up guidance only to implemented commands.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "behavior-audited"];
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
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_mutate_index", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold"];
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
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_mutate_index", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold"];
        readonly optionalAgents: readonly ["blueprint-researcher"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
        readonly contractNotes: "Docless manifest+skill-owned runtime for short ideation routing: require explicit idea text, read blueprint_project_status first, classify exactly one target among note, todo, backlog, roadmap, and no-write, use blueprint-researcher only for bounded context checks that materially affect routing, require explicit routing confirmation before persistence, write note/todo/backlog targets through blueprint_artifact_mutate_index with duplicate handling, append roadmap work through blueprint_roadmap_add_phase and scaffold only returned context paths, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const QUICK_RUNTIME_METADATA: {
    readonly commandName: "quick";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 3;
        readonly family: "Capture And Lightweight Execution";
        readonly primarySkill: "blueprint-phase-execution";
        readonly declaredStatus: "implemented";
        readonly risk: "High: can execute repo changes with reduced ceremony.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_command_catalog", "blueprint_artifact_report_write", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-researcher", "blueprint-planner", "blueprint-executor", "blueprint-verifier"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-quick`";
        readonly executionProfile: "long-running-mutation";
        readonly rootRoutable: true;
        readonly purpose: "`quick` runs bounded quick delivery with optional depth gates, persists durable quick-run evidence, and routes follow-up through implemented Blueprint commands.";
        readonly reads: readonly ["project status, command availability, and current next-step posture through MCP"];
        readonly writes: readonly ["quick-run report in .blueprint/reports/", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Capture And Lightweight Execution";
        readonly command: "quick";
        readonly primarySkill: "blueprint-phase-execution";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_command_catalog", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-researcher", "blueprint-planner", "blueprint-executor", "blueprint-verifier"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Long-running-mutation profile for non-trivial bounded quick runs; keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, require explicit opt-in for deeper discuss, research, or validation passes, treat branchy quick work as tracker-eligible session-local coordination paired with visible todos, persist durable quick-run evidence through blueprint_artifact_report_write using the canonical quick-run-latest report name, and do not let quick impersonate saved planning or broad lifecycle execution. The rich command-local contract lives in skills/blueprint-phase-execution/references/quick-runtime-contract.md.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const DEBUG_RUNTIME_METADATA: {
    readonly commandName: "debug";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 3;
        readonly family: "Capture And Lightweight Execution";
        readonly primarySkill: "blueprint-debug";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: exploratory shell commands and test runs are likely.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
    readonly optionalAgents: readonly ["blueprint-debugger"];
    readonly requiredInputPaths: readonly ["commands/blu-debug.toml", "skills/blueprint-debug/references/debug-runtime-contract.md"];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-debug`";
        readonly executionProfile: "interactive-read -> long-running-mutation when non-trivial";
        readonly rootRoutable: true;
        readonly purpose: "`debug` investigates a concrete issue, persists a durable debug-latest report, and stops at an explicit follow-up gate before todo capture or fix attempts.";
        readonly reads: readonly ["project status, user-provided issue evidence, relevant local files, command outputs, and prior debug-latest report content when continuing"];
        readonly writes: readonly [".blueprint/reports/debug-latest.md", "optional explicit follow-up todo through .blueprint/todos/TODO.md", ".blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Capture And Lightweight Execution";
        readonly command: "debug";
        readonly primarySkill: "blueprint-debug";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-debugger"];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Interactive-read profile for evidence-backed investigations that can stay concise; long-running-mutation profile only for non-trivial investigations. Load commands/blu-debug.toml plus skills/blueprint-debug/references/debug-runtime-contract.md, require a concrete issue statement and initialized Blueprint state before durable persistence, keep --diagnose honest as diagnose-only until the user confirms a fix attempt, use update_topic and write_todos only as session-local visibility for non-trivial investigations, persist the durable report through blueprint_artifact_report_write with the bare debug-latest name and treat returned paths and ids as authoritative, require overwrite confirmation before replacing an existing report, capture persisted todos only after an explicit user ask or confirmation through blueprint_artifact_mutate_index, update state through blueprint_state_update, route implemented follow-ups only to /blu-quick, /blu-plan-phase, /blu-validate-phase, or /blu-progress, and do not hide state or perform broad direct fixes inside debug.";
        readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
    };
};
export declare const FAST_RUNTIME_METADATA: {
    readonly commandName: "fast";
    readonly sourceId: string;
    readonly catalog: {
        readonly wave: 3;
        readonly family: "Capture And Lightweight Execution";
        readonly primarySkill: "blueprint-phase-execution";
        readonly declaredStatus: "implemented";
        readonly risk: "Medium: minimal-planning repo mutation path.";
    };
    readonly requiredTools: readonly ["blueprint_project_status", "blueprint_state_update"];
    readonly optionalAgents: readonly [];
    readonly spec: {
        readonly path: string;
        readonly title: "`/blu-fast`";
        readonly executionProfile: "interactive-read";
        readonly rootRoutable: true;
        readonly purpose: "`fast` handles genuinely trivial inline execution without subagents, durable reports, or phase artifacts.";
        readonly reads: readonly ["project status through MCP when useful"];
        readonly writes: readonly ["optional .blueprint/STATE.md"];
    };
    readonly runtimeReference: {
        readonly path: string;
        readonly waveTitle: "Capture And Lightweight Execution";
        readonly command: "fast";
        readonly primarySkill: "blueprint-phase-execution";
        readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
        readonly contractNotes: "Interactive-read profile for trivial inline execution: keep the ask genuinely small, explicitly exclude tracker-backed branching plus update_topic or write_todos long-running visibility, refuse report-backed or subagent depth, update STATE.md only when Blueprint is initialized, do not create quick-run reports, phase summaries, phase artifacts, or other durable execution evidence, and route anything larger to quick or phase planning. The rich command-local contract lives in skills/blueprint-phase-execution/references/fast-runtime-contract.md.";
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
        readonly requiredInputPaths: readonly ["skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"];
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
    readonly "insert-phase": {
        readonly commandName: "insert-phase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 2;
            readonly family: "Roadmap And Milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: inserts the next decimal phase after an integer phase without renumbering later roadmap entries.";
        };
        readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_roadmap_insert_phase", "blueprint_artifact_scaffold", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-insert-phase`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`insert-phase` inserts urgent work as a decimal phase between existing phases, scaffolds the matching phase context starter, records roadmap evolution state, and routes back to discovery without renumbering later phases.";
            readonly reads: readonly ["The current roadmap and milestone inventory through blueprint_roadmap_read."];
            readonly writes: readonly [".blueprint/ROADMAP.md", ".blueprint/phases/<phasePrefix>-<phaseSlug>/", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Roadmap And Milestone";
            readonly command: "insert-phase";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_roadmap_insert_phase", "blueprint_artifact_scaffold", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Interactive-read profile for bounded roadmap insertion: use skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md as the rich behavior contract, require a confirmed integer anchor plus non-empty description, keep decimal numbering roadmap-driven, scaffold only starter phase.context content from the returned phasePrefix, prefer ask_user for the insert confirmation gate, keep the waiting state explicit as phase-insert-confirmation, invalid-insertion-anchor, or conflicting-decimal-directory, preserve the no-subagent fallback and reject browser/web-search/shell-only or generic agents as substitutes, report partial MCP-write failures without hand-editing .blueprint/, record the inserted decimal in STATE.md through roadmapEvolutionNotes, and route to /blu-discuss-phase <decimal> without adopting long-running progress tools.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "remove-phase": {
        readonly commandName: "remove-phase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 2;
            readonly family: "Roadmap And Milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly declaredStatus: "implemented";
            readonly risk: "High: deletes a future phase and renumbers later roadmap references plus phase artifacts.";
        };
        readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_phase_locate", "blueprint_roadmap_remove_phase", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["commands/blu-remove-phase.toml"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-remove-phase`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`remove-phase` removes a future roadmap phase, deletes its phase directory, renumbers subsequent roadmap and phase artifacts, and re-anchors state on the safest implemented follow-up.";
            readonly reads: readonly ["The current roadmap and milestone inventory through blueprint_roadmap_read.", "Existing target-phase artifacts and drift through blueprint_phase_locate."];
            readonly writes: readonly [".blueprint/ROADMAP.md", "renamed phase directories and phase-scoped artifact filenames under .blueprint/phases/", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Roadmap And Milestone";
            readonly command: "remove-phase";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_phase_locate", "blueprint_roadmap_remove_phase", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Interactive-read profile for bounded roadmap removal: preview the target phase through phase location, prefer ask_user for the destructive confirmation gates, keep the waiting state explicit as future-phase-guard, remove-phase-confirmation, or force-remove-confirmation, allow force: true only after execution evidence triggers the second explicit approval path, and re-anchor state on /blu-progress without adopting long-running progress tools.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "plan-milestone-gaps": {
        readonly commandName: "plan-milestone-gaps";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 2;
            readonly family: "Roadmap And Milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: can add multiple phases in one pass.";
        };
        readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_roadmap_add_phase", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-roadmapper"];
        readonly requiredInputPaths: readonly ["commands/blu-plan-milestone-gaps.toml"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-plan-milestone-gaps`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`plan-milestone-gaps` creates grouped roadmap phases to close actionable gaps identified by the saved milestone audit, keeping persistence on roadmap and state MCP tools.";
            readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_artifact_list -> {artifacts, reports, missing}", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
            readonly writes: readonly [".blueprint/ROADMAP.md", "new phase directories for approved gaps", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Roadmap And Milestone";
            readonly command: "plan-milestone-gaps";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_roadmap_add_phase", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-roadmapper"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Interactive-read profile for bounded audit-follow-up planning: locate the matching milestone audit, preserve grouped requirement, integration, flow, and optional sections with traceability repair notes, prefer ask_user for the grouped plan confirmation gate, keep the waiting state explicit as missing-milestone-audit, no-actionable-gaps, or gap-plan-confirmation, append coherent phases through repeated roadmap-add-phase calls, and route to /blu-discuss-phase <first new phase> without adopting long-running progress tools.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "audit-milestone": {
        readonly commandName: "audit-milestone";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 2;
            readonly family: "Roadmap And Milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: report generation only.";
        };
        readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_phase_summary_index", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_artifact_report_write"];
        readonly optionalAgents: readonly ["blueprint-verifier"];
        readonly requiredInputPaths: readonly ["commands/blu-audit-milestone.toml"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-audit-milestone`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`audit-milestone` compares original milestone intent against saved phase evidence and writes a durable milestone audit report with grouped gaps and traceability notes.";
            readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_phase_summary_index -> phase summary evidence", "blueprint_artifact_list -> {artifacts, reports, missing}", "blueprint_artifact_contract_read -> report.milestone-audit contract", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
            readonly writes: readonly ["milestone audit report in .blueprint/reports/"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Roadmap And Milestone";
            readonly command: "audit-milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_phase_summary_index", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_artifact_report_write"];
            readonly optionalAgents: readonly ["blueprint-verifier"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Interactive-read profile for bounded milestone auditing: compare original milestone intent against completed phase evidence, read report.milestone-audit before drafting, keep grouped gap sections plus traceability notes for downstream repair, prefer ask_user for overwrite confirmation, keep the waiting state explicit as milestone-audit-overwrite-confirmation, and stay report-local in .blueprint/reports/ without adopting long-running progress tools.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "complete-milestone": {
        readonly commandName: "complete-milestone";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 2;
            readonly family: "Roadmap And Milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: writes milestone closeout evidence and advances archival routing.";
        };
        readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_state_load", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["commands/blu-complete-milestone.toml"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-complete-milestone`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`complete-milestone` performs a report-driven closeout gated by saved milestone audit readiness, writes a durable completion report, and routes to milestone summary.";
            readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_artifact_list -> {artifacts, reports, missing}", "blueprint_state_load -> derivedStatus.milestoneAudit readiness", "blueprint_artifact_contract_read -> report.milestone-complete contract", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
            readonly writes: readonly [".blueprint/reports/milestone-complete-<version>.md", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Roadmap And Milestone";
            readonly command: "complete-milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_state_load", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Interactive-read profile for bounded milestone closeout: require the saved milestone audit and derivedStatus.milestoneAudit.readyForCompletion, read report.milestone-complete before drafting, prefer ask_user for overwrite confirmation, keep the waiting state explicit as missing-milestone-audit, milestone-not-ready, or milestone-complete-overwrite-confirmation, write milestone-complete-<version>.md, and route to /blu-milestone-summary <milestone> without adopting long-running progress tools.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "milestone-summary": {
        readonly commandName: "milestone-summary";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 2;
            readonly family: "Roadmap And Milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: report generation and routing only.";
        };
        readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["commands/blu-milestone-summary.toml"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-milestone-summary`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`milestone-summary` builds a durable milestone summary from saved roadmap, audit, and completion evidence and routes toward the next milestone-start action.";
            readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_artifact_list -> {artifacts, reports, missing}", "blueprint_artifact_contract_read -> report.milestone-summary contract", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
            readonly writes: readonly [".blueprint/reports/milestone-summary-<version>.md", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Roadmap And Milestone";
            readonly command: "milestone-summary";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Interactive-read profile for bounded milestone summarization: use saved audit and completion evidence, read report.milestone-summary before drafting, prefer ask_user for overwrite confirmation, keep the waiting state explicit as missing-milestone-audit, missing-milestone-complete, or milestone-summary-overwrite-confirmation, write milestone-summary-<version>.md, and route to /blu-new-milestone without pulling in later-wave docs agents or adopting long-running progress tools.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "new-milestone": {
        readonly commandName: "new-milestone";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 2;
            readonly family: "Roadmap And Milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: rewrites milestone starter docs through carry-forward scaffolding and advances state without deleting historical phase artifacts.";
        };
        readonly requiredTools: readonly ["blueprint_roadmap_read", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_artifact_scaffold", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-roadmapper"];
        readonly requiredInputPaths: readonly ["commands/blu-new-milestone.toml"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-new-milestone`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`new-milestone` starts a new milestone cycle by deriving carry-forward context from the saved milestone summary, scaffolding starter docs and the first phase context, and preserving historical phase artifacts.";
            readonly reads: readonly ["blueprint_roadmap_read -> {roadmap, milestone, phases}", "blueprint_artifact_contract_read -> report.milestone-summary and phase.context contracts", "blueprint_artifact_summary_digest -> {digest, inputsUsed}"];
            readonly writes: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/phases/<next-phase-slug>/<NN-CONTEXT.md>", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Roadmap And Milestone";
            readonly command: "new-milestone";
            readonly primarySkill: "blueprint-roadmap-admin";
            readonly exactMcpDestination: readonly ["blueprint_roadmap_read", "blueprint_artifact_contract_read", "blueprint_artifact_summary_digest", "blueprint_config_get", "blueprint_artifact_scaffold", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-roadmapper"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Interactive-read profile for bounded milestone restart: use the saved milestone summary as durable carry-forward input, read report.milestone-summary before seeding, read phase.context before scaffolding the first carried-forward phase, prefer ask_user for reset-versus-carry-forward and overwrite confirmations, keep the waiting state explicit as missing-milestone-summary, carry-forward-confirmation, or starter-doc-overwrite-confirmation, preserve historical phase artifacts, and route to /blu-discuss-phase <first phase> without adopting long-running progress tools.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly help: {
        readonly commandName: "help";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 0;
            readonly family: "Foundation";
            readonly primarySkill: "blueprint-router";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: read-only router guidance from project status and the live command catalog.";
        };
        readonly requiredTools: readonly ["blueprint_command_catalog", "blueprint_project_status"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["commands/blu-help.toml"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-help`";
            readonly executionProfile: "router";
            readonly rootRoutable: true;
            readonly purpose: "`help` shows safe Blueprint router guidance from project readiness and the implemented command catalog.";
            readonly reads: readonly ["Project status and command availability through Blueprint MCP tools."];
            readonly writes: readonly [];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Foundation";
            readonly command: "help";
            readonly primarySkill: "blueprint-router";
            readonly exactMcpDestination: readonly ["blueprint_command_catalog", "blueprint_project_status"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [];
            readonly contractNotes: "Router profile; report the waiting state from project status, keep the next safe action explicit, and never present planned or blocked commands as runnable. This includes map-first waiting states: brownfield uninitialized and mapping-incomplete route to /blu-map-codebase, while mapped-only routes to /blu-new-project.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
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
            readonly contractNotes: "Router profile; preserve read-only next-step guidance while surfacing active profile, branching mode, blockers, pending gates, and config warnings from normalized config, and keep recommendations inside the implemented runtime surface. Brownfield uninitialized and mapping-incomplete states point to /blu-map-codebase; mapped-only points to /blu-new-project. Planned or blocked commands are not runnable.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly next: {
        readonly commandName: "next";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-router";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: read-only next-step routing from project status, state, artifacts, and the live command catalog.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_state_load", "blueprint_artifact_list", "blueprint_command_catalog"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["commands/blu-next.toml"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-next`";
            readonly executionProfile: "router";
            readonly rootRoutable: true;
            readonly purpose: "`next` returns the next safe direct Blueprint command for the current repo state without widening beyond implemented commands.";
            readonly reads: readonly [".blueprint/ state, artifact inventory, project status, and command catalog through MCP tools."];
            readonly writes: readonly [];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "next";
            readonly primarySkill: "blueprint-router";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_state_load", "blueprint_artifact_list", "blueprint_command_catalog"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [];
            readonly contractNotes: "Host-native router flow; report waiting state and the next safe follow-up explicitly, and never hide destructive behavior behind implicit routing. This includes /blu-map-codebase for unmapped brownfield or mapping-incomplete and /blu-new-project for mapped-only. Planned or blocked commands are not runnable.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "map-codebase": {
        readonly commandName: "map-codebase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 0;
            readonly family: "Foundation";
            readonly primarySkill: "blueprint-map";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: refresh mode can replace existing codebase-mapping artifacts.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_artifact_scaffold", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_codebase_artifact_write", "blueprint_artifact_validate"];
        readonly optionalAgents: readonly ["blueprint-mapper"];
        readonly requiredInputPaths: readonly ["commands/blu-map-codebase.toml", "skills/blueprint-map/references/map-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-map-codebase`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`map-codebase` analyzes a brownfield codebase with mapper-style passes and produces the stable seven-document Blueprint codebase bundle. Focus areas deepen the same bundle instead of creating a separate suffix-only mode.";
            readonly reads: readonly [];
            readonly writes: readonly [".blueprint/codebase/STACK.md", ".blueprint/codebase/ARCHITECTURE.md", ".blueprint/codebase/STRUCTURE.md", ".blueprint/codebase/CONVENTIONS.md", ".blueprint/codebase/TESTING.md", ".blueprint/codebase/INTEGRATIONS.md", ".blueprint/codebase/CONCERNS.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Foundation";
            readonly command: "map-codebase";
            readonly primarySkill: "blueprint-map";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_artifact_scaffold", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_codebase_artifact_write", "blueprint_artifact_validate"];
            readonly optionalAgents: readonly ["blueprint-mapper"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for read-heavy brownfield mapping: load the local map runtime contract at skills/blueprint-map/references/map-runtime-contract.md, keep reuse as the default posture, treat supplied focus areas as targeted deepening across the same seven-document bundle, require ask_user confirmation for refresh or replace paths before any overwrite, read the canonical codebase contract before scaffold or refresh decisions, use contract.authoringTemplate as the heading authority, pass digest inputs as repo-relative paths and treat returned inputsUsed as authoritative, persist substantive mapping content through blueprint_codebase_artifact_write, repair invalid write results from returned issues before moving on, validate the resulting bundle, and route a successful map-first brownfield repo to /blu-new-project.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
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
    readonly "plan-phase": {
        readonly commandName: "plan-phase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-phase-planning";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: can replace plans and change downstream execution order.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_phase_research_status", "blueprint_phase_artifact_read", "blueprint_phase_validation_read", "blueprint_review_load_findings", "blueprint_artifact_contract_read", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_plan_authoring_context", "blueprint_phase_plan_validate_model", "blueprint_phase_plan_write", "blueprint_phase_plan_validate", "blueprint_config_get", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-planner", "blueprint-checker"];
        readonly requiredInputPaths: readonly ["skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-plan-phase`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`plan-phase` creates or extends execution-ready phase plans through MCP-owned structured phase.plan model validation and plan writes.";
            readonly reads: readonly ["Phase resolution, context, planning readiness, saved discovery artifacts, validation and review evidence, plan inventory, plan authoring schema, effective config, and state through MCP."];
            readonly writes: readonly ["structured phase.plan JSON through blueprint_phase_plan_write", ".blueprint/phases/<phase>/<phase-prefix>-<plan-id>-PLAN.md (XX-YY-PLAN.md) through blueprint_phase_plan_write", ".blueprint/STATE.md through synced state update"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "plan-phase";
            readonly primarySkill: "blueprint-phase-planning";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_phase_research_status", "blueprint_phase_artifact_read", "blueprint_phase_validation_read", "blueprint_review_load_findings", "blueprint_artifact_contract_read", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_plan_authoring_context", "blueprint_phase_plan_validate_model", "blueprint_phase_plan_write", "blueprint_phase_plan_validate", "blueprint_config_get", "blueprint_state_load", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-planner", "blueprint-checker"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile; keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible. Load skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md as the local runtime contract, respect blueprint_phase_research_status.planningReadiness as the config-aware pre-draft handoff gate, consume saved research instead of live browsing for freshness-sensitive technical decisions, and route to /blu-research-phase when research evidence is required. Author phase.plan as structured JSON against blueprint_phase_plan_authoring_context.taskSchema and contract.modelContract.schemaPath, re-read blueprint_phase_plan_authoring_context immediately before each model validation/write after any successful plan write because saved plan files are intentional later-slot evidence artifacts, validate with blueprint_phase_plan_validate_model, persist the same model through blueprint_phase_plan_write with validationMode: \"strict\" and authoringMode: \"model-only\", and reject scaffold-placeholder seeding, Markdown fallback, raw .blueprint edits, or warn-mode writes from /blu-plan-phase. Gate reuse/revise/replace only for writes that revise or replace saved plan ids, while additive new plan ids may proceed without an overwrite gate. Use blueprint-planner when suitable, preserve the one-plan-at-a-time no-subagent fallback, run blueprint-checker only when workflow.plan_check is enabled, and keep the checker/fallback loop bounded. Repair MCP validation, write, or scoped plan diagnostics against the live task schema before retrying, run blueprint_phase_plan_validate after persistence, then call blueprint_state_update with base: \"synced\" followed by state-aware routing to implemented follow-ups.";
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
            readonly contractNotes: "Long-running-mutation profile for topic-strand phase research: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial multi-strand research without turning them into persistence, and when those helpers are unavailable fall back to short progress recaps plus MCP-backed checkpoints and STATE.md. Ground repo truth first in phase context, actual saved context content, existing research, and saved codebase summaries, stop on missing XX-CONTEXT.md instead of drafting from status-only signals, read blueprint_config_get before any official-doc or external verification, honor research.external_sources as off/ask/auto, use official docs or explicitly supplied external references only when the repo cannot settle a claim, keep repo-derived evidence distinct from external truth in the finished research, treat State Of The Art freshness wording as runtime-contract guidance rather than an MCP validation gate, use skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md as the rich behavior contract, keep contract.authoringTemplate as schema authority, reserve blueprint_artifact_scaffold for deliberate placeholder creation only, use capability-gated blueprint-researcher only when suitable Blueprint research or code-analysis agents are available, require the parent to supply any official-doc or external evidence packet instead of asking the subagent to fetch it, preserve the single-agent topic-strand fallback when they are not, reject browser/web-search/shell-only or generic agents as substitutes, force repair when existing research is invalid, sync STATE.md even on valid non-writing reuse paths, repair invalid writes or validation failures before completion, checkpoint inconclusive strands instead of bluffing a final artifact, delete only research-owned shared checkpoints, and keep routing limited to implemented commands only.";
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
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_research_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_artifact_scaffold", "blueprint_state_load", "blueprint_command_catalog", "blueprint_state_update"];
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
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_research_status", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_phase_artifact_read", "blueprint_phase_artifact_write", "blueprint_artifact_scaffold", "blueprint_state_load", "blueprint_command_catalog", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-ui-designer", "blueprint-checker"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for bounded UI-contract drafting: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, keep contract-versus-skip posture, workflow.ui_safety_gate rationale confirmation, overwrite confirmation, checker-requested revision, and MCP validation repair explicit as visible gates, read the canonical phase.ui-spec contract before drafting or persisting, read actual saved context and research bodies when status reports them, load skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md as the richness, evidence, fallback, and retry authority, keep contract.authoringTemplate as heading/schema authority, use capability-gated blueprint-ui-designer and blueprint-checker for design-system evidence plus six-dimension UI quality review, preserve the no-subagent section-by-section fallback, reject browser/web-search/shell-only or generic substitute agents, repair invalid writes or checker-blocked dimensions before completion, call blueprint_state_update with base: \"synced\" while preserving patch.currentPhase and patch.activeCommand, then re-load blueprint_state_load.derivedStatus.nextAction and keep final routing constrained by blueprint_command_catalog, and use XX-UI-SPEC.md as the single durable output for either a UI contract or an explicit skip rationale.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly "execute-phase": {
        readonly commandName: "execute-phase";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 1;
            readonly family: "Core Lifecycle";
            readonly primarySkill: "blueprint-phase-execution";
            readonly declaredStatus: "implemented";
            readonly risk: "High: drives real repo mutation during implementation and records execution summaries.";
        };
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_plan_index", "blueprint_phase_execution_targets", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_summary_authoring_context", "blueprint_phase_summary_validate_model", "blueprint_phase_summary_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-executor"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-execute-phase`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`execute-phase` executes saved phase plans in deterministic target order, records plan-linked execution summaries, and syncs Blueprint state without claiming phase completion.";
            readonly reads: readonly [".blueprint/config.json", ".blueprint/STATE.md", "selected plan and summary files through MCP", "phase.summary contract"];
            readonly writes: readonly ["one or more XX-YY-SUMMARY.md files", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Core Lifecycle";
            readonly command: "execute-phase";
            readonly primarySkill: "blueprint-phase-execution";
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_plan_index", "blueprint_phase_execution_targets", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_summary_authoring_context", "blueprint_phase_summary_validate_model", "blueprint_phase_summary_write", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_validate", "blueprint_state_load", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-executor"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Long-running-mutation profile; keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, pair Gemini-native update_topic and write_todos for long execution runs without turning them into persistence, read the canonical phase.summary contract plus the Markdown-first summary authoring context before any summary write or replacement, use blueprint_phase_execution_targets for deterministic target selection plus overwrite and overlap warnings, refuse stale or invalid saved plans, preserve wave order and lower-wave blockers, use bounded blueprint-executor agents only with explicit disjoint write ownership, fall back to one-plan-at-a-time inline execution when agents are unavailable or unsafe, persist PARTIAL or BLOCKED summaries as durable carry-forward evidence, run targeted verification plus bounded repair before COMPLETED summaries, rerun the summary index before synced state update, never persist execute-phase reports, and never claim phase completion before validation and verification evidence exists. The rich command-local contract lives in skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md.";
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
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_project_status", "blueprint_config_get"];
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
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_context", "blueprint_roadmap_read", "blueprint_project_status", "blueprint_config_get"];
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
            readonly contractNotes: "Long-running-mutation profile; validate saved summary evidence through the phase validation MCP substrate, use schema/evidence-rich MCP text from the validation and contract tools when host structured content is hidden, author the phase.verification 1.1.0 model with status equal to gateState, normalize covered coverage to COVERED, preserve extended validation evidence fields, and route only to implemented follow-up commands.";
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
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_review_scope", "blueprint_review_load_findings", "blueprint_review_validate_model", "blueprint_review_record"];
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
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_config_get", "blueprint_artifact_contract_read", "blueprint_review_scope", "blueprint_review_load_findings", "blueprint_review_validate_model", "blueprint_review_record"];
            readonly optionalAgents: readonly ["blueprint-reviewer"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for deterministic phase-scoped review: keep Resolve/Read/Decide/Execute/Validate/Persist/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial review runs without turning them into persistence, let blueprint_review_scope own review enablement, normalized depth defaults, saved evidence inventory, deterministic repo-file scoping, authoring context, and narrowed task schema, load skills/blueprint-review/references/code-review-runtime-contract.md for model-only JSON authoring, depth semantics, evidence richness, capability-gated reviewer use, no-subagent fallback, and MCP retry/repair behavior, repair invalid models against modelContract.jsonSchema, the narrowed task schema, and returned diagnostics instead of rendered Markdown shape, keep explicit scope or overwrite confirmation when broad scope or existing review evidence needs approval, fail any invalid explicit --files scope instead of silently narrowing it, load saved XX-REVIEW.md findings before overwrite decisions, validate the authored model through blueprint_review_validate_model, and persist the model through blueprint_review_record so MCP renders canonical XX-REVIEW.md without Markdown fallback. When security still routes first, keep code-review-fix visible as the secondary queued follow-up if concrete follow-up fixes remain.";
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
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_config_get", "blueprint_review_load_findings", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record", "blueprint_state_update"];
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
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_config_get", "blueprint_review_load_findings", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-reviewer"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Long-running-mutation profile for bounded saved-finding remediation: default unscoped remediation to saved follow-up findings, keep repo mutation scoped to selected findings, use blueprint-reviewer only for read-only selected-target fix/defer/skip reclassification plus stale-evidence notes, keep the inline fallback on the same one-target-at-a-time decision contract, author only the review.review-fix schema's camelCase JSON fields while forbidding rendered-heading or locked-marker keys, validate through blueprint_review_validate_model, persist through review MCP tools, and update STATE.md through blueprint_state_update with base synced plus explicit activeCommand/currentPhase/nextAction patch fields before routing follow-up through implemented validation or progress commands only.";
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
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_review_scope", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
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
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_review_scope", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-reviewer", "blueprint-verifier"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Long-running-mutation profile for bounded saved-evidence remediation: load skills/blueprint-review/references/audit-fix-runtime-contract.md, resolve the phase and artifact inventory, let blueprint_review_scope own the repo-file scope, classify only selected saved evidence, keep --source, --severity, --max, --dry-run, mutation confirmation, report overwrite, optional todo capture, active stage, and early-stop state explicit, use blueprint-reviewer only for bounded read-only classification and blueprint-verifier only for bounded post-fix verification, validate the structured report.audit-fix model through blueprint_artifact_report_validate_model, repair invalid diagnostics by exact path, code, repair, allowedValues, missing, argsPatch, and repairSummary guidance, reread authoring context when runtime context is stale or incomplete, persist it through blueprint_artifact_report_write, append confirmed todo follow-ups through blueprint_artifact_mutate_index, update state through blueprint_state_update, and stop with top diagnostics plus suggestedRepairs rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.";
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
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_phase_plan_index", "blueprint_phase_plan_read", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_execution_targets", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_artifact_list", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_review_authoring_context", "blueprint_review_validate_model", "blueprint_review_record"];
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
        readonly requiredTools: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_render", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_phase_validation_write", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_state_load", "blueprint_state_update"];
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
            readonly exactMcpDestination: readonly ["blueprint_phase_locate", "blueprint_phase_summary_index", "blueprint_phase_summary_read", "blueprint_phase_validation_read", "blueprint_phase_validation_authoring_context", "blueprint_phase_validation_render", "blueprint_artifact_contract_read", "blueprint_config_get", "blueprint_phase_validation_write", "blueprint_artifact_list", "blueprint_artifact_validate", "blueprint_artifact_report_authoring_context", "blueprint_artifact_report_validate_model", "blueprint_artifact_report_write", "blueprint_state_load", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-executor", "blueprint-verifier"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Long-running-mutation profile for evidence-backed test generation; keep repo mutation scoped to selected tests and persist validation/report evidence through MCP tools.";
            readonly evidenceState: readonly ["locked", "source-owned", "needs-behavior-audit"];
        };
    };
    readonly "docs-update": {
        readonly commandName: "docs-update";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-docs";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: writes selected repo documentation files and a durable docs-update report.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write"];
        readonly optionalAgents: readonly ["blueprint-doc-writer", "blueprint-doc-verifier"];
        readonly requiredInputPaths: readonly ["skills/blueprint-docs/references/docs-update-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-docs-update`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`docs-update` refreshes or verifies selected repo documentation against saved Blueprint and repo evidence, optionally checks current external truth, and persists the durable docs-update report through MCP.";
            readonly reads: readonly ["Project health, artifact inventory, selected repo documentation, source files, tests, saved Blueprint artifacts, digest inputsUsed, and optional cited external truth."];
            readonly writes: readonly ["selected repo documentation files when not verify-only", ".blueprint/reports/docs-update-latest.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality And Shipping";
            readonly command: "docs-update";
            readonly primarySkill: "blueprint-docs";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_list", "blueprint_artifact_summary_digest", "blueprint_artifact_report_write"];
            readonly optionalAgents: readonly ["blueprint-doc-writer", "blueprint-doc-verifier"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for scoped repo documentation refresh or verification: load commands/blu-docs-update.toml and skills/blueprint-docs/references/docs-update-runtime-contract.md, resolve a narrow doc scope before drafting, keep repo truth from selected docs, source files, tests, saved Blueprint artifacts, digest inputsUsed, and optional cited external truth separate, keep --verify-only read-only for repo docs while still allowing the durable report, gate broad scope, doc replacement, and report replacement unless --force already supplies approval, use blueprint-doc-writer and blueprint-doc-verifier only for bounded docs passes when available, persist the report through blueprint_artifact_report_write with bare reportName docs-update-latest, keep Blueprint persistence inside .blueprint/reports/, and route only to implemented follow-ups such as /blu-map-codebase or /blu-progress.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly impact: {
        readonly commandName: "impact";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 4;
            readonly family: "Quality And Shipping";
            readonly primarySkill: "blueprint-impact";
            readonly declaredStatus: "implemented";
            readonly risk: "Low: advisory blast-radius report writes only under .blueprint/impact/.";
        };
        readonly requiredTools: readonly ["blueprint_impact_config_get", "blueprint_impact_scope_resolve", "blueprint_impact_context_load", "blueprint_impact_analyze", "blueprint_impact_report_write", "blueprint_impact_output_render"];
        readonly optionalAgents: readonly [];
        readonly requiredInputPaths: readonly ["skills/blueprint-impact/references/impact-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-impact`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`impact` performs advisory blast-radius analysis for a resolved change scope, persists an impact report bundle when writing is enabled, and renders the requested output format through the impact MCP substrate.";
            readonly reads: readonly ["impact config, resolved scope, source files, runtime metadata, Blueprint artifacts, ownership or dependency metadata, PR or deployment context, and command catalog state as read-only evidence"];
            readonly writes: readonly [".blueprint/impact/<impact-id>/ only through blueprint_impact_report_write when writing is enabled"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Quality And Shipping";
            readonly command: "impact";
            readonly primarySkill: "blueprint-impact";
            readonly exactMcpDestination: readonly ["blueprint_impact_config_get", "blueprint_impact_scope_resolve", "blueprint_impact_context_load", "blueprint_impact_analyze", "blueprint_impact_report_write", "blueprint_impact_output_render"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly [".blueprint write guard"];
            readonly contractNotes: "Long-running-mutation profile for advisory blast-radius analysis with no subagents. Load skills/blueprint-impact/references/impact-runtime-contract.md, resolve scope through the impact MCP tools, keep source files, runtime files, PR metadata, deployment state, and command-catalog state read-only, persist impact bundles only through blueprint_impact_report_write under .blueprint/impact/<impact-id>/, render final human, JSON, Markdown, PR-comment, or summary output only through blueprint_impact_output_render, treat BLOCK as advisory rather than permission to mutate non-impact state, and route follow-up guidance only to implemented commands.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "behavior-audited"];
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
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_mutate_index", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold"];
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
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_mutate_index", "blueprint_roadmap_add_phase", "blueprint_artifact_scaffold"];
            readonly optionalAgents: readonly ["blueprint-researcher"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard"];
            readonly contractNotes: "Docless manifest+skill-owned runtime for short ideation routing: require explicit idea text, read blueprint_project_status first, classify exactly one target among note, todo, backlog, roadmap, and no-write, use blueprint-researcher only for bounded context checks that materially affect routing, require explicit routing confirmation before persistence, write note/todo/backlog targets through blueprint_artifact_mutate_index with duplicate handling, append roadmap work through blueprint_roadmap_add_phase and scaffold only returned context paths, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly quick: {
        readonly commandName: "quick";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 3;
            readonly family: "Capture And Lightweight Execution";
            readonly primarySkill: "blueprint-phase-execution";
            readonly declaredStatus: "implemented";
            readonly risk: "High: can execute repo changes with reduced ceremony.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_command_catalog", "blueprint_artifact_report_write", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-researcher", "blueprint-planner", "blueprint-executor", "blueprint-verifier"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-quick`";
            readonly executionProfile: "long-running-mutation";
            readonly rootRoutable: true;
            readonly purpose: "`quick` runs bounded quick delivery with optional depth gates, persists durable quick-run evidence, and routes follow-up through implemented Blueprint commands.";
            readonly reads: readonly ["project status, command availability, and current next-step posture through MCP"];
            readonly writes: readonly ["quick-run report in .blueprint/reports/", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Capture And Lightweight Execution";
            readonly command: "quick";
            readonly primarySkill: "blueprint-phase-execution";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_command_catalog", "blueprint_artifact_report_write", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-researcher", "blueprint-planner", "blueprint-executor", "blueprint-verifier"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Long-running-mutation profile for non-trivial bounded quick runs; keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, require explicit opt-in for deeper discuss, research, or validation passes, treat branchy quick work as tracker-eligible session-local coordination paired with visible todos, persist durable quick-run evidence through blueprint_artifact_report_write using the canonical quick-run-latest report name, and do not let quick impersonate saved planning or broad lifecycle execution. The rich command-local contract lives in skills/blueprint-phase-execution/references/quick-runtime-contract.md.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly debug: {
        readonly commandName: "debug";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 3;
            readonly family: "Capture And Lightweight Execution";
            readonly primarySkill: "blueprint-debug";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: exploratory shell commands and test runs are likely.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
        readonly optionalAgents: readonly ["blueprint-debugger"];
        readonly requiredInputPaths: readonly ["commands/blu-debug.toml", "skills/blueprint-debug/references/debug-runtime-contract.md"];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-debug`";
            readonly executionProfile: "interactive-read -> long-running-mutation when non-trivial";
            readonly rootRoutable: true;
            readonly purpose: "`debug` investigates a concrete issue, persists a durable debug-latest report, and stops at an explicit follow-up gate before todo capture or fix attempts.";
            readonly reads: readonly ["project status, user-provided issue evidence, relevant local files, command outputs, and prior debug-latest report content when continuing"];
            readonly writes: readonly [".blueprint/reports/debug-latest.md", "optional explicit follow-up todo through .blueprint/todos/TODO.md", ".blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Capture And Lightweight Execution";
            readonly command: "debug";
            readonly primarySkill: "blueprint-debug";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_config_get", "blueprint_artifact_report_write", "blueprint_artifact_mutate_index", "blueprint_state_update"];
            readonly optionalAgents: readonly ["blueprint-debugger"];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Interactive-read profile for evidence-backed investigations that can stay concise; long-running-mutation profile only for non-trivial investigations. Load commands/blu-debug.toml plus skills/blueprint-debug/references/debug-runtime-contract.md, require a concrete issue statement and initialized Blueprint state before durable persistence, keep --diagnose honest as diagnose-only until the user confirms a fix attempt, use update_topic and write_todos only as session-local visibility for non-trivial investigations, persist the durable report through blueprint_artifact_report_write with the bare debug-latest name and treat returned paths and ids as authoritative, require overwrite confirmation before replacing an existing report, capture persisted todos only after an explicit user ask or confirmation through blueprint_artifact_mutate_index, update state through blueprint_state_update, route implemented follow-ups only to /blu-quick, /blu-plan-phase, /blu-validate-phase, or /blu-progress, and do not hide state or perform broad direct fixes inside debug.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
    readonly fast: {
        readonly commandName: "fast";
        readonly sourceId: string;
        readonly catalog: {
            readonly wave: 3;
            readonly family: "Capture And Lightweight Execution";
            readonly primarySkill: "blueprint-phase-execution";
            readonly declaredStatus: "implemented";
            readonly risk: "Medium: minimal-planning repo mutation path.";
        };
        readonly requiredTools: readonly ["blueprint_project_status", "blueprint_state_update"];
        readonly optionalAgents: readonly [];
        readonly spec: {
            readonly path: string;
            readonly title: "`/blu-fast`";
            readonly executionProfile: "interactive-read";
            readonly rootRoutable: true;
            readonly purpose: "`fast` handles genuinely trivial inline execution without subagents, durable reports, or phase artifacts.";
            readonly reads: readonly ["project status through MCP when useful"];
            readonly writes: readonly ["optional .blueprint/STATE.md"];
        };
        readonly runtimeReference: {
            readonly path: string;
            readonly waveTitle: "Capture And Lightweight Execution";
            readonly command: "fast";
            readonly primarySkill: "blueprint-phase-execution";
            readonly exactMcpDestination: readonly ["blueprint_project_status", "blueprint_state_update"];
            readonly optionalAgents: readonly [];
            readonly hookInvolvement: readonly ["read-before-edit", ".blueprint write guard", "workflow advisory"];
            readonly contractNotes: "Interactive-read profile for trivial inline execution: keep the ask genuinely small, explicitly exclude tracker-backed branching plus update_topic or write_todos long-running visibility, refuse report-backed or subagent depth, update STATE.md only when Blueprint is initialized, do not create quick-run reports, phase summaries, phase artifacts, or other durable execution evidence, and route anything larger to quick or phase planning. The rich command-local contract lives in skills/blueprint-phase-execution/references/fast-runtime-contract.md.";
            readonly evidenceState: readonly ["locked", "runtime-owned", "needs-behavior-audit"];
        };
    };
};
export declare function listRuntimeOwnedCommandMetadata(): RuntimeOwnedCommandMetadata[];
export declare function getRuntimeOwnedCommandMetadata(commandName: string): RuntimeOwnedCommandMetadata | null;
export declare function getRuntimeOwnedCommandMetadataBySourceId(sourceId: string | null): RuntimeOwnedCommandMetadata | null;
export {};
