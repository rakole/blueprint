# `/blu-reapply-patches`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`reapply-patches` is Blueprint's command for reapplying local modifications after a Blueprint update. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-reapply-patches`
- Root router form: `/blu reapply-patches`
- Argument hint: `none`
- `/blu-reapply-patches`
- `/blu reapply-patches`

## Inputs, Project State, And Prerequisite Artifacts


- A recorded patch registry entry must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `patch replay report in .blueprint/reports/ or global patch logs`
- `repo file changes when replay succeeds`


## Required MCP Tools


- `blueprint_patch_list` -> `{patches, registryPath}`
- `blueprint_patch_reapply` -> `{appliedPatches, skippedPatches, conflicts}`
- `blueprint_patch_record` -> `{patchId, registryPath, trackedFiles}`


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
- `docs/commands/update.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- High: patch replay may touch many repo files.

## Risk Notes


- Patch replay must target the global patch registry in `~/.gemini/blueprint/patches/`, not ad hoc files inside the installed extension copy.
- Conflict reporting is more important than partial success; skipped or failed hunks need to be explicit and durable.
- Patch selection should be auditable by patch id, source version, and repo compatibility before replay begins.
- The command should show the resolved patch set, target repo compatibility, and report-before-mutate plan before replay confirmation.


## User Prompts And Confirmation Gates


- Require confirmation before replaying patches onto a dirty or drifted tree.


## Edge Cases


- A saved patch may no longer apply cleanly after a later update because the destination files have drifted.
- The patch registry may contain entries from multiple repos or versions, so selection must be explicit and auditable.
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
- Direct `reapply-patches` happy-path fixture.


