---
name: blueprint-capture
description: >
  Project-local capture and parking-lot workflows for Blueprint. Use this skill
  to record ideas deterministically in `.blueprint/` without skipping MCP-owned
  persistence or advertising unimplemented capture commands as runnable.
status: implemented
commands:
  - /blu-note
  - /blu-add-todo
  - /blu-check-todos
  - /blu-add-backlog
  - /blu-review-backlog
  - /blu-explore
---

# Blueprint Capture Skill

## Purpose

Keep notes, todos, backlog entries, and ideation handoffs project-local, deterministic, and easy to promote later without turning chat history into the source of truth.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Keep the useful capture behavior while preserving Blueprint's host-native boundaries:

- capture state stays inside `.blueprint/`
- MCP tools own durable writes and index repair
- parking-lot ideas may reserve `999.x` phase-style stubs without becoming active roadmap work
- root routing and follow-up guidance stay inside the implemented command surface
- planned capture commands remain documented but unroutable until their own manifest-plus-tool contracts ship

## Required Inputs

- `docs/commands/note.md`
- `docs/commands/add-todo.md`
- `docs/commands/check-todos.md`
- `docs/commands/add-backlog.md`
- `docs/commands/review-backlog.md`
- `docs/commands/explore.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`

## Required MCP Tools

- `blueprint_artifact_mutate_index`
- `blueprint_artifact_scaffold`
- `blueprint_project_status`
- `blueprint_state_update`
- `blueprint_roadmap_promote_backlog`

## Optional Agents

- `blueprint-researcher`

## Workflow Rules

### `note`

1. Require non-empty note text before any mutation.
2. Use `blueprint_artifact_mutate_index` with `target: "note"` for durable note writes instead of raw append logic.
3. Degrade to suggestion mode when the repo is not yet a Blueprint project.
4. Treat normalized duplicate note descriptions as already captured work and report the existing entry instead of creating a second copy.
5. Keep notes project-local. Do not reintroduce global-note behavior, and do not bluff listing or promotion support before those contracts ship.
6. Keep follow-up guidance inside implemented commands only.

### `add-backlog`

1. Require a non-empty backlog description before any mutation.
2. Use `blueprint_artifact_mutate_index` for durable backlog writes instead of raw append logic.
3. Degrade to suggestion mode when the repo is not yet a Blueprint project.
4. Treat normalized duplicate backlog descriptions as already captured work and report the existing entry instead of creating a second copy.
5. Reserve a `999.x` phase stub only when the user explicitly asks for it and confirms that reservation.
6. When a stub is reserved, create its initial context scaffold through `blueprint_artifact_scaffold` rather than hand-writing the phase file.
7. Keep follow-up guidance inside implemented commands only.

### `add-todo`

1. Require a non-empty todo description before any mutation.
2. Use `blueprint_artifact_mutate_index` with `target: "todo"` for durable writes instead of raw append logic.
3. Degrade to suggestion mode when the repo is not yet a Blueprint project.
4. Treat normalized duplicate todo descriptions as already captured work and report the existing entry instead of creating a second copy.
5. Keep follow-up guidance inside implemented commands only.

### `check-todos`

1. Read `blueprint_project_status` before listing or mutating todos so missing or partial Blueprint state routes safely.
2. Use `blueprint_artifact_mutate_index` with `target: "todo"` and `action: "list"` to inspect pending todos. Apply a query filter when the user supplies an area, ID, or keyword.
3. When the user only wants the queue, keep the response read-oriented and show pending todos with any active item first.
4. Require explicit confirmation before marking a todo `active` or `completed` unless the user request is already unmistakably explicit.
5. Use `blueprint_artifact_mutate_index` with `target: "todo"` and `action: "update"` for status changes, and prefer exact todo IDs when mutating.
6. Keep follow-up guidance inside implemented commands only.

### `review-backlog`

1. Start with `blueprint_roadmap_promote_backlog` in preview mode so backlog review decisions come from the canonical backlog index instead of chat memory.
2. Require explicit confirmation for each promote or remove decision; keep is the default safe path.
3. Promote confirmed backlog items through `blueprint_roadmap_promote_backlog` so roadmap append logic, next-phase numbering, and reserved `999.x` stub reuse stay deterministic.
4. After promotion, update the canonical backlog rows through `blueprint_artifact_mutate_index` with `action: "update"` so promoted items become `promoted` and clear any consumed reserved phase metadata.
5. If the user explicitly removes backlog items from active consideration, mark them `archived` through `blueprint_artifact_mutate_index` instead of deleting history.
6. Use `blueprint_state_update` so the next safe implemented action routes to `/blu-discuss-phase <first promoted phase>` when promotion happened, or `/blu-progress` when it did not.
7. Keep follow-up guidance inside implemented commands only.

### `explore`

1. Require a non-empty idea or topic before doing any classification work.
2. Read `blueprint_project_status` first so missing or partial Blueprint state routes safely.
3. Classify the idea into exactly one of `note`, `todo`, `backlog`, `roadmap`, or `no-write`.
4. If the request is clearly execution-sized or phase-sized beyond a capture handoff, do not persist it through capture tools; route to `quick` or `plan-phase` instead.
5. If the repo is not yet a Blueprint project, stop in suggestion mode and direct the user to `/blu-new-project` instead of inventing persistence.
6. Confirm the final routing target and normalized text before any write. Review is the default safe path.
7. Use `blueprint_artifact_mutate_index` for confirmed `note`, `todo`, or `backlog` writes, and treat duplicate descriptions as already captured work instead of creating a second copy.
8. Use `blueprint_roadmap_add_phase` only when the confirmed target is roadmap-ready active work; if project health is partial, route to `/blu-health` before roadmap mutation.
9. Keep follow-up guidance inside implemented commands only. Prefer `/blu-check-todos` after todo capture, `/blu-review-backlog` after backlog capture, `/blu-discuss-phase <phase>` after roadmap capture, and `/blu-progress` otherwise.

## Future Capture Guardrails

- Do not write capture state outside `.blueprint/notes/`, `.blueprint/todos/`, `.blueprint/backlog/`, or explicitly reserved `.blueprint/phases/999.x-*/` stubs.

## Output Style

- Report created entry IDs plainly.
- Mention duplicate detection and recovery warnings when they occur.
- Keep parking-lot summaries short and action-oriented.
