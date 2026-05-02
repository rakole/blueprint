# Phase 9: Bug Index Priority Review - Pattern Map

**Mapped:** 2026-05-02
**Purpose:** Give Phase 9 executors concrete analogs for deduping, cross-linking, prioritizing, and closing the bug inventory without applying source fixes.

## Target Surfaces And Closest Analogs

| Planned Surface | Role | Closest Existing Analog | Reuse Pattern |
|-----------------|------|-------------------------|---------------|
| `docs/bugs/INDEX.md` | Canonical bug inventory plus repair-priority board. | Existing Phase 1 through Phase 8 rows and `## Root Cause Clusters` in `docs/bugs/INDEX.md` | Extend existing sections instead of replacing the table schema; preserve vocabulary and routing guardrails. |
| `docs/bugs/BPBUG-001-*.md` through `docs/bugs/BPBUG-005-*.md` | Per-defect evidence trail and current status source. | `docs/bugs/TEMPLATE.md` plus current report sections | Preserve evidence, verification steps, uncertainty, related bugs, and no-fix language while adding only status/related notes needed for Phase 9. |
| `.planning/phases/09-bug-index-priority-review/09-INVENTORY-REVIEW.md` | Execution artifact for status freshness and metadata consistency. | `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-REGRESSION-GAPS.md` | Use a compact table with source, observed state, disposition, and required index/report update. |
| `.planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md` | Execution artifact for priority bands, repair batches, and verification questions. | `docs/bugs/INDEX.md` root-cause clusters and Phase 8 closeout summary | Group by repair direction and validation surface, not discovery phase alone. |
| `.planning/phases/09-bug-index-priority-review/*-SUMMARY.md` | Plan execution evidence and no-fix boundary proof. | Phase 8 summaries, especially `08-04-SUMMARY.md` and `08-05-SUMMARY.md` | Record requirement/decision coverage, exact verification commands, and `git status --short`. |

## Inventory Extension Pattern

When updating `docs/bugs/INDEX.md` during Phase 9:

1. Preserve the existing `## Bug Reports` table and its columns.
2. Reconcile every real BPBUG file against the table row.
3. Keep `BPBUG-000` illustrative and excluded from real totals.
4. Add or update separate sections for:
   - current active repair candidates
   - repaired or historical items
   - duplicate and related findings
   - repair priority bands
   - repair batches
   - verification questions / follow-ups
5. Keep planned-only Blueprint commands out of immediate next-step guidance.

## Status Freshness Pattern

| Bug | Freshness Source | Required Handling |
|-----|------------------|-------------------|
| BPBUG-001 | Current report and Phase 8 regression-gap ledger | Keep active unless execution finds a repair artifact. |
| BPBUG-002 | Current report and Phase 8 regression-gap ledger | Keep active unless execution finds a repair artifact. |
| BPBUG-003 | Current report and Phase 8 drift matrix | Keep active unless execution finds a docs-sync repair artifact. |
| BPBUG-004 | Quick repair summary and Phase 7 validation rerun | Separate from active queue; mark as repaired/verified history if evidence still matches. |
| BPBUG-005 | Current report and Phase 8 validation | Keep active unless execution finds a repair artifact. |

## Verification Pattern

| Evidence Type | Preferred Command Or Inspection |
|---------------|----------------------------------|
| Bug row coverage | `rg -n "BPBUG-00[1-9]" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md` |
| Metadata consistency | `rg -n "^id:|^title:|^severity:|^confidence:|^surface:|^status:|^discovery_phase:" docs/bugs/BPBUG-00[1-9]-*.md` |
| Duplicate policy | `rg -n "duplicate|Duplicate|canonical|Related Bugs|Root Cause Clusters" docs/bugs/INDEX.md docs/bugs/BPBUG-*.md` |
| Priority and batches | `rg -n "Repair Priority|Now|Next|Later|Repair Batches|runtime and safety|contract and test|docs synchronization" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/*.md` |
| Open questions | `rg -n "Verification Questions|Follow-Ups|evidence gap|low-confidence" docs/bugs/INDEX.md .planning/phases/09-bug-index-priority-review/*.md` |
| Discovery-only boundary | `git status --short` |

## No-Fix Pattern

Allowed Phase 9 execution writes:

- `docs/bugs/INDEX.md`
- `docs/bugs/BPBUG-*.md`
- `.planning/phases/09-bug-index-priority-review/*-SUMMARY.md`
- `.planning/phases/09-bug-index-priority-review/09-INVENTORY-REVIEW.md`
- `.planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

Forbidden Phase 9 execution writes:

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
- workspace directories, branches, PRs, git history, remotes, or remote services

## Pattern Mapping Complete
