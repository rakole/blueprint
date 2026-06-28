# Blueprint Agent Guide

## Purpose

This file gives Codex durable repo-scoped rules for working in Blueprint.

## Hard Rules

- Do not use GSD or Blueprint workflows to develop Blueprint; use Codex harness tools and normal repo commands.
- Close subagents as soon as their bounded task is done.
- For any source-controlled edit, work in a fresh git worktree; subagents should stay in that same worktree.
- After work is complete, merge to `origin/main`, fast-forward local `main`, and clean up stale branches and worktrees.
- In every fresh worktree, run `npm ci` before `npm run build`, `npm run typecheck`, or `npm test`.
- Treat the Codex GitHub plugin as read-only; use `gh` CLI or normal git pushes for write operations.

## Product Guardrails

- Blueprint is a Gemini-native redesign, not GSD and not a legacy slash-command port.
- Keep commands thin, skills orchestration-focused, agents bounded, MCP tools state-owning, and hooks advisory.
- `.blueprint/` is runtime state; do not hand-edit it or mutate installed extension directories.
- `~/.gemini/blueprint/` is host-global operational state; do not mutate it unless the task explicitly requires the owning runtime code path.
- `.planning/` in this repo is local implementation bookkeeping only.
- `/blu`, `/blu-help`, and `/blu-progress` must recommend only commands whose live catalog status is `implemented`.
- Require explicit confirmation for high-risk commands such as `undo`, `ship`, `pr-branch`, `new-workspace`, `remove-workspace`, `cleanup`, and `reapply-patches`.

## Read Order

1. `agent-docs/README.md`
2. The task-relevant files it points you to under `agent-docs/`
3. `src/mcp/command-runtime-metadata.ts`
4. `generated/command-catalog.json`
5. `blueprint://commands/catalog`
6. `blueprint://commands/{command}/runtime-contract`
7. The matching `commands/blu*.toml`, `skills/*/SKILL.md`, `agents/*.md`, source files, and tests for the area you are changing

## Runtime Anchors

- Command availability is grounded in source-owned metadata and live runtime checks, not repo-root documentation mirrors.
- For implemented-only routing questions, start with `src/mcp/tools/project.ts`, `src/mcp/command-runtime-metadata.ts`, `generated/command-catalog.json`, and `blueprint://commands/catalog`.
- When command behavior and guidance differ, reconcile against the live runtime contract for that command.

## Working Norms

- Preserve changes you did not make.
- Prefer deterministic MCP-owned writes over script-owned persistence.
- Keep edits scoped to the touched workflow and its local verification surface.
- When architecture or wave behavior changes, update the owned source or `agent-docs/` authority instead of creating a new repo-root mirror.
