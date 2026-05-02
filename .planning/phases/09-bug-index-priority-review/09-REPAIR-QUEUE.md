# Phase 9 Repair Queue

Discovery-only artifact. This queue organizes the confirmed BPBUG inventory into
repair-priority bands, repair batches, and a separate verification-follow-up
lane without selecting or applying fixes.

## Repair Priority

| Bug ID | Priority Band | Why This Band | Repair Leverage | Validation Surface |
|--------|---------------|---------------|-----------------|--------------------|
| BPBUG-005 | Now | Weak repo-root validation is a shared safety boundary used across multiple MCP tool families; the blast radius spans artifact, phase, impact, and workspace flows. | One shared guard hardening closes a cross-cutting safety gap and prevents misleading downstream failures in non-repo directories. | Shared repo-root helpers plus focused artifact, workspace, impact, and security regression coverage |
| BPBUG-001 | Now | High-risk ship and undo reports can look valid while omitting durable evidence for push, PR, and revert decisions. | Tightening the canonical report contracts and validation signals improves every later high-risk workflow review that depends on `ship-latest` and `undo-latest`. | Artifact-contract validation plus focused ship/undo metadata and report-content regression checks |
| BPBUG-002 | Next | Cleanup is destructive, but the current defect is missing behavioral proof rather than a confirmed runtime escape in the present tree. | A dedicated cleanup orchestration regression would lock down protected-scope, sequencing, and partial-failure behavior in one place. | Cleanup command-level behavioral tests and maintenance regression coverage |
| BPBUG-003 | Later | The runtime already returns the richer update-tool shape; the remaining risk is misleading shared docs rather than unsafe runtime behavior. | One synchronized docs and metadata guard refresh resolves the user-facing drift with low implementation breadth. | `docs/MCP-TOOLS.md`, focused update-tool tests, and docs/runtime schema cross-check coverage |

### Repaired / History

| Bug ID | Current Disposition | Evidence | Why It Is Separate |
|--------|---------------------|----------|--------------------|
| BPBUG-004 | verified repaired/history | Quick task `260502-bpbug-004-dist-refresh`, commit `350e87a`, and the Phase 7 validation rerun with `27 passing tests, 0 failures` | The defect remains important historical evidence, but it no longer belongs in the active `Now`/`Next`/`Later` queue. |

## Repair Batches

| Batch | Bug IDs | Shared Repair Direction | Validation Surface | Priority Band | Notes |
|-------|---------|-------------------------|--------------------|---------------|-------|
| Runtime and safety fixes | BPBUG-005 | Replace existence-only repo-root checks with Git-backed repo validation and add fake-`.git` rejection coverage. | Shared repo-root helpers, artifact tools, workspace tools, impact tools, and security regressions | Now | Cross-cutting safety leverage is highest here because one boundary protects multiple command families. |
| Contract and test hardening | BPBUG-001, BPBUG-002 | Tighten canonical report contracts and add behavior-level regression coverage for high-risk destructive flows. | Artifact-contract validation, ship/undo metadata and populated-report tests, cleanup orchestration regression coverage | Now / Next | These defects share a repair style: strengthen durable evidence and executable guards rather than change product scope. |
| Docs synchronization cleanup | BPBUG-003 | Align the shared MCP tool reference with the live update-tool runtime shape and add a doc-shape regression guard. | `docs/MCP-TOOLS.md`, `docs/commands/update.md`, update-tool tests | Later | Lower current user risk than the safety and high-risk workflow gaps, but still worth cleaning up before later maintenance drift accumulates. |

## Verification Questions / Follow-Ups

No open verification questions remain. The remaining items are confirmed bugs or
historical repaired-state evidence rather than low-confidence leads.
