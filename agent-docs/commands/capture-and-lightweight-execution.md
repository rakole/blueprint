# Capture And Lightweight Execution Commands

Capture commands record lightweight project information. Lightweight execution
commands handle bounded work below full phase ceremony.

Commands:

- `/blu-note`
- `/blu-add-todo`
- `/blu-check-todos`
- `/blu-add-backlog`
- `/blu-review-backlog`
- `/blu-explore`
- `/blu-fast`
- `/blu-quick`
- `/blu-debug`

## Source Surfaces

- Capture, phase-execution, and debug skills.
- State, artifact report, roadmap, todo, backlog, and project status tools.
- Debugger, executor, reviewer, and planner agents when allowed by the active
  command.

## Invariants

Do:

- Keep capture writes bounded to the confirmed destination.
- Keep `/blu-fast` trivial and low-ceremony.
- Keep `/blu-quick` report-backed instead of pretending it is a full saved plan.
- Keep debug investigation evidence durable when the command owns a report.
- Route follow-ups to implemented commands, often `/blu-progress` when unclear.

Do not:

- Promote backlog into roadmap without the command's confirmation and MCP path.
- Let quick or fast bypass safety when the work is non-trivial.
- Store debugging conclusions only in chat when the command owns a report.

## Verification

Use focused tests such as:

- `tests/capture-tools.test.ts`
- `tests/note-metadata.test.ts`
- `tests/add-todo-metadata.test.ts`
- `tests/check-todos-metadata.test.ts`
- `tests/add-backlog-metadata.test.ts`
- `tests/review-backlog-metadata.test.ts`
- `tests/explore-metadata.test.ts`
- `tests/fast-metadata.test.ts`
- `tests/quick-metadata.test.ts`
- `tests/debug-metadata.test.ts`
- `tests/lightweight-execution-regression.test.ts`
