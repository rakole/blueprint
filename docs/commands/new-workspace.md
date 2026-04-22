# `/blu-new-workspace`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `high-risk-maintenance` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the workspace-creation posture explicit throughout the run: resolved scope must stay tied to the workspace name, resolved workspace path, repo members, strategy, branch, workspace manifest path, and host-global registry mutation plan; pending gates stay limited to visible preflight blockers such as `dirty-working-tree`, `invalid-workspace-source`, or `workspace-conflict`, explicit strategy-change approval when `worktree` must fall back to `clone`, and the destructive approval gate `new-workspace-confirmation`; execution mode should reflect preview-only versus confirmed workspace creation; and the next safe action should stay visible while the command is waiting on cleanup, strategy approval, or workspace creation approval.

## Purpose

`new-workspace` is Blueprint's command for creating an isolated workspace with repo copies and independent project state. In Blueprint it now ships as a confirmation-gated workspace bootstrap flow: it derives the default workspace root from normalized maintenance config when available, keeps registry and disk writes transactional through MCP tools, writes a workspace manifest at the workspace root, and records the workspace only in the host-global Blueprint registry under `~/.<host>/blueprint/`.

## Command Path And Examples

- CLI command path: `/blu-new-workspace`
- Root router form: `/blu new-workspace`
- Argument hint: `--name <name> [--repos repo1,repo2] [--path /target] [--strategy worktree|clone] [--branch name]`
- `/blu-new-workspace --name feature-a --repos .`
- `/blu-new-workspace --name release-hardening --strategy clone --branch release-hardening`
- `/blu new-workspace`

## Inputs, Project State, And Prerequisite Artifacts

- Target repos must already be valid git repos.
- When no explicit workspace path is provided, the command should derive the default workspace root from effective config `maintenance.workspace_root` before falling back to `~/blueprint-workspaces`.
- Workspace creation must stop when the host-global registry already contains the requested workspace name or resolved path.
- `worktree` creation should stop on dirty source repos, incompatible branch plans, or source repos that cannot host the requested worktree.

## Outputs

- User-facing result: a concise completion summary plus any active waiting state or next safe action when applicable.
- Repo side effects: writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- In-flight workspace creation should keep the resolved scope, active stage, pending gate, execution mode, previewed registry mutation plan, and next safe action legible while the run is still live.

## Blueprint And Global State Reads

- `.blueprint/config.json` through effective-config reads when the current repo is already a Blueprint project
- `~/.<host>/blueprint/workspaces.json`
- git metadata for each source repo

## Blueprint And Global State Writes

- workspace directory under configured `maintenance.workspace_root` or `~/blueprint-workspaces` by default
- workspace manifest at `<workspace>/.blueprint-workspace.json`
- host-global workspace registry entry at `~/.<host>/blueprint/workspaces.json`

## Required MCP Tools

- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_workspace_registry_get` -> `{registryPath, workspaces}`
- `blueprint_workspace_create` -> `{workspacePath, manifestPath, registryPath, registryEntry, repoMembers}`

## Registry And Manifest Contract

- Treat `blueprint_workspace_registry_get` as the authoritative host-global registry read; do not invent a second workspace index under `.blueprint/`.
- Persist workspace creation only through `blueprint_workspace_create`; it owns the workspace directory, `.blueprint-workspace.json`, and the host-global `workspaces.json` mutation.
- Treat the returned `workspacePath`, `manifestPath`, `registryPath`, `registryEntry`, and `repoMembers` as authoritative.
- Registry and disk writes must stay transactional: no partial registry entry may remain when workspace creation fails.

## In-Flight Progress Contract

- Keep the shared stage vocabulary visible only for the stages the workspace-creation run actually reaches.
- Keep the waiting state explicit whenever workspace creation is blocked before mutation: preflight blockers should surface as `dirty-working-tree`, `invalid-workspace-source`, or `workspace-conflict`; strategy fallback should stay visible until the user explicitly approves switching from `worktree` to `clone`; and destructive approval should stay visible as `new-workspace-confirmation`.
- Keep that visible progress aligned to the resolved workspace name and path, repo members, strategy, branch, manifest path, registry path, execution mode, and next safe action while the run moves from preview through confirmation, workspace creation, validation, and routing.
- Execution mode should distinguish preview-only versus confirmed workspace creation.

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
- `docs/commands/remove-workspace.md`

## External Shell Or Git Dependencies

- External dependencies:
- git
- filesystem operations

## Shell Risk Profile

- High: filesystem and git worktree mutation outside the current repo.

## Risk Notes

- Default workspace creation should resolve to `maintenance.workspace_root` from effective config when available, falling back to `~/blueprint-workspaces/<name>` only when no config layer overrides it.
- Registry writes in `~/.<host>/blueprint/workspaces.json` must be transactional with filesystem creation so partial entries are not left behind.
- Worktree mode should be preferred when safe, but the command needs an explicit, user-approved fallback to clone mode when the source repo cannot host the requested worktree.
- The command should show the resolved workspace path, chosen strategy, branch, repo list, workspace manifest path, and registry mutation plan explicitly before creation.
- Host-global workspace state must stay under `~/.<host>/blueprint/`; do not create repo-local workspace registries or store workspace bookkeeping under `.planning/`.

## User Prompts And Confirmation Gates

- Always preview the resolved workspace name, path, repo list, strategy, branch, workspace manifest path, and registry mutation plan before mutation.
- Require explicit confirmation before creating the workspace, and keep the destructive approval gate visible as `new-workspace-confirmation` until the user approves.
- When a `worktree` preview has to switch to `clone`, keep that strategy-change approval explicit instead of silently mutating the requested strategy.

## Edge Cases

- The requested workspace name or resolved path already exists in the host-global registry.
- A source repo is dirty, detached in an unsafe way, or not a valid git repo.
- The requested workspace path is inside a source repo or already exists on disk.
- `worktree` creation is incompatible with the requested branch plan and needs an explicit clone fallback.

## Failure Modes And Recovery

- Stop on dirty trees, malformed registry state, target-path conflicts, or invalid source repos with a specific remediation checklist.
- Do not mutate the installed extension directory.
- Leave the repo, workspace registry, and patch registry unchanged when a preflight check fails.
- Leave no partial registry entry behind when workspace creation fails after repo or filesystem work starts.

## Acceptance Criteria

- Mutates only the intended workspace root, workspace manifest, and host-global workspace registry entry.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Never executes git, workspace, patch, or cleanup mutation without an explicit confirmation gate.
- Honors normalized `maintenance.workspace_root` when choosing the default target directory.
- Keeps the `high-risk-maintenance` execution profile, shared stage vocabulary, and in-flight status fields visible while the run is active or waiting.
- Keeps the destructive approval gate visible together with the exact previewed workspace name, path, repo list, strategy, branch, and registry mutation plan before the first mutating tool call.
- Keeps host-global workspace state under `~/.<host>/blueprint/` and leaves no partial registry entry behind on failure.

## Test Cases

- Configured-workspace-root fixture.
- Dirty-tree or registry-conflict fixture.
- Worktree-to-clone fallback approval fixture.
- Direct `new-workspace` happy-path fixture.
