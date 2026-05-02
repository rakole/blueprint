---
phase: 08-cross-cut-drift-and-regression-gaps
plan: 03
subsystem: concern-triage
tags: [blueprint, concerns, repo-root, security, filesystem, impact]
requires:
  - phase: 08-cross-cut-drift-and-regression-gaps
    plan: 02
    provides: Regression-gap ledger and focused risk posture
provides:
  - Concern triage artifact
  - BPBUG-005 covering repo-root validation drift
  - Phase 8 concern-map notes for Phase 9 performance review
affects: [phase-8, docs/bugs, planning]
tech-stack:
  added: []
  patterns: [concern-led triage, disposable proof probe, cross-cutting runtime guard bug]
key-files:
  created:
    - .planning/phases/08-cross-cut-drift-and-regression-gaps/08-CONCERN-TRIAGE.md
    - .planning/phases/08-cross-cut-drift-and-regression-gaps/08-03-SUMMARY.md
    - docs/bugs/BPBUG-005-repo-root-guard-accepts-any-git-entry.md
  modified:
    - docs/bugs/INDEX.md
key-decisions:
  - "Plan 03 recorded BPBUG-005 because the shared repo-root guard accepts a fake `.git` entry and therefore violates a cross-cutting runtime safety boundary."
patterns-established:
  - "Concern-map execution should use a disposable proof probe only when static source and tests leave one material ambiguity unresolved."
requirements-completed: [CLASS-04, EVID-04, COV-08, NFIX-01, NFIX-02, NFIX-03]
duration: 18min
completed: 2026-05-02T11:34:36Z
---

# Phase 8 Plan 03: Concern Map Schema Parser Filesystem And Scaling Triage Summary

**Plan 03 converted the concern map into a concrete triage artifact, confirmed one new cross-cutting bug in the shared repo-root guard, and kept the remaining parser, schema, security, and scaling leads as aligned results or explicit risk notes.**

## Accomplishments

- Created `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-CONCERN-TRIAGE.md` with the required concern table and decision coverage for `D-09`, `D-10`, `D-11`, `D-12`, `D-17`, `D-18`, `D-19`, and `D-20`.
- Confirmed `BPBUG-005` and added it to `docs/bugs/INDEX.md` after proving that `ensureRepoRoot()` accepts a temporary directory containing a fake `.git` file.
- Kept the `BLUEPRINT_TEST_*` workspace env toggles, Markdown parsing cost, large-diff processing, and large-artifact regex passes as risk notes rather than overstating them as confirmed defects.
- Confirmed prompt-boundary rejection, path-containment hardening, workspace mutation blockers, and impact low-confidence behavior remain aligned in the current tree.

## Verification

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| Concern-triage suite | `npx tsx --test tests/artifact-contracts.test.ts tests/artifact-validate-runtime.test.ts tests/impact-tools.test.ts tests/security-hardening.test.ts tests/workspace-tools.test.ts` | pass | 115 tests passed on 2026-05-02 across artifact validation, impact analysis, security hardening, and workspace behavior. |
| Repo-root proof probe | `tmpdir=$(mktemp -d); printf 'not-a-real-gitdir\n' > "$tmpdir/.git"; npx tsx -e 'import { ensureRepoRoot } from "./src/mcp/tools/artifacts.ts"; const dir = process.argv[1]!; (async () => { const result = await ensureRepoRoot(dir); console.log(result); })().catch((error) => { console.error(error); process.exit(1); });' "$tmpdir"; rm -rf "$tmpdir"` | pass | The probe echoed the temporary directory path instead of rejecting it, which confirmed the weak shared guard recorded in BPBUG-005. |
| Concern triage structure | `rg -n "Concern|Evidence Checked|Impact Class|Disposition|Related Bug Or Note" .planning/phases/08-cross-cut-drift-and-regression-gaps/08-CONCERN-TRIAGE.md` | pass | The triage artifact contains the required headers and concern rows. |
| Discovery-only boundary | `git status --short` | pass | Plan-owned writes remain under `.planning/` and `docs/bugs/`; the disposable `.git` probe directory was removed immediately after use. |

## Bug Reports

- `BPBUG-005` - Repo-root guard accepts any `.git` entry as a valid repository.

## Decisions Made

- `D-09` triaged the parser, schema, filesystem, security, and scaling leads explicitly.
- `D-10` and `D-12` kept only the repo-root guard at bug severity because it has a concrete contract violation and a reproducible proof probe.
- `D-11` and `D-19` used one disposable probe only after source review and passing tests still left the repo-root guard ambiguous.
- `D-17`, `D-18`, and `D-20` preserved the prior evidence bar, no-fix boundary, and implemented-only routing posture.

## Issues Encountered

- The concern map surfaced several real scaling and tech-debt risks, but most of them remain performance or maintainability notes rather than current correctness bugs.

## Self-Check: PASSED

- `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-CONCERN-TRIAGE.md` exists.
- `docs/bugs/BPBUG-005-repo-root-guard-accepts-any-git-entry.md` exists and is indexed.
- The only disposable probe used for this plan was cleaned up immediately.
