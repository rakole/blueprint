---
phase: 5
slug: review-quality-impact-shipping-audit
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-02
---

# Phase 5 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node test runner via `tsx --test` |
| Config file | `package.json`, `tsconfig.json` |
| Quick run command | `npx tsx --test tests/code-review-metadata.test.ts tests/audit-fix-metadata.test.ts tests/impact-metadata.test.ts tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts` |
| Full suite command | `npm test` |
| Estimated runtime | Not recorded. Plans should record actual pass/fail or environment blockers. |

## Sampling Rate

- After every plan: run the targeted command named in that plan when dependencies are installed.
- Before Phase 5 UAT: run at least the targeted Phase 5 subset or document the environment blocker.
- Max feedback latency: one targeted Phase 5 test file or one targeted grep/read probe per command-family slice before writing a bug report.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | COV-04, NFIX-01, NFIX-02, NFIX-03 | T-01 | Review artifact defects are documented without changing review runtime behavior. | regression/read audit | `npx tsx --test tests/code-review-metadata.test.ts tests/code-review-slice.test.ts tests/secure-phase-metadata.test.ts tests/secure-phase-slice.test.ts tests/review-metadata.test.ts tests/review-slice.test.ts tests/ui-review-metadata.test.ts tests/ui-review-slice.test.ts` | yes | covered |
| 5-02-01 | 02 | 2 | COV-04, NFIX-01, NFIX-02, NFIX-03 | T-02 | Remediation/docs mutation safety is audited without applying source or docs fixes. | regression/read audit | `npx tsx --test tests/code-review-fix-metadata.test.ts tests/code-review-fix-slice.test.ts tests/audit-fix-metadata.test.ts tests/audit-fix-slice.test.ts tests/docs-update-metadata.test.ts tests/review-docs-safety-regression.test.ts` | yes | covered |
| 5-03-01 | 03 | 3 | COV-04, NFIX-01, NFIX-02, NFIX-03 | T-03 | Impact analysis is audited without mutating `.blueprint/impact/` except in disposable/no-write contexts. | regression/read audit | `npx tsx --test tests/impact-metadata.test.ts tests/impact-tools.test.ts tests/impact-fixtures.test.ts` | yes | covered |
| 5-04-01 | 04 | 4 | COV-04, NFIX-01, NFIX-02, NFIX-03 | T-04 | High-risk git workflows are audited without branch, PR, remote, or history mutation in the main worktree. | metadata/read audit | `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts` | yes | covered |
| 5-05-01 | 05 | 5 | COV-04, NFIX-01, NFIX-02, NFIX-03 | T-05 | Phase 5 closeout reconciles bug docs and confirms no-fix boundaries. | status/index audit | `rg -n "Phase 5|code-review|audit-fix|docs-update|impact|pr-branch|ship|undo" docs/bugs/INDEX.md` plus `git status --short` | yes | covered |

## Wave 0 Requirements

Existing infrastructure covers all Phase 5 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Evidence quality above schema validity | COV-04, EVID-01, EVID-03 | Static schemas cannot fully judge whether review rationale is specific enough to support later repair work. | Compare review artifacts and contracts against D-01 through D-03 in `05-CONTEXT.md`; file only confirmed or likely defects unless suspected impact is high and uncertainty is explicit. |
| High-risk mutation preview sufficiency | COV-04, NFIX-01 | Metadata tests can prove the contract exists but cannot prove every preview is reviewable enough. | Inspect `pr-branch`, `ship`, and `undo` docs/manifests/skill/runtime/report contracts for exact pre-mutation evidence, dirty-tree blockers, confirmation gates, and manual fallback paths. |
| Temporary probe cleanup | NFIX-02 | Static tests cannot know whether a plan used disposable probe files. | If any temp probe is used, record the temp path, cleanup command, and post-cleanup evidence in the summary or bug report. |
| Discovery-only boundary | NFIX-01, NFIX-03 | Requires inspecting local git status and separating unrelated changes. | Run `git status --short`; verify intentional changes are limited to `docs/bugs/` and `.planning/phases/05-review-quality-impact-shipping-audit/`. |

## Validation Audit 2026-05-02

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Generated test files | 0 |

| Evidence | Count |
|----------|-------|
| Phase-5 targeted test cases executed | 194 |
| Targeted test failures | 0 |

Recheck (2026-05-02): confirmed the existing Per-Task Verification Map covers all five Phase 5 plans with existing automated commands plus manual review checks for evidence quality, high-risk mutation previews, temporary probe cleanup, and the discovery-only boundary. The fresh targeted validation run passed with `npx tsx --test tests/code-review-metadata.test.ts tests/code-review-slice.test.ts tests/secure-phase-metadata.test.ts tests/secure-phase-slice.test.ts tests/review-metadata.test.ts tests/review-slice.test.ts tests/ui-review-metadata.test.ts tests/ui-review-slice.test.ts tests/code-review-fix-metadata.test.ts tests/code-review-fix-slice.test.ts tests/audit-fix-metadata.test.ts tests/audit-fix-slice.test.ts tests/docs-update-metadata.test.ts tests/review-docs-safety-regression.test.ts tests/impact-metadata.test.ts tests/impact-tools.test.ts tests/impact-fixtures.test.ts tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts`.

Bug-index validation also passed: `docs/bugs/BPBUG-001-ship-undo-report-contracts-underconstrained.md` is the only real `discovery_phase: 5` bug report, it is indexed in `docs/bugs/INDEX.md`, and the no-fix sentence is present in both the bug report and index. `git status --short` was clean before validation artifact updates.

## Validation Sign-Off

- [x] All planned tasks have an automated or grep/status verification command.
- [x] Sampling continuity: each plan has at least one targeted verification probe.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated via the Phase-5 targeted test subset on 2026-05-02

**Manual sign-off:** approved 2026-05-02 (close validation loop)
