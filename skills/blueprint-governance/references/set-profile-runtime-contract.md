# /blu-set-profile Runtime Contract

## Scope

Switch the active project-local Blueprint model profile. Valid requested profiles are `quality`, `balanced`, `budget`, and `inherit`.

## Required MCP Call Order

1. Call `mcp_blueprint_blueprint_config_get` with `scope: "project"` to load the current project config and old `model_profile`.
2. If the repository is uninitialized, the config is missing, or the config path cannot be resolved, stop with the precise project/config error.
3. Echo the old profile and requested new profile before saving.
4. Call `mcp_blueprint_blueprint_config_set_profile` to write the new project-local profile.

## Confirmation Gates

- No extra confirmation is required for a valid profile switch after the old and new values are echoed.
- Do not ask for defaults confirmation because defaults are outside this command scope.

## Write Boundaries

- The only allowed write is `mcp_blueprint_blueprint_config_set_profile`.
- Do not call `mcp_blueprint_blueprint_config_set` for this command.
- Do not mutate host-global saved defaults.
- Treat the returned `configPath` as authoritative.

## Routing And Completion Criteria

- Confirm the old-to-new profile change.
- Report `updatedKeys` and `configPath` from `mcp_blueprint_blueprint_config_set_profile`.
- Explicitly state that saved defaults were not modified.

## Anti-Patterns

- Do not emulate the profile change with a general JSON patch.
- Do not write `.blueprint/config.json` directly.
- Do not continue when project config is missing or uninitialized.
- Do not mutate defaults, roadmap, state, reports, or artifacts.
