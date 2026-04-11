# Blueprint Handoff

## Current State

The repository contains both the original planning pack and a shipped runtime for `/blu`, `new-project`, `settings`, `set-profile`, `help`, `progress`, `health`, `map-codebase`, `discuss-phase`, `research-phase`, and `ui-phase`.

Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both completed on 2026-04-11. Phase 3 discovery shipped later that day, and the current repair focus is upgrading the discovery trio from scaffold-heavy persistence to substantive artifact writes while runtime routing remains limited to `implemented` commands.

## What Future Sessions Already Have

- locked command set
- locked omit list
- locked state locations
- locked MCP boundary
- locked hook-policy boundaries plus explicit hook deferral
- dependency-ordered implementation queue
- one spec file per retained command
- command catalog and phase lifecycle references for quick lookup
- Gemini-specific constraint notes to keep implementation aligned with the host CLI
- runtime command manifests for the shipped Wave 0 plus Phase 3 discovery surface
- shipped skill files in `skills/`, including `blueprint-phase-discovery`
- shipped agent contract files in `agents/`, including `blueprint-researcher` and `blueprint-ui-designer`
- implementation-aware command catalog metadata in `blueprint_command_catalog`
- seven-document codebase mapping bundle, including `.blueprint/codebase/STRUCTURE.md`

## Recommended Next Session

Continue the Phase 3 discovery repair:

1. keep `discuss-phase`, `research-phase`, and `ui-phase` on substantive artifact-write paths
2. preserve checkpoint-aware recovery for `discuss-phase`
3. keep `/blu`, `/blu:help`, and `/blu:progress` limited to commands whose catalog entry is truthfully `implemented`
4. defer hooks and broader Phase 4 rollout until the discovery repair is complete

## Current Repair Slice

- `discuss-phase` parity and checkpoint behavior
- `research-phase` substantive artifact persistence
- `ui-phase` substantive UI-spec and skip-rationale persistence
- only after those remain green should later lifecycle or roadmap substrate expand

## Shared Risks To Watch

- Gemini command routing may tempt inline duplication instead of reusing skills and MCP tools.
- `update` must remain advisory; do not let implementation drift toward self-updating the extension.
- workspace removal, patch replay, and undo need especially strict mutation boundaries.
- keep `.blueprint/` artifacts stable while adding command code; later commands depend on early schema choices.
- keep hook enablement in `hooks/hooks.json` once hook code exists; do not reintroduce repo-level hook toggles while building config support.

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

The next milestone is successful when the shipped Phase 3 discovery commands are fully substantive and checkpoint-safe without regressing the closed Phase 2.2 contract guarantees, and later commands remain blocked until their substrate exists.
