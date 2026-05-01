---
phase: 1
slug: bug-taxonomy-and-reporting-harness
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-01
---

# Phase 1 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Markdown file-read and grep checks |
| **Config file** | none |
| **Quick run command** | `test -f docs/bugs/TEMPLATE.md && test -f docs/bugs/INDEX.md && test -f docs/bugs/BPBUG-000-illustrative-example.md` |
| **Full suite command** | `rg -n "No source, manifest, skill, test, generated asset, or runtime behavior fix was applied|ILLUSTRATIVE ONLY|BPBUG-001|critical\\|high\\|medium\\|low\\|info" docs/bugs` |
| **Estimated runtime** | less than 5 seconds |

## Sampling Rate

- **After every task commit:** Run the quick file-existence command.
- **After every plan wave:** Run the full grep command.
- **Before `$gsd-verify-work`:** Confirm `git status --short` shows only `.planning/` and `docs/bugs/` changes for this phase.
- **Max feedback latency:** 5 seconds.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | BOUND-01,HARN-03,CLASS-01 | T-01 | No source-fix mutation is required. | grep | `rg -n "Blueprint is a Gemini-native|critical\\|high\\|medium\\|low\\|info|confirmed\\|likely\\|suspected" docs/bugs/TEMPLATE.md` | yes after task | pending |
| 01-01-02 | 01 | 1 | BUG-02,EVID-01,EVID-02 | T-01 | Evidence and reproduction sections are required before reports are actionable. | grep | `rg -n "Expected Behavior|Actual Behavior|Evidence|Verification Steps|No Fix Applied" docs/bugs/TEMPLATE.md` | yes after task | pending |
| 01-02-01 | 02 | 1 | HARN-04,D-04,D-05 | T-01 | Index tracks status without mutating runtime state. | grep | `rg -n "Discovery Phase|Impact|Likely Cause|Report|BPBUG-001" docs/bugs/INDEX.md` | yes after task | pending |
| 01-02-02 | 02 | 1 | D-06,D-07,BUG-04 | T-01 | Duplicate and lifecycle statuses are explicit. | grep | `rg -n "new\\|triaged\\|planned\\|in-progress\\|fixed\\|verified\\|closed\\|duplicate\\|closed-invalid" docs/bugs/INDEX.md` | yes after task | pending |
| 01-03-01 | 03 | 2 | D-02,D-08,NFIX-01 | T-01 | Example cannot be mistaken for a real fixed defect. | grep | `rg -n "ILLUSTRATIVE ONLY|not a real Blueprint defect|No Fix Applied" docs/bugs/BPBUG-000-illustrative-example.md` | yes after task | pending |
| 01-03-02 | 03 | 2 | NFIX-03,SLICE-02,SLICE-03 | T-01 | Phase boundary hygiene is verified by repo status. | command | `git status --short` | n/a | pending |

## Wave 0 Requirements

- Existing shell tools cover this docs-only phase: `test`, `rg`, and `git`.
- No test framework or dependency install is required for Phase 1 execution.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Example report reads as illustrative only | D-02 | The distinction is semantic, not just a token check. | Read `docs/bugs/BPBUG-000-illustrative-example.md` and confirm it cannot be mistaken for a confirmed Blueprint defect. |
| Template is usable by later audit phases | HARN-03 | Usability depends on field clarity and authoring instructions. | Read `docs/bugs/TEMPLATE.md` and confirm a later phase can fill every required field without inventing new vocabulary. |

## Validation Sign-Off

- [x] All tasks have automated grep, file-read, or command verification.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency less than 5 seconds.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending execution evidence
