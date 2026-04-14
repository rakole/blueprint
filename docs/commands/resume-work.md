# `/blu-resume-work`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`resume-work` restores a paused Blueprint session from the canonical handoff and state artifacts, then surfaces the next safe implemented action. In Blueprint it stays host-native and uses documented MCP tools for deterministic re-entry.


## Command Path And Examples

- CLI command path: `/blu-resume-work`
- Root router form: `/blu resume-work`
- Argument hint: `none`
- `/blu-resume-work`
- `/blu resume-work`

## Inputs, Project State, And Prerequisite Artifacts


- A prior `pause-work` handoff or populated `STATE.md` should exist.


## Outputs


- User-facing result: a concise resume summary plus the next safe implemented action when applicable.
- Repo side effects: Updates the current Blueprint state to reflect the resumed session.


## Blueprint And Global State Reads


- `.blueprint/STATE.md`
- `.blueprint/reports/pause-work-latest.md`
- relevant phase artifacts when present


## Blueprint And Global State Writes


- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_pause_handoff_get` -> `{found, path, handoff, reason}`
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
- `docs/commands/pause-work.md`


## Related Command Docs


- `docs/commands/progress.md`
- `docs/commands/pause-work.md`
- `docs/commands/next.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: restores state and updates `STATE.md` only.

## User Prompts And Confirmation Gates


- None unless multiple valid handoff candidates exist later or the latest handoff clearly conflicts with current phase state.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which handoff or phase artifact is missing and which command creates or repairs it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reconstructs context from `STATE.md`, phase artifacts, and the canonical `pause-work` handoff schema in `.blueprint/reports/pause-work-latest.md`.
- Updates `STATE.md` whenever the next-step signal changes.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `resume-work` happy-path fixture.


