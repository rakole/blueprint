# Phase 6: Workspace Maintenance Audit - Pattern Map

**Mapped:** 2026-05-02
**Purpose:** Give Phase 6 executors concrete analogs for auditing workspace, workstream, cleanup, update, and patch-replay defects without applying fixes.

## Target Surfaces And Closest Analogs

| Planned Surface | Role | Closest Existing Analog | Reuse Pattern |
|-----------------|------|-------------------------|---------------|
| `docs/bugs/BPBUG-###-*.md` | One defect report per confirmed or likely Phase 6 finding. | `docs/bugs/BPBUG-001-ship-undo-report-contracts-underconstrained.md`, `docs/bugs/BPBUG-000-illustrative-example.md`, and `docs/bugs/TEMPLATE.md` | Copy the required report shape, replace prior-phase language with real Phase 6 evidence, and preserve `No Fix Applied`. |
| `docs/bugs/INDEX.md` | Cross-phase triage board and slice coverage ledger. | Phase 1 through Phase 5 rows in `docs/bugs/INDEX.md` | Add real bug rows and update the Phase 6 slice row without changing vocabulary or table schema. |
| Workspace create/remove flows | Host-global registry, workspace manifest, worktree/clone creation, exact teardown. | `src/mcp/tools/workspace.ts`, workspace metadata tests, workspace tools tests | Trace docs/manifests/skill into `blueprint_workspace_registry_get`, `blueprint_workspace_create`, and `blueprint_workspace_remove`; inspect registry locks, temp/backup writes, rollback, exact manifest verification, dirty-tree checks, and worktree force behavior. |
| Workstream flows | Project-local workstream state and resume snapshots. | `src/mcp/tools/workspace.ts`, `src/mcp/tools/state.ts`, workstream metadata/tests | Verify `.blueprint/workstreams/WORKSTREAMS.md`, per-stream `state.json`, waiting states, malformed canonical state rejection, dirty-tree active transitions, and narrow `statePatch` restoration. |
| Cleanup flow | Protected-scope archival and durable cleanup report. | `commands/blu-cleanup.toml`, `docs/commands/cleanup.md`, `skills/blueprint-maintenance/SKILL.md`, `src/mcp/tools/artifacts.ts` | Audit prompt/runtime contract order: project status, roadmap, artifact list, digest, report write, confirmation, filesystem mutation, optional state update. Treat missing runtime test coverage as a possible test-gap finding only when risk is concrete. |
| Advisory update flow | Installed-extension read-only status and saved checklist. | `src/mcp/tools/update.ts`, `src/mcp/runtime-host.ts`, update tests | Verify extension path discovery stays read-only, latest-version uncertainty is honest, saved paths stay under `~/.<host>/blueprint/updates/`, write failures degrade to manual fallback, and restart guidance is always present. |
| Patch replay flow | Host-global patch registry, preview/replay, and audit. | `src/mcp/tools/workspace.ts`, patch metadata/tests, Git apply reference behavior | Verify selected patch ids, dry-run preview parity, dirty-tree and compatibility blockers, installed-extension guard, all-or-nothing replay, and audit writes under `~/.<host>/blueprint/patches/`. |

## Bug Report Authoring Pattern

When a Phase 6 defect is confirmed or likely:

1. Choose the next real id from `docs/bugs/INDEX.md`, currently `BPBUG-002` unless an earlier Phase 6 plan already created it.
2. Create `docs/bugs/BPBUG-###-short-slug.md` with frontmatter matching `docs/bugs/TEMPLATE.md`.
3. Include evidence as a table with exact file paths, command/test outputs, and contract mismatches.
4. Include verification steps a later fixer can run or inspect.
5. Include `No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.`
6. Update the bug index row and Phase 6 slice coverage row.

If no defect is found in a plan's assigned surface, do not create a fake bug. Record the no-defect result in the plan summary and let Plan 05 update the final Phase 6 slice row.

## Test And Evidence Pattern

| Evidence Type | Preferred Command Or Inspection |
|---------------|----------------------------------|
| Workspace create/remove | `npx tsx --test tests/new-workspace-metadata.test.ts tests/remove-workspace-metadata.test.ts tests/workspace-tools.test.ts` |
| Workstreams | `npx tsx --test tests/workstreams-metadata.test.ts tests/workstream-tools.test.ts` |
| Cleanup | `npx tsx --test tests/cleanup-metadata.test.ts` plus targeted contract reads of `commands/blu-cleanup.toml`, `docs/commands/cleanup.md`, and `skills/blueprint-maintenance/SKILL.md` |
| Update and patch replay | `npx tsx --test tests/update-metadata.test.ts tests/update-tools.test.ts tests/reapply-patches-metadata.test.ts tests/patch-tools.test.ts` |
| Discovery-only boundary | `git status --short` |

## No-Fix Pattern

Phase 6 execution must not edit:

- `src/**`
- `commands/**`
- `skills/**`
- `agents/**`
- `tests/**`
- `dist/**`
- `.blueprint/**`
- installed extension directories
- host-global `~/.gemini/blueprint/**`, `~/.tabnine/blueprint/**`, or real patch/workspace registries
- workspace directories, branches, PRs, git history, or remote services

Allowed Phase 6 execution writes are:

- `docs/bugs/*.md`
- `docs/bugs/INDEX.md`
- `.planning/phases/06-workspace-maintenance-audit/*-SUMMARY.md`
- follow-on `.planning/STATE.md` or `.planning/ROADMAP.md` updates made by GSD workflow bookkeeping

## Pattern Mapping Complete

