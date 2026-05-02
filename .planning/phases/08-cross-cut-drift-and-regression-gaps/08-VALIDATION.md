---
phase: 8
slug: cross-cut-drift-and-regression-gaps
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-02
---

# Phase 8 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node test runner via `tsx --test`; package scripts through npm |
| Config file | `package.json`, `tsconfig.json` |
| Quick run command | `npx tsx --test tests/command-contract-docs.test.ts tests/command-catalog.test.ts tests/extension-runtime-contracts.test.ts tests/built-schema-assets.test.ts tests/artifact-contracts.test.ts tests/impact-tools.test.ts tests/security-hardening.test.ts` |
| Full suite command | `npm test` |
| Estimated runtime | Not recorded. Plans should record pass/fail, skip, or environment blockers exactly. |

## Sampling Rate

- After every Phase 8 plan: run the targeted command named in that plan or document the blocker.
- Before Phase 8 UAT: run the Phase 8 quick command above or document why a subset is the only safe local signal.
- Max feedback latency: one targeted contract/regression command, one focused static audit, or one disposable no-write probe before a bug report is written.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | CLASS-04, EVID-04, COV-07, NFIX-01, NFIX-02, NFIX-03 | T-01 | Drift findings compare expected and actual contract layers without mutating runtime assets. | contract/read audit | `npx tsx --test tests/command-contract-docs.test.ts tests/command-catalog.test.ts tests/extension-runtime-contracts.test.ts` | yes | covered |
| 8-02-01 | 02 | 1 | CLASS-04, COV-07, NFIX-01, NFIX-02, NFIX-03 | T-02 | Regression-gap bugs are limited to high-risk missing guards and prior recurrence. | coverage/read audit | `npx tsx --test tests/cleanup-tools.test.ts tests/cleanup-metadata.test.ts tests/built-schema-assets.test.ts tests/built-assets-smoke.test.ts tests/impact-tools.test.ts` | yes | covered |
| 8-03-01 | 03 | 2 | CLASS-04, EVID-04, COV-08, NFIX-01, NFIX-02, NFIX-03 | T-03 | Concern-map leads become bugs only with concrete exploitability, runtime impact, or contract mismatch. | concern/source audit | `npx tsx --test tests/artifact-contracts.test.ts tests/artifact-validate-runtime.test.ts tests/impact-tools.test.ts tests/security-hardening.test.ts tests/workspace-tools.test.ts` | yes | covered |
| 8-04-01 | 04 | 3 | CLASS-04, EVID-04, COV-07, COV-08, NFIX-01, NFIX-02, NFIX-03 | T-04 | Bug clusters preserve individual bug identity and do not duplicate defects. | index/report audit | `rg -n "Related Bugs|root-cause|cluster|BPBUG-00[1-9]" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md` | yes | covered |
| 8-05-01 | 05 | 4 | CLASS-04, EVID-04, COV-07, COV-08, NFIX-01, NFIX-02, NFIX-03 | T-05 | Closeout confirms Phase 8 writes are limited to planning artifacts and bug docs. | status/index audit | `git status --short && rg -n "Phase 8|No source, manifest, skill, test, generated asset, or runtime behavior fix was applied" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md` | yes | covered |

## Wave 0 Requirements

Existing infrastructure covers all Phase 8 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bug filing threshold | CLASS-04, EVID-04, COV-07, COV-08 | Existing tests can expose drift, but the auditor must decide whether risk justifies a bug or a non-bug note. | For every candidate, cite expected and actual evidence, classify confidence, and state uncertainty before writing a bug report. |
| Cluster identity and no-duplicate judgment | CLASS-04, EVID-04, COV-07, COV-08 | Grep checks can prove cluster notes exist, but an auditor still has to judge whether two reports share the same defect and repair path. | Compare BPBUG-001 through BPBUG-005 evidence and repair direction; keep reports distinct unless both the defect and repair path match. |
| Concern-map proof probe and cleanup | COV-08, NFIX-02 | Existing tests narrow the candidate set, but the repo-root false-positive path still requires a disposable no-write probe to confirm a live contract violation. | Re-run the fake-`.git` probe from `BPBUG-005`, confirm it reproduces, and remove the temp directory immediately after the command. |
| Discovery-only boundary | NFIX-01, NFIX-02, NFIX-03 | Requires inspecting local git status and separating probe output from kept fixes. | Run `git status --short`; confirm intentional changes are limited to `.planning/` and `docs/bugs/`. |

## Validation Audit 2026-05-02

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Generated test files | 0 |

| Evidence | Count |
|----------|-------|
| Phase-8 targeted commands executed | 5 |
| Phase-8 targeted test cases executed | 297 |
| Targeted test failures | 0 |

Recheck (2026-05-02): the existing Phase 8 validation draft was stale. It still marked the phase `planned` and left all five verification rows `pending` even though Plans 01 through 05 had already completed, written summaries, and recorded targeted evidence for every discovery slice.

Fresh targeted reruns passed for the three executable Phase 8 subsets:

- `npx tsx --test tests/command-contract-docs.test.ts tests/command-catalog.test.ts tests/extension-runtime-contracts.test.ts` -> 103 passing tests, 0 failures.
- `npx tsx --test tests/cleanup-tools.test.ts tests/cleanup-metadata.test.ts tests/built-schema-assets.test.ts tests/built-assets-smoke.test.ts tests/impact-tools.test.ts` -> 79 passing tests, 0 failures.
- `npx tsx --test tests/artifact-contracts.test.ts tests/artifact-validate-runtime.test.ts tests/impact-tools.test.ts tests/security-hardening.test.ts tests/workspace-tools.test.ts` -> 115 passing tests, 0 failures.

The plan-04 and plan-05 grep/status audits also remain aligned: `docs/bugs/INDEX.md` and `docs/bugs/BPBUG-001` through `docs/bugs/BPBUG-005` still contain the required cluster, related-bug, Phase 8, and no-fix evidence; `git status --short` remains limited to `.planning/` and `docs/bugs/` artifacts rather than implementation or runtime files.

`BPBUG-005` still reproduces with the disposable fake-`.git` probe, which confirms a current runtime defect in the shared repo-root guard. That is not a missing Nyquist probe for Phase 8 itself. Phase 8's requirement was to triage concern-map leads into bugs only when there is concrete source, test, or probe evidence. The current validation surface already provides that: the focused plan-03 test subset stays green for the aligned concerns, and the manual/probe path explicitly confirms the one real concern-map bug without mutating implementation. No additional test-generation work is required to mark the Phase 8 discovery workflow as Nyquist-compliant.

## Validation Sign-Off Checklist

- [x] All planned tasks have an automated, grep, or status verification command.
- [x] Sampling continuity: each plan has at least one targeted verification probe.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated via the Phase-8 targeted subsets, grep audits, and disposable proof probe on 2026-05-02

**Manual sign-off:** approved 2026-05-02 (`BPBUG-005` remains a confirmed product defect, not a missing validation probe)
