# `/blu-validate-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `validate-phase` uses the shared long-running-mutation posture: resolve the target phase, read every completed saved execution summary plus any existing verification artifact, decide whether validation can reuse or revise the current artifact, execute bounded verifier analysis, persist through MCP, validate the saved artifact, and route to the next safe implemented follow-up.
- Keep the saved-summary-first contract explicit throughout the run: execution summaries are the validation baseline, overwrite confirmation is the pending gate when an existing `XX-VERIFICATION.md` would change, and the next safe action stays on `/blu-validate-phase <phase>` only until the saved verification artifact is either ready for `/blu-verify-work` or truthfully routes to an implemented repair command.
- Detailed runtime reference: `skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md`. Keep the manifest and skill thin, and treat that reference as the canonical source for the State A/B/C model, coverage-map rules, verifier fallback, retry behavior, and final routing details.

## Purpose


`validate-phase` is Blueprint's command for auditing completed phase execution and persisting durable, summary-backed verification evidence in `XX-VERIFICATION.md`. It is implemented as a host-native validation contract: it reads saved execution summaries first (not chat memory), normalizes the verification draft against the canonical `phase.verification` authoring template, persists the artifact through validation MCP tools, and keeps `verify-work` as the next safe implemented step when validation succeeds. Nyquist-style test-gap closure is handled separately via `/blu-add-tests`.


## Command Path And Examples

- CLI command path: `/blu-validate-phase`
- Root router form: `/blu validate-phase`
- Argument hint: `[phase number]`
- `/blu-validate-phase 3`
- `/blu validate-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must already have execution evidence.
- Use the runtime contract's State A/B/C model to decide whether validation reuses an existing artifact, reconstructs one from saved summaries, or stops without writing.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: writes `XX-VERIFICATION.md` through MCP and updates `.blueprint/STATE.md`.
- In-flight validation should keep the resolved scope, active stage, pending gate, execution mode, and next safe action legible while the run is still live.

## In-Flight Progress Contract

- For non-trivial validation runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact validation checklist with `write_todos`.
- Keep that visible progress aligned to the selected scope, current stage, pending gate, execution mode, and next safe action as the run moves from target resolution through saved-summary review, verifier analysis, persistence, post-write validation, and routing.
- Treat `update_topic` and `write_todos` as session-local coordination only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.


## Blueprint And Global State Reads


- effective Blueprint config through `blueprint_config_get`
- execution summaries through `blueprint_phase_summary_index` and `blueprint_phase_summary_read`
- existing validation artifacts through `blueprint_phase_validation_read`
- canonical authoring templates and required-tool derivation through `blueprint_artifact_contract_read`


## Blueprint And Global State Writes


- `phase XX-VERIFICATION.md`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, reason}`
- `blueprint_phase_validation_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, summaryPaths, reason}`
- `blueprint_phase_validation_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, summaryPaths, written, created, overwritten, status, issues, warnings}`
- `blueprint_artifact_contract_read` -> `{id, canonicalName, scaffoldTemplate, authoringTemplate, requiredHeadings, lockedMarkers, freehandPolicy, notes}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Validation Persistence Contract

- Persist verification evidence through `blueprint_phase_validation_write`; do not write raw validation files directly.
- Pass `phase` as the resolved numeric phase reference and use only the validation artifact enums that the tool owns: `verification` or `uat`.
- Validation writes require saved execution summaries. Treat the returned `summaryPaths` as the authoritative evidence set that backed the saved artifact.
- Read the canonical contract through `blueprint_artifact_contract_read` with `artifactId: "phase.verification"` before final normalization.
- Normalize the final verification draft to the returned `authoringTemplate`, keep the locked markers and required section names unchanged, cite every completed saved summary under `## Evidence Reviewed`, and self-check the normalized draft against the returned contract before calling `blueprint_phase_validation_write`.
- Build the concrete requirement/task coverage map, verifier behavior, no-subagent fallback, and retry path from the detailed runtime reference instead of duplicating that step-by-step contract in this doc.
- For `/blu-validate-phase`, write `artifact: "verification"` and treat the returned `path` as the authoritative saved filename.
- `uat` writes are a separate flow and additionally require an existing `XX-VERIFICATION.md` artifact before persistence succeeds.
- If `blueprint_phase_validation_write` returns `status: "invalid"`, repair the draft against the canonical contract and retry once before stopping with explicit issues and suggested repairs. Run post-write `blueprint_artifact_validate` and `blueprint_state_update` only after a successful write or reuse outcome.
- Only route the next safe action to `/blu-verify-work` when the saved artifact says `Gate State: PASS`, readiness is ready for UAT, and no unresolved gap or repair signals remain. When the saved artifact makes test-generation gaps the main remaining follow-up, route to `/blu-add-tests <phase>`; when implementation or behavior gaps remain, route to `/blu-audit-fix <phase>` instead of coercing the gate to PASS or looping back through validation.
- Prefer `blueprint_state_update` with `base: "synced"` plus `patch.activeCommand: "/blu-validate-phase"` after persistence so `STATE.md` derives the next safe action from the updated artifact inventory without losing the active validation command.


## Skills And Subagents


- Primary skill: `blueprint-phase-validation`
- Required local reference: `skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md`
- Optional subagents:
- `blueprint-verifier`
- Use the optional verifier only when a suitable Blueprint code/workflow-analysis agent is available and `workflow.verifier=true`.
- If the verifier is unavailable or disabled, use the sequential no-subagent fallback from the local runtime contract: read one completed summary at a time, extract evidence, compress carry-forward rows, classify gaps, and draft from the final map.
- Do not substitute browser, web-search-only, shell-only, or generic agents for validation analysis.


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/execute-phase.md`
- `docs/commands/verify-work.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: writes summary-aware verification evidence and updates follow-up state.

## User Prompts And Confirmation Gates


- Confirm any overwrite before replacing an existing `XX-VERIFICATION.md` artifact; prefer Gemini CLI `ask_user` for that gate.


## Edge Cases


- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent with `ROADMAP.md`.


## Failure Modes And Recovery


- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on failure.


## Acceptance Criteria


- Reads and writes only the selected phase scope.
- Reads every completed execution summary and any existing validation artifact before replacement.
- Classifies State A/B/C and stops cleanly without writing when completed summaries are missing.
- Produces a requirement/task coverage map with evidence metadata, manual-only or deferred coverage, gap classification, and repair guidance.
- Uses a capability-gated `blueprint-verifier` path or the explicit sequential no-subagent fallback.
- Repairs and retries invalid verification writes or post-write validation failures once before stopping with issues.
- Keeps verification stages, pending gates, and the next safe action explicit while validation is in flight.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Persists verification evidence through `blueprint_phase_validation_write` rather than direct file writes.
- Leaves unrelated repo files untouched.


## Test Cases


- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `validate-phase` happy-path fixture.
