# `/blu:research-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Research how to implement a phase (standalone - usually use /gsd-plan-phase instead) |


## Purpose


`research-phase` carries forward the GSD intent to research how to implement a phase (standalone - usually use /gsd-plan-phase instead). In Blueprint it stays Gemini-native, delegates persistence to documented MCP tools, and now writes substantive research content through dedicated phase-artifact write primitives instead of stopping at scaffold creation.


## Command Path And Examples

- Gemini command path: `/blu:research-phase`
- Root router form: `/blu research-phase`
- Argument hint: `[phase]`
- `/blu:research-phase 3`
- `/blu research-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `phase XX-RESEARCH.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, requirements, missingArtifacts}`
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, warnings}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-phase-discovery`
- Optional subagents:
- `blueprint-researcher`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`
- `docs/commands/discuss-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- web docs when needed


## Shell Risk Profile

- Low: writes research artifacts only.

## User Prompts And Confirmation Gates


- Confirm overwrite when research already exists.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Persists substantive research findings into `XX-RESEARCH.md`, not only scaffold placeholders.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `research-phase` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/research-phase.md`
- Upstream workflow status: GSD has an upstream workflow file
