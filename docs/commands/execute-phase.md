# `/blu:execute-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Execute all plans in a phase with wave-based parallelization |


## Purpose


`execute-phase` carries forward the GSD intent to execute all plans in a phase with wave-based parallelization. In Blueprint it is implemented as a Gemini-native runtime contract that delegates plan discovery and summary persistence to documented MCP tools, keeps the repo-side contract explicit, and leaves `validate-phase` and `verify-work` as the next slice.


## Command Path And Examples

- Gemini command path: `/blu:execute-phase`
- Root router form: `/blu execute-phase`
- Argument hint: `<phase-number> [--wave N] [--gaps-only] [--interactive]`
- `/blu:execute-phase 3 --wave 2`
- `/blu execute-phase`

## Inputs, Project State, And Prerequisite Artifacts


- At least one plan must already exist for the selected phase.
- `--wave`, `--gaps-only`, and `--interactive` are honored when present.


## Outputs


- User-facing result: a concise completion summary, recorded execution evidence, and the next logical action when applicable.
- Repo side effects: writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- `.blueprint/config.json`
- `.blueprint/STATE.md`
- selected phase plan files through MCP reads
- selected phase summary files through MCP reads


## Blueprint And Global State Writes


- `one or more XX-YY-SUMMARY.md files`
- `optional execution reports in .blueprint/reports/`
- `.blueprint/STATE.md` when the next-step signal changes


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}`
- `blueprint_phase_summary_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, linkedPlanPath, written, created, overwritten, status, issues, warnings}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-phase-execution`
- Optional subagents:
- `blueprint-executor`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/GSD-RUNTIME-MIGRATION.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/plan-phase.md`
- `docs/commands/validate-phase.md`
- `docs/commands/verify-work.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- High: drives real repo mutation during implementation.

## User Prompts And Confirmation Gates


- Confirm branch or wave-specific execution details before starting.
- Respect normalized config for `parallelization.*`, `workflow.use_worktrees`, and `git.branching_strategy` when deciding whether wave execution is parallel, worktree-isolated, or branch-scoped.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.
- If config forces sequential execution or disables worktree isolation, explain that behavior explicitly instead of implying an execution failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes, including the plan read and summary read/write tools.
- Leaves unrelated repo files untouched.
- Honors normalized `parallelization.*`, `workflow.use_worktrees`, and `git.branching_strategy` from effective config instead of ad hoc command-local heuristics.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Parallelization and worktree-isolation fixture.
- Wave-filtered direct `execute-phase` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/execute-phase.md`
- Upstream workflow status: GSD has an upstream workflow file
