# `/blu:validate-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Retroactively audit and fill Nyquist validation gaps for a completed phase |


## Purpose


`validate-phase` carries forward the GSD intent to retroactively audit and fill Nyquist validation gaps for a completed phase. In Blueprint it is implemented as a Gemini-native validation contract that reads execution summaries and validation artifacts through documented MCP tools, persists durable verification evidence, and keeps `verify-work` as the next planned slice.


## Command Path And Examples

- Gemini command path: `/blu:validate-phase`
- Root router form: `/blu validate-phase`
- Argument hint: `[phase number]`
- `/blu:validate-phase 3`
- `/blu validate-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must already have execution evidence.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- effective Blueprint config through `blueprint_config_get`
- execution summaries through `blueprint_phase_summary_index` and `blueprint_phase_summary_read`
- existing validation artifacts through `blueprint_phase_validation_read`


## Blueprint And Global State Writes


- `phase XX-VERIFICATION.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}`
- `blueprint_phase_validation_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, summaryPaths, reason}`
- `blueprint_phase_validation_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, summaryPaths, written, created, overwritten, status, issues, warnings}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`
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
- `docs/GSD-RUNTIME-MIGRATION.md`
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


## Upstream Reference


- Upstream command file: `commands/gsd/validate-phase.md`
- Upstream workflow status: GSD has an upstream workflow file
