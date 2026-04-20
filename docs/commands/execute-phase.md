# `/blu-execute-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`execute-phase` is Blueprint's command for executing all plans in a phase with wave-based parallelization and honest gap closure. In Blueprint it is implemented as a host-native runtime contract that delegates plan discovery and summary persistence to documented MCP tools, keeps the repo-side contract explicit, and hands off to the shipped `validate-phase` flow before `verify-work` continues the lifecycle.


## Command Path And Examples

- CLI command path: `/blu-execute-phase`
- Root router form: `/blu execute-phase`
- Argument hint: `<phase-number> [--wave N] [--gaps-only] [--interactive]`
- `/blu-execute-phase 3 --wave 2`
- `/blu execute-phase`

## Inputs, Project State, And Prerequisite Artifacts


- At least one plan must already exist for the selected phase.
- `--wave`, `--gaps-only`, and `--interactive` are honored when present.
- `--wave` never proves lower-wave completion by itself.
- `--gaps-only` targets plans explicitly marked as gap closure through saved plan metadata, not every unsummarized plan.
- Existing summary files only count as completed evidence when summary validation passes; malformed summaries remain repair or replace targets.


## Outputs


- User-facing result: a concise completion summary, recorded execution evidence, and the next logical action when applicable.
- Repo side effects: writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- Interactive runs include progress checkpoints and branch points for `review`, `skip`, or `stop` instead of a single preflight approval only.


## Blueprint And Global State Reads


- `.blueprint/config.json`
- `.blueprint/STATE.md`
- selected phase plan files through MCP reads
- selected phase summary files through MCP reads
- `phase.summary` canonical authoring contract through MCP reads before summary creation or replacement


## Blueprint And Global State Writes


- `one or more XX-YY-SUMMARY.md files`
- `optional execution reports in .blueprint/reports/`
- `.blueprint/STATE.md` when the next-step signal changes


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans, gapClosurePlans}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}`
- `blueprint_phase_summary_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, linkedPlanPath, written, created, overwritten, status, issues, warnings}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}` or `{artifactId: null, contracts}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Summary Persistence Contract

- Persist execution evidence through `blueprint_phase_summary_write`; do not write raw `XX-YY-SUMMARY.md` files directly.
- Pass `phase` as the resolved numeric phase reference and `planId` as the numeric id of the matching saved plan, for example `"01"` or `1`.
- The matching `XX-YY-PLAN.md` must already exist before a summary can be written.
- Pass the full final summary body and treat the returned `path` plus `linkedPlanPath` as authoritative instead of rebuilding summary filenames manually.
- Do not pass summary filenames, phase slugs, phase directories, or combined tokens such as `03-01` where the tool expects `planId`.
- For `--gaps-only`, start from `blueprint_phase_plan_index.gapClosurePlans` and intersect that set with pending plans; do not infer gap closure from missing summaries alone.
- Use `mcp_blueprint_blueprint_artifact_contract_read` with `artifactId: "phase.summary"` before any summary write or replacement so the persisted body matches the canonical template.
- If the summary index or summary read flags a malformed summary, treat it as a repair or replace candidate instead of reusing it as durable completion evidence.
- If selected summaries overlap on a shared file set, pause for explicit confirmation instead of assuming the write is safe.
- If validation or state reads surface code-review, regression, or schema-drift warnings, treat them as gates before summary persistence.


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
- `docs/RUNTIME-REFERENCE.md`
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
- In interactive mode, prefer `ask_user` for overwrite confirmation, sequential execution checkpoints, and review/skip/stop choices.
- Respect normalized config for `parallelization.*`, `workflow.use_worktrees`, and `git.branching_strategy` when deciding whether wave execution is parallel, worktree-isolated, or branch-scoped.
- If later-wave work is selected while lower-wave plans remain pending, stop and report the lower-wave gap explicitly.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.
- If config forces sequential execution or disables worktree isolation, explain that behavior explicitly instead of implying an execution failure.
- If the plan set reveals a lower-wave gap, treat execution as partial and do not imply full phase completion.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes, including the plan read and summary read/write tools.
- Leaves unrelated repo files untouched.
- Honors normalized `parallelization.*`, `workflow.use_worktrees`, and `git.branching_strategy` from effective config instead of ad hoc command-local heuristics.
- Treats `gaps-only` as a real gap-closure mode backed by `gapClosurePlans` metadata rather than a synonym for "plans without summaries".
- Treats valid summaries as completion evidence and malformed summaries as repair or replace targets.
- Uses sequential interactive checkpoints when `--interactive` is set, with explicit branch points for `review`, `skip`, and `stop`.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Parallelization and worktree-isolation fixture.
- Wave-filtered direct `execute-phase` happy-path fixture.
