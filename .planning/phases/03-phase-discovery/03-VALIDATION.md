---
phase: 03
slug: phase-discovery
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
---

# Phase 03 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` via `tsx --test` |
| **Config file** | `none` |
| **Quick run command** | `tsx --test tests/phase-discovery-tools.test.ts tests/phase-discovery-discuss.test.ts tests/phase-discovery-research.test.ts tests/phase-discovery-ui.test.ts tests/command-catalog.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run that task's exact `<automated>` command from its plan.
- **After every completed plan:** Run `tsx --test tests/phase-discovery-tools.test.ts tests/phase-discovery-discuss.test.ts tests/phase-discovery-research.test.ts tests/phase-discovery-ui.test.ts tests/command-catalog.test.ts`
- **After final wave / phase gate:** Run `npm test`
- **Before `/blu:plan-phase` exposure in runtime routing:** Quick suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | LIFE-01 | T-03-01 | Phase resolution and context tools return deterministic phase scope and missing-artifact signals | unit/integration | `tsx --test tests/phase-discovery-tools.test.ts` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | LIFE-01 | T-03-01 | `discuss-phase` manifest and skill flow write context artifacts with overwrite confirmation | contract/integration | `tsx --test tests/phase-discovery-discuss.test.ts` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | LIFE-02 | T-03-02 | `research-phase` routes through phase tooling and writes research artifact with deterministic status updates | contract | `tsx --test tests/phase-discovery-research.test.ts` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | LIFE-02 | T-03-02 | research-status checks block invalid/ambiguous phase targeting and preserve safe fallback guidance | integration | `tsx --test tests/phase-discovery-tools.test.ts tests/phase-discovery-research.test.ts` | ✅ | ⬜ pending |
| 03-03-01 | 03 | 3 | LIFE-03 | T-03-03 | `ui-phase` enforces config-aware UI gate and records explicit UI-skip rationale when appropriate | contract/integration | `tsx --test tests/phase-discovery-ui.test.ts` | ✅ | ⬜ pending |
| 03-03-02 | 03 | 3 | LIFE-01, LIFE-02, LIFE-03 | T-03-03 | Runtime catalog and docs expose only shipped Phase 3 discovery commands as implemented | regression | `tsx --test tests/command-catalog.test.ts tests/command-contract-docs.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prompt clarity for overwrite confirmations in discuss/research/ui flows | LIFE-01, LIFE-02, LIFE-03 | Prompt wording quality is not fully captured by unit tests | Run `/blu:discuss-phase`, `/blu:research-phase`, and `/blu:ui-phase` in a seeded fixture and verify each confirmation describes impacted artifact paths and choices explicitly |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
