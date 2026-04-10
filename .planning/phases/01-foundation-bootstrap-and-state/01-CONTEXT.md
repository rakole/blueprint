# Phase 1: Foundation Bootstrap and State - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the docs-first Blueprint pack into the smallest installable Gemini extension loop: an extension manifest, a `GEMINI.md` context file, the root `/blu` router, the first `/blu:new-project` command, and the MCP-backed `blueprint_command_catalog` plus project/config/state/artifact primitives that make those command paths deterministic. This phase does not expand into Wave 0 read-path commands or later lifecycle flows.

</domain>

<decisions>
## Implementation Decisions

### Bootstrap scope and sequence
- **D-01 [auto]:** Keep Phase 1 limited to the minimum installable loop: `gemini-extension.json`, `GEMINI.md`, `/blu`, `/blu:new-project`, the MCP server bootstrap, and initial fixture-based tests.
- **D-02 [auto]:** Supporting build and test files may be added only when they are required to make that loop installable and testable; broader command scaffolding is deferred.

### Extension packaging and command surface
- **D-03 [auto]:** Use a minimal `gemini-extension.json` modeled on official Gemini CLI extension examples: declare `name`, `version`, `contextFileName`, and only the extra sections needed for Blueprint's MCP-backed runtime.
- **D-04 [auto]:** Keep `/blu` as a safe root router and `/blu:new-project` as the first mutating direct command; do not rely on slash-command chaining or undocumented aliases.
- **D-05 [auto]:** `GEMINI.md` should explain the Blueprint command namespace, the `.blueprint/` versus `~/.gemini/blueprint/` state boundary, and the rule that MCP owns persistent mutations.

### MCP ownership and persistence
- **D-06 [auto]:** All persistent project writes in Phase 1 must happen through MCP tool implementations, not through TOML prompt prose or ad hoc scripts.
- **D-07 [auto]:** The first MCP surface is limited to the read-only `blueprint_command_catalog` router metadata tool plus the project, config, state, and artifact primitives required by `/blu` and `/blu:new-project`; roadmap, workstream, review, and maintenance tooling stay out of scope for this phase.
- **D-08 [auto]:** `.blueprint/config.json` must be written as a fully materialized normalized v2 config object that matches `docs/ARTIFACT-SCHEMA.md`, using hardcoded defaults plus optional user defaults.

### New-project behavior and artifact contract
- **D-09 [auto]:** `/blu:new-project` should scaffold deterministic `.blueprint/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, and `phases/` artifacts from locked defaults and repo context.
- **D-10 [auto]:** `.planning/` remains only the local GSD workspace for building Blueprint; nothing shipped in Phase 1 may write Blueprint runtime state into `.planning/`.

### Test and verification approach
- **D-11 [auto]:** Phase 1 verification should cover fixture-style project initialization happy-path tests, the main missing-precondition path, the highest-risk `new-project` edge case required by the command spec, and a deterministic packaging/install-path smoke proof before broader command coverage.

### the agent's Discretion
- Exact internal module boundaries under `src/`
- Choice of build and test tooling, as long as the extension remains installable and `npm test` can validate deterministic scaffolding
- Non-user-facing helper utilities for path safety, markdown generation, and config normalization

</decisions>

<specifics>
## Specific Ideas

- The immediate implementation slice already locked in project docs is: `gemini-extension.json`, `GEMINI.md`, `commands/blu.toml`, `commands/blu/new-project.toml`, `src/mcp/server.ts`, `src/mcp/tools/project.ts`, `src/mcp/tools/config.ts`, `src/mcp/tools/state.ts`, `src/mcp/tools/artifacts.ts`, and initial `new-project` tests.
- Official Gemini CLI extension examples currently use a root `gemini-extension.json` with `contextFileName: "GEMINI.md"` and optionally an `mcpServers` block for extension-provided tools.
- The install model remains `gemini extensions install https://github.com/<repo>`.
- The root router should prefer inline routing when intent is clear and safe recommendations when it is not, using `blueprint_command_catalog`, `blueprint_project_status`, and `blueprint_config_get` for read-only routing context.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Repo guardrails and locked product contracts
- `AGENTS.md` — repo-specific implementation guardrails, current phase rules, and the immediate next slice
- `docs/DECISIONS.md` — locked Blueprint namespace, state boundary, and architecture decisions
- `docs/ARCHITECTURE.md` — runtime layer split between commands, skills, agents, MCP, and hooks
- `docs/ARTIFACT-SCHEMA.md` — `.blueprint/` tree, normalized config schema, and phase artifact contracts
- `docs/MCP-TOOLS.md` — required Phase 1 tool names and return contracts
- `docs/GEMINI-CONSTRAINTS.md` — Gemini CLI constraints that block a literal GSD-style port

### Phase and command scope
- `docs/IMPLEMENTATION-ORDER.md` — wave ordering and the recommended first code slice
- `docs/commands/root-router.md` — `/blu` contract and safe routing behavior
- `docs/commands/new-project.md` — `/blu:new-project` inputs, outputs, writes, and MCP dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The existing `docs/` pack is the main reusable asset; per-command specs already define the Phase 1 contract.
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, and `.planning/ROADMAP.md` already map the first implementation slice and requirement coverage.

### Established Patterns
- No runtime implementation exists yet; Phase 1 establishes the first executable structure.
- Product state must remain in `.blueprint/`, while global operational state remains in `~/.gemini/blueprint/`.
- Commands stay thin and user-facing; MCP owns deterministic writes.

### Integration Points
- `gemini-extension.json` and `GEMINI.md` anchor extension installation and context loading.
- `commands/blu.toml` and `commands/blu/new-project.toml` are the first Gemini command entrypoints.
- `src/mcp/server.ts` and `src/mcp/tools/*.ts` back the first end-to-end command path.

</code_context>

<deferred>
## Deferred Ideas

- Wave 0 follow-on commands after `new-project`: `settings`, `set-profile`, `help`, `progress`, `health`, and `map-codebase`
- Wave 1 lifecycle commands such as `discuss-phase`, `research-phase`, `plan-phase`, `execute-phase`, `verify-work`, and `next`
- Workspace, review, shipping, and maintenance commands outside the bootstrap loop

</deferred>

---

*Phase: 01-foundation-bootstrap-and-state*
*Context gathered: 2026-04-11*
