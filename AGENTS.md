# Blueprint Agent Guide

## Purpose

This file provides durable repo-scoped instructions for Codex instances working on Blueprint.
Read this before making planning or implementation changes.

## Project Mission

Blueprint is a Gemini CLI extension that rethinks the useful parts of GSD as a Gemini-native system.
It is not a literal port of GSD internals.

## Current Phase

- Wave 0 plus Phase 3 discovery runtime exists for `/blu`, `new-project`, `settings`, `set-profile`, `help`, `progress`, `health`, `map-codebase`, `discuss-phase`, `list-phase-assumptions`, `research-phase`, `ui-phase`, `next`, `plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, `pause-work`, `resume-work`, `add-phase`, `remove-phase`, `plan-milestone-gaps`, and `audit-milestone`
- Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both completed on 2026-04-11
- Phase 3 discovery shipped on 2026-04-11 and is under active repair; `plan-phase`, `execute-phase`, and `validate-phase` are now implemented on top of the plan, summary, and validation MCP substrates, `verify-work`, `pause-work`, and `resume-work` are also shipped, `/blu:add-phase`, `/blu:remove-phase`, `/blu:plan-milestone-gaps`, `/blu:audit-milestone`, and `/blu:list-phase-assumptions` are now implemented as the current Wave 2 roadmap, milestone, and discovery slice, and the next broader rollout continues with `complete-milestone`
- `/blu`, `/blu:help`, and `/blu:progress` must still surface only commands whose catalog entry is `implemented`

## Core Product Decisions

- Product name: `blueprint`
- Root router: `/blu`
- Direct commands: `/blu:<command>`
- Project-local state directory: `.blueprint/`
- Global non-project state directory: `~/.gemini/blueprint/`
- Install model: `gemini extensions install https://github.com/rakole/blueprint`

## Architecture Rules

- Treat Blueprint as a Gemini-native redesign, not a file-for-file GSD port
- Use MCP as the deterministic state engine for structured reads and writes
- Keep commands thin and user-facing
- Use skills for orchestration
- Use agents for bounded deep work
- Keep hooks advisory rather than state-owning
- Do not make scripts the primary persistence layer
- Root routing and help/progress guidance must only surface commands whose catalog entry is `implemented`

## State Ownership

- Every Blueprint-managed repo or workspace should have its own `.blueprint/`
- `.blueprint/` is the source of truth for project planning artifacts
- `~/.gemini/blueprint/` is only for cross-project operational state such as:
- workspace registry
- update metadata
- patch registry
- `.planning/` may exist in this repository for local GSD implementation bookkeeping only; it is not Blueprint runtime state

## Command Status Vocabulary

- `planned`: documented but not yet shipped
- `implemented`: manifest, primary skill, and required MCP tools are all present
- `blocked`: not safe to expose because required runtime pieces are missing
- `repairing`: partially shipped and under active drift repair

## Guardrails

- Do not reintroduce `.planning/` or `/gsd:*`
- Do not silently add omitted GSD commands without re-planning
- Do not mutate the installed extension directory from Blueprint commands
- Do not make `update` self-mutating; it must remain advisory
- Do not rely on hooks for core state transitions
- Keep `.blueprint/` schema stable while implementing Wave 0 and Wave 1
- Do not change `blueprint_command_catalog` status semantics while Phase 3 is being implemented; later commands become routable only when manifests, primary skills, and required MCP tools exist
- Require explicit confirmation for high-risk commands such as `undo`, `ship`, `new-workspace`, `remove-workspace`, `cleanup`, and `reapply-patches`
- Do not recommend planned-only commands from `/blu`, `/blu:help`, or `/blu:progress`
- Do not treat documented Phase 3+ commands as runnable until their runtime catalog entry is `implemented`
- When starting any new code change(fresh context) create a new worktree, post work completion, push to origin, PR to main, merge, pull into main local

## Preferred Read Order

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

## Immediate Next Slice

Continue the next roadmap slice with:

- `complete-milestone`
- unchanged implemented-only routing guarantees in `src/mcp/tools/project.ts`
- the closed Phase 2.2 drift guarantees plus shipped Phase 3, Phase 4, and Wave 2 gap-planning regression coverage preserved while later roadmap commands land

## Working Norms

- Prefer deterministic state changes through MCP tools
- Keep command behavior aligned with the command spec docs
- Update `MEMORY.md` when major decisions change or implementation moves to a new wave
- If a new architectural decision is made, update the relevant doc in `docs/` rather than only mentioning it in chat
- When a shipped command intentionally differs from upstream GSD behavior, document that delta in `docs/GSD-RUNTIME-MIGRATION.md`
