# Pitfalls Research

**Domain:** Enterprise impact analysis command design
**Researched:** 2026-04-24
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: False Certainty in Impact Claims

**What goes wrong:** Report states definitive downstream impact/reviewer ownership where evidence is partial.

**Why it happens:** Teams optimize for concise output and hide confidence metadata.

**How to avoid:** Require confidence + evidence source for every major finding and force unknowns section.

**Warning signs:** Reports never include unknowns; owners always appear populated.

**Phase to address:** Phase 1 and Phase 3

---

### Pitfall 2: Over-Broad Risk Classification

**What goes wrong:** Most changes become `high risk`, making the tool noisy and ignored.

**Why it happens:** Conservative rules are added without calibration loops.

**How to avoid:** Start with explainable rule tiers and collect calibration fixtures.

**Warning signs:** >70% of routine changes classified high-risk in fixture set.

**Phase to address:** Phase 4 and Phase 5

---

### Pitfall 3: Missing Boundary Detection for Config/Data/Infra

**What goes wrong:** Reports understate deployment risk when non-code files change.

**Why it happens:** Initial classifiers focus only on source code paths.

**How to avoid:** Include first-class classifiers for migrations, config, infrastructure, and API schema deltas.

**Warning signs:** Config or migration file changes do not affect risk score.

**Phase to address:** Phase 2 and Phase 4

---

### Pitfall 4: Reviewer Suggestions Drift from Actual Ownership

**What goes wrong:** Suggested reviewers are repeatedly rejected as irrelevant.

**Why it happens:** Ownership heuristics are stale or path conventions changed.

**How to avoid:** Layer ownership sources (CODEOWNERS + repo conventions + optional catalog), and expose source provenance.

**Warning signs:** Frequent manual reviewer override in pilot usage.

**Phase to address:** Phase 3 and Phase 5

---

### Pitfall 5: Latency Too High for Daily Use

**What goes wrong:** Command takes too long on medium/large diffs and gets skipped.

**Why it happens:** Full-graph analysis is run by default for every request.

**How to avoid:** Diff-first scope, bounded dependency expansion, optional deep mode later.

**Warning signs:** Typical runtime exceeds acceptable pre-review threshold.

**Phase to address:** Phase 2 and Phase 5

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded path regex for all ownership logic | Fast MVP | Frequent false assignments | Acceptable only with explicit confidence and quick update path |
| Single global risk threshold | Simple implementation | Poor signal across boundary types | Acceptable in pilot with calibration backlog |
| No fixture-based regression tests | Faster initial coding | Silent drift in report quality | Never for production command |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Git compare input | Mixing staged and unstaged semantics | Normalize scope and show analyzed source explicitly |
| CODEOWNERS parsing | Treating wildcard matches as exact ownership | Preserve match rule and confidence provenance |
| Roadmap context | Assuming current phase always applies | Allow explicit phase override or mark unknown context |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full dependency traversal for every file | Long runtime spikes | Cap expansion depth and cache known edges | Medium/large repos |
| Recomputing ownership maps per request | High repeated IO | Cache parsed ownership metadata | Frequent local runs |
| Rendering very verbose reports inline only | UX overload | Provide concise summary + optional full artifact | Large change sets |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Echoing raw secrets from changed config into report | Secret exposure in artifacts | Redact sensitive tokens/keys before rendering |
| Following untrusted symlink paths during scan | Path traversal / wrong-scope analysis | Enforce existing shared path containment guards |
| Treating external metadata as trusted without provenance | Policy bypass via poisoned metadata | Mark source trust level and fallback to unknown |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Giant unprioritized output | Reviewers skip report | Use grouped sections with risk-priority ordering |
| No unknowns section | False confidence | Mandatory unknowns + next evidence suggestions |
| Unclear risk rationale | Team disputes output | Provide top contributing factors per risk level |

## "Looks Done But Isn't" Checklist

- [ ] **Boundary detection:** Includes API, config, data, and infra changes, not just source files
- [ ] **Reviewer inference:** Shows source and confidence for each reviewer/owner
- [ ] **Risk output:** Includes rationale and evidence references
- [ ] **Unknowns:** Lists unproven assumptions and missing metadata

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| False certainty | MEDIUM | Add confidence model + unknown section and rerun on fixture set |
| Over-broad high risk | MEDIUM | Recalibrate thresholds using representative diff corpus |
| Ownership drift | LOW | Refresh ownership mapping rules and add regression fixtures |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| False certainty | Phase 1, 3 | Reports show confidence + unknowns in fixture snapshots |
| Over-broad risk | Phase 4, 5 | Risk distribution calibrated against known scenarios |
| Missing boundary detection | Phase 2, 4 | Fixture suite contains config/data/infra diffs with expected flags |
| Ownership drift | Phase 3, 5 | Reviewer suggestions match expected owners in fixtures |
| Latency regressions | Phase 5 | Runtime benchmark stays inside target envelope |

## Sources

- User problem statement for `/blu-impact`
- `docs/MCP-TOOLS.md`
- `docs/ARCHITECTURE.md`
- `docs/COMMAND-CATALOG.md`

---
*Pitfalls research for: `/blu-impact`*
*Researched: 2026-04-24*
