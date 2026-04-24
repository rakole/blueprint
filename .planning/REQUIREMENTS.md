# Requirements: Blueprint Impact Command

**Defined:** 2026-04-24
**Core Value:** Every meaningful change gets a provable blast-radius report before it ships.

## v1 Requirements

### Scope Ingestion

- [ ] **SCOP-01**: User can run `/blu-impact` against current working-tree and staged changes.
- [ ] **SCOP-02**: User can run `/blu-impact` against an explicit compare target (commit range or branch base..head).
- [ ] **SCOP-03**: Change scope normalizes added, modified, deleted, and renamed files before downstream analysis.

### Impact Analysis

- [ ] **IMPT-01**: Report lists affected services/modules inferred from touched files and known mapping rules.
- [ ] **IMPT-02**: Report identifies downstream consumers likely affected by touched services/modules.
- [ ] **IMPT-03**: Report flags touched boundaries across API contracts, configuration, data schema/migrations, and infrastructure.

### Governance Output

- [ ] **GOV-01**: Report recommends required test suites for the identified impact scope.
- [ ] **GOV-02**: Report recommends required reviewers/owners with source provenance (e.g., CODEOWNERS, rule-based, unknown).
- [ ] **GOV-03**: Report assigns deploy risk level (`low`, `medium`, `high`) with evidence-backed rationale.
- [ ] **GOV-04**: Report includes explicit "unknowns we could not prove" with suggested next evidence.

### Safety and Runtime Contract

- [ ] **SAFE-01**: `/blu-impact` remains advisory/read-only and does not mutate code, git history, or deployment state.
- [ ] **SAFE-02**: Command exposure follows implemented-only routing guarantees (`/blu`, `/blu-help`, `/blu-progress` only surface when implemented).
- [ ] **SAFE-03**: Impact analysis runs through deterministic, schema-validated MCP tooling rather than prompt-only state.
- [ ] **SAFE-04**: Report output has stable section schema so regressions can be fixture-tested.

## v2 Requirements

### Integrations and Advanced Intelligence

- **INTG-01**: Support optional external service-catalog and ownership-system enrichment.
- **INTG-02**: Support organization-specific risk policy weighting and override rules.
- **INTG-03**: Add incident-history-aware risk adjustments for previously unstable boundaries.

### Workflow Expansion

- **FLOW-01**: Add optional artifact persistence modes for PR-linked impact snapshots.
- **FLOW-02**: Add optional deep dependency expansion mode with bounded performance controls.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic code changes based on impact report | First release is trust-building and advisory-only |
| Automatic PR approval/rejection | Human review remains required governance gate |
| Mandatory external metadata integrations | Must work in repos without CMDB/service-catalog connections |
| Perfect certainty guarantee | Real-world metadata gaps require explicit unknown handling |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCOP-01 | Phase 2 | Pending |
| SCOP-02 | Phase 2 | Pending |
| SCOP-03 | Phase 2 | Pending |
| IMPT-01 | Phase 2 | Pending |
| IMPT-02 | Phase 3 | Pending |
| IMPT-03 | Phase 2 | Pending |
| GOV-01 | Phase 3 | Pending |
| GOV-02 | Phase 3 | Pending |
| GOV-03 | Phase 4 | Pending |
| GOV-04 | Phase 1 | Pending |
| SAFE-01 | Phase 1 | Pending |
| SAFE-02 | Phase 1 | Pending |
| SAFE-03 | Phase 1 | Pending |
| SAFE-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-24 after initial definition*
