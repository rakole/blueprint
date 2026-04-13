# `/blu-research-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`research-phase` is Blueprint's command for research how to implement a phase as a standalone discovery flow that usually feeds `/blu-plan-phase`. In Blueprint it stays Gemini-native, delegates persistence to documented MCP tools, and must produce planner-friendly, cited, confidence-tagged phase research rather than a scaffold-only placeholder.


## Command Path And Examples

- Gemini command path: `/blu-research-phase`
- Root router form: `/blu research-phase`
- Argument hint: `[phase]`
- `/blu-research-phase 3`
- `/blu research-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist.


## Outputs


- User-facing result: a concise summary of whether existing research was viewed, reused, created, or updated, plus the next logical action when applicable.
- Repo side effects: writes validated `XX-RESEARCH.md` content and updates `.blueprint/STATE.md`.


## Blueprint And Global State Reads


- `.blueprint/STATE.md`


## Blueprint And Global State Writes


- `phase XX-RESEARCH.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, requirements, missingArtifacts}`
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec, contextPath, researchPath, uiSpecPath, researchValid, researchIssues, suggestedRepairs, warnings}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, status, validation, warnings}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_command_catalog` -> `{commands, waves, aliases}`
- `blueprint_state_update` -> `{updatedFields, statePath, warnings}`


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
- Force an explicit `view`, `skip`, or `update` path when `XX-RESEARCH.md` already exists.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Surface `blueprint_phase_locate.recovery` guidance for missing roadmap or phase-directory failures.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Persists populated research content through MCP rather than raw prompt-side file writes.
- Uses a research schema with citations, confidence, recommendations, and planner-friendly sections.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `research-phase` happy-path fixture.
- Existing research `view`, `skip`, and `update` fixture.
- Invalid research-content rejection fixture.


