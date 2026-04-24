# Coding Conventions

**Analysis Date:** 2026-04-24

## Naming Patterns

**Files:**
- Use lowercase kebab-case for source modules under `src/` (examples: `src/mcp/runtime-vocabulary.ts`, `src/mcp/write-failure-log.ts`, `src/hooks/read-before-edit.ts`).
- Use descriptive suffixes for MCP tool families in `src/mcp/tools/` (examples: `src/mcp/tools/project.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/workspace.ts`).
- Use `*.test.ts` for most tests and `*.integration.ts` for container/install flows in `tests/` (examples: `tests/roadmap-tools.test.ts`, `tests/extension-install.integration.ts`).

**Functions:**
- Use `camelCase` for local helpers and exported functions (examples: `resolveBlueprintSkillPath` in `src/mcp/runtime-vocabulary.ts`, `blueprintProjectStatus` in `src/mcp/tools/project.ts`).
- Prefix MCP-facing handlers with `blueprint` and a domain verb/noun to keep tool mapping explicit (examples: `blueprintStateLoad` in `src/mcp/tools/state.ts`, `blueprintReviewRecord` in `src/mcp/tools/review.ts`).

**Variables:**
- Use `UPPER_SNAKE_CASE` for module-level constants (examples: `BLUEPRINT_DIR` in `src/mcp/tools/artifacts.ts`, `DEFAULT_MAX_JSON_BYTES` in `src/shared/security.ts`).
- Use descriptive `camelCase` for runtime values and collections (examples: `implementedCommandNamesPromise` in `src/mcp/tools/state.ts`, `MUTATION_FAILURE_STATUSES` usage in `src/mcp/server.ts`).

**Types:**
- Use `PascalCase` for type aliases and object contracts (examples: `CommandCatalogEntry` in `src/mcp/tools/project.ts`, `PromptBoundaryAnalysis` in `src/shared/security.ts`).
- Use string-literal unions for bounded domains (examples: `type CommandStatus = "planned" | "implemented" | "blocked" | "repairing"` in `src/mcp/tools/project.ts`).

## Code Style

**Formatting:**
- Enforce TypeScript strictness via `tsconfig.json` (`"strict": true`, NodeNext module resolution in `tsconfig.json`).
- Follow existing style in `src/` and `tests/`: 2-space indentation, semicolons, double quotes, trailing commas in multiline objects/arrays (examples across `src/mcp/server.ts` and `tests/new-project.test.ts`).
- Formatter config files are not detected (`.eslintrc*`, `.prettierrc*`, `eslint.config.*`, `prettier.config.*`, `biome.json` absent at repo root).

**Linting:**
- Dedicated lint tooling/rules are not detected in `package.json` scripts (only `build`, `typecheck`, `test`, and integration/smoke scripts in `package.json`).
- Use `npm run typecheck` (`package.json`) as the current static-quality gate.

## Import Organization

**Order:**
1. Node built-ins first (examples: `import path from "node:path";` in `src/mcp/tools/artifacts.ts`, `tests/map-codebase.test.ts`).
2. Third-party packages second (examples: `import * as z from "zod/v4";` in `src/mcp/tools/phase.ts`, `import { GenericContainer } from "testcontainers";` in `tests/extension-install.integration.ts`).
3. Project-local imports last (examples: `import { blueprintConfigGet } from "./config.js";` in `src/mcp/tools/state.ts`, `import { blueprintToolNames } from "../src/mcp/server.js";` in tests).

**Path Aliases:**
- Path aliases are not used; imports are relative and include `.js` extensions for TS NodeNext compatibility (examples: `src/mcp/tools/project.ts`, `src/hooks/workflow-advisory.ts`).

## Error Handling

**Patterns:**
- Throw explicit `Error` for invalid input, unsafe paths, and invariant failures (examples: `src/shared/security.ts`, `src/mcp/server.ts` required tool checks).
- Return structured status objects (`status`, `warnings`, `issues`, `reason`) for recoverable validation outcomes instead of throwing (examples: `blueprintCodebaseArtifactWrite` in `src/mcp/tools/artifacts.ts`, `blueprintReviewLoadFindings` in `src/mcp/tools/review.ts`).
- Use `try/catch` fallbacks for optional/non-critical checks like `pathExists` helpers (examples: `src/mcp/tools/review.ts`, `tests/helpers/extension-hosts.ts`).
- Route mutation failures through centralized logging wrappers before surfacing failures (examples: `executeToolHandlerWithFailureLogging` in `src/mcp/server.ts`, log writer in `src/mcp/write-failure-log.ts`).

## Logging

**Framework:** `console` plus structured NDJSON failure logs.

**Patterns:**
- Limit `console.error` to process boundaries (examples: hook runner in `src/hooks/run-hook.ts`, MCP startup error in `src/mcp/server.ts`).
- Persist mutation failure telemetry as NDJSON under `.blueprint/` (path constant `MCP_WRITE_FAILURE_LOG_PATH` in `src/mcp/write-failure-log.ts`).
- Keep core tool handlers mostly side-effect-free from ad-hoc logging (pattern across `src/mcp/tools/*.ts`).

## Comments

**When to Comment:**
- Keep comments sparse and targeted to high-level contract context (example block comment near repaired command coverage in `tests/extension-runtime-contracts.test.ts`).
- Prefer descriptive names over inline narration in production code (pattern across `src/mcp/tools/*.ts` and `src/shared/security.ts`).

**JSDoc/TSDoc:**
- JSDoc/TSDoc is not a primary pattern; type aliases and explicit return types carry most documentation (`src/mcp/tools/project.ts`, `src/mcp/tools/state.ts`).

## Function Design

**Size:** 
- Use small pure helpers for normalization/parsing where possible (examples: `normalizeReviewListItem` in `src/mcp/tools/review.ts`, `validateFieldNameSegment` in `src/shared/security.ts`).
- Larger orchestration functions exist in tool modules with dense domain logic (notably `src/mcp/tools/artifacts.ts` and `src/mcp/tools/phase.ts`); keep new logic decomposed into helpers before wiring into tool handlers.

**Parameters:** 
- Use typed argument objects with optional `cwd` and explicit option fields (examples: `ProjectInitArgs` in `src/mcp/tools/project.ts`, `ReviewScopeArgs` in `src/mcp/tools/review.ts`).
- Validate external input via Zod schemas colocated with handlers (examples: `projectStatusInputSchema` in `src/mcp/tools/project.ts`, `reviewRecordInputSchema` in `src/mcp/tools/review.ts`).

**Return Values:** 
- Return typed result objects that include status metadata and durable paths (examples: `ProjectStatusResult` in `src/mcp/tools/project.ts`, `StateSyncResult` in `src/mcp/tools/state.ts`).
- For write paths, include idempotency signals (`created`, `overwritten`, `reused`, `updated`) (examples: `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`).

## Module Design

**Exports:** 
- Prefer named exports for constants, types, and handlers (examples: `src/mcp/runtime-vocabulary.ts`, `src/mcp/tools/config.ts`).
- Expose per-domain `*ToolDefinitions` arrays that bind handler + schema + description (examples: `configToolDefinitions` in `src/mcp/tools/config.ts`, `phaseToolDefinitions` in `src/mcp/tools/phase.ts`).

**Barrel Files:** 
- Barrel usage is minimal; one major index-style module defines artifact contracts at `src/mcp/artifact-contracts/index.ts`.
- Cross-module composition happens in `src/mcp/server.ts` by importing domain `*ToolDefinitions` arrays rather than re-export barrels.

---

*Convention analysis: 2026-04-24*
