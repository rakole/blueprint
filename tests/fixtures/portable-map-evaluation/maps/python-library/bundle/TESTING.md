# Testing

## Purpose

The tests are unittest-based and exercise the public behavior across the CLI, immutable models, reporting, repository adapters, service orchestration, and validation. The service tests cover opening, assessing, searching, closing, critical-finding rejection, and summary counts; adapter tests cover JSONL round trips and duplicate identifiers; validation tests cover canonicalization, duplicate finding rejection, and future dates.

## Behavioral coverage

test_service.py drives InspectionService with an InMemoryInspectionStore, InspectionPolicy, and FrozenClock, then verifies normalized requests, overdue risk, query selection, lifecycle revision, critical close protection, and summary counts. test_validation.py checks asset canonicalization and request constraints.

## Boundary coverage

test_repository.py verifies nested Finding persistence through JsonlInspectionStore and duplicate rejection in the in-memory adapter. test_cli.py verifies TOML loading and policy output; test_reporting.py verifies operator strings; test_models.py verifies unresolved finding detection and dataclass immutability.

## Evidence

- `tests/test_service.py`
- `tests/test_validation.py`
- `tests/test_repository.py`
- `tests/test_cli.py`
- `tests/test_reporting.py`
- `tests/test_models.py`
- `AGENTS.md`
- `README.md`
