# Code Review Fix Runtime Contract

This reference is the local runtime contract for `/blu-code-review-fix`.
It repairs the retained GSD workflow's practical quality in Blueprint-native
terms: MCP owns Blueprint state, the command stays thin, the skill orchestrates,
agents do bounded analysis only, review-fix persistence is schema-first and
model-only, and repo mutation remains explicit and scoped.

## Visible Review-Fix Progress

For non-trivial runs, keep progress visible through short boundary updates.
Gemini-native progress helpers are presentation mirrors only. They do not
expand the MCP tool allowlist, persistence authority, reviewer authority,
repo-mutation authority, state-sync authority, routing authority, or user
confirmation authority defined by this contract.

Visible review-fix stages:

| Step | User-visible wording | Shared stage | Required visibility |
|------|----------------------|--------------|---------------------|
| 1 | resolve remediation phase | Resolve | selected phase, phase directory, or recovery blocker |
| 2 | load saved findings and context | Read | source review path, finding count, follow-up baseline, existing review-fix status, selected targetIds posture, and authoring schema |
| 3 | confirm remediation targets | Decide | selected finding ids, `--all`/bounded `--auto`/explicit mode, overwrite gate, defer/skip posture, and reviewer/fallback mode |
| 4 | remediate selected finding | Execute | active target id, implicated files, fix/defer/skip decision, repo-change status, and verification status |
| 5 | author review-fix model | Persist | lifecycle status, fixed/deferred/blocked counts, report path candidate, and same-targetIds persistence posture |
| 6 | validate remediation evidence | Validate | model-validation status, verification gaps, diagnostics, repair attempt, and partial/blocked reason |
| 7 | sync state and route | Route | state-sync result, implemented next action, remaining gaps, and whether validation or tests should run next |

Progress updates must be short boundary updates. Emit exceptional updates for
missing saved review, no actionable findings, finding-selection waits,
overwrite waits, stale evidence, broader-remediation handoff, reviewer
unavailable fallback, verification failure, model-validation repair, record
rejection, state-sync failure, ambiguous routing, and completion.

## Stage Mapping

### Resolve

- Resolve the target phase with `blueprint_phase_locate`.
- If no phase resolves, stop with the tool's reason and recovery guidance.
- Keep the resolved phase, phase directory, active stage, pending gate, execution
  mode, and next safe action visible.

### Read

- Load saved findings with `blueprint_review_load_findings` using
  `artifact: "code-review"`.
- Read `review.review-fix` with `blueprint_review_authoring_context` before any
  review-fix model drafting, validation, or repair.
- Treat returned `findings`, `severityCounts`, `followUps`, `path`, and
  `warnings` as the remediation baseline. Do not infer findings from chat
  memory, unstaged git drift, or a new prompt-only review.
- Treat the authoring context's saved code-review findings, phase execution
  plan/summary evidence, dependency evidence, locked markers, rendered headings,
  base schema, and narrowed `taskSchema` as the authoring baseline.
- When remediation is intentionally scoped to selected saved findings or
  follow-ups, pass those exact saved target ids as `targetIds` to
  `blueprint_review_authoring_context` and reuse the same array for validation
  and persistence. Omit `targetIds` consistently only for full-baseline runs.
- If an existing `XX-REVIEW-FIX.md` is present, read it as prior remediation
  context and require explicit overwrite confirmation before replacing it.

### Decide

- Select findings from the saved review baseline only.
- Require explicit finding-selection confirmation unless the user already gave a
  narrow scope through `--all`, `--auto`, or clear natural language.
- Treat `--auto` as bounded finding selection, not permission for hidden commits,
  branch creation, a fixer agent, or iterative re-review.
- When the user did not explicitly choose targets, default the candidate
  remediation set to saved `follow-up` findings only. Treat observations,
  accepted risks, validation-only follow-ups, process notes, and stale evidence
  as defer-or-skip inputs unless the user explicitly selects them.
- Prefer high-confidence saved findings for automatic selection. Defer stale,
  ambiguous, or broad findings with a reason instead of widening scope.
- Preserve the confirmed selected saved target ids exactly; they are part of the
  runtime-narrowed schema and must not be recomputed during validate or save.
- Route broader remediation to `/blu-audit-fix`, `/blu-quick`, or
  `/blu-plan-phase` rather than expanding this command in place.

### Execute

- Attempt one selected finding at a time.
- Before editing for a finding, reread the implicated source files and compare
  current code with the saved review evidence.
- If code context differs enough that the saved fix no longer applies, skip or
  defer that finding with a concrete reason.
- Keep modifications limited to files directly implicated by the saved finding.
- Run the narrowest relevant verification from the repo's tooling. At minimum,
  reread changed code and confirm the intended change is present and surrounding
  code is intact. Prefer file-level syntax/type checks or focused tests when the
  repo makes them available.
- When verification fails, undo only the in-progress uncommitted change for that
  finding, document the failure, and continue to the next selected finding when
  doing so is safe.

### Persist

- Author only the `review.review-fix` JSON model. Markdown `content` fallback is
  invalid.
- Use lifecycle statuses `COMPLETED`, `PARTIAL`, or `BLOCKED`.
- Preserve the locked markers `Status`, `Readiness`, `Completion State`, and
  `Next Safe Action` through the schema fields; MCP owns rendered source-review
  provenance.
- Populate only the schema's camelCase keys such as `remediationSummary`,
  `findingsAddressed`, `changesMade`, `verification`, `dependencyPlans`,
  `manualOrDeferredWork`, `gapRoutes`, `followUps`, `evidence`, and
  `nextSafeAction`.
- Literal rendered heading keys like `Remediation Summary`, `Findings
  Addressed`, `Changes Made`, `Verification`, `Dependency Plans`,
  `Manual / Deferred Work`, `Gap / Repair Routes`, `Follow-Ups`, `Evidence`,
  `Next Safe Action`, or locked-marker keys like `Status`, `Readiness`, and
  `Completion State` are forbidden in the JSON model.
- Validate through `blueprint_review_validate_model`, repair diagnostics against
  `authoringContext.taskSchema`, and retry validation once. Pass the same
  `targetIds` array used for authoring context when the run is scoped.
- Persist only the same validated model through `blueprint_review_record` with
  `artifact: "review-fix"` and the same scoped `targetIds` array.
- Treat the returned `reportPath`, `counts`, `followUps`, `status`, and
  `warnings` as authoritative.

### Validate

- If `blueprint_review_validate_model` rejects the model, repair against the
  narrowed task schema and retry once.
- If `blueprint_review_record` rejects the validated model, stop with the exact
  MCP failure reason and summarize the model diagnostics in the response for
  user inspection. Do not write `XX-REVIEW-FIX.md` by hand.
- If repo verification could not run or failed, keep the artifact status
  `PARTIAL` or `BLOCKED` as appropriate and route to validation or tests.

### Route

- Update state through `blueprint_state_update` after the review-fix artifact is
  settled.
- Call `blueprint_state_update` with `base: "synced"` plus an explicit patch
  that sets `activeCommand: "/blu-code-review-fix"`,
  `currentPhase: "<resolved phase>"`, and
  `nextAction: "<chosen implemented action>"`.
- Prefer `/blu-validate-phase <phase>` when behavior changed or verification
  evidence is stale.
- Prefer `/blu-add-tests <phase>` when the main remaining gap is test coverage.
- Prefer `/blu-progress` when no specific implemented follow-up is required.

## Required MCP Calls

- `blueprint_phase_locate`: controls whether the workflow can begin and which
  phase directory/artifact set is authoritative.
- `blueprint_review_load_findings`: controls saved findings, severity counts,
  source review path, follow-ups, and whether remediation can proceed.
- `blueprint_review_authoring_context`: controls the canonical review-fix
  schema, locked markers, rendered headings, saved finding ids, selected
  `targetIds`, plan/summary evidence, dependency evidence, allowed next actions,
  and repair target.
- `blueprint_review_validate_model`: controls schema validation, residual
  diagnostics, normalized model shape, and the render preview.
- `blueprint_review_record`: controls durable `XX-REVIEW-FIX.md` persistence and
  post-write counts/follow-ups.
- `blueprint_state_update`: controls final command state and next implemented
  route.

## Subagent Path

Gemini CLI exposes an enabled delegated reviewer as the same-named
`blueprint-reviewer` tool. Do not read, inline, or load separate agent source
before delegation. Call `blueprint-reviewer` with a bounded reclassification
task packet only when available and useful. Suitable triggers:

- saved findings span multiple files or severity bands
- finding severity is unclear
- selected remediation scope is ambiguous
- the user requests `--auto` but the saved finding set is not trivially narrow

The delegated reviewer may reclassify selected saved targets, flag stale evidence, and
recommend `fix`, `defer`, or `skip` decisions for those exact target ids. It
must stay read-only and must not apply fixes, persist artifacts, invent new
findings, widen scope, use browser/web/search-only tools as substitutes for
codebase analysis, create commits, or route the user.

## No-Subagent Fallback

When `blueprint-reviewer` is unavailable, disabled, unnecessary, or unsafe:

1. Sort selected findings by severity and saved-review order.
2. Work one finding at a time.
3. Reread the implicated source and test files before editing.
4. Decide `fix`, `defer`, or `skip` for the current target before broadening
   work.
5. Record stale-evidence notes whenever the current code no longer matches the
   saved review evidence well enough for safe remediation.
6. Apply only the minimal scoped change for the current `fix` target.
7. Verify the changed surface with the narrowest available check.
8. Record fixed, skipped, or deferred evidence before moving on.
9. Compress carry-forward context to the remaining selected finding ids,
   modified files, verification state, and unresolved blockers.

This fallback is the default safe path; it is not a degraded permission to skip
evidence, scope checks, or artifact richness.

## Retry And Repair Behavior

- Missing saved review: stop and route to `/blu-code-review <phase>`.
- Saved review has no structured findings and no meaningful follow-ups: stop and
  route to `/blu-progress`.
- Existing review-fix artifact: default to reuse; require explicit overwrite
  confirmation before replacement.
- Stale code context: skip or defer the affected finding with the specific
  mismatch.
- Verification failure: roll back the in-progress uncommitted change for that
  finding, document the failure, and continue only if subsequent findings remain
  independent.
- Model validation failure: repair against the narrowed task schema and retry
  once.
- MCP write validation failure: stop without manual file writes.

## Output Quality Criteria

- Every fixed, skipped, or deferred finding ties back to a saved finding id or
  summary from `blueprint_review_load_findings`.
- Changed files and verification evidence are specific enough for a reviewer to
  audit quickly.
- The rendered artifact distinguishes applied fixes from skipped stale-context findings
  and remaining follow-ups.
- The status is honest: `COMPLETED` only when selected findings were fixed and
  verified, `PARTIAL` when some selected findings remain or checks are thin,
  `BLOCKED` when selected findings cannot be safely changed without a blocking
  prerequisite or repair route.
- The user-facing summary reports repo changes, verification, artifact status,
  deferred work, and the next implemented command.

## Completion Criteria

- The selected findings were all attempted or explicitly deferred before
  persistence.
- The `review.review-fix` model was validated through
  `blueprint_review_validate_model` and persisted through
  `blueprint_review_record` with the same selected `targetIds` used for
  authoring, or the run stopped with the exact MCP failure after one model repair
  retry.
- `.blueprint/STATE.md` was updated through `blueprint_state_update` whenever a
  durable artifact was created or updated.
- No unrelated repo files were modified.
- No public command surface, catalog status semantics, hook ownership, hidden git
  automation, or `.planning/` runtime dependency was introduced.
