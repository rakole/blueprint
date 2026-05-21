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
- Gemini CLI exposes enabled delegated agents as same-named tools. Do not read,
  inline, or load separate agent source before delegation.
- Call `blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and
  `blueprint-verifier` only with bounded task packets that stay inside the
  confirmed quick-run scope, only when `workflow.subagents` is enabled and the
  same-named tool is available in the current host session.
- If those Blueprint agent tools are unavailable, unnecessary, disabled, or
  unsafe for the bounded scope, continue inline with the same evidence depth and
  output quality one confirmed branch at a time.
- Do not substitute browser-only, web-search-only, shell-only, or generic
  helper agents for these Blueprint roles.
- Tracker-backed branching is allowed only as session-local coordination for
  branchy bounded quick work. Pair it with visible `write_todos`, and do not
  let it impersonate a saved phase plan or lifecycle execution.

## No-Subagent Fallback

When optional Blueprint agents are unavailable or skipped, keep the quick run
single-agent and sequential:

1. Resolve the bounded task and any explicitly confirmed depth gate before
   acting.
2. Read only the evidence needed for the current branch or section.
3. Complete one discuss, research, execution, or validation unit at a time
   where the agent path could have isolated or parallelized work.
4. After each completed unit, compress the result into compact carry-forward
   context: scope handled, evidence used, decisions made, verification status,
   and the next bounded unit.
5. Persist the same durable quick-run evidence through MCP and keep routing
   inside the implemented Blueprint surface.

## Persistence And Routing

- Persist durable quick-run evidence only through
  `mcp_blueprint_blueprint_artifact_report_write` with the bare canonical
  report name `quick-run-latest` and a structured `report.quick-run` model.
- Do not hand-build the final Markdown report or pass Markdown `content`;
  MCP validates the model and renders the canonical report body.
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
