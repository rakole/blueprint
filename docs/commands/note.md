# `/blu-note`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `note` uses the shared interactive-read classification only to keep the command metadata aligned; it completes inline, stays grounded in local Blueprint state, and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Unsupported list, promote, or global-note asks should stop quickly with implemented-only guidance instead of turning `/blu-note` into a broader workflow.


## Purpose


`note` is Blueprint's command for zero-friction idea capture. In Blueprint, the currently shipped slice supports project-local append-only note capture through MCP-backed persistence. It keeps notes inside `.blueprint/notes/`, does not reintroduce global-note behavior, and leaves listing or promotion behavior for later dedicated capture contracts.


## Command Path And Examples

- CLI command path: `/blu-note`
- Root router form: `/blu note`
- Argument hint: `<text>`
- `/blu-note Investigate-sync-edge-cases`
- `/blu note`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project should already exist for persistence.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: appends to `.blueprint/notes/NOTES.md` only.
- In-flight posture: none beyond a concise inline summary or reroute; `note` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `.blueprint/notes/NOTES.md`


## Required MCP Tools


- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`

## Capture Tool Contract

- Call `blueprint_artifact_mutate_index` in append mode by omitting `action` and passing the note body in `entry.text`.
- Treat returned `createdEntryIds` or `duplicateEntryIds` as the authoritative note identifiers. Do not synthesize `NOTE-*` ids manually.


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
- Explicitly excludes `update_topic`, `write_todos`, tracker-backed branching, and other long-running progress behavior.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `note` happy-path fixture.
