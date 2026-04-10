# Blueprint Memory

## Purpose

This file is the evolving project snapshot for Codex sessions operating on Blueprint.
Use `AGENTS.md` for durable repo instructions and use this file for current state, recent decisions, and next-step context.

## Project Status

- Current milestone: Wave 0 foundation expansion on top of the shipped Phase 1 loop
- Runtime status: Phase 1 foundation loop is implemented and verified
- Planning status: shared architecture docs plus executable Phase 1 runtime artifacts are present
- Implementation strategy: build one command at a time, starting with Wave 0

## Stable References

- Durable repo instructions: `AGENTS.md`
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

## Retained Commands

- Total retained commands: 53
- Root router spec: `docs/commands/root-router.md`
- Per-command specs: `docs/commands/*.md`
- Command inventory index: `docs/COMMAND-CATALOG.md`

## Important Docs

- `README.md`
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
2. `docs/DECISIONS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ARTIFACT-SCHEMA.md`
5. `docs/MCP-TOOLS.md`
6. `docs/GEMINI-CONSTRAINTS.md`
7. `docs/PHASE-LIFECYCLE.md`
8. `docs/SKILLS-AND-AGENTS.md`
9. `docs/IMPLEMENTATION-ORDER.md`
10. `docs/COMMAND-CATALOG.md`
11. `docs/commands/<command>.md`

## Next Implementation Slice

- `src/mcp/tools/config.ts` extensions for settings/profile flows
- `commands/blu/help.toml` or inline `/blu` help routing support
- `commands/blu/progress.toml`
- `commands/blu/health.toml`
- `src/mcp` read-path helpers needed by help/progress/health
- `map-codebase` command scaffolding and initial artifact tests

## Guardrail Snapshot

- Do not start by porting all GSD scripts directly
- Do not make hooks foundational to state transitions
- Do not mutate the installed extension directory from Blueprint commands
- Treat `update` as advisory only
- Treat high-risk commands like `undo`, `ship`, `new-workspace`, `remove-workspace`, `cleanup`, and `reapply-patches` as explicit-confirmation flows

## Session Notes

- The repo now contains a buildable Gemini extension shell, `/blu`, `/blu:new-project`, and Phase 1 MCP primitives
- `npm run typecheck`, `npm run build`, and `npm test` all pass for the Phase 1 slice
- Phase 1 review is clean and verification passed in `.planning/phases/01-foundation-bootstrap-and-state/01-REVIEW.md` and `01-VERIFICATION.md`
- Future sessions should build Phase 2 on top of the shipped `.blueprint/` bootstrap rather than revisiting the completed scaffold
