# `/blu-quick` Runtime Contract

This reference is the rich behavior contract for `/blu-quick`. The command
manifest should stay thin; the skill should load this file when a bounded quick
run needs optional depth gates, session-local branching help, or durable
quick-run evidence.

Use `skills/blueprint-phase-execution/references/long-running-execution-profile.md`
for the shared stage vocabulary, in-flight status fields, and session-local
helper guidance that apply to non-trivial quick runs.

## Scope Rules

- Require an explicit task description.
- Keep `quick` bounded. If the request clearly needs a saved phase plan,
  multi-wave execution, or a broader rollout, route to `/blu-plan-phase` or
  `/blu-execute-phase` instead of stretching the command.
- Use `mcp_blueprint_blueprint_project_status` and
  `mcp_blueprint_blueprint_command_catalog` before mutation so initialization,
  health, and implemented-only routing stay explicit.

## Optional Depth Gates

- `--discuss`, `--research`, `--validate`, and `--full` require explicit
  confirmation before the run expands into those deeper branches.
- Use `blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and
  `blueprint-verifier` only for bounded work that stays inside the confirmed
  quick-run scope.
- Tracker-backed branching is allowed only as session-local coordination for
  branchy bounded quick work. Pair it with visible `write_todos`, and do not
  let it impersonate a saved phase plan or lifecycle execution.

## Persistence And Routing

- Persist durable quick-run evidence only through
  `mcp_blueprint_blueprint_artifact_report_write` with the bare canonical
  report name `quick-run-latest`.
- Require explicit overwrite confirmation before replacing the canonical quick
  report unless `--force` is present.
- After completion, call `mcp_blueprint_blueprint_state_update` so `STATE.md`
  records `/blu-quick` and points to the next safe implemented action.
- Prefer `/blu-progress` as the follow-up unless a narrower implemented next
  step is clearly warranted.

## Completion Criteria

- The task stayed bounded.
- Any deeper discuss, research, or validation work was explicitly confirmed.
- Tracker or visible progress helpers stayed session-local only.
- The quick report was persisted through MCP, not via a hand-built path.
- Routing stayed inside the implemented Blueprint surface.
