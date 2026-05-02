---
phase: 06-workspace-maintenance-audit
plan: 04
subsystem: update-and-patch-replay
tags: [blueprint, update, patch-replay, host-global-state, advisory-maintenance]
requires:
  - phase: 01-bug-taxonomy-and-reporting-harness
    provides: bug report template, bug index, discovery-only reporting rules
  - phase: 06-workspace-maintenance-audit
    plan: 03
    provides: cleanup audit baseline and Phase 6 continuity
provides:
  - Advisory update and patch replay audit evidence
  - BPBUG-003 covering stale MCP update-tool docs
  - Focused update and patch regression test results
affects: [phase-6, update, reapply-patches, docs/bugs]
tech-stack:
  added: []
  patterns: [shared-doc drift audit, host-global maintenance verification]
key-files:
  created:
    - .planning/phases/06-workspace-maintenance-audit/06-04-SUMMARY.md
    - docs/bugs/BPBUG-003-mcp-tools-docs-stale-update-return-shapes.md
  modified:
    - docs/bugs/INDEX.md
key-decisions:
  - "BPBUG-003 was recorded because `docs/MCP-TOOLS.md` still documents stale update-tool return shapes even though the live runtime, command docs, and focused tests expect richer fields."
  - "No patch replay bug was recorded because command contracts, runtime behavior, and focused patch tests aligned on preview-before-replay, compatibility gating, and host-global audit recording."
patterns-established:
  - "Shared MCP tool docs need the same regression attention as command docs when tool result shapes evolve; otherwise prompt contracts and runtime usage drift even while behavior tests stay green."
requirements-completed: [COV-05, NFIX-01, NFIX-02, NFIX-03]
duration: 12min
completed: 2026-05-02T09:10:28Z
---

# Phase 6 Plan 04: Advisory Update And Patch Replay Summary

**The update and patch replay runtimes are largely aligned and well covered, but the shared MCP docs still advertise stale update-tool return shapes. Plan 04 therefore recorded BPBUG-003 and found no patch replay defect.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-02T08:58:30Z
- **Completed:** 2026-05-02T09:10:28Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Compared `docs/commands/update.md`, `docs/commands/reapply-patches.md`, `commands/blu-update.toml`, `commands/blu-reapply-patches.toml`, `skills/blueprint-maintenance/SKILL.md`, `docs/MCP-TOOLS.md`, and `docs/RUNTIME-REFERENCE.md` against the Phase 6 update and patch replay contracts.
- Audited `src/mcp/tools/update.ts` and the patch replay implementation in `src/mcp/tools/workspace.ts` for installed-extension read-only boundaries, host-global update persistence, `dryRun` preview semantics, compatibility mismatches, installed-extension target guards, and host-global replay audit recording.
- Ran the focused update and patch metadata plus behavior suites; all 23 tests passed.
- Recorded `docs/bugs/BPBUG-003-mcp-tools-docs-stale-update-return-shapes.md` and added `BPBUG-003` to `docs/bugs/INDEX.md` because the shared MCP docs no longer match the live update tool results.

## Task Commits

Task 1 and Task 2 confirmed the live update and patch runtimes. Task 3 produced one documentation bug report because `docs/MCP-TOOLS.md` has drifted from the shipped update tool schema.

## Files Created/Modified

- `docs/bugs/BPBUG-003-mcp-tools-docs-stale-update-return-shapes.md` - Records the confirmed update-tool documentation drift.
- `docs/bugs/INDEX.md` - Adds the `BPBUG-003` triage row.
- `.planning/phases/06-workspace-maintenance-audit/06-04-SUMMARY.md` - Records Plan 04 audit evidence and bug outcome.

## Evidence Reviewed

| Surface | Evidence |
|---------|----------|
| Update command/docs/manifests | `docs/commands/update.md` and `commands/blu-update.toml` require read-only extension inspection, host-global checklist persistence, `update-mode-gate`, restart guidance, and richer update result fields such as provenance, lookup status, and saved paths. |
| Patch command/docs/manifests | `docs/commands/reapply-patches.md` and `commands/blu-reapply-patches.toml` consistently require `preflight -> preview -> confirm -> replay -> record`, dirty-tree and compatibility blockers, host-global patch state, and installed-extension target guards. |
| Runtime implementation | `src/mcp/tools/update.ts` returns rich `UpdateCheckResult` and `UpdatePlanResult` objects, while `src/mcp/tools/workspace.ts` enforces clean-tree, compatibility, `dryRun` preview, conflict reporting, and audit recording for patch replay. |
| Tests | `tests/update-tools.test.ts` and `tests/patch-tools.test.ts` behaviorally cover update persistence, malformed metadata fallback, restart guidance, patch replay preview, compatibility mismatch, dirty-tree blocking, conflicts, and audit recording. |
| Shared MCP docs | `docs/MCP-TOOLS.md` still lists stale update return keys, creating a drift defect even though the runtime and focused tests are green. |

## Verification

- `npx tsx --test tests/update-metadata.test.ts tests/update-tools.test.ts tests/reapply-patches-metadata.test.ts tests/patch-tools.test.ts` passed: 23 tests, 23 pass, 0 fail.
- `rg -n "blueprintUpdateCheck|blueprintUpdatePlan|blueprintPatchList|blueprintPatchReapply|blueprintPatchRecord|dryRun|installed-extension-target|requiresRestart|update-mode-gate|reapply-patches-confirmation" src/mcp/tools/update.ts src/mcp/tools/workspace.ts docs/commands commands skills docs/MCP-TOOLS.md docs/RUNTIME-REFERENCE.md tests` found aligned update and patch evidence plus the stale shared MCP rows for update.
- `rg -n "discovery_phase: 6|No source, manifest, skill, test, generated asset, or runtime behavior fix was applied" docs/bugs/BPBUG-*.md` confirmed both new Phase 6 bug files and the no-fix sentence.
- `git status --short` before summary creation showed only allowed Phase 6 execution artifacts in `docs/bugs/` and `.planning/phases/06-workspace-maintenance-audit/`.

## Bug Reports

- `BPBUG-003` - MCP tool docs advertise stale return shapes for update tools.

## Deviations from Plan

None in audit scope. The update and patch behavior suites were available and passed, so no disposable probes were needed.

## Issues Encountered

- `gsd-sdk query ...` remains unavailable in this checkout, so plan execution continued from the checked-in `.planning/` artifacts.

## Known Stubs

None found for patch replay. The only confirmed Plan 04 defect is the shared update-tool documentation drift captured in `BPBUG-003`.

## Threat Flags

No live update or patch replay mutation was performed against the user's real extension or repo state. This plan introduced no new network endpoints, auth paths, source changes, host-global runtime mutations outside disposable tests, branch mutations, or git-history changes.

## Next Phase Readiness

Plan 05 can reconcile the Phase 6 bug index and no-fix boundary with `BPBUG-002` and `BPBUG-003` now recorded as the real findings from this phase.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/06-workspace-maintenance-audit/06-04-SUMMARY.md`.
- `BPBUG-003` exists and is indexed in `docs/bugs/INDEX.md`.
- Plan-owned changes stay within `docs/bugs/` and `.planning/phases/06-workspace-maintenance-audit/`.

---
*Phase: 06-workspace-maintenance-audit*
*Completed: 2026-05-02T09:10:28Z*
