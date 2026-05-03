export type RuntimeOwnedCommandStatus =
  | "planned"
  | "implemented"
  | "blocked"
  | "repairing";

export type RuntimeOwnedCommandSpecMetadata = {
  path: string;
  title: string | null;
  wave: number | null;
  family: string | null;
  executionProfile: string | null;
  rootRoutable: boolean | null;
  purpose: string | null;
  requiredTools: string[];
  primarySkill: string | null;
  optionalSubagents: string[];
  reads: string[];
  writes: string[];
};

export type RuntimeOwnedReferenceRowMetadata = {
  path: string;
  wave: number | null;
  waveTitle: string | null;
  command: string;
  commandSpecPath: string | null;
  primarySkill: string | null;
  exactMcpDestination: string[];
  optionalAgents: string[];
  hookInvolvement: string[];
  contractNotes: string | null;
  evidenceState: string[];
};

export type RuntimeOwnedCommandMetadata = {
  commandName: string;
  wave: number;
  family: string;
  primarySkill: string;
  declaredStatus: RuntimeOwnedCommandStatus;
  risk: string;
  requiredTools: string[];
  optionalAgents: string[];
  requiredInputPaths: string[];
  exposeRuntimeContract: boolean;
  spec: RuntimeOwnedCommandSpecMetadata;
  runtimeReference: RuntimeOwnedReferenceRowMetadata;
};

const PROGRESS_REQUIRED_TOOLS = [
  "blueprint_project_status",
  "blueprint_config_get",
  "blueprint_state_load",
  "blueprint_artifact_list",
  "blueprint_command_catalog"
];
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
];
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
];
const CODE_REVIEW_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_artifact_contract_read",
  "blueprint_review_scope",
  "blueprint_review_load_findings",
  "blueprint_review_validate_model",
  "blueprint_review_record"
];
const CODE_REVIEW_FIX_REQUIRED_TOOLS = [
  "blueprint_phase_locate",
  "blueprint_review_load_findings",
  "blueprint_review_authoring_context",
  "blueprint_review_validate_model",
  "blueprint_review_record",
  "blueprint_state_update"
];
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
];
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
];
const VALIDATION_OPTIONAL_AGENTS = ["blueprint-verifier"];
const ADD_TESTS_OPTIONAL_AGENTS = ["blueprint-executor", "blueprint-verifier"];
const CODE_REVIEW_OPTIONAL_AGENTS = ["blueprint-reviewer"];
const CODE_REVIEW_FIX_OPTIONAL_AGENTS = ["blueprint-reviewer"];
const SECURE_PHASE_OPTIONAL_AGENTS = ["blueprint-security-auditor"];
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
const RUNTIME_METADATA_PATH = "src/mcp/command-runtime-metadata.ts";

export const runtimeOwnedCommandMetadata: Record<string, RuntimeOwnedCommandMetadata> = {
  progress: {
    commandName: "progress",
    wave: 0,
    family: "Foundation",
    primarySkill: "blueprint-router",
    declaredStatus: "implemented",
    risk: "Low: read-only status inspection.",
    requiredTools: PROGRESS_REQUIRED_TOOLS,
    optionalAgents: [],
    requiredInputPaths: [PROGRESS_SPEC_PATH],
    exposeRuntimeContract: false,
    spec: {
      path: PROGRESS_SPEC_PATH,
      title: "`/blu-progress`",
      wave: 0,
      family: "Foundation",
      executionProfile: "router",
      rootRoutable: true,
      purpose:
        "`progress` summarizes Blueprint repo status, blockers, warnings, and next safe implemented guidance from MCP-owned state.",
      requiredTools: PROGRESS_REQUIRED_TOOLS,
      primarySkill: "blueprint-router",
      optionalSubagents: [],
      reads: [
        ".blueprint/ state, config, artifacts, project status, and command catalog through MCP tools."
      ],
      writes: []
    },
    runtimeReference: {
      path: RUNTIME_METADATA_PATH,
      wave: 0,
      waveTitle: "Foundation",
      command: "progress",
      commandSpecPath: PROGRESS_SPEC_PATH,
      primarySkill: "blueprint-router",
      exactMcpDestination: PROGRESS_REQUIRED_TOOLS,
      optionalAgents: [],
      hookInvolvement: [],
      contractNotes:
        "Router profile; preserve read-only next-step guidance from MCP-owned project status, config, state, artifact inventory, and implemented command catalog.",
      evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
    }
  },
  "validate-phase": {
    commandName: "validate-phase",
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-phase-validation",
    declaredStatus: "implemented",
    risk:
      "Low: writes summary-aware verification evidence and updates follow-up state.",
    requiredTools: VALIDATE_PHASE_REQUIRED_TOOLS,
    optionalAgents: VALIDATION_OPTIONAL_AGENTS,
    requiredInputPaths: [VALIDATE_PHASE_SPEC_PATH],
    exposeRuntimeContract: false,
    spec: {
      path: VALIDATE_PHASE_SPEC_PATH,
      title: "`/blu-validate-phase`",
      wave: 1,
      family: "Core Lifecycle",
      executionProfile: "long-running-mutation",
      rootRoutable: true,
      purpose:
        "`validate-phase` audits saved execution summaries and persists phase verification evidence through the validation MCP substrate.",
      requiredTools: VALIDATE_PHASE_REQUIRED_TOOLS,
      primarySkill: "blueprint-phase-validation",
      optionalSubagents: VALIDATION_OPTIONAL_AGENTS,
      reads: [
        "Saved phase summaries, validation baselines, config, artifact health, and state through MCP tools."
      ],
      writes: ["phase XX-VERIFICATION.md", ".blueprint/STATE.md"]
    },
    runtimeReference: {
      path: RUNTIME_METADATA_PATH,
      wave: 1,
      waveTitle: "Core Lifecycle",
      command: "validate-phase",
      commandSpecPath: VALIDATE_PHASE_SPEC_PATH,
      primarySkill: "blueprint-phase-validation",
      exactMcpDestination: VALIDATE_PHASE_REQUIRED_TOOLS,
      optionalAgents: VALIDATION_OPTIONAL_AGENTS,
      hookInvolvement: ["read-before-edit", ".blueprint write guard"],
      contractNotes:
        "Long-running-mutation profile; validate saved summary evidence through the phase validation MCP substrate and route only to implemented follow-up commands.",
      evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
    }
  },
  "verify-work": {
    commandName: "verify-work",
    wave: 1,
    family: "Core Lifecycle",
    primarySkill: "blueprint-phase-validation",
    declaredStatus: "implemented",
    risk:
      "Medium: writes resumable UAT artifacts, can close or reopen roadmap completion, and records follow-up state.",
    requiredTools: VERIFY_WORK_REQUIRED_TOOLS,
    optionalAgents: VALIDATION_OPTIONAL_AGENTS,
    requiredInputPaths: [VERIFY_WORK_SPEC_PATH],
    exposeRuntimeContract: false,
    spec: {
      path: VERIFY_WORK_SPEC_PATH,
      title: "`/blu-verify-work`",
      wave: 1,
      family: "Core Lifecycle",
      executionProfile: "long-running-mutation",
      rootRoutable: true,
      purpose:
        "`verify-work` runs summary-backed UAT and persists resumable phase UAT evidence through the validation MCP substrate.",
      requiredTools: VERIFY_WORK_REQUIRED_TOOLS,
      primarySkill: "blueprint-phase-validation",
      optionalSubagents: VALIDATION_OPTIONAL_AGENTS,
      reads: [
        "Saved phase summaries, verification and UAT state, config, artifact health, and state through MCP tools."
      ],
      writes: ["phase XX-UAT.md", ".blueprint/ROADMAP.md", ".blueprint/STATE.md"]
    },
    runtimeReference: {
      path: RUNTIME_METADATA_PATH,
      wave: 1,
      waveTitle: "Core Lifecycle",
      command: "verify-work",
      commandSpecPath: VERIFY_WORK_SPEC_PATH,
      primarySkill: "blueprint-phase-validation",
      exactMcpDestination: VERIFY_WORK_REQUIRED_TOOLS,
      optionalAgents: VALIDATION_OPTIONAL_AGENTS,
      hookInvolvement: ["read-before-edit", ".blueprint write guard"],
      contractNotes:
        "Long-running-mutation profile; keep conversational UAT phase-scoped, summary-aware, and persisted through the validation MCP substrate.",
      evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
    }
  },
  "code-review": {
    commandName: "code-review",
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-review",
    declaredStatus: "implemented",
    risk: "Low: review artifact generation only.",
    requiredTools: CODE_REVIEW_REQUIRED_TOOLS,
    optionalAgents: CODE_REVIEW_OPTIONAL_AGENTS,
    requiredInputPaths: [CODE_REVIEW_SPEC_PATH],
    exposeRuntimeContract: true,
    spec: {
      path: CODE_REVIEW_SPEC_PATH,
      title: "`/blu-code-review`",
      wave: 4,
      family: "Quality And Shipping",
      executionProfile: "long-running-mutation",
      rootRoutable: true,
      purpose:
        "`code-review` reviews source files changed during a Blueprint phase, resolves deterministic scope from executed plan metadata or explicit file paths, honors review settings, audits saved phase evidence, and persists the result through review MCP tools instead of prompt-only file writes.",
      requiredTools: CODE_REVIEW_REQUIRED_TOOLS,
      primarySkill: "blueprint-review",
      optionalSubagents: CODE_REVIEW_OPTIONAL_AGENTS,
      reads: [
        ".blueprint/config.json",
        "Phase resolution, artifact inventory, review scoping, saved execution summaries, matching plans, validation or UAT evidence, and any existing review findings through MCP tools and read-only repo access."
      ],
      writes: ["phase XX-REVIEW.md"]
    },
    runtimeReference: {
      path: RUNTIME_METADATA_PATH,
      wave: 4,
      waveTitle: "Quality, Shipping, Docs, And Maintenance",
      command: "code-review",
      commandSpecPath: CODE_REVIEW_SPEC_PATH,
      primarySkill: "blueprint-review",
      exactMcpDestination: CODE_REVIEW_REQUIRED_TOOLS,
      optionalAgents: CODE_REVIEW_OPTIONAL_AGENTS,
      hookInvolvement: ["read-before-edit", ".blueprint write guard"],
      contractNotes:
        "Long-running-mutation profile for deterministic phase-scoped review: keep Resolve/Read/Decide/Execute/Validate/Persist/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial review runs without turning them into persistence, let blueprint_review_scope own review enablement, normalized depth defaults, saved evidence inventory, deterministic repo-file scoping, authoring context, and narrowed task schema, load skills/blueprint-review/references/code-review-runtime-contract.md for model-only JSON authoring, depth semantics, evidence richness, capability-gated reviewer use, no-subagent fallback, and MCP retry/repair behavior, keep explicit scope or overwrite confirmation when broad scope or existing review evidence needs approval, fail any invalid explicit --files scope instead of silently narrowing it, load saved XX-REVIEW.md findings before overwrite decisions, validate the authored model through blueprint_review_validate_model, and persist the model through blueprint_review_record so MCP renders canonical XX-REVIEW.md without Markdown fallback.",
      evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
    }
  },
  "code-review-fix": {
    commandName: "code-review-fix",
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-review",
    declaredStatus: "implemented",
    risk:
      "High: selected findings can trigger bounded repo remediation plus review-fix/state updates.",
    requiredTools: CODE_REVIEW_FIX_REQUIRED_TOOLS,
    optionalAgents: CODE_REVIEW_FIX_OPTIONAL_AGENTS,
    requiredInputPaths: [CODE_REVIEW_FIX_SPEC_PATH],
    exposeRuntimeContract: false,
    spec: {
      path: CODE_REVIEW_FIX_SPEC_PATH,
      title: "`/blu-code-review-fix`",
      wave: 4,
      family: "Quality And Shipping",
      executionProfile: "long-running-mutation",
      rootRoutable: true,
      purpose:
        "`code-review-fix` applies bounded fixes from saved code-review findings and persists review-fix evidence plus state through MCP tools.",
      requiredTools: CODE_REVIEW_FIX_REQUIRED_TOOLS,
      primarySkill: "blueprint-review",
      optionalSubagents: CODE_REVIEW_FIX_OPTIONAL_AGENTS,
      reads: [
        "Saved code-review findings, phase evidence, and review-fix authoring context through MCP tools."
      ],
      writes: ["phase XX-REVIEW-FIX.md", ".blueprint/STATE.md"]
    },
    runtimeReference: {
      path: RUNTIME_METADATA_PATH,
      wave: 4,
      waveTitle: "Quality, Shipping, Docs, And Maintenance",
      command: "code-review-fix",
      commandSpecPath: CODE_REVIEW_FIX_SPEC_PATH,
      primarySkill: "blueprint-review",
      exactMcpDestination: CODE_REVIEW_FIX_REQUIRED_TOOLS,
      optionalAgents: CODE_REVIEW_FIX_OPTIONAL_AGENTS,
      hookInvolvement: ["read-before-edit", ".blueprint write guard", "workflow advisory"],
      contractNotes:
        "Long-running-mutation profile for bounded saved-finding remediation; keep repo mutation scoped to selected findings, validate review.review-fix, persist through review MCP tools, and route follow-up through implemented validation or progress commands only.",
      evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
    }
  },
  "secure-phase": {
    commandName: "secure-phase",
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-review",
    declaredStatus: "implemented",
    risk: "Low: audit artifact only.",
    requiredTools: SECURE_PHASE_REQUIRED_TOOLS,
    optionalAgents: SECURE_PHASE_OPTIONAL_AGENTS,
    requiredInputPaths: [SECURE_PHASE_SPEC_PATH],
    exposeRuntimeContract: false,
    spec: {
      path: SECURE_PHASE_SPEC_PATH,
      title: "`/blu-secure-phase`",
      wave: 4,
      family: "Quality And Shipping",
      executionProfile: "long-running-mutation",
      rootRoutable: true,
      purpose:
        "`secure-phase` verifies declared saved-plan threats against completed execution evidence and persists phase security evidence through review MCP tools.",
      requiredTools: SECURE_PHASE_REQUIRED_TOOLS,
      primarySkill: "blueprint-review",
      optionalSubagents: SECURE_PHASE_OPTIONAL_AGENTS,
      reads: [
        "Saved plans, summaries, threat evidence, artifact inventory, and security authoring context through MCP tools."
      ],
      writes: ["phase XX-SECURITY.md"]
    },
    runtimeReference: {
      path: RUNTIME_METADATA_PATH,
      wave: 4,
      waveTitle: "Quality, Shipping, Docs, And Maintenance",
      command: "secure-phase",
      commandSpecPath: SECURE_PHASE_SPEC_PATH,
      primarySkill: "blueprint-review",
      exactMcpDestination: SECURE_PHASE_REQUIRED_TOOLS,
      optionalAgents: SECURE_PHASE_OPTIONAL_AGENTS,
      hookInvolvement: ["read-before-edit", ".blueprint write guard"],
      contractNotes:
        "Long-running-mutation profile for bounded threat verification; persist review.security through review MCP tools and route only after open threats are closed or accepted.",
      evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
    }
  },
  "add-tests": {
    commandName: "add-tests",
    wave: 4,
    family: "Quality And Shipping",
    primarySkill: "blueprint-phase-validation",
    declaredStatus: "implemented",
    risk: "High: repo test mutation plus verification/report updates.",
    requiredTools: ADD_TESTS_REQUIRED_TOOLS,
    optionalAgents: ADD_TESTS_OPTIONAL_AGENTS,
    requiredInputPaths: [ADD_TESTS_SPEC_PATH],
    exposeRuntimeContract: false,
    spec: {
      path: ADD_TESTS_SPEC_PATH,
      title: "`/blu-add-tests`",
      wave: 4,
      family: "Quality And Shipping",
      executionProfile: "long-running-mutation",
      rootRoutable: true,
      purpose:
        "`add-tests` generates focused repo tests from saved phase evidence and persists validation plus report artifacts through MCP tools.",
      requiredTools: ADD_TESTS_REQUIRED_TOOLS,
      primarySkill: "blueprint-phase-validation",
      optionalSubagents: ADD_TESTS_OPTIONAL_AGENTS,
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
      path: RUNTIME_METADATA_PATH,
      wave: 4,
      waveTitle: "Quality, Shipping, Docs, And Maintenance",
      command: "add-tests",
      commandSpecPath: ADD_TESTS_SPEC_PATH,
      primarySkill: "blueprint-phase-validation",
      exactMcpDestination: ADD_TESTS_REQUIRED_TOOLS,
      optionalAgents: ADD_TESTS_OPTIONAL_AGENTS,
      hookInvolvement: ["read-before-edit", ".blueprint write guard", "workflow advisory"],
      contractNotes:
        "Long-running-mutation profile for evidence-backed test generation; keep repo mutation scoped to selected tests and persist validation/report evidence through MCP tools.",
      evidenceState: ["locked", "source-owned", "needs-behavior-audit"]
    }
  }
};

export function getRuntimeOwnedCommandMetadata(
  commandName: string
): RuntimeOwnedCommandMetadata | null {
  return runtimeOwnedCommandMetadata[commandName] ?? null;
}

export function listRuntimeOwnedCommandMetadata(): RuntimeOwnedCommandMetadata[] {
  return Object.values(runtimeOwnedCommandMetadata);
}

export function listRuntimeOwnedCommandContractMetadata(): RuntimeOwnedCommandMetadata[] {
  return listRuntimeOwnedCommandMetadata().filter(
    (metadata) => metadata.exposeRuntimeContract
  );
}
