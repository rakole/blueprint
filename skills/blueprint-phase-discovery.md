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
- `blueprint_phase_artifact_read`
- `blueprint_phase_artifact_write`
- `blueprint_phase_checkpoint_get`
- `blueprint_phase_checkpoint_put`
- `blueprint_phase_checkpoint_delete`
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
2. Read effective config and honor `workflow.discuss_mode`, `workflow.skip_discuss`, and `workflow.research_before_questions`.
3. Load existing context, discussion log, and any saved checkpoint before starting a replacement path.
4. Use `blueprint_artifact_scaffold` only to seed missing files; persist real context content through `blueprint_phase_artifact_write`.
5. Write `XX-DISCUSSION-LOG.md` only when durable notes add value beyond the main context artifact.
6. Persist a checkpoint during long discovery flows and delete it after successful context capture.
7. Require explicit overwrite confirmation before replacing existing substantive context artifacts.
8. End with a next safe action inside the implemented Blueprint surface.

### `research-phase`

1. Confirm phase readiness with `blueprint_phase_context` and `blueprint_phase_research_status`.
2. Read any existing `XX-RESEARCH.md` before proposing replacement.
3. Use `blueprint_artifact_scaffold` only to seed a missing research file; persist substantive research through `blueprint_phase_artifact_write`.
4. Require explicit overwrite confirmation before replacing existing research.
5. If UI discovery is clearly next and `/blu:ui-phase` is already available, route there. Otherwise route toward `/blu:progress`.
6. Keep the research branch read-heavy and phase-scoped; do not mutate unrelated repo files.

### `ui-phase`

1. Inspect effective config through `blueprint_config_get`.
2. Respect `workflow.ui_phase` and `workflow.ui_safety_gate`.
3. Read any existing `XX-UI-SPEC.md` before proposing replacement.
4. Use `XX-UI-SPEC.md` as the single durable output for both a real UI contract and an explicit skip rationale.
5. Use `blueprint_artifact_scaffold` only to seed a missing UI spec; persist substantive output through `blueprint_phase_artifact_write`.
6. Require explicit overwrite confirmation before replacing an existing UI spec.
7. When UI work is intentionally skipped, record the rationale in `XX-UI-SPEC.md` instead of inventing a second file.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from discovery commands.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
- Do not claim upstream-style power mode, chain mode, or auto-advance behavior unless that runtime path truly exists.
