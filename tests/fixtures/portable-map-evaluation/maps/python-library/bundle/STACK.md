# Stack

## Purpose

HarborLog is a Python 3.11+ source-only library with no declared runtime dependencies. Its public package API exposes immutable inspection models, an application service, policy and query types, clock implementations, repository and storage adapters, configuration loading, and domain exceptions. A small argparse entry point reads TOML policy configuration and prints selected limits.

## Runtime and packaging

pyproject.toml declares the `harborlog` package, version 0.1.0, Python >=3.11, and an empty dependency list. The fixture notes that it relies on standard-library APIs only.

## Public surfaces

src/harborlog/__init__.py re-exports the domain models, policy, query, service, repository, both stores, clocks, configuration loader, and expected errors. `python -m harborlog` delegates to `cli.main`; the CLI requires `--config` and currently exposes a `policy` subcommand.

## Evidence

- `pyproject.toml`
- `AGENTS.md`
- `README.md`
- `src/harborlog/__init__.py`
- `src/harborlog/__main__.py`
- `src/harborlog/cli.py`
