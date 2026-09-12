# `/blu-plan-phase` Runtime Contract

Turn saved phase requirements, decisions and research into bounded executable
plans. MCP owns durable state and document compilation. Preserve the original
candidate before assessing whether it is ready to execute.

## Prepare

Call `blueprint_plan_prepare` first using the selected phase. It resolves phase
identity, context/research/UI gates, effective config, evidence fingerprints,
saved plans, session revision and the compact authoring schema. Consume this
packet directly; do not repeat primitive MCP reads or request the legacy plan
schema/Markdown template on the normal path. The returned schema and paths own
identity and authoring shape.

If existing plans require a choice, ask for add, revise or replace. Explicit
additive intent is sufficient for add. For revise, select targetPlanIds; replace
defaults to the whole saved set, or explicitly selected targetPlanIds. Obtain explicit overwrite authorization
before publishing either revise or replace. Preserve unselected plans.

Stop before drafting when preparation is blocked. Missing, invalid or unusable
phase context routes to `/blu-discuss-phase`; do not synthesize or repair it.
Enabled research/UI gates require usable saved evidence or an allowed explicit
UI skip rationale. Use optional XX-SPEC.md when present; treat missing
XX-SPEC.md as nonblocking. Never browse live web docs from this command.
Route missing or stale research to `/blu-research-phase` using the tool's safe
action. Honor all effective config gates; disabled gates are explicit skips.

Read evidence bodies when the summaries cannot ground a decision. Prefer mapped
codebase context and exact source paths over broad repository exploration. Use
prepare's evidencePaths to register any additional files actually relied on;
review the refreshed packet before continuing. Changed evidence must be
acknowledged and reconciled against the retained candidate, never silently
replaced with a fresh baseline. Do not reconstruct filesystem paths from guesses.

Give a short Planning Investigation Trace: phase goal, locked constraints,
evidence gaps, anticipated split and highest-risk decision. Preserve material
assumptions and deferrals in the candidate instead of a separate planning report.

## Draft And Save

Draft one coherent candidate plan set against the stable snapshot. Each plan has
a local key, title, goal, scope, tasks, must-haves and dependencies. Tasks name
concrete modified files, read-first files, requirement IDs, implementation
behavior and mechanically checkable acceptance criteria. Use literal paths,
including framework route filenames. Keep task actions specific enough for an
executor to implement without guessing interfaces, values or expected behavior.

MCP derives numeric plan slots, dependency waves, aggregate file lists and
coverage ledgers. Reference another candidate by its local key or a retained
saved plan by numeric ID. Preserve observable outcomes and key wiring in
mustHaves. Keep external services and required setup explicit. Cite evidence
only when actually used; unreferenced inventory must not acquire invented usage.

Prefer vertical slices with disjoint ownership. Split on real dependencies,
verification boundaries or independent features; task/file counts are signals,
not arbitrary reasons to discard a useful plan. Preserve locked decisions at full
fidelity. Explicitly defer excluded work; mentioning a boundary or reading a file
is not authorization to implement changes there.

Submit the entire candidate through `blueprint_plan_submit` with requestId and
expectedRevision as soon as it is available, before semantic review. Raw JSON
text and incomplete objects are recoverable candidates. For long drafts, submit
at meaningful boundaries and continue from the returned revision. Submission
saves the exact original before parsing/validation, then returns diagnostics,
compiled previews and candidateHash. Saved, valid and published are distinct.

Use `blueprint_plan_read` to recover the saved candidate/history after an
interruption. Never transcribe a full unchanged candidate merely to satisfy a
validator. Field corrections create a new revision; correct only affected fields
and preserve unrelated decisions. Use a new requestId for a changed submission;
retry identical arguments with the same requestId after an uncertain response.
See `plan-phase-recovery.md` only when a repair or recovery condition occurs.

## Review

Draft ordinary phases inline. Use blueprint-planner only for useful bounded
planning work, with the compact schema, evidence excerpts/paths, current plan
inventory and locked decisions. The planner returns candidates; the parent owns
MCP persistence. Preserve the no-subagent fallback with the same schema and
quality criteria.

When workflow.plan_check is enabled, review the complete saved candidate with
blueprint-checker. Supply its exact revision, candidateHash, previews, evidence
and prior findings. If unavailable, perform an explicit inline review and report
that fallback honestly. When disabled, state the config skip and omit the review
claim. No checker should repeat deterministic formatting or coverage bookkeeping
already checked by MCP.

Review goal fidelity, requirement sufficiency, concrete actions and acceptance
checks, dependency/ownership coherence, security boundaries, assumptions and
external prerequisites. Semantic contradictions remain blockers even when JSON
is valid. Reading excluded code and documenting deferrals are not scope breaches.

Prefer one review and one targeted repair. Carry forward unaffected decisions and
classify findings as resolved, recurring, new or regressed. If the same blocker
persists, preserve the candidate and report it; do not enter an unbounded loop.
Any candidate edit invalidates the prior verdict. The finalizer review receipt
must carry the current revision and candidateHash, verdict and concrete summary;
never invent checker acceptance or reuse a verdict for different content.

## Publish And Route

Call `blueprint_plan_finalize` for the saved revision. It rechecks required
readiness, evidence/target freshness, full requirement coverage and the complete
prospective plan set. Revise/replace require overwrite authorization. The tool
owns canonical XX-YY-PLAN.md writes, the resumable publication journal, synced
STATE.md and implemented-only next action. Never fall back to raw .blueprint
writes, warn-mode publication, legacy primitive writes or scaffold placeholders.

Until finalization, existing accepted plans remain intact. A pending publication
marker blocks readers/execution from accepting a partially written set. If the
tool returns partial, report the preserved candidate and retry its exact request
rather than generating another plan. Do not hand-edit the marker or journal.

## Completion Criteria

- Evidence and effective config grounded the candidate; saved-plan intent and
  overwrite gates were honored.
- The original candidate is saved and all required fixes are reflected in the
  final reviewed revision.
- Finalizer reports published completion after full plan-set validation, durable
  publication and state synchronization. Candidate saved/valid is insufficient.
- Outstanding blockers or partial publication are stated explicitly, with the
  returned recovery action; do not claim execution readiness.

## Downstream Execution Handoff

Report the phase, saved versus published status, plan IDs, wave order and task
summary. Include evidence gaps, assumptions, verification priorities, deferred
items, external prerequisites and known risks when present. State checker or
inline review outcome (or config-disabled skip), then the returned implemented
next action. Progress updates remain short boundary summaries of scope, stage,
pending gate and next action; internal tool parameters need not clutter the UI.
