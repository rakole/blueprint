# External Integrations

**Analysis Date:** 2026-05-01

## APIs & External Services

**Extension Hosts (local CLI integration):**
- Gemini CLI extension host - runs Blueprint as an MCP server and provides the command surface
  - Runtime entry: `dist/mcp/server.js` built from `src/mcp/server.ts` (`scripts/build.mjs`)
  - Host manifest: `gemini-extension.json` (injects `BLUEPRINT_HOST=gemini`, `BLUEPRINT_EXTENSION_PATH`)
- Tabnine CLI extension host - runs Blueprint as an MCP server and provides the command surface
  - Runtime entry: `dist/mcp/server.js` built from `src/mcp/server.ts` (`scripts/build.mjs`)
  - Host manifest: `tabnine-extension.json` (injects `BLUEPRINT_HOST=tabnine`, `BLUEPRINT_EXTENSION_PATH`)

**GitHub (read-only HTTP lookup):**
- GitHub raw content - used to look up the latest installed version by fetching `package.json` from the configured GitHub remote
  - Implementation: `src/mcp/tools/update.ts` (`lookupLatestVersionFromGithub()` fetches `https://raw.githubusercontent.com/.../package.json`)
  - Auth: none (public raw fetch); falls back to “manual_only” when lookup fails/timeouts

## Data Storage

**Databases:**
- Not detected (no SQL/NoSQL client libraries and no DB connection configuration in `src/`)

**File Storage (durable state):**
- Project-local state under `.blueprint/` (artifact roots and write helpers in `src/mcp/tools/artifacts.ts`, plus command/tool usage across `src/mcp/tools/*.ts`)
- Host-global operational state under `~/.gemini/blueprint/` or `~/.tabnine/blueprint/` (resolved in `src/mcp/runtime-host.ts`)
  - Defaults: `defaults.json` (`src/mcp/runtime-host.ts`)
  - Workspace registry: `workspaces.json` (`src/mcp/runtime-host.ts`, `src/mcp/tools/workspace.ts`)
  - Patch registry dir: `patches/` (`src/mcp/runtime-host.ts`, `src/mcp/tools/workspace.ts`)
  - Update metadata dir: `updates/` (`src/mcp/runtime-host.ts`, `src/mcp/tools/update.ts`)

**Caching:**
- None detected (no Redis/memcached clients; no caching layer under `src/`)

## Authentication & Identity

**Auth Provider:**
- None for Blueprint runtime tools (no OAuth/OpenID/Auth SDKs in `package.json`, and runtime tools primarily use filesystem + `git` + MCP substrate in `src/mcp/tools/*.ts`)

**Host authentication (test-only):**
- Gemini CLI live smoke tests can pass through `GEMINI_API_KEY` when invoking `gemini` inside the integration test container (`tests/extension-install.integration.ts`)

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry/New Relic/Datadog SDKs in `package.json`)

**Logs / Telemetry:**
- Mutation failure journaling to NDJSON under `.blueprint/` (`src/mcp/write-failure-log.ts`, wiring in `src/mcp/server.ts`)

## CI/CD & Deployment

**Hosting:**
- Distributed as a CLI extension installed from a git source (install model referenced in `README.md`, manifests in `gemini-extension.json` and `tabnine-extension.json`)

**CI Pipeline:**
- Not detected in-repo (no `.github/workflows` directory in the repository root; tests are invoked via `package.json` scripts)

## Environment Configuration

**Required env vars (runtime host wiring):**
- `BLUEPRINT_HOST` - set by host manifests (`gemini-extension.json`, `tabnine-extension.json`)
- `BLUEPRINT_EXTENSION_PATH` - set by host manifests (`gemini-extension.json`, `tabnine-extension.json`)

**Optional env vars (runtime behavior):**
- `BLUEPRINT_GLOBAL_HOME` - overrides host-global state root (`src/mcp/runtime-host.ts`)

**CI and test env vars (non-production):**
- `GITHUB_BASE_REF`, `GITHUB_HEAD_REF` - optional GitHub Actions context for base/head scope inference (`src/mcp/tools/impact.ts`)
- `CI` - used for CLI/test behavior switches (referenced in `src/mcp/tools/impact.ts`, `tests/extension-install.integration.ts`)
- `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND` - enables Tabnine CLI install smoke path in integration tests (`tests/extension-install.integration.ts`)
- `BLUEPRINT_TEST_FAIL_WORKSPACE_REGISTRY_WRITE_ONCE` and other `BLUEPRINT_TEST_WORKSPACE_*` knobs - test-only workspace registry behavior injection (`src/mcp/tools/workspace.ts`)

**Secrets location:**
- Environment variables only (no `.env*` configuration is required for normal operation; test-only auth can use `GEMINI_API_KEY` in `tests/extension-install.integration.ts`)

## Webhooks & Callbacks

**Incoming:**
- None detected (no HTTP server endpoints intended for third-party callbacks; MCP server is stdio-transport in `src/mcp/server.ts`)

**Outgoing:**
- GitHub raw content fetch for update lookup only (`src/mcp/tools/update.ts`)

---

*Integration audit: 2026-05-01*
