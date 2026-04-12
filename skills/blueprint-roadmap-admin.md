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

Orchestrate Blueprint's roadmap and milestone management flows so milestone evidence, roadmap intent, and archival decisions stay aligned with durable project state.

## Parity Goal

Carry forward the useful upstream milestone-management intent while preserving Blueprint's roadmap and milestone boundaries:

- roadmap reads happen before milestone mutations
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

## Required MCP Tools

- `blueprint_roadmap_read`
- `blueprint_phase_summary_index`
- `blueprint_artifact_list`
- `blueprint_artifact_summary_digest`
- `blueprint_artifact_report_write`

## Optional Agents

- `blueprint-roadmapper`
- `blueprint-verifier`

## Workflow Rules

1. Read the roadmap before making milestone claims or writing milestone reports.
2. Keep milestone audits grounded in saved roadmap and phase evidence instead of chat memory.
3. Require explicit overwrite confirmation before replacing an existing milestone audit report.
4. Use `blueprint_artifact_summary_digest` with explicit milestone artifact paths when the command needs a compact roadmap-plus-evidence digest.
5. Use `blueprint-verifier` when a second-pass evidence review helps explain gaps or stale assumptions.
6. Keep milestone report output project-local in `.blueprint/reports/` through `blueprint_artifact_report_write`.
7. Treat planned-only milestone follow-up commands as unavailable until their runtime catalog entry is implemented.

## Output Style

- Call out the original milestone intent and the evidence that confirms or weakens it.
- Explain any gaps before proposing the next safe action.
- Keep the user anchored on the next implemented Blueprint step when no milestone follow-up is available.
