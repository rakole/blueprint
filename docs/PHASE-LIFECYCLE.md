# Blueprint Phase Lifecycle

## Purpose

This file describes the intended artifact flow through a single Blueprint phase so future work can implement lifecycle commands without reopening naming or ownership decisions.

## Happy-Path Sequence

1. `discuss-phase`
   Writes `XX-CONTEXT.md` and captures phase framing.
2. `research-phase`
   Writes `XX-RESEARCH.md` when technical uncertainty or integration risk exists.
3. `ui-phase`
   Writes `XX-UI-SPEC.md` for frontend-heavy work, or records an explicit UI-skip rationale in `XX-UI-SPEC.md` when UI work is intentionally out of scope.
4. `plan-phase`
   Writes one or more `XX-YY-PLAN.md` files and updates `STATE.md`.
5. `execute-phase`
   Produces implementation changes plus `XX-YY-SUMMARY.md` execution evidence.
6. `validate-phase`
   Writes `XX-VERIFICATION.md` and records validation gaps or pass signals.
7. `verify-work`
   Writes `XX-UAT.md` and confirms conversational or scripted user-acceptance evidence.

## Optional Quality Passes

- `code-review` writes `XX-REVIEW.md`.
- `code-review-fix` writes a review-fix artifact or summary when issues are addressed.
- `secure-phase` writes `XX-SECURITY.md`.
- `ui-review` writes `XX-UI-REVIEW.md`.
- `add-tests` may write supporting reports in `.blueprint/reports/` while adding code-level tests later.
- `review` writes peer-review artifacts under `.blueprint/reports/` when cross-CLI review is requested.

## Phase Completion Signals

A phase should not be treated as complete just because execution finished. Completion requires enough evidence for the next command to route safely:

- execution summaries exist
- validation state is known
- UAT state is known or explicitly deferred
- any review or security follow-up is visible in artifacts
- `STATE.md` names the next action clearly

## Failure And Pause Paths

- `pause-work` should leave a resumable handoff in `.blueprint/reports/` plus an updated `STATE.md`.
- `resume-work` should reconstruct context from `STATE.md`, phase artifacts, and the latest handoff report.
- failed execution, validation, or review steps should still leave durable artifacts explaining blockers rather than disappearing into chat history.

## Related Specs

- `docs/commands/discuss-phase.md`
- `docs/commands/research-phase.md`
- `docs/commands/ui-phase.md`
- `docs/commands/plan-phase.md`
- `docs/commands/execute-phase.md`
- `docs/commands/validate-phase.md`
- `docs/commands/verify-work.md`
