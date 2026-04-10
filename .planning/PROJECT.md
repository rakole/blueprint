# Blueprint

## What This Is

Blueprint is a planned Gemini CLI extension that keeps the useful parts of Get Shit Done while redesigning them for Gemini-native commands, skills, agents, hooks, and MCP tools. This repository is still pre-implementation: the product runtime does not exist yet, and the current goal is to use GSD locally to turn the locked docs pack into executable Blueprint code one phase at a time.

## Core Value

A Gemini user can get from ambiguous work to a trustworthy next step through explicit commands, durable artifacts, and deterministic state.

## Vision

Build a Gemini-native extension that preserves GSD's command-driven methodology without carrying over hidden runtime assumptions, installer tricks, or file-for-file porting baggage.

## Audience

- Developers using Gemini CLI who want repo-local planning, clear command entrypoints, and bounded agent delegation
- Existing GSD users who want the useful workflow patterns in a Gemini-native extension

## Current Milestone

Turn the docs-first planning pack into the first executable Blueprint foundation loop:
- extension scaffold
- `/blu` root router and direct `/blu:<command>` entrypoints
- `/blu:new-project`
- shared MCP primitives for project, config, state, and artifact operations

## Requirements

### Validated

(None yet — Blueprint has not shipped runtime behavior)

### Active

- [ ] Ship the smallest working Blueprint loop with a real Gemini extension scaffold, router, and deterministic MCP-backed state primitives
- [ ] Implement the retained Blueprint command surface in dependency order, starting with Wave 0 and expanding only after shared contracts are real
- [ ] Keep GSD planning local to `.planning/` while Blueprint itself continues to use `.blueprint/` as the product runtime state directory

### Out of Scope

- Reintroducing `.planning/` as Blueprint's product runtime state — `.planning/` here is only the local GSD workspace for building Blueprint
- Literal file-for-file porting of GSD internals — Blueprint is a redesign, not a transliteration
- Extension self-mutation, hidden hook-owned state, or scripts as the primary persistence layer — these violate locked architecture decisions

## Context

- The repository already contains a docs-first planning pack covering decisions, architecture, artifact schema, MCP tool contracts, lifecycle flow, implementation order, and per-command specs
- The product name, router namespace, state boundaries, hook policy, and retained command set are already locked in `docs/`
- We are using GSD locally to implement Blueprint, so `.planning/` is an implementation aid for this repo, not a statement that Blueprint-managed projects will use `.planning/`
- The immediate implementation slice is `gemini-extension.json`, `GEMINI.md`, `commands/blu.toml`, `commands/blu/new-project.toml`, `src/mcp/server.ts`, and initial MCP tool/test coverage for `new-project`

## Constraints

- **Host runtime**: Blueprint must ship as a Gemini CLI extension installed from GitHub
- **Product state boundary**: Blueprint runtime state still belongs in `.blueprint/` and `~/.gemini/blueprint/`, even though this repo's local planning lives in `.planning/`
- **Architecture**: Commands own UX, skills own orchestration, agents own bounded deep work, and MCP tools own deterministic persistence
- **Delivery strategy**: Build one command at a time after Wave 0 scaffolding; do not try to land the whole command surface in one pass
- **Safety**: High-risk commands keep explicit confirmation flows, and `update` remains advisory rather than self-mutating

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GSD locally in `.planning/` while building Blueprint | Lets us run the current GSD workflow without changing Blueprint's product-state contract | — Pending |
| Keep `/blu` and `/blu:<command>` as the only Blueprint command surface | Matches the locked Gemini-native UX and avoids slash-command chaining assumptions | — Pending |
| Keep `.blueprint/` as Blueprint's runtime state directory | Preserves the product architecture locked in `docs/DECISIONS.md` and `docs/MIGRATION-FROM-GSD.md` | — Pending |
| Use an extension-bundled MCP server as the deterministic state engine | Keeps persistent mutations explicit, validated, and reusable across commands | — Pending |
| Start implementation with `new-project` and shared MCP primitives | Creates the smallest viable loop that later commands depend on | — Pending |

## Non-Goals

- Add omitted GSD commands back into the Blueprint v1 contract without re-planning
- Let local GSD planning artifacts leak into Blueprint's product runtime behavior
- Implement all retained commands before the Wave 0 foundation is executable

## Evolution

This document evolves as local GSD planning turns the Blueprint docs pack into real runtime code.

**After each phase transition:**
1. Move shipped behavior from `Active` to `Validated`
2. Move invalidated or deferred scope to `Out of Scope` with a reason
3. Add new requirements discovered during implementation
4. Update the `Key Decisions` table when implementation confirms or challenges an earlier choice
5. Refresh the product description if the implementation meaningfully changes the shape of Blueprint

**After each milestone:**
1. Re-check whether the current milestone still represents the highest-leverage next slice
2. Audit `Non-Goals` and `Out of Scope` for drift
3. Update `Context` with new command coverage, test learnings, and architecture constraints uncovered in code

---
*Last updated: 2026-04-10 after local GSD project initialization*
