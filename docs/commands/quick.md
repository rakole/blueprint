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


`quick` is Blueprint's command for executing a quick task with Blueprint guarantees while skipping unnecessary ceremony. In Blueprint it is implemented as a host-native bounded-execution contract that keeps Blueprint-owned persistence on MCP rails, uses optional depth gates only when the user explicitly asks for them, keeps non-trivial work visibly in flight, and records a durable quick-run report plus the next safe implemented action without turning the run into full lifecycle planning.


## Command Path And Examples

- CLI command path: `/blu-quick`
- Root router form: `/blu quick`
- Argument hint: `[task description] [--full] [--validate] [--discuss] [--research] [--force]`
- `/blu-quick "Rename BLUEPRINT_API_ENV references and update focused tests" --validate`
- `/blu quick "Update the quick command docs to clarify report overwrite handling" --research`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project should already exist.
- A bounded task description should already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: may mutate repo files for the bounded task and persists a durable quick-run report plus `STATE.md`.
- In-flight posture for non-trivial runs: keeps the resolved scope, active stage, pending gate, execution mode, and next safe action visible while work is in flight.


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
- Persist the durable quick-run report through `blueprint_artifact_report_write` with the bare report name `quick-run-latest` and a structured `report.quick-run` model, not Markdown `content` and not a `.blueprint/reports/...` path.
- Quick-run report persistence is schema-backed: validate or repair the structured model against `report.quick-run.modelContract`; MCP renders the final Markdown and rejects hand-written Markdown fallback.
- Treat the returned report `path`, `written`, and `status` as authoritative.
- For code mutation, include cheap validation evidence by default when a bounded safe check is discoverable; otherwise record an explicit skipped reason in the quick-run report.
- Treat `--validate` as stronger validation, not the first time validation exists.

## In-Flight Progress Contract

- For non-trivial bounded quick runs, keep the shared stage vocabulary visible only for the stages the run actually reaches.
- Use `update_topic` to surface the active stage and `write_todos` to maintain a compact visible checklist for the bounded quick scope.
- Keep the current resolved scope, active stage, pending gate, execution mode, and next safe action explicit while the run is in flight.
- Typical pending gates include missing task clarity, depth-mode confirmation, quick-report overwrite approval, and rerouting when the task no longer qualifies as bounded quick work.
- Execution mode should distinguish whether the run stayed direct or used confirmed discuss, research, implementation, validation, or branchy coordination depth.
- When `update_topic` or `write_todos` are unavailable, preserve the same progress in prose instead of inventing persistence outside MCP.

## Tracker Eligibility

- Branchy quick work is tracker-eligible when the run splits across optional discuss, research, implementation, or validation substeps that still fit the bounded quick contract.
- Tracker use is session-local coordination only and must be paired with visible `write_todos`; it does not replace Blueprint MCP persistence.
- Tracker-backed branching must not create a hidden saved plan, summary artifact, or lifecycle claim.
- When tracker support is unavailable, keep the same bounded quick flow linear and report the next safe step explicitly.


## Skills And Subagents


- Primary skill: `blueprint-phase-execution`
- Optional subagents:
- `blueprint-researcher`
- `blueprint-planner`
- `blueprint-executor`
- `blueprint-verifier`


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
- If validation fails, report the failure honestly and route to the next safe implemented action.


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
