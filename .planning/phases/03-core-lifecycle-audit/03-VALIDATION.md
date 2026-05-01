---
phase: 3
slug: core-lifecycle-audit
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-01
---

# Phase 3 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node test runner via `tsx --test` |
| Config file | `package.json`, `tsconfig.json` |
| Quick run command | `npx tsx --test tests/phase-discovery-discuss.test.ts tests/phase-discovery-research.test.ts tests/phase-discovery-ui.test.ts tests/phase-planning-tools.test.ts tests/execute-phase-summary-tools.test.ts tests/phase-validation-slice.test.ts tests/add-tests-slice.test.ts` |
| Full suite command | `npm test` |
| Estimated runtime | Not recorded (see Phase 3 summaries for pass/fail evidence). |

## Sampling Rate

- After every plan: run the targeted command named in that plan when dependencies are installed.
- Before Phase 3 UAT: run at least the targeted lifecycle subset or document the environment blocker.
- Max feedback latency: one targeted lifecycle test file or one targeted grep/read probe per command-flow slice before writing a bug report.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | COV-02, NFIX-01, NFIX-02, NFIX-03 | T-01 | Discovery audit writes only bug docs and planning summaries. | regression/read audit | `npx tsx --test tests/phase-discovery-discuss.test.ts tests/phase-discovery-research.test.ts tests/phase-discovery-ui.test.ts tests/phase-discovery-tools.test.ts` | yes | covered |
| 3-02-01 | 02 | 2 | COV-02, NFIX-01, NFIX-02, NFIX-03 | T-02 | Plan-phase audit documents defects instead of changing plan runtime code or schemas. | regression/read audit | `npx tsx --test tests/phase-planning-tools.test.ts tests/phase-plan-validation-hardening.test.ts tests/phase-plan-write-locking.test.ts tests/plan-phase-metadata.test.ts` | yes | covered |
| 3-03-01 | 03 | 3 | COV-02, NFIX-01, NFIX-02, NFIX-03 | T-03 | Execute-phase audit does not perform repo implementation work. | regression/read audit | `npx tsx --test tests/execute-phase-summary-tools.test.ts tests/execute-phase-metadata.test.ts` | yes | covered |
| 3-04-01 | 04 | 4 | COV-02, NFIX-01, NFIX-02, NFIX-03 | T-04 | Validation/UAT audit preserves summary-backed evidence and documents defects only. | regression/read audit | `npx tsx --test tests/phase-validation-slice.test.ts tests/validate-phase-tools.test.ts tests/verify-work-roadmap-sync.test.ts tests/validate-phase-metadata.test.ts tests/verify-work-metadata.test.ts` | yes | covered |
| 3-05-01 | 05 | 5 | COV-02, NFIX-01, NFIX-02, NFIX-03 | T-05 | Add-tests/closeout audit does not add or edit repo tests during discovery. | regression/status audit | `npx tsx --test tests/add-tests-slice.test.ts tests/add-tests-metadata.test.ts` plus `git status --short` | yes | covered |

## Wave 0 Requirements

Existing infrastructure covers all Phase 3 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Defect threshold for material lifecycle-state risk | COV-02, EVID-03 | Requires judgment over user impact and lifecycle-state risk. | Compare evidence against D-08 through D-11 in `03-CONTEXT.md`; classify only confirmed or likely defects unless suspected impact is high and uncertainty is explicit. |
| Temporary probe cleanup | NFIX-02 | Static tests cannot know whether a plan used disposable probe files. | If any temp probe is used, record the temp path, cleanup command, and post-cleanup evidence in the summary or bug report. |
| Discovery-only boundary | NFIX-01, NFIX-03 | Requires inspecting local git status and separating unrelated changes. | Run `git status --short`; verify intentional changes are limited to `docs/bugs/` and `.planning/phases/03-core-lifecycle-audit/`. |

## Validation Audit 2026-05-01

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

| Evidence | Count |
|----------|-------|
| Phase-3 targeted test cases executed | 166 |
| Targeted test failures | 0 |

## Validation Sign-Off

- [x] All tasks have an automated or grep/status verification command.
- [x] Sampling continuity: each plan has at least one targeted verification probe.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated via the Phase-3 targeted test subset on 2026-05-01

**Manual sign-off:** approved 2026-05-01 (close validation loop)
