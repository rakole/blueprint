# Discuss Phase Runtime Contract

This reference is the rich behavior contract for `/blu-discuss-phase`. The
canonical artifact schema still comes from `blueprint_artifact_contract_read`
with `artifactId: "phase.context"` and, when used, `artifactId:
"phase.discussion-log"`. Treat this file as orchestration and evidence-density
guidance, not a competing markdown schema. If the runtime exposes scaffold
starter material separately from the authoring template, keep that split
explicit: scaffold output seeds a missing file, while `authoringTemplate`
governs the final saved markdown.

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

Before asking fresh questions, resolve the selected phase and build a compact
evidence packet from:

- `blueprint_phase_context`: phase boundary, project brief, requirements
  grounding, workflow posture, mapped codebase summaries, and existing artifact
  signals
- `blueprint_roadmap_read`: phase title, objective, success criteria,
  requirement links, and any canonical refs already written into the roadmap
- `blueprint_artifact_list`: current artifact inventory
- `blueprint_config_get`: `workflow.discuss_mode`,
  `workflow.skip_discuss`, and `workflow.research_before_questions`
- `blueprint_phase_artifact_read`: current context, discussion log, and
  materially relevant earlier phase context artifacts
- `blueprint_phase_checkpoint_get`: resumable in-progress decisions
- `blueprint_phase_plan_index`: saved plans that will not be rewritten by new
  context unless the user later reruns `/blu-plan-phase`
- `blueprint_artifact_contract_read`: `phase.context` before context model
  authoring and `phase.discussion-log` before discussion-log drafting

Read saved `.blueprint/codebase/` summaries before broad repo rereads. If the
bundle is missing or thin, say so and do targeted local reading only where it
sharpens the current phase discussion.

## Selected Phase Read Packet

After `blueprint_phase_locate` succeeds, create a run-local selected-phase
register:

- `selectedPhase`: `String(result.phaseNumber)`
- `selectedPhasePrefix`: `result.phasePrefix`
- `selectedPhaseDir`: `result.phaseDir`
- `selectedPhaseResolvedFrom`: `result.resolvedFrom`

Use `selectedPhase` for every phase-scoped read, checkpoint read/write/delete,
scaffold path, artifact write, and final `patch.currentPhase`. Treat any
state-derived current phase returned by later reads as `stateCurrentPhase`, an
ambient routing signal, not a replacement for `selectedPhase`.

If `blueprint_phase_locate` returns `found: false`, stop before artifact reads
or writes and report `reason` plus `recovery`.

### Minimum Read Order

1. Call `blueprint_phase_locate`.
2. In parallel, call `blueprint_phase_context`, `blueprint_roadmap_read`,
   `blueprint_artifact_list`, and `blueprint_config_get`.
3. Using `selectedPhase`, read current `context`, current `discussion-log`,
   the discuss checkpoint with owner/mode guards, plan inventory, and the
   `phase.context` artifact contract.
4. Read the `phase.discussion-log` contract only when a durable discussion log
   is likely.
5. Read earlier phase context only when the relevance rule below matches.

### Prior-Context Relevance Rule

Earlier phase context is materially relevant when it shares roadmap
requirement ids, canonical references, deferred ideas, codebase surfaces, MCP
tool families, command lifecycle gates, or explicit dependency language with
the selected phase. Prefer the nearest prior matching phase plus any phase
explicitly referenced by ROADMAP or saved context. If no rule matches, say no
earlier context was reused instead of doing a broad sweep.

### Compact Read-Packet Summary

Before the first fresh user question, summarize: selected phase, phase
resolution source, `stateCurrentPhase` if different, config mode (`discuss`,
`assumptions`, or `skip_discuss`), context status, discussion-log status,
checkpoint status, prior context reused/skipped, codebase-summary status, and
plan-inventory warning.

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

6. Write or refresh the structured checkpoint with
   `ownerCommand: "/blu-discuss-phase"`, `completedAreas`, `remainingAreas`,
   `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`.
   Use `resumeMeta.mode: "discuss"`.

### Checkpoint Persistence Frequency

Persist after every user answer and after every gray-area boundary. A
checkpoint is resume-ready only when the active area has a stable `areaId`,
state, current question or blocking reason, evidence refs, and the last
accepted user answer or assumption. Do not infer these from the chat
transcript.

### Area States

Each gray area in the checkpoint progresses through these states:
`questioning`, `assumed`, `decided`, `blocked`, `needs-revisit`, `unseen`.

Resume must not re-ask an area whose `resolutionCriterion` was already met
unless new evidence contradicts the saved decision.

### Checkpoint V2 Shape

The current MCP checkpoint schema tolerates extra fields via `.catchall()`.
Use this extended shape as prompt-compatible metadata. Keep existing
`completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`,
`canonicalReferences`, and `resumeMeta` for current runtime compatibility, but
derive them from `areaQueue` when `areaQueue` exists. The `areaQueue` is the
semantic source of truth; the lists are compatibility summaries.

Sample v2 checkpoint:

```json
{
  "ownerCommand": "/blu-discuss-phase",
  "schemaVersion": 2,
  "phaseKey": "03-phase-discovery",
  "progress": {
    "activeStage": "Execute",
    "pendingGate": "gray-area-question",
    "executionMode": "discuss/resumed",
    "areasDecided": 1,
    "areasTotal": 4,
    "nextActionPreview": "Ask the current UI expectations follow-up"
  },
  "areaQueue": [
    {
      "areaId": "scope-boundary",
      "title": "Scope boundaries",
      "state": "decided",
      "decisionIds": ["D-scope-001"],
      "evidenceRefs": [".blueprint/ROADMAP.md"],
      "downstreamConsumers": ["/blu-research-phase", "/blu-plan-phase"]
    },
    {
      "areaId": "ui-expectations",
      "title": "UI expectations",
      "state": "questioning",
      "currentQuestion": "Does this phase author a real UI surface or only a no-UI rationale?",
      "questionWhyItMatters": "Controls whether /blu-ui-phase should produce UI work or an explicit skip rationale.",
      "lastUserAnswer": null
    }
  ],
  "carryForward": {
    "phaseBoundary": [],
    "completedDecisions": [],
    "openQuestions": [],
    "deferredIdeas": [],
    "canonicalReferences": [],
    "contradictions": [],
    "doNotInferBeyond": []
  },
  "readSet": []
}
```

### Carry-Forward Packet

Before asking the next question or handing off to a sidecar, build
`carryForward`: `phaseBoundary`, `activeArea`, `completedDecisions`,
`openQuestions`, `deferredIdeas`, `canonicalReferences`, `evidenceRefs`,
`contradictions`, `omittedDetails`, and `doNotInferBeyond`. Store the compact
`carryForward` in the checkpoint. Copy the final version into
`XX-DISCUSSION-LOG.md` when the session had more than one area,
contradictions, assumptions, or deferred ideas.

### Deterministic Resume Ordering

On resume, read with `expectedOwnerCommand: "/blu-discuss-phase"` and
`expectedMode: "discuss"`. If `safeToResume` is false, ask resume-versus-
discard using the warnings. If `safeToResume` is true, pick the first area
with state `questioning`, then `blocked`, then `needs-revisit`, then the
first `unseen` area. Never reconstruct the queue from `completedAreas` prose
alone.

### Stale-Input Detection

`readSet` should list the roadmap/context/config/plan-index artifacts used to
form the queue, with path plus lightweight fingerprint or `updatedAt` where
available. On resume, warn when the read set changed and route the affected
area to `needs-revisit` instead of silently continuing.

7. Delete the checkpoint only after the context write, optional discussion-log
   write, synced state update, and follow-up state load have all succeeded.
   Pass `expectedOwnerCommand: "/blu-discuss-phase"` and
   `expectedMode: "discuss"` so cleanup cannot delete another command's shared
   checkpoint. If any finalization step fails, leave the checkpoint in place
   and report the exact continuation blocker.

If validation cannot be repaired in the current run, leave the checkpoint in
place and report the exact blocker plus the next safe continuation action.

### Checkpoint Deletion And Audit Trail

When `blueprint_phase_checkpoint_delete` succeeds after finalization, the
final response and optional discussion log should say which areas were
decided, which were assumed, which remain open, and where those facts landed
in `XX-CONTEXT.md` or `XX-DISCUSSION-LOG.md`.

## Gray Area Identification

Generate gray areas from the phase, not from generic categories. Each gray area
should name a decision that would change the implementation result.

Useful lenses:

- scope boundary: what is in this phase versus a later phase
- user-visible behavior: modes, states, ordering, errors, empty states
- interface contract: flags, routes, payloads, outputs, compatibility
- reuse: existing components, MCP tools, skills, agents, docs, and tests
- dependencies: prerequisite artifacts, data, integrations, or command states
- risk and failure handling: rollback, partial completion, validation, security
- methodology: active project lenses or saved constraints that affect choices

Skip areas already locked by prior context unless the current phase introduces a
real conflict. When reusing a prior decision, cite the artifact that locked it.

## Gray Area Queue

Before asking the user anything, build a compact `grayAreaQueue` from the
evidence packet. This queue is working state and checkpoint context, not a
competing artifact schema. Each entry must include:

- `areaId`: stable kebab-case label
- `slot`: actor | action-task | object-concept | attribute | goal | event |
  constraint | exception | external-interface | quality-attribute |
  acceptance-verification
- `defect`: ambiguous | incomplete | inconsistent | unverifiable | tradeoff
- `lens`: scope | user-visible-behavior | interface-contract | reuse |
  dependency | risk-failure | methodology | routing
- `evidence`: repo paths, saved artifacts, MCP results, or user-provided
  source that exposed the gap
- `downstreamImpact`: research | ui | plan | validation | routing
- `decisionValue`: high | medium | low
- `resolutionCriterion`: what answer, assumption, or handoff makes the area
  resolved
- `candidateQuestion`: the single next question that would resolve or shrink
  the area

Classify every gray area by requirement slot first, then by Blueprint lens.
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

### Anti-Generic Question Rule

Do not ask checklist or atmosphere questions such as "Any other requirements?",
"What should we consider?", or "What are your preferences?" unless the question
is tied to a named `grayAreaQueue` entry, cites the evidence gap, and states
what downstream decision the answer will change.

### Gray Area Example

- `areaId`: auth-error-contract
- `slot`: exception
- `defect`: incomplete
- `lens`: interface-contract
- `evidence`: `.blueprint/ROADMAP.md` says "handle auth failures"; current
  context names no error payload.
- `downstreamImpact`: plan, validation
- `decisionValue`: high
- `candidateQuestion`: "For auth failures, should this phase standardize a
  machine-readable error code now, reuse the existing generic failure shape,
  or defer payload shape to a later API-contract phase?"
- `resolved`: selected generic failure shape; record rationale and validation
  expectation in `implementationDecisions`.

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

Do not claim unshipped power, batch, chain, auto, or auto-advance behavior in
this runtime.

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

- `blueprint-researcher` as a bounded read-only sidecar for one gray area when
  codebase or official-reference reading would materially improve the options
- `blueprint-researcher` in assumptions mode when evidence-backed assumptions
  need a deeper repo pass than the main session should carry

Agent prompts must be bounded to one area or one assumptions pass and must pass
the compact phase boundary, relevant saved context, and canonical references
needed for that area. Ask `blueprint-researcher` for gray-area memo mode: a
lightweight read-only options and tradeoffs memo with concrete options,
complexity or impact surface, recommendation rationale, confidence, and
citations or repo paths. Do not ask it to populate `phase.research` or draft
`XX-RESEARCH.md` for `/blu-discuss-phase`; artifact-grade research belongs to
`/blu-research-phase`. The parent command owns synthesis, user-facing
questions, checkpoints, artifact writes, and state updates.

If no suitable subagent exists, or if the host disallows subagents, use the
single-agent fallback below without lowering artifact quality.

## Single-Agent Fallback

The main agent must be able to complete the whole workflow one discussion area
at a time:

1. Pick the next selected gray area.
2. Compress carry-forward context to the minimum useful packet: phase boundary,
   applicable prior decisions, codebase evidence, canonical refs, completed
   decisions, deferred ideas, and the current unanswered question.
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

- `Phase Boundary`: fixed phase scope, in-scope and out-of-scope boundaries,
  success criteria
- `Discovery Grounding`: project brief, requirements grounding, workflow
  posture, prior decisions, plan-inventory warning when applicable
- `Implementation Decisions`: locked decisions grouped by the phase-specific
  areas actually discussed, including rationale and evidence when useful
- `Specific Ideas`: user examples, references, desired feel, constraints, or
  "like X" moments
- `Existing Code Insights`: reusable assets, established patterns, integration
  points, known gaps
- `Dependencies`: prior artifacts, MCP tools, command surfaces, docs, external
  constraints, required follow-up reads
- `Open Questions`: only unresolved questions that must remain explicit; when none remain, save the model value as `none` so the renderer emits exactly `- none`
- `Deferred Ideas`: scope-creep or later-phase ideas with why they are out of
  this phase
- `Canonical References`: full relative paths plus what each source controls;
  if no external specs exist, say that explicitly

Prefer rich model values over terse labels. A downstream researcher or planner
should understand what was decided, why, what evidence supports it, and where to
look next. The final artifact must be renderer output and must not preserve
literal scaffold headings, placeholder bullets, example filler, or "replace me"
instructions.

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

- `Summary`: the decision arc and session outcome
- `Notes`: user corrections, options rejected, evidence snippets, and
  assumptions corrections and review results
- `Follow-Ups`: only concrete later actions, or exact rationale that no
  follow-up remains

### Assumptions Review Block

When assumptions mode was used, include:

- Presented: assumption text
- User correction: what changed
- Evidence changed: new evidence surfaced
- Final disposition: accepted / corrected / rejected
- Downstream impact: which command or artifact is affected

## Downstream Handoff Packet

Before final validation and routing, derive a compact handoff packet from the
saved context model, checkpoint decisions, plan index, effective config, and
artifact inventory. Persist its substance inside existing `phase.context`
model sections; do not create a new artifact or pass the raw conversation
transcript downstream.

### Required Packet Fields

- `researchBrief`: known unknowns, evidence needed, source policy from
  effective config, decision each research item unblocks, stop condition,
  evidence refs, and unresolved questions that must route to
  `/blu-research-phase`.
- `uiBrief`: UI applicability, users, critical journeys, interaction
  surfaces, accessibility/privacy/safety constraints, and any no-UI skip-
  rationale candidate. A candidate is not a completed `XX-UI-SPEC.md` skip
  rationale.
- `planBrief`: initial state, desired end state, dependencies, forbidden
  moves, validation oracle, non-goals, repo constraints, accepted assumptions,
  rejected options, and open planning risks.
- `planInventory`: existing plan IDs and paths, dependency gaps, warnings,
  and whether refreshed discovery leaves saved plans stale until
  `/blu-plan-phase` is rerun.
- `routingGates`: selected phase, workflow research/UI booleans, context
  path, research path/status, UI-spec path/status, refreshed next safe
  action, and fallback action when routing is unavailable.

### Stale-Plan Warning

When `blueprint_phase_plan_index.plans.length > 0`, include this warning
in the handoff and the final response:

> Existing saved plans were not rewritten by this refreshed discussion;
> rerun `/blu-plan-phase <selectedPhase>` before trusting plan content that
> depends on the new context.

### Research Handoff Stop Condition

Give research a concrete stop: "enough evidence to choose between the listed
options or confirm that repo evidence is insufficient and an assumption must
remain open."

### UI Handoff Applicability

`uiBrief.applicability` should be one of:
- `needs-ui-contract` - UI work is needed
- `skip-rationale-candidate` - discuss captured a skip rationale candidate
  but `/blu-ui-phase` must still confirm or formalize it
- `unknown` - UI applicability not yet determined

### Plan Handoff Shape

Keep `planBrief` planning-oriented: acceptance/verification hooks,
dependencies, non-goals, constraints, rejected options, and assumptions
safe for planning. Any unresolved high-impact ambiguity should stay in
`openQuestions` or `researchBrief`, not silently become a plan premise.

## Validation And Repair

Before treating the discussion as complete:

1. Build a `phase.context` model against the live `modelContract`; for discussion logs, normalize the draft to the live `authoringTemplate`.
2. Self-check for placeholder text, empty required sections, contradiction with
   prior saved context, missing canonical references, unsupported mode claims,
   dropped deferred ideas, preserved scaffold literals, and plan-inventory
   warnings that were not carried forward. If `Open Questions` has no
   unresolved items, preserve the exact `none` model value so the renderer emits
   `- none` instead of expanding it into filler prose.
3. Call `blueprint_phase_artifact_write` in strict mode. If it returns
   `status: "invalid"` or validation issues, repair the same model or discussion
   draft from the returned issues and retry before claiming success.
   Treat the returned `path` as the authoritative saved filename instead of
   rebuilding it from the phase slug or scaffold result.
4. If a discussion log is written, apply the same contract-read,
   normalize, write, and repair loop for `phase.discussion-log`.
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

Preserve state warnings in the final response when they affect routing:
requested-phase preservation warnings, invalid research warnings, missing
plan dependency warnings, and quality-gate debt warnings. This makes the
refreshed route auditable without requiring downstream agents to re-run
all reads.

## Final Response Shape

Final response shape:

- **Saved**: context path, optional discussion-log path, reused/replaced
  status.
- **Checkpoint**: deleted, retained with reason, or no checkpoint.
- **Handoff**: one-line summary of `researchBrief`, `uiBrief`, `planBrief`,
  and `planInventory`, including the stale-plan warning when plans already
  exist.
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
