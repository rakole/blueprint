<!-- refreshed: 2026-05-01 -->
# Architecture

**Analysis Date:** 2026-05-01

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                  Host CLI Extension (Gemini / Tabnine)                   │
│  Manifests: `gemini-extension.json`, `tabnine-extension.json`            │
│  Prompts: `commands/*.toml`                                              │
└───────────────┬───────────────────────────────────────────┬──────────────┘
                │                                           │
                ▼                                           ▼
┌──────────────────────────────────────┐        ┌──────────────────────────┐
│ Prompt Orchestration Contracts         │        │ Advisory Hooks (BeforeTool) │
│ Skills: `skills/*/SKILL.md`            │        │ Config: `hooks/hooks.json`  │
│ Subagents: `agents/*.md`               │        │ Entrypoints: `src/hooks/*.ts`│
└───────────────────┬───────────────────┘        └──────────────┬───────────┘
                    │                                            │
                    ▼                                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       MCP Runtime (Node ESM, stdio)                      │
│  Server: `src/mcp/server.ts`                                             │
│  Resources: `src/mcp/command-resources.ts`                               │
│  Tools: `src/mcp/tools/*.ts`                                             │
└───────────────┬───────────────────────────────────────────┬──────────────┘
                │                                           │
                ▼                                           ▼
┌──────────────────────────────────────┐        ┌──────────────────────────┐
│ Project-local Blueprint state         │        │ Host-global operational state │
│ Root: `.blueprint/`                   │        │ Root: `~/.gemini/blueprint/`  │
│ IO helpers: `src/mcp/tools/artifacts.ts` │     │ Resolver: `src/mcp/runtime-host.ts` |
└──────────────────────────────────────┘        └──────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Extension manifests | Start MCP server with host identity (`BLUEPRINT_HOST`) and extension path wiring (`BLUEPRINT_EXTENSION_PATH`). | `gemini-extension.json` |
| Extension manifests | Same as Gemini, for Tabnine host. | `tabnine-extension.json` |
| Command manifests | Define user-facing prompt contracts for `/blu` and `/blu-<command>`. | `commands/blu.toml` |
| Command manifests | Define direct command prompts (`/blu-<command>`). | `commands/blu-*.toml` |
| Skills | Provide reusable orchestration policy per command family; list required inputs/tools; bind optional subagents. | `skills/*/SKILL.md` |
| Agents | Bounded deep-work contracts (planner/reviewer/mapper/etc.) validated by runtime. | `agents/*.md` |
| MCP server | Register tools/resources; enforce required tool presence; wrap tool execution with mutation-failure logging and user-friendly summaries. | `src/mcp/server.ts` |
| Command resources | Expose read-only command catalog + per-command runtime contracts via `blueprint://` URIs. | `src/mcp/command-resources.ts` |
| Command catalog tooling | Compute “implemented-only routing” by combining declared catalog status with runtime substrate checks (manifest + skill + tool availability). | `src/mcp/tools/project.ts` |
| Artifact contracts | Canonical artifact schema/templates for `.blueprint/` (bootstrap/codebase/phase/review/report). | `src/mcp/artifact-contracts/index.ts` |
| Artifact IO | Path-safe file IO, artifact discovery, validation, scaffolding, and `.blueprint/` structure conventions. | `src/mcp/tools/artifacts.ts` |
| Phase lifecycle tools | Phase discovery/planning/execution/validation persistence and indexing inside `.blueprint/phases/`. | `src/mcp/tools/phase.ts` |
| Review tools | Read/validate/write review artifacts and keep next-safe-action routable. | `src/mcp/tools/review.ts` |
| Impact tools | Compute blast-radius / diff scope for `/blu-impact` and persist impact reports. | `src/mcp/tools/impact.ts` |
| Workspace/update tools | Manage workspace registry, patch registry, and update planning under global state root. | `src/mcp/tools/workspace.ts` |
| Build pipeline | Bundle ESM runtime + hooks to `dist/` and emit `.d.ts`; copy JSON schemas. | `scripts/build.mjs` |

## Pattern Overview

**Overall:** Doc-driven prompt contracts + deterministic MCP “state engine” with filesystem-backed artifacts.

**Key Characteristics:**
- **Prompts are declarative:** `/blu` and `/blu-<command>` behavior lives in `commands/*.toml`, which instructs the model to call MCP tools instead of “inventing state” (example: `commands/blu.toml`).
- **Routing is implemented-only:** The runtime command catalog is computed from `docs/COMMAND-CATALOG.md` and then gated by verifying substrate presence (spec + manifest + skill + tool registration) in `src/mcp/tools/project.ts`.
- **Deterministic persistence is centralized:** Artifact schemas/templates are defined in `src/mcp/artifact-contracts/index.ts`, and `.blueprint/` IO/validation/scaffolding is implemented by `src/mcp/tools/artifacts.ts`.

## Layers

**Extension Host Layer:**
- Purpose: Launch MCP server and supply host identity + extension path.
- Location: `gemini-extension.json`, `tabnine-extension.json`
- Contains: MCP server command/args, env wiring for `BLUEPRINT_HOST` and `BLUEPRINT_EXTENSION_PATH`.
- Depends on: `dist/mcp/server.js`
- Used by: Gemini CLI / Tabnine CLI host runtime.

**Prompt Contract Layer:**
- Purpose: Define the user-facing command prompts and orchestration constraints.
- Location: `commands/`
- Contains: Root router prompt (`commands/blu.toml`) and direct command prompts (`commands/blu-*.toml`).
- Depends on: Skills (`skills/*/SKILL.md`) and MCP tool FQNs (`mcp_blueprint_*`).
- Used by: Host command invoker when users run `/blu` or `/blu-<command>`.

**Orchestration Policy Layer (Skills + Agents):**
- Purpose: Encode reusable command-family rules and bounded deep-work contracts.
- Location: `skills/`, `agents/`
- Contains: Skill frontmatter (implemented status, command bindings, input bundles) and agent frontmatter (name/kind/tools).
- Depends on: Specs (`docs/commands/*.md`) and runtime contract docs (`docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`).
- Used by: Command manifests and runtime contract projection (`src/mcp/command-resources.ts`).

**MCP Runtime Layer:**
- Purpose: Provide deterministic tool/resource substrate over stdio.
- Location: `src/mcp/server.ts`, `src/mcp/command-resources.ts`
- Contains: Tool registry assembly from `src/mcp/tools/*.ts`, mutation failure logging, resource registration.
- Depends on: `@modelcontextprotocol/sdk` and tool definitions.
- Used by: Host CLI via stdio transport.

**State & IO Layer:**
- Purpose: Own all structured reads/writes and their safety constraints.
- Location: `src/mcp/tools/*.ts`, `src/shared/security.ts`
- Contains: Zod schemas, path-safety (`ensurePathWithinRootSync`), JSON safety limits, artifact validation/scaffolding.
- Depends on: Repo filesystem, Git CLI for impact/update/workspace operations, and `.blueprint/` artifact contracts.
- Used by: All commands through MCP tool calls.

## Data Flow

### Primary Request Path

1. Host CLI launches MCP server (`gemini-extension.json`, `tabnine-extension.json`).
2. User runs a slash command defined by a TOML manifest (example root router: `commands/blu.toml`).
3. The prompt contract instructs the model to call MCP tools using runtime FQNs (`mcp_blueprint_*`), not shell scripts.
4. MCP server connects over stdio and registers tools/resources (`src/mcp/server.ts:536`).
5. Tool handler validates input (Zod schemas in `src/mcp/tools/*.ts`) and performs deterministic reads/writes under `.blueprint/` (primarily via helpers in `src/mcp/tools/artifacts.ts`).
6. For mutation tools, failures are journaled to `.blueprint/mcp-write-failures.ndjson` (`src/mcp/write-failure-log.ts:10`, `src/mcp/server.ts:486`).
7. Tool results are summarized into user-facing text plus structured payloads (`src/mcp/server.ts:449`).

### Command Availability / Implemented-Only Routing Flow

1. Runtime reads and parses `docs/COMMAND-CATALOG.md` (`src/mcp/tools/project.ts:747`).
2. For each command, runtime checks substrate presence:
   - Command spec `docs/commands/<command>.md` (e.g. `src/mcp/tools/project.ts:666`)
   - Command manifest `commands/blu-<command>.toml` (`src/mcp/tools/project.ts:667`)
   - Primary skill path under `skills/<skill>/SKILL.md` (`src/mcp/tools/project.ts:676`)
   - Required MCP tool names are registered (`src/mcp/tools/project.ts:693`)
3. Catalog entry status is computed as `implemented` only when substrate is satisfied; otherwise `repairing`/`blocked` (`src/mcp/tools/project.ts:710`).
4. Router skills and command prompts must only recommend commands where `implemented: true` (policy encoded in `commands/blu.toml` and `skills/blueprint-router/SKILL.md`).

**State Management:**
- Project-local: `.blueprint/` is treated as source-of-truth for planning artifacts and state; tool path constants live in `src/mcp/tools/artifacts.ts` (referenced widely, e.g. `src/mcp/tools/state.ts:5`).
- Host-global: Operational state paths are derived from `BLUEPRINT_HOST`, `BLUEPRINT_EXTENSION_PATH`, and optional `BLUEPRINT_GLOBAL_HOME` in `src/mcp/runtime-host.ts`.

## Key Abstractions

**Artifact Contract Registry:**
- Purpose: Single canonical “what an artifact is” contract (headings, locked markers, schemas, templates) for all Blueprint persistence.
- Examples: `readArtifactContract()` and `artifactContractIds` in `src/mcp/artifact-contracts/index.ts`.
- Pattern: Contract id (`codebase.architecture`, `phase.plan`, `report.impact`, …) maps to templates + optional JSON Schema model contracts.

**Runtime Tool Registry:**
- Purpose: Enumerate and register all MCP tools, and enforce required subsets exist.
- Examples: `TOOL_DEFINITIONS` and `REQUIRED_*_TOOL_NAMES` in `src/mcp/server.ts`.
- Pattern: Each domain exports `*ToolDefinitions` arrays (example: `src/mcp/tools/project.ts` exports `projectToolDefinitions`) and `src/mcp/server.ts` concatenates them.

**Command Runtime Contract Resource:**
- Purpose: Read-only projection to expose “implemented-only” runtime contracts to models without creating another persistence channel.
- Examples: `blueprint://commands/catalog` and `blueprint://commands/{command}/runtime-contract` in `src/mcp/command-resources.ts`.
- Pattern: Build JSON payloads from command catalog + spec parsing + runtime reference row parsing, then publish via MCP resources.

## Entry Points

**MCP Server Entrypoint:**
- Location: `src/mcp/server.ts`
- Triggers: Host CLI runs `node ${extensionPath}/dist/mcp/server.js` (configured in `gemini-extension.json` / `tabnine-extension.json`).
- Responsibilities: Tool/resource registration and stdio transport connection.

**Root Router Command:**
- Location: `commands/blu.toml`
- Triggers: User runs `/blu` in the host CLI.
- Responsibilities: Implemented-only routing using `mcp_blueprint_blueprint_project_status`, `mcp_blueprint_blueprint_command_catalog`, and config reads.

**Hook Entrypoints:**
- Location: `hooks/hooks.json`
- Triggers: Host `BeforeTool` hook for `write_file|replace`.
- Responsibilities: Advisory-only guidance (read-before-edit, `.blueprint/` injection guard, workflow advisory) via `src/hooks/*.ts`.

**Build Entrypoint:**
- Location: `scripts/build.mjs`
- Triggers: `npm run build` (declared in `package.json`).
- Responsibilities: Bundle runtime to `dist/` and copy schema assets under `dist/mcp/artifact-contracts/schemas/`.

## Architectural Constraints

- **Threading:** Single-threaded Node event loop; CPU-heavy work should avoid blocking patterns (runtime is Node ESM, bundled by `scripts/build.mjs`).
- **Global state:** Some modules maintain process-level caches (examples: `cachedRuntimeHost` in `src/mcp/runtime-host.ts`, `implementedCommandNamesPromise` in `src/mcp/tools/state.ts`, `src/mcp/tools/review.ts`, and `src/mcp/tools/artifacts.ts`).
- **Circular imports:** Some domains dynamically import `src/mcp/tools/project.ts` to avoid hard cycles at module init (example dynamic import in `src/mcp/tools/review.ts:891`).
- **Bundled-file access:** Runtime contract resources read “bundled” files via `new URL(..., import.meta.url)` patterns, so relative path moves require updating `bundledUrl()` helpers (examples: `src/mcp/command-resources.ts:54`, `src/mcp/tools/project.ts:254`).

## Anti-Patterns

### Adding New Persistence Outside MCP Tools

**What happens:** New features write to `.blueprint/` (or global state) directly from prompts/skills instead of via a tool handler.
**Why it's wrong:** It bypasses validation, path safety, and mutation-failure logging, and breaks the “MCP as deterministic state engine” constraint.
**Do this instead:** Add or extend an MCP tool under `src/mcp/tools/*.ts`, register it in `src/mcp/server.ts`, and drive it from the command prompt contract in `commands/blu-*.toml`.

### Growing Monolithic Tool Modules Without Extracting Helpers

**What happens:** Domain logic, markdown parsing, validation, IO, and rendering are added directly into already-large tool modules.
**Why it's wrong:** It increases risk of subtle regressions and makes review/testing slower (large surfaces: `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`).
**Do this instead:** Add focused helper modules under `src/mcp/` or `src/shared/` and keep `src/mcp/tools/*.ts` primarily as handler wiring + domain orchestration.

## Error Handling

**Strategy:** Fail fast on invariants and unsafe inputs; return structured status objects for recoverable states; journal mutation failures.

**Patterns:**
- Input validation is Zod-based and colocated with tool definitions (e.g. `src/mcp/tools/config.ts`, `src/mcp/tools/project.ts`).
- Unsafe paths / malformed JSON throw explicit `Error` via helpers in `src/shared/security.ts`.
- Mutation failures and thrown errors are logged to NDJSON via `src/mcp/write-failure-log.ts` and invoked by `executeToolHandlerWithFailureLogging()` in `src/mcp/server.ts:486`.

## Cross-Cutting Concerns

**Logging:** Mutation failure journaling to `.blueprint/mcp-write-failures.ndjson` (`src/mcp/write-failure-log.ts`).
**Validation:** Artifact-level validation is centralized in artifact contracts (`src/mcp/artifact-contracts/index.ts`) and enforced by artifact IO/tool modules (`src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/review.ts`).
**Authentication:** Not applicable; this extension assumes local filesystem + CLI host context (host identity is inferred from env in `src/mcp/runtime-host.ts`).

---

*Architecture analysis: 2026-05-01*
