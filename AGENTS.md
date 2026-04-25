# Blueprint Agent Guide

## Purpose

This file provides durable repo-scoped instructions for Codex instances working on Blueprint.
Read this before making planning or implementation changes.

## Project Mission

Blueprint is a Gemini CLI extension that packages the retained Blueprint workflow as a Gemini-native system.
It is not a literal port of earlier tooling internals.

## Current Phase

- Wave 0 plus Phase 3 discovery runtime exists for `/blu`, `new-project`, `settings`, `set-profile`, `help`, `progress`, `health`, `map-codebase`, `discuss-phase`, `list-phase-assumptions`, `research-phase`, `ui-phase`, `next`, `plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, `add-tests`, `quick`, `debug`, `pause-work`, `resume-work`, `add-phase`, `insert-phase`, `remove-phase`, `plan-milestone-gaps`, `audit-milestone`, `complete-milestone`, `milestone-summary`, `new-milestone`, `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `explore`, `docs-update`, `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `pr-branch`, `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `update`, `cleanup`, and `reapply-patches`
- Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both completed on 2026-04-11
- Phase 3 discovery shipped on 2026-04-11 and is under active repair; `plan-phase`, `execute-phase`, and `validate-phase` are now implemented on top of the plan, summary, and validation MCP substrates, `quick` and `debug` are also now shipped on the lightweight execution and investigation paths, `verify-work`, `add-tests`, `pause-work`, `resume-work`, `docs-update`, `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `pr-branch`, `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `update`, `cleanup`, and `reapply-patches` are also shipped, `/blu-add-phase`, `/blu-insert-phase`, `/blu-remove-phase`, `/blu-plan-milestone-gaps`, `/blu-audit-milestone`, `/blu-complete-milestone`, `/blu-milestone-summary`, `/blu-new-milestone`, `/blu-note`, `/blu-add-todo`, `/blu-check-todos`, `/blu-add-backlog`, `/blu-review-backlog`, `/blu-explore`, `/blu-list-phase-assumptions`, `/blu-new-workspace`, `/blu-remove-workspace`, `/blu-workstreams`, `/blu-update`, `/blu-cleanup`, and `/blu-reapply-patches` are now implemented as the current Wave 2, Wave 3, Wave 4, and Wave 5 roadmap, capture, lightweight execution, review, review-fix, docs, shipping, and maintenance slices
- `/blu`, `/blu-help`, and `/blu-progress` must still surface only commands whose catalog entry is `implemented`

## Core Product Decisions

- Product name: `blueprint`
- Root router: `/blu`
- Direct commands: `/blu-<command>`
- Project-local state directory: `.blueprint/`
- Global non-project state directory: `~/.gemini/blueprint/`
- Install model: `gemini extensions install https://github.com/rakole/blueprint`

## Architecture Rules

- Treat Blueprint as a Gemini-native redesign, not a file-for-file legacy port
- Use MCP as the deterministic state engine for structured reads and writes
- Keep commands thin and user-facing
- Use skills for orchestration
- Use agents for bounded deep work
- Keep hooks advisory rather than state-owning
- Do not make scripts the primary persistence layer
- Root routing and help/progress guidance must only surface commands whose catalog entry is `implemented`

## State Ownership

- Every Blueprint-managed repo or workspace should have its own `.blueprint/`
- `.blueprint/` is the source of truth for project planning artifacts
- `~/.gemini/blueprint/` is only for cross-project operational state such as:
- workspace registry
- update metadata
- patch registry
- `.planning/` may exist in this repository for local implementation bookkeeping only; it is not Blueprint runtime state

## Command Status Vocabulary

- `planned`: documented but not yet shipped
- `implemented`: manifest, primary skill, and required MCP tools are all present
- `blocked`: not safe to expose because required runtime pieces are missing
- `repairing`: partially shipped and under active drift repair

Control-plane docs such as `docs/COMMAND-CATALOG.md`, `PROGRESS.md`, and
command specs record the declared status for retained work. The live
`blueprint_command_catalog` may still derive a different non-routable runtime
status from missing runtime pieces. For example, `/blu-do` stays declared
`planned` in docs while the runtime catalog remains `repairing` until the
dedicated manifest exists.

## Guardrails

- Do not reintroduce `.planning/` or legacy slash-command surfaces
- Do not silently add omitted legacy commands without re-planning
- Do not mutate the installed extension directory from Blueprint commands
- Do not make `update` self-mutating; it must remain advisory
- Do not rely on hooks for core state transitions
- Keep `.blueprint/` schema stable while implementing Wave 0 and Wave 1
- Do not change `blueprint_command_catalog` status semantics while Phase 3 is being implemented; later commands become routable only when manifests, primary skills, and required MCP tools exist
- Require explicit confirmation for high-risk commands such as `undo`, `ship`, `new-workspace`, `remove-workspace`, `cleanup`, and `reapply-patches`
- Do not recommend planned-only commands from `/blu`, `/blu-help`, or `/blu-progress`
- Do not treat documented Phase 3+ commands as runnable until their runtime catalog entry is `implemented`
- When starting any new code change(fresh context) create a new worktree, post work completion, push to origin, PR to main, merge, pull into main local

## Preferred Read Order

1. `docs/DECISIONS.md`
2. `docs/DRIFT.MD`
3. `docs/ARCHITECTURE.md`
4. `docs/ARTIFACT-SCHEMA.md`
5. `docs/MCP-TOOLS.md`
6. `docs/GEMINI-CONSTRAINTS.md`
7. `docs/PHASE-LIFECYCLE.md`
8. `docs/SKILLS-AND-AGENTS.md`
9. `docs/IMPLEMENTATION-ORDER.md`
10. `docs/COMMAND-CATALOG.md`
11. `docs/commands/<command>.md`

## Immediate Next Slice

Hold the shipped Wave 2 roadmap-admin surface stable while the next rollout is replanned:

- unchanged implemented-only routing guarantees in `src/mcp/tools/project.ts`
- `insert-phase` stays aligned across its manifest, primary skill contract, required MCP tools, and regression coverage
- the closed Phase 2.2 drift guarantees plus shipped Phase 3, Phase 4, and Wave 2 closeout regression coverage stay preserved while later commands land

## Working Norms

- Prefer deterministic state changes through MCP tools
- Keep command behavior aligned with the command spec docs
- Update `MEMORY.md` when major decisions change or implementation moves to a new wave
- If a new architectural decision is made, update the relevant doc in `docs/` rather than only mentioning it in chat
- When a shipped command intentionally differs from the locked Blueprint baseline, document that delta in `docs/RUNTIME-REFERENCE.md`

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Blueprint Impact Command**

This project adds a new Blueprint command, `/blu-impact`, that computes blast radius for proposed changes before implementation or merge. It analyzes diff scope, roadmap context, touched code and configuration surfaces, and known dependencies to produce a structured impact report teams can review quickly. The primary audience is engineering teams that need reliable cross-service impact visibility and reviewer confidence in large or regulated repos.

**Core Value:** Every meaningful change gets a provable blast-radius report before it ships.

### Constraints

- **Architecture**: Keep commands thin and user-facing while pushing deterministic analysis/state operations into MCP tools.
- **Routing safety**: Planned commands must stay non-routable until their runtime contract is complete and catalog status is `implemented`.
- **State boundary**: Project state remains `.blueprint/` at runtime; `.planning/` here is implementation bookkeeping only.
- **Risk posture**: Initial command must be advisory/read-only and must call out uncertainty rather than inventing certainty.
- **Compatibility**: Must degrade safely when optional ownership/dependency metadata is missing.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript (project uses `typescript` `^6.0.2`) - MCP server, tools, hooks, and shared runtime code in `src/mcp/*.ts`, `src/mcp/tools/*.ts`, `src/hooks/*.ts`, and `src/shared/security.ts` (`package.json`, `tsconfig.json`)
- JavaScript (ESM `.mjs`) - build and runtime helper scripts in `scripts/build.mjs`, `scripts/lib/extension-hosts.mjs`, and `scripts/*.mjs`
- Markdown/TOML runtime assets - command and skill contracts in `commands/*.toml`, `skills/*/SKILL.md`, and `docs/*.md`
## Runtime
- Node.js `>=20` (`package.json` `engines.node`)
- Node ESM runtime (`package.json` `"type": "module"`, `tsconfig.json` `module: "NodeNext"`)
- npm (npm scripts defined in `package.json`)
- Lockfile: present (`package-lock.json`)
## Frameworks
- `@modelcontextprotocol/sdk` `^1.29.0` - MCP server and resource registration in `src/mcp/server.ts` and `src/mcp/command-resources.ts`
- `zod` `^4.3.6` - tool input validation across MCP tool modules such as `src/mcp/tools/config.ts`, `src/mcp/tools/phase.ts`, and `src/mcp/tools/workspace.ts`
- Node test runner via `tsx --test` (`package.json` `scripts.test`, tests in `tests/**/*.test.ts`)
- `testcontainers` `^11.14.0` - containerized extension-install integration tests in `tests/extension-install.integration.ts`
- `esbuild` `^0.28.0` - bundles `src/mcp/server.ts` and hook entrypoints into `dist/` via `scripts/build.mjs`
- TypeScript compiler (`tsc`) - declaration emit and typecheck via `scripts/build.mjs` and `package.json` `scripts.typecheck`
- `tsx` `^4.21.0` - TypeScript test execution (`package.json` `scripts.test`)
## Key Dependencies
- `@modelcontextprotocol/sdk` `^1.29.0` - Blueprint runtime is an MCP server and cannot run tool/resource contracts without this package (`src/mcp/server.ts`)
- `zod` `^4.3.6` - command/tool argument schemas and deterministic validation rely on this package (`src/mcp/tools/*.ts`)
- `esbuild` `^0.28.0` - produces distributable extension runtime artifacts in `dist/` (`scripts/build.mjs`)
- `typescript` `^6.0.2` - typed source compilation/declaration output (`tsconfig.json`, `scripts/build.mjs`)
- `testcontainers` `^11.14.0` - validates host CLI extension install behavior in containerized integration tests (`tests/extension-install.integration.ts`)
## Configuration
- Runtime host/env wiring is provided by extension manifests in `gemini-extension.json` and `tabnine-extension.json` (`BLUEPRINT_HOST`, `BLUEPRINT_EXTENSION_PATH`)
- Optional global state root override is read from `BLUEPRINT_GLOBAL_HOME` in `src/mcp/runtime-host.ts`
- No repo-level `.env*` files detected at repository root (`find . -maxdepth 1 -name '.env*'`)
- TypeScript config: `tsconfig.json`
- Build pipeline script: `scripts/build.mjs`
- Extension host manifests: `gemini-extension.json`, `tabnine-extension.json`
- Hook registration: `hooks/hooks.json`
## Platform Requirements
- Node.js 20+ and npm (`package.json`)
- Git CLI is required for workspace/update maintenance tool operations (`src/mcp/tools/workspace.ts`, `src/mcp/tools/update.ts`)
- Docker engine is required only for integration tests that use `testcontainers` (`tests/extension-install.integration.ts`)
- Hosted as a Gemini CLI or Tabnine CLI extension installed from GitHub (`README.md`, `gemini-extension.json`, `tabnine-extension.json`)
- Runtime entrypoint is `dist/mcp/server.js`; advisory hook entrypoints are `dist/hooks/*.js` (`scripts/build.mjs`, `hooks/hooks.json`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Use lowercase kebab-case for source modules under `src/` (examples: `src/mcp/runtime-vocabulary.ts`, `src/mcp/write-failure-log.ts`, `src/hooks/read-before-edit.ts`).
- Use descriptive suffixes for MCP tool families in `src/mcp/tools/` (examples: `src/mcp/tools/project.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/workspace.ts`).
- Use `*.test.ts` for most tests and `*.integration.ts` for container/install flows in `tests/` (examples: `tests/roadmap-tools.test.ts`, `tests/extension-install.integration.ts`).
- Use `camelCase` for local helpers and exported functions (examples: `resolveBlueprintSkillPath` in `src/mcp/runtime-vocabulary.ts`, `blueprintProjectStatus` in `src/mcp/tools/project.ts`).
- Prefix MCP-facing handlers with `blueprint` and a domain verb/noun to keep tool mapping explicit (examples: `blueprintStateLoad` in `src/mcp/tools/state.ts`, `blueprintReviewRecord` in `src/mcp/tools/review.ts`).
- Use `UPPER_SNAKE_CASE` for module-level constants (examples: `BLUEPRINT_DIR` in `src/mcp/tools/artifacts.ts`, `DEFAULT_MAX_JSON_BYTES` in `src/shared/security.ts`).
- Use descriptive `camelCase` for runtime values and collections (examples: `implementedCommandNamesPromise` in `src/mcp/tools/state.ts`, `MUTATION_FAILURE_STATUSES` usage in `src/mcp/server.ts`).
- Use `PascalCase` for type aliases and object contracts (examples: `CommandCatalogEntry` in `src/mcp/tools/project.ts`, `PromptBoundaryAnalysis` in `src/shared/security.ts`).
- Use string-literal unions for bounded domains (examples: `type CommandStatus = "planned" | "implemented" | "blocked" | "repairing"` in `src/mcp/tools/project.ts`).
## Code Style
- Enforce TypeScript strictness via `tsconfig.json` (`"strict": true`, NodeNext module resolution in `tsconfig.json`).
- Follow existing style in `src/` and `tests/`: 2-space indentation, semicolons, double quotes, trailing commas in multiline objects/arrays (examples across `src/mcp/server.ts` and `tests/new-project.test.ts`).
- Formatter config files are not detected (`.eslintrc*`, `.prettierrc*`, `eslint.config.*`, `prettier.config.*`, `biome.json` absent at repo root).
- Dedicated lint tooling/rules are not detected in `package.json` scripts (only `build`, `typecheck`, `test`, and integration/smoke scripts in `package.json`).
- Use `npm run typecheck` (`package.json`) as the current static-quality gate.
## Import Organization
- Path aliases are not used; imports are relative and include `.js` extensions for TS NodeNext compatibility (examples: `src/mcp/tools/project.ts`, `src/hooks/workflow-advisory.ts`).
## Error Handling
- Throw explicit `Error` for invalid input, unsafe paths, and invariant failures (examples: `src/shared/security.ts`, `src/mcp/server.ts` required tool checks).
- Return structured status objects (`status`, `warnings`, `issues`, `reason`) for recoverable validation outcomes instead of throwing (examples: `blueprintCodebaseArtifactWrite` in `src/mcp/tools/artifacts.ts`, `blueprintReviewLoadFindings` in `src/mcp/tools/review.ts`).
- Use `try/catch` fallbacks for optional/non-critical checks like `pathExists` helpers (examples: `src/mcp/tools/review.ts`, `tests/helpers/extension-hosts.ts`).
- Route mutation failures through centralized logging wrappers before surfacing failures (examples: `executeToolHandlerWithFailureLogging` in `src/mcp/server.ts`, log writer in `src/mcp/write-failure-log.ts`).
## Logging
- Limit `console.error` to process boundaries (examples: hook runner in `src/hooks/run-hook.ts`, MCP startup error in `src/mcp/server.ts`).
- Persist mutation failure telemetry as NDJSON under `.blueprint/` (path constant `MCP_WRITE_FAILURE_LOG_PATH` in `src/mcp/write-failure-log.ts`).
- Keep core tool handlers mostly side-effect-free from ad-hoc logging (pattern across `src/mcp/tools/*.ts`).
## Comments
- Keep comments sparse and targeted to high-level contract context (example block comment near repaired command coverage in `tests/extension-runtime-contracts.test.ts`).
- Prefer descriptive names over inline narration in production code (pattern across `src/mcp/tools/*.ts` and `src/shared/security.ts`).
- JSDoc/TSDoc is not a primary pattern; type aliases and explicit return types carry most documentation (`src/mcp/tools/project.ts`, `src/mcp/tools/state.ts`).
## Function Design
- Use small pure helpers for normalization/parsing where possible (examples: `normalizeReviewListItem` in `src/mcp/tools/review.ts`, `validateFieldNameSegment` in `src/shared/security.ts`).
- Larger orchestration functions exist in tool modules with dense domain logic (notably `src/mcp/tools/artifacts.ts` and `src/mcp/tools/phase.ts`); keep new logic decomposed into helpers before wiring into tool handlers.
- Use typed argument objects with optional `cwd` and explicit option fields (examples: `ProjectInitArgs` in `src/mcp/tools/project.ts`, `ReviewScopeArgs` in `src/mcp/tools/review.ts`).
- Validate external input via Zod schemas colocated with handlers (examples: `projectStatusInputSchema` in `src/mcp/tools/project.ts`, `reviewRecordInputSchema` in `src/mcp/tools/review.ts`).
- Return typed result objects that include status metadata and durable paths (examples: `ProjectStatusResult` in `src/mcp/tools/project.ts`, `StateSyncResult` in `src/mcp/tools/state.ts`).
- For write paths, include idempotency signals (`created`, `overwritten`, `reused`, `updated`) (examples: `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`).
## Module Design
- Prefer named exports for constants, types, and handlers (examples: `src/mcp/runtime-vocabulary.ts`, `src/mcp/tools/config.ts`).
- Expose per-domain `*ToolDefinitions` arrays that bind handler + schema + description (examples: `configToolDefinitions` in `src/mcp/tools/config.ts`, `phaseToolDefinitions` in `src/mcp/tools/phase.ts`).
- Barrel usage is minimal; one major index-style module defines artifact contracts at `src/mcp/artifact-contracts/index.ts`.
- Cross-module composition happens in `src/mcp/server.ts` by importing domain `*ToolDefinitions` arrays rather than re-export barrels.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- User-facing command behavior is declared in `commands/blu*.toml` and kept thin; durable state logic is delegated to MCP tools in `src/mcp/tools/*.ts`.
- Runtime command availability is computed from `docs/COMMAND-CATALOG.md`, command manifests, skill presence, and required tool registration in `src/mcp/tools/project.ts`.
- Artifact shape is centralized in `src/mcp/artifact-contracts/index.ts` and enforced by write paths in `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/review.ts`, and `src/mcp/tools/state.ts`.
## Layers
- Purpose: Registers Blueprint as a Gemini/Tabnine extension and starts the MCP process.
- Location: `gemini-extension.json`, `tabnine-extension.json`.
- Contains: Extension metadata plus MCP process launch config (`dist/mcp/server.js`).
- Depends on: Built outputs under `dist/`.
- Used by: Gemini CLI and Tabnine CLI host runtimes.
- Purpose: Defines per-command prompt contracts and required MCP interactions.
- Location: `commands/blu.toml`, `commands/blu-*.toml`.
- Contains: Command prompt text, execution profile, and routing constraints.
- Depends on: Skill docs in `skills/*/SKILL.md` and MCP tool FQNs (`mcp_blueprint_*`).
- Used by: Host command invoker and root `/blu` router.
- Purpose: Encodes reusable orchestration policy across command families.
- Location: `skills/blueprint-*/SKILL.md`.
- Contains: Required docs, required MCP tools, optional subagents, and workflow rules.
- Depends on: Command specs in `docs/commands/*.md` and runtime contracts in `docs/MCP-TOOLS.md`.
- Used by: Command manifests and `src/mcp/skill-metadata.ts` runtime-contract resource projection.
- Purpose: Bounded deep-work contracts for planning, execution, review, research, and mapping.
- Location: `agents/*.md`.
- Contains: Agent frontmatter schema (`name`, `kind`, `tools`, limits) and execution rules.
- Depends on: Validation in `src/mcp/agent-definition.ts`.
- Used by: Skills and command contracts that request optional subagents.
- Purpose: Registers tools/resources and exposes a deterministic stdio MCP server.
- Location: `src/mcp/server.ts`, `src/mcp/command-resources.ts`.
- Contains: Tool registry assembly, mutation-failure logging hooks, command catalog resource, and runtime-contract resource template.
- Depends on: Tool-definition exports from `src/mcp/tools/*.ts`.
- Used by: Extension hosts via `dist/mcp/server.js`.
- Purpose: Owns all structured state reads/writes and lifecycle semantics.
- Location: `src/mcp/tools/project.ts`, `src/mcp/tools/config.ts`, `src/mcp/tools/state.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/review.ts`, `src/mcp/tools/workspace.ts`, `src/mcp/tools/update.ts`.
- Contains: Zod input schemas, validation, path-safe persistence, and status-oriented results.
- Depends on: Artifact contracts, shared security helpers, runtime-host and command-path helpers.
- Used by: All command manifests through MCP FQNs.
- Purpose: Enforces path/prompt safety for MCP writes and provides advisory hook guidance.
- Location: `src/shared/security.ts`, `src/mcp/write-failure-log.ts`, `src/hooks/*.ts`, `hooks/hooks.json`.
- Contains: Path-containment checks, safe JSON parsing, prompt-boundary analysis, mutation-failure NDJSON logging, advisory hook entrypoints.
- Depends on: Filesystem/path APIs and MCP tool write paths.
- Used by: MCP mutating tools and hook command invocations (`dist/hooks/*.js`).
## Data Flow
- Project-local state source of truth is `.blueprint/` (artifact roots defined in `src/mcp/tools/artifacts.ts`).
- Host-global state is resolved in `src/mcp/runtime-host.ts` (`defaultsPath`, `workspaceRegistryPath`, `patchRegistryPath`, `updatesDir`).
- Artifact schema and templates are centralized in `src/mcp/artifact-contracts/index.ts` and surfaced through `blueprint_artifact_contract_read`.
## Key Abstractions
- Purpose: Guarantees implemented-only routing.
- Examples: `blueprintCommandCatalog()` in `src/mcp/tools/project.ts`, `docs/COMMAND-CATALOG.md`, `commands/blu-*.toml`.
- Pattern: Doc-driven catalog row parsing + runtime substrate checks (`manifest`, `skill`, `requiredTools`).
- Purpose: Single canonical schema for bootstrap, codebase, phase, review, and report documents.
- Examples: `artifactContractIds`, `readArtifactContract`, `renderArtifactScaffoldTemplate` in `src/mcp/artifact-contracts/index.ts`.
- Pattern: Contract ID -> scaffold/authoring template + locked markers + required heading validation.
- Purpose: Exposes read-only runtime contract resources to models without creating a second persistence channel.
- Examples: `blueprint://commands/catalog` and `blueprint://commands/{command}/runtime-contract` in `src/mcp/command-resources.ts`.
- Pattern: Build resource payloads from live tool/catalog/spec/runtime-reference state.
## Entry Points
- Location: `gemini-extension.json`, `tabnine-extension.json`.
- Triggers: CLI extension host startup.
- Responsibilities: Starts `dist/mcp/server.js` with host-specific env (`BLUEPRINT_HOST`, `BLUEPRINT_EXTENSION_PATH`).
- Location: `src/mcp/server.ts`.
- Triggers: Node process execution of built server file.
- Responsibilities: Registers resources/tools, wraps handlers with failure logging, connects stdio transport.
- Location: `commands/blu.toml` and `commands/blu-*.toml`.
- Triggers: Slash-command invocation in host CLI.
- Responsibilities: Command-specific orchestration prompts and MCP tool usage policy.
- Location: `hooks/hooks.json`, `src/hooks/read-before-edit.ts`, `src/hooks/blueprint-write-guard.ts`, `src/hooks/workflow-advisory.ts`.
- Triggers: Host `BeforeTool` hook for `write_file|replace`.
- Responsibilities: Advisory-only warnings; no persistence ownership.
## Error Handling
- Input schema validation through Zod in each tool module (`src/mcp/tools/*.ts`).
- Safety failures from `src/shared/security.ts` for traversal, malformed JSON, invalid identifiers, and suspicious prompt-boundary content.
- Mutation failure journaling in `.blueprint/mcp-write-failures.ndjson` via `logRejectedMutationResult` and `logThrownMutationError` in `src/mcp/write-failure-log.ts`.
- Tool responses favor explicit status metadata (`found`, `phaseFound`, `status`, `warnings`, `reason`) to support router-safe recovery.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
