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

## Parity Goal

Carry forward the useful capture behavior from GSD while preserving Blueprint's Gemini-native boundaries:

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
- `docs/GSD-RUNTIME-MIGRATION.md`

## Required MCP Tools

- `blueprint_artifact_mutate_index`
- `blueprint_artifact_scaffold`
- `blueprint_project_status`
- `blueprint_state_update`
- `blueprint_roadmap_add_phase`

## Optional Agents

- `blueprint-researcher`

## Workflow Rules

### `add-backlog`

1. Require a non-empty backlog description before any mutation.
2. Use `blueprint_artifact_mutate_index` for durable backlog writes instead of raw append logic.
3. Degrade to suggestion mode when the repo is not yet a Blueprint project.
4. Treat normalized duplicate backlog descriptions as already captured work and report the existing entry instead of creating a second copy.
5. Reserve a `999.x` phase stub only when the user explicitly asks for it and confirms that reservation.
6. When a stub is reserved, create its initial context scaffold through `blueprint_artifact_scaffold` rather than hand-writing the phase file.
7. Keep follow-up guidance inside implemented commands only.

## Future Capture Guardrails

- `note`, `add-todo`, `check-todos`, `review-backlog`, and `explore` stay documented contracts until their own manifests and any extra MCP substrate ship.
- Do not quietly promote backlog entries into roadmap phases without the dedicated promotion contract.
- Do not write capture state outside `.blueprint/notes/`, `.blueprint/todos/`, `.blueprint/backlog/`, or explicitly reserved `.blueprint/phases/999.x-*/` stubs.

## Output Style

- Report created entry IDs plainly.
- Mention duplicate detection and recovery warnings when they occur.
- Keep parking-lot summaries short and action-oriented.
