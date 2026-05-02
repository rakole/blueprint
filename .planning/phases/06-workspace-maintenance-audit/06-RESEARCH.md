# Phase 6: Workspace Maintenance Audit - Research

**Researched:** 2026-05-02
**Domain:** Blueprint workspace, workstream, cleanup, advisory update, and patch-replay maintenance flows
**Confidence:** HIGH

## Research Question

What does the executor need to know to audit Blueprint's workspace and maintenance surfaces without applying source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, workspace, patch-registry, branch, PR, remote-service, or git-history fixes?

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-05 | Workspace and maintenance commands are audited for registry, worktree, high-risk confirmation, and global-state boundaries. | The plan set must trace `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `update`, and `reapply-patches` from docs and manifests into `skills/blueprint-maintenance/SKILL.md`, MCP tools, runtime references, artifact schemas, and targeted tests. |
| NFIX-01 | No source, manifest, skill, test, build, generated asset, or runtime behavior fixes are applied. | Plans must be read-heavy and write only bug reports, bug index rows, summaries, and planning artifacts. |
| NFIX-02 | Temporary probe files are removed before completion and documented. | Any runtime probe must use disposable temp roots, `BLUEPRINT_GLOBAL_HOME`, or dry-run/no-write paths and must record cleanup evidence. |
| NFIX-03 | Git status is checked at phase boundaries. | Every plan includes `git status --short` and separates unrelated user changes from phase-owned bug docs or summaries. |

## Summary

Phase 6 should be planned as five audit slices. Start with host-global workspace registry and workspace create/remove behavior because `new-workspace` and `remove-workspace` share the highest-risk host-global write substrate. Then audit project-local workstreams because they have a different state boundary under `.blueprint/workstreams/` and a narrow `STATE.md` resume patch contract. Keep cleanup as its own destructive archival slice because report-before-mutate, protected current phase handling, active roadmap references, and partial filesystem failure behavior are distinct from workspaces. Audit advisory update and patch replay together because both are host-global operational maintenance surfaces, but keep `/blu-update` read-only/advisory and `/blu-reapply-patches` confirmation-gated and preview-backed. Close with bug-index reconciliation, no-fix boundary verification, and Phase 6 summary readiness.

## Locked Decisions From Context

- D-01 through D-03: Host-global workspace, update, and patch registry state is a first-class boundary and should be audited for bounded paths, atomic writes, write-failure reporting, and no project-local shadow state.
- D-04 through D-06: `new-workspace`, `remove-workspace`, and `cleanup` need preflight, preview, confirmation, mutation, validation, dirty-tree blockers, exact targets, worktree safety, protected current-phase handling, and durable cleanup reports.
- D-07 through D-09: Workstreams are project-local under `.blueprint/workstreams/`; switch/resume/complete must preserve waiting states and restore only the returned `statePatch` through `blueprint_state_update`.
- D-10 through D-12: `/blu-update` remains advisory and non-self-mutating; `/blu-reapply-patches` must preserve `preflight -> preview -> confirm -> replay -> record`, block unsafe targets, and use Git patch preview/all-or-nothing expectations as a reference point.
- D-13 through D-15: Preserve the Phase 2 through Phase 5 evidence bar and the milestone discovery-only boundary.

## External Behavior References Verified

- Git worktree behavior: official `git worktree` documentation describes linked worktree metadata, stale metadata cleanup through prune/repair, refusal to remove unclean worktrees by default, and force behavior for unclean or locked worktrees. Phase 6 should use that as the reference point for worktree-backed workspace create/remove defects.
- Git apply behavior: official `git apply` documentation describes `--check` preview and the default atomicity where a patch that does not apply cleanly fails as a whole unless `--reject` is used. Phase 6 should treat partial replay, unsafe path acceptance, or wider-than-previewed patch sets as material bug candidates.
- Node filesystem behavior: official Node `fs.writeFile()` documentation warns that repeated writes without waiting are unsafe and that aborting a write is best-effort. Phase 6 should prefer implementation evidence that registry/checklist writes are sequenced through temp files, renames, backup/restore, or explicit rollback.

References:
- `https://git-scm.com/docs/git-worktree.html`
- `https://git-scm.com/docs/git-apply/2.19.0`
- `https://nodejs.org/api/fs.html`

## Evidence Baseline

### Workspace Registry And Workspace Teardown

- `docs/commands/new-workspace.md`, `docs/commands/remove-workspace.md`, `commands/blu-new-workspace.toml`, and `commands/blu-remove-workspace.toml` define the user-facing workspace create/remove contracts.
- `skills/blueprint-maintenance/SKILL.md` defines the shared high-risk maintenance posture, confirmation gates, host-global registry boundary, and no planned-only follow-up rule.
- `src/mcp/tools/workspace.ts` owns `blueprint_workspace_registry_get`, `blueprint_workspace_create`, `blueprint_workspace_remove`, registry parsing, registry locks, rollback, worktree/clone member creation, exact manifest verification, dirty repo checks, and teardown.
- Focused tests: `tests/new-workspace-metadata.test.ts`, `tests/remove-workspace-metadata.test.ts`, and `tests/workspace-tools.test.ts`.

### Project-Local Workstreams

- `docs/commands/workstreams.md` and `commands/blu-workstreams.toml` define project-local state, `ask_user` gates, waiting states, and the `statePatch` restoration contract.
- `skills/blueprint-maintenance/SKILL.md` forbids global workstream registries, `.planning/` ownership, and `workflow.use_workstreams` toggles.
- `src/mcp/tools/workspace.ts` owns `blueprint_workstream_list` and `blueprint_workstream_mutate`; `src/mcp/tools/state.ts` owns final `STATE.md` patching.
- Focused tests: `tests/workstreams-metadata.test.ts` and `tests/workstream-tools.test.ts`.

### Cleanup

- `docs/commands/cleanup.md` and `commands/blu-cleanup.toml` define protected-scope archival, report-before-mutate behavior, destination approval, overwrite approval, and active roadmap/current phase protections.
- `skills/blueprint-maintenance/SKILL.md` defines the shared cleanup flow on top of `blueprint_project_status`, `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update`.
- `src/mcp/tools/artifacts.ts` and `src/mcp/tools/state.ts` are the key runtime substrates for cleanup reports and routing updates. Cleanup itself is command-orchestrated filesystem mutation, so prompt/runtime contract drift matters.
- Focused test: `tests/cleanup-metadata.test.ts`. No dedicated cleanup tools test was identified in this repository snapshot.

### Advisory Update And Patch Replay

- `docs/commands/update.md`, `commands/blu-update.toml`, `src/mcp/tools/update.ts`, and `tests/update-tools.test.ts` define advisory update discovery, latest-version uncertainty, host-global saved checklist paths, and installed-extension read-only boundaries.
- `docs/commands/reapply-patches.md`, `commands/blu-reapply-patches.toml`, `src/mcp/tools/workspace.ts`, and `tests/patch-tools.test.ts` define host-global patch registry reads, patch manifests, dry-run preview, replay, audit recording, dirty tree blockers, compatibility checks, and installed-extension guards.
- `docs/ARTIFACT-SCHEMA.md` documents host-global `workspaces.json`, `updates/`, and `patches/` state under `~/.<host>/blueprint/`.
- Focused tests: `tests/update-metadata.test.ts`, `tests/update-tools.test.ts`, `tests/reapply-patches-metadata.test.ts`, and `tests/patch-tools.test.ts`.

## Existing Tests To Reuse

Prefer these targeted commands during execution:

```bash
npx tsx --test tests/new-workspace-metadata.test.ts tests/remove-workspace-metadata.test.ts tests/workspace-tools.test.ts
npx tsx --test tests/workstreams-metadata.test.ts tests/workstream-tools.test.ts
npx tsx --test tests/cleanup-metadata.test.ts
npx tsx --test tests/update-metadata.test.ts tests/update-tools.test.ts tests/reapply-patches-metadata.test.ts tests/patch-tools.test.ts
```

Run `npm ci` first only in a fresh worktree with missing `node_modules`. If a targeted command cannot run because of dependency, Docker, network, or environment issues, record the blocker honestly in the summary.

## Recommended Audit Shape

1. Workspace registry and create/remove: host-global registry reads/writes, locks, rollback, default workspace root, worktree/clone strategy, exact remove target, dirty-tree and drift blockers.
2. Workstreams: project-local index/state, waiting states, dirty-tree blockers, snapshot capture/restore, malformed timestamp/snapshot rejection, `blueprint_state_update` patch boundary.
3. Cleanup: current phase and active roadmap protection, saved closeout evidence, cleanup report-before-mutate, destination/overwrite confirmations, partial filesystem failure reporting.
4. Update and patch replay: advisory update/install read-only boundary, saved checklist paths, latest-version uncertainty, patch registry state, dry-run preview parity, selected patch ids, all-or-nothing replay, installed-extension target blockers.
5. Closeout: reconcile Phase 6 bug reports, update `docs/bugs/INDEX.md`, verify discovery-only boundaries, and prepare validation.

## Validation Architecture

Phase 6 validation is artifact and evidence based, not source mutation based.

- Each plan must preserve no-fix discipline: writes are limited to `docs/bugs/*.md`, `docs/bugs/INDEX.md`, and Phase 6 planning/execution artifacts under `.planning/phases/06-workspace-maintenance-audit/`.
- Each bug report must follow `docs/bugs/TEMPLATE.md` and cite concrete evidence from command outputs, test outputs, file paths, line-level references where useful, or docs/source contract mismatches.
- Each plan should run at least one targeted Phase 6 test command or document why it could not run.
- Workspace and patch runtime probes, if needed, must use disposable temp roots and `BLUEPRINT_GLOBAL_HOME` so installed-extension and real host-global state are not touched.
- Every plan must run `git status --short` before completion and document that no source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed extension, host-global, workspace, patch-registry, branch, PR, remote-service, or git-history changes were applied by the audit.
- If tests fail, classify whether the failure is defect evidence, an environment/dependency problem, or unrelated pre-existing breakage.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| A workspace or patch replay audit accidentally mutates real host-global state. | Plans require static review first and disposable `BLUEPRINT_GLOBAL_HOME` only when a behavior probe is materially needed. |
| Prompt contracts look safe but MCP rollback or locking behavior hides a defect. | Plan 01 reads the implementation and targeted tests, including injected failure and lock lease coverage, before conclusion. |
| Workstream state defects are mistaken for generic progress issues. | Plan 02 keeps project-local state, waiting states, malformed canonical files, and `statePatch` scope explicit. |
| Cleanup safety is judged only by metadata tests. | Plan 03 explicitly checks command/skill/report orchestration and records the absence of dedicated runtime tests as evidence if it creates risk. |
| Update and patch replay are blurred into one maintenance behavior. | Plan 04 separates advisory read-only update from high-risk patch replay and applies different defect thresholds. |

## Deferrals

- Repairing any discovered Phase 6 defect is deferred to a later repair milestone.
- Packaging, generated `dist`, hooks, install readiness, and cross-cut drift surfaces are deferred to Phases 7 and 8 unless directly needed as evidence for a Phase 6 defect.

## Research Complete

Phase 6 can be planned from this research, the Phase 6 context, and the existing Phase 1 bug-reporting harness.

