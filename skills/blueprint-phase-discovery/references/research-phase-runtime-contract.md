# Research Phase Runtime Contract

This reference is the rich behavior contract for `/blu-research-phase`. Load it
on demand for research runs instead of copying its details into the shared
discovery skill or command manifest. The canonical artifact schema still comes
from `blueprint_artifact_contract_read` with `artifactId: "phase.research"`.
Treat this file as orchestration, evidence-depth, and recovery guidance, not a
competing markdown schema.

## Parity Target

`/blu-research-phase` must produce planner-grade phase research, not a valid but
thin research-shaped note. It should answer "what do we need to know to plan
this phase well?" and preserve uncertainty honestly when the answer is not yet
known.

The retained behaviors that matter are:

- phase validation before research
- explicit reuse, view, or update handling for existing research
- actual saved `XX-CONTEXT.md` content and requirement mapping before drafting
- visible initial assessment before deep research: relevant saved artifacts,
  repo files or symbols, key findings, implementation questions, and confidence
- compact navigation evidence before broad reads: source class, retrieval mode,
  path or symbol, evidence role, finding, limits, and why the search stopped or
  widened
- canonical `phase.research` template use before authoring and persistence
- planner-consumed sections such as standard stack, architecture patterns,
  don't-hand-roll guidance, pitfalls, code examples, recommendations, sources,
  and confidence breakdown
- clear distinction between repo evidence, official or supplied external
  references, and inference
- topic-strand research with checkpoints for pauses or inconclusive evidence
- per-strand planning handoff with recommendation, affected files or modules,
  validation or test implications, unresolved blockers, evidence basis, and
  confidence
- validation repair before completion
- routing only to implemented commands after refreshed state is loaded

## Shared Stage Mapping

Use the shared long-running-mutation stages:

- `Resolve`: resolve the phase and current roadmap boundary.
- `Read`: load phase context, current context artifact, existing research,
  checkpoint state, effective external-source policy, state, catalog, and the
  canonical research contract.
- `Decide`: choose reuse, view, update, resume, discard, repo-only, or
  repo-plus-external verification posture based on
  `research.external_sources`.
- `Execute`: build the initial assessment and navigation evidence packet,
  research one topic strand at a time, close each strand with a planning
  handoff, and keep evidence provenance visible.
- `Persist`: scaffold only a missing file, write checkpoints for pauses, and
  write final research through MCP only.
- `Validate`: normalize to the live authoring template, self-check, write in
  strict mode, repair invalid results, and retry when safe.
- `Route`: reload state and recommend only implemented next commands.

During non-trivial runs, keep resolved scope, active stage, pending gate,
execution mode, and next safe action visible through Gemini-native progress
helpers when available, or concise progress recaps when they are not.

## Required MCP Calls

- `blueprint_phase_locate`: selects the phase and supplies authoritative phase
  number, prefix, name, and directory. Stop on `found: false`.
- `blueprint_phase_context`: provides project brief, roadmap boundary,
  requirement mapping, workflow posture, missing artifacts, and saved codebase
  bundle signals. This controls research scope and surfaces the mirrored
  `workflowPosture.research.externalSources` policy view.
- `blueprint_config_get` with `scope: "effective"`: provides the source-of-truth
  `research.external_sources` policy before any official-doc or other external
  verification step. `off` means no live external lookup, `ask` means confirm
  first, and `auto` allows official-doc or external verification when the repo
  cannot settle the claim.
- `blueprint_phase_research_status`: detects existing context, research,
  UI-spec, validity, stale paths, and suggested repair posture.
- `blueprint_phase_artifact_read` with `artifact: "context"`: loads the actual
  saved discovery decisions that constrain research.
- If the `context` read returns `found: false`, stop and route back to
  `/blu-discuss-phase <phase>` before drafting research. Do not continue from
  status-only signals.
- `blueprint_phase_artifact_read` with `artifact: "research"`: supports
  view, skip, update, and revision paths.
- `blueprint_phase_checkpoint_get`: detects resumable in-progress research and
  controls resume-versus-discard branching. Pass
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`,
  then honor `safeToResume` and `warnings` before using saved state.
- `blueprint_state_load`: grounds workflow posture before and after writes.
- `blueprint_command_catalog`: gates every next-command recommendation.
- `blueprint_artifact_contract_read` with `artifactId: "phase.research"`:
  supplies `contract.authoringTemplate`, required headings, locked markers,
  placeholder signals, and freehand policy. This is the schema authority.
- `blueprint_artifact_scaffold`: reserve this for deliberate placeholder
  creation only. Default drafting should start from
  `contract.authoringTemplate`, and scaffold output is never completed
  research.
- `blueprint_phase_checkpoint_put`: persists inconclusive or paused strand
  state using the structured checkpoint shape with
  `ownerCommand: "/blu-research-phase"` and `resumeMeta.mode: "research"`.
  The MCP tool owns the shared checkpoint path; do not assume the filename is
  research-specific.
- `blueprint_phase_artifact_write`: persists final research with the resolved
  numeric `phase`, `artifact: "research"`, full markdown body, and strict
  validation unless the user explicitly accepts a warned save.
- `blueprint_phase_checkpoint_delete`: removes stale continuation state after a
  successful final research write. Pass
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`
  so cleanup cannot delete another command's shared checkpoint.
- `blueprint_state_update`: records completion or repair posture after
  artifact persistence.

## Artifact Authoring Rules

Use `contract.authoringTemplate` as the heading, marker, and direct drafting
authority. Populate every required section with substantive, phase-specific
content before persistence.

Quality rules for `XX-RESEARCH.md`:

- `## Phase Requirements` maps each in-scope requirement ID to the research
  finding that enables implementation or verification.
- `## Summary` gives a concise executive recommendation, not just a list of
  topics inspected.
- Optional `## Investigation Trace` content, when present in the authoring
  template, records the initial assessment, navigation evidence packet, and
  per-strand planning handoffs. Populate it for non-trivial research, but do
  not make older valid artifacts fail solely because they lack this optional
  heading.
- `## Locked Decisions From Context` and `## User Constraints` preserve the
  saved context decisions that constrain implementation.
- `## Standard Stack` names concrete runtime, library, tool, or repo patterns
  and versions when version knowledge matters.
- `## Installation And Setup` says whether setup is needed, already present, or
  intentionally not applicable.
- `## Alternatives Considered` records real tradeoffs, including why the
  recommendation is preferred.
- `## Architecture Patterns`, `## Don't Hand-Roll`, and `## Anti-Patterns`
  give planner-usable implementation structure and verification risks.
- `## State Of The Art` identifies current guidance or repo-local context. As
  advisory provenance guidance, prefer explicit source dates near
  freshness-sensitive external evidence, or say when live external checking did
  not happen; MCP validation does not require either marker.
- `## Common Pitfalls` describes failure modes, why they happen, and how a plan
  should prevent them.
- `## Open Questions` lists only unresolved questions that matter downstream,
  with a recommended handling path.
- `## Confidence Breakdown` assigns honest confidence by topic and explains the
  evidence behind each level.
- `## Code Examples` includes fenced code, pseudocode, config, command examples,
  or says why examples would be misleading for this phase.
- `## Recommendations` is prescriptive enough for `/blu-plan-phase` to turn
  into tasks.
- Each planner-critical recommendation should be traceable to a strand handoff
  that names affected files or modules, validation or test implications,
  unresolved blockers, evidence basis, and confidence.
- `## Sources` separates repo evidence, official or supplied external
  references, and inference. Do not blend these source classes. For repo
  evidence that supports planner-critical recommendations, prefer path or
  symbol plus evidence role such as definition, reference, test, config,
  contract, runtime, or example, and name the retrieval mode when it affects
  confidence.

Every non-repo factual claim should carry provenance in nearby prose or the
source list. Use labels such as `Repo evidence`, `Official reference`,
`Supplied reference`, or `Inference` rather than implying external verification
that did not happen.

## Investigation Trace And Navigation Evidence

Before deep strand work, create a concise parent-owned investigation trace. The
trace is not a new persistence owner and does not require a new MCP tool. It is
the working evidence shape the parent uses while drafting `XX-RESEARCH.md` from
`contract.authoringTemplate`.

The initial assessment should answer:

- which saved Blueprint artifacts were inspected
- which repo files, tests, manifests, commands, skills, contracts, or symbols
  look relevant
- which retrieval mode found them: saved context, saved codebase summary,
  scoped `rg`, targeted file read, parent-supplied semantic/navigation packet,
  official or supplied external packet, or inference
- the key findings so far
- implementation questions that still matter for planning
- current confidence and why

Use this repository evidence ladder before widening research:

1. saved `XX-CONTEXT.md` content and requirement mapping
2. existing `XX-RESEARCH.md` when updating
3. saved `.blueprint/codebase/` summaries surfaced by
   `blueprint_phase_context.codebase`
4. compact file, symbol, command, artifact, or contract anchors already present
   in saved context
5. scoped repo searches such as targeted path or term searches, keeping normal
   ignore behavior unless the strand explains why hidden, generated, vendored,
   or ignored files matter
6. optional parent-supplied navigation packets such as definitions, references,
   symbol maps, dependency edges, or code-search hints when the host already
   has them
7. targeted full-file, test, manifest, command, skill, runtime-contract, or
   built-entrypoint reads

Do not treat "more files read" as better research. Widen only when the current
strand cannot be answered from narrower evidence. Record why the search stopped
or widened.

A compact navigation evidence packet should use this shape in prose, tables, or
the optional `## Investigation Trace` template section:

```text
Evidence ID: NAV-001
Strand: <strand id or topic>
Retrieval mode: saved-context | codebase-summary | scoped-rg | targeted-read | parent-navigation-packet | external-packet | inference
Source class: blueprint-artifact | repo-code | repo-test | repo-config | command-manifest | skill-contract | runtime-contract | built-entrypoint | official-reference | supplied-reference | inference
Path / symbol / URL: <repo path, symbol, URL, or supplied source label>
Role: definition | reference | test | config | contract | runtime | example | background | inference
Finding: <what this proves for planning>
Limits: <staleness, partial coverage, missing lines, no-hit search, heuristic navigation, or none>
Stop or widen reason: <why this evidence is enough or what would justify more search>
```

Treat context files, skills, runtime contracts, and saved summaries as valuable
but potentially stale. Cite them as repo evidence, then check that the live
repository still agrees before presenting them as planner-grade truth.

Each non-trivial topic strand must close with a Strand Planning Handoff:

```text
Strand: <id/topic>
Recommendation: <planner-ready direction or "no safe recommendation">
Affected files/modules: <repo paths, command surfaces, contracts, tests, or none>
Validation or test implications: <specific tests/checks or "not yet known">
Unresolved blockers: <none or exact blocker>
Evidence basis: <NAV/source ids or concise citations>
Confidence: LOW|MEDIUM|HIGH with reason
```

When evidence is partial, inconclusive, stale, or blocked by source policy,
lower confidence and preserve the uncertainty in `## Open Questions`, the
strand handoff, or the research checkpoint. Do not turn a weak strand into a
confident recommendation.

## Capability-Gated Subagent Path

Use `blueprint-researcher` only when the host exposes a suitable Blueprint
research or code-analysis agent and the work benefits from isolated reading or
comparison. Do not substitute browser-only, web-search-only, shell-only, or
generic agents for codebase and workflow analysis.

When used, pass the agent:

- resolved phase number, name, goal, success criteria, and requirements
- the actual saved context artifact content
- saved codebase summaries or a compact repo evidence packet
- any external evidence packet the parent already gathered or the user already
  supplied, with source title, date, URL, excerpt, claim, and evidence class
- existing research content when revising
- `contract.authoringTemplate`, required headings, locked markers,
  placeholder signals, and freehand policy
- the requested topic strand or evidence question
- one bounded evidence question, expected source classes, retrieval boundaries,
  and the strand handoff fields the parent needs back
- source and confidence expectations

Ask the agent for bounded findings by default, not broad plans or final
persistence ownership. The response should include the strand/question,
concise answer, source classes, paths or URLs, retrieval notes, confidence,
failed or limited searches, unanswered questions, and a planning handoff.
Ask for a bounded section draft only when the parent names target headings from
`contract.authoringTemplate`; the parent still merges, normalizes, validates,
and persists the final artifact.

The agent must not imply it fetched official docs itself. If the parent asks
for official-doc comparison without an external evidence packet, the agent
should mark the claim unverified and ask the parent for confirmation or
supplied evidence. The parent command owns synthesis, evidence acceptance, user
gates, normalization, checkpointing, final artifact persistence, state updates,
and routing.

## No-Subagent Fallback

If no suitable subagent is available, the parent command must still complete
the workflow without lowering output quality:

1. Build a compact carry-forward packet: phase boundary, requirement mapping,
   saved context decisions, codebase bundle status, existing research posture,
   initial assessment, navigation evidence packet, and current open questions.
2. Select one topic strand, such as stack, architecture, dependency/runtime
   availability, validation/testing impact, risk/pitfalls, sources, or a
   specific implementation question from the initial assessment.
3. Follow the repository evidence ladder for that strand: saved context,
   existing research, saved codebase summaries, scoped searches, optional
   parent-supplied navigation packets, then targeted file/test/contract reads.
   Use official or supplied references only for claims the repo cannot settle,
   and only when the `research.external_sources` policy allows them.
4. Append or revise the normalized research draft section-by-section against
   the canonical template.
5. Compress the completed strand into the carry-forward packet.
6. Re-check research status or checkpoint state between strands when the run is
   long enough that persistence could have changed.
7. Persist a structured checkpoint if the run pauses or evidence remains
   inconclusive before the artifact is ready.

This fallback is the required single-agent path, not a degraded emergency mode.

## Retry And Repair Behavior

- If phase resolution fails, stop with the tool reason and recovery guidance.
- If existing research is present, default to reuse unless the user chooses
  view or update, but only when the saved research is already valid. Treat an
  explicit `update` selection as the overwrite gate; do not default overwrite
  or ask for a second confirmation unless the user's intent remains ambiguous.
- If `research.external_sources` is `off`, do not perform live external lookup.
  Keep the run repo-only and avoid implying that upstream guidance was checked.
- If `research.external_sources` is `ask`, stop for confirmation before any
  official-doc or external verification.
- If existing research is invalid, do not allow skip, default reuse, or an
  unchanged invalid write result to count as successful completion. Surface the
  validation issues, repair the artifact, or stop with the blocker.
- If a checkpoint exists, resume by default unless the user explicitly discards
  it.
- If evidence conflicts or a critical claim cannot be verified, lower
  confidence, preserve the conflict in `## Open Questions`, and checkpoint when
  the uncertainty blocks a planner-grade recommendation.
- If `blueprint_phase_artifact_write` returns `status: "invalid"`, repair the
  same normalized draft using the returned validation issues and retry before
  treating the command as complete.
- If repair cannot be completed safely, leave or refresh the checkpoint and
  report the exact validation blocker plus the next safe continuation action.
- Delete the checkpoint only after final research writes successfully.
- After a successful research write or a valid `view`/`skip`/`reuse` exit,
  sync `STATE.md` through `blueprint_state_update` with `base: "synced"` while
  preserving the already resolved selected phase in `patch.currentPhase`
  together with `patch.activeCommand`, then re-load routing through
  `blueprint_state_load` without mutating the research artifact or falling back
  to roadmap-derived phase selection.

## Output Quality Criteria

Research is complete only when the saved artifact is specific, evidence-backed,
and planner-ready:

- requirements are mapped to research support
- the artifact exposes enough investigation trace for planning: relevant saved
  artifacts, repo files or symbols, retrieval modes, key findings,
  implementation questions, and confidence
- planner-critical recommendations have strand handoffs naming affected files
  or modules, validation or test implications, unresolved blockers, evidence
  basis, and confidence
- recommendations are prescriptive rather than exploratory
- don't-hand-roll and anti-pattern sections are concrete
- pitfalls are tied to prevention or validation steps
- code examples or pseudocode are useful, or their omission is justified
- sources include at least one repo path, URL, or cited file reference
- `## State Of The Art` uses clear provenance for freshness-sensitive claims
  when helpful; absence of a date or unchecked marker is not an MCP blocker
- confidence is honest and scoped by topic
- unresolved questions are visible instead of hidden by confident language

## Completion Criteria

`/blu-research-phase` is complete when:

- the selected phase and artifact paths are resolved through MCP
- existing research was viewed, reused, skipped, updated, or replaced through an
  explicit path, and invalid research never completed through a silent reuse
- the final artifact was normalized to the canonical `phase.research`
  authoring template
- strict MCP write validation passed, or a validation blocker was checkpointed
  and reported
- stale research-owned shared checkpoints were deleted after success
- `STATE.md` was updated through MCP
- refreshed state and command catalog were used for the next safe action
- the effective `research.external_sources` policy was honored before any
  external verification step

## Phase Context Ownership And Repair Loop

- Blueprint does not create, manage, or repair repo-root `CONTEXT.md`.
- Brownfield mapping writes repo context only to `.blueprint/codebase/*.md`.
- `/blu-research-phase` reads phase context only from `.blueprint/phases/<phase>/<XX>-CONTEXT.md` and must not repair, overwrite, synthesize, or mirror it.
- Missing, invalid, contradictory, or unusable context routes to `/blu-discuss-phase <phase>` with exact diagnostics before any research drafting.
- If research validation returns diagnostics, repair the same normalized research draft once and retry the same MCP write path.
- If the retry returns identical diagnostics, stop, preserve or refresh the research checkpoint, report the exact diagnostics and next safe action, and do not inspect MCP source files as a repair strategy.
