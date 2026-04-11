# `/blu:verify-work`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Validate built features through conversational UAT |


## Purpose


`verify-work` carries forward the GSD intent to validate built features through conversational UAT. Blueprint ships it as a summary-aware UAT command: it reads execution evidence first, persists resumable phase-scoped `XX-UAT.md` content through MCP, and keeps optional follow-up fixes explicit instead of hiding them in chat.


## Command Path And Examples

- Gemini command path: `/blu:verify-work`
- Root router form: `/blu verify-work`
- Argument hint: `[phase number, e.g., '4']`
- `/blu:verify-work 3`
- `/blu verify-work`

## Inputs, Project State, And Prerequisite Artifacts

- The target phase must already have execution summaries.
- Existing UAT artifacts should be resumed or reused unless the user explicitly asks for a replacement.


## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: writes `XX-UAT.md` through MCP, may record explicit follow-up fix capture in the same artifact, and updates `.blueprint/STATE.md` when the next safe action changes.


## Blueprint And Global State Reads

- `.blueprint/STATE.md`
- selected phase `XX-YY-SUMMARY.md` artifacts through MCP
- existing `XX-UAT.md` through MCP when present


## Blueprint And Global State Writes

- `phase XX-UAT.md`
- `.blueprint/STATE.md`
- optional explicit follow-up fix capture in the same UAT artifact


## Required MCP Tools

- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, requirements, missingArtifacts}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, status, validation, warnings}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs}`
- `blueprint_command_catalog` -> `{commands, waves, aliases}` with per-command `implemented`, `status`, and `blockedBy`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


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
- `docs/GSD-RUNTIME-MIGRATION.md`
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

- Confirm any overwrite before replacing an existing UAT artifact.
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
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses execution summaries as the source of truth for conversational UAT coverage.
- Keeps `XX-UAT.md` resumable and explicit about unresolved gaps or follow-up captures.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases

- Single-phase happy path fixture.
- Missing-summary recovery fixture.
- Existing-UAT resume fixture.
- Follow-up fix capture fixture.
- Direct `verify-work` happy-path fixture.


## Upstream Reference

- Upstream command file: `commands/gsd/verify-work.md`
- Upstream workflow status: GSD has an upstream workflow file
