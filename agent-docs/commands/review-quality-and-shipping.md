# Review, Quality, And Shipping Commands

This family audits, reviews, fixes, validates quality, and prepares shipping
evidence.

Commands:

- `/blu-code-review`
- `/blu-code-review-fix`
- `/blu-audit-fix`
- `/blu-secure-phase`
- `/blu-review`
- `/blu-ui-review`
- `/blu-add-tests`
- `/blu-docs-update`
- `/blu-impact`
- `/blu-pr-branch`
- `/blu-ship`
- `/blu-undo`

## Source Surfaces

- Review, phase-validation, docs, impact, and maintenance skills.
- Review, god-review, impact, state, artifact, and workspace/update MCP tools.
- Security auditor, UI auditor, reviewer, doc writer, doc verifier, checker,
  and executor agents.

## Invariants

Do:

- Keep review artifacts phase-scoped when the command is phase-scoped.
- Keep fix commands tied to selected findings or explicit scope.
- Keep `ship`, `undo`, and `pr-branch` confirmation-gated.
- Keep PR and git operations outside the GitHub connector when repository write
  operations are needed.
- Preserve report outputs and state updates owned by the command.

Do not:

- Apply broad remediation from a review command without selection.
- Treat external review or UI/security audit output as proof without source
  evidence.
- Rewrite history destructively; use safe revert-style behavior where undo owns
  the operation.

## Verification

Use focused tests such as:

- `tests/code-review-slice.test.ts`
- `tests/code-review-fix-slice.test.ts`
- `tests/audit-fix-slice.test.ts`
- `tests/secure-phase-slice.test.ts`
- `tests/review-slice.test.ts`
- `tests/ui-review-slice.test.ts`
- `tests/add-tests-slice.test.ts`
- `tests/docs-update-metadata.test.ts`
- `tests/impact-tools.test.ts`
- `tests/pr-branch-metadata.test.ts`
- `tests/ship-metadata.test.ts`
- `tests/undo-metadata.test.ts`
