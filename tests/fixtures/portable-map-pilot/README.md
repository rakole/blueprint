# Portable map pilot fixture

This fixture is a small invented Parcel Desk repository and a manually authored
portable map. `repository/` is the frozen source; `bundle/` is the authored map
source and the portable transfer is its `INDEX.md` plus the referenced
generation; `evaluation/` contains development probes and development query
metadata and is intentionally outside both. Root compatibility views are
authoring fixtures, not navigation inputs. The transfer contains no task
prompts, gold answers, or source bodies.

The deterministic harness is file-only and uses Node built-ins. It does not
load Blueprint, MCP, a parser, a model, or a runtime dependency. Its output is
labelled `fixture-checks-only`: it is not hosted performance evidence and does
not evaluate release token or quality gates.

Materialize a clean repository and bundle, while keeping tasks separate:

```text
node scripts/portable-map-pilot.mjs --materialize /tmp/portable-map-pilot-repo
node scripts/portable-map-pilot.mjs --report /tmp/portable-map-pilot-repo \
  --queries tests/fixtures/portable-map-pilot/evaluation/development-queries.json
```

Materialization copies `repository/` to the destination and copies only
`bundle/INDEX.md` plus `bundle/generations/` to its `.blueprint/codebase/`
directory. Root compatibility views and the evaluation directory are never
transferred. A report records ordered reads, first-useful and sufficient
evidence, fixture bytes, known-target versus discovery mode, and fallback
status for each query.
