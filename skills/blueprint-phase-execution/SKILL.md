---
name: blueprint-phase-execution
description: >
  Plan execution, bounded quick delivery, and summary or report generation for
  Blueprint lifecycle work. Use this skill to run saved plans in wave-aware
  order, execute quick scoped tasks, delegate bounded implementation work, and
  persist honest execution evidence through MCP.
status: implemented
commands:
  - /blu-execute-phase
  - /blu-fast
  - /blu-quick
---

# Blueprint Phase Execution Skill

## Purpose

Orchestrate Blueprint's execution-family flows so saved plans run in a wave-aware order, bounded quick tasks stay intentionally small, durable `XX-YY-SUMMARY.md` or quick-run report artifacts are persisted through MCP, and follow-up routing stays inside the implemented Blueprint surface.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are Gemini entrypoints, not shell executables.

## Parity Goal

Carry forward the useful `execute-phase`, `quick`, and later `fast` intent while preserving Blueprint deltas:

- execution stays Gemini-native and MCP-owned instead of script-owned
- plans remain the source of execution scope and dependency ordering
- one durable summary artifact is written per executed plan
- bounded quick work stays report-backed and does not quietly become a phase-planning substitute
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
- `blueprint_project_status`
- `blueprint_command_catalog`
- `blueprint_config_get`
- `blueprint_artifact_report_write`
- `blueprint_artifact_validate`
- `blueprint_state_load`
- `blueprint_state_update`

## Optional Agents

- `blueprint-researcher`
- `blueprint-planner`
- `blueprint-executor`
- `blueprint-verifier`

## Workflow Rules

1. Resolve the target phase before executing anything and stop if the phase cannot be inferred safely.
2. Treat the plan index plus summary index as the execution source of truth; plans without summaries are pending work, and summaries without plans are a repair warning.
3. If no plans exist yet, route to `/blu-plan-phase` before attempting execution.
4. Read the selected plan artifacts before delegating execution so wave ordering, dependencies, and acceptance criteria stay grounded in the saved plan set.
5. Respect `parallelization.*`, `workflow.use_worktrees`, and `git.branching_strategy` from normalized effective config when describing execution mode.
6. Use `blueprint-executor` for bounded per-plan work instead of collapsing the entire phase into one task.
7. Persist execution evidence through `blueprint_phase_summary_write`; do not write raw summary files directly.
8. Existing summaries require explicit overwrite confirmation before replacement. Reuse is the default.
9. Keep partial-wave, `--wave`, and `--gaps-only` runs honest: they may advance execution coverage, but they must not claim the whole phase is complete while pending plans remain.
10. After summary writes, refresh validation signals and update `STATE.md` so the next safe implemented action stays accurate.
11. Prefer `/blu-progress` as the default safe follow-up unless a later lifecycle command is clearly implemented.
12. Do not present planned-only lifecycle commands as runnable or guaranteed next steps.
13. For `/blu-quick`, start from `blueprint_project_status` and `blueprint_command_catalog`, keep the scope bounded, and refuse to impersonate a saved plan or a broad multi-phase rollout.
14. `/blu-quick` may use `blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` only when the user explicitly confirms deeper discuss, research, or validation depth.
15. Persist durable quick-run evidence through `blueprint_artifact_report_write` with the canonical `quick-run-latest` report instead of inventing ad hoc state files.
16. `/blu-quick` should prefer `/blu-progress` after completion unless a narrower implemented next step is obvious and safe.
17. `/blu-fast` is the trivial inline execution path: start from `blueprint_project_status`, keep the ask genuinely small, do not use subagents, and do not create durable reports or phase artifacts.
18. `/blu-fast` may update `STATE.md` only when Blueprint is initialized and healthy; partial repos should reroute to `/blu-health`, and uninitialized repos should stay in safe suggestion mode for Blueprint persistence.
19. Route any non-trivial or evidence-heavy ask from `/blu-fast` to `/blu-quick` or `/blu-plan-phase` instead of stretching the command past its contract.
20. Do not recommend `/blu-fast` unless `blueprint_command_catalog` says it is implemented.

## Output Style

- Explain which plans or waves were selected and why.
- Explain any overwrite or partial-run risk before writes.
- Call out the effective execution mode, including parallelization, worktree, and branch-strategy decisions.
- Keep the user anchored on the next safe implemented action after execution.
- For `/blu-fast`, explain why the task qualified as a trivial inline run, whether Blueprint state was updated, and which implemented follow-up remains safest.
- For `/blu-quick`, explain why the task qualified as a bounded quick run, which optional depth gates were used, what the quick-run report captured, and which implemented follow-up remains safest.
