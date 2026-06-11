# `/blu-fast` Runtime Contract

This reference is the rich behavior contract for `/blu-fast`. The command
manifest should stay thin; the skill should load this file when deciding
whether a task truly qualifies for the trivial inline path.

Keep the prompt cache-friendly: command identity, hard contract, routing
ladder, tool boundaries, and response schema expectations stay in the static
prefix. Only the user task, preflight result, and state-update or no-write
result belong in the variable suffix.

## Qualification Rules

- Require an explicit task description.
- `/blu-fast` qualifies only when all are true:
  - the task description is explicit
  - the expected edit is obvious from the request
  - no repo/domain research is needed
  - no multi-file blast-radius analysis is needed
  - no subagent would improve quality
  - no durable report is useful
  - no validation pass is needed beyond ordinary user review
  - Blueprint state is initialized + healthy before Blueprint-owned persistence
- Keep the ask genuinely small. If the task would benefit from a saved phase
  plan, a durable Blueprint report, deeper research, validation, multi-file
  analysis, or any subagent work, reroute to `/blu-quick` or
  `/blu-plan-phase`.
- `fast` is the no-subagent execution path.

## State And Persistence

- Start from `mcp_blueprint_blueprint_lightweight_preflight` with `mode:
  "fast"` so deterministic scope classification, initialization, health, and
  implemented-only next action are known before any Blueprint-owned write.
- Common path tool budget: `mcp_blueprint_blueprint_lightweight_preflight`
  first, then `mcp_blueprint_blueprint_state_update` only after a successful
  initialized + healthy run. Do not add redundant primitive MCP reads on the
  common path when preflight already surfaced classification, project health,
  and next action.
- If Blueprint is partial or unhealthy, stop and route to `/blu-health` before
  persisting through broken state.
- If Blueprint is uninitialized, the task may still complete inline, but stay
  in safe suggestion mode for Blueprint persistence.
- Inside an initialized Blueprint project, refresh `STATE.md` only through
  `mcp_blueprint_blueprint_state_update`.
- Do not create quick-run reports, phase summaries, phase artifacts, or any
  other durable execution evidence as side effects of `fast`.
- Never write a report from `/blu-fast`.

## Visibility Rules

- Execution profile: `interactive-read`.
- `/blu-fast` latency budget:
  - Blueprint administrative preflight: lightweight preflight only
  - subagents: 0
  - visible progress helpers: 0
  - tracker state: 0
  - durable reports: 0
  - phase artifacts: 0
  - Blueprint-owned writes: state update only, initialized + healthy only
  - final response: concise inline summary, max 8 lines
- Do not use `update_topic`, `write_todos`, or tracker tools.
- Do not turn `/blu-fast` into a long-running progress flow. Finish inline or
  reroute quickly.

## Completion Criteria

- The response explains why the task qualified as `fast`.
- The response stays within 8 lines and includes qualification reason,
  state-update or no-write status, any reroute or warning, and the next safe
  implemented action.
- Any Blueprint-owned persistence was limited to `STATE.md` inside an
  initialized project.
- Routing stayed inside the implemented Blueprint surface.
