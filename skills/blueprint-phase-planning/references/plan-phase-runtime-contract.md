# `/blu-plan-phase` Runtime Contract

This reference is the rich behavior contract for `/blu-plan-phase`. The command
manifest should stay thin; the skill should load this file when planning a
phase so plan authoring preserves GSD's retained quality bar while staying
Blueprint-native.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_phase_locate` before drafting.
- If the phase cannot be resolved, stop with the tool `reason`, recovery
  guidance, and `/blu-progress` as the safe implemented route.
- Keep the resolved phase number, phase directory, active stage, pending gate,
  execution mode, and next safe action visible.

### Read

- Read `mcp_blueprint_blueprint_artifact_contract_read` with
  `artifactId: "phase.plan"` and use `contract.modelContract.schemaPath` plus
  the returned JSON Schema as the base model authority.
- Read `mcp_blueprint_blueprint_phase_plan_authoring_context` for the selected
  phase and plan slot. Use its `taskSchema` as the effective authoring
  contract; it narrows roadmap requirement ids, saved evidence artifact rows,
  and allowed dependency plan ids for this exact write.
- Read `mcp_blueprint_blueprint_phase_context` for roadmap, requirement, and
  mapped codebase signals.
- Read `mcp_blueprint_blueprint_phase_research_status` for context, research,
  UI readiness, and the config-aware `planningReadiness` handoff gate.
- Read `mcp_blueprint_blueprint_phase_artifact_read` for actual current
  context, research, UI, and other relevant discovery artifact content that
  exists. Status metadata alone is not enough.
- Read `mcp_blueprint_blueprint_phase_validation_read` for saved verification
  or UAT evidence when present.
- Read `mcp_blueprint_blueprint_review_load_findings` for saved review findings
  when present.
- Read `mcp_blueprint_blueprint_phase_plan_index` and
  `mcp_blueprint_blueprint_phase_plan_read` before any reuse, revision, or
  replacement decision.
- Read `mcp_blueprint_blueprint_config_get` with `scope: "effective"` and
  `mcp_blueprint_blueprint_state_load`.
- Prefer saved `.blueprint/codebase/` summaries exposed through phase context
  before broad repo rereads. Call out missing or invalid mapped codebase
  evidence as uncertainty.

### Decide

- Honor normalized effective config:
  - Use `phase_research_status.planningReadiness` as the authoritative
    pre-draft gate. If `readyForPlanPhase=false`, stop before drafting and
    route to `nextSafeAction`; report the first listed blocker instead of
    recomputing a different handoff from raw missing-artifact metadata.
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
- When the current write would revise or replace saved plan ids or the saved
  plan set, use `ask_user` for `reuse`, `revise`, or `replace`; replacement
  requires explicit confirmation. Additive new plan ids may proceed without
  that gate when no saved plan body will be overwritten.
- If the phase scope cannot be planned without reducing locked decisions or
  must-haves, recommend a split or prioritization before persistence.

### Execute

- When `blueprint-planner` is available, use it for bounded plan drafting.
- When `workflow.plan_check=true` and `blueprint-checker` is available, use it
  for bounded saved-plan review. When `workflow.plan_check=false`, skip checker
  review entirely and state that config disabled it.
- The parent command owns MCP calls, user gates, persistence, validation, state
  updates, and final routing.
- Planner input must include the resolved phase, live plan contract, roadmap
  and requirements, `phase_plan_authoring_context.taskSchema`, actual context
  text, actual research/UI/validation/review content when present, effective
  config, mapped codebase summaries, existing plan contents when revising, and
  the current checker findings during revision.
- Planner output must be a complete structured `phase.plan` JSON model, not
  Markdown, outlines, notes, or scaffold text.
- Checker input must include the saved plan bodies plus the same phase evidence
  used by the planner.

### Persist

- Do not seed `XX-YY-PLAN.md` with scaffold placeholders. Draft the finalized
  structured model first, then validate and persist it directly.
- Validate the model with `mcp_blueprint_blueprint_phase_plan_validate_model`
  before persistence.
- Persist only through `mcp_blueprint_blueprint_phase_plan_write` using the same
  validated `model` payload and `authoringMode: "model-only"`.
- Re-read `mcp_blueprint_blueprint_phase_plan_authoring_context` immediately
  before each model validation/write, especially after any successful plan write;
  saved `XX-YY-PLAN.md` files are intentional known evidence artifacts for later
  plan slots and must be covered by the refreshed task schema.
- Use `validationMode: "strict"` for `/blu-plan-phase`; `validationMode:
  "warn"` is not part of this command's write contract.
- Pass `phase` as the resolved numeric phase and `model` as the complete
  structured phase.plan payload. Omit `planId` to auto-assign, or pass only a numeric plan id when
  targeting an existing plan. If passing `planId`, use the JSON string value
  `planId: "01"` or numeric value `planId: 1`, never the double-encoded string
  `planId: "\"01\""`.
- Do not write raw `.blueprint/` files and do not pass phase directories,
  slugs, filenames, combined tokens like `02-01`, frontmatter key names as
  plan ids, or Markdown `content` from `/blu-plan-phase`.

### Validate

- Call `mcp_blueprint_blueprint_phase_plan_validate` after the final write
  path.
- If `phase_plan_validate_model`, `phase_plan_write`, or scoped plan-validation
  returns invalid diagnostics, do not present the plan as complete and do not
  fall back to Markdown. Repair all diagnostics together against the live task
  schema and contract, rerun the targeted planner/checker path if needed, then
  retry through MCP at most once unless a new deterministic issue appears.
- If validation or checker repair stalls, preserve the best coherent draft
  only when it is saved truthfully, report the remaining blocker or split point,
  and route to `/blu-progress`.

### Route

- Call `mcp_blueprint_blueprint_state_update` with `base: "synced"` after
  successful final persistence so `.blueprint/STATE.md` recomputes next action
  from the updated artifact inventory.
- Route only to implemented commands. Use `/blu-progress` when the natural next
  command is not implemented or the safest action is ambiguous.

## Artifact Authoring Rules

- Every plan must follow the live `phase.plan` authoring template and preserve
  required frontmatter keys and headings.
- Preserve the exact frontmatter keys `phase`, `plan_id`, `title`, `wave`,
  `status`, `objective`, `depends_on`, `requirements`, `files_modified`,
  `read_first`, `acceptance_criteria`, and `autonomous`.
- Preserve the exact required sections `## Goal`, `## Scope`, `## Tasks`,
  `## Verification`, and `## Must Haves`.
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
- Frontmatter `requirements` must map every declared phase requirement to at
  least one plan. Plans with no requirement coverage are invalid for acceptance.
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
  itself, and name required env vars or dashboard actions concretely.
- For security-relevant changes, include threat boundaries and mitigation tasks
  when saved research, requirements, or config indicate security exposure.

## Subagent Path

Use this path only when suitable code/workflow analysis subagents are available:

1. Parent reads all required MCP context and saved artifacts.
2. Parent gives `blueprint-planner` the actual artifact contents, live
   contract, config gates, mapped codebase summaries, and existing plans.
3. Planner returns complete plan bodies, coverage mapping, dependency waves,
   split rationale, blockers, and assumptions.
4. Parent writes through MCP.
5. If `workflow.plan_check=true`, parent gives the saved plan bodies to
   `blueprint-checker`.
6. Checker returns `ACCEPT`, `REVISE`, or `BLOCK` with blockers, warnings,
   evidence, why each issue matters, and concrete fix hints.
7. Parent performs targeted revisions, up to three checker passes. If issue
   count stalls or the checker keeps finding the same blocker, ask whether to
   adjust approach, proceed with an explicitly risky saved draft, or stop.

Do not use browser, web-search-only, or generic browsing agents as substitutes
for Blueprint planning, codebase, or workflow analysis agents.

## No-Subagent Fallback

When planner/checker agents are unavailable, continue sequentially:

1. Compress the read context into a carry-forward note containing phase goal,
   requirements, locked decisions, deferred ideas, config gates, codebase
   evidence, and uncertainties.
2. Draft one structured plan model or one coherent topic at a time from the
   live runtime-narrowed task schema.
3. Run an inline checklist for requirement coverage, decision fidelity,
   dependency correctness, task specificity, scope sanity, verification
   readiness, must-have quality, and invalid scope-reduction language. This
   checklist is always required, and it becomes the final review fallback when
   `workflow.plan_check=true` but no suitable checker agent is available.
4. Persist only after the current plan passes the inline checklist.
5. Move to the next dependency wave only after summarizing what was already
   written and what evidence still carries forward.
6. If the inline checklist finds a blocker, repair the affected plan before
   drafting more plans.

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
- Existing plans: additive new plan writes may proceed without the
  reuse/revise/replace gate when no saved plan id is being overwritten; never
  replace without the explicit `replace` decision and overwrite confirmation.
- Invalid model validation or write: repair all diagnostics using the task
  schema and validation issues, then retry the same MCP path. Do not bypass
  validation with raw file writes or Markdown fallback.
- Scoped plan validation failure: repair only the affected plan ids or split
  point, then rerun the same scoped validation before completion.
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
- Requirement coverage is exhaustive or gaps are named as blockers.
- Plan dependencies are acyclic, wave numbers agree with `depends_on`, and file
  ownership does not create avoidable parallel conflicts.
- Must-haves are outcome-shaped and include artifacts plus key wiring, not only
  implementation chores.
- Research, UI, validation, review, and codebase evidence is cited where it
  affects plan tasks.
- Uncertainty is explicit. The plan names missing evidence rather than
  inventing certainty.

## Completion Criteria

- A valid `phase.plan` contract was read before authoring.
- Existing plan reuse/revise/replace was decided safely.
- All enabled config gates were honored or explicitly routed.
- Final plan bodies were persisted through
  `mcp_blueprint_blueprint_phase_plan_write`.
- Saved plans were validated through
  `mcp_blueprint_blueprint_phase_plan_validate` and checker-reviewed when
  `workflow.plan_check` is enabled, or the config-disabled skip is stated and
  no checker review is claimed.
- `.blueprint/STATE.md` was refreshed through synced state update.
- The final response names the phase, gates, plan ids, revision/checker result,
  warnings or blockers, and the next safe implemented action.
