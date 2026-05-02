---
phase: 07-host-packaging-build-hooks-audit
plan: 04
subsystem: install-and-clean-home-smoke-readiness
tags: [blueprint, packaging, install, smoke, host-behavior, docker]
requires:
  - phase: 07-host-packaging-build-hooks-audit
    provides: Plans 01-03 packaging, build, and hook audit evidence
provides:
  - Clean-home smoke audit evidence for Gemini and Tabnine host flows
  - Confirmation that no confirmed or likely Plan 04 install-readiness defect was found
  - Explicit Docker and optional host-prerequisite blocker notes for deferred containerized integration
affects: [phase-7, packaging, install, docs/bugs]
tech-stack:
  added: []
  patterns: [smoke-script audit, blocker-classification for optional host integration]
key-files:
  created:
    - .planning/phases/07-host-packaging-build-hooks-audit/07-04-SUMMARY.md
  modified: []
key-decisions:
  - "No bug report was created because the clean-home smoke script, fake-CLI tests, and integration harness contracts aligned; the containerized install run was deferred solely because Docker is unavailable in this environment."
patterns-established:
  - "Install-readiness audits should separate real packaging defects from environment blockers such as missing Docker or optional host installer configuration."
requirements-completed: [COV-06, NFIX-01, NFIX-02, NFIX-03]
duration: 5min
completed: 2026-05-02T09:58:47Z
---

# Phase 7 Plan 04: Install And Clean-Home Smoke Readiness Summary

**Blueprint's clean-home smoke and install harness contracts aligned with the packaged host bundle, and no confirmed or likely install-readiness defect was found; the only blocker was local Docker unavailability for the containerized integration run.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-02T09:53:30Z
- **Completed:** 2026-05-02T09:58:47Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Verified `scripts/gemini-clean-home-smoke.mjs` enforces manifest and built-MCP preflight checks, prepares a clean host home, runs validate/link/list in the expected order, verifies the listed extension identity and path, and preserves the clean home on failure.
- Confirmed `tests/gemini-clean-home-smoke.test.ts` exercises both Gemini and Tabnine fake-CLI flows, including validate/link/list ordering, clean-home environment reuse, success output, and failure preservation.
- Audited `tests/extension-install.integration.ts` for staged shipped-path inclusion, excluded repo-only paths, required installed paths, link/install mode coverage, install metadata checks, installed MCP import, hook containment, and optional live Gemini and Tabnine gating.
- Ran `npx tsx --test tests/gemini-clean-home-smoke.test.ts`; both clean-home smoke tests passed.
- Confirmed the containerized install integration path was blocked by missing Docker in this environment, so `npm run test:integration:extension` was not run and no failure was treated as a Blueprint defect.
- Recorded that `GEMINI_API_KEY` is present while `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND` is absent; these optional host prerequisites did not affect the main blocker classification because Docker was unavailable first.

## Task Commits

Task 1 audited the clean-home smoke script and fake-CLI coverage. Task 2 reviewed the containerized install harness and checked the local runtime prerequisites. Task 3 recorded the no-defect outcome plus the Docker blocker in this summary.

## Files Created/Modified

- `.planning/phases/07-host-packaging-build-hooks-audit/07-04-SUMMARY.md` - Records Plan 04 audit evidence, smoke results, and blocker classification.

## Evidence Reviewed

| Surface | Evidence |
|---------|----------|
| Clean-home smoke script | `scripts/gemini-clean-home-smoke.mjs` accepts `--host`, `--repo`, `--home`, `--cli`, and `--keep-home`; requires the host manifest and `dist/mcp/server.js`; builds a clean host home env; runs validate, link, and list; verifies the listed extension path; and preserves the home on failure. |
| Fake-CLI smoke tests | `tests/gemini-clean-home-smoke.test.ts` covers both hosts, validate/link/list ordering, PTY-backed list handling, clean-home env reuse, success output, and failure preservation. |
| Integration harness | `tests/extension-install.integration.ts` stages tracked shipped paths only, excludes `src`, `node_modules`, `.planning`, and `.git`, checks required installed paths, validates install metadata, imports the installed MCP server, and verifies hook targets stay inside the bundle. |
| Optional host gates | The integration harness treats `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND` and `GEMINI_API_KEY` as explicit prerequisites for optional host flows instead of defaulting them into product defects. |

## Verification

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| Install/smoke contracts are visible in source | `rg -n "extensions validate|extensions link|extensions install|extensions list|BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND|GEMINI_API_KEY|excludedStagePaths|requiredInstalledPaths|Smoke home preserved" scripts/gemini-clean-home-smoke.mjs tests/gemini-clean-home-smoke.test.ts tests/extension-install.integration.ts` | pass | The script and tests contain the expected packaging, cleanup, staging, and optional-gate logic. |
| Clean-home fake-CLI smoke passes | `npx tsx --test tests/gemini-clean-home-smoke.test.ts` | pass | 2 tests passed across Gemini and Tabnine fake-CLI flows. |
| Docker prerequisite for containerized install is available | `docker info >/dev/null 2>&1 && echo DOCKER_OK || echo DOCKER_MISSING` | blocked | Returned `DOCKER_MISSING`, so `npm run test:integration:extension` could not be executed in this environment. |
| Optional Tabnine installer gate | `[ -n "$BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND" ] && echo TABNINE_INSTALL_SET || echo TABNINE_INSTALL_MISSING` | blocked | Returned `TABNINE_INSTALL_MISSING`; Tabnine integration would remain optional even if Docker were present. |
| Optional live Gemini gate | `[ -n "$GEMINI_API_KEY" ] && echo GEMINI_API_KEY_SET || echo GEMINI_API_KEY_MISSING` | pass | Returned `GEMINI_API_KEY_SET`, but the live/containerized Gemini path still could not run because Docker was unavailable. |
| Discovery-only boundary preserved | `git status --short` | pass | Remaining intentional changes were limited to `docs/bugs/INDEX.md`, `docs/bugs/BPBUG-004-...md`, and Phase 7 summary files. |

## Bug Reports

None. No confirmed or likely install or clean-home smoke defect was found in Plan 04.

## Deviations from Plan

- `npm run test:integration:extension` was not run because Docker is unavailable in this local environment (`DOCKER_MISSING`). This was treated as an environment blocker rather than a Blueprint defect.

## Issues Encountered

- `gsd-sdk query ...` is unavailable in this checkout; manual execution used the phase plan files and repo config instead of the missing helper.
- Docker is unavailable locally, which blocked the containerized integration harness.

## No-Fix Boundary

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied. This plan only wrote its summary and reused existing disposable smoke tests.

## Temporary Probe Cleanup

The clean-home smoke tests used temporary fake-CLI roots and cleaned them automatically. No persistent installed-extension or host-global state was mutated.

## Known Stubs

None found in files created or modified by this plan.

## Threat Flags

None. The observed blocker was environmental (missing Docker), not a shipped packaging or install-contract defect.

## Next Phase Readiness

Phase 7 closeout can now reconcile one real defect (`BPBUG-004`), three no-defect plan summaries, and the Docker-blocked integration note without expanding into repair work.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/07-host-packaging-build-hooks-audit/07-04-SUMMARY.md`.
- No bug report was required or created by this plan.
- Plan-owned changes are limited to `.planning/phases/07-host-packaging-build-hooks-audit/07-04-SUMMARY.md`.

---
*Phase: 07-host-packaging-build-hooks-audit*
*Completed: 2026-05-02T09:58:47Z*
