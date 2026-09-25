# Concerns

## Purpose

The fixture is intentionally compact and source-only. The service keeps registered assets in process memory, while the JSONL adapter rewrites its complete record file for each insert or replacement; there is no concurrency, migration, transaction, or remote persistence layer shown. The map covers the frozen 30-file source snapshot and its checked-in tests, so behavior outside those files is not inferred.

## Operational boundaries

InspectionService must register an asset before opening or assessing its inspections, and its asset registry is not persisted by JsonlInspectionStore. Jsonl writes use an atomic replace but the source does not show locking or multi-process coordination.

## Policy and coverage limits

Closing is blocked by unresolved critical findings when configured; waiving requires an open inspection with no unresolved findings. The map does not claim production safety-regulation compliance, and the frozen source contains no deployment, packaging build, database, network, or performance specification.

## Evidence

- `README.md`
- `AGENTS.md`
- `src/harborlog/service.py`
- `src/harborlog/storage.py`
- `src/harborlog/policy.py`
- `src/harborlog/validation.py`
