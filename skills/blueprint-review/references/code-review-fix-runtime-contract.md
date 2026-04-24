# Code Review Fix Runtime Contract

This reference is the local runtime contract for `/blu-code-review-fix`.
It repairs the retained GSD workflow's practical quality in Blueprint-native
terms: MCP owns Blueprint state, the command stays thin, the skill orchestrates,
agents do bounded analysis only, and repo mutation remains explicit and scoped.

## Stage Mapping

### Resolve

- Resolve the target phase with `blueprint_phase_locate`.
- If no phase resolves, stop with the tool's reason and recovery guidance.
- Keep the resolved phase, phase directory, active stage, pending gate, execution
  mode, and next safe action visible.

### Read

- Load saved findings with `blueprint_review_load_findings` using
  `artifact: "code-review"`.
- Read `review.review-fix` with `blueprint_artifact_contract_read` before any
  review-fix artifact drafting, validation, or repair.
- Treat returned `findings`, `severityCounts`, `followUps`, `path`, and
  `warnings` as the remediation baseline. Do not infer findings from chat
  memory, unstaged git drift, or a new prompt-only review.
- If an existing `XX-REVIEW-FIX.md` is present, read it as prior remediation
  context and require explicit overwrite confirmation before replacing it.

### Decide

- Select findings from the saved review baseline only.
- Require explicit finding-selection confirmation unless the user already gave a
  narrow scope through `--all`, `--auto`, or clear natural language.
- Treat `--auto` as bounded finding selection, not permission for hidden commits,
  branch creation, a fixer agent, or iterative re-review.
- Prefer high-confidence saved findings for automatic selection. Defer stale,
  ambiguous, or broad findings with a reason instead of widening scope.
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

- Author `XX-REVIEW-FIX.md` from the canonical `review.review-fix` template.
- Include concrete evidence in every section:
  - `## Findings Addressed`: saved finding ids or summaries plus fixed,
    skipped, or deferred status.
  - `## Changes Made`: repo files changed and what changed.
  - `## Verification`: commands run, targeted checks, reread-only checks, or why
    no reliable check was available.
  - `## Follow-Ups`: remaining saved findings, skipped items, stale evidence,
    or `none`.
  - `## Next Safe Action`: one implemented Blueprint command.
- Persist only through `blueprint_review_record` with `artifact: "review-fix"`.
- Treat the returned `reportPath`, `counts`, `followUps`, `status`, and
  `warnings` as authoritative.

### Validate

- If `blueprint_review_record` rejects the artifact or reports missing required
  headings, repair against the `review.review-fix` template and retry once.
- If the retry still fails, stop with the exact MCP failure reason and present
  the drafted artifact body in the response for user inspection. Do not write
  `XX-REVIEW-FIX.md` by hand.
- If repo verification could not run or failed, keep the artifact status
  `PARTIAL` or `SKIPPED` as appropriate and route to validation or tests.

### Route

- Update state through `blueprint_state_update` after the review-fix artifact is
  settled.
- Prefer `/blu-validate-phase <phase>` when behavior changed or verification
  evidence is stale.
- Prefer `/blu-add-tests <phase>` when the main remaining gap is test coverage.
- Prefer `/blu-progress` when no specific implemented follow-up is required.

## Required MCP Calls

- `blueprint_phase_locate`: controls whether the workflow can begin and which
  phase directory/artifact set is authoritative.
- `blueprint_review_load_findings`: controls saved findings, severity counts,
  source review path, follow-ups, and whether remediation can proceed.
- `blueprint_artifact_contract_read`: controls the canonical review-fix
  headings, locked markers, placeholder signals, and repair target.
- `blueprint_review_record`: controls durable `XX-REVIEW-FIX.md` persistence and
  post-write counts/follow-ups.
- `blueprint_state_update`: controls final command state and next implemented
  route.

## Subagent Path

Use `blueprint-reviewer` only as a bounded analysis helper when available and
useful. Suitable triggers:

- saved findings span multiple files or severity bands
- finding severity is unclear
- selected remediation scope is ambiguous
- the user requests `--auto` but the saved finding set is not trivially narrow

The subagent may reclassify saved findings, flag stale evidence, and recommend a
selection/defer list. It must stay read-only and must not apply fixes, persist
artifacts, invent new findings, use browser/web/search-only tools as substitutes
for codebase analysis, create commits, or route the user.

## No-Subagent Fallback

When `blueprint-reviewer` is unavailable or unnecessary:

1. Sort selected findings by severity and saved-review order.
2. Work one finding at a time.
3. Reread the implicated source and test files before editing.
4. Apply only the minimal scoped change for the current finding.
5. Verify the changed surface with the narrowest available check.
6. Record fixed, skipped, or deferred evidence before moving on.
7. Compress carry-forward context to the remaining selected finding ids,
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
- MCP write validation failure: repair against the canonical template and retry
  once; if still failing, stop without manual file writes.

## Output Quality Criteria

- Every fixed, skipped, or deferred finding ties back to a saved finding id or
  summary from `blueprint_review_load_findings`.
- Changed files and verification evidence are specific enough for a reviewer to
  audit quickly.
- The artifact distinguishes applied fixes from skipped stale-context findings
  and remaining follow-ups.
- The status is honest: `APPLIED` only when selected findings were fixed and
  verified, `PARTIAL` when some selected findings remain or checks are thin,
  `SKIPPED` when no selected finding could be safely changed.
- The user-facing summary reports repo changes, verification, artifact status,
  deferred work, and the next implemented command.

## Completion Criteria

- The selected findings were all attempted or explicitly deferred before
  persistence.
- `XX-REVIEW-FIX.md` was persisted through `blueprint_review_record` or the run
  stopped with the exact MCP write failure after one repair retry.
- `.blueprint/STATE.md` was updated through `blueprint_state_update` whenever a
  durable artifact was created or updated.
- No unrelated repo files were modified.
- No public command surface, catalog status semantics, hook ownership, hidden git
  automation, or `.planning/` runtime dependency was introduced.
