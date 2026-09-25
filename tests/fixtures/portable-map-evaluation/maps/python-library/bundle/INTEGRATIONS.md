# Integrations

## Purpose

External integration is deliberately small. TOML files feed AppConfig and InspectionPolicy through the standard-library tomllib loader; the CLI prints selected policy values. The storage abstraction supports either process-local memory or a JSON Lines file path, and JSON serialization preserves inspection dates, statuses, findings, notes, closed dates, and revisions. No third-party package or network integration is declared.

## Configuration

load_config reads a binary TOML stream, lowercases category keys, applies defaults, and rejects non-positive day limits. config/default.toml supplies 30-day open, 180-day standard due, critical resolution, and category overrides; config/test.toml supplies shorter CLI-test values.

## Persistence formats

JsonlInspectionStore treats a missing path as an empty store, decodes each nonblank line with inspection_from_dict, and writes sorted-key JSON records one per line through an atomic temporary-file replacement. The repository keeps callers independent of that file format.

## Evidence

- `src/harborlog/config.py`
- `config/default.toml`
- `config/test.toml`
- `src/harborlog/cli.py`
- `src/harborlog/storage.py`
- `src/harborlog/serialization.py`
- `pyproject.toml`
