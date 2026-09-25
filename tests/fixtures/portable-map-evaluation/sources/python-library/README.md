# HarborLog synthetic fixture

HarborLog is a small, invented Python library for recording safety inspections
of harbor equipment. It models assets, inspection findings, policy checks,
risk assessments, and a replaceable persistence adapter. The package is a
source-only fixture for repository understanding exercises; it is intentionally
compact and makes no claim to represent a production safety system or any
real maritime regulation.

The package uses only Python's standard library (Python 3.11 or newer). Run
the baseline from this directory with bytecode disabled so the fixture stays
free of generated files:

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src python3 -m unittest discover -s tests -v
```

The command exercises the in-memory service, JSON-lines adapter, validation and
policy boundaries, reporting, configuration loading, and the small CLI entry
point. `config/default.toml` is a sample operational policy and
`config/test.toml` is a deliberately shorter policy used by CLI tests.

HarborLog keeps domain decisions in `policy.py` and `validation.py`, data
shapes in `models.py`, orchestration in `service.py`, and storage mechanics in
`storage.py`. The other modules provide focused transforms, queries, ordering,
serialization, scoring, and reporting surfaces so the fixture has realistic
cross-module navigation without generated padding.
