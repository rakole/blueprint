---
phase: 2
slug: bootstrap-router-config-audit
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-01
---

# Phase 2 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node test runner via `tsx --test` |
| Config file | `package.json`, `tsconfig.json` |
| Quick run command | `npx tsx --test tests/help-progress-health.test.ts tests/command-catalog.test.ts` |
| Full suite command | `npm test` |
| Estimated runtime | Unknown; executor records observed runtime when run. |

## Sampling Rate

- After every plan: run the targeted command named in that plan when dependencies are installed.
- Before Phase 2 UAT: run at least the targeted router/catalog/config test subset or document the environment blocker.
- Max feedback latency: one targeted test file or one targeted grep/read probe per audit surface before writing a bug report.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | COV-01, NFIX-01, NFIX-03 | T-01 | Router audit writes only bug docs and planning summaries. | regression/read audit | `npx tsx --test tests/help-progress-health.test.ts tests/next.test.ts` | yes | pending |
| 2-02-01 | 02 | 1 | COV-01, NFIX-01, NFIX-03 | T-02 | Catalog audit does not repair manifests, skills, tools, docs, or tests. | regression/read audit | `npx tsx --test tests/command-catalog.test.ts tests/command-contract-docs.test.ts` | yes | pending |
| 2-03-01 | 03 | 1 | COV-01, NFIX-01, NFIX-03 | T-03 | Bootstrap/config audit writes only bug docs and planning summaries. | regression/read audit | `npx tsx --test tests/new-project.test.ts tests/map-codebase.test.ts tests/help-progress-health.test.ts` | yes | pending |
| 2-04-01 | 04 | 2 | COV-01, NFIX-01, NFIX-02, NFIX-03 | T-04 | Closeout validates bug index and no-fix boundary. | grep/status audit | `git status --short` plus `rg -n "Phase 2" docs/bugs/INDEX.md` | yes | pending |

## Wave 0 Requirements

Existing infrastructure covers all Phase 2 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Classification of docs/source drift as real bug versus acceptable delta | COV-01, EVID-03 | Requires judgment over materiality and user impact. | Compare cited docs/source/test evidence against D-06 through D-08 in `02-CONTEXT.md`; classify only confirmed or likely defects. |
| Discovery-only boundary | NFIX-01, NFIX-02, NFIX-03 | Requires inspecting local git status and any temporary probes. | Run `git status --short`; verify only `docs/bugs/` and `.planning/` Phase 2 artifacts changed, and record probe cleanup in summaries/bug docs. |

## Validation Sign-Off

- [x] All tasks have an automated or grep/status verification command.
- [x] Sampling continuity: each plan has at least one targeted verification probe.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending execution evidence
