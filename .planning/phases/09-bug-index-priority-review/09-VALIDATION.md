---
phase: 9
slug: bug-index-priority-review
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-02
---

# Phase 9 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Markdown/grep/status checks over planning artifacts and bug-board docs |
| Config file | `package.json`, `tsconfig.json` |
| Quick run command | `rg -n "BPBUG-00[1-9]|Duplicate And Related Findings|Repair Priority|Repair Batches|Verification Questions|repaired/history|none new" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md .planning/phases/09-bug-index-priority-review/09-INVENTORY-REVIEW.md .planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md .planning/phases/09-bug-index-priority-review/09-04-SUMMARY.md` |
| Full suite command | `npm test` |
| Estimated runtime | Not recorded. Plans should record pass/fail or environment blockers exactly. |

## Sampling Rate

- After every plan: run the targeted grep/status command named in that plan.
- After every wave: run the Phase 9 quick command and inspect `git status --short`.
- Before Phase 9 closeout: run all commands listed in `09-04-PLAN.md`.
- Max feedback latency: one focused grep/status audit per inventory, duplicate, priority, or closeout view before editing the next view.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | BUG-04, REPAIR-02, NFIX-01, NFIX-03 | T-01 | Inventory status is reconciled from existing bug reports and repair evidence without source fixes. | inventory grep/status | `rg -n "BPBUG-001|BPBUG-002|BPBUG-003|BPBUG-004|BPBUG-005|illustrative only|active candidate|repaired/history" .planning/phases/09-bug-index-priority-review/09-INVENTORY-REVIEW.md docs/bugs/INDEX.md` | yes | covered |
| 9-01-02 | 01 | 1 | REPAIR-02, NFIX-01, NFIX-03 | T-02 | BPBUG-004 status freshness is checked against the quick repair and validation artifacts before ranking. | evidence grep/status | `rg -n "BPBUG-004|350e87a|27 passing tests|verified|Current Status|260502-bpbug-004-dist-refresh" docs/bugs/INDEX.md docs/bugs/BPBUG-004-*.md .planning/phases/09-bug-index-priority-review/09-INVENTORY-REVIEW.md .planning/quick/260502-bpbug-004-dist-refresh/260502-bpbug-004-dist-refresh-SUMMARY.md .planning/phases/07-host-packaging-build-hooks-audit/07-VALIDATION.md` | yes | covered |
| 9-02-01 | 02 | 2 | BUG-04, NFIX-01, NFIX-03 | T-03 | Duplicate status is explicit and not inferred from root-cause clusters. | duplicate grep/status | `rg -n "Duplicate And Related Findings|same user-visible defect|same repair path|No duplicate reports|Related Bugs|Root Cause Clusters" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md .planning/phases/09-bug-index-priority-review/09-02-SUMMARY.md` | yes | covered |
| 9-03-01 | 03 | 3 | REPAIR-01, REPAIR-02, REPAIR-03, NFIX-01 | T-04 | Repair priority bands and batches reflect active candidates separately from repaired/history items. | priority grep/status | `rg -n "Repair Priority|Now|Next|Later|Repair Batches|Verification Questions|Repaired / History|BPBUG-00[1-9]" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md .planning/phases/09-bug-index-priority-review/09-03-SUMMARY.md` | yes | covered |
| 9-04-01 | 04 | 4 | BUG-04, REPAIR-01, REPAIR-02, REPAIR-03, NFIX-01, NFIX-02, NFIX-03 | T-05 | Closeout records final inventory coverage, workflow handoff, open questions, and no-fix boundary. | closeout grep/status | `git status --short && rg -n "Phase 9|inventory/status freshness|duplicate review|Repair Priority|Repair Batches|Verification Questions|none new|BUG-04|REPAIR-01|REPAIR-02|REPAIR-03|NFIX-01|NFIX-02|NFIX-03" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/09-04-SUMMARY.md && rg -n "Phase 9|09-01-PLAN|09-02-PLAN|09-03-PLAN|09-04-PLAN|\\$gsd-validate-phase 9|ready for validation" .planning/ROADMAP.md .planning/STATE.md` | yes | covered |

## Wave 0 Requirements

Existing markdown inventory and grep/status infrastructure covers all Phase 9 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Duplicate judgment | BUG-04 | Grep can prove links and policy text exist, but an auditor must compare whether defects and repair paths actually match. | Compare each BPBUG report's expected behavior, actual behavior, impact, likely cause, and suggested fix direction before marking duplicate. |
| Repair priority ordering | REPAIR-01, REPAIR-02 | Priority is a judgment over impact, blast radius, leverage, and current status. | Read all BPBUG reports plus `09-INVENTORY-REVIEW.md` and `09-REPAIR-QUEUE.md`; confirm `Now`, `Next`, and `Later` rationale is explicit. |
| Open-question separation | REPAIR-03 | Requires distinguishing evidence gaps from confirmed defects and feature ideas. | Verify the follow-up lane says no open verification questions remain and does not mix in confirmed bugs or feature requests. |
| Discovery-only boundary | NFIX-01, NFIX-02, NFIX-03 | Requires local git-status review and allowed-write judgment. | Run `git status --short`; confirm intentional changes stay inside `.planning/` and `docs/bugs/` and do not mutate implementation or runtime state. |

## Validation Audit 2026-05-02

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |
| Generated test files | 0 |

| Evidence | Count |
|----------|-------|
| Phase-9 targeted commands executed | 5 |
| Phase-9 targeted test cases executed | 0 |
| Targeted test failures | 0 |

Recheck (2026-05-02): the existing Phase 9 validation draft was stale. It still marked the phase `planned`, left every verification row `planned`, and under-specified two checks that should have been part of the Nyquist map: Plan 01 did not explicitly validate the inventory ledger itself, and Plan 04 did not include the roadmap/state handoff check that the execution plan required.

Fresh reruns passed for all five Phase 9 targeted validation commands:

- `rg -n "BPBUG-001|BPBUG-002|BPBUG-003|BPBUG-004|BPBUG-005|illustrative only|active candidate|repaired/history" .planning/phases/09-bug-index-priority-review/09-INVENTORY-REVIEW.md docs/bugs/INDEX.md`
- `rg -n "BPBUG-004|350e87a|27 passing tests|verified|Current Status|260502-bpbug-004-dist-refresh" docs/bugs/INDEX.md docs/bugs/BPBUG-004-*.md .planning/phases/09-bug-index-priority-review/09-INVENTORY-REVIEW.md .planning/quick/260502-bpbug-004-dist-refresh/260502-bpbug-004-dist-refresh-SUMMARY.md .planning/phases/07-host-packaging-build-hooks-audit/07-VALIDATION.md`
- `rg -n "Duplicate And Related Findings|same user-visible defect|same repair path|No duplicate reports|Related Bugs|Root Cause Clusters" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md .planning/phases/09-bug-index-priority-review/09-02-SUMMARY.md`
- `rg -n "Repair Priority|Now|Next|Later|Repair Batches|Verification Questions|Repaired / History|BPBUG-00[1-9]" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md .planning/phases/09-bug-index-priority-review/09-03-SUMMARY.md`
- `git status --short && rg -n "Phase 9|inventory/status freshness|duplicate review|Repair Priority|Repair Batches|Verification Questions|none new|BUG-04|REPAIR-01|REPAIR-02|REPAIR-03|NFIX-01|NFIX-02|NFIX-03" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/09-04-SUMMARY.md && rg -n "Phase 9|09-01-PLAN|09-02-PLAN|09-03-PLAN|09-04-PLAN|\\$gsd-validate-phase 9|ready for validation" .planning/ROADMAP.md .planning/STATE.md`

No additional test-generation work is required for Phase 9 Nyquist coverage. This phase is a discovery-only planning and bug-board reconciliation slice whose locked acceptance criteria are already expressed as deterministic grep/status audits plus explicit manual judgment gates for duplicate policy, repair ordering, and follow-up separation. The current artifact set satisfies those requirements without touching source, manifests, skills, or runtime files.

## Validation Audit 2026-05-02 - Bookkeeping Recheck

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Generated test files | 0 |

Follow-up recheck during `$gsd-validate-phase 9`: reran all five targeted
Phase 9 validation commands and confirmed they still pass against the current
artifact set. No new automated coverage was needed, no implementation files
were touched, and the remaining work was limited to aligning
`.planning/ROADMAP.md` and `.planning/STATE.md` with the already-complete Phase
9 validation result.

## Validation Sign-Off Checklist

- [x] All planned tasks have an automated, grep, or status verification command.
- [x] Sampling continuity: each plan has at least one targeted verification probe.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated via the Phase-9 targeted grep/status subset on 2026-05-02

**Manual sign-off:** approved 2026-05-02 (no remaining Nyquist gaps; remaining items are confirmed product defects or repair-priority judgments, not missing validation probes)
