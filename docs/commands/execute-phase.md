# `/blu-execute-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Detailed Draw.io workflow: [`docs/diagrams/execute-phase-workflow-end-to-end.drawio`](../diagrams/execute-phase-workflow-end-to-end.drawio)
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
- `gapClosurePlans` from `blueprint_phase_plan_index` is the source of truth
  for `--gaps-only`.
- Any lower-wave pending plan in `lowerWavePendingPlans` blocks later-wave
  work, including combined `--gaps-only --wave` requests.
- Existing summary files only count as completed evidence when validation
  passes. Valid `PARTIAL` and `BLOCKED` summaries remain truthful carry-forward
  evidence and keep the plan pending.
- Invalid or stale saved plans are not executable.

## Execution Gates

- Pre-persistence gates: read the selected plan index, summary index,
  execution-target helper, effective config, canonical summary contract,
  artifact validation state, and phase state before any summary write.
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
- `.blueprint/STATE.md`
- selected phase plan files through MCP reads
- selected phase summary files through MCP reads
- `phase.summary` canonical authoring contract through MCP reads before summary
  creation or replacement

## Blueprint And Global State Writes

- `one or more XX-YY-SUMMARY.md files`
- `.blueprint/STATE.md` when the next-step signal changes

## Required MCP Tools

- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans, gapClosurePlans}`
- `blueprint_phase_execution_targets` -> `{pendingPlanIds, candidatePlanIds, selectedPlanIds, lowerWavePendingPlans, overwriteCandidatePlanIds, overlapPlanIds, blockers, conflicts, warnings}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_summary_authoring_context` -> `{status, phase, planId, path, linkedPlanPath, plan, existing, dependencyPlans, acceptanceCriteria, allowedNextActions, schemaPath, baseSchema, taskSchema, prerequisiteBlockers, warnings}`
- `blueprint_phase_summary_validate_model` -> `{status, valid, phase, planId, path, linkedPlanPath, schemaPath, taskSchema, diagnostics, diagnosticCounts, normalizedModel, renderPreview, warnings}`
- `blueprint_phase_summary_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, linkedPlanPath, written, created, overwritten, status, issues, warnings}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}` or `{artifactId: null, contracts}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Summary Persistence Contract

- Persist execution evidence through `blueprint_phase_summary_write`; do not
  write raw `XX-YY-SUMMARY.md` files directly.
- Pass `phase` as the resolved numeric phase reference and `planId` as the
  numeric id of the matching saved plan.
- Read `blueprint_phase_summary_authoring_context` before final summary
  drafting so the exact acceptance criteria, dependency plan rows, linked plan
  provenance, summary path, allowed next actions, `schemaPath`, base schema,
  and narrowed `taskSchema` are explicit.
- Validate the structured `phase.summary` model through
  `blueprint_phase_summary_validate_model`; repair all diagnostics together
  and persist the same model through `blueprint_phase_summary_write`.
- New summary writes are model-only. Markdown content fallback is rejected by
  the writer, while existing Markdown summaries may still be read and indexed
  for compatibility.
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
- Treats `gaps-only` as a real gap-closure mode backed by `gapClosurePlans`
  metadata rather than a synonym for "plans without summaries".
- Uses `blueprint_state_update` with `base: "synced"` after summary
  persistence so `STATE.md` follows refreshed summary truth instead of stale
  stored state.

## Test Cases

- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Parallelization and worktree-isolation fixture.
- Wave-filtered direct `execute-phase` happy-path fixture.
