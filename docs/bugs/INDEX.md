# Blueprint Bug Index

## Purpose

This index is the triage board for the Blueprint Defect Discovery Milestone.
It tracks every real bug report, preserves shared vocabulary, records duplicate
relationships, and keeps the milestone discovery-only.

## Bug Reports

| ID | Title | Severity | Confidence | Surface | Status | Discovery Phase | Impact | Likely Cause | Report |
|----|-------|----------|------------|---------|--------|-----------------|--------|--------------|--------|
| BPBUG-001 | Ship and undo report contracts accept under-specified high-risk evidence | medium | confirmed | MCP tool | fixed  | 5 | Repaired canonical `ship-latest` and `undo-latest` contracts now require high-risk push, PR, revert, evidence, fallback, digest, branch-state, outcome, and semantic safety details, with post-mutation report overwrites and regression coverage. | Ship and undo report contracts stayed broad heading-only templates while command manifests evolved to require richer durable evidence. | [BPBUG-001](./BPBUG-001-ship-undo-report-contracts-underconstrained.md) |
| BPBUG-002 | Cleanup lacks behavioral regression coverage for protected-scope archival | medium | confirmed | tests | fixed  | 6 | Repaired with dedicated cleanup behavior coverage for protected historical scope, active-roadmap exclusions, report-before-mutate ordering, overwrite gating, and true partial-failure preservation. | Cleanup shipped with manifest and metadata coverage, but no dedicated behavior-level regression for its destructive orchestration path. | [BPBUG-002](./BPBUG-002-cleanup-lacks-behavioral-regression-coverage.md) |
| BPBUG-003 | MCP tool docs advertise stale return shapes for update tools | low | confirmed | docs | fixed  | 6 | Shared MCP docs now document the live `blueprint_update_check` and `blueprint_update_plan` fields, including update provenance, restart, saved-path, and checklist metadata, with row-level regression coverage. | The update implementation and tests evolved, but `docs/MCP-TOOLS.md` kept older summary rows instead of the live result shapes. | [BPBUG-003](./BPBUG-003-mcp-tools-docs-stale-update-return-shapes.md) |
| BPBUG-004 | Tracked built bundle is stale and omits audit-fix generated assets | high | confirmed | generated assets | closed | 7 | Git-installed hosts originally launched a tracked `dist/` bundle that lagged the implemented `audit-fix` source contract; the historical defect is now kept as repaired/history evidence after quick repair commit `350e87a`, the Phase 7 validation rerun, and the 2026-05-02 installed-bundle/freshness hardening commits. | Source-side `audit-fix` contract and schema changes landed without a matching committed `dist/` refresh, and packaging tests only asserted bundle presence and startup rather than generated-asset freshness or doc-backed installed runtime completeness. | [BPBUG-004](./BPBUG-004-stale-built-bundle-omits-audit-fix-generated-assets.md) |
| BPBUG-005 | Repo-root guard accepts any `.git` entry as a valid repository | medium | confirmed | cross-cutting | fixed  | 8 | Shared repo-root validation now rejects bogus `.git` placeholders, accepts real repo/worktree/symlinked roots, rejects nested repo subdirectories, and keeps full-suite fixture coverage on real Git repos. | The shared `ensureRepoRoot()` helper stayed as a `.git`-existence check even as more MCP tools began depending on it as a real repository-boundary guard. | [BPBUG-005](./BPBUG-005-repo-root-guard-accepts-any-git-entry.md) |

`BPBUG-000` is reserved for the illustrative non-real example and is excluded
from real defect totals.

## Vocabularies

- Severity: `critical`, `high`, `medium`, `low`, `info`.
- Confidence: `confirmed`, `likely`, `suspected`.
- Surface: `command`, `skill`, `MCP tool`, `hook`, `docs`, `tests`, `build`, `generated assets`, `state artifacts`, `host behavior`, `cross-cutting`.
- Status: `new`, `triaged`, `planned`, `in-progress`, `fixed`, `verified`, `closed`, `duplicate`, `closed-invalid`.

## Duplicate And Related Findings

Mark duplicate findings with `status: duplicate` and link them to the
canonical bug instead of silently repeating the same defect. Use the related
bug links to show shared root causes, downstream fallout, or overlapping evidence.

Duplicate status requires the **same user-visible defect** and the **same
repair path**. Shared root cause alone is not enough.

Current outcome: **No duplicate reports are currently marked.**

## Root Cause Clusters

| Cluster | Bug IDs | Shared Cause | Preventive Repair Direction |
|---------|---------|--------------|-----------------------------|
| under-specified contracts | BPBUG-001 | High-risk report contracts stayed broader than the evidence the shipping and undo manifests require. | Tighten canonical report schemas, placeholder signals, and populated-report regression checks. |
| missing regression guards | BPBUG-002 | Destructive or sequencing-sensitive behavior shipped with metadata coverage but without behavior-level regression proof. | Add executable command-level regression coverage for protected-scope and report-before-mutate flows. |
| docs/runtime synchronization | BPBUG-003 | Shared tool docs drifted behind the live runtime and focused tests. | Cross-check shared docs against runtime result shapes and focused tool suites. |
| generated-asset freshness | BPBUG-004 | Source-side contract changes outpaced the tracked `dist/` bundle and copied schema inventory. | Require tracked `dist` freshness, schema-parity checks, and doc-backed installed-bundle coverage for Git-installed host bundles. |
| repo-root validation gaps | BPBUG-005 | Shared repo-root gating trusts `.git` presence instead of validating a real repository boundary. | Replace existence-only repo-root checks with Git-backed validation and add fake-`.git` regression coverage. |
| cross-layer contract synchronization gaps | none new in Phase 8 | Phase 8 re-checked docs, manifests, skills, runtime, tests, and generated assets together and found only the already-indexed contract drift defects above. | Keep matrix-based cross-layer re-checks in future discovery or repair follow-ups so new drift does not fragment across surfaces. |

## Repair Priority

| Bug ID | Priority Band | Why This Band | Repair Leverage | Validation Surface |
|--------|---------------|---------------|-----------------|--------------------|
| BPBUG-005 | Fixed | Repaired in `codex/bpbug-005-repo-root-guard`; retained here as the completed shared repo-root safety item. | Git-backed `ensureRepoRoot()` validation now improves artifact, phase, impact, and workspace flows at once. | `npm run typecheck`, focused repo-root/workspace suite `43/43`, and full `npm test` `851/851` |
| BPBUG-001 | Fixed | Repaired in `codex/bpbug-repair-run`; retained here as the completed contract-hardening priority item. | Canonical ship/undo report contracts, post-mutation overwrites, semantic validation, tracked `dist`, and regression coverage are now in place. | `npm run typecheck`, focused ship/undo suite `67/67`, and full `npm test` `840/840` |
| BPBUG-002 | Fixed | Repaired in `codex/bpbug-002-cleanup-coverage`; retained here as the completed cleanup behavioral-regression priority item. | Cleanup behavior fixture coverage now locks protected historical scope, active/current exclusions, report-before-mutate ordering, overwrite gates, and partial-failure preservation. | `npm run typecheck`, focused cleanup suite `109/109`, and full `npm test` `845/845` |
| BPBUG-003 | Fixed | Repaired in `codex/bpbug-003-update-docs`; retained here as the completed docs/runtime synchronization item. | Shared MCP update rows now match the runtime result shape and have row-level regression coverage against stale fields. | `npm run typecheck`, `npm run build --silent`, and focused update suite `55/55` |

### Repaired / History

| Bug ID | Current Disposition | Evidence |
|--------|---------------------|----------|
| BPBUG-004 | verified repaired/history | Quick task `260502-bpbug-004-dist-refresh`, commit `350e87a`, the Phase 7 validation rerun with `27 passing tests, 0 failures`, and 2026-05-02 hardening commits `9c18792` and `c4b259b` with targeted build/typecheck/schema/runtime verification |
| BPBUG-001 | fixed | Repair branch `codex/bpbug-repair-run`, commits `f55d2f8`, `143e246`, `146f51f`, `e309c1c`, and `235631f`; verification `npm run typecheck`, focused ship/undo contract suite `67/67`, and full `npm test` `840/840` |
| BPBUG-002 | fixed | Repair branch `codex/bpbug-002-cleanup-coverage`, commits `e034e40`, `e7b7918`, and `571f591`; verification `npm run typecheck`, focused cleanup suite `109/109`, and full `npm test` `845/845` |
| BPBUG-003 | fixed | Repair branch `codex/bpbug-003-update-docs`, commit `cca6b6c`; verification `npm run typecheck`, `npm run build --silent`, and focused update suite `55/55` |
| BPBUG-005 | fixed | Repair branch `codex/bpbug-005-repo-root-guard`, commits `98540b4`, `871dd47`, and `4d5576a`; verification `npm run typecheck`, focused repo-root/workspace suite `43/43`, and full `npm test` `851/851` |

## Repair Batches

See
[`09-REPAIR-QUEUE.md`](../../.planning/phases/09-bug-index-priority-review/09-REPAIR-QUEUE.md)
for the full batch ledger.

| Batch | Bug IDs | Shared Repair Direction | Validation Surface | Priority Band |
|-------|---------|-------------------------|--------------------|---------------|
| Runtime and safety fixes | BPBUG-005 | Replace existence-only repo-root checks with Git-backed repo validation. | Shared repo-root helpers and focused cross-tool regressions | Now |
| Contract and test hardening | BPBUG-001, BPBUG-002 | Tighten durable report contracts and add behavior-level safety regressions. | Artifact-contract validation, ship/undo report-content checks, cleanup orchestration tests | Now / Next |
| Docs synchronization cleanup | BPBUG-003 | Align the shared MCP tool reference with the live update-tool runtime shape. | Shared docs plus focused update-tool tests | Later |

## Verification Questions / Follow-Ups

No open verification questions remain. The unresolved inventory is confirmed-bug
repair work plus BPBUG-004 historical repaired-state evidence.

## Illustrative Example

- [`BPBUG-000-illustrative-example.md`](./BPBUG-000-illustrative-example.md)
  demonstrates the report format only.
- `BPBUG-000` is excluded from real defect totals and must not be used as repair evidence.
- `BPBUG-001` is the first real defect report.

## Discovery-Only Guardrails

No source, manifest, skill, test, generated asset, or runtime behavior fixes are applied during this milestone.

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.

Later phases must document findings and suggested repair directions without
turning the audit into source-fix work.

## Phase Boundary Hygiene

Before finishing a discovery phase, run `git status --short` and confirm the
phase's intentional changes are limited to `.planning/` and `docs/bugs/`. Report
unrelated pre-existing user changes separately and do not revert them.

## Slice Coverage

| Phase | Surfaces Examined | Surfaces Deferred | Bug IDs |
|-------|-------------------|-------------------|---------|
| Phase 1 | bug reporting harness, template, index, illustrative example boundary | workflow-specific Blueprint audit surfaces | BPBUG-000 illustrative only; BPBUG-001 reserved next real bug id |
| Phase 2 | router/readiness (Plan 01); catalog/substrate (Plan 02); bootstrap/config/governance (Plan 03); no confirmed or likely defects found | later lifecycle, review, workspace, packaging, and cross-cut drift slices | none found in Plans 01-04; BPBUG-001 remains the next real bug id |
| Phase 3 | discuss/research/ui-phase discovery artifacts (Plan 01); plan-phase authoring and validation (Plan 02); execute-phase targets and summaries (Plan 03); validate-phase and verify-work evidence (Plan 04); add-tests and closeout (Plan 05); no confirmed or likely defects found | later roadmap-admin, review, workspace, packaging, and cross-cut drift slices | none found in Plans 01-05; BPBUG-001 remains the next real bug id |
| Phase 4 | roadmap mutation commands `add-phase`, `insert-phase`, `remove-phase`, and `plan-milestone-gaps` (Plan 01); milestone report and carry-forward commands `audit-milestone`, `complete-milestone`, `milestone-summary`, and `new-milestone` (Plan 02); capture and backlog promotion commands `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, and `explore` (Plan 03); lightweight execution commands `fast` and `quick` (Plan 04); debug report/follow-up flow and no-fix boundary closeout (Plan 05); no confirmed or likely defects found | later review, workspace, packaging, and cross-cut drift slices | none found in Plans 01-05; BPBUG-001 remains the next real bug id |
| Phase 5 | review artifact quality for `code-review`, `secure-phase`, `review`, and `ui-review` (Plan 01); remediation and docs mutation safety for `code-review-fix`, `audit-fix`, and `docs-update` (Plan 02); impact analysis depth, scaling, report validation, and output rendering for `impact` (Plan 03); high-risk git workflow safety for `pr-branch`, `ship`, and `undo` (Plan 04); closeout and no-fix boundary verification (Plan 05) | workspace, maintenance, packaging, generated assets, hooks, host install, and cross-cut drift slices | BPBUG-001 |
| Phase 6 | workspace create/remove commands `new-workspace` and `remove-workspace` (Plan 01); `workstreams` registry, status, and state transition coverage (Plan 02); `cleanup` protected-scope archival and confirmation safety (Plan 03); advisory `update` and `reapply-patches` flows plus shared MCP update-tool docs (Plan 04); closeout and no-fix boundary verification (Plan 05) | packaging, generated `dist`, hooks, install/smoke, and cross-cut drift slices | BPBUG-002, BPBUG-003 |
| Phase 7 | host manifests and shared metadata (Plan 01); build pipeline, generated `dist`, copied schemas, and built runtime smoke (Plan 02); advisory hook config and shared security behavior (Plan 03); clean-home smoke and containerized install-readiness contracts (Plan 04); closeout and no-fix boundary verification (Plan 05) | cross-cut docs/runtime drift and duplicated root-cause analysis to Phase 8; final priority review to Phase 9; containerized install execution remains environment-blocked until Docker is available | BPBUG-004 |
| Phase 8 | cross-cut docs/runtime drift (Plan 01); risk-backed regression gaps (Plan 02); concern-map triage (Plan 03); root-cause clusters (Plan 04); closeout and no-fix verification (Plan 05) | final repair prioritization deferred to Phase 9; lower-risk concern-map performance notes and deliberate `BLUEPRINT_TEST_*` env-toggle uncertainty stayed as notes instead of new bugs | BPBUG-005 |
| Phase 9 | inventory/status freshness, BPBUG-004 status reconciliation, duplicate review, related-bug linkage, repair-priority bands, repair batches, verification questions, and no-fix closeout | actual repair implementation and optional GitHub Issues/Projects migration | none new |

Later phases should update their slice row when they complete even if no bugs
are found.

## Routing Guardrails

Planned-only or non-routable Blueprint commands must not be recommended as
immediate remediation paths in discovery findings.
