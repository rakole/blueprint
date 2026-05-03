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
const ADD_TESTS_SPEC_PATH =
  "skills/blueprint-phase-validation/references/add-tests-runtime-contract.md";

const VALIDATION_OPTIONAL_AGENTS = ["blueprint-verifier"] as const;
const ADD_TESTS_OPTIONAL_AGENTS = [
  "blueprint-executor",
  "blueprint-verifier"
] as const;
const CODE_REVIEW_OPTIONAL_AGENTS = ["blueprint-reviewer"] as const;
const CODE_REVIEW_FIX_OPTIONAL_AGENTS = ["blueprint-reviewer"] as const;
const SECURE_PHASE_OPTIONAL_AGENTS = ["blueprint-security-auditor"] as const;

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

export const RUNTIME_OWNED_COMMAND_METADATA = {
  [NEW_PROJECT_RUNTIME_METADATA.commandName]: NEW_PROJECT_RUNTIME_METADATA,
  [ADD_PHASE_RUNTIME_METADATA.commandName]: ADD_PHASE_RUNTIME_METADATA,
  [PROGRESS_RUNTIME_METADATA.commandName]: PROGRESS_RUNTIME_METADATA,
  [VALIDATE_PHASE_RUNTIME_METADATA.commandName]: VALIDATE_PHASE_RUNTIME_METADATA,
  [VERIFY_WORK_RUNTIME_METADATA.commandName]: VERIFY_WORK_RUNTIME_METADATA,
  [CODE_REVIEW_RUNTIME_METADATA.commandName]: CODE_REVIEW_RUNTIME_METADATA,
  [CODE_REVIEW_FIX_RUNTIME_METADATA.commandName]: CODE_REVIEW_FIX_RUNTIME_METADATA,
  [SECURE_PHASE_RUNTIME_METADATA.commandName]: SECURE_PHASE_RUNTIME_METADATA,
  [ADD_TESTS_RUNTIME_METADATA.commandName]: ADD_TESTS_RUNTIME_METADATA
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
