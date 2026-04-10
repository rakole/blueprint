# Blueprint Drift Ledger

## Status

- Checkpoint: Phase 2.1 drift recovery gate
- State: completed on 2026-04-11
- Scope: repair drift introduced across Phase 1 and Phase 2 before any Phase 3 expansion
- Stance: salvage the current Wave 0 runtime; do not blindly revert shipped work

## Locked Recovery Rules

- Preserve working Wave 0 code unless it violates an explicit Blueprint decision.
- Do not expose or recommend Phase 3+ commands while this checklist is open.
- Treat `.blueprint/` as Blueprint runtime truth and `.planning/` as local implementation bookkeeping only.
- Preserve Blueprint-specific deltas, but restore accidental GSD dilution.

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

## Evidence Of Drift

| Drift Area | Evidence | Repair Direction |
|---|---|---|
| Control docs claimed docs-only or no runtime | `AGENTS.md`, `docs/HANDOFF.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` lagged the shipped Wave 0 surface | Truth-sync control docs and local implementation state |
| Router treated docs as runtime truth | `blueprint_command_catalog` parsed `docs/COMMAND-CATALOG.md` without checking manifests, skills, or tool presence | Make command discovery implementation-aware and route only `implemented` commands |
| Skills and agents were promised but absent | `docs/ARCHITECTURE.md` and `docs/SKILLS-AND-AGENTS.md` described runtime `skills/` and `agents/` that did not exist | Ship Wave 0 skill files and agent contracts |
| `map-codebase` lost upstream output scope | Runtime and docs only described six codebase docs | Restore `STRUCTURE.md` and treat the bundle as seven documents |
| `new-project` drifted toward simple scaffolding | Upstream GSD treats bootstrap as a deeper orchestration flow with durable roadmap and requirement traceability | Keep MCP bootstrap, but document the higher-level bootstrap contract through `blueprint-bootstrap` |
| Later commands could be recommended too early | `plan-phase`, `insert-phase`, `next`, `do`, and other later commands had docs but lacked substrate | Keep them blocked until required MCP families, manifests, and skills exist |

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

## Active Repair Order

- [x] Truth-sync `AGENTS.md`, `README.md`, `GEMINI.md`, `docs/HANDOFF.md`, `MEMORY.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md`
- [x] Add runtime Wave 0 `skills/` and `agents/` surfaces
- [x] Make `blueprint_command_catalog` implementation-aware
- [x] Restore `STRUCTURE.md` to the codebase bundle
- [x] Keep `/blu`, `/blu:help`, and `/blu:progress` limited to implemented commands
- [x] Re-baseline shipped Wave 0 command specs and command manifests around skill-led orchestration
- [x] Finish explicit remaining divergence notes in `docs/GSD-RUNTIME-MIGRATION.md`
- [x] Close regression coverage and verify the repaired runtime

## Remaining Blocked Surfaces

The following families remain intentionally blocked until substrate exists:

- roadmap MCP tools
- phase MCP tools
- review MCP tools
- workspace MCP tools
- workstream MCP tools
- update MCP tools
- patch MCP tools

Because of that, later commands such as `plan-phase`, `insert-phase`, `next`, and `do` must remain blocked in the runtime catalog even though they are documented.

## Exit Criteria

- [x] Docs and control files stop describing Blueprint as docs-only
- [x] Runtime `skills/` and `agents/` exist for the shipped Wave 0 surface
- [x] `blueprint_command_catalog` reports real implementation state instead of docs-only intent
- [x] `map-codebase` owns the seven-document codebase bundle
- [x] Consistency and parity regression tests pass
- [x] Remaining explicit divergences are documented in `docs/GSD-RUNTIME-MIGRATION.md`
- [x] Phase 3+ command exposure stayed frozen until the checklist was closed

## Future Phase Freeze

No Phase 3+ implementation or command exposure should proceed until:

1. this drift checklist is closed
2. routing only surfaces implemented commands
3. the next slice of roadmap/phase substrate is deliberately planned

## `gsd-insert-phase` Prompt

```text
/gsd-insert-phase 2 Repair Blueprint drift before Phase 3: re-baseline docs and requirements to the real Wave 0 state; create docs/DRIFT.md as the canonical repair ledger; add real runtime skills and agents for shipped commands; make the router and command catalog expose only implemented commands with satisfied MCP/skill/agent dependencies; audit every shipped Wave 0 command against upstream GSD skills/workflows and restore lost behavior except for explicit Blueprint deltas (/blu naming, .blueprint state, Gemini-native routing, advisory hooks, no slash-command chaining, no repo-level hook config, no self-update); re-evaluate map-codebase against upstream multi-agent 7-document mapping and restore any dropped artifacts unless a written decision rejects them; add the missing roadmap/phase MCP substrate before exposing plan-phase, insert-phase, next, or do; and block all future phases until truth-sync, parity, and regression tests pass.
```

## Follow-Up Planning Brief

```text
When you plan this inserted phase, treat these as locked requirements:

1. Do not discard working Phase 1/2 code unless it violates an explicit Blueprint decision.
2. Keep docs/DRIFT.md as the repair source of truth until the checkpoint is closed.
3. Keep AGENTS.md, README.md, GEMINI.md, MEMORY.md, docs/HANDOFF.md, .planning/ROADMAP.md, and .planning/STATE.md aligned with the actual Wave 0 runtime.
4. Commands must stay thin wrappers over skills plus MCP tools. Do not collapse orchestration back into inline command prose.
5. `blueprint_command_catalog` must stay runtime-aware; docs alone must never decide command availability.
6. `/blu`, `/blu:help`, and `/blu:progress` must never recommend planned-only or blocked commands as runnable.
7. Preserve only explicit Blueprint divergences: `/blu` namespace, `.blueprint` state, Gemini-native routing, advisory hooks, no slash-command chaining, no repo-level hook config, and no self-update.
8. Keep `new-project` closer to upstream bootstrap intent by preserving durable requirement and roadmap traceability, not bare scaffolding.
9. Keep `map-codebase` on the seven-document bundle, including `STRUCTURE.md`, unless a later written decision intentionally changes it.
10. Do not continue to Phase 3 until doc truth, router truth, skill/agent presence, and Wave 0 parity tests all pass.
```
