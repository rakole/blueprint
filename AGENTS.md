# Blueprint Agent Guide

## Purpose

This file provides durable repo-scoped instructions for Codex instances working on Blueprint.
Read this before making planning or implementation changes.

## Project Mission

Blueprint is a Gemini CLI extension that rethinks the useful parts of GSD as a Gemini-native system.
It is not a literal port of GSD internals.

## Current Phase

- The repository is currently in a docs-first planning phase
- No Gemini extension runtime has been implemented yet
- Work should proceed one command at a time after Wave 0 scaffolding starts

## Core Product Decisions

- Product name: `blueprint`
- Root router: `/blu`
- Direct commands: `/blu:<command>`
- Project-local state directory: `.blueprint/`
- Global non-project state directory: `~/.gemini/blueprint/`
- Install model: `gemini extensions install https://github.com/<repo>`

## Architecture Rules

- Treat Blueprint as a Gemini-native redesign, not a file-for-file GSD port
- Use MCP as the deterministic state engine for structured reads and writes
- Keep commands thin and user-facing
- Use skills for orchestration
- Use agents for bounded deep work
- Keep hooks advisory rather than state-owning
- Do not make scripts the primary persistence layer

## State Ownership

- Every Blueprint-managed repo or workspace should have its own `.blueprint/`
- `.blueprint/` is the source of truth for project planning artifacts
- `~/.gemini/blueprint/` is only for cross-project operational state such as:
- workspace registry
- update metadata
- patch registry

## Guardrails

- Do not reintroduce `.planning/` or `/gsd:*`
- Do not silently add omitted GSD commands without re-planning
- Do not mutate the installed extension directory from Blueprint commands
- Do not make `update` self-mutating; it must remain advisory
- Do not rely on hooks for core state transitions
- Keep `.blueprint/` schema stable while implementing Wave 0 and Wave 1
- Require explicit confirmation for high-risk commands such as `undo`, `ship`, `new-workspace`, `remove-workspace`, `cleanup`, and `reapply-patches`

## Preferred Read Order

1. `docs/DECISIONS.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ARTIFACT-SCHEMA.md`
4. `docs/MCP-TOOLS.md`
5. `docs/GEMINI-CONSTRAINTS.md`
6. `docs/PHASE-LIFECYCLE.md`
7. `docs/SKILLS-AND-AGENTS.md`
8. `docs/IMPLEMENTATION-ORDER.md`
9. `docs/COMMAND-CATALOG.md`
10. `docs/commands/<command>.md`

## Immediate Next Slice

When implementation begins, start with:

- `gemini-extension.json`
- `GEMINI.md`
- `commands/blu.toml`
- `commands/blu/new-project.toml`
- `src/mcp/server.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/artifacts.ts`
- initial tests for `new-project`

## Working Norms

- Prefer deterministic state changes through MCP tools
- Keep command behavior aligned with the command spec docs
- Update `MEMORY.md` when major decisions change or implementation moves to a new wave
- If a new architectural decision is made, update the relevant doc in `docs/` rather than only mentioning it in chat
