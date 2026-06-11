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
- Use `mcp_blueprint_blueprint_lightweight_preflight` before mutation so
  deterministic scope classification, initialization, health, effective
  subagent config, implemented-only routing, quick-report overwrite gates, and
  next safe action stay explicit.

## Optional Depth Gates

- `--discuss`, `--research`, `--validate`, and `--full` are pre-authorization
  for bounded non-destructive depth branches inside the quick-run scope.
- Still require explicit confirmation for quick-run report overwrite unless
  `--force` is present, external-service or runtime dependencies, destructive
  shell/git/file operations outside the bounded task, and scope expansion beyond
  quick.
- Use no subagents by default.
- Use `blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and
  `blueprint-verifier` only for bounded work that stays inside the quick-run
  scope, clearly improves quality, and only when effective config allows
  subagents.
- If those Blueprint agents are unavailable, unnecessary, or unsafe for the
  bounded scope, continue inline with the same evidence depth and output
  quality one authorized branch at a time.
- Do not substitute browser-only, web-search-only, shell-only, or generic
  helper agents for these Blueprint roles.
- Tracker-backed branching is allowed only as session-local coordination for
  branchy bounded quick work. Pair it with visible `write_todos`, and do not
  let it impersonate a saved phase plan or lifecycle execution.
- Do not use tracker as a saved plan, and do not use subagents to widen scope.

## Adaptive Subagent Decision Table

Apply this table only after preflight confirms the task still fits `quick`
scope:

- Default: stay inline and use no subagents.
- Use `blueprint-researcher` only when `--research` or `--full` is present,
  the task touches an unfamiliar repo area, or bounded research can reduce
  implementation risk, and `workflow.subagents` is enabled.
- Use `blueprint-planner` only when the task needs a short bounded checklist,
  has multiple ordered steps, still does not deserve a saved phase plan, and
  `workflow.subagents` is enabled.
- Use `blueprint-executor` only when implementation can be isolated inside the
  agreed quick-run scope, write ownership is clear, and
  `workflow.subagents` is enabled.
- Use `blueprint-verifier` only when `--validate` or `--full` is present,
  touched files are greater than 2, the change is risky, or validation failed
  once and needs fresh-context review, and `workflow.subagents` is enabled.
- If `workflow.subagents` is disabled or the Blueprint agents are unavailable,
  keep the quick run inline with the same bounded scope and evidence standard.

## Subagent Packets

When a Blueprint subagent is warranted, pass this bounded handoff packet:

```json
{
  "quickTask": "",
  "boundedScope": [],
  "forbiddenScope": [],
  "evidenceAlreadyRead": [],
  "allowedFilesOrAreas": [],
  "validationBudget": "cheap | deep",
  "reportFieldsToReturn": ["evidenceRead", "changesMade", "validation", "risks", "deferredWork"]
}
```

Require this compact return packet so the parent can keep the run bounded:

```json
{
  "scopeHandled": [],
  "evidenceUsed": [],
  "changesOrRecommendations": [],
  "validationEvidence": [],
  "risks": [],
  "deferredWork": [],
  "nextBoundedUnit": ""
}
```

Do not replace these packets with generic helper prose, browser-only notes,
shell-only logs, or web-search-only substitutes.

## Compact Progress UX

- Show progress only at meaningful stage or gate transitions.
- Do not spam stage narration.
- Keep visible status compact: resolved scope, active stage, pending gate,
  execution mode, next safe action.
- Use `update_topic` and `write_todos` only when the host exposes them and they
  add clarity.
- When helpers are unavailable, use concise prose instead of pretending helper
  calls happened.
- Never claim helper calls were made when unavailable.

## No-Subagent Fallback

When optional Blueprint agents are unavailable or skipped, keep the quick run
single-agent and sequential:

1. Resolve the bounded task and any authorized depth gate before
   acting.
2. Read only the evidence needed for the current branch or section.
3. Complete one discuss, research, execution, or validation unit at a time
   where the agent path could have isolated or parallelized work.
4. After each completed unit, compress the result into compact carry-forward
   context: scope handled, evidence used, decisions made, verification status,
   and the next bounded unit.
5. Persist the same durable quick-run evidence through MCP and keep routing
   inside the implemented Blueprint surface.

## Validation Policy

- For `/blu-quick` code mutation, run cheap validation by default when a
  bounded safe check is discoverable.
- Cheap means a focused test, lint, typecheck, or build expected to finish
  quickly.
- If no cheap validation is available, record an explicit skipped reason in the
  quick report.
- `--validate` means stronger validation, not the first time validation exists.
- Expensive or external validation requires confirmation or routes to lifecycle.
- If validation fails, make at most one bounded repair attempt when it still
  fits quick scope.
- Use `validation.repairAttempt` to distinguish failed without repair,
  repaired, or still-failing outcomes when that bounded repair path matters.
- Do not claim success if validation failed; record the failure honestly and
  route to the next safe implemented action even after a bounded repair attempt.

## Persistence And Routing

- Persist durable quick-run evidence only through
  `mcp_blueprint_blueprint_artifact_report_write` with the bare canonical
  report name `quick-run-latest` and a structured `report.quick-run` model
  with `schemaVersion: 2`.
- The structured model must include `task`, `classification`, `depthUsed`,
  `evidenceRead`, `changesMade`, `validation`, `gates`, `risks`,
  `deferredWork`, and `nextSafeAction`, and may include `runMetrics`.
- Keep the final chat closeout high-signal only: bounded task outcome,
  validation outcome including skipped reason or repair-attempt outcome when
  relevant, authoritative report `status` and `path`, and the next safe
  implemented action. Leave risks, deferred work, gates, and tracker detail in
  the durable report unless they are the user-facing blocker.
- Do not hand-build the final Markdown report or pass Markdown `content`;
  MCP validates the model and renders the canonical report body.
- Do not hand-address `.blueprint/reports/quick-run-latest.md`.
- Require explicit overwrite confirmation before replacing the canonical quick
  report unless `--force` is present, and represent that overwrite gate in the
  model `gates`.
- Treat the returned report `path` and `status` as authoritative.
- After completion, call `mcp_blueprint_blueprint_state_update` so `STATE.md`
  records `/blu-quick` and points to the next safe implemented action.
- Prefer `/blu-progress` as the follow-up unless a narrower implemented next
  step is clearly warranted.

## Completion Criteria

- The task stayed bounded.
- Any deeper discuss, research, or validation work stayed inside a bounded
  preauthorized branch.
- Tracker or visible progress helpers stayed session-local only.
- The quick report was persisted through MCP, not via a hand-built path.
- Routing stayed inside the implemented Blueprint surface.
