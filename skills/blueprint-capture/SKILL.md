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
input_bundles:
  shared: []
  commands:
    "/blu-note":
      - commands/blu-note.toml
    "/blu-add-todo":
      - commands/blu-add-todo.toml
    "/blu-check-todos":
      - commands/blu-check-todos.toml
    "/blu-add-backlog":
      - commands/blu-add-backlog.toml
    "/blu-review-backlog":
      - commands/blu-review-backlog.toml
    "/blu-explore":
      - commands/blu-explore.toml
---

# Blueprint Capture Skill

## Purpose

Keep notes, todos, backlog entries, and ideation handoffs project-local, deterministic, and easy to promote later without turning chat history into the source of truth.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Invoke optional subagents only when the current command contract explicitly allows them and effective config has `workflow.subagents=true`; otherwise use the command's no-subagent fallback and state config disabled subagents.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- Load only the active command's structured `input_bundles.commands[...]` inputs for that invocation.

## Parity Goal

Keep the useful capture behavior while preserving Blueprint's host-native boundaries:

- capture state stays inside `.blueprint/`
- MCP tools own durable writes and index repair
- parking-lot ideas may reserve `999.x` phase-style stubs without becoming active roadmap work
- root routing and follow-up guidance stay inside the implemented command surface
- planned capture commands remain documented but unroutable until their own manifest-plus-tool contracts ship

## Required MCP Tools

- `blueprint_artifact_mutate_index`
- `blueprint_artifact_scaffold`
- `blueprint_project_status`
- `blueprint_roadmap_add_phase`
- `blueprint_state_update`
- `blueprint_roadmap_promote_backlog`

## Optional Agents

- `blueprint-researcher`

## Shared MCP Contracts

- `blueprint_artifact_mutate_index`: omit `action` for append flows, pass the user text in `entry.text`, and use only returned `createdEntryIds`, `duplicateEntryIds`, `matchedEntryIds`, or `reservedPhase` as authoritative capture ids and reserved-stub metadata. Never synthesize capture ids manually.
- `blueprint_roadmap_promote_backlog`: call with `previewOnly: true`, or with no `backlogIds`, for preview mode. Promote only with confirmed `backlogIds` from the preview result, and treat returned `promotedItems` plus `createdPhaseDirs` as authoritative.
- `blueprint_roadmap_add_phase`: pass only the normalized phase-ready description. Do not precompute phase numbers, slugs, or phase directories; use the returned `phaseNumber`, `phasePrefix`, and `phaseDir`.
- `blueprint_artifact_scaffold`: pass only supported repo-relative Blueprint artifact paths. Use scaffolding to seed a missing context file or reserved stub, not as the final filled-in content.

## Workflow Rules

Execution profile for `/blu-note`, `/blu-add-todo`, `/blu-check-todos`, `/blu-add-backlog`, `/blu-review-backlog`, and `/blu-explore`: `interactive-read`.

In-flight status fields for this capture family: resolved scope, active stage, pending gate, execution mode, next safe action.

Treat capture as short interactive routing or index mutation, not as long-running orchestration. Do not use `update_topic`, `write_todos`, or tracker tools to make these commands look like `quick`, lifecycle, review, or maintenance runs. When a capture command needs confirmation, prefer a single structured `ask_user` decision on Gemini; otherwise keep the same gate explicit in prose.

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
5. Reserve a `999.x` phase stub only when the user explicitly asks for it and confirms that reservation. Prefer Gemini's `ask_user` tool when a structured confirmation helps.
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
4. Require explicit confirmation before marking a todo `active` or `completed` unless the user request is already unmistakably explicit. Prefer Gemini's `ask_user` tool when a structured confirmation helps.
5. Use `blueprint_artifact_mutate_index` with `target: "todo"` and `action: "update"` for status changes, and prefer exact todo IDs when mutating.
6. Keep follow-up guidance inside implemented commands only.

### `review-backlog`

1. Start with `blueprint_roadmap_promote_backlog` in preview mode so backlog review decisions come from the canonical backlog index instead of chat memory.
2. Require explicit confirmation for each promote or remove decision; keep is the default safe path. Prefer Gemini's `ask_user` tool when a structured decision helps.
3. Promote confirmed backlog items through `blueprint_roadmap_promote_backlog` so roadmap append logic, next-phase numbering, and reserved `999.x` stub reuse stay deterministic. Use the preview result's `backlogId` values as the only valid promotion ids.
4. After promotion, update the canonical backlog rows through `blueprint_artifact_mutate_index` with `action: "update"` so promoted items become `promoted` and clear any consumed reserved phase metadata. Reuse the same confirmed backlog ids instead of re-deriving them from prose.
5. If the user explicitly removes backlog items from active consideration, mark them `archived` through `blueprint_artifact_mutate_index` instead of deleting history.
6. Use `blueprint_state_update` so the next safe implemented action routes to `/blu-discuss-phase <first promoted phase>` when promotion happened, or `/blu-progress` when it did not. Use the returned `promotedItems[0].phaseNumber` when a concrete promoted phase is needed for follow-up routing.
7. Keep follow-up guidance inside implemented commands only.

### `explore`

1. Require a non-empty idea or topic before doing any classification work.
2. Read `blueprint_project_status` first so missing or partial Blueprint state routes safely.
3. Classify the idea into exactly one of `note`, `todo`, `backlog`, `roadmap`, or `no-write`.
4. If the request is clearly execution-sized or phase-sized beyond a capture handoff, do not persist it through capture tools; route to `quick` or `plan-phase` instead.
5. If the repo is not yet a Blueprint project, stop in suggestion mode and direct the user to `/blu-new-project` instead of inventing persistence.
6. Confirm the final routing target and normalized text before any write. Review is the default safe path, and Gemini's `ask_user` tool is preferred when a structured confirmation helps.
7. Use `blueprint_artifact_mutate_index` for confirmed `note`, `todo`, or `backlog` writes, and treat duplicate descriptions as already captured work instead of creating a second copy.
8. Use `blueprint_roadmap_add_phase` only when the confirmed target is roadmap-ready active work; if project health is partial, route to `/blu-health` before roadmap mutation.
9. After confirmed roadmap promotion, use `blueprint_artifact_scaffold` to create or reuse the initial phase context instead of hand-writing it.
10. Keep follow-up guidance inside implemented commands only. Prefer `/blu-check-todos` after todo capture, `/blu-review-backlog` after backlog capture, `/blu-discuss-phase <phase>` after roadmap capture, and `/blu-progress` otherwise.

## Future Capture Guardrails

- Do not write capture state outside `.blueprint/notes/`, `.blueprint/todos/`, `.blueprint/backlog/`, or explicitly reserved `.blueprint/phases/999.x-*/` stubs.

## Output Style

- Report created entry IDs plainly.
- Mention duplicate detection and recovery warnings when they occur.
- Keep parking-lot summaries short and action-oriented.

## Completion Self-Check

Before claiming completion, verify:

- The active `/blu-*` command's manifest was loaded from `input_bundles.commands[...]`, and sibling capture manifests were not treated as active input.
- Required MCP calls for the active command were made in manifest order, using runtime FQNs such as `mcp_blueprint_blueprint_artifact_mutate_index`.
- Persistence went only through the owning MCP tools, with returned `status`, ids, `created`, `updated`, `written`, `path`, `warnings`, and `reason` fields treated as authoritative.
- Any required confirmation gate was satisfied before stub reservation, todo status changes, backlog promotion/removal, roadmap capture, scaffolding, or state updates.
- Duplicate, `project_missing`, unhealthy, invalid, rejected, partial, or skipped results were repaired or reported honestly, not described as successful capture.
- Writes stayed inside the active command's allowed `.blueprint/` paths and did not touch installed extension files, unrelated Blueprint state, runtime docs, manifests, or planned-only surfaces.
- Follow-up routing named only implemented Blueprint commands, using `/blu-progress` when the safe next action was ambiguous.
- The final response reported concrete artifact paths or no-write status, authoritative ids or phase numbers, warnings/blockers, and the next safe implemented action.
