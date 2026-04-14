# `/blu-pause-work`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`pause-work` is Blueprint's command for create context handoff when pausing work mid-phase. In Blueprint it stays host-native, persists the handoff through dedicated MCP tools, and keeps follow-up routing inside the implemented Blueprint surface.


## Command Path And Examples

- CLI command path: `/blu-pause-work`
- Root router form: `/blu pause-work`
- Argument hint: `none`
- `/blu-pause-work`
- `/blu pause-work`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `.blueprint/reports/pause-work-latest.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_pause_handoff_get` -> `{found, path, handoff, reason}`
- `blueprint_pause_handoff_write` -> `{path, written, created, overwritten, status, handoff}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-governance`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/progress.md`


## Related Command Docs


- `docs/commands/progress.md`
- `docs/commands/resume-work.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: writes handoff and state artifacts only.

## User Prompts And Confirmation Gates


- Confirm replacement when `.blueprint/reports/pause-work-latest.md` already exists and the user has not clearly asked to replace it.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which Blueprint prerequisite is missing and which command creates or repairs it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Captures resumable context including current state, completed work, remaining work, decisions, blockers, pending human actions, modified files, context notes, and the first next action.
- Does not create an automatic git commit; Blueprint keeps pause persistence in MCP-owned artifacts rather than silent VCS writes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `pause-work` happy-path fixture.


