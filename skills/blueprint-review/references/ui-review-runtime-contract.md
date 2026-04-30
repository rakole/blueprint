# Blueprint UI Review Runtime Contract

This reference is the runtime-heavy contract for `/blu-ui-review`. It keeps the
retained GSD UI-audit value in Blueprint-native terms: MCP owns deterministic
state and persistence, the command remains thin, the skill orchestrates, and the
optional UI auditor performs bounded read-only analysis.

## Contract Authority

- `mcp_blueprint_blueprint_artifact_contract_read` exposes the base model
  schema and rendered heading contract for `review.ui-review`.
- The returned `contract.modelContract.schemaPath`,
  `contract.modelContract.jsonSchema`, and
  `blueprint_review_authoring_context.authoringContext.taskSchema` are the
  schema authority before drafting, repair, or persistence.
- This reference is the output-quality authority: it defines evidence depth,
  scored pillar expectations, capability-gated auditor use, fallback behavior,
  and write repair.
- Do not add new public command names, `.planning/` runtime dependencies,
  shell-owned persistence, hook-owned state, or direct writes to
  `XX-UI-REVIEW.md`.

## Stage Mapping

Map `/blu-ui-review` to the shared stages:

### Resolve

- Resolve the target phase with `mcp_blueprint_blueprint_phase_locate`.
- If no phase resolves, stop with the tool reason and useful recovery guidance.
- Keep the resolved phase, active stage, pending gate, execution mode, and next
  safe action visible.

### Read

- Read the artifact inventory with `mcp_blueprint_blueprint_artifact_list`.
- Require at least one completed execution summary before persistence. If no
  `XX-YY-SUMMARY.md` artifact exists, stop and route to
  `/blu-execute-phase <phase>`.
- Read `review.ui-review` with
  `mcp_blueprint_blueprint_artifact_contract_read` before drafting,
  validating, or repairing the UI-review artifact.
- Read `mcp_blueprint_blueprint_review_authoring_context` with
  `artifact: "ui-review"` before drafting. Treat missing completed summaries as
  a blocker, and treat returned evidence keys and allowed next actions as exact.
- Read saved summaries, matching plans when available through artifact paths or
  command context, the saved `XX-UI-SPEC.md` contract when present, validation
  or UAT evidence when present, and the actual repo surface implicated by the
  saved phase evidence. Inspect a prior `XX-UI-REVIEW.md` when present for the
  reuse-or-overwrite decision, but do not cite the replacement path as reviewed
  evidence because it will be overwritten in place.
- Use explicitly supplied screenshots, recordings, browser observations, or
  visual descriptions as evidence when available. When they are unavailable,
  record the audit as code/static-evidence-only instead of claiming visual
  certainty.

### Decide

- Decide whether the phase has actual UI/UX scope or only a saved UI-spec skip
  rationale. A no-UI phase may produce a `PASS` or `FOLLOW_UP` artifact only if
  the evidence and skip rationale are explicit.
- Decide whether an existing `XX-UI-REVIEW.md` is reused or replaced. Default
  to reuse and require explicit overwrite confirmation before replacement.
- Decide whether the run benefits from `blueprint-ui-auditor`. Use the auditor
  for multiple screens, richer interaction state, non-obvious visual evidence,
  prior-review comparison, or a broad saved UI contract.
- Keep pending gates limited to overwrite confirmation unless the command must
  stop for missing execution evidence.

### Execute

- Conduct a bounded six-pillar UI audit against the saved phase evidence and
  actual frontend surface.
- Score each pillar from 1 to 4 and compute an overall score out of 24:
  `Copywriting`, `Visual Hierarchy`, `Color`, `Typography`, `Spacing`, and
  `Experience Design`.
- For each score, cite concrete evidence: saved artifact paths, repo-relative
  files and lines when available, UI-spec requirements, screenshot or visual
  observation references, or explicit unavailable-evidence notes.
- Identify up to three priority fixes with user impact and concrete repair
  guidance. If no material fix exists, write `none` and explain the pass
  evidence.
- Treat accessibility, responsiveness, interaction states, consistency, and
  polish as required evidence dimensions inside the relevant scored pillars,
  especially `Visual Hierarchy` and `Experience Design`.
- If `components.json` or the saved UI spec indicates third-party UI registry
  usage, do a read-only registry-safety pass over checked-in component source
  when available. Flag suspicious network calls, dynamic code execution,
  external dynamic imports, or unexplained local modifications as findings or
  follow-ups. If the evidence is unavailable, record that limitation.

### Persist

- Author the `review.ui-review` JSON model against the narrowed task schema.
- Persist only through `mcp_blueprint_blueprint_review_record` with numeric
  `phase`, `artifact: "ui-review"`, and the same validated structured `model`.
  Markdown `content` fallback is invalid; MCP renders canonical Markdown.
- Treat the returned `reportPath`, `counts`, `followUps`, `status`, and
  `warnings` as authoritative.
- Never hand-write `XX-UI-REVIEW.md`.

### Validate

- Validate the model through `mcp_blueprint_blueprint_review_validate_model`
  before persistence and repair all diagnostics together against the task schema.
- Ensure the rendered artifact includes the canonical headings:
  `UI Review Summary`, `Evidence Reviewed`, `Findings`, `Follow-Ups`, and
  `Next Safe Action`.
- Also include the richer authoring sections from the canonical template:
  `Pillar Scores`, `Priority Fixes`, and `Audit Trail`.
- Run a final consistency pass before persistence: every score has evidence,
  the overall score equals the six pillar scores, priority fixes appear in
  `Findings` or `Follow-Ups`, unavailable visual evidence is stated plainly,
  and next-step guidance names only implemented Blueprint commands.
- If `blueprint_review_validate_model` or `blueprint_review_record` rejects the
  model, repair once against `review.ui-review` and retry through MCP. If the retry
  still fails, stop with the exact MCP reason and do not write the artifact by
  hand.

### Route

- Route only to implemented Blueprint commands. Prefer
  `/blu-validate-phase <phase>` when validation is missing, then
  `/blu-verify-work <phase>` when UAT is missing, otherwise `/blu-progress`.
- If material UI follow-up remains but the safe next action is ambiguous, route
  to `/blu-progress` rather than inventing a planned command.

## Required MCP Calls

Call these tools in this order unless the command must stop early:

1. `mcp_blueprint_blueprint_phase_locate`
   - Controls target phase, phase directory, phase prefix, and missing-phase
     recovery.
2. `mcp_blueprint_blueprint_artifact_list`
   - Controls saved-evidence inventory, existing UI-review state, UI-spec
     presence, validation/UAT presence, and missing-summary recovery.
3. `mcp_blueprint_blueprint_artifact_contract_read` for `review.ui-review`
   - Controls base schema, required headings, locked markers, authoring template,
     and repair target.
4. `mcp_blueprint_blueprint_review_authoring_context`
   - Controls completed-summary prerequisites, live evidence keys, existing
     UI-review path, pending-plan narrowing, and allowed next actions.
5. `mcp_blueprint_blueprint_review_validate_model`
   - Controls AJV schema diagnostics, residual quality diagnostics, and the
     canonical Markdown render preview.
6. `mcp_blueprint_blueprint_review_record`
   - Controls the final filename, create/update/reuse status, counts,
     follow-ups, warnings, and validation failures.

## Artifact Authoring Rules

The UI-review model must be useful standalone review evidence after MCP renders
it, not merely valid JSON.

- `**Verdict:** PASS`, `FOLLOW_UP`, or `BLOCKED`.
- `## UI Review Summary`: phase, UI surface, baseline (`XX-UI-SPEC.md` or
  abstract standards), overall score out of 24, screenshot/visual-evidence
  posture, execution mode, and one-line verdict rationale.
- `## Evidence Reviewed`: saved summaries, UI spec, plans or context when
  available, validation or UAT artifacts, prior UI review when present,
  screenshots or visual observations, repo paths and lines, and unavailable
  evidence that limits confidence.
- `## Pillar Scores`: a table with `Copywriting`, `Visual Hierarchy`, `Color`,
  `Typography`, `Spacing`, and `Experience Design`, each scored `1/4` through
  `4/4` with a key finding and evidence reference.
- `## Priority Fixes`: top three concrete fixes with user impact and suggested
  repair, or `none`.
- `## Findings`: grouped by pillar or severity. Each material finding should
  include the pillar, score impact, evidence, user impact, and fix or
  verification guidance.
- `## Follow-Ups`: actionable UI repair, visual verification, registry-safety
  follow-up, validation step, or `none`.
- `## Audit Trail`: audit date, execution mode, auditor/fallback path, existing
  review posture, and whether visual evidence was captured, supplied, or
  unavailable.
- `## Next Safe Action`: exactly one implemented Blueprint command.

Do not persist placeholder scores, generic "looks good" prose, or findings
without evidence. If the result is a pass, explain which surfaces and pillars
were checked and why the evidence supports `PASS`.

## Capability-Gated Subagent Path

Use `blueprint-ui-auditor` only when a suitable code/UI analysis subagent is
available and the scope benefits from bounded deep work:

- multiple UI surfaces, components, or responsive breakpoints
- a saved `XX-UI-SPEC.md` with concrete design-system, layout, copy, or state
  requirements
- prior `XX-UI-REVIEW.md` comparison
- user-supplied screenshots or visual observations that need structured review
- third-party registry or component-source evidence that needs a read-only
  pass

Pass the auditor only:

- the resolved phase and phase evidence inventory
- saved summaries, UI spec, context or plans when available, prior UI review,
  for comparison only, and selected repo paths
- explicit screenshots or visual observations supplied in the session
- the canonical `review.ui-review` authoring requirements and scored-pillar
  expectations

The auditor returns scored findings and an artifact draft. The parent command
owns all confirmation, user-facing progress, MCP writes, validation, and
routing.

Browser-only, web-search-only, shell-only, or generic helpers are not
acceptable substitutes for `blueprint-ui-auditor`.

## No-Subagent Fallback

If `blueprint-ui-auditor` is unavailable or unnecessary, continue sequentially
in the parent session.

1. Read saved evidence first: summaries, UI spec, context or plans when
   available, validation or UAT artifacts, existing UI review for comparison
   only, and implicated repo files.
2. Identify the actual UI surfaces from saved evidence and repo paths. If the
   surface cannot be identified, record that uncertainty instead of widening
   the audit.
3. Audit one pillar at a time in this order: Copywriting, Visual Hierarchy,
   Color, Typography, Spacing, Experience Design.
4. After each pillar, compress carry-forward context to checked evidence,
   score, confirmed findings, open uncertainties, and likely follow-ups.
5. Build the final artifact from accumulated scores, pass signals, findings,
   and follow-ups.
6. Run the final consistency pass before persistence.

Do not replace the missing subagent with browser/web/search-only analysis.

## Retry And Repair Behavior

- Missing phase: stop with `blueprint_phase_locate` reason and recovery.
- Missing summaries: stop without writing and route to
  `/blu-execute-phase <phase>`.
- Existing UI review: default to reuse; require explicit overwrite confirmation
  before replacement.
- Missing UI spec: continue against abstract six-pillar standards, but mark the
  baseline as `abstract standards` and record the confidence limitation.
- Missing screenshot or visual runtime evidence: continue code/static-evidence
  audit, record `Screenshots: not captured or not supplied`, and avoid claims
  that require visual inspection.
- Invalid UI-review model or write: repair once against `review.ui-review`,
  `authoringContext.taskSchema`, and this reference's richness requirements,
  then retry through `blueprint_review_validate_model` and
  `blueprint_review_record`.
- Failed retry: stop without manual `.blueprint/` writes.

## Output Quality Criteria

The UI review is strong enough to persist only when:

- the resolved phase, UI surface, baseline, execution mode, pending gate, and
  artifact create/reuse/revise posture are visible before persistence
- saved summaries and the UI spec, when present, are cited in evidence
- every scored pillar has a score, evidence, and short rationale
- the overall `/24` score matches the six pillar scores
- top priority fixes are concrete enough to act on
- accessibility, responsiveness, interaction states, consistency, and polish
  are considered and either evidenced or explicitly unavailable
- screenshot or visual-runtime limitations are called out honestly
- registry or third-party component risk is checked when saved evidence makes
  it relevant
- next-step guidance names only implemented Blueprint commands

## Completion Criteria

Complete the command only after:

1. the phase is resolved or precise recovery is reported
2. required execution evidence exists or the command routed to execute-phase
3. any overwrite gate has cleared
4. the UI audit has produced scored pillar evidence
5. the model validates and the rendered `XX-UI-REVIEW.md` content satisfies the
   canonical contract and this reference
6. `blueprint_review_record` returns `created`, `updated`, or `reused`
7. the final response reports phase, artifact status, overall score, top
   findings or pass signals, warnings, and next safe implemented action
