---
phase: 6
slug: workspace-maintenance-audit
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-02
---

# Phase 6 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node test runner via `tsx --test` |
| Config file | `package.json`, `tsconfig.json` |
| Quick run command | `npx tsx --test tests/new-workspace-metadata.test.ts tests/remove-workspace-metadata.test.ts tests/workspace-tools.test.ts tests/workstreams-metadata.test.ts tests/workstream-tools.test.ts tests/cleanup-metadata.test.ts tests/cleanup-tools.test.ts tests/update-metadata.test.ts tests/update-tools.test.ts tests/reapply-patches-metadata.test.ts tests/patch-tools.test.ts` |
| Full suite command | `npm test` |
| Estimated runtime | Not recorded. Plans should record actual pass/fail or environment blockers. |

## Sampling Rate

- After every plan: run the targeted command named in that plan when dependencies are installed.
- Before Phase 6 UAT: run at least the targeted Phase 6 subset or document the environment blocker.
- Max feedback latency: one targeted Phase 6 test file, one targeted MCP tool test subset, or one targeted grep/read probe per command-family slice before writing a bug report.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | COV-05, NFIX-01, NFIX-02, NFIX-03 | T-01 | Workspace registry and create/remove defects are documented without mutating real host-global state or workspaces. | regression/read audit | `npx tsx --test tests/new-workspace-metadata.test.ts tests/remove-workspace-metadata.test.ts tests/workspace-tools.test.ts` | yes | covered |
| 6-02-01 | 02 | 2 | COV-05, NFIX-01, NFIX-02, NFIX-03 | T-02 | Workstream defects are documented without changing real `.blueprint/workstreams/` runtime state. | regression/read audit | `npx tsx --test tests/workstreams-metadata.test.ts tests/workstream-tools.test.ts` | yes | covered |
| 6-03-01 | 03 | 3 | COV-05, NFIX-01, NFIX-02, NFIX-03 | T-03 | Cleanup protected-scope defects are documented without moving or deleting phase directories. | regression/read audit | `npx tsx --test tests/cleanup-metadata.test.ts tests/cleanup-tools.test.ts` | yes | covered |
| 6-04-01 | 04 | 4 | COV-05, NFIX-01, NFIX-02, NFIX-03 | T-04 | Update and patch replay defects are documented without mutating installed extension directories or real patch registries. | regression/read audit | `npx tsx --test tests/update-metadata.test.ts tests/update-tools.test.ts tests/reapply-patches-metadata.test.ts tests/patch-tools.test.ts` | yes | covered |
| 6-05-01 | 05 | 5 | COV-05, NFIX-01, NFIX-02, NFIX-03 | T-05 | Phase 6 closeout reconciles bug docs and confirms no-fix boundaries. | status/index audit | `rg -n "Phase 6|new-workspace|remove-workspace|workstreams|cleanup|update|reapply-patches" docs/bugs/INDEX.md` plus `git status --short` | yes | covered |

## Wave 0 Requirements

Targeted infrastructure now covers all Phase 6 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Host-global state boundary | COV-05, BOUND-03, NFIX-01 | Tests can prove tool behavior in fixtures, but the audit must judge docs/manifest/skill/runtime alignment and any untested failure path. | Compare `06-CONTEXT.md` D-01 through D-03 with workspace, update, and patch docs/manifests/MCP tools. File only confirmed or likely defects unless suspected impact is high and uncertainty is explicit. |
| Destructive confirmation sufficiency | COV-05, NFIX-01 | Metadata tests can prove confirmation vocabulary exists but cannot prove every preview names enough target detail. | Inspect command docs/manifests/skill/runtime references for exact preview fields, blockers, pending gates, and report-before-mutate order. |
| Temporary probe cleanup | NFIX-02 | Static tests cannot know whether a plan used disposable probe files. | If any temp probe is used, record the temp path, cleanup command, and post-cleanup evidence in the summary or bug report. |
| Discovery-only boundary | NFIX-01, NFIX-03 | Requires inspecting local git status and separating unrelated changes. | Run `git status --short`; verify intentional changes are limited to `docs/bugs/` and `.planning/phases/06-workspace-maintenance-audit/`. |

## Validation Audit 2026-05-02

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |
| Generated test files | 1 |

| Evidence | Count |
|----------|-------|
| Phase-6 targeted test cases executed | 76 |
| Targeted test failures | 0 |

Recheck (2026-05-02): the existing Phase 6 validation draft was stale because it still marked the phase as `planned` and treated cleanup as fully covered even though Plan 03 had already recorded `BPBUG-002` for missing cleanup behavioral regression coverage. That gap is now closed by `tests/cleanup-tools.test.ts`, which behaviorally covers canonical `cleanup-latest` report writes, required-heading rejection, and the explicit `artifactPaths` digest scope that cleanup uses to ground archival evidence.

The fresh targeted validation run passed with `npx tsx --test tests/new-workspace-metadata.test.ts tests/remove-workspace-metadata.test.ts tests/workspace-tools.test.ts tests/workstreams-metadata.test.ts tests/workstream-tools.test.ts tests/cleanup-metadata.test.ts tests/cleanup-tools.test.ts tests/update-metadata.test.ts tests/update-tools.test.ts tests/reapply-patches-metadata.test.ts tests/patch-tools.test.ts`.

Bug-index validation also passed: `BPBUG-002` and `BPBUG-003` remain the only real `discovery_phase: 6` bug reports, and both are indexed in `docs/bugs/INDEX.md`. At validation time, `git status --short` still reflected the existing Phase 6 discovery artifacts in `docs/bugs/` and `.planning/phases/06-workspace-maintenance-audit/`, and this validation pass added `tests/cleanup-tools.test.ts` plus the current `06-VALIDATION.md` update without touching implementation files.

## Validation Audit 2026-05-02 (Recheck)

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Generated test files | 0 |

| Evidence | Count |
|----------|-------|
| Phase-6 targeted test cases executed | 76 |
| Targeted test failures | 0 |

Recheck on 2026-05-02 confirmed that the earlier cleanup Nyquist gap remains closed. `tests/cleanup-tools.test.ts` is now present in the repo and the targeted Phase 6 subset still passes with `npx tsx --test tests/new-workspace-metadata.test.ts tests/remove-workspace-metadata.test.ts tests/workspace-tools.test.ts tests/workstreams-metadata.test.ts tests/workstream-tools.test.ts tests/cleanup-metadata.test.ts tests/cleanup-tools.test.ts tests/update-metadata.test.ts tests/update-tools.test.ts tests/reapply-patches-metadata.test.ts tests/patch-tools.test.ts`.

The remaining Phase 6 finding, `BPBUG-003`, is a confirmed shared-doc drift defect in `docs/MCP-TOOLS.md`, not a missing-or-partial validation probe. No additional test-generation work is required for Phase 6 Nyquist coverage, and `nyquist_compliant: true` remains accurate for the current artifact set.

## Validation Sign-Off Checklist

- [x] All planned tasks have an automated or grep/status verification command.
- [x] Sampling continuity: each plan has at least one targeted verification probe.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** validated via the Phase-6 targeted test subset on 2026-05-02

**Manual sign-off:** approved 2026-05-02 (cleanup Nyquist gap closed)
