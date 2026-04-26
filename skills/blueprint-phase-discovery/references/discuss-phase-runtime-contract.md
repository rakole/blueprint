# Discuss Phase Runtime Contract

This reference is the rich behavior contract for `/blu-discuss-phase`. The
canonical artifact schema still comes from `blueprint_artifact_contract_read`
with `artifactId: "phase.context"` and, when used, `artifactId:
"phase.discussion-log"`. Treat this file as orchestration and evidence-density
guidance, not a competing markdown schema.

## Parity Target

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

## Resolve And Read

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
- `blueprint_artifact_contract_read`: `phase.context` before context drafting
  and `phase.discussion-log` before discussion-log drafting

Read saved `.blueprint/codebase/` summaries before broad repo rereads. If the
bundle is missing or thin, say so and do targeted local reading only where it
sharpens the current phase discussion.

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
the canonical `phase.context` contract requirements when returned content will
feed the context draft. Ask the agent for concrete options, tradeoffs,
complexity or impact surface, recommendation rationale, and citations or repo
paths. The parent command owns synthesis, user-facing questions, checkpoints,
artifact writes, and state updates.

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
6. Write or refresh the structured checkpoint with `completedAreas`,
   `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and
   `resumeMeta`.
7. Summarize progress briefly, then move to the next area or ask whether more
   questions are needed for the current area.

This fallback is the required behavior, not a degraded emergency path.

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

## Artifact Authoring

The `phase.context` authoring template is the schema authority. Populate every
required section with concrete content:

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
- `Open Questions`: only unresolved questions that must remain explicit
- `Deferred Ideas`: scope-creep or later-phase ideas with why they are out of
  this phase
- `Canonical References`: full relative paths plus what each source controls;
  if no external specs exist, say that explicitly

Prefer rich bullets over terse labels. A downstream researcher or planner should
understand what was decided, why, what evidence supports it, and where to look
next.

Write `XX-DISCUSSION-LOG.md` when it adds durable value beyond the context,
especially for multi-area sessions, assumptions-mode corrections, advisor-style
comparison tables, or compliance/audit needs.

## Validation And Repair

Before treating the discussion as complete:

1. Normalize the draft to the live `authoringTemplate`.
2. Self-check for placeholder text, empty required sections, contradiction with
   prior saved context, missing canonical references, unsupported mode claims,
   dropped deferred ideas, and plan-inventory warnings that were not carried
   forward.
3. Call `blueprint_phase_artifact_write` in strict mode. If it returns
   `status: "invalid"` or validation issues, repair the same draft from the
   returned issues and retry before claiming success.
4. If a discussion log is written, apply the same contract-read,
   normalize, write, and repair loop for `phase.discussion-log`.
5. After the final context artifact and any optional discussion log write
   successfully, call `blueprint_state_update` with `base: "synced"`. Do not
   treat the update response as the routing decision.
6. Call `blueprint_state_load` after the synced update and report the refreshed
   next safe action from the loaded state, falling back to `/blu-progress` when
   routing is missing, blocked, or undecidable.
7. Delete the checkpoint only after the context write, optional discussion-log
   write, synced state update, and follow-up state load have all succeeded. If
   any finalization step fails, leave the checkpoint in place and report the
   exact continuation blocker.

If validation cannot be repaired in the current run, leave the checkpoint in
place and report the exact blocker plus the next safe continuation action.
