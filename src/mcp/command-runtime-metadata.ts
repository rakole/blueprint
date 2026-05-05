import type { BlueprintInternalToolName } from "./runtime-vocabulary.js";

type RuntimeOwnedCommandStatus =
  | "planned"
  | "implemented"
  | "blocked"
  | "repairing";

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

const RUNTIME_METADATA_PATH = "src/mcp/command-runtime-metadata.ts";

export const NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID =
  "src/mcp/command-runtime-metadata.ts#new-project";

export const NEW_PROJECT_RUNTIME_METADATA = {
  commandName: "new-project",
  sourceId: NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID,
  catalog: {
    wave: 0,
    family: "Foundation",
    primarySkill: "blueprint-bootstrap",
    declaredStatus: "implemented",
    risk:
      "Medium: deep-questioning bootstrap that creates the initial planning tree, seeds normalized repo config, and leaves a traceable first roadmap."
  },
  requiredTools: [
    "blueprint_project_init",
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_config_set",
    "blueprint_state_update",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_validate"
  ],
  optionalAgents: ["blueprint-project-researcher", "blueprint-roadmapper"],
  spec: {
    path: NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID,
    title: "`/blu-new-project`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "new-project initializes a Blueprint project with deep context gathering and PROJECT.md. It stays host-native and delegates durable persistence to Blueprint MCP tools while preserving the richer bootstrap flow.",
    reads: ["~/.<host>/blueprint/defaults.json when present"],
    writes: [
      ".blueprint/PROJECT.md",
      ".blueprint/REQUIREMENTS.md",
      ".blueprint/ROADMAP.md",
      ".blueprint/STATE.md",
      ".blueprint/config.json",
      ".blueprint/phases/"
    ]
  },
  runtimeReference: {
    path: NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID,
    waveTitle: "Foundation",
    command: "new-project",
    primarySkill: "blueprint-bootstrap",
    exactMcpDestination: [
      "blueprint_project_init",
      "blueprint_project_status",
      "blueprint_config_get",
      "blueprint_config_set",
      "blueprint_state_update",
      "blueprint_artifact_contract_read",
      "blueprint_artifact_validate"
    ],
    optionalAgents: ["blueprint-project-researcher", "blueprint-roadmapper"],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation Gemini-native bootstrap. The detailed runtime contract lives in skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md, with host-entrypoint, MCP FQN, approval-surface, and Gemini-helper guardrails centralized in skills/blueprint-bootstrap/references/runtime-guardrails.md. The live contract stays map-first for brownfield repos: unmapped or mapping-incomplete states route to map-codebase; valid mapped-only states may run new-project while preserving .blueprint/codebase/*.md.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const ADD_PHASE_RUNTIME_METADATA_SOURCE_ID =
  "src/mcp/command-runtime-metadata.ts#add-phase";

const ADD_PHASE_SPEC_PATH =
  "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md";

export const ADD_PHASE_RUNTIME_METADATA = {
  commandName: "add-phase",
  sourceId: ADD_PHASE_RUNTIME_METADATA_SOURCE_ID,
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-roadmap-admin",
    declaredStatus: "implemented",
    risk:
      "Medium: appends the next whole-number phase, scaffolds the matching phase directory, and updates the next-step signal."
  },
  requiredTools: [
    "blueprint_roadmap_read",
    "blueprint_roadmap_add_phase",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ],
  optionalAgents: [],
  requiredInputPaths: [ADD_PHASE_SPEC_PATH],
  spec: {
    path: ADD_PHASE_RUNTIME_METADATA_SOURCE_ID,
    title: "`/blu-add-phase`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "Append a new whole-number phase to an initialized Blueprint roadmap through MCP-owned roadmap and scaffold writes.",
    reads: [".blueprint/ROADMAP.md"],
    writes: [
      ".blueprint/ROADMAP.md",
      ".blueprint/phases/<phase-slug>/<phase-prefix>-CONTEXT.md",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: ADD_PHASE_RUNTIME_METADATA_SOURCE_ID,
    waveTitle: "Roadmap And Milestone",
    command: "add-phase",
    primarySkill: "blueprint-roadmap-admin",
    exactMcpDestination: [
      "blueprint_roadmap_read",
      "blueprint_roadmap_add_phase",
      "blueprint_artifact_scaffold",
      "blueprint_state_update"
    ],
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Interactive-read profile for bounded roadmap append: load skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md, keep the command grounded in the live roadmap, preview the next integer phase while ignoring decimal suffixes, prefer ask_user for the exact phase-number confirmation gate, pass the confirmed number as expectedPhaseNumber, keep the waiting state explicit as phase-number-confirmation or stale-phase-number, persist the append only through the roadmap and scaffold MCP tools, scaffold ${phaseDir}/${phasePrefix}-CONTEXT.md from returned metadata without treating scaffold text as finished context, preserve the no-subagent fallback, reject browser/web-search/shell-only or generic agents as substitutes, and route the next safe action to /blu-discuss-phase <phase> without adopting long-running progress tools.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

const PROGRESS_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_config_get",
  "blueprint_state_load",
  "blueprint_artifact_list",
  "blueprint_command_catalog"
] as const satisfies readonly BlueprintInternalToolName[];

const HELP_REQUIRED_TOOLS = [
  "blueprint_command_catalog",
  "blueprint_project_status"
] as const satisfies readonly BlueprintInternalToolName[];

const NEXT_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_state_load",
  "blueprint_artifact_list",
  "blueprint_command_catalog"
] as const satisfies readonly BlueprintInternalToolName[];

const DISCUSS_PHASE_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_phase_context",
  "blueprint_roadmap_read",
  "blueprint_phase_plan_index",
  "blueprint_artifact_list",
  "blueprint_config_get",
  "blueprint_artifact_contract_read",
  "blueprint_phase_artifact_read",
  "blueprint_phase_artifact_write",
  "blueprint_phase_checkpoint_get",
  "blueprint_phase_checkpoint_put",
  "blueprint_phase_checkpoint_delete",
  "blueprint_artifact_scaffold",
  "blueprint_state_update",
  "blueprint_state_load"
] as const satisfies readonly BlueprintInternalToolName[];

const PLAN_PHASE_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_phase_context",
  "blueprint_phase_research_status",
  "blueprint_phase_artifact_read",
  "blueprint_phase_validation_read",
  "blueprint_review_load_findings",
  "blueprint_artifact_contract_read",
  "blueprint_phase_plan_index",
  "blueprint_phase_plan_read",
  "blueprint_phase_plan_authoring_context",
  "blueprint_phase_plan_validate_model",
  "blueprint_phase_plan_write",
  "blueprint_phase_plan_validate",
  "blueprint_config_get",
  "blueprint_state_load",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const RESEARCH_PHASE_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_phase_context",
  "blueprint_phase_research_status",
  "blueprint_phase_artifact_read",
  "blueprint_phase_artifact_write",
  "blueprint_phase_checkpoint_get",
  "blueprint_phase_checkpoint_put",
  "blueprint_phase_checkpoint_delete",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_scaffold",
  "blueprint_config_get",
  "blueprint_state_load",
  "blueprint_command_catalog",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const UI_PHASE_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_phase_research_status",
  "blueprint_config_get",
  "blueprint_artifact_contract_read",
  "blueprint_phase_artifact_read",
  "blueprint_phase_artifact_write",
  "blueprint_artifact_scaffold",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const EXECUTE_PHASE_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_phase_plan_index",
  "blueprint_phase_execution_targets",
  "blueprint_phase_plan_read",
  "blueprint_phase_summary_index",
  "blueprint_phase_summary_read",
  "blueprint_phase_summary_authoring_context",
  "blueprint_phase_summary_validate_model",
  "blueprint_phase_summary_write",
  "blueprint_artifact_contract_read",
  "blueprint_config_get",
  "blueprint_artifact_validate",
  "blueprint_state_load",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const LIST_PHASE_ASSUMPTIONS_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_phase_context",
  "blueprint_roadmap_read",
  "blueprint_project_status"
] as const satisfies readonly BlueprintInternalToolName[];

const INSERT_PHASE_REQUIRED_TOOLS = [
  "blueprint_roadmap_read",
  "blueprint_roadmap_insert_phase",
  "blueprint_artifact_scaffold",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const REMOVE_PHASE_REQUIRED_TOOLS = [
  "blueprint_roadmap_read",
  "blueprint_phase_locate",
  "blueprint_roadmap_remove_phase",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const PLAN_MILESTONE_GAPS_REQUIRED_TOOLS = [
  "blueprint_roadmap_read",
  "blueprint_artifact_list",
  "blueprint_artifact_summary_digest",
  "blueprint_roadmap_add_phase",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const AUDIT_MILESTONE_REQUIRED_TOOLS = [
  "blueprint_roadmap_read",
  "blueprint_phase_summary_index",
  "blueprint_artifact_list",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_summary_digest",
  "blueprint_artifact_report_write"
] as const satisfies readonly BlueprintInternalToolName[];

const COMPLETE_MILESTONE_REQUIRED_TOOLS = [
  "blueprint_roadmap_read",
  "blueprint_artifact_list",
  "blueprint_state_load",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_summary_digest",
  "blueprint_artifact_report_write",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const MILESTONE_SUMMARY_REQUIRED_TOOLS = [
  "blueprint_roadmap_read",
  "blueprint_artifact_list",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_summary_digest",
  "blueprint_artifact_report_write",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const NEW_MILESTONE_REQUIRED_TOOLS = [
  "blueprint_roadmap_read",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_summary_digest",
  "blueprint_artifact_scaffold",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const VALIDATE_PHASE_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_phase_summary_index",
  "blueprint_phase_summary_read",
  "blueprint_phase_validation_read",
  "blueprint_phase_validation_authoring_context",
  "blueprint_phase_validation_validate_model",
  "blueprint_phase_validation_write",
  "blueprint_artifact_contract_read",
  "blueprint_config_get",
  "blueprint_artifact_validate",
  "blueprint_state_load",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const VERIFY_WORK_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_phase_summary_index",
  "blueprint_phase_summary_read",
  "blueprint_phase_validation_read",
  "blueprint_phase_validation_authoring_context",
  "blueprint_phase_validation_validate_model",
  "blueprint_phase_validation_render",
  "blueprint_phase_validation_write",
  "blueprint_artifact_contract_read",
  "blueprint_config_get",
  "blueprint_artifact_validate",
  "blueprint_state_load",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const CODE_REVIEW_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_artifact_contract_read",
  "blueprint_review_scope",
  "blueprint_review_load_findings",
  "blueprint_review_validate_model",
  "blueprint_review_record"
] as const satisfies readonly BlueprintInternalToolName[];

const CODE_REVIEW_FIX_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_review_load_findings",
  "blueprint_review_authoring_context",
  "blueprint_review_validate_model",
  "blueprint_review_record",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const SECURE_PHASE_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_artifact_list",
  "blueprint_phase_plan_index",
  "blueprint_phase_plan_read",
  "blueprint_phase_summary_index",
  "blueprint_phase_summary_read",
  "blueprint_phase_execution_targets",
  "blueprint_artifact_contract_read",
  "blueprint_review_authoring_context",
  "blueprint_review_validate_model",
  "blueprint_review_record"
] as const satisfies readonly BlueprintInternalToolName[];

const AUDIT_FIX_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_artifact_list",
  "blueprint_review_scope",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_report_authoring_context",
  "blueprint_artifact_report_validate_model",
  "blueprint_artifact_report_write",
  "blueprint_artifact_mutate_index",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const REVIEW_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_artifact_list",
  "blueprint_artifact_contract_read",
  "blueprint_phase_plan_index",
  "blueprint_phase_plan_read",
  "blueprint_phase_summary_index",
  "blueprint_phase_summary_read",
  "blueprint_phase_execution_targets",
  "blueprint_review_authoring_context",
  "blueprint_review_validate_model",
  "blueprint_review_record"
] as const satisfies readonly BlueprintInternalToolName[];

const UI_REVIEW_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_artifact_list",
  "blueprint_artifact_contract_read",
  "blueprint_review_authoring_context",
  "blueprint_review_validate_model",
  "blueprint_review_record"
] as const satisfies readonly BlueprintInternalToolName[];

const ADD_TESTS_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_phase_summary_index",
  "blueprint_phase_summary_read",
  "blueprint_phase_validation_read",
  "blueprint_phase_validation_authoring_context",
  "blueprint_phase_validation_render",
  "blueprint_artifact_contract_read",
  "blueprint_phase_validation_write",
  "blueprint_artifact_list",
  "blueprint_artifact_validate",
  "blueprint_artifact_report_authoring_context",
  "blueprint_artifact_report_validate_model",
  "blueprint_artifact_report_write",
  "blueprint_state_load",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const DOCS_UPDATE_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_artifact_list",
  "blueprint_artifact_summary_digest",
  "blueprint_artifact_report_write"
] as const satisfies readonly BlueprintInternalToolName[];

const IMPACT_REQUIRED_TOOLS = [
  "blueprint_impact_config_get",
  "blueprint_impact_scope_resolve",
  "blueprint_impact_context_load",
  "blueprint_impact_analyze",
  "blueprint_impact_report_write",
  "blueprint_impact_output_render"
] as const satisfies readonly BlueprintInternalToolName[];

const NOTE_REQUIRED_TOOLS = [
  "blueprint_artifact_mutate_index"
] as const satisfies readonly BlueprintInternalToolName[];

const ADD_TODO_REQUIRED_TOOLS = [
  "blueprint_artifact_mutate_index"
] as const satisfies readonly BlueprintInternalToolName[];

const CHECK_TODOS_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_artifact_mutate_index"
] as const satisfies readonly BlueprintInternalToolName[];

const ADD_BACKLOG_REQUIRED_TOOLS = [
  "blueprint_artifact_mutate_index",
  "blueprint_artifact_scaffold"
] as const satisfies readonly BlueprintInternalToolName[];

const REVIEW_BACKLOG_REQUIRED_TOOLS = [
  "blueprint_roadmap_promote_backlog",
  "blueprint_artifact_mutate_index",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const EXPLORE_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_artifact_mutate_index",
  "blueprint_roadmap_add_phase",
  "blueprint_artifact_scaffold"
] as const satisfies readonly BlueprintInternalToolName[];

const QUICK_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_command_catalog",
  "blueprint_artifact_report_write",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const DEBUG_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_artifact_report_write",
  "blueprint_artifact_mutate_index",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const FAST_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const SETTINGS_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_config_get",
  "blueprint_config_set"
] as const satisfies readonly BlueprintInternalToolName[];

const SET_PROFILE_REQUIRED_TOOLS = [
  "blueprint_config_get",
  "blueprint_config_set_profile"
] as const satisfies readonly BlueprintInternalToolName[];

const HEALTH_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_config_get",
  "blueprint_config_set",
  "blueprint_state_load",
  "blueprint_artifact_list",
  "blueprint_artifact_validate",
  "blueprint_state_sync"
] as const satisfies readonly BlueprintInternalToolName[];

const PAUSE_WORK_REQUIRED_TOOLS = [
  "blueprint_state_load",
  "blueprint_artifact_list",
  "blueprint_pause_handoff_get",
  "blueprint_pause_handoff_write",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const RESUME_WORK_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_state_load",
  "blueprint_artifact_list",
  "blueprint_pause_handoff_get",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const PR_BRANCH_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_config_get",
  "blueprint_artifact_summary_digest",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_report_write"
] as const satisfies readonly BlueprintInternalToolName[];

const SHIP_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_phase_locate",
  "blueprint_config_get",
  "blueprint_artifact_list",
  "blueprint_artifact_summary_digest",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_report_write",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const UNDO_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_phase_locate",
  "blueprint_artifact_list",
  "blueprint_artifact_summary_digest",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_report_write",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const NEW_WORKSPACE_REQUIRED_TOOLS = [
  "blueprint_config_get",
  "blueprint_workspace_registry_get",
  "blueprint_workspace_create"
] as const satisfies readonly BlueprintInternalToolName[];

const REMOVE_WORKSPACE_REQUIRED_TOOLS = [
  "blueprint_workspace_registry_get",
  "blueprint_workspace_remove"
] as const satisfies readonly BlueprintInternalToolName[];

const WORKSTREAMS_REQUIRED_TOOLS = [
  "blueprint_workstream_list",
  "blueprint_workstream_mutate",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const CLEANUP_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_roadmap_read",
  "blueprint_artifact_list",
  "blueprint_artifact_summary_digest",
  "blueprint_artifact_report_write",
  "blueprint_state_update"
] as const satisfies readonly BlueprintInternalToolName[];

const UPDATE_REQUIRED_TOOLS = [
  "blueprint_update_check",
  "blueprint_update_plan"
] as const satisfies readonly BlueprintInternalToolName[];

const REAPPLY_PATCHES_REQUIRED_TOOLS = [
  "blueprint_patch_list",
  "blueprint_patch_reapply",
  "blueprint_patch_record"
] as const satisfies readonly BlueprintInternalToolName[];

const MAP_CODEBASE_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_artifact_contract_read",
  "blueprint_artifact_scaffold",
  "blueprint_artifact_list",
  "blueprint_artifact_summary_digest",
  "blueprint_codebase_artifact_write",
  "blueprint_artifact_validate"
] as const satisfies readonly BlueprintInternalToolName[];

const HELP_SPEC_PATH = "commands/blu-help.toml";
const PROGRESS_SPEC_PATH = "commands/blu-progress.toml";
const NEXT_SPEC_PATH = "commands/blu-next.toml";
const MAP_CODEBASE_SPEC_PATH =
  "skills/blueprint-map/references/map-runtime-contract.md";
const DISCUSS_PHASE_SPEC_PATH =
  "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md";
const LONG_RUNNING_PHASE_DISCOVERY_PROFILE_PATH =
  "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md";
const PLAN_PHASE_SPEC_PATH =
  "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md";
const RESEARCH_PHASE_SPEC_PATH =
  "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md";
const UI_PHASE_SPEC_PATH =
  "skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md";
const LIST_PHASE_ASSUMPTIONS_SPEC_PATH =
  "skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md";
const INSERT_PHASE_SPEC_PATH =
  "skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md";
const REMOVE_PHASE_SPEC_PATH = "commands/blu-remove-phase.toml";
const PLAN_MILESTONE_GAPS_SPEC_PATH =
  "commands/blu-plan-milestone-gaps.toml";
const AUDIT_MILESTONE_SPEC_PATH = "commands/blu-audit-milestone.toml";
const COMPLETE_MILESTONE_SPEC_PATH =
  "commands/blu-complete-milestone.toml";
const MILESTONE_SUMMARY_SPEC_PATH =
  "commands/blu-milestone-summary.toml";
const NEW_MILESTONE_SPEC_PATH = "commands/blu-new-milestone.toml";
const VALIDATE_PHASE_SPEC_PATH =
  "skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md";
const VERIFY_WORK_SPEC_PATH =
  "skills/blueprint-phase-validation/references/verify-work-runtime-contract.md";
const CODE_REVIEW_SPEC_PATH =
  "skills/blueprint-review/references/code-review-runtime-contract.md";
const CODE_REVIEW_FIX_SPEC_PATH =
  "skills/blueprint-review/references/code-review-fix-runtime-contract.md";
const SECURE_PHASE_SPEC_PATH =
  "skills/blueprint-review/references/secure-phase-runtime-contract.md";
const AUDIT_FIX_SPEC_PATH =
  "skills/blueprint-review/references/audit-fix-runtime-contract.md";
const REVIEW_SPEC_PATH =
  "skills/blueprint-review/references/review-runtime-contract.md";
const UI_REVIEW_SPEC_PATH =
  "skills/blueprint-review/references/ui-review-runtime-contract.md";
const ADD_TESTS_SPEC_PATH =
  "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md";
const DOCS_UPDATE_SPEC_PATH =
  "skills/blueprint-docs/references/docs-update-runtime-contract.md";
const IMPACT_SPEC_PATH =
  "skills/blueprint-impact/references/impact-runtime-contract.md";
const SETTINGS_SPEC_PATH =
  "skills/blueprint-governance/references/settings-runtime-contract.md";
const SET_PROFILE_SPEC_PATH =
  "skills/blueprint-governance/references/set-profile-runtime-contract.md";
const HEALTH_SPEC_PATH =
  "skills/blueprint-governance/references/health-runtime-contract.md";
const PAUSE_WORK_SPEC_PATH =
  "skills/blueprint-governance/references/pause-work-runtime-contract.md";
const RESUME_WORK_SPEC_PATH =
  "skills/blueprint-governance/references/resume-work-runtime-contract.md";
const PR_BRANCH_SPEC_PATH =
  "skills/blueprint-maintenance/references/pr-branch-runtime-contract.md";
const SHIP_SPEC_PATH =
  "skills/blueprint-maintenance/references/ship-runtime-contract.md";
const UNDO_SPEC_PATH =
  "skills/blueprint-maintenance/references/undo-runtime-contract.md";
const NEW_WORKSPACE_SPEC_PATH =
  "skills/blueprint-maintenance/references/new-workspace-runtime-contract.md";
const REMOVE_WORKSPACE_SPEC_PATH =
  "skills/blueprint-maintenance/references/remove-workspace-runtime-contract.md";
const WORKSTREAMS_SPEC_PATH =
  "skills/blueprint-maintenance/references/workstreams-runtime-contract.md";
const CLEANUP_SPEC_PATH =
  "skills/blueprint-maintenance/references/cleanup-runtime-contract.md";
const UPDATE_SPEC_PATH =
  "skills/blueprint-maintenance/references/update-runtime-contract.md";
const REAPPLY_PATCHES_SPEC_PATH =
  "skills/blueprint-maintenance/references/reapply-patches-runtime-contract.md";
const DEBUG_SPEC_PATH =
  "skills/blueprint-debug/references/debug-runtime-contract.md";

const PHASE_DISCOVERY_RESEARCHER_OPTIONAL_AGENTS = [
  "blueprint-researcher"
] as const;
const PLAN_PHASE_OPTIONAL_AGENTS = [
  "blueprint-planner",
  "blueprint-checker"
] as const;
const UI_PHASE_OPTIONAL_AGENTS = [
  "blueprint-ui-designer",
  "blueprint-checker"
] as const;
const EXECUTE_PHASE_OPTIONAL_AGENTS = ["blueprint-executor"] as const;
const VALIDATION_OPTIONAL_AGENTS = ["blueprint-verifier"] as const;
const ADD_TESTS_OPTIONAL_AGENTS = [
  "blueprint-executor",
  "blueprint-verifier"
] as const;
const CODE_REVIEW_OPTIONAL_AGENTS = ["blueprint-reviewer"] as const;
const CODE_REVIEW_FIX_OPTIONAL_AGENTS = ["blueprint-reviewer"] as const;
const SECURE_PHASE_OPTIONAL_AGENTS = ["blueprint-security-auditor"] as const;
const AUDIT_FIX_OPTIONAL_AGENTS = [
  "blueprint-reviewer",
  "blueprint-verifier"
] as const;
const REVIEW_OPTIONAL_AGENTS = ["blueprint-reviewer"] as const;
const UI_REVIEW_OPTIONAL_AGENTS = ["blueprint-ui-auditor"] as const;
const DOCS_UPDATE_OPTIONAL_AGENTS = [
  "blueprint-doc-writer",
  "blueprint-doc-verifier"
] as const;
const ROADMAP_ADMIN_HOOKS = [
  "read-before-edit",
  ".blueprint write guard"
] as const;
const ROADMAP_ADMIN_ROADMAPPER_OPTIONAL_AGENTS = [
  "blueprint-roadmapper"
] as const;
const ROADMAP_ADMIN_VERIFIER_OPTIONAL_AGENTS = [
  "blueprint-verifier"
] as const;
const EXPLORE_OPTIONAL_AGENTS = ["blueprint-researcher"] as const;
const QUICK_OPTIONAL_AGENTS = [
  "blueprint-researcher",
  "blueprint-planner",
  "blueprint-executor",
  "blueprint-verifier"
] as const;
const MAP_CODEBASE_OPTIONAL_AGENTS = ["blueprint-mapper"] as const;

function runtimeMetadataSourceId(commandName: string): string {
  return `${RUNTIME_METADATA_PATH}#${commandName}`;
}

export const INSERT_PHASE_RUNTIME_METADATA = {
  commandName: "insert-phase",
  sourceId: runtimeMetadataSourceId("insert-phase"),
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-roadmap-admin",
    declaredStatus: "implemented",
    risk:
      "Medium: inserts the next decimal phase after an integer phase without renumbering later roadmap entries."
  },
  requiredTools: INSERT_PHASE_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [INSERT_PHASE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("insert-phase"),
    title: "`/blu-insert-phase`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`insert-phase` inserts urgent work as a decimal phase between existing phases, scaffolds the matching phase context starter, records roadmap evolution state, and routes back to discovery without renumbering later phases.",
    reads: [
      "The current roadmap and milestone inventory through blueprint_roadmap_read."
    ],
    writes: [
      ".blueprint/ROADMAP.md",
      ".blueprint/phases/<phasePrefix>-<phaseSlug>/",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("insert-phase"),
    waveTitle: "Roadmap And Milestone",
    command: "insert-phase",
    primarySkill: "blueprint-roadmap-admin",
    exactMcpDestination: INSERT_PHASE_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ROADMAP_ADMIN_HOOKS,
    contractNotes:
      "Interactive-read profile for bounded roadmap insertion: use skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md as the rich behavior contract, require a confirmed integer anchor plus non-empty description, keep decimal numbering roadmap-driven, scaffold only starter phase.context content from the returned phasePrefix, prefer ask_user for the insert confirmation gate, keep the waiting state explicit as phase-insert-confirmation, invalid-insertion-anchor, or conflicting-decimal-directory, preserve the no-subagent fallback and reject browser/web-search/shell-only or generic agents as substitutes, report partial MCP-write failures without hand-editing .blueprint/, record the inserted decimal in STATE.md through roadmapEvolutionNotes, and route to /blu-discuss-phase <decimal> without adopting long-running progress tools.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const REMOVE_PHASE_RUNTIME_METADATA = {
  commandName: "remove-phase",
  sourceId: runtimeMetadataSourceId("remove-phase"),
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-roadmap-admin",
    declaredStatus: "implemented",
    risk:
      "High: deletes a future phase and renumbers later roadmap references plus phase artifacts."
  },
  requiredTools: REMOVE_PHASE_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [REMOVE_PHASE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("remove-phase"),
    title: "`/blu-remove-phase`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`remove-phase` removes a future roadmap phase, deletes its phase directory, renumbers subsequent roadmap and phase artifacts, and re-anchors state on the safest implemented follow-up.",
    reads: [
      "The current roadmap and milestone inventory through blueprint_roadmap_read.",
      "Existing target-phase artifacts and drift through blueprint_phase_locate."
    ],
    writes: [
      ".blueprint/ROADMAP.md",
      "renamed phase directories and phase-scoped artifact filenames under .blueprint/phases/",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("remove-phase"),
    waveTitle: "Roadmap And Milestone",
    command: "remove-phase",
    primarySkill: "blueprint-roadmap-admin",
    exactMcpDestination: REMOVE_PHASE_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ROADMAP_ADMIN_HOOKS,
    contractNotes:
      "Interactive-read profile for bounded roadmap removal: preview the target phase through phase location, prefer ask_user for the destructive confirmation gates, keep the waiting state explicit as future-phase-guard, remove-phase-confirmation, or force-remove-confirmation, allow force: true only after execution evidence triggers the second explicit approval path, and re-anchor state on /blu-progress without adopting long-running progress tools.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const PLAN_MILESTONE_GAPS_RUNTIME_METADATA = {
  commandName: "plan-milestone-gaps",
  sourceId: runtimeMetadataSourceId("plan-milestone-gaps"),
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-roadmap-admin",
    declaredStatus: "implemented",
    risk: "Medium: can add multiple phases in one pass."
  },
  requiredTools: PLAN_MILESTONE_GAPS_REQUIRED_TOOLS,
  optionalAgents: ROADMAP_ADMIN_ROADMAPPER_OPTIONAL_AGENTS,
  requiredInputPaths: [PLAN_MILESTONE_GAPS_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("plan-milestone-gaps"),
    title: "`/blu-plan-milestone-gaps`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`plan-milestone-gaps` creates grouped roadmap phases to close actionable gaps identified by the saved milestone audit, keeping persistence on roadmap and state MCP tools.",
    reads: [
      "blueprint_roadmap_read -> {roadmap, milestone, phases}",
      "blueprint_artifact_list -> {artifacts, reports, missing}",
      "blueprint_artifact_summary_digest -> {digest, inputsUsed}"
    ],
    writes: [
      ".blueprint/ROADMAP.md",
      "new phase directories for approved gaps",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("plan-milestone-gaps"),
    waveTitle: "Roadmap And Milestone",
    command: "plan-milestone-gaps",
    primarySkill: "blueprint-roadmap-admin",
    exactMcpDestination: PLAN_MILESTONE_GAPS_REQUIRED_TOOLS,
    optionalAgents: ROADMAP_ADMIN_ROADMAPPER_OPTIONAL_AGENTS,
    hookInvolvement: ROADMAP_ADMIN_HOOKS,
    contractNotes:
      "Interactive-read profile for bounded audit-follow-up planning: locate the matching milestone audit, preserve grouped requirement, integration, flow, and optional sections with traceability repair notes, prefer ask_user for the grouped plan confirmation gate, keep the waiting state explicit as missing-milestone-audit, no-actionable-gaps, or gap-plan-confirmation, append coherent phases through repeated roadmap-add-phase calls, and route to /blu-discuss-phase <first new phase> without adopting long-running progress tools.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const AUDIT_MILESTONE_RUNTIME_METADATA = {
  commandName: "audit-milestone",
  sourceId: runtimeMetadataSourceId("audit-milestone"),
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-roadmap-admin",
    declaredStatus: "implemented",
    risk: "Low: report generation only."
  },
  requiredTools: AUDIT_MILESTONE_REQUIRED_TOOLS,
  optionalAgents: ROADMAP_ADMIN_VERIFIER_OPTIONAL_AGENTS,
  requiredInputPaths: [AUDIT_MILESTONE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("audit-milestone"),
    title: "`/blu-audit-milestone`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`audit-milestone` compares original milestone intent against saved phase evidence and writes a durable milestone audit report with grouped gaps and traceability notes.",
    reads: [
      "blueprint_roadmap_read -> {roadmap, milestone, phases}",
      "blueprint_phase_summary_index -> phase summary evidence",
      "blueprint_artifact_list -> {artifacts, reports, missing}",
      "blueprint_artifact_contract_read -> report.milestone-audit contract",
      "blueprint_artifact_summary_digest -> {digest, inputsUsed}"
    ],
    writes: ["milestone audit report in .blueprint/reports/"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("audit-milestone"),
    waveTitle: "Roadmap And Milestone",
    command: "audit-milestone",
    primarySkill: "blueprint-roadmap-admin",
    exactMcpDestination: AUDIT_MILESTONE_REQUIRED_TOOLS,
    optionalAgents: ROADMAP_ADMIN_VERIFIER_OPTIONAL_AGENTS,
    hookInvolvement: ROADMAP_ADMIN_HOOKS,
    contractNotes:
      "Interactive-read profile for bounded milestone auditing: compare original milestone intent against completed phase evidence, read report.milestone-audit before drafting, keep grouped gap sections plus traceability notes for downstream repair, prefer ask_user for overwrite confirmation, keep the waiting state explicit as milestone-audit-overwrite-confirmation, and stay report-local in .blueprint/reports/ without adopting long-running progress tools.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const COMPLETE_MILESTONE_RUNTIME_METADATA = {
  commandName: "complete-milestone",
  sourceId: runtimeMetadataSourceId("complete-milestone"),
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-roadmap-admin",
    declaredStatus: "implemented",
    risk:
      "Medium: writes milestone closeout evidence and advances archival routing."
  },
  requiredTools: COMPLETE_MILESTONE_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [COMPLETE_MILESTONE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("complete-milestone"),
    title: "`/blu-complete-milestone`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`complete-milestone` performs a report-driven closeout gated by saved milestone audit readiness, writes a durable completion report, and routes to milestone summary.",
    reads: [
      "blueprint_roadmap_read -> {roadmap, milestone, phases}",
      "blueprint_artifact_list -> {artifacts, reports, missing}",
      "blueprint_state_load -> derivedStatus.milestoneAudit readiness",
      "blueprint_artifact_contract_read -> report.milestone-complete contract",
      "blueprint_artifact_summary_digest -> {digest, inputsUsed}"
    ],
    writes: [
      ".blueprint/reports/milestone-complete-<version>.md",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("complete-milestone"),
    waveTitle: "Roadmap And Milestone",
    command: "complete-milestone",
    primarySkill: "blueprint-roadmap-admin",
    exactMcpDestination: COMPLETE_MILESTONE_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ROADMAP_ADMIN_HOOKS,
    contractNotes:
      "Interactive-read profile for bounded milestone closeout: require the saved milestone audit and derivedStatus.milestoneAudit.readyForCompletion, read report.milestone-complete before drafting, prefer ask_user for overwrite confirmation, keep the waiting state explicit as missing-milestone-audit, milestone-not-ready, or milestone-complete-overwrite-confirmation, write milestone-complete-<version>.md, and route to /blu-milestone-summary <milestone> without adopting long-running progress tools.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const MILESTONE_SUMMARY_RUNTIME_METADATA = {
  commandName: "milestone-summary",
  sourceId: runtimeMetadataSourceId("milestone-summary"),
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-roadmap-admin",
    declaredStatus: "implemented",
    risk: "Low: report generation and routing only."
  },
  requiredTools: MILESTONE_SUMMARY_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [MILESTONE_SUMMARY_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("milestone-summary"),
    title: "`/blu-milestone-summary`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`milestone-summary` builds a durable milestone summary from saved roadmap, audit, and completion evidence and routes toward the next milestone-start action.",
    reads: [
      "blueprint_roadmap_read -> {roadmap, milestone, phases}",
      "blueprint_artifact_list -> {artifacts, reports, missing}",
      "blueprint_artifact_contract_read -> report.milestone-summary contract",
      "blueprint_artifact_summary_digest -> {digest, inputsUsed}"
    ],
    writes: [
      ".blueprint/reports/milestone-summary-<version>.md",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("milestone-summary"),
    waveTitle: "Roadmap And Milestone",
    command: "milestone-summary",
    primarySkill: "blueprint-roadmap-admin",
    exactMcpDestination: MILESTONE_SUMMARY_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ROADMAP_ADMIN_HOOKS,
    contractNotes:
      "Interactive-read profile for bounded milestone summarization: use saved audit and completion evidence, read report.milestone-summary before drafting, prefer ask_user for overwrite confirmation, keep the waiting state explicit as missing-milestone-audit, missing-milestone-complete, or milestone-summary-overwrite-confirmation, write milestone-summary-<version>.md, and route to /blu-new-milestone without pulling in later-wave docs agents or adopting long-running progress tools.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const NEW_MILESTONE_RUNTIME_METADATA = {
  commandName: "new-milestone",
  sourceId: runtimeMetadataSourceId("new-milestone"),
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-roadmap-admin",
    declaredStatus: "implemented",
    risk:
      "Medium: rewrites milestone starter docs through carry-forward scaffolding and advances state without deleting historical phase artifacts."
  },
  requiredTools: NEW_MILESTONE_REQUIRED_TOOLS,
  optionalAgents: ROADMAP_ADMIN_ROADMAPPER_OPTIONAL_AGENTS,
  requiredInputPaths: [NEW_MILESTONE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("new-milestone"),
    title: "`/blu-new-milestone`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`new-milestone` starts a new milestone cycle by deriving carry-forward context from the saved milestone summary, scaffolding starter docs and the first phase context, and preserving historical phase artifacts.",
    reads: [
      "blueprint_roadmap_read -> {roadmap, milestone, phases}",
      "blueprint_artifact_contract_read -> report.milestone-summary and phase.context contracts",
      "blueprint_artifact_summary_digest -> {digest, inputsUsed}"
    ],
    writes: [
      ".blueprint/PROJECT.md",
      ".blueprint/REQUIREMENTS.md",
      ".blueprint/ROADMAP.md",
      ".blueprint/phases/<next-phase-slug>/<NN-CONTEXT.md>",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("new-milestone"),
    waveTitle: "Roadmap And Milestone",
    command: "new-milestone",
    primarySkill: "blueprint-roadmap-admin",
    exactMcpDestination: NEW_MILESTONE_REQUIRED_TOOLS,
    optionalAgents: ROADMAP_ADMIN_ROADMAPPER_OPTIONAL_AGENTS,
    hookInvolvement: ROADMAP_ADMIN_HOOKS,
    contractNotes:
      "Interactive-read profile for bounded milestone restart: use the saved milestone summary as durable carry-forward input, read report.milestone-summary before seeding, read phase.context before scaffolding the first carried-forward phase, prefer ask_user for reset-versus-carry-forward and overwrite confirmations, keep the waiting state explicit as missing-milestone-summary, carry-forward-confirmation, or starter-doc-overwrite-confirmation, preserve historical phase artifacts, and route to /blu-discuss-phase <first phase> without adopting long-running progress tools.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const HELP_RUNTIME_METADATA = {
  commandName: "help",
  sourceId: runtimeMetadataSourceId("help"),
  catalog: {
    wave: 0,
    family: "Foundation",
    primarySkill: "blueprint-router",
    declaredStatus: "implemented",
    risk: "Low: read-only router guidance from project status and the live command catalog."
  },
  requiredTools: HELP_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [HELP_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("help"),
    title: "`/blu-help`",
    executionProfile: "router",
    rootRoutable: true,
    purpose:
      "`help` shows safe Blueprint router guidance from project readiness and the implemented command catalog.",
    reads: [
      "Project status and command availability through Blueprint MCP tools."
    ],
    writes: []
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("help"),
    waveTitle: "Foundation",
    command: "help",
    primarySkill: "blueprint-router",
    exactMcpDestination: HELP_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [],
    contractNotes:
      "Router profile; report the waiting state from project status, keep the next safe action explicit, and never present planned or blocked commands as runnable. This includes map-first waiting states: brownfield uninitialized and mapping-incomplete route to /blu-map-codebase, while mapped-only routes to /blu-new-project.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const PROGRESS_RUNTIME_METADATA = {
  commandName: "progress",
  sourceId: runtimeMetadataSourceId("progress"),
  catalog: {
    wave: 0,
    family: "Foundation",
    primarySkill: "blueprint-router",
    declaredStatus: "implemented",
    risk: "Low: read-only status inspection."
  },
  requiredTools: PROGRESS_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [PROGRESS_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("progress"),
    title: "`/blu-progress`",
    executionProfile: "router",
    rootRoutable: true,
    purpose:
      "`progress` summarizes Blueprint repo status, blockers, warnings, and next safe implemented guidance from MCP-owned state.",
    reads: [
      ".blueprint/ state, config, artifacts, project status, and command catalog through MCP tools."
    ],
    writes: []
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("progress"),
    waveTitle: "Foundation",
    command: "progress",
    primarySkill: "blueprint-router",
    exactMcpDestination: PROGRESS_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [],
    contractNotes:
      "Router profile; preserve read-only next-step guidance while surfacing active profile, branching mode, blockers, pending gates, and config warnings from normalized config, and keep recommendations inside the implemented runtime surface. Brownfield uninitialized and mapping-incomplete states point to /blu-map-codebase; mapped-only points to /blu-new-project. Planned or blocked commands are not runnable.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const NEXT_RUNTIME_METADATA = {
  commandName: "next",
  sourceId: runtimeMetadataSourceId("next"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-router",
    declaredStatus: "implemented",
    risk:
      "Low: read-only next-step routing from project status, state, artifacts, and the live command catalog."
  },
  requiredTools: NEXT_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [NEXT_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("next"),
    title: "`/blu-next`",
    executionProfile: "router",
    rootRoutable: true,
    purpose:
      "`next` returns the next safe direct Blueprint command for the current repo state without widening beyond implemented commands.",
    reads: [
      ".blueprint/ state, artifact inventory, project status, and command catalog through MCP tools."
    ],
    writes: []
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("next"),
    waveTitle: "Core Lifecycle",
    command: "next",
    primarySkill: "blueprint-router",
    exactMcpDestination: NEXT_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [],
    contractNotes:
      "Host-native router flow; report waiting state and the next safe follow-up explicitly, and never hide destructive behavior behind implicit routing. This includes /blu-map-codebase for unmapped brownfield or mapping-incomplete and /blu-new-project for mapped-only. Planned or blocked commands are not runnable.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const MAP_CODEBASE_RUNTIME_METADATA = {
  commandName: "map-codebase",
  sourceId: runtimeMetadataSourceId("map-codebase"),
  catalog: {
    wave: 0,
    family: "Foundation",
    primarySkill: "blueprint-map",
    declaredStatus: "implemented",
    risk:
      "Medium: refresh mode can replace existing codebase-mapping artifacts."
  },
  requiredTools: MAP_CODEBASE_REQUIRED_TOOLS,
  optionalAgents: MAP_CODEBASE_OPTIONAL_AGENTS,
  requiredInputPaths: [
    "commands/blu-map-codebase.toml",
    MAP_CODEBASE_SPEC_PATH
  ],
  spec: {
    path: runtimeMetadataSourceId("map-codebase"),
    title: "`/blu-map-codebase`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`map-codebase` analyzes a brownfield codebase with mapper-style passes and produces the stable seven-document Blueprint codebase bundle. Focus areas deepen the same bundle instead of creating a separate suffix-only mode.",
    reads: [],
    writes: [
      ".blueprint/codebase/STACK.md",
      ".blueprint/codebase/ARCHITECTURE.md",
      ".blueprint/codebase/STRUCTURE.md",
      ".blueprint/codebase/CONVENTIONS.md",
      ".blueprint/codebase/TESTING.md",
      ".blueprint/codebase/INTEGRATIONS.md",
      ".blueprint/codebase/CONCERNS.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("map-codebase"),
    waveTitle: "Foundation",
    command: "map-codebase",
    primarySkill: "blueprint-map",
    exactMcpDestination: MAP_CODEBASE_REQUIRED_TOOLS,
    optionalAgents: MAP_CODEBASE_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile for read-heavy brownfield mapping: load the local map runtime contract at skills/blueprint-map/references/map-runtime-contract.md, keep reuse as the default posture, treat supplied focus areas as targeted deepening across the same seven-document bundle, require ask_user confirmation for refresh or replace paths before any overwrite, read the canonical codebase contract before scaffold or refresh decisions, use contract.authoringTemplate as the heading authority, pass digest inputs as repo-relative paths and treat returned inputsUsed as authoritative, persist substantive mapping content through blueprint_codebase_artifact_write, repair invalid write results from returned issues before moving on, validate the resulting bundle, and route a successful map-first brownfield repo to /blu-new-project.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const SETTINGS_RUNTIME_METADATA = {
  commandName: "settings",
  sourceId: runtimeMetadataSourceId("settings"),
  catalog: {
    wave: 0,
    family: "Foundation",
    primarySkill: "blueprint-governance",
    declaredStatus: "implemented",
    risk:
      "Low: config-only mutation inside repo config plus optional user defaults."
  },
  requiredTools: SETTINGS_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [SETTINGS_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("settings"),
    title: "`/blu-settings`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`settings` inspects and updates Blueprint repo or default configuration through governance MCP tools.",
    reads: ["Project status and current Blueprint configuration through MCP."],
    writes: [".blueprint/config.json or host defaults when explicitly requested"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("settings"),
    waveTitle: "Foundation",
    command: "settings",
    primarySkill: "blueprint-governance",
    exactMcpDestination: SETTINGS_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for bounded configuration inspection and mutation: load skills/blueprint-governance/references/settings-runtime-contract.md, read status and config through MCP first, mutate only explicit repo/defaults settings through blueprint_config_set, and route follow-ups only to implemented commands.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const SET_PROFILE_RUNTIME_METADATA = {
  commandName: "set-profile",
  sourceId: runtimeMetadataSourceId("set-profile"),
  catalog: {
    wave: 0,
    family: "Foundation",
    primarySkill: "blueprint-governance",
    declaredStatus: "implemented",
    risk: "Low: single-setting mutation for project model profile selection."
  },
  requiredTools: SET_PROFILE_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [SET_PROFILE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("set-profile"),
    title: "`/blu-set-profile`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`set-profile` changes the current project model_profile through the governance MCP config substrate.",
    reads: ["Current Blueprint configuration through MCP."],
    writes: [".blueprint/config.json model_profile"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("set-profile"),
    waveTitle: "Foundation",
    command: "set-profile",
    primarySkill: "blueprint-governance",
    exactMcpDestination: SET_PROFILE_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for one-field project profile mutation: load skills/blueprint-governance/references/set-profile-runtime-contract.md, inspect current config first, update only model_profile through blueprint_config_set_profile, and route follow-ups only to implemented commands.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const HEALTH_RUNTIME_METADATA = {
  commandName: "health",
  sourceId: runtimeMetadataSourceId("health"),
  catalog: {
    wave: 0,
    family: "Foundation",
    primarySkill: "blueprint-governance",
    declaredStatus: "implemented",
    risk:
      "Medium: repair mode can normalize config and rewrite malformed planning artifacts."
  },
  requiredTools: HEALTH_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [HEALTH_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("health"),
    title: "`/blu-health`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`health` checks Blueprint project health and can run explicit repair-mode normalization through MCP-owned tools.",
    reads: [
      "Project status, config, state, artifact inventory, and validation results through MCP."
    ],
    writes: [
      ".blueprint/config.json and malformed planning artifacts only in explicit repair mode"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("health"),
    waveTitle: "Foundation",
    command: "health",
    primarySkill: "blueprint-governance",
    exactMcpDestination: HEALTH_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for health inspection and explicit repair: load skills/blueprint-governance/references/health-runtime-contract.md, gather project/config/state/artifact evidence through MCP, validate artifacts before reporting, run blueprint_config_set and blueprint_state_sync only for requested repair mode, and route follow-ups only to implemented commands.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const DISCUSS_PHASE_RUNTIME_METADATA = {
  commandName: "discuss-phase",
  sourceId: runtimeMetadataSourceId("discuss-phase"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-phase-discovery",
    declaredStatus: "implemented",
    risk: "Medium: can replace or extend phase context artifacts."
  },
  requiredTools: DISCUSS_PHASE_REQUIRED_TOOLS,
  optionalAgents: PHASE_DISCOVERY_RESEARCHER_OPTIONAL_AGENTS,
  requiredInputPaths: [
    DISCUSS_PHASE_SPEC_PATH,
    LONG_RUNNING_PHASE_DISCOVERY_PROFILE_PATH
  ],
  spec: {
    path: runtimeMetadataSourceId("discuss-phase"),
    title: "`/blu-discuss-phase`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`discuss-phase` gathers durable phase context through adaptive discovery, capability-gated gray-area research sidecars, checkpointed resumability, validation repair, and MCP-owned phase artifact writes.",
    reads: [
      "Phase resolution, roadmap state, artifact inventory, effective config, saved phase artifacts, plan inventory, artifact contracts, checkpoints, and refreshed state through MCP."
    ],
    writes: [
      "phase XX-CONTEXT.md",
      "optional phase XX-DISCUSSION-LOG.md",
      "optional shared phase XX-DISCUSS-CHECKPOINT.json during in-progress discovery",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("discuss-phase"),
    waveTitle: "Core Lifecycle",
    command: "discuss-phase",
    primarySkill: "blueprint-phase-discovery",
    exactMcpDestination: DISCUSS_PHASE_REQUIRED_TOOLS,
    optionalAgents: PHASE_DISCOVERY_RESEARCHER_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation phase discovery uses the shared profile in skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md and the command-specific behavior contract in skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md. It does a prior-context sweep before asking questions, keeps host-supported structured choices and checkpoint resume-versus-discard gates explicit, supports assumptions-mode analysis, uses capability-gated blueprint-researcher sidecars only for one gray area or assumptions pass in lightweight gray-area memo mode, preserves a one-area-at-a-time single-agent fallback with checkpoint-per-area resumability, keeps contract.authoringTemplate as schema authority, reads plan-index and artifact-contract guidance before persistence, repairs returned artifact validation issues, folds deferred ideas into the saved record, calls blueprint_state_update with synced state followed by blueprint_state_load, and does not promise a dedicated todo/backlog file crawl.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const PLAN_PHASE_RUNTIME_METADATA = {
  commandName: "plan-phase",
  sourceId: runtimeMetadataSourceId("plan-phase"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-phase-planning",
    declaredStatus: "implemented",
    risk:
      "Medium: can replace plans and change downstream execution order."
  },
  requiredTools: PLAN_PHASE_REQUIRED_TOOLS,
  optionalAgents: PLAN_PHASE_OPTIONAL_AGENTS,
  requiredInputPaths: [PLAN_PHASE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("plan-phase"),
    title: "`/blu-plan-phase`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`plan-phase` creates or extends execution-ready phase plans through MCP-owned structured phase.plan model validation and plan writes.",
    reads: [
      "Phase resolution, context, planning readiness, saved discovery artifacts, validation and review evidence, plan inventory, plan authoring schema, effective config, and state through MCP."
    ],
    writes: [
      "structured phase.plan JSON through blueprint_phase_plan_write",
      ".blueprint/phases/<phase>/<phase-prefix>-<plan-id>-PLAN.md (XX-YY-PLAN.md) through blueprint_phase_plan_write",
      ".blueprint/STATE.md through synced state update"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("plan-phase"),
    waveTitle: "Core Lifecycle",
    command: "plan-phase",
    primarySkill: "blueprint-phase-planning",
    exactMcpDestination: [
      "blueprint_phase_locate",
      "blueprint_artifact_contract_read",
      "blueprint_phase_context",
      "blueprint_phase_research_status",
      "blueprint_phase_artifact_read",
      "blueprint_phase_validation_read",
      "blueprint_review_load_findings",
      "blueprint_phase_plan_index",
      "blueprint_phase_plan_read",
      "blueprint_phase_plan_authoring_context",
      "blueprint_phase_plan_validate_model",
      "blueprint_phase_plan_validate",
      "blueprint_phase_plan_write",
      "blueprint_config_get",
      "blueprint_state_load",
      "blueprint_state_update"
    ],
    optionalAgents: PLAN_PHASE_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile; keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible. Load skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md as the local runtime contract, respect blueprint_phase_research_status.planningReadiness as the config-aware pre-draft handoff gate, consume saved research instead of live browsing for freshness-sensitive technical decisions, and route to /blu-research-phase when research evidence is required. Author phase.plan as structured JSON against blueprint_phase_plan_authoring_context.taskSchema and contract.modelContract.schemaPath, re-read blueprint_phase_plan_authoring_context immediately before each model validation/write after any successful plan write because saved plan files are intentional later-slot evidence artifacts, validate with blueprint_phase_plan_validate_model, persist the same model through blueprint_phase_plan_write with validationMode: \"strict\" and authoringMode: \"model-only\", and reject scaffold-placeholder seeding, Markdown fallback, raw .blueprint edits, or warn-mode writes from /blu-plan-phase. Gate reuse/revise/replace only for writes that revise or replace saved plan ids, while additive new plan ids may proceed without an overwrite gate. Use blueprint-planner when suitable, preserve the one-plan-at-a-time no-subagent fallback, run blueprint-checker only when workflow.plan_check is enabled, and keep the checker/fallback loop bounded. Repair MCP validation, write, or scoped plan diagnostics against the live task schema before retrying, run blueprint_phase_plan_validate after persistence, then call blueprint_state_update with base: \"synced\" followed by state-aware routing to implemented follow-ups.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const RESEARCH_PHASE_RUNTIME_METADATA = {
  commandName: "research-phase",
  sourceId: runtimeMetadataSourceId("research-phase"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-phase-discovery",
    declaredStatus: "implemented",
    risk: "Low: writes research artifacts only."
  },
  requiredTools: RESEARCH_PHASE_REQUIRED_TOOLS,
  optionalAgents: PHASE_DISCOVERY_RESEARCHER_OPTIONAL_AGENTS,
  requiredInputPaths: [RESEARCH_PHASE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("research-phase"),
    title: "`/blu-research-phase`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`research-phase` gathers phase-scoped implementation guidance from saved Blueprint artifacts, repo evidence, and approved external references, then persists validated research through MCP-owned state paths.",
    reads: [
      "Phase resolution, context, research status, saved phase artifacts, checkpoints, artifact contracts, effective config, command catalog, and refreshed state through MCP."
    ],
    writes: [
      "phase XX-RESEARCH.md",
      "optional shared phase checkpoint JSON owned by research-phase",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("research-phase"),
    waveTitle: "Core Lifecycle",
    command: "research-phase",
    primarySkill: "blueprint-phase-discovery",
    exactMcpDestination: RESEARCH_PHASE_REQUIRED_TOOLS,
    optionalAgents: PHASE_DISCOVERY_RESEARCHER_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile for topic-strand phase research: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial multi-strand research without turning them into persistence, and when those helpers are unavailable fall back to short progress recaps plus MCP-backed checkpoints and STATE.md. Ground repo truth first in phase context, actual saved context content, existing research, and saved codebase summaries, stop on missing XX-CONTEXT.md instead of drafting from status-only signals, read blueprint_config_get before any official-doc or external verification, honor research.external_sources as off/ask/auto, use official docs or explicitly supplied external references only when the repo cannot settle a claim, keep repo-derived evidence distinct from external truth in the finished research, treat State Of The Art freshness wording as runtime-contract guidance rather than an MCP validation gate, use skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md as the rich behavior contract, keep contract.authoringTemplate as schema authority, reserve blueprint_artifact_scaffold for deliberate placeholder creation only, use capability-gated blueprint-researcher only when suitable Blueprint research or code-analysis agents are available, require the parent to supply any official-doc or external evidence packet instead of asking the subagent to fetch it, preserve the single-agent topic-strand fallback when they are not, reject browser/web-search/shell-only or generic agents as substitutes, force repair when existing research is invalid, sync STATE.md even on valid non-writing reuse paths, repair invalid writes or validation failures before completion, checkpoint inconclusive strands instead of bluffing a final artifact, delete only research-owned shared checkpoints, and keep routing limited to implemented commands only.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const UI_PHASE_RUNTIME_METADATA = {
  commandName: "ui-phase",
  sourceId: runtimeMetadataSourceId("ui-phase"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-phase-discovery",
    declaredStatus: "implemented",
    risk: "Low: writes a UI contract or documented skip rationale only."
  },
  requiredTools: UI_PHASE_REQUIRED_TOOLS,
  optionalAgents: UI_PHASE_OPTIONAL_AGENTS,
  requiredInputPaths: [UI_PHASE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("ui-phase"),
    title: "`/blu-ui-phase`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`ui-phase` creates or reuses the single phase-scoped UI artifact, writing either a UI design contract or an explicit skip rationale through MCP-owned phase artifact persistence.",
    reads: [
      "Phase resolution, research status, effective config, canonical UI-spec contract, saved context/research/UI artifacts, and state through MCP."
    ],
    writes: [
      "phase XX-UI-SPEC.md for either a UI contract or an explicit UI-skip rationale",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("ui-phase"),
    waveTitle: "Core Lifecycle",
    command: "ui-phase",
    primarySkill: "blueprint-phase-discovery",
    exactMcpDestination: UI_PHASE_REQUIRED_TOOLS,
    optionalAgents: UI_PHASE_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile for bounded UI-contract drafting: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, keep contract-versus-skip posture, workflow.ui_safety_gate rationale confirmation, overwrite confirmation, checker-requested revision, and MCP validation repair explicit as visible gates, read the canonical phase.ui-spec contract before drafting or persisting, read actual saved context and research bodies when status reports them, load skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md as the richness, evidence, fallback, and retry authority, keep contract.authoringTemplate as heading/schema authority, use capability-gated blueprint-ui-designer and blueprint-checker for design-system evidence plus six-dimension UI quality review, preserve the no-subagent section-by-section fallback, reject browser/web-search/shell-only or generic substitute agents, repair invalid writes or checker-blocked dimensions before completion, and use XX-UI-SPEC.md as the single durable output for either a UI contract or an explicit skip rationale.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const EXECUTE_PHASE_RUNTIME_METADATA = {
  commandName: "execute-phase",
  sourceId: runtimeMetadataSourceId("execute-phase"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-phase-execution",
    declaredStatus: "implemented",
    risk:
      "High: drives real repo mutation during implementation and records execution summaries."
  },
  requiredTools: EXECUTE_PHASE_REQUIRED_TOOLS,
  optionalAgents: EXECUTE_PHASE_OPTIONAL_AGENTS,
  spec: {
    path: runtimeMetadataSourceId("execute-phase"),
    title: "`/blu-execute-phase`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`execute-phase` executes saved phase plans in deterministic target order, records plan-linked execution summaries, and syncs Blueprint state without claiming phase completion.",
    reads: [
      ".blueprint/config.json",
      ".blueprint/STATE.md",
      "selected plan and summary files through MCP",
      "phase.summary contract"
    ],
    writes: [
      "one or more XX-YY-SUMMARY.md files",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("execute-phase"),
    waveTitle: "Core Lifecycle",
    command: "execute-phase",
    primarySkill: "blueprint-phase-execution",
    exactMcpDestination: EXECUTE_PHASE_REQUIRED_TOOLS,
    optionalAgents: EXECUTE_PHASE_OPTIONAL_AGENTS,
    hookInvolvement: [
      "read-before-edit",
      ".blueprint write guard",
      "workflow advisory"
    ],
    contractNotes:
      "Long-running-mutation profile; keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, pair Gemini-native update_topic and write_todos for long execution runs without turning them into persistence, read the canonical phase.summary contract plus the Markdown-first summary authoring context before any summary write or replacement, use blueprint_phase_execution_targets for deterministic target selection plus overwrite and overlap warnings, refuse stale or invalid saved plans, preserve wave order and lower-wave blockers, use bounded blueprint-executor agents only with explicit disjoint write ownership, fall back to one-plan-at-a-time inline execution when agents are unavailable or unsafe, persist PARTIAL or BLOCKED summaries as durable carry-forward evidence, run targeted verification plus bounded repair before COMPLETED summaries, rerun the summary index before synced state update, never persist execute-phase reports, and never claim phase completion before validation and verification evidence exists. The rich command-local contract lives in skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const LIST_PHASE_ASSUMPTIONS_RUNTIME_METADATA = {
  commandName: "list-phase-assumptions",
  sourceId: runtimeMetadataSourceId("list-phase-assumptions"),
  catalog: {
    wave: 2,
    family: "Roadmap And Milestone",
    primarySkill: "blueprint-phase-discovery",
    declaredStatus: "implemented",
    risk: "Low: read-only analysis."
  },
  requiredTools: LIST_PHASE_ASSUMPTIONS_REQUIRED_TOOLS,
  optionalAgents: PHASE_DISCOVERY_RESEARCHER_OPTIONAL_AGENTS,
  requiredInputPaths: [LIST_PHASE_ASSUMPTIONS_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("list-phase-assumptions"),
    title: "`/blu-list-phase-assumptions`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`list-phase-assumptions` surfaces read-only pre-planning assumptions about a phase so users can correct misunderstandings before discovery or planning.",
    reads: [
      "Phase resolution, phase context, roadmap state, and project status through MCP."
    ],
    writes: []
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("list-phase-assumptions"),
    waveTitle: "Roadmap And Milestone",
    command: "list-phase-assumptions",
    primarySkill: "blueprint-phase-discovery",
    exactMcpDestination: LIST_PHASE_ASSUMPTIONS_REQUIRED_TOOLS,
    optionalAgents: PHASE_DISCOVERY_RESEARCHER_OPTIONAL_AGENTS,
    hookInvolvement: [],
    contractNotes:
      "Interactive-read profile for read-only pre-planning synthesis: load skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md, keep the response grounded in saved phase and roadmap state, preserve the five explicit assumption areas plus uncertainty language, surface missing or blocked phase resolution as a waiting state with valid roadmap phases and the next safe implemented follow-up, and do not widen into writes, hidden planning, or tracker-backed progress behavior.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const VALIDATE_PHASE_RUNTIME_METADATA = {
  commandName: "validate-phase",
  sourceId: runtimeMetadataSourceId("validate-phase"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-phase-validation",
    declaredStatus: "implemented",
    risk:
      "Low: writes summary-aware verification evidence and updates follow-up state."
  },
  requiredTools: VALIDATE_PHASE_REQUIRED_TOOLS,
  optionalAgents: VALIDATION_OPTIONAL_AGENTS,
  requiredInputPaths: [VALIDATE_PHASE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("validate-phase"),
    title: "`/blu-validate-phase`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`validate-phase` audits saved execution summaries and persists phase verification evidence through the validation MCP substrate.",
    reads: [
      "Saved phase summaries, validation baselines, config, artifact health, and state through MCP tools."
    ],
    writes: ["phase XX-VERIFICATION.md", ".blueprint/STATE.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("validate-phase"),
    waveTitle: "Core Lifecycle",
    command: "validate-phase",
    primarySkill: "blueprint-phase-validation",
    exactMcpDestination: VALIDATE_PHASE_REQUIRED_TOOLS,
    optionalAgents: VALIDATION_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile; validate saved summary evidence through the phase validation MCP substrate, use schema/evidence-rich MCP text from the validation and contract tools when host structured content is hidden, author the phase.verification 1.1.0 model with status equal to gateState, normalize covered coverage to COVERED, preserve extended validation evidence fields, and route only to implemented follow-up commands.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const VERIFY_WORK_RUNTIME_METADATA = {
  commandName: "verify-work",
  sourceId: runtimeMetadataSourceId("verify-work"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-phase-validation",
    declaredStatus: "implemented",
    risk:
      "Medium: writes resumable UAT artifacts, can close or reopen roadmap completion, and records follow-up state."
  },
  requiredTools: VERIFY_WORK_REQUIRED_TOOLS,
  optionalAgents: VALIDATION_OPTIONAL_AGENTS,
  requiredInputPaths: [VERIFY_WORK_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("verify-work"),
    title: "`/blu-verify-work`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`verify-work` runs summary-backed UAT and persists resumable phase UAT evidence through the validation MCP substrate.",
    reads: [
      "Saved phase summaries, verification and UAT state, config, artifact health, and state through MCP tools."
    ],
    writes: ["phase XX-UAT.md", ".blueprint/ROADMAP.md", ".blueprint/STATE.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("verify-work"),
    waveTitle: "Core Lifecycle",
    command: "verify-work",
    primarySkill: "blueprint-phase-validation",
    exactMcpDestination: VERIFY_WORK_REQUIRED_TOOLS,
    optionalAgents: VALIDATION_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile; keep conversational UAT phase-scoped, summary-aware, and persisted through the validation MCP substrate.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const CODE_REVIEW_RUNTIME_METADATA = {
  commandName: "code-review",
  sourceId: runtimeMetadataSourceId("code-review"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-review",
    declaredStatus: "implemented",
    risk: "Low: review artifact generation only."
  },
  requiredTools: CODE_REVIEW_REQUIRED_TOOLS,
  optionalAgents: CODE_REVIEW_OPTIONAL_AGENTS,
  requiredInputPaths: [CODE_REVIEW_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("code-review"),
    title: "`/blu-code-review`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`code-review` reviews source files changed during a Blueprint phase, resolves deterministic scope from executed plan metadata or explicit file paths, honors review settings, audits saved phase evidence, and persists the result through review MCP tools instead of prompt-only file writes.",
    reads: [
      ".blueprint/config.json",
      "Phase resolution, artifact inventory, review scoping, saved execution summaries, matching plans, validation or UAT evidence, and any existing review findings through MCP tools and read-only repo access."
    ],
    writes: ["phase XX-REVIEW.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("code-review"),
    waveTitle: "Quality, Shipping, Docs, And Maintenance",
    command: "code-review",
    primarySkill: "blueprint-review",
    exactMcpDestination: CODE_REVIEW_REQUIRED_TOOLS,
    optionalAgents: CODE_REVIEW_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile for deterministic phase-scoped review: keep Resolve/Read/Decide/Execute/Validate/Persist/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial review runs without turning them into persistence, let blueprint_review_scope own review enablement, normalized depth defaults, saved evidence inventory, deterministic repo-file scoping, authoring context, and narrowed task schema, load skills/blueprint-review/references/code-review-runtime-contract.md for model-only JSON authoring, depth semantics, evidence richness, capability-gated reviewer use, no-subagent fallback, and MCP retry/repair behavior, keep explicit scope or overwrite confirmation when broad scope or existing review evidence needs approval, fail any invalid explicit --files scope instead of silently narrowing it, load saved XX-REVIEW.md findings before overwrite decisions, validate the authored model through blueprint_review_validate_model, and persist the model through blueprint_review_record so MCP renders canonical XX-REVIEW.md without Markdown fallback.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const CODE_REVIEW_FIX_RUNTIME_METADATA = {
  commandName: "code-review-fix",
  sourceId: runtimeMetadataSourceId("code-review-fix"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-review",
    declaredStatus: "implemented",
    risk:
      "High: selected findings can trigger bounded repo remediation plus review-fix/state updates."
  },
  requiredTools: CODE_REVIEW_FIX_REQUIRED_TOOLS,
  optionalAgents: CODE_REVIEW_FIX_OPTIONAL_AGENTS,
  requiredInputPaths: [CODE_REVIEW_FIX_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("code-review-fix"),
    title: "`/blu-code-review-fix`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`code-review-fix` applies bounded fixes from saved code-review findings and persists review-fix evidence plus state through MCP tools.",
    reads: [
      "Saved code-review findings, phase evidence, and review-fix authoring context through MCP tools."
    ],
    writes: ["phase XX-REVIEW-FIX.md", ".blueprint/STATE.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("code-review-fix"),
    waveTitle: "Quality, Shipping, Docs, And Maintenance",
    command: "code-review-fix",
    primarySkill: "blueprint-review",
    exactMcpDestination: CODE_REVIEW_FIX_REQUIRED_TOOLS,
    optionalAgents: CODE_REVIEW_FIX_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard", "workflow advisory"],
    contractNotes:
      "Long-running-mutation profile for bounded saved-finding remediation; keep repo mutation scoped to selected findings, validate review.review-fix, persist through review MCP tools, and route follow-up through implemented validation or progress commands only.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const SECURE_PHASE_RUNTIME_METADATA = {
  commandName: "secure-phase",
  sourceId: runtimeMetadataSourceId("secure-phase"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-review",
    declaredStatus: "implemented",
    risk: "Low: audit artifact only."
  },
  requiredTools: SECURE_PHASE_REQUIRED_TOOLS,
  optionalAgents: SECURE_PHASE_OPTIONAL_AGENTS,
  requiredInputPaths: [SECURE_PHASE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("secure-phase"),
    title: "`/blu-secure-phase`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`secure-phase` verifies declared saved-plan threats against completed execution evidence and persists phase security evidence through review MCP tools.",
    reads: [
      "Saved plans, summaries, threat evidence, artifact inventory, and security authoring context through MCP tools."
    ],
    writes: ["phase XX-SECURITY.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("secure-phase"),
    waveTitle: "Quality, Shipping, Docs, And Maintenance",
    command: "secure-phase",
    primarySkill: "blueprint-review",
    exactMcpDestination: SECURE_PHASE_REQUIRED_TOOLS,
    optionalAgents: SECURE_PHASE_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile for bounded threat verification; persist review.security through review MCP tools and route only after open threats are closed or accepted.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const AUDIT_FIX_RUNTIME_METADATA = {
  commandName: "audit-fix",
  sourceId: runtimeMetadataSourceId("audit-fix"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-review",
    declaredStatus: "implemented",
    risk: "High: bounded remediation plus report/state updates."
  },
  requiredTools: AUDIT_FIX_REQUIRED_TOOLS,
  optionalAgents: AUDIT_FIX_OPTIONAL_AGENTS,
  requiredInputPaths: [AUDIT_FIX_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("audit-fix"),
    title: "`/blu-audit-fix`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`audit-fix` classifies saved review, security, verification, and UAT evidence, applies bounded remediation when not dry-running, persists a durable audit-fix report, and updates state through MCP tools.",
    reads: [
      "Saved phase evidence, artifact inventory, deterministic review scope, audit-fix report authoring context, and state through MCP tools plus bounded repo inspection."
    ],
    writes: [
      ".blueprint/reports/audit-fix-<phase>.md",
      "optional .blueprint/todos/TODO.md",
      "repo code changes when not dry-running",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("audit-fix"),
    waveTitle: "Quality, Shipping, Docs, And Maintenance",
    command: "audit-fix",
    primarySkill: "blueprint-review",
    exactMcpDestination: AUDIT_FIX_REQUIRED_TOOLS,
    optionalAgents: AUDIT_FIX_OPTIONAL_AGENTS,
    hookInvolvement: [
      "read-before-edit",
      ".blueprint write guard",
      "workflow advisory"
    ],
    contractNotes:
      "Long-running-mutation profile for bounded saved-evidence remediation: load skills/blueprint-review/references/audit-fix-runtime-contract.md, resolve the phase and artifact inventory, let blueprint_review_scope own the repo-file scope, classify only selected saved evidence, keep --source, --severity, --max, --dry-run, mutation confirmation, report overwrite, optional todo capture, active stage, and early-stop state explicit, use blueprint-reviewer only for bounded read-only classification and blueprint-verifier only for bounded post-fix verification, validate the structured report.audit-fix model through blueprint_artifact_report_validate_model, repair invalid diagnostics by exact path, code, repair, allowedValues, missing, argsPatch, and repairSummary guidance, reread authoring context when runtime context is stale or incomplete, persist it through blueprint_artifact_report_write, append confirmed todo follow-ups through blueprint_artifact_mutate_index, update state through blueprint_state_update, and stop with top diagnostics plus suggestedRepairs rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const REVIEW_RUNTIME_METADATA = {
  commandName: "review",
  sourceId: runtimeMetadataSourceId("review"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-review",
    declaredStatus: "implemented",
    risk: "Medium: external reviewer orchestration without default repo mutation."
  },
  requiredTools: REVIEW_REQUIRED_TOOLS,
  optionalAgents: REVIEW_OPTIONAL_AGENTS,
  requiredInputPaths: [REVIEW_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("review"),
    title: "`/blu-review`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`review` orchestrates bounded peer review from saved phase plans and evidence, preserves reviewer availability and disagreement honestly, and persists the peer-review artifact through review MCP tools.",
    reads: [
      "Phase resolution, artifact inventory, saved phase plans, saved execution summaries, execution targets, and peer-review authoring context through MCP tools."
    ],
    writes: ["phase XX-REVIEWS.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("review"),
    waveTitle: "Quality, Shipping, Docs, And Maintenance",
    command: "review",
    primarySkill: "blueprint-review",
    exactMcpDestination: REVIEW_REQUIRED_TOOLS,
    optionalAgents: REVIEW_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile for saved-plan peer review: load skills/blueprint-review/references/review-runtime-contract.md, resolve the phase and artifact inventory, read only selected phase plans and related summaries through MCP, keep requested reviewers, available and unavailable reviewers, reviewer-availability gates, overwrite confirmation, disagreement posture, execution mode, active stage, and next safe action explicit, use blueprint-reviewer only for bounded packet and synthesis quality checks, validate the structured review.peer-review model through blueprint_review_validate_model, persist it through blueprint_review_record, preserve partial reviewer coverage honestly, and stop rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const UI_REVIEW_RUNTIME_METADATA = {
  commandName: "ui-review",
  sourceId: runtimeMetadataSourceId("ui-review"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-review",
    declaredStatus: "implemented",
    risk: "Low: review artifact only."
  },
  requiredTools: UI_REVIEW_REQUIRED_TOOLS,
  optionalAgents: UI_REVIEW_OPTIONAL_AGENTS,
  requiredInputPaths: [UI_REVIEW_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("ui-review"),
    title: "`/blu-ui-review`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`ui-review` audits shipped UI work against saved execution and UI-spec evidence, optionally delegates bounded six-pillar analysis, and persists the UI-review artifact through review MCP tools.",
    reads: [
      "Phase resolution, artifact inventory, saved execution and UI-spec evidence, and UI-review authoring context through MCP tools."
    ],
    writes: ["phase XX-UI-REVIEW.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("ui-review"),
    waveTitle: "Quality, Shipping, Docs, And Maintenance",
    command: "ui-review",
    primarySkill: "blueprint-review",
    exactMcpDestination: UI_REVIEW_REQUIRED_TOOLS,
    optionalAgents: UI_REVIEW_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile for phase-scoped UI audit: load skills/blueprint-review/references/ui-review-runtime-contract.md, resolve the phase and artifact inventory, read review.ui-review through blueprint_artifact_contract_read, keep saved execution evidence, UI-spec coverage, visual-evidence limits, overwrite confirmation, inline versus blueprint-ui-auditor execution mode, scored findings posture, active stage, and next safe action explicit, use blueprint-ui-auditor only for bounded UI/code analysis when available, validate the structured review.ui-review model through blueprint_review_validate_model, persist it through blueprint_review_record, and stop rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const ADD_TESTS_RUNTIME_METADATA = {
  commandName: "add-tests",
  sourceId: runtimeMetadataSourceId("add-tests"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-phase-validation",
    declaredStatus: "implemented",
    risk: "High: repo test mutation plus verification/report updates."
  },
  requiredTools: ADD_TESTS_REQUIRED_TOOLS,
  optionalAgents: ADD_TESTS_OPTIONAL_AGENTS,
  requiredInputPaths: [ADD_TESTS_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("add-tests"),
    title: "`/blu-add-tests`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`add-tests` generates focused repo tests from saved phase evidence and persists validation plus report artifacts through MCP tools.",
    reads: [
      "Saved summaries, validation or UAT evidence, artifact inventory, report authoring context, and state through MCP tools."
    ],
    writes: [
      "repo test files",
      "phase XX-VERIFICATION.md",
      ".blueprint/reports/add-tests-<phase>.md",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("add-tests"),
    waveTitle: "Quality, Shipping, Docs, And Maintenance",
    command: "add-tests",
    primarySkill: "blueprint-phase-validation",
    exactMcpDestination: ADD_TESTS_REQUIRED_TOOLS,
    optionalAgents: ADD_TESTS_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard", "workflow advisory"],
    contractNotes:
      "Long-running-mutation profile for evidence-backed test generation; keep repo mutation scoped to selected tests and persist validation/report evidence through MCP tools.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const DOCS_UPDATE_RUNTIME_METADATA = {
  commandName: "docs-update",
  sourceId: runtimeMetadataSourceId("docs-update"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-docs",
    declaredStatus: "implemented",
    risk: "Medium: writes selected repo documentation files and a durable docs-update report."
  },
  requiredTools: DOCS_UPDATE_REQUIRED_TOOLS,
  optionalAgents: DOCS_UPDATE_OPTIONAL_AGENTS,
  requiredInputPaths: [DOCS_UPDATE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("docs-update"),
    title: "`/blu-docs-update`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`docs-update` refreshes or verifies selected repo documentation against saved Blueprint and repo evidence, optionally checks current external truth, and persists the durable docs-update report through MCP.",
    reads: [
      "Project health, artifact inventory, selected repo documentation, source files, tests, saved Blueprint artifacts, digest inputsUsed, and optional cited external truth."
    ],
    writes: [
      "selected repo documentation files when not verify-only",
      ".blueprint/reports/docs-update-latest.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("docs-update"),
    waveTitle: "Quality And Shipping",
    command: "docs-update",
    primarySkill: "blueprint-docs",
    exactMcpDestination: DOCS_UPDATE_REQUIRED_TOOLS,
    optionalAgents: DOCS_UPDATE_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile for scoped repo documentation refresh or verification: load commands/blu-docs-update.toml and skills/blueprint-docs/references/docs-update-runtime-contract.md, resolve a narrow doc scope before drafting, keep repo truth from selected docs, source files, tests, saved Blueprint artifacts, digest inputsUsed, and optional cited external truth separate, keep --verify-only read-only for repo docs while still allowing the durable report, gate broad scope, doc replacement, and report replacement unless --force already supplies approval, use blueprint-doc-writer and blueprint-doc-verifier only for bounded docs passes when available, persist the report through blueprint_artifact_report_write with bare reportName docs-update-latest, keep Blueprint persistence inside .blueprint/reports/, and route only to implemented follow-ups such as /blu-map-codebase or /blu-progress.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const IMPACT_RUNTIME_METADATA = {
  commandName: "impact",
  sourceId: runtimeMetadataSourceId("impact"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-impact",
    declaredStatus: "implemented",
    risk:
      "Low: advisory blast-radius report writes only under .blueprint/impact/."
  },
  requiredTools: IMPACT_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [IMPACT_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("impact"),
    title: "`/blu-impact`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`impact` performs advisory blast-radius analysis for a resolved change scope, persists an impact report bundle when writing is enabled, and renders the requested output format through the impact MCP substrate.",
    reads: [
      "impact config, resolved scope, source files, runtime metadata, Blueprint artifacts, ownership or dependency metadata, PR or deployment context, and command catalog state as read-only evidence"
    ],
    writes: [
      ".blueprint/impact/<impact-id>/ only through blueprint_impact_report_write when writing is enabled"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("impact"),
    waveTitle: "Quality And Shipping",
    command: "impact",
    primarySkill: "blueprint-impact",
    exactMcpDestination: IMPACT_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Long-running-mutation profile for advisory blast-radius analysis with no subagents. Load skills/blueprint-impact/references/impact-runtime-contract.md, resolve scope through the impact MCP tools, keep source files, runtime files, PR metadata, deployment state, and command-catalog state read-only, persist impact bundles only through blueprint_impact_report_write under .blueprint/impact/<impact-id>/, render final human, JSON, Markdown, PR-comment, or summary output only through blueprint_impact_output_render, treat BLOCK as advisory rather than permission to mutate non-impact state, and route follow-up guidance only to implemented commands.",
    evidenceState: ["locked", "runtime-owned", "behavior-audited"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const PAUSE_WORK_RUNTIME_METADATA = {
  commandName: "pause-work",
  sourceId: runtimeMetadataSourceId("pause-work"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-governance",
    declaredStatus: "implemented",
    risk: "Low: writes handoff and state artifacts only."
  },
  requiredTools: PAUSE_WORK_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [PAUSE_WORK_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("pause-work"),
    title: "`/blu-pause-work`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`pause-work` records a canonical handoff from current Blueprint state and artifact inventory.",
    reads: [
      "Current state, artifact inventory, and existing pause handoff state through MCP."
    ],
    writes: [".blueprint/reports/pause-work-latest.md", ".blueprint/STATE.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("pause-work"),
    waveTitle: "Core Lifecycle",
    command: "pause-work",
    primarySkill: "blueprint-governance",
    exactMcpDestination: PAUSE_WORK_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for canonical handoff capture: load skills/blueprint-governance/references/pause-work-runtime-contract.md, read state and artifact inventory through MCP, compare existing handoff state before overwrite where relevant, persist only through blueprint_pause_handoff_write and blueprint_state_update, and route follow-ups only to implemented commands.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const RESUME_WORK_RUNTIME_METADATA = {
  commandName: "resume-work",
  sourceId: runtimeMetadataSourceId("resume-work"),
  catalog: {
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-governance",
    declaredStatus: "implemented",
    risk:
      "Low: restores state from the canonical pause handoff and updates the next safe action."
  },
  requiredTools: RESUME_WORK_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [RESUME_WORK_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("resume-work"),
    title: "`/blu-resume-work`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`resume-work` restores working context from the canonical pause handoff and records the next safe action.",
    reads: [
      "Project status, current state, artifact inventory, and canonical pause handoff through MCP."
    ],
    writes: [".blueprint/STATE.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("resume-work"),
    waveTitle: "Core Lifecycle",
    command: "resume-work",
    primarySkill: "blueprint-governance",
    exactMcpDestination: RESUME_WORK_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for handoff restoration: load skills/blueprint-governance/references/resume-work-runtime-contract.md, read project status, state, artifacts, and canonical pause handoff through MCP, restore only from the canonical handoff, persist next safe action through blueprint_state_update, and route follow-ups only to implemented commands.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const PR_BRANCH_RUNTIME_METADATA = {
  commandName: "pr-branch",
  sourceId: runtimeMetadataSourceId("pr-branch"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-maintenance",
    declaredStatus: "implemented",
    risk: "High: git branch mutation."
  },
  requiredTools: PR_BRANCH_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [PR_BRANCH_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("pr-branch"),
    title: "`/blu-pr-branch`",
    executionProfile: "high-risk-maintenance",
    rootRoutable: true,
    purpose:
      "`pr-branch` prepares a clean review branch by filtering Blueprint bookkeeping scope and persists a durable report.",
    reads: [
      "Project health, effective git config, active diff, artifact digest scope, and report contract through MCP plus git inspection."
    ],
    writes: [".blueprint/reports/pr-branch-latest.md", "confirmed git branch"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("pr-branch"),
    waveTitle: "Quality And Shipping",
    command: "pr-branch",
    primarySkill: "blueprint-maintenance",
    exactMcpDestination: PR_BRANCH_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/pr-branch-runtime-contract.md, require a clean tree and review-branch confirmation before git mutation, default to excluding .blueprint/** bookkeeping when configured, persist only the durable report through blueprint_artifact_report_write, and route follow-ups only to implemented commands or manual git/PR steps.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const SHIP_RUNTIME_METADATA = {
  commandName: "ship",
  sourceId: runtimeMetadataSourceId("ship"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-maintenance",
    declaredStatus: "implemented",
    risk: "High: remote and git mutation path."
  },
  requiredTools: SHIP_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [SHIP_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("ship"),
    title: "`/blu-ship`",
    executionProfile: "high-risk-maintenance",
    rootRoutable: true,
    purpose:
      "`ship` prepares a confirmation-gated shipping run from saved Blueprint evidence and records actual push or PR outcomes.",
    reads: [
      "Project health, optional phase metadata, effective config, saved evidence, artifact digest scope, and report contract through MCP plus git/gh inspection."
    ],
    writes: [
      ".blueprint/reports/ship-latest.md",
      ".blueprint/STATE.md when routing changes",
      "approved git remote or PR state"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("ship"),
    waveTitle: "Quality And Shipping",
    command: "ship",
    primarySkill: "blueprint-maintenance",
    exactMcpDestination: SHIP_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/ship-runtime-contract.md, keep local prep, push, and PR creation as separate approved steps, write the approved plan before mutation, overwrite ship-latest after actual outcomes, and keep manual fallback durable when remote tooling is unavailable.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const UNDO_RUNTIME_METADATA = {
  commandName: "undo",
  sourceId: runtimeMetadataSourceId("undo"),
  catalog: {
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-maintenance",
    declaredStatus: "implemented",
    risk:
      "High: intentionally destructive history-rewrite-adjacent workflow using safe revert-style steps."
  },
  requiredTools: UNDO_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [UNDO_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("undo"),
    title: "`/blu-undo`",
    executionProfile: "high-risk-maintenance",
    rootRoutable: true,
    purpose:
      "`undo` previews a bounded revert, persists a durable undo report, and runs only confirmed safe revert-style git steps.",
    reads: [
      "Project health, optional phase metadata, affected artifacts, artifact digest scope, and report contract through MCP plus git history inspection."
    ],
    writes: [
      ".blueprint/reports/undo-latest.md",
      ".blueprint/STATE.md when routing changes",
      "approved git revert commits"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("undo"),
    waveTitle: "Quality And Shipping",
    command: "undo",
    primarySkill: "blueprint-maintenance",
    exactMcpDestination: UNDO_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/undo-runtime-contract.md, hard-stop on dirty or unsafe git state, require undo confirmation, write undo-latest before mutation, run only safe git revert style steps, overwrite undo-latest with actual outcome, and update state only after a successful revert changes routing.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const NEW_WORKSPACE_RUNTIME_METADATA = {
  commandName: "new-workspace",
  sourceId: runtimeMetadataSourceId("new-workspace"),
  catalog: {
    wave: 5,
    family: "Workspace And Maintenance",
    primarySkill: "blueprint-maintenance",
    declaredStatus: "implemented",
    risk:
      "High: filesystem and git worktree mutation outside the current repo."
  },
  requiredTools: NEW_WORKSPACE_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [NEW_WORKSPACE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("new-workspace"),
    title: "`/blu-new-workspace`",
    executionProfile: "high-risk-maintenance",
    rootRoutable: true,
    purpose:
      "`new-workspace` creates a confirmed multi-repo workspace and records it in host-global Blueprint workspace state.",
    reads: [
      "Effective config, host-global workspace registry, source repo status, and target path preflight."
    ],
    writes: [
      "workspace manifest under the selected workspace",
      "~/.<host>/blueprint/workspaces registry"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("new-workspace"),
    waveTitle: "Workspace And Maintenance",
    command: "new-workspace",
    primarySkill: "blueprint-maintenance",
    exactMcpDestination: NEW_WORKSPACE_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [],
    contractNotes:
      "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/new-workspace-runtime-contract.md, derive workspace root from config or explicit input, stop on dirty sources or conflicts, require new-workspace-confirmation, and persist only through blueprint_workspace_create and the host-global registry it owns.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const REMOVE_WORKSPACE_RUNTIME_METADATA = {
  commandName: "remove-workspace",
  sourceId: runtimeMetadataSourceId("remove-workspace"),
  catalog: {
    wave: 5,
    family: "Workspace And Maintenance",
    primarySkill: "blueprint-maintenance",
    declaredStatus: "implemented",
    risk:
      "High: confirmation-gated workspace teardown and registry cleanup."
  },
  requiredTools: REMOVE_WORKSPACE_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [REMOVE_WORKSPACE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("remove-workspace"),
    title: "`/blu-remove-workspace`",
    executionProfile: "high-risk-maintenance",
    rootRoutable: true,
    purpose:
      "`remove-workspace` tears down an exact confirmed workspace and updates the host-global workspace registry.",
    reads: [
      "Host-global workspace registry, workspace manifest, recorded repo members, and dirty-tree preflight."
    ],
    writes: [
      "workspace teardown on disk",
      "~/.<host>/blueprint/workspaces registry"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("remove-workspace"),
    waveTitle: "Workspace And Maintenance",
    command: "remove-workspace",
    primarySkill: "blueprint-maintenance",
    exactMcpDestination: REMOVE_WORKSPACE_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [],
    contractNotes:
      "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/remove-workspace-runtime-contract.md, resolve a single registry-backed workspace target, stop on ambiguity, drift, or dirty members, require remove-workspace-confirmation, and persist teardown only through blueprint_workspace_remove.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const WORKSTREAMS_RUNTIME_METADATA = {
  commandName: "workstreams",
  sourceId: runtimeMetadataSourceId("workstreams"),
  catalog: {
    wave: 5,
    family: "Workspace And Maintenance",
    primarySkill: "blueprint-maintenance",
    declaredStatus: "implemented",
    risk:
      "Medium: project-local state mutation with switching semantics."
  },
  requiredTools: WORKSTREAMS_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [WORKSTREAMS_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("workstreams"),
    title: "`/blu-workstreams`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`workstreams` lists, creates, switches, resumes, or completes project-local Blueprint workstreams through MCP-owned state.",
    reads: ["Project-local workstream index and saved per-stream state."],
    writes: [
      ".blueprint/workstreams/WORKSTREAMS.md",
      ".blueprint/workstreams/<slug>/state.json",
      ".blueprint/STATE.md for returned resume patches"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("workstreams"),
    waveTitle: "Workspace And Maintenance",
    command: "workstreams",
    primarySkill: "blueprint-maintenance",
    exactMcpDestination: WORKSTREAMS_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/workstreams-runtime-contract.md, keep read-only operations on blueprint_workstream_list, require explicit targets and switch/archive confirmation gates before mutation, persist workstream changes only through blueprint_workstream_mutate, and apply returned resume statePatch only through blueprint_state_update.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const CLEANUP_RUNTIME_METADATA = {
  commandName: "cleanup",
  sourceId: runtimeMetadataSourceId("cleanup"),
  catalog: {
    wave: 5,
    family: "Workspace And Maintenance",
    primarySkill: "blueprint-maintenance",
    declaredStatus: "implemented",
    risk:
      "High: confirmation-gated phase-directory archival and removal behavior."
  },
  requiredTools: CLEANUP_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [CLEANUP_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("cleanup"),
    title: "`/blu-cleanup`",
    executionProfile: "high-risk-maintenance",
    rootRoutable: true,
    purpose:
      "`cleanup` archives completed Blueprint phase directories through a protected-scope confirmation flow and persists a durable cleanup report.",
    reads: [
      "Project health, roadmap references, artifact inventory, cleanup evidence digest, and filesystem preflight."
    ],
    writes: [
      ".blueprint/reports/cleanup-latest.md",
      ".blueprint/STATE.md when routing changes",
      "confirmed phase archive destination"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("cleanup"),
    waveTitle: "Workspace And Maintenance",
    command: "cleanup",
    primarySkill: "blueprint-maintenance",
    exactMcpDestination: CLEANUP_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/cleanup-runtime-contract.md, protect the current phase and active roadmap references, require cleanup and destination confirmations before filesystem mutation, write cleanup-latest before archival, and update state only after successful approved archival.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const UPDATE_RUNTIME_METADATA = {
  commandName: "update",
  sourceId: runtimeMetadataSourceId("update"),
  catalog: {
    wave: 5,
    family: "Workspace And Maintenance",
    primarySkill: "blueprint-maintenance",
    declaredStatus: "implemented",
    risk:
      "Low: advisory only; no in-session self-update."
  },
  requiredTools: UPDATE_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [UPDATE_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("update"),
    title: "`/blu-update`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`update` inspects the installed Blueprint extension and prepares an advisory out-of-band update checklist.",
    reads: [
      "Host, installed extension path, installed version, provenance, latest-version lookup status, and warnings."
    ],
    writes: ["~/.<host>/blueprint/updates/ when checklist persistence is chosen"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("update"),
    waveTitle: "Workspace And Maintenance",
    command: "update",
    primarySkill: "blueprint-maintenance",
    exactMcpDestination: UPDATE_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [],
    contractNotes:
      "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/update-runtime-contract.md, keep installed extension handling read-only, use update-mode-gate for saved checklist versus manual fallback, persist only through blueprint_update_plan under host-global update state, and always end with restart guidance.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const REAPPLY_PATCHES_RUNTIME_METADATA = {
  commandName: "reapply-patches",
  sourceId: runtimeMetadataSourceId("reapply-patches"),
  catalog: {
    wave: 5,
    family: "Workspace And Maintenance",
    primarySkill: "blueprint-maintenance",
    declaredStatus: "implemented",
    risk:
      "High: confirmation-gated patch replay across repo files."
  },
  requiredTools: REAPPLY_PATCHES_REQUIRED_TOOLS,
  optionalAgents: [],
  requiredInputPaths: [REAPPLY_PATCHES_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("reapply-patches"),
    title: "`/blu-reapply-patches`",
    executionProfile: "high-risk-maintenance",
    rootRoutable: true,
    purpose:
      "`reapply-patches` previews, confirms, replays, and records host-global Blueprint patch reapplication.",
    reads: [
      "Host-global patch registry, selected patch manifests, target compatibility, and dry-run replay result."
    ],
    writes: [
      "approved git patch replay",
      "~/.<host>/blueprint/patches replay audit"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("reapply-patches"),
    waveTitle: "Workspace And Maintenance",
    command: "reapply-patches",
    primarySkill: "blueprint-maintenance",
    exactMcpDestination: REAPPLY_PATCHES_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [],
    contractNotes:
      "Docless manifest+skill-owned runtime: load skills/blueprint-maintenance/references/reapply-patches-runtime-contract.md, list patches first, dry-run the exact replay set through blueprint_patch_reapply, stop on dirty or incompatible targets, require reapply-patches-confirmation, replay only the previewed patch ids, and record the outcome through blueprint_patch_record.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const NOTE_RUNTIME_METADATA = {
  commandName: "note",
  sourceId: runtimeMetadataSourceId("note"),
  catalog: {
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-capture",
    declaredStatus: "implemented",
    risk: "Low: note capture only."
  },
  requiredTools: NOTE_REQUIRED_TOOLS,
  optionalAgents: [],
  spec: {
    path: runtimeMetadataSourceId("note"),
    title: "`/blu-note`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`note` appends explicit project-local notes through the capture index MCP tool while keeping unsupported list, promote, and global-note asks in safe suggestion mode.",
    reads: ["User-provided note text and duplicate state through MCP."],
    writes: [".blueprint/notes/NOTES.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("note"),
    waveTitle: "Capture And Lightweight Execution",
    command: "note",
    primarySkill: "blueprint-capture",
    exactMcpDestination: NOTE_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for deterministic project-local note capture: require explicit note text, persist only through blueprint_artifact_mutate_index, treat duplicate results and returned ids as authoritative, keep unsupported list, promote, and global-note behavior in safe suggestion mode, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const ADD_TODO_RUNTIME_METADATA = {
  commandName: "add-todo",
  sourceId: runtimeMetadataSourceId("add-todo"),
  catalog: {
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-capture",
    declaredStatus: "implemented",
    risk: "Low: todo index update only."
  },
  requiredTools: ADD_TODO_REQUIRED_TOOLS,
  optionalAgents: [],
  spec: {
    path: runtimeMetadataSourceId("add-todo"),
    title: "`/blu-add-todo`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`add-todo` appends explicit project-local todo items through the capture index MCP tool.",
    reads: ["User-provided todo text and duplicate state through MCP."],
    writes: [".blueprint/todos/TODO.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("add-todo"),
    waveTitle: "Capture And Lightweight Execution",
    command: "add-todo",
    primarySkill: "blueprint-capture",
    exactMcpDestination: ADD_TODO_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for short project-local todo capture: require an explicit description, persist append-only todo entries through blueprint_artifact_mutate_index, report duplicates using returned matching ids instead of creating a second copy, route missing projects and follow-ups only through implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const CHECK_TODOS_RUNTIME_METADATA = {
  commandName: "check-todos",
  sourceId: runtimeMetadataSourceId("check-todos"),
  catalog: {
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-capture",
    declaredStatus: "implemented",
    risk: "Low: todo selection and status update only."
  },
  requiredTools: CHECK_TODOS_REQUIRED_TOOLS,
  optionalAgents: [],
  spec: {
    path: runtimeMetadataSourceId("check-todos"),
    title: "`/blu-check-todos`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`check-todos` inspects pending project-local todos and can mark one active or completed through bounded MCP updates.",
    reads: [
      "Project readiness and todo queue state through Blueprint MCP tools."
    ],
    writes: [".blueprint/todos/TODO.md when status changes are confirmed"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("check-todos"),
    waveTitle: "Capture And Lightweight Execution",
    command: "check-todos",
    primarySkill: "blueprint-capture",
    exactMcpDestination: CHECK_TODOS_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for deterministic todo inspection and bounded status changes: read blueprint_project_status first, list or update todos only through blueprint_artifact_mutate_index, require explicit confirmation before marking active or completed unless intent is unmistakable, prefer exact ids for updates, report duplicate or reopened-active behavior from MCP results, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const ADD_BACKLOG_RUNTIME_METADATA = {
  commandName: "add-backlog",
  sourceId: runtimeMetadataSourceId("add-backlog"),
  catalog: {
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-capture",
    declaredStatus: "implemented",
    risk: "Low: backlog append plus optional stub scaffold."
  },
  requiredTools: ADD_BACKLOG_REQUIRED_TOOLS,
  optionalAgents: [],
  spec: {
    path: runtimeMetadataSourceId("add-backlog"),
    title: "`/blu-add-backlog`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`add-backlog` appends explicit parking-lot ideas and can reserve a confirmed 999.x phase stub through MCP-owned capture and scaffold writes.",
    reads: ["User-provided backlog text and duplicate state through MCP."],
    writes: [
      ".blueprint/backlog/BACKLOG.md",
      "optional .blueprint/phases/999.x-*/ context stub"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("add-backlog"),
    waveTitle: "Capture And Lightweight Execution",
    command: "add-backlog",
    primarySkill: "blueprint-capture",
    exactMcpDestination: ADD_BACKLOG_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for parking-lot capture: require explicit backlog text, persist append-only entries through blueprint_artifact_mutate_index, reserve a 999.x phase stub only behind an explicit confirmation gate, scaffold only returned reserved paths through blueprint_artifact_scaffold, report duplicate backlog ids instead of creating a second copy, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const REVIEW_BACKLOG_RUNTIME_METADATA = {
  commandName: "review-backlog",
  sourceId: runtimeMetadataSourceId("review-backlog"),
  catalog: {
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-capture",
    declaredStatus: "implemented",
    risk: "Medium: can promote backlog items into active roadmap scope."
  },
  requiredTools: REVIEW_BACKLOG_REQUIRED_TOOLS,
  optionalAgents: [],
  spec: {
    path: runtimeMetadataSourceId("review-backlog"),
    title: "`/blu-review-backlog`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`review-backlog` previews canonical backlog entries, promotes or archives confirmed items, and records the next safe state through MCP-owned transitions.",
    reads: ["Canonical backlog preview through Blueprint MCP tools."],
    writes: [
      ".blueprint/backlog/BACKLOG.md",
      ".blueprint/ROADMAP.md",
      ".blueprint/phases/<phase>/",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("review-backlog"),
    waveTitle: "Capture And Lightweight Execution",
    command: "review-backlog",
    primarySkill: "blueprint-capture",
    exactMcpDestination: REVIEW_BACKLOG_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for deterministic backlog review: preview through blueprint_roadmap_promote_backlog before decisions, require explicit promote or archive confirmation while keep remains the safe default, promote only confirmed ids through roadmap MCP, persist promoted or archived status transitions through blueprint_artifact_mutate_index instead of deleting history, update state with implemented-only follow-ups, preserve reserved-stub reuse from MCP results, and do not use update_topic, write_todos, task trackers, or long-running progress posture.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const EXPLORE_RUNTIME_METADATA = {
  commandName: "explore",
  sourceId: runtimeMetadataSourceId("explore"),
  catalog: {
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-capture",
    declaredStatus: "implemented",
    risk:
      "Medium: ideation-first, but confirmed roadmap promotion can append a new active phase."
  },
  requiredTools: EXPLORE_REQUIRED_TOOLS,
  optionalAgents: EXPLORE_OPTIONAL_AGENTS,
  spec: {
    path: runtimeMetadataSourceId("explore"),
    title: "`/blu-explore`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`explore` briefly classifies an idea into note, todo, backlog, roadmap, or no-write and persists only the explicitly confirmed target through MCP tools.",
    reads: [
      "Project readiness, user-provided idea text, and optional bounded researcher context."
    ],
    writes: [
      "confirmed target only: .blueprint/notes/NOTES.md, .blueprint/todos/TODO.md, .blueprint/backlog/BACKLOG.md, or .blueprint/ROADMAP.md plus scaffolded phase context"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("explore"),
    waveTitle: "Capture And Lightweight Execution",
    command: "explore",
    primarySkill: "blueprint-capture",
    exactMcpDestination: EXPLORE_REQUIRED_TOOLS,
    optionalAgents: EXPLORE_OPTIONAL_AGENTS,
    hookInvolvement: ["read-before-edit", ".blueprint write guard"],
    contractNotes:
      "Docless manifest+skill-owned runtime for short ideation routing: require explicit idea text, read blueprint_project_status first, classify exactly one target among note, todo, backlog, roadmap, and no-write, use blueprint-researcher only for bounded context checks that materially affect routing, require explicit routing confirmation before persistence, write note/todo/backlog targets through blueprint_artifact_mutate_index with duplicate handling, append roadmap work through blueprint_roadmap_add_phase and scaffold only returned context paths, route follow-ups only to implemented commands, and do not use update_topic, write_todos, task trackers, or long-running progress posture.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const QUICK_RUNTIME_METADATA = {
  commandName: "quick",
  sourceId: runtimeMetadataSourceId("quick"),
  catalog: {
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-phase-execution",
    declaredStatus: "implemented",
    risk: "High: can execute repo changes with reduced ceremony."
  },
  requiredTools: QUICK_REQUIRED_TOOLS,
  optionalAgents: QUICK_OPTIONAL_AGENTS,
  spec: {
    path: runtimeMetadataSourceId("quick"),
    title: "`/blu-quick`",
    executionProfile: "long-running-mutation",
    rootRoutable: true,
    purpose:
      "`quick` runs bounded quick delivery with optional depth gates, persists durable quick-run evidence, and routes follow-up through implemented Blueprint commands.",
    reads: [
      "project status, command availability, and current next-step posture through MCP"
    ],
    writes: ["quick-run report in .blueprint/reports/", ".blueprint/STATE.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("quick"),
    waveTitle: "Capture And Lightweight Execution",
    command: "quick",
    primarySkill: "blueprint-phase-execution",
    exactMcpDestination: QUICK_REQUIRED_TOOLS,
    optionalAgents: QUICK_OPTIONAL_AGENTS,
    hookInvolvement: [
      "read-before-edit",
      ".blueprint write guard",
      "workflow advisory"
    ],
    contractNotes:
      "Long-running-mutation profile for non-trivial bounded quick runs; keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, require explicit opt-in for deeper discuss, research, or validation passes, treat branchy quick work as tracker-eligible session-local coordination paired with visible todos, persist durable quick-run evidence through blueprint_artifact_report_write using the canonical quick-run-latest report name, and do not let quick impersonate saved planning or broad lifecycle execution. The rich command-local contract lives in skills/blueprint-phase-execution/references/quick-runtime-contract.md.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const DEBUG_RUNTIME_METADATA = {
  commandName: "debug",
  sourceId: runtimeMetadataSourceId("debug"),
  catalog: {
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-debug",
    declaredStatus: "implemented",
    risk: "Medium: exploratory shell commands and test runs are likely."
  },
  requiredTools: DEBUG_REQUIRED_TOOLS,
  optionalAgents: ["blueprint-debugger"],
  requiredInputPaths: ["commands/blu-debug.toml", DEBUG_SPEC_PATH],
  spec: {
    path: runtimeMetadataSourceId("debug"),
    title: "`/blu-debug`",
    executionProfile: "interactive-read -> long-running-mutation when non-trivial",
    rootRoutable: true,
    purpose:
      "`debug` investigates a concrete issue, persists a durable debug-latest report, and stops at an explicit follow-up gate before todo capture or fix attempts.",
    reads: [
      "project status, user-provided issue evidence, relevant local files, command outputs, and prior debug-latest report content when continuing"
    ],
    writes: [
      ".blueprint/reports/debug-latest.md",
      "optional explicit follow-up todo through .blueprint/todos/TODO.md",
      ".blueprint/STATE.md"
    ]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("debug"),
    waveTitle: "Capture And Lightweight Execution",
    command: "debug",
    primarySkill: "blueprint-debug",
    exactMcpDestination: DEBUG_REQUIRED_TOOLS,
    optionalAgents: ["blueprint-debugger"],
    hookInvolvement: [
      "read-before-edit",
      ".blueprint write guard",
      "workflow advisory"
    ],
    contractNotes:
      "Interactive-read profile for evidence-backed investigations that can stay concise; long-running-mutation profile only for non-trivial investigations. Load commands/blu-debug.toml plus skills/blueprint-debug/references/debug-runtime-contract.md, require a concrete issue statement and initialized Blueprint state before durable persistence, keep --diagnose honest as diagnose-only until the user confirms a fix attempt, use update_topic and write_todos only as session-local visibility for non-trivial investigations, persist the durable report through blueprint_artifact_report_write with the bare debug-latest name and treat returned paths and ids as authoritative, require overwrite confirmation before replacing an existing report, capture persisted todos only after an explicit user ask or confirmation through blueprint_artifact_mutate_index, update state through blueprint_state_update, route implemented follow-ups only to /blu-quick, /blu-plan-phase, /blu-validate-phase, or /blu-progress, and do not hide state or perform broad direct fixes inside debug.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const FAST_RUNTIME_METADATA = {
  commandName: "fast",
  sourceId: runtimeMetadataSourceId("fast"),
  catalog: {
    wave: 3,
    family: "Capture And Lightweight Execution",
    primarySkill: "blueprint-phase-execution",
    declaredStatus: "implemented",
    risk: "Medium: minimal-planning repo mutation path."
  },
  requiredTools: FAST_REQUIRED_TOOLS,
  optionalAgents: [],
  spec: {
    path: runtimeMetadataSourceId("fast"),
    title: "`/blu-fast`",
    executionProfile: "interactive-read",
    rootRoutable: true,
    purpose:
      "`fast` handles genuinely trivial inline execution without subagents, durable reports, or phase artifacts.",
    reads: ["project status through MCP when useful"],
    writes: ["optional .blueprint/STATE.md"]
  },
  runtimeReference: {
    path: runtimeMetadataSourceId("fast"),
    waveTitle: "Capture And Lightweight Execution",
    command: "fast",
    primarySkill: "blueprint-phase-execution",
    exactMcpDestination: FAST_REQUIRED_TOOLS,
    optionalAgents: [],
    hookInvolvement: [
      "read-before-edit",
      ".blueprint write guard",
      "workflow advisory"
    ],
    contractNotes:
      "Interactive-read profile for trivial inline execution: keep the ask genuinely small, explicitly exclude tracker-backed branching plus update_topic or write_todos long-running visibility, refuse report-backed or subagent depth, update STATE.md only when Blueprint is initialized, do not create quick-run reports, phase summaries, phase artifacts, or other durable execution evidence, and route anything larger to quick or phase planning. The rich command-local contract lives in skills/blueprint-phase-execution/references/fast-runtime-contract.md.",
    evidenceState: ["locked", "runtime-owned", "needs-behavior-audit"]
  }
} as const satisfies RuntimeOwnedCommandMetadata;

export const RUNTIME_OWNED_COMMAND_METADATA = {
  [NEW_PROJECT_RUNTIME_METADATA.commandName]: NEW_PROJECT_RUNTIME_METADATA,
  [ADD_PHASE_RUNTIME_METADATA.commandName]: ADD_PHASE_RUNTIME_METADATA,
  [INSERT_PHASE_RUNTIME_METADATA.commandName]: INSERT_PHASE_RUNTIME_METADATA,
  [REMOVE_PHASE_RUNTIME_METADATA.commandName]: REMOVE_PHASE_RUNTIME_METADATA,
  [PLAN_MILESTONE_GAPS_RUNTIME_METADATA.commandName]:
    PLAN_MILESTONE_GAPS_RUNTIME_METADATA,
  [AUDIT_MILESTONE_RUNTIME_METADATA.commandName]: AUDIT_MILESTONE_RUNTIME_METADATA,
  [COMPLETE_MILESTONE_RUNTIME_METADATA.commandName]:
    COMPLETE_MILESTONE_RUNTIME_METADATA,
  [MILESTONE_SUMMARY_RUNTIME_METADATA.commandName]:
    MILESTONE_SUMMARY_RUNTIME_METADATA,
  [NEW_MILESTONE_RUNTIME_METADATA.commandName]: NEW_MILESTONE_RUNTIME_METADATA,
  [HELP_RUNTIME_METADATA.commandName]: HELP_RUNTIME_METADATA,
  [PROGRESS_RUNTIME_METADATA.commandName]: PROGRESS_RUNTIME_METADATA,
  [NEXT_RUNTIME_METADATA.commandName]: NEXT_RUNTIME_METADATA,
  [MAP_CODEBASE_RUNTIME_METADATA.commandName]: MAP_CODEBASE_RUNTIME_METADATA,
  [SETTINGS_RUNTIME_METADATA.commandName]: SETTINGS_RUNTIME_METADATA,
  [SET_PROFILE_RUNTIME_METADATA.commandName]: SET_PROFILE_RUNTIME_METADATA,
  [HEALTH_RUNTIME_METADATA.commandName]: HEALTH_RUNTIME_METADATA,
  [DISCUSS_PHASE_RUNTIME_METADATA.commandName]: DISCUSS_PHASE_RUNTIME_METADATA,
  [PLAN_PHASE_RUNTIME_METADATA.commandName]: PLAN_PHASE_RUNTIME_METADATA,
  [RESEARCH_PHASE_RUNTIME_METADATA.commandName]: RESEARCH_PHASE_RUNTIME_METADATA,
  [UI_PHASE_RUNTIME_METADATA.commandName]: UI_PHASE_RUNTIME_METADATA,
  [EXECUTE_PHASE_RUNTIME_METADATA.commandName]: EXECUTE_PHASE_RUNTIME_METADATA,
  [LIST_PHASE_ASSUMPTIONS_RUNTIME_METADATA.commandName]:
    LIST_PHASE_ASSUMPTIONS_RUNTIME_METADATA,
  [VALIDATE_PHASE_RUNTIME_METADATA.commandName]: VALIDATE_PHASE_RUNTIME_METADATA,
  [VERIFY_WORK_RUNTIME_METADATA.commandName]: VERIFY_WORK_RUNTIME_METADATA,
  [CODE_REVIEW_RUNTIME_METADATA.commandName]: CODE_REVIEW_RUNTIME_METADATA,
  [CODE_REVIEW_FIX_RUNTIME_METADATA.commandName]: CODE_REVIEW_FIX_RUNTIME_METADATA,
  [SECURE_PHASE_RUNTIME_METADATA.commandName]: SECURE_PHASE_RUNTIME_METADATA,
  [AUDIT_FIX_RUNTIME_METADATA.commandName]: AUDIT_FIX_RUNTIME_METADATA,
  [REVIEW_RUNTIME_METADATA.commandName]: REVIEW_RUNTIME_METADATA,
  [UI_REVIEW_RUNTIME_METADATA.commandName]: UI_REVIEW_RUNTIME_METADATA,
  [ADD_TESTS_RUNTIME_METADATA.commandName]: ADD_TESTS_RUNTIME_METADATA,
  [DOCS_UPDATE_RUNTIME_METADATA.commandName]: DOCS_UPDATE_RUNTIME_METADATA,
  [IMPACT_RUNTIME_METADATA.commandName]: IMPACT_RUNTIME_METADATA,
  [PAUSE_WORK_RUNTIME_METADATA.commandName]: PAUSE_WORK_RUNTIME_METADATA,
  [RESUME_WORK_RUNTIME_METADATA.commandName]: RESUME_WORK_RUNTIME_METADATA,
  [PR_BRANCH_RUNTIME_METADATA.commandName]: PR_BRANCH_RUNTIME_METADATA,
  [SHIP_RUNTIME_METADATA.commandName]: SHIP_RUNTIME_METADATA,
  [UNDO_RUNTIME_METADATA.commandName]: UNDO_RUNTIME_METADATA,
  [NEW_WORKSPACE_RUNTIME_METADATA.commandName]: NEW_WORKSPACE_RUNTIME_METADATA,
  [REMOVE_WORKSPACE_RUNTIME_METADATA.commandName]: REMOVE_WORKSPACE_RUNTIME_METADATA,
  [WORKSTREAMS_RUNTIME_METADATA.commandName]: WORKSTREAMS_RUNTIME_METADATA,
  [CLEANUP_RUNTIME_METADATA.commandName]: CLEANUP_RUNTIME_METADATA,
  [UPDATE_RUNTIME_METADATA.commandName]: UPDATE_RUNTIME_METADATA,
  [REAPPLY_PATCHES_RUNTIME_METADATA.commandName]: REAPPLY_PATCHES_RUNTIME_METADATA,
  [NOTE_RUNTIME_METADATA.commandName]: NOTE_RUNTIME_METADATA,
  [ADD_TODO_RUNTIME_METADATA.commandName]: ADD_TODO_RUNTIME_METADATA,
  [CHECK_TODOS_RUNTIME_METADATA.commandName]: CHECK_TODOS_RUNTIME_METADATA,
  [ADD_BACKLOG_RUNTIME_METADATA.commandName]: ADD_BACKLOG_RUNTIME_METADATA,
  [REVIEW_BACKLOG_RUNTIME_METADATA.commandName]: REVIEW_BACKLOG_RUNTIME_METADATA,
  [EXPLORE_RUNTIME_METADATA.commandName]: EXPLORE_RUNTIME_METADATA,
  [QUICK_RUNTIME_METADATA.commandName]: QUICK_RUNTIME_METADATA,
  [DEBUG_RUNTIME_METADATA.commandName]: DEBUG_RUNTIME_METADATA,
  [FAST_RUNTIME_METADATA.commandName]: FAST_RUNTIME_METADATA
} as const;

export function listRuntimeOwnedCommandMetadata(): RuntimeOwnedCommandMetadata[] {
  return Object.values(RUNTIME_OWNED_COMMAND_METADATA);
}

export function getRuntimeOwnedCommandMetadata(
  commandName: string
): RuntimeOwnedCommandMetadata | null {
  return (
    RUNTIME_OWNED_COMMAND_METADATA[
      commandName as keyof typeof RUNTIME_OWNED_COMMAND_METADATA
    ] ?? null
  );
}

export function getRuntimeOwnedCommandMetadataBySourceId(
  sourceId: string | null
): RuntimeOwnedCommandMetadata | null {
  if (!sourceId) {
    return null;
  }

  return (
    Object.values(RUNTIME_OWNED_COMMAND_METADATA).find(
      (metadata) => metadata.sourceId === sourceId
    ) ?? null
  );
}
