# Blueprint Handoff

## Current State

The repository contains both the original planning pack and a shipped runtime for Wave 0, the Phase 3 discovery commands, the Phase 4 validation/UAT commands, and the governance handoff command.

Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both completed on 2026-04-11. Phase 3 discovery shipped the same day and remains in parity closeout, including validated `research-phase` writes, catalog-aware next-step recovery, advisory hook coverage, and implemented `plan-phase` and `execute-phase` flows on the plan and summary MCP substrates. Phase 4 validation now ships through `validate-phase` and `verify-work` with summary-aware phase artifact persistence. `/blu:add-phase` is also shipped as the append-only Wave 2 roadmap command, while the remaining roadmap and milestone surfaces stay unshipped. Runtime routing remains limited to `implemented` commands.

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
- runtime command manifests for the shipped Wave 0, Phase 3 discovery, `next`, `validate-phase`, `verify-work`, `pause-work`, and `add-phase` surfaces
- shipped Wave 0, Phase 3 discovery, Phase 4 validation, and roadmap append skill files in `skills/`
- shipped Wave 0 and Phase 3 discovery agent contract files in `agents/`
- implementation-aware command catalog metadata in `blueprint_command_catalog`
- seven-document codebase mapping bundle, including `.blueprint/codebase/STRUCTURE.md`
- advisory hook entrypoints under `src/hooks/` plus `hooks/hooks.json`

## Recommended Next Session

Phase 4 validation and UAT are now shipped, so future sessions should focus on the next unshipped command slice while keeping blocked surfaces blocked:

1. Keep `resume-work` blocked until its required manifest and runtime substrate exist
2. Keep `/blu`, `/blu:help`, and `/blu:progress` limited to commands whose catalog entry is `implemented`
3. Use the shipped validation and UAT commands when closing out phase evidence instead of reintroducing prompt-only verification

## First Implementation Slice

The next unshipped slice should land in dependency order after validation/UAT closeout:

- `resume-work`
- `audit-milestone`
- `remove-phase`
- `complete-milestone`
- `new-milestone`

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

The next milestone is successful when the shipped Phase 4 validation commands keep their summary-aware and resumable guarantees intact, and later commands remain blocked until their substrate exists.
