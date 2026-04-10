# Blueprint Handoff

## Current State

The repository contains both the original planning pack and a shipped Wave 0 runtime for `/blu`, `new-project`, `settings`, `set-profile`, `help`, `progress`, `health`, and `map-codebase`.

The current checkpoint is Phase 2.1 drift repair: bring docs, command discovery, skills, agents, and tests back into agreement before any Phase 3 work lands.

## What Future Sessions Already Have

- locked command set
- locked omit list
- locked state locations
- locked MCP boundary
- locked hook and policy boundaries
- dependency-ordered implementation queue
- one spec file per retained command
- command catalog and phase lifecycle references for quick lookup
- Gemini-specific constraint notes to keep implementation aligned with the host CLI
- runtime command manifests for the shipped Wave 0 surface
- shipped Wave 0 skill files in `skills/`
- shipped Wave 0 agent contract files in `agents/`
- implementation-aware command catalog metadata in `blueprint_command_catalog`
- seven-document codebase mapping bundle, including `.blueprint/codebase/STRUCTURE.md`

## Recommended Next Session

Continue the drift-repair checklist in `docs/DRIFT.MD`:

1. Finish any remaining truth-sync gaps across `AGENTS.md`, `README.md`, `GEMINI.md`, `MEMORY.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md`
2. Keep `/blu`, `/blu:help`, and `/blu:progress` limited to commands whose catalog entry is `implemented`
3. Audit remaining Wave 0 behavior against local upstream GSD assets and document only explicit Blueprint deltas
4. Do not begin Phase 3 or expose later commands until the drift checklist is closed

## First Implementation Slice

After the drift checkpoint closes, the next implementation slice should target the missing substrate rather than more command manifests:

- roadmap MCP tools
- phase MCP tools
- review MCP tools
- workspace and workstream MCP tools
- update and patch MCP tools
- the commands that depend on those families, in dependency order

## Shared Risks To Watch

- Gemini command routing may tempt inline duplication instead of reusing skills and MCP tools.
- `update` must remain advisory; do not let implementation drift toward self-updating the extension.
- workspace removal, patch replay, and undo need especially strict mutation boundaries.
- keep `.blueprint/` artifacts stable while adding command code; later commands depend on early schema choices.
- keep hook enablement in `hooks/hooks.json`; do not reintroduce repo-level hook toggles while building config support.

## Documentation Order To Reuse

When implementing a command, consult in this order:

1. `docs/DECISIONS.md`
2. `docs/DRIFT.MD`
3. `docs/ARCHITECTURE.md`
4. `docs/ARTIFACT-SCHEMA.md`
5. `docs/MCP-TOOLS.md`
6. `docs/GEMINI-CONSTRAINTS.md`
7. `docs/PHASE-LIFECYCLE.md`
8. `docs/SKILLS-AND-AGENTS.md`
9. `docs/IMPLEMENTATION-ORDER.md`
10. `docs/COMMAND-CATALOG.md`
11. `docs/commands/<command>.md`

## Success Marker For The Next Milestone

The next milestone is successful when the drift checklist is closed, the shipped Wave 0 runtime is parity-audited and regression-tested, and later commands remain blocked until their substrate exists.
