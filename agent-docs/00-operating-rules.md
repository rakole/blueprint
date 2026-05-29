# Operating Rules

These rules apply to every coding agent working in this repository.

## Worktree Rule

Any task that changes even one source-controlled line must start in a fresh git
worktree. Keep all edits and any subagents in that same worktree.

Recommended shape:

```bash
git worktree add -b codex/<short-task-name> ../blueprint-<short-task-name> main
cd ../blueprint-<short-task-name>
npm ci
```

Do not edit the main checkout directly for implementation work.

## Install Rule

Worktrees do not share `node_modules`. In a fresh worktree, run:

```bash
npm ci
```

Run it before `npm run build`, `npm run typecheck`, `npm test`, or any targeted
`tsx --test` command. Missing local packages can create misleading failures for
`esbuild`, `tsc`, and `tsx`.

## Subagent Rule

Use subagents only when the task benefits from independent lanes.

Do:

- Put subagents in the same worktree as the parent task.
- Give every subagent a bounded read or write scope.
- Close each subagent as soon as its work is finished.
- Treat subagent output as evidence until checked against live source.

Do not:

- Let subagents edit the main checkout while the parent edits a worktree.
- Give two writing subagents overlapping file ownership.
- Leave finished subagents open.

## Repository Workflow

For a completed change:

```bash
git status --short
npm run typecheck       # when code changed
npm test                # when shared behavior changed
git push -u origin codex/<short-task-name>
gh pr create --draft    # or ready PR when requested
gh pr merge             # when the user explicitly wants merge completion
git checkout main
git pull --ff-only origin main
git worktree remove ../blueprint-<short-task-name>
git branch -d codex/<short-task-name>
```

Treat the GitHub connector as read-only for Blueprint write operations. Use
`gh` CLI or plain `git` for PR creation, merge, and push operations.

## Host Safety

Do not mutate installed extension directories. Do not write host-global
Blueprint state directly. Host-global state is owned by MCP tools and runtime
host helpers.

## Documentation Updates

This folder is implementation guidance for coding agents. Keep it concise,
specific, and source-grounded. Do not turn it into a second product manual.
