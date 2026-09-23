# Portable map pilot fixture

This fixture is a small invented Parcel Desk repository and a manually authored
portable map. `repository/` is the frozen source; `bundle/` is the transfer
unit; `evaluation/` contains development probes and held-out query metadata and
is intentionally outside both. The bundle contains no task prompts, gold
answers, or source bodies.

The deterministic harness is file-only and uses Node built-ins. It does not
load Blueprint, MCP, a parser, a model, or a runtime dependency. Its output is
labelled `fixture-checks-only`: it is not hosted performance evidence and does
not evaluate release token or quality gates.

Materialize a clean repository and bundle, while keeping tasks separate:

```text
node scripts/portable-map-pilot.mjs --materialize /tmp/portable-map-pilot-repo
node scripts/portable-map-pilot.mjs --report /tmp/portable-map-pilot-repo \
  --queries tests/fixtures/portable-map-pilot/evaluation/held-out-queries.json
```

Materialization copies `repository/` to the destination and copies only
`bundle/` to its `.blueprint/codebase/` directory. The evaluation directory is
never transferred. A report records ordered reads, source evidence, bytes,
known-target versus discovery mode, and fallback status for each query.
