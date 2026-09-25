# Structure

## Purpose

The repository has a src/harborlog package, a tests package, two TOML configuration samples, and small project metadata and documentation files. Package modules are single-purpose: models and errors define domain vocabulary; normalization and validation guard inputs; policy, scoring, filters, ordering, and reporting derive decisions or views; serialization and storage persist records; repository and service provide application coordination; cli and __main__ provide the command boundary.

## Domain and decision modules

models.py contains Severity and InspectionStatus enums plus frozen Asset, Finding, InspectionRequest, Inspection, RiskAssessment, and InspectionSummary dataclasses. policy.py owns due-date, stale-open, close, and waive decisions; scoring.py computes a capped risk score and band from finding severities and schedule state.

## Data flow

Requests enter InspectionService, are normalized and validated, become Inspection records, and are inserted through InspectionRepository. Search applies InspectionQuery predicates before newest-first ordering. Assessment and summary read repository records and registered assets, while serialization maps nested inspections to JSON-compatible dictionaries for the JSONL store.

## Evidence

- `src/harborlog/models.py`
- `src/harborlog/policy.py`
- `src/harborlog/scoring.py`
- `src/harborlog/service.py`
- `src/harborlog/serialization.py`
- `src/harborlog/storage.py`
- `src/harborlog/filters.py`
- `src/harborlog/ordering.py`
