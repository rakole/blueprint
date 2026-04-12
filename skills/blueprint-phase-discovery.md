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
- `docs/commands/list-phase-assumptions.md`
- `docs/commands/research-phase.md`
- `docs/commands/ui-phase.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/DRIFT.MD`

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_phase_context`
- `blueprint_roadmap_read`
- `blueprint_project_status`
- `blueprint_phase_research_status`
- `blueprint_phase_artifact_read`
- `blueprint_phase_artifact_write`
- `blueprint_phase_checkpoint_get`
- `blueprint_phase_checkpoint_put`
- `blueprint_phase_checkpoint_delete`
- `blueprint_artifact_list`
- `blueprint_command_catalog`
- `blueprint_state_load`
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
2. Read any existing `XX-RESEARCH.md` through `blueprint_phase_artifact_read` before proposing replacement and force an explicit `view`, `skip`, or `update` decision when research already exists.
3. Use `blueprint_artifact_scaffold` only to seed a missing research file.
4. Use `blueprint-researcher` for bounded sidecar research when the artifact needs to be created or updated.
5. Persist only validated research content through `blueprint_phase_artifact_write`; do not leave `research-phase` with a scaffold-only placeholder.
6. Require explicit overwrite confirmation before replacing existing research.
7. Use `blueprint_command_catalog` before recommending `/blu:ui-phase`; otherwise route toward `/blu:progress`.
8. Keep the research branch read-heavy and phase-scoped; do not mutate unrelated repo files.

### `list-phase-assumptions`

1. Resolve the phase through `blueprint_phase_locate`; omitted phase input may be inferred from state or roadmap, but an explicit invalid phase must fail clearly.
2. Read `blueprint_project_status`, `blueprint_roadmap_read`, and `blueprint_phase_context` before presenting any assumptions so the answer stays grounded in actual repo readiness, roadmap intent, and saved discovery artifacts.
3. Keep the command read-only. Do not scaffold, write, repair, or update `.blueprint/` artifacts from this flow.
4. Surface assumptions across the five required areas: technical approach, implementation order, scope boundaries, risk areas, and dependencies.
5. Mark uncertainty explicitly instead of overstating confidence; use evidence-first language when context is thin or missing.
6. If the requested phase cannot be resolved, report the exact failure reason and list valid roadmap phases instead of guessing a substitute.
7. When deeper technical context would materially improve the summary, `blueprint-researcher` may be used as a bounded read-only sidecar, but the command still ends with conversational output only.
8. End by inviting corrections and keeping any next-step suggestion inside the implemented Blueprint surface.

### `ui-phase`

1. Inspect effective config through `blueprint_config_get`.
2. Respect `workflow.ui_phase` and `workflow.ui_safety_gate`.
3. Use `XX-UI-SPEC.md` as the single durable output for both a real UI contract and an explicit skip rationale.
4. Require explicit overwrite confirmation before replacing an existing UI spec.
5. When UI work is intentionally skipped, record the rationale in `XX-UI-SPEC.md` instead of inventing a second file.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from discovery commands.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
