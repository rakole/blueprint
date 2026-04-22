---
name: blueprint-maintenance
description: >
  Git, review-branch prep, workspace, cleanup, update, and patch operations for
  Blueprint. Use this skill to keep high-risk maintenance flows confirmation-gated,
  explicit about git or filesystem mutation, and report-backed when the command
  owns project-local evidence.
status: implemented
commands:
  - /blu-pr-branch
  - /blu-ship
  - /blu-undo
  - /blu-new-workspace
  - /blu-remove-workspace
  - /blu-workstreams
  - /blu-cleanup
  - /blu-update
  - /blu-reapply-patches
---

# Blueprint Maintenance Skill

## Purpose

Orchestrate Blueprint maintenance flows so git, workspace, cleanup, and patch operations stay explicit, confirmation-gated, and aligned with documented runtime state boundaries.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Parity Goal

Carry forward the useful maintenance intent while preserving Blueprint's host-native boundaries:

- confirmation comes before any destructive or git-mutating step
- Blueprint-owned persistence stays inside documented MCP tools
- repo and global state boundaries stay explicit
- `.blueprint/` filtering decisions stay reviewable instead of hidden in shell glue
- source branches, workspaces, and patch registries are never rewritten implicitly
- follow-up guidance stays inside the implemented Blueprint surface when possible

## Required Inputs

- `docs/commands/pr-branch.md`
- `docs/commands/ship.md`
- `docs/commands/undo.md`
- `docs/commands/new-workspace.md`
- `docs/commands/remove-workspace.md`
- `docs/commands/workstreams.md`
- `docs/commands/cleanup.md`
- `docs/commands/update.md`
- `docs/commands/reapply-patches.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`

## Required MCP Tools

- `blueprint_project_status`
- `blueprint_phase_locate`
- `blueprint_config_get`
- `blueprint_roadmap_read`
- `blueprint_artifact_list`
- `blueprint_artifact_summary_digest`
- `blueprint_artifact_report_write`
- `blueprint_state_update`

## Shared MCP Contracts

- `blueprint_phase_locate`: pass only a numeric phase reference when the command provides one, or omit `phase` for state or roadmap inference. Never pass phase directories, slugs, or filenames.
- `blueprint_artifact_summary_digest`: pass repo-relative `artifactPaths`, `trackedFiles`, and related file inputs only, and treat `inputsUsed` as the authoritative digest scope.
- `blueprint_artifact_report_write`: pass a bare report name such as `pr-branch-latest`, `ship-latest`, `undo-latest`, or `cleanup-latest`, not a `.blueprint/reports/...` path. Use the returned `path` as authoritative.

## Workflow Rules

Shared rule for all maintenance flows:

- run the same integrity preflight first: confirm the resolved target, stop on dirty or drifted state, verify the intended evidence scope, and prefer a report-before-mutate flow when the command owns a durable maintenance report

### `pr-branch`

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Read effective config through `blueprint_config_get` before deriving base-branch or commit-docs behavior. Prefer explicit user input, then `git.base_branch`, then safe repo detection.
3. Inspect git status before mutation. A dirty working tree is a hard stop for the clean review-branch flow.
4. Keep the waiting state explicit before mutation: a dirty working tree should surface the pending gate `clean-working-tree` plus the next safe action to clean, stash, or commit before rerunning.
5. Make the resolved target explicit before mutation: name the source branch, base branch, candidate review branch, and whether `.blueprint/**` is included.
6. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` and, when useful, changed-file inputs so the filtered review scope stays evidence-backed.
7. Keep the filtering decision explicit: default to excluding `.blueprint/**` bookkeeping paths when `planning.commit_docs` is true unless the user clearly wants those artifacts included.
8. Fail fast when the filtered diff is empty. Do not create noise branches just to satisfy the command.
9. Require one explicit confirmation that includes the base branch, source branch, candidate review branch name, and included versus excluded scope before any git mutation, and keep the pending gate visible as `review-branch-confirmation` until the user approves.
10. If a later `pr-branch-latest` replacement is blocked on an existing report, keep the pending gate explicit as report overwrite confirmation and name the next safe action instead of smoothing past it.
11. Create the review branch without rewriting or deleting the source branch in place.
12. Persist the durable outcome through `blueprint_artifact_report_write` with the bare report name `pr-branch-latest`, and use the returned `path` as the authoritative saved report location.
13. Keep follow-up guidance honest: give manual push or PR guidance when later shipping commands are still planned instead of advertising them as runnable.

### `ship`

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Resolve the shipping scope explicitly. Prefer the user-named phase, otherwise anchor the flow to the current phase and saved Blueprint evidence instead of guessing across unrelated work.
3. Read effective config through `blueprint_config_get` before deriving base-branch, branching, or commit-docs behavior. Prefer explicit user input, then `git.base_branch`, then safe repo detection.
4. Inspect git status before mutation. A dirty working tree or missing base branch is a hard stop for the shipping flow.
5. Make the resolved target explicit before mutation: name the selected phase or milestone, source branch, base branch, and the evidence set that is gating the ship path.
6. Read saved verification, UAT, review, security, and `pr-branch` evidence through `blueprint_artifact_list` before proposing a draft or ready PR path.
7. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` and, when useful, tracked-file inputs so the shipping plan stays grounded in the saved Blueprint evidence and the active diff.
8. Keep remote mutation explicit: local preparation, optional push, and optional PR creation are separate steps, and the preview must name the exact git or `gh` commands that would run.
9. Require explicit confirmation that includes draft versus ready state, source and base branches, requested push or PR steps, and fallback behavior when `gh` is missing or unauthenticated.
10. Persist the durable outcome through `blueprint_artifact_report_write` with the bare report name `ship-latest`, including manual fallback guidance when remote creation does not happen. Use the returned `path` as the authoritative saved report location.
11. If the outcome changes the next safe Blueprint action, update it through `blueprint_state_update` after the report is written.

### `undo`

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Resolve the undo scope explicitly. Prefer the user-named phase or plan when one was provided; otherwise keep any `last N commits` request bounded to the current branch and recent history instead of guessing across unrelated work.
3. Read `blueprint_phase_locate` when the user names a phase or plan so the revert target stays anchored to authoritative Blueprint metadata instead of filenames or chat memory.
4. Inspect git status before mutation. A dirty working tree, detached HEAD, or in-progress merge is a hard stop for undo.
5. Make the resolved target explicit before mutation: name the branch, candidate revert set, revert order, and any saved Blueprint evidence that would become stale if the revert succeeds.
6. Read saved summaries, verification or UAT artifacts, review artifacts, shipping reports, and related evidence through `blueprint_artifact_list` before proposing the revert so dependency impact stays visible.
7. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` and, when useful, tracked-file inputs so the undo plan stays grounded in the selected evidence and candidate revert set.
8. Require explicit confirmation that includes the exact revert scope, candidate commits, dependency-impact notes, the `undo-latest` report, and the precise git commands that will run.
9. Persist the approved undo plan through `blueprint_artifact_report_write` with the bare report name `undo-latest` before git mutation begins, and use the returned `path` as the authoritative saved report location.
10. Run only safe revert-style git steps. Never use `git reset --hard`, implicit branch deletion, or other destructive shortcuts for this command.
11. If the outcome changes the next safe Blueprint action, update it through `blueprint_state_update` after the report is written and the revert succeeds.

### `cleanup`

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Read `blueprint_roadmap_read` before proposing any archive scope so the current phase and active roadmap references stay visible as protected exclusions.
3. Inspect git status plus `.blueprint/phases/` before mutation. A dirty working tree, missing phase root, or obviously inconsistent phase layout is a hard stop for cleanup.
4. Make the resolved target explicit before mutation: name the candidate phase directories, protected exclusions, and final archive destination.
5. Read saved milestone completion, summary, and related evidence through `blueprint_artifact_list` before proposing any archive scope.
6. Keep the cleanup scope explicit: only archive phase directories from completed milestones, never the current phase or any phase still referenced by the active roadmap, and stop instead of guessing when saved evidence is incomplete.
7. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` so the cleanup plan stays grounded in the saved milestone evidence and the selected directories.
8. Require explicit confirmation that includes the selected phase directories, protected exclusions, archive destination, whether the operation is move versus copy-then-delete, and report overwrite behavior.
9. Persist the approved cleanup plan through `blueprint_artifact_report_write` with the bare report name `cleanup-latest` before filesystem mutation begins, and use the returned `path` as the authoritative saved report location.
10. Run only the approved filesystem operations, and if a copy path is used, delete originals only after the archive copy succeeds.
11. If the outcome changes the next safe Blueprint action, update it through `blueprint_state_update` after the report is written and filesystem work succeeds.

## Planned Later Command Guardrail

- `new-workspace`, `remove-workspace`, `workstreams`, `update`, and `reapply-patches` remain documented maintenance commands, but they are not routable until their manifests, primary-skill contract, and required MCP substrates all exist together.
- Do not let the presence of this shared maintenance skill make later commands appear implemented by implication.

## Output Style

- For `pr-branch`, report the created review branch plainly, name the base and source branches, call out the included and excluded scope compactly, mention the durable report status, make any active pending gate or waiting state explicit, and end with the safest implemented follow-up or manual next step.
- For `ship`, report the selected scope, the branch plus PR outcome, whether push or `gh` steps were executed or skipped, the durable report status, and the safest implemented follow-up or manual next step.
- For `undo`, report the resolved revert scope, the revert outcome, any stale-evidence or conflict warnings, the durable report status, and the safest implemented follow-up or manual next step.
- For `cleanup`, report the archived phase directories, protected exclusions, chosen archive destination, report status, any skipped safety blockers, and the safest implemented follow-up or manual next step.
