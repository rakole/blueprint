---
phase: 01-foundation-bootstrap-and-state
plan: "03"
subsystem: testing
tags: [new-project, tests, fixtures, packaging, status]
requires:
  - phase: 01-01
    provides: Router and extension shell
  - phase: 01-02
    provides: Blueprint MCP project/config/state/artifact tools
provides:
  - `/blu:new-project` direct command contract
  - Fixture-backed bootstrap and negative-path tests
  - Install-path and command-to-tool wiring smoke coverage
affects: [health, progress, discuss-phase]
tech-stack:
  added: [tsx]
  patterns: [fixture-driven bootstrap testing, install-path smoke assertions]
key-files:
  created: [commands/blu/new-project.toml, tests/new-project.test.ts, tests/fixtures/new-project/]
  modified: [package.json, package-lock.json, src/mcp/tools/config.ts]
key-decisions:
  - "Run tests through `tsx` so TypeScript test files stay simple while the build still proves the dist layout."
  - "Use fixtures plus temp repo copies to test saved defaults and overwrite protection without touching the real workspace."
patterns-established:
  - "Assert command contracts against the registered MCP tool names to prevent silent drift."
  - "Keep packaging smoke tests in the same suite as command behavior so manifest regressions fail early."
requirements-completed: [FND-01, FND-02, FND-03]
duration: 1min
completed: 2026-04-11
---

# Phase 1: Foundation Bootstrap and State Summary

**`/blu:new-project` command contract with fixture-backed bootstrap tests and install-path smoke verification**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-11T00:55:57+05:30
- **Completed:** 2026-04-11T00:56:48+05:30
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Added the first mutating direct Blueprint command contract at `commands/blu/new-project.toml`.
- Proved deterministic `.blueprint/` initialization, repo-root errors, overwrite protection, and defaults handling with fixtures.
- Added status, command/tool consistency, and manifest install-path smoke checks so the whole vertical slice is exercised.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the `/blu:new-project` command contract** - `e1e457e` (feat)
2. **Task 2: Add fixture-based bootstrap and negative-path tests for project initialization** - `30786d8` (test)
3. **Task 3: Verify post-init status, command-to-tool integration, and install-path readiness** - `9fcc160` (test)

**Plan metadata:** pending summary commit

## Files Created/Modified
- `commands/blu/new-project.toml` - Defines the first direct Blueprint command and its required tool flow.
- `tests/new-project.test.ts` - Exercises happy-path bootstrap, defaults handling, status, tool wiring, and packaging smoke.
- `tests/fixtures/new-project/partial-blueprint/.blueprint/PROJECT.md` - Simulates rerun protection against partial state.
- `tests/fixtures/new-project/saved-defaults/valid-defaults.json` - Seeds the saved-defaults provenance path.
- `tests/fixtures/new-project/saved-defaults/malformed-defaults.json` - Protects the hardcoded-default fallback path.
- `package.json` - Switches the test runner to `tsx --test` for TypeScript-native test execution.

## Decisions Made
- Kept the command contract explicit about `--auto`, overwrite confirmation, and next-step reporting so the user-facing behavior mirrors the spec.
- Tested handlers directly instead of through an MCP client because that is the nearest public runtime surface and keeps the suite deterministic.
- Extended config seeding provenance so valid defaults are observable in tests and command responses.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 1's vertical slice is now end-to-end: install scaffold, MCP-backed bootstrap, direct command contract, and tests.
The repo is ready for phase-level verification and then for Wave 0 follow-on commands in Phase 2.

---
*Phase: 01-foundation-bootstrap-and-state*
*Completed: 2026-04-11*
