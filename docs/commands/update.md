# `/blu:update`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Update GSD to latest version with changelog display |


## Purpose


`update` carries forward the GSD intent to update GSD to latest version with changelog display. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:update`
- Root router form: `/blu update`
- Argument hint: `none`
- `/blu:update`
- `/blu update`

## Inputs, Project State, And Prerequisite Artifacts


- None.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `update plan metadata under ~/.gemini/blueprint/updates/`
- `human-readable update checklist report`


## Required MCP Tools


- `blueprint_update_check` -> `{installedVersion, latestVersion, updateAvailable}`
- `blueprint_update_plan` -> `{steps, requiresRestart, notes}`


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
- none


## External Shell Or Git Dependencies


- External dependencies:
- network access for version lookup when supported


## Shell Risk Profile

- Low: advisory only; no in-session self-update.

## Risk Notes


- Gemini extension updates happen outside the running interactive session, so `/blu:update` must remain advisory rather than self-mutating.
- The command should never write into the installed extension directory or assume a writable installation target.
- Any update checklist should end with a restart expectation because extension changes load on the next session start.


## User Prompts And Confirmation Gates


- Confirm whether the user wants only a changelog view or a full update checklist.


## Edge Cases


- Blueprint may be installed from GitHub, a local path, or a pinned branch, so update advice must reflect the actual install source.
- Version lookup may be unavailable offline, in which case the command should still leave a deterministic manual checklist.
- The requested target does not exist in the registry, or the registry is stale relative to disk state.
- A dirty tree, patch conflict, or active work in another location would make mutation unsafe.


## Failure Modes And Recovery


- Stop on dirty trees or corrupted registry state with a specific remediation checklist.
- Do not mutate the installed extension directory.
- Fall back to a human-readable manual update checklist if version discovery is unavailable.


## Acceptance Criteria


- Mutates only the intended workspace, maintenance target, or patch set.
- Leaves an audit report or registry update behind every maintenance action.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Never executes git, workspace, patch, or cleanup mutation without an explicit confirmation gate.
- Never mutates the installed extension directory from inside the running Gemini session.


## Test Cases


- Workspace or maintenance fixture.
- Dirty-tree or registry-conflict fixture.
- Direct `update` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/update.md`
- Upstream workflow status: GSD has an upstream workflow file
