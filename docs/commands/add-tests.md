# `/blu-add-tests`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `add-tests` uses the shared long-running-mutation posture: resolve the target phase, read saved execution and validation evidence, decide the narrowest safe test scope, execute bounded test generation, persist verification notes and the durable report through MCP, validate the saved artifact state, and route to the next safe implemented follow-up.
- Keep the evidence-backed mutation contract explicit throughout the run: execution summaries plus saved verification or UAT artifacts remain the grounding source, the selected test scope is part of the resolved scope, scope confirmation or a broader-suite choice is the pending gate when the request would widen beyond targeted tests, and targeted test results plus verification and report status must stay aligned with tool-owned results instead of being inferred from prompt progress alone.

## Purpose


`add-tests` is Blueprint's command for generating tests for a completed phase based on UAT criteria and implementation. Blueprint ships it as an evidence-backed test-generation command: it reads saved execution summaries plus existing verification or UAT evidence first, keeps repo mutation scoped to the selected tests, persists updated verification notes through the validation MCP substrate, and writes a durable phase report under `.blueprint/reports/`.


## Command Path And Examples

- CLI command path: `/blu-add-tests`
- Root router form: `/blu add-tests`
- Argument hint: `<phase> [additional instructions]`
- `/blu-add-tests 3`
- `/blu add-tests`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must already have execution summaries.
- The target phase should already have a `XX-VERIFICATION.md` or `XX-UAT.md` artifact.
- Existing repo test conventions should be reused unless the user explicitly asks for a different supported scope.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: updates repo test files in the selected scope, persists updated verification notes through MCP, writes a durable `.blueprint/reports/add-tests-<phase>.md` report, and updates `.blueprint/STATE.md` when the next safe action changes.
- In-flight add-tests should keep the resolved scope, active stage, pending gate, execution mode, targeted test result, verification status, report status, and next safe action legible while the run is still live.

## In-Flight Progress Contract

- For non-trivial add-tests runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact test-generation checklist with `write_todos`.
- Keep that visible progress aligned to the selected scope, current stage, pending gate, execution mode, targeted test command or result, verification status, report status, and next safe action as the run moves from evidence review through scope confirmation, bounded test implementation, targeted test execution, verification persistence, report persistence, post-write validation, and routing.
- Treat `update_topic` and `write_todos` as session-local coordination only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.


## Blueprint And Global State Reads


- selected phase `XX-YY-SUMMARY.md` artifacts through `blueprint_phase_summary_index` and `blueprint_phase_summary_read`
- existing verification and UAT artifacts through `blueprint_phase_validation_read`
- canonical verification contract through `blueprint_artifact_contract_read` with `artifactId: "phase.verification"`
- current Blueprint artifact inventory through `blueprint_artifact_list`
- current state routing through `blueprint_state_load`


## Blueprint And Global State Writes


- `phase XX-VERIFICATION.md`
- `.blueprint/reports/add-tests-<phase>.md`
- `.blueprint/STATE.md`
- `new or updated repo test files in the selected scope`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}`
- `blueprint_phase_validation_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, summaryPaths, reason}`
- `blueprint_artifact_contract_read` -> `{id, canonicalName, scaffoldTemplate, authoringTemplate, requiredHeadings, lockedMarkers, freehandPolicy, notes}`
- `blueprint_phase_validation_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, summaryPaths, written, created, overwritten, status, issues, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Validation And Report Contract

- Update verification coverage through `blueprint_phase_validation_write` with `artifact: "verification"` and the full final markdown body; do not edit `XX-VERIFICATION.md` directly.
- Pass `phase` as the resolved numeric phase reference and treat the returned `path` plus `summaryPaths`, `written`, and `status` as authoritative instead of rebuilding filenames or summary links manually.
- Read the canonical contract through `blueprint_artifact_contract_read` with `artifactId: "phase.verification"` before final normalization.
- Normalize the final verification draft to the returned `authoringTemplate`, keep the locked markers and required section names unchanged, and self-check the normalized verification draft against the returned contract before writing.
- Keep the reported verification status aligned with the returned `written` and `status` fields instead of claiming a save from command progress alone.
- Persist the durable add-tests report through `blueprint_artifact_report_write` with the bare report name `add-tests-<phase>`, not a `.blueprint/reports/...` path.
- Treat the returned report `path`, `written`, and `status` as authoritative, and keep the reported report status explicit even when targeted test execution or verification persistence fails.


## Skills And Subagents


- Primary skill: `blueprint-phase-validation`
- Optional subagents:
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
- `docs/commands/verify-work.md`


## External Shell Or Git Dependencies


- External dependencies:
- the repo's existing test runner or test script


## Shell Risk Profile

- High: repo code mutation plus verification updates.

## User Prompts And Confirmation Gates


- Use Gemini CLI `ask_user` when the request is broad and the test scope needs a structured choice.
- Confirm before widening from a focused targeted test pass to a broader suite-wide run.


## Edge Cases


- The command scope does not match the saved execution summaries, existing verification or UAT evidence, or current repo test conventions.
- The repo has no clear test runner, package script, or nearby test harness for the selected scope.
- Existing verification notes are stale or heavily edited and should be extended rather than replaced casually.


## Failure Modes And Recovery


- Preserve the durable add-tests report even when test execution fails.
- Route to `/blu-validate-phase <phase>` when validation evidence is missing instead of generating tests from chat memory.
- Fall back to explicit file selection or `/blu-progress` instead of guessing through an unclear test harness.


## Acceptance Criteria


- Reads execution summaries plus existing verification or UAT evidence before generating tests.
- Keeps repo mutation scoped to the selected tests and any minimal supporting helpers.
- Keeps test-generation stages, pending gates, targeted test results, verification status, report status, and the next safe action explicit while add-tests is in flight.
- Persists updated verification notes through `blueprint_phase_validation_write` rather than direct file edits.
- Persists the durable report through `blueprint_artifact_report_write`.
- Reports verification and report persistence outcomes from MCP return values instead of assuming they succeeded.
- Updates `STATE.md` whenever the next-step signal changes.
- Uses only documented MCP tools for Blueprint-owned persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `add-tests` happy-path fixture.
