---
status: complete
created: 2026-05-05
branch: codex/remove-research-currency-validation
---

# Remove Research Freshness Validation

## Task

Remove MCP enforcement that rejects `phase.research` artifacts when `## State Of The Art` lacks freshness provenance markers.

## Scope

- Remove the hard validation from `blueprint_phase_artifact_write` research artifact validation.
- Remove MCP-facing artifact contract and metadata language that presents the rule as a required validation gate.
- Keep the phase runtime contract as advisory guidance only.
- Update focused regression coverage so undated `## State Of The Art` content is accepted when the rest of the research artifact is valid.
- Rebuild generated `dist/` outputs and run focused verification.

## Verification

- `npm run build`
- Focused research/artifact contract tests

## Notes

- Work ran in fresh worktree `/Users/rhishi/dev/repositories/blueprint-remove-research-currency-validation` on branch `codex/remove-research-currency-validation`.
- `gsd-sdk query` is unavailable in the installed SDK, so this quick task was recorded manually while preserving the workflow gates.
