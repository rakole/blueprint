# `/blu-check-todos`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | List pending todos and select one to work on |


## Purpose


`check-todos` carries forward the GSD intent to list pending todos and select one to work on. In Blueprint it stays Gemini-native, reads repo readiness through `blueprint_project_status`, and uses the shared capture index MCP tool to inspect pending todos plus mark a single todo active or completed when the user confirms that change.


## Command Path And Examples

- Gemini command path: `/blu-check-todos`
- Compatibility during this release: `/blu:check-todos` (deprecated; remove next release)
- Root router form: `/blu check-todos`
- Argument hint: `[area filter]`
- `/blu-check-todos auth`
- `/blu check-todos`

## Inputs, Project State, And Prerequisite Artifacts


- A todo index should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `todo status fields when selection or completion changes`


## Required MCP Tools


- `blueprint_artifact_mutate_index` -> `{targetPath, matchedEntryIds, entries, updatedCounts, summary}`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`


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


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `check-todos` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/check-todos.md`
- Upstream workflow status: GSD has an upstream workflow file
