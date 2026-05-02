---
phase: 08-cross-cut-drift-and-regression-gaps
plan: 01
subsystem: cross-layer-drift
tags: [blueprint, drift-matrix, docs, runtime, tests, generated-assets]
requires:
  - phase: 08-cross-cut-drift-and-regression-gaps
    provides: Phase 8 context, research, and pattern map
provides:
  - Cross-layer drift matrix artifact
  - Confirmed carry-forward classification for BPBUG-001 and BPBUG-003
  - Explicit no-new-bug outcome for Phase 8 Plan 01
affects: [phase-8, docs/bugs, planning]
tech-stack:
  added: []
  patterns: [cross-layer drift matrix, materiality threshold, discovery-only carry-forward]
key-files:
  created:
    - .planning/phases/08-cross-cut-drift-and-regression-gaps/08-DRIFT-MATRIX.md
    - .planning/phases/08-cross-cut-drift-and-regression-gaps/08-01-SUMMARY.md
key-decisions:
  - "Plan 01 found no new material cross-layer drift beyond the already-open BPBUG-001 and BPBUG-003 findings."
patterns-established:
  - "Cross-cut drift plans should consolidate existing defects when the current tree still shows them, rather than filing duplicate bug reports."
requirements-completed: [CLASS-04, EVID-04, COV-07, NFIX-01, NFIX-02, NFIX-03]
duration: 14min
completed: 2026-05-02T11:34:36Z
---

# Phase 8 Plan 01: Cross-Layer Contract Drift Matrix Summary

**Plan 01 built the Phase 8 drift matrix, re-checked the shared docs, manifests, skills, runtime references, focused contract tests, and generated-asset surfaces, and found no new material drift beyond the existing BPBUG-001 and BPBUG-003 defects already recorded earlier in the milestone.**

## Accomplishments

- Created `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-DRIFT-MATRIX.md` with the required surface-family matrix and decision coverage for `D-01`, `D-02`, `D-03`, `D-04`, `D-17`, `D-18`, and `D-20`.
- Confirmed router/readiness, lifecycle, roadmap/capture/lightweight execution, and current packaging/generated-asset surfaces are aligned in the current tree.
- Confirmed the review/impact/shipping family still carries the already-known BPBUG-001 report-contract drift and the shared MCP docs/tests family still carries the already-known BPBUG-003 docs/runtime mismatch.
- Avoided duplicate bug creation because the current evidence cleanly mapped back to existing reports instead of a new Phase 8 defect.

## Verification

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| Contract drift regression suite | `npx tsx --test tests/command-contract-docs.test.ts tests/command-catalog.test.ts tests/extension-runtime-contracts.test.ts` | pass | 103 tests passed on 2026-05-02, including implemented-only routing, runtime-contract resource, and command-catalog alignment checks. |
| Drift matrix structure | `rg -n "Surface Family|Expected Contract|Observed Evidence|Risk Tag|Disposition|Related Bug Or Note" .planning/phases/08-cross-cut-drift-and-regression-gaps/08-DRIFT-MATRIX.md` | pass | The matrix contains the required headers and surface-family rows. |
| Carry-forward drift evidence | `rg -n "BPBUG-001|BPBUG-003|installProvenance|savedPaths|placeholderSignals" .planning/phases/08-cross-cut-drift-and-regression-gaps/08-DRIFT-MATRIX.md docs/MCP-TOOLS.md src/mcp/artifact-contracts/index.ts src/mcp/tools/update.ts` | pass | Existing drift evidence still points to the already-open BPBUG-001 and BPBUG-003 defects. |
| Discovery-only boundary | `git status --short` | pass | Plan-owned writes remain inside `.planning/` during this plan; no source, manifest, skill, test, generated-asset, runtime, branch, PR, remote, or host-global fix was applied. |

## Bug Outcome

- No new Phase 8 bug report was created by Plan 01.
- Existing cross-layer drift remains tracked by:
  - `BPBUG-001` for under-specified ship and undo report contracts.
  - `BPBUG-003` for stale shared MCP update-tool docs.

## Decisions Made

- `D-01` through `D-04` were satisfied by using one matrix grouped by surface family and by limiting the re-check to the shared layers touched by cross-cut evidence.
- `D-17` kept the evidence bar high enough to reject duplicate or wording-only drift findings.
- `D-18` preserved the discovery-only boundary.
- `D-20` kept follow-up routing inside existing implemented commands and bug reports rather than inventing planned-only remediation.

## Issues Encountered

- The local `gsd-sdk` executable still does not expose the workflow `query` helpers referenced by the skill adapter, so Plan 01 executed directly from the checked-in Phase 8 artifacts.

## Self-Check: PASSED

- `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-DRIFT-MATRIX.md` exists.
- The matrix records the required surface families and decision markers.
- No duplicate Phase 8 drift bug was filed when existing bug reports already covered the current mismatch.
