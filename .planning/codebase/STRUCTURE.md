# Codebase Structure

**Analysis Date:** 2026-05-01

## Directory Layout

```
[project-root]/
├── agents/                 # Optional bounded subagents (planner/reviewer/mapper/etc.)
├── commands/               # Gemini/Tabnine slash-command manifests (`/blu`, `/blu-<command>`)
├── dist/                   # Bundled runtime shipped with the extension (committed)
├── docs/                   # Locked command specs + runtime reference + implementation docs
├── hooks/                  # Host hook registration (`BeforeTool`) wiring
├── scripts/                # Build and packaging scripts
├── skills/                 # Orchestration skills used by commands
├── src/                    # TypeScript source for MCP server, tools, hooks, shared utilities
├── tests/                  # `tsx --test` test suite + integration tests
├── gemini-extension.json   # Gemini host manifest (launches `dist/mcp/server.js`)
├── tabnine-extension.json  # Tabnine host manifest (launches `dist/mcp/server.js`)
├── package.json            # Node ESM package + scripts
└── tsconfig.json           # TypeScript config (NodeNext)
```

## Directory Purposes

**`src/`:**
- Purpose: Primary implementation code for the MCP server runtime and hook entrypoints.
- Contains: MCP server (`src/mcp/server.ts`), tool implementations (`src/mcp/tools/*.ts`), hook entrypoints (`src/hooks/*.ts`), shared safety helpers (`src/shared/security.ts`).
- Key files: `src/mcp/server.ts`, `src/mcp/command-resources.ts`, `src/mcp/tools/project.ts`, `src/mcp/artifact-contracts/index.ts`

**`commands/`:**
- Purpose: Host-consumed command prompt contracts for Blueprint.
- Contains: Root router manifest `commands/blu.toml` and direct command manifests `commands/blu-*.toml`.
- Key files: `commands/blu.toml`, `commands/blu-impact.toml`, `commands/blu-plan-phase.toml`

**`skills/`:**
- Purpose: Reusable orchestration policy and command-family constraints.
- Contains: Skill directories per skill name, each with a `SKILL.md` entrypoint and optional `references/` materials.
- Key files: `skills/blueprint-router/SKILL.md`, `skills/blueprint-phase-planning/SKILL.md`

**`agents/`:**
- Purpose: Bounded deep-work instructions invoked as optional subagents from skills/command contracts.
- Contains: One markdown file per agent name, validated by runtime.
- Key files: `agents/blueprint-planner.md`, `agents/blueprint-mapper.md`, `agents/blueprint-reviewer.md`

**`docs/`:**
- Purpose: Locked “source-of-truth” documentation for command specs, runtime references, and MCP tool contracts.
- Contains: Command catalog (`docs/COMMAND-CATALOG.md`), runtime reference (`docs/RUNTIME-REFERENCE.md`), MCP tool contract documentation (`docs/MCP-TOOLS.md`), plus per-command specs under `docs/commands/`.
- Key files: `docs/COMMAND-CATALOG.md`, `docs/MCP-TOOLS.md`, `docs/commands/root-router.md`

**`hooks/`:**
- Purpose: Host hook registration for advisory guidance around write tools.
- Contains: Hook config consumed by the host (`hooks/hooks.json`).
- Key files: `hooks/hooks.json`

**`dist/`:**
- Purpose: Shipped build output for the extension (must be committed; see `.gitignore`).
- Contains: Bundled JS entrypoints and declaration files for MCP server and hooks.
- Key files: `dist/mcp/server.js`, `dist/hooks/read-before-edit.js`, `dist/mcp/artifact-contracts/schemas/*.json`

**`scripts/`:**
- Purpose: Build automation and helper scripts.
- Contains: Build bundler (`scripts/build.mjs`) and support libs under `scripts/lib/`.
- Key files: `scripts/build.mjs`

**`tests/`:**
- Purpose: Regression and contract tests for manifests, skills, tools, and runtime behavior.
- Contains: Unit tests (`tests/*.test.ts`), integration tests (`tests/*.integration.ts`), helpers/fixtures.
- Key files: `tests/command-catalog.test.ts`, `tests/extension-install.integration.ts`, `tests/hooks.test.ts`

## Key File Locations

**Entry Points:**
- `gemini-extension.json`: Launch configuration for the MCP server (`dist/mcp/server.js`) and env wiring.
- `tabnine-extension.json`: Same as above for Tabnine.
- `src/mcp/server.ts`: MCP server implementation and tool registry assembly.
- `commands/blu.toml`: Root router prompt contract for `/blu`.

**Configuration:**
- `package.json`: Node ESM project metadata + build/test scripts.
- `tsconfig.json`: TypeScript NodeNext compilation settings.
- `hooks/hooks.json`: BeforeTool hook wiring for `write_file|replace`.

**Core Logic:**
- `src/mcp/tools/`: MCP tool handler modules (project/config/state/phase/review/artifacts/impact/update/workspace).
- `src/mcp/artifact-contracts/index.ts`: Artifact schemas/templates and contract resolution.
- `src/mcp/command-resources.ts`: `blueprint://` resource publication for command catalog/runtime contracts.

**Testing:**
- `tests/`: Primary test suite.
- `tests/helpers/`: Test helpers (extension host helpers, etc.).
- `tests/fixtures/`: Test fixtures.

## Naming Conventions

**Files:**
- Command manifests: `commands/blu-<command>.toml` (example: `commands/blu-impact.toml`) and root router `commands/blu.toml`.
- Command spec docs: `docs/commands/<command>.md` (example: `docs/commands/impact.md`).
- Skills: `skills/<skill-name>/SKILL.md` (example: `skills/blueprint-router/SKILL.md`).
- Agents: `agents/<agent-name>.md` (example: `agents/blueprint-mapper.md`).
- MCP tools: `src/mcp/tools/<domain>.ts` (example: `src/mcp/tools/project.ts`).
- Hooks: `src/hooks/<hook-name>.ts` (example: `src/hooks/blueprint-write-guard.ts`).
- Tests: `tests/<area>.test.ts` and integration tests `tests/*.integration.ts` (example: `tests/extension-install.integration.ts`).

**Directories:**
- Skills are grouped by the canonical skill name under `skills/` (example: `skills/blueprint-phase-planning/`).
- MCP runtime code stays under `src/mcp/` with tools isolated in `src/mcp/tools/`.

## Where to Add New Code

**New MCP Tool (new capability):**
- Primary code: `src/mcp/tools/<domain>.ts`
- Registration: add the domain’s `*ToolDefinitions` export to `TOOL_DEFINITIONS` in `src/mcp/server.ts`
- Shared helpers (if needed): `src/shared/security.ts` (cross-cutting safety) or a new module under `src/mcp/`
- Tests: `tests/<domain>-tools.test.ts` (or follow existing naming near the tool family)

**New Command (`/blu-<command>`):**
- Manifest: `commands/blu-<command>.toml`
- Spec doc: `docs/commands/<command>.md`
- Skill: `skills/<primary-skill>/SKILL.md` (or extend an existing skill)
- Catalog entry: `docs/COMMAND-CATALOG.md` (so `src/mcp/tools/project.ts` can compute runtime availability)
- Optional agent: `agents/<agent-name>.md` (only if needed and referenced by the spec/skill)
- Tests: mirror existing “metadata + slice” patterns under `tests/` (examples: `tests/impact-metadata.test.ts`, `tests/impact-tools.test.ts`)

**New Hook (advisory):**
- Entrypoint: `src/hooks/<hook-name>.ts`
- Wiring: `hooks/hooks.json` (host hook registration)
- Build: add to `scripts/build.mjs` entryPoints map so it appears under `dist/hooks/`
- Tests: extend `tests/hooks.test.ts`

**Utilities:**
- Shared safety & parsing: `src/shared/security.ts`
- Runtime vocabulary (paths/FQNs): `src/mcp/runtime-vocabulary.ts`, `src/mcp/command-paths.ts`

## Special Directories

**`dist/`:**
- Purpose: Shipped bundled runtime output for extension install-from-git behavior.
- Generated: Yes (`scripts/build.mjs`).
- Committed: Yes (explicitly not ignored; `.gitignore` documents why).

**`.plan/`:**
- Purpose: Local planning scratchpad.
- Generated: No.
- Committed: No (`.gitignore` ignores `.plan/`).

**`dilution-report/`:**
- Purpose: Local documentation/reporting artifacts.
- Generated: Not detected as generated.
- Committed: No (`.gitignore` ignores `dilution-report/`).

---

*Structure analysis: 2026-05-01*
