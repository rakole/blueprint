---
phase: 4
slug: roadmap-capture-lightweight-audit
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-01
---

# Phase 4 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node test runner via `tsx --test` |
| Config file | `package.json`, `tsconfig.json` |
| Quick run command | `npx tsx --test tests/roadmap-tools.test.ts tests/capture-tools.test.ts tests/lightweight-execution-regression.test.ts tests/debug-metadata.test.ts` |
| Full suite command | `npm test` |
| Estimated runtime | Not recorded. Plans should record actual pass/fail or environment blockers. |

## Sampling Rate

- After every plan: run the targeted command named in that plan when dependencies are installed.
- Before Phase 4 UAT: run at least the targeted Phase 4 subset or document the environment blocker.
- Max feedback latency: one targeted Phase 4 test file or one targeted grep/read probe per command-family slice before writing a bug report.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | COV-03, NFIX-01, NFIX-02, NFIX-03 | T-01 | Roadmap mutation defects are documented without changing runtime roadmap behavior. | regression/read audit | `npx tsx --test tests/roadmap-tools.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/remove-phase-metadata.test.ts tests/plan-milestone-gaps-metadata.test.ts` | yes | planned |
| 4-02-01 | 02 | 2 | COV-03, NFIX-01, NFIX-02, NFIX-03 | T-02 | Milestone reports and carry-forward routing are audited without closing or rewriting a real milestone. | regression/read audit | `npx tsx --test tests/audit-milestone-tools.test.ts tests/audit-milestone-metadata.test.ts tests/complete-milestone-metadata.test.ts tests/milestone-summary-metadata.test.ts tests/new-milestone-metadata.test.ts` | yes | planned |
| 4-03-01 | 03 | 3 | COV-03, NFIX-01, NFIX-02, NFIX-03 | T-03 | Capture indexes and backlog promotion are audited without mutating runtime `.blueprint/` capture state. | regression/read audit | `npx tsx --test tests/capture-tools.test.ts tests/note-metadata.test.ts tests/add-todo-metadata.test.ts tests/check-todos-metadata.test.ts tests/add-backlog-metadata.test.ts tests/review-backlog-metadata.test.ts tests/explore-metadata.test.ts` | yes | planned |
| 4-04-01 | 04 | 4 | COV-03, NFIX-01, NFIX-02, NFIX-03 | T-04 | Fast and quick boundaries are audited without performing repo implementation work. | regression/read audit | `npx tsx --test tests/fast-metadata.test.ts tests/quick-metadata.test.ts tests/lightweight-execution-regression.test.ts` | yes | planned |
| 4-05-01 | 05 | 5 | COV-03, NFIX-01, NFIX-02, NFIX-03 | T-05 | Debug reporting and closeout are audited without attempting fixes or silently capturing follow-up todos. | regression/status audit | `npx tsx --test tests/debug-metadata.test.ts tests/lightweight-execution-regression.test.ts` plus `git status --short` | yes | planned |

## Wave 0 Requirements

Existing infrastructure covers all Phase 4 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preview parity and destructive-gate severity | COV-03, EVID-03 | Requires judgment over whether preview/apply drift or missing second confirmations create user-impacting roadmap risk. | Compare evidence against D-01 through D-04 in `04-CONTEXT.md`; classify only confirmed or likely defects unless suspected impact is high and uncertainty is explicit. |
| Temporary probe cleanup | NFIX-02 | Static tests cannot know whether a plan used disposable probe files. | If any temp probe is used, record the temp path, cleanup command, and post-cleanup evidence in the summary or bug report. |
| Discovery-only boundary | NFIX-01, NFIX-03 | Requires inspecting local git status and separating unrelated changes. | Run `git status --short`; verify intentional changes are limited to `docs/bugs/` and `.planning/phases/04-roadmap-capture-lightweight-audit/`. |

## Validation Sign-Off

- [x] All planned tasks have an automated or grep/status verification command.
- [x] Sampling continuity: each plan has at least one targeted verification probe.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** planned for Phase 4 execution.
