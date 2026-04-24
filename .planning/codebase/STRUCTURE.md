# Codebase Structure

**Analysis Date:** 2026-04-24

## Directory Layout

```text
blueprint-map-codebase-20260424/
├── commands/            # Slash-command manifests (`/blu` and `/blu-<command>`)
├── skills/              # Skill bundles (`skills/<skill>/SKILL.md`)
├── agents/              # Optional bounded subagent contracts
├── src/                 # TypeScript runtime source (MCP server, tools, hooks, security)
├── docs/                # Product, architecture, command, and runtime contracts
├── tests/               # Unit/integration tests and fixtures
├── scripts/             # Build and smoke-test scripts
├── hooks/               # Hook registration config (`hooks.json`)
├── dist/                # Built JS and declaration outputs consumed by extension hosts
└── .planning/codebase/  # Mapper-generated planning docs for local workflow
```

## Directory Purposes

**`commands/`:**
- Purpose: Host command entry manifests.
- Contains: `blu.toml` root router plus `blu-*.toml` per direct command.
- Key files: `commands/blu.toml`, `commands/blu-plan-phase.toml`, `commands/blu-execute-phase.toml`, `commands/blu-map-codebase.toml`.

**`skills/`:**
- Purpose: Shared orchestration contracts grouped by command family.
- Contains: One directory per skill with `SKILL.md`.
- Key files: `skills/blueprint-router/SKILL.md`, `skills/blueprint-phase-planning/SKILL.md`, `skills/blueprint-phase-execution/SKILL.md`, `skills/blueprint-maintenance/SKILL.md`.

**`agents/`:**
- Purpose: Subagent contracts for bounded deep work.
- Contains: `blueprint-*.md` files with frontmatter + execution rules.
- Key files: `agents/blueprint-planner.md`, `agents/blueprint-executor.md`, `agents/blueprint-verifier.md`, `agents/blueprint-mapper.md`.

**`src/mcp/`:**
- Purpose: MCP runtime and composition.
- Contains: Server bootstrap, runtime resource projections, host/path helpers, skill/agent metadata loaders.
- Key files: `src/mcp/server.ts`, `src/mcp/command-resources.ts`, `src/mcp/runtime-host.ts`, `src/mcp/skill-metadata.ts`, `src/mcp/agent-definition.ts`.

**`src/mcp/tools/`:**
- Purpose: Deterministic state engine APIs.
- Contains: Domain tool modules for project/config/state/phase/artifacts/review/workspace/update.
- Key files: `src/mcp/tools/project.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/state.ts`, `src/mcp/tools/workspace.ts`.

**`src/mcp/artifact-contracts/`:**
- Purpose: Canonical artifact template and validation registry.
- Contains: Contract IDs, template renderers, and validation metadata.
- Key files: `src/mcp/artifact-contracts/index.ts`.

**`src/hooks/`:**
- Purpose: Advisory hook implementations for write-time guardrails.
- Contains: Hook runners and three advisory policies.
- Key files: `src/hooks/read-before-edit.ts`, `src/hooks/blueprint-write-guard.ts`, `src/hooks/workflow-advisory.ts`, `src/hooks/shared.ts`.

**`src/shared/`:**
- Purpose: Shared low-level runtime utilities.
- Contains: Security/path/prompt-boundary helper functions.
- Key files: `src/shared/security.ts`.

**`docs/`:**
- Purpose: Locked product/runtime reference docs and command specs.
- Contains: Architecture and schema docs plus `docs/commands/*.md`.
- Key files: `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/ARTIFACT-SCHEMA.md`, `docs/MCP-TOOLS.md`, `docs/COMMAND-CATALOG.md`.

**`tests/`:**
- Purpose: Runtime contract regression coverage.
- Contains: Command metadata tests, MCP tool tests, integration tests, fixture repos.
- Key files: `tests/command-catalog.test.ts`, `tests/phase-planning-tools.test.ts`, `tests/execute-phase-summary-tools.test.ts`, `tests/fixtures/...`.

## Key File Locations

**Entry Points:**
- `gemini-extension.json`: Gemini extension bootstrap and MCP process wiring.
- `tabnine-extension.json`: Tabnine extension bootstrap and MCP process wiring.
- `src/mcp/server.ts`: MCP server runtime entrypoint and tool/resource registration.
- `commands/blu.toml`: Root router command entrypoint.

**Configuration:**
- `hooks/hooks.json`: Host advisory hook registration map.
- `tsconfig.json`: TypeScript compilation settings.
- `package.json`: Build/test scripts and runtime dependencies.
- `src/mcp/runtime-host.ts`: Host-global path resolution for defaults, workspaces, patches, and updates.

**Core Logic:**
- `src/mcp/tools/*.ts`: Stateful tool handlers and domain behavior.
- `src/mcp/artifact-contracts/index.ts`: Artifact schema/templating authority.
- `src/shared/security.ts`: Shared path and content safety boundary.
- `src/mcp/command-resources.ts`: Read-only resource projection layer.

**Testing:**
- `tests/*.test.ts`: Runtime and contract regression tests.
- `tests/fixtures/`: Fixture repos and config snapshots used by tests.
- `tests/helpers/extension-hosts.ts`: Shared test helper for host runtime variants.

## Naming Conventions

**Files:**
- Command manifests use `commands/blu-<command>.toml` and root uses `commands/blu.toml`.
- Skills use `skills/<skill-name>/SKILL.md` with kebab-case skill names (for example `skills/blueprint-phase-validation/SKILL.md`).
- Agent contracts use `agents/blueprint-<role>.md`.
- MCP tool modules map one domain per file under `src/mcp/tools/` (`project.ts`, `phase.ts`, `workspace.ts`).
- Docs use uppercase anchor docs (`docs/ARCHITECTURE.md`) and kebab-case command specs (`docs/commands/plan-phase.md`).

**Directories:**
- Top-level runtime directories are stable nouns: `commands`, `skills`, `agents`, `src`, `docs`, `tests`.
- Source runtime layers are grouped by concern: `src/mcp`, `src/hooks`, `src/shared`.
- Tool handlers stay flat in `src/mcp/tools/`; add new tool families as a new `*.ts` file in this directory.

## Where to Add New Code

**New Feature:**
- Primary code: add/extend MCP behavior in `src/mcp/tools/<domain>.ts` and wire registration via exported `*ToolDefinitions`.
- Command surface: add `commands/blu-<command>.toml` and update `commands/blu.toml` only if root routing text needs adjustment.
- Skill orchestration: add or update `skills/<skill>/SKILL.md`.
- Contract docs: add `docs/commands/<command>.md` and update `docs/COMMAND-CATALOG.md`.
- Tests: add matching `tests/<command-or-domain>.test.ts` and fixture data under `tests/fixtures/` when needed.

**New Component/Module:**
- MCP runtime helper: place in `src/mcp/` when shared across tool modules.
- Tool-domain logic: place in `src/mcp/tools/` if it exposes or supports MCP tools.
- Hook logic: place in `src/hooks/` and register in `hooks/hooks.json` only for advisory behavior.

**Utilities:**
- Shared security/path utilities: `src/shared/security.ts` (or sibling file under `src/shared/` if concern is distinct).
- Build/test utilities: `scripts/` or `tests/helpers/` depending on runtime vs test-only usage.

## Special Directories

**`dist/`:**
- Purpose: Built JavaScript bundles and `.d.ts` outputs consumed by extension hosts.
- Generated: Yes (via `scripts/build.mjs`).
- Committed: Yes (repository currently includes `dist/mcp/server.js`, `dist/hooks/*.js`, and declarations).

**`.planning/`:**
- Purpose: Local planning and mapper outputs for implementation workflow.
- Generated: Yes (by planning/mapping commands).
- Committed: Project-dependent; this repository currently contains `.planning/codebase/`.

**`tests/fixtures/`:**
- Purpose: Controlled fixture repositories and sample Blueprint state trees.
- Generated: No (hand-authored test assets).
- Committed: Yes.

---

*Structure analysis: 2026-04-24*
