# `/blu-plan-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`plan-phase` is Blueprint's command for create a detailed phase plan with verification loop. Blueprint now implements it with the plan index plus dedicated plan read/write tools so it can read existing plans, persist real `XX-YY-PLAN.md` content, and update state deterministically while staying host-native.


## Command Path And Examples

- CLI command path: `/blu-plan-phase`
- Root router form: `/blu plan-phase`
- Argument hint: `[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>] [--reviews] [--text]`
- `/blu-plan-phase 3`
- `/blu plan-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must exist and usually should already have context and research.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and updates `.blueprint/STATE.md` through MCP.


## Blueprint And Global State Reads


- `.blueprint/STATE.md`
- `.blueprint/config.json`


## Blueprint And Global State Writes


- `one or more XX-YY-PLAN.md files`
- `.blueprint/STATE.md`
- `optional plan-check report in .blueprint/reports/`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, requirements, missingArtifacts}`
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_plan_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, written, created, overwritten, status, validation, warnings}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Plan Persistence Contract


- Persist final plan bodies through `blueprint_phase_plan_write`; do not write raw `.blueprint/` plan files directly.
- Pass `phase` as the resolved phase number, for example `"3"`.
- Pass `content` as the full finalized `XX-YY-PLAN.md` body, not scaffold placeholder text.
- Omit `planId` to let Blueprint auto-assign the next available plan slot.
- If targeting a specific plan, pass `planId` as a string. Prefer zero-padded values such as `"01"` so the request matches Blueprint artifact naming.
- Do not pass a numeric `planId` value and do not derive `planId` manually from a scaffold path.


## Skills And Subagents


- Primary skill: `blueprint-phase-planning`
- Optional subagents:
- `blueprint-planner`
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
- `docs/commands/research-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- web docs for unstable technical choices


## Shell Risk Profile

- Medium: can replace plans and change downstream execution order.

## User Prompts And Confirmation Gates


- Confirm destructive replanning when plans already exist.
- Prefer reusing the existing plan index and reading existing plan files before creating replacements.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.
- Existing plan files conflict with the current roadmap or are missing required wave coverage.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.
- If config disables optional planning steps such as research or UI gating, report that those behaviors were skipped because of normalized `workflow.*` settings rather than undocumented defaults.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses the plan index plus dedicated plan read/write tools to persist actual plan content instead of scaffold-only placeholders.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Derives research, plan-check, Nyquist, UI-gate, and planning-confirmation behavior from normalized effective config instead of re-deriving defaults inside the command.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Config-conditioned planning fixture with research or UI gating disabled.
- Existing-plan overwrite and plan-index refresh fixture.
- Direct `plan-phase` happy-path fixture.

