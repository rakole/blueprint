---
name: blueprint-phase-planning
description: >
  Preserve plan-set drafts, coordinate bounded review, and publish execution-ready
  phase plans through MCP-owned durable planning sessions.
status: implemented
commands:
  - /blu-plan-phase
input_bundles:
  shared: []
  commands:
    "/blu-plan-phase":
      - skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md
---

# Blueprint Phase Planning

Load `references/plan-phase-runtime-contract.md` for the active planning contract.
Use `blueprint_plan_prepare` -> `blueprint_plan_submit` -> `blueprint_plan_finalize`.
Use `blueprint_plan_read` for viewing or recovery.

Prepare supplies phase resolution, effective config, evidence fingerprints,
readiness, saved-plan choices and one compact candidate schema. Do not repeat
primitive state, catalog, artifact or authoring-context reads on the normal path.
Use optional XX-SPEC.md when present; treat missing XX-SPEC.md as nonblocking.
Consume saved research instead of browsing. Read supplied evidence bodies when
summaries are insufficient, registering additional evidence through prepare.

The parent owns user gates, persistence and acceptance. Draft ordinary phases
inline; use blueprint-planner for bounded decomposition when useful. Give agents
compact packets containing the schema, evidence paths/excerpts, constraints and
candidate revision. Agents stay read-only and must not call MCP persistence.
Run blueprint-checker when workflow.plan_check is enabled, or an explicit inline
review when that agent is unavailable; never claim an unavailable agent ran.

Submit preserves original candidates before validation. Repair only affected
fields against the saved revision; prior work and history remain recoverable.
Finalizer owns strict full-set validation, publication, state synchronization and
implemented routing. No raw `.blueprint/` writes, warn-mode publication or
canonical Markdown fallback. Meet the runtime contract's Completion Criteria
and return its Downstream Execution Handoff.

## Runtime Call Rules

Translate any shorthand tool ids like `blueprint_plan_submit` to runtime FQNs,
such as `mcp_blueprint_blueprint_plan_submit`.
Treat Blueprint skills as loaded guidance, not callable tools.
Never run `/blu-*` in the shell.
