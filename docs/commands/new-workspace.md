# `/blu-new-workspace`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Create an isolated workspace with repo copies and independent project state |


## Purpose


`new-workspace` carries forward the GSD intent to create an isolated workspace with repo copies and independent project state. In Blueprint that means per-workspace `.blueprint/` state plus a global workspace registry under `~/.gemini/blueprint/`; the command should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that it can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-new-workspace`
- Compatibility during this release: `/blu:new-workspace` (deprecated; remove next release)
- Root router form: `/blu new-workspace`
- Argument hint: `--name <name> [--repos repo1,repo2] [--path /target] [--strategy worktree|clone] [--branch name] [--auto]`
- `/blu-new-workspace --name feature-a --repos .`
- `/blu new-workspace`

## Inputs, Project State, And Prerequisite Artifacts


- Target repos must be valid git repos for worktree or clone strategies.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- `.blueprint/config.json` when a Blueprint project exists
- `~/.gemini/blueprint/defaults.json` when project config is absent and global defaults are available


## Blueprint And Global State Writes


- `workspace directory under configured maintenance.workspace_root or ~/blueprint-workspaces by default`
- `workspace manifest`
- `global workspace registry entry`


## Required MCP Tools


- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_workspace_registry_get` -> `{registryPath, workspaces}`
- `blueprint_workspace_create` -> `{workspacePath, registryEntry, repoMembers}`


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
- git


## Shell Risk Profile

- High: filesystem and git worktree mutation outside the current repo.

## Risk Notes


- Default workspace creation should resolve to `maintenance.workspace_root` from effective config when available, falling back to `~/blueprint-workspaces/<name>` only when no config layer overrides it.
- Registry writes in `~/.gemini/blueprint/workspaces.json` must be transactional with filesystem creation so partial entries are not left behind.
- Worktree mode should be preferred when safe, but the command needs a clean fallback to clone mode when the source repo cannot host worktrees.


## User Prompts And Confirmation Gates


- Always confirm path, repo list, and strategy before creation.


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
- Honors normalized `maintenance.workspace_root` when choosing the default target directory.


## Test Cases


- Workspace or maintenance fixture.
- Dirty-tree or registry-conflict fixture.
- Configured-workspace-root fixture.
- Direct `new-workspace` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/new-workspace.md`
- Upstream workflow status: GSD has an upstream workflow file
