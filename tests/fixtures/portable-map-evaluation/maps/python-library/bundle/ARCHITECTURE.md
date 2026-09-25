# Architecture

## Purpose

The implementation separates immutable domain shapes in models.py, canonicalization in normalization.py, input and lifecycle checks in validation.py, configurable due and transition policy in policy.py, orchestration in service.py, and persistence behind an InspectionStore protocol. InspectionRepository translates adapter lookup and replacement failures into a domain RecordNotFoundError. Scoring, filtering, ordering, serialization, reporting, and CLI/configuration remain focused collaborators.

## Service boundary

InspectionService owns the registered asset map and coordinates repository access, the injected policy and clock, validation, ordered search, risk assessment, and summary aggregation. It creates inspection identifiers from normalized asset id, inspection date, and the per-asset sequence.

## Adapter boundary

InspectionRepository depends on the InspectionStore protocol rather than a concrete adapter. InMemoryInspectionStore keeps records in a dictionary; JsonlInspectionStore reads and rewrites JSON Lines, using a temporary file, flush/fsync, and os.replace for replacement.

## Evidence

- `src/harborlog/service.py`
- `src/harborlog/repository.py`
- `src/harborlog/storage.py`
- `src/harborlog/policy.py`
- `src/harborlog/validation.py`
