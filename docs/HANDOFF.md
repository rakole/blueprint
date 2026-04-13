# Blueprint Handoff

## Current State

The repository contains both the original planning pack and a shipped runtime for Wave 0, the Phase 3 discovery commands, the read-only `list-phase-assumptions` discovery command, the Phase 4 validation/UAT commands, the governance handoff/resume commands, the current Wave 2 roadmap/milestone commands including `insert-phase` and the milestone-closeout trio, the shipped Wave 3 capture slice through `review-backlog`, the first shipped Wave 3 lightweight execution command `quick`, the first shipped Wave 4 review command `secure-phase`, and the first shipped Wave 4 docs command `docs-update`.

Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both completed on 2026-04-11. Phase 3 discovery shipped the same day and remains in parity closeout, while the live lifecycle slice now also includes `plan-phase`, `execute-phase`, `validate-phase`, and `verify-work` on the plan, summary, and validation MCP substrates. The bounded Wave 3 `quick` flow, the governance handoff/resume pair, the current Wave 2 roadmap-admin slice (`add-phase`, `insert-phase`, `remove-phase`, `plan-milestone-gaps`, `audit-milestone`, `complete-milestone`, `milestone-summary`, `new-milestone`, and `list-phase-assumptions`), the Wave 3 capture commands `note`, `add-todo`, `add-backlog`, and `review-backlog`, the Wave 4 docs command `docs-update`, and the Wave 4 review command `secure-phase` are also shipped. Runtime routing remains limited to `implemented` commands.

The governance handoff/resume pair now ships through `pause-work` and `resume-work`, with `pause-work` owning the durable handoff report and `resume-work` restoring the next safe implemented action from it. `secure-phase` now ships as the first review-family command on top of `blueprint_review_record`, the discoverable `blueprint-review` skill, and the bounded `blueprint-security-auditor` contract.

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
- runtime command manifests for the shipped Wave 0, discovery, planning, execution, validation/UAT, lightweight execution, governance, current roadmap-admin, review, and docs surfaces
- shipped `blueprint-roadmap-admin` skill file for the roadmap append, removal, gap-planning, and milestone audit slice
- shipped Wave 0, discovery, planning, execution, validation, review, governance, roadmap-admin, and docs skill files in `skills/`
- shipped mapping, discovery, planning, execution, validation, review, roadmap-support, and docs agent contract files in `agents/`
- implementation-aware command catalog metadata in `blueprint_command_catalog`
- seven-document codebase mapping bundle, including `.blueprint/codebase/STRUCTURE.md`
- advisory hook entrypoints under `src/hooks/` plus `hooks/hooks.json`
- the Wave 2 anti-drift build pack in `docs/build/` for parallel 1-to-3-agent closeout loops

## Recommended Next Session

Wave 2 milestone closeout plus the shipped capture, review, and docs slices are now shipped, so future sessions should focus on preserving those contracts while keeping blocked surfaces blocked:

1. Keep `/blu`, `/blu-help`, and `/blu-progress` limited to commands whose catalog entry is `implemented`
2. Use the shipped validation, UAT, and milestone closeout sequence (`audit-milestone` -> `complete-milestone` -> `milestone-summary` -> `new-milestone`) instead of reintroducing prompt-only verification or ad hoc archival steps
3. Keep the shipped `insert-phase` contract aligned across docs, manifest, skill, MCP substrate, and tests

## First Replanned Slice

The next implementation slice should be freshly planned after Wave 2 closeout:

- preserve `insert-phase` as a shipped Wave 2 command instead of letting it drift back into docs-only status
- otherwise the next post-Wave-2 rollout should start from a newly locked Wave 3 or later slice instead of pretending the closeout trio is still pending

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

The next milestone is successful when the shipped lifecycle, governance, roadmap-admin, capture, review, and docs commands keep their current guarantees intact, the Wave 2 closeout trio plus `insert-phase` stay aligned across docs and runtime, and later commands remain blocked until their substrate exists.
