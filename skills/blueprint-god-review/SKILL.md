---
name: blueprint-god-review
description: >
  Internal repo-local orchestration for `--feels-like-god` review and
  review-fix invocations. This skill is private and must not be surfaced by
  public Blueprint routing.
status: implemented
---

# Blueprint God Review Skill

## Purpose

Hold the private god-review orchestration for `/blu-code-review` and
`/blu-code-review-fix` so the public review skill and public command manifests
stay free of hidden control flow.

## Runtime Call Rules

- Hidden God-Review Activation Guard: before any MCP call, repo read, file
  write, subagent call, topic update, todo update, or source edit for hidden
  god-review work, inspect only the already-available active command and raw
  invocation text. Hidden god-review work is valid only when the active command
  is `/blu-code-review` or `/blu-code-review-fix` and the raw invocation
  contains `--feels-like-god` as a standalone flag token. If this skill is
  invoked for hidden god-review work without that exact activation, return only:

  ```text
  God mode only wakes during special `occassions`.
  This is a mistaken skill invocation, reach out to blueprint admin for help.
  No `thunderbolt` today.
  ```

  Then stop immediately. Do not call MCP tools, inspect `.blueprint/`, read
  repo files, use `STATE.md.activeCommand`, write files, spawn subagents, or
  infer intent from ordinary Blueprint state before this guard passes.
- After the activation guard passes and before ordinary review-mode lane work,
  load these private lane references:
  - `skills/blueprint-god-review/references/review-method.md`
  - `skills/blueprint-god-review/references/lane-rubrics.md`
  - `skills/blueprint-god-review/references/finding-quality.md`
  - `skills/blueprint-god-review/references/context-selection.md`
  - `skills/blueprint-god-review/references/finding-examples.md`
  Do not load `skills/blueprint-god-review/references/final-curation.md` for
  ordinary lane passes.
  Load `skills/blueprint-god-review/references/final-curation.md` only after a
  hidden review invocation reaches terminal review status because all hidden
  groups are complete or blocked and no pending group remains. This terminal
  curation reference is never required before the activation guard, before the
  hidden MCP state reports terminal review status, or during per-lane review.
  In fix mode, default to `finding-quality.md` and `context-selection.md` for
  stale evidence, fix eligibility, and selected target context; load
  `finding-examples.md` only when classifying duplicate, weak, or no-edit
  outcomes would benefit from calibration examples.
- Hidden `/blu-code-review --feels-like-god` orchestration is private and
  one-group-at-a-time:
  1. Start fresh hidden review state with
     `mcp_blueprint_blueprint_god_review_start`, or continue saved hidden state
     with `mcp_blueprint_blueprint_god_review_next` when the invocation
     supplies `--continue`, `--run-id`, or `--session`.
  2. Treat the returned `files`, `scopeFingerprint`, `nextGroup`,
     `nextGroupId`, and `nextCommand` as authoritative. Do not rediscover or
     widen scope from normal review tools, git drift, chat memory, or
     `.blueprint/STATE.md`.
  3. Review exactly one returned pending group per invocation, then persist
     that group with `mcp_blueprint_blueprint_god_review_append`. Pass one
     `groupId`, one terminal group `status`, and that group's findings only.
  4. End with the exact returned continuation command when more groups remain.
     When no pending group remains or the session is blocked, load
     `skills/blueprint-god-review/references/final-curation.md`, curate only
     from the durable hidden report and lane evidence, and return the terminal
     review response described there.
  5. Do not call normal `blueprint_review_record`, do not write
     `XX-REVIEW.md`, and do not update quality gates or normal `STATE.md`.
- Hidden `/blu-code-review-fix --feels-like-god` selection is private and
  no-edit-on-stale:
  1. After the activation guard passes, call
     `mcp_blueprint_blueprint_god_review_load_findings` before source edits.
     Pass active command, raw invocation, and any supplied `--run-id`,
     `--session`, `--finding`, `--severity`, or `--all` selector.
  2. Treat the returned `selection.status`, `selection.targets`,
     `selection.excluded`, and `selection.staleReasons` as authoritative.
     Default hidden fix selection includes only high or medium actionable
     `follow-up` findings with `Fix Eligibility: eligible`.
  3. Use `--finding`, `--severity`, and `--all` as the only widening
     selectors. Do not widen from chat memory, normal `XX-REVIEW.md`, normal
     `XX-REVIEW-FIX.md`, `.blueprint/STATE.md`, or current git drift.
  4. If `selection.status` is `stale`, `invalid`, or `empty`, stop with a
     no-edit hidden outcome and name the stale reasons, invalid reason, or
     empty selection. Do not write normal review-fix artifacts, commits,
     branches, PRs, staging changes, or quality-gate state.
  5. If `selection.status` is `ready`, re-read only the selected target files,
     make bounded source edits only for the returned target ids, and run
     focused verification.
  6. After each selected finding attempt, call
     `mcp_blueprint_blueprint_god_review_record_fix` exactly once for that
     finding. Record the exact `findingId`, `status`, `selectedBy`, changed
     files, verification, evidence, and follow-up. Use `fixed` only for real
     code edits; use `stale`, `skipped`, `deferred`, or `blocked` for no-edit
     outcomes with no changed files.
  7. Set the record call's `terminal` flag only when the hidden fix pass has
     reached a terminal result for the run.
  8. When hidden review and hidden fix are both terminal, use
     `mcp_blueprint_blueprint_god_review_cleanup` only for private temporary
     state cleanup. For a no-op hidden fix pass with no eligible findings, pass
     `noEligibleFindingsTerminal: true` only after `selection.status` is
     `empty`. Cleanup may delete only the hidden session JSON and
     `.god-review-state.md`; it must preserve the durable god-review report and
     remediation log plus all normal Blueprint review, review-fix, state, and
     quality-gate artifacts.
- Call Blueprint MCP tools only through runtime FQNs such as
  `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older
  Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Invoke
  optional subagents only when the current command contract explicitly allows
  them and effective config has `workflow.subagents=true`; otherwise use the
  command's no-subagent fallback and state config disabled subagents.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI
  entrypoints, not shell executables.
