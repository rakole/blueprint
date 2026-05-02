---
quick_id: 260502-bpbug-004-dist-refresh
status: complete
created: 2026-05-02
---

# Quick Task 260502-bpbug-004-dist-refresh: Repair BPBUG-004 dist bundle

## Goal

Refresh the tracked `dist/` bundle so Git-installed Blueprint hosts include the generated `report.audit-fix` schema asset and rebuilt audit-fix runtime contract output.

## Tasks

| Task | Files | Action | Verify |
|------|-------|--------|--------|
| 1 | `dist/mcp/server.js`, `dist/mcp/server.js.map`, `dist/mcp/tools/artifacts.d.ts`, `dist/mcp/tools/project.d.ts`, `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json` | Run `npm ci`, run `npm run build`, and keep only the generated `dist/` outputs required by the clean build. | `npx tsx --test tests/extension-runtime-contracts.test.ts tests/built-assets-smoke.test.ts tests/built-schema-assets.test.ts tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts tests/gemini-clean-home-smoke.test.ts` |
| 2 | `.planning/phases/07-host-packaging-build-hooks-audit/07-VALIDATION.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` | Rerun Phase 7 validation bookkeeping after the targeted tests pass. | Phase 7 validation status records Plan 02 as covered and `nyquist_compliant: true`. |

## Notes

- Work ran in fresh worktree `/Users/rhishi/dev/repositories/blueprint-bpbug-004-dist` on branch `codex/bpbug-004-dist-schema`.
- `gsd-sdk query` is unavailable in the installed SDK, so this quick task was recorded manually while preserving the workflow gates.
