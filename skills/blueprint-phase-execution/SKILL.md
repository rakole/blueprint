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
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- For structured interactive choices, confirmations, review, skip, or stop branching, or short clarifications, prefer Gemini CLI's built-in `ask_user` tool over plain assistant prose.

## Parity Goal

Carry forward the useful `execute-phase`, `quick`, and later `fast` intent while preserving Blueprint deltas:

- execution stays host-native and MCP-owned instead of script-owned
- plans remain the source of execution scope and dependency ordering
- one valid durable summary artifact is written per executed plan
- malformed summaries are repair or replace targets, not reusable execution evidence
- pre-persistence gates must clear before any summary write
- post-execution checks must run before state is updated
- code-review, regression, and schema-drift warnings block summary persistence until they are repaired or explicitly acknowledged
- bounded quick work stays report-backed and does not quietly become a phase-planning substitute
- partial-wave, filtered, and gap-closure runs do not falsely complete the whole phase
- later waves never erase lower-wave debt
- `/blu-execute-phase` hands off to `/blu-validate-phase` before any phase-level completion claim, and `/blu-verify-work` remains the verifier follow-up once validation evidence exists
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
- `blueprint_artifact_contract_read`
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

## Shared MCP Contracts

- `blueprint_phase_locate`: pass only a numeric phase reference when the command provides one, or omit `phase` for state or roadmap inference. Never pass phase directories or filenames.
- `blueprint_phase_plan_index`: use `gapClosurePlans` as the source of truth for `--gaps-only` targeting instead of inferring gap closure from missing summaries.
- `blueprint_phase_summary_write`: pass numeric `phase`, numeric `planId`, and full summary content. The matching plan must already exist, and the returned `path` plus `linkedPlanPath` are authoritative.
- `blueprint_artifact_contract_read`: read the canonical authoring template and validation metadata for `phase.summary` before drafting or replacing `XX-YY-SUMMARY.md`.
- `blueprint_artifact_report_write`: pass a bare report name such as `quick-run-latest`, not `.blueprint/reports/quick-run-latest.md`. Use the returned `path` as authoritative.

## Workflow Rules

1. Resolve the target phase before executing anything and stop if the phase cannot be inferred safely.
2. Treat the plan index plus summary index as the execution source of truth; plans without valid summaries are pending work, and summaries without plans or with validation failures are repair warnings.
3. If no plans exist yet, route to `/blu-plan-phase` before attempting execution.
4. Read the selected plan artifacts before delegating execution so wave ordering, dependencies, and acceptance criteria stay grounded in the saved plan set.
5. Respect `parallelization.*`, `workflow.use_worktrees`, and `git.branching_strategy` from normalized effective config when describing execution mode.
6. Use `blueprint-executor` for bounded per-plan work instead of collapsing the entire phase into one task.
7. Persist execution evidence through `blueprint_phase_summary_write`; do not write raw summary files directly, and never pass summary filenames where the tool expects a numeric `planId`.
8. Before drafting or replacing a summary, read the canonical `phase.summary` contract through `blueprint_artifact_contract_read` and normalize the body to its authoring template.
9. Existing valid summaries require explicit overwrite confirmation before replacement. Reuse is the default only when the summary is valid.
10. Interactive runs should be sequential and checkpointed: after each plan or major task group, surface progress and ask the user whether to review, skip, or stop before continuing.
11. Keep partial-wave, `--wave`, and `--gaps-only` runs honest: they may advance execution coverage, but they must not claim the whole phase is complete while pending plans remain.
12. Never treat later-wave execution as proof that lower-wave plans are done.
13. For `--gaps-only`, target only the pending plan ids present in `blueprint_phase_plan_index.gapClosurePlans`. If none match, stop instead of silently falling back to all pending plans.
14. If summaries overlap on a shared file set, treat that as a conflict risk and pause for confirmation instead of assuming the write is safe.
15. Before summary persistence, verify the selected goal, acceptance criteria, dependency order, and any code-review, regression, or schema-drift warnings surfaced by validation or state reads so execution sequencing stays aligned with the plan. Treat those warnings as pre-persistence gates, not retrospective notes.
16. After summary writes, run the post-execution checks and update `STATE.md` so the next safe implemented action stays accurate. Do not make a phase-level completion claim from execute-phase itself; that claim waits for the `/blu-validate-phase` handoff and the later `/blu-verify-work` verifier pass.
17. Prefer `/blu-progress` as the default safe follow-up unless a later lifecycle command is clearly implemented.
18. Do not present planned-only lifecycle commands as runnable or guaranteed next steps.
19. For `/blu-quick`, start from `blueprint_project_status` and `blueprint_command_catalog`, keep the scope bounded, and refuse to impersonate a saved plan or a broad multi-phase rollout.
20. `/blu-quick` may use `blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` only when the user explicitly confirms deeper discuss, research, or validation depth.
21. Persist durable quick-run evidence through `blueprint_artifact_report_write` with the bare canonical report name `quick-run-latest` instead of inventing ad hoc state files or passing a `.blueprint/reports/...` path.
22. `/blu-quick` should prefer `/blu-progress` after completion unless a narrower implemented next step is obvious and safe.
23. `/blu-fast` is the trivial inline execution path: start from `blueprint_project_status`, keep the ask genuinely small, do not use subagents, and do not create durable reports or phase artifacts.
24. `/blu-fast` may update `STATE.md` only when Blueprint is initialized and healthy; partial repos should reroute to `/blu-health`, and uninitialized repos should stay in safe suggestion mode for Blueprint persistence.
25. Route any non-trivial or evidence-heavy ask from `/blu-fast` to `/blu-quick` or `/blu-plan-phase` instead of stretching the command past its contract.
26. Do not recommend `/blu-fast` unless `blueprint_command_catalog` says it is implemented.

## Output Style

- Explain which plans or waves were selected and why.
- Explain any overwrite or partial-run risk before writes.
- Call out the effective execution mode, including parallelization, worktree, and branch-strategy decisions.
- Keep the user anchored on the next safe implemented action after execution.
- For `/blu-fast`, explain why the task qualified as a trivial inline run, whether Blueprint state was updated, and which implemented follow-up remains safest.
- For `/blu-quick`, explain why the task qualified as a bounded quick run, which optional depth gates were used, what the quick-run report captured, and which implemented follow-up remains safest.
