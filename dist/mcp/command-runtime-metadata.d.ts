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
};
export declare function getRuntimeOwnedCommandMetadata(commandName: string): RuntimeOwnedCommandMetadata | null;
export declare function getRuntimeOwnedCommandMetadataBySourceId(sourceId: string | null): RuntimeOwnedCommandMetadata | null;
