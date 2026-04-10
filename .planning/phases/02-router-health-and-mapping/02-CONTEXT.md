# Phase 2: Router, Health, and Mapping - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the rest of Wave 0 usable on top of the shipped Phase 1 Blueprint foundation: implement `settings`, `set-profile`, `help`, `progress`, `health`, and `map-codebase` so they work against real `.blueprint/` state, partial initialization, and brownfield repositories. This phase does not expand into lifecycle orchestration, roadmap mutation, or quality/shipping flows.

</domain>

<decisions>
## Implementation Decisions

### Wave 0 slice ordering
- **D-01 [auto]:** Keep Phase 2 aligned with the locked Wave 0 sequence: land `settings` and `set-profile` first, then `help`/`progress`/`health`, then `map-codebase`, while still organizing execution into the roadmap's three plans (`02-01`, `02-02`, `02-03`).
- **D-02 [auto]:** Build Phase 2 strictly on top of the shipped Phase 1 MCP/tooling surface. Extend existing tool modules only where the command specs require it; do not move persistence into command TOML prompts or ad hoc scripts.

### Config and profile behavior
- **D-03 [auto]:** Treat `settings` as the broad normalized-config workflow over project config plus optional saved defaults, reusing the existing `blueprint_config_get` / `blueprint_config_set` layering model instead of inventing a second config format.
- **D-04 [auto]:** Add a dedicated `blueprint_config_set_profile` path for `set-profile` so project-local profile changes mutate only `model_profile` and never write `~/.gemini/blueprint/defaults.json`.
- **D-05 [auto]:** Phase 2 must explicitly cover legacy/minimal-config migration, malformed saved-default fallback, and rejection of removed repo config keys such as `workflow.use_workspaces`, `workflow.use_workstreams`, and repo-level `hooks.*`, because those repair rules are already locked in docs and only partially implemented in code.

### Router, progress, and health semantics
- **D-06 [auto]:** Keep `/blu`, `help`, `progress`, and other router-style read paths inline and Gemini-native. Do not reintroduce slash-command chaining, hidden aliases, or state inference outside MCP-backed reads.
- **D-07 [auto]:** `help` must remain useful even before `.blueprint/` exists, while `progress` and `health` must distinguish clearly between uninitialized, partially initialized, and fully initialized repos using project/config/state/artifact MCP reads rather than prompt-only heuristics.
- **D-08 [auto]:** `health` stays diagnosis-first. Repair mode may normalize config and sync state only after an explicit confirmation-style path; non-repair mode should surface precise missing or malformed artifacts instead of silently rewriting anything.

### Codebase mapping contract
- **D-09 [auto]:** `map-codebase` should write the full stable `.blueprint/codebase/` document set (`STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `INTEGRATIONS.md`, `CONCERNS.md`) because later Blueprint commands depend on those filenames, even if the first implementation keeps the generated content concise.
- **D-10 [auto]:** Mapping should derive its output from deterministic repo evidence such as `package.json`, source layout, tests, and docs, and should confirm before replacing heavily edited mapping docs.
- **D-11 [auto]:** Because this repository itself is not initialized with `.blueprint/`, Phase 2 should rely on fixture repos for initialized and partial-state coverage while still handling the real uninitialized-root case cleanly in the shipped command behavior.

### Verification approach
- **D-12 [auto]:** Add command-focused fixture coverage for config/profile mutation, read-only router guidance across uninitialized and partial repos, and codebase mapping artifact generation, while continuing to require `npm run typecheck`, `npm run build`, and `npm test` for phase verification.

### the agent's Discretion
- Exact user-facing wording for settings prompts, help text, and progress summaries
- Internal file/module boundaries for new MCP read-path helpers
- Heuristics used to summarize the repo into the six `map-codebase` artifacts, so long as the artifact names and overwrite rules stay fixed

</decisions>

<specifics>
## Specific Ideas

- The current Phase 2 gaps are concrete: `commands/blu/` only contains `new-project.toml`, `src/mcp/tools/config.ts` already supports normalized get/set flows but not a profile-specific setter, `src/mcp/tools/state.ts` only exposes update semantics, and `src/mcp/tools/artifacts.ts` only scaffolds bootstrap artifacts.
- `src/mcp/tools/project.ts` already parses `docs/COMMAND-CATALOG.md` into `blueprint_command_catalog` output and already detects partially initialized `.blueprint/` trees in `blueprint_project_status`; Phase 2 should reuse that rather than re-derive command metadata elsewhere.
- The repo root currently has no `.blueprint/` directory, so successful Phase 2 behavior must cover both fixture-backed initialized repos and the real repo's uninitialized state without pretending the project is already bootstrapped.
- Top-level narrative docs like `README.md` and `docs/HANDOFF.md` still contain pre-Phase-1 wording in places. Downstream planning should trust the live Phase 1 code and `.planning/` artifacts first, then refresh stale repo docs when Phase 2 implementation would otherwise leave misleading guidance.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Repo guardrails and locked Blueprint contracts
- `AGENTS.md` — repo-specific guardrails, preferred read order, and current implementation norms
- `docs/DECISIONS.md` — locked namespace, state-boundary, router, config, and omit-policy decisions
- `docs/ARCHITECTURE.md` — runtime split across commands, skills, agents, MCP, and advisory hooks
- `docs/ARTIFACT-SCHEMA.md` — normalized `.blueprint/` tree, config schema v2, and codebase artifact filenames
- `docs/MCP-TOOLS.md` — required MCP families for config, state, project status, artifacts, and mapping
- `docs/GEMINI-CONSTRAINTS.md` — Gemini-host constraints that forbid slash-command chaining, hook-owned state, or installer-style mutation

### Phase 2 scope and command contracts
- `docs/IMPLEMENTATION-ORDER.md` — Wave 0 ordering, dependency matrix, and recommended command sequence
- `docs/COMMAND-CATALOG.md` — retained-command inventory, skill ownership, and write surfaces
- `docs/commands/root-router.md` — `/blu` routing behavior and blocked-state expectations
- `docs/commands/settings.md` — `settings` inputs, confirmation gates, writes, and edge cases
- `docs/commands/set-profile.md` — `set-profile` contract and project-local profile mutation rules
- `docs/commands/help.md` — `help` read-only routing contract
- `docs/commands/progress.md` — `progress` read-path output requirements, config signals, and next-step guidance
- `docs/commands/health.md` — `health` diagnostics, repair boundaries, and migration expectations
- `docs/commands/map-codebase.md` — `map-codebase` artifact set, overwrite behavior, and external shell dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/mcp/server.ts` already centralizes tool registration; Phase 2 tools can slot into the existing module-array pattern without changing server shape.
- `src/mcp/tools/config.ts` already provides normalized hardcoded-defaults -> saved-defaults -> repo-config composition, reserved-key rejection, and deterministic JSON persistence.
- `src/mcp/tools/project.ts` already exposes `blueprint_command_catalog`, `blueprint_project_init`, and `blueprint_project_status`, including partial `.blueprint/` detection and command-catalog parsing from docs.
- `src/mcp/tools/artifacts.ts` already provides repo-root enforcement, path-safety helpers, deterministic file writes, and bootstrap scaffolding primitives that later artifact helpers can reuse.
- `tests/new-project.test.ts` and `tests/phase-01-validation.test.ts` already establish the temp-repo fixture pattern for Phase 2 command tests.

### Established Patterns
- MCP tools return structured JSON objects and are exported through `*ToolDefinitions` arrays that the server registers directly.
- Command contracts are verified partly by matching required MCP tool names in TOML files and the live server registry.
- Fixture-driven Node tests are the preferred verification style for Blueprint state mutations and repo-root edge cases.
- Repo-root enforcement is intentionally strict: commands fail from nested directories instead of guessing project context.

### Integration Points
- New direct command files belong under `commands/blu/` beside the existing `new-project.toml`.
- New MCP read-path or validation helpers belong in `src/mcp/tools/` and must be added to `src/mcp/server.ts` through the exported tool-definition arrays.
- Read-path commands will rely on `.blueprint/config.json`, `.blueprint/STATE.md`, and future `.blueprint/codebase/*.md` artifacts generated by these Phase 2 changes.
- Mapping output should integrate with the artifact schema under `.blueprint/codebase/` so Phase 3+ discovery/planning commands can consume stable filenames later.

</code_context>

<deferred>
## Deferred Ideas

- Lifecycle routing and continuation commands such as `next`, `pause-work`, and `resume-work` remain Phase 4 work.
- Additional brownfield analysis commands beyond `map-codebase` stay out of scope; omitted `scan` and `intel` should not be reintroduced indirectly.
- Hook implementation, statusline-like affordances, and any repo-level hook toggles remain out of scope for Phase 2.

</deferred>

---

*Phase: 02-router-health-and-mapping*
*Context gathered: 2026-04-11*
