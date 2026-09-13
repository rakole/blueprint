# Discuss Phase Runtime Contract

`/blu-discuss-phase` turns phase intent into durable, evidence-backed context.
Execution profile: `long-running-mutation`. Keep visible progress concise:
Prepare → Discuss → Save. While waiting, name the selected phase,
pending choice or blocker, and next safe action. Host visibility helpers are
optional; they never own persistence or completion.

## Prepare once

Call `blueprint_discuss_prepare` with the numeric phase (or omit to resolve it).
Use its selected phase, which can differ from ambientCurrentPhase, throughout.
The packet includes roadmap goal/requirements, effective config, context/spec/log
content and validation, plan inventory, bounded relevant prior context, codebase
evidence, checkpoint, and compact notes session. Prepare also supplies authoring.schema, defaults,
missingEssentialFields, records and examples from the selected evidence. Independent reads are bundled
inside MCP. Do not repeat primitive read/config/contract/checkpoint calls.
A missing directory is seeded only for a proven planned ROADMAP phase through
the existing scaffold owner. Ambiguous or unknown targets stop with the returned diagnostic. Completed phases
cannot seed missing directories; existing phase contexts remain refreshable. Missing optional spec is nonblocking.

Treat saved `XX-SPEC.md` Goal, Requirements, Boundaries, Constraints and Acceptance
Criteria as authoritative WHAT/WHY, including locked numbered requirements.
Ask only missing, conflicting, uncertain, or high-impact choices. If the spec
already answers deliverable shape, focus on approach, reuse, tradeoffs, sequencing,
safety and handoffs. If it is wrong, use `ask_user` to route to
`/blu-spec-phase <phase>`; never silently override contradicted intent in context.

Cite the packet's sources. For an evidence-backed default, inspect the narrow live
source when a saved codebase summary may be stale; add the exact repo-relative
paths with `evidencePaths` in prepare. No broad prior-context or todo/backlog crawl.
Preserve existing-plan refresh warnings: changed decisions may require
`/blu-plan-phase`. Read-set hashes include optional absence and plan inventory;
STATE and canonical publication baselines remain separate.

## Discuss adaptively and save incrementally

Present a small set of evidence-grounded gray areas and let the user pick areas.
Prefer host `ask_user` structured choices where useful. Offer a recommended default
with its source and tradeoff, then ask one focused question at a time. Follow up
only when the answer changes scope, safety, dependencies or implementation.
Let the user choose another area or finish; avoid a fixed checklist interview.
`--assumptions` or effective `workflow.discuss_mode` assumptions mode presents
inferred choices and confidence for correction instead of generic questions.

Save the user-selected gray-area queue as stable open-question records (including
pending questions) before fresh interviewing; resolve or update each by ID as the
area is settled. This preserves remaining areas across sessions.

After each meaningful answer, call `blueprint_discuss_record` with stable record
IDs, a unique requestId and the returned expectedRevision. Include rationale,
evidence, rejected options and unresolved/deferred status without losing nuance.
Only explicit blocking=true unresolved notes prevent publication. downstreamOwner
is optional; do not force an owner or invent filler for an ordinary open question.
Deferred ideas remain durable even when outside this phase. Updates reuse record
IDs; request retries reuse identical requestId and arguments. Never save chat-only
state as if it were durable. Report the save receipt before continuing.

Resolve authoring.missingEssentialFields from evidence or focused user answers before
generating. Use authoring.schema and defaults for one sparse context model; MCP
supplies phase identity, paths, normalized optional sections and Markdown. Empty
optional fields and omission are valid. Do not require a standalone validation
call, a critic pass or a saved draft before writing.

`blueprint_discuss_read` recovers notes, history and publication metadata only.
Generated and rejected documents are not stored. Resume from prepared notes; ask
before replacing substantive decisions. Legacy checkpoints are evidence, not
current truth: reconcile their decisions against the packet and save notes.
Load `discuss-phase-recovery.md` only for changed inputs, targets or interrupted
publication. Preserve prior valid context while resolving blockers.

## Optional bounded research

Use `blueprint-researcher` only if effective config enables workflow.subagents,
its capabilities fit, and a material gray area needs evidence. Honor
workflow.research_before_questions and research.external_sources (off/ask/auto).
One gray area or assumptions pass per sidecar: supply selected phase, relevant
packet excerpts, exact read paths, decision to resolve, evidence expectations and
stop conditions; request a lightweight memo. Parent accepts evidence, asks users,
saves records and routes. Without a suitable enabled agent, inspect the same narrow
evidence directly, state the fallback and continue one area at a time. Never
substitute generic web/browser/shell-only agents or broaden write scope.

## Finalize and report

When answers are ready, generate once and call `blueprint_discuss_finalize` with
model, the current expectedRevision and a new requestId. MCP derives a log from record history
when multiple records, revisions or rejected options warrant it. includeLog is an
explicit preference override; never author the log as model-written Markdown.
Require explicit user confirmation before overwrite=true replaces substantive
context/log; scaffold replacement needs no overwrite gate. Blueprint manages only
phase `XX-CONTEXT.md`, never repo-root `CONTEXT.md`.

Finalize owns validation, fresh-evidence checks, canonical context/log writes,
synced selected-phase state update, refreshed routing, and guarded checkpoint
cleanup. Do not duplicate these calls. Report saved and outcome distinctly:
rejected-not-saved means the generated document was not saved;
saved-but-state-incomplete means context exists but completion needs recovery;
complete means all publication stages finished. Never describe partial results as
complete. Before context commits, a retry needs the model again. After it commits,
the same requestId can resume without model; MCP verifies canonical hashes before
finishing state and cleanup. Notes remain resumable in either case.

Receipt: selected phase, MCP-returned context/log paths, covered decisions and
remaining deferred items, warnings/blockers, and exactly the returned
`nextAction` (derivedStatus.nextAction). Do not substitute a memorized route.
