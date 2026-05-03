# Remove Workspace Runtime Contract

This reference is the detailed `/blu-remove-workspace` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, and workspace removal remains exact-target and confirmation-gated.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_workspace_registry_get` first and treat returned registry data as authoritative.
- Resolve a single workspace target by name and confirmed path.
- Stop on `workspace-not-found`, `workspace-path-ambiguity`, `registry-drift`, or malformed registry state.

### Read

- Resolve workspace name, canonical workspace path, registry path, repo members and strategies, manifest path, and teardown plan.
- Inspect every recorded repo member before mutation.
- Dirty working tree, missing paths, invalid repos, missing manifest, or registry-versus-manifest mismatch is a hard stop.

### Decide

- Preview workspace path, registry path, repo members, manifest path, and exact teardown plan.
- Require explicit confirmation and surface `remove-workspace-confirmation` until approved.
- If structured confirmation is unavailable, stop with `ask-user-unavailable`.

### Execute

- Call `mcp_blueprint_blueprint_workspace_remove` only after confirmation.
- Never smooth past partial teardown state.

### Persist

- Treat `removedPath`, `manifestPath`, `registryPath`, `removedEntry`, `removedMembers`, and `skippedMembers` returned by the remove tool as authoritative.
- If removal fails, stop and report the blocker; do not claim the registry entry or manifest was removed.

### Validate

- Verify removed and skipped members, registry path, manifest path, and any remaining blockers.

### Route

- End with the removed workspace details, active waiting state if any, and next safe manual or Blueprint action.
- Do not present planned-only commands as runnable.

## Persistence Boundaries

- Workspace registry state is host-global under `~/.<host>/blueprint/`.
- Do not create project-local workspace registries.
- Do not mutate installed extension directories.

## Required MCP FQNs

- `mcp_blueprint_blueprint_workspace_registry_get`
- `mcp_blueprint_blueprint_workspace_remove`
