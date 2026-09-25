# `/blu-plan-phase` Runtime Contract

Turn saved phase requirements, decisions and research into executable plans.
Prepare the authoring information first, generate one complete model, review it
when configured, then publish it directly. Rejected documents are never stored.

## Prepare

Call `blueprint_plan_prepare` first. Consume its phase identity, context/research/UI
gates, effective config, evidence, existing plans, revision, schema, example and
validation rules; do not repeat primitive MCP reads or request the legacy schema.

If existing plans require a choice, ask for add, revise or replace. Explicit
additive intent is sufficient for add. For revise, select targetPlanIds; replace
defaults to the whole saved set or explicitly selected targetPlanIds. Obtain
explicit overwrite authorization for revise/replace. Preserve unselected plans.

Stop before drafting when readiness blocks. Missing or unusable context routes to
`/blu-discuss-phase`; treat context as read-only. Honor all effective config gates.
Use optional XX-SPEC.md when present; treat missing XX-SPEC.md as nonblocking.
Required missing/stale research routes to `/blu-research-phase`. Use saved research;
planning performs no live browsing. Disabled gates are explicit skips.

Resolve missing essential intent before generation. Prefer `task.readFirst`, known
live targets, and compact parent evidence. When repository discovery remains
unresolved, use prepare's optional `portableSelections` and `evidenceDelivery`
controls for selected portable evidence, without automatically loading all seven
compatibility views to enrich a valid portable map. Missing or unusable maps keep the existing bounded source path. Read
truncated evidence when needed and register additional relied-on paths through
prepare. Changed evidence must be acknowledged and reconciled against affected
decisions. Follow returned paths and safe actions. Give a short Planning Investigation Trace: phase goal,
locked constraints, evidence gaps, anticipated split and highest-risk decision.
Keep material assumptions in the model rather than a separate planning report.
Use `full` for initial/unbound bodies, `delta` only for new or changed bodies
relative to accepted delivery, and `register` only for an already-bound same
hash or a hash computed from bytes read now. Without that proof, reread or
request a bounded MCP excerpt; never treat an unknown earlier read as fresh.

## Author And Review

Author the complete plan set using prepare's schema and example. Supply titles,
goals and tasks with concrete modified files, known requirement IDs, implementation
actions and mechanically checkable acceptance criteria. Use faithful multiline
prose or code when useful. No exact empty sentinel or optional-section padding is
needed. Omit fields the runtime derives; do not copy example claims as evidence.

MCP derives numeric plan slots, dependency waves, aggregate file lists and coverage
ledgers. Name a local key when another new plan depends on it; retained saved plans
use numeric IDs. Keep external services and setup explicit. Cite evidence only
when used; unreferenced inventory must not acquire invented usage. The prepared
schema enumerates allowed requirement IDs and phase-artifact citation paths. Put
repository source references in task.readFirst; evidence uses knownEvidenceArtifacts.

Prefer vertical slices with disjoint ownership and real dependency/verification
boundaries. Task/file counts are guidance. Preserve locked decisions at full
fidelity. Reading excluded code and documenting deferrals are not scope breaches.
All required phase outcomes must be assigned to tasks before publication.

Draft ordinary phases inline. Use blueprint-planner only for bounded decomposition
that helps; preserve the no-subagent fallback with the same schema and evidence.
The planner returns a model to the parent and owns no persistence.

When workflow.plan_check is enabled, give blueprint-checker the complete model,
evidence and prior findings before submission. If unavailable, perform an explicit
inline review and report that fallback honestly. When disabled, state the config
skip. Review goal fidelity, requirement sufficiency, action/acceptance quality,
dependencies, ownership, security, assumptions and external prerequisites. Leave
formatting and derived bookkeeping to MCP. Semantic contradictions remain blockers.

Prefer one review and one targeted repair. Carry forward unaffected decisions and
classify findings as resolved, recurring, new or regressed. Any model edit
invalidates acceptance for affected content and interactions. Do not invent review
acceptance or loop on identical findings. Submit the actual reviewed model with
review.verdict and review.summary; no caller-computed hash is required.

## Publish And Route

Call `blueprint_plan_submit` with model, requestId and prepare's expectedRevision,
plus the configured review and authorized overwrite flag. It normalizes harmless
formatting, validates the prospective full set in memory and publishes canonical
XX-YY-PLAN.md files. It owns fresh evidence/target checks, state synchronization and
implemented-only routing. No separate validation, draft-save or finalize call is
needed. Never fall back to raw .blueprint writes, warn-mode publication, legacy
primitive writes or scaffold placeholders.

If rejected, saved:false means no new PLAN document was written. Existing accepted
plans remain intact. Fix diagnosed fields in the model in conversation and retry
at the same revision. Rejected models, rendered drafts, diagnostic prose and
document history are not retained in sessions or failure logs.

A pending publication marker blocks readers/execution from accepting a partial
set. An accepted publication has a metadata-only journal. On partial failure,
report which canonical files were saved and follow the returned retry instruction:
resend the same model while any required file is unwritten; omit it only after all
intended files are present. Retry identical control arguments with the same
requestId. See `plan-phase-recovery.md` only when a conflict or interruption occurs.

## Completion Criteria

- Required evidence, effective config, saved-plan intent and overwrite gates were
  honored; the submitted model is complete and reviewed when configured.
- Submit reports published completion after full plan-set validation, canonical
  publication and state synchronization. A partial saved result is insufficient.
- Report unresolved blockers and the returned recovery action without claiming
  execution readiness.

## Downstream Execution Handoff

Report phase, publication status, plan IDs, wave order and task summary. Include
evidence gaps, assumptions, verification priorities, deferred items, external
prerequisites and known risks when present. State review outcome or config skip,
then the returned implemented next action. Keep progress updates concise.
