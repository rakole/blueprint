# Phase 8: Cross-Cut Drift And Regression Gaps - Pattern Map

**Mapped:** 2026-05-02
**Purpose:** Give Phase 8 executors concrete analogs for auditing cross-layer drift, regression gaps, concern-map leads, and bug clusters without applying fixes.

## Target Surfaces And Closest Analogs

| Planned Surface | Role | Closest Existing Analog | Reuse Pattern |
|-----------------|------|-------------------------|---------------|
| `08-DRIFT-MATRIX.md` | Cross-layer matrix for docs, manifests, skills, MCP docs, source, tests, and generated assets. | Phase 2 catalog/runtime substrate plans and `tests/command-contract-docs.test.ts` | Group by surface family, name expected contract, actual evidence, risk tag, disposition, and related bug or note. |
| `08-REGRESSION-GAPS.md` | Risk-backed coverage note table. | BPBUG-002 and Phase 7 `tests/built-schema-assets.test.ts` validation update | File bugs only for high-risk missing guards; keep lower-risk gaps as notes for Phase 9. |
| `08-CONCERN-TRIAGE.md` | Concern-map lead triage table. | `.planning/codebase/CONCERNS.md`, Phase 5 impact plan, Phase 6 cleanup plan, Phase 7 generated-assets plan | Convert each concern to confirmed bug, likely bug, non-bug note, or deferred uncertainty with exact evidence. |
| `docs/bugs/BPBUG-###-*.md` | One defect report per confirmed or likely Phase 8 finding. | `docs/bugs/TEMPLATE.md`, BPBUG-001 through BPBUG-004 | Preserve frontmatter, evidence table, verification steps, uncertainty, related bugs, and exact no-fix sentence. |
| `docs/bugs/INDEX.md` | Bug inventory, slice coverage, and root-cause cluster board. | Existing Phase 1 through Phase 7 rows in `docs/bugs/INDEX.md` | Add Phase 8 rows, update slice coverage, and introduce cluster links without changing vocabulary or table schema. |
| Existing BPBUG reports | Prior bugs requiring cluster links. | BPBUG-001, BPBUG-002, BPBUG-003, BPBUG-004 | Add related-bug context only when it improves repair planning; do not mark duplicates unless defect and repair path are the same. |

## Bug Report Authoring Pattern

When a Phase 8 defect is confirmed or likely:

1. Choose the next real id from `docs/bugs/INDEX.md`, currently after BPBUG-004 unless earlier Phase 8 execution already created a report.
2. Create `docs/bugs/BPBUG-###-short-slug.md` with frontmatter matching `docs/bugs/TEMPLATE.md`.
3. For contract drift, cite both sides of the mismatch: expected docs/manifest/skill/MCP contract and actual source/test/generated/runtime behavior.
4. For regression gaps, name the exact missing guard, the surface it protects, existing nearby tests, and the failure mode that can escape.
5. For concern-map leads, label uncertainty explicitly if evidence is likely rather than confirmed.
6. Include `No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.`
7. Update `docs/bugs/INDEX.md`, the Phase 8 slice row, and related-bug links where appropriate.

## Test And Evidence Pattern

| Evidence Type | Preferred Command Or Inspection |
|---------------|----------------------------------|
| Command catalog/spec/skill drift | `npx tsx --test tests/command-contract-docs.test.ts tests/command-catalog.test.ts tests/extension-runtime-contracts.test.ts` |
| Shared MCP docs drift | `rg -n "Returns|blueprint_update_|blueprint_phase_|blueprint_artifact_" docs/MCP-TOOLS.md src/mcp/tools tests` plus focused metadata tests |
| Generated asset freshness | `npx tsx --test tests/built-schema-assets.test.ts tests/built-assets-smoke.test.ts` and `git status --short` after any planned build probe |
| Artifact schema or Markdown parser concern | `npx tsx --test tests/artifact-contracts.test.ts tests/artifact-validate-runtime.test.ts` plus source inspection |
| Impact scaling/schema concern | `npx tsx --test tests/impact-tools.test.ts tests/impact-fixtures.test.ts tests/impact-metadata.test.ts` |
| Filesystem/destructive safety concern | `npx tsx --test tests/cleanup-tools.test.ts tests/workspace-tools.test.ts tests/security-hardening.test.ts` |
| Cluster and index consistency | `rg -n "Related Bugs|Phase 8|BPBUG-" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md` |
| Discovery-only boundary | `git status --short` |

## No-Fix Pattern

Phase 8 execution must not edit:

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

Allowed Phase 8 execution writes are:

- `docs/bugs/*.md`
- `docs/bugs/INDEX.md`
- `.planning/phases/08-cross-cut-drift-and-regression-gaps/*-SUMMARY.md`
- `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-DRIFT-MATRIX.md`
- `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-REGRESSION-GAPS.md`
- `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-CONCERN-TRIAGE.md`
- follow-on `.planning/STATE.md` or `.planning/ROADMAP.md` updates made by GSD workflow bookkeeping

## Pattern Mapping Complete

