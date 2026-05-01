# Audit Fix Runtime Contract

This reference is the local runtime contract for `/blu-audit-fix`. It preserves
the useful retained GSD audit-to-fix behavior in Blueprint-native terms: MCP
owns deterministic state, the command remains thin, the skill orchestrates, and
bounded agents classify or verify only when they are suitable.

## Stage Mapping

### Resolve

- Resolve the target phase with `blueprint_phase_locate`.
- If no phase resolves, stop with the tool's reason and recovery guidance.
- Keep the resolved phase, active stage, pending gate, execution mode, and next
  safe action visible.

### Read

- Read the current artifact inventory with `blueprint_artifact_list`.
- Resolve the deterministic repo-file scope with `blueprint_review_scope`.
- Treat `blueprint_review_scope.files` as authoritative. Do not add files from
  unstaged drift, chat memory, broad git history, directories, wildcards,
  `.blueprint/**`, or absolute paths.
- Read saved evidence selected by `--source`: `XX-REVIEW.md`,
  `XX-SECURITY.md`, `XX-VERIFICATION.md`, `XX-UAT.md`, or all available saved
  evidence when `--source all` is used.
- If the selected evidence is missing or too weak to classify, stop and route to
  `/blu-code-review <phase>`, `/blu-verify-work <phase>`, or `/blu-progress`
  instead of inventing findings.

### Decide

- Classify only from saved evidence plus direct inspection of files returned by
  `blueprint_review_scope`.
- Produce a classification table before mutation with one row per finding:
  finding id, evidence source, severity, classification, reason, implicated
  files, and narrow verification.
- Classification values are `auto-fixable`, `manual-only`, or `skip`.
- Treat a finding as `auto-fixable` only when it has specific file evidence, a
  clear bounded change, and a credible verification path.
- Treat design choices, ambiguous scope, architectural changes, broad
  cross-system work, and user-decision-dependent fixes as `manual-only`.
- Treat below-threshold findings as `skip` after applying `--severity`.
- Sort mutation candidates highest-severity-first, preserve stable saved
  evidence order within each severity, and cap attempts with `--max`.
- When uncertain, prefer `manual-only` and explain what evidence would make it
  actionable.

### Execute

- In `--dry-run` mode, do not mutate repo files. Stop after classification,
  optional verifier/reviewer notes, and report persistence.
- In mutation mode, require explicit confirmation before non-trivial fixes such
  as multiple findings, multi-file edits, or medium/high severity changes.
- Process one capped `auto-fixable` finding at a time.
- Before editing each finding, reread the implicated scoped files and confirm
  the saved evidence still matches current code.
- Apply the minimal change for the current finding only.
- Run the narrowest relevant verification available from the repo's tooling.
  At minimum, reread changed code and confirm the intended fix is present.
- Stop on the first failed mutation or failed required verification. Leave later
  candidates unattempted and record why the loop stopped.

### Persist

- Read `report.audit-fix` through `blueprint_artifact_contract_read`, then call
  `blueprint_artifact_report_authoring_context` with the bare report name
  `audit-fix-<phase>` plus `auditFixContext {source, severity, maxAttempts,
  dryRun, scopeFiles}`.
- Author only the structured model fields `status`, `readiness`,
  `completionState`, `remediationSummary`, `summaryEvidence`,
  `classification`, `changesApplied`, `verification`, `pendingPlans`,
  `dependencyPlans`, `manualOrDeferredWork`, `gapRoutes`, `followUpFixes`,
  `evidence`, `commitTraceability`, `todoCapture`, and `nextSafeAction`.
- Preserve the locked wording `Status`, `Readiness`, `Completion State`,
  `Source`, `Severity Filter`, `Max Attempts`, `Dry Run`, `Evidence Used`,
  `Fix Scope`, `Changes Applied`, `Remaining Gaps`, and `Next Safe Action`.
- Persist only through `blueprint_artifact_report_write` with the same
  validated `model`, the same `auditFixContext`, and the bare report name
  `audit-fix-<phase>`.
- Include summary evidence, evidence ledger rows, the classification table,
  attempted-fix statuses, verification results, dependency and pending-plan
  debt, manual or deferred work, gap routes, follow-up fixes, todo-capture
  status, and commit traceability.
- Commit traceability must include the pre-fix HEAD reference, any commit SHA(s)
  created during the run, or `none` when no commit was created.
- If a concrete follow-up should become a todo, ask for explicit confirmation
  first and then append through `blueprint_artifact_mutate_index`. Treat
  returned `createdEntryIds` as authoritative.

### Validate

- Validate the structured report through
  `blueprint_artifact_report_validate_model` before persistence, passing the
  same `auditFixContext`.
- If validation or `blueprint_artifact_report_write` returns `status: "invalid"`
  or warns about schema, marker, or rendered-heading issues, repair the model
  against `contract.modelContract.schemaPath`, the narrowed `taskSchema`, and
  MCP diagnostics, then retry once through MCP.
- If the retry still fails, stop with the exact MCP warnings or thrown error and
  do not write the report by hand.
- If verification could not run, failed, or was reread-only, make that explicit
  in `Changes Applied` or `Remaining Gaps` and route accordingly.
- Use `blueprint-verifier` for a bounded second pass when post-fix verification
  needs summary, UAT, or targeted-check reconciliation beyond a simple local
  check.

### Route

- Update `.blueprint/STATE.md` through `blueprint_state_update` after the report
  path is settled.
- Prefer `/blu-validate-phase <phase>` when behavior changed or prior
  verification evidence is stale.
- Prefer `/blu-add-tests <phase>` when missing or thin test coverage is the main
  remaining gap.
- Prefer `/blu-code-review <phase>` or `/blu-verify-work <phase>` when the
  selected source evidence was too weak to proceed.
- Prefer `/blu-progress` when no specific implemented follow-up is required.

## Required MCP Calls

- `blueprint_phase_locate`: controls phase identity, phase directory, saved
  artifacts, and recovery guidance.
- `blueprint_artifact_list`: controls whether saved review, security,
  verification, UAT, prior report, or todo context exists.
- `blueprint_review_scope`: controls the authoritative repo-file scope and
  whether execution evidence can ground remediation.
- `blueprint_artifact_contract_read`: controls the canonical `report.audit-fix`
  contract, locked markers, rendered headings, model schema path, and notes.
- `blueprint_artifact_report_authoring_context`: controls the narrowed report
  task schema, summary evidence inventory, dependency and pending-plan debt,
  overwrite baseline, allowed next actions, and the accepted `auditFixContext`.
- `blueprint_artifact_report_validate_model`: controls structured-model
  validation diagnostics plus canonical Markdown preview before persistence.
- `blueprint_artifact_report_write`: controls durable report persistence,
  overwrite behavior, validation status, final report path, and model-only
  audit-fix rendering with `auditFixContext`.
- `blueprint_artifact_mutate_index`: controls optional confirmed todo capture
  and authoritative todo ids.
- `blueprint_state_update`: controls final command state and next implemented
  route.

## Artifact Authoring Rules

The audit-fix report must be useful as a standalone review artifact, not merely
schema-valid JSON or valid Markdown.

- `Status`, `Readiness`, and `Completion State` must follow the schema truth
  table, while `Source`, `Severity Filter`, `Max Attempts`, and `Dry Run` come
  from `auditFixContext`; all seven remain exact locked markers.
- `## Evidence Used`: cite selected saved artifacts, scoped repo files, pre-fix
  HEAD, relevant warnings, any unavailable expected evidence, `### Scope
  Files`, `### Summary Evidence`, and `### Evidence Ledger`.
- `## Fix Scope`: record the remediation summary bullets, candidate
  classification table, confirmation gates, the authoritative
  `blueprint_review_scope.files` list, and dependency or pending-plan debt.
- `## Changes Applied`: record fixed, failed, skipped, and dry-run-only
  findings; changed files; verification checks and commands; created commit
  SHA(s) or `none`; and rollback or early-stop details.
- `## Remaining Gaps`: record manual-only findings, gap routes, follow-up
  fixes, todo capture status, unattempted capped candidates, verification gaps,
  stale evidence, and stop reason or `none`.
- `## Next Safe Action`: name exactly one implemented Blueprint command and why
  it is safe from the saved evidence.

Do not create `XX-REVIEW-FIX.md` from this command. That artifact belongs to
`/blu-code-review-fix`.

## Subagent Path

Use `blueprint-reviewer` only as a bounded read-only classification helper when
available and useful. Suitable triggers:

- selected evidence spans multiple artifacts or many scoped files
- severity is unclear
- saved findings need sorting into `auto-fixable`, `manual-only`, or `skip`
- confidence would benefit from a focused second pass before mutation

The reviewer may classify, explain reasons, flag stale evidence, and suggest
narrow verification. It must not apply fixes, persist artifacts, create commits,
invent new files, widen scope, route the user, or act as a browser/web/search-
only substitute for codebase analysis.

Use `blueprint-verifier` only after a fix or dry-run plan when targeted
verification needs a bounded second pass. It may compare changed files, saved
verification/UAT evidence, and targeted check output, then return
`VERIFIED`, `GAPS`, or `BLOCKED` with concrete evidence. It must not persist
reports, mutate repo files, or replace the parent command's final routing.

## No-Subagent Fallback

When suitable subagents are unavailable or unnecessary, the parent command uses
this single-agent fallback:

1. Read selected saved evidence and scoped files.
2. Classify findings into `auto-fixable`, `manual-only`, or `skip`.
3. Present the classification table and obtain any required confirmation.
4. Process one capped finding at a time.
5. Reread implicated files before editing.
6. Apply the minimal scoped fix.
7. Run narrow verification or document why it could not run.
8. Record fixed, failed, skipped, deferred, and unattempted evidence.
9. Compress carry-forward context to remaining finding ids, modified files,
   verification state, and blockers before continuing.

This fallback is the normal safe path, not permission to skip classification,
evidence citations, verification notes, or report richness.

## Retry And Repair Behavior

- Unsupported `--source`: stop with supported values and do not write a report
  unless the user asks for a dry-run diagnostic.
- Missing phase: stop with `blueprint_phase_locate` reason and recovery.
- Invalid scope: stop with `blueprint_review_scope.reason`.
- Missing selected evidence: stop and route to the safest implemented command
  that can create the missing evidence.
- Existing report: require explicit overwrite confirmation before replacement.
- Stale finding context: mark that finding `manual-only` or `skip` with the
  mismatch reason.
- Failed fix or failed required verification: stop the mutation loop, preserve
  evidence, and leave remaining candidates unattempted.
- Invalid report model or write: repair once against `report.audit-fix`,
  `contract.modelContract.schemaPath`, the narrowed `taskSchema`, and MCP
  diagnostics, then retry through the validate/write flow.
- Failed retry: stop without manual `.blueprint/` writes.

## Stop-On-First-Failure Behavior

Mutation mode halts after the first failed mutation or failed required
verification because continuing could cascade errors across unrelated findings.
The report must name the failed finding, changed files, rollback or cleanup
status, verification evidence, and all unattempted candidates.

## Dry-Run Behavior

Dry runs classify and plan only. They may persist the durable audit-fix report,
but they must not mutate repo files, create commits, update tests, or pretend a
fix was verified. The final summary should make the dry-run boundary explicit.

## Commit Traceability

Blueprint does not require hidden automatic commits for `/blu-audit-fix`, but
the report must be traceable either way:

- record pre-fix HEAD before mutation
- record each commit SHA created during this run, if any
- record `none` when no commit was created
- never invent commit ids
- when commits are created, include finding ids or summaries in the commit
  messages where the host workflow allowed it

## Output Quality Criteria

- Findings are traceable to selected saved artifacts and scoped repo files.
- Every classification has a reason and a severity.
- Auto-fixable findings include implicated files and a verification path.
- Manual-only findings explain the missing decision, scope, or architecture
  evidence.
- Skipped findings explain the severity filter, stale context, or source gap.
- The report distinguishes dry-run plans, applied fixes, failed attempts,
  unattempted candidates, and remaining gaps.
- Verification results are concrete: command output summary, focused test name,
  typecheck/build result, reread-only check, or explicit unavailable reason.
- User-facing output names the report path, early-stop state, todo capture
  result, commit traceability, and next implemented command.

## Completion Criteria

- The run resolved a phase and deterministic remediation scope or stopped with
  the exact MCP reason.
- Selected evidence was read before classification.
- The classification table was produced before mutation.
- Mutation, if any, was capped by `--severity` and `--max`, confirmation-gated
  when non-trivial, and stopped on first failure.
- The report model was validated through
  `blueprint_artifact_report_validate_model` with the same `auditFixContext`
  passed to authoring and persistence, and it was then persisted through
  `blueprint_artifact_report_write`, or the run stopped after one failed MCP
  repair retry.
- Optional todo capture used `blueprint_artifact_mutate_index` only after
  explicit confirmation.
- State was updated through `blueprint_state_update` after durable persistence.
- No browser/web/search-only or generic agent was used as a substitute for
  codebase analysis.
- `blueprint-fixer` remained planned-only and non-routable.
