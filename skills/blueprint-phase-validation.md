---
name: blueprint-phase-validation
status: implemented
commands:
  - /blu:validate-phase
  - /blu:verify-work
---

# Blueprint Phase Validation Skill

## Purpose

Orchestrate Blueprint's post-execution validation and conversational UAT flow so completed phase summaries are audited, durable validation artifacts are persisted through MCP, and follow-up routing stays inside the implemented Blueprint surface.

## Parity Goal

Carry forward the useful upstream validation intent while preserving Blueprint deltas:

- execution summaries remain the source of truth for what was actually delivered
- validation and UAT stay Gemini-native and MCP-owned instead of script-owned
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
- saved `XX-YY-SUMMARY.md` artifacts for the target phase

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_phase_summary_index`
- `blueprint_phase_summary_read`
- `blueprint_phase_validation_read`
- `blueprint_phase_validation_write`
- `blueprint_config_get`
- `blueprint_artifact_validate`
- `blueprint_state_load`
- `blueprint_state_update`

## Optional Agents

- `blueprint-verifier`

## Workflow Rules

### `validate-phase`

1. Resolve the target phase and require execution summaries before validation begins.
2. Read summary index and relevant summary artifacts first so validation is grounded in the saved execution evidence.
3. Inspect any existing `XX-VERIFICATION.md` before proposing replacement and default to reuse unless the user explicitly asks for an update.
4. Respect `workflow.verifier` and `workflow.nyquist_validation` from normalized effective config when describing validation depth and coverage expectations.
5. Use `blueprint-verifier` to assess coverage, gaps, and repair suggestions against the saved summaries.
6. Persist finished validation evidence through `blueprint_phase_validation_write` with the `verification` artifact.
7. Update `STATE.md` with the validation result and the next safe implemented action. Prefer `/blu:verify-work`, and fall back to `/blu:progress` only if runtime availability changes.

### `verify-work`

1. Resolve the target phase and require both execution summaries and a `XX-VERIFICATION.md` artifact before UAT begins.
2. Read summary index, summary artifacts, and any existing validation or UAT artifact so conversational UAT is grounded in saved execution evidence.
3. Inspect any existing `XX-UAT.md` before proposing replacement and default to resume or reuse unless the user explicitly asks for an update.
4. Respect `workflow.verifier` and `workflow.nyquist_validation` from normalized effective config when describing the UAT pass and any remaining acceptance gaps.
5. Use `blueprint-verifier` to capture conversational UAT evidence, unresolved gaps, and optional follow-up fix notes.
6. Persist finished UAT evidence through `blueprint_phase_validation_write` with the `uat` artifact.
7. Keep follow-up fixes explicit in the same artifact or in a clearly signposted state update.
8. Update `STATE.md` with the UAT result and the next safe implemented action.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from validation commands.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
