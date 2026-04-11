# Blueprint Phase Lifecycle

## Purpose

This file describes the intended artifact flow through a single Blueprint phase so future work can implement lifecycle commands without reopening naming or ownership decisions.

## Happy-Path Sequence

1. `discuss-phase`
   Writes `XX-CONTEXT.md`, may persist `XX-DISCUSS-CHECKPOINT.json` during long discovery, and should delete that checkpoint after successful context capture.
2. `research-phase`
   Writes `XX-RESEARCH.md` when technical uncertainty or integration risk exists.
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
- `secure-phase` writes `XX-SECURITY.md`.
- `ui-review` writes `XX-UI-REVIEW.md`.
- `add-tests` may write supporting reports in `.blueprint/reports/` while adding code-level tests later.
- `review` writes peer-review artifacts under `.blueprint/reports/` when cross-CLI review is requested.

## Phase Completion Signals

A phase should not be treated as complete just because execution finished. Completion requires enough evidence for the next command to route safely:

- execution summaries exist
- validation state is known and grounded in saved summaries
- UAT state is known, resumable, or explicitly deferred
- any review or security follow-up is visible in artifacts
- `STATE.md` names the next action clearly

## Failure And Pause Paths

- `pause-work` writes the canonical `.blueprint/reports/pause-work-latest.md` handoff plus an updated `STATE.md`.
- The pause handoff captures the stopping point, completed work, remaining work, decisions, blockers, pending human actions, modified files, context notes, and the first next action for resumption.
- `resume-work` should reconstruct context from `STATE.md`, phase artifacts, and the canonical `pause-work` handoff schema.
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
