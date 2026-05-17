# `/blu-execute-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`,
  `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate,
  execution mode, next safe action
- `execute-phase` uses the shared long-running-mutation posture and the
  execution-family skill bundle. The rich runtime contract lives in
  `skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md`.
- For long-running execution, use Gemini CLI's internal `update_topic` plus
  `write_todos` only as session-local visibility helpers.

## Purpose

`execute-phase` is Blueprint's command for executing saved plans in wave-aware
order, persisting one summary per executed plan, and routing from refreshed
state without claiming phase completion on its own.

## Command Path And Examples

- CLI command path: `/blu-execute-phase`
- Root router form: `/blu execute-phase`
- Argument hint: `<phase-number> [--wave N] [--gaps-only] [--interactive]`
- `/blu-execute-phase 3 --wave 2`
- `/blu execute-phase`

## Inputs, Project State, And Prerequisite Artifacts

- At least one valid plan must already exist for the selected phase.
- `--wave`, `--gaps-only`, and `--interactive` are honored when present.
- `blueprint_phase_execution_targets` is the deterministic selection helper for
  default runs plus `--wave` and `--gaps-only`.
- `externalServicePreflight` from `blueprint_phase_execution_targets` is the
  deterministic preflight packet for saved plan prerequisites the agent cannot
  safely assume are ready, such as container runtimes, databases, queues,
  emulators, local API servers, search services, caches, brokers, auth
  sandboxes, or third-party SaaS test tenants.
- `blueprint_phase_execution_targets` is the common-path authority for default
  runs, `--wave`, and `--gaps-only`; `--gaps-only` uses that helper's selected
  target set instead of a separate `gapClosurePlans` reread.
- Any lower-wave pending plan in `lowerWavePendingPlans` blocks later-wave
  work, including combined `--gaps-only --wave` requests.
- Existing summary files only count as completed evidence when validation
  passes. Valid `PARTIAL` and `BLOCKED` summaries remain truthful carry-forward
  evidence and keep the plan pending.
- Invalid or stale saved plans are not executable.

## Execution Gates

- Pre-persistence gates: read `blueprint_phase_execution_targets`, effective
  config, and the canonical `phase.summary` contract before any summary write.
  Treat `blueprint_phase_execution_targets` as the common metadata and
  target-selection authority for default runs plus `--wave` and `--gaps-only`;
  selected plan bodies are read only after target selection.
- Conditional body inspection: call `blueprint_phase_summary_read` only when
  selected or overlapping plan ids need existing summary-body inspection to
  decide reuse, replacement, or carry-forward handling.
- Non-default pre-write reads: `blueprint_artifact_validate` and
  `blueprint_state_load` stay in the allowlist for conditional health or
  routing inspection, but they are not default pre-write reads for summary
  authoring; `blueprint_phase_summary_index` belongs to the post-write
  sequence.
- External-service gates: when selected plans declare blocking external-service
  prerequisites and `safety.always_confirm_external_services` is enabled,
  confirm readiness before meaningful execution. If confirmation is granted,
  rerun `blueprint_phase_execution_targets` with
  `externalServiceConfirmed: true`; otherwise stop without entering execution.
- Ownership gates: parallel executor agents are allowed only for disjoint
  write ownership; overlapping plan surfaces force sequential execution or
  explicit confirmation.
- Verification gates: run targeted acceptance checks before writing a
  `COMPLETED` summary. Failed checks trigger bounded repair attempts and then a
  `PARTIAL` or `BLOCKED` summary when needed.
- Post-execution checks: rerun the summary index, run artifact validation, and
  then call `blueprint_state_update` with `base: "synced"`.
- Verifier handoff: `/blu-execute-phase` records execution coverage but never
  makes a phase-level completion claim on its own; the downstream
  `/blu-validate-phase` handoff is required before any completion claim, and
  `/blu-verify-work` remains the next lifecycle step once validation evidence
  exists.

For detailed sequencing, overwrite behavior, carry-forward checkpoint rules,
and no-subagent fallback behavior, read the rich runtime contract in
`skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md`.

## Outputs

- User-facing result: a concise completion summary, truthful checkpoint
  evidence, and the next safe implemented action.
- Repo side effects: writes one or more phase summaries plus `.blueprint/STATE.md`.
- `/blu-execute-phase` does not persist reports.

## Blueprint And Global State Reads

- `.blueprint/config.json`
- selected phase plan files through MCP reads
- selected phase summary files through MCP reads only when existing summary
  bodies need inspection for reuse, replacement, or carry-forward decisions
- `phase.summary` canonical authoring contract through MCP reads before summary
  creation or replacement
- `.blueprint/STATE.md` only when conditional routing inspection needs
  `blueprint_state_load`

## Blueprint And Global State Writes

- `one or more XX-YY-SUMMARY.md files`
- `.blueprint/STATE.md` when the next-step signal changes

## Required MCP Tools

- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans, gapClosurePlans}`
- `blueprint_phase_execution_targets` -> `{pendingPlanIds, candidatePlanIds, selectedPlanIds, lowerWavePendingPlans, overwriteCandidatePlanIds, overlapPlanIds, externalServicePreflight, blockers, conflicts, warnings}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}` (conditional existing-summary body inspection only)
- `blueprint_phase_summary_authoring_context` -> `{status, phase, planId, path, linkedPlanPath, plan, existing, dependencyPlans, acceptanceCriteria, allowedNextActions, schemaPath, baseSchema, taskSchema, prerequisiteBlockers, warnings}`
- `blueprint_phase_summary_validate_model` -> `{status, valid, phase, planId, path, linkedPlanPath, schemaPath, taskSchema, diagnostics, diagnosticCounts, normalizedModel, renderPreview, warnings}`
- `blueprint_phase_summary_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, linkedPlanPath, written, created, overwritten, status, issues, warnings}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}` or `{artifactId: null, contracts}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}` (allowlisted for conditional inspection and post-write validation; not a default pre-write read)
- `blueprint_state_load` -> `{state, blockers, derivedStatus}` (allowlisted for conditional routing inspection; not a default pre-write read)
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Summary Persistence Contract

- Persist execution evidence through `blueprint_phase_summary_write`; do not
  write raw `XX-YY-SUMMARY.md` files directly.
- Pass `phase` as the resolved numeric phase reference and `planId` as the
  numeric id of the matching saved plan.
- Read `blueprint_phase_summary_authoring_context` before final summary
  drafting so acceptance criteria, dependency plan rows, linked plan
  provenance, summary path, and allowed next actions are explicit.
- The `phase.summary` authoring template is a safe `PARTIAL` carry-forward seed;
  switch it to `COMPLETED` only after concrete execution evidence and targeted
  verification pass.
- Validate Markdown summary `content` through
  `blueprint_phase_summary_validate_model`; repair semantic diagnostics
  together and persist the same Markdown content through
  `blueprint_phase_summary_write`.
- New summary writes are Markdown-first and must include an explicit `Status`
  marker. Heading shape, casing, and optional section drift are warnings, not
  validation blockers; warning-only Markdown shape, sentinel, or style advice
  does not require another repair loop when summary truth is otherwise valid.
- The matching `XX-YY-PLAN.md` must already exist before a summary can be
  written.
- Treat the returned `path` plus `linkedPlanPath` as authoritative instead of
  rebuilding summary filenames manually.
- Do not pass summary filenames, phase slugs, phase directories, combined
  tokens such as `03-01`, or model-owned path/provenance fields where the tool
  expects `planId`.
- `COMPLETED` is the only summary status that closes execution debt. `PARTIAL`
  and `BLOCKED` remain pending carry-forward evidence.
- Truth table: `COMPLETED` closes the selected plan's execution debt and
  requires completion state `complete`, passing targeted verification rows, and
  exact `none` sentinel rows for manual/deferred work and gaps. It uses
  `not-ready-for-validation` plus `/blu-execute-phase <phase>` while other
  phase plans remain pending, and `ready-for-validation` plus
  `/blu-validate-phase <phase>` only when no phase plans remain pending.
  `PARTIAL` requires `not-ready-for-validation`, completion state `pending`,
  at least one non-pass targeted verification row, a concrete open repair
  route, and `/blu-execute-phase <phase>`. `BLOCKED` requires `blocked`,
  completion state `blocked`, at least one blocked repair route, and
  `/blu-progress`.
- If dependency summaries, failed verification, or blocked prerequisites prevent
  `COMPLETED`, downgrade to `PARTIAL` or `BLOCKED`, update Readiness,
  Completion State, Next Safe Action, Verification, Gap / Repair Routes, and
  Follow-Ups together, and keep the open repair route explicit.

## Skills And Subagents

- Primary skill: `blueprint-phase-execution`
- Optional subagents:
- `blueprint-executor`

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/plan-phase.md`
- `docs/commands/validate-phase.md`
- `docs/commands/verify-work.md`

## External Shell Or Git Dependencies

- External dependencies:
- git

## Shell Risk Profile

- High: drives real repo mutation during implementation.

## User Prompts And Confirmation Gates

- Confirm branch or wave-specific execution details before starting.
- In interactive mode, prefer `ask_user` for overwrite confirmation,
  sequential execution checkpoints, and review/skip/stop choices.
- Respect normalized config for `parallelization.*`,
  `workflow.use_worktrees`, and `git.branching_strategy`.
- If later-wave work is selected while lower-wave plans remain pending, stop
  and report the lower-wave gap explicitly.
- If saved plans declare blocking external-service prerequisites, stop before
  meaningful execution until readiness is confirmed. When a required service
  becomes unavailable after work starts, write truthful `PARTIAL` or `BLOCKED`
  execution evidence and keep the next safe action on `/blu-execute-phase` or
  `/blu-progress` rather than handing off to validation.

## Edge Cases

- The target phase is omitted or ambiguous while multiple active phases exist.
- Expected prior artifacts exist but are stale, incomplete, or inconsistent
  with `ROADMAP.md`.

## Failure Modes And Recovery

- Explain exactly which phase artifact is missing and which command creates it.
- Write follow-up state back into `.blueprint/` instead of dropping context on
  failure.
- If config forces sequential execution or disables worktree isolation, explain
  that behavior explicitly instead of implying an execution failure.
- If the plan set reveals a lower-wave gap, treat execution as partial and do
  not imply full phase completion.

## Acceptance Criteria

- Reads and writes only the selected phase scope.
- Updates `STATE.md` whenever the next-step signal changes.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes, including the
  plan read and summary read/write tools.
- Uses `blueprint_phase_execution_targets` for deterministic execute-phase
  target selection, lower-wave blocking, overwrite candidates, and overlap
  warnings.
- Honors normalized `parallelization.*`, `workflow.use_worktrees`, and
  `git.branching_strategy` from effective config.
- Treats `gaps-only` as a real gap-closure mode selected through
  `blueprint_phase_execution_targets`, preserving saved gap-closure intent
  rather than treating it as a synonym for "plans without summaries".
- Uses `blueprint_state_update` with `base: "synced"` after summary
  persistence so `STATE.md` follows refreshed summary truth instead of stale
  stored state.

## Test Cases

- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Parallelization and worktree-isolation fixture.
- Wave-filtered direct `execute-phase` happy-path fixture.
