# Architecture

**Analysis Date:** 2026-04-24

## Pattern Overview

**Overall:** Contract-driven layered extension runtime (manifest commands + skill orchestration + MCP-owned persistence).

**Key Characteristics:**
- User-facing command behavior is declared in `commands/blu*.toml` and kept thin; durable state logic is delegated to MCP tools in `src/mcp/tools/*.ts`.
- Runtime command availability is computed from `docs/COMMAND-CATALOG.md`, command manifests, skill presence, and required tool registration in `src/mcp/tools/project.ts`.
- Artifact shape is centralized in `src/mcp/artifact-contracts/index.ts` and enforced by write paths in `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/review.ts`, and `src/mcp/tools/state.ts`.

## Layers

**Host Extension Layer:**
- Purpose: Registers Blueprint as a Gemini/Tabnine extension and starts the MCP process.
- Location: `gemini-extension.json`, `tabnine-extension.json`.
- Contains: Extension metadata plus MCP process launch config (`dist/mcp/server.js`).
- Depends on: Built outputs under `dist/`.
- Used by: Gemini CLI and Tabnine CLI host runtimes.

**Command Manifest Layer:**
- Purpose: Defines per-command prompt contracts and required MCP interactions.
- Location: `commands/blu.toml`, `commands/blu-*.toml`.
- Contains: Command prompt text, execution profile, and routing constraints.
- Depends on: Skill docs in `skills/*/SKILL.md` and MCP tool FQNs (`mcp_blueprint_*`).
- Used by: Host command invoker and root `/blu` router.

**Skill Orchestration Layer:**
- Purpose: Encodes reusable orchestration policy across command families.
- Location: `skills/blueprint-*/SKILL.md`.
- Contains: Required docs, required MCP tools, optional subagents, and workflow rules.
- Depends on: Command specs in `docs/commands/*.md` and runtime contracts in `docs/MCP-TOOLS.md`.
- Used by: Command manifests and `src/mcp/skill-metadata.ts` runtime-contract resource projection.

**Agent Contract Layer:**
- Purpose: Bounded deep-work contracts for planning, execution, review, research, and mapping.
- Location: `agents/*.md`.
- Contains: Agent frontmatter schema (`name`, `kind`, `tools`, limits) and execution rules.
- Depends on: Validation in `src/mcp/agent-definition.ts`.
- Used by: Skills and command contracts that request optional subagents.

**MCP Server Composition Layer:**
- Purpose: Registers tools/resources and exposes a deterministic stdio MCP server.
- Location: `src/mcp/server.ts`, `src/mcp/command-resources.ts`.
- Contains: Tool registry assembly, mutation-failure logging hooks, command catalog resource, and runtime-contract resource template.
- Depends on: Tool-definition exports from `src/mcp/tools/*.ts`.
- Used by: Extension hosts via `dist/mcp/server.js`.

**MCP Tool Domain Layer:**
- Purpose: Owns all structured state reads/writes and lifecycle semantics.
- Location: `src/mcp/tools/project.ts`, `src/mcp/tools/config.ts`, `src/mcp/tools/state.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/review.ts`, `src/mcp/tools/workspace.ts`, `src/mcp/tools/update.ts`.
- Contains: Zod input schemas, validation, path-safe persistence, and status-oriented results.
- Depends on: Artifact contracts, shared security helpers, runtime-host and command-path helpers.
- Used by: All command manifests through MCP FQNs.

**Cross-Cutting Security and Advisory Layer:**
- Purpose: Enforces path/prompt safety for MCP writes and provides advisory hook guidance.
- Location: `src/shared/security.ts`, `src/mcp/write-failure-log.ts`, `src/hooks/*.ts`, `hooks/hooks.json`.
- Contains: Path-containment checks, safe JSON parsing, prompt-boundary analysis, mutation-failure NDJSON logging, advisory hook entrypoints.
- Depends on: Filesystem/path APIs and MCP tool write paths.
- Used by: MCP mutating tools and hook command invocations (`dist/hooks/*.js`).

## Data Flow

**Router Dispatch Flow:**

1. Host invokes `/blu` via `commands/blu.toml`.
2. Router contract reads `mcp_blueprint_blueprint_project_status` and `mcp_blueprint_blueprint_command_catalog`.
3. `blueprint_command_catalog` in `src/mcp/tools/project.ts` parses `docs/COMMAND-CATALOG.md`, checks manifest and skill existence, and verifies required tool registration.
4. Router resolves to an implemented direct command (`/blu-<command>`) or returns blocked/waiting-state guidance.

**Plan/Execute Persistence Flow:**

1. `/blu-plan-phase` and `/blu-execute-phase` manifests call phase tools (`blueprint_phase_locate`, `blueprint_phase_plan_*`, `blueprint_phase_summary_*`).
2. Tool handlers in `src/mcp/tools/phase.ts` resolve canonical phase paths under `.blueprint/phases/` and enforce contract/overwrite checks.
3. Write operations call shared path and content guards from `src/shared/security.ts`.
4. Mutating failures are appended to `.blueprint/mcp-write-failures.ndjson` by `src/mcp/write-failure-log.ts` before surfacing errors.
5. State continuity is reconciled with `blueprint_state_update` and `blueprint_state_sync` in `src/mcp/tools/state.ts`.

**State Management:**
- Project-local state source of truth is `.blueprint/` (artifact roots defined in `src/mcp/tools/artifacts.ts`).
- Host-global state is resolved in `src/mcp/runtime-host.ts` (`defaultsPath`, `workspaceRegistryPath`, `patchRegistryPath`, `updatesDir`).
- Artifact schema and templates are centralized in `src/mcp/artifact-contracts/index.ts` and surfaced through `blueprint_artifact_contract_read`.

## Key Abstractions

**Command Catalog Runtime Gate:**
- Purpose: Guarantees implemented-only routing.
- Examples: `blueprintCommandCatalog()` in `src/mcp/tools/project.ts`, `docs/COMMAND-CATALOG.md`, `commands/blu-*.toml`.
- Pattern: Doc-driven catalog row parsing + runtime substrate checks (`manifest`, `skill`, `requiredTools`).

**Artifact Contract Registry:**
- Purpose: Single canonical schema for bootstrap, codebase, phase, review, and report documents.
- Examples: `artifactContractIds`, `readArtifactContract`, `renderArtifactScaffoldTemplate` in `src/mcp/artifact-contracts/index.ts`.
- Pattern: Contract ID -> scaffold/authoring template + locked markers + required heading validation.

**Runtime Resource Projection:**
- Purpose: Exposes read-only runtime contract resources to models without creating a second persistence channel.
- Examples: `blueprint://commands/catalog` and `blueprint://commands/{command}/runtime-contract` in `src/mcp/command-resources.ts`.
- Pattern: Build resource payloads from live tool/catalog/spec/runtime-reference state.

## Entry Points

**Extension Bootstrap Entry Point:**
- Location: `gemini-extension.json`, `tabnine-extension.json`.
- Triggers: CLI extension host startup.
- Responsibilities: Starts `dist/mcp/server.js` with host-specific env (`BLUEPRINT_HOST`, `BLUEPRINT_EXTENSION_PATH`).

**MCP Server Entry Point:**
- Location: `src/mcp/server.ts`.
- Triggers: Node process execution of built server file.
- Responsibilities: Registers resources/tools, wraps handlers with failure logging, connects stdio transport.

**Command Surface Entry Point:**
- Location: `commands/blu.toml` and `commands/blu-*.toml`.
- Triggers: Slash-command invocation in host CLI.
- Responsibilities: Command-specific orchestration prompts and MCP tool usage policy.

**Hook Entry Points:**
- Location: `hooks/hooks.json`, `src/hooks/read-before-edit.ts`, `src/hooks/blueprint-write-guard.ts`, `src/hooks/workflow-advisory.ts`.
- Triggers: Host `BeforeTool` hook for `write_file|replace`.
- Responsibilities: Advisory-only warnings; no persistence ownership.

## Error Handling

**Strategy:** Structured validation-first with explicit status returns for recoverable conditions and bounded exceptions for invalid mutation contexts.

**Patterns:**
- Input schema validation through Zod in each tool module (`src/mcp/tools/*.ts`).
- Safety failures from `src/shared/security.ts` for traversal, malformed JSON, invalid identifiers, and suspicious prompt-boundary content.
- Mutation failure journaling in `.blueprint/mcp-write-failures.ndjson` via `logRejectedMutationResult` and `logThrownMutationError` in `src/mcp/write-failure-log.ts`.
- Tool responses favor explicit status metadata (`found`, `phaseFound`, `status`, `warnings`, `reason`) to support router-safe recovery.

## Cross-Cutting Concerns

**Logging:** Mutation failure diagnostics are appended by MCP runtime in `src/mcp/write-failure-log.ts`; command UX summaries are synthesized in `summarizeToolResult()` in `src/mcp/server.ts`.
**Validation:** Contract validation is centralized in `src/mcp/artifact-contracts/index.ts` and enforced by tool writers in `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, and `src/mcp/tools/review.ts`.
**Authentication:** No app-level auth provider is implemented in runtime code; trust boundary is local CLI extension execution context plus filesystem scoping in `src/mcp/runtime-host.ts` and path guards in `src/shared/security.ts`.

---

*Architecture analysis: 2026-04-24*
