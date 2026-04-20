# `/blu-verify-work`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`verify-work` is Blueprint's command for validating built features through conversational UAT. Blueprint ships it as a summary-aware UAT command: it reads saved execution and validation evidence first, resumes an existing `XX-UAT.md` unless the user chooses otherwise, normalizes the final body to the canonical UAT template before persistence, validates the written artifact before updating state, and only leaves roadmap completion green when the saved evidence remains valid.


## Command Path And Examples

- CLI command path: `/blu-verify-work`
- Root router form: `/blu verify-work`
- Argument hint: `[phase number, e.g., '4']`
- `/blu-verify-work 3`
- `/blu verify-work`

## Inputs, Project State, And Prerequisite Artifacts

- The target phase must already have execution summaries.
- The target phase must already have a `XX-VERIFICATION.md` artifact from `validate-phase`.
- Existing UAT artifacts should be resumed or reused unless the user explicitly asks for a replacement.
- Confirm any follow-up-fix capture before it is written into the UAT artifact.


## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: writes `XX-UAT.md` through MCP, validates the saved artifact after the write, updates `.blueprint/ROADMAP.md` when valid execution, verification, and UAT evidence make completion durable, may record explicit follow-up fix capture in the same artifact after confirmation, and updates `.blueprint/STATE.md` when the next safe action changes.


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
- `blueprint_phase_validation_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, summaryPaths, reason}`
- `blueprint_phase_validation_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, summaryPaths, written, created, overwritten, status, issues, warnings}`
- `blueprint_artifact_contract_read` -> `{id, canonicalName, scaffoldTemplate, authoringTemplate, requiredHeadings, lockedMarkers, freehandPolicy, notes}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## UAT Persistence Contract

- Persist conversational UAT through `blueprint_phase_validation_write`; do not write raw `XX-UAT.md` files directly.
- Pass `phase` as the resolved numeric phase reference and `artifact: "uat"`.
- UAT persistence requires both saved execution summaries and an existing `XX-VERIFICATION.md` artifact.
- Read the canonical contract through `blueprint_artifact_contract_read` with `artifactId: "phase.uat"` before final normalization.
- Keep the live `blueprint_artifact_contract_read` dependency explicit anywhere the required UAT-tool shape or heading structure is derived from the contract.
- Self-check the normalized draft against the returned contract before writing so the final body matches the persisted shape.
- Pass the full final UAT body and treat the returned `path` plus `summaryPaths` as authoritative instead of rebuilding filenames or summary links manually.
- Keep follow-up fixes or remaining gaps inside the saved UAT content or later explicit state updates; confirm follow-up-fix capture before persistence and do not invent separate tool-owned artifacts.

## Canonical UAT Contract

Before persistence, normalize the final `XX-UAT.md` body to the returned `phase.uat` `authoringTemplate`.

- Do not rename the contract's required headings or replace the locked `**Status:**`, `**Resume State:**`, or `**Checkpoint:**` markers.
- Keep summary references inside the contract-defined summary-aware sections so `blueprint_phase_validation_write` validation passes cleanly.
- Allow extra top-level headings only when the returned contract policy says they are supported.
- After writing, run artifact validation before updating state so schema drift is caught in the same command path.


## Skills And Subagents

- Primary skill: `blueprint-phase-validation`
- Optional subagents:
- `blueprint-verifier`


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

- Low: writes UAT and follow-up evidence.

## User Prompts And Confirmation Gates

- Use Gemini CLI `ask_user` to capture a focused structured decision when an existing UAT artifact is present: `view` (`view current UAT`), `resume` (`resume saved UAT`), or `update` (`replace UAT`).
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
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses execution summaries as the source of truth for conversational UAT coverage.
- Persists UAT evidence through `blueprint_phase_validation_write` rather than direct file writes.
- Marks the matching `ROADMAP.md` phase complete only after summary, verification, and UAT evidence all exist.
- Keeps `XX-UAT.md` resumable and explicit about unresolved gaps or follow-up captures.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases

- Single-phase happy path fixture.
- Missing-summary recovery fixture.
- Existing-UAT resume fixture.
- Follow-up fix capture fixture.
- Direct `verify-work` happy-path fixture.
