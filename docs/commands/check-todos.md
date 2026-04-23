# `/blu-check-todos`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `check-todos` uses the shared interactive-read classification only to keep the command metadata aligned; it inspects or updates one bounded todo state at a time and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- When the project is missing, partial, unhealthy, or the todo selection is ambiguous, stop with the next safe implemented action instead of making `/blu-check-todos` look like a longer workflow.


## Purpose


`check-todos` is Blueprint's command for list pending todos and select one to work on. In Blueprint it stays host-native, reads repo readiness through `blueprint_project_status`, and uses the shared capture index MCP tool to inspect pending todos plus mark a single todo active or completed when the user confirms that change.


## Command Path And Examples

- CLI command path: `/blu-check-todos`
- Root router form: `/blu check-todos`
- Argument hint: `[area filter]`
- `/blu-check-todos auth`
- `/blu check-todos`

## Inputs, Project State, And Prerequisite Artifacts


- A todo index should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: lists from or updates `.blueprint/todos/TODO.md` only.
- In-flight posture: none beyond a concise inline summary or confirmation gate; `check-todos` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `todo status fields when selection or completion changes`


## Required MCP Tools


- `blueprint_artifact_mutate_index` -> `{targetPath, matchedEntryIds, entries, updatedCounts, summary}`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`

## Todo Mutation Contract

- List todos through `blueprint_artifact_mutate_index` with `action: "list"` and optional `filter` values.
- Status changes must use `action: "update"` plus either `match.id` or exact `match.text`, and they must include `update.status`.
- Treat returned `matchedEntryIds` as the authoritative todo selection. Do not guess from display order alone.


## Skills And Subagents


- Primary skill: `blueprint-capture`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/add-todo.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: todo selection and status update only.

## User Prompts And Confirmation Gates


- Confirm active or completed status changes before writing them.
- Confirm active or completed status changes before writing them unless the user's intent is already unmistakably explicit.
- If the user's intent is already unmistakably explicit, the command may proceed without re-asking. Prefer Gemini CLI `ask_user` when a structured choice helps, otherwise keep the same gate explicit in prose.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.


## Failure Modes And Recovery


- Repair malformed index files through MCP instead of raw append logic.
- Route oversized execution asks to `quick` or `plan-phase` instead of bluffing.


## Acceptance Criteria


- Capture outputs stay deterministic, and todo status updates remain MCP-owned.
- If no Blueprint project exists, the command degrades to safe suggestion mode instead of inventing persistence.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Explicitly excludes `update_topic`, `write_todos`, tracker-backed branching, and other long-running progress behavior.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `check-todos` happy-path fixture.
