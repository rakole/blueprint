---
quick_id: 260502-bpbug-004-dist-refresh
status: complete
completed: 2026-05-02
code_commit: 350e87a
---

# Quick Task 260502-bpbug-004-dist-refresh Summary

## Result

Repaired BPBUG-004 by refreshing the generated `dist/` bundle from a clean `npm run build` after `npm ci`.

## Files Changed

- `dist/mcp/server.js`
- `dist/mcp/server.js.map`
- `dist/mcp/tools/artifacts.d.ts`
- `dist/mcp/tools/project.d.ts`
- `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`

## Verification

Commands run:

```bash
npm ci
npm run build
npx tsx --test tests/extension-runtime-contracts.test.ts tests/built-assets-smoke.test.ts tests/built-schema-assets.test.ts tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts tests/gemini-clean-home-smoke.test.ts
```

The first targeted test run failed only because the new schema asset was present but not yet staged, and `tests/built-schema-assets.test.ts` intentionally checks Git tracking with `git ls-files`. After staging the generated `dist/` refresh, the Phase 7 targeted subset passed with 27 passing tests and 0 failures.

## Commits

- `350e87a build: refresh audit-fix dist assets`

## Validation Follow-Up

Phase 7 validation was rerun after the repair. Plan 02 is now covered and Phase 7 is Nyquist-compliant, with Docker-based integration testing still recorded as an environment-only blocker.
