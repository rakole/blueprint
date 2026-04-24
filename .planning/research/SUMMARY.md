# Project Research Summary

**Project:** Blueprint Impact Command
**Domain:** Enterprise blast-radius analysis command
**Researched:** 2026-04-24
**Confidence:** MEDIUM

## Executive Summary

`/blu-impact` should ship as an advisory, evidence-first command that computes blast radius from proposed change scope and returns structured output for engineering decision-making. The highest-confidence strategy is to start with deterministic repo-local evidence (diffs, roadmap artifacts, ownership conventions) and make uncertainty explicit through a required unknowns contract.

The recommended architecture keeps orchestration thin in command/skill layers and concentrates classification, dependency inference, ownership mapping, and risk logic in MCP-backed typed modules. This aligns with Blueprint's existing runtime rules and reduces drift risk.

The main risks are false certainty, noisy risk scoring, and slow analysis on larger diffs. The roadmap should explicitly stage confidence modeling, boundary coverage, and calibration fixtures before broad rollout.

## Key Findings

### Recommended Stack

Use the existing Blueprint stack: Node.js + TypeScript + MCP SDK + zod schemas, with git diff as canonical scope source and deterministic MCP tools for persistence/reporting.

**Core technologies:**
- Node.js: Runtime alignment with extension packaging.
- TypeScript: Stable impact report contracts and rule safety.
- MCP SDK + zod: Deterministic tool boundaries and validated payloads.

### Expected Features

**Must have (table stakes):**
- Canonical diff scope ingestion
- Affected services/modules and boundary detection
- Downstream consumer estimates
- Required test and reviewer suggestions
- Deploy risk with rationale
- Explicit unknowns section

**Should have (competitive):**
- Phase-aware impact context
- Confidence/provenance labels for every major finding

**Defer (v2+):**
- Full external service-catalog integration
- Continuous branch lifecycle monitoring

### Architecture Approach

Adopt a layered design: scope normalization -> classification -> dependency/ownership/test inference -> risk engine -> report renderer. Keep each layer independently testable and route final persistence through existing Blueprint report patterns.

**Major components:**
1. Scope + boundary analyzer
2. Dependency/ownership/test inference pipeline
3. Risk engine + report formatter with unknowns contract

### Critical Pitfalls

1. **False certainty** -> enforce confidence + unknowns in every report
2. **Noisy high-risk output** -> calibrate risk rules with fixtures
3. **Missing config/data/infra detection** -> treat non-code boundaries as first-class
4. **Ownership drift** -> show provenance and support layered ownership sources

## Implications for Roadmap

### Phase 1: Command Contract and Report Schema
**Rationale:** Trust and shape must be fixed before deeper analysis logic.
**Delivers:** `/blu-impact` runtime contract, report schema, unknowns contract.
**Addresses:** Confidence transparency and governance fit.
**Avoids:** False certainty.

### Phase 2: Scope and Boundary Detection
**Rationale:** Accurate blast radius starts with normalized input and boundary tagging.
**Delivers:** Diff ingestion and classifiers for module/service/api/config/data/infra.
**Uses:** Existing git and MCP tooling.
**Implements:** Scope resolver + classifier components.

### Phase 3: Dependency, Reviewer, and Test Inference
**Rationale:** Review friction is mostly ownership/test uncertainty.
**Delivers:** Downstream consumer, reviewer/owner, and test-suite inference.
**Uses:** CODEOWNERS and path conventions with confidence labels.
**Implements:** Inference pipeline.

### Phase 4: Risk Engine and Reporting UX
**Rationale:** Output must be actionable, auditable, and prioritizable.
**Delivers:** Deploy risk scoring with rationale and report rendering.

### Phase 5: Regression Calibration and Rollout Hardening
**Rationale:** Command value depends on stable precision and acceptable runtime.
**Delivers:** Fixture corpus, calibration loops, performance envelope checks, docs/tests.

### Phase Ordering Rationale

- Fix report contract first, then add inference complexity.
- Build from deterministic scope signals outward to heuristics.
- Delay broad rollout until calibration demonstrates usable signal quality.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** Ownership and dependency heuristics vary by repository structure.
- **Phase 4:** Risk weighting needs organization-specific tuning.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Command/report contract follows existing Blueprint conventions.
- **Phase 2:** Diff and boundary classification are straightforward with deterministic rules.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Fully aligned with current repository runtime |
| Features | MEDIUM | Enterprise needs are clear, but org-specific expectations vary |
| Architecture | MEDIUM | Pattern is stable; dependency inference depth remains repo-specific |
| Pitfalls | MEDIUM | Risks are well-known; exact thresholds need fixture calibration |

**Overall confidence:** MEDIUM

### Gaps to Address

- Ownership quality in repos with sparse or absent CODEOWNERS.
- Dependency inference precision without a maintained service graph.
- Risk-level calibration targets for different repository sizes.

## Sources

### Primary (HIGH confidence)
- `package.json` — runtime constraints and dependencies
- `docs/ARCHITECTURE.md` — command/MCP ownership model
- `docs/MCP-TOOLS.md` — live tool contracts

### Secondary (MEDIUM confidence)
- `docs/COMMAND-CATALOG.md` — routing and command exposure constraints
- User command framing for `/blu-impact`

---
*Research completed: 2026-04-24*
*Ready for roadmap: yes*
