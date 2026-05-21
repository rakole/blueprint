# `/blu-plan-phase`

| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Purpose

`/blu-plan-phase` creates or extends execution-ready phase plans for a selected
Blueprint phase. It reads the current phase context, readiness gates, effective
config, saved evidence, existing plans, and the live `phase.plan` model
contract, then persists structured plan models through MCP.

This page is user-facing documentation. The runtime prompt authority is the
command manifest, `blueprint-phase-planning` skill, and
`skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md`.

## User Flow

- Resolve the target phase from the argument, state, or roadmap.
- Read a compact readiness packet for context, research/UI readiness, plan
  inventory, effective config, state, authoring schema, and read-set freshness.
- Stop before drafting when readiness blocks planning, and route to the returned
  next safe action.
- Ask for `add`, `revise`, or `replace` when saved plans exist and `planId` was
  omitted. Explicit additive intent can choose a new slot; revise, replace, and
  overwrite paths require confirmation.
- Draft structured `phase.plan` JSON, optionally run a dry-run model validation
  or checker loop, then persist through `blueprint_phase_plan_write`.
- Run final `blueprint_phase_plan_validate` before state update or completion.
- Return a concise result plus the Downstream Execution Handoff for execution.

## Important Safety Rules

- No raw `.blueprint/` writes.
- No scaffold-placeholder plans.
- No Markdown `content` fallback from `/blu-plan-phase`.
- No `validationMode: "warn"` from this command.
- Treat `XX-CONTEXT.md` as read-only planning input. Missing, invalid,
  contradictory, or unusable phase context routes to
  `/blu-discuss-phase <phase>` before any planning draft.
- No live web browsing for planning evidence; use saved research or route to
  `/blu-research-phase`.
- If model validation or write repair returns identical diagnostics, stop and
  report the diagnostics; do not inspect MCP source as a repair strategy.
- No synced state update until final scoped plan-set validation is valid.
- No planned-only lifecycle command should be presented as runnable.

## Plan Persistence

Normal model writes use:

- `blueprint_phase_plan_write`
- `authoringMode: "model-only"`
- `validationMode: "strict"`
- `returnPlanSetValidation: true`
- `expectedReadSet` when skipping duplicate pre-write re-read after a fresh
  readiness packet

`blueprint_phase_plan_validate_model` remains available for dry-run previews,
repair loops, and checker convergence. It is not mandatory before every strict
model write.

`phase_plan_write.validation.valid`, `planSetValidationSummary`,
`completionReady`, and `incrementalCheckpoint` are write-scope signals. Final
completion still depends on `blueprint_phase_plan_validate` returning
`status: "valid"`.

## Outputs

- One or more `.blueprint/phases/<phase>/<XX>-<YY>-PLAN.md` files.
- `.blueprint/STATE.md` updated through synced state only after final validation.
- A final response with phase, plan ids, artifact paths or no-write status,
  gate decisions, checker behavior, final validation result, warnings or
  blockers, next safe implemented action, and the Downstream Execution Handoff.

## Skills And Subagents

- Primary skill: `blueprint-phase-planning`

## Required MCP Tools

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
- `blueprint_phase_plan_authoring_context`
- `blueprint_phase_plan_validate_model`
- `blueprint_phase_plan_write`
- `blueprint_phase_plan_validate`
- `blueprint_config_get`
- `blueprint_state_load`
- `blueprint_state_update`

## Examples

- `/blu-plan-phase 3`
- `/blu plan-phase`
