# `/blu-verify-work`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `verify-work` uses the shared long-running-mutation posture: resolve the target phase, read saved execution and validation evidence, decide whether the current UAT artifact is viewed, resumed, replaced, or newly created, execute bounded conversational UAT, persist through MCP, validate the saved artifact, and route to the next safe implemented follow-up.
- Keep the saved-summary-first contract explicit throughout the run: execution summaries plus a ready-for-UAT verification artifact are the UAT baseline, overwrite confirmation and interactive `review` / `skip` / `stop` checkpoints are the pending gates while evidence is still being collected, and the next safe action stays on `/blu-verify-work <phase>` until the saved UAT checkpoint is either completed or a prerequisite routes elsewhere.
- Detailed runtime reference: `skills/blueprint-phase-validation/references/verify-work-runtime-contract.md`.
- The detailed contract owns the richer UAT loop: derive user-observable tests from saved summaries, present one expected behavior at a time, classify plain responses into pass/skipped/blocked/issue, preserve verbatim reports and inferred severity, separate blocked prerequisites from code gaps, and persist test matrix plus structured gaps in `XX-UAT.md`.


## Purpose


`verify-work` is Blueprint's command for validating built features through conversational UAT. Blueprint ships it as a summary-aware, checkpointed UAT command: it reads saved execution and validation evidence first, resumes an existing `XX-UAT.md` unless the user chooses otherwise, requires the verification artifact to be both structurally valid and ready for UAT, keeps `review` / `skip` / `stop` checkpoints explicit while the pass is in flight, normalizes the final body to the canonical UAT template before persistence, validates the written artifact before updating state, and only leaves roadmap completion green when the saved evidence remains valid.


## Command Path And Examples

- CLI command path: `/blu-verify-work`
- Root router form: `/blu verify-work`
- Argument hint: `[phase number, e.g., '4']`
- `/blu-verify-work 3`
- `/blu verify-work`

## Inputs, Project State, And Prerequisite Artifacts

- The target phase must already have execution summaries.
- The target phase must already have a `XX-VERIFICATION.md` artifact from `validate-phase`, and that verification must be ready for UAT.
- Existing valid incomplete UAT artifacts should be resumed or reused unless the user explicitly asks for a replacement. Malformed saved UAT should be viewed or explicitly replaced, not resumed blindly.
- Non-trivial interactive UAT should stay checkpointed and bounded: after each major evidence block, the user may `review`, `skip`, or `stop`.
- User-reported issues, blocked prerequisites, and structured gaps are UAT evidence and should be preserved in `XX-UAT.md` without a separate confirmation gate.
- Confirm any explicit follow-up-fix capture before it is written into the UAT artifact or a later state update.


## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: writes `XX-UAT.md` through MCP, validates the saved artifact after the write, updates `.blueprint/ROADMAP.md` when valid execution, verification, and UAT evidence make completion durable, preserves user-reported issues and structured gaps as UAT evidence, may record explicit follow-up fix capture in the same artifact after confirmation, and updates `.blueprint/STATE.md` when the next safe action changes.
- In-flight UAT should keep the resolved scope, active stage, pending gate, execution mode, and next safe action legible while the run is still live.

## In-Flight Progress Contract

- For non-trivial UAT runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact UAT checklist with `write_todos`.
- Keep that visible progress aligned to the selected scope, current stage, pending gate, execution mode, and next safe action as the run moves from target resolution through saved-summary review, verifier analysis, checkpointed conversational UAT, persistence, post-write validation, and routing.
- Interactive checkpoints should use explicit `review`, `skip`, and `stop` choices rather than flattening the entire UAT pass into one preflight approval.
- Treat `update_topic` and `write_todos` as session-local coordination only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.

## UAT Test Loop

- Build a concrete test queue from saved summaries and ready verification evidence before asking the user anything.
- Each row should include test name, expected user-observable behavior, saved evidence, result, and notes.
- Skip internal-only implementation details unless they affect visible startup, command behavior, generated artifacts, routing, or errors.
- Add a cold-start smoke test when saved evidence touches startup, server or CLI entrypoints, database, seed, migration, Docker, or first-run surfaces.
- Present one expected behavior at a time and classify the user's plain response without asking them for severity:
  - no answer: empty response; restate the current test once and ask for an explicit answer instead of counting it as a pass
  - pass: `yes`, `y`, `ok`, `pass`, `next`, or `approved`
  - skipped: `skip`, `can't test`, or `n/a`, preserving reason when given
  - blocked: prerequisite language such as server, not running, physical device, release build, third-party setup, or prior phase
  - issue: any other response, preserving the verbatim report and inferring blocker, major, minor, or cosmetic severity
- Blocked tests are prerequisite gates, not code gaps. Issues become structured gap rows with truth, status, reason, severity, test number, artifacts, missing work, and follow-up status.


## Blueprint And Global State Reads

- effective Blueprint config through `blueprint_config_get`
- selected phase `XX-YY-SUMMARY.md` artifacts through `blueprint_phase_summary_index` and `blueprint_phase_summary_read`
- existing validation and UAT artifacts through `blueprint_phase_validation_read`
- canonical authoring templates and required-tool derivation through `blueprint_artifact_contract_read`
- post-write artifact validation through `blueprint_artifact_validate`


## Blueprint And Global State Writes

- `phase XX-UAT.md`
- `.blueprint/ROADMAP.md` when valid lifecycle evidence closes or reopens the phase
- `.blueprint/STATE.md`
- optional explicit follow-up fix capture in the same UAT artifact after confirmation


## Required MCP Tools

- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}`
- `blueprint_phase_validation_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, validation, verificationReadyForUat, uatStatus, resumeState, checkpoint, complete, summaryPaths, reason}`
- `blueprint_phase_validation_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, summaryPaths, written, created, overwritten, status, issues, warnings}`
- `blueprint_artifact_contract_read` -> `{id, canonicalName, scaffoldTemplate, authoringTemplate, requiredHeadings, lockedMarkers, freehandPolicy, notes}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## UAT Persistence Contract

- Persist conversational UAT through `blueprint_phase_validation_write`; do not write raw `XX-UAT.md` files directly, and require the verification artifact to be both valid and ready for UAT before persisting UAT.
- Pass `phase` as the resolved numeric phase reference and `artifact: "uat"`.
- UAT persistence requires both saved execution summaries and an existing `XX-VERIFICATION.md` artifact that is valid and ready for UAT.
- Read the canonical contract through `blueprint_artifact_contract_read` with `artifactId: "phase.uat"` before final normalization.
- Keep the live `blueprint_artifact_contract_read` dependency explicit anywhere the required UAT-tool shape or heading structure is derived from the contract.
- Self-check the normalized draft against the returned contract before writing so the final body matches the persisted shape.
- Pass the full final UAT body and treat the returned `path` plus `summaryPaths` as authoritative instead of rebuilding filenames or summary links manually.
- Keep resumability explicit in the saved body: preserve the contract-owned `**Resume State:**` and `**Checkpoint:**` markers so a bounded UAT pass can pause and resume inside `XX-UAT.md` without inventing a second checkpoint file.
- New or updated UAT artifacts must preserve the current test, test matrix, result counts, blocked prerequisites, structured gaps, and follow-up fix candidates from the canonical authoring template before the artifact can count as completion evidence.
- If the verification artifact is valid but not ready for UAT, route back to `/blu-validate-phase <phase>` for repair before attempting UAT persistence.
- Keep user-reported issues and remaining gaps inside the saved UAT content by default. Confirm follow-up-fix capture before persistence or later explicit state updates, and do not invent separate tool-owned artifacts.
- Keep the next safe action on `/blu-verify-work <phase>` while the saved UAT artifact still reflects an in-progress or intentionally stopped checkpoint; route onward only when the saved evidence and current prerequisites support that follow-up.
- Re-read the saved UAT through `blueprint_phase_validation_read` after persistence and use its typed `validation`, `uatStatus`, `resumeState`, `checkpoint`, and `complete` fields as the artifact-scoped truth.
- If the write result or the post-write UAT re-read says the saved artifact is invalid, repair the normalized draft against the canonical contract and retry once before stopping with explicit issues and suggested repairs.
- If post-write `blueprint_artifact_validate` fails only because unrelated Blueprint artifacts are invalid, surface that repo-health issue without rewriting the UAT draft.

## Canonical UAT Contract

Before persistence, normalize the final `XX-UAT.md` body to the returned `phase.uat` `authoringTemplate`.

- Do not rename the contract's required headings or replace the locked `**Status:**`, `**Resume State:**`, or `**Checkpoint:**` markers.
- Keep summary references inside the contract-defined summary-aware sections so `blueprint_phase_validation_write` validation passes cleanly.
- Keep the `**Resume State:**` and `**Checkpoint:**` markers current when the user chooses `review`, `skip`, or `stop`, so the checkpoint remains resumable and bounded instead of drifting into prompt-only state.
- Fill the richer authoring sections for current test, test matrix, result summary, and structured gaps when creating or updating UAT output. The saved artifact should not collapse the pass into a one-paragraph summary if it is expected to count as completion evidence.
- Allow extra top-level headings only when the returned contract policy says they are supported.
- After writing, run artifact validation before updating state so schema drift is caught in the same command path.


## Skills And Subagents

- Primary skill: `blueprint-phase-validation`
- Runtime reference: `skills/blueprint-phase-validation/references/verify-work-runtime-contract.md`
- Optional subagents:
- `blueprint-verifier`
- Use the verifier only when a suitable code or workflow analysis agent is available and `workflow.verifier=true`.
- If the verifier is unavailable or disabled, use the no-subagent fallback: read one completed summary at a time, compress carry-forward test rows, build the queue, run one UAT prompt at a time, classify responses, and draft from the final queue, counts, gaps, and checkpoint state.
- Browser, web-search-only, shell-only, and generic agents are not substitutes for the verifier.


## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/execute-phase.md`
- `docs/commands/validate-phase.md`


## External Shell Or Git Dependencies

- External dependencies:
- none


## Shell Risk Profile

- Medium: writes UAT evidence, can sync `.blueprint/ROADMAP.md` completion state, and updates follow-up state.

## User Prompts And Confirmation Gates

- Use Gemini CLI `ask_user` to capture a focused structured decision when an existing UAT artifact is present: `view` (`view current UAT`), `resume` (`resume saved UAT`), or `update` (`replace UAT`).
- In interactive mode, prefer `ask_user` for checkpoint decisions after each major UAT block: `review`, `skip`, or `stop`.
- Confirm any overwrite before replacing an existing UAT artifact; use a separate `ask_user` confirmation path for that overwrite.
- Confirm any explicit follow-up fix capture before persisting it in the UAT artifact.


## Edge Cases

- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected execution summaries exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.
- A previous UAT run exists and the user wants to resume rather than replace it.


## Failure Modes And Recovery

- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria

- Reads and writes only the selected phase scope.
- Reads completed execution summaries plus the existing validation artifact before replacement.
- Keeps UAT stages, checkpoints, pending gates, and the next safe action explicit while verification is in flight.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses execution summaries as the source of truth for conversational UAT coverage.
- Persists UAT evidence through `blueprint_phase_validation_write` rather than direct file writes.
- Marks the matching `ROADMAP.md` phase complete only after summary, verification, and UAT evidence all exist.
- Keeps `XX-UAT.md` resumable and explicit about unresolved gaps or follow-up captures.
- Produces a concrete user-observable test matrix with expected behavior, saved evidence, result counts, blocked-prerequisite separation, and structured gaps.
- Preserves plain user issue reports with inferred severity rather than asking the user to classify implementation risk.
- Uses the capability-gated verifier path or the no-subagent sequential fallback from the runtime contract.
- Uses bounded `review`, `skip`, and `stop` checkpoints instead of collapsing multi-step UAT into a single approval gate.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases

- Single-phase happy path fixture.
- Missing-summary recovery fixture.
- Existing-UAT resume fixture.
- Checkpointed `review` / `skip` / `stop` fixture.
- Follow-up fix capture fixture.
- Direct `verify-work` happy-path fixture.
