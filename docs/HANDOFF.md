# Blueprint Handoff

## Current State

The repository contains both the original planning pack and a shipped Wave 0 runtime for `/blu`, `new-project`, `settings`, `set-profile`, `help`, `progress`, `health`, and `map-codebase`.

Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both completed on 2026-04-11. Phase 3 discovery is now unblocked for implementation work, while runtime routing remains limited to `implemented` commands.

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

Start Phase 3 Phase Discovery implementation:

1. Implement `discuss-phase` on the existing phase-artifact and state contracts
2. Implement `research-phase` with explicit research outputs and bounded agent orchestration
3. Implement `ui-phase` while preserving thin commands, MCP-owned persistence, and documented subagent boundaries
4. Keep `/blu`, `/blu:help`, and `/blu:progress` limited to commands whose catalog entry is `implemented`

## First Implementation Slice

Phase 3 should land in dependency order:

- `discuss-phase`
- `research-phase`
- `ui-phase`
- only after those are real should later lifecycle or roadmap substrate expand

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

The next milestone is successful when the Phase 3 discovery commands are implemented without regressing the closed Phase 2.2 contract guarantees, and later commands remain blocked until their substrate exists.
