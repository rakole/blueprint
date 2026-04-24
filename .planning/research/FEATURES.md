# Feature Research

**Domain:** Enterprise blast-radius analysis for code changes
**Researched:** 2026-04-24
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Diff scope ingestion (working tree, commit range, or branch compare) | Users expect analysis to match what is being changed | MEDIUM | Must normalize file statuses and renames |
| Affected modules/services listing | Core blast-radius output | MEDIUM | Needs path-to-module/service mapping |
| Downstream consumer identification | Reviewers need cross-team impact visibility | HIGH | Can begin heuristic and graduate to explicit graphs |
| Data/API/config/infra touch detection | Operational risk depends on boundary type | MEDIUM | Pattern and path classifiers are sufficient for v1 |
| Required tests and reviewers suggestion | Reduces review friction directly | HIGH | Best-effort with confidence/unknown annotations |
| Deploy risk level with rationale | Needed for release gate conversations | MEDIUM | Must show evidence, not only score |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Phase-aware impact context from roadmap/requirements | Connects change impact to planned work commitments | HIGH | Reuses Blueprint planning artifacts |
| Explicit "unknowns we could not prove" contract | Builds trust by exposing uncertainty | LOW | Should be mandatory section in every report |
| Reviewer ownership confidence levels | Prevents false authority in reviewer assignment | MEDIUM | Include source (`CODEOWNERS`, path heuristic, or unknown) |
| Test-suite traceability to impacted boundaries | Makes CI scope decisions explainable | HIGH | Start with mapping file + fallback heuristics |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| One-click auto-approve when risk is low | Speeds review throughput | Encourages over-trust and weak governance | Keep advisory-only report and human gate |
| "No unknowns" mode | Feels cleaner for dashboards | Hides uncertainty and degrades trust | Force unknowns section with explicit confidence |
| Full-callgraph deep analysis by default | Feels comprehensive | Slow and noisy for daily use | Diff-first analysis with optional deep mode |

## Feature Dependencies

```
Diff Ingestion
    └──requires──> Scope Normalization
                         └──requires──> Module/Service Mapping

Module/Service Mapping ──enables──> Consumer + Test + Reviewer Inference

Evidence Links ──required for──> Risk Scoring Trust
```

### Dependency Notes

- **Consumer/test/reviewer inference requires stable scope mapping:** weak mapping inflates false positives.
- **Risk scores require evidence references:** a score without traceability is not auditable.
- **Unknown reporting depends on confidence model:** every inference path should emit confidence and fallback reason.

## MVP Definition

### Launch With (v1)

- [ ] Normalize proposed change scope from git diff inputs.
- [ ] Classify touched boundaries (service/module/api/config/data/infra).
- [ ] Produce structured impact report with required sections and evidence links.
- [ ] Infer tests and reviewers with confidence tags and unknown fallback.
- [ ] Compute deploy risk level (`low`, `medium`, `high`) with rule rationale.

### Add After Validation (v1.x)

- [ ] Optional integration with external ownership/service-catalog metadata.
- [ ] Historical incident-aware risk boost signals.
- [ ] Custom org policy weighting for risk scoring.

### Future Consideration (v2+)

- [ ] Continuous impact monitoring across branch lifecycle.
- [ ] Auto-generated mitigation checklists by risk class.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Structured impact report with unknowns | HIGH | MEDIUM | P1 |
| Boundary classification | HIGH | MEDIUM | P1 |
| Reviewer/test inference | HIGH | HIGH | P1 |
| External metadata connectors | MEDIUM | HIGH | P2 |
| Incident-history enrichment | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Change impact summary | Typically static path summary | Often PR-only summary | Blend diff + roadmap + artifact context |
| Reviewer suggestion | CODEOWNERS-only | Optional team graph | Multi-source with confidence and unknowns |
| Risk output | Coarse labels | Policy-based gates | Label + evidence + unknowns contract |

## Sources

- User-provided problem framing for `/blu-impact`
- `docs/COMMAND-CATALOG.md`
- `docs/MCP-TOOLS.md`
- `docs/ARCHITECTURE.md`

---
*Feature research for: `/blu-impact`*
*Researched: 2026-04-24*
