---
name: blueprint-phase-validation
status: implemented
commands:
  - /blu:validate-phase
  - /blu:verify-work
---

# Blueprint Phase Validation Skill

## Purpose

Orchestrate Blueprint's validation and conversational UAT flow so phase-scoped verification evidence stays durable, resumable, and summary-aware.

## Parity Goal

Carry forward the useful upstream validation intent while preserving Blueprint deltas:

- validation is evidence-first and reads execution summaries before writing new phase state
- conversational UAT is resumable through `XX-UAT.md`
- follow-up fixes stay explicit instead of hidden in prompt-only prose
- persistent writes remain phase-scoped inside `.blueprint/`
- follow-up routing stays inside the implemented Blueprint surface

## Required Inputs

- `docs/commands/validate-phase.md`
- `docs/commands/verify-work.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/GSD-RUNTIME-MIGRATION.md`
- `docs/PHASE-LIFECYCLE.md`

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_phase_context`
- `blueprint_phase_summary_index`
- `blueprint_phase_summary_read`
- `blueprint_phase_artifact_read`
- `blueprint_phase_artifact_write`
- `blueprint_artifact_scaffold`
- `blueprint_artifact_list`
- `blueprint_artifact_validate`
- `blueprint_state_load`
- `blueprint_state_update`
- `blueprint_command_catalog`

## Optional Agents

- `blueprint-verifier`

## Workflow Rules

### `validate-phase`

1. Resolve the target phase and require execution summaries before validation begins.
2. Read summary index and relevant summary artifacts first so validation is grounded in the saved execution evidence.
3. Inspect any existing `XX-VERIFICATION.md` before proposing replacement and default to reuse unless the user explicitly asks for an update.
4. Use `blueprint_artifact_scaffold` only to seed a missing verification file.
5. Use `blueprint-verifier` to assess coverage, gaps, and repair suggestions against the saved summaries.
6. Persist finished validation evidence through `blueprint_phase_artifact_write` with the `verification` artifact.
7. Update `STATE.md` with the validation result and the next safe implemented action.

### `verify-work`

1. Resolve the target phase and require execution summaries before UAT begins.
2. Read summary index and relevant summary artifacts first so conversational UAT is grounded in the saved execution evidence.
3. Inspect any existing `XX-UAT.md` before proposing replacement and default to resume or reuse unless the user explicitly asks for an update.
4. Use `blueprint_artifact_scaffold` only to seed a missing UAT file.
5. Use `blueprint-verifier` to capture conversational UAT evidence, unresolved gaps, and optional follow-up fix notes.
6. Persist finished UAT evidence through `blueprint_phase_artifact_write` with the `uat` artifact.
7. Keep follow-up fixes explicit in the same artifact or in a clearly signposted state update.
8. Update `STATE.md` with the UAT result and the next safe implemented action.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from validation commands.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
