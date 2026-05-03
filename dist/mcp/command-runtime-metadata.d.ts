import type { BlueprintInternalToolName } from "./runtime-vocabulary.js";
export type RuntimeOwnedCommandMetadata = {
    commandName: string;
    sourceId: string;
    catalog: {
        wave: number;
        family: string;
        primarySkill: string;
        declaredStatus: "planned" | "implemented" | "blocked" | "repairing";
        risk: string;
    };
    requiredTools: readonly BlueprintInternalToolName[];
    optionalAgents: readonly string[];
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
};
export declare function listRuntimeOwnedCommandMetadata(): RuntimeOwnedCommandMetadata[];
export declare function getRuntimeOwnedCommandMetadata(commandName: string): RuntimeOwnedCommandMetadata | null;
export declare function getRuntimeOwnedCommandMetadataBySourceId(sourceId: string | null): RuntimeOwnedCommandMetadata | null;
