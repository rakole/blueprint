---
name: blueprint-execution
description: Use when the user is ready to implement a defined Blueprint slice and wants careful execution with verification.
---

# Blueprint Execution

Execute one clearly scoped slice at a time.

## Execution loop

1. Restate the target.
2. Inspect the relevant files and interfaces.
3. Make the smallest complete change.
4. Run verification.
5. Report outcome and remaining gaps.

## Rules

- Do not expand scope silently.
- Prefer working software over placeholder abstractions.
- If the scaffold lacks supporting infrastructure, say so and continue with the next best local implementation.
