---
name: blueprint-roadmap-admin
status: implemented
commands:
  - /blu:add-phase
  - /blu:insert-phase
  - /blu:remove-phase
  - /blu:plan-milestone-gaps
  - /blu:audit-milestone
  - /blu:complete-milestone
  - /blu:milestone-summary
  - /blu:new-milestone
---

# Blueprint Roadmap Admin Skill

## Purpose

Orchestrate Blueprint roadmap and milestone management flows so phase mutations, milestone evidence, and archival decisions stay aligned with durable project state.

## Parity Goal

Carry forward the useful upstream roadmap and milestone intent while preserving Blueprint's Gemini-native boundaries:

- roadmap reads happen before roadmap or milestone mutations
- new phases require an explicit description and deterministic numbering
- milestone audits compare original intent against saved phase evidence
- milestone reports stay durable and project-local in `.blueprint/reports/`
- follow-up routing stays inside the implemented Blueprint surface
- persistent writes remain scoped to `.blueprint/`

## Required Inputs

- `docs/commands/add-phase.md`
- `docs/commands/insert-phase.md`
- `docs/commands/remove-phase.md`
- `docs/commands/plan-milestone-gaps.md`
- `docs/commands/audit-milestone.md`
- `docs/commands/complete-milestone.md`
- `docs/commands/milestone-summary.md`
- `docs/commands/new-milestone.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/GSD-RUNTIME-MIGRATION.md`

## Required MCP Tools

- `blueprint_roadmap_read`
- `blueprint_roadmap_add_phase`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`
- `blueprint_phase_summary_index`
- `blueprint_artifact_list`
- `blueprint_artifact_summary_digest`
- `blueprint_artifact_report_write`

## Optional Agents

- `blueprint-roadmapper`
- `blueprint-verifier`

## Workflow Rules

### `add-phase`

1. Require a non-empty phase description before any mutation.
2. Read the roadmap first and stop with recovery guidance if the roadmap is missing or malformed.
3. Require explicit confirmation before appending the phase.
4. Choose the next phase number from the highest base phase number already present in the roadmap and ignore decimal suffixes when counting.
5. Persist the roadmap mutation through `blueprint_roadmap_add_phase`; do not rewrite `.blueprint/ROADMAP.md` directly from the command prompt.
6. Scaffold the new phase directory through `blueprint_artifact_scaffold` by seeding the initial `XX-CONTEXT.md` file.
7. Update `STATE.md` through `blueprint_state_update` so the new phase becomes current and the next safe implemented follow-up is `/blu:discuss-phase <phase>`.
8. Keep follow-up routing inside implemented Blueprint commands only.

### `audit-milestone`

1. Read the roadmap before making milestone claims or writing milestone reports.
2. Keep milestone audits grounded in saved roadmap and phase evidence instead of chat memory.
3. Require explicit overwrite confirmation before replacing an existing milestone audit report.
4. Use `blueprint_artifact_summary_digest` with explicit milestone artifact paths when the command needs a compact roadmap-plus-evidence digest.
5. Use `blueprint-verifier` when a second-pass evidence review helps explain gaps or stale assumptions.
6. Keep milestone report output project-local in `.blueprint/reports/` through `blueprint_artifact_report_write`.
7. Treat planned-only milestone follow-up commands as unavailable until their runtime catalog entry is implemented.

## Output Style

- For `add-phase`, report the new phase number and description plainly, mention the scaffolded phase path and any reuse warnings, and end with the next safe implemented action.
- For `audit-milestone`, call out the original milestone intent, the evidence that confirms or weakens it, any gaps, and the next safe implemented action.
