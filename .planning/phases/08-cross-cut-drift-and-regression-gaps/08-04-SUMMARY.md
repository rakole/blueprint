---
phase: 08-cross-cut-drift-and-regression-gaps
plan: 04
subsystem: bug-clusters
tags: [blueprint, bug-index, clusters, related-bugs, no-duplicates]
requires:
  - phase: 08-cross-cut-drift-and-regression-gaps
    plan: 03
    provides: Drift matrix, regression ledger, concern triage, and current bug inventory
provides:
  - Root-cause cluster board in docs/bugs/INDEX.md
  - Related-bug cluster notes across BPBUG-001 through BPBUG-005
  - Explicit no-duplicate outcome for Phase 8 clustering
affects: [phase-8, docs/bugs]
tech-stack:
  added: []
  patterns: [root-cause clustering, cluster-anchor notes, duplicate restraint]
key-files:
  created:
    - .planning/phases/08-cross-cut-drift-and-regression-gaps/08-04-SUMMARY.md
  modified:
    - docs/bugs/INDEX.md
    - docs/bugs/BPBUG-001-ship-undo-report-contracts-underconstrained.md
    - docs/bugs/BPBUG-002-cleanup-lacks-behavioral-regression-coverage.md
    - docs/bugs/BPBUG-003-mcp-tools-docs-stale-update-return-shapes.md
    - docs/bugs/BPBUG-004-stale-built-bundle-omits-audit-fix-generated-assets.md
key-decisions:
  - "Phase 8 added cluster-level repair context without collapsing any existing bug into a duplicate."
patterns-established:
  - "Cluster work should add practical preventive-repair context while preserving one canonical report per distinct defect and repair path."
requirements-completed: [CLASS-04, EVID-04, COV-07, COV-08, NFIX-01, NFIX-02, NFIX-03]
duration: 8min
completed: 2026-05-02T11:34:36Z
---

# Phase 8 Plan 04: Root-Cause Cluster And Related-Bug Linkage Summary

**Plan 04 added a root-cause cluster board to the bug index, linked BPBUG-001 through BPBUG-005 to their practical cluster anchors, and confirmed that no current bug should be marked duplicate.**

## Accomplishments

- Added `## Root Cause Clusters` to `docs/bugs/INDEX.md` with the required cluster labels for under-specified contracts, missing regression guards, docs/runtime synchronization, generated-asset freshness, and the new repo-root validation gap.
- Updated `## Related Bugs` in BPBUG-001 through BPBUG-005 so each report now records its cluster anchor without changing severity, status, evidence, or no-fix language.
- Kept the Phase 8 cross-layer drift rollup explicit as `none new in Phase 8` instead of inventing a redundant synthetic defect.
- Confirmed that none of the current bug reports share the same defect and same repair path, so no bug was reclassified as `duplicate`.

## Verification

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| Cluster section present | `rg -n "## Root Cause Clusters|under-specified contracts|missing regression guards|docs/runtime synchronization|generated-asset freshness|repo-root validation gaps" docs/bugs/INDEX.md` | pass | The bug index now contains the cluster board with the required labels. |
| Related-bug cluster notes | `rg -n "Related Bugs|cluster" docs/bugs/BPBUG-*.md` | pass | BPBUG-001 through BPBUG-005 now each include a cluster note in `## Related Bugs`. |
| Duplicate restraint | `rg -n "status: duplicate" docs/bugs/BPBUG-*.md` | pass | No current bug report was reclassified as a duplicate. |
| Discovery-only boundary | `git status --short` | pass | Plan-owned changes remain limited to `docs/bugs/` plus the Phase 8 summary artifact. |

## Decisions Made

- `D-13` linked BPBUG-001 through BPBUG-005 into practical cluster anchors for later repair planning.
- `D-14` used concrete preventive-repair labels instead of abstract taxonomy.
- `D-15` kept every current bug distinct because no two reports share the same defect and same repair path.
- `D-16` recorded cluster context in both `docs/bugs/INDEX.md` and the affected reports.
- `D-02`, `D-05`, `D-10`, and `D-17` prevented the cluster work from inventing new defects or diluting evidence quality.

## Lower-Risk Notes Carried Forward

- Large-repo performance and large-diff processing remain Phase 9 tuning notes rather than new bug reports.
- The deliberate `BLUEPRINT_TEST_*` workspace env-toggle path remains a low-signal risk note instead of a confirmed defect.

## Self-Check: PASSED

- `docs/bugs/INDEX.md` contains the cluster board.
- BPBUG-001 through BPBUG-005 keep their original evidence and no-fix sections intact.
- No bug report was marked duplicate.
