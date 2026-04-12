# Blueprint Drift Ledger

## Status

- Checkpoint: Phase 2.2 future-contract drift repair
- State: closed on 2026-04-11 after Phase 2.1 completed earlier that day
- Result: all Phase 2.2 exit criteria validated; the later discovery, lifecycle, governance, and roadmap-admin follow-up slices are now shipped, and the current repair round is closing extension-surface drift without widening runtime exposure
- Scope: repair control-plane and future-command contract drift before any broader post-Phase-3 expansion
- Runtime posture: salvage the working Wave 0 runtime, keep blocked command exposure unchanged, and do not invent new runtime substrate in this checkpoint

## Phase 2.1 Closure

The Phase 2.1 drift recovery gate closed on 2026-04-11 with these outcomes preserved:

- shipped Wave 0 skills and agent contracts exist
- `blueprint_command_catalog` is runtime-aware
- `map-codebase` owns the seven-document codebase bundle, including `STRUCTURE.md`
- `/blu`, `/blu:help`, and `/blu:progress` stay limited to `implemented` commands

Phase 2.2 reopens this ledger for follow-up repair work without undoing those results.

## Locked Recovery Rules

- Preserve working Phase 1 and Phase 2 code unless it violates an explicit Blueprint decision.
- Do not expose or recommend Phase 3+ commands while this checklist is open.
- Treat `.blueprint/` as Blueprint runtime truth and `.planning/` as local implementation bookkeeping only.
- Preserve Blueprint-specific deltas, but restore accidental GSD dilution.
- Keep `blueprint_command_catalog` status semantics unchanged during Phase 2.2; agent protection is docs-plus-tests only in this slice.
- Future docs may describe the full intended architecture for retained commands, but runtime exposure still requires an `implemented` catalog entry.

## Command Status Vocabulary

- `planned`: documented but not yet shipped
- `implemented`: manifest, primary skill, and required MCP tools are all present
- `blocked`: not safe to expose because required runtime pieces are missing
- `repairing`: partially shipped and under active drift repair

## Shipped Wave 0 Surface

- `/blu`
- `/blu:new-project`
- `/blu:settings`
- `/blu:set-profile`
- `/blu:help`
- `/blu:progress`
- `/blu:health`
- `/blu:map-codebase`

## Post-Close Follow-Up

Phase 2.2 remains closed. The relevant follow-up for this branch is narrower than a new drift checkpoint:

- `discuss-phase`, `research-phase`, `ui-phase`, `plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, `next`, `pause-work`, and `resume-work` are now shipped
- `add-phase`, `remove-phase`, `plan-milestone-gaps`, `audit-milestone`, and `list-phase-assumptions` are now shipped
- the initial discovery and lifecycle rollout needed follow-up work on artifact depth, command vocabulary, discoverability, and bounded-agent contracts
- current repair work is replacing placeholder persistence, stale runtime wording, and packaging drift without widening command exposure
- a dedicated custom-agent drift audit was added on 2026-04-12 in `docs/drift-fixes/2026-04-12-custom-agent-audit-and-fix-plan.md`; the next repair round should restore Gemini-valid agent definitions and stronger bounded-agent contracts without changing command status semantics
- later review, workspace, workstream, update, patch, and still-unimplemented roadmap/maintenance commands remain non-routable until their own substrate exists

## Evidence Of Phase 2.2 Drift

| Drift Area | Evidence | Repair Direction |
|---|---|---|
| Control-plane narrative still treated Phase 2.1 as active | `AGENTS.md`, `README.md`, `docs/HANDOFF.md`, and `MEMORY.md` still described an active Phase 2.1 checkpoint after the inserted Phase 2.2 work started on 2026-04-11 | Truth-sync all control-plane docs and `.planning` state around Phase 2.1 closure and active Phase 2.2 work |
| Drift-repair requirement traceability was incomplete | `.planning/REQUIREMENTS.md` omitted `DRIFT-01` through `DRIFT-07`, and Foundation completion markers lagged the verified Phase 2 runtime | Backfill drift requirements and phase mapping in the requirements ledger |
| Future command ownership drifted across docs | `docs/SKILLS-AND-AGENTS.md` did not match the canonical ownership in `docs/COMMAND-CATALOG.md` and the per-command specs for `next`, `do`, `pause-work`, `resume-work`, and `plan-milestone-gaps` | Treat the catalog plus command specs as canonical and repair conflicting docs |
| Future parity docs could flatten orchestration | Planned high-risk command docs need an explicit guard against collapsing skill-led or agent-assisted flows into command-only prose | Refresh migration and parity notes so later slices preserve Blueprint's thin-command, skill-led architecture |
| Later commands remain intentionally blocked | Review, workspace, workstream, update, and patch MCP families are still missing, and some later roadmap or maintenance flows are still spec-only | Keep blocked or planned commands unroutable and do not change runtime status semantics in this checkpoint |

## Allowed Blueprint Divergences

These are intentional and should not be “fixed away”:

- `/blu` namespace and direct `/blu:<command>` commands
- `.blueprint/` as project-local runtime state
- `~/.gemini/blueprint/` as the only global mutable state root
- Gemini-native routing instead of slash-command chaining
- MCP-owned persistence rather than script-owned persistence
- advisory hooks instead of hook-owned state transitions
- advisory-only `update`
- no repo-level hook config in `.blueprint/config.json`
- no in-session extension self-mutation

## Phase 2.2 Work Completed

- [x] Reopen `docs/DRIFT.MD` as the live Phase 2.2 ledger instead of a closed Phase 2.1 note
- [x] Truth-sync `AGENTS.md`, `README.md`, `GEMINI.md`, `docs/HANDOFF.md`, `MEMORY.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, and `.planning/REQUIREMENTS.md`
- [x] Backfill `DRIFT-01` through `DRIFT-07` traceability
- [x] Repair future command ownership metadata across the catalog, skills inventory, migration matrix, and per-command specs
- [x] Add regression coverage for control-plane and command-contract drift
- [x] Keep `/blu`, `/blu:help`, and `/blu:progress` limited to implemented commands without changing runtime status semantics

## Remaining Blocked Surfaces

The following families remain intentionally blocked until substrate exists:

- review MCP tools
- workspace MCP tools
- workstream MCP tools
- update MCP tools
- patch MCP tools

The roadmap-admin family is only partially shipped. Later commands such as `insert-phase`, `complete-milestone`, `new-milestone`, `milestone-summary`, `do`, `quick`, and `ship` must remain non-routable in the runtime catalog until their own runtime substrate exists.

## Phase 2.2 Exit Criteria

- [x] Control-plane docs describe Phase 2.1 as complete on 2026-04-11 and Phase 2.2 as the active checkpoint
- [x] `DRIFT-01` through `DRIFT-07` exist in `.planning/REQUIREMENTS.md` with phase mapping
- [x] Future command metadata is consistent across `docs/COMMAND-CATALOG.md`, `docs/SKILLS-AND-AGENTS.md`, `docs/GSD-RUNTIME-MIGRATION.md`, and `docs/commands/*.md`
- [x] Regression tests fail on control-plane or command-contract drift
- [x] `blueprint_command_catalog` status semantics remain unchanged
- [x] Phase 3+ command exposure remains frozen while substrate is still missing

## Closure Decision

- Phase 2.2 closed on 2026-04-11 after the drift suite and full test suite both passed.
- Phase 3 discovery later shipped on 2026-04-11.
- Current follow-up work repairs discovery parity gaps without changing the implemented-only routing rule.
- `/blu`, `/blu:help`, and `/blu:progress` must still surface only commands whose catalog entry is `implemented`.
- Documented future commands remain non-routable until their manifest, primary skill, and required MCP tools exist.

## Post-Close Guardrails

Phase 2.2 closure does not relax these runtime protections:

1. routing still surfaces only `implemented` commands
2. still-unimplemented command families remain blocked until substrate exists
3. Phase 3 implementation may proceed, but Phase 3+ commands do not become runnable through docs alone
