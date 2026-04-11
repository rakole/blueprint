# Phase 3: Phase Discovery - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning repair and implementation

<domain>
## Phase Boundary

Implement the first Wave 1 lifecycle slice for Blueprint: `discuss-phase`, `research-phase`, and `ui-phase`. This phase adds the missing phase-aware MCP substrate, lands the shared discovery skill, and makes the three pre-planning discovery commands executable without reopening Phase 2.2 routing semantics or exposing later lifecycle commands.

The repair focus inside this phase is narrow but important: keep command-by-command implementation aligned with the source-of-truth docs outside `.planning/`, prevent temporary control-plane drift while commands become implemented, and avoid inventing new phase artifacts that were never locked in the Blueprint schema.

</domain>

<decisions>
## Implementation Decisions

### Discovery Slice Scope
- **D-01 [review]:** Keep Phase 3 limited to `discuss-phase`, `research-phase`, and `ui-phase` exactly as `AGENTS.md`, `docs/HANDOFF.md`, and `docs/IMPLEMENTATION-ORDER.md` prescribe.
- **D-02 [review]:** Do not change `src/mcp/tools/project.ts` status semantics during this phase. Commands become runtime-implemented when manifests, primary skills, and required MCP tools exist.

### Contract Alignment
- **D-03 [review]:** When a Phase 3 command becomes implemented, update command-catalog metadata and its regression expectations in the same plan so the repo does not reintroduce Phase 2.2-style drift.
- **D-04 [review]:** The shared `blueprint-phase-discovery` skill-family status may flip only after the skill file and the three core discovery commands (`discuss-phase`, `research-phase`, `ui-phase`) are all real. Command-level rollout remains canonical in `docs/COMMAND-CATALOG.md`.

### UI Output Contract
- **D-05 [review]:** `ui-phase` keeps a single declared phase-scoped artifact: `XX-UI-SPEC.md`.
- **D-06 [review]:** `XX-UI-SPEC.md` may contain either a real UI contract or an explicit rationale that UI work was intentionally skipped. Do not invent a second phase artifact for UI-skip handling during Phase 3.
- **D-07 [review]:** `ui-phase` must honor `workflow.ui_phase` and `workflow.ui_safety_gate` from effective config via `blueprint_config_get`.

### Bounded Agent Expectations
- **D-08 [review]:** `research-phase` and `ui-phase` should land with their documented bounded-agent contracts (`blueprint-researcher`, `blueprint-ui-designer`) instead of postponing agent files indefinitely.
- **D-09 [review]:** `discuss-phase` may reference `blueprint-researcher` selectively, but the initial runtime slice ships the core context-capture path first rather than upstream-style chaining or power modes.

### Implemented-Only Routing
- **D-10 [review]:** Phase 3 commands may mention later lifecycle steps as future follow-up, but they must not present blocked commands such as `plan-phase` as runnable next actions before the runtime catalog marks them implemented.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Repo Guardrails
- `AGENTS.md`
- `docs/HANDOFF.md`
- `MEMORY.md`

### Locked Product And Runtime Contracts
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/IMPLEMENTATION-ORDER.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/GSD-RUNTIME-MIGRATION.md`

### Per-Command Specs
- `docs/commands/discuss-phase.md`
- `docs/commands/research-phase.md`
- `docs/commands/ui-phase.md`

### Runtime Surfaces
- `src/mcp/tools/project.ts`
- `src/mcp/server.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/state.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/mcp/tools/project.ts` already makes runtime status implementation-aware and will auto-elevate a command once manifest, primary skill, and required tools are present.
- `src/mcp/tools/artifacts.ts` currently supports only bootstrap and codebase scaffolds, so Phase 3 needs explicit phase-artifact support rather than prompt-only file creation.
- `tests/command-catalog.test.ts` is the current regression anchor for implemented-versus-blocked command exposure.

### Established Patterns
- The repo already tolerates an implemented skill owning both shipped and not-yet-shipped commands (`blueprint-router`, `blueprint-governance`), so Phase 3 can safely flip the shared discovery-skill status once its runtime file exists without making `list-phase-assumptions` runnable.
- Command docs, the catalog, the migration matrix, and tests are treated as contract surfaces, not optional commentary.

</code_context>

<specifics>
## Specific Ideas

- `discuss-phase` should explicitly ship only the core context flow for now.
- `research-phase` should route to `ui-phase` when applicable and otherwise fall back to implemented-safe guidance such as `/blu:progress`, not directly to blocked lifecycle commands.
- `ui-phase` should treat `XX-UI-SPEC.md` as the only durable phase output regardless of whether a full UI contract is needed.

</specifics>

<deferred>
## Deferred Ideas

- `plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, `next`, `pause-work`, and `resume-work` remain later-wave work.
- Any richer discuss batching, chaining, or power-mode flows stay deferred until their downstream lifecycle substrate exists.

</deferred>

---

*Phase: 03-phase-discovery*
*Context gathered: 2026-04-11*
