# `/blu:complete-milestone`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Archive completed milestone and prepare for next version |


## Purpose


`complete-milestone` carries forward the GSD intent to archive completed milestone and prepare for next version. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:complete-milestone`
- Root router form: `/blu complete-milestone`
- Argument hint: `<version>`
- `/blu:complete-milestone v1.0`
- `/blu complete-milestone`

## Inputs, Project State, And Prerequisite Artifacts


- A milestone audit should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `milestone completion report`
- `.blueprint/STATE.md`
- `optional roadmap archive notes`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_phase_mark_complete` -> `{updatedPaths, status}`
- `blueprint_state_update` -> `{updatedFields, statePath}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


## Skills And Subagents


- Primary skill: `blueprint-roadmap-admin`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/audit-milestone.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: advances milestone status and archival expectations.

## User Prompts And Confirmation Gates


- Require explicit confirmation before closing a milestone.


## Edge Cases


- none


## Failure Modes And Recovery


- Show roadmap and phase-directory drift before mutation.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Keeps roadmap, phase directories, and state synchronized.
- Produces a durable report for milestone-level operations.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Roadmap mutation fixture.
- Renumbering or archival regression fixture.
- Direct `complete-milestone` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/complete-milestone.md`
- Upstream workflow status: GSD has an upstream workflow file
