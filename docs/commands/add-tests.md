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
- Detailed runtime reference: `skills/blueprint-phase-validation/references/add-tests-runtime-contract.md`
- `add-tests` uses the shared long-running-mutation posture: resolve the target phase, read saved execution and validation evidence, decide the narrowest safe test scope, execute bounded test generation, persist verification notes and the durable report through MCP, validate the saved artifact state, and route to the next safe implemented follow-up.
- Keep the evidence-backed mutation contract explicit throughout the run: execution summaries plus saved verification or UAT artifacts remain the grounding source, the selected test scope is part of the resolved scope, classification approval, test-plan approval, scope confirmation, or a broader-suite choice are pending gates when the request would widen beyond targeted tests, and targeted test results plus verification and report status must stay aligned with tool-owned results instead of being inferred from prompt progress alone.

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
- Keep that visible progress aligned to the selected scope, current stage, classification status, test-plan status, pending gate, execution mode, targeted test command or result, verification status, report status, and next safe action as the run moves from evidence review through classification, scope confirmation, bounded test implementation, targeted test execution, verification persistence, report persistence, post-write validation, and routing.
- Treat `update_topic` and `write_todos` as session-local coordination only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.

## Classification And Test Plan

- Build a file-by-file classification table before writing tests. Read each candidate file, nearby tests, and runner configuration before classifying it as `Unit / TDD`, `Integration / API`, `E2E / UI`, or `Skip`.
- Present classification decisions with concrete reasons when the run is broad, ambiguous, or user-visible. Apply user adjustments and re-present changed classifications before planning.
- Discover existing test directories, naming conventions, duplicate coverage, and narrow test commands before drafting the plan.
- Present a concrete test plan before non-trivial mutation: target test paths, test cases or scenarios, expected assertions, command to run, and blocked prerequisites.
- During execution, distinguish passing generated tests, tests that reveal implementation bugs, test-authoring errors that should be repaired in this command, and blocked tests that cannot run.


## Blueprint And Global State Reads


- selected phase `XX-YY-SUMMARY.md` artifacts through `blueprint_phase_summary_index` and `blueprint_phase_summary_read`
- existing verification and UAT artifacts through `blueprint_phase_validation_read`
- verification authoring context through `blueprint_phase_validation_authoring_context`
- canonical verification contract through `blueprint_artifact_contract_read` with `artifactId: "phase.verification"`
- canonical add-tests report contract through `blueprint_artifact_contract_read` with `artifactId: "report.add-tests"`
- effective workflow config through `blueprint_config_get` before any optional executor or verifier decision
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
- `blueprint_phase_validation_authoring_context` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, contract, summaryPaths, summaryEvidence, existing, verification, prerequisiteBlockers, readyForDraft, allowedValues, routingRules, warnings, reason}`
- `blueprint_phase_validation_render` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, validation, summaryPaths, referencedSummaryPaths, prerequisiteBlockers, readyToWrite, issues, warnings}`
- `blueprint_artifact_contract_read` -> `{id, canonicalName, scaffoldTemplate, authoringTemplate?, requiredHeadings, lockedMarkers, freehandPolicy, modelContract?, notes}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_phase_validation_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, summaryPaths, written, created, overwritten, status, issues, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs}`
- `blueprint_artifact_report_authoring_context` -> `{status, reportName, path, phase, completedSummaries, pendingPlans, dependencyPlans, validationEvidencePaths, allowedNextActions, schemaPath, baseSchema, taskSchema, modelOnly, prerequisiteBlockers, reason, warnings}`
- `blueprint_artifact_report_validate_model` -> `{status, valid, reportName, path, phase, schemaPath, taskSchema, diagnostics, normalizedModel, renderPreview, warnings}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Validation And Report Contract

- Read effective config through `blueprint_config_get` before deciding whether to use `blueprint-executor`, `blueprint-verifier`, or the no-subagent fallback.
- Update verification coverage through `blueprint_phase_validation_render` followed by `blueprint_phase_validation_write` with `artifact: "verification"` and exactly one of rendered `content` or the same structured `model`; do not edit `XX-VERIFICATION.md` directly.
- Pass `phase` as the resolved numeric phase reference and treat the returned `path` plus `summaryPaths`, `written`, and `status` as authoritative instead of rebuilding filenames or summary links manually.
- Read `blueprint_phase_validation_authoring_context` and the canonical contract through `blueprint_artifact_contract_read` with `artifactId: "phase.verification"` before final verification authoring.
- Build a structured verification evidence payload, call `blueprint_phase_validation_render`, keep the locked markers and required section names unchanged, and call `blueprint_phase_validation_write` only when the render result has `readyToWrite: true`, passing exactly one of the returned `content` unchanged or the same structured `model`.
- Keep the reported verification status aligned with the returned `written` and `status` fields instead of claiming a save from command progress alone.
- Read the canonical add-tests report contract through `blueprint_artifact_contract_read` with `artifactId: "report.add-tests"` before final report authoring.
- Read `blueprint_artifact_report_authoring_context` for the bare report name `add-tests-<phase>`, author the durable report as structured `report.add-tests` JSON against the returned `taskSchema`, and validate it with `blueprint_artifact_report_validate_model`.
- For `report.add-tests`, treat `contract.modelContract` plus `blueprint_artifact_report_authoring_context.taskSchema` as the authoring authority, and use `blueprint_artifact_report_validate_model.renderPreview` as the canonical preview instead of relying on a public `contract.authoringTemplate`.
- Persist the durable add-tests report through `blueprint_artifact_report_write` with the same validated `model` and bare report name `add-tests-<phase>`, not Markdown `content` and not a `.blueprint/reports/...` path.
- The structured report must include the approved classification, selected scope, test plan, tests added or updated, generated/passing/failing/blocked counts, bugs or blockers discovered, verification write status, report write status, remaining gaps, and next safe action.
- Treat the returned report `path`, `written`, and `status` as authoritative, and keep the reported report status explicit even when targeted test execution or verification persistence fails.
- If validation render, report model validation, or report persistence is rejected, repair the structured verification payload or authored report model against the returned canonical contract and retry once before stopping with explicit issues and suggested repairs.


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
- Use Gemini CLI `ask_user` when classification or the concrete test plan needs approval before mutation.
- Confirm before widening from a focused targeted test pass to a broader suite-wide run.


## Edge Cases


- The command scope does not match the saved execution summaries, existing verification or UAT evidence, or current repo test conventions.
- The repo has no clear test runner, package script, or nearby test harness for the selected scope.
- Existing verification notes are stale or heavily edited and should be extended rather than replaced casually.


## Failure Modes And Recovery


- Preserve the durable add-tests report even when test execution fails.
- Route to `/blu-validate-phase <phase>` when validation evidence is missing instead of generating tests from chat memory.
- Keep implementation bugs discovered by generated tests as reported bugs or blockers; do not silently fix product code from this command.
- Fall back to explicit file selection or `/blu-progress` instead of guessing through an unclear test harness.


## Acceptance Criteria


- Reads execution summaries plus existing verification or UAT evidence before generating tests.
- Builds an evidence-backed classification table and approved test plan before non-trivial mutation.
- Discovers repo test conventions and duplicate coverage before writing tests.
- Keeps repo mutation scoped to the selected tests and any minimal supporting helpers.
- Keeps test-generation stages, pending gates, targeted test results, verification status, report status, and the next safe action explicit while add-tests is in flight.
- Persists updated verification notes through `blueprint_phase_validation_write` rather than direct file edits.
- Uses `blueprint_phase_validation_authoring_context` plus `blueprint_phase_validation_render` so updated verification notes are rendered canonically or passed as the same ready structured model before the writer runs.
- Persists the durable report through `blueprint_artifact_report_write` after validating the structured model against the live `report.add-tests` task schema.
- Reports verification and report persistence outcomes from MCP return values instead of assuming they succeeded.
- Distinguishes passing tests, implementation bugs, test-authoring errors, and blocked checks in the final report.
- Updates `STATE.md` whenever the next-step signal changes.
- Uses only documented MCP tools for Blueprint-owned persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `add-tests` happy-path fixture.
