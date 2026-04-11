---
name: blueprint-phase-execution
status: implemented
commands:
  - /blu:execute-phase
---

# Blueprint Phase Execution Skill

## Purpose

Orchestrate Blueprint's phase-execution flow so existing plans are executed in a wave-aware order, durable `XX-YY-SUMMARY.md` artifacts are persisted through MCP, and follow-up routing stays inside the implemented Blueprint surface.

## Parity Goal

Carry forward the useful upstream `execute-phase` intent while preserving Blueprint deltas:

- execution stays Gemini-native and MCP-owned instead of script-owned
- plans remain the source of execution scope and dependency ordering
- one durable summary artifact is written per executed plan
- partial-wave and filtered runs do not falsely complete the whole phase
- follow-up routing stays inside the implemented Blueprint surface

## Required Inputs

- `docs/commands/execute-phase.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_phase_plan_index`
- `blueprint_phase_plan_read`
- `blueprint_phase_summary_index`
- `blueprint_phase_summary_read`
- `blueprint_phase_summary_write`
- `blueprint_config_get`
- `blueprint_artifact_validate`
- `blueprint_state_load`
- `blueprint_state_update`

## Optional Agents

- `blueprint-executor`

## Workflow Rules

1. Resolve the target phase before executing anything and stop if the phase cannot be inferred safely.
2. Treat the plan index plus summary index as the execution source of truth; plans without summaries are pending work, and summaries without plans are a repair warning.
3. If no plans exist yet, route to `/blu:plan-phase` before attempting execution.
4. Read the selected plan artifacts before delegating execution so wave ordering, dependencies, and acceptance criteria stay grounded in the saved plan set.
5. Respect `parallelization.*`, `workflow.use_worktrees`, and `git.branching_strategy` from normalized effective config when describing execution mode.
6. Use `blueprint-executor` for bounded per-plan work instead of collapsing the entire phase into one task.
7. Persist execution evidence through `blueprint_phase_summary_write`; do not write raw summary files directly.
8. Existing summaries require explicit overwrite confirmation before replacement. Reuse is the default.
9. Keep partial-wave, `--wave`, and `--gaps-only` runs honest: they may advance execution coverage, but they must not claim the whole phase is complete while pending plans remain.
10. After summary writes, refresh validation signals and update `STATE.md` so the next safe implemented action stays accurate.
11. Prefer `/blu:progress` as the default safe follow-up unless a later lifecycle command is clearly implemented.
12. Do not present planned-only lifecycle commands as runnable or guaranteed next steps.

## Output Style

- Explain which plans or waves were selected and why.
- Explain any overwrite or partial-run risk before writes.
- Call out the effective execution mode, including parallelization, worktree, and branch-strategy decisions.
- Keep the user anchored on the next safe implemented action after execution.
