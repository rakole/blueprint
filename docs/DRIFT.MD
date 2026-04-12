# Drift Ledger

## Checkpoint: Phase 2.2 future-contract drift repair

- State: closed on 2026-04-11
- Scope: lock the retained-command docs, runtime ownership map, and status vocabulary before later command slices land
- Outcome: Phase 2.2 closed the future-contract mismatch set and Phase 3 discovery then shipped on the repaired substrate

## Status Vocabulary

- `implemented`: manifest, primary skill, and required MCP tools are all present
- `repairing`: partially shipped and under active drift repair
- `planned`: documented but not yet shipped
- `blocked`: not safe to expose because required runtime pieces are missing

## Closed Drift Set

The Phase 2.2 checkpoint closed `DRIFT-01` through `DRIFT-07` and left the resulting guarantees in force for later slices:

- `DRIFT-01`: command status semantics stay implementation-aware rather than doc-only
- `DRIFT-02`: root routing continues to recommend implemented commands only
- `DRIFT-03`: future command ownership stays aligned with the canonical skill families
- `DRIFT-04`: required MCP tools remain the gate for routable command exposure
- `DRIFT-05`: roadmap-admin closeout docs stay aligned with the shipped Wave 2 runtime
- `DRIFT-06`: discovery and lifecycle contracts remain grounded in MCP-owned artifacts
- `DRIFT-07`: later wave docs remain documented without being treated as runnable by default

## Follow-Through

- Keep the closed checkpoint locked while later work repairs discovery parity gaps and other post-shipment regressions.
- Do not reopen `insert-phase` or later-wave capture, review, workspace, or maintenance commands without the matching manifest, primary skill, required MCP tools, and tests.
