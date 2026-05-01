# Phase 4: Roadmap Capture Lightweight Audit - Pattern Map

**Mapped:** 2026-05-01
**Purpose:** Give Phase 4 executors concrete analogs for auditing roadmap, capture, lightweight execution, and debug defects without applying fixes.

## Target Surfaces And Closest Analogs

| Planned Surface | Role | Closest Existing Analog | Reuse Pattern |
|-----------------|------|-------------------------|---------------|
| `docs/bugs/BPBUG-###-*.md` | One defect report per confirmed or likely Phase 4 finding. | `docs/bugs/BPBUG-000-illustrative-example.md` and `docs/bugs/TEMPLATE.md` | Copy the required report shape, replace illustrative language with real Phase 4 evidence, and preserve `No Fix Applied`. |
| `docs/bugs/INDEX.md` | Cross-phase triage board and slice coverage ledger. | Phase 1, Phase 2, and Phase 3 rows in `docs/bugs/INDEX.md` | Add real bug rows and update the Phase 4 slice row without changing vocabulary or table schema. |
| Roadmap mutation command docs and manifests | Prompt-level contract for add, insert, remove, and gap-planning flows. | `docs/commands/add-phase.md`, `insert-phase.md`, `remove-phase.md`, `plan-milestone-gaps.md`; matching `commands/blu-*.toml` files | Compare declared MCP FQNs, preview/confirm gates, returned-value usage, scaffold behavior, and state routing against skill/runtime references and tests. |
| Roadmap MCP mutation handlers | Deterministic roadmap and phase-directory mutation substrate. | `src/mcp/tools/phase.ts` and `tests/roadmap-tools.test.ts` | Inspect add/insert/remove/promote helpers for stale-input guards, directory behavior, renumbering, warnings, and partial-failure evidence. |
| Milestone report flows | Report-backed audit, completion, summary, and carry-forward paths. | `skills/blueprint-roadmap-admin/SKILL.md`, `tests/audit-milestone-tools.test.ts`, milestone metadata tests | Verify report contract reads, digest inputs, overwrite gates, derived readiness, state routing, and scaffold/carry-forward boundaries. |
| Capture index flows | Notes, todos, backlog, duplicate handling, reserved stubs, and promotion. | `skills/blueprint-capture/SKILL.md`, `src/mcp/tools/artifacts.ts`, `tests/capture-tools.test.ts` | Use `blueprint_artifact_mutate_index` as the expected persistence path and treat returned ids/reserved metadata as authoritative. |
| Lightweight execution | Trivial fast path and bounded quick path. | `skills/blueprint-phase-execution/SKILL.md`, `fast-runtime-contract.md`, `quick-runtime-contract.md`, `tests/lightweight-execution-regression.test.ts` | Verify `/blu-fast` remains report-free and no-subagent, while `/blu-quick` remains bounded, report-backed, and non-lifecycle. |
| Debug report flow | Evidence-backed diagnosis, durable report, and explicit follow-up gate. | `skills/blueprint-debug/SKILL.md`, `docs/commands/debug.md`, `tests/debug-metadata.test.ts` | Verify diagnose-only boundaries, `debug-latest` report persistence, explicit todo/fix gating, and implemented-only routing. |

## Bug Report Authoring Pattern

When a Phase 4 defect is confirmed or likely:

1. Choose the next real id from `docs/bugs/INDEX.md`, currently `BPBUG-001` unless an earlier Phase 4 plan already created it.
2. Create `docs/bugs/BPBUG-###-short-slug.md` with frontmatter matching `docs/bugs/TEMPLATE.md`.
3. Include evidence as a table with exact file paths, command/test outputs, and contract mismatches.
4. Include verification steps a later fixer can run or inspect.
5. Include `No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.`
6. Update the bug index row and Phase 4 slice coverage row.

If no defect is found in a plan's assigned surface, do not create a fake bug. Record the no-defect result in the plan summary and let Plan 05 update the final Phase 4 slice row.

## Test And Evidence Pattern

| Evidence Type | Preferred Command Or Inspection |
|---------------|----------------------------------|
| Roadmap mutation behavior | `npx tsx --test tests/roadmap-tools.test.ts tests/add-phase-metadata.test.ts tests/insert-phase-metadata.test.ts tests/remove-phase-metadata.test.ts tests/plan-milestone-gaps-metadata.test.ts` |
| Milestone report behavior | `npx tsx --test tests/audit-milestone-tools.test.ts tests/audit-milestone-metadata.test.ts tests/complete-milestone-metadata.test.ts tests/milestone-summary-metadata.test.ts tests/new-milestone-metadata.test.ts` |
| Capture and backlog promotion | `npx tsx --test tests/capture-tools.test.ts tests/note-metadata.test.ts tests/add-todo-metadata.test.ts tests/check-todos-metadata.test.ts tests/add-backlog-metadata.test.ts tests/review-backlog-metadata.test.ts tests/explore-metadata.test.ts` |
| Fast and quick boundaries | `npx tsx --test tests/fast-metadata.test.ts tests/quick-metadata.test.ts tests/lightweight-execution-regression.test.ts` |
| Debug report and follow-up behavior | `npx tsx --test tests/debug-metadata.test.ts tests/lightweight-execution-regression.test.ts` |
| Discovery-only boundary | `git status --short` |

## No-Fix Pattern

Phase 4 execution must not edit:

- `src/**`
- `commands/**`
- `skills/**`
- `agents/**`
- `tests/**`
- `dist/**`
- `.blueprint/**`
- host-global `~/.gemini/blueprint/**`, `~/.tabnine/blueprint/**`, installed extension directories, or remote services

Allowed Phase 4 execution writes are:

- `docs/bugs/*.md`
- `docs/bugs/INDEX.md`
- `.planning/phases/04-roadmap-capture-lightweight-audit/*-SUMMARY.md`
- follow-on `.planning/STATE.md` or `.planning/ROADMAP.md` updates made by GSD workflow bookkeeping

## Pattern Mapping Complete
