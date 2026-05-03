# New Workspace Runtime Contract

This reference is the detailed `/blu-new-workspace` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, and workspace creation remains confirmation-gated.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_config_get` before deriving a default workspace root.
- Prefer an explicit target path. Otherwise use normalized `maintenance.workspace_root`, falling back to `~/blueprint-workspaces` only when config cannot provide one.
- Resolve workspace name, workspace path, repo members, strategy, branch, manifest path, and registry mutation plan.

### Read

- Call `mcp_blueprint_blueprint_workspace_registry_get` before mutation and treat returned registry data as authoritative.
- Inspect every source repo before mutation.
- Dirty working tree, invalid source repo, malformed registry, target conflict, or unsafe strategy is a hard stop.

### Decide

- Preview the complete workspace plan and host-global registry mutation.
- Prefer `worktree` when safe. If preflight requires a strategy change such as clone fallback, preview that change and require explicit approval.
- Require explicit confirmation and surface `new-workspace-confirmation` until approved.

### Execute

- Call `mcp_blueprint_blueprint_workspace_create` only after confirmation.
- Never create a second workspace registry outside host-global Blueprint state.

### Persist

- Treat `workspacePath`, `manifestPath`, `registryPath`, `registryEntry`, and `repoMembers` returned by the create tool as authoritative.
- If creation fails, stop and report the blocker; do not claim success or invent a partial registry entry.

### Validate

- Verify the returned workspace path, manifest path, registry path, repo members, strategy, and branch.

### Route

- End with the created workspace details, any waiting state, and the next safe manual or Blueprint action.
- Do not present planned-only commands as runnable.

## Persistence Boundaries

- Workspace state is host-global under `~/.<host>/blueprint/`.
- Do not mutate installed extension directories.
- Do not create project-local workspace registries.

## Required MCP FQNs

- `mcp_blueprint_blueprint_config_get`
- `mcp_blueprint_blueprint_workspace_registry_get`
- `mcp_blueprint_blueprint_workspace_create`
