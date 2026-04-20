# `/blu-validate-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`validate-phase` is Blueprint's command for auditing completed phase execution and persisting durable, summary-backed verification evidence in `XX-VERIFICATION.md`. It is implemented as a host-native validation contract: it reads saved execution summaries first (not chat memory), normalizes the verification draft against the canonical `phase.verification` authoring template, persists the artifact through validation MCP tools, and keeps `verify-work` as the next safe implemented step when validation succeeds. Nyquist-style test-gap closure is handled separately via `/blu-add-tests`.


## Command Path And Examples

- CLI command path: `/blu-validate-phase`
- Root router form: `/blu validate-phase`
- Argument hint: `[phase number]`
- `/blu-validate-phase 3`
- `/blu validate-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must already have execution evidence.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: writes `XX-VERIFICATION.md` through MCP and updates `.blueprint/STATE.md`.


## Blueprint And Global State Reads


- effective Blueprint config through `blueprint_config_get`
- execution summaries through `blueprint_phase_summary_index` and `blueprint_phase_summary_read`
- existing validation artifacts through `blueprint_phase_validation_read`
- canonical authoring templates and required-tool derivation through `blueprint_artifact_contract_read`


## Blueprint And Global State Writes


- `phase XX-VERIFICATION.md`
- `.blueprint/STATE.md`


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

## Validation Persistence Contract

- Persist verification evidence through `blueprint_phase_validation_write`; do not write raw validation files directly.
- Pass `phase` as the resolved numeric phase reference and use only the validation artifact enums that the tool owns: `verification` or `uat`.
- Validation writes require saved execution summaries. Treat the returned `summaryPaths` as the authoritative evidence set that backed the saved artifact.
- Read the canonical contract through `blueprint_artifact_contract_read` with `artifactId: "phase.verification"` before final normalization.
- Keep the live `blueprint_artifact_contract_read` dependency explicit anywhere the required validation-tool shape or heading structure is derived from the contract.
- For `/blu-validate-phase`, write `artifact: "verification"` and treat the returned `path` as the authoritative saved filename.
- `uat` writes are a separate flow and additionally require an existing `XX-VERIFICATION.md` artifact before persistence succeeds.
- Keep the contract's required section names and locked markers unchanged, and allow extra top-level headings only when the returned contract policy says they are supported.
- Prefer `blueprint_state_update` with `base: "synced"` after persistence so `STATE.md` derives the next safe action from the updated artifact inventory instead of leaving stale routing behind.


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
- `docs/RUNTIME-REFERENCE.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/execute-phase.md`
- `docs/commands/verify-work.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: writes validation artifacts and gap reports.

## User Prompts And Confirmation Gates


- Confirm any follow-up fix suggestions before creating them.
- Confirm any overwrite before replacing an existing `XX-VERIFICATION.md` artifact; prefer Gemini CLI `ask_user` for that gate.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Reads completed execution summaries and any existing validation artifact before replacement.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Persists verification evidence through `blueprint_phase_validation_write` rather than direct file writes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `validate-phase` happy-path fixture.
