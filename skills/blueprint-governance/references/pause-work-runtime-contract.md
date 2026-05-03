# /blu-pause-work Runtime Contract

## Scope

Create or replace the durable Blueprint pause handoff and update project state so the next safe implemented follow-up is `/blu-resume-work`.

## Required MCP Call Order

1. Call `mcp_blueprint_blueprint_state_load` first.
2. Call `mcp_blueprint_blueprint_artifact_list`.
3. Call `mcp_blueprint_blueprint_pause_handoff_get`.
4. If an active handoff exists and the user has not clearly requested replacement, stop and require explicit overwrite confirmation.
5. Build a handoff with current state, stopping point, completed work, remaining work, decisions, blockers, pending human actions, modified files, context notes, and first resume action when known.
6. Persist the handoff only with `mcp_blueprint_blueprint_pause_handoff_write`. Include `currentState`; list fields may be omitted for tool normalization. Omit `nextAction` when the safest action should be derived.
7. After the handoff write succeeds, call `mcp_blueprint_blueprint_state_update` with `base: "synced"` so `STATE.md` records `/blu-pause-work` and points the next safe implemented follow-up to `/blu-resume-work`.

## Confirmation Gates

- Replacing an existing active handoff requires explicit overwrite confirmation before any write.

## Write Boundaries

- `mcp_blueprint_blueprint_pause_handoff_write` owns `.blueprint/reports/` report persistence.
- `mcp_blueprint_blueprint_state_update` owns `.blueprint/STATE.md`.
- Persistent writes are limited to `.blueprint/reports/` and `.blueprint/STATE.md`.

## Routing And Completion Criteria

- Return the authoritative handoff path and handoff payload from the write result.
- Report whether the handoff was created or updated, any overwrite warning, and `/blu-resume-work` as the next safe implemented action.

## Anti-Patterns

- Do not write report files directly.
- Do not create a git commit.
- Do not mutate roadmap, phase, config, or code artifacts.
- Do not route follow-up to planned-only commands.
