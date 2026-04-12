# Wave 2 Agent Workflow

Last updated: 2026-04-12

## Purpose

This document is the anti-drift operating contract for every agent working on the Blueprint Wave 2 closeout cycle.

It exists to keep the remaining roadmap-admin work aligned with:

- the current repo truth
- Blueprint's locked product decisions
- Gemini CLI extension packaging rules
- the implemented-only routing guarantee

## Current Repo Truth

- Blueprint is a Gemini CLI extension rooted at `gemini-extension.json` with `GEMINI.md`, `commands/`, `skills/`, `agents/`, and `hooks/hooks.json`.
- Wave 0 foundation commands are shipped.
- Wave 1 lifecycle commands are shipped.
- The already-shipped Wave 2 roadmap-admin commands are `add-phase`, `remove-phase`, `plan-milestone-gaps`, `audit-milestone`, and `list-phase-assumptions`.
- The only Wave 2 closeout target for this cycle is the milestone trio:
  - `complete-milestone`
  - `milestone-summary`
  - `new-milestone`
- `insert-phase` stays documented but blocked and non-routable in this cycle.
- `/blu`, `/blu:help`, and `/blu:progress` must continue to surface only commands whose catalog entry is `implemented`.

## Mandatory Read Order

Every agent must read these before claiming work:

1. `AGENTS.md`
2. `docs/DECISIONS.md`
3. `docs/DRIFT.MD`
4. `docs/ARCHITECTURE.md`
5. `docs/ARTIFACT-SCHEMA.md`
6. `docs/MCP-TOOLS.md`
7. `docs/SKILLS-AND-AGENTS.md`
8. `docs/IMPLEMENTATION-ORDER.md`
9. `docs/COMMAND-CATALOG.md`
10. `docs/commands/complete-milestone.md`
11. `docs/commands/milestone-summary.md`
12. `docs/commands/new-milestone.md`
13. `docs/build/WAVE-2-PARALLEL-CLOSEOUT-PLAN.md`

## Gemini Packaging Checklist

Use the official Gemini references as the platform contract:

- [Extension reference](https://geminicli.com/docs/extensions/reference/)
- [Extension best practices](https://geminicli.com/docs/extensions/best-practices/)
- [Subagents](https://geminicli.com/docs/core/subagents/)

Do not guess the extension shape. Check each affected surface against the official contract:

| Surface | Required rule |
|---|---|
| `gemini-extension.json` | Use `${extensionPath}` for bundled paths, keep `command` and `args` separate, and keep the extension name stable. |
| `commands/**/*.toml` | Commands are discovered from TOML files under `commands/`; command prompts must reference runtime MCP FQNs, not internal file paths. |
| `skills/<name>/SKILL.md` | Skills are Gemini-discoverable bundles; keep frontmatter valid and command ownership current. |
| `agents/*.md` | Agent files must start with YAML frontmatter and remain valid Gemini subagent definitions. |
| `hooks/hooks.json` | Hooks are configured here, not in `gemini-extension.json`. |
| Bundled output | Built paths must resolve through `dist/`, not `src/`. |

## Change Matrix

No Wave 2 command is allowed to land partially.

| If you change | You must also truth-sync |
|---|---|
| `docs/commands/<command>.md` | `docs/COMMAND-CATALOG.md`, `docs/MCP-TOOLS.md`, `docs/GSD-RUNTIME-MIGRATION.md`, `docs/SKILLS-AND-AGENTS.md`, and tests that lock the command contract |
| `commands/blu/<command>.toml` | command metadata tests, runtime contract tests, and any state/progress routing tests affected by the new follow-up |
| `skills/blueprint-roadmap-admin/SKILL.md` | the trio command docs, command metadata tests, and command ownership docs |
| state-derived routing | `tests/help-progress-health.test.ts`, any affected router tests, and control-plane docs that describe the shipped surface |
| command status in docs | actual manifest presence, primary skill contract, required MCP tools, and catalog/runtime tests |

## Hard Bans

- Do not reintroduce `.planning/` as Blueprint runtime state.
- Do not reintroduce `/gsd:*` naming or routing.
- Do not promote a command to `implemented` speculatively.
- Do not add a command without the matching skill contract, MCP docs, and tests.
- Do not add a new MCP tool, new hook, or later-wave agent unless the closeout plan explicitly assigns that work.
- Do not widen the write scope of a claimed task.
- Do not mutate the installed extension directory from Blueprint commands.

## Shared Memory Protocol

Use `scripts/drift-fix-memory.mjs` as the only shared task state for this repair round.

Default workflow:

```bash
node scripts/drift-fix-memory.mjs init --branch "$(git branch --show-current)"
node scripts/drift-fix-memory.mjs register-agent --agent AGENT_ID --worktree "$PWD" --branch "$(git branch --show-current)"
node scripts/drift-fix-memory.mjs claim --agent AGENT_ID --task W2-01 --summary "short scope"
node scripts/drift-fix-memory.mjs note --agent AGENT_ID --task W2-01 --title "Finding" --body "..."
node scripts/drift-fix-memory.mjs complete --agent AGENT_ID --task W2-01 --summary "done" --tests "npm test -- --test-name-pattern=..." --files "a,b,c"
```

If a task truly finishes without repo file edits, do not invent touched files.
Record that explicitly with:

```bash
node scripts/drift-fix-memory.mjs complete --agent AGENT_ID --task W2-08 --summary "regression-only closeout" --tests "npm test" --no-files-reason "Regression-only pass; no repo edits were needed."
```

If blocked:

```bash
node scripts/drift-fix-memory.mjs block --agent AGENT_ID --task W2-01 --reason "..."
node scripts/drift-fix-memory.mjs release --agent AGENT_ID --task W2-01 --reason "..."
```

## Worktree And Git Expectations

Follow the repo-scoped instructions from `AGENTS.md`:

- start each fresh code-change pass in a new worktree
- use a `codex/` branch by default
- finish the work on that branch
- push to `origin`
- open a PR to `main`
- merge the PR
- pull the merged result into local `main`

If a task cannot safely reach push/PR/merge because auth or remote tooling is unavailable, record that explicitly in shared memory and in the final handoff.

## Stop And Re-Plan Conditions

Stop the current task and release it if any of these become necessary:

- a new MCP tool
- a new hook or policy file
- a new later-wave agent
- a cross-task write scope not already assigned in the closeout plan
- a behavior change that would alter implemented-status semantics

When that happens, log the blocker in shared memory and re-plan instead of improvising.
