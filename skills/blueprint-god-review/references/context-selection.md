# God Review Context Selection

## Universal Rules

- Diff-first, not diff-only: start with the changed or selected files, then read
  surrounding contracts needed to prove behavior.
- Trust the hidden session scope after it is created. Continuations must not
  rediscover, widen, or silently refresh scope.
- Prefer narrow, relevant context over whole-repo loading. More files are useful
  only when they test a specific hypothesis.
- Record omissions, skipped files, unavailable commands, and oversize inputs in
  the group notes.

## Phase Scope

Read:
- The MCP-returned phase files and implementation files.
- The phase plan, execution summary, validation/UAT evidence, and artifact
  contracts only when they define the behavior under review.
- Tests and helpers that exercise the phase-owned surface.

Surrounding context:
- Callers/callees of changed public APIs.
- Schema, validator, renderer, persistence, and state-routing helpers touched by
  the phase.
- Existing regression tests near the changed behavior.

Avoid:
- Reopening unrelated phases because they look similar.
- Treating local `.blueprint/` drift outside the frozen scope as evidence for a
  different defect.

## PR Scope

Read:
- PR file list, patch hunks, commit range, and changed tests.
- Target branch contracts, public APIs, and caller/callee context around the
  changed lines.

Surrounding context:
- Files referenced by imports, schemas, migrations, or fixtures in the patch.
- CI/test names when available from read-only `gh` output.

Avoid:
- Reviewing the whole repository because a PR is broad.
- Depending on PR title or description as proof; use it as a hypothesis source
  that source evidence must confirm.

## Current-Diff Scope

Read:
- Staged and unstaged diff, renamed files, deleted files, and changed tests.
- Surrounding functions/classes/modules around each changed hunk.

Surrounding context:
- Build scripts, generated outputs, or snapshots only when the diff implies they
  are part of the runtime contract.
- Recent local changes only through the diff; do not assume untracked files are
  intended unless the session includes them.

Avoid:
- Fixing incidental local dirt.
- Treating current working-tree drift as permission to widen hidden fix targets.

## Explicit-Files Scope

Read:
- Exactly the repo-relative files returned by the hidden session plus minimal
  imports, callers, tests, schemas, or docs needed to evaluate the active lane.

Surrounding context:
- Public API consumers, test fixtures, and persistence formats referenced by the
  explicit files.

Avoid:
- Expanding to sibling modules just because naming suggests related work.
- Reporting omissions as findings when the user intentionally selected a narrow
  file set.

## What To Skip Or Omit

Skip with a written reason:
- Generated files, vendored dependencies, lockfiles, snapshots, minified assets,
  and huge fixtures unless the active lane specifically concerns generated or
  packaging behavior.
- Secrets, host-global state, installed extension directories, and private user
  files outside the repo.
- Files outside the frozen scope when they are not needed for a specific
  evidence chain.

If context is missing:
- Say what was unavailable and how that limits confidence.
- Use `Disposition: blocked` when the missing context prevents a safe judgment.
- Use `Disposition: observation` when the concern is still useful but not
  actionable.
