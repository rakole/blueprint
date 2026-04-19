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
- saved phase artifacts for the target phase, especially execution summaries

## Required MCP Tools

- `blueprint_phase_locate`
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

## Shared MCP Contracts

- `blueprint_review_scope`: explicit `files` must be repo-relative file paths. Directories, wildcards, absolute paths, and `.blueprint/**` paths are invalid or skipped. Omit `files` when the command wants scope derived from executed plans and summaries, and treat returned `files` as authoritative.
- `blueprint_review_record`: pass numeric `phase`, the correct review `artifact` enum, and full report content. The tool owns the final review filename; use returned `reportPath`, `counts`, and `followUps` as authoritative.
- `blueprint_artifact_contract_read`: read the canonical review and report contracts before drafting, updating, or validating review artifacts instead of relying on copied prompt-local templates.
- `blueprint_review_load_findings`: omit `artifact` only when the command intentionally wants saved `code-review` findings; use returned `findings` and `severityCounts` as the authoritative fix baseline.
- `blueprint_artifact_report_write`: pass a bare report name such as `audit-fix-3`, not `.blueprint/reports/audit-fix-3.md`. Use the returned `path` as authoritative.

## Workflow Rules

### `code-review`

1. Resolve the target phase first and read the current Blueprint artifact
   inventory before reviewing code.
2. Read the canonical review contract through `blueprint_artifact_contract_read` before drafting `XX-REVIEW.md`, then use the returned template as the baseline for the persisted artifact.
3. Use `blueprint_review_scope` to derive the deterministic repo file list from
   executed plan metadata or explicit file arguments; do not guess from git
   diff alone.
4. Require executed phase evidence unless the user supplied an explicit file
   scope.
5. Inspect any existing `XX-REVIEW.md` before proposing replacement and default
   to reuse unless the user explicitly asks for an update.
6. Keep findings grounded in the selected repo files plus saved execution,
   validation, or UAT artifacts.
7. Use `blueprint-reviewer` when the scope spans multiple plans, multiple files,
   or a deep pass that benefits from a bounded second look.
8. Persist the finished review through `blueprint_review_record` with the
   `code-review` artifact.
9. Keep next-step guidance inside implemented Blueprint commands only. Prefer
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
4. If there is no saved `XX-REVIEW.md` or no structured finding to act on,
   route back to `/blu-code-review <phase>` or `/blu-progress` instead of
   bluffing.
5. Use Gemini CLI's `ask_user` tool for overwrite confirmation and for any
   structured confirmation of which findings Blueprint is about to fix.
6. Treat `--auto` as bounded finding selection only. It may skip the manual
   selection step for a narrow, high-confidence saved finding set, but it does
   not authorize automatic commits, branch creation, or iterative re-review
   loops.
7. Require explicit confirmation of the selected findings unless the user
   clearly requested `--all`, `--auto`, or an equivalent narrow automatic fix.
8. Keep repo mutation tightly bounded to the selected review findings and the
   implicated repo files.
9. Use `blueprint-reviewer` for bounded reclassification when the saved review
   is broad or ambiguous.
10. Report the resolved phase, selected finding ids, remediation progress, and
    verification progress while work is in flight, not only in the closing
    summary.
11. Persist the durable remediation artifact as `XX-REVIEW-FIX.md` through
   `blueprint_review_record` with the `review-fix` artifact.
12. Update `STATE.md` through `blueprint_state_update` so follow-up routing stays
   inside implemented commands. Prefer `/blu-validate-phase <phase>` when
   behavior changed, `/blu-add-tests <phase>` when missing tests are the main
   remaining gap, and `/blu-progress` otherwise.

### `secure-phase`

1. Resolve the target phase and require saved execution evidence before the
   audit begins.
2. Read the existing Blueprint artifact inventory first so the audit can cite
   summaries, validation, and UAT artifacts when they exist.
3. Read the canonical `review.security` contract through
   `blueprint_artifact_contract_read` before drafting or revising
   `XX-SECURITY.md`, and use the returned template plus headings as the
   baseline instead of a copied prompt-local structure.
4. Inspect any existing `XX-SECURITY.md` before proposing replacement and
   default to reuse unless the user explicitly asks for an update. Use Gemini
   CLI's `ask_user` tool for overwrite confirmation before replacement.
5. Read `blueprint_phase_plan_index` and `blueprint_phase_plan_read` so the
   saved phase threat model can be parsed from executed plan evidence, then
   build a threat register from the declared threats and mitigations.
6. Keep the audit bounded to that declared security scope rather than a broad
   scan.
7. Distinguish confirmed mitigations, open threats, accepted risks, and
   follow-up hardening work explicitly inside the saved security artifact.
8. Present the user with the choice to verify open threats or explicitly accept
   them, use Gemini CLI's `ask_user` for that structured decision, and block
   advancement when any threat remains open instead of always computing a next
   action.
9. Report in-flight progress while the audit is running, including the
   resolved phase, threat-register coverage, whether the security artifact is
   being reused or revised, and the current verify-versus-accept state for
   open threats.
10. Use `blueprint-security-auditor` when the phase spans multiple plans,
   touches risky surfaces, or needs a higher-confidence mitigation review.
11. Persist finished security evidence through `blueprint_review_record` with
   the `security` artifact.
12. Keep next-step guidance inside implemented Blueprint commands only. Prefer
   `/blu-validate-phase`, then `/blu-verify-work`, and otherwise `/blu-progress`
   only after all threats are closed or accepted.

### `ui-review`

1. Resolve the target phase and require saved execution evidence before the
   audit begins.
2. Read the existing Blueprint artifact inventory first so the audit can cite
   summaries, `XX-UI-SPEC.md`, validation, and UAT artifacts when they exist.
3. Inspect any existing `XX-UI-REVIEW.md` before proposing replacement and
   default to reuse unless the user explicitly asks for an update.
4. Keep the audit grounded in saved repo evidence, the phase goal, and the
   actual frontend or UX surface under review.
5. Use `blueprint-ui-auditor` when the phase spans multiple screens, includes
   richer interaction work, or benefits from a higher-confidence six-pillar UI
   audit.
6. Persist finished UI audit evidence through `blueprint_review_record` with
   the `ui-review` artifact.
7. Keep next-step guidance inside implemented Blueprint commands only. Prefer
   `/blu-validate-phase`, then `/blu-verify-work`, and otherwise `/blu-progress`
   depending on which lifecycle artifacts already exist and whether follow-up UI
   work remains.

### `audit-fix`

1. Resolve the target phase and read the current Blueprint artifact inventory
   before proposing changes.
2. Use `blueprint_review_scope` to derive the deterministic remediation scope
   from executed plan metadata or explicit repo files; do not guess from git
   diff alone.
3. Treat `--source` as a strict saved-evidence selector for classification:
   `review`, `security`, `verification`, `uat`, or `all` (default).
4. Read the selected saved evidence first. Prefer an existing `XX-REVIEW.md`,
   and also inspect `XX-SECURITY.md`, `XX-VERIFICATION.md`, and `XX-UAT.md`
   when selected and present. If selected evidence is missing or weak, stop and
   route to `/blu-code-review <phase>` or `/blu-verify-work <phase>`.
5. Classify candidate findings from selected saved evidence plus direct
   inspection of scoped files only. Do not classify from unstaged drift or chat
   memory alone.
6. Apply `--severity` before mutation candidate selection: `high` means
   critical/high, `medium` means critical/high/medium, and `all` means every
   severity.
7. Apply `--max` as a hard cap on mutation attempts after severity filtering,
   with highest-severity-first ordering.
8. Treat `--dry-run` as analysis-only mode. Dry runs may still write the
   durable `audit-fix-<phase>` report, but they must not apply repo mutations.
9. In mutation mode, use Gemini CLI `ask_user` for explicit confirmation before
   non-trivial remediation (for example: multiple findings, multi-file scope,
   or medium/high severity changes).
10. Keep repo mutation tightly bounded to the resolved review scope and capped
    candidate list.
11. Use `blueprint-reviewer` for bounded classification when evidence is broad,
    and `blueprint-verifier` for bounded post-fix verification when targeted
    checks need a second pass. The planned `blueprint-fixer` is not a shipped
    runtime path for `audit-fix`.
12. Report in-flight progress, including phase, source/severity/max filter
    settings, candidate count, attempt index (`i/N`), verification status, and
    whether the loop stopped early.
13. Enforce stop-on-first-failure behavior in mutation mode: stop the loop on
    the first failed fix or failed required verification and record remaining
    candidates as unattempted.
14. Persist the durable remediation report through
    `blueprint_artifact_report_write` using the bare canonical report name
    `audit-fix-<phase>`, not a `.blueprint/reports/...` path. Capture commit
    traceability in the report (pre-fix HEAD, any created commit SHA(s), or
    `none`).
15. Capture todo follow-up through `blueprint_artifact_mutate_index` only after
    explicit user confirmation via `ask_user`.
16. Update `STATE.md` through `blueprint_state_update` so the next safe action
    points at `/blu-validate-phase <phase>`, `/blu-add-tests <phase>`, or
    `/blu-progress` based on the remaining evidence gap.

### `review`

1. Resolve the target phase and read the current Blueprint artifact inventory
   before launching peer review so plan, execution, or prior review evidence is
   visible.
2. Read the canonical review contract through `blueprint_artifact_contract_read` before drafting `XX-REVIEWS.md`, then use the returned template as the baseline for the persisted artifact.
3. Read the saved plan set through `blueprint_phase_plan_index` and
   `blueprint_phase_plan_read`; do not guess the review scope from unstaged repo
   drift, chat memory, or unrelated files.
4. If there are no saved `XX-YY-PLAN.md` artifacts for the phase, route to
   `/blu-plan-phase <phase>` instead of bluffing through a planless peer review.
5. Inspect any existing `XX-REVIEWS.md` before proposing replacement and
   default to reuse unless the user explicitly asks for an update.
6. Confirm which reviewer CLIs are actually available and authenticated before
   launch. Honor explicit reviewer flags, but never claim an unavailable
   reviewer ran successfully.
7. Preserve disagreement between reviewers instead of flattening it into a fake
   consensus, and record partial reviewer availability honestly when only some
   requested reviewers ran.
8. Persist the finished peer-review artifact through `blueprint_review_record`
   with the `peer-review` artifact.
9. Keep next-step guidance inside implemented Blueprint commands only. Prefer
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
- Do not guess review scope from unstaged repo drift when saved phase evidence
  is missing.
- Keep the artifact explicit about pass signals, findings, and follow-up risk.
