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
input_bundles:
  shared: []
  commands:
    "/blu-plan-phase":
      - docs/commands/plan-phase.md
      - skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md
---

# Blueprint Phase Planning Skill

## Purpose

Orchestrate Blueprint's phase-planning flow so the final plan is grounded in current phase context, normalized config, the live phase.plan contract, and an explicit planner/checker revision loop with coverage gating.

## Shared Runtime Contract

- Execution profile: `long-running-mutation`
- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the resolved scope, active stage, pending gate, execution mode, and next safe action visible while planning.
- Use a structured `reuse`, `revise`, or `replace` gate only when the current write would revise or replace saved plans. Additive new plan ids may proceed without that gate when no saved plan body is being overwritten.
- Load `references/plan-phase-runtime-contract.md` as the detailed runtime contract for stage mapping, MCP call control flow, anti-shallow artifact authoring, capability-gated subagent use, no-subagent fallback, validation repair, output quality, and completion criteria.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful `plan-phase` intent while preserving Blueprint deltas:

- config-driven research and UI gates stay authoritative
- overwrite or replace paths require explicit confirmation, while additive new plan ids remain allowed
- plan checks stay config-gated and the checker loop stays bounded until the draft is acceptable or the gap is isolated
- follow-up routing only stays inside the implemented Blueprint surface
- persistent writes remain phase-scoped inside `.blueprint/`

## Required Inputs

Command-specific inputs are resolved from the structured `input_bundles`
frontmatter for `/blu-plan-phase`.

## Command-Scoped Required MCP Tools

Use only the MCP tools allowed by the active command contract. The shared skill
does not grant broader tool scope to a command.

- `blueprint_phase_locate`
- `blueprint_artifact_contract_read`
- `blueprint_phase_context`
- `blueprint_phase_research_status`
- `blueprint_phase_artifact_read`
- `blueprint_phase_validation_read`
- `blueprint_review_load_findings`
- `blueprint_phase_plan_index`
- `blueprint_phase_plan_read`
- `blueprint_phase_plan_validate`
- `blueprint_phase_plan_write`
- `blueprint_config_get`
- `blueprint_state_load`
- `blueprint_state_update`

## Optional Agents

- `blueprint-planner`
- `blueprint-checker`

## Workflow Rules

1. Resolve the target phase before drafting anything and stop if it cannot be inferred safely.
2. Treat `workflow.research`, `workflow.ui_phase`, `workflow.ui_safety_gate`, and `workflow.plan_check` from normalized effective config as the source of truth for planning gates.
3. Read the live `phase.plan` contract, actual saved discovery artifact bodies, saved validation or review evidence when present, plan inventory, effective config, and state before replanning. Reuse `blueprint_phase_context.codebase` when the mapped codebase bundle is present.
4. If research is enabled and missing or invalid, route to `/blu-research-phase` before finalizing the plan. Use saved research for unstable technical decisions instead of browsing live web docs during planning.
5. Only require the reuse/revise/replace gate when the current write would revise or replace saved plan ids or the saved plan set. Additive new plan ids may be appended without that gate when no saved content is being overwritten.
6. Use `blueprint-planner` to draft execution-ready plan bodies when suitable. If suitable planning agents are unavailable, use the no-subagent fallback from `references/plan-phase-runtime-contract.md`.
7. Normalize finalized content to `contract.authoringTemplate`, then persist it through `blueprint_phase_plan_write` with `validationMode: "strict"`. Omit `planId` to auto-assign the next slot, or pass only the numeric plan id when targeting a specific plan; prefer zero-padded string values such as `"01"` so the request matches artifact naming, but numeric inputs such as `1` are accepted. Do not rely on scaffold text as the finished plan.
8. When `workflow.plan_check=true`, run the bounded review loop from the runtime contract: use `blueprint-checker` when suitable, otherwise use the inline fallback. When `workflow.plan_check=false`, skip checker review entirely and state that the config disabled it.
9. If `blueprint_phase_plan_write` or `blueprint_phase_plan_validate` reports invalid content, repair against the live contract and retry through MCP before presenting completion; never bypass validation with raw `.blueprint/` edits.
10. After persistence, prefer `blueprint_state_update` with `base: "synced"` so `STATE.md` recomputes the next safe action from the updated artifact inventory instead of leaving stale routing behind. Prefer `/blu-progress` as the default safe follow-up unless a later lifecycle command is clearly implemented.
11. Do not present planned-only lifecycle commands as runnable or as a guaranteed next step.

## Output Style

- Explain which gates were enabled or skipped because normalized config said so.
- Explain overwrite, replace, or revision risk before writes when saved plan bodies would change.
- Keep the user anchored on the next safe implemented action after planning.
