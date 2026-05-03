# /blu-resume-work Runtime Contract

## Scope

Restore context from the canonical pause handoff, re-anchor `STATE.md` on live Blueprint state, and surface the next safe implemented action.

## Required MCP Call Order

1. Call `mcp_blueprint_blueprint_project_status` first.
2. Call `mcp_blueprint_blueprint_state_load`.
3. Call `mcp_blueprint_blueprint_artifact_list`.
4. Call `mcp_blueprint_blueprint_pause_handoff_get`.
5. If Blueprint is uninitialized or partial, stop and route to `/blu-new-project` or `/blu-health` using project status guidance.
6. If no handoff exists, explain the missing handoff and preserve the current safe next action. Call `mcp_blueprint_blueprint_state_update` only if recording `/blu-resume-work` as attempted is needed while keeping `STATE.md` aligned with the existing derived next step.
7. If a handoff exists, summarize the saved stopping point, completed work, remaining work, decisions, blockers, pending human actions, modified files, context notes, and artifact snapshot.
8. Treat the handoff as canonical resume context, but let live project status, state, blockers, and current artifacts win when choosing the next safe action.
9. When the handoff is still active, call `mcp_blueprint_blueprint_state_update` with the stored base to set `activeCommand` to `/blu-resume-work` and advance `lastUpdated`.
10. Re-read `mcp_blueprint_blueprint_state_load` and `mcp_blueprint_blueprint_project_status`.
11. Call `mcp_blueprint_blueprint_state_update` again only when needed so `STATE.md` records `/blu-resume-work`, current milestone and phase, remaining blockers, and the resumed next safe implemented action.

## Confirmation Gates

- No overwrite or deletion confirmation should be requested because the pause report is preserved.
- Do not perform repair or bootstrap writes from this command.

## Write Boundaries

- Persistent writes are limited to `.blueprint/STATE.md` through `mcp_blueprint_blueprint_state_update`.
- Do not rewrite, delete, or archive the pause handoff report.
- Do not mutate roadmap, phase, config, reports, or code artifacts.

## Routing And Completion Criteria

- Uninitialized repositories route to `/blu-new-project`.
- Partial or unhealthy repositories route to `/blu-health`.
- Missing handoff preserves the current safe next action.
- Existing handoff is canonical context; live state wins final routing.
- Return handoff path, active or historical status, recovered stopping point, blockers or missing artifacts, and the resumed next safe implemented action.

## Anti-Patterns

- Do not rewrite or delete `.blueprint/reports/pause-work-latest.md`.
- Do not let stale handoff next action override live project state.
- Do not use planned-only commands.
- Do not mutate config, roadmap, phase artifacts, reports, or code files.
