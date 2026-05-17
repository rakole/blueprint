# `/blu-plan-phase` Runtime Contract

This reference is the rich behavior contract for `/blu-plan-phase`. The command
manifest should stay thin; the skill should load this file when planning a
phase so plan authoring preserves Blueprint's retained quality bar.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_phase_locate` before drafting.
- If the phase cannot be resolved, stop with the tool `reason`, recovery
  guidance, and `/blu-progress` as the safe implemented route.
- Keep the resolved phase number, phase directory, active stage, pending gate,
  execution mode, and next safe action visible.

### Read

- Prefer one `mcp_blueprint_blueprint_phase_plan_readiness` call as the compact
  Read-stage packet. Use summary/hash mode by default; request bounded bodies
  only when drafting or a subagent handoff needs actual context, research, or UI
  excerpts.
- Use readiness `contract.modelContract.schemaPath` plus the returned JSON
  Schema as the base model authority. Fall back to
  `mcp_blueprint_blueprint_artifact_contract_read` only when the packet omitted
  or truncated contract detail.
- Use readiness `context`, `researchStatus`, `planIndex`, `effectiveConfig`,
  `stateSnapshot`, evidence absence/presence signals, and `readSet` freshness
  metadata as the normal source for Read-stage grounding.
- Call `mcp_blueprint_blueprint_phase_context`,
  `mcp_blueprint_blueprint_phase_research_status`,
  `mcp_blueprint_blueprint_phase_artifact_read`,
  `mcp_blueprint_blueprint_phase_validation_read`,
  `mcp_blueprint_blueprint_review_load_findings`,
  `mcp_blueprint_blueprint_phase_plan_index`,
  `mcp_blueprint_blueprint_phase_plan_read`,
  `mcp_blueprint_blueprint_config_get`, or
  `mcp_blueprint_blueprint_state_load` only when readiness reports omitted,
  truncated, stale, or user-requested detail. Status metadata alone is not
  enough when the draft needs actual saved discovery content.
- After `planningReadiness` allows drafting and any saved-plan add/revise/replace
  choice is settled, use readiness `authoringContext` when it matches the
  selected phase and plan slot and its read set is fresh; otherwise read
  `mcp_blueprint_blueprint_phase_plan_authoring_context` for that slot. Use its
  `taskSchema` as the effective authoring contract; it narrows roadmap
  requirement ids, saved evidence artifact rows, and allowed dependency plan ids
  for this exact write.
- Prefer saved `.blueprint/codebase/` summaries exposed through phase context
  before broad repo rereads. Call out missing or invalid mapped codebase
  evidence as uncertainty.
- After all Read-stage MCP calls complete, build the Planning Investigation
  Trace before any drafting or subagent invocation. The full section is
  defined below, after Stage Mapping, to preserve the stage hierarchy.

#### Read-Set Staleness Check

- Record the key Read-stage evidence set used for drafting:
  - `blueprint_phase_plan_readiness.readSet` entries and freshness result when
    readiness was used
  - `XX-CONTEXT.md` path and the substantive content relied on from its
    `mcp_blueprint_blueprint_phase_artifact_read` result
  - `XX-RESEARCH.md` path and relied-on content when research was read
  - `XX-UI-SPEC.md` path and relied-on content when a UI contract was read
  - Plan index state from `mcp_blueprint_blueprint_phase_plan_index`,
    including saved plan count and plan ids
  - Any saved plan bodies or excerpts from
    `mcp_blueprint_blueprint_phase_plan_read` that were relied on during `add`,
    `revise`, or `replace` decisions or while revising/replacing an existing
    plan
  - Any runtime-narrowed evidence rows or dependency-plan ids from
    `mcp_blueprint_blueprint_phase_plan_authoring_context.taskSchema` that
    materially constrained the draft
- Before persistence, if the command skips a duplicate pre-write re-read from an
  uninterrupted readiness-backed flow, pass the recorded readiness `readSet` as
  `expectedReadSet` to `mcp_blueprint_blueprint_phase_plan_write` so the server
  checks freshness before saving. Otherwise call readiness with `readMode:
  "hashes-only"` and `previousReadSet`, or re-read the same MCP evidence
  surfaces, then compare their current content or inventory against the
  recorded read set.
- If the comparison shows drift, surface it as a warning, re-read the changed
  evidence before continuing, and repair the draft/checker context against the
  refreshed evidence before persistence.
- This is a warning-only MCP re-read/content-comparison guard. Do not rely on
  filesystem mtime/stat checks, hidden host metadata, or non-MCP freshness
  signals.

### Decide

- Honor normalized effective config:
  - Use `phase_research_status.planningReadiness` as the authoritative
    pre-draft gate. If `readyForPlanPhase=false`, stop before drafting and
    route to `nextSafeAction`; report the first listed blocker instead of
    recomputing a different handoff from raw missing-artifact metadata. Do not
    interpret `mcp_blueprint_blueprint_phase_plan_authoring_context.taskSchema`
    for drafting until this gate is satisfied.
  - `workflow.research=true`: require usable research before final plan
    authoring, or route to `/blu-research-phase`.
  - `workflow.research=false`: state that research was skipped by config.
  - `workflow.ui_phase=true`: require a usable UI contract for UI work, or a
    documented skip rationale.
  - `workflow.ui_safety_gate=true`: block silent UI omission when UI work is in
    scope.
  - `workflow.plan_check=true`: run the checker loop before acceptance.
  - `workflow.plan_check=false`: state that checker review was skipped by
    config.
- Use saved research for freshness-sensitive or unstable technical decisions.
  If that evidence is missing or stale under the active planning gates, route
  to `/blu-research-phase` instead of live browsing or ad hoc web-doc lookup.
- If saved plans already exist and `planId` is omitted, use `ask_user` for
  `add`, `revise`, or `replace` before drafting. `add` keeps multi-plan
  authoring supported while selecting a new slot, `revise` means choose an
  existing saved plan id before drafting, and `replace` requires explicit
  confirmation before replacing the saved plan set. If no saved plans exist and
  `planId` is omitted, the first slot may auto-assign without that gate. If a
  specific saved `planId` was passed, treat that as a targeted revise flow and
  confirm before overwriting.
- Explicit additive intent may proceed without an overwrite confirmation once
  the new slot is selected. Revise, replace, overwrite, or deleting/replacing a
  saved plan set always requires confirmation.
- If the phase scope cannot be planned without reducing locked decisions or
  must-haves, recommend a split or prioritization before persistence.

### Execute

- When `blueprint-planner` is available, use it for bounded plan drafting.
- When `workflow.plan_check=true` and `blueprint-checker` is available, use it
  for bounded saved-plan review. When `workflow.plan_check=false`, skip checker
  review entirely and state that config disabled it.
- The parent command owns MCP calls, user gates, persistence, validation, state
  updates, and final routing.
- Planner input should be a compact packet by default: resolved phase and phase
  dir, readiness summary, effective config, task schema path/hash plus task
  schema only when needed, artifact paths plus read-set hashes, short excerpts
  for context/research/UI/validation/review evidence, plan index summary,
  existing plan bodies only when revising or replacing, and current checker
  findings during revision. The planner may use read-only `read_file` for
  supplied paths when it needs the full body.
- Planner output must be a complete structured `phase.plan` JSON model, not
  Markdown, outlines, notes, or scaffold text.
- Checker input should be compact by default: saved plan paths/hashes, write and
  validation result summaries, readiness/config summary, prior findings, and
  evidence paths/excerpts. The checker may use read-only `read_file` for supplied plan paths
  when exact body review is necessary.

### Persist

- Do not seed `XX-YY-PLAN.md` with scaffold placeholders. Draft the finalized
  structured model first, then persist it directly through MCP.
- `mcp_blueprint_blueprint_phase_plan_validate_model` remains available for
  dry-run previews, repair loops, and checker convergence, but it is not
  mandatory before every write.
- Persist only through `mcp_blueprint_blueprint_phase_plan_write` using the
  structured `model` payload, `authoringMode: "model-only"`,
  `returnPlanSetValidation: true`, and `expectedReadSet` from the fresh
  readiness `readSet` when skipping a duplicate pre-write re-read.
- Re-read `mcp_blueprint_blueprint_phase_plan_authoring_context` after any
  successful plan write, after a user pause or subagent return, or whenever
  read-set freshness is absent or stale; saved `XX-YY-PLAN.md` files are
  intentional known evidence artifacts for later plan slots and must be covered
  by the refreshed task schema. Do not skip the refresh unless the server checked
  `expectedReadSet` for the write.
- Use `validationMode: "strict"` for `/blu-plan-phase`; validationMode:
  "warn" is not part of this command's write contract.
- Pass `phase` as the resolved numeric phase and `model` as the complete
  structured phase.plan payload. Omit `planId` only for the first plan in an
  empty plan set or after an explicit `add` choice selected a new slot, or pass
  only a numeric plan id when targeting an existing plan. If passing `planId`,
  use the JSON string value `planId: "01"` or numeric value `planId: 1`, never
  the double-encoded string `planId: "\"01\""`.
- Do not write raw `.blueprint/` files and do not pass phase directories,
  slugs, filenames, combined tokens like `02-01`, frontmatter key names as
  plan ids, or Markdown `content` from `/blu-plan-phase`.

### Validate

- Call `mcp_blueprint_blueprint_phase_plan_validate` after the final write
  path.
- The final `mcp_blueprint_blueprint_phase_plan_validate` status must be
  `valid` before completion advances or `mcp_blueprint_blueprint_state_update`
  is allowed to run.
- Do not infer completion from `phase_plan_write.validation.valid` alone; the
  write result's `planSetValidationSummary` and `completionReady` are incremental
  signals, and the separate final scoped validation remains authoritative.
- If dry-run `phase_plan_validate_model`, `phase_plan_write`, or scoped plan-validation
  returns invalid diagnostics, do not present the plan as complete and do not
  fall back to Markdown. Repair all diagnostics together against the live task
  schema and contract, rerun the targeted planner/checker path if needed, then
  retry through MCP at most once unless a new deterministic issue appears.
- If a write succeeds but scoped plan validation still returns `status:
  "invalid"`, preserve the saved plan as an incremental checkpoint, surface the
  exact uncovered requirements or dependency/slot issues, and do not claim
  final completion. Incomplete roadmap coverage may still be saved
  incrementally, but it is not final completion.
- If validation or checker repair stalls, preserve the best coherent draft
  only when it is saved truthfully, report the remaining blocker or split point,
  and route to `/blu-progress`.

### Route

- Call `mcp_blueprint_blueprint_state_update` with `base: "synced"` only after
  successful final persistence and final scoped validation status `valid`, so
  `.blueprint/STATE.md` recomputes next action from the updated artifact
  inventory.
- Route only to implemented commands. Use `/blu-progress` when the natural next
  command is not implemented or the safest action is ambiguous.

## Downstream Execution Handoff

Before final routing, derive a compact execution handoff from the planning
session. Include it in the final response as structured prose:

- `planSummary`: plan count, wave structure, total tasks, key files
- `executionOrder`: which plans run first and why
- `evidenceGaps`: evidence that was missing or uncertain during planning;
  execution should verify these early
- `assumptions`: planning assumptions that execution should validate
- `verificationPriorities`: which acceptance criteria are highest-risk and
  should be checked first
- `deferredItems`: requirements or ideas deferred from this planning pass with
  rationale
- `knownRisks`: risk factors from the investigation trace that execution
  should monitor

Do not create a new artifact. Include the handoff substance in the final
response and in `unknownsAndDeferrals` where appropriate.

## Planning Investigation Trace

After completing all Read-stage MCP calls, build a session-local planning
evidence summary before drafting any plan content. This summary is working
state, not a new artifact or MCP type.

### Evidence Inventory

| Source | Status | Key Finding | Planning Impact | Confidence |
|--------|--------|-------------|-----------------|------------|

Classify each source as one of:

- `present-usable`: artifact exists with substantive authored content
- `present-scaffold`: artifact exists but contains only scaffold or seed content
- `present-invalid`: artifact exists but failed or may fail validation
- `missing`: no artifact file exists
- `disabled-by-config`: artifact gate disabled in normalized config

Required sources to classify:

- Phase context (`XX-CONTEXT.md`)
- Research (`XX-RESEARCH.md`) only when `workflow.research=true`
- UI spec (`XX-UI-SPEC.md`) only when `workflow.ui_phase=true`
- Validation evidence when present
- Review findings when present
- Existing plan inventory
- Mapped codebase summaries

### Planning Signals

Before drafting, extract and list:

1. Locked decisions: implementation decisions from context that constrain the
   plan and must not be reduced.
2. Requirement mapping: which phase requirements map to which implementation
   areas and what evidence supports each mapping.
3. Evidence gaps: where saved evidence is missing, stale, or insufficient for
   confident planning.
4. Split signals: early indicators that the phase needs multiple plans, such
   as broad scope, independent features, or dependency layers.
5. Risk factors: security exposure, external dependencies, validation
   complexity, or areas where research flagged uncertainty.

### Compact Summary

Summarize in 3-5 lines: phase goal, key constraints, evidence quality,
anticipated plan count, and highest-risk planning decision.

Present this summary before any plan drafting or subagent invocation.

## Planning Decision Record

Maintain a session-local record of planning decisions that persist across
revision passes. This is working state, not a new artifact.

For each non-trivial planning decision, record:

- `decision`: what was decided (split strategy, wave ordering, requirement
  deferral, dependency direction, vertical vs horizontal slice)
- `rationale`: why this choice over alternatives
- `evidence`: which investigation trace source supported this decision
- `alternatives`: what was considered and rejected
- `risk`: what could invalidate this decision
- `revision-stable`: whether this decision should survive a targeted
  revision pass (yes by default; no only when the checker found it unsound)

### Carry-Forward Between Revision Passes

When the checker returns REVISE, carry the decision record forward so the
revision pass can:
1. Preserve decisions marked `revision-stable: yes`
2. Revise only decisions the checker found unsound
3. Avoid re-deriving decisions that were already validated

### Fold Into Plan Artifacts

Before final model validation and write, fold unresolved decisions into the
plan's `unknownsAndDeferrals` section. Fold rejected alternatives into `scope`
when they clarify what the plan intentionally excludes.

## Artifact Authoring Rules

- Every plan must preserve the live `phase.plan` rendered shape, required
  frontmatter keys, and headings. Treat the public `contract.authoringTemplate`
  as a Markdown compatibility/rendered-shape preview only; `/blu-plan-phase`
  authoring authority is `contract.modelContract` plus the narrowed
  `blueprint_phase_plan_authoring_context.taskSchema`.
- Preserve the exact frontmatter keys `phase`, `plan_id`, `title`, `wave`,
  `status`, `objective`, `depends_on`, `requirements`, `files_modified`,
  `read_first`, `acceptance_criteria`, and `autonomous`.
- Preserve the exact required sections `## Goal`, `## Scope`, `## Tasks`,
  `## External Service Prerequisites`, `## Verification`, `## Must Haves`, `## Requirement Coverage`,
  `## Evidence Coverage`, `## File / Surface Coverage`, and
  `## Unknowns And Deferrals`.
- Every task must include `#### Read First`, `#### Action`, and
  `#### Acceptance Criteria`.
- `#### Read First` must include concrete repo-relative paths: the file being
  modified, source-of-truth docs, existing pattern files, schemas, interfaces,
  tests, and config that constrain the task. Do not put endpoint routes,
  command globs, or code snippets in path-list positions.
- `#### Action` must include concrete target state: function names, routes,
  schema fields, config keys, expected values, imports, command arguments, and
  decisions being implemented. Avoid vague "align with", "make consistent",
  "wire up", or "handle errors" phrasing unless the exact target behavior is
  spelled out.
- `#### Acceptance Criteria` must be grep/test/CLI/file-read verifiable and
  include exact strings, commands, expected outputs, files, or patterns.
  Subjective criteria such as "looks good" or "properly configured" are not
  enough.
- Each plan should usually contain 2-3 implementation tasks. Four tasks is a
  warning; five or more tasks, more than about eight files, or any single task
  touching more than five files should trigger a split review.
- Prefer vertical slices when independent features can run in parallel. Use
  horizontal foundations only when downstream interfaces or shared state really
  require it.
- Frontmatter/top-level model `requirements` must list only requirements this
  specific plan covers now. Do not put deferred or irrelevant requirements in
  that top-level list.
- `requirementCoverage` is the all-requirements ledger: every known phase
  requirement from the runtime-narrowed task schema must appear exactly once as
  `covered`, `deferred`, or `irrelevant` with concrete rationale. Plans with no
  covered requirement are invalid for acceptance unless the plan is an explicit
  blocker/deferral artifact accepted by the parent command.
- `evidenceCoverage` is runtime-narrowed and dynamic. It must cover every saved
  evidence artifact in the current authoring context exactly once as `used`,
  `deferred`, `irrelevant`, or `unavailable`; after each successful plan write,
  re-read `blueprint_phase_plan_authoring_context` because saved plan files can
  become evidence for later plan slots.
- Include goal-backward must-haves: observable truths, required artifacts, and
  key links or wiring points. If the canonical template uses prose rather than
  nested YAML for `## Must Haves`, preserve the section while keeping those
  three categories explicit.
- Preserve locked context decisions at full fidelity. Do not use language such
  as "v1", "simplified", "static for now", "placeholder", "future
  enhancement", "will be wired later", "not connected", or "stub" to reduce a
  user decision. If full fidelity does not fit, split or block.
- Exclude deferred ideas from context artifacts.
- For code-producing tasks, prefer test-first or test-explicit instructions
  when behavior can be specified before implementation. If no test exists, add
  an early task or acceptance criterion that creates or names the missing test
  evidence.
- For external services, include only user setup the agent cannot perform
  itself, and name required env vars or dashboard actions concretely. Record
  those dependencies in the structured `externalServicePrerequisites` field and
  the rendered `## External Service Prerequisites` section whenever execution
  depends on runtime state outside the repo. Keep this generic: valid examples
  include Docker or other container runtimes, Postgres/MySQL/MongoDB/Redis,
  queues or brokers, cloud emulators, local API servers, search services,
  caches, auth sandboxes, and third-party SaaS test tenants.
- For security-relevant changes, include threat boundaries and mitigation tasks
  when saved research, requirements, or config indicate security exposure.

## Plan Complexity And Split Framework

### Complexity Signals

Evaluate these signals before and during drafting:

| Signal | Threshold | Action |
|--------|-----------|--------|
| Tasks per plan | >3 | Consider split |
| Files modified per plan | >8 | Consider split |
| Files per task | >5 | Split the task or plan |
| Independent features | >1 | Prefer vertical slice split |
| Dependency layers | >2 | Consider horizontal foundation plan |
| Requirement groups | >2 unrelated | Split by requirement group |
| Risk concentration | 1 task has all risk | Isolate risky task in its own plan |

### Split Axes (ordered by preference)

1. **By feature/vertical slice**: when independent features can run and
   validate in parallel without shared state
2. **By requirement group**: when requirements cluster into distinct
   implementation areas with different verification strategies
3. **By dependency layer**: when a shared foundation must be proven before
   dependent features can start (use sparingly)
4. **By risk boundary**: when one area has disproportionate uncertainty,
   security exposure, or external dependency

### Minimum Viable Plan

A plan is too small to be useful when it:
- Has only 1 trivial task that could be a subtask of another plan
- Creates no verifiable artifact or behavior change
- Cannot be validated independently

When a split would produce a below-minimum plan, merge it back into its
nearest dependency neighbor.

### Split Rationale In Output

When splitting, include in the planning decision record:
- Why this split axis was chosen over alternatives
- What dependency exists between the resulting plans
- What the execution order constraint is
- What would trigger a re-merge if evidence changes

## Subagent Path

Use this path only when suitable code/workflow analysis subagents are available:

1. Parent reads all required MCP context and saved artifacts.
2. Parent gives `blueprint-planner` a compact packet with readiness/config
   summary, task schema authority, paths/hashes, short excerpts, plan index, and
   existing plan bodies only when revising/replacing. Planner can use read-only
   `read_file` for supplied paths when exact bodies are needed.
3. Planner returns complete plan bodies, coverage mapping, dependency waves,
   split rationale, blockers, and assumptions.
4. Parent writes through MCP.
5. If `workflow.plan_check=true`, parent gives `blueprint-checker` saved plan
   paths/hashes, write and validation summaries, readiness/config summary, prior
   findings, and full plan bodies only when needed. Checker can use read-only
   `read_file` for supplied plan paths.
6. Checker returns `ACCEPT`, `REVISE`, or `BLOCK` with blockers, warnings,
   evidence, why each issue matters, and concrete fix hints.
7. Parent performs targeted revisions, up to three checker passes. If issue
   count stalls or the checker keeps finding the same blocker, ask whether to
   adjust approach, proceed with an explicitly risky saved draft, or stop.

Do not use browser, web-search-only, or generic browsing agents as substitutes
for Blueprint planning, codebase, or workflow analysis agents.

## No-Subagent Fallback

When planner/checker agents are unavailable, continue sequentially with the
same plan quality, evidence coverage, and review bar expected from the bounded
subagent path. Do not substitute browser-only, web-search-only, shell-only, or
generic helpers for Blueprint planning, codebase, or workflow analysis.

1. Build the Planning Investigation Trace from the read context: evidence
   inventory, planning signals, and compact summary.
2. Build the Pre-Draft Readiness Assessment. If any HIGH-risk dimension is not
   ready, document it as a planning assumption or blocker.
3. Draft one structured plan model at a time from the live runtime-narrowed
   task schema. Start a Planning Decision Record for non-trivial decisions.
4. Run the inline quality checklist with priority ordering:
   a. Requirement coverage completeness (`no` is a BLOCKER)
   b. Locked decision fidelity (`no` is a BLOCKER)
   c. Task action specificity (`no` is a BLOCKER)
   d. Acceptance criteria verifiability (`no` is a BLOCKER)
   e. Dependency correctness (`no` is a WARNING unless it breaks validity)
   f. Scope sanity and split signals (`no` is a WARNING unless the plan is no
      longer coherent)
   g. Evidence coverage match (`no` is a WARNING and must trigger the
      Read-Set Staleness Check)
   h. Must-have derivation quality (`no` is a WARNING unless the plan becomes
      chore-only)
5. Compress the completed plan into the carry-forward note with plan ids,
   requirement coverage decisions, evidence used, remaining blockers, and what
   the next wave can assume.
6. Persist only after the current plan passes the inline checklist with no
   BLOCKER items.
7. Move to the next dependency wave only after summarizing what was written and
   what evidence still carries forward.
8. If the inline checklist finds a blocker, repair the affected plan before
   drafting more plans.
9. Run the Post-Draft Semantic Self-Check before claiming completion. If any
   answer is `no`, repair the plan before persistence or final completion
   claims.

## Retry And Repair Behavior

- Missing phase: stop and route with the locate recovery guidance.
- Missing required context or research under enabled config: route to the
  producing command instead of fabricating evidence.
- If `planningReadiness.readyForPlanPhase=true`, do not block only because
  `suggestedRepairs` or `missingArtifacts` mention disabled research or UI
  artifacts. Those lists are artifact inventory and repair hints; the readiness
  gate owns whether `/blu-plan-phase` may continue.
- Missing UI contract under enabled UI gates: require skip rationale or route to
  `/blu-ui-phase`.
- Existing plans with omitted `planId`: require an explicit `add`, `revise`, or
  `replace` decision before drafting. Never replace without the explicit
  `replace` decision and overwrite confirmation.
- Invalid model validation or write: repair all diagnostics using the task
  schema and validation issues, then retry the same MCP path. Do not bypass
  validation with raw file writes or Markdown fallback.
- Scoped plan validation failure: repair only the affected plan ids or split
  point, then rerun the same scoped validation before completion. A saved plan
  may remain as an incremental checkpoint, but completion and synced state stay
  blocked until scoped validation returns `status: "valid"`.
- Checker `REVISE`: when `workflow.plan_check=true`, revise only affected plan
  ids unless the whole plan set is unsound.
- Checker `BLOCK`: when `workflow.plan_check=true`, stop or split unless the
  missing substrate can be produced by an implemented command.
- Max revision loop: three checker passes when `workflow.plan_check=true`.
  After that, report the unresolved issues and route to `/blu-progress` unless
  the user explicitly chooses a risky proceed path.

## Output Quality Criteria

- The executor can implement each task without asking what file, function,
  route, schema, config, test, or command is intended.
- Every acceptance criterion can be checked mechanically by grep, file read,
  test command, CLI output, or a tightly specified manual checkpoint.
- Requirement coverage is exhaustive for final completion, or any remaining gaps
  are named explicitly as blockers on an incremental saved checkpoint.
- Plan dependencies are acyclic, wave numbers agree with `depends_on`, and file
  ownership does not create avoidable parallel conflicts.
- Must-haves are outcome-shaped and include artifacts plus key wiring, not only
  implementation chores.
- Research, UI, validation, review, and codebase evidence is cited where it
  affects plan tasks.
- Uncertainty is explicit. The plan names missing evidence rather than
  inventing certainty.

## Planning Quality Self-Check

### Pre-Draft Readiness Assessment

Before drafting plan content, assess readiness per dimension:

| Dimension | Ready? | Evidence | Risk If Weak |
|-----------|--------|----------|--------------|
| Phase goal clarity | | | |
| Requirement completeness | | | |
| Locked decision coverage | | | |
| Evidence sufficiency | | | |
| Dependency visibility | | | |
| Verification feasibility | | | |

If any HIGH-risk dimension is not ready, document the gap as a planning
assumption or blocker before drafting. Do not silently resolve uncertainty by
omitting the requirement or weakening the plan.

### Post-Draft Semantic Self-Check

Before claiming plan completion, answer yes or no:

1. Does every task `Action` name concrete target state such as functions,
   routes, schema fields, config keys, or expected values rather than vague
   alignment or wiring language?
2. Does every task `Read First` cite the actual files being modified plus
   constraining docs, schemas, interfaces, or tests?
3. Does every `Acceptance Criteria` item specify a mechanically checkable
   condition such as a grep string, test command, CLI output, or file content?
4. Does `requirementCoverage` account for every known phase requirement exactly
   once with concrete rationale for deferred or irrelevant items?
5. Does `evidenceCoverage` match the latest runtime-narrowed inventory from a
   fresh `blueprint_phase_plan_authoring_context` read?
6. Could `/blu-execute-phase` implement each task without asking what file,
   function, route, or test is intended?
7. Are deferred items, assumptions, and evidence gaps named in
   `unknownsAndDeferrals` rather than silently omitted?

If any answer is "no", repair the affected plan section before persistence.

## Worked Examples And Anti-Examples

### Good: Single-Plan Phase With Research

Phase has 2 requirements, clear context, and valid research. The agent reads
all evidence, builds an investigation trace showing both requirements map to
one implementation area, drafts one structured plan model with 3 tasks,
validates against the task schema, persists through MCP, runs checker
(`ACCEPT`), validates the plan set, and syncs state. The final response names
phase, plan id, gates honored, and next safe action.

### Good: Multi-Plan Phase With Dependency Waves

Phase has 5 requirements spanning UI and backend. The investigation trace
identifies 2 independent feature slices plus 1 shared foundation. The agent
drafts 3 plans: wave-1 foundation, wave-2a UI slice, and wave-2b backend
slice. It re-reads authoring context after each write so saved plan files
become evidence for later slots. Checker finds one `REVISE` issue; the agent
fixes the affected plan only and re-validates. The final plan set passes
scoped validation.

### Good: Reuse Gate For Existing Plans

Phase has 2 existing plans. The agent reads plan index and plan bodies. New
context does not change the first plan but invalidates the second. The agent
uses `ask_user` for add, revise, or replace. The user chooses revise plan 02,
and the agent drafts a revised model for plan 02 only while preserving plan
01.

### Good: Config-Disabled Research Skip

`workflow.research=false` in effective config. The agent reads config and
reports that research was skipped because normalized config disabled it. It
proceeds without blocking on a missing research artifact.

### Good: Planning Readiness Block

`planningReadiness.readyForPlanPhase=false` with blocker "missing usable
context". The agent stops before drafting, reports the blocker, and routes to
`/blu-discuss-phase <phase>`. No plan files are written.

### Anti-Example: Skipping Investigation Trace

Bad: Reading all MCP sources and immediately drafting a plan model without
summarizing what was found.
Correct: Building the evidence inventory and planning signals summary before
any drafting.

### Anti-Example: Markdown Fallback After Validation Failure

Bad: `blueprint_phase_plan_validate_model` returns invalid diagnostics and the
agent writes raw `.blueprint/` Markdown to bypass validation.
Correct: Repairing diagnostics against the live task schema, retrying through
`blueprint_phase_plan_write`, and stopping if identical diagnostics repeat.

### Anti-Example: Ignoring Evidence Coverage Refresh

Bad: Writing plan 01 and then writing plan 02 without refreshing
`blueprint_phase_plan_authoring_context` or checking a fresh `expectedReadSet`.
Plan 02's `evidenceCoverage` misses the newly saved plan 01 file.
Correct: Refreshing authoring context after successful writes or relying only on
a server-checked `expectedReadSet` for an uninterrupted write.

### Anti-Example: Scope Reduction Language

Bad: A task action says "Add a simplified v1 authentication flow for now."
Correct: A task action names the full target behavior required by the locked
decision in context instead of reducing scope with placeholder language.

### Anti-Example: Vague Acceptance Criteria

Bad: "Authentication is properly configured and working."
Correct: Acceptance criteria specify exact tests, grep targets, CLI outputs, or
file content that can be checked mechanically.

### Anti-Example: Unbounded Checker Loop

Bad: Checker returns `REVISE` three times with the same issue and the agent
keeps retrying without tracking convergence.
Correct: After 3 passes with the same blocker, the agent stops, preserves the
best draft, reports the exact unresolved issue, and routes to `/blu-progress`.

## Completion Criteria

- A valid `phase.plan` contract was read before authoring.
- Existing saved plans used an explicit add/revise/replace decision safely
  before drafting.
- All enabled config gates were honored or explicitly routed.
- Final plan bodies were persisted through
  `mcp_blueprint_blueprint_phase_plan_write`.
- Saved plans were validated through
  `mcp_blueprint_blueprint_phase_plan_validate` with final status `valid` and
  checker-reviewed when `workflow.plan_check` is enabled, or the config-disabled
  skip is stated and no checker review is claimed.
- Incremental saved checkpoints with incomplete roadmap coverage or other
  scoped validation gaps were reported honestly as not complete.
- `.blueprint/STATE.md` was refreshed through synced state update only after
  final scoped validation became `valid`.
- The final response names the phase, gates, plan ids, revision/checker result,
  warnings or blockers, the Downstream Execution Handoff, and the next safe
  implemented action.

## Phase Context Ownership And Repair Loop

- Blueprint does not create, manage, or repair repo-root `CONTEXT.md`.
- Brownfield mapping writes repo context only to `.blueprint/codebase/*.md`.
- `/blu-plan-phase` reads phase context only from `.blueprint/phases/<phase>/<XX>-CONTEXT.md` and must not repair, overwrite, synthesize, or mirror it.
- The canonical phase context filename shape is `XX-CONTEXT.md` inside the resolved phase directory.
- Missing, invalid, contradictory, or unusable context routes to `/blu-discuss-phase <phase>` with exact diagnostics before any planning draft.
- If plan model validation, plan write, or scoped plan validation returns diagnostics, repair the same structured model once and retry the same MCP path.
- If the retry returns identical diagnostics, stop, preserve the planning checkpoint or best safe no-write state, report the exact diagnostics and next safe action, and do not inspect MCP source files as a repair strategy.
