---
name: blueprint-phase-validation
status: implemented
commands:
  - /blu:validate-phase
---

# Blueprint Phase Validation Skill

## Purpose

Orchestrate Blueprint's post-execution validation flow so completed phase summaries are audited, durable `XX-VERIFICATION.md` evidence is persisted through MCP, and follow-up routing stays inside the implemented Blueprint surface.

## Parity Goal

Carry forward the useful upstream `validate-phase` intent while preserving Blueprint deltas:

- validation stays Gemini-native and MCP-owned instead of script-owned
- execution summaries remain the source of truth for what was actually delivered
- one durable verification artifact is written per validated phase
- missing validation evidence can be reconstructed from saved summary artifacts
- follow-up routing stays inside the implemented Blueprint surface until `verify-work` actually ships

## Required Inputs

- `docs/commands/validate-phase.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/DRIFT.MD`
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

1. Resolve the target phase before validating anything and stop if the phase cannot be inferred safely.
2. Treat saved execution summaries as the validation source of truth; if no summaries exist yet, route back to `/blu:execute-phase`.
3. Read the saved summaries before drafting conclusions so the verification artifact reflects durable execution evidence rather than chat memory.
4. Existing `XX-VERIFICATION.md` artifacts are audit baselines, not throwaway drafts. Reuse is the default and overwrite requires explicit confirmation.
5. Respect `workflow.verifier` and `workflow.nyquist_validation` from normalized effective config when describing the audit depth and coverage expectations.
6. Use `blueprint-verifier` for bounded gap analysis instead of collapsing the whole audit into a vague summary.
7. Persist verification evidence through `blueprint_phase_validation_write`; do not write raw verification files directly.
8. After validation writes, refresh artifact health and update `STATE.md` so the next safe implemented action stays accurate.
9. Prefer `/blu:progress` as the safe follow-up until `verify-work` is genuinely implemented.
10. Do not present planned-only lifecycle commands as runnable or guaranteed next steps.

## Output Style

- Explain whether the validation artifact was newly reconstructed, reused, or revised.
- Explain how many execution summaries were audited and what evidence they covered.
- Call out any remaining validation gaps or follow-up recommendations explicitly.
- Keep the user anchored on the next safe implemented action after validation.
