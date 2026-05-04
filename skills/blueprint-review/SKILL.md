---
name: blueprint-review
description: >
  Review, security, UI-audit, and peer-review orchestration for Blueprint. Use
  this skill to keep phase-scoped review artifacts MCP-owned, grounded in saved
  repo evidence, and explicit about follow-up risk.
status: implemented
commands:
  - /blu-secure-phase
  - /blu-code-review
  - /blu-code-review-fix
  - /blu-audit-fix
  - /blu-ui-review
  - /blu-review
input_bundles:
  shared: []
  commands:
    "/blu-code-review":
      - commands/blu-code-review.toml
      - skills/blueprint-review/references/code-review-runtime-contract.md
    "/blu-code-review-fix":
      - commands/blu-code-review-fix.toml
      - skills/blueprint-review/references/code-review-fix-runtime-contract.md
    "/blu-audit-fix":
      - commands/blu-audit-fix.toml
      - skills/blueprint-review/references/audit-fix-runtime-contract.md
    "/blu-secure-phase":
      - commands/blu-secure-phase.toml
      - skills/blueprint-review/references/secure-phase-runtime-contract.md
    "/blu-review":
      - commands/blu-review.toml
      - skills/blueprint-review/references/review-runtime-contract.md
    "/blu-ui-review":
      - commands/blu-ui-review.toml
      - skills/blueprint-review/references/ui-review-runtime-contract.md
---

# Blueprint Review Skill

## Purpose

Orchestrate Blueprint's review-family commands so durable review artifacts are
phase-scoped, evidence-backed, and persisted only through MCP tools.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful review intent while preserving Blueprint
deltas:

- review outputs are durable artifacts, not prompt-only summaries
- security, code-review, UI-review, and peer-review results stay phase-scoped
- persistent writes remain MCP-owned instead of script-owned
- optional bounded agents analyze evidence, but commands own routing and
  confirmation language
- follow-up risks stay explicit in artifacts instead of disappearing into chat
- implemented-only routing remains the source of truth for next-step guidance

Today, `code-review`, `code-review-fix`, `secure-phase`, `review`, `ui-review`, and `audit-fix` are the shipped
review-family commands. Other review-family commands remain documented but
non-routable until their extra MCP substrate lands.

## Required Inputs

Command-specific inputs are resolved from the structured `input_bundles`
frontmatter for the invoking review command. Shipped review commands are
intentionally docs-free at runtime: load the command manifest and matching local
runtime contract, then use MCP tools, resources, artifact contracts, saved phase
artifacts, and optional review agents when the command contract allows them.

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_config_get`
- `blueprint_artifact_list`
- `blueprint_phase_plan_index`
- `blueprint_phase_plan_read`
- `blueprint_phase_summary_index`
- `blueprint_phase_summary_read`
- `blueprint_phase_execution_targets`
- `blueprint_review_scope`
- `blueprint_review_load_findings`
- `blueprint_review_authoring_context`
- `blueprint_review_validate_model`
- `blueprint_review_record`
- `blueprint_artifact_contract_read`
- `blueprint_artifact_report_authoring_context`
- `blueprint_artifact_report_validate_model`
- `blueprint_artifact_report_write`
- `blueprint_artifact_mutate_index`
- `blueprint_state_update`

## Optional Agents

- `blueprint-reviewer`
- `blueprint-security-auditor`
- `blueprint-ui-auditor`
- `blueprint-verifier`

## Shared Runtime Contract

- Execution profile for `code-review`: `long-running-mutation`
- Execution profile for `code-review-fix`: `long-running-mutation`
- Execution profile for `audit-fix`: `long-running-mutation`
- Execution profile for `secure-phase`: `long-running-mutation`
- Execution profile for `review`: `long-running-mutation`
- Execution profile for `ui-review`: `long-running-mutation`
- Each command-local runtime contract owns the detailed stage vocabulary, in-flight status fields, and waiting-state semantics for that surface.

## Shared MCP Contracts

- `blueprint_review_scope`: explicit `files` must be repo-relative file paths. Directories, wildcards, absolute paths, and `.blueprint/**` paths are invalid or skipped. Omit `files` when the command wants scope derived from executed plans and summaries, treat returned `files` as authoritative, use `confirmationRecommended` instead of prompt-only heuristics for scope-confirmation gates, and request `includeAuthoringContext` for code-review model authoring.
- `blueprint_review_authoring_context`: request this for `review.peer-review`, `review.security`, `review.review-fix`, and `review.ui-review` authoring before drafting the model. For peer review, treat selected phase plans plus saved phase evidence as schema-owned runtime context. For review-fix, treat saved code-review findings plus phase execution plan, summary, and dependency evidence as schema-owned runtime context. For ui-review, treat completed summaries, pending plans, exact evidence keys, existing UI-review path, allowed overwrite posture, and allowed next actions as schema-owned runtime context. Pass the exact selected saved target ids as `targetIds` when remediation is intentionally scoped to a subset, and keep that same array through validation and persistence. Treat `status: "invalid"` as an early blocker rather than an invitation to invent summaries, finding rows, threat rows, evidence keys, or next actions.
- `blueprint_review_validate_model`: validate `review.code-review`, `review.peer-review`, `review.review-fix`, `review.security`, and `review.ui-review` JSON against the runtime-narrowed `taskSchema`, aggregate schema plus residual diagnostics, and use `renderPreview` only after the model is valid. For review-fix subset remediation, pass the same `targetIds` used for authoring context.
- `blueprint_review_record`: pass numeric `phase` and the correct review `artifact` enum. For model-only artifacts (`code-review`, `peer-review`, `review-fix`, `security`, and `ui-review`), pass only the validated structured `model`; `code-review` also passes resolved `scopeFiles` and `scopeSource`, and `review-fix` also passes the same `targetIds` selection when the model covers a subset. Markdown `content` is invalid for all five. The tool owns the final review filename; use returned `reportPath`, `counts`, and `followUps` as authoritative.
- `blueprint_artifact_contract_read`: read the canonical review and report contracts before drafting, updating, or validating review artifacts instead of relying on copied prompt-local templates.
- `blueprint_review_load_findings`: omit `artifact` only when the command intentionally wants saved `code-review` findings; use returned `findings` and `severityCounts` as the authoritative fix baseline.
- `blueprint_artifact_report_authoring_context`: for `report.audit-fix`, pass the bare report name plus the exact `auditFixContext {source, severity, maxAttempts, dryRun, scopeFiles}` so saved evidence, completed summary inventory, dependency/pending-plan debt, and report marker rendering stay MCP-owned.
- `blueprint_artifact_report_validate_model`: for `report.audit-fix`, validate only the structured model fields `status`, `readiness`, `completionState`, `remediationSummary`, `summaryEvidence`, `classification`, `changesApplied`, `verification`, `pendingPlans`, `dependencyPlans`, `manualOrDeferredWork`, `gapRoutes`, `followUpFixes`, `evidence`, `commitTraceability`, `todoCapture`, and `nextSafeAction`; pass the same `auditFixContext` used for authoring context.
- `blueprint_artifact_report_write`: pass a bare report name such as `audit-fix-3`, not `.blueprint/reports/audit-fix-3.md`. For `report.audit-fix`, persist the same validated structured `model` plus the same `auditFixContext`, and use the returned `path` as authoritative.
- Do not guess review scope from unstaged repo drift when saved phase evidence is the authoritative baseline.
- Keep repo mutation tightly bounded to the resolved review scope and capped candidate set.

## Workflow Rules

### `code-review`

1. Load `skills/blueprint-review/references/code-review-runtime-contract.md`
   before analysis. That local reference owns depth semantics, artifact
   richness, capability-gated reviewer use, no-subagent fallback, and
   invalid-write repair for `/blu-code-review`.
2. Resolve the target phase first and read the current Blueprint artifact
   inventory before reviewing code.
3. Read the canonical review contract through `blueprint_artifact_contract_read` before drafting the model that will render to `XX-REVIEW.md`, then use the returned `modelContract.schemaPath`, JSON schema, and template metadata as the baseline.
4. Use `blueprint_review_scope` to derive the deterministic repo file list from
   executed plan metadata or explicit file arguments; do not guess from git
   diff alone. Pass `includeAuthoringContext: true` before authoring JSON.
5. Keep the shared review posture from the local runtime contract legible
   throughout the run.
6. For non-trivial code-review runs, prefer update_topic plus `write_todos` so
   evidence review, scope resolution, scope confirmation, bounded findings
   analysis, artifact persistence, and routing stay visible without becoming
   persistence.
7. Require executed phase evidence unless the user supplied an explicit file
   scope.
8. Inspect any existing `XX-REVIEW.md` before proposing replacement and default
   to reuse unless the user explicitly asks for an update.
9. Keep findings grounded in the selected repo files plus saved execution,
   validation, or UAT artifacts.
10. Use `blueprint-reviewer` when the scope spans multiple plans, multiple files,
   or a deep pass that benefits from a bounded second look.
11. If `blueprint-reviewer` is unavailable or unnecessary, use the no-subagent
    fallback from the local runtime contract: review saved evidence first,
    handle one file group at a time, compress carry-forward context, and run a
    final severity-count consistency pass.
12. Keep the scope confirmation gate explicit when
    `blueprint_review_scope.confirmationRecommended` says the resolved review
    crossed deterministic thresholds, and keep rolling finding counts or
    severity buckets visible while the review is in flight.
13. Author only the code-review JSON model fields: `verdict`, `reviewSummary`,
   `positiveSignals`, `findings`, `evidenceCoverage`, `followUps`, and
   `nextSafeAction`. Let MCP own depth, scope/source, evidence inventory,
   severity counts, path, and Markdown rendering.
14. Validate through `blueprint_review_validate_model`; repair every returned
   diagnostic against `authoringContext.taskSchema`, then retry validation once.
15. Persist the validated model through `blueprint_review_record` with the
   `code-review` artifact, resolved `scopeFiles`, and the returned
   `reviewMode.source` as `scopeSource`. Use `scopeSource: "explicit-files"`
   only when the user supplied explicit file arguments. Do not pass Markdown
   `content` for code-review, and do not hand-edit `.blueprint/`.
16. Keep next-step guidance inside implemented Blueprint commands only. Prefer
   `/blu-secure-phase <phase>` when the phase still lacks a security artifact,
   `/blu-code-review-fix <phase>` when concrete follow-up fixes remain, and
   otherwise `/blu-progress`.

### `code-review-fix`

1. Resolve the target phase and load the saved `XX-REVIEW.md` findings before
   proposing any repo mutation.
2. Use `blueprint_review_load_findings` for the findings baseline; do not infer
   fix scope from chat memory or raw git drift when review evidence is missing.
3. Read the review-fix authoring context through
   `blueprint_review_authoring_context` before drafting `XX-REVIEW-FIX.md`, then
   use its model contract, narrowed task schema, locked markers, rendered
   headings, saved findings, phase execution plan/summary evidence, and
   dependency evidence as the baseline for the persisted artifact. If the run
   selects a subset, pass the exact selected saved target ids as `targetIds` and
   keep that same array for validation and persistence.
4. Load `skills/blueprint-review/references/code-review-fix-runtime-contract.md`
   for the detailed stage mapping, required MCP call controls, artifact
   authoring rules, capability-gated subagent path, no-subagent fallback,
   retry/repair behavior, output quality criteria, and completion criteria.
5. If there is no saved `XX-REVIEW.md` or no structured finding to act on,
   route back to `/blu-code-review <phase>` or `/blu-progress` instead of
   bluffing.
6. Use Gemini CLI's `ask_user` tool for overwrite confirmation and for any
   structured confirmation of which findings Blueprint is about to fix.
7. Treat `--auto` as bounded finding selection only. It may skip the manual
   selection step for a narrow, high-confidence saved finding set, but it does
   not authorize any auto-fixer behavior, automatic commits, branch creation,
   or hidden iterative re-review loops.
   It does not authorize automatic commits, branch creation, or iterative re-review loops.
8. Require explicit confirmation of the selected findings unless the user
   clearly requested `--all`, `--auto`, or an equivalent narrow automatic fix.
9. Keep repo mutation tightly bounded to the selected review findings and the
   implicated repo files.
10. Use `blueprint-reviewer` for bounded reclassification when the saved review
   is broad or ambiguous. The subagent stays read-only: it may sort,
   reclassify, or recommend selected/deferred findings, but it must not apply
   fixes, persist artifacts, create commits, or act as a browser/web/search-only
   substitute for codebase analysis.
11. When the subagent is unavailable or unnecessary, use the no-subagent
   fallback from the runtime contract: process one selected finding at a time,
   reread implicated files, apply the minimal scoped change, verify the changed
   surface, record fixed/skipped/deferred evidence, and compress carry-forward
   context before moving to the next finding.
12. Keep the active stage visible as the run moves through `Resolve`, `Read`,
    `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the
    resolved scope, active stage, pending gate, execution mode, and next safe
    action legible throughout the run.
13. For non-trivial code-review-fix runs, prefer update_topic plus
    `write_todos` so saved-findings review, finding-selection confirmation,
    bounded remediation, artifact persistence, verification, and routing stay
    visible without becoming persistence.
14. Report the resolved phase, resolved scope, selected finding ids,
    remediation progress, and verification progress while work is in flight,
    not only in the closing summary. Keep pending gates limited to overwrite confirmation or
    finding-selection confirmation, and let execution mode reflect whether the
    run stays inline, uses the reviewer subagent, or is following an explicit
    versus bounded `--auto` selection path.
15. Author only the `review.review-fix` JSON model. Use lifecycle statuses
   `COMPLETED`, `PARTIAL`, or `BLOCKED`; preserve the locked markers `Status`,
   `Readiness`, `Completion State`, and `Next Safe Action`; and fill rendered
   heading evidence for `Remediation Summary`, `Findings Addressed`,
   `Changes Made`, `Verification`, `Dependency Plans`,
   `Manual / Deferred Work`, `Gap / Repair Routes`, `Follow-Ups`, `Evidence`,
   and `Next Safe Action`.
16. Validate through `blueprint_review_validate_model`; repair every returned
   diagnostic against `authoringContext.taskSchema`, then retry validation once.
   Pass the same `targetIds` array used for authoring context. Markdown `content`
   fallback is invalid.
17. Persist the same validated model as `XX-REVIEW-FIX.md` through
   `blueprint_review_record` with the `review-fix` artifact and the same
   `targetIds` selection.
18. If `blueprint_review_record` rejects the model, stop with the MCP reason and
   do not write the artifact by hand.
19. Update `STATE.md` through `blueprint_state_update` so follow-up routing stays
   inside implemented commands. Prefer `/blu-validate-phase <phase>` when
   behavior changed, `/blu-add-tests <phase>` when missing tests are the main
   remaining gap, and `/blu-progress` otherwise.
20. No auto-fixer behavior is shipped. Do not invent a `blueprint-fixer`,
    implicit branch or commit flow, or hidden iterative re-review pass.

### `secure-phase`

1. Load `skills/blueprint-review/references/secure-phase-runtime-contract.md`
   before analysis. That local reference owns the retained security behavior:
   State A/B/C input handling, saved threat-model parsing, summary threat-flag
   incorporation, bounded auditor use, no-subagent fallback, retry/repair,
   threat-count consistency, and advancement blocking.
2. Resolve the target phase and require saved completed execution summaries
   before the audit begins.
3. Read the existing Blueprint artifact inventory first so the audit can cite
   summaries, validation, and UAT artifacts when they exist.
4. Read the canonical `review.security` contract through
   `blueprint_artifact_contract_read` before drafting or revising security
   evidence, and use `contract.modelContract.schemaPath`,
   `contract.modelContract.jsonSchema`, and the secure-phase task schema as the
   model-authoring authority instead of a copied prompt-local Markdown
   structure.
5. Inspect any existing `XX-SECURITY.md` before proposing replacement and
   default to reuse unless the user explicitly asks for an update. Use Gemini
   CLI's `ask_user` tool for overwrite confirmation before replacement.
6. Read `blueprint_phase_plan_index` and `blueprint_phase_plan_read` so the
   saved phase threat model can be parsed from executed plan evidence, then
   build a threat register from the declared threats and mitigations. Include
   threat id, category, component, disposition, mitigation, status, and evidence
   for each declared threat.
7. Read `blueprint_phase_summary_index`, `blueprint_phase_summary_read`, and
   `blueprint_phase_execution_targets` so completed summaries, pending plans,
   lower-wave blockers, and overwrite candidates are explicit before authoring.
   Stop before persistence when the phase has no completed summaries or still
   has pending plan work.
8. Read `blueprint_review_authoring_context` before drafting. Use its
   `authoringContext.taskSchema` as the effective secure-phase model schema,
   and stop on `status: "invalid"` instead of inventing upstream context.
9. Read executed summaries from the artifact inventory and incorporate
   `## Threat Flags` when present. Map them to declared threats when possible,
   and record unregistered flags separately instead of widening the audit into a
   broad scan.
10. Keep the audit bounded to that declared security scope from saved plan
   evidence only rather than a broad scan.
11. Keep the active stage visible as the run moves through `Resolve`, `Read`,
   `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the
   resolved scope, active stage, pending gate, execution mode, and next safe
   action legible throughout the run.
12. For non-trivial secure-phase runs, prefer update_topic plus `write_todos`
   so saved-plan review, threat verification, overwrite gates, artifact
   persistence, post-write validation, and routing stay visible without
   becoming persistence.
13. Report the resolved scope, threat-register coverage, whether the security
   artifact is being reused or revised, and the current pending-open-threat
   status while work is in flight. Keep the verify-versus-accept decision
   explicit whenever threats remain open. Keep pending gates limited to
   overwrite confirmation, the verify-versus-accept decision, or
   `pending-open-threat`, and let execution mode reflect inline versus
   `blueprint-security-auditor`-assisted review.
14. Distinguish confirmed mitigations, open threats, accepted risks, suspicious
   artifact content, and follow-up hardening work explicitly inside the saved
   security artifact.
15. Present the user with the choice to verify open threats or explicitly accept
   them, use Gemini CLI's `ask_user` for that structured decision, and block
   advancement when any threat remains open instead of always computing a next
   action.
16. Use `blueprint-security-auditor` only for bounded mitigation verification
   when the phase spans multiple plans, touches risky surfaces, or needs a
   higher-confidence review of declared threats. The auditor stays read-only and
   cannot persist artifacts, mutate repo files, invent threats, or route the
   user.
17. If `blueprint-security-auditor` is unavailable or unnecessary, use the
   no-subagent fallback from the local runtime contract: read saved plans,
   summaries, prior security artifact if any, and implicated repo files; verify
   one declared threat at a time; compress carry-forward context; then run a
   final threat-count consistency pass before persistence.
18. Author only the structured `review.security` model fields: `status`,
   `readiness`, `completionState`, `securitySummary`, `evidenceCoverage`,
   `threatRegister`, `acceptedRisks`, `findings`, `manualOrDeferredWork`,
   `gapRoutes`, `followUps`, `auditTrail`, and `nextSafeAction`. The task
   schema narrows live plan, summary, threat, prior-security, validation, UAT,
   and evidence inventory; `auditTrail` is an object; threat statuses are
   lowercase values such as `closed`, `accepted`, `open`, and `none`; exact
   empty-state sentinel entries must be used for empty security tables and
   blocked next-safe-action states.
19. Validate the model through `blueprint_review_validate_model` before
   persistence. Repair all schema, truth-table, sentinel-entry, and residual
   diagnostics together, and do not switch to Markdown fallback.
20. Persist finished security evidence through `blueprint_review_record` with
   the `security` artifact and the same structured `model`; Markdown `content`
   is invalid for `review.security`.
21. If `blueprint_review_validate_model` or `blueprint_review_record` rejects
   the model, repair against the `review.security` model contract, narrowed task
   schema, and diagnostics, then retry once. If the retry still fails, stop with
   the MCP reason and do not write the artifact by hand.
22. Keep next-step guidance inside implemented Blueprint commands only. Prefer
   `/blu-validate-phase <phase>`, then `/blu-verify-work <phase>`, and
   otherwise `/blu-progress` only after all threats are closed or accepted.
   Do not emit next-step routing while threats remain open, and keep the
   waiting state explicit as `pending-open-threat` until the gate clears.

### `ui-review`

1. Load `skills/blueprint-review/references/ui-review-runtime-contract.md`
   before analysis. That local reference owns retained UI-review quality:
   scored six-pillar output, evidence depth, capability-gated auditor use,
   no-subagent fallback, invalid-write repair, and completion criteria.
2. Resolve the target phase and require saved execution evidence before the
   audit begins.
3. Read the existing Blueprint artifact inventory first so the audit can cite
   summaries, `XX-UI-SPEC.md`, validation, and UAT artifacts when they exist.
4. Read the canonical `review.ui-review` contract through
   `blueprint_artifact_contract_read` before drafting or revising
   `XX-UI-REVIEW.md`, and use `contract.modelContract.schemaPath`,
   `contract.modelContract.jsonSchema`, and the narrowed task schema as the
   model-authoring authority.
5. Read `blueprint_review_authoring_context` before drafting. Use its
   `authoringContext.taskSchema`, completed summaries, pending plans, evidence
   keys, existing UI-review path, allowed overwrite posture, and allowed next
   actions as authoritative.
6. Inspect any existing `XX-UI-REVIEW.md` before proposing replacement and
   default to reuse unless the user explicitly asks for an update.
7. Keep the audit grounded in saved repo evidence, the phase goal, the saved
   UI-spec baseline when present, and the actual frontend or UX surface under
   review.
8. Produce a scored six-pillar JSON model: Copywriting, Visual Hierarchy, Color,
   Typography, Spacing, and Experience Design, each scored 1-4 with evidence,
   plus an overall `/24` score and up to three concrete priority fixes.
9. Treat accessibility, responsiveness, interaction states, consistency, and
   polish as required evidence dimensions inside those scored pillars. If
   screenshot, browser, or visual-runtime evidence is unavailable, record that
   limitation instead of claiming visual certainty.
10. Keep the active stage visible as the run moves through `Resolve`, `Read`,
   `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the
   resolved scope, active stage, pending gate, execution mode, and next safe
   action legible throughout the run.
11. For non-trivial ui-review runs, prefer update_topic plus `write_todos` so
    saved-evidence review, bounded UI analysis, artifact persistence,
    validation, and routing stay visible without becoming persistence.
12. Report the resolved phase, saved execution and UI-spec coverage, whether
    the existing `XX-UI-REVIEW.md` artifact is being created, reused, or
    revised, the current overall score or findings-or-pass posture, and next
    safe action while work is in flight. Let execution mode reflect inline
    versus `blueprint-ui-auditor`-assisted analysis, and keep pending gates
    limited to overwrite confirmation only.
13. Use `blueprint-ui-auditor` when the phase spans multiple screens, includes
    richer interaction work, has user-supplied visual evidence, needs prior
    UI-review comparison, or benefits from a higher-confidence six-pillar UI
    audit.
14. Reject browser-only, web-search-only, shell-only, or generic agents as
    substitutes for `blueprint-ui-auditor`. When a suitable auditor is
    unavailable or unnecessary, use the no-subagent fallback from the runtime
    contract: read saved evidence, identify the UI surface, audit one pillar at
    a time, compress carry-forward context after each pillar, then run a final
    score/evidence consistency pass.
15. Validate through `blueprint_review_validate_model`; repair every returned
    schema and residual diagnostic together against the task schema before the
    single validation retry.
16. Persist finished UI audit evidence through `blueprint_review_record` with
    the `ui-review` artifact and the same structured `model`; Markdown
    `content` is invalid for ui-review.
17. If `blueprint_review_validate_model` or `blueprint_review_record` rejects
    the model, repair against `review.ui-review`, the narrowed task schema, and
    the runtime contract, then retry once through MCP. If the retry still
    fails, stop with the MCP reason and do not write `.blueprint/` by hand.
18. Keep next-step guidance inside implemented Blueprint commands only. Prefer
    `/blu-validate-phase`, then `/blu-verify-work`, and otherwise
    `/blu-progress` depending on which lifecycle artifacts already exist and
    whether follow-up UI work remains.

### `audit-fix`

1. Load `skills/blueprint-review/references/audit-fix-runtime-contract.md`
   before classification. That local reference owns the retained audit-to-fix
   quality contract: stage mapping, required MCP call controls, report
   authoring richness, capability-gated reviewer/verifier paths, no-subagent
   fallback, retry/repair behavior, stop-on-first-failure semantics, dry-run
   behavior, commit traceability, output quality criteria, and completion
   criteria.
2. Resolve the target phase and read the current Blueprint artifact inventory
   before proposing changes.
3. Use `blueprint_review_scope` to derive the deterministic remediation scope
   from executed plan metadata or explicit repo files; do not guess from git
   diff alone.
4. Treat `--source` as a strict saved-evidence selector for classification:
   `review`, `security`, `verification`, `uat`, or `all` (default).
5. Read the selected saved evidence first. Prefer an existing `XX-REVIEW.md`,
   and also inspect `XX-SECURITY.md`, `XX-VERIFICATION.md`, and `XX-UAT.md`
   when selected and present. If selected evidence is missing or weak, stop and
   route to `/blu-code-review <phase>` or `/blu-verify-work <phase>`.
6. Classify candidate findings from selected saved evidence plus direct
   inspection of scoped files only. Do not classify from unstaged drift or chat
   memory alone.
   Keep repo mutation tightly bounded to the resolved review scope and capped
   candidate set.
7. Produce a classification table before mutation with finding id, evidence
   source, severity, classification (`auto-fixable`, `manual-only`, or `skip`),
   reason, implicated files, and narrow verification. Prefer `manual-only` when
   scope, design intent, architecture impact, or user choice is unclear.
8. Apply `--severity` before mutation candidate selection: `high` means
   critical/high, `medium` means critical/high/medium, and `all` means every
   severity.
9. Apply `--max` as a hard cap on mutation attempts after severity filtering,
   with highest-severity-first ordering.
10. Treat `--dry-run` as analysis-only mode. Dry runs may still write the
   durable `audit-fix-<phase>` report, but they must not apply repo mutations.
11. In mutation mode, use Gemini CLI `ask_user` for explicit confirmation before
   non-trivial remediation (for example: multiple findings, multi-file scope,
   or medium/high severity changes).
12. For non-trivial audit-fix runs, prefer update_topic plus `write_todos` so
    saved-evidence review, candidate confirmation, bounded remediation,
    verification, report overwrite handling, todo capture, and routing stay
    visible without becoming persistence.
13. Branchy audit-fix remediation is tracker-eligible when scoped findings or
    targeted verification follow-through split into real dependency branches.
    Treat tracker state as session-local coordination only, pair it with
    visible `write_todos`, and fall back to linear prose when tracker support
    is unavailable.
14. Keep repo mutation tightly bounded to the resolved review scope and capped
    candidate list.
15. Use `blueprint-reviewer` for bounded classification when evidence is broad,
    and `blueprint-verifier` for bounded post-fix verification when targeted
    checks need a second pass. The planned `blueprint-fixer` is not a shipped
    runtime path for `audit-fix`.
16. Reject browser-only, web-search-only, shell-only, or generic agents as
    substitutes for audit-fix classification or verification. If suitable
    subagents are unavailable, use the no-subagent fallback from the runtime
    contract: classify saved evidence, process one finding at a time, reread
    implicated scoped files, apply the minimal fix, run narrow verification,
    record fixed/skipped/deferred evidence, compress carry-forward context, and
    continue until the cap is reached or the loop stops.
17. Keep the active stage visible as the run moves through `Resolve`, `Read`,
    `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the
    resolved scope, active stage, pending gate, execution mode, and next safe
    action legible throughout the run.
18. Report in-flight progress, including phase, source/severity/max/dry-run
    settings, candidate count, attempt index (`i/N`), remediation progress,
    verification progress, report status, and whether the loop stopped early.
    Keep pending gates limited to non-trivial mutation confirmation, report
    overwrite confirmation, or todo capture confirmation, and let execution
    mode reflect dry-run versus mutation plus inline versus
    reviewer/verifier-assisted remediation.
19. Enforce stop-on-first-failure behavior in mutation mode: stop the loop on
    the first failed fix or failed required verification and record remaining
    candidates as unattempted.
20. Read `report.audit-fix` through `blueprint_artifact_contract_read` and
    then call `blueprint_artifact_report_authoring_context` with the bare
    canonical report name `audit-fix-<phase>` plus
    `auditFixContext {source, severity, maxAttempts, dryRun, scopeFiles}`. Use
    `contract.modelContract.schemaPath`, the JSON schema, locked markers, and
    the narrowed `taskSchema` as the model-authoring authority before drafting,
    revising, or repairing the report.
21. Validate the authored `report.audit-fix` JSON through
    `blueprint_artifact_report_validate_model`; repair every returned schema or
    residual diagnostic against the narrowed task schema, then retry validation
    once before persistence. Pass the same `auditFixContext`, and author only
    the model fields `status`, `readiness`, `completionState`,
    `remediationSummary`, `summaryEvidence`, `classification`,
    `changesApplied`, `verification`, `pendingPlans`, `dependencyPlans`,
    `manualOrDeferredWork`, `gapRoutes`, `followUpFixes`, `evidence`,
    `commitTraceability`, `todoCapture`, and `nextSafeAction`. Markdown
    `content` fallback is invalid.
22. Persist the durable remediation report through
    `blueprint_artifact_report_write` using the same validated `model` and the
    same `auditFixContext`, and the bare canonical report name
    `audit-fix-<phase>`, not a `.blueprint/reports/...` path. Capture commit
    traceability in the report (pre-fix HEAD, any created commit SHA(s), or
    `none`). Keep the locked wording `Status`, `Readiness`, `Completion State`,
    `Source`, `Severity Filter`, `Max Attempts`, `Dry Run`, `Evidence Used`,
    `Fix Scope`, `Changes Applied`, `Remaining Gaps`, and `Next Safe Action`
    intact while rendering summary evidence, the evidence ledger, the
    classification table, dependency or pending-plan debt, attempted changes,
    verification, manual or deferred work, gap routes, follow-up fixes, todo
    capture, and stale-context gaps.
23. If validation or `blueprint_artifact_report_write` rejects the model,
    repair the structured report against the canonical `report.audit-fix`
    contract, the narrowed task schema, and returned diagnostics, then retry
    once through MCP. If the retry still fails, stop with the MCP reason and do
    not write `.blueprint/` by hand.
24. Capture todo follow-up through `blueprint_artifact_mutate_index` only after
    explicit user confirmation via `ask_user`.
25. Update `STATE.md` through `blueprint_state_update` so the next safe action
    points at `/blu-validate-phase <phase>`, `/blu-add-tests <phase>`, or
    `/blu-progress` based on the remaining evidence gap.

### `review`

1. Load `skills/blueprint-review/references/review-runtime-contract.md`
   before analysis. That local reference owns peer-review packet depth,
   schema-first artifact authoring, capability-gated `blueprint-reviewer` use,
   no-subagent fallback, reviewer-availability truth, disagreement handling,
   retry/repair behavior, output quality criteria, and completion criteria.
2. Resolve the target phase first and read the current Blueprint artifact
   inventory before assembling reviewer prompts.
3. Read the canonical review contract through `blueprint_artifact_contract_read`
   and read `blueprint_review_authoring_context` with `artifact: "peer-review"`
   before drafting `XX-REVIEWS.md`. Use the `review.peer-review`
   `modelContract`, `baseSchema`, and runtime-narrowed `taskSchema` as the
   model-authoring authority before drafting, revising, or repairing the artifact.
4. Read `blueprint_phase_plan_index` and then each selected plan through
   `blueprint_phase_plan_read`. If no saved plan exists, stop and route to
   `/blu-plan-phase <phase>` instead of reviewing chat memory.
   Use `blueprint_phase_plan_read`; do not guess the review scope from unstaged repo
   drift, unrelated files, or chat memory. Do not guess review scope from unstaged
   repo drift when saved phase evidence is the authoritative baseline.
5. Build the reviewer packet from saved Blueprint evidence: selected plans,
   phase goal or roadmap intent, available requirements/context/research
   evidence, and directly related prior phase artifacts. State unavailable
   evidence plainly instead of inventing content.
6. Confirm reviewer CLI availability before launch. Honor explicit reviewer
   flags and `--all`, but record unavailable or unauthenticated reviewers
   honestly. If no requested reviewer can run, stop with pending gate
   `reviewer-availability` and keep the next safe action on
   `/blu-review <phase>`.
7. Preserve partial reviewer output when at least one selected reviewer
   completed, and keep material disagreement visible instead of flattening it
   into false consensus.
8. Use `blueprint-reviewer` only for read-only packet-completeness or
   consensus/disagreement synthesis when the saved plan set is broad, multiple
   plans are involved, prior peer-review evidence exists, or reviewer outputs
   materially disagree. The subagent must not invoke external reviewer CLIs,
   replace unavailable reviewers, persist artifacts, mutate files, or route the
   command.
9. If `blueprint-reviewer` is unavailable or unnecessary, use the no-subagent
   fallback from the local runtime contract: assemble one evidence group at a
   time, run selected available reviewers sequentially, compress each reviewer
   result into strengths, severity-tagged concerns, suggestions, risk, and
   uncertainty, then synthesize consensus and divergence.
10. Reject browser-only, web-search-only, shell-only, or generic agents as
    substitutes for `blueprint-reviewer` or for external reviewer CLIs.
11. Keep the active stage visible as the run moves through `Resolve`, `Read`,
    `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep resolved
    scope, active stage, pending gate, execution mode, and next safe action
    legible throughout the run.
12. For non-trivial review runs, prefer update_topic plus `write_todos` so
    saved-plan review, reviewer-packet assembly, reviewer availability,
    external-review execution, synthesis, artifact persistence, and routing stay
    visible without becoming persistence, including reviewer disagreement status.
13. Validate the structured peer-review JSON through
    `blueprint_review_validate_model`, repairing all diagnostics together once
    if needed.
14. Persist the same validated model through `blueprint_review_record` with
    the `peer-review` artifact. Treat returned `reportPath`, `counts`,
    `followUps`, `status`, and `warnings` as authoritative.
15. If `blueprint_review_validate_model` or `blueprint_review_record` rejects
    the model, repair once against the `review.peer-review` task schema and the
    local runtime contract, then retry through MCP. If the retry still fails,
    stop with the MCP reason and do not write the artifact by hand.
16. Keep next-step guidance inside implemented Blueprint commands only. Prefer
    `/blu-plan-phase <phase>` when plan revisions are needed,
    `/blu-execute-phase <phase>` when execution evidence is missing,
    `/blu-code-review <phase>` when code review is missing, and
    `/blu-progress` otherwise.

## Completion Self-Check

Before claiming completion, verify:

- The invoked command's manifest and matching runtime contract from
  `input_bundles` were loaded; sibling review-command references were not
  treated as active input.
- Required MCP calls for the active command ran in the contract order using
  runtime FQNs (`mcp_blueprint_blueprint_*`), and missing or invalid phase,
  scope, plan, summary, finding, reviewer, or evidence results stopped or
  routed exactly as that contract requires.
- Review artifacts were authored as the structured model the active artifact
  expects; `report.audit-fix` used the report model plus the same
  `auditFixContext`; Markdown `content` or copied templates were not used for
  model-only persistence.
- Persistence stayed inside the owning MCP tools:
  `blueprint_review_record` for review artifacts,
  `blueprint_artifact_report_write` for audit-fix reports,
  `blueprint_state_update` for state, and `blueprint_artifact_mutate_index`
  only for confirmed todos. Returned `status`, `created`, `updated`, `reused`,
  `reportPath`, `path`, `counts`, `followUps`, `warnings`, and `reason` fields
  were treated as authoritative.
- Every required confirmation gate cleared first: overwrite, broad/deep scope,
  finding selection, non-trivial mutation, open-threat verify/accept, reviewer
  availability, report overwrite, and todo capture. Unclear gates stayed
  visible as blockers.
- Validation diagnostics, tool rejections, failed verification, stale context,
  open threats, unavailable reviewers, dry-run boundaries, skipped mutation, and
  partial or blocked outcomes were repaired once when allowed or reported
  honestly; they were not described as completed writes.
- The run stayed within the active command's write boundaries and resolved
  scope: no direct `.blueprint/` edits, unrelated repo/runtime/manifest/doc
  mutations, installed-extension changes, planned-only agents or commands, or
  hidden git automation.
- Final routing named only implemented Blueprint commands allowed by the active
  contract; when the safe next action was ambiguous, blocked, open-threat,
  reviewer-availability, or not implemented, it fell back to `/blu-progress` or
  the contract's waiting action.
- The final response named the resolved phase and concrete artifact, report,
  state, or todo paths, or the no-write status; it also summarized warnings,
  blockers, verification, and the next safe implemented action.
