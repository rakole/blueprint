# Changing Course

Do not execute a plan you do not trust. If the plan, next action, or saved context is wrong, stop and move upstream until the evidence is correct.

## When The Next Action Feels Wrong

Start with read-only state:

```text
/blu-progress
```

```text
/blu-next
```

Then ask Blueprint to show its assumptions:

```text
/blu-list-phase-assumptions <phase>
```

Use this when the command seems to be planning the wrong work, skipping context, or misunderstanding the repo.

## When The Plan Is Wrong

Use:

```text
/blu-plan-phase <phase>
```

Be explicit about whether you want to add, revise, or replace:

- Add a new plan when the existing plan is useful but incomplete.
- Revise a plan when the same plan should keep its identity but change details.
- Replace a plan when the saved plan is no longer trustworthy.

Replacement or overwrite should require confirmation. Do not let a command quietly overwrite a saved plan set.

## When Context Is Wrong

Move upstream instead of patching the plan:

```text
/blu-spec-phase <phase>
```

Use this when the desired outcome, boundaries, acceptance criteria, or "not doing" list is wrong.

```text
/blu-discuss-phase <phase>
```

Use this when the implementation context, constraints, risks, or open questions are wrong or incomplete.

```text
/blu-research-phase <phase>
```

Use this when the plan depends on stale technical facts, missing repo evidence, external APIs, migration choices, or unclear dependencies.

```text
/blu-review <phase>
```

Use this when you want independent scrutiny of saved plans and evidence before execution or shipping.

## Phrases That Work Well

```text
Pause. I do not trust this plan because it assumes the old auth flow still exists.
```

```text
Before execution, run /blu-list-phase-assumptions 4 and show the assumptions you are using.
```

```text
Go upstream. Run /blu-spec-phase 4 to clarify what success means and what is out of scope.
```

```text
Revise the saved plan for Phase 4. Keep the database migration, remove the UI rewrite, and add verification for rollback.
```

```text
Replace the current Phase 4 plan only after confirming the overwrite.
```

```text
Run /blu-review 4 on the saved plan and evidence before any execution.
```

## Stop Rules

Stop before mutation when:

- The plan depends on assumptions you have not seen.
- The command is about to execute a plan you have not approved.
- The next action ignores a recent correction.
- The saved spec, context, research, or plan contradicts current user intent.
- A replacement, cleanup, undo, shipping, workspace, or patch command lacks explicit confirmation.

The safe move is to read state, correct upstream artifacts, then plan again.
