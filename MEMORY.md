# Blueprint Memory

## Purpose

This file is the evolving project snapshot for Codex sessions operating on Blueprint.
Use `AGENTS.md` for durable repo instructions and use this file for current state, recent decisions, and next-step context.

## Project Status

- Current milestone: Phase 4 Plan, Execute, and Verify after Phase 3 completed on 2026-04-11
- Runtime status: Wave 0 plus the Phase 3 discovery commands (`discuss-phase`, `research-phase`, `ui-phase`) are implemented, and routing still filters to implemented commands only
- Planning status: shared architecture docs, executable Wave 0 plus Phase 3 runtime artifacts, a closed drift ledger, and Phase 3 execution summaries are present
- Implementation strategy: build one command at a time, preserve the closed Phase 2.2 and shipped Phase 3 contract guarantees, and keep later commands blocked until their substrate exists

## Stable References

- Durable repo instructions: `AGENTS.md`
- Drift ledger: `docs/DRIFT.MD`
- Shared architecture decisions: `docs/DECISIONS.md`
- MCP contracts: `docs/MCP-TOOLS.md`
- Command inventory: `docs/COMMAND-CATALOG.md`
- Current handoff: `docs/HANDOFF.md`

## Current Architecture Snapshot

- Blueprint uses MCP as the deterministic state engine for structured reads and writes
- Commands own UX and routing
- Skills own orchestration
- Agents own bounded deep work
- Hooks remain advisory rather than state-owning
- Scripts are not the primary persistence layer
- `blueprint_command_catalog` is runtime-aware and should be treated as the source of routable-command truth

## Planned MCP Responsibilities

- `blueprint_project_*`: initialize repo state and report readiness
- `blueprint_config_*`: read and update `.blueprint/config.json`
- `blueprint_state_*`: load, update, and sync `STATE.md`
- `blueprint_roadmap_*` and `blueprint_phase_*`: mutate roadmap state and inspect phase readiness
- `blueprint_artifact_*`: scaffold, list, validate, and summarize artifacts
- `blueprint_workspace_*`: manage global workspace registry and workspace creation/removal
- `blueprint_workstream_*`: manage project-local workstreams
- `blueprint_review_*`: persist review scope and findings
- `blueprint_update_*`: generate advisory update checks and checklists
- `blueprint_patch_*`: record and replay patch metadata from the global registry

## Local Vs Global State

- Every Blueprint-managed repo or workspace gets its own `.blueprint/`
- `.blueprint/` holds project truth such as `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, phase artifacts, backlog, todos, notes, reports, codebase docs, and workstreams
- `~/.gemini/blueprint/` holds only cross-project operational data such as:
- workspace registry
- update metadata
- patch registry
- `.planning/` in this repo is implementation bookkeeping for the GSD build-out and must not be surfaced as Blueprint runtime state

## Retained Commands

- Total retained commands: 53
- Root router spec: `docs/commands/root-router.md`
- Per-command specs: `docs/commands/*.md`
- Command inventory index: `docs/COMMAND-CATALOG.md`

## Important Docs

- `README.md`
- `docs/DRIFT.MD`
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/GEMINI-CONSTRAINTS.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- `docs/TEST-STRATEGY.md`
- `docs/HANDOFF.md`

## Recommended Read Order Before Coding

1. `AGENTS.md`
2. `docs/DRIFT.MD`
3. `docs/DECISIONS.md`
4. `docs/ARCHITECTURE.md`
5. `docs/ARTIFACT-SCHEMA.md`
6. `docs/MCP-TOOLS.md`
7. `docs/GEMINI-CONSTRAINTS.md`
8. `docs/PHASE-LIFECYCLE.md`
9. `docs/SKILLS-AND-AGENTS.md`
10. `docs/IMPLEMENTATION-ORDER.md`
11. `docs/COMMAND-CATALOG.md`
12. `docs/commands/<command>.md`

## Next Implementation Slice

- implement `plan-phase`, then `execute-phase`, then `validate-phase` and `verify-work`
- keep `next`, `pause-work`, and `resume-work` blocked until their runtime substrate exists
- preserve the shipped Phase 3 discovery artifact contracts and implemented-only routing behavior
- keep command-catalog rollout aligned with each shipped Phase 4 command
- keep regression coverage in place so the closed drift and discovery guarantees fail fast if they drift

## Guardrail Snapshot

- Do not start by porting all GSD scripts directly
- Do not make hooks foundational to state transitions
- Do not mutate the installed extension directory from Blueprint commands
- Treat `update` as advisory only
- Treat high-risk commands like `undo`, `ship`, `new-workspace`, `remove-workspace`, `cleanup`, and `reapply-patches` as explicit-confirmation flows

## Session Notes

- The repo contains a buildable Gemini extension shell plus the full shipped Wave 0 command set
- Runtime `skills/` and `agents/` surfaces now exist for the shipped Wave 0 contracts
- The router/help/progress path must filter to commands whose catalog entry is `implemented`
- `map-codebase` now owns a seven-document codebase bundle: `STACK`, `ARCHITECTURE`, `STRUCTURE`, `CONVENTIONS`, `TESTING`, `INTEGRATIONS`, and `CONCERNS`
- Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both closed on 2026-04-11
- Phase 3 discovery is now implemented end-to-end with deterministic phase MCP tools, bounded researcher/UI agent contracts, and command-catalog/doc parity tests
- Canonical future-command ownership is `next` and `do` on `blueprint-router`, `pause-work` and `resume-work` on `blueprint-governance`, and `plan-milestone-gaps` on `blueprint-roadmap-admin`
- `ui-phase` keeps a single declared phase artifact: `XX-UI-SPEC.md`, which may hold either a UI contract or an explicit skip rationale
- Future sessions may proceed with Phase 4 implementation, but they should not expose later commands until the required manifests, primary skills, and MCP tools exist
