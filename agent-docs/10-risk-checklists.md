# Risk Checklists

Use these checklists before changing high-risk behavior.

## Implemented-Only Routing

Before touching router, help, progress, next, or command follow-up text:

- Confirm the command catalog entry is implemented.
- Confirm required tools are registered.
- Confirm primary skill resolves.
- Confirm optional agents are known.
- Confirm unavailable commands are explained as unavailable, not recommended.
- Prefer `/blu-progress` when a specific implemented follow-up is not safe.

## High-Risk Commands

Treat these as confirmation-gated:

- `/blu-ship`
- `/blu-undo`
- `/blu-pr-branch`
- `/blu-new-workspace`
- `/blu-remove-workspace`
- `/blu-workstreams` when switching or mutating workstream state
- `/blu-cleanup`
- `/blu-reapply-patches`
- roadmap mutation commands that add, insert, remove, or promote phases

Before mutation:

- Preview the exact target.
- Surface dirty, ambiguous, stale, or drifted state.
- Require explicit confirmation where the runtime contract requires it.
- Prefer report-before-mutate when the command owns a report.
- Stop instead of guessing when the target is unclear.

Specific traps:

- `ship`: keep local prep, push, and PR creation separate; preserve manual
  fallback when remote operations cannot complete.
- `undo`: dirty tree, detached HEAD, merge in progress, or missing target are
  hard stops; use safe revert-style behavior rather than reset, delete, or
  history rewrite shortcuts.
- `pr-branch`: dirty tree is a hard stop; classify commits before confirmation;
  do not rewrite or delete the source branch.
- `cleanup`: protect current phase and active roadmap references before moving
  directories.
- `reapply-patches`: list first, dry-run the exact patch set, hard-stop on
  dirty tree, compatibility mismatch, or installed-extension target, then replay
  only confirmed ids.
- `update`: keep it advisory and out-of-band; do not make it self-mutating.

## State Writes

Before adding or changing a write path:

- Confirm the owning MCP tool.
- Confirm path containment.
- Confirm idempotency fields.
- Confirm mutation failure logging.
- Confirm focused tests cover rejection and success.

Do not write `.blueprint/` or host-global state directly from command prompts,
skills, agents, or hooks.

## Host And Install Safety

Before changing host behavior:

- Check both host manifests.
- Check runtime host defaults.
- Build before smoke or install checks.
- Do not mutate installed extension directories.
- Do not make update self-mutating.

## Public MCP Response Safety

Before changing response shaping:

- Confirm `content[0].text` mirrors the JSON string form of
  `structuredContent`.
- Trim only redundant or oversized fields in public output.
- Keep full tool contracts available to handlers and tests.

## Prompt-Boundary Safety

Before changing model-authored persistence:

- Strip invisible or control characters when the helper is designed to sanitize.
- Reject instruction-override patterns and suspicious high-entropy payloads.
- Keep rejection diagnostics actionable.

## Dirty Worktree Safety

Before editing:

- Check `git status --short --branch`.
- Keep unrelated user changes untouched.
- Work in the fresh worktree for the task.
- Do not use destructive git commands unless explicitly asked.
