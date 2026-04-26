# `/blu-fast` Runtime Contract

This reference is the rich behavior contract for `/blu-fast`. The command
manifest should stay thin; the skill should load this file when deciding
whether a task truly qualifies for the trivial inline path.

## Qualification Rules

- Require an explicit task description.
- Keep the ask genuinely small. If the task would benefit from a saved phase
  plan, a durable Blueprint report, deeper research, validation, or any
  subagent work, reroute to `/blu-quick` or `/blu-plan-phase`.
- `fast` is the no-subagent execution path.

## State And Persistence

- Start from `mcp_blueprint_blueprint_project_status` so initialization and
  health are known before any Blueprint-owned write.
- If Blueprint is partial or unhealthy, stop and route to `/blu-health` before
  persisting through broken state.
- If Blueprint is uninitialized, the task may still complete inline, but stay
  in safe suggestion mode for Blueprint persistence.
- Inside an initialized Blueprint project, refresh `STATE.md` only through
  `mcp_blueprint_blueprint_state_update`.
- Do not create quick-run reports, phase summaries, phase artifacts, or any
  other durable execution evidence as side effects of `fast`.

## Visibility Rules

- Execution profile: `interactive-read`.
- Do not use `update_topic`, `write_todos`, or tracker tools.
- Do not turn `/blu-fast` into a long-running progress flow. Finish inline or
  reroute quickly.

## Completion Criteria

- The response explains why the task qualified as `fast`.
- Any Blueprint-owned persistence was limited to `STATE.md` inside an
  initialized project.
- Routing stayed inside the implemented Blueprint surface.
