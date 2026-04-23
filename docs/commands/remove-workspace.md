# `/blu-remove-workspace`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `high-risk-maintenance` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the workspace-removal posture explicit throughout the run: resolved scope must stay tied to the workspace name, canonical workspace path, registry path, repo members with their strategies, manifest path, and exact teardown plan; pending gates stay limited to visible blockers such as `workspace-not-found`, `workspace-path-ambiguity`, `dirty-working-tree`, `registry-drift`, `malformed-workspace-registry`, `ask-user-unavailable`, and the destructive approval gate `remove-workspace-confirmation`; execution mode should reflect preview-only versus confirmed removal; and the next safe action should stay visible while the command is waiting on clarification, confirmation, or teardown completion.

## Purpose

`remove-workspace` is Blueprint's command for removing an isolated workspace after explicit confirmation. In Blueprint it now ships as a confirmation-gated teardown flow: it resolves the exact workspace target from the host-global registry, previews the canonical workspace path plus per-repo teardown strategy before deletion, blocks on dirty or drifted repo state, removes worktree or clone members safely, and persists the registry mutation only under `~/.<host>/blueprint/`.

## Command Path And Examples

- CLI command path: `/blu-remove-workspace`
- Root router form: `/blu remove-workspace`
- Argument hint: `<workspace-name> [--path /absolute/workspace]`
- `/blu-remove-workspace feature-a`
- `/blu-remove-workspace feature-a --path ~/blueprint-workspaces/feature-a`
- `/blu remove-workspace`

## Inputs, Project State, And Prerequisite Artifacts

- The workspace must already exist in the host-global registry at `~/.<host>/blueprint/workspaces.json`.
- Removal should use the exact confirmed workspace path when one is available so registry revalidation can stay exact under the registry lock.
- Removal must stop when the registry is malformed, the requested workspace name maps to multiple entries, or the confirmed path no longer matches the registry entry.
- All recorded repo members inside the workspace must be clean git repos before teardown begins.

## Outputs

- User-facing result: a concise completion summary plus any active waiting state or next safe action when applicable.
- Repo side effects: removes the declared host-global registry entry plus the recorded workspace directory and manifest after confirmation.
- In-flight workspace removal should keep the resolved scope, active stage, pending gate, execution mode, previewed teardown plan, and next safe action legible while the run is still live.

## Blueprint And Global State Reads

- `~/.<host>/blueprint/workspaces.json`
- `<workspace>/.blueprint-workspace.json`
- git metadata for each recorded workspace repo member

## Blueprint And Global State Writes

- updated host-global workspace registry entry at `~/.<host>/blueprint/workspaces.json`
- removed workspace manifest at `<workspace>/.blueprint-workspace.json`
- removed workspace directory and recorded repo-member directories

## Required MCP Tools

- `blueprint_workspace_registry_get` -> `{registryPath, workspaces}`
- `blueprint_workspace_remove` -> `{removedPath, manifestPath, registryPath, removedEntry, removedMembers, skippedMembers}`

## Registry And Teardown Contract

- Treat `blueprint_workspace_registry_get` as the authoritative host-global registry read; do not invent a second workspace index under `.blueprint/`.
- Persist workspace removal only through `blueprint_workspace_remove`; it owns exact target verification, repo cleanliness checks, worktree or clone teardown, workspace-manifest removal, workspace-root removal, and the host-global `workspaces.json` mutation.
- Treat the returned `removedPath`, `manifestPath`, `registryPath`, `removedEntry`, `removedMembers`, and `skippedMembers` as authoritative.
- Registry lookups must stay locked and exact: if the workspace name is ambiguous or the confirmed path no longer matches the registry entry, stop instead of guessing.

## In-Flight Progress Contract

- Keep the shared stage vocabulary visible only for the stages the workspace-removal run actually reaches.
- Keep the waiting state explicit whenever workspace removal is blocked before mutation: preflight blockers should surface as `workspace-not-found`, `workspace-path-ambiguity`, `dirty-working-tree`, `registry-drift`, `malformed-workspace-registry`, or `ask-user-unavailable`; destructive approval should stay visible as `remove-workspace-confirmation`.
- Keep that visible progress aligned to the resolved workspace name and canonical path, registry path, repo members with strategies, manifest path, teardown plan, execution mode, and next safe action while the run moves from preview through confirmation, teardown, validation, and routing.
- Execution mode should distinguish preview-only versus confirmed workspace removal.

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
- filesystem operations

## Shell Risk Profile

- High: directory deletion and worktree cleanup.

## Risk Notes

- Workspace deletion must always show the canonical workspace path before confirmation, not just the logical workspace name.
- Dirty repo members or unmerged work inside the workspace must block removal by default.
- Registry cleanup must not orphan sibling workspace entries or remove the wrong directory because of stale path resolution or ambiguous names.
- Removal should make registry provenance, resolved workspace membership, per-member teardown strategy, and exact teardown behavior explicit before filesystem mutation.
- Host-global workspace state must stay under `~/.<host>/blueprint/`; do not create repo-local workspace registries or move teardown state into `.planning/`.

## User Prompts And Confirmation Gates

- Always preview the resolved workspace name, canonical workspace path, registry path, repo members with strategies, manifest path, and exact teardown plan before mutation.
- Require explicit confirmation before removing the workspace, and keep the destructive approval gate visible as `remove-workspace-confirmation` until the user approves.
- When structured confirmation cannot run, stop honestly with `ask-user-unavailable` instead of pretending removal was confirmed.

## Edge Cases

- The requested target does not exist in the registry, or the registry is stale relative to disk state.
- The requested workspace name maps to multiple registry entries and needs the exact confirmed path to disambiguate.
- A dirty tree, missing repo member path, missing manifest, or invalid git repo would make mutation unsafe.

## Failure Modes And Recovery

- Stop on dirty trees, malformed registry state, path ambiguity, or registry drift with a specific remediation checklist.
- Do not mutate the installed extension directory.
- Leave the workspace registry and workspace directory unchanged when a preflight check fails.
- Stop honestly when structured confirmation is unavailable instead of deleting the workspace through plain assistant prose.

## Acceptance Criteria

- Mutates only the intended workspace root, workspace manifest, recorded repo members, and host-global workspace registry entry.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Never executes git, workspace, patch, or cleanup mutation without an explicit confirmation gate.
- Keeps the `high-risk-maintenance` execution profile, shared stage vocabulary, and in-flight status fields visible while the run is active or waiting.
- Keeps the destructive approval gate visible together with the exact previewed workspace name, canonical path, registry path, repo members, manifest path, and teardown plan before the first mutating tool call.
- Keeps host-global workspace state under `~/.<host>/blueprint/`, blocks on dirty or drifted repo state, and stops instead of guessing when the registry target is ambiguous.

## Test Cases

- Worktree-backed removal fixture.
- Dirty-tree blocker fixture.
- Registry-drift or malformed-registry fixture.
- Path-ambiguity fixture.
