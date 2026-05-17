---
name: blueprint-phase-planning
description: >
  Plan synthesis, checker coordination, and phase.plan persistence for Blueprint
  lifecycle work. Use this skill for config-gated `/blu-plan-phase` runs with
  additive-safe plan writes, optional planner/checker agents, MCP-owned
  persistence, and final plan-set validation.
status: implemented
commands:
  - /blu-plan-phase
input_bundles:
  shared: []
  commands:
    "/blu-plan-phase":
      - skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md
---

# Blueprint Phase Planning Skill

## Purpose

Orchestrate `/blu-plan-phase` so saved plans are grounded in current Blueprint
state, normalized config, the live `phase.plan` model contract, and a bounded
planner/checker loop. A saved plan can be an incremental checkpoint; completion
advances only after final scoped plan-set validation is valid.

## Required Runtime Contract

Load `references/plan-phase-runtime-contract.md` for the detailed
Resolve/Read/Decide/Execute/Persist/Validate/Route behavior, Planning
Investigation Trace, no-subagent fallback, repair loop, completion criteria,
and Downstream Execution Handoff.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as
  `mcp_blueprint_blueprint_phase_plan_readiness`.
- Translate older shorthand ids such as `blueprint_phase_plan_readiness` into
  runtime FQNs before calling.
- Never run `/blu-*` commands in the shell.
- Treat docs under `docs/commands/` as user-facing documentation, not runtime
  prompt authority.

## Command Inputs

Command-specific inputs are declared in this file's `input_bundles`
frontmatter. `/blu-plan-phase` must load the runtime contract above.

## Allowed MCP Tools

Use only tools allowed by the active command contract:

- `blueprint_phase_locate`
- `blueprint_artifact_contract_read`
- `blueprint_phase_context`
- `blueprint_phase_research_status`
- `blueprint_phase_artifact_read`
- `blueprint_phase_validation_read`
- `blueprint_review_load_findings`
- `blueprint_phase_plan_index`
- `blueprint_phase_plan_read`
- `blueprint_phase_plan_readiness`
- `blueprint_phase_plan_validate`
- `blueprint_phase_plan_authoring_context`
- `blueprint_phase_plan_validate_model`
- `blueprint_phase_plan_write`
- `blueprint_config_get`
- `blueprint_state_load`
- `blueprint_state_update`

## Optional Agents

- `blueprint-planner`
- `blueprint-checker`

Use optional agents only when suitable and enabled by effective config. The
parent command owns user gates, MCP reads, validation, persistence, state
update, and final routing.

## Orchestration Rules

- Prefer `blueprint_phase_plan_readiness` as the compact Read-stage packet for
  phase context, readiness gates, plan inventory, effective config, state,
  selected-slot authoring context, model contract authority, evidence signals,
  and read-set freshness.
- Stop before drafting when readiness blocks planning. Report the blocker and
  route to the returned next safe action.
- existing saved plans plus omitted `planId` require an explicit `add`,
  `revise`, or `replace` choice. Explicit additive intent may select a new
  slot; revise, replace, overwrite, or saved-plan-set replacement always asks.
- Draft structured `phase.plan` JSON against the selected runtime
  `taskSchema`. Do not pass Markdown `content`, seed scaffold placeholders, or
  fall back to raw `.blueprint/` writes.
- Persist through `blueprint_phase_plan_write` with `authoringMode:
  "model-only"`, `validationMode: "strict"`, `returnPlanSetValidation: true`,
  and `expectedReadSet` when skipping duplicate pre-write re-read.
- Use `blueprint_phase_plan_validate_model` only for dry-run preview, repair
  loops, and checker convergence.
- Refresh authoring context after successful writes, user pauses, subagent
  returns, or stale/missing read-set freshness. Do not skip refresh unless the
  write checked `expectedReadSet` server-side.
- Run final `blueprint_phase_plan_validate` before synced state update or
  completion claims. Do not infer completion from write-scope signals alone.
- Route only to implemented Blueprint commands; use `/blu-progress` when the
  safe next action is ambiguous.

## Non-Negotiable Safety

- No raw `.blueprint/` writes.
- No `validationMode: "warn"` from `/blu-plan-phase`.
- No Markdown fallback after model validation or write rejection.
- No installed-extension edits.
- No state update until final scoped validation is valid.
- No planned-only follow-up commands.
- No live web browsing for planning evidence; use saved research or route to
  `/blu-research-phase`.

## Completion Self-Check Pointer

Before claiming completion, satisfy the runtime contract's `Completion Criteria`
and include the Downstream Execution Handoff in the final response.
