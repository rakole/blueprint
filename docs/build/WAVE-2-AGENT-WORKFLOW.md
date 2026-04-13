# Wave 2 Agent Workflow

## Scope

This workflow exists to close Wave 2 without drifting the shipped runtime while
`insert-phase` remains blocked.

- Keep `complete-milestone`, `milestone-summary`, and `new-milestone` aligned
  across docs, manifests, skills, MCP tools, and tests.
- Treat `insert-phase` as blocked until its dedicated runtime substrate ships.
- Do not reintroduce `.planning/` as Blueprint runtime state.
- Do not reintroduce legacy slash-command surfaces as a user-visible runtime escape hatch.

## Packaging And Gemini Checks

- Review the Gemini extension packaging references before claiming parity:
  - https://geminicli.com/docs/extensions/reference/
  - https://geminicli.com/docs/extensions/best-practices/
  - https://geminicli.com/docs/core/subagents/
- Keep bundled paths extension-safe and rooted at `${extensionPath}`.
- Validate that runtime manifests still point at `${extensionPath}` in
  `gemini-extension.json`.
- Re-check command manifests against `commands/**/*.toml`.

## Shared Memory Protocol

- Initialize and coordinate shared closeout work through
  `scripts/drift-fix-memory.mjs`.
- Update `MEMORY.md` through the shared workflow before handing off.
- Record major drift checkpoints through `scripts/drift-fix-memory.mjs`.
- Record major drift checkpoints through `scripts/drift-fix-memory.mjs`.
- Record task claims, blockers, notes, files changed, and tests run in the
  shared memory flow before marking work complete.
