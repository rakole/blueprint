# `/blu:cleanup`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Archive accumulated phase directories from completed milestones |


## Purpose


`cleanup` carries forward the GSD intent to archive accumulated phase directories from completed milestones. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:cleanup`
- Root router form: `/blu cleanup`
- Argument hint: `none`
- `/blu:cleanup`
- `/blu cleanup`

## Inputs, Project State, And Prerequisite Artifacts


- Completed milestone or phase archives should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `archived phase directories`
- `cleanup report in .blueprint/reports/`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-maintenance`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/complete-milestone.md`


## External Shell Or Git Dependencies


- External dependencies:
- filesystem operations


## Shell Risk Profile

- High: planning-directory archival and removal behavior.

## Risk Notes


- Cleanup should never silently remove active or unverified phase material.
- The command should emit an archive or cleanup report before deleting, compacting, or relocating planning artifacts.
- Milestone-level cleanup must respect later reports that still reference earlier phase files.


## User Prompts And Confirmation Gates


- Require confirmation before moving or deleting accumulated phase directories.


## Edge Cases


- The requested target does not exist in the registry, or the registry is stale relative to disk state.
- A dirty tree, patch conflict, or active work in another location would make mutation unsafe.


## Failure Modes And Recovery


- Stop on dirty trees or corrupted registry state with a specific remediation checklist.
- Do not mutate the installed extension directory.
- Leave the repo, workspace registry, and patch registry unchanged when a preflight check fails.


## Acceptance Criteria


- Mutates only the intended workspace, maintenance target, or patch set.
- Leaves an audit report or registry update behind every maintenance action.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Never executes git, workspace, patch, or cleanup mutation without an explicit confirmation gate.


## Test Cases


- Workspace or maintenance fixture.
- Dirty-tree or registry-conflict fixture.
- Direct `cleanup` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/cleanup.md`
- Upstream workflow status: GSD has an upstream workflow file
