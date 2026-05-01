# Phase 3: Core Lifecycle Audit - Pattern Map

**Mapped:** 2026-05-01
**Purpose:** Give Phase 3 executors concrete analogs for auditing lifecycle defects without applying fixes.

## Target Surfaces And Closest Analogs

| Planned Surface | Role | Closest Existing Analog | Reuse Pattern |
|-----------------|------|-------------------------|---------------|
| `docs/bugs/BPBUG-###-*.md` | One defect report per confirmed or likely lifecycle finding. | `docs/bugs/BPBUG-000-illustrative-example.md` and `docs/bugs/TEMPLATE.md` | Copy the required report shape, replace illustrative language with real lifecycle evidence, and preserve `No Fix Applied`. |
| `docs/bugs/INDEX.md` | Cross-phase triage board and slice coverage ledger. | Phase 1 and Phase 2 rows in `docs/bugs/INDEX.md` | Add real bug rows and update the Phase 3 slice row without changing vocabulary or table schema. |
| Discovery command docs and manifests | Prompt-level contract for context, research, and UI-spec flows. | `docs/commands/discuss-phase.md`, `research-phase.md`, `ui-phase.md`; `commands/blu-discuss-phase.toml`, `blu-research-phase.toml`, `blu-ui-phase.toml` | Compare declared MCP FQNs, checkpoint ownership, artifact contract reads, overwrite gates, validation repair, and state sync against skill/runtime references and tests. |
| Discovery skill/runtime references | Detailed orchestration authority for pre-planning commands. | `skills/blueprint-phase-discovery/SKILL.md` and `skills/blueprint-phase-discovery/references/*.md` | Treat the command-specific runtime references as expected behavior; flag material drift when manifests/docs/tools contradict them. |
| Plan-phase model path | Schema-first plan authoring and scoped validation. | `docs/commands/plan-phase.md`, `commands/blu-plan-phase.toml`, `skills/blueprint-phase-planning/SKILL.md`, `src/mcp/tools/phase.ts` plan handlers | Verify plan authoring context, model validation, model-only write, strict validation mode, scoped validation, and checker-loop contracts are all present and tested. |
| Execute-phase summary path | Plan-target selection and summary-backed carry-forward evidence. | `docs/commands/execute-phase.md`, `commands/blu-execute-phase.toml`, `skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md`, summary handlers in `src/mcp/tools/phase.ts` | Verify execution targets, lower-wave blockers, summary model validation, summary writes, `PARTIAL`/`BLOCKED` pending semantics, and synced state update. |
| Validation/UAT model path | Summary-backed verification and resumable conversational UAT. | `docs/commands/validate-phase.md`, `docs/commands/verify-work.md`, validation handlers and schemas in `src/mcp/tools/phase.ts` and `src/mcp/artifact-contracts/schemas/` | Verify summary prerequisites, State A/B/C, `phase.verification` and `phase.uat` model-only writes, UAT checkpoint markers, roadmap/state sync, and tests. |
| Add-tests report path | Evidence-backed test generation and durable add-tests report. | `docs/commands/add-tests.md`, `commands/blu-add-tests.toml`, `skills/blueprint-phase-validation/references/add-tests-runtime-contract.md`, `src/mcp/tools/artifacts.ts` report handlers | Verify saved evidence prerequisites, scope classification gates, verification render/write, structured `report.add-tests` validation/write, and explicit no-fix boundary during this audit. |

## Bug Report Authoring Pattern

When a lifecycle defect is confirmed or likely:

1. Choose the next real id from `docs/bugs/INDEX.md`, currently `BPBUG-001` unless an earlier Phase 3 plan already created it.
2. Create `docs/bugs/BPBUG-###-short-slug.md` with frontmatter matching `docs/bugs/TEMPLATE.md`.
3. Include evidence as a table with exact file paths, command/test outputs, and contract mismatches.
4. Include verification steps a later fixer can run or inspect.
5. Include `No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.`
6. Update the bug index row and Phase 3 slice coverage row.

If no defect is found in a plan's assigned surface, do not create a fake bug. Record the no-defect result in the plan summary and let Plan 05 update the final Phase 3 slice row.

## Test And Evidence Pattern

| Evidence Type | Preferred Command Or Inspection |
|---------------|----------------------------------|
| Discovery command contracts and tools | `npx tsx --test tests/phase-discovery-discuss.test.ts tests/phase-discovery-research.test.ts tests/phase-discovery-ui.test.ts tests/phase-discovery-tools.test.ts` |
| Plan authoring and validation | `npx tsx --test tests/phase-planning-tools.test.ts tests/phase-plan-validation-hardening.test.ts tests/phase-plan-write-locking.test.ts tests/plan-phase-metadata.test.ts` |
| Execution summaries and target selection | `npx tsx --test tests/execute-phase-summary-tools.test.ts tests/execute-phase-metadata.test.ts` |
| Validation and UAT behavior | `npx tsx --test tests/phase-validation-slice.test.ts tests/validate-phase-tools.test.ts tests/verify-work-roadmap-sync.test.ts tests/validate-phase-metadata.test.ts tests/verify-work-metadata.test.ts` |
| Add-tests behavior | `npx tsx --test tests/add-tests-slice.test.ts tests/add-tests-metadata.test.ts` |
| Discovery-only boundary | `git status --short` |

## No-Fix Pattern

Phase 3 execution must not edit:

- `src/**`
- `commands/**`
- `skills/**`
- `agents/**`
- `tests/**`
- `dist/**`
- `.blueprint/**`
- host-global `~/.gemini/blueprint/**`, `~/.tabnine/blueprint/**`, or installed extension directories

Allowed Phase 3 execution writes are:

- `docs/bugs/*.md`
- `docs/bugs/INDEX.md`
- `.planning/phases/03-core-lifecycle-audit/*-SUMMARY.md`
- follow-on `.planning/STATE.md` or `.planning/ROADMAP.md` updates made by GSD workflow bookkeeping

## Pattern Mapping Complete
