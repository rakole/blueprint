# `/blu-add-backlog`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`add-backlog` is Blueprint's command for add an idea to the backlog parking lot (999.x numbering). In Blueprint it should stay host-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- CLI command path: `/blu-add-backlog`
- Root router form: `/blu add-backlog`
- Argument hint: `<description>`
- `/blu-add-backlog Offline-mode`
- `/blu add-backlog`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `.blueprint/backlog/BACKLOG.md`
- `optional 999.x phase stub in .blueprint/phases/`


## Required MCP Tools


- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`

## Capture Tool Contract

- Call `blueprint_artifact_mutate_index` in append mode by omitting `action` and passing the backlog text in `entry.text`.
- Set `entry.reservePhaseStub=true` only after the user explicitly confirms that reservation.
- Treat returned `createdEntryIds`, `duplicateEntryIds`, and `reservedPhase` as authoritative. Do not synthesize `BACKLOG-*` ids or `999.x` stub paths manually.
- When a stub is reserved, scaffold only the returned `reservedPhase.artifactPaths` entry. Do not hand-write the reserved phase context file.


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

- Low: backlog append plus optional stub scaffold.

## User Prompts And Confirmation Gates


- Confirm immediate phase-stub reservation when used.


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
- Direct `add-backlog` happy-path fixture.

