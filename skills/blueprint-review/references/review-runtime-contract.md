# Blueprint Peer Review Runtime Contract

This reference is the runtime-heavy contract for `/blu-review`. It keeps the
retained GSD peer-review value in Blueprint-native terms: MCP owns
deterministic state and persistence, the command stays thin and user-facing,
the skill orchestrates, external reviewer CLIs provide independent opinions
when available, and optional Blueprint agents only do bounded read-only packet
or synthesis quality work.

## Contract Authority

- `mcp_blueprint_blueprint_artifact_contract_read` and
  `mcp_blueprint_blueprint_review_authoring_context` are the schema authority
  for `review.peer-review`.
- The returned `contract.modelContract`, base schema, runtime-narrowed
  `taskSchema`, required headings, and locked markers are the canonical shape
  for model authoring and MCP-rendered `XX-REVIEWS.md` before drafting, repair,
  or persistence.
- This reference is the output-quality authority: it defines saved-evidence
  packet assembly, reviewer coverage semantics, consensus and divergence
  synthesis, capability-gated `blueprint-reviewer` use, fallback behavior, and
  write repair.
- Do not add new public command names, `.planning/` runtime dependencies,
  shell-owned persistence, hook-owned state, or direct writes to
  `XX-REVIEWS.md`.

## Stage Mapping

Map `/blu-review` to the shared stages:

### Resolve

- Resolve the target phase with `mcp_blueprint_blueprint_phase_locate`.
- Parse explicit reviewer flags: `--gemini`, `--claude`, `--codex`,
  `--opencode`, and `--all`.
- If no phase resolves, stop with the tool reason and useful recovery guidance.
- Keep the resolved phase, active stage, pending gate, execution mode, and next
  safe action visible.

### Read

- Read the artifact inventory with `mcp_blueprint_blueprint_artifact_list`.
- Read `review.peer-review` with
  `mcp_blueprint_blueprint_artifact_contract_read` before drafting,
  validating, or repairing the peer-review artifact.
- Read `mcp_blueprint_blueprint_review_authoring_context` with
  `artifact: "peer-review"` so selected plans, saved evidence coverage, pending
  plan state, and status-safe next actions are narrowed before model drafting.
- Read `mcp_blueprint_blueprint_phase_plan_index` for the resolved phase.
- If no saved `*-PLAN.md` artifacts exist, stop and route to
  `/blu-plan-phase <phase>`.
- Read every selected saved plan with
  `mcp_blueprint_blueprint_phase_plan_read`.
- Include directly related saved evidence from the artifact inventory when it
  exists: phase context, research, summaries, validation, UAT, security,
  prior peer review, or code review. If the artifact inventory only exposes
  paths and the command cannot read a body through an MCP substrate, cite the
  path and state the limitation instead of inventing content.

### Decide

- Decide whether reviewer selection comes from explicit flags, `--all`, or the
  default available-reviewer set.
- Confirm reviewer CLI availability and authentication before claiming a
  reviewer ran.
- If requested reviewers are unavailable, either proceed with honest partial
  coverage when at least one reviewer can run, or stop with the pending gate
  `reviewer-availability` when none can run.
- Decide whether an existing `XX-REVIEWS.md` is reused or replaced. Default to
  reuse and require explicit overwrite confirmation before replacement.
- Decide whether the run benefits from `blueprint-reviewer` as a read-only
  packet or synthesis quality helper. Use it for broad or multi-plan review
  packets, meaningful context/research evidence, prior review comparison, or
  complex reviewer disagreement.

### Execute

- Build one reviewer packet from saved Blueprint evidence. The packet must
  include the resolved phase, phase goal, selected plan list, plan contents,
  available requirements or context evidence, available research evidence, and
  any directly related saved artifacts or explicit limitations.
- Ask every external reviewer for the same structured feedback:
  summary, strengths, concerns with severity, suggestions, risk assessment,
  whether the plans achieve the phase goal, missing edge cases, dependency
  ordering risks, scope creep or over-engineering, security considerations,
  performance implications, and unknowns.
- Invoke only available and selected external reviewer CLIs. Run them
  sequentially unless the host explicitly provides a safe fan-out mechanism.
- Preserve raw reviewer conclusions enough for auditability, but summarize
  long outputs into stable sections before persistence.
- Keep disagreement visible. Do not flatten materially different reviewer
  opinions into false consensus.

### Persist

- Author a structured `review.peer-review` JSON model against the narrowed
  task schema, then validate it through
  `mcp_blueprint_blueprint_review_validate_model`.
- Persist only through `mcp_blueprint_blueprint_review_record` with numeric
  `phase`, `artifact: "peer-review"`, and the same validated structured model.
- Treat the returned `reportPath`, `counts`, `followUps`, `status`, and
  `warnings` as authoritative.
- Never hand-write `XX-REVIEWS.md`.

### Validate

- Ensure the final MCP-rendered artifact includes the canonical headings from
  the model contract, including `Review Summary`, `Reviewer Coverage`,
  `Reviewer Results`, `Plan Reviews`, `Findings`, `Consensus`,
  `Disagreements`, `Risk Assessment`, `Manual / Deferred Work`,
  `Gap / Repair Routes`, `Follow-Ups`, `Evidence Reviewed`, and
  `Next Safe Action`.
- Run a final consistency pass before persistence:
  every claimed reviewer appears in `**Reviewers:**`, unavailable reviewers are
  listed separately, every material concern is tied to a reviewer or saved
  evidence, disagreements are preserved, follow-ups are actionable, and the
  next safe action names only implemented Blueprint commands.
- If `blueprint_review_validate_model` or `blueprint_review_record` rejects the
  model, repair all diagnostics together once against `review.peer-review` and
  this reference, then retry through MCP. If the retry still fails, stop with
  the exact MCP reason and do not write the artifact by hand.

### Route

- Route only to implemented Blueprint commands.
- Prefer `/blu-plan-phase <phase>` when the peer review calls for meaningful
  plan revisions.
- Otherwise prefer `/blu-execute-phase <phase>` when execution summaries are
  missing.
- Otherwise prefer `/blu-code-review <phase>` when code review is missing.
- Otherwise prefer `/blu-progress`.
- Keep `/blu-review <phase>` as the next safe action while reviewer
  availability is unresolved.

## Required MCP Calls

Call these tools in this order unless the command must stop early:

1. `mcp_blueprint_blueprint_phase_locate`
   - Controls target phase, phase directory, phase prefix, and missing-phase
     recovery.
2. `mcp_blueprint_blueprint_artifact_list`
   - Controls saved-evidence inventory, existing peer-review state, and
     related artifact posture.
3. `mcp_blueprint_blueprint_artifact_contract_read` for `review.peer-review`
   - Controls required headings, locked markers, authoring template, and repair
     target.
4. `mcp_blueprint_blueprint_phase_plan_index`
   - Controls the saved plan list, wave grouping, missing-plan recovery, and
     whether review can proceed.
5. `mcp_blueprint_blueprint_phase_plan_read`
   - Controls each selected plan body and plan validation metadata.
6. `mcp_blueprint_blueprint_phase_summary_index`
   - Controls pending-plan state and post-review routing.
7. `mcp_blueprint_blueprint_phase_summary_read`
   - Controls saved summary evidence when summaries exist.
8. `mcp_blueprint_blueprint_phase_execution_targets`
   - Controls pending execution target and blocker visibility.
9. `mcp_blueprint_blueprint_review_authoring_context`
   - Controls the base schema, runtime-narrowed task schema, selected plan
     inventory, evidence coverage keys, and status-safe next actions.
10. `mcp_blueprint_blueprint_review_validate_model`
   - Controls schema, residual, and rendered Markdown validation before
     persistence.
11. `mcp_blueprint_blueprint_review_record`
   - Controls the final filename, create/update/reuse status, counts,
     follow-ups, warnings, and validation failures.

## Artifact Authoring Rules

The peer-review artifact must be useful standalone review evidence, not merely
valid Markdown.

- `**Reviewers:**` lists only reviewers that actually completed, plus a clear
  unavailable-reviewer note elsewhere when requested reviewers could not run.
- `## Review Summary`: resolved phase, selected plan count, reviewer coverage,
  execution mode, pending gate, overall risk posture, and one-paragraph result.
- `## Plan Reviews`: every selected plan id/path from the task schema, plus
  goal-fit judgment and concrete review summary.
- `## Reviewer Coverage`: requested reviewers, available reviewers, completed
  reviewers, unavailable or unauthenticated reviewers, failures, and partial
  coverage rationale.
- `## Reviewer Results`: one subsection or bullet group per completed reviewer
  with summary, strengths, severity-tagged concerns, suggestions, risk
  assessment, and goal-achievement judgment.
- `## Consensus`: concerns or strengths raised by two or more
  reviewers, or `none` when only one reviewer completed.
- `## Disagreements`: material reviewer disagreements and why they matter, or
  `none`.
- `## Risk Assessment`: overall `LOW`, `MEDIUM`, or `HIGH` peer-review risk
  with rationale from reviewer evidence.
- `## Manual / Deferred Work`: exact `none` sentinel for completed reviews, or
  concrete reviewer availability or plan-revision checkpoints for partial and
  blocked reviews.
- `## Gap / Repair Routes`: exact `none` sentinel for completed reviews, or
  concrete open/blocked gaps with repair routes for partial and blocked reviews.
- `## Follow-Ups`: concrete plan revisions, execution changes, additional
  reviewer/authentication steps, or `none`.
- `## Next Safe Action`: exactly one implemented Blueprint command.

Do not persist placeholder reviewer names, generic "reviewed plans" prose, or
reviewer coverage that did not actually run. If only one reviewer completed,
say that consensus is limited rather than manufacturing agreement.

## Capability-Gated Subagent Path

Gemini CLI exposes an enabled delegated reviewer as the same-named
`blueprint-reviewer` tool. Do not read, inline, or load separate agent source
before delegation. Call `blueprint-reviewer` with a bounded peer-review
synthesis task packet only when a suitable codebase/workflow-analysis tool is
available and the scope benefits from bounded read-only quality work:

- multiple saved plans or broad roadmap context
- context, research, security, validation, or prior-review evidence that should
  be included in the reviewer packet
- complex reviewer disagreement that needs structured synthesis
- replacing an existing `XX-REVIEWS.md`

Pass the reviewer task packet only:

- the resolved phase and selected plan paths
- the saved plan contents and selected Blueprint evidence
- the reviewer-packet requirements from this contract
- completed reviewer outputs when asking for synthesis quality checks
- the canonical `review.peer-review` authoring requirements

The delegated reviewer may return packet-completeness issues, synthesis gaps, consensus
and disagreement notes, risk posture, and an artifact draft. The parent command
owns external CLI invocation, reviewer availability truth, confirmation gates,
MCP writes, validation, and routing.

Browser-only, web-search-only, shell-only, or generic helpers are not
acceptable substitutes for `blueprint-reviewer` or for external reviewer CLIs.

## No-Subagent Fallback

If `blueprint-reviewer` is unavailable, disabled, unnecessary, or unsafe, continue sequentially in
the parent session. The fallback must preserve the same saved-evidence depth,
reviewer honesty, and artifact quality as the agent-tool path; the only change is
that packet assembly and synthesis happen one isolated unit at a time in the
parent flow.

1. Assemble the review packet one evidence group at a time: phase identity,
   roadmap intent, plan list, plan bodies, requirements/context, research, and
   related artifacts.
2. Compress the packet to a short checklist of included evidence and missing
   evidence before invoking reviewers.
3. Invoke one available selected reviewer at a time.
4. After each reviewer completes, compress carry-forward context to strengths,
   severity-tagged concerns, suggestions, risk, goal-achievement judgment, and
   uncertainties.
5. Synthesize consensus and divergence from the accumulated reviewer notes.
6. Build the final artifact from completed reviewer evidence, unavailable
   reviewer truth, consensus, disagreements, risk, and follow-ups.
7. Run the final consistency pass before persistence.

Do not replace the missing agent tool with browser/web/search-only analysis.

## Retry And Repair Behavior

- Missing phase: stop with `blueprint_phase_locate` reason and recovery.
- Missing saved plans: stop without writing and route to
  `/blu-plan-phase <phase>`.
- Existing peer review: default to reuse; require explicit overwrite
  confirmation before replacement.
- No available requested reviewers: stop with pending gate
  `reviewer-availability`, do not write a fake review, and keep the next safe
  action on `/blu-review <phase>`.
- Partial reviewer coverage: continue only when at least one requested or
  selected reviewer completed; record unavailable reviewers and failures in the
  artifact.
- Empty or failed reviewer output: mark that reviewer as failed or unavailable
  instead of summarizing it as a pass.
- Invalid peer-review model: repair once against `review.peer-review` task
  schema diagnostics and this reference's richness requirements, then retry
  through `blueprint_review_validate_model` and `blueprint_review_record`.
- Failed retry: stop without manual `.blueprint/` writes.

## Output Quality Criteria

The peer review is strong enough to persist only when:

- the resolved phase, plan count, reviewer selection mode, pending gate,
  execution mode, and artifact create/reuse/revise posture are visible before
  persistence
- every saved plan that was reviewed appears in `Plan Reviews`
- requested, available, completed, unavailable, and failed reviewers are
  separated
- every material concern is attributed to a reviewer or saved evidence
- consensus requires at least two reviewers; otherwise the limitation is stated
- disagreements are preserved with reviewer names and impact
- risk level has concrete rationale
- follow-ups are actionable and tied to plan revision, execution, reviewer
  availability, or implemented follow-up commands
- uncertainty is stated plainly instead of upgraded into false certainty
- next-step guidance names only implemented Blueprint commands

## Completion Criteria

Complete the command only after:

1. the phase resolves or a precise recovery is reported
2. saved plans are found and read, or `/blu-plan-phase <phase>` recovery is
   reported
3. reviewer availability is honest and at least one selected reviewer completed
   or the run stops at `reviewer-availability`
4. any overwrite confirmation gate has cleared
5. the structured model validates and the rendered `XX-REVIEWS.md` satisfies the canonical contract and this reference
6. `blueprint_review_record` returns `created`, `updated`, or `reused`
7. the final response reports phase, reviewed plans, completed and unavailable
   reviewers, artifact status, consensus or limitation, major risks,
   follow-ups, warnings, and next safe implemented action
