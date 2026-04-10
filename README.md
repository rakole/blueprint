# Blueprint

Blueprint is in active implementation as a Gemini CLI extension that rethinks the useful parts of Get Shit Done as a Gemini-native workflow.

This repository still carries the planning pack that locked the product and architecture, but the Wave 0 runtime is now landing one command at a time on top of that contract.

## What Is Locked

- Global install target: `gemini extensions install https://github.com/<our_repo>`
- Brand and namespace: `blueprint`, with a root `/blu` router and direct `/blu:<command>` commands
- Project state location: `.blueprint/`
- Global mutable state location: `~/.gemini/blueprint/`
- Config layering: normalized repo config in `.blueprint/config.json`, optional user defaults in `~/.gemini/blueprint/defaults.json`
- Runtime architecture: Gemini commands, Gemini skills, Gemini subagents, advisory hooks, and an extension-bundled MCP server
- Delivery approach: no conversion yet; planning docs first, then granular command-by-command implementation

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
- `docs/ARCHITECTURE.md`: extension structure and runtime boundaries
- `docs/ARTIFACT-SCHEMA.md`: `.blueprint/`, normalized config schema, and global-state schema
- `docs/MCP-TOOLS.md`: proposed MCP tool contracts, including scoped config reads and writes
- `docs/SKILLS-AND-AGENTS.md`: planned Gemini skills and subagents
- `docs/HOOKS-POLICIES.md`: advisory hooks and safety policy
- `docs/MIGRATION-FROM-GSD.md`: command and behavior mapping from GSD to Blueprint
- `docs/GSD-RUNTIME-MIGRATION.md`: runtime-porting matrix for retained workflows and hooks
- `docs/COMMAND-CATALOG.md`: one-page retained-command index with wave, skill, write surface, and risk
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
- `commands/blu/help.toml`
- `commands/blu/progress.toml`
- `commands/blu/health.toml`

## Next Implementation Slice

The recommended first code slice is:

1. Root extension scaffold
2. `/blu` router
3. `/blu:new-project`
4. Shared MCP primitives for project, config, state, roadmap, and artifacts

The detailed breakdown lives in `docs/HANDOFF.md` and `docs/IMPLEMENTATION-ORDER.md`.
