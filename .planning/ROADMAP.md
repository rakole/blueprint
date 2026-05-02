# Roadmap: Blueprint Defect Discovery Milestone

**Created:** 2026-05-01
**Granularity:** Fine
**Milestone Goal:** Systematically find, classify, and document current Blueprint defects in `docs/bugs/*.md` without applying fixes.

## Phase Overview

| Phase | Name | Goal | Requirements | Status |
|-------|------|------|--------------|--------|
| 1 | Bug Taxonomy And Reporting Harness | Establish the defect-reporting structure, bug schema, index, and audit rules used by all later slices. | BOUND-01, BOUND-02, BOUND-03, HARN-01, HARN-02, HARN-03, HARN-04, BUG-01, BUG-02, BUG-03, CLASS-01, CLASS-02, CLASS-03, EVID-01, EVID-02, EVID-03, SLICE-01, SLICE-02, SLICE-03, NFIX-01, NFIX-02, NFIX-03 | Verified |
| 2 | Bootstrap Router Config Audit | Audit `/blu`, `new-project`, `help`, `progress`, `next`, `settings`, `set-profile`, `health`, map-first readiness, catalog routing, and config behavior. | COV-01, NFIX-01, NFIX-02, NFIX-03 | Validated |
| 3 | Core Lifecycle Audit | Audit phase discovery, planning, execution, validation, UAT, add-tests, checkpoints, summaries, and state transitions. | COV-02, NFIX-01, NFIX-02, NFIX-03 | Validated |
| 4 | Roadmap Capture Lightweight Audit | Audit roadmap admin, milestone flows, notes, todos, backlog, explore, fast, quick, and debug surfaces. | COV-03, NFIX-01, NFIX-02, NFIX-03 | Validated |
| 5 | Review Quality Impact Shipping Audit | Audit review, security, UI-review, peer-review, docs-update, impact, pr-branch, ship, and undo surfaces. | COV-04, NFIX-01, NFIX-02, NFIX-03 | Validated |
| 6 | Workspace Maintenance Audit | Audit workspace, workstream, cleanup, update, patch replay, registry, worktree, and high-risk confirmation behavior. | COV-05, NFIX-01, NFIX-02, NFIX-03 | Validated |
| 7 | Host Packaging Build Hooks Audit | Audit Gemini/Tabnine extension manifests, build pipeline, generated `dist`, hooks, package scripts, and install/smoke behavior. | COV-06, NFIX-01, NFIX-02, NFIX-03 | Validated |
| 8 | Cross-Cut Drift And Regression Gaps | Audit docs/runtime drift, codebase concern leads, regression coverage gaps, schema drift, generated asset drift, and duplicated root causes. | CLASS-04, EVID-04, COV-07, COV-08, NFIX-01, NFIX-02, NFIX-03 | Pending |
| 9 | Bug Index Priority Review | Dedupe, cross-link, classify, and summarize the full bug inventory for later repair planning. | BUG-04, REPAIR-01, REPAIR-02, REPAIR-03, NFIX-01, NFIX-02, NFIX-03 | Pending |

## Phase Details

### Phase 1: Bug Taxonomy And Reporting Harness

**Goal:** Create the reusable defect-reporting harness before any workflow-specific findings are written.

**Mapped requirements:** BOUND-01, BOUND-02, BOUND-03, HARN-01, HARN-02, HARN-03, HARN-04, BUG-01, BUG-02, BUG-03, CLASS-01, CLASS-02, CLASS-03, EVID-01, EVID-02, EVID-03, SLICE-01, SLICE-02, SLICE-03, NFIX-01, NFIX-02, NFIX-03

**Dependencies:** Existing codebase map and Blueprint runtime docs.

**UI hint:** no

**Plan artifacts:**
- Wave 1: `01-01-PLAN.md` creates `docs/bugs/TEMPLATE.md`.
- Wave 1: `01-02-PLAN.md` creates `docs/bugs/INDEX.md`.
- Wave 2 *(blocked on Wave 1 completion)*: `01-03-PLAN.md` creates the illustrative non-real example report, updates the index reference, and runs boundary verification.
- Execution evidence: `01-01-SUMMARY.md`, `01-02-SUMMARY.md`, and `01-03-SUMMARY.md` are now saved in the phase directory.

**Cross-cutting constraints:**
- Preserve Blueprint as a Gemini-native product boundary, not a GSD or legacy-port audit.
- Keep the milestone discovery-only; do not fix source, manifest, skill, test, build, generated asset, runtime, `.blueprint/`, or host-global state defects during Phase 1 execution.
- Keep `.blueprint/` runtime state distinct from `.planning/` audit bookkeeping in every harness artifact.
- Require grep/file-read/command-verifiable evidence and explicit uncertainty in later bug reports.

**Success criteria:**
1. `docs/bugs/` exists with an index and reusable bug-report template guidance.
2. Bug id, severity, confidence, affected-surface, and status vocabularies are defined.
3. The audit explicitly states that Blueprint must not be treated as GSD.
4. The no-fix rule is visible in the harness and phase handoff.

**Execution status:** verified on 2026-05-01; ready to begin Phase 2 discovery.

### Phase 2: Bootstrap Router Config Audit

**Goal:** Find and document defects in the foundational user entrypoints and configuration/readiness substrate.

**Mapped requirements:** COV-01, NFIX-01, NFIX-02, NFIX-03

**Dependencies:** Phase 1 bug-reporting harness.

**UI hint:** no

**Suggested surfaces:**
- `commands/blu.toml`, `commands/blu-new-project.toml`, `commands/blu-help.toml`, `commands/blu-progress.toml`, `commands/blu-next.toml`, settings/profile/health manifests
- `skills/blueprint-router/`, `skills/blueprint-bootstrap/`, `skills/blueprint-governance/`
- `src/mcp/tools/project.ts`, `src/mcp/tools/config.ts`, `src/mcp/tools/state.ts`, `src/mcp/command-resources.ts`
- readiness tests, command catalog tests, new-project tests, help/progress fixtures

**Plan artifacts:**
- Wave 1: `02-01-PLAN.md` audits router and map-first readiness outputs for `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next`.
- Wave 1: `02-02-PLAN.md` audits command catalog, manifest, skill, required MCP tool, and runtime-contract substrate.
- Wave 1: `02-03-PLAN.md` audits `new-project`, `map-codebase`, settings, set-profile, health, config normalization, saved defaults, and repair routing.
- Wave 2 *(blocked on Wave 1 completion)*: `02-04-PLAN.md` reconciles Phase 2 bug reports, updates the bug index slice row, and verifies no-fix boundaries.
- Execution evidence: `02-01-SUMMARY.md`, `02-02-SUMMARY.md`, `02-03-SUMMARY.md`, and `02-04-SUMMARY.md` are now saved in the phase directory.

**Cross-cutting constraints:**
- Preserve discovery-only execution: Phase 2 writes bug reports, bug index updates, and planning summaries only.
- Treat `.blueprint/` as Blueprint runtime state and `.planning/` as GSD bookkeeping.
- Classify declared-implemented-but-unroutable findings as command catalog/status contract defects.
- Keep map-first routing strict: unmapped brownfield and `mapping-incomplete` route to `/blu-map-codebase`; `mapped-only` routes to `/blu-new-project`.

**Success criteria:**
1. Implemented-only routing behavior is checked against docs, manifests, skills, runtime tools, and tests.
2. Bootstrap mapped-only and mapping-incomplete behavior is checked.
3. Config normalization, defaults, and health repair behavior are checked.
4. All confirmed or likely defects are documented in `docs/bugs/*.md`.

**Execution status:** validated (manual sign-off) on 2026-05-01; no confirmed or likely defects were found and the phase is ready to begin Phase 3.

### Phase 3: Core Lifecycle Audit

**Goal:** Find and document defects in phase discovery, planning, execution, validation, UAT, and test-generation flows.

**Mapped requirements:** COV-02, NFIX-01, NFIX-02, NFIX-03

**Dependencies:** Phase 1 bug-reporting harness.

**UI hint:** no

**Suggested surfaces:**
- Lifecycle command manifests and specs
- `skills/blueprint-phase-discovery/`, `skills/blueprint-phase-planning/`, `skills/blueprint-phase-execution/`, `skills/blueprint-phase-validation/`
- `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, review/validation schema assets
- tests for phase planning, execution, validation, UAT, and add-tests

**Plan artifacts:**
- Wave 1: `03-01-PLAN.md` audits discovery artifact lifecycle commands for discuss, research, UI-spec/skip rationale, checkpoint ownership, artifact validation, and state handoff behavior.
- Wave 2 *(blocked on Wave 1 completion)*: `03-02-PLAN.md` audits `plan-phase` readiness gates, schema-first plan authoring, model validation, strict plan writes, scoped plan validation, and checker-loop behavior.
- Wave 3 *(blocked on Wave 2 completion)*: `03-03-PLAN.md` audits `execute-phase` target selection, lower-wave blockers, plan reads, summary model writes, `PARTIAL`/`BLOCKED` carry-forward semantics, and state handoff behavior.
- Wave 4 *(blocked on Wave 3 completion)*: `03-04-PLAN.md` audits `validate-phase` and `verify-work` summary-backed validation, UAT readiness, resumable UAT checkpointing, roadmap/state sync, and regression coverage.
- Wave 5 *(blocked on Wave 4 completion)*: `03-05-PLAN.md` audits `add-tests`, reconciles Phase 3 bug reports, updates the bug index slice row, and verifies the discovery-only boundary.

**Cross-cutting constraints:**
- Preserve command-flow order from discovery through add-tests.
- Use static contract review plus targeted existing tests before any disposable probe.
- Keep discovery-only execution: Phase 3 may write bug reports, bug index updates, and planning summaries, but must not fix source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, or host-global defects.
- Record concrete evidence and uncertainty for every confirmed or likely lifecycle finding.
- Verify `git status --short` at every plan boundary and document any temporary probe cleanup.

**Success criteria:**
1. Phase artifact authoring, validation, checkpoint, summary, verification, and UAT contracts are compared to implementation.
2. State updates and next-safe-action behavior are checked.
3. Missing prerequisite and safe-degradation paths are checked.
4. All confirmed or likely defects are documented in `docs/bugs/*.md`.

**Execution status:** validated on 2026-05-01; no confirmed or likely defects were found across Plans 01 through 05.

### Phase 4: Roadmap Capture Lightweight Audit

**Goal:** Find and document defects in roadmap administration, milestone flows, capture, quick execution, and debug.

**Mapped requirements:** COV-03, NFIX-01, NFIX-02, NFIX-03

**Dependencies:** Phase 1 bug-reporting harness.

**UI hint:** no

**Suggested surfaces:**
- Roadmap admin command manifests and skills
- Capture command manifests and `skills/blueprint-capture/`
- `skills/blueprint-phase-execution/` quick/fast behavior
- `skills/blueprint-debug/`
- `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/review.ts`
- roadmap, backlog, todo, note, debug, and quick tests

**Plan artifacts:**
- Wave 1: `04-01-PLAN.md` audits roadmap mutation safety for `add-phase`, `insert-phase`, `remove-phase`, and `plan-milestone-gaps`.
- Wave 2 *(blocked on Wave 1 completion)*: `04-02-PLAN.md` audits milestone report and carry-forward flows for `audit-milestone`, `complete-milestone`, `milestone-summary`, and `new-milestone`.
- Wave 3 *(blocked on Wave 2 completion)*: `04-03-PLAN.md` audits capture indexes and backlog promotion for notes, todos, backlog, review-backlog, and explore.
- Wave 4 *(blocked on Wave 3 completion)*: `04-04-PLAN.md` audits `fast` and `quick` lightweight execution boundaries.
- Wave 5 *(blocked on Wave 4 completion)*: `04-05-PLAN.md` audits `debug`, reconciles Phase 4 bug reports, updates the bug index slice row, and verifies the discovery-only boundary.
- Execution evidence: `04-01-SUMMARY.md`, `04-02-SUMMARY.md`,
  `04-03-SUMMARY.md`, `04-04-SUMMARY.md`, and `04-05-SUMMARY.md` are now
  saved in the phase directory.

**Cross-cutting constraints:**
- Preserve discovery-only execution: Phase 4 may write bug reports, bug index updates, and planning summaries, but must not fix source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, remote-service, or command behavior defects.
- Prefer static contract review plus targeted existing tests before any disposable runtime probe.
- Roadmap mutation findings must check preview parity, destructive confirmations, partial-failure recovery, and MCP-returned state routing before conclusion.
- All follow-up routing in findings and summaries must stay inside implemented Blueprint commands.

**Success criteria:**
1. Add/insert/remove phase behavior, milestone closeout, and gap planning are checked.
2. Capture indexes and duplicate/status handling are checked.
3. Quick, fast, and debug report/follow-up boundaries are checked.
4. All confirmed or likely defects are documented in `docs/bugs/*.md`.

**Execution status:** validated on 2026-05-02; no confirmed or likely defects were found across Plans 01 through 05.

### Phase 5: Review Quality Impact Shipping Audit

**Goal:** Find and document defects in review, remediation, docs, impact, review-branch, shipping, and undo workflows.

**Mapped requirements:** COV-04, NFIX-01, NFIX-02, NFIX-03

**Dependencies:** Phase 1 bug-reporting harness.

**UI hint:** no

**Suggested surfaces:**
- `skills/blueprint-review/`, `skills/blueprint-docs/`, `skills/blueprint-impact/`, `skills/blueprint-maintenance/`
- `src/mcp/tools/review.ts`, `src/mcp/tools/impact.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/workspace.ts`
- impact report schemas, review schemas, maintenance report contracts
- code-review, audit-fix, secure-phase, ui-review, docs-update, impact, pr-branch, ship, and undo tests

**Plan artifacts:**
- Wave 1: `05-01-PLAN.md` audits review artifact quality for `code-review`, `secure-phase`, `review`, and `ui-review`.
- Wave 2 *(blocked on Wave 1 completion)*: `05-02-PLAN.md` audits remediation and docs mutation safety for `code-review-fix`, `audit-fix`, and `docs-update`.
- Wave 3 *(blocked on Wave 2 completion)*: `05-03-PLAN.md` audits `/blu-impact` depth, scaling, report validation, and output rendering.
- Wave 4 *(blocked on Wave 3 completion)*: `05-04-PLAN.md` audits high-risk git safety for `pr-branch`, `ship`, and `undo`.
- Wave 5 *(blocked on Wave 4 completion)*: `05-05-PLAN.md` reconciles Phase 5 bug reports, updates the bug index slice row, and verifies the discovery-only boundary.

**Cross-cutting constraints:**
- Preserve discovery-only execution: Phase 5 may write bug reports, bug index updates, and planning summaries, but must not fix source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, remote-service, branch, PR, or git-history defects.
- Require schema-plus-evidence review quality for review artifacts; schema-valid but materially weak evidence is still a bug candidate when supported by concrete evidence.
- Keep `/blu-impact` risk, confidence, ownership, dependency, and unknown signals distinct; missing metadata must not be treated as proof of safety.
- Keep high-risk git workflow audits static or disposable: no branch creation, push, PR, revert, reset, or source-branch mutation in the main audit worktree.

**Success criteria:**
1. Schema-first review and report authoring paths are checked.
2. Impact scope/config/context/report behavior is checked.
3. High-risk git mutation previews and report-before-mutate contracts are checked for shipping/undo/pr-branch.
4. All confirmed or likely defects are documented in `docs/bugs/*.md`.

**Execution status:** validated on 2026-05-02; BPBUG-001 was recorded for under-constrained ship and undo report contracts, and the phase is ready to begin Phase 6 discovery.

### Phase 6: Workspace Maintenance Audit

**Goal:** Find and document defects in workspace/workstream/maintenance flows and host-global state handling.

**Mapped requirements:** COV-05, NFIX-01, NFIX-02, NFIX-03

**Dependencies:** Phase 1 bug-reporting harness.

**UI hint:** no

**Suggested surfaces:**
- `commands/blu-new-workspace.toml`, `commands/blu-remove-workspace.toml`, `commands/blu-workstreams.toml`, `commands/blu-cleanup.toml`, `commands/blu-update.toml`, `commands/blu-reapply-patches.toml`
- `skills/blueprint-maintenance/`
- `src/mcp/tools/workspace.ts`, `src/mcp/tools/update.ts`, runtime host helpers
- workspace, workstream, cleanup, update, and patch tests

**Plan artifacts:**
- Wave 1: `06-01-PLAN.md` audits `new-workspace` and `remove-workspace` registry atomicity, create/remove rollback, worktree/clone safety, exact target resolution, and host-global workspace boundaries.
- Wave 2 *(blocked on Wave 1 completion)*: `06-02-PLAN.md` audits project-local workstream state, canonical index/state validation, waiting states, dirty-tree active transitions, and resume snapshot restoration.
- Wave 3 *(blocked on Wave 2 completion)*: `06-03-PLAN.md` audits cleanup protected-scope behavior, closeout evidence, report-before-mutate ordering, destination/overwrite gates, and partial filesystem failure visibility.
- Wave 4 *(blocked on Wave 3 completion)*: `06-04-PLAN.md` audits advisory update boundaries and patch replay preview/replay/audit behavior.
- Wave 5 *(blocked on Waves 1-4 completion)*: `06-05-PLAN.md` reconciles Phase 6 bug reports, updates the bug index slice row, and verifies the discovery-only boundary.

**Cross-cutting constraints:**
- Preserve discovery-only execution: Phase 6 may write bug reports, bug index updates, and planning summaries, but must not fix source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, workspace, patch-registry, branch, PR, remote-service, or git-history defects.
- Keep host-global operational state bounded to `~/.<host>/blueprint/` for workspace registry, update metadata, and patch registry behavior.
- Keep workstream state project-local under `.blueprint/workstreams/` and do not reintroduce global workstream indexes, `.planning/` ownership, or workstream config toggles.
- Treat destructive maintenance flows as preview-confirm-mutate-validate flows and file bugs when visible confirmation, exact target, dirty-tree, rollback, or report-before-mutate guarantees are under-constrained.
- Prefer static contract review plus targeted existing tests before disposable probes; any probe must use disposable temp roots and document cleanup.

**Success criteria:**
1. Host-global registry boundaries and transactional behavior are checked.
2. Dirty-tree, confirmation, rollback, and compatibility blockers are checked.
3. Advisory update and patch registry behavior are checked.
4. All confirmed or likely defects are documented in `docs/bugs/*.md`.

**Execution status:** validated on 2026-05-02; BPBUG-002 and BPBUG-003 were recorded during execution, Phase 6 Nyquist coverage was rechecked in `06-VALIDATION.md`, and the phase is ready to begin Phase 7 planning.

### Phase 7: Host Packaging Build Hooks Audit

**Goal:** Find and document defects in extension packaging, build outputs, host manifests, advisory hooks, and install readiness.

**Mapped requirements:** COV-06, NFIX-01, NFIX-02, NFIX-03

**Dependencies:** Phase 1 bug-reporting harness.

**UI hint:** no

**Suggested surfaces:**
- `gemini-extension.json`, `tabnine-extension.json`, `package.json`, `scripts/build.mjs`, `scripts/lib/extension-hosts.mjs`
- `hooks/hooks.json`, `src/hooks/*.ts`, `src/shared/security.ts`
- generated `dist/`
- extension install and hook tests

**Plan artifacts:**
- Wave 1: `07-01-PLAN.md` audits Gemini/Tabnine host manifests, host context files, shared host metadata, and runtime-contract coverage.
- Wave 1: `07-02-PLAN.md` audits package scripts, build pipeline behavior, generated `dist`, copied schemas, tracked built assets, and built runtime smoke.
- Wave 2 *(blocked on Wave 1 completion)*: `07-03-PLAN.md` audits advisory hook configuration, stdin/stdout behavior, shared security reuse, and hook regression coverage.
- Wave 3 *(blocked on Wave 2 completion)*: `07-04-PLAN.md` audits clean-home smoke behavior, staged install bundles, link/install metadata, and optional host/auth integration blockers.
- Wave 4 *(blocked on Waves 1-3 completion)*: `07-05-PLAN.md` reconciles Phase 7 bug reports, updates the bug index slice row, and verifies the discovery-only boundary.
- Execution evidence: `07-01-SUMMARY.md`, `07-02-SUMMARY.md`, `07-03-SUMMARY.md`, `07-04-SUMMARY.md`, and `07-05-SUMMARY.md` are now saved in the phase directory.

**Cross-cutting constraints:**
- Preserve discovery-only execution: Phase 7 may write bug reports, bug index updates, and planning summaries, but must not fix source, manifest, hook, script, package, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, branch, PR, remote-service, or git-history defects.
- Treat generated `dist` drift as evidence only; do not keep rebuilt assets as a repair during this milestone.
- Keep hooks advisory-only and configured through `hooks/hooks.json`, with MCP and shared security owning enforcement.
- Keep install and smoke probes disposable through staged bundles, clean homes, fake CLIs, or containers; document Docker, Tabnine installer, or Gemini auth blockers separately from Blueprint defects.

**Success criteria:**
1. Built asset presence and packaging contract alignment are checked.
2. Gemini/Tabnine host env wiring is checked.
3. Advisory hook behavior is checked against docs and tests.
4. All confirmed or likely defects are documented in `docs/bugs/*.md`.

**Execution status:** validated on 2026-05-02 after BPBUG-004 repair; BPBUG-004 was recorded for a stale tracked build bundle that omitted audit-fix generated assets, then repair commit `350e87a` refreshed the generated `dist/` bundle and the Phase 7 targeted validation subset passed with 27 passing tests and 0 failures. No confirmed or likely defects were found in Plans 01, 03, and 04, and Plan 04 documented Docker as an environment blocker for the containerized install integration run.

### Phase 8: Cross-Cut Drift And Regression Gaps

**Goal:** Find and document cross-cutting contract drift, missing regression coverage, schema drift, and issue clusters from the codebase concern map.

**Mapped requirements:** CLASS-04, EVID-04, COV-07, COV-08, NFIX-01, NFIX-02, NFIX-03

**Dependencies:** Phases 2 through 7.

**UI hint:** no

**Suggested surfaces:**
- `docs/DECISIONS.md`, `docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`, `docs/COMMAND-CATALOG.md`, `docs/commands/*.md`
- `commands/*.toml`, `skills/*/SKILL.md`, `agents/*.md`
- `.planning/codebase/CONCERNS.md`
- all relevant tests and generated assets identified in previous phases

**Success criteria:**
1. Docs/source/test drift findings are separated from confirmed runtime behavior bugs.
2. Missing regression coverage is documented as bugs or test-gap reports where it creates risk.
3. Shared root-cause clusters are linked.
4. All confirmed or likely defects are documented in `docs/bugs/*.md`.

### Phase 9: Bug Index Priority Review

**Goal:** Dedupe and classify the full bug inventory so the user can choose repair work later.

**Mapped requirements:** BUG-04, REPAIR-01, REPAIR-02, REPAIR-03, NFIX-01, NFIX-02, NFIX-03

**Dependencies:** Phases 1 through 8.

**UI hint:** no

**Success criteria:**
1. `docs/bugs/INDEX.md` links every bug report and records severity, confidence, affected surface, status, and discovery phase.
2. Duplicates and related bugs are marked and cross-linked.
3. Highest-priority repair candidates are summarized without implementing fixes.
4. Remaining verification questions are listed separately from confirmed defects.

## Coverage Validation

All v1 requirements in `.planning/REQUIREMENTS.md` are mapped to at least one phase. The no-fix requirements apply to every phase and should be verified at phase boundaries.

---
*Roadmap created: 2026-05-01*
*Last updated: 2026-05-02 after Phase 7 partial validation*
