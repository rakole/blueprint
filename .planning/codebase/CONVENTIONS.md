# Coding Conventions

**Analysis Date:** 2026-05-01

## Naming Patterns

**Files:**
- Use lowercase `kebab-case` for TypeScript modules under `src/` (examples: `src/mcp/write-failure-log.ts`, `src/mcp/runtime-vocabulary.ts`, `src/hooks/read-before-edit.ts`).
- Keep MCP tool modules grouped by domain under `src/mcp/tools/` (examples: `src/mcp/tools/project.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/impact.ts`).
- Use `*.test.ts` for the main test suite files in `tests/` (examples: `tests/update-tools.test.ts`, `tests/new-project.test.ts`, `tests/map-codebase.test.ts`).
- Use descriptive test suffixes to indicate scope: `*-metadata.test.ts` (manifest/docs/runtime-contract alignment), `*-slice.test.ts` (end-to-end slice checks), and `*.integration.ts` for containerized install flows (examples: `tests/ship-metadata.test.ts`, `tests/add-tests-slice.test.ts`, `tests/extension-install.integration.ts`).

**Functions:**
- Use `camelCase` for helpers and exported functions (examples: `resolveBlueprintSkillPath()` in `src/mcp/runtime-vocabulary.ts`, `ensurePathWithinRootSync()` in `src/shared/security.ts`, `blueprintUpdatePlan()` in `src/mcp/tools/update.ts`).
- Use a `blueprint*` prefix for exported MCP handler functions to keep public surfaces recognizable (examples across `src/mcp/tools/project.ts`, `src/mcp/tools/state.ts`, `src/mcp/tools/review.ts`).

**Variables:**
- Use `camelCase` for locals and parameters (examples: `projectRoot`, `relativePath`, `warnings` in `src/mcp/tools/update.ts` and `src/mcp/tools/state.ts`).
- Use `UPPER_SNAKE_CASE` (and `as const`) for module-level constants and fixed vocabulary (examples: `MCP_WRITE_FAILURE_LOG_PATH` in `src/mcp/write-failure-log.ts`, `BLUEPRINT_MUTATION_TOOL_NAMES` in `src/mcp/server.ts`, `BLUEPRINT_ROOT_COMMAND` in `src/mcp/command-paths.ts`).

**Types:**
- Use `PascalCase` for type aliases and interfaces (examples: `UpdatePlanResult` in `src/mcp/tools/update.ts`, `PromptBoundaryAnalysis` in `src/shared/security.ts`, `HookInput` in `src/hooks/shared.ts`).
- Prefer string-literal unions for bounded domains (examples: `type CommandStatus = "planned" | "implemented" | "blocked" | "repairing"` in `src/mcp/tools/project.ts`, and many status/result unions across `src/mcp/tools/*.ts`).
- Use `as const` and `satisfies` to keep literal types precise for constant lists (examples: `SUMMARY_COUNT_KEYS` in `src/mcp/server.ts`, `BLUEPRINT_HOST_IDS` in `src/mcp/runtime-host.ts`).

## Code Style

**Formatting:**
- No repo-level formatter config is present at root (no `.prettierrc*`, `prettier.config.*`, `biome.json`, or ESLint configs were detected alongside `package.json`).
- Use 2-space indentation, semicolons, and double quotes consistently (examples throughout `src/mcp/server.ts`, `src/shared/security.ts`, `tests/update-tools.test.ts`).
- Prefer trailing commas in multiline object/array literals (examples: `src/mcp/server.ts`, `src/mcp/tools/config.ts`).

**Linting:**
- No dedicated lint script is declared; the primary static quality gate is `npm run typecheck` (`package.json`, `tsconfig.json`).
- TypeScript strictness is enabled (`"strict": true`) with Node ESM-aware module settings (`"module": "NodeNext"`, `"moduleResolution": "NodeNext"`) (`tsconfig.json`).

## Import Organization

**Order:**
1. External packages (examples: `@modelcontextprotocol/sdk/...` imports at the top of `src/mcp/server.ts`; `ajv` + `zod` imports in `src/mcp/tools/phase.ts`).
2. Node built-ins, generally using `node:` specifiers (examples: `node:path`, `node:fs/promises`, `node:child_process` across `src/mcp/tools/update.ts` and `tests/impact-tools.test.ts`).
3. Relative internal modules (examples across `src/mcp/server.ts`, `src/mcp/tools/*.ts`, `src/hooks/*.ts`).

**Path Aliases:**
- No TS path aliases are used; imports are relative throughout `src/` and `tests/`.
- When importing TypeScript sources from ESM contexts, use explicit `.js` extensions to match NodeNext resolution (examples: `tests/update-tools.test.ts` importing `../src/mcp/server.js` and `../src/mcp/tools/update.js`).
- Tests sometimes import local TypeScript helpers using `.ts` extensions (example: `tests/extension-install.integration.ts` importing `./helpers/extension-hosts.ts`).

## Error Handling

**Patterns:**
- Use `throw new Error(...)` for invariants and safety violations (examples: tool registration guards in `src/mcp/server.ts`, path/prompt safety in `src/shared/security.ts`).
- Prefer returning structured result objects for recoverable outcomes, with fields like `status`, `warnings`, `reason`, `found`, `phaseFound`, `created`, `overwritten`, `updatedFields` (examples: `blueprintUpdateCheck()` / `blueprintUpdatePlan()` in `src/mcp/tools/update.ts`, `blueprintStateLoad()` / `blueprintStateUpdate()` in `src/mcp/tools/state.ts`, `blueprintReviewLoadFindings()` in `src/mcp/tools/review.ts`).
- Convert parse failures into warnings rather than throwing when the caller can proceed safely (example: `readJsonObject()` in `src/mcp/tools/update.ts`).

**Input validation:**
- Validate MCP tool inputs with Zod schemas colocated with handlers (examples: `projectInitInputSchema` in `src/mcp/tools/project.ts`, `updatePlanInputSchema` in `src/mcp/tools/update.ts`, `reviewScopeInputSchema` in `src/mcp/tools/review.ts`).
- Validate structured model JSON against JSON Schema using Ajv 2020 when appropriate (Ajv imports and validation logic in `src/mcp/tools/phase.ts`, `src/mcp/tools/review.ts`, and `src/mcp/tools/artifacts.ts`).

## Logging

**Framework:** Node `console` at process boundaries.

**Patterns:**
- Use `console.error(...)` primarily in process entrypoints and fatal error paths (examples: dependency-missing guardrails in `scripts/build.mjs`, hook runner failure paths in `src/hooks/run-hook.ts`, and MCP top-level error handler in `src/mcp/server.ts`).
- Persist mutation failure telemetry as NDJSON under `.blueprint/` (writer functions in `src/mcp/write-failure-log.ts`; tool wrapper logic in `src/mcp/server.ts`).

## Comments

**When to Comment:**
- Prefer self-describing identifiers and typed contracts over heavy inline commentary (pattern across `src/mcp/tools/*.ts` and `src/shared/security.ts`).
- Use short, contract-level comments when locking down behavior is important (examples appear in some regression-oriented tests under `tests/`, such as `tests/extension-runtime-contracts.test.ts`).

**JSDoc/TSDoc:**
- Not a primary pattern; documentation is carried by explicit types, result shapes, and schema-driven contracts (examples: `src/mcp/tools/state.ts`, `src/mcp/tools/review.ts`).

## Function Design

**Size:**
- Keep complex tool handlers decomposed into helpers; tool modules can be large but still rely on smaller focused functions (notable large domains: `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/review.ts`).

**Parameters:**
- Prefer a single args object with optional `cwd` and explicit option fields (examples: `type UpdatePlanArgs = { cwd?: string; mode?: ... }` in `src/mcp/tools/update.ts`, and similar args shapes across `src/mcp/tools/*.ts`).

**Return Values:**
- Return explicit typed result objects (not `void`) and include durable paths + idempotency signals for writes (examples: `seedProjectConfig()` in `src/mcp/tools/config.ts`, `blueprintStateSync()` in `src/mcp/tools/state.ts`).

## Module Design

**Exports:**
- Prefer named exports for functions/constants/types; default exports are uncommon in production modules (contrast: tests use `import test from "node:test"` in `tests/*.test.ts`).

**Barrel Files:**
- Minimize barrels; one central contract module exists for artifact contracts and templates (`src/mcp/artifact-contracts/index.ts`).

**Tool registration:**
- Each domain module exports a `*ToolDefinitions` array that binds `name`, `description`, `inputSchema`, and `handler` (examples: `configToolDefinitions` in `src/mcp/tools/config.ts`, `projectToolDefinitions` in `src/mcp/tools/project.ts`, and the tool registry assembly in `src/mcp/server.ts`).

---

*Convention analysis: 2026-05-01*

