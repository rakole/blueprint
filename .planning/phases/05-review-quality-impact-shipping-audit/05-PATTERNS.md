# Phase 5: Review Quality Impact Shipping Audit - Pattern Map

**Mapped:** 2026-05-02
**Purpose:** Give Phase 5 executors concrete analogs for auditing review, remediation, docs, impact, shipping, and undo defects without applying fixes.

## Target Surfaces And Closest Analogs

| Planned Surface | Role | Closest Existing Analog | Reuse Pattern |
|-----------------|------|-------------------------|---------------|
| `docs/bugs/BPBUG-###-*.md` | One defect report per confirmed or likely Phase 5 finding. | `docs/bugs/BPBUG-000-illustrative-example.md` and `docs/bugs/TEMPLATE.md` | Copy the required report shape, replace illustrative language with real Phase 5 evidence, and preserve `No Fix Applied`. |
| `docs/bugs/INDEX.md` | Cross-phase triage board and slice coverage ledger. | Phase 1 through Phase 4 rows in `docs/bugs/INDEX.md` | Add real bug rows and update the Phase 5 slice row without changing vocabulary or table schema. |
| Review artifact flows | Code, security, peer, and UI review artifacts. | `src/mcp/tools/review.ts`, `src/mcp/artifact-contracts/index.ts`, review model schemas, and review slice tests | Trace docs/manifests/skills into `blueprint_review_*` handlers; inspect schema narrowing, residual quality checks, rendered Markdown, saved finding loading, and next-safe-action filtering. |
| Remediation/docs mutation flows | Bounded fixes and docs refresh reports. | `code-review-fix-runtime-contract.md`, `audit-fix-runtime-contract.md`, `skills/blueprint-docs/SKILL.md`, `src/mcp/tools/artifacts.ts` | Verify saved evidence prerequisites, target selection, dry-run behavior, report-before/after expectations, overwrite gates, validation, and state routing. |
| Impact analysis flows | Config, scope, context, analysis, report bundle, and output rendering. | `src/mcp/tools/impact.ts`, `report.impact` schema, and impact fixtures/tests | Treat MCP outputs as authoritative; distinguish risk from confidence, warnings from blockers, and missing metadata from proof of safety. |
| High-risk git workflows | Clean review branch, shipping, and undo. | `skills/blueprint-maintenance/SKILL.md`, `pr-branch-runtime-contract.md`, maintenance metadata tests, report contracts | Verify dirty-tree blockers, exact preview content, explicit confirmation, report-before-mutate posture, source branch/history safety, remote fallback, and implemented-only routing. |

## Bug Report Authoring Pattern

When a Phase 5 defect is confirmed or likely:

1. Choose the next real id from `docs/bugs/INDEX.md`, currently `BPBUG-001` unless an earlier Phase 5 plan already created it.
2. Create `docs/bugs/BPBUG-###-short-slug.md` with frontmatter matching `docs/bugs/TEMPLATE.md`.
3. Include evidence as a table with exact file paths, command/test outputs, and contract mismatches.
4. Include verification steps a later fixer can run or inspect.
5. Include `No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.`
6. Update the bug index row and Phase 5 slice coverage row.

If no defect is found in a plan's assigned surface, do not create a fake bug. Record the no-defect result in the plan summary and let Plan 05 update the final Phase 5 slice row.

## Test And Evidence Pattern

| Evidence Type | Preferred Command Or Inspection |
|---------------|----------------------------------|
| Review artifacts | `npx tsx --test tests/code-review-metadata.test.ts tests/code-review-slice.test.ts tests/secure-phase-metadata.test.ts tests/secure-phase-slice.test.ts tests/review-metadata.test.ts tests/review-slice.test.ts tests/ui-review-metadata.test.ts tests/ui-review-slice.test.ts` |
| Remediation/docs mutation | `npx tsx --test tests/code-review-fix-metadata.test.ts tests/code-review-fix-slice.test.ts tests/audit-fix-metadata.test.ts tests/audit-fix-slice.test.ts tests/docs-update-metadata.test.ts tests/review-docs-safety-regression.test.ts` |
| Impact analysis | `npx tsx --test tests/impact-metadata.test.ts tests/impact-tools.test.ts tests/impact-fixtures.test.ts` |
| High-risk git workflows | `npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts` |
| Discovery-only boundary | `git status --short` |

## No-Fix Pattern

Phase 5 execution must not edit:

- `src/**`
- `commands/**`
- `skills/**`
- `agents/**`
- `tests/**`
- `dist/**`
- `.blueprint/**`
- branches, PRs, git history, remote services, host-global `~/.gemini/blueprint/**`, `~/.tabnine/blueprint/**`, or installed extension directories

Allowed Phase 5 execution writes are:

- `docs/bugs/*.md`
- `docs/bugs/INDEX.md`
- `.planning/phases/05-review-quality-impact-shipping-audit/*-SUMMARY.md`
- follow-on `.planning/STATE.md` or `.planning/ROADMAP.md` updates made by GSD workflow bookkeeping

## Pattern Mapping Complete
