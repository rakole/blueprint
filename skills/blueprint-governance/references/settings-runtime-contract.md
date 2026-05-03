# /blu-settings Runtime Contract

## Scope

Review and update normalized project-local Blueprint settings, with an optional explicit save-to-defaults step. This command does not repair project health and does not bootstrap Blueprint.

## Required MCP Call Order

1. Call `mcp_blueprint_blueprint_project_status` first.
2. Stop unless the repository is initialized for Blueprint. Route uninitialized state to `/blu-new-project`; route partial or unhealthy state to `/blu-health` when status guidance indicates repair is needed.
3. Call `mcp_blueprint_blueprint_config_get` with `scope: "project"` before asking for changes. Surface returned migration or normalization warnings.
4. Call `mcp_blueprint_blueprint_config_get` with `scope: "defaults"` only when the user asks to compare, inspect, or save host-global defaults.
5. Apply project-local changes only with `mcp_blueprint_blueprint_config_set` using `scope: "project"` and a JSON-object `patch`.
6. After project-local changes, call `mcp_blueprint_blueprint_config_set` with `scope: "defaults"` only when the user explicitly opts in to saving the resolved settings as defaults.

## Confirmation Gates

- Broad resets require confirmation before `mcp_blueprint_blueprint_config_set`.
- Saved-defaults writes require explicit opt-in after the user sees that the write is host-global.

## Write Boundaries

- Project settings writes go only through `mcp_blueprint_blueprint_config_set` with `scope: "project"`.
- Saved defaults writes go only through `mcp_blueprint_blueprint_config_set` with `scope: "defaults"` after explicit opt-in.
- Treat returned `configPath` values as authoritative.
- Patches must be JSON objects, not arrays, strings, or raw config file content.

## Effectiveness Spine Settings

The settings runtime preserves these effectiveness-spine keys:

- `ux.progress_mode`: `quiet | stage | checklist`
- `ux.structured_confirmations`: `auto | required`
- `ux.user_checkpoints`: `off | phase | plan`
- `orchestration.task_tracker`: `off | auto`
- `research.external_sources`: `off | ask | auto`

When omitted from a project config, these keys inherit from saved defaults when present, otherwise from hardcoded defaults. Keep the common settings pass stable; do not force these keys into the first settings pass. When the user explicitly asks to change them, write them through the normal `mcp_blueprint_blueprint_config_set` JSON-object `patch` path, not through direct file edits or a separate persistence flow.

## Routing And Completion Criteria

- Report changed project settings, whether defaults were updated, warnings from get/set calls, and the next logical action from project status.
- End on an implemented Blueprint command only.

## Anti-Patterns

- Do not write config files directly.
- Do not mutate defaults during normal project settings updates.
- Do not reintroduce `hooks.*`, `workflow.use_workspaces`, or `workflow.use_workstreams`.
- Do not use removed workflow keys or planned-only commands.
