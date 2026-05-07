# `/blu-debug`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `long-running-mutation` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `debug` uses the shared long-running-mutation posture only for non-trivial investigations that need visible stage, gate, and follow-up reporting.
- `debug` does not imply tracker-backed branching, hidden fix execution, or silent todo capture.

## Purpose


`debug` is Blueprint's command for systematic debugging with persistent state across context resets. In Blueprint it is implemented as a host-native investigation flow that keeps debugging evidence explicit, persists a durable `debug-latest` report through MCP, keeps diagnose-only mode honest, and routes broader fix work into existing implemented follow-up commands instead of inventing hidden runtime state.


## Command Path And Examples

- CLI command path: `/blu-debug`
- Root router form: `/blu debug`
- Argument hint: `[--diagnose] [issue description]`
- `/blu-debug login-button-hangs-on-safari`
- `/blu debug`

## Inputs, Project State, And Prerequisite Artifacts


- Project context is strongly preferred for persistent debugging.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: persists the durable debug report, may append an explicitly approved todo follow-up, updates `STATE.md`, and may inspect repo evidence through shell or tests.
- In-flight posture when the run pauses on a decision: keeps the resolved scope, active stage, pending gate, execution mode, and next safe action explicit.


## Blueprint And Global State Reads


- Project status and any prior `debug-latest` report needed to continue the same investigation.


## Blueprint And Global State Writes


- `debug report in .blueprint/reports/debug-latest.md`
- `optional todo follow-ups`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Report And Todo Contract

- Read effective config through `blueprint_config_get` before deciding whether to use the optional `blueprint-debugger` path or stay inline.
- Persist the durable debug report through `blueprint_artifact_report_write` with the bare report name `debug-latest`, not a `.blueprint/reports/...` path.
- Treat the returned report `path` as authoritative.
- Report persistence is independent from follow-up capture; writing `debug-latest` must not silently create a todo.
- When capturing a todo follow-up, append through `blueprint_artifact_mutate_index` only after the user explicitly asks for capture or explicitly confirms after the diagnosis or saved report that the follow-up should become a todo. Treat the returned `createdEntryIds` as authoritative instead of inventing todo ids manually.

## In-Flight Progress Contract

- For non-trivial investigations, keep the shared stage vocabulary visible only for the stages the run actually reaches.
- Use `update_topic` to surface the active stage and `write_todos` to maintain a compact visible checklist for the investigation.
- Keep the current resolved scope, active stage, pending gate, execution mode, and next safe action explicit while the run is in flight.
- Typical pending gates include missing issue detail, diagnose-only fix approval, report overwrite approval, explicit todo-capture approval, and rerouting when the next safe step belongs to another implemented command.
- Execution mode should distinguish whether the run stayed direct, used bounded debugger support, or stayed diagnose-only after the diagnosis.
- `update_topic` and `write_todos` are session-local visibility only and do not replace Blueprint MCP persistence or explicit todo capture.

## Diagnose-Only And Follow-Up Gates

- `--diagnose` keeps the run in diagnose-only mode until the user explicitly confirms any fix attempt after seeing the diagnosis.
- When the investigation surfaces a concrete next step, stop on an explicit follow-up gate: keep the run report-only, capture a todo only after an explicit user ask or confirmation, route to `/blu-quick`, route to `/blu-plan-phase`, route to `/blu-validate-phase`, or defer to `/blu-progress` when multiple implemented follow-ups remain viable.
- Confirm report replacement before overwriting `.blueprint/reports/debug-latest.md`.
- Use one explicit decision boundary for follow-up capture instead of silently turning findings into todos.


## Skills And Subagents


- Primary skill: `blueprint-debug`
- Optional subagents:
- `blueprint-debugger`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/quick.md`
- `docs/commands/plan-phase.md`
- `docs/commands/validate-phase.md`
- `docs/commands/progress.md`


## External Shell Or Git Dependencies


- External dependencies:
- test runners and logs as needed


## Shell Risk Profile

- Medium: exploratory shell commands and test runs are likely.

## User Prompts And Confirmation Gates


- Confirm fix attempts when the command was invoked in diagnose-only mode.
- Confirm whether a follow-up should stay report-only, become a todo, or reroute into another implemented command.
- Confirm report replacement before overwriting `.blueprint/reports/debug-latest.md`.
- Confirm todo capture before persisting follow-up work into `.blueprint/todos/TODO.md`.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.


## Failure Modes And Recovery


- Repair malformed todo index files through MCP instead of raw append logic.
- Route oversized implementation asks to `quick` or `plan-phase` instead of bluffing.
- Route saved verification follow-up to `validate-phase` and multi-branch uncertainty to `progress` instead of improvising hidden debug state.


## Acceptance Criteria


- Capture outputs stay deterministic and append-only where expected.
- If no Blueprint project exists, the command degrades to safe suggestion mode instead of inventing persistence.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Persists the durable investigation report through `.blueprint/reports/debug-latest.md`.
- Non-trivial debug runs use the shared long-running-mutation posture without turning session-local visibility into persistence.
- Makes follow-up capture explicit instead of silently creating todos from report findings.
- Persisted todo follow-up capture requires an explicit user ask or confirmation.
- Treats `--diagnose` as a confirmation gate for any fix attempt.
- Routes broader remediation into implemented follow-up commands instead of landing it as implicit debug work.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `debug` happy-path fixture.
