# `/blu-add-tests`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Generate tests for a completed phase based on UAT criteria and implementation |


## Purpose


`add-tests` carries forward the GSD intent to generate tests for a completed phase based on UAT criteria and implementation. Blueprint ships it as an evidence-backed test-generation command: it reads saved execution summaries plus existing verification or UAT evidence first, keeps repo mutation scoped to the selected tests, persists updated verification notes through the validation MCP substrate, and writes a durable phase report under `.blueprint/reports/`.


## Command Path And Examples

- Gemini command path: `/blu-add-tests`
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


## Blueprint And Global State Reads


- selected phase `XX-YY-SUMMARY.md` artifacts through `blueprint_phase_summary_index` and `blueprint_phase_summary_read`
- existing verification and UAT artifacts through `blueprint_phase_validation_read`
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
- `blueprint_phase_validation_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, summaryPaths, written, created, overwritten, status, issues, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


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


- Confirm test scope when the request is broad.
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
- Persists updated verification notes through `blueprint_phase_validation_write` rather than direct file edits.
- Persists the durable report through `blueprint_artifact_report_write`.
- Updates `STATE.md` whenever the next-step signal changes.
- Uses only documented MCP tools for Blueprint-owned persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `add-tests` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/add-tests.md`
- Upstream workflow status: GSD has an upstream workflow file
