# `/blu-note`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Zero-friction idea capture. Append, list, or promote notes to todos. |


## Purpose


`note` carries forward the GSD intent to zero-friction idea capture. In Blueprint, the currently shipped slice supports project-local append-only note capture through MCP-backed persistence. It keeps notes inside `.blueprint/notes/`, does not reintroduce upstream global-note behavior, and leaves listing or promotion behavior for later dedicated capture contracts.


## Command Path And Examples

- Gemini command path: `/blu-note`
- Compatibility during this release: `/blu:note` (deprecated; remove next release)
- Root router form: `/blu note`
- Argument hint: `<text>`
- `/blu-note Investigate-sync-edge-cases`
- `/blu note`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project should already exist for persistence.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `.blueprint/notes/NOTES.md`


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

- Low: note capture only.

## User Prompts And Confirmation Gates


- None.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.
- The user asks for `list`, `promote`, or `--global` behavior that is not part of the currently shipped note slice.


## Failure Modes And Recovery


- Repair malformed index files through MCP instead of raw append logic.
- Explain that the shipped note contract supports project-local capture only when the user asks for global notes, listing, or promotion behavior.
- Route oversized execution asks to `quick` or `plan-phase` instead of bluffing.


## Acceptance Criteria


- Capture outputs stay deterministic and append-only where expected.
- If no Blueprint project exists, the command degrades to safe suggestion mode instead of inventing persistence.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Keeps notes project-local instead of reintroducing global-note behavior.
- Leaves unrelated repo files untouched.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `note` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/note.md`
- Upstream workflow status: GSD has an upstream workflow file
