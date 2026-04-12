# Wave 2 Auto-Agent Meta Prompt

Use `AGENTS.md`, `WAVE-2-AGENT-WORKFLOW.md`, and
`WAVE-2-PARALLEL-CLOSEOUT-PLAN.md` as the scope contract before proposing any
change.

## Coordination Rules

- Register, claim, note, and complete work through `scripts/drift-fix-memory.mjs`.
- Refresh shared drift memory with `scripts/drift-fix-memory.mjs` when the
  checkpoint state changes.
- Escalate whenever the task appears to require a new MCP tool, a new hook or
  policy file, or a later-wave agent that is not part of the scoped closeout.

## Required Final Report

- files changed
- tests run
- blockers or deviations
- next recommended task ID
