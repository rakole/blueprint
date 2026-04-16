---
name: blueprint-phase-validation
description: >
  Verification, UAT, tests, and gap closure for Blueprint lifecycle work. Use
  this skill to validate summary-backed execution evidence, run resumable UAT,
  and keep follow-up fixes explicit and MCP-owned.
status: implemented
commands:
  - /blu-validate-phase
  - /blu-verify-work
  - /blu-add-tests
---

# Blueprint Phase Validation Skill

## Purpose

Orchestrate Blueprint's post-execution validation, conversational UAT, and evidence-backed test-generation flow so completed phase summaries are audited, durable validation artifacts are persisted through MCP, and follow-up routing stays inside the implemented Blueprint surface.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful validation intent while preserving Blueprint deltas:

- execution summaries remain the source of truth for what was actually delivered
- validation and UAT stay host-native and MCP-owned instead of script-owned
- conversational UAT is resumable through `XX-UAT.md`
- test generation stays grounded in saved summaries plus validation or UAT evidence
- follow-up fixes stay explicit instead of hidden in prompt-only prose
- persistent writes remain phase-scoped inside `.blueprint/`
- follow-up routing stays inside the implemented Blueprint surface

## Required Inputs

- `docs/commands/validate-phase.md`
- `docs/commands/verify-work.md`
- `docs/commands/add-tests.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/PHASE-LIFECYCLE.md`
- saved `XX-YY-SUMMARY.md` artifacts for the target phase

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_phase_summary_index`
- `blueprint_phase_summary_read`
- `blueprint_phase_validation_read`
- `blueprint_phase_validation_write`
- `blueprint_artifact_list`
- `blueprint_config_get`
- `blueprint_artifact_validate`
- `blueprint_artifact_report_write`
- `blueprint_state_load`
- `blueprint_state_update`

## Optional Agents

- `blueprint-verifier`
- `blueprint-executor`

## Shared MCP Contracts

- `blueprint_phase_locate`: pass only a numeric phase reference when the command provides one, or omit `phase` for state or roadmap inference. Never pass phase directories or filenames.
- `blueprint_phase_validation_write`: pass numeric `phase`, artifact enum `verification` or `uat`, and full artifact content. Both validation modes require saved summaries, and `uat` also requires an existing verification artifact. Use returned `path`, `summaryPaths`, `written`, and `status` as authoritative. Only describe the artifact as persisted when `written` is `true`; report `reused` or `invalid` outcomes explicitly.
- `blueprint_artifact_report_write`: pass a bare report name such as `add-tests-3`, not `.blueprint/reports/add-tests-3.md`. Use the returned `path` as authoritative.

## Workflow Rules

### `validate-phase`

1. Resolve the target phase and require execution summaries before validation begins.
2. Read summary index and relevant summary artifacts first so validation is grounded in the saved execution evidence.
3. Inspect any existing `XX-VERIFICATION.md` before proposing replacement and default to reuse unless the user explicitly asks for an update.
4. Respect `workflow.verifier` and `workflow.nyquist_validation` from normalized effective config when describing validation depth and coverage expectations.
5. Use `blueprint-verifier` to assess coverage, gaps, and repair suggestions against the saved summaries.
6. Persist finished validation evidence through `blueprint_phase_validation_write` with the `verification` artifact, and use the returned `summaryPaths` plus `written` or `status` to report whether the evidence was newly saved, preserved unchanged, or rejected as invalid.
7. Update `STATE.md` with the validation result and the next safe implemented action. Prefer `/blu-verify-work`, and fall back to `/blu-progress` only if runtime availability changes.

### `verify-work`

1. Resolve the target phase and require both execution summaries and a `XX-VERIFICATION.md` artifact before UAT begins.
2. Read summary index, summary artifacts, and any existing validation or UAT artifact so conversational UAT is grounded in saved execution evidence.
3. Inspect any existing `XX-UAT.md` before proposing replacement and default to resume or reuse unless the user explicitly asks for an update.
4. Respect `workflow.verifier` and `workflow.nyquist_validation` from normalized effective config when describing the UAT pass and any remaining acceptance gaps.
5. Use `blueprint-verifier` to capture conversational UAT evidence, unresolved gaps, and optional follow-up fix notes.
6. Persist finished UAT evidence through `blueprint_phase_validation_write` with the `uat` artifact, and use the returned `summaryPaths` plus `written` or `status` to report whether the evidence was newly saved, preserved unchanged, or rejected as invalid.
7. Keep follow-up fixes explicit in the same artifact or in a clearly signposted state update.
8. Update `STATE.md` with the UAT result and the next safe implemented action.

### `add-tests`

1. Resolve the target phase and require saved execution summaries before generating or updating tests.
2. Read summary artifacts plus any existing `XX-VERIFICATION.md` or `XX-UAT.md` so test generation is grounded in saved implementation evidence and explicit gaps.
3. Require at least one validation or UAT artifact before proceeding. Route to `/blu-validate-phase` when both are missing.
4. Keep repo mutation narrow: honor explicit user scope first, otherwise derive a focused test scope from completed summaries, saved gaps, and existing repo test conventions.
5. Inspect the relevant repo code, existing tests, and test-runner configuration before writing. Prefer extending nearby tests over duplicating the same coverage in a second suite.
6. Use `blueprint-executor` for bounded multi-file test implementation when the harness or write scope is non-trivial.
7. Use `blueprint-verifier` to review whether the proposed tests cover the saved execution behavior and any explicit validation or UAT gaps.
8. Persist updated verification notes through `blueprint_phase_validation_write` with the `verification` artifact and preserve the existing artifact as the baseline when it already exists.
9. Persist the durable non-phase report through `blueprint_artifact_report_write` using the bare canonical `add-tests-<phase>` report naming pattern, not a `.blueprint/reports/...` path.
10. Update `STATE.md` with the test-generation result and the next safe implemented action. Prefer `/blu-code-review <phase>` when review evidence is still missing, otherwise fall back to `/blu-progress`.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from validation commands.
- Do not invent or switch test frameworks when the repo has no clear test convention.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
