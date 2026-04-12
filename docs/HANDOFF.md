# Blueprint Handoff

## Current State

The repository contains both the original planning pack and a shipped runtime for Wave 0, the Phase 3 discovery commands, the read-only `list-phase-assumptions` discovery command, the Phase 4 validation/UAT commands, the governance handoff/resume commands, and the current Wave 2 roadmap/milestone commands.

Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both completed on 2026-04-11. Phase 3 discovery shipped the same day and remains in parity closeout, while the live lifecycle slice now also includes `plan-phase`, `execute-phase`, `validate-phase`, and `verify-work` on the plan, summary, and validation MCP substrates. The governance handoff/resume pair and the current Wave 2 roadmap-admin slice (`add-phase`, `remove-phase`, `plan-milestone-gaps`, `audit-milestone`, and `list-phase-assumptions`) are also shipped. Runtime routing remains limited to `implemented` commands.

The governance handoff/resume pair now ships through `pause-work` and `resume-work`, with `pause-work` owning the durable handoff report and `resume-work` restoring the next safe implemented action from it.

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
- runtime command manifests for the shipped Wave 0, discovery, planning, execution, validation/UAT, governance, and current roadmap-admin surfaces
- shipped `blueprint-roadmap-admin` skill file for the roadmap append, removal, gap-planning, and milestone audit slice
- shipped Wave 0, discovery, planning, execution, validation, governance, and roadmap-admin skill files in `skills/`
- shipped mapping, discovery, planning, execution, validation, and roadmap-support agent contract files in `agents/`
- implementation-aware command catalog metadata in `blueprint_command_catalog`
- seven-document codebase mapping bundle, including `.blueprint/codebase/STRUCTURE.md`
- advisory hook entrypoints under `src/hooks/` plus `hooks/hooks.json`

## Recommended Next Session

Phase 4 validation and UAT are now shipped, so future sessions should focus on the next unshipped command slice while keeping blocked surfaces blocked:

1. Keep `/blu`, `/blu:help`, and `/blu:progress` limited to commands whose catalog entry is `implemented`
2. Use the shipped validation, UAT, and milestone-audit commands when closing out phase and milestone evidence instead of reintroducing prompt-only verification
3. Start the next roadmap slice with `complete-milestone`

## First Implementation Slice

The next unshipped slice should land in dependency order after validation/UAT closeout:

- `complete-milestone`
- `milestone-summary`
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

The next milestone is successful when the shipped lifecycle, governance, and roadmap-admin commands keep their current guarantees intact, and later commands remain blocked until their substrate exists.
