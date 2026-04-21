# `/blu-debug`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `debug` uses the shared interactive-read posture for evidence gathering, explicit follow-up decisions, report persistence, and implemented-command rerouting.
- `debug` does not imply tracker-backed branching, hidden fix execution, or silent todo capture.

## Purpose


`debug` is Blueprint's command for systematic debugging with persistent state across context resets. In Blueprint it is implemented as a host-native investigation flow that keeps debugging evidence explicit, persists a durable `debug-latest` report through MCP, and routes broader fix work into the existing implemented execution commands instead of inventing hidden runtime state.


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
- Repo side effects: Writes the declared Blueprint artifacts, may inspect repo evidence through shell or tests, and only crosses from diagnosis into fix work after an explicit follow-up gate.
- In-flight posture when the run pauses on a decision: keeps the resolved scope, active stage, pending gate, execution mode, and next safe action explicit.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `debug report in .blueprint/reports/debug-latest.md`
- `optional todo follow-ups`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_artifact_mutate_index` -> `{targetPath, createdEntryIds, updatedCounts}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Report And Todo Contract

- Persist the durable debug report through `blueprint_artifact_report_write` with the bare report name `debug-latest`, not a `.blueprint/reports/...` path.
- Treat the returned report `path` as authoritative.
- Report persistence is independent from follow-up capture; writing `debug-latest` must not silently create a todo.
- When capturing a todo follow-up, append through `blueprint_artifact_mutate_index` only after the user explicitly asks for capture or confirms that the follow-up should become a todo. Treat the returned `createdEntryIds` as authoritative instead of inventing todo ids manually.

## Diagnose-Only And Follow-Up Gates

- `--diagnose` keeps the run in diagnose-only mode until the user explicitly confirms any fix attempt after seeing the diagnosis.
- When the investigation surfaces a concrete next step, stop on an explicit follow-up gate: keep the run report-only, capture a todo, route to `/blu-quick`, route to `/blu-plan-phase`, or defer to `/blu-progress` when multiple implemented follow-ups remain viable.
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


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.


## Failure Modes And Recovery


- Repair malformed todo index files through MCP instead of raw append logic.
- Route oversized implementation asks to `quick` or `plan-phase` instead of bluffing.


## Acceptance Criteria


- Capture outputs stay deterministic and append-only where expected.
- If no Blueprint project exists, the command degrades to safe suggestion mode instead of inventing persistence.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Persists the durable investigation report through `.blueprint/reports/debug-latest.md`.
- Makes follow-up capture explicit instead of silently creating todos from report findings.
- Treats `--diagnose` as a confirmation gate for any fix attempt.


## Test Cases


- Capture append fixture.
- No-project graceful degradation fixture.
- Direct `debug` happy-path fixture.
