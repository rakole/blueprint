# Phase 8: Cross-Cut Drift And Regression Gaps - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 8-Cross-Cut Drift And Regression Gaps
**Areas discussed:** Contract Drift Matrix, Regression Gap Threshold, Concern Map Triage, Bug Clustering Rules

---

## Contract Drift Matrix

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How broad should Phase 8's drift matrix be? | Full cross-layer matrix | Compare docs, command catalog, command manifests, skills, MCP docs, runtime/source, tests, and generated `dist` where relevant. | yes |
| How broad should Phase 8's drift matrix be? | Known-leads only | Start from BPBUG-001 through BPBUG-004 plus `.planning/codebase/CONCERNS.md`; lower effort but may miss unclustered drift. | |
| How broad should Phase 8's drift matrix be? | Docs/runtime only | Focus on documentation versus live implementation; fastest but weaker on missing tests and generated assets. | |

**User's choice:** Full cross-layer matrix.
**Notes:** The user selected option 1. Later, the user asked Codex to choose the recommended option for every remaining question and record it as their answer.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| What should count as a Phase 8 drift finding? | Material mismatch only | File a bug when drift could mislead a user, agent, test, installer, or later repair planner. | yes |
| What should count as a Phase 8 drift finding? | Any mismatch | File every doc/source/test wording mismatch, even if low impact. | |
| What should count as a Phase 8 drift finding? | Runtime-facing only | File only drift that changes command behavior, MCP calls, artifacts, or install/runtime output. | |

**User's choice:** Material mismatch only.
**Notes:** The user selected option 1.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How should the matrix be organized for downstream planners? | By command/surface family | Aligns with prior phase slices and traces user impact. | yes |
| How should the matrix be organized for downstream planners? | By artifact type | Cleaner inventory, but weaker for user-impact tracing. | |
| How should the matrix be organized for downstream planners? | By risk type | Good for clustering, less direct for finding files. | |

**User's choice:** By command/surface family.
**Notes:** The user selected option 1. Risk tags should still be preserved.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Should Phase 8 actively re-check surfaces that earlier phases found clean? | Targeted re-check only | Trust earlier clean slices, but re-check shared docs/tests/generated assets and any surface touched by cross-cut evidence. | yes |
| Should Phase 8 actively re-check surfaces that earlier phases found clean? | Re-audit everything | Broadest confidence, but duplicates Phases 2-7. | |
| Should Phase 8 actively re-check surfaces that earlier phases found clean? | Trust all prior clean slices | Only analyze known bug reports and concern-map leads. | |

**User's choice:** Targeted re-check only.
**Notes:** The user selected option 1.

---

## Regression Gap Threshold

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| When should missing regression coverage become a `docs/bugs/*.md` finding? | Risk-backed gaps only | File when the missing test protects high-risk behavior, prior bug recurrence, generated assets, safety gates, or user-visible runtime contracts. | yes |
| When should missing regression coverage become a `docs/bugs/*.md` finding? | Every uncovered drift path | File every missing test found while building the matrix. | |
| When should missing regression coverage become a `docs/bugs/*.md` finding? | Only proven regression misses | File only when a current bug escaped because a specific test was absent. | |

**User's choice:** Risk-backed gaps only.
**Notes:** The user selected option 1.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How should Phase 8 handle lower-risk test gaps? | Capture as non-bug notes | Put them in context, summaries, or Phase 9 notes without inflating the bug index. | yes |
| How should Phase 8 handle lower-risk test gaps? | File low-severity bugs | More complete inventory, but risks noisy repair prioritization. | |
| How should Phase 8 handle lower-risk test gaps? | Ignore them entirely | Keeps focus sharp, but loses planning signals. | |

**User's choice:** Capture as non-bug notes.
**Notes:** Codex selected the recommended option after the user asked to skip the remaining discussion and record recommendations as their answers.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Which regression gap classes should get first attention? | Prior bug recurrence, high-risk safety gates, generated assets, and user-visible runtime contracts first | Focuses testing effort where failure is most damaging or likely to recur. | yes |
| Which regression gap classes should get first attention? | Only prior bug recurrence | Sharp but may miss high-impact gaps before they fail. | |
| Which regression gap classes should get first attention? | Only generated and packaging freshness | Good for BPBUG-004 recurrence, too narrow for Phase 8. | |

**User's choice:** Prior bug recurrence, high-risk safety gates, generated assets, and user-visible runtime contracts first.
**Notes:** Recommended option recorded as requested.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| What evidence should a regression-gap bug include? | Exact missing guard plus escaped failure mode | Name the missing guard, protected surface, nearby tests, and what could escape. | yes |
| What evidence should a regression-gap bug include? | General coverage concern | Easier to write, weaker repair input. | |
| What evidence should a regression-gap bug include? | Only a suggested new test name | Actionable but insufficient evidence. | |

**User's choice:** Exact missing guard plus escaped failure mode.
**Notes:** Recommended option recorded as requested.

---

## Concern Map Triage

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Which concern-map leads should Phase 8 prioritize? | All high-risk leads | Include Markdown parsing, schema permissiveness, generated freshness, filesystem edges, impact performance, and stale docs/runtime references. | yes |
| Which concern-map leads should Phase 8 prioritize? | Only Markdown parsing and schema validation | Good depth, too narrow for the roadmap goal. | |
| Which concern-map leads should Phase 8 prioritize? | Only generated assets and tests | Strong recurrence check for BPBUG-004, too narrow overall. | |

**User's choice:** All high-risk leads, with priority for cross-layer or user-visible drift.
**Notes:** Recommended option recorded as requested.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How should concern-map leads become bug reports? | Confirmed or likely evidence only | Escalate only when contract/source/test evidence supports the finding. | yes |
| How should concern-map leads become bug reports? | File every concern as suspected | Captures more, but risks weak bug reports. | |
| How should concern-map leads become bug reports? | Treat concerns only as planning notes | Too conservative for the Phase 8 requirement. | |

**User's choice:** Confirmed or likely evidence only.
**Notes:** Recommended option recorded as requested.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How much probing should Phase 8 do for performance and filesystem concerns? | Static review plus targeted disposable probes | Use runtime probes only to resolve material ambiguity. | yes |
| How much probing should Phase 8 do for performance and filesystem concerns? | Broad stress testing | Potentially valuable, but too expansive for this discovery slice. | |
| How much probing should Phase 8 do for performance and filesystem concerns? | Static review only | Safer, but may leave material ambiguity unresolved. | |

**User's choice:** Static review plus targeted disposable probes.
**Notes:** Recommended option recorded as requested.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How should speculative security or TOCTOU edges be handled? | Concrete exploitability or contract violation only | File bugs with concrete exploitability, destructive impact, or clear contract violation; otherwise keep risk notes. | yes |
| How should speculative security or TOCTOU edges be handled? | File all security concerns | Overstates uncertain risks. | |
| How should speculative security or TOCTOU edges be handled? | Defer all speculative concerns | Could miss high-impact issues. | |

**User's choice:** Concrete exploitability or contract violation only.
**Notes:** Recommended option recorded as requested.

---

## Bug Clustering Rules

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Should Phase 8 cluster existing BPBUG-001 through BPBUG-004? | Cluster existing and new bugs | Link existing and new bugs into shared root-cause clusters without changing individual bug identities. | yes |
| Should Phase 8 cluster existing BPBUG-001 through BPBUG-004? | Cluster only new Phase 8 bugs | Avoids touching older entries, but misses the cross-cut point of this phase. | |
| Should Phase 8 cluster existing BPBUG-001 through BPBUG-004? | Do not cluster bugs | Leaves Phase 9 with less repair-prioritization context. | |

**User's choice:** Cluster existing and new bugs.
**Notes:** Recommended option recorded as requested.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| What cluster labels should Phase 8 use? | Practical root-cause labels | Use labels such as under-specified contracts, missing regression guards, generated-asset freshness, and stale docs/runtime references. | yes |
| What cluster labels should Phase 8 use? | Severity-based labels | Useful for triage, weak for root-cause prevention. | |
| What cluster labels should Phase 8 use? | Phase-based labels only | Easy to map, but not a true cluster. | |

**User's choice:** Practical root-cause labels.
**Notes:** Recommended option recorded as requested.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| When should related findings be treated as duplicates? | Same defect and repair path only | Preserve separate reports when affected surfaces or repairs differ. | yes |
| When should related findings be treated as duplicates? | Same root cause means duplicate | Risks hiding distinct repair work. | |
| When should related findings be treated as duplicates? | Never mark duplicates in Phase 8 | Preserves all findings, but weakens index hygiene. | |

**User's choice:** Same defect and repair path only.
**Notes:** Recommended option recorded as requested.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Where should cluster information live? | Bug index plus related-bugs sections | Keeps clusters reviewable and preserves per-bug evidence. | yes |
| Where should cluster information live? | Only in Phase 8 planning artifacts | Easy during planning, but may be lost during repair triage. | |
| Where should cluster information live? | Only in each individual bug report | Preserves local evidence, but weakens inventory view. | |

**User's choice:** Bug index plus related-bugs sections.
**Notes:** Recommended option recorded as requested.

---

## the agent's Discretion

- After the first five explicit user selections, the user asked Codex to choose the recommended option for every remaining question and record those choices as the user's answers.
- Codex used the same recommendation posture already presented in the discussion: risk-backed findings, material drift only, targeted re-checks, and practical root-cause clustering.

## Deferred Ideas

None - discussion stayed within phase scope.
