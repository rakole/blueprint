---
phase: 02-router-health-and-mapping
plan: "03"
subsystem: foundation
tags: [mcp, gemini, mapping, artifacts, testing]
requires:
  - phase: 02-router-health-and-mapping
    provides: shared read-path artifact inspection and repair-aware status tooling from 02-02
provides:
  - deterministic `.blueprint/codebase/` scaffold support for the locked six-file mapping bundle
  - `blueprint_artifact_summary_digest` for repo-evidence mapping summaries with `inputsUsed`
  - direct `/blu:map-codebase` command contract plus fixture-backed brownfield mapping coverage
affects: [phase-03, discovery, planning, codebase]
tech-stack:
  added: []
  patterns: [stable codebase artifact bundle, deterministic repo-evidence digest, fixture-backed command-tool alignment]
key-files:
  created:
    - commands/blu/map-codebase.toml
    - tests/map-codebase.test.ts
    - tests/fixtures/map-codebase/
  modified:
    - src/mcp/server.ts
    - src/mcp/tools/artifacts.ts
key-decisions:
  - "Preserve existing `.blueprint/codebase/*.md` files by default and surface explicit replace warnings instead of silently overwriting edited mapping docs."
  - "Keep map-codebase synthesis in the artifact tool family by adding `blueprint_artifact_summary_digest` over deterministic path-based repo evidence inputs."
patterns-established:
  - "Brownfield mapping commands create or reuse the locked six-file `.blueprint/codebase/` bundle and summarize repo evidence through MCP instead of prompt-owned writes."
  - "Command contracts are validated against the live MCP registry so the `/blu:map-codebase` TOML and server tool surface cannot drift silently."
requirements-completed: [FND-06]
duration: 4min
completed: 2026-04-10
---

# Phase 2 Plan 03: Router Health And Mapping Summary

**Deterministic brownfield codebase mapping via a stable six-file `.blueprint/codebase/` bundle, repo-evidence digest output, and fixture-backed overwrite protection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T20:50:07Z
- **Completed:** 2026-04-10T20:53:42Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Extended the artifact MCP layer so Blueprint can scaffold, inventory, validate, and summarize the locked six-file `.blueprint/codebase/` bundle.
- Added the `/blu:map-codebase` command contract over `blueprint_project_status`, `blueprint_artifact_scaffold`, `blueprint_artifact_list`, and `blueprint_artifact_summary_digest`.
- Added a brownfield fixture and tests that prove deterministic digest output, command-tool alignment, and default reuse of edited codebase docs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend artifact helpers for the `.blueprint/codebase/` bundle** - `18645da` (`feat`)
2. **Task 2: Create the `/blu:map-codebase` command contract** - `7bac688` (`feat`)
3. **Task 3: Add brownfield fixtures and tests for deterministic codebase mapping** - `8e8c0c4` (`test`)

## Files Created/Modified

- `commands/blu/map-codebase.toml` - Declares the brownfield mapping flow, deterministic repo-evidence gathering, and replace confirmation gate.
- `src/mcp/server.ts` - Enforces registration of `blueprint_artifact_summary_digest` in the MCP server surface.
- `src/mcp/tools/artifacts.ts` - Adds codebase bundle scaffold support, reuse/replace warnings, and deterministic summary digest generation.
- `tests/map-codebase.test.ts` - Verifies codebase bundle creation, digest evidence, reuse behavior, and command-tool alignment.
- `tests/fixtures/map-codebase/` - Provides the representative brownfield repo used to exercise mapping behavior.

## Decisions Made

- Preserved edited codebase docs by default and made replace behavior an explicit overwrite path instead of allowing silent regeneration.
- Used additive warnings on artifact list and validate results so commands can surface reuse/replace guidance without treating healthy codebase docs as validation failures.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

- `src/mcp/tools/artifacts.ts:143` - Pre-existing `/blu:new-project` requirements placeholder text remains intentional bootstrap seed content and was not introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Downstream discovery and planning work can now rely on the stable `.blueprint/codebase/STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `INTEGRATIONS.md`, and `CONCERNS.md` filenames.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` were left untouched because they were outside this plan's allowed write scope.

## Self-Check: PASSED

- Summary file created at `.planning/phases/02-router-health-and-mapping/02-03-SUMMARY.md`
- Verified commits exist: `18645da`, `7bac688`, `8e8c0c4`

---
*Phase: 02-router-health-and-mapping*
*Completed: 2026-04-10*
