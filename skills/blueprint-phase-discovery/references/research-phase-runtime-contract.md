# Research Phase Runtime Contract

This reference is the rich behavior contract for `/blu-research-phase`. The
canonical artifact schema still comes from `blueprint_artifact_contract_read`
with `artifactId: "phase.research"`. Treat this file as orchestration,
evidence-depth, and recovery guidance, not a competing markdown schema.

## Parity Target

`/blu-research-phase` must produce planner-grade phase research, not a valid but
thin research-shaped note. It should answer "what do we need to know to plan
this phase well?" and preserve uncertainty honestly when the answer is not yet
known.

The retained behaviors that matter are:

- phase validation before research
- explicit reuse, view, or update handling for existing research
- actual saved `XX-CONTEXT.md` content and requirement mapping before drafting
- canonical `phase.research` template use before authoring and persistence
- planner-consumed sections such as standard stack, architecture patterns,
  don't-hand-roll guidance, pitfalls, code examples, recommendations, sources,
  and confidence breakdown
- clear distinction between repo evidence, official or supplied external
  references, and inference
- topic-strand research with checkpoints for pauses or inconclusive evidence
- validation repair before completion
- routing only to implemented commands after refreshed state is loaded

## Shared Stage Mapping

Use the shared long-running-mutation stages:

- `Resolve`: resolve the phase and current roadmap boundary.
- `Read`: load phase context, current context artifact, existing research,
  checkpoint state, state, catalog, and the canonical research contract.
- `Decide`: choose reuse, view, update, resume, discard, repo-only, or
  repo-plus-external verification posture.
- `Execute`: research one topic strand at a time and keep evidence provenance
  visible.
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
  bundle signals. This controls research scope.
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
- `blueprint_phase_artifact_write`: persists final research with the resolved
  numeric `phase`, `artifact: "research"`, full markdown body, and strict
  validation unless the user explicitly accepts a warned save.
- `blueprint_phase_checkpoint_delete`: removes stale continuation state after a
  successful final research write.
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
- `## State Of The Art` identifies current guidance, repo-local currency, or
  explicitly says external currency was not checked.
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
- `## Sources` separates repo evidence, official or supplied external
  references, and inference. Do not blend these source classes.

Every non-repo factual claim should carry provenance in nearby prose or the
source list. Use labels such as `Repo evidence`, `Official reference`,
`Supplied reference`, or `Inference` rather than implying external verification
that did not happen.

## Capability-Gated Subagent Path

Use `blueprint-researcher` only when the host exposes a suitable Blueprint
research or code-analysis agent and the work benefits from isolated reading or
comparison. Do not substitute browser-only, web-search-only, shell-only, or
generic agents for codebase and workflow analysis.

When used, pass the agent:

- resolved phase number, name, goal, success criteria, and requirements
- the actual saved context artifact content
- saved codebase summaries or a compact repo evidence packet
- existing research content when revising
- `contract.authoringTemplate`, required headings, locked markers,
  placeholder signals, and freehand policy
- the requested topic strand or evidence question
- source and confidence expectations

Ask the agent for populated research content or a bounded section draft with
warnings. The parent command owns synthesis, user gates, normalization,
checkpointing, final artifact persistence, state updates, and routing.

## No-Subagent Fallback

If no suitable subagent is available, the parent command must still complete
the workflow without lowering output quality:

1. Build a compact carry-forward packet: phase boundary, requirement mapping,
   saved context decisions, codebase bundle status, existing research posture,
   and current open questions.
2. Select one topic strand, such as stack, architecture, dependency/runtime
   availability, validation/testing impact, risk/pitfalls, or sources.
3. Read only the repo files or saved Blueprint artifacts needed for that
   strand. Use official or supplied references only for claims the repo cannot
   settle.
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
  view or update, but only when the saved research is already valid.
  Replacement requires explicit confirmation.
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
  sync `STATE.md` through `blueprint_state_update` with `base: "synced"`, then
  re-load routing through `blueprint_state_load` without mutating the research
  artifact.

## Output Quality Criteria

Research is complete only when the saved artifact is specific, evidence-backed,
and planner-ready:

- requirements are mapped to research support
- recommendations are prescriptive rather than exploratory
- don't-hand-roll and anti-pattern sections are concrete
- pitfalls are tied to prevention or validation steps
- code examples or pseudocode are useful, or their omission is justified
- sources include at least one repo path, URL, or cited file reference
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
- stale research checkpoints were deleted after success
- `STATE.md` was updated through MCP
- refreshed state and command catalog were used for the next safe action
