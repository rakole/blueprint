# /blu-health Runtime Contract

## Scope

Diagnose Blueprint project health, config provenance, state consistency, and artifact validity. The command is read-only by default. `--repair` enables only confirmation-gated config normalization and state reconstruction.

## Required MCP Call Order

1. Detect whether the user passed `--repair`.
2. Call `mcp_blueprint_blueprint_project_status`.
3. Call `mcp_blueprint_blueprint_config_get` with the effective scope so config warnings and provenance are visible.
4. Call `mcp_blueprint_blueprint_state_load`.
5. Call `mcp_blueprint_blueprint_artifact_list`.
6. Call `mcp_blueprint_blueprint_artifact_validate`.
7. In read-only mode, stop after reporting diagnosis and exact repair options.
8. In `--repair` mode, get explicit confirmation with `ask_user` after presenting an exact write preview.
9. After confirmation, call `mcp_blueprint_blueprint_config_set` only when config normalization is required.
10. After confirmation, call `mcp_blueprint_blueprint_state_sync` only when state reconstruction is required.
11. Re-read `mcp_blueprint_blueprint_project_status` when a post-repair next action is needed.

## Confirmation Gates

- `--repair` never implies silent writes.
- Before any repair write, present the exact config and/or state changes that will be written and require an explicit `ask_user` confirmation.

## Write Boundaries

- Read-only mode performs no writes.
- Config repair uses `mcp_blueprint_blueprint_config_set` with `scope: "project"` and a JSON-object `patch` only for normalization.
- State repair uses `mcp_blueprint_blueprint_state_sync` only for reconstruction.
- Do not mutate unrelated repo files.

## Routing And Completion Criteria

- If Blueprint is uninitialized, route to `/blu-new-project`; do not treat repair as bootstrap.
- Report project status, config warnings, state/blocker summary, artifact inventory, validation issues, suggested repairs, repair status, and next safe implemented action.

## Anti-Patterns

- Do not write without `ask_user` confirmation in repair mode.
- Do not repair by direct file edits.
- Do not use config repair for non-normalization changes.
- Do not use state sync for anything other than reconstruction.
- Do not recommend planned-only commands.
