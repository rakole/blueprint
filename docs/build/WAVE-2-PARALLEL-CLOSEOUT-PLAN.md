# Wave 2 Parallel Closeout Plan

## Tasks

- `W2-01`: repair command-catalog parity for the closeout trio
- `W2-02`: repair manifest metadata and routing language
- `W2-03`: repair roadmap-admin skill coverage
- `W2-04`: keep `insert-phase` blocked and non-routable
- `W2-05`: repair README, GEMINI, HANDOFF, and MEMORY control-plane docs
- `W2-06`: repair hook and packaging references
- `W2-07`: repair command metadata regression coverage
- `W2-08`: run the final regression gate

## Batches

- Batch A: `W2-01`, `W2-02`
- Batch B: `W2-03`, `W2-04`
- Batch C: `W2-05`, `W2-06`
- Batch D: `W2-07`, `W2-08`

## Regression Gate

- Run targeted checks:
  - `tests/command-catalog.test.ts`
  - `tests/help-progress-health.test.ts`
  - `tests/hooks.test.ts`
- Finish with the full `npm test` suite.
