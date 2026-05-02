---
phase: 9
slug: bug-index-priority-review
status: planned
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-02
---

# Phase 9 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Markdown/grep/status checks plus Node test runner if execution needs broader confidence |
| Config file | `package.json`, `tsconfig.json` |
| Quick run command | `rg -n "BPBUG-00[1-9]|Repair Priority|Repair Batches|Verification Questions|Duplicate" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md` |
| Full suite command | `npm test` |
| Estimated runtime | Not recorded. Plans should record actual pass/fail or environment blockers. |

## Sampling Rate

- After every plan: run the targeted grep/status command named in that plan.
- After every wave: run the Phase 9 quick command and inspect `git status --short`.
- Before Phase 9 closeout: run all commands listed in `09-04-PLAN.md`.
- Max feedback latency: one focused grep/status audit per inventory view before editing the next view.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | BUG-04, REPAIR-02, NFIX-01, NFIX-03 | T-01 | Inventory status is reconciled from existing bug reports and repair evidence without source fixes. | inventory grep/status | `rg -n "BPBUG-00[1-9]|status:|discovery_phase:|## Evidence|## Suggested Fix Direction" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md` | yes | planned |
| 9-01-02 | 01 | 1 | REPAIR-02, NFIX-01, NFIX-03 | T-02 | BPBUG-004 status freshness is checked against the quick repair and validation artifacts before ranking. | evidence grep/status | `rg -n "BPBUG-004|350e87a|27 passing tests|status" docs/bugs/INDEX.md docs/bugs/BPBUG-004-*.md .planning/quick/260502-bpbug-004-dist-refresh/260502-bpbug-004-dist-refresh-SUMMARY.md .planning/phases/07-host-packaging-build-hooks-audit/07-VALIDATION.md` | yes | planned |
| 9-02-01 | 02 | 2 | BUG-04, NFIX-01, NFIX-03 | T-03 | Duplicate status is explicit and not inferred from root-cause clusters. | duplicate grep/status | `rg -n "duplicate|Duplicate|canonical|Related Bugs|Root Cause Clusters" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md` | yes | planned |
| 9-03-01 | 03 | 3 | REPAIR-01, REPAIR-02, REPAIR-03, NFIX-01 | T-04 | Repair priority bands and batches reflect active candidates separately from repaired/history items. | priority grep/status | `rg -n "Repair Priority|Now|Next|Later|Repair Batches|Verification Questions" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md` | yes | planned |
| 9-04-01 | 04 | 4 | BUG-04, REPAIR-01, REPAIR-02, REPAIR-03, NFIX-01, NFIX-02, NFIX-03 | T-05 | Closeout records final inventory coverage, open questions, and no-fix boundary. | closeout grep/status | `git status --short && rg -n "Phase 9|BUG-04|REPAIR-01|REPAIR-02|REPAIR-03|NFIX-01|NFIX-02|NFIX-03" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/09-04-SUMMARY.md` | yes | planned |

## Wave 0 Requirements

Existing markdown inventory and grep/status infrastructure covers all Phase 9 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Duplicate judgment | BUG-04 | Grep can prove links exist, but an auditor must compare whether defects and repair paths actually match. | Compare each BPBUG report's expected behavior, actual behavior, impact, likely cause, and suggested fix direction before marking duplicate. |
| Repair priority ordering | REPAIR-01, REPAIR-02 | Priority is a judgment over impact, blast radius, leverage, and current status. | Read all BPBUG reports and Phase 9 inventory review; confirm `Now`, `Next`, and `Later` rationale is explicit. |
| Open-question separation | REPAIR-03 | Requires distinguishing evidence gaps from confirmed defects and feature ideas. | Verify each open question names an evidence gap or verification follow-up, not a confirmed bug or feature request. |
| Discovery-only boundary | NFIX-01, NFIX-02, NFIX-03 | Requires local git status and allowed-write review. | Run `git status --short`; confirm changes are limited to `.planning/` and `docs/bugs/`. |

## Validation Sign-Off

- [ ] All tasks have automated, grep, or status verification.
- [ ] Sampling continuity: no 3 consecutive tasks lack verification.
- [x] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] `nyquist_compliant: true` set after execution validation passes.

**Approval:** pending Phase 9 execution
