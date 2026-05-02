---
phase: 07-host-packaging-build-hooks-audit
plan: 02
subsystem: build-pipeline-and-generated-assets
tags: [blueprint, packaging, build, generated-assets, dist, host-behavior]
requires:
  - phase: 07-host-packaging-build-hooks-audit
    provides: Plan 01 host manifest and runtime metadata evidence
provides:
  - Build pipeline and generated asset audit evidence for the shipped `dist` bundle
  - Confirmed generated-asset freshness defect recorded as BPBUG-004
  - Built runtime smoke results and cleanup evidence preserving the discovery-only boundary
affects: [phase-7, packaging, generated-assets, docs/bugs]
tech-stack:
  added: []
  patterns: [build-to-dist freshness audit, generated-drift evidence capture]
key-files:
  created:
    - .planning/phases/07-host-packaging-build-hooks-audit/07-02-SUMMARY.md
    - docs/bugs/BPBUG-004-stale-built-bundle-omits-audit-fix-generated-assets.md
  modified:
    - docs/bugs/INDEX.md
key-decisions:
  - "Recorded BPBUG-004 because a clean rebuild changed tracked built outputs and produced the missing copied `report.audit-fix` schema asset for an implemented command."
patterns-established:
  - "Packaging audits should rebuild in a fresh worktree, treat `dist/` churn as evidence rather than a kept fix, and restore generated outputs after documenting stale-bundle defects."
requirements-completed: [COV-06, NFIX-01, NFIX-02, NFIX-03]
duration: 12min
completed: 2026-05-02T09:56:14Z
---

# Phase 7 Plan 02: Build Pipeline And Generated Assets Summary

**Plan 02 confirmed a generated-asset freshness defect: the tracked built bundle on `main` is stale relative to source and omits the copied `report.audit-fix` schema asset, so BPBUG-004 was recorded.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-02T09:44:00Z
- **Completed:** 2026-05-02T09:56:14Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Verified `package.json` and `scripts/build.mjs` align on the expected Node 20, ESM, TypeScript declaration emit, esbuild entrypoints, source maps, and schema-copy build contract.
- Ran `npm run build` successfully in the fresh Phase 7 worktree after `npm ci`.
- Confirmed the rebuild changed tracked generated outputs and produced an untracked `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`, proving the checked-in bundle was stale.
- Reran `npx tsx --test tests/built-assets-smoke.test.ts` after the rebuild and confirmed the rebuilt bundle passes both built-hook and built-MCP smoke checks.
- Recorded BPBUG-004 for the stale built bundle and updated `docs/bugs/INDEX.md`.
- Restored `dist/` from the untouched original checkout after capturing evidence so Phase 7 remained discovery-only.

## Task Commits

Task 1 gathered the build and package contract evidence. Task 2 rebuilt `dist/`, captured the generated diff as defect evidence, and reran built smoke against the regenerated bundle. Task 3 recorded BPBUG-004, updated the bug index, and restored generated outputs so only docs and summaries remained changed.

## Files Created/Modified

- `docs/bugs/BPBUG-004-stale-built-bundle-omits-audit-fix-generated-assets.md` - Captures the confirmed stale-bundle defect and generated-diff evidence.
- `docs/bugs/INDEX.md` - Adds the BPBUG-004 row.
- `.planning/phases/07-host-packaging-build-hooks-audit/07-02-SUMMARY.md` - Records Plan 02 evidence, cleanup posture, and the bug-report outcome.

## Verification

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| Build contract is wired correctly | `rg -n "emitDeclarationOnly|entryPoints|blueprint-write-guard|read-before-edit|workflow-advisory|mcp/server|sourcemap|node20|artifact-contracts.*schemas" scripts/build.mjs` | pass | The build script emits declarations, bundles the three hook entrypoints plus `mcp/server`, targets Node 20, enables sourcemaps, and copies artifact schemas into `dist/mcp/artifact-contracts/schemas`. |
| Package scripts expose the expected build and packaging entrypoints | `rg -n "\"build\"|\"typecheck\"|\"test\"|\"smoke:gemini-clean-home\"|\"test:integration:extension\"|\">=20\"" package.json` | pass | `package.json` declares the expected scripts plus Node `>=20`. |
| Clean rebuild works | `npm run build` | pass | The build completed successfully and regenerated `dist/` outputs. |
| Built runtime smoke passes after rebuild | `npx tsx --test tests/built-assets-smoke.test.ts` | pass | 2 tests passed: built hook commands executed successfully and the built MCP server advertised the expected tools. |
| Tracked generated bundle is fresh | `git status --short` and `git diff --stat -- dist` after rebuild | fail | The rebuild changed `dist/mcp/server.js`, `dist/mcp/server.js.map`, `dist/mcp/tools/artifacts.d.ts`, `dist/mcp/tools/project.d.ts`, and added `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`, proving the checked-in bundle was stale. |
| Discovery-only cleanup restored generated outputs | `git status --short` after `rsync -a --delete .../blueprint/dist/ .../worktree/dist/` | pass | After restoration, the remaining intentional changes were limited to `docs/bugs/INDEX.md`, `docs/bugs/BPBUG-004-...md`, and Phase 7 summary files. |

## Evidence Reviewed

| Surface | Evidence |
|---------|----------|
| Build pipeline | `scripts/build.mjs` removes `dist/`, emits declarations with local `tsc`, bundles the hooks plus MCP server through esbuild, targets Node 20, and copies schema assets. |
| Package scripts | `package.json` exposes `build`, `typecheck`, `test`, `smoke:gemini-clean-home`, and `test:integration:extension`. |
| Generated bundle | `find dist -maxdepth 3 -type f | sort` plus `git diff --stat -- dist` showed the tracked bundle was missing the copied `report.audit-fix` schema file and lagged current generated output. |
| Source/runtime contract | `src/mcp/artifact-contracts/index.ts`, `src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`, `docs/COMMAND-CATALOG.md`, and `docs/RUNTIME-REFERENCE.md` all treat `audit-fix` as implemented and require `report.audit-fix` runtime support. |
| Packaging regression coverage | `tests/built-assets-smoke.test.ts` and `tests/extension-runtime-contracts.test.ts` cover startup and key built-file presence, but did not catch the stale generated bundle before rebuild. |

## Bug Reports

- `BPBUG-004` - Tracked built bundle is stale and omits audit-fix generated assets.

## Deviations from Plan

- The first `npx tsx --test tests/built-assets-smoke.test.ts` invocation was accidentally launched in parallel with `npm run build`, so it raced `dist/mcp/server.js` creation and failed before the build completed. The smoke suite was rerun after the build finished and passed; this was an execution-order mistake in the audit, not Blueprint defect evidence.

## Issues Encountered

- `gsd-sdk query ...` is unavailable in this checkout; manual execution used the phase plan files and repo config instead of the missing helper.
- Running the built-assets smoke concurrently with the build created a false negative that was resolved by rerunning the smoke after the build completed.

## No-Fix Boundary

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied. Generated `dist/` drift was used as evidence for BPBUG-004 and then restored from the untouched original checkout instead of being kept as a repair.

## Temporary Probe Cleanup

- Rebuilt `dist/` as planned evidence.
- Captured the generated diff and missing-schema evidence.
- Restored `dist/` with `rsync -a --delete /Users/rhishi/dev/repositories/blueprint/dist/ /Users/rhishi/dev/repositories/blueprint-phase7-host-packaging-build-hooks-audit/dist/` so the worktree returned to docs-only Phase 7 outputs.

## Known Stubs

None found in files created or modified by this plan beyond the stale generated-bundle defect captured in BPBUG-004.

## Threat Flags

- `BPBUG-004` indicates a shipped bundle freshness risk for Git-installed hosts because they launch tracked `dist/` directly.

## Next Phase Readiness

Plan 03 can audit advisory hooks next with BPBUG-004 recorded as the first real Phase 7 finding. The closeout plan should keep the generated-drift cleanup note explicit so the final Phase 7 boundary check stays honest.

## Self-Check: PASSED

- `docs/bugs/BPBUG-004-stale-built-bundle-omits-audit-fix-generated-assets.md` exists.
- `docs/bugs/INDEX.md` contains a BPBUG-004 row.
- `.planning/phases/07-host-packaging-build-hooks-audit/07-02-SUMMARY.md` exists.
- Remaining plan-owned changes are limited to `docs/bugs/` and `.planning/phases/07-host-packaging-build-hooks-audit/`.

---
*Phase: 07-host-packaging-build-hooks-audit*
*Completed: 2026-05-02T09:56:14Z*
