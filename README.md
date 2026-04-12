# Blueprint

Blueprint is in active implementation as a Gemini CLI extension that rethinks the useful parts of Get Shit Done as a Gemini-native workflow.

This repository still carries the planning pack that locked the product and architecture, but the live runtime now spans Wave 0, the shipped lifecycle slice (`discuss-phase` through `verify-work`), governance handoff/resume, and the current roadmap-admin slice. Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both closed on April 11, 2026. Phase 3 discovery shipped the same day and remains in parity closeout while runtime routing stays limited to commands whose catalog entry is `implemented`.

## What Is Locked

- Global install target: `gemini extensions install https://github.com/rakole/blueprint`
- Brand and namespace: `blueprint`, with a root `/blu` router and direct `/blu:<command>` commands
- Project state location: `.blueprint/`
- Global mutable state location: `~/.gemini/blueprint/`
- Config layering: normalized repo config in `.blueprint/config.json`, optional user defaults in `~/.gemini/blueprint/defaults.json`
- Runtime architecture: Gemini commands, Gemini skills, Gemini subagents, advisory hooks, and an extension-bundled MCP server
- Delivery approach: docs-first planning pack first, then granular command-by-command implementation with repair checkpoints when runtime and docs drift

## Current Status

- Wave 0 shipped commands: `/blu`, `/blu:new-project`, `/blu:settings`, `/blu:set-profile`, `/blu:help`, `/blu:progress`, `/blu:health`, `/blu:map-codebase`
- Phase 3 discovery commands are shipped: `/blu:discuss-phase`, `/blu:research-phase`, `/blu:ui-phase`
- The shipped lifecycle slice also includes `/blu:plan-phase`, `/blu:execute-phase`, `/blu:validate-phase`, `/blu:verify-work`, and the read-only next-step router `/blu:next`
- The read-only phase-discovery assumptions command `/blu:list-phase-assumptions` is now shipped on the same discovery substrate
- The governance handoff and resume commands `/blu:pause-work` and `/blu:resume-work` are now shipped with durable MCP-owned handoff/state routing in `.blueprint/reports/` and `.blueprint/STATE.md`
- The roadmap append command `/blu:add-phase` is now shipped; it appends the next whole-number phase, ignores decimal suffixes when numbering, scaffolds `.blueprint/phases/<phase-slug>/`, and updates `.blueprint/STATE.md`
- The roadmap removal command `/blu:remove-phase` is now shipped; it removes a future phase, deletes the matching phase directory, renumbers later roadmap references and phase artifacts, and updates `.blueprint/STATE.md`
- The milestone audit command `/blu:audit-milestone` is now shipped; it compares original milestone intent against completed phase evidence and writes a durable report in `.blueprint/reports/`
- The gap-planning command `/blu:plan-milestone-gaps` is now shipped; it reads the latest milestone audit, groups actionable gaps into a small set of follow-up phases, appends them to `.blueprint/ROADMAP.md`, and updates `.blueprint/STATE.md`
- Phase 2.1 and Phase 2.2 both closed on 2026-04-11; current follow-up work keeps the shipped discovery, planning, execution, validation/UAT, governance, and roadmap-admin contracts aligned while `complete-milestone` is the next unshipped slice
- The remaining Wave 2 roadmap and milestone commands remain unshipped
- Runtime gate: `/blu`, `/blu:help`, and `/blu:progress` must still recommend only commands whose runtime catalog entry is `implemented`

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
- `docs/DRIFT.MD`: closed ledger for the Phase 2.2 drift-repair checkpoint and the Phase 3 unblock decision
- `docs/ARCHITECTURE.md`: extension structure and runtime boundaries
- `docs/ARTIFACT-SCHEMA.md`: `.blueprint/`, normalized config schema, and global-state schema
- `docs/MCP-TOOLS.md`: current registered MCP tools plus planned future tool families
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
- `commands/blu/list-phase-assumptions.toml`
- `commands/blu/research-phase.toml`
- `commands/blu/ui-phase.toml`
- `commands/blu/plan-phase.toml`
- `commands/blu/execute-phase.toml`
- `commands/blu/validate-phase.toml`
- `commands/blu/verify-work.toml`
- `commands/blu/audit-milestone.toml`
- `commands/blu/add-phase.toml`
- `commands/blu/plan-milestone-gaps.toml`
- `commands/blu/remove-phase.toml`
- `commands/blu/next.toml`
- `commands/blu/pause-work.toml`
- `commands/blu/resume-work.toml`
- `skills/blueprint-router.md`
- `skills/blueprint-bootstrap.md`
- `skills/blueprint-governance.md`
- `skills/blueprint-map.md`
- `skills/blueprint-phase-discovery.md`
- `skills/blueprint-phase-planning.md`
- `skills/blueprint-phase-execution.md`
- `skills/blueprint-phase-validation.md`
- `skills/blueprint-roadmap-admin.md`
- `agents/blueprint-project-researcher.md`
- `agents/blueprint-roadmapper.md`
- `agents/blueprint-mapper.md`
- `agents/blueprint-researcher.md`
- `agents/blueprint-ui-designer.md`
- `agents/blueprint-planner.md`
- `agents/blueprint-checker.md`
- `agents/blueprint-executor.md`
- `agents/blueprint-verifier.md`
- `hooks/hooks.json`
- `src/mcp/server.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase.ts`
- `src/hooks/`

## Command Status

Blueprint uses one runtime-facing vocabulary across docs and the command catalog:

- `implemented`: manifest, primary skill, and required MCP tools are present
- `repairing`: partially shipped and under active drift repair
- `blocked`: not safe to expose because required runtime pieces are missing
- `planned`: documented future intent only

## Next Implementation Slice

The next broad rollout starts with the remaining roadmap slice while the shipped Phase 3, Phase 4, governance handoff/resume, roadmap-append, and milestone-audit guarantees stay green:

1. Continue the next unshipped command slice beginning with `complete-milestone`
2. Keep `/blu`, `/blu:help`, and `/blu:progress` limited to `implemented` commands until new manifests, skills, and required MCP tools actually ship
3. Preserve the shipped pause/resume routing, validation parity, `add-phase` append guarantees, `remove-phase` renumbering guarantees, `plan-milestone-gaps` grouped audit-follow-up contract, and milestone-audit report contract while the rest of Wave 2 lands

The Phase 2.2 closure record lives in `docs/DRIFT.MD`, and the next-session pickup guide lives in `docs/HANDOFF.md`.
