# Wave 2 Parallel Closeout Plan

## Tasks

- `W2-01`: repair command-catalog parity for the closeout trio
- `W2-02`: repair manifest metadata and routing language
- `W2-03`: repair roadmap-admin skill coverage
- `W2-04`: repair milestone artifact and report contracts
- `W2-05`: repair README, GEMINI, HANDOFF, and MEMORY control-plane docs
- `W2-06`: repair hook and packaging references
- `W2-07`: repair command metadata regression coverage
- `W2-08`: run the final verification sweep and close blockers

## Batches

- Batch A: `W2-01`, `W2-02`
- Batch B: `W2-03`, `W2-04`
- Batch C: `W2-05`, `W2-06`
- Batch D: `W2-07`, `W2-08`

## Regression Gate

- Re-run `tests/command-catalog.test.ts`
- Re-run `tests/help-progress-health.test.ts`
- Re-run `tests/hooks.test.ts`
- Finish with a full `npm test`
