# Technology Stack

**Analysis Date:** 2026-04-24

## Languages

**Primary:**
- TypeScript (project uses `typescript` `^6.0.2`) - MCP server, tools, hooks, and shared runtime code in `src/mcp/*.ts`, `src/mcp/tools/*.ts`, `src/hooks/*.ts`, and `src/shared/security.ts` (`package.json`, `tsconfig.json`)

**Secondary:**
- JavaScript (ESM `.mjs`) - build and runtime helper scripts in `scripts/build.mjs`, `scripts/lib/extension-hosts.mjs`, and `scripts/*.mjs`
- Markdown/TOML runtime assets - command and skill contracts in `commands/*.toml`, `skills/*/SKILL.md`, and `docs/*.md`

## Runtime

**Environment:**
- Node.js `>=20` (`package.json` `engines.node`)
- Node ESM runtime (`package.json` `"type": "module"`, `tsconfig.json` `module: "NodeNext"`)

**Package Manager:**
- npm (npm scripts defined in `package.json`)
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- `@modelcontextprotocol/sdk` `^1.29.0` - MCP server and resource registration in `src/mcp/server.ts` and `src/mcp/command-resources.ts`
- `zod` `^4.3.6` - tool input validation across MCP tool modules such as `src/mcp/tools/config.ts`, `src/mcp/tools/phase.ts`, and `src/mcp/tools/workspace.ts`

**Testing:**
- Node test runner via `tsx --test` (`package.json` `scripts.test`, tests in `tests/**/*.test.ts`)
- `testcontainers` `^11.14.0` - containerized extension-install integration tests in `tests/extension-install.integration.ts`

**Build/Dev:**
- `esbuild` `^0.28.0` - bundles `src/mcp/server.ts` and hook entrypoints into `dist/` via `scripts/build.mjs`
- TypeScript compiler (`tsc`) - declaration emit and typecheck via `scripts/build.mjs` and `package.json` `scripts.typecheck`
- `tsx` `^4.21.0` - TypeScript test execution (`package.json` `scripts.test`)

## Key Dependencies

**Critical:**
- `@modelcontextprotocol/sdk` `^1.29.0` - Blueprint runtime is an MCP server and cannot run tool/resource contracts without this package (`src/mcp/server.ts`)
- `zod` `^4.3.6` - command/tool argument schemas and deterministic validation rely on this package (`src/mcp/tools/*.ts`)

**Infrastructure:**
- `esbuild` `^0.28.0` - produces distributable extension runtime artifacts in `dist/` (`scripts/build.mjs`)
- `typescript` `^6.0.2` - typed source compilation/declaration output (`tsconfig.json`, `scripts/build.mjs`)
- `testcontainers` `^11.14.0` - validates host CLI extension install behavior in containerized integration tests (`tests/extension-install.integration.ts`)

## Configuration

**Environment:**
- Runtime host/env wiring is provided by extension manifests in `gemini-extension.json` and `tabnine-extension.json` (`BLUEPRINT_HOST`, `BLUEPRINT_EXTENSION_PATH`)
- Optional global state root override is read from `BLUEPRINT_GLOBAL_HOME` in `src/mcp/runtime-host.ts`
- No repo-level `.env*` files detected at repository root (`find . -maxdepth 1 -name '.env*'`)

**Build:**
- TypeScript config: `tsconfig.json`
- Build pipeline script: `scripts/build.mjs`
- Extension host manifests: `gemini-extension.json`, `tabnine-extension.json`
- Hook registration: `hooks/hooks.json`

## Platform Requirements

**Development:**
- Node.js 20+ and npm (`package.json`)
- Git CLI is required for workspace/update maintenance tool operations (`src/mcp/tools/workspace.ts`, `src/mcp/tools/update.ts`)
- Docker engine is required only for integration tests that use `testcontainers` (`tests/extension-install.integration.ts`)

**Production:**
- Hosted as a Gemini CLI or Tabnine CLI extension installed from GitHub (`README.md`, `gemini-extension.json`, `tabnine-extension.json`)
- Runtime entrypoint is `dist/mcp/server.js`; advisory hook entrypoints are `dist/hooks/*.js` (`scripts/build.mjs`, `hooks/hooks.json`)

---

*Stack analysis: 2026-04-24*
