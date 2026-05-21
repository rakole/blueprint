# Discuss Phase Runtime Contract

This reference is the rich behavior contract for `/blu-discuss-phase`. The
canonical artifact schema still comes from `blueprint_artifact_contract_read`
with `artifactId: "phase.context"` and, when used, `artifactId:
"phase.discussion-log"`. Treat this file as orchestration and evidence-density
guidance, not a competing markdown schema. Keep the split explicit: scaffold
output seeds a missing file, `phase.context.modelContract` governs the saved
context artifact, and `authoringTemplate` governs saved freehand artifacts such
as `phase.discussion-log`.

Use `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
for the shared `long-running-mutation` stage vocabulary, in-flight status
fields, session-local helper policy, and host-supported structured choice
guidance.

## Objective And Authority Boundary

`/blu-discuss-phase` must behave like a Blueprint-native thinking partner, not a
thin questionnaire. It should extract implementation decisions that
`/blu-research-phase`, `/blu-ui-phase`, and `/blu-plan-phase` can consume
without asking the user to repeat themselves.

The retained behaviors that matter are:

- prior-context sweep before fresh questions
- phase-specific gray-area discovery
- evidence-backed assumptions when the repo can answer part of the question
- user choice over which gray areas to discuss
- adaptive follow-ups until the current area is clear
- scope-creep capture as deferred ideas, not silent loss
- checkpoint-per-area resumability
- canonical reference accumulation
- validation and repair before the discussion is treated as complete

## Required MCP Read Sequence

Before asking fresh questions, call `blueprint_phase_context` first. Use
`phaseSelection` as the selected-phase authority when it is found and includes
phase number, prefix, and dir. Build a compact evidence packet from:

- `blueprint_phase_context`: phase boundary, project brief, requirements
  grounding, workflow posture, mapped codebase summaries, existing artifact
  signals, and `phaseSelection`
- `blueprint_roadmap_read`: phase title, objective, success criteria,
  requirement links, and any canonical refs already written into the roadmap
- `blueprint_artifact_list`: current artifact inventory
- `blueprint_config_get`: `workflow.discuss_mode`,
  `workflow.skip_discuss`, and `workflow.research_before_questions`
- `blueprint_phase_artifact_read`: current context, discussion log, and
  earlier phase context artifacts that match the Prior-Context Relevance Rule
- when the current context is a fresh starter seeded by `/blu-new-project`,
  `/blu-add-phase`, or `/blu-insert-phase`, read the starter handoff packet
  inside that starter context as seed evidence before asking new questions
- `blueprint_phase_checkpoint_get`: resumable in-progress decisions
- `blueprint_phase_plan_index`: saved plans that will not be rewritten by new
  context unless the user later reruns `/blu-plan-phase`
- `blueprint_artifact_contract_read`: `phase.context` before context model
  authoring and `phase.discussion-log` before discussion-log drafting

Use `blueprint_phase_locate` when `phaseSelection` is missing, ambiguous,
lacks number/prefix/dir, or lacks `reason` plus `recovery`. If
`phaseSelection.found` is false with those diagnostics, report them without
another locate call. Keep locate available; do not guess phase directories,
slugs, or paths.

Read saved `.blueprint/codebase/` summaries before broad repo rereads. If the
bundle is missing or thin, say so and do targeted local reading only where it
sharpens the current phase discussion.

### Same-Turn Read Batching

At each Resolve or Read stage, identify Blueprint MCP reads whose arguments are
already known and whose results do not choose another call's arguments. Request
those independent read-only calls together in the same model response/tool-call
turn, using runtime FQNs, before analyzing results or drafting. Do not narrate
between independent read calls.

| Boundary | Rule |
|----------|------|
| Before selected phase is known | Do not batch reads that require phase id/path, artifact id, checkpoint owner/mode, or recovery data. |
| After `phase_context.phaseSelection` is usable | Batch independent reads whose arguments are known: effective config, roadmap read, artifact inventory, current context/log reads, discuss checkpoint status, plan inventory, and `phase.context` contract read. |
| After a user answer or before persistence | Do not batch checkpoint writes, context writes, discussion-log writes, validation repair, state updates, final route load, checkpoint deletion, or confirmation prompts. |

Dependent reads stay in later turns when a prior result chooses the selected
phase, artifact id, plan id, overwrite/reuse decision, validation repair, write
payload, or routing state. If the host cannot batch tool calls, proceed with the
same dependency order one call at a time. Do not batch writes, user
confirmations, validation repair, state updates, or checkpoint deletion.

## Selected Phase Read Packet

After `blueprint_phase_context.phaseSelection` succeeds, create a run-local
selected-phase register:

- `selectedPhase`: `String(phaseSelection.phaseNumber)`
- `selectedPhasePrefix`: `phaseSelection.phasePrefix`
- `selectedPhaseDir`: `phaseSelection.phaseDir`
- `selectedPhaseResolvedFrom`: `phaseSelection.resolvedFrom`

Use `selectedPhase` for every phase-scoped read, checkpoint read/write/delete,
scaffold path, artifact write, and final `patch.currentPhase`. Treat any
state-derived current phase returned by later reads as `stateCurrentPhase`, an
ambient routing signal, not a replacement for `selectedPhase`.

If `phaseSelection` is not usable but includes `reason` plus `recovery`, stop
before artifact reads/writes and report them. Call `blueprint_phase_locate` once
only when context lacks recovery detail. If locate returns `found: false`, stop
before artifact reads/writes and report `reason` plus `recovery`.

### Minimum Read Order

1. Call `blueprint_phase_context` first.
2. If `phaseSelection` is not usable but includes `reason` plus `recovery`, stop
   with those diagnostics. Otherwise call `blueprint_phase_locate` as the
   fallback and stop when locate cannot identify one phase.
3. Using `selectedPhase`, request the independent reads still needed before the
   first question in the same model response/tool-call turn when the host
   supports it: `blueprint_roadmap_read`, `blueprint_artifact_list`,
   `blueprint_config_get`, current `context`, current `discussion-log`, the
   discuss checkpoint with owner/mode guards, plan inventory, and the
   `phase.context` artifact contract. Include only calls whose arguments are
   already known.
4. Read the `phase.discussion-log` contract only after a trigger in
   Discussion Log Triggers is present or the user requests a durable log.
5. Read earlier phase context only when the relevance rule below matches.

### Prior-Context Relevance Rule

Read prior context only when one of these criteria matches the selected phase:
shared roadmap requirement id, shared canonical reference, deferred idea carried
into this phase, same codebase surface, same MCP tool family, same lifecycle
gate, or explicit dependency language. Default maximum: the nearest prior
matching phase plus any phase explicitly named by ROADMAP or saved context.
Read more only when a unique high-impact dependency would otherwise be hidden
or the user asks for a broader comparison. If no criterion matches, say no
earlier context was reused instead of doing a broad sweep.

### Minimum Evidence Packet

Before the first fresh user question, summarize these fields and no extra
inventory dump: selected phase, phase resolution source, `stateCurrentPhase` if
different, config mode (`discuss`, `assumptions`, or `skip_discuss`), context
status, discussion-log status, checkpoint status, prior context reused/skipped,
codebase-summary status, artifact inventory status, plan-inventory warning, and
artifact-contract status.

### Starter Handoff Intake

When the selected phase was just scaffolded by `/blu-new-project`,
`/blu-add-phase`, or `/blu-insert-phase` and the current `XX-CONTEXT.md`
contains starter-only material, treat its starter handoff as disposable seed
evidence:

Read the packet before fresh questions. Map source refs to
`canonicalReferences` or `dependencies.requiredFollowUpReads`; map deferred
risks, consequence-if-wrong notes, and open gray areas to `openQuestions`,
`deferredIdeas`, or evidence-backed `implementationDecisions`. Ask only for
missing, contradictory, uncertain, or high-impact details that still change the
implementation result.

Do not preserve the starter packet heading, scaffold footer, placeholder
labels, unsupported claims, or raw handoff text verbatim in the final saved
`XX-CONTEXT.md`.

## Artifact Status Classification

Classify current artifacts before questioning:

| Status | Meaning |
|--------|---------|
| `missing` | No artifact file exists |
| `scaffold-starter` | File exists but contains only scaffold/seed content |
| `authored-substantive` | File contains real authored content |
| `validation-suspect` | File exists but failed or may fail validation |
| `unreadable` | File exists but cannot be parsed or read |
| `safe-checkpoint` | Checkpoint exists with matching owner/mode |
| `foreign-checkpoint` | Checkpoint exists but owner/mode mismatch |
| `stale-plan-inventory` | Saved plans exist that may not reflect current context |

The classification controls the next gate:

- `missing` or `scaffold-starter` -> fresh discovery
- `authored-substantive` -> overwrite confirmation gate
- `validation-suspect` -> repair or overwrite confirmation
- `unreadable` -> report and route to fresh discovery
- `safe-checkpoint` -> resume-versus-discard gate
- `foreign-checkpoint` -> treat as non-resumable evidence only
- `stale-plan-inventory` -> warn before context rewrite

## Checkpoint And Resume

Write or refresh only structured checkpoint v2: `schemaVersion: 2`,
`ownerCommand: "/blu-discuss-phase"`, top-level `mode: "discuss"`,
`progress`, `areaQueue`, `carryForward`, and `readSet`. Do not write
compatibility summary fields such as `completedAreas`, `remainingAreas`,
`decisions`, `deferredIdeas`, `canonicalReferences`, or `resumeMeta`.

### Checkpoint Persistence Frequency

Persist after every user answer and after every gray-area boundary. A
checkpoint is resume-ready only when the active area has a stable `areaId`,
state, current question or blocking reason, evidence refs, and the last
accepted user answer or assumption. Do not infer these from the chat
transcript.

### Area States

Area states are `questioning`, `assumed`, `decided`, `blocked`,
`needs-revisit`, and `unseen`. Resume must not re-ask an area whose
`resolutionCriterion` was already met unless new evidence contradicts it.

### Checkpoint V2 Shape

The MCP checkpoint schema is v2-only for new writes. The `areaQueue` is the
semantic source of truth; legacy compatibility summary fields are non-resumable
evidence and must not be written.

Required checkpoint fields:

- identity: `schemaVersion: 2`, `ownerCommand: "/blu-discuss-phase"`,
  top-level `mode: "discuss"`, and selected phase key or number
- `progress`: active stage, pending gate, execution mode, decided/total counts,
  and next action preview
- `areaQueue`: ordered gray-area entries with `areaId`, `title`, `state`,
  evidence refs, downstream consumers, and either a decision/assumption,
  current question, blocking reason, or revisit trigger
- `carryForward`: compact handoff context with phase boundary, active area,
  completed decisions, open questions, deferred ideas, canonical references,
  evidence refs, contradictions, omitted details, and do-not-infer-beyond notes
- `readSet`: roadmap/context/config/plan-index/artifact-contract inputs with
  path plus fingerprint or `updatedAt` when available

Tiny schematic:

```text
checkpoint v2 -> identity + progress
  areaQueue[areaId,state,evidenceRefs,currentQuestion|decision|blockingReason]
  carryForward[phaseBoundary,completedDecisions,openQuestions,deferredIdeas]
  readSet[path,fingerprint|updatedAt]
```

Before each next question or sidecar handoff, keep compact `carryForward` in
the checkpoint: phase boundary, active area, completed decisions, open
questions, deferred ideas, canonical references, evidence refs,
contradictions, omitted details, and do-not-infer-beyond notes. Copy the final
version into `XX-DISCUSSION-LOG.md` only when the log triggers below apply.

On resume, read with `expectedOwnerCommand: "/blu-discuss-phase"` and
`expectedMode: "discuss"`. If `safeToResume` is false, ask resume-versus-
discard using the warnings. If true, pick the first area in this order:
`questioning`, `blocked`, `needs-revisit`, then `unseen`. Never reconstruct
the queue from legacy summary prose.

`readSet` lists roadmap/context/config/plan-index/artifact-contract inputs
with path plus fingerprint or `updatedAt` when available. Changed inputs route
affected areas to `needs-revisit`.

Delete the checkpoint only after context write, optional discussion-log write,
synced state update, and follow-up state load all succeed. Pass
`expectedOwnerCommand: "/blu-discuss-phase"` and `expectedMode: "discuss"` so
cleanup cannot delete another command's checkpoint. If context write,
discussion-log write, state update, state load, validation repair, or guarded
checkpoint delete finalization fails, leave the checkpoint in place and report
the exact continuation blocker. After successful delete, the final response
and optional log should say which areas were decided, assumed, or left open
and where those facts landed in `XX-CONTEXT.md` or `XX-DISCUSSION-LOG.md`.

## Gray Area Identification

Generate gray areas from the phase, not from generic categories. Each gray area
should name a decision that would change the implementation result.

Useful lenses: scope boundary, user-visible behavior, interface contract,
reuse, dependencies, risk/failure handling, methodology, and routing.

Skip areas already locked by prior context unless the current phase introduces a
real conflict. When reusing a prior decision, cite the artifact that locked it.

## Gray Area Queue

Before asking the user anything, build a compact `grayAreaQueue`. It is working
state and checkpoint context, not a competing artifact schema.

For obvious low-risk areas, use the simple gray-area fast path: `areaId`,
`title`, `state`, `candidateQuestion`, `decisionValue`, `downstreamImpact` or
`resolutionCriterion` when useful, and `evidence` only when actual source
exposed the gap. Do not require `slot`, `defect`, or `lens` classification for
every simple queue entry.
The queue still must explain the decision, why it matters, and what answer lets
discussion continue.

Use the full gray-area taxonomy for complex sessions: multiple ambiguous areas,
unclear boundaries, contradictory evidence, high downstream risk, routing
uncertainty, or any case where the simple path does not explain why the question
matters. Full entries may include `slot` (actor, action-task, object-concept,
attribute, goal, event, constraint, exception, external-interface,
quality-attribute, acceptance-verification), `defect` (ambiguous, incomplete,
inconsistent, unverifiable, tradeoff), `lens`, `evidence`, `downstreamImpact`,
`decisionValue`, `resolutionCriterion`, and `candidateQuestion`.

For complex sessions, classify each gray area by requirement slot first, then by
Blueprint lens.
Example: `slot=external-interface`, `lens=interface-contract`,
`defect=incomplete`, `impact=plan+validation`: "The roadmap says sync to
GitHub, but no payload, auth, or failure contract is known."

### Stop Criteria

An area is resolved when one of these is true:

1. A user answer or evidence-backed assumption maps to a concrete
   `implementationDecisions` entry with rationale and evidence.
2. The unknown is intentionally recorded in `openQuestions` with owner or
   downstream consumer and no longer blocks the current context write.
3. The unknown is routed to `research`, `ui`, or later planning with the exact
   follow-up read or artifact dependency recorded.
4. The idea is out of scope and captured under `deferredIdeas`.

Stop asking when all high-decision-value areas are resolved by one of those
paths and remaining low-value details would not change the next safe action.

### Model-Authoring Bridge

Every resolved high-value area must appear in the final `phase.context` model
as an `implementationDecisions` row, a `dependencies` item, an `openQuestions`
item, a `deferredIdeas` item, or a `canonicalReferences` source. If none of
those fields receives the area, the discussion is not ready to write.

Starter-handoff seed evidence must follow the same rule. Source refs,
deferred risks, and open gray areas are useful only after they are mapped into
those canonical `phase.context` fields; copying packet labels or packet prose
does not count as carry-forward.

### Anti-Generic Question Rule

Do not ask checklist or atmosphere questions such as "Any other requirements?",
"What should we consider?", or "What are your preferences?" unless the question
is tied to a named `grayAreaQueue` entry, cites the evidence gap, and states
what downstream decision the answer will change.

## Questioning Rules

Use `ask_user` for structured tradeoffs, overwrite confirmation,
resume-versus-discard, gray-area selection, and readiness-to-write gates when
the host provides it. Prefer one focused question at a time.

Good options are concrete and code-informed:

- mention existing reusable assets or missing patterns
- include the recommended option first when there is a clear default
- include an agent-discretion option only when downstream planning can safely
  decide the detail
- keep custom-answer or freeform escape available

Do not ask checklist questions. Start broad enough to learn the user's intent,
then dig into the area that actually changes the implementation.

Ask only for missing, contradictory, uncertain, or high-impact details once the
read packet and any starter handoff evidence are in hand.

Do not describe same-turn read batching as a power, chain, auto, or
auto-advance mode. It is only a request shape for independent read-only MCP
calls whose arguments are already known.

### Decision-Value Ranking

Ask the highest-decision-value unresolved question next. A question is high
value only when the answer can change phase boundary, implementation approach,
acceptance/verification hooks, safety/security posture, artifact routing, or
required `phase.context` fields. If the answer would only add color, record
it as a deferred idea or optional note instead of interrupting.

### One-Question Format

Use this format for interactive `ask_user` calls:

```text
Question: <one concrete phase-specific decision>
Why it matters: <which context field, downstream command, or routing gate this unblocks>
Known evidence: <repo path/MCP result/user source>
Recommended option: <safe default, only when evidence supports one>
Other options: <2-3 concrete alternatives plus freeform escape>
Resolved when: <exact criterion that lets the agent checkpoint or move on>
```

## Assumptions Mode

When `workflow.discuss_mode="assumptions"`, prefer evidence-first assumptions
over interview-style questioning:

- state each assumption as a decision downstream agents can use
- cite repo paths, saved artifacts, or official supplied references
- state the consequence if the assumption is wrong
- mark confidence as `Confident`, `Likely`, or `Unclear`
- ask the user only to correct uncertain or high-impact assumptions

Confirmed or corrected assumptions become implementation decisions in the final
context. The discussion log should preserve assumptions presented, corrections,
and any external or supplied-reference evidence used.

### Assumption Record Shape

Assumption record:

- **Area**: gray-area id this resolves
- **Decision default**: the assumed answer
- **Evidence**: repo paths, saved artifacts, MCP results
- **Evidence grade**: `repo-observed` | `repo-inferred` | `saved-artifact` |
  `user-stated` | `official-external` | `research-secondary` | `assumption` |
  `contradicted` | `unknown`
- **Confidence**: `Confident` | `Likely` | `Unclear`
- **Competing interpretations**: other viable readings
- **Contradictions checked**: conflicts found or "none found"
- **Consequence if wrong**: downstream impact
- **Ask/reopen rule**: condition that should trigger re-asking
- **Downstream status**: `plan-safe` | `research-needed` | `ui-needed` |
  `user-confirmation-needed`

### Confidence Label Definitions

- **Confident**: Direct repo/runtime or saved Blueprint evidence supports the
  default, no material contradictory evidence was found, and the consequence
  if wrong is low or easily corrected.
- **Likely**: The default follows from a consistent repo pattern or prior
  artifact but lacks direct confirmation, or the consequence if wrong is
  moderate and must be visible to downstream planning.
- **Unclear**: Evidence is thin, conflicting, stale, externally inferred, or
  the consequence if wrong is high. Do not lock as plan-safe; ask the user
  or route to research/UI/user confirmation.

### Ask-Versus-Assume Threshold

Ask instead of assuming when the answer changes phase scope, public behavior,
data/contracts, security/privacy, migration or deletion behavior, acceptance
criteria, command routing, or whether a downstream research/UI gate is
required.

Assume only when the evidence is repo-grounded, internally consistent, low
blast-radius, and the final context can label the default as reversible.

When a starter handoff or repo evidence already names a consequence-if-wrong,
do not leave that assumption floating. Either confirm it with the user,
convert it into an evidence-backed `implementationDecisions` entry, or keep it
explicit in `Open Questions` or `Deferred Ideas`.

### Contradiction Handling

When evidence conflicts, preserve the conflict instead of smoothing it. For
current Blueprint runtime behavior, prefer live MCP output and repo source
over saved docs. For desired product intent, prefer the user's current answer
over older artifacts. If the conflict changes implementation shape, ask the
user; if it changes technical feasibility or external correctness, route to a
`research-needed` assumption.

### Sidecar Bounds For Assumptions

Ask `blueprint-researcher` for one assumptions pass only when configured and
useful. It must return defaults grouped by gray area, direct repo paths or
supplied official references, confidence labels using this contract,
contradictions or missing evidence, and the smallest question that would
change each default. It must not draft `phase.context` or mark `Unclear`
defaults as decisions.

### Skip-Discuss Safety

When `workflow.skip_discuss=true`, the same safety rules apply: produce
evidence-backed context, label defaults, and stop or ask when high-impact
assumptions remain unresolved. Skip-discuss may reduce interview turns but
must not silently convert thin evidence into saved context.

## Capability-Gated Agent Use

Use subagents only when the host exposes suitable Blueprint agents and the work
benefits from isolated reading or comparison. Never require a subagent for
correctness.

Suitable uses:

Use `blueprint-researcher` only for one gray area or one assumptions pass when:
at least two viable options remain, an option changes scope or downstream
routing, and isolated repo or supplied-reference reading can add citations
before the next user question. It must return defaults or options grouped by
gray area, citations, confidence labels, contradictions or missing evidence, and
the smallest question that would change each default.

Agent prompts must pass only the compact phase boundary, relevant saved
context, and canonical references for that area. Ask for gray-area memo mode,
not `phase.research` or an `XX-RESEARCH.md` draft. The parent command owns
synthesis, user-facing questions, checkpoints, artifact writes, and state
updates.

If no suitable subagent exists, or if the host disallows subagents, use the
single-agent fallback below without lowering artifact quality.

## Single-Agent Fallback

The main agent must be able to complete the whole workflow one discussion area
at a time:

1. Pick the next selected gray area.
2. Compress carry-forward context to these packet fields: selected phase and
   phase boundary, active area id/title/state, applicable prior decisions,
   codebase evidence, canonical refs, completed decisions, open questions,
   deferred ideas, contradictions, do-not-infer-beyond notes, and the current
   unanswered question or blocker.
3. Ask one focused `ask_user` choice or freeform follow-up.
4. Validate the answer. If it is empty, vague, or conflicts with saved context,
   retry once with a narrower question or ask a focused follow-up.
5. Record a rich decision with the question, selected answer, options considered,
   rationale, evidence paths, assumptions made, consequences if wrong, and any
   canonical references.
6. Summarize progress briefly, then move to the next area or ask whether more
   questions are needed for the current area.

This fallback is the required behavior, not a degraded emergency path.

## Context Model Readiness

Before writing `phase.context`, build a readiness ledger:

| field | source basis | confidence | unresolved risk | downstream consumer |
|-------|-------------|------------|-----------------|---------------------|

Every required field must be evidence-backed, user-confirmed, or explicitly
assumption-backed. Do not write the model while any field is scaffold-derived,
source-free, or contradicted without an `openQuestions`, `dependencies`, or
`deferredIdeas` entry.

Every resolved high-value gray area must appear in the final `phase.context`
model as an `implementationDecisions` row, a `dependencies` item, an
`openQuestions` item, a `deferredIdeas` item, or a `canonicalReferences`
source. If none of those fields receives the area, the discussion is not
ready to write.

### Claim-Linked Evidence

Because the current `phase.context` schema has no separate per-claim evidence
object, include evidence anchors inside durable values when useful. Prefer:

"Keep execution resumability checkpoint-owned because
tests/phase-discovery-discuss.test.ts covers checkpoint survival after
invalid context writes."

Avoid disconnected source lists such as:

"Implementation is straightforward and tests should be added."

### Context Quality Anti-Example

Weak: "Implementation is straightforward and tests should be added."

Better: "Planning must preserve checkpoint deletion after context write,
optional discussion-log write, synced STATE update, and state reload; the
runtime contract names this order and tests assert it."

## Artifact Authoring

The `phase.context` model contract is the schema authority. Populate every
model field with concrete content and let MCP render `XX-CONTEXT.md`. If a
missing file is first seeded from `blueprint_artifact_scaffold` or a future
`scaffoldTemplate`, treat that seed as throwaway starter material to replace
with model-rendered Markdown, not as text to preserve:

The saved phase context artifact is `XX-CONTEXT.md` for the resolved phase.

Use the live `modelContract` field names and required sections. Preserve these
semantics without restating the full schema: phase boundary, discovery
grounding, implementation decisions with rationale/evidence, specific ideas,
existing code insights, dependencies and follow-up reads, open questions,
deferred ideas, and canonical references. When no open questions remain, save
`openQuestions: []` so MCP renders exactly `- none` in Markdown.
`openQuestions: ["none"]` remains compatibility-only for older model inputs; do
not pass scalar `openQuestions: "none"`.

Prefer rich model values over terse labels. A downstream researcher or planner
should understand what was decided, why, what evidence supports it, and where to
look next. The final artifact must be renderer output and must not preserve
literal scaffold headings, placeholder bullets, example filler, or "replace me"
instructions.

Starter-handoff packet labels such as `Source refs`, `Deferred risks`, `Open
gray areas`, `researchBrief`, `uiBrief`, `planBrief`, `planInventory`, or
`routingGates` are intermediate labels only, not required fields or final
headings. Map their substance into existing `phase.context` fields and reject
verbatim packet copy.

Write `XX-DISCUSSION-LOG.md` when it adds durable value beyond the context,
especially for multi-area sessions, assumptions-mode corrections, advisor-style
comparison tables, or compliance/audit needs.

## Discussion Log Triggers

Write `XX-DISCUSSION-LOG.md` when any trigger is true:

- More than one gray area was discussed or resumed
- Assumptions mode presented defaults that were accepted, corrected, or
  rejected
- user direction changes must be logged when they alter scope, options, or
  rationale
- The user changed direction, rejected an option, or supplied rationale not
  fully represented in `phase.context`
- A contradiction, plan-inventory warning, compliance/audit concern, or
  deferred follow-up needs reconstruction later

Skip the log only when one straightforward area was resolved and the final
`phase.context` preserves all decisions, sources, and follow-ups.

### Discussion-Log Content Expectations

The log complements, not duplicates, `XX-CONTEXT.md`:

- `Summary`: decision arc and outcome
- `Notes`: corrections, rejected options, evidence snippets, assumptions
  corrections, and review results; preserve assumptions corrections explicitly
- `Follow-Ups`: concrete later actions or the reason none remain

### Assumptions Review Block

When assumptions mode was used, include:

Presented assumption, user correction, evidence changed, final disposition
(`accepted`, `corrected`, or `rejected`), and downstream impact.

## Downstream Context Mapping

Before final validation and routing, turn downstream-relevant substance from
the saved context model, checkpoint decisions, plan index, effective config,
and artifact inventory into existing `phase.context` fields. Do not create a
handoff schema field, new artifact, runtime behavior, or pass the raw
conversation transcript downstream.

Use this mapping:

- research unknowns, evidence needs, source policy, stop conditions, and
  unresolved research questions -> `openQuestions`, `dependencies`, and
  `canonicalReferences`
- UI applicability, users, journeys, surfaces, constraints, and no-UI skip
  rationale candidates -> `specificIdeas`, `implementationDecisions`,
  `openQuestions`, `deferredIdeas`, and `phaseBoundary` where present
- initial/desired state, forbidden moves, validation oracle, non-goals,
  accepted assumptions, rejected options, and planning risks ->
  `implementationDecisions`, `dependencies`, `openQuestions`,
  `deferredIdeas`, and `existingCodeInsights`
- saved plan IDs/paths, dependency gaps, stale-plan warning, and whether
  `/blu-plan-phase` must be rerun -> `dependencies`, `canonicalReferences`,
  and `openQuestions`
- selected phase, research/UI booleans, artifact statuses, refreshed next safe
  action, and `/blu-progress` fallback -> final response routing text only,
  plus `phaseBoundary` or `dependencies` when they are phase-context facts

### Stale-Plan Warning

When `blueprint_phase_plan_index.plans.length > 0`, include this warning
in `dependencies` or `openQuestions` and the final response:

> Existing saved plans were not rewritten by this refreshed discussion;
> rerun `/blu-plan-phase <selectedPhase>` before trusting plan content that
> depends on the new context.

For UI applicability, record one of these meanings in the relevant existing
field: UI work is needed; discuss captured a skip-rationale candidate but
`/blu-ui-phase` must still confirm or formalize it; or UI applicability is
unknown. Unresolved high-impact ambiguity stays in `openQuestions` or
`dependencies`, not as a silent plan premise.

## Validation And Repair

Before treating the discussion as complete:

1. Build a `phase.context` model against the live `modelContract`; normalize
   any discussion log to the live `authoringTemplate`.
2. Self-check for placeholder text, empty required sections, contradiction with
   prior saved context, missing canonical references, unsupported mode claims,
   dropped deferred ideas, dropped deferred risks, preserved scaffold literals,
   preserved packet headings or placeholder labels, verbatim handoff packet
   text, and plan-inventory warnings that were not carried forward. If `Open
   Questions` has no unresolved items, save `openQuestions: []` so MCP renders
   the canonical `- none` line instead of expanding it into filler prose.
3. Call `blueprint_phase_artifact_write` in strict mode. If it returns
   `status: "invalid"` or validation issues, repair the same model or draft
   from returned issues and retry before claiming success. Treat returned
   `path` as the authoritative saved filename.
4. If a discussion log is written, apply the same read, normalize, write, and
   repair loop for `phase.discussion-log`.
5. After the final context artifact and any optional discussion log write
   successfully, call `blueprint_state_update` with `base: "synced"` and keep
   the already resolved selected phase in `patch.currentPhase` together with
   `patch.activeCommand`. Do not rely on roadmap-derived phase selection and do
   not treat the update response as the routing decision.
6. Call `blueprint_state_load` after the synced update and report the refreshed
   next safe action from the loaded state, falling back to `/blu-progress` when
   routing is missing, blocked, or undecidable.
   Do not infer `/blu-plan-phase` only because context capture succeeded; when
   normalized config still requires research or UI, the loaded
   `derivedStatus.nextAction` must continue to point to `/blu-research-phase`
   or `/blu-ui-phase` and the final response must preserve that handoff.

## Final Routing

Route only from the post-write `blueprint_state_load` result:

1. Call `blueprint_state_update({ base: "synced", patch: { currentPhase:
   selectedPhase, activeCommand: "/blu-discuss-phase" } })`.
2. Call `blueprint_state_load`.
3. Copy `derivedStatus.nextAction` exactly as the next safe action.
4. If the loaded action is missing, blocked, or not a Blueprint command, say:
   "Run /blu-progress to review the next safe Blueprint action."
5. Do not include secondary runnable routes unless a future contract
   explicitly adds `blueprint_command_catalog` to this command's allowlist
   and tests.

### State Warning Preservation

Surface non-empty routing-relevant warnings returned by `blueprint_state_update`
or the final `blueprint_state_load` in the final response. If neither result
returns a routing-relevant warning, do not invent warning categories or audit
state warning families.

## Final Response Shape

Final response shape:

- **Saved**: context path, optional discussion-log path, reused/replaced
  status.
- **Checkpoint**: deleted, retained with reason, or no checkpoint.
- **Context carry-forward**: one-line summary of downstream-relevant entries
  saved in `implementationDecisions`, `dependencies`, `openQuestions`,
  `deferredIdeas`, `canonicalReferences`, `specificIdeas`,
  `existingCodeInsights`, and `phaseBoundary` where present, including the
  stale-plan warning when plans already exist.
- **Next safe action**: exact refreshed `derivedStatus.nextAction` or
  `/blu-progress` fallback. Do not include secondary runnable routes.

### Semantic Self-Check

Before claiming success, answer yes/no:

1. Does every `implementationDecisions` row name a decision and the
   constraint/tradeoff that makes it durable?
2. Does every `existingCodeInsights` item cite a file/module, saved artifact,
   command output, or explicit unknown?
3. Are all deferred or later ideas preserved in `deferredIdeas` and, when
   useful, in the discussion log?
4. Are all open questions either concrete blockers or exactly the model value
   `"none"`?
5. Could `/blu-research-phase`, `/blu-ui-phase`, or `/blu-plan-phase` consume
   this without re-asking basics?

## Phase Context Ownership And Repair Loop

- Blueprint does not create, manage, or repair repo-root `CONTEXT.md`.
- Brownfield mapping writes repo context only to `.blueprint/codebase/*.md`.
- `/blu-discuss-phase` authors and repairs phase context only at `.blueprint/phases/<phase>/<XX>-CONTEXT.md` through MCP artifact tools.
- The canonical phase context filename shape is `XX-CONTEXT.md` inside the resolved phase directory.
- Any scaffolded or starter-only content is disposable seed material. The saved `XX-CONTEXT.md` must contain authored decisions rendered from the live `phase.context` model contract, not preserved scaffold literals.
- Research, UI, and planning commands consume this phase context as read-only evidence and route back to `/blu-discuss-phase <phase>` when it is missing, invalid, contradictory, or unusable.
- If context or discussion validation returns diagnostics, repair the same context model or normalized discussion draft once and retry the same MCP write path.
- If the retry returns identical diagnostics, stop, preserve the discuss checkpoint, report the exact diagnostics and next safe action, and do not inspect MCP source files as a repair strategy.
