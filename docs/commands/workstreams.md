# `/blu-workstreams`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`workstreams` is Blueprint's command for manage parallel workstreams — list, create, switch, status, progress, complete, and resume. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-workstreams`
- Root router form: `/blu workstreams`
- Argument hint: `none`
- `/blu-workstreams create backend-api`
- `/blu workstreams`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `.blueprint/workstreams/WORKSTREAMS.md`
- `per-workstream state files`


## Required MCP Tools


- `blueprint_workstream_list` -> `{active, workstreams, summary}`
- `blueprint_workstream_mutate` -> `{operation, active, affectedPaths}`
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
- `docs/commands/new-project.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: project-local state mutation with switching semantics.

## Risk Notes


- Only one active workstream should be treated as current for routing at a time, even if multiple workstreams exist on disk.
- Switching workstreams should snapshot enough state to make `resume-work` deterministic later.
- Workstream completion must not silently rewrite roadmap state for unrelated streams.


## User Prompts And Confirmation Gates


- Confirm switches or archival operations when a different active workstream exists.


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
- Direct `workstreams` happy-path fixture.


