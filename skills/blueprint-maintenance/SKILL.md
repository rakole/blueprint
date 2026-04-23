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
- `blueprint_update_check`
- `blueprint_update_plan`
- `blueprint_workspace_registry_get`
- `blueprint_workspace_create`
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

### `new-workspace`

- Execution profile: `high-risk-maintenance`
- Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep `new-workspace-confirmation` visible until the user approves, and keep any `dirty-working-tree`, `invalid-workspace-source`, `workspace-conflict`, or strategy-change waiting state explicit with the next safe action while the run is blocked.

1. Read `blueprint_config_get` before deriving the default workspace root. Prefer an explicit target path from the user; otherwise derive the workspace root from normalized `maintenance.workspace_root` and fall back to `~/blueprint-workspaces` only when config cannot provide a root.
2. Read `blueprint_workspace_registry_get` before mutation. Treat the returned `registryPath` and `workspaces` as authoritative host-global workspace state, and stop on malformed or conflicting registry state instead of guessing.
3. Resolve the full workspace plan before mutation: workspace name, resolved workspace path, repo members, strategy, branch, workspace manifest path, and the registry mutation plan. Keep that resolved scope visible throughout the run.
4. Inspect every source repo before mutation. A dirty working tree, invalid git repo, or target-path conflict is a hard stop for workspace creation. Keep those blockers visible as `dirty-working-tree`, `invalid-workspace-source`, or `workspace-conflict`.
5. Prefer `worktree` when it is safe, but if preflight proves that `worktree` cannot satisfy the requested branch or source-repo conditions, do not silently switch to `clone`. Preview the clone fallback and require explicit approval before changing strategy.
6. Require one explicit confirmation that includes the resolved workspace name and path, repo members, strategy, branch, workspace manifest path, and host-global registry mutation plan before calling `blueprint_workspace_create`. Keep the pending gate explicit as `new-workspace-confirmation` until the user approves.
7. Persist the workspace only through `blueprint_workspace_create`, and treat its returned `workspacePath`, `manifestPath`, `registryPath`, `registryEntry`, and `repoMembers` as authoritative. Keep host-global state under `~/.<host>/blueprint/`; never invent a project-local workspace registry.
8. Keep failure handling honest: if creation fails, stop and surface the blocker clearly. Never claim success when the workspace manifest or registry entry was not written, and never leave a partial registry entry behind.

### `update`

- Execution profile: `interactive-read`
- Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep `update-mode-gate` visible until the user chooses the saved checklist versus the manual fallback view when the intent is not already explicit.

1. Read `blueprint_update_check` first and treat the returned host, extension path, installed version, install provenance, latest-version lookup status, update availability, and warnings as authoritative runtime discovery.
2. Keep extension-path handling read-only. `/blu-update` must never write into the installed extension directory or mutate the running extension bundle in-session.
3. Resolve the advisory scope explicitly before persistence: host, resolved extension path, installed version, install provenance, latest-version lookup status, and whether an update appears available.
4. Prefer Gemini CLI `ask_user` for the saved-checklist versus manual-fallback mode gate when a structured choice helps. When that helper is unavailable, keep the same gate explicit in prose instead of implying tool parity.
5. If the user wants a saved checklist, persist it only through `blueprint_update_plan`, and treat the returned `savedPaths.updatesDir`, `savedPaths.metadataPath`, and `savedPaths.checklistPath` as authoritative.
6. Keep all Blueprint-owned update persistence under `~/.<host>/blueprint/updates/`. Do not write project-local update artifacts under `.blueprint/`.
7. Keep failure handling honest: if latest-version lookup is unavailable, surface the manual fallback path clearly instead of bluffing a remote version. If checklist persistence fails, report the blocker and still return the manual update steps without pretending the checklist was saved.
8. Always end the flow with restart guidance. The next safe action after the manual update is to restart Gemini CLI or Tabnine CLI and rerun `/blu-update` if the user wants post-update verification.

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

Shared in-flight contract for `ship`:

- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- For non-trivial `ship` runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact shipping checklist with `write_todos`.
- Treat branchy `ship` runs as tracker-eligible only for session-local coordination. Pair tracker state with visible `write_todos`, and never let tracker state replace the durable `ship-latest` report or Blueprint MCP persistence.

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Resolve the shipping scope explicitly. Prefer the user-named phase, otherwise anchor the flow to the current phase and saved Blueprint evidence instead of guessing across unrelated work.
3. Read effective config through `blueprint_config_get` before deriving base-branch, branching, or commit-docs behavior. Prefer explicit user input, then `git.base_branch`, then safe repo detection.
4. Inspect git status before mutation. A dirty working tree or missing base branch is a hard stop for the shipping flow.
5. Make the resolved target explicit before mutation: name the selected phase or milestone, source branch, base branch, and the evidence set that is gating the ship path.
6. Read saved verification, UAT, review, security, and `pr-branch` evidence through `blueprint_artifact_list` before proposing a draft or ready PR path.
7. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` and, when useful, tracked-file inputs so the shipping plan stays grounded in the saved Blueprint evidence and the active diff.
8. Keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the resolved scope, pending gate, execution mode, and next safe action legible throughout the run.
9. Keep remote mutation explicit: local preparation, optional push, and optional PR creation are separate steps, and the preview must name the exact git or `gh` commands that would run.
10. Require explicit confirmation that includes draft versus ready state, source and base branches, requested push or PR steps, and fallback behavior when `gh` is missing or unauthenticated.
11. When the flow branches across local prep, remote checks, optional push, optional PR creation, manual fallback preparation, and post-ship routing, tracker-backed coordination may be used, but treat tracker state as session-local coordination only and keep the visible checklist authoritative for the user.
12. Persist the durable outcome through `blueprint_artifact_report_write` with the bare report name `ship-latest`, including manual fallback guidance when remote creation does not happen. Use the returned `path` as the authoritative saved report location.
13. If the outcome changes the next safe Blueprint action, update it through `blueprint_state_update` after the report is written.

### `undo`

Shared in-flight contract for `undo`:

- Execution profile: `high-risk-maintenance`
- Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep `undo-confirmation` and `report-overwrite-confirmation` visible until the user clears them, and name the next safe action while the flow is blocked.

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Resolve the undo scope explicitly. Prefer the user-named phase or plan when one was provided; otherwise keep any `last N commits` request bounded to the current branch and recent history instead of guessing across unrelated work.
3. Read `blueprint_phase_locate` when the user names a phase or plan so the revert target stays anchored to authoritative Blueprint metadata instead of filenames or chat memory.
4. Inspect git status before mutation. A dirty working tree, detached HEAD, in-progress merge, or missing revert target is a hard stop for undo. Keep that waiting state explicit as pending gate `dirty-working-tree`, `detached-head`, `merge-in-progress`, or `missing-revert-target`, and keep the next safe action explicit before rerunning.
5. Make the resolved target explicit before mutation: name the branch, candidate revert set, revert order, and any saved Blueprint evidence that would become stale if the revert succeeds.
6. Read saved summaries, verification or UAT artifacts, review artifacts, shipping reports, and related evidence through `blueprint_artifact_list` before proposing the revert so dependency impact stays visible.
7. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` and, when useful, tracked-file inputs so the undo plan stays grounded in the selected evidence and candidate revert set.
8. Keep the active stage visible as the run moves through `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, and keep the resolved scope, pending gate, execution mode, and next safe action legible throughout the run.
9. Require explicit confirmation that includes the exact revert scope, candidate commits, dependency-impact notes, the `undo-latest` report, and the precise git commands that will run. Keep the pending gate explicit as `undo-confirmation` until the user approves.
10. If replacing `undo-latest` needs overwrite approval, keep the report-overwrite waiting state explicit as `report-overwrite-confirmation` and name the next safe action before continuing.
11. Persist the approved undo plan through `blueprint_artifact_report_write` with the bare report name `undo-latest` before git mutation begins, and use the returned `path` as the authoritative saved report location.
12. Run only safe revert-style git steps. Never use `git reset --hard`, implicit branch deletion, or other destructive shortcuts for this command.
13. If the outcome changes the next safe Blueprint action, update it through `blueprint_state_update` after the report is written and the revert succeeds.

### `cleanup`

Shared in-flight contract for `cleanup`:

- Execution profile: `high-risk-maintenance`
- Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the protected scope explicit throughout the run: current phase, active roadmap references, evidence-incomplete directories, and the final protected exclusions must stay visible before any archive scope is approved.

1. Read `blueprint_project_status` first and stop with `/blu-new-project` or `/blu-health` guidance when Blueprint state is missing or unhealthy.
2. Read `blueprint_roadmap_read` before proposing any archive scope so the current phase and active roadmap references stay visible as protected exclusions.
3. Inspect git status plus `.blueprint/phases/` before mutation. A dirty working tree, missing phase root, or obviously inconsistent phase layout is a hard stop for cleanup. Keep that waiting state explicit as the pending gate `dirty-working-tree`, `missing-phase-root`, or `inconsistent-phase-layout`, and keep the next safe action explicit before rerunning.
4. Make the resolved target explicit before mutation: name the candidate phase directories, protected exclusions, and final archive destination.
5. Read saved milestone completion, summary, and related evidence through `blueprint_artifact_list` before proposing any archive scope.
6. Keep the cleanup scope explicit: only archive phase directories from completed milestones, never the current phase or any phase still referenced by the active roadmap, keep evidence-incomplete directories in the protected set, and stop instead of guessing when saved evidence is incomplete.
7. Build the preview through `blueprint_artifact_summary_digest` with explicit `artifactPaths` so the cleanup plan stays grounded in the saved milestone evidence and the selected directories.
8. Require explicit confirmation that includes the selected phase directories, protected exclusions, archive destination, whether the operation is move versus copy-then-delete, and report overwrite behavior. Keep the destructive approval gate visible as `cleanup-confirmation` until the user approves. When a new cleanup destination would need to be created, keep that waiting state visible as `archive-destination-confirmation` until the user explicitly approves creating it.
9. If replacing `cleanup-latest` needs overwrite approval, keep the report-overwrite waiting state visible as `report-overwrite-confirmation` and name the next safe action before continuing. Persist the approved cleanup plan through `blueprint_artifact_report_write` with the bare report name `cleanup-latest` before filesystem mutation begins, and use the returned `path` as the authoritative saved report location.
10. Run only the approved filesystem operations, and if a copy path is used, delete originals only after the archive copy succeeds.
11. If the outcome changes the next safe Blueprint action, update it through `blueprint_state_update` after the report is written and filesystem work succeeds.

## Planned Later Command Guardrail

- `remove-workspace`, `workstreams`, and `reapply-patches` remain documented maintenance commands, but they are not routable until their manifests, primary-skill contract, and required MCP substrates all exist together.
- Do not let the presence of this shared maintenance skill make later commands appear implemented by implication.

## Output Style

- For `pr-branch`, report the created review branch plainly, name the base and source branches, call out the included and excluded scope compactly, mention the durable report status, make any active pending gate or waiting state explicit, and end with the safest implemented follow-up or manual next step.
- For `ship`, report the selected scope, the active stage reached, the branch plus PR outcome, whether push or `gh` steps were executed or skipped, the durable report status, any active fallback or pending gate, and the safest implemented follow-up or manual next step.
- For `undo`, report the resolved revert scope, the active stage reached, any active pending gate or waiting state, the revert outcome, any stale-evidence or conflict warnings, the durable report status, and the safest implemented follow-up or manual next step.
- For `new-workspace`, report the resolved workspace path, manifest path, registry path, repo members, chosen strategy, branch, any active pending gate or waiting state, and the safest implemented follow-up or manual next step.
- For `cleanup`, report the archived phase directories, protected exclusions, chosen archive destination, any active pending gate or waiting state, the report status, any skipped safety blockers, and the safest implemented follow-up or manual next step.
- For `update`, report the resolved host, extension path, installed version, latest-version lookup status, whether an update appears available, any active pending gate or waiting state, the saved checklist status when applicable, and the restart-focused next safe action.
