---
name: blueprint-phase-execution
description: >
  Plan execution, bounded quick delivery, and durable execution evidence for
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

Orchestrate Blueprint's execution-family flows so saved plans run in a wave-aware order, bounded quick tasks stay intentionally small, durable `XX-YY-SUMMARY.md` artifacts for `/blu-execute-phase` and quick-run reports for `/blu-quick` are persisted through MCP, and follow-up routing stays inside the implemented Blueprint surface.

## Runtime Call Rules

- Execution profile for `/blu-execute-phase` and non-trivial `/blu-quick`: `long-running-mutation`
- Execution profile for `/blu-fast`: `interactive-read`
- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- For structured interactive choices, confirmations, review, skip, or stop branching, or short clarifications, prefer Gemini CLI's built-in `ask_user` tool over plain assistant prose.
- When the host does not expose `ask_user`, ask the same focused question in prose instead of inventing a replacement host tool.
- Use Gemini CLI's internal `update_topic` tool to keep `/blu-execute-phase` and non-trivial `/blu-quick` runs anchored on the active stage.
- Use Gemini CLI's internal `write_todos` tool to maintain a compact visible checklist for `/blu-execute-phase` and non-trivial `/blu-quick` runs when the work spans multiple stages.
- Treat branchy execution-family work, including tracker-eligible `/blu-quick` runs, as eligible for Gemini's internal task tracker when that tracker helps manage bounded dependencies across discuss, research, implementation, and validation substeps.
- Treat `update_topic` and `write_todos` as session-local coordination only; they do not replace Blueprint MCP persistence or `.blueprint/STATE.md`.
- Treat tracker state as session-local coordination only; it does not replace Blueprint MCP persistence, saved plans, or durable Blueprint reports.
- `/blu-fast` explicitly excludes `update_topic`, `write_todos`, and tracker tools; finish the run inline or reroute instead of building a long-running progress layer around trivial work.

## Parity Goal

Carry forward the useful `execute-phase`, `quick`, and later `fast` intent while preserving Blueprint deltas:

- execution stays host-native and MCP-owned instead of script-owned
- plans remain the source of execution scope and dependency ordering
- one valid durable summary artifact is written per executed plan
- malformed summaries are repair or replace targets, not reusable execution evidence
- `PARTIAL` and `BLOCKED` summaries are durable carry-forward evidence, but they do not close execution debt or make a plan complete
- pre-persistence gates must clear before any summary write
- post-execution checks must run before state is updated
- state updates happen after summary indexing re-checks, not before execution truth is known
- code-review, regression, and schema-drift warnings block summary persistence until they are repaired or explicitly acknowledged
- targeted tests, acceptance checks, and bounded repair attempts must happen before a `COMPLETED` summary is written
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

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_phase_plan_index`
- `blueprint_phase_execution_targets`
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
- `blueprint_phase_execution_targets`: use it as the deterministic read path for execute-phase target selection, lower-wave blockers, overwrite candidates, and overlap warnings. Any lower-wave pending plan in `lowerWavePendingPlans` blocks later-wave work, including `--gaps-only --wave` runs.
- `blueprint_phase_summary_write`: pass numeric `phase`, numeric `planId`, and full summary content. The matching plan must already exist, and the returned `path` plus `linkedPlanPath` are authoritative.
- `blueprint_artifact_contract_read`: read the canonical authoring template and validation metadata for `phase.summary` before drafting or replacing `XX-YY-SUMMARY.md`.
- `blueprint_artifact_report_write`: pass a bare report name such as `quick-run-latest`, not `.blueprint/reports/quick-run-latest.md`. Use the returned `path` as authoritative.
- `blueprint_state_update`: for execute-phase state refresh after summary persistence, call it with `base: "synced"` so `STATE.md` recomputes the next safe action from refreshed summary truth.

## Workflow Rules

1. Resolve the target phase before executing anything and stop if the phase cannot be inferred safely.
2. Treat the plan index, summary index, and `blueprint_phase_execution_targets` result as the execution source of truth; plans without valid summaries are pending work, summaries without plans or with validation failures are repair warnings, and the execution-target helper is authoritative for selected plan ids plus lower-wave blockers.
3. If no plans exist yet, route to `/blu-plan-phase` before attempting execution.
4. Once the target plan set is known and the run is non-trivial, keep the resolved scope, active stage, pending gate, execution mode, and next safe action visible with `update_topic`, `write_todos`, or the equivalent prose fallback.
5. Read the selected plan artifacts before delegating execution so wave ordering, dependencies, and acceptance criteria stay grounded in the saved plan set.
6. Refuse to execute stale or invalid plans. If `blueprint_phase_plan_read` or the plan index reports invalid frontmatter, missing dependencies, stale metadata, missing read-first files, or other prerequisite drift, repair or re-plan before any summary write.
7. Respect `parallelization.*`, `workflow.use_worktrees`, and `git.branching_strategy` from normalized effective config when describing execution mode.
8. Group execution by wave. Execute lower waves before higher waves, and stop a wave-filtered run if any lower-wave pending plan remains. This blocker is absolute, including combined `--gaps-only --wave` runs.
9. For each selected wave, compare `files_modified`, generated artifacts, and other write surfaces. Use parallel executor agents only for disjoint write ownership; run overlapping plans sequentially and call out the planning defect.
10. Use `blueprint-executor` for bounded per-plan work instead of collapsing the entire phase into one task. Executor prompts must include the exact plan id, write-owned files or surfaces, read-first files, expected isolation mode, verification commands or checks, and the requirement to return a summary-ready outcome.
11. If subagents are unavailable, unreliable, disabled by config, or unsafe because of overlapping write ownership, use the single-agent fallback: execute one plan or major task group inline, verify it, persist a summary through MCP, compress carry-forward context from that artifact, and use the latest `PARTIAL`, `BLOCKED`, or completed summary as durable checkpoint evidence before continuing.
12. Preserve checkpointing. For interactive runs and blockers, pause after each plan or major task group and ask whether to review, skip, stop, or retry. Checkpoints must include completed work, current task, blocker or pending gate, verification status, and next safe action, and they must be grounded in the latest persisted summary state rather than a dedicated execute-phase checkpoint write.
    Interactive runs remain sequential and checkpointed; they do not collapse into a single preflight approval.
13. Run the test/repair loop before completion evidence. Target only checks that prove the selected plan's acceptance criteria, repair only issues caused by the current changes, cap repeated repair attempts, and write `PARTIAL` or `BLOCKED` summaries when verification cannot pass.
14. Persist execution evidence through `blueprint_phase_summary_write`; do not write raw summary files directly, and never pass summary filenames where the tool expects a numeric `planId`.
15. Before drafting or replacing a summary, read the canonical `phase.summary` contract through `blueprint_artifact_contract_read` and normalize the body to its authoring template.
16. Existing valid summaries require explicit overwrite confirmation before replacement. Reuse is the default only when the summary is valid and marked `COMPLETED`; `PARTIAL` and `BLOCKED` summaries are carry-forward context, not completed execution coverage.
17. Keep partial-wave, `--wave`, and `--gaps-only` runs honest: they may advance execution coverage, but they must not claim the whole phase is complete while pending plans remain.
18. Never treat later-wave execution as proof that lower-wave plans are done.
19. For `--gaps-only`, target only the pending plan ids present in `blueprint_phase_plan_index.gapClosurePlans`. If none match, stop instead of silently falling back to all pending plans.
20. If summaries or selected plans overlap on a shared file set, treat that as a conflict risk and pause for confirmation or force sequential execution instead of assuming the write is safe.
21. Before summary persistence, verify the selected goal, acceptance criteria, dependency order, and any code-review, regression, or schema-drift warnings surfaced by validation or state reads so execution sequencing stays aligned with the plan. Treat those warnings as pre-persistence gates, not retrospective notes.
22. After summary writes, rerun `blueprint_phase_summary_index`, run post-execution artifact validation, then call `blueprint_state_update` with `base: "synced"` so `STATE.md` and the next safe implemented action stay accurate. Do not update state as if a plan or phase completed while the summary index still reports pending plans, partial summaries, blocked summaries, failed tests, or lower-wave debt.
23. Do not make a phase-level completion claim from execute-phase itself; that claim waits for the `/blu-validate-phase` handoff and the later `/blu-verify-work` verifier pass.
24. Prefer `/blu-progress` as the default safe follow-up unless a later lifecycle command is clearly implemented.
25. Do not present planned-only lifecycle commands as runnable or guaranteed next steps.
26. For `/blu-quick`, start from `blueprint_project_status` and `blueprint_command_catalog`, keep the scope bounded, and refuse to impersonate a saved plan or a broad multi-phase rollout.
27. Treat non-trivial `/blu-quick` runs as long-running-mutation work: keep the active stage visible, keep the resolved scope, pending gate, execution mode, and next safe action explicit, and use only the stage labels the run actually reaches.
28. `/blu-quick` may use `blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` only when the user explicitly confirms deeper discuss, research, or validation depth.
29. When a bounded `/blu-quick` run becomes branchy, it is tracker-eligible: use Gemini's task tracker only for session-local dependency management, pair it with visible `write_todos`, and do not let it impersonate a saved phase plan or full lifecycle execution.
30. Persist durable quick-run evidence through `blueprint_artifact_report_write` with the bare canonical report name `quick-run-latest` instead of inventing ad hoc state files or passing a `.blueprint/reports/...` path.
31. `/blu-quick` should prefer `/blu-progress` after completion unless a narrower implemented next step is obvious and safe.
32. `/blu-fast` is the trivial inline execution path: start from `blueprint_project_status`, keep the ask genuinely small, do not use subagents, do not use `update_topic`, `write_todos`, or tracker tools, and do not create durable reports or phase artifacts.
33. `/blu-fast` may update `STATE.md` only when Blueprint is initialized and healthy; partial repos should reroute to `/blu-health`, and uninitialized repos should stay in safe suggestion mode for Blueprint persistence.
34. Route any non-trivial or evidence-heavy ask from `/blu-fast` to `/blu-quick` or `/blu-plan-phase` instead of stretching the command past its contract.
35. Do not recommend `/blu-fast` unless `blueprint_command_catalog` says it is implemented.

## Output Style

- Explain which plans or waves were selected and why.
- Explain any overwrite or partial-run risk before writes.
- Call out the effective execution mode, including parallelization, worktree, and branch-strategy decisions.
- Keep the user anchored on the next safe implemented action after execution.
- For `/blu-fast`, explain why the task qualified as a trivial inline run, whether Blueprint state was updated, and which implemented follow-up remains safest.
- For `/blu-quick`, explain why the task qualified as a bounded quick run, which optional depth gates were used, whether tracker-backed branching was needed, what the quick-run report captured, and which implemented follow-up remains safest.
