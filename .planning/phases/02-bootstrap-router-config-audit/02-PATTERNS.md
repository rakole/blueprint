# Phase 2: Bootstrap Router Config Audit - Pattern Map

**Mapped:** 2026-05-01
**Purpose:** Give Phase 2 executors concrete analogs for auditing and documenting defects without applying fixes.

## Target Surfaces And Closest Analogs

| Planned Surface | Role | Closest Existing Analog | Reuse Pattern |
|-----------------|------|-------------------------|---------------|
| `docs/bugs/BPBUG-###-*.md` | One defect report per confirmed or likely finding. | `docs/bugs/BPBUG-000-illustrative-example.md` and `docs/bugs/TEMPLATE.md` | Copy the required section shape, replace illustrative language with real evidence, and keep `No Fix Applied`. |
| `docs/bugs/INDEX.md` | Cross-phase triage board and slice coverage ledger. | Phase 1 update in `docs/bugs/INDEX.md` | Add real bug rows and update the Phase 2 slice row without changing vocabulary or table schema. |
| Router command manifests | Prompt-level contracts for `/blu*` entrypoints. | `commands/blu.toml`, `commands/blu-help.toml`, `commands/blu-progress.toml`, `commands/blu-next.toml` | Compare explicit MCP FQNs, implemented-only guidance, waiting-state language, and map-first recommendations against docs and tests. |
| Router command specs | Human-readable contract baseline. | `docs/commands/root-router.md`, `docs/commands/help.md`, `docs/commands/progress.md`, `docs/commands/next.md` | Treat acceptance criteria and failure modes as expected behavior. |
| Runtime command catalog | Live routability truth. | `src/mcp/tools/project.ts` and `tests/command-catalog.test.ts` | Verify declared `implemented` rows resolve manifest, skill, spec, and required MCP tools before runtime exposes them. |
| Readiness and next-action logic | Runtime next safe action. | `blueprintProjectStatus()` in `src/mcp/tools/project.ts`; `deriveNextAction()` in `src/mcp/tools/state.ts` | Verify uninitialized brownfield, mapping-incomplete, mapped-only, partial, and initialized branches match docs and tests. |
| Config/governance logic | Effective config and repair substrate. | `src/mcp/tools/config.ts`, `docs/commands/settings.md`, `docs/commands/set-profile.md`, `docs/commands/health.md` | Compare normalized config schema, allowed scopes, saved defaults, profile updates, repair language, and tests. |

## Bug Report Authoring Pattern

When a defect is confirmed or likely:

1. Choose the next real id from `docs/bugs/INDEX.md`, beginning at `BPBUG-001`.
2. Create `docs/bugs/BPBUG-###-short-slug.md` with frontmatter matching `docs/bugs/TEMPLATE.md`.
3. Include evidence as a table with exact file paths, commands, tests, and contract mismatches.
4. Include verification steps a later fixer can run or inspect.
5. Add `No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.`
6. Update the bug index row and Phase 2 slice coverage row.

If no defect is found in a plan's assigned surface, do not create a fake bug. Update the Phase 2 slice row with the examined surface and `none found` for bug ids if the whole phase closes cleanly.

## Test And Evidence Pattern

| Evidence Type | Preferred Command Or Inspection |
|---------------|----------------------------------|
| Router/readiness fixtures | `npx tsx --test tests/help-progress-health.test.ts` |
| `/blu-next` behavior | `npx tsx --test tests/next.test.ts` |
| New-project map-first bootstrap | `npx tsx --test tests/new-project.test.ts` |
| Map-codebase bootstrap state | `npx tsx --test tests/map-codebase.test.ts` |
| Runtime catalog and contract resources | `npx tsx --test tests/command-catalog.test.ts` |
| Docs/manifests contract drift | `npx tsx --test tests/command-contract-docs.test.ts` plus direct `rg`/file reads |
| Discovery-only boundary | `git status --short` |

## No-Fix Pattern

Phase 2 execution must not edit:

- `src/**`
- `commands/**`
- `skills/**`
- `agents/**`
- `tests/**`
- `dist/**`
- `.blueprint/**`
- host-global `~/.gemini/blueprint/**` or `~/.tabnine/blueprint/**`

Allowed Phase 2 execution writes are:

- `docs/bugs/*.md`
- `docs/bugs/INDEX.md`
- `.planning/phases/02-bootstrap-router-config-audit/*-SUMMARY.md`
- follow-on `.planning/STATE.md` or `.planning/ROADMAP.md` updates made by GSD workflow bookkeeping

## Pattern Mapping Complete
