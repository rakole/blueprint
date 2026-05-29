# Roadmap And Milestone Commands

Roadmap and milestone commands mutate or report on milestone structure.

Commands:

- `/blu-add-phase`
- `/blu-insert-phase`
- `/blu-remove-phase`
- `/blu-plan-milestone-gaps`
- `/blu-audit-milestone`
- `/blu-complete-milestone`
- `/blu-milestone-summary`
- `/blu-new-milestone`

## Source Surfaces

- Roadmap admin skill and runtime references.
- Project, phase, state, artifact, and roadmap-related MCP tools.
- Artifact contracts for milestone reports and phase context scaffolds.
- Metadata tests for each roadmap command.

## Invariants

Do:

- Use MCP roadmap tools for add, insert, remove, and promotion behavior.
- Preserve requirement traceability.
- Keep decimal insertions from renumbering later integer phases unless the
  command explicitly owns renumbering.
- Require confirmation for destructive or broad roadmap mutation.
- Update state after successful roadmap writes.

Do not:

- Hand-edit roadmap and phase directories separately.
- Delete or renumber future phases outside the owning command contract.
- Treat scaffolded context as finished phase context.

## Verification

Use focused tests such as:

- `tests/roadmap-tools.test.ts`
- `tests/add-phase-metadata.test.ts`
- `tests/insert-phase-metadata.test.ts`
- `tests/remove-phase-metadata.test.ts`
- `tests/plan-milestone-gaps-metadata.test.ts`
- `tests/audit-milestone-tools.test.ts`
- `tests/complete-milestone-metadata.test.ts`
- `tests/milestone-summary-metadata.test.ts`
- `tests/new-milestone-metadata.test.ts`
