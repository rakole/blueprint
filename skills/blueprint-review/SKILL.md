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

- `docs/commands/code-review.md`
- `docs/commands/code-review-fix.md`
- `docs/commands/secure-phase.md`
- `docs/commands/audit-fix.md`
- `docs/commands/review.md`
- `docs/commands/ui-review.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/PHASE-LIFECYCLE.md`
- `skills/blueprint-review/references/code-review-runtime-contract.md`
- `skills/blueprint-review/references/code-review-fix-runtime-contract.md`
- `skills/blueprint-review/references/audit-fix-runtime-contract.md`
- `skills/blueprint-review/references/secure-phase-runtime-contract.md`
- saved phase artifacts for the target phase, especially execution summaries

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_config_get`
- `blueprint_artifact_list`
- `blueprint_review_scope`
- `blueprint_review_load_findings`
- `blueprint_review_record`
- `blueprint_artifact_contract_read`
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
- Stage vocabulary for visible review posture: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields for `code-review`: resolved scope, active stage, pending gate, execution mode, next safe action
- In-flight status fields for `code-review-fix`: resolved scope, active stage, pending gate, execution mode, next safe action
- In-flight status fields for `audit-fix`: resolved scope, active stage, pending gate, execution mode, next safe action
- In-flight status fields for `secure-phase`: resolved scope, active stage, pending gate, execution mode, next safe action
- In-flight status fields for `review`: resolved scope, active stage, pending gate, execution mode, next safe action
- In-flight status fields for `ui-review`: resolved scope, active stage, pending gate, execution mode, next safe action

## Shared MCP Contracts

- `blueprint_review_scope`: explicit `files` must be repo-relative file paths. Directories, wildcards, absolute paths, and `.blueprint/**` paths are invalid or skipped. Omit `files` when the command wants scope derived from executed plans and summaries, and treat returned `files` as authoritative.
- `blueprint_review_record`: pass numeric `phase`, the correct review `artifact` enum, and full report content. The tool owns the final review filename; use returned `reportPath`, `counts`, and `followUps` as authoritative.
- `blueprint_artifact_contract_read`: read the canonical review and report contracts before drafting, updating, or validating review artifacts instead of relying on copied prompt-local templates.
- `blueprint_review_load_findings`: omit `artifact` only when the command intentionally wants saved `code-review` findings; use returned `findings` and `severityCounts` as the authoritative fix baseline.
- `blueprint_artifact_report_write`: pass a bare report name such as `audit-fix-3`, not `.blueprint/reports/audit-fix-3.md`. Use the returned `path` as authoritative.

## Workflow Rules

### `code-review`

1. Load `skills/blueprint-review/references/code-review-runtime-contract.md`
   before analysis. That local reference owns depth semantics, artifact
   richness, capability-gated reviewer use, no-subagent fallback, and
   invalid-write repair for `/blu-code-review`.
2. Resolve the target phase first and read the current Blueprint artifact
   inventory before reviewing code.
3. Read the canonical review contract through `blueprint_artifact_contract_read` before drafting `XX-REVIEW.md`, then use the returned template as the baseline for the persisted artifact.
4. Use `blueprint_review_scope` to derive the deterministic repo file list from
   executed plan metadata or explicit file arguments; do not guess from git
   diff alone.
5. Keep the active stage visible as the run moves through `Resolve`, `Read`,
   `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the
   resolved scope, pending gate, execution mode, and next safe action legible
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
12. Keep the scope confirmation gate explicit for broad, multi-plan, or deep
    reviews, and keep rolling finding counts or severity buckets visible while
    the review is in flight.
13. Persist the finished review through `blueprint_review_record` with the
   `code-review` artifact.
14. If `blueprint_review_record` returns invalid, repair the markdown against
   `contract.authoringTemplate` and the returned warnings, then retry once
   through MCP. Do not hand-edit `.blueprint/`.
15. Keep next-step guidance inside implemented Blueprint commands only. Prefer
   `/blu-secure-phase <phase>` when the phase still lacks a security artifact,
   `/blu-code-review-fix <phase>` when concrete follow-up fixes remain, and
   otherwise `/blu-progress`.

### `code-review-fix`

1. Resolve the target phase and load the saved `XX-REVIEW.md` findings before
   proposing any repo mutation.
2. Use `blueprint_review_load_findings` for the findings baseline; do not infer
   fix scope from chat memory or raw git drift when review evidence is missing.
3. Read the canonical review-fix contract through
   `blueprint_artifact_contract_read` before drafting `XX-REVIEW-FIX.md`, then
   use the returned template as the baseline for the persisted artifact.
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
15. Persist the durable remediation artifact as `XX-REVIEW-FIX.md` through
   `blueprint_review_record` with the `review-fix` artifact.
16. If `blueprint_review_record` rejects the artifact or reports missing
   required headings, repair against the `review.review-fix` authoring template
   and retry once. If the retry still fails, stop with the MCP reason and do not
   write the artifact by hand.
17. Update `STATE.md` through `blueprint_state_update` so follow-up routing stays
   inside implemented commands. Prefer `/blu-validate-phase <phase>` when
   behavior changed, `/blu-add-tests <phase>` when missing tests are the main
   remaining gap, and `/blu-progress` otherwise.
18. No auto-fixer behavior is shipped. Do not invent a `blueprint-fixer`,
    implicit branch or commit flow, or hidden iterative re-review pass.

### `secure-phase`

1. Load `skills/blueprint-review/references/secure-phase-runtime-contract.md`
   before analysis. That local reference owns the retained security behavior:
   State A/B/C input handling, saved threat-model parsing, summary threat-flag
   incorporation, bounded auditor use, no-subagent fallback, retry/repair,
   threat-count consistency, and advancement blocking.
2. Resolve the target phase and require saved execution evidence before the
   audit begins.
3. Read the existing Blueprint artifact inventory first so the audit can cite
   summaries, validation, and UAT artifacts when they exist.
4. Read the canonical `review.security` contract through
   `blueprint_artifact_contract_read` before drafting or revising
   `XX-SECURITY.md`, and use the returned template plus headings as the
   baseline instead of a copied prompt-local structure.
5. Inspect any existing `XX-SECURITY.md` before proposing replacement and
   default to reuse unless the user explicitly asks for an update. Use Gemini
   CLI's `ask_user` tool for overwrite confirmation before replacement.
6. Read `blueprint_phase_plan_index` and `blueprint_phase_plan_read` so the
   saved phase threat model can be parsed from executed plan evidence, then
   build a threat register from the declared threats and mitigations. Include
   threat id, category, component, disposition, mitigation, status, and evidence
   for each declared threat.
7. Read executed summaries from the artifact inventory and incorporate
   `## Threat Flags` when present. Map them to declared threats when possible,
   and record unregistered flags separately instead of widening the audit into a
   broad scan.
8. Keep the audit bounded to that declared security scope from saved plan
   evidence only rather than a broad scan.
9. Keep the active stage visible as the run moves through `Resolve`, `Read`,
   `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the
   resolved scope, active stage, pending gate, execution mode, and next safe
   action legible throughout the run.
10. For non-trivial secure-phase runs, prefer update_topic plus `write_todos`
   so saved-plan review, threat verification, overwrite gates, artifact
   persistence, post-write validation, and routing stay visible without
   becoming persistence.
11. Report the resolved scope, threat-register coverage, whether the security
   artifact is being reused or revised, and the current pending-open-threat
   status while work is in flight. Keep the verify-versus-accept decision
   explicit whenever threats remain open. Keep pending gates limited to
   overwrite confirmation, the verify-versus-accept decision, or
   `pending-open-threat`, and let execution mode reflect inline versus
   `blueprint-security-auditor`-assisted review.
12. Distinguish confirmed mitigations, open threats, accepted risks, suspicious
   artifact content, and follow-up hardening work explicitly inside the saved
   security artifact.
13. Present the user with the choice to verify open threats or explicitly accept
   them, use Gemini CLI's `ask_user` for that structured decision, and block
   advancement when any threat remains open instead of always computing a next
   action.
14. Use `blueprint-security-auditor` only for bounded mitigation verification
   when the phase spans multiple plans, touches risky surfaces, or needs a
   higher-confidence review of declared threats. The auditor stays read-only and
   cannot persist artifacts, mutate repo files, invent threats, or route the
   user.
15. If `blueprint-security-auditor` is unavailable or unnecessary, use the
   no-subagent fallback from the local runtime contract: read saved plans,
   summaries, prior security artifact if any, and implicated repo files; verify
   one declared threat at a time; compress carry-forward context; then run a
   final threat-count consistency pass before persistence.
16. Persist finished security evidence through `blueprint_review_record` with
   the `security` artifact.
17. If `blueprint_review_record` rejects the artifact or reports missing
   required headings, repair against the `review.security` authoring template
   and retry once. If the retry still fails, stop with the MCP reason and do not
   write the artifact by hand.
18. Keep next-step guidance inside implemented Blueprint commands only. Prefer
   `/blu-validate-phase <phase>`, then `/blu-verify-work <phase>`, and
   otherwise `/blu-progress` only after all threats are closed or accepted.
   Do not emit next-step routing while threats remain open, and keep the
   waiting state explicit as `pending-open-threat` until the gate clears.

### `ui-review`

1. Resolve the target phase and require saved execution evidence before the
   audit begins.
2. Read the existing Blueprint artifact inventory first so the audit can cite
   summaries, `XX-UI-SPEC.md`, validation, and UAT artifacts when they exist.
3. Inspect any existing `XX-UI-REVIEW.md` before proposing replacement and
   default to reuse unless the user explicitly asks for an update.
4. Keep the audit grounded in saved repo evidence, the phase goal, and the
   actual frontend or UX surface under review.
5. Keep the active stage visible as the run moves through `Resolve`, `Read`,
   `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the
   resolved scope, active stage, pending gate, execution mode, and next safe
   action legible throughout the run.
6. For non-trivial ui-review runs, prefer update_topic plus `write_todos` so
   saved-evidence review, bounded UI analysis, artifact persistence,
   validation, and routing stay visible without becoming persistence.
7. Report the resolved phase, saved execution and UI-spec coverage, whether
   the existing `XX-UI-REVIEW.md` artifact is being created, reused, or
   revised, and the current findings-or-pass posture while work is in flight.
   Let execution mode reflect inline versus `blueprint-ui-auditor`-assisted
   analysis, and keep pending gates limited to overwrite confirmation only.
8. Use `blueprint-ui-auditor` when the phase spans multiple screens, includes
   richer interaction work, or benefits from a higher-confidence six-pillar UI
   audit.
9. Persist finished UI audit evidence through `blueprint_review_record` with
   the `ui-review` artifact.
10. Keep next-step guidance inside implemented Blueprint commands only. Prefer
   `/blu-validate-phase`, then `/blu-verify-work`, and otherwise `/blu-progress`
   depending on which lifecycle artifacts already exist and whether follow-up UI
   work remains.

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
20. Persist the durable remediation report through
    `blueprint_artifact_report_write` using the bare canonical report name
    `audit-fix-<phase>`, not a `.blueprint/reports/...` path. Capture commit
    traceability in the report (pre-fix HEAD, any created commit SHA(s), or
    `none`). Use the canonical `report.audit-fix` headings and include concrete
    evidence in `Evidence Used`, source/severity/max/dry-run settings plus the
    classification table in `Fix Scope`, attempted changes and verification in
    `Changes Applied`, manual-only/unattempted/stale-context gaps in
    `Remaining Gaps`, and exactly one implemented command in `Next Safe Action`.
21. If `blueprint_artifact_report_write` rejects the report body or returns
    missing-heading validation warnings, repair the body against the canonical
    `report.audit-fix` headings and retry once through MCP. If the retry still
    fails, stop with the MCP reason and do not write `.blueprint/` by hand.
22. Capture todo follow-up through `blueprint_artifact_mutate_index` only after
    explicit user confirmation via `ask_user`.
23. Update `STATE.md` through `blueprint_state_update` so the next safe action
    points at `/blu-validate-phase <phase>`, `/blu-add-tests <phase>`, or
    `/blu-progress` based on the remaining evidence gap.

### `review`

1. Resolve the target phase and read the current Blueprint artifact inventory
   before launching peer review so plan, execution, or prior review evidence is
   visible.
2. Read the saved plan set through `blueprint_phase_plan_index` and
   `blueprint_phase_plan_read`; do not guess the review scope from unstaged repo
   drift, chat memory, or unrelated files.
3. Read the canonical review contract through `blueprint_artifact_contract_read` before drafting `XX-REVIEWS.md`, then use the returned template as the baseline for the persisted artifact.
4. If there are no saved `XX-YY-PLAN.md` artifacts for the phase, route to
   `/blu-plan-phase <phase>` instead of bluffing through a planless peer review.
5. Inspect any existing `XX-REVIEWS.md` before proposing replacement and
   default to reuse unless the user explicitly asks for an update.
6. Use Gemini CLI's `ask_user` tool for overwrite confirmation and any
   structured reviewer-availability confirmation when requested reviewers are
   unavailable or unauthenticated.
7. Confirm which reviewer CLIs are actually available and authenticated before
   launch. Honor explicit reviewer flags, but never claim an unavailable
   reviewer ran successfully.
8. Preserve disagreement between reviewers instead of flattening it into a fake
   consensus, and record partial reviewer availability honestly when only some
   requested reviewers ran.
9. Keep the active stage visible as the run moves through `Resolve`, `Read`,
   `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the
   resolved scope, active stage, pending gate, execution mode, and next safe
   action legible throughout the run.
10. For non-trivial review runs, prefer update_topic plus `write_todos` so
   saved-plan review, reviewer-availability confirmation, bounded peer-review
   execution, artifact persistence, and routing stay visible without becoming
   persistence.
11. Report the resolved phase, requested reviewers, completed and unavailable
    reviewer coverage, reviewer disagreement status, artifact reuse or revision
    status, pending gate, execution mode, and next safe action while work is in
    flight. Keep pending gates limited to overwrite confirmation,
    reviewer-availability confirmation, or the explicit
    `reviewer-availability` waiting state. Let execution mode reflect explicit
    reviewer flags versus `--all` fan-out plus whether the run is still inline
    or waiting on reviewer availability.
12. Persist the finished peer-review artifact through `blueprint_review_record`
   with the `peer-review` artifact.
13. If none of the requested reviewers are available, stop with the waiting
    state explicit as `reviewer-availability` and keep the next safe action on
    `/blu-review <phase>` until reviewer selection or authentication changes.
14. Keep next-step guidance inside implemented Blueprint commands only. Prefer
   `/blu-plan-phase <phase>` when meaningful plan revisions remain,
   `/blu-execute-phase <phase>` when the review passes and execution has not
   started, `/blu-code-review <phase>` when execution exists but code review is
   still missing, and otherwise `/blu-progress`.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from review commands.
- Do not present planned-only review commands as runnable just because they are
  documented.
- Do not treat the planned `blueprint-fixer` as an implemented dependency for
  `code-review-fix` or `audit-fix`.
- Do not use browser, web-search-only, shell-only, or generic agents as
  substitutes for the bounded Blueprint reviewer/verifier paths.
- Do not guess review scope from unstaged repo drift when saved phase evidence
  is missing.
- Keep the artifact explicit about pass signals, findings, and follow-up risk.
