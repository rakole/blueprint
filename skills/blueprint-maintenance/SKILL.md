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
- Never run `/blu-*` in the shell. Blueprint slash commands are Gemini entrypoints, not shell executables.

## Parity Goal

Carry forward the useful upstream maintenance intent while preserving Blueprint's Gemini-native boundaries:

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
- `docs/GSD-RUNTIME-MIGRATION.md`

## Required MCP Tools

- `blueprint_project_status`
- `blueprint_phase_locate`
- `blueprint_config_get`
- `blueprint_roadmap_read`
- `blueprint_artifact_list`
- `blueprint_artifact_summary_digest`
- `blueprint_artifact_report_write`
- `blueprint_state_update`

## Workflow Rules

Shared rule for all maintenance flows:

- run the same integrity preflight first: confirm the resolved target, stop on dirty or drifted state, verify the intended evidence scope, and prefer writing the durable maintenance report before the mutating step when the command owns one

### `pr-branch`

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Read effective config through `blueprint_config_get` before deriving base-branch or commit-docs behavior. Prefer explicit user input, then `git.base_branch`, then safe repo detection.
3. Inspect git status before mutation. A dirty working tree is a hard stop for the clean review-branch flow.
4. Make the resolved target explicit before mutation: name the source branch, base branch, candidate review branch, and whether `.blueprint/**` is included.
5. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` and, when useful, changed-file inputs so the filtered review scope stays evidence-backed.
6. Keep the filtering decision explicit: default to excluding `.blueprint/**` bookkeeping paths when `planning.commit_docs` is true unless the user clearly wants those artifacts included.
7. Fail fast when the filtered diff is empty. Do not create noise branches just to satisfy the command.
8. Require one explicit confirmation that includes the base branch, source branch, candidate review branch name, and included versus excluded scope before any git mutation.
9. Create the review branch without rewriting or deleting the source branch in place.
10. Persist the durable outcome through `blueprint_artifact_report_write` as `.blueprint/reports/pr-branch-latest.md`.
11. Keep follow-up guidance honest: give manual push or PR guidance when later shipping commands are still planned instead of advertising them as runnable.

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
10. Persist the durable outcome through `blueprint_artifact_report_write` as `.blueprint/reports/ship-latest.md`, including manual fallback guidance when remote creation does not happen.
11. If the outcome changes the next safe Blueprint action, update it through `blueprint_state_update` after the report is written.

### `cleanup`

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Read `blueprint_roadmap_read` before proposing any archive scope so the current phase and active roadmap references stay visible as protected exclusions.
3. Inspect git status plus `.blueprint/phases/` before mutation. A dirty working tree, missing phase root, or obviously inconsistent phase layout is a hard stop for cleanup.
4. Make the resolved target explicit before mutation: name the candidate phase directories, protected exclusions, and final archive destination.
5. Read saved milestone completion, summary, and related evidence through `blueprint_artifact_list` before proposing any archive scope.
6. Keep the cleanup scope explicit: only archive phase directories from completed milestones, never the current phase or any phase still referenced by the active roadmap, and stop instead of guessing when saved evidence is incomplete.
7. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` so the cleanup plan stays grounded in the saved milestone evidence and the selected directories.
8. Require explicit confirmation that includes the selected phase directories, protected exclusions, archive destination, whether the operation is move versus copy-then-delete, and report overwrite behavior.
9. Persist the approved cleanup plan through `blueprint_artifact_report_write` as `.blueprint/reports/cleanup-latest.md` before filesystem mutation begins.
10. Run only the approved filesystem operations, and if a copy path is used, delete originals only after the archive copy succeeds.
11. If the outcome changes the next safe Blueprint action, update it through `blueprint_state_update` after the report is written and filesystem work succeeds.

## Planned Later Command Guardrail

- `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `update`, and `reapply-patches` remain documented maintenance commands, but they are not routable until their manifests, primary-skill contract, and required MCP substrates all exist together.
- Do not let the presence of this shared maintenance skill make later commands appear implemented by implication.

## Output Style

- For `pr-branch`, report the created review branch plainly, name the base and source branches, call out the included and excluded scope compactly, mention the durable report status, and end with the safest implemented follow-up or manual next step.
- For `ship`, report the selected scope, the branch plus PR outcome, whether push or `gh` steps were executed or skipped, the durable report status, and the safest implemented follow-up or manual next step.
- For `cleanup`, report the archived phase directories, protected exclusions, chosen archive destination, report status, any skipped safety blockers, and the safest implemented follow-up or manual next step.
