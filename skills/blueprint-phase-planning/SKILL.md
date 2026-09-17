---
name: blueprint-phase-planning
description: >
  Prepare grounded plan models, coordinate bounded review, and publish execution-ready
  phase plans through MCP without retaining rejected drafts.
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
Use `blueprint_plan_prepare` -> author/review -> `blueprint_plan_submit`.
Use `blueprint_plan_read` to view canonical plans and recovery metadata.

Prepare supplies phase resolution, effective config, evidence fingerprints,
readiness, saved-plan choices, compact schema, grounded example and validation
rules. Resolve essential gaps before generation. Do not repeat primitive state,
catalog, artifact or authoring-context reads on the normal path.
Use optional XX-SPEC.md when present; treat missing XX-SPEC.md as nonblocking.
Consume saved research instead of browsing. Read supplied evidence bodies when
summaries are insufficient, registering additional evidence through prepare.

The parent owns user gates, persistence and acceptance. Draft ordinary phases
inline; use blueprint-planner for bounded decomposition when useful. Give agents
the schema/example, evidence, constraints and complete model for review. Agents
stay read-only and must not call MCP persistence. Run blueprint-checker when
workflow.plan_check is enabled, or an explicit inline
review when that agent is unavailable; never claim an unavailable agent ran.

Submit the reviewed model directly. MCP normalizes formatting, derives mechanical
fields, validates the complete set in memory and publishes canonical plans.
Rejected documents are never stored; fix only diagnosed fields in conversation.
Recovery journals contain publication metadata only. No raw `.blueprint/` writes,
warn-mode publication or canonical Markdown fallback. Meet the runtime contract's
Completion Criteria and return its Downstream Execution Handoff.

## Runtime Call Rules

Translate any shorthand tool ids like `blueprint_plan_submit` to runtime FQNs,
such as `mcp_blueprint_blueprint_plan_submit`.
Treat Blueprint skills as loaded guidance, not callable tools.
Never run `/blu-*` in the shell.
