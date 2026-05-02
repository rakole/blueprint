# Phase 7: Host Packaging Build Hooks Audit - Pattern Map

**Mapped:** 2026-05-02
**Purpose:** Give Phase 7 executors concrete analogs for auditing extension packaging, generated assets, hooks, and install readiness without applying fixes.

## Target Surfaces And Closest Analogs

| Planned Surface | Role | Closest Existing Analog | Reuse Pattern |
|-----------------|------|-------------------------|---------------|
| `docs/bugs/BPBUG-###-*.md` | One defect report per confirmed or likely Phase 7 finding. | `docs/bugs/BPBUG-001-ship-undo-report-contracts-underconstrained.md`, `docs/bugs/BPBUG-003-mcp-tools-docs-stale-update-return-shapes.md`, and `docs/bugs/TEMPLATE.md` | Copy the report shape, replace prior-phase language with Phase 7 evidence, keep explicit uncertainty, and preserve `No Fix Applied`. |
| `docs/bugs/INDEX.md` | Cross-phase triage board and slice ledger. | Phase 1 through Phase 6 rows in `docs/bugs/INDEX.md` | Add real bug rows and update the Phase 7 slice row without changing vocabulary or table schema. |
| Host manifests | Host-level extension launch contract. | `gemini-extension.json`, `tabnine-extension.json`, `scripts/lib/extension-hosts.mjs`, `tests/extension-runtime-contracts.test.ts` | Verify context file, `${extensionPath}/dist/mcp/server.js`, `BLUEPRINT_HOST`, `BLUEPRINT_EXTENSION_PATH`, host metadata, and tracked bundle assumptions together. |
| Build pipeline and generated `dist` | Release/runtime asset production. | `scripts/build.mjs`, `package.json`, `dist/`, `tests/built-assets-smoke.test.ts` | Compare source entrypoints to built entrypoints, declaration output, source maps, schema copying, package scripts, and MCP startup smoke. |
| Advisory hooks | Host hook warnings and advisory boundary. | `hooks/hooks.json`, `src/hooks/*.ts`, `src/shared/security.ts`, `tests/hooks.test.ts`, `tests/built-assets-smoke.test.ts` | Verify hooks stay rooted at `${extensionPath}`, parse stdin safely, return advisory `allow` or `{}`, reuse shared security detectors, and do not become persistence/enforcement. |
| Install and smoke readiness | Extension install/link validation and clean-home checks. | `tests/extension-install.integration.ts`, `scripts/gemini-clean-home-smoke.mjs`, `tests/gemini-clean-home-smoke.test.ts`, `tests/helpers/extension-hosts.ts` | Audit staged shipped path inclusion/exclusion, install metadata, link/install modes, host CLI availability gates, fake CLI smoke, clean-home cleanup, and live-auth skip handling. |

## Bug Report Authoring Pattern

When a Phase 7 defect is confirmed or likely:

1. Choose the next real id from `docs/bugs/INDEX.md`, currently `BPBUG-004` unless an earlier Phase 7 plan already created it.
2. Create `docs/bugs/BPBUG-###-short-slug.md` with frontmatter matching `docs/bugs/TEMPLATE.md`.
3. Include evidence as a table with exact file paths, line-level references where useful, command/test output, generated asset comparisons, or contract mismatches.
4. Include reproduction or verification steps a later fixer can run or inspect.
5. Include `No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.`
6. Update the bug index row and Phase 7 slice coverage row.

If no defect is found in a plan's assigned surface, do not create a fake bug. Record the no-defect result in the plan summary and let Plan 05 update the final Phase 7 slice row.

## Test And Evidence Pattern

| Evidence Type | Preferred Command Or Inspection |
|---------------|----------------------------------|
| Host manifest and runtime contract | `npx tsx --test tests/extension-runtime-contracts.test.ts` |
| Build and built runtime smoke | `npm run build` plus `npx tsx --test tests/built-assets-smoke.test.ts` |
| Hook source/config behavior | `npx tsx --test tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts` |
| Clean-home smoke script | `npx tsx --test tests/gemini-clean-home-smoke.test.ts` |
| Containerized host install | `npm run test:integration:extension` when Docker and host CLI prerequisites are available |
| Discovery-only boundary | `git status --short` |

## No-Fix Pattern

Phase 7 execution must not edit:

- `src/**`
- `commands/**`
- `skills/**`
- `agents/**`
- `tests/**`
- `scripts/**`
- `hooks/**`
- `dist/**`
- `package.json` or `package-lock.json`
- `gemini-extension.json` or `tabnine-extension.json`
- `.blueprint/**`
- installed extension directories
- host-global `~/.gemini/blueprint/**` or `~/.tabnine/blueprint/**`
- workspace directories, branches, PRs, git history, or remote services

Allowed Phase 7 execution writes are:

- `docs/bugs/*.md`
- `docs/bugs/INDEX.md`
- `.planning/phases/07-host-packaging-build-hooks-audit/*-SUMMARY.md`
- follow-on `.planning/STATE.md` or `.planning/ROADMAP.md` updates made by GSD workflow bookkeeping

## Pattern Mapping Complete

