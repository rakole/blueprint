# Phase 9 Inventory Review

Discovery-only artifact. This inventory reconciles the current `docs/bugs/`
board against the five real BPBUG reports before duplicate review or repair
prioritization.

`BPBUG-000` remains **illustrative only** and is excluded from real defect
totals and repair-priority ranking.

| Bug ID | Index Status | Report Status | Severity | Confidence | Surface | Discovery Phase | Repair-Readiness Evidence | Current Disposition | Required Index Or Report Update |
|--------|--------------|---------------|----------|------------|---------|-----------------|---------------------------|---------------------|---------------------------------|
| BPBUG-001 | `new` | repair-ready | medium | confirmed | MCP tool | 5 | Report already contains `## Evidence`, `## Verification Steps`, `## Suggested Fix Direction`, `## Uncertainty`, and `## Related Bugs`; the index row matches the report. | active candidate | none beyond later duplicate/priority views |
| BPBUG-002 | `new` | repair-ready | medium | confirmed | tests | 6 | Report already contains the required repair-ready sections and points to the exact cleanup contract and missing regression coverage evidence. | active candidate | none beyond later duplicate/priority views |
| BPBUG-003 | `new` | repair-ready | low | confirmed | docs | 6 | Report already contains the required repair-ready sections and cites the stale MCP-doc rows, live runtime types, and focused tool tests. | active candidate | none beyond later duplicate/priority views |
| BPBUG-004 | `verified` after reconciliation | repair-ready historical record | high | confirmed | generated assets | 7 | Quick task [`260502-bpbug-004-dist-refresh`](../../quick/260502-bpbug-004-dist-refresh/260502-bpbug-004-dist-refresh-SUMMARY.md) records repair commit `350e87a`, and Phase 7 validation rerun records `27 passing tests, 0 failures` in [`07-VALIDATION.md`](../../07-host-packaging-build-hooks-audit/07-VALIDATION.md). | repaired/history | update index status to `verified`, update report `status: verified`, and add a `## Current Status` section preserving discovery evidence |
| BPBUG-005 | `new` | repair-ready | medium | confirmed | cross-cutting | 8 | Report already contains the required repair-ready sections and cites both source inspection and the disposable fake-`.git` probe. | active candidate | none beyond later duplicate/priority views |

## Inventory Notes

- `BPBUG-001` through `BPBUG-005` remain the complete real defect inventory for
  this milestone.
- `BPBUG-004` is the only report whose current disposition changed after the
  original discovery phase; it now belongs in a repaired/history lane instead
  of the active-candidate queue.
- No contradictory status evidence was found. The quick-task summary and Phase 7
  validation rerun both support the `verified` historical-state update for
  `BPBUG-004`.
