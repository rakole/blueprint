---
phase: 09-bug-index-priority-review
plan: 03
subsystem: repair-priority-batches
tags: [blueprint, repair-priority, repair-batches, verification-questions]
requires:
  - phase: 09-bug-index-priority-review
    provides: inventory review and duplicate-policy outcome
provides:
  - Repair-priority bands
  - Repair-batch summary
  - Verification-questions lane outcome
affects: [phase-9, docs/bugs, repair-queue]
tech-stack:
  added: []
  patterns: [priority-bands, batch-grouping, active-vs-history split]
key-files:
  created:
    - .planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md
    - .planning/phases/09-bug-index-priority-review/09-03-SUMMARY.md
  modified:
    - docs/bugs/INDEX.md
key-decisions:
  - "BPBUG-005 and BPBUG-001 belong in Now because they offer the highest current safety and leverage gains."
  - "No open verification questions remain; the unresolved inventory is confirmed-bug work, not low-confidence follow-up."
patterns-established:
  - "Repair priority is a separate planning lens layered over the durable bug board, not a replacement for severity or confidence."
requirements-completed: [REPAIR-01, REPAIR-02, REPAIR-03, NFIX-01, NFIX-02, NFIX-03]
duration: 8min
completed: 2026-05-02T14:44:29Z
---

# Phase 9 Plan 03: Repair Priority, Batches, And Open Questions Summary

**Plan 03 turned the reconciled inventory into a repair-planning view with `Now` / `Next` / `Later` bands, batch-level repair lanes, a repaired/history subsection for BPBUG-004, and an explicit no-open-questions outcome.**

## Priority Bands Chosen

- `Now`
  - `BPBUG-005` because it hardens a shared repo-root safety boundary used by
    multiple MCP tool families.
  - `BPBUG-001` because it closes durable-evidence gaps in high-risk ship and
    undo workflows.
- `Next`
  - `BPBUG-002` because the risk is destructive-flow regression coverage rather
    than an already-observed escape in the current tree.
- `Later`
  - `BPBUG-003` because the runtime already behaves correctly and the remaining
    defect is shared documentation drift.
- `Repaired / History`
  - `BPBUG-004` remains visible as verified historical evidence and is not
    ranked beside active candidates.

## Repair Batches Chosen

- `Runtime and safety fixes`
  - `BPBUG-005`
- `Contract and test hardening`
  - `BPBUG-001`, `BPBUG-002`
- `Docs synchronization cleanup`
  - `BPBUG-003`

## Verification Questions / Follow-Ups

- `No open verification questions remain.`
- The remaining inventory items are all confirmed bugs or repaired/history
  evidence rather than low-confidence leads.

## Requirement Coverage

- `REPAIR-01` - The index and repair queue now summarize the highest-priority
  repair candidates in `Now`, `Next`, and `Later` bands.
- `REPAIR-02` - Priority and batch views keep repair-ready evidence,
  validation surfaces, and current disposition visible.
- `REPAIR-03` - Open verification questions are separated from confirmed bugs,
  with an explicit no-open-question result.
- `NFIX-01` - No source, manifest, skill, test, generated-asset, or runtime
  repair was applied.
- `NFIX-02` - No temporary probes or new evidence files were needed.
- `NFIX-03` - Git-status boundary evidence remained explicit.

## Decision Coverage

- `D-01` - Priority remained separate from severity and confidence.
- `D-02` - Active candidates were split from repaired/history evidence.
- `D-03` - Tie-breaking favored cross-cutting leverage and recurrence risk.
- `D-04` - The final bands are `Now`, `Next`, and `Later`.
- `D-09` - Repair work is summarized as batches rather than only a flat bug
  list.
- `D-10` - Batches are grouped by shared repair direction and validation
  surface.
- `D-11` - The current queue uses runtime and safety, contract and test, and
  docs synchronization lanes.
- `D-12` - BPBUG-004 stays visible but separate from active repair work.
- `D-13` - Verification questions have their own lane.
- `D-14` - No feature ideas or confirmed bugs were mixed into the follow-up
  lane.
- `D-15` - Open-question tracking did not block progress because no material
  evidence gaps remained.
- `D-16` - The queue structure is ready to map later into issues or projects
  while preserving the confirmed-bug versus follow-up split.

## Verification

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| Priority and repaired/history view | `rg -n "Repair Priority|Now|Next|Later|Repair Leverage|Validation Surface|Repaired / History|BPBUG-00[1-9]" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md` | pass | The index and repair queue now include all required priority-band and repaired/history markers. |
| Repair batches | `rg -n "Repair Batches|Runtime and safety|Contract and test|Docs synchronization|Shared Repair Direction|Validation Surface" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md` | pass | The queue contains the three seeded repair lanes grouped by repair direction and validation surface. |
| Verification questions lane | `rg -n "Verification Questions|Follow-Ups|REPAIR-01|REPAIR-02|REPAIR-03|D-01|D-02|D-03|D-04|D-09|D-10|D-11|D-12|D-13|D-14|D-15|D-16|git status --short" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md .planning/phases/09-bug-index-priority-review/09-03-SUMMARY.md` | pass | The no-open-question lane and decision coverage markers are present. |
| Discovery-only boundary | `git status --short` | pass | Intentional writes at the end of Plan 03 were limited to `docs/bugs/` and `.planning/phases/09-bug-index-priority-review/`. |

## `git status --short`

```text
 M docs/bugs/BPBUG-004-stale-built-bundle-omits-audit-fix-generated-assets.md
 M docs/bugs/INDEX.md
?? .planning/phases/09-bug-index-priority-review/09-01-SUMMARY.md
?? .planning/phases/09-bug-index-priority-review/09-02-SUMMARY.md
?? .planning/phases/09-bug-index-priority-review/09-03-SUMMARY.md
?? .planning/phases/09-bug-index-priority-review/09-INVENTORY-REVIEW.md
?? .planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md
```

Allowed-write analysis: all writes remained inside `docs/bugs/` and
`.planning/phases/09-bug-index-priority-review/`.
