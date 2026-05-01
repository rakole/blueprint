# Technology Stack

**Analysis Date:** 2026-05-01

## Languages

**Primary:**
- TypeScript `^6.0.2` - MCP server, tools, hooks, and shared runtime in `src/mcp/**/*.ts`, `src/hooks/*.ts`, `src/shared/*.ts` (`package.json`, `tsconfig.json`)

**Secondary:**
- JavaScript (ESM `.mjs`) - build and helper scripts in `scripts/*.mjs` (notably `scripts/build.mjs`, `scripts/lib/extension-hosts.mjs`)
- JSON - extension manifests and configuration assets in `gemini-extension.json`, `tabnine-extension.json`, `hooks/hooks.json`, plus on-disk state written by tools under `.blueprint/` and host-global state (`src/mcp/tools/*.ts`)
- Markdown - command/skill/agent docs and runtime contracts in `README.md`, `GEMINI.md`, `TABNINE.md`, `docs/**/*.md`, `skills/**/SKILL.md`, `agents/*.md`
- TOML - Gemini/Tabnine command manifests under `commands/*.toml`

## Runtime

**Environment:**
- Node.js `>=20` (ESM) (`package.json` `"engines.node"`, `"type": "module"`)

**Package Manager:**
- npm (scripts in `package.json`)
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- `@modelcontextprotocol/sdk` `^1.29.0` - MCP server runtime and stdio transport in `src/mcp/server.ts`, command resource projection in `src/mcp/command-resources.ts`
- `zod` `^4.3.6` - input validation for MCP tools across `src/mcp/tools/*.ts` (examples: `src/mcp/tools/project.ts`, `src/mcp/tools/update.ts`, `src/mcp/tools/workspace.ts`)
- `ajv` `^8.20.0` - JSON schema validation / contract enforcement (notably `src/mcp/tools/impact.ts`)

**Testing:**
- Node test runner via `tsx --test` (`package.json` `scripts.test`, tests in `tests/**/*.test.ts`)
- `testcontainers` `^11.14.0` - containerized extension-install / host-smoke integration tests in `tests/extension-install.integration.ts`

**Build/Dev:**
- `esbuild` `^0.28.0` - bundles `src/mcp/server.ts` and hook entrypoints into `dist/` via `scripts/build.mjs`
- TypeScript compiler (`tsc`) - emits `.d.ts` declarations during build (`scripts/build.mjs`, `tsconfig.json`)
- `tsx` `^4.21.0` - executes TypeScript tests (`package.json`)

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/sdk` `^1.29.0` - without it, Blueprint cannot register MCP tools/resources or run as an extension (`src/mcp/server.ts`)
- `zod` `^4.3.6` - tool argument validation gate for deterministic behavior (`src/mcp/tools/*.ts`)
- `ajv` `^8.20.0` - schema-backed validation for impact/config/report artifacts (`src/mcp/tools/impact.ts`)

**Infrastructure:**
- `esbuild` `^0.28.0` - produces the distributable runtime entrypoints (`dist/mcp/server.js`, `dist/hooks/*.js`) (`scripts/build.mjs`)
- `tsx` `^4.21.0` - test runner used in CI/local (`package.json`)
- `testcontainers` `^11.14.0` - Docker-backed integration test harness (`tests/extension-install.integration.ts`)

## Configuration

**Environment:**
- Host/runtime environment variables are injected by extension manifests:
  - `BLUEPRINT_HOST` and `BLUEPRINT_EXTENSION_PATH` in `gemini-extension.json` and `tabnine-extension.json`
- Optional override for host-global state root:
  - `BLUEPRINT_GLOBAL_HOME` in `src/mcp/runtime-host.ts`
- TypeScript runtime compiles to ESM in `dist/` (`tsconfig.json`, `scripts/build.mjs`)

**Build:**
- TypeScript config: `tsconfig.json` (`"module": "NodeNext"`, `"strict": true`, `"outDir": "dist"`)
- Build script: `scripts/build.mjs` (runs `tsc --emitDeclarationOnly` + `esbuild` bundle)
- Hook registration: `hooks/hooks.json` (executes `dist/hooks/*.js` before host tool writes)
- MCP runtime entrypoint: `dist/mcp/server.js` built from `src/mcp/server.ts` (`scripts/build.mjs`)

## Platform Requirements

**Development:**
- Node.js 20+ and npm (`package.json`)
- Git CLI available for tools that inspect repos/worktrees and compute diffs (`src/mcp/tools/workspace.ts`, `src/mcp/tools/update.ts`, `src/mcp/tools/impact.ts`)
- Docker engine required only for `testcontainers` integration tests (`tests/extension-install.integration.ts`)

**Production:**
- Installed as a Gemini CLI / Tabnine CLI extension and executed via MCP stdio (`gemini-extension.json`, `tabnine-extension.json`, `src/mcp/server.ts`)
- Distributable artifacts are the compiled/bundled outputs under `dist/` plus static command/skill/agent assets (`scripts/build.mjs`, `commands/`, `skills/`, `agents/`, `docs/`, `hooks/`)

---

*Stack analysis: 2026-05-01*
