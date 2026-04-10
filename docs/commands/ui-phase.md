# `/blu:ui-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Generate UI design contract (UI-SPEC.md) for frontend phases |


## Purpose


`ui-phase` carries forward the GSD intent to generate UI design contract (UI-SPEC.md) for frontend phases. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu:ui-phase`
- Root router form: `/blu ui-phase`
- Argument hint: `[phase]`
- `/blu:ui-phase 2`
- `/blu ui-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist and include UI work.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `phase XX-UI-SPEC.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-phase-discovery`
- Optional subagents:
- `blueprint-ui-designer`


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
- `docs/commands/map-codebase.md`


## External Shell Or Git Dependencies


- External dependencies:
- web docs when framework behavior is unclear


## Shell Risk Profile

- Low: writes a UI design contract only.

## User Prompts And Confirmation Gates


- Confirm replacement when a UI spec already exists.


## Edge Cases


- The selected phase is backend-only and should probably record an explicit UI-skip rationale instead of forcing a `UI-SPEC`.
- The project already has a design system, and the new UI contract needs to extend it rather than invent a parallel language.
- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `ui-phase` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/ui-phase.md`
- Upstream workflow status: GSD has an upstream workflow file
