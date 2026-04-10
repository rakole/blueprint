# `/blu:add-phase`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Add phase to end of current milestone in roadmap |


## Purpose


`add-phase` carries forward the GSD intent to add phase to end of current milestone in roadmap. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:add-phase`
- Root router form: `/blu add-phase`
- Argument hint: `<description>`
- `/blu:add-phase Notifications`
- `/blu add-phase`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project and roadmap must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `new phase directory in .blueprint/phases/`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_roadmap_add_phase` -> `{phaseNumber, phaseDir, roadmapPath}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


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
- `docs/commands/new-project.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: mutates roadmap state and scaffolds a new phase.

## User Prompts And Confirmation Gates


- Confirm the final phase description before append.


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
- Direct `add-phase` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/add-phase.md`
- Upstream workflow status: GSD has an upstream workflow file
