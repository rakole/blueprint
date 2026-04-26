# `/blu-execute-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `execute-phase` uses the shared long-running-mutation posture: resolve the target phase, read live plan and summary state, decide the pending execution scope plus any overwrite or durable carry-forward gate, execute bounded plan work, persist summaries through MCP, validate the resulting artifacts, and route to the next safe implemented follow-up.
- For long-running execution, use Gemini CLI's internal `update_topic` plus `write_todos` tools to keep the current stage, selected plan set, pending gate, execution mode, and next safe action visible without turning those helpers into durable state.


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
- `blueprint_phase_execution_targets` is the deterministic selection helper for default runs plus `--wave` and `--gaps-only`; any lower-wave pending plan in its result blocks later-wave work, including combined `--gaps-only --wave` requests.
- Existing summary files only count as completed evidence when summary validation passes; malformed summaries remain repair or replace targets.
- `PARTIAL` and `BLOCKED` summaries count as truthful saved evidence, but they do not close the plan in `pendingPlans` or allow a phase completion claim.
- Invalid or stale saved plans are not executable. Missing dependencies, invalid frontmatter, unreadable read-first context, or plan-validation warnings that affect execution must be repaired before implementation or summary persistence.

## Execution Gates

- Pre-persistence gates: read the selected plan index, summary index, effective config, canonical summary contract, artifact validation state, and phase state before any summary write.
- Wave gates: execute waves in dependency order; a `--wave N` run stops when any lower-wave pending plan is still pending, including combined `--gaps-only --wave` runs.
- Ownership gates: compare selected plans' `files_modified`, generated artifacts, and other write surfaces before dispatch. Parallel executor agents are allowed only for disjoint write ownership; otherwise execution is sequential.
- If validation or state reads surface code-review, regression, or schema-drift warnings, treat them as blockers for summary persistence until they are cleared or repaired.
- Verification gates: run targeted acceptance checks before writing a `COMPLETED` summary. Failed checks trigger bounded repair attempts and then a `PARTIAL` or `BLOCKED` summary if the plan cannot be completed honestly.
- Post-execution checks: after summary writes finish, rerun the summary index, run artifact validation, and then call `blueprint_state_update` with `base: "synced"` so the next safe implemented action stays current.
- State timing: rerun the summary index after writes and update state only from that refreshed truth. Do not advance state as if the phase completed while pending plans, lower-wave blockers, failed tests, partial summaries, blocked summaries, or incomplete selected waves remain.
- Verifier handoff: `/blu-execute-phase` records execution coverage but never makes a phase-level completion claim on its own; the downstream `/blu-validate-phase` handoff is required before any completion claim, and `/blu-verify-work` remains the next lifecycle step once validation evidence exists.


## Outputs


- User-facing result: a concise completion summary, recorded execution evidence, and the next logical action when applicable.
- Repo side effects: writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- Interactive runs include progress checkpoints and branch points for `review`, `skip`, or `stop` instead of a single preflight approval only.
- Interactive runs still obey the same pre-persistence and post-execution gates before they can advance to the next plan.
- Subagent-capable runs dispatch bounded `blueprint-executor` agents one plan or confirmed disjoint batch at a time, with explicit write ownership, read-first context, isolation expectation, targeted verification, and summary-ready output.
- Single-agent fallback runs execute one plan or major task group inline, verify it, persist an MCP-owned summary, treat the latest `PARTIAL`, `BLOCKED`, or completed summary as durable carry-forward checkpoint evidence, compress context from that artifact, and only then proceed.

## In-Flight Progress Contract

- For non-trivial runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact execution checklist with `write_todos`.
- Keep that visible progress aligned to the selected scope, current stage, pending gate, execution mode, and next safe action as the run moves from target resolution through execution, persistence, validation, and routing.
- Treat `update_topic` and `write_todos` as session-local coordination only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.


## Blueprint And Global State Reads


- `.blueprint/config.json`
- `.blueprint/STATE.md`
- selected phase plan files through MCP reads
- selected phase summary files through MCP reads
- `phase.summary` canonical authoring contract through MCP reads before summary creation or replacement


## Blueprint And Global State Writes


- `one or more XX-YY-SUMMARY.md files`
- `.blueprint/STATE.md` when the next-step signal changes


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans, gapClosurePlans}`
- `blueprint_phase_execution_targets` -> `{pendingPlanIds, candidatePlanIds, selectedPlanIds, lowerWavePendingPlans, overwriteCandidatePlanIds, overlapPlanIds, blockers, conflicts, warnings}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
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
- Use `blueprint_phase_execution_targets` as the authoritative selector for default targets, `--wave`, `--gaps-only`, lower-wave blockers, overwrite candidates, and overlap warnings.
- Use `mcp_blueprint_blueprint_artifact_contract_read` with `artifactId: "phase.summary"` before any summary write or replacement so the persisted body matches the canonical template.
- If the summary index or summary read flags a malformed summary, treat it as a repair or replace candidate instead of reusing it as durable completion evidence.
- `COMPLETED` is the only summary status that closes execution debt. `PARTIAL` and `BLOCKED` are allowed truthful statuses for carry-forward evidence and must keep the plan pending.
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
- When `ask_user` is unavailable, ask the same focused confirmation or branch question in prose instead of inventing a replacement host tool.
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
- Uses `blueprint_phase_execution_targets` for deterministic execute-phase target selection, lower-wave blocking, overwrite candidates, and overlap warnings.
- Leaves unrelated repo files untouched.
- Honors normalized `parallelization.*`, `workflow.use_worktrees`, and `git.branching_strategy` from effective config instead of ad hoc command-local heuristics.
- Treats `gaps-only` as a real gap-closure mode backed by `gapClosurePlans` metadata rather than a synonym for "plans without summaries".
- Treats valid summaries as completion evidence and malformed summaries as repair or replace targets.
- Uses sequential interactive checkpoints when `--interactive` is set, with explicit branch points for `review`, `skip`, and `stop`.
- Uses `blueprint_state_update` with `base: "synced"` after summary persistence so `STATE.md` follows refreshed summary truth instead of stale stored state.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Parallelization and worktree-isolation fixture.
- Wave-filtered direct `execute-phase` happy-path fixture.
