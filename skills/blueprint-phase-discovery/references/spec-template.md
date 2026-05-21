# Phase Specification Template

Use this as a Blueprint-native drafting seed for a phase-scoped `XX-SPEC.md`.
Keep it aligned with the live `phase.spec` contract: same top metadata,
canonical headings, falsifiable requirements, explicit boundaries, and
pass/fail acceptance criteria.

## File Template

```markdown
# Phase [X]: [Name] - Specification

**Created:** [date]
**Ambiguity score:** [score] (gate: <= 0.20)
**Requirements locked:** [count]

## Goal

[One precise sentence describing the observable outcome. State what changes from
the current state to the target state.]

## Background

[Current phase context: what exists today, what is missing, what triggers this
phase, and which saved Blueprint artifacts or narrow repo evidence grounded the
spec.]

## Requirements

1. **[Short label]**: [Specific, testable requirement statement.]
   - Current: [what exists today or does not exist yet]
   - Target: [what should be true after this phase]
   - Acceptance: [concrete pass/fail verification]

2. **[Short label]**: [Specific, testable requirement statement.]
   - Current: [what exists today or does not exist yet]
   - Target: [what should be true after this phase]
   - Acceptance: [concrete pass/fail verification]

[Continue for every locked requirement. Each one must include Current, Target,
and Acceptance.]

## Boundaries

**In scope:**
- [Concrete deliverable or behavior this phase will produce]
- [Concrete deliverable or behavior this phase will produce]

**Out of scope:**
- [Excluded work] - [brief reason it stays out of this phase]
- [Adjacent work kept for another phase] - [brief reason]

## Constraints

- [Constraint, dependency, compatibility rule, workflow limit, or safety
  expectation that must remain true]

[If there are no extra constraints: "No additional constraints beyond current
Blueprint conventions."]

## Acceptance Criteria

- [ ] [Pass/fail criterion]
- [ ] [Pass/fail criterion]
- [ ] [Pass/fail criterion]

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | [score] | 0.75 | [met or below-minimum] | [notes] |
| Boundary Clarity | [score] | 0.70 | [met or below-minimum] | [notes] |
| Constraint Clarity | [score] | 0.65 | [met or below-minimum] | [notes] |
| Acceptance Criteria | [score] | 0.70 | [met or below-minimum] | [notes] |
| Ambiguity | [score] | <=0.20 | [met or above-gate] | [notes] |

Status notes:
- `met` means the dimension met its minimum.
- `below-minimum` means later work must treat the gap as an explicit
  assumption.
- unresolved dimensions should be named directly in the `Notes` column.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | [summary] | [decision] |
| 2 | Researcher + Simplifier | [summary] | [decision] |
| 3 | Boundary Keeper | [summary] | [decision] |
| 4 | Failure Analyst | [summary] | [decision] |
| 5 | Seed Closer | [summary] | [decision] |

[If decisions were made automatically, mark the relevant entries as
`auto-selected` and state what was locked.]

---
*Phase: [XX-phase-slug]*
```

## Drafting Rules

- Every requirement must include `Current`, `Target`, and `Acceptance`.
- Keep `In scope` and `Out of scope` as explicit lists, not narrative prose.
- Acceptance criteria must be pass/fail checkboxes.
- Keep the artifact Blueprint-native and phase-scoped.
- Use saved phase artifacts and narrow repo evidence to ground the Background.
- Remove all placeholder text before any persisted write.
