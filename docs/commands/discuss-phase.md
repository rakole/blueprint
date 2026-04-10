# `/blu:discuss-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Gather phase context through adaptive questioning before planning. Use --auto to skip interactive questions (Claude picks recommended defaults). Use --chain for interactive discuss followed by automatic plan+execute. Use --power for bulk question generation into a file-based UI (answer at your own pace). |


## Purpose


`discuss-phase` carries forward the GSD intent to gather phase context through adaptive questioning before planning. Use --auto to skip interactive questions (Claude picks recommended defaults). Use --chain for interactive discuss followed by automatic plan+execute. Use --power for bulk question generation into a file-based UI (answer at your own pace).. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:discuss-phase`
- Root router form: `/blu discuss-phase`
- Argument hint: `<phase> [--auto] [--chain] [--batch] [--analyze] [--text] [--power]`
- `/blu:discuss-phase 3`
- `/blu discuss-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist in `.blueprint/ROADMAP.md`.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `phase XX-CONTEXT.md`
- `optional phase XX-DISCUSSION-LOG.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, requirements, missingArtifacts}`
- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-phase-discovery`
- Optional subagents:
- `blueprint-researcher`


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

- Medium: can replace or extend phase context artifacts.

## User Prompts And Confirmation Gates


- Confirm overwrite when a context artifact already exists.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `discuss-phase` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/discuss-phase.md`
- Upstream workflow status: GSD has an upstream workflow file
