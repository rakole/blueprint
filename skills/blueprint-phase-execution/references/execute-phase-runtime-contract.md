# `/blu-execute-phase` Runtime Contract

This reference is the rich behavior contract for `/blu-execute-phase`. The
command manifest should stay thin; the skill should load this file when
executing saved plans so wave ordering, carry-forward evidence, and MCP-owned
summary persistence stay intact without importing `/blu-quick` or `/blu-fast`
detail.

Use `skills/blueprint-phase-execution/references/long-running-execution-profile.md`
for the shared stage vocabulary, in-flight status fields, and session-local
helper guidance.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_phase_locate` before execution.
- If the phase cannot be resolved, stop with the tool `reason`, recovery
  guidance, and `/blu-progress` as the safe implemented route.
- Keep the resolved phase number, active stage, pending gate, execution mode,
  and next safe action visible.

### Read

- Read `mcp_blueprint_blueprint_phase_plan_index`,
  `mcp_blueprint_blueprint_phase_summary_index`, and
  `mcp_blueprint_blueprint_phase_execution_targets` before any mutation.
- Read `mcp_blueprint_blueprint_config_get` with `scope: "effective"`,
  `mcp_blueprint_blueprint_artifact_validate`, and
  `mcp_blueprint_blueprint_state_load` so execution knows the normalized
  execution config, artifact health, and current routing truth before
  persistence.
- Read every selected plan through
  `mcp_blueprint_blueprint_phase_plan_read`.
- Read existing summaries for selected or overlapping plan ids through
  `mcp_blueprint_blueprint_phase_summary_read` before deciding whether to
  reuse, replace, or carry forward prior evidence.

### Decide

- Treat `mcp_blueprint_blueprint_phase_execution_targets` as the deterministic
  selection helper for default runs, `--wave`, and `--gaps-only`.
- Treat any lower-wave pending plan in `lowerWavePendingPlans` as an absolute
  blocker for later-wave work, including combined `--gaps-only --wave` runs.
- Treat `gapClosurePlans` from `mcp_blueprint_blueprint_phase_plan_index` as
  the source of truth for `--gaps-only`; do not infer gap closure from missing
  summaries alone.
- Existing valid summaries require explicit overwrite confirmation before
  replacement. Reuse is the default only when the summary is valid and marked
  `COMPLETED`.
- Treat malformed summaries as repair or replace targets, not reusable
  execution evidence.
- Treat valid `PARTIAL` and `BLOCKED` summaries as durable carry-forward
  evidence, but keep those plans pending.
- If no plans exist, route to `/blu-plan-phase`. If selected plans are stale,
  invalid, missing dependencies, or otherwise unreadable, stop and repair or
  re-plan before execution.

### Execute

- Respect normalized effective config when describing or delegating execution:
  - `parallelization.enabled`, `parallelization.plan_level`,
    `parallelization.max_concurrent_agents`, and
    `parallelization.min_plans_for_parallel` shape parallel versus sequential
    plan execution.
  - `workflow.use_worktrees` shapes whether execution should describe worktree
    isolation.
  - `git.branching_strategy` shapes whether execution stays on the current
    branch or uses branch-scoped guidance.
- Preserve wave order. Execute lower waves before higher waves.
- Use bounded `blueprint-executor` subagents only when selected plans have
  disjoint write ownership. Each executor prompt must name exactly one plan or
  one explicitly confirmed bounded batch, list write-owned files or surfaces,
  list read-first files, state isolation expectations, and require verification
  evidence plus a summary draft before returning.
- If subagents are unavailable, unreliable, disabled by config, or unsafe
  because of overlapping write ownership, fall back to one-plan-at-a-time
  inline execution.
- Interactive runs remain sequential and checkpointed. After each plan or major
  task group, ask whether to `review`, `skip`, `stop`, or `retry`.

### Persist

- Read `mcp_blueprint_blueprint_artifact_contract_read` with
  `artifactId: "phase.summary"` before drafting or replacing any summary, and
  use `contract.authoringTemplate` as the summary shape authority.
- Read `mcp_blueprint_blueprint_phase_summary_authoring_context` for the
  selected `planId` before final drafting. If it returns `status: "invalid"`,
  stop with the prerequisite blockers instead of inventing acceptance checks,
  dependency rows, plan provenance, or next actions.
- Author the structured `phase.summary` model against the returned
  `taskSchema`, then call `mcp_blueprint_blueprint_phase_summary_validate_model`
  and repair all diagnostics together before persistence. The task schema is
  the truth source for exact targeted verification rows, dependency-plan rows,
  status/readiness/completion consistency, sentinel rows, and allowed next
  actions.
- Persist one `XX-YY-SUMMARY.md` artifact per executed plan through
  `mcp_blueprint_blueprint_phase_summary_write`.
- Pass the resolved numeric `phase`, the numeric `planId` for the matching
  saved plan, and the same validated structured `model`. Do not pass Markdown
  `content`.
- The matching plan must already exist before the summary write.
- Treat the returned `path` and `linkedPlanPath` as authoritative instead of
  rebuilding summary filenames manually.
- Do not pass summary filenames, phase directories, slugs, combined tokens
  such as `03-01`, or model-owned path/provenance fields where the tool expects
  `planId`.
- Do not persist execute-phase reports. `/blu-execute-phase` writes summaries
  plus synced state only.

### Validate

- Before any summary write, confirm the selected goal, acceptance criteria,
  dependency order, and any code-review, regression, or schema-drift warnings
  surfaced by validation or state reads. These are pre-persistence gates.
- Run the target plan's required checks before claiming completion. Repair only
  issues caused by the current changes, cap repeated repair attempts, and write
  `PARTIAL` or `BLOCKED` summaries when verification cannot pass honestly.
- Do not persist `COMPLETED` summaries while required tests fail, lower-wave
  blockers remain, or acceptance criteria are unverified.
- After summary writes finish, rerun
  `mcp_blueprint_blueprint_phase_summary_index`, then
  `mcp_blueprint_blueprint_artifact_validate`, and finally
  `mcp_blueprint_blueprint_state_update` with `base: "synced"`. These are the
  post-execution checks.
- State updates must stay truthful about pending plans, lower-wave debt,
  partial summaries, blocked summaries, failed tests, and filtered or
  gap-closure runs. Do not mark the whole phase complete from partial coverage.

### Route

- Do not make a phase-level completion claim from `/blu-execute-phase`. That
  waits for the `/blu-validate-phase` handoff.
- `/blu-verify-work` remains the verifier follow-up once validation evidence
  exists.
- Route only to implemented commands. Prefer `/blu-progress` when the natural
  next step is ambiguous.

## Conflict And Ownership Rules

- Compare selected plans' `files_modified`, generated artifacts, read-first
  surfaces, and other shared write surfaces before dispatch.
- If selected plans overlap on a shared file set, run sequentially or pause for
  explicit confirmation instead of assuming the write is safe.
- Parallel execution is allowed only for disjoint write ownership. Overlap is a
  planning defect to call out, not a reason to bluff safety.

## Durable Carry-Forward Rules

- Checkpoints must be grounded in the latest persisted summary state rather
  than a dedicated execute-phase checkpoint file.
- After each plan or major task group, capture completed work, current task,
  blocker or pending gate, verification status, and next safe action from the
  latest persisted summary.
- Summary-backed carry-forward evidence is the only durable execute-phase
  continuation record. Do not keep an unbounded in-memory narrative as the
  sole continuation state.

## No-Subagent Fallback

When suitable execution agents are unavailable, continue sequentially:

1. Compress the read context into a carry-forward note containing the selected
   plan ids, wave order, overlap or blocker notes, config-driven execution
   mode, acceptance criteria, and current uncertainties.
2. Execute one plan or one confirmed major task group at a time.
3. Run the plan's targeted verification and bounded repair loop.
4. Persist the resulting summary through MCP.
5. Use the latest persisted summary, including valid `PARTIAL` or `BLOCKED`
   status when present, as the durable checkpoint before moving to the next
   plan.
6. Stop or ask for review when the next plan is blocked by overlap, lower-wave
   debt, repeated verification failure, or user choice.

## Completion Criteria

- `blueprint_phase_execution_targets` was used for deterministic plan
  selection.
- Lower-wave blockers remained absolute.
- Selected plans were read before execution, and stale or invalid plans were
  not executed.
- The canonical `phase.summary` contract was read before summary authoring or
  replacement.
- The summary authoring context and model validator were used before every new
  summary write.
- One summary per executed plan was persisted only through
  `mcp_blueprint_blueprint_phase_summary_write`.
- Valid `PARTIAL` and `BLOCKED` summaries remained pending carry-forward
  evidence.
- Post-write summary indexing, artifact validation, and synced state refresh
  ran in that order.
- The final response names the executed plans or waves, whether summaries were
  created, reused, replaced, partial, or blocked, any config or blocker notes,
  and the next safe implemented action.
