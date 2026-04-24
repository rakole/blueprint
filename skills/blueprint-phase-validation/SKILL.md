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

## Shared Visibility Contract

- Execution profile for `validate-phase`, `verify-work`, and the long-running parts of `add-tests`: `long-running-mutation`
- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- For `add-tests`, keep the selected test scope, targeted test command or result, verification status, report status, and next safe action explicit while bounded repo mutation is in flight.
- For structured interactive choices, confirmations, review, skip, or stop branching, or short clarifications, prefer Gemini CLI's built-in `ask_user` tool over plain assistant prose.
- When a validation-family run is non-trivial, keep those status fields visible with `update_topic`, `write_todos`, or an honest prose fallback rather than inventing persistence outside MCP.
- Keep validation saved-summary-first: the `Execute` stage is bounded verifier analysis grounded in saved summaries and existing validation artifacts, not direct repo mutation or prompt-memory reconstruction. For `add-tests`, bounded repo mutation stays grounded in saved summaries plus validation evidence, and the resulting verification plus report status must come from MCP returns.

## Required Inputs

- `skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md`
- `skills/blueprint-phase-validation/references/verify-work-runtime-contract.md`
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
- `blueprint_artifact_contract_read`
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
- `blueprint_artifact_contract_read`: read canonical authoring templates and validation metadata by contract id such as `phase.verification` or `phase.uat` instead of relying on copied prompt-local templates.
- `blueprint_artifact_report_write`: pass a bare report name such as `add-tests-3`, not `.blueprint/reports/add-tests-3.md`. Use the returned `path` as authoritative.
- `blueprint_artifact_validate`: run after every validation or UAT write so the persisted artifact is checked before the next state update is written.

## Canonical Validation Contracts

- For `XX-VERIFICATION.md`, use `blueprint_artifact_contract_read` with `artifactId: "phase.verification"` and normalize the final draft to the returned `authoringTemplate`.
- For `XX-UAT.md`, use `blueprint_artifact_contract_read` with `artifactId: "phase.uat"` and normalize the final draft to the returned `authoringTemplate`.
- Keep each contract's locked markers and required section names unchanged.
- Keep summary references in the contract-defined evidence sections.
- Allow extra top-level headings only when the contract policy says they are supported.

## Workflow Rules

### `validate-phase`

1. Resolve the target phase and require execution summaries before validation begins.
2. Read summary index and relevant summary artifacts first so validation is grounded in the saved execution evidence.
3. Keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the resolved scope, pending gate, execution mode, and next safe action legible throughout the run.
4. Inspect any existing `XX-VERIFICATION.md` before proposing replacement and default to reuse unless the user explicitly asks for an update. When the saved artifact would change, keep the overwrite confirmation gate explicit instead of treating replacement as the default.
5. Respect `workflow.verifier` and `workflow.nyquist_validation` from normalized effective config when describing validation depth and coverage expectations.
6. Apply the State A/B/C model from `references/validate-phase-runtime-contract.md`: existing verification is an audit baseline, missing verification plus completed summaries is reconstruction, and missing completed summaries stops without writing.
7. Build an explicit requirement/task coverage map before authoring. Include reviewed summaries, completed and pending plan ids, requirement or task ids, cited implementation or artifact surfaces, test or evidence metadata, coverage state (`PASS`, `MANUAL`, `DEFERRED`, `BLOCKED`), and gap class.
8. Use `blueprint-verifier` to assess coverage, gaps, and repair suggestions against the saved summaries only when the suitable Blueprint verifier is available and `workflow.verifier=true`.
9. When the verifier is unavailable or disabled, use the no-subagent fallback from the runtime contract: read one completed summary at a time, extract evidence, compress each summary into carry-forward rows, classify gaps, and draft from the final map.
10. Never substitute browser, web-search-only, shell-only, or generic agents for codebase or workflow validation analysis.
11. Keep the validation pass saved-summary-first: `Execute` means bounded validation analysis over saved summaries plus any existing verification artifact, not direct repo mutation or fabrication from chat history.
12. Normalize the final validation draft to the canonical `phase.verification` authoring template before calling `blueprint_phase_validation_write`. Keep summary filenames or paths in the contract-defined evidence section, keep all required section names unchanged, fill every richer evidence section, and self-check the normalized draft against the returned contract before writing.
13. If `blueprint_phase_validation_write` returns `status: "invalid"` or post-write `blueprint_artifact_validate` reports validation failures, repair the draft against the canonical contract and retry once before stopping with explicit issues and suggested repairs.
14. Persist finished validation evidence through `blueprint_phase_validation_write` with the `verification` artifact, and use the returned `summaryPaths` plus `written` or `status` to report whether the evidence was newly saved, preserved unchanged, or rejected as invalid.
15. Update `STATE.md` with the validation result and the next safe implemented action. Route valid ready-for-UAT verification to `/blu-verify-work <phase>`, route explicit test-generation gaps to `/blu-add-tests <phase>` only when that command is implemented and the artifact states the need, and route PARTIAL or BLOCKED verification back to `/blu-validate-phase <phase>` for repair.

### `verify-work`

1. Resolve the target phase and require both execution summaries and a `XX-VERIFICATION.md` artifact that is valid and ready for UAT before UAT begins. If the verification is valid but not ready, route back to `/blu-validate-phase <phase>` for repair.
2. Read summary index, summary artifacts, and any existing validation or UAT artifact so conversational UAT is grounded in saved execution evidence.
3. Keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the resolved scope, pending gate, execution mode, and next safe action legible throughout the run.
4. Inspect any existing `XX-UAT.md` before proposing replacement and default to resume or reuse unless the user explicitly asks for an update.
5. Respect `workflow.verifier` and `workflow.nyquist_validation` from normalized effective config when describing the UAT pass and any remaining acceptance gaps.
6. Load `references/verify-work-runtime-contract.md` and follow it for UAT test queue construction, response classification, artifact authoring, verifier use, no-subagent fallback, retry behavior, and output quality.
7. Build a concrete user-observable test queue from saved summaries and ready verification evidence before asking the user anything. Include expected behavior, saved evidence, current result, and notes for each test. Prepend a cold-start smoke test when saved summary evidence touches startup, server or CLI entrypoints, database, seed, migration, Docker, or first-run surfaces.
8. Present one expected behavior at a time. Classify plain user responses as `pass`, `skipped`, `blocked`, or `issue`; infer issue severity from the user's words; preserve verbatim issue text; keep blocked prerequisites separate from code gaps; and append structured gap rows for issues.
9. Use `blueprint-verifier` to capture conversational UAT evidence, test rows, result counts, structured gaps, unresolved blockers, and optional follow-up fix notes when a suitable Blueprint verifier is available and `workflow.verifier=true`.
10. When the verifier is unavailable or disabled, use the no-subagent fallback from the runtime contract: read one completed summary at a time, compress carry-forward test rows, build the queue, run one UAT prompt at a time, classify responses, and draft from the final queue, counts, gaps, and checkpoint state.
11. Never substitute browser, web-search-only, shell-only, or generic agents for codebase or workflow UAT analysis.
12. Keep non-trivial conversational UAT sequential and checkpointed: after each major evidence block or question group, surface progress and ask the user whether to `review`, `skip`, or `stop` before continuing.
13. `review` means summarize the current checkpoint, observed behavior, result counts, and unresolved gaps before proceeding. `skip` means keep the skipped area explicit in the resumable UAT body and move to the next bounded step. `stop` means persist the current checkpoint and leave the next safe action on `/blu-verify-work <phase>` unless a missing prerequisite routes elsewhere.
14. Normalize the final UAT draft to the canonical `phase.uat` authoring template before calling `blueprint_phase_validation_write`. Keep summary filenames or paths inside the contract-defined summary-aware sections, keep all required section names unchanged, keep the contract-owned `**Resume State:**` and `**Checkpoint:**` markers current, and include current test state, test matrix, result counts, structured gaps, blocked prerequisites, and follow-up fix candidates.
15. Self-check the normalized draft against the returned contract before writing, then persist finished UAT evidence through `blueprint_phase_validation_write` with the `uat` artifact. Use the returned `summaryPaths` plus `written` or `status` to report whether the evidence was newly saved, preserved unchanged, or rejected as invalid.
16. If `blueprint_phase_validation_write` returns `status: "invalid"` or post-write `blueprint_artifact_validate` reports validation failures, repair the draft against the canonical contract and retry once before stopping with explicit issues and suggested repairs.
17. Keep follow-up fixes explicit in the same artifact or in a clearly signposted state update, and confirm any follow-up-fix capture before persisting it.
18. Run `blueprint_artifact_validate` after the write and before `STATE.md` is updated.
19. Update `STATE.md` with the UAT result and the next safe implemented action.

### `add-tests`

1. Resolve the target phase and require saved execution summaries before generating or updating tests.
2. Read summary artifacts plus any existing `XX-VERIFICATION.md` or `XX-UAT.md` so test generation is grounded in saved implementation evidence and explicit gaps.
3. Require at least one validation or UAT artifact before proceeding. Route to `/blu-validate-phase` when both are missing.
4. Keep repo mutation narrow: honor explicit user scope first, otherwise derive a focused test scope from completed summaries, saved gaps, and existing repo test conventions.
5. Keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the resolved scope, selected test scope, pending gate, execution mode, targeted test command or result, verification status, report status, and next safe action legible throughout the run.
6. Treat broad test-scope confirmation, any broader-suite request, unclear repo test conventions, and verification or report persistence outcomes as explicit pending gates rather than post-hoc notes.
7. For non-trivial add-tests runs, prefer update_topic plus `write_todos` so evidence review, scope confirmation, bounded implementation, targeted test execution, verification-note persistence, report persistence, post-write validation, and routing stay visible without becoming persistence.
8. Use `ask_user` for structured scope or breadth decisions instead of burying those gates in prose.
9. Inspect the relevant repo code, existing tests, and test-runner configuration before writing. Prefer extending nearby tests over duplicating the same coverage in a second suite.
10. Use `blueprint-executor` for bounded multi-file test implementation when the harness or write scope is non-trivial.
11. Use `blueprint-verifier` to review whether the proposed tests cover the saved execution behavior and any explicit validation or UAT gaps.
12. Read `blueprint_artifact_contract_read` for `phase.verification`, normalize the final verification draft to `contract.authoringTemplate`, and self-check the normalized verification draft against the returned contract before persisting verification notes.
13. Persist updated verification notes through `blueprint_phase_validation_write` with the `verification` artifact and preserve the existing artifact as the baseline when it already exists. Keep the reported verification status aligned with the tool-owned `written` and `status` result.
14. Persist the durable non-phase report through `blueprint_artifact_report_write` using the bare canonical `add-tests-<phase>` report naming pattern, not a `.blueprint/reports/...` path. Keep the reported report status aligned with the tool-owned `written` and `status` result.
15. Update `STATE.md` with the test-generation result and the next safe implemented action. Prefer `/blu-code-review <phase>` when review evidence is still missing, otherwise fall back to `/blu-progress`.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from validation commands.
- Do not invent or switch test frameworks when the repo has no clear test convention.
- Do not present planned-only lifecycle commands as runnable just because they are documented.
