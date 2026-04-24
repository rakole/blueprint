# External Integrations

**Analysis Date:** 2026-04-24

## APIs & External Services

**Host CLI Platforms:**
- Gemini CLI - primary extension host runtime
  - SDK/Client: extension manifest `gemini-extension.json` launching `node ${extensionPath}/dist/mcp/server.js`
  - Auth: host-managed Gemini CLI auth (Blueprint-specific env: `BLUEPRINT_HOST=gemini`, `BLUEPRINT_EXTENSION_PATH`)
- Tabnine CLI - alternate extension host runtime
  - SDK/Client: extension manifest `tabnine-extension.json` launching `node ${extensionPath}/dist/mcp/server.js`
  - Auth: host-managed Tabnine CLI auth (Blueprint-specific env: `BLUEPRINT_HOST=tabnine`, `BLUEPRINT_EXTENSION_PATH`)

**Protocol/Runtime APIs:**
- Model Context Protocol (MCP) - server/tool/resource surface for Blueprint state operations
  - SDK/Client: `@modelcontextprotocol/sdk` in `src/mcp/server.ts` and `src/mcp/command-resources.ts`
  - Auth: none at Blueprint layer (host CLI manages session access)

**External Network Service:**
- GitHub Raw Content (`raw.githubusercontent.com`) - latest-version lookup for `/blu-update` advisory checks
  - SDK/Client: native `fetch` in `src/mcp/tools/update.ts`
  - Auth: none (public read path, no token handling in runtime code)

**System CLI Integrations:**
- Git CLI - repository metadata, workspace/worktree orchestration, and patch replay checks
  - SDK/Client: `execFile("git", ...)` in `src/mcp/tools/workspace.ts` and `src/mcp/tools/update.ts`
  - Auth: inherited from local git configuration/credentials (not managed in Blueprint code)

## Data Storage

**Databases:**
- Not detected
  - Connection: Not applicable
  - Client: Not applicable

**File Storage:**
- Local filesystem only
  - Project state: `.blueprint/` artifact tree managed by MCP tools in `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, and `src/mcp/tools/state.ts`
  - Host-global operational state: `~/.<host>/blueprint/` paths resolved in `src/mcp/runtime-host.ts` (`defaults.json`, `workspaces.json`, `updates/`, `patches/`)

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Host CLI native authentication (Gemini CLI or Tabnine CLI), not a Blueprint-owned identity subsystem
  - Implementation: Blueprint receives host context/environment from extension manifests (`gemini-extension.json`, `tabnine-extension.json`) and does not implement OAuth/session storage in `src/`

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry/Datadog/New Relic SDK usage in `src/`)

**Logs:**
- Mutation failure diagnostics are appended to `.blueprint/mcp-write-failures.ndjson` via `src/mcp/write-failure-log.ts`
- Additional command evidence is persisted as report artifacts under `.blueprint/reports/` through MCP tool flows in `src/mcp/tools/artifacts.ts`

## CI/CD & Deployment

**Hosting:**
- Deployed as a local Gemini/Tabnine CLI extension bundle (`dist/`, `commands/`, `skills/`, `agents/`, `hooks/`) per `README.md` and `tests/extension-install.integration.ts`

**CI Pipeline:**
- Not detected in repository (no `.github/workflows/*.yml` found)

## Environment Configuration

**Required env vars:**
- `BLUEPRINT_HOST` - runtime host ID (`gemini` or `tabnine`) (`src/mcp/runtime-host.ts`, manifest env blocks in `gemini-extension.json` and `tabnine-extension.json`)
- `BLUEPRINT_EXTENSION_PATH` - installed extension path used for runtime host resolution and update inspection (`src/mcp/runtime-host.ts`, `src/mcp/tools/update.ts`)

**Optional/operational env vars:**
- `BLUEPRINT_GLOBAL_HOME` - overrides default host-global state root (`src/mcp/runtime-host.ts`)
- Test-only vars: `GEMINI_API_KEY`, `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND` (`tests/extension-install.integration.ts`)

**Secrets location:**
- Not stored in repository runtime code; host CLI/account secrets remain external to this repo
- No root `.env*` files detected in this worktree (`find . -maxdepth 1 -name '.env*'`)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

*Integration audit: 2026-04-24*
