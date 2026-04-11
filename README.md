# Blueprint

Blueprint is in active implementation as a Gemini CLI extension that rethinks the useful parts of Get Shit Done as a Gemini-native workflow.

This repository still carries the planning pack that locked the product and architecture, but the Wave 0 runtime and the Phase 3 discovery commands now exist. Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both closed on April 11, 2026, Phase 3 discovery shipped later that day, and the current repair focus is making those discovery commands fully substantive before any broader Phase 4 rollout.

## What Is Locked

- Global install target: `gemini extensions install https://github.com/<our_repo>`
- Brand and namespace: `blueprint`, with a root `/blu` router and direct `/blu:<command>` commands
- Project state location: `.blueprint/`
- Global mutable state location: `~/.gemini/blueprint/`
- Config layering: normalized repo config in `.blueprint/config.json`, optional user defaults in `~/.gemini/blueprint/defaults.json`
- Runtime architecture: Gemini commands, Gemini skills, Gemini subagents, an extension-bundled MCP server, and a deferred advisory-hook policy
- Delivery approach: docs-first planning pack first, then granular command-by-command implementation with repair checkpoints when runtime and docs drift

## Current Status

- Shipped direct commands: `/blu:new-project`, `/blu:settings`, `/blu:set-profile`, `/blu:help`, `/blu:progress`, `/blu:health`, `/blu:map-codebase`, `/blu:discuss-phase`, `/blu:research-phase`, `/blu:ui-phase`
- Phase 2.1 and Phase 2.2 both closed on 2026-04-11, and Phase 3 discovery shipped on 2026-04-11
- Current repair slice: replace scaffold-only Phase 3 discovery persistence with substantive artifact writes and checkpoint-aware recovery
- Runtime gate: `/blu`, `/blu:help`, and `/blu:progress` must still recommend only commands whose runtime catalog entry is `implemented`
- Router rule: `/blu`, `/blu:help`, and `/blu:progress` should only recommend commands whose runtime catalog entry is `implemented`

## Retained Commands

Wave 0 foundation:
- `new-project`
- `settings`
- `set-profile`
- `help`
- `progress`
- `health`
- `map-codebase`

Wave 1 core lifecycle:
- `discuss-phase`
- `research-phase`
- `ui-phase`
- `plan-phase`
- `execute-phase`
- `validate-phase`
- `verify-work`
- `next`
- `pause-work`
- `resume-work`

Wave 2 roadmap and milestone management:
- `add-phase`
- `insert-phase`
- `remove-phase`
- `list-phase-assumptions`
- `plan-milestone-gaps`
- `audit-milestone`
- `complete-milestone`
- `milestone-summary`
- `new-milestone`

Wave 3 capture and lightweight execution:
- `note`
- `add-todo`
- `check-todos`
- `add-backlog`
- `review-backlog`
- `fast`
- `quick`
- `do`
- `explore`
- `debug`

Wave 4 quality and shipping:
- `code-review`
- `code-review-fix`
- `audit-fix`
- `secure-phase`
- `docs-update`
- `ui-review`
- `review`
- `add-tests`
- `pr-branch`
- `ship`
- `undo`

Wave 5 workspace and maintenance:
- `new-workspace`
- `remove-workspace`
- `workstreams`
- `cleanup`
- `update`
- `reapply-patches`

## Intentionally Out Of Scope

- Removed from the requested keep-list: `eval-review`
- Omitted from Blueprint v1 planning: `analyze-dependencies`, `audit-uat`, `autonomous`, `forensics`, `import`, `intel`, `join-discord`, `list-workspaces`, `manager`, `plant-seed`, `profile-user`, `scan`, `session-report`, `stats`, `thread`

## Current Repo Contents

- `docs/DECISIONS.md`: locked project decisions
- `docs/DRIFT.MD`: closed ledger for the Phase 2.2 drift-repair checkpoint plus notes on the shipped Phase 3 discovery follow-up
- `docs/ARCHITECTURE.md`: extension structure and runtime boundaries
- `docs/ARTIFACT-SCHEMA.md`: `.blueprint/`, normalized config schema, and global-state schema
- `docs/MCP-TOOLS.md`: proposed MCP tool contracts, including scoped config reads and writes
- `docs/SKILLS-AND-AGENTS.md`: shipped and planned Gemini skills and subagents
- `docs/HOOKS-POLICIES.md`: advisory hooks and safety policy
- `docs/MIGRATION-FROM-GSD.md`: command and behavior mapping from GSD to Blueprint
- `docs/GSD-RUNTIME-MIGRATION.md`: runtime-porting matrix for retained workflows and explicit Blueprint deltas
- `docs/COMMAND-CATALOG.md`: retained-command index with wave, skill, status, write surface, and risk
- `docs/GEMINI-CONSTRAINTS.md`: Gemini CLI restrictions that shaped the Blueprint design
- `docs/IMPLEMENTATION-ORDER.md`: dependency-ordered command queue
- `docs/PHASE-LIFECYCLE.md`: artifact flow across discuss, research, planning, execution, validation, and verification
- `docs/TEST-STRATEGY.md`: test plan for docs, tools, commands, hooks, and E2E
- `docs/HANDOFF.md`: next-session pickup guide
- `docs/commands/`: one implementation-ready spec per retained command

## Current Runtime Layout

These runtime files exist today:

- `gemini-extension.json`
- `GEMINI.md`
- `commands/blu.toml`
- `commands/blu/new-project.toml`
- `commands/blu/settings.toml`
- `commands/blu/set-profile.toml`
- `commands/blu/help.toml`
- `commands/blu/progress.toml`
- `commands/blu/health.toml`
- `commands/blu/map-codebase.toml`
- `commands/blu/discuss-phase.toml`
- `commands/blu/research-phase.toml`
- `commands/blu/ui-phase.toml`
- `skills/blueprint-router.md`
- `skills/blueprint-bootstrap.md`
- `skills/blueprint-governance.md`
- `skills/blueprint-map.md`
- `skills/blueprint-phase-discovery.md`
- `agents/blueprint-project-researcher.md`
- `agents/blueprint-roadmapper.md`
- `agents/blueprint-mapper.md`
- `agents/blueprint-planner.md`
- `agents/blueprint-checker.md`
- `agents/blueprint-executor.md`
- `agents/blueprint-verifier.md`
- `agents/blueprint-researcher.md`
- `agents/blueprint-ui-designer.md`
- `src/mcp/server.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase.ts`

Deferred but not yet shipped in this repair branch:

- `src/hooks/`
- `hooks/`
- bundled hook code and hook fixture coverage

## Command Status

Blueprint uses one runtime-facing vocabulary across docs and the command catalog:

- `implemented`: manifest, primary skill, and required MCP tools are present
- `repairing`: partially shipped and under active drift repair
- `blocked`: not safe to expose because required runtime pieces are missing
- `planned`: documented future intent only

## Current Repair Slice

The current slice hardens the shipped Phase 3 discovery runtime:

1. replace scaffold-only `discuss-phase`, `research-phase`, and `ui-phase` persistence with substantive artifact writes
2. add checkpoint-aware recovery for `discuss-phase`
3. keep `/blu`, `/blu:help`, and `/blu:progress` limited to commands whose catalog entry is truthfully `implemented`
4. defer hooks and any broader Phase 4 rollout until the discovery repair is complete

The Phase 2.2 closure record lives in `docs/DRIFT.MD`, and the next-session pickup guide lives in `docs/HANDOFF.md`.
