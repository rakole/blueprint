---
name: blueprint-roadmap-admin
description: >
  Roadmap append, milestone audits, and future roadmap or milestone mutations
  for Blueprint project state. Use this skill to keep roadmap changes
  deterministic, evidence-backed, and MCP-owned.
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
- `blueprint_artifact_list`
- `blueprint_roadmap_remove_phase`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`
- `blueprint_phase_summary_index`
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

### `remove-phase`

1. Require an explicit phase number before any mutation.
2. Read the roadmap first and stop with recovery guidance if the roadmap is missing or malformed.
3. Read the target phase artifacts before mutation so drift or execution evidence is visible in the preview.
4. Require explicit confirmation before deleting the target phase and renumbering subsequent phases.
5. Persist the roadmap mutation through `blueprint_roadmap_remove_phase`; do not rewrite `.blueprint/ROADMAP.md` or rename phase directories directly from the command prompt.
6. Treat the future-phase guard as mandatory and reject targets that already have execution evidence such as `SUMMARY`, `VERIFICATION`, or `UAT` artifacts.
7. Update `STATE.md` through `blueprint_state_update` so `/blu:remove-phase` is the active command and the next safe implemented follow-up is `/blu:progress`.
8. Keep follow-up routing inside implemented Blueprint commands only.

### `audit-milestone`

1. Read the roadmap before making milestone claims or writing milestone reports.
2. Keep milestone audits grounded in saved roadmap and phase evidence instead of chat memory.
3. Require explicit overwrite confirmation before replacing an existing milestone audit report.
4. Use `blueprint_artifact_summary_digest` with explicit milestone artifact paths when the command needs a compact roadmap-plus-evidence digest.
5. Use `blueprint-verifier` when a second-pass evidence review helps explain gaps or stale assumptions.
6. Keep milestone report output project-local in `.blueprint/reports/` through `blueprint_artifact_report_write`.
7. If the audit surfaces actionable gaps and `plan-milestone-gaps` is implemented, route the follow-up there; otherwise treat planned-only milestone follow-up commands as unavailable.

### `plan-milestone-gaps`

1. Read the roadmap first and then inspect `.blueprint/reports/` through `blueprint_artifact_list` so the command stays grounded in the latest milestone audit instead of chat memory.
2. Fail fast when the matching milestone audit report is missing or when the audit contains no actionable gaps.
3. Use `blueprint_artifact_summary_digest` with explicit roadmap-plus-audit inputs to build a compact evidence view before proposing any new phases.
4. Preserve the upstream gap-closure intent by grouping related requirement, integration, and flow gaps into a few coherent roadmap phases rather than adding one phase per gap.
5. Keep the grouping reviewable: show which gaps each proposed phase closes and separate optional nice-to-have gaps from must-close work.
6. Require one explicit confirmation before any roadmap mutation.
7. Append each approved gap-closure phase through repeated `blueprint_roadmap_add_phase` calls; do not rewrite `.blueprint/ROADMAP.md` directly from the command prompt.
8. Update `STATE.md` through `blueprint_state_update` so the first new gap-closure phase becomes current and the next safe implemented follow-up is `/blu:discuss-phase <phase>`.
9. Keep follow-up routing inside implemented Blueprint commands only.

## Output Style

- For `add-phase`, report the new phase number and description plainly, mention the scaffolded phase path and any reuse warnings, and end with the next safe implemented action.
- For `plan-milestone-gaps`, show the grouped gap-closure phases compactly, call out any deferred optional gaps, and end with the first safe implemented follow-up.
- For `remove-phase`, report the removed phase plainly, summarize any renumbered phases or drift warnings, and end with the next safe implemented action.
- For `plan-milestone-gaps`, show the grouped gap-closure phases compactly, call out any deferred optional gaps, and end with the first safe implemented follow-up.
- For `audit-milestone`, call out the original milestone intent, the evidence that confirms or weakens it, any gaps, and the next safe implemented action.
