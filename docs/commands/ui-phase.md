# `/blu-ui-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`ui-phase` is Blueprint's command for generate UI design contract (UI-SPEC.md) for frontend phases. In Blueprint it stays host-native, delegates persistence to documented MCP tools, and now writes substantive UI-spec or skip-rationale content through dedicated phase-artifact write primitives instead of stopping at scaffold creation.


## Command Path And Examples

- CLI command path: `/blu-ui-phase`
- Root router form: `/blu ui-phase`
- Argument hint: `[phase]`
- `/blu-ui-phase 2`
- `/blu ui-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist.
- Frontend-heavy phases should produce a UI contract.
- Backend-only or intentionally skipped phases should record the rationale in `XX-UI-SPEC.md` instead of inventing a second phase artifact.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- effective Blueprint config through `blueprint_config_get`


## Blueprint And Global State Writes


- `phase XX-UI-SPEC.md` for either a UI contract or an explicit UI-skip rationale
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, warnings}`
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
- Prefer Gemini CLI's built-in `ask_user` dialog for overwrite confirmation or focused contract-versus-skip decisions instead of a plain-text menu.
- Honor effective-config gates before writing:
- `workflow.ui_phase=false` should produce a documented skip rationale instead of a generated UI contract.
- `workflow.ui_safety_gate=true` should require an explicit rationale when UI work is skipped.


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
- Uses `XX-UI-SPEC.md` as the single phase-scoped durable output, whether the result is a full UI contract or a documented skip rationale.
- Respects effective-config UI gates before generating or skipping UI output.
- Persists substantive UI guidance or skip rationale into `XX-UI-SPEC.md`, not only scaffold placeholders.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `ui-phase` happy-path fixture.

