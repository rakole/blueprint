# Blueprint Phase Lifecycle

## Purpose

This file describes the intended artifact flow through a single Blueprint phase so future work can implement lifecycle commands without reopening naming or ownership decisions.

## Happy-Path Sequence

1. `discuss-phase`
   Writes `XX-CONTEXT.md`, may persist the shared `XX-DISCUSS-CHECKPOINT.json` continuation artifact during long discovery, and should delete only discuss-owned checkpoint state after successful context capture.
2. `research-phase`
   Writes `XX-RESEARCH.md` when technical uncertainty or integration risk exists, and may reuse the shared `XX-DISCUSS-CHECKPOINT.json` continuation artifact with `ownerCommand: "/blu-research-phase"` during pauses or inconclusive research.
3. `ui-phase`
   Writes `XX-UI-SPEC.md` for frontend-heavy work, or records an explicit UI-skip rationale in `XX-UI-SPEC.md` when UI work is intentionally out of scope.
4. `plan-phase`
   Uses the plan index plus dedicated plan read/write tools to persist one or more `XX-YY-PLAN.md` files and updates `STATE.md`.
5. `execute-phase`
   Uses the plan index/read tools plus dedicated summary index/read/write tools to produce implementation changes and `XX-YY-SUMMARY.md` execution evidence.
6. `validate-phase`
   Reads the saved execution summaries first, then writes `XX-VERIFICATION.md` with validation gaps, pass signals, and a clear next safe action.
7. `verify-work`
   Reads the saved execution summaries first, then writes resumable `XX-UAT.md` evidence with explicit follow-up fixes when needed.

## Optional Quality Passes

- `code-review` writes `XX-REVIEW.md`.
- `code-review-fix` writes a review-fix artifact or summary when issues are addressed.
- `audit-fix` writes `.blueprint/reports/audit-fix-<phase>.md` and may update repo files plus `STATE.md`.
- `secure-phase` writes `XX-SECURITY.md` through `blueprint_review_record` after reading saved plans, summaries, the canonical `review.security` contract, and any prior security artifact; it blocks next-step routing while declared threats remain open.
- `ui-review` writes `XX-UI-REVIEW.md`.
- `add-tests` may add code-level tests, update `XX-VERIFICATION.md`, and write a supporting `.blueprint/reports/add-tests-<phase>.md` report.
- `review` writes `XX-REVIEWS.md`.

## Post-UAT Quality Gate

When effective config `workflow.code_review` is true and saved execution evidence includes reviewable repo or source files, completed UAT does not advance the phase by itself. `/blu-code-review <phase>` and `/blu-secure-phase <phase>` become mandatory before normal phase advancement.

Routing order after UAT is:

- UAT complete, reviewable files present, and no `XX-REVIEW.md`: route to `/blu-code-review <phase>`.
- `XX-REVIEW.md` exists and no `XX-SECURITY.md`: route to `/blu-secure-phase <phase>`.
- `XX-REVIEW.md` has open findings: follow the saved review next safe action.
- Review and security gates complete: advance normally.

When `workflow.code_review` is false, or saved execution evidence has no reviewable repo/source files, preserve the previous post-UAT advancement behavior.

## Phase Completion Signals

A phase should not be treated as complete just because execution finished. Completion requires enough evidence for the next command to route safely:

- execution summaries exist
- validation state is known and grounded in saved summaries
- UAT state is known, resumable, or explicitly deferred
- required review and security gates are complete, or any follow-up is visible in artifacts
- `STATE.md` names the next action clearly

## Failure And Pause Paths

- `pause-work` writes the canonical `.blueprint/reports/pause-work-latest.md` handoff plus an updated `STATE.md`.
- The pause handoff captures the stopping point, completed work, remaining work, decisions, blockers, pending human actions, modified files, context notes, and the first next action for resumption.
- `resume-work` reconstructs context from `STATE.md`, phase artifacts, and the canonical `pause-work` handoff schema.
- failed execution, validation, or review steps should still leave durable artifacts explaining blockers rather than disappearing into chat history.
- validation and UAT artifacts should remain resumable so a later run can continue from the saved evidence instead of starting from scratch.

## Related Specs

- `docs/commands/discuss-phase.md`
- `docs/commands/research-phase.md`
- `docs/commands/ui-phase.md`
- `docs/commands/plan-phase.md`
- `docs/commands/execute-phase.md`
- `docs/commands/validate-phase.md`
- `docs/commands/verify-work.md`
