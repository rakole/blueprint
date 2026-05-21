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
- Read a compact readiness packet for phase context, research/UI readiness,
  plan inventory, optional XX-SPEC.md evidence when
  `phase.artifacts.spec exists`, effective config, state, authoring schema, and
  read-set freshness.
- Treat the canonical `XX-CONTEXT.md` artifact in
  `.blueprint/phases/<phase>/` as read-only planning evidence. If it is
  missing, invalid, contradictory, or unusable, route back to
  `/blu-discuss-phase <phase>` with diagnostics instead of repairing or
  replacing it.
- Treat missing spec evidence as nonblocking by default; when a spec is present,
  account for its requirements and boundaries in evidence coverage and avoid
  draft contradictions against explicit out-of-scope items.
- Stop before drafting when readiness blocks planning, and route to the returned
  next safe action.
- Ask for `add`, `revise`, or `replace` when saved plans exist and `planId` was
  omitted. Explicit additive intent can choose a new slot; revise, replace, and
  overwrite paths require confirmation.
- Draft structured `phase.plan` JSON, optionally run a dry-run model validation
  or checker loop, then persist through `blueprint_phase_plan_write`.
- If validation fails, repair the same structured draft once. If identical
  diagnostics or the same diagnostics repeat, stop, report the diagnostics, and
  do not inspect MCP source files as a repair strategy.
- Run final `blueprint_phase_plan_validate` before state update or completion.
- Return a concise result plus the Downstream Execution Handoff for execution.

## Important Safety Rules

- No raw `.blueprint/` writes.
- No scaffold-placeholder plans.
- No Markdown `content` fallback from `/blu-plan-phase`.
- No `validationMode: "warn"` from this command.
- No live web browsing for planning evidence; use saved research or route to
  `/blu-research-phase`.
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
