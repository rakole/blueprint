# `/blu-remove-workspace`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`remove-workspace` is Blueprint's command for removing a workspace and cleaning up worktrees. In Blueprint it should stay host-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- CLI command path: `/blu-remove-workspace`
- Root router form: `/blu remove-workspace`
- Argument hint: `<workspace-name>`
- `/blu-remove-workspace feature-a`
- `/blu remove-workspace`

## Inputs, Project State, And Prerequisite Artifacts


- The workspace must already exist in the global registry.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `updated global workspace registry`
- `workspace directory removal`


## Required MCP Tools


- `blueprint_workspace_registry_get` -> `{registryPath, workspaces}`
- `blueprint_workspace_remove` -> `{removedPath, removedEntry, skippedMembers}`


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
- `docs/commands/new-workspace.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- High: directory deletion and worktree cleanup.

## Risk Notes


- Workspace deletion must always show the resolved path before confirmation, not just the logical workspace name.
- Dirty nested repos or unmerged work inside the workspace should block removal by default.
- Registry cleanup must not orphan sibling workspace entries or remove the wrong directory because of stale path resolution.
- Removal should make registry provenance, resolved workspace membership, and rollback-safe failure behavior explicit before filesystem mutation.


## User Prompts And Confirmation Gates


- Always confirm the workspace name and show dirty-repo blockers before removal.


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
- Direct `remove-workspace` happy-path fixture.


