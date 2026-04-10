---
name: blueprint-planning
description: Use when the user needs a phased implementation plan, task decomposition, dependencies, or verification criteria for a build.
---

# Blueprint Planning

Turn ambiguous requests into execution-ready plans.

## Output shape

Return:

1. Intended outcome
2. Phases or slices
3. Dependencies and assumptions
4. Verification criteria
5. Recommended first move

## Planning rules

- Prefer small slices that can be verified independently.
- Call out risky unknowns early.
- Avoid pretending a dependency or integration exists when it does not.
- Keep the first slice small enough to complete in one focused pass.
