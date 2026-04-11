---
name: blueprint-phase-discovery
status: implemented
commands:
  - /blu:discuss-phase
  - /blu:research-phase
  - /blu:ui-phase
  - /blu:list-phase-assumptions
---

# Blueprint Phase Discovery Skill

## Purpose

Orchestrate Blueprint's pre-planning discovery flow with deterministic MCP-owned phase artifacts.

## Parity Goal

Carry forward the useful discovery intent from upstream GSD while preserving Blueprint deltas:

- persistent writes stay inside `.blueprint/`
- commands stay thin and user-facing
- MCP tools own state mutation
- later chaining and power-mode variants stay deferred until the downstream lifecycle substrate exists

## Required Inputs

- `docs/commands/discuss-phase.md`
- `docs/commands/research-phase.md`
- `docs/commands/ui-phase.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_phase_context`
- `blueprint_roadmap_read`
- `blueprint_phase_research_status`
- `blueprint_artifact_list`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`
- `blueprint_config_get`

## Optional Agents

- `blueprint-researcher`
- `blueprint-ui-designer`

## Workflow Rules

### `discuss-phase`

1. Resolve the phase through MCP tools before asking the user to confirm any write path.
2. Write `XX-CONTEXT.md` through `blueprint_artifact_scaffold`.
3. Write `XX-DISCUSSION-LOG.md` only when durable notes add value beyond the main context artifact.
4. Require explicit overwrite confirmation before replacing existing context artifacts.
5. End with a next safe action inside the implemented Blueprint surface.

### `research-phase`

1. Confirm phase readiness with `blueprint_phase_context` and `blueprint_phase_research_status`.
2. Write only `XX-RESEARCH.md` through `blueprint_artifact_scaffold`.
3. Require explicit overwrite confirmation before replacing existing research.
4. If UI discovery is clearly next and `/blu:ui-phase` is already available, route there. Otherwise route toward `/blu:progress`.
5. Keep the research branch read-heavy and phase-scoped; do not mutate unrelated repo files.

### `ui-phase`

1. Inspect effective config through `blueprint_config_get`.
2. Respect `workflow.ui_phase` and `workflow.ui_safety_gate`.
3. Use `XX-UI-SPEC.md` as the single durable output for both a real UI contract and an explicit skip rationale.
4. Require explicit overwrite confirmation before replacing an existing UI spec.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from discovery commands.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
