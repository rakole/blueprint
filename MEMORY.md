# Blueprint Memory

## Purpose

This file is the evolving project snapshot for Codex sessions operating on Blueprint.
Use `AGENTS.md` for durable repo instructions and use this file for current state, recent decisions, and next-step context.

## Project Status

- Current milestone: post-shipment lifecycle and roadmap-admin closeout now also includes the shipped Wave 3 capture slice, the shipped Wave 3 lightweight execution slice, and the shipped Wave 4 docs and review slices; `complete-milestone`, `milestone-summary`, `new-milestone`, `insert-phase`, `note`, `add-todo`, `add-backlog`, `fast`, `quick`, `docs-update`, and `secure-phase` are implemented alongside the earlier lifecycle, governance, and roadmap-admin surfaces
- Runtime status: Wave 0 plus the Phase 3 discovery commands (`discuss-phase`, `research-phase`, `ui-phase`), the roadmap-discovery command `list-phase-assumptions`, the lifecycle commands `plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, the Wave 3 lightweight execution commands `fast` and `quick`, the router command `next`, the governance handoff/resume commands `pause-work` and `resume-work`, the Wave 2 roadmap-admin commands `add-phase`, `insert-phase`, `remove-phase`, `plan-milestone-gaps`, `audit-milestone`, `complete-milestone`, `milestone-summary`, and `new-milestone`, the Wave 3 capture commands `note`, `add-todo`, and `add-backlog`, the Wave 4 docs command `docs-update`, and the Wave 4 review command `secure-phase` are implemented, and routing still filters to implemented commands only
- Planning status: shared architecture docs, executable Wave 0 plus Phase 3 runtime artifacts, a closed drift ledger, shipped advisory hooks, repaired research-phase parity guarantees, implemented plan-phase artifacts, implemented validation artifacts, implemented capture, lightweight execution, docs, review, and roadmap insertion artifacts, and Phase 4 execution summaries are present
- Implementation strategy: keep the shipped Wave 2 closeout plus `insert-phase`, `note`, `add-todo`, `add-backlog`, `fast`, `quick`, `docs-update`, and `secure-phase` contracts locked, preserve the closed Phase 2.2 and shipped Phase 3 guarantees, and only expand routing when manifests, primary skills, and required MCP tools all line up
- Roadmap-admin status: `/blu:add-phase`, `/blu:insert-phase`, `/blu:remove-phase`, `/blu:plan-milestone-gaps`, `/blu:audit-milestone`, `/blu:complete-milestone`, `/blu:milestone-summary`, and `/blu:new-milestone` are now shipped as the current roadmap-admin slice, covering whole-number phase append, decimal insertion without renumbering later phases, future-phase removal with renumbering, grouped gap-closure planning, milestone audit reporting, report-driven milestone closeout, summary generation, and carry-forward milestone reset

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
- `blueprint_roadmap_*` and `blueprint_phase_*`: mutate roadmap state, inspect phase readiness, and persist validated phase-scoped research, plans, and checkpoints
- `blueprint_review_*`: persist phase-scoped review artifacts and later review findings
- `blueprint_artifact_*`: scaffold, capture-index mutate, list, validate, and summarize artifacts
- `blueprint_review_*`: persist phase-scoped review artifacts and later review findings
- `blueprint_workspace_*`: manage global workspace registry and workspace creation/removal
- `blueprint_workstream_*`: manage project-local workstreams
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

- keep the shipped `complete-milestone`, `milestone-summary`, and `new-milestone` contracts aligned with their docs, manifests, shared skill, and implemented-only routing behavior
- keep the shipped `insert-phase` contract aligned across its manifest, primary skill contract, required MCP substrate, and regression coverage
- start any post-Wave-2 rollout from a fresh plan instead of treating the closeout trio as still upcoming
- preserve the shipped `add-phase`, `remove-phase`, `plan-milestone-gaps`, and `audit-milestone` contracts plus implemented-only routing behavior
- preserve the shipped Phase 3 discovery artifact contracts, the read-only `list-phase-assumptions` contract, and implemented-only routing behavior
- keep `plan-phase` routed through the plan index plus dedicated plan read/write MCP tools
- keep `execute-phase` routed through the plan index plus dedicated summary read/write MCP tools
- keep `secure-phase` routed through `blueprint_phase_locate`, `blueprint_artifact_list`, and `blueprint_review_record`
- keep `docs-update` routed through its evidence-backed docs-report substrate
- keep `note` routed through `blueprint_artifact_mutate_index`
- keep `add-todo` routed through `blueprint_artifact_mutate_index`
- keep `add-backlog` routed through `blueprint_artifact_mutate_index` plus optional stub scaffolding
- keep command-catalog rollout aligned with each shipped Wave 3 and Phase 4 command, including `note`, `add-todo`, `add-backlog`, `fast`, `quick`, `docs-update`, and `secure-phase`
- keep regression coverage in place so the closed drift and discovery guarantees fail fast if they drift

## Guardrail Snapshot

- Do not start by porting all GSD scripts directly
- Do not make hooks foundational to state transitions
- Do not mutate the installed extension directory from Blueprint commands
- Treat `update` as advisory only
- Treat high-risk commands like `undo`, `ship`, `new-workspace`, `remove-workspace`, `cleanup`, and `reapply-patches` as explicit-confirmation flows

## Session Notes

- The repo contains a buildable Gemini extension shell plus the shipped Wave 0, lifecycle, governance, and roadmap-admin command sets
- Runtime `skills/` and `agents/` surfaces now exist for the shipped Wave 0, capture, discovery, planning, execution, validation, review, docs, and roadmap-admin contracts
- The router/help/progress path must filter to commands whose catalog entry is `implemented`
- `map-codebase` now owns a seven-document codebase bundle: `STACK`, `ARCHITECTURE`, `STRUCTURE`, `CONVENTIONS`, `TESTING`, `INTEGRATIONS`, and `CONCERNS`
- Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both closed on 2026-04-11
- Phase 3 discovery is now implemented end-to-end with deterministic phase MCP tools, bounded researcher/UI agent contracts, and command-catalog/doc parity tests
- `research-phase` now uses validated MCP-owned research writes, explicit existing-research handling, and advisory hooks for read-before-edit, `.blueprint` write safety, and workflow drift
- `/blu:next` now ships as a read-only router on top of `blueprint_project_status`, `blueprint_state_load`, `blueprint_artifact_list`, and `blueprint_command_catalog`
- `/blu:pause-work` now persists a single canonical handoff at `.blueprint/reports/pause-work-latest.md` through MCP instead of relying on raw file writes or an automatic WIP commit, and `/blu:resume-work` restores the next safe implemented action from that handoff
- Canonical future-command ownership is `next` and `do` on `blueprint-router`, `pause-work` and `resume-work` on `blueprint-governance`, and `plan-milestone-gaps` on `blueprint-roadmap-admin`
- `ui-phase` keeps a single declared phase artifact: `XX-UI-SPEC.md`, which may hold either a UI contract or an explicit skip rationale
- `plan-phase` now uses `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, and `blueprint_phase_plan_write` to persist real `XX-YY-PLAN.md` content
- `validate-phase` now uses `blueprint_phase_summary_index`, `blueprint_phase_summary_read`, `blueprint_phase_validation_read`, and `blueprint_phase_validation_write` to persist real `XX-VERIFICATION.md` content
- `note` now uses `blueprint_artifact_mutate_index` to append canonical note entries in `.blueprint/notes/NOTES.md`, detect duplicates deterministically, and keep note capture project-local instead of reintroducing global-note behavior
- `add-todo` now uses `blueprint_artifact_mutate_index` to append canonical todo entries in `.blueprint/todos/TODO.md`, detect duplicates deterministically, and keep todo capture project-local
- `add-backlog` now uses `blueprint_artifact_mutate_index` to append canonical parking-lot entries in `.blueprint/backlog/BACKLOG.md`, detect duplicates deterministically, and optionally reserve a `999.x` phase stub before scaffolding it
- `fast` shipped on 2026-04-13 with dedicated `/blu-fast` and `/blu:fast` manifests, the shared `blueprint-phase-execution` skill, no subagent or report-backed side path, and optional `STATE.md` refresh through `blueprint_state_update` only when Blueprint is initialized
- `quick` shipped on 2026-04-12 with a dedicated `/blu:quick` manifest, the shared `blueprint-phase-execution` skill, a canonical `.blueprint/reports/quick-run-latest.md` report, and implemented-only follow-up routing through `blueprint_command_catalog`
- `secure-phase` now uses `blueprint_review_record` plus the discoverable `blueprint-review` skill and `blueprint-security-auditor` contract to persist real `XX-SECURITY.md` content
- `docs/build/WAVE-2-AGENT-WORKFLOW.md`, `docs/build/WAVE-2-PARALLEL-CLOSEOUT-PLAN.md`, and `docs/build/WAVE-2-AUTO-AGENT-META-PROMPT.md` now define the anti-drift closeout workflow for the next 1-to-3-agent cycles
- `docs-update` shipped on 2026-04-12 with a dedicated `blueprint-docs` skill, the `blueprint-doc-writer` and `blueprint-doc-verifier` agent contracts, a routable command manifest, and report persistence through `blueprint_artifact_report_write`
- Future sessions should treat the Wave 2 milestone-closeout trio plus `insert-phase`, `note`, `add-todo`, `add-backlog`, `fast`, `quick`, `docs-update`, and `secure-phase` as shipped, and only start a new slice once its manifest, primary skill, and required MCP tools are planned together
