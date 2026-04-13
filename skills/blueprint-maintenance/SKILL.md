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
- `blueprint_config_get`
- `blueprint_artifact_summary_digest`
- `blueprint_artifact_report_write`

## Workflow Rules

### `pr-branch`

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Read effective config through `blueprint_config_get` before deriving base-branch or commit-docs behavior. Prefer explicit user input, then `git.base_branch`, then safe repo detection.
3. Inspect git status before mutation. A dirty working tree is a hard stop for the clean review-branch flow.
4. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` and, when useful, changed-file inputs so the filtered review scope stays evidence-backed.
5. Keep the filtering decision explicit: default to excluding `.blueprint/**` bookkeeping paths when `planning.commit_docs` is true unless the user clearly wants those artifacts included.
6. Fail fast when the filtered diff is empty. Do not create noise branches just to satisfy the command.
7. Require one explicit confirmation that includes the base branch, source branch, candidate review branch name, and included versus excluded scope before any git mutation.
8. Create the review branch without rewriting or deleting the source branch in place.
9. Persist the durable outcome through `blueprint_artifact_report_write` as `.blueprint/reports/pr-branch-latest.md`.
10. Keep follow-up guidance honest: give manual push or PR guidance when later shipping commands are still planned instead of advertising them as runnable.

## Planned Later Command Guardrail

- `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `update`, and `reapply-patches` remain documented maintenance commands, but they are not routable until their manifests, primary-skill contract, and required MCP substrates all exist together.
- Do not let the presence of this shared maintenance skill make later commands appear implemented by implication.

## Output Style

- For `pr-branch`, report the created review branch plainly, name the base and source branches, call out the included and excluded scope compactly, mention the durable report status, and end with the safest implemented follow-up or manual next step.
