# Wave 2 Parallel Closeout Plan

## Task Inventory

- `W2-01`: lock command-catalog status semantics and implemented-only routing
- `W2-02`: verify help, progress, and health against the shipped runtime surface
- `W2-03`: keep roadmap-admin manifests aligned with the current closeout slice
- `W2-04`: keep milestone audit and report persistence grounded in MCP-owned writes
- `W2-05`: preserve lifecycle and hooks regression coverage
- `W2-06`: verify packaged extension assets and runtime discovery metadata
- `W2-07`: refresh shared memory and closeout handoff docs
- `W2-08`: run the final regression gate and record residual risk

## Batches

- Batch A: catalog and routing alignment
- Batch B: roadmap-admin and milestone closeout verification
- Batch C: hooks, docs, and packaging checks
- Batch D: final regression and handoff

## Regression Gate

- Re-run `tests/command-catalog.test.ts`
- Re-run `tests/help-progress-health.test.ts`
- Re-run `tests/hooks.test.ts`
- Finish with the full `npm test`
