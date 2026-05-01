# Phase 5: Review Quality Impact Shipping Audit - Research

**Researched:** 2026-05-02
**Domain:** Blueprint review, remediation, docs-update, impact, shipping, review-branch, and undo flows
**Confidence:** HIGH

## Research Question

What does the executor need to know to audit Blueprint's quality and shipping surfaces without applying source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, remote-service, branch, PR, or git-history fixes?

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-04 | Review, security, UI-review, peer-review, docs-update, impact, review-branch, ship, and undo are audited. | The plan set must trace review artifacts, remediation/docs mutation, impact analysis, and high-risk git workflows from command specs and manifests into skills, runtime references, MCP tools, artifact contracts, and targeted tests. |
| NFIX-01 | No source, manifest, skill, test, build, generated asset, or runtime behavior fixes are applied. | Plans must be read-heavy and write only bug reports, bug index rows, summaries, and planning artifacts. |
| NFIX-02 | Temporary probe files are removed before completion and documented. | Any runtime probe must use disposable temp roots or dry-run/no-write paths and must record cleanup evidence. |
| NFIX-03 | Git status is checked at phase boundaries. | Every plan includes `git status --short` and separates unrelated user changes from phase-owned bug docs or summaries. |

## Summary

Phase 5 should be planned as five audit slices. Start with review artifact quality because `code-review`, `secure-phase`, `review`, and `ui-review` share the `src/mcp/tools/review.ts` substrate and model-only review contracts. Then audit remediation and docs-update mutation safety, including `code-review-fix`, `audit-fix`, and `docs-update`, where evidence must remain durable and writes must stay bounded. Keep `/blu-impact` as its own depth and scaling slice because it has a dedicated config, scope, context, analysis, report, and output-rendering tool family. Then audit high-risk git workflows (`pr-branch`, `ship`, and `undo`) with a strict pre-mutation report/preview posture. Close with bug-index reconciliation, no-fix verification, and Phase 5 summary readiness.

## Locked Decisions From Context

- D-01 through D-03: Review artifacts should satisfy schema and evidence quality, not just headings or JSON shape.
- D-04 through D-06: `/blu-impact` scope includes config provenance, scope resolution, context loading, ownership/dependency coverage, generated/source mixed-scope signals, report validation, rendering, and scaling/degradation.
- D-07 through D-09: `code-review-fix`, `audit-fix`, and `docs-update` must preserve bounded mutation safety, durable evidence, and MCP-owned reports/state.
- D-10 through D-12: `pr-branch`, `ship`, and `undo` need report/preview gates before git or remote mutation, explicit confirmation, source-branch/history safety, and manual fallback paths.
- D-13 through D-15: Preserve the Phase 2 through Phase 4 evidence bar and discovery-only boundary.

## Evidence Baseline

### Review Artifact Quality

- `docs/commands/code-review.md`, `secure-phase.md`, `review.md`, and `ui-review.md` define review scope, saved evidence, model-only artifact writing, overwrite posture, and status-safe routing.
- `commands/blu-code-review.toml`, `blu-secure-phase.toml`, `blu-review.toml`, and `blu-ui-review.toml` should require the same MCP tools and local runtime references.
- `skills/blueprint-review/SKILL.md` and the review runtime references define line-backed findings, threat-bound security review, peer-review coverage, UI evidence limits, capability-gated subagent use, no-subagent fallback, and validation retry behavior.
- `src/mcp/tools/review.ts` owns `blueprint_review_scope`, `blueprint_review_authoring_context`, `blueprint_review_validate_model`, `blueprint_review_record`, and saved findings loading.
- `src/mcp/artifact-contracts/index.ts` and the `review.*.model.schema.json` files are the canonical schema contracts.
- Focused tests: `tests/code-review-metadata.test.ts`, `tests/code-review-slice.test.ts`, `tests/secure-phase-metadata.test.ts`, `tests/secure-phase-slice.test.ts`, `tests/review-metadata.test.ts`, `tests/review-slice.test.ts`, `tests/ui-review-metadata.test.ts`, and `tests/ui-review-slice.test.ts`.

### Remediation And Docs Mutation Safety

- `docs/commands/code-review-fix.md`, `audit-fix.md`, and `docs-update.md` define saved-evidence prerequisites, bounded mutation behavior, visible progress, durable reports, and next-safe-action routing.
- `commands/blu-code-review-fix.toml`, `blu-audit-fix.toml`, and `blu-docs-update.toml` should keep MCP persistence and confirmation gates explicit.
- `skills/blueprint-review/references/code-review-fix-runtime-contract.md` and `audit-fix-runtime-contract.md` define saved finding selection, dry-run semantics, report model validation, and one-finding-at-a-time fallback.
- `skills/blueprint-docs/SKILL.md` defines docs-update evidence posture, scoped repo-doc refresh, verification, report persistence, and broad-refresh routing.
- `src/mcp/tools/review.ts`, `src/mcp/tools/artifacts.ts`, and `src/mcp/tools/state.ts` are the key runtime substrates.
- Focused tests: `tests/code-review-fix-metadata.test.ts`, `tests/code-review-fix-slice.test.ts`, `tests/audit-fix-metadata.test.ts`, `tests/audit-fix-slice.test.ts`, `tests/docs-update-metadata.test.ts`, and `tests/review-docs-safety-regression.test.ts`.

### Impact Analysis

- `docs/commands/impact.md`, `commands/blu-impact.toml`, `skills/blueprint-impact/SKILL.md`, and `skills/blueprint-impact/references/impact-runtime-contract.md` define the full impact tool order and report-bundle behavior.
- `src/mcp/tools/impact.ts` owns config merge/provenance, scope resolution, context loading, surface classification, ownership/dependency coverage, advisory status, normalized report creation, bundle writing, and output rendering.
- `docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`, and `docs/ARTIFACT-SCHEMA.md` define the `report.impact` schema and expected output semantics.
- `tests/impact-metadata.test.ts`, `tests/impact-tools.test.ts`, `tests/impact-fixtures.test.ts`, and `tests/fixtures/impact/` provide the strongest targeted evidence leads.

### High-Risk Git Workflows

- `docs/commands/pr-branch.md`, `ship.md`, and `undo.md` define report-backed high-risk maintenance posture, confirmation gates, dirty-tree blockers, and manual fallback behavior.
- `commands/blu-pr-branch.toml`, `blu-ship.toml`, and `blu-undo.toml` should require project/config/evidence reads, preview/report authoring, and confirmation before git or remote mutation.
- `skills/blueprint-maintenance/SKILL.md` and `skills/blueprint-maintenance/references/pr-branch-runtime-contract.md` are the main skill/runtime references for branch filtering and shared maintenance posture.
- `src/mcp/tools/artifacts.ts`, `src/mcp/tools/state.ts`, and `src/mcp/tools/workspace.ts` provide report/state/workspace helpers relevant to maintenance safety.
- Focused tests: `tests/pr-branch-metadata.test.ts`, `tests/ship-metadata.test.ts`, and `tests/undo-metadata.test.ts`.

## Existing Tests To Reuse

Prefer these targeted commands during execution:

```bash
npx tsx --test tests/code-review-metadata.test.ts tests/code-review-slice.test.ts tests/secure-phase-metadata.test.ts tests/secure-phase-slice.test.ts tests/review-metadata.test.ts tests/review-slice.test.ts tests/ui-review-metadata.test.ts tests/ui-review-slice.test.ts
npx tsx --test tests/code-review-fix-metadata.test.ts tests/code-review-fix-slice.test.ts tests/audit-fix-metadata.test.ts tests/audit-fix-slice.test.ts tests/docs-update-metadata.test.ts tests/review-docs-safety-regression.test.ts
npx tsx --test tests/impact-metadata.test.ts tests/impact-tools.test.ts tests/impact-fixtures.test.ts
npx tsx --test tests/pr-branch-metadata.test.ts tests/ship-metadata.test.ts tests/undo-metadata.test.ts
```

Run `npm ci` first only in a fresh worktree with missing `node_modules`. If a targeted test cannot run because of dependency or environment issues, record the blocker honestly in the summary.

## Recommended Audit Shape

1. Review artifact quality: code-review, secure-phase, peer-review, UI-review, review schemas, evidence coverage, and status-safe routing.
2. Remediation and docs mutation safety: code-review-fix, audit-fix, docs-update, report/state persistence, dry-run and confirmation gates.
3. Impact analysis depth and scaling: config, scope, context, analysis, report write, rendering, ownership/dependency coverage, and degradation warnings.
4. High-risk git safety: pr-branch, ship, undo, dirty-tree/preflight blockers, report-before-mutate posture, confirmation gates, and manual fallbacks.
5. Closeout: reconcile Phase 5 bug reports, update `docs/bugs/INDEX.md`, verify discovery-only boundaries, and prepare validation.

## Validation Architecture

Phase 5 validation is artifact and evidence based, not source mutation based.

- Each plan must preserve no-fix discipline: writes are limited to `docs/bugs/*.md`, `docs/bugs/INDEX.md`, and Phase 5 planning/execution artifacts under `.planning/phases/05-review-quality-impact-shipping-audit/`.
- Each bug report must follow `docs/bugs/TEMPLATE.md` and cite concrete evidence from command outputs, test outputs, file paths, line-level references where useful, or docs/source contract mismatches.
- Each plan should run at least one targeted Phase 5 test command or document why it could not run.
- Every plan must run `git status --short` before completion and document that no source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed extension, host-global, remote-service, branch, PR, or git-history changes were applied by the audit.
- If tests fail, classify whether the failure is defect evidence, an environment/dependency problem, or unrelated pre-existing breakage.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| A remediation or shipping audit accidentally performs real fixes or git mutation. | Plans forbid source/runtime fixes and require dry-run/static review or disposable local repos for any behavior probe. |
| Review artifacts pass schema but weak evidence goes unnoticed. | Plan 01 audits residual quality checks, rendered artifacts, evidence keys, and saved artifact parsing, not schema shape alone. |
| Impact scaling risks are treated as speculation. | Plan 03 uses fixtures/tests and source path inspection first; suspected scaling bugs require explicit uncertainty. |
| High-risk git workflows are judged only by prompts. | Plan 04 compares docs/manifests/skills/runtime references to report contracts and metadata tests, and only uses disposable repos if needed. |

## Deferrals

- Repairing any discovered Phase 5 defect is deferred to a later repair milestone.
- Workspace, packaging, generated `dist`, hooks, and cross-cut drift surfaces are deferred to Phases 6 through 8 unless directly needed as evidence for a Phase 5 defect.

## Research Complete

Phase 5 can be planned from this research, the Phase 5 context, and the existing Phase 1 bug-reporting harness.
