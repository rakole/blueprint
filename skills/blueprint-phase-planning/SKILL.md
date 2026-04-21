---
name: blueprint-phase-planning
description: >
  Plan synthesis, plan checks, and phase plan persistence for Blueprint
  lifecycle work. Use this skill to orchestrate config-gated planning flows
  with planner/checker revision loops, explicit requirements coverage checks,
  and MCP-owned plan writes.
status: implemented
commands:
  - /blu-plan-phase
---

# Blueprint Phase Planning Skill

## Purpose

Orchestrate Blueprint's phase-planning flow so the final plan is grounded in current phase context, normalized config, the live phase.plan contract, and an explicit planner/checker revision loop with coverage gating.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful `plan-phase` intent while preserving Blueprint deltas:

- config-driven research and UI gates stay authoritative
- existing plans require explicit overwrite confirmation
- planner and checker stay in a bounded revision loop until the draft is acceptable or the gap is isolated
- follow-up routing only stays inside the implemented Blueprint surface
- persistent writes remain phase-scoped inside `.blueprint/`

## Required Inputs

- `docs/commands/plan-phase.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_artifact_contract_read`
- `blueprint_phase_context`
- `blueprint_phase_research_status`
- `blueprint_phase_plan_index`
- `blueprint_phase_plan_read`
- `blueprint_phase_plan_write`
- `blueprint_config_get`
- `blueprint_artifact_validate`
- `blueprint_state_load`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`

## Optional Agents

- `blueprint-planner`
- `blueprint-checker`

## Workflow Rules

1. Resolve the target phase before drafting anything and stop if it cannot be inferred safely.
2. Treat `workflow.research`, `workflow.ui_phase`, `workflow.ui_safety_gate`, and `workflow.plan_check` from normalized effective config as the source of truth for planning gates.
3. Reuse `blueprint_phase_context.codebase` when the mapped codebase bundle is present, especially for brownfield repos. Prefer those saved summaries before broad repo rereads, and call out when the codebase bundle is missing or incomplete.
4. Read `mcp_blueprint_blueprint_artifact_contract_read` with `artifactId: "phase.plan"` before drafting or persisting any plan, then normalize the final body to `contract.authoringTemplate` before save. Treat the returned live contract object as the source of truth for plan shape and required wording, not a copied local template.
5. If a phase already has one or more `-PLAN.md` files, inspect them through `blueprint_phase_plan_index` and `blueprint_phase_plan_read`, then use `ask_user` for the reuse/revise/replace decision and require explicit overwrite confirmation before any replace path. Reuse is the default.
6. If research is enabled and missing or invalid, route to `/blu-research-phase` before finalizing the plan.
7. If UI planning is enabled, require a usable UI contract or explicit skip rationale before the plan is finalized.
8. Before finalizing, run a requirements-coverage check that maps every declared phase requirement and non-optional must-have to explicit plan coverage or a named blocker.
9. If the phase is too broad for one coherent plan, split it into prioritized dependency-aware waves or a narrower phase slice before drafting the final write.
10. Use `blueprint-planner` to draft one or more execution-ready plans with concrete frontmatter, dependency waves, repo paths, task-level `Read First`, task-level `Action`, and grep/test-verifiable `Acceptance Criteria`.
11. Persist finalized plan content through `blueprint_phase_plan_write`. Pass `phase` as the resolved phase number and `content` as the full plan body. Omit `planId` to auto-assign the next slot, or pass only the numeric plan id when targeting a specific plan; prefer zero-padded string values such as `"01"` so the request matches artifact naming, but numeric inputs such as `1` are accepted. Never pass `phaseDir`, `phasePrefix`, a scaffolded filename, a slug such as `02-invoice-ingestion`, a combined token like `02-01`, or a frontmatter key name like `plan_id`. Do not rely on scaffold text as the finished plan.
12. The saved plan must keep the exact Blueprint contract: frontmatter keys `phase`, `plan_id`, `title`, `wave`, `status`, `objective`, `depends_on`, `requirements`, `files_modified`, `read_first`, `acceptance_criteria`, and `autonomous`; body sections `## Goal`, `## Scope`, `## Tasks`, `## Verification`, and `## Must Haves`; and per-task subsections `#### Read First`, `#### Action`, and `#### Acceptance Criteria`.
13. Use `blueprint-checker` to review the saved plan set against phase evidence, locked Blueprint decisions, and the current discovery artifacts.
14. If the checker finds gaps, run a targeted revision loop instead of replanning unrelated files, then re-run the checker before accepting the plan.
15. If planner/checker revisions keep failing after a bounded number of passes, stop the loop, preserve the best coherent draft, and report the unresolved requirement or split point instead of looping indefinitely.
16. After persistence, prefer `blueprint_state_update` with `base: "synced"` so `STATE.md` recomputes the next safe action from the updated artifact inventory instead of leaving stale routing behind.
17. Prefer `/blu-progress` as the default safe follow-up unless a later lifecycle command is clearly implemented.
18. Do not present planned-only lifecycle commands as runnable or as a guaranteed next step.

## Output Style

- Explain which gates were enabled or skipped because normalized config said so.
- Explain any overwrite or revision risk before writes.
- Keep the user anchored on the next safe implemented action after planning.
