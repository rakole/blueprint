# Wave 2 Agent Workflow

Use this workflow when closing the Wave 2 roadmap-admin surface and its regression obligations.

## Locked Scope

- Keep `complete-milestone`, `milestone-summary`, and `new-milestone` aligned with their shipped contracts.
- Keep `insert-phase` blocked until its dedicated runtime substrate exists.
- Do not reintroduce `.planning/` as Blueprint runtime state.
- Do not reintroduce `/gsd:*`.

## Packaging And Runtime Checks

- Re-read the Gemini extension reference: https://geminicli.com/docs/extensions/reference/
- Re-read extension best practices: https://geminicli.com/docs/extensions/best-practices/
- Re-read Gemini subagents guidance: https://geminicli.com/docs/core/subagents/
- Keep runtime references aligned with `${extensionPath}` and the bundled command manifests under `commands/**/*.toml`.

## Shared Memory Protocol

- Update `MEMORY.md` through the shared workflow before handing off.
- Refresh drift notes with `scripts/drift-fix-memory.mjs` when the state snapshot changes materially.
- Record blockers, tests, and the next safe action in the closeout handoff.
