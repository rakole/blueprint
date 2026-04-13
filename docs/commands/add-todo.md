# `/blu-add-todo`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Capture idea or task as todo from current conversation context |


## Purpose


`add-todo` carries forward the GSD intent to capture idea or task as todo from current conversation context. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-add-todo`
- Root router form: `/blu add-todo`
- Argument hint: `<description>`
- `/blu-add-todo Add-retry-telemetry`
- `/blu add-todo`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project should already exist for persistence.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `.blueprint/todos/TODO.md`


## Required MCP Tools


- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`


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
- `docs/commands/new-project.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: todo index update only.

## User Prompts And Confirmation Gates


- None.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.


## Failure Modes And Recovery


- Repair malformed index files through MCP instead of raw append logic.
- Route oversized execution asks to `quick` or `plan-phase` instead of bluffing.


## Acceptance Criteria


- Capture outputs stay deterministic and append-only where expected.
- If no Blueprint project exists, the command degrades to safe suggestion mode instead of inventing persistence.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `add-todo` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/add-todo.md`
- Upstream workflow status: GSD has an upstream workflow file
