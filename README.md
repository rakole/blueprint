# Blueprint

Blueprint is in active implementation as a Gemini CLI extension that rethinks the useful parts of Get Shit Done as a Gemini-native workflow.

This repository still carries the planning pack that locked the product and architecture, but the live runtime now spans Wave 0, the shipped lifecycle slice (`discuss-phase` through `verify-work`), governance handoff/resume, the current roadmap-admin slice including the Wave 2 milestone-closeout trio plus `insert-phase`, the shipped Wave 3 capture commands `/blu-note`, `/blu-add-todo`, and `/blu-add-backlog`, the shipped Wave 3 lightweight execution command `/blu-quick`, and the shipped Wave 4 review and docs commands. Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both closed on April 11, 2026. Phase 3 discovery shipped the same day and remains in parity closeout while runtime routing stays limited to commands whose catalog entry is `implemented`.

## What Is Locked

- Global install target: `gemini extensions install https://github.com/rakole/blueprint`
- Brand and namespace: `blueprint`, with a root `/blu` router and direct `/blu-<command>` commands; deprecated `/blu:<command>` aliases remain for one release
- Project state location: `.blueprint/`
- Global mutable state location: `~/.gemini/blueprint/`
- Config layering: normalized repo config in `.blueprint/config.json`, optional user defaults in `~/.gemini/blueprint/defaults.json`
- Runtime architecture: Gemini commands, Gemini skills, Gemini subagents, advisory hooks, and an extension-bundled MCP server
- Delivery approach: docs-first planning pack first, then granular command-by-command implementation with repair checkpoints when runtime and docs drift

## Current Status

- Wave 0 shipped commands: `/blu`, `/blu-new-project`, `/blu-settings`, `/blu-set-profile`, `/blu-help`, `/blu-progress`, `/blu-health`, `/blu-map-codebase`
- Phase 3 discovery commands are shipped: `/blu-discuss-phase`, `/blu-research-phase`, `/blu-ui-phase`
- The shipped lifecycle slice also includes `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-verify-work`, and the read-only next-step router `/blu-next`
- The read-only phase-discovery assumptions command `/blu-list-phase-assumptions` is now shipped on the same discovery substrate
- The governance handoff and resume commands `/blu-pause-work` and `/blu-resume-work` are now shipped with durable MCP-owned handoff/state routing in `.blueprint/reports/` and `.blueprint/STATE.md`
- The security audit command `/blu-secure-phase` is now shipped; it reads saved phase evidence, uses the `blueprint-review` skill plus the bounded `blueprint-security-auditor` contract when needed, and persists `XX-SECURITY.md` through `blueprint_review_record`
- The roadmap append command `/blu-add-phase` is now shipped; it appends the next whole-number phase, ignores decimal suffixes when numbering, scaffolds `.blueprint/phases/<phase-slug>/`, and updates `.blueprint/STATE.md`
- The roadmap insertion command `/blu-insert-phase` is now shipped; it inserts the next decimal phase after an existing integer anchor, keeps later roadmap entries stable, scaffolds `.blueprint/phases/<decimal-phase-slug>/`, and routes back into `/blu-discuss-phase`
- The roadmap removal command `/blu-remove-phase` is now shipped; it removes a future phase, deletes the matching phase directory, renumbers later roadmap references and phase artifacts, and updates `.blueprint/STATE.md`
- The milestone audit command `/blu-audit-milestone` is now shipped; it compares original milestone intent against completed phase evidence and writes a durable report in `.blueprint/reports/`
- The gap-planning command `/blu-plan-milestone-gaps` is now shipped; it reads the latest milestone audit, groups actionable gaps into a small set of follow-up phases, appends them to `.blueprint/ROADMAP.md`, and updates `.blueprint/STATE.md`
- The milestone closeout trio `/blu-complete-milestone`, `/blu-milestone-summary`, and `/blu-new-milestone` are now shipped on the existing roadmap, artifact, and state MCP substrates; `new-milestone` defaults to carry-forward and may optionally reuse `blueprint-roadmapper`
- The capture command `/blu-note` is now shipped; it appends deterministic project-local notes to `.blueprint/notes/NOTES.md`, detects duplicates, and keeps note persistence inside Blueprint MCP
- The capture command `/blu-add-todo` is now shipped; it appends deterministic project-local todos to `.blueprint/todos/TODO.md`, detects duplicates, and keeps todo persistence inside Blueprint MCP
- The capture command `/blu-add-backlog` is now shipped; it appends deterministic parking-lot entries to `.blueprint/backlog/BACKLOG.md`, detects duplicates, and can optionally reserve a `999.x` stub through Blueprint MCP plus scaffolding
- The bounded execution command `/blu-quick` is now shipped; it keeps lightweight repo work inside a reduced-ceremony path, uses optional discuss, research, and validation depth only after explicit confirmation, persists `.blueprint/reports/quick-run-latest.md`, and updates `.blueprint/STATE.md`
- The documentation command `/blu-docs-update` is now shipped on April 12, 2026; it scopes repo-doc edits narrowly, verifies claims against repo and Blueprint evidence, and persists a durable `.blueprint/reports/docs-update-latest.md` report
- Runtime gate: `/blu`, `/blu-help`, and `/blu-progress` must still recommend only commands whose runtime catalog entry is `implemented`

## Install And Release

Blueprint is intended to install from the public repository:

```bash
gemini extensions install https://github.com/rakole/blueprint
```

After install or update, restart Gemini CLI before expecting `/blu` or `/blu-help`
to appear in the active session.

Release and operator verification should always confirm the bundled extension
shape, not just the source tree:

1. `npm ci`
2. `npm run build`
3. `npm test`
4. `gemini extensions validate . --debug`
5. Clean-home smoke from a temporary home:
   - `HOME="$TMPDIR/blueprint-gemini-home" gemini extensions link .`
   - `HOME="$TMPDIR/blueprint-gemini-home" gemini extensions list`
6. Restart Gemini CLI with that clean home and confirm `/blu` plus `/blu-help`
   load before treating the release candidate as publishable.

`dist/` must be current before publishing because Gemini loads the built MCP
server and built hooks, not the TypeScript source files directly.

Manifest hardening note: `excludeTools` is intentionally deferred for now. The
extension should adopt it only after a focused compatibility pass proves the
restricted tool surface will not break shipped command flows or Gemini's own
runtime expectations.

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
- `commands/blu-new-project.toml`
- `commands/blu-settings.toml`
- `commands/blu-set-profile.toml`
- `commands/blu-help.toml`
- `commands/blu-progress.toml`
- `commands/blu-health.toml`
- `commands/blu-map-codebase.toml`
- `commands/blu-note.toml`
- `commands/blu-add-todo.toml`
- `commands/blu-add-backlog.toml`
- `commands/blu-quick.toml`
- `commands/blu-discuss-phase.toml`
- `commands/blu-list-phase-assumptions.toml`
- `commands/blu-research-phase.toml`
- `commands/blu-ui-phase.toml`
- `commands/blu-plan-phase.toml`
- `commands/blu-execute-phase.toml`
- `commands/blu-validate-phase.toml`
- `commands/blu-verify-work.toml`
- `commands/blu-secure-phase.toml`
- `commands/blu-audit-milestone.toml`
- `commands/blu-add-phase.toml`
- `commands/blu-insert-phase.toml`
- `commands/blu-complete-milestone.toml`
- `commands/blu-docs-update.toml`
- `commands/blu-milestone-summary.toml`
- `commands/blu-new-milestone.toml`
- `commands/blu-plan-milestone-gaps.toml`
- `commands/blu-remove-phase.toml`
- `commands/blu-next.toml`
- `commands/blu-pause-work.toml`
- `commands/blu-resume-work.toml`
- Deprecated one-release compatibility manifests for shipped direct commands under `commands/blu/*.toml`
- `skills/blueprint-router/SKILL.md`
- `skills/blueprint-router.md` (legacy mirror retained for compatibility docs during migration)
- `skills/blueprint-bootstrap/SKILL.md`
- `skills/blueprint-governance/SKILL.md`
- `skills/blueprint-map/SKILL.md`
- `skills/blueprint-capture/SKILL.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `skills/blueprint-phase-planning/SKILL.md`
- `skills/blueprint-phase-execution/SKILL.md`
- `skills/blueprint-phase-validation/SKILL.md`
- `skills/blueprint-docs/SKILL.md`
- `skills/blueprint-review/SKILL.md`
- `skills/blueprint-roadmap-admin/SKILL.md`
- `agents/blueprint-project-researcher.md`
- `agents/blueprint-roadmapper.md`
- `agents/blueprint-mapper.md`
- `agents/blueprint-researcher.md`
- `agents/blueprint-ui-designer.md`
- `agents/blueprint-planner.md`
- `agents/blueprint-checker.md`
- `agents/blueprint-executor.md`
- `agents/blueprint-verifier.md`
- `agents/blueprint-doc-writer.md`
- `agents/blueprint-doc-verifier.md`
- `agents/blueprint-security-auditor.md`
- `hooks/hooks.json`
- `src/mcp/server.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/review.ts`
- `src/hooks/`

## Command Status

Blueprint uses one runtime-facing vocabulary across docs and the command catalog:

- `implemented`: manifest, primary skill, and required MCP tools are present
- `repairing`: partially shipped and under active drift repair
- `blocked`: not safe to expose because required runtime pieces are missing
- `planned`: documented future intent only

## Next Implementation Slice

Wave 2 milestone closeout is now part of the shipped runtime. The next broad rollout should start from a fresh plan while the shipped Phase 3, Phase 4, governance handoff/resume, and roadmap-admin guarantees stay green:

1. Keep `/blu`, `/blu-help`, and `/blu-progress` limited to `implemented` commands until any new manifest, primary skill, and required MCP tools actually ship
2. Keep the shipped `insert-phase` contract aligned across docs, manifest, primary skill, required MCP substrate, and regression coverage
3. Preserve the shipped pause/resume routing, validation parity, roadmap append/removal guarantees, milestone audit and closeout report contracts, and carry-forward `new-milestone` behavior while the next post-Wave-2 slice lands

The Phase 2.2 closure record lives in `docs/DRIFT.MD`, and the next-session pickup guide lives in `docs/HANDOFF.md`.
