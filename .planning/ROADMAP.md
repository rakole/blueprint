# Roadmap: Blueprint Impact Command

## Overview

This roadmap delivers `/blu-impact` as an advisory, enterprise-grade blast-radius workflow that turns proposed changes into auditable impact reports. Work is sequenced from contract safety and deterministic inputs to inference depth, risk scoring, and rollout hardening.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Contract and Safety Rails** - Define report schema, command contract, and implemented-only routing guardrails.
- [ ] **Phase 2: Scope and Boundary Detection** - Normalize compare inputs and classify touched technical boundaries.
- [ ] **Phase 3: Dependency, Reviewer, and Test Inference** - Produce downstream impact plus ownership and test recommendations.
- [ ] **Phase 4: Risk Engine and Report UX** - Add deploy risk scoring and high-signal report formatting.
- [ ] **Phase 5: Calibration and Rollout Hardening** - Add fixture calibration, performance guards, and rollout confidence checks.

## Phase Details

### Phase 1: Contract and Safety Rails
**Goal**: Lock runtime contract and guarantee trusted, advisory-first output semantics.
**Depends on**: Nothing (first phase)
**Requirements**: SAFE-01, SAFE-02, SAFE-03, GOV-04
**Success Criteria** (what must be TRUE):
  1. `/blu-impact` runtime contract exists with explicit advisory/read-only behavior.
  2. Report schema includes mandatory "unknowns we could not prove" section.
  3. Command catalog/routing behavior keeps `/blu-impact` hidden until marked `implemented`.
  4. MCP input/output schemas validate impact requests and response structure.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Define command spec, manifest, and runtime contract updates.
- [ ] 01-02: Implement MCP schema + validation scaffolding for impact payload.
- [ ] 01-03: Add routing/regression checks for implemented-only exposure.

### Phase 2: Scope and Boundary Detection
**Goal**: Convert proposed changes into a reliable impacted-boundary model.
**Depends on**: Phase 1
**Requirements**: SCOP-01, SCOP-02, SCOP-03, IMPT-01, IMPT-03
**Success Criteria** (what must be TRUE):
  1. Command can analyze working tree/staged changes and explicit compare ranges.
  2. File-level changes are normalized for add/modify/delete/rename cases.
  3. Impact output includes affected modules/services from deterministic mapping rules.
  4. Boundary flags cover API, config, data/migration, and infra touchpoints.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Build scope resolver and normalized diff model.
- [ ] 02-02: Implement boundary classifiers and module/service mapping.
- [ ] 02-03: Add deterministic fixtures for scope and boundary classification.

### Phase 3: Dependency, Reviewer, and Test Inference
**Goal**: Reduce review friction with actionable downstream, owner, and test guidance.
**Depends on**: Phase 2
**Requirements**: IMPT-02, GOV-01, GOV-02
**Success Criteria** (what must be TRUE):
  1. Report identifies likely downstream consumers for impacted modules/services.
  2. Report recommends required test suites tied to impacted boundaries.
  3. Report recommends reviewers/owners with provenance and confidence metadata.
  4. Unknown ownership and dependency gaps are explicit and actionable.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Implement dependency inference pipeline with confidence output.
- [ ] 03-02: Implement reviewer/owner inference from CODEOWNERS and path heuristics.
- [ ] 03-03: Implement required-test inference and validation fixtures.

### Phase 4: Risk Engine and Report UX
**Goal**: Produce high-trust deploy risk conclusions that are easy to act on.
**Depends on**: Phase 3
**Requirements**: GOV-03, SAFE-04
**Success Criteria** (what must be TRUE):
  1. Report assigns risk level (`low`, `medium`, `high`) with explicit rationale.
  2. Report sections are stable, ordered, and easy to consume in review workflows.
  3. Fixture tests verify section schema and risk rationale presence.
**Plans**: 2 plans

Plans:
- [ ] 04-01: Implement evidence-backed risk engine with scoring rules.
- [ ] 04-02: Implement report renderer and schema compliance tests.

### Phase 5: Calibration and Rollout Hardening
**Goal**: Ensure output precision and runtime performance are production-usable.
**Depends on**: Phase 4
**Requirements**: SAFE-05
**Success Criteria** (what must be TRUE):
  1. Representative fixture corpus validates impact and risk quality across change types.
  2. Risk-level distribution is calibrated to avoid pervasive false-high results.
  3. Runtime performance remains acceptable for normal pre-review workflows.
  4. Rollout notes document known limits and escalation guidance for unknown-heavy reports.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Build calibration suite and risk-threshold tuning loop.
- [ ] 05-02: Add runtime benchmark checks, rollout docs, and quality gates.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Contract and Safety Rails | 0/3 | Not started | - |
| 2. Scope and Boundary Detection | 0/3 | Not started | - |
| 3. Dependency, Reviewer, and Test Inference | 0/3 | Not started | - |
| 4. Risk Engine and Report UX | 0/2 | Not started | - |
| 5. Calibration and Rollout Hardening | 0/2 | Not started | - |
