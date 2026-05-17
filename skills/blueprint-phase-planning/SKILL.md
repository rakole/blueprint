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
      - skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md
---

# Blueprint Phase Planning Skill

## Purpose

Orchestrate Blueprint's phase-planning flow so the final plan is grounded in current phase context, normalized config, the live phase.plan contract, and an explicit planner/checker revision loop with coverage gating. Saved plans may land as incremental checkpoints, but completion advances only after final plan-set validation is truly valid.

## Shared Runtime Contract

- Execution profile: `long-running-mutation`
- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the resolved scope, active stage, pending gate, execution mode, and next safe action visible while planning.
- If saved plans already exist and `planId` is omitted, require a structured `add`, `revise`, or `replace` gate before drafting so multi-plan authoring stays explicit. An empty plan set may auto-assign the first slot without that gate.
- Load `references/plan-phase-runtime-contract.md` as the detailed runtime contract for stage mapping, MCP call control flow, anti-shallow artifact authoring, capability-gated subagent use, no-subagent fallback, validation repair, output quality, and completion criteria.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Invoke optional subagents only when the current command contract explicitly allows them and effective config has `workflow.subagents=true`; otherwise use the command's no-subagent fallback and state config disabled subagents.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful `plan-phase` intent while preserving Blueprint deltas:

- config-driven research and UI gates stay authoritative
- existing saved plans plus omitted `planId` require an explicit add/revise/replace choice, while empty plan sets and explicit add paths still support additive multi-plan authoring
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

## Workflow Rules

1. Resolve the target phase before drafting anything and stop if it cannot be inferred safely.
2. Treat `workflow.research`, `workflow.ui_phase`, `workflow.ui_safety_gate`, and `workflow.plan_check` from normalized effective config as the source of truth for planning gates.
3. Prefer `blueprint_phase_plan_readiness` as the compact read-only packet for the live `phase.plan` contract, `planningReadiness`, actual saved discovery summaries or bounded bodies, saved validation or review absence/presence signals, plan inventory, effective config, state, authoring context, and read-set freshness metadata. Use older individual read tools only when readiness reports omitted, truncated, stale, or user-requested details. Reuse `blueprint_phase_context.codebase` when the mapped codebase bundle is present.
4. Treat `blueprint_phase_plan_readiness.researchStatus.planningReadiness` or fallback `blueprint_phase_research_status.planningReadiness` as the config-aware handoff gate. If `readyForPlanPhase=false`, stop before drafting and route to `nextSafeAction`; report its blocker instead of guessing from raw missing-artifact lists. If research is enabled and missing or invalid, route to `/blu-research-phase` before finalizing the plan. Use saved research for unstable technical decisions instead of browsing live web docs during planning. Do not interpret `blueprint_phase_plan_authoring_context.taskSchema` for authoring until this readiness gate is satisfied.
5. If saved plans already exist and `planId` is omitted, require an explicit `add`, `revise`, or `replace` choice before drafting. `add` keeps multi-plan authoring supported while selecting a new slot, `revise` means choose an existing saved plan id before drafting, and `replace` requires explicit confirmation for a saved-plan-set replacement. If no saved plans exist and `planId` is omitted, proceed to the first auto-assigned slot without that gate. If a specific saved `planId` was passed, treat that as a targeted revise flow and confirm before overwriting.
6. Once readiness and any saved-plan add/revise/replace gate allow drafting, use the selected-slot `blueprint_phase_plan_authoring_context` returned by readiness when it matches the chosen slot and its read set is fresh; otherwise read `blueprint_phase_plan_authoring_context` for that slot. Use its `taskSchema` plus `contract.modelContract.schemaPath` as the phase.plan authoring authority.
7. Before any drafting or subagent invocation, build the Planning Investigation Trace from the completed Read-stage evidence so the draft is anchored in the live evidence inventory, planning signals, and compact summary.
8. When the phase needs multiple plans, carry a Planning Decision Record across drafting and revision passes so split rationale, execution order, deferred requirements, and revision-stable decisions stay explicit.
9. Use `blueprint-planner` to draft execution-ready structured plan models when suitable. If suitable planning agents are unavailable, use the stronger no-subagent fallback from `references/plan-phase-runtime-contract.md`.
10. Author a structured `phase.plan` JSON model against `blueprint_phase_plan_authoring_context.taskSchema`, then persist it through `blueprint_phase_plan_write` with `validationMode: "strict"`, `authoringMode: "model-only"`, `returnPlanSetValidation: true`, and `expectedReadSet` from the fresh readiness or authoring packet when skipping a duplicate pre-write re-read. Use `blueprint_phase_plan_validate_model` for dry-run previews, repair loops, or checker convergence rather than as a mandatory pre-write step. Refresh `blueprint_phase_plan_authoring_context` after any successful plan write, after a user pause or subagent return, or whenever read-set freshness is absent or stale because previously saved plan files become intentional known evidence artifacts for later plan slots; do not skip the refresh unless the server checked `expectedReadSet` for the write. Omit `planId` only when writing the first plan in an empty plan set or after an earlier explicit `add` choice selected a new slot, or pass only the numeric plan id when targeting a specific plan; use the JSON string value `planId: "01"` or numeric value `planId: 1`, never the double-encoded string `planId: "\"01\""`. When tasks, verification, or acceptance criteria depend on runtime state outside the repo, populate `externalServicePrerequisites` explicitly with generic prerequisite rows such as Docker or another container runtime, databases, queues, local daemons, cloud emulators, search services, auth sandboxes, or third-party SaaS test tenants. Do not send `content` from `/blu-plan-phase`, do not rely on scaffold text as the finished plan, and do not use Markdown fallback after validation fails.
11. Preserve the strict model-rendered heading set: `Goal`, `Scope`, `Tasks`, `External Service Prerequisites`, `Verification`, `Must Haves`, `Requirement Coverage`, `Evidence Coverage`, `File / Surface Coverage`, and `Unknowns And Deferrals`. Top-level `requirements` lists only requirements this plan covers now; `requirementCoverage` accounts for every known phase requirement exactly once as `covered`, `deferred`, or `irrelevant`. Treat `evidenceCoverage` as the current runtime-narrowed inventory, not a static list. Use an exact empty `externalServicePrerequisites: []` shape only when the plan truly has no external-service dependency.
12. When `workflow.plan_check=true`, run the bounded review loop from the runtime contract: use `blueprint-checker` when suitable, otherwise use the inline fallback. When `workflow.plan_check=false`, skip checker review entirely and state that the config disabled it.
13. Run the Post-Draft Semantic Self-Check before claiming completion. If any answer is `no`, repair the affected plan section before persistence or final completion.
14. Call `blueprint_phase_plan_validate` after the final write path and require its final `status` to be `valid` before synced state update or completion advances; do not infer completion from `blueprint_phase_plan_write.validation.valid` alone. If dry-run `blueprint_phase_plan_validate_model`, `blueprint_phase_plan_write`, or `blueprint_phase_plan_validate` reports invalid model content, repair all diagnostics against the live task schema and contract in one pass before retrying through MCP; never bypass validation with raw `.blueprint/` edits.
15. If a write succeeds but final scoped validation remains `invalid`, keep the saved plan as an incremental checkpoint, report the uncovered requirements or other issues, and do not claim final completion. Incomplete roadmap coverage may still be saved incrementally, but it is not final completion.
16. After persistence, prefer `blueprint_state_update` with `base: "synced"` only after final scoped validation is `valid`, so `STATE.md` recomputes the next safe action from the updated artifact inventory instead of leaving stale routing behind. Prefer `/blu-progress` as the default safe follow-up unless a later lifecycle command is clearly implemented.
17. Do not present planned-only lifecycle commands as runnable or as a guaranteed next step.

## Output Style

- Explain which gates were enabled or skipped because normalized config said so.
- Explain add, overwrite, replace, or revision risk before writes when saved plan bodies or plan-set intent would change.
- State whether the result is an incremental saved checkpoint or final completion.
- Include the Downstream Execution Handoff in the final response so execution
  inherits order, assumptions, evidence gaps, verification priorities,
  deferred items, and known risks.
- Keep the user anchored on the next safe implemented action after planning.

## Completion Self-Check

Before claiming completion, verify:

- `/blu-plan-phase` loaded `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md`, its `Completion Criteria` were satisfied, and no sibling command reference was treated as active input.
- Required reads and writes ran in the contract order through runtime FQNs, including phase locate, `phase.plan` contract, phase context, research readiness, saved artifact bodies, validation/review evidence when present, plan inventory/read when deciding add/revise/replace, effective config, post-gate authoring context or freshness-checked `expectedReadSet`, optional dry-run model validation when used, plan write, scoped validation, and synced state update only after final validation became valid.
- Persistence used only `mcp_blueprint_blueprint_phase_plan_write` with the structured model, `authoringMode: "model-only"`, and `validationMode: "strict"`; no raw `.blueprint/` writes, Markdown fallback, installed-extension edits, runtime file mutations, or unrelated Blueprint state changes occurred.
- MCP `status`, `written`, `created`, `updated`, `path`, validation diagnostics, warnings, and `reason` fields were treated as authoritative; rejected, invalid, partial, blocked, or skipped work was repaired through MCP or reported honestly.
- `ask_user` confirmation was satisfied before any saved-plan add/revise/replace choice, revising or replacing saved plan bodies, or replacing a saved plan set; auto-assigned plan ids were limited to the first empty-plan slot or an explicit prior `add` choice.
- Normalized config gates for research, UI, UI safety, and plan check matched the final behavior, and checker output or the inline fallback was resolved, deferred truthfully, or reported as a blocker.
- Final scoped plan validation reached `status: "valid"` before synced state update or completion claims; incremental saved checkpoints with incomplete roadmap coverage were reported honestly as not complete.
- Final routing named only implemented Blueprint commands, using `/blu-progress` when the safe next action was ambiguous or not implemented.
- The final response named the phase, plan ids and returned artifact paths or no-write status, gate decisions, whether the outcome was incremental or final, checker/validation result, warnings or blockers, the Downstream Execution Handoff, and the next safe implemented action.
