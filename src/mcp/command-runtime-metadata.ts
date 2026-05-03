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

const PROGRESS_SPEC_PATH = "commands/blu-progress.toml";
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
const EXPLORE_OPTIONAL_AGENTS = ["blueprint-researcher"] as const;

function runtimeMetadataSourceId(commandName: string): string {
  return `${RUNTIME_METADATA_PATH}#${commandName}`;
}

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
      "Router profile; preserve read-only next-step guidance from MCP-owned project status, config, state, artifact inventory, and implemented command catalog.",
    evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
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
      "Long-running-mutation profile; validate saved summary evidence through the phase validation MCP substrate and route only to implemented follow-up commands.",
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
      "Long-running-mutation profile for bounded saved-evidence remediation: load skills/blueprint-review/references/audit-fix-runtime-contract.md, resolve the phase and artifact inventory, let blueprint_review_scope own the repo-file scope, classify only selected saved evidence, keep --source, --severity, --max, --dry-run, mutation confirmation, report overwrite, optional todo capture, active stage, and early-stop state explicit, use blueprint-reviewer only for bounded read-only classification and blueprint-verifier only for bounded post-fix verification, validate the structured report.audit-fix model through blueprint_artifact_report_validate_model, persist it through blueprint_artifact_report_write, append confirmed todo follow-ups through blueprint_artifact_mutate_index, update state through blueprint_state_update, and stop rather than hand-writing .blueprint/ if MCP validation or persistence rejects the repaired model.",
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

export const RUNTIME_OWNED_COMMAND_METADATA = {
  [NEW_PROJECT_RUNTIME_METADATA.commandName]: NEW_PROJECT_RUNTIME_METADATA,
  [ADD_PHASE_RUNTIME_METADATA.commandName]: ADD_PHASE_RUNTIME_METADATA,
  [PROGRESS_RUNTIME_METADATA.commandName]: PROGRESS_RUNTIME_METADATA,
  [SETTINGS_RUNTIME_METADATA.commandName]: SETTINGS_RUNTIME_METADATA,
  [SET_PROFILE_RUNTIME_METADATA.commandName]: SET_PROFILE_RUNTIME_METADATA,
  [HEALTH_RUNTIME_METADATA.commandName]: HEALTH_RUNTIME_METADATA,
  [VALIDATE_PHASE_RUNTIME_METADATA.commandName]: VALIDATE_PHASE_RUNTIME_METADATA,
  [VERIFY_WORK_RUNTIME_METADATA.commandName]: VERIFY_WORK_RUNTIME_METADATA,
  [CODE_REVIEW_RUNTIME_METADATA.commandName]: CODE_REVIEW_RUNTIME_METADATA,
  [CODE_REVIEW_FIX_RUNTIME_METADATA.commandName]: CODE_REVIEW_FIX_RUNTIME_METADATA,
  [SECURE_PHASE_RUNTIME_METADATA.commandName]: SECURE_PHASE_RUNTIME_METADATA,
  [AUDIT_FIX_RUNTIME_METADATA.commandName]: AUDIT_FIX_RUNTIME_METADATA,
  [REVIEW_RUNTIME_METADATA.commandName]: REVIEW_RUNTIME_METADATA,
  [UI_REVIEW_RUNTIME_METADATA.commandName]: UI_REVIEW_RUNTIME_METADATA,
  [ADD_TESTS_RUNTIME_METADATA.commandName]: ADD_TESTS_RUNTIME_METADATA,
  [PAUSE_WORK_RUNTIME_METADATA.commandName]: PAUSE_WORK_RUNTIME_METADATA,
  [RESUME_WORK_RUNTIME_METADATA.commandName]: RESUME_WORK_RUNTIME_METADATA,
  [NOTE_RUNTIME_METADATA.commandName]: NOTE_RUNTIME_METADATA,
  [ADD_TODO_RUNTIME_METADATA.commandName]: ADD_TODO_RUNTIME_METADATA,
  [CHECK_TODOS_RUNTIME_METADATA.commandName]: CHECK_TODOS_RUNTIME_METADATA,
  [ADD_BACKLOG_RUNTIME_METADATA.commandName]: ADD_BACKLOG_RUNTIME_METADATA,
  [REVIEW_BACKLOG_RUNTIME_METADATA.commandName]: REVIEW_BACKLOG_RUNTIME_METADATA,
  [EXPLORE_RUNTIME_METADATA.commandName]: EXPLORE_RUNTIME_METADATA
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
