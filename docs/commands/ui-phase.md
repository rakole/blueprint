# `/blu-ui-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`ui-phase` is Blueprint's command for generating a UI design contract (`UI-SPEC.md`) for frontend phases. In Blueprint it stays host-native, delegates persistence to documented MCP tools, reads the canonical `phase.ui-spec` contract before drafting or persisting, and uses a bounded checker review loop so designer output is revised before anything is saved.


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
- `blueprint_artifact_contract_read` -> `{artifactId, contract, authoringTemplate, validation, warnings}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, warnings}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## UI Persistence Contract

- Pass `phase` to `blueprint_phase_artifact_write` as the resolved numeric phase reference only, for example `"2"` or `2`.
- Read the canonical `phase.ui-spec` contract through `blueprint_artifact_contract_read` with `artifactId: "phase.ui-spec"` before drafting or revising `XX-UI-SPEC.md`, and normalize the final draft to the returned `authoringTemplate`.
- Read any existing `XX-UI-SPEC.md` through `blueprint_phase_artifact_read` before proposing replacement so overwrite confirmation stays explicit and reuse remains the default.
- Use `blueprint_artifact_scaffold` only with the repo-relative UI-spec artifact path for the selected phase. Bare names such as `UI-SPEC` and absolute filesystem paths are invalid.
- Use `blueprint-ui-designer` to draft the phase-scoped UI guidance when deeper design work is useful, then use `blueprint-checker` to review the draft against the phase requirements, locked Blueprint decisions, and discovery artifacts before any persistence step. If the checker requests revisions, update only the affected sections, re-normalize the draft to the same `authoringTemplate`, and re-run the checker before saving.
- Persist the real final markdown through `blueprint_phase_artifact_write` with `artifact: "ui-spec"` and treat the returned `path` as authoritative instead of rebuilding filenames manually.
- `XX-UI-SPEC.md` is the single durable output whether the phase gets a real UI contract or an explicit skip rationale. Do not invent a second skip artifact.


## Skills And Subagents


- Primary skill: `blueprint-phase-discovery`
- Optional subagents:
- `blueprint-ui-designer`
- `blueprint-checker`


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
- Keep the checker-and-revision gate bounded: revise only the affected sections, then re-run the checker before persisting the final artifact.


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
- Reads the canonical `phase.ui-spec` contract before drafting or revising the artifact.
- Uses a checker-reviewed revision loop before persistence.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `ui-phase` happy-path fixture.
