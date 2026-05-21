# `/blu-execute-phase` Runtime Contract

This reference is the rich behavior contract for `/blu-execute-phase`. The
command manifest should stay thin; the skill should load this file when
executing saved plans so wave ordering, carry-forward evidence, and MCP-owned
summary persistence stay intact without importing `/blu-quick` or `/blu-fast`
detail.

Use `skills/blueprint-phase-execution/references/long-running-execution-profile.md`
for the shared stage vocabulary, in-flight status fields, and session-local
helper guidance.

## Visible Execution Progress

For non-trivial runs, keep progress visible through short boundary updates.
Gemini-native progress helpers are presentation mirrors only. They do not
expand the MCP tool allowlist, persistence authority, executor authority,
verification authority, state-sync authority, routing authority, or user
confirmation authority defined by this contract.

Visible execution stages:

| Step | User-visible wording | Shared stage | Required visibility |
|------|----------------------|--------------|---------------------|
| 1 | resolve execution phase | Resolve | selected phase, phase directory, or recovery blocker |
| 2 | select executable targets | Read | selected plans, lower-wave blockers, gap-only scope, existing summaries, conflicts, and external-service preflight |
| 3 | confirm execution mode | Decide | overwrite posture, overlap posture, external-service confirmation gate, parallel/sequential mode, and subagent/fallback mode |
| 4 | execute selected plan work | Execute | active plan or task group, write ownership, verification target, blocker, and repair attempt count |
| 5 | write execution summary | Persist | summary path/status, `COMPLETED`/`PARTIAL`/`BLOCKED` truth state, linked plan, and durable carry-forward evidence |
| 6 | run post-execution checks | Validate | summary index, artifact validation result, failed checks, lower-wave debt, partial/blocked status, and state-sync readiness |
| 7 | sync state and route | Route | state-sync result, implemented next action, remaining execution debt, and validation handoff posture |

Progress updates must be short boundary updates. Emit exceptional updates for
missing or stale plans, lower-wave blockers, external-service waits, overwrite
waits, overlapping write ownership, executor unavailable or unsafe fallback,
verification repair, failed checks requiring `PARTIAL` or `BLOCKED`,
summary-validation repair, post-write artifact-validation failure, state-sync
failure, ambiguous routing, and completion.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_phase_locate` before execution.
- If the phase cannot be resolved, stop with the tool `reason`, recovery
  guidance, and `/blu-progress` as the safe implemented route.
- Keep the resolved phase number, active stage, pending gate, execution mode,
  and next safe action visible.

### Read

- Read `mcp_blueprint_blueprint_phase_execution_targets` before any mutation.
- Read `mcp_blueprint_blueprint_config_get` with `scope: "effective"` so
  execution knows the normalized execution config before persistence.
- Treat `mcp_blueprint_blueprint_phase_execution_targets` as the common
  pre-write metadata authority for selected plans, existing summaries,
  blockers, conflicts, overlap detection, and gap-only routing.
- Read every selected plan through
  `mcp_blueprint_blueprint_phase_plan_read`.
- Read existing summaries for selected or overlapping plan ids through
  `mcp_blueprint_blueprint_phase_summary_read` only when existing summary body
  text is needed to decide whether to overwrite, repair, or carry forward
  prior evidence.
- Do not make pre-write `mcp_blueprint_blueprint_artifact_validate` or
  `mcp_blueprint_blueprint_state_load` part of the common read path. Keep the
  post-write `summary_index -> artifact_validate -> state_update(base:
  "synced")` sequence unchanged.

### Decide

- Treat `mcp_blueprint_blueprint_phase_execution_targets` as the deterministic
  selection helper for default runs, `--wave`, and `--gaps-only`.
- Treat `mcp_blueprint_blueprint_phase_execution_targets.externalServicePreflight`
  as the deterministic packet for saved external service prerequisites.
- Treat the returned selected plan set, existing summary metadata, blockers,
  and conflicts as the default public metadata authority instead of rereading
  plan or summary indexes on the common path; do not widen the common path with
  separate `gapClosurePlans` rereads.
- Treat any lower-wave pending plan in `lowerWavePendingPlans` as an absolute
  blocker for later-wave work, including combined `--gaps-only --wave` runs.
- Do not infer gap closure from missing summaries alone.
- Existing valid summaries require explicit overwrite confirmation before
  replacement. Reuse is the default only when the summary is valid and marked
  `COMPLETED`.
- Treat summaries with semantic completion blockers as repair or replace
  targets. Formatting drift, heading casing, or missing optional sections are
  warnings, not execution blockers.
- Treat valid `PARTIAL` and `BLOCKED` summaries as durable carry-forward
  evidence, but keep those plans pending.
- If no plans exist, route to `/blu-plan-phase`. If selected plans are stale,
  invalid, missing dependencies, or otherwise unreadable, stop and repair or
  re-plan before execution.
- If `externalServicePreflight.confirmationRequired` is true, stop before
  meaningful execution, present the exact declared prerequisites, respect
  `safety.always_confirm_external_services`, and ask the user to confirm
  readiness. Only after confirmation should the command rerun
  `mcp_blueprint_blueprint_phase_execution_targets` with
  `externalServiceConfirmed: true`.

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
- Do not substitute browser-only, web-search-only, shell-only, or generic
  helper agents for `blueprint-executor`.
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
- The public `phase.summary` authoring template is a safe `PARTIAL`
  carry-forward seed, not a completed-evidence claim. Switch it to `COMPLETED`
  only after execution evidence and targeted verification pass.
- Draft Markdown `phase.summary` content against the returned contract and
  authoring context, then call
  `mcp_blueprint_blueprint_phase_summary_validate_model` with `content` and
  repair semantic diagnostics together before persistence. The Markdown
  contract is the authoring guide; exact heading shape and marker casing are
  quality warnings, while missing linkage, missing/invalid status on new
  writes, dependency completion for `COMPLETED`, and explicit failed
  verification remain blockers.
- Warning-only Markdown shape, exact sentinel, or style advice should not start
  another repair loop when summary truth is otherwise valid.
- Persist one `XX-YY-SUMMARY.md` artifact per executed plan through
  `mcp_blueprint_blueprint_phase_summary_write`.
- Pass the resolved numeric `phase`, the numeric `planId` for the matching
  saved plan, and Markdown `content` with an explicit `Status` marker.
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
  surfaced during execution or summary validation. These are pre-persistence
  gates.
- Run the target plan's required checks before claiming completion. Repair only
  issues caused by the current changes, cap repeated repair attempts, and write
  `PARTIAL` or `BLOCKED` summaries when verification cannot pass honestly.
- Treat blocking external service availability as part of the required checks.
  If a required service is not confirmed ready, do not enter meaningful
  execution. If it becomes unavailable after work starts, write a truthful
  `PARTIAL` or `BLOCKED` summary that names the prerequisite and keeps routing
  on `/blu-execute-phase <phase>` or `/blu-progress`.
- If a dependency plan summary is still missing or not yet `COMPLETED`, do not
  persist `COMPLETED` for the dependent plan. Downgrade to `PARTIAL` or
  `BLOCKED`, update `Completion State`, `Readiness`, and `Next Safe Action` to
  match that status, update Verification, Gap / Repair Routes, and Follow-Ups
  to match the open blocker, and keep the dependency blocker explicit until the
  dependency summary exists.
- Do not persist `COMPLETED` summaries while required tests fail, lower-wave
  blockers remain, or acceptance criteria are unverified. A `COMPLETED`
  summary closes only the selected plan's execution debt; route it back to
  `/blu-execute-phase <phase>` while other phase plans remain pending and to
  `/blu-validate-phase <phase>` only after the last pending plan is summarized.
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

When suitable execution agents are unavailable, continue sequentially with the
same evidence depth and output quality bar:

1. Compress the read context into a carry-forward note containing the selected
   plan ids, wave order, overlap or blocker notes, config-driven execution
   mode, acceptance criteria, and current uncertainties.
2. Execute one plan or one confirmed major task group at a time.
3. Run the plan's targeted verification and bounded repair loop.
4. Persist the resulting summary through MCP.
5. Use the latest persisted summary, including valid `PARTIAL` or `BLOCKED`
   status when present, as the durable checkpoint and compact carry-forward
   context before moving to the next plan.
6. Stop or ask for review when the next plan is blocked by overlap, lower-wave
   debt, repeated verification failure, or user choice.

## Completion Criteria

- `blueprint_phase_execution_targets` was used for deterministic plan
  selection and as the common pre-write metadata authority.
- Lower-wave blockers remained absolute.
- Selected plans were read before execution, and stale or invalid plans were
  not executed.
- The canonical `phase.summary` contract was read before summary authoring or
  replacement.
- The summary authoring context and Markdown draft validator were used before
  every new summary write.
- One summary per executed plan was persisted only through
  `mcp_blueprint_blueprint_phase_summary_write`.
- Valid `PARTIAL` and `BLOCKED` summaries remained pending carry-forward
  evidence.
- Post-write summary indexing, artifact validation, and synced state refresh
  ran in that order.
- The final response names the executed plans or waves, whether summaries were
  created, reused, replaced, partial, or blocked, any config or blocker notes,
  and the next safe implemented action.
