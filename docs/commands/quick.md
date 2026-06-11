# `/blu-quick`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `long-running-mutation` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `quick` uses the shared long-running-mutation posture only for non-trivial bounded runs; it does not imply a saved phase plan, multi-wave rollout, or full lifecycle orchestration.

## Purpose


`quick` is Blueprint's command for executing a quick task with Blueprint guarantees while skipping unnecessary ceremony. In Blueprint it is implemented as a host-native bounded-execution contract that keeps Blueprint-owned persistence on MCP rails, uses optional depth gates only when the user explicitly asks for them, keeps non-trivial work visibly in flight, and records a durable quick-run report plus the next safe implemented action without turning the run into full lifecycle planning. Use no subagents by default. Keep the run inline unless a Blueprint subagent clearly earns its coordination cost.

Use this public ladder when choosing a route:
- `/blu-fast`: trivial inline path for obvious low-risk edits with no progress/report layer.
- `/blu-quick`: bounded work with light progress/reporting and an explicit next safe action.
- `/blu-plan-phase` or `/blu-execute-phase`: saved-plan or broader lifecycle route when the work no longer fits quick scope.

## Command Path And Examples

- CLI command path: `/blu-quick`
- Root router form: `/blu quick`
- Argument hint: `[task description] [--validate] [--discuss] [--research] [--force] [--full]`
- `--full` is the uncommon all-depth branch; the default quick path stays narrower.
- `/blu-quick "Rename BLUEPRINT_API_ENV references and update focused tests" --validate`
- `/blu quick "Update the quick command docs to clarify report overwrite handling" --research`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project should already exist.
- A bounded task description should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: may mutate repo files for the bounded task and persists a durable quick-run report plus `STATE.md`.
- In-flight posture for non-trivial runs: keeps the resolved scope, active stage, pending gate, execution mode, and next safe action visible while work is in flight.
- Common path tool budget: `blueprint_lightweight_preflight` first. When validation is needed, run validation shell or test commands outside Blueprint MCP before `blueprint_artifact_report_write`; then persist through `blueprint_artifact_report_write` and `blueprint_state_update`. Do not add redundant primitive Blueprint reads on the common path when preflight already surfaced scope, health, effective config, implemented routes, and overwrite posture.
- Final response budget: max 12 lines by default with task, depth used, validation status, report `status` and `path`, warnings or deferred work, and the next safe implemented action. Keep detailed evidence in the quick-run report.


## Blueprint And Global State Reads


- Deterministic lightweight preflight reads project status, effective config, command availability, quick-report overwrite posture, and the current next-step posture through Blueprint MCP tools rather than direct file crawls.


## Blueprint And Global State Writes


- `quick-run-latest` through `blueprint_artifact_report_write`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_lightweight_preflight` -> `{classification, projectStatus, effectiveConfig, implementedRoutes, quickReport, gates, nextSafeAction, warnings}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Quick Report Contract

- Read effective config through `blueprint_lightweight_preflight` before deciding whether to use any optional research, planning, execution, or verification subagent path.
- When validation is needed, finish validation before `blueprint_artifact_report_write`; validation shell or test commands stay outside Blueprint MCP.
- Persist the durable quick-run report through `blueprint_artifact_report_write` with the bare report name `quick-run-latest` and a structured `report.quick-run` model with `schemaVersion: 2`, then call `blueprint_state_update`, not Markdown `content` and not a `.blueprint/reports/...` path.
- The structured model must include `task`, `classification`, `depthUsed`, `evidenceRead`, `changesMade`, `validation`, `gates`, `risks`, `deferredWork`, and `nextSafeAction`, and may include `runMetrics`.
- Optional `runMetrics` stays lightweight; the command-specific runtime reference owns the exact optional counter names.
- Do not require exact token counts.
- When a Blueprint subagent is used, keep the handoff packet and return packet compact, bounded to the agreed scope, and aligned with the command-specific runtime reference.
- Quick-run report persistence is schema-backed: validate or repair the structured model against `report.quick-run.modelContract`; MCP renders the final Markdown and rejects hand-written Markdown fallback.
- Treat the returned report `path` and `status` as authoritative.
- For code mutation, include cheap validation evidence by default when a bounded safe check is discoverable; otherwise record an explicit skipped reason in the quick-run report.
- If validation fails, record that failure honestly, make at most one bounded repair attempt when it still fits quick scope, use `validation.repairAttempt` to distinguish no repair attempt versus still-failing, and do not claim success unless validation actually passes. If one bounded repair attempt recovers the failure, record that repaired outcome there too.
- Represent the quick report overwrite confirmation gate in the model `gates` and still require confirmation unless `--force` is present.
- Treat `--validate` as stronger validation, not the first time validation exists.
- Keep the final chat closeout concise: task, depth used, validation status including skipped reason or repair-attempt outcome when relevant, authoritative report `status` and `path`, warnings or deferred work, and the next safe implemented action. Let the durable report carry the detailed evidence, file lists, validation logs, gate detail, and tracker detail.

## In-Flight Progress Contract

- For non-trivial bounded quick runs, keep the shared stage vocabulary visible only for the stages the run actually reaches.
- Show progress only at meaningful stage or gate transitions.
- Do not spam stage narration or emit in-flight updates between transitions.
- Use `update_topic` to surface the active stage and `write_todos` to maintain a compact visible checklist for the bounded quick scope.
- Keep the current resolved scope, active stage, pending gate, execution mode, and next safe action explicit while the run is in flight.
- Typical pending gates include missing task clarity, depth-mode confirmation, quick-report overwrite approval, and rerouting when the task no longer qualifies as bounded quick work.
- Execution mode should distinguish whether the run stayed direct or used confirmed discuss, research, implementation, validation, or branchy coordination depth.
- When `update_topic` or `write_todos` are unavailable, preserve the same compact progress in concise prose instead of inventing persistence outside MCP.
- Never claim helper calls were made when unavailable.

## Tracker Eligibility

- Branchy quick work is tracker-eligible when the run splits across optional discuss, research, implementation, or validation substeps that still fit the bounded quick contract.
- Tracker use is session-local coordination only and must be paired with visible `write_todos`; it does not replace Blueprint MCP persistence.
- Do not use tracker as a saved plan, and do not use subagents to widen scope.
- Tracker-backed branching must not create a hidden saved plan, summary artifact, or lifecycle claim.
- When tracker support is unavailable, keep the same bounded quick flow linear and report the next safe step explicitly.


## Skills And Subagents


- Primary skill: `blueprint-phase-execution`
- Optional subagents:
- `blueprint-researcher`
- `blueprint-planner`
- `blueprint-executor`
- `blueprint-verifier`
- Use `blueprint-researcher` only when `--research` or `--full` is present, the task touches an unfamiliar repo area, or bounded research can reduce implementation risk, and `workflow.subagents` is enabled.
- Use `blueprint-planner` only when the task needs a short bounded checklist, has multiple ordered steps, still does not deserve a saved phase plan, and `workflow.subagents` is enabled.
- Use `blueprint-executor` only when implementation can be isolated inside the agreed quick-run scope, write ownership is clear, and `workflow.subagents` is enabled.
- Use `blueprint-verifier` only when `--validate` or `--full` is present, touched files exceed 2, the change is risky, or validation failed once and needs fresh-context review, and `workflow.subagents` is enabled.
- If `workflow.subagents` is disabled or the Blueprint agents are unavailable, keep the quick run inline with the same bounded scope and evidence standards.
- Do not use generic helper agents, browser-only agents, shell-only agents, or web-search-only substitutes.


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`
- `docs/commands/progress.md`


## Related Command Docs


- `docs/commands/fast.md`
- `docs/commands/plan-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- High: can execute repo changes with reduced ceremony.

## User Prompts And Confirmation Gates


- Treat `--discuss`, `--research`, `--validate`, and `--full` as pre-authorization for bounded non-destructive depth branches.
- Confirm report replacement before replacing the canonical quick-run report unless `--force` is present.
- Confirm external-service or runtime dependencies, destructive shell/git/file operations outside the bounded task, and scope expansion beyond quick.
- Stop and reroute when the task needs a saved phase plan, multi-wave execution, or broader lifecycle coordination.


## Edge Cases


- The input is blank or too vague to identify a bounded task.
- The task is symptom-first with unknown root cause; route to `/blu-debug`.
- The task needs a saved phase plan, multi-wave execution, or broad migration; route to `/blu-plan-phase` or `/blu-execute-phase`.
- The canonical quick-run report already exists; require overwrite confirmation unless `--force` is present.


## Failure Modes And Recovery


- Route oversized execution asks to `plan-phase` or `execute-phase` instead of bluffing.
- If no cheap validation is discoverable, record a skipped reason instead of claiming validation passed.
- If validation fails, report the failure honestly and route to the next safe implemented action even after one bounded repair attempt.


## Acceptance Criteria


- `quick` remains bounded and does not impersonate `plan-phase` or `execute-phase`.
- Non-trivial quick runs use the shared long-running-mutation posture with visible stage and status fields.
- Branchy quick work is tracker-eligible without turning tracker state into Blueprint persistence.
- If no Blueprint project exists, the command routes to `/blu-new-project` instead of inventing persistence.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Keeps deeper discuss, research, and validation branches bounded and flag-preauthorized instead of implicit.


## Test Cases


- Branchy bounded quick fixture with visible progress posture.
- No-project route-to-new-project fixture.
- Direct `quick` happy-path fixture with explicit bounded task text.
- Code mutation fixture with cheap validation evidence or explicit skipped reason.
