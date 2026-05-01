# Requirements: Blueprint Defect Discovery Milestone

**Defined:** 2026-05-01
**Core Value:** Every meaningful current Blueprint defect is captured as a detailed, evidence-backed bug document that can later drive safe, prioritized fixes.

## v1 Requirements

### Product Boundary

- [ ] **BOUND-01**: Auditor treats Blueprint as a Gemini-native CLI extension, not as GSD internals or a legacy port.
- [ ] **BOUND-02**: Auditor uses Blueprint docs, command manifests, skills, MCP tools, tests, generated assets, and source files as the expected/actual evidence base.
- [ ] **BOUND-03**: Auditor distinguishes `.blueprint/` runtime state from `.planning/` implementation bookkeeping.

### Audit Harness

- [ ] **HARN-01**: `docs/bugs/` exists before slice findings are recorded.
- [ ] **HARN-02**: Bug reports use stable ids and filenames in the form `BPBUG-###-short-slug.md`.
- [ ] **HARN-03**: A reusable bug-report schema exists and is applied consistently to every finding.
- [ ] **HARN-04**: `docs/bugs/INDEX.md` summarizes every bug id, title, severity, confidence, affected surface, status, and phase of discovery.

### Bug Documentation

- [ ] **BUG-01**: Each confirmed or strongly suspected defect is recorded in its own `docs/bugs/*.md` file, unless it is clearly a duplicate of an existing bug report.
- [ ] **BUG-02**: Each bug report includes expected behavior, actual behavior, user/runtime impact, evidence, reproduction or verification steps, likely cause, suggested fix direction, affected files, and related bugs.
- [ ] **BUG-03**: Each bug report explicitly states that no fix was applied in this milestone.
- [ ] **BUG-04**: Duplicate or related findings are linked instead of being silently repeated.

### Classification

- [ ] **CLASS-01**: Every bug is classified by severity: `critical`, `high`, `medium`, `low`, or `info`.
- [ ] **CLASS-02**: Every bug is classified by confidence: `confirmed`, `likely`, or `suspected`.
- [ ] **CLASS-03**: Every bug is classified by affected surface: command, skill, MCP tool, hook, docs, tests, build, generated assets, state artifacts, host behavior, or cross-cutting.
- [ ] **CLASS-04**: Contract drift, runtime behavior defects, documentation defects, test gaps, packaging defects, and performance/scaling risks are distinguishable in the bug docs.

### Evidence Quality

- [ ] **EVID-01**: Every bug cites exact file paths, command outputs, test names, line-level references where useful, or runtime contract mismatches.
- [ ] **EVID-02**: Every bug includes reproduction or verification steps that a later fixer can run or inspect.
- [ ] **EVID-03**: Uncertainty is explicitly documented instead of being presented as fact.
- [ ] **EVID-04**: When a finding comes from docs/source drift, the report cites both sides of the mismatch.

### Slicing

- [ ] **SLICE-01**: The audit is split into workflow-level or more granular slices.
- [ ] **SLICE-02**: Each slice records the surfaces examined and the surfaces intentionally deferred.
- [ ] **SLICE-03**: Each slice can complete without depending on source fixes from another slice.

### Workflow Coverage

- [ ] **COV-01**: Bootstrap, router, config, help, progress, health, and map-first readiness behavior are audited.
- [ ] **COV-02**: Core phase lifecycle behavior is audited: discuss, research, UI, plan, execute, validate, UAT, and add-tests.
- [ ] **COV-03**: Roadmap administration, milestone flows, capture commands, lightweight execution, and debug are audited.
- [ ] **COV-04**: Review, security, UI-review, peer-review, docs-update, impact, review-branch, ship, and undo are audited.
- [ ] **COV-05**: Workspace and maintenance commands are audited for registry, worktree, high-risk confirmation, and global-state boundaries.
- [ ] **COV-06**: Extension host manifests, build pipeline, generated `dist`, hooks, packaging, and install/smoke behavior are audited.
- [ ] **COV-07**: Cross-cut docs/runtime drift and missing regression coverage are audited.
- [ ] **COV-08**: Existing codebase concerns from `.planning/codebase/CONCERNS.md` are considered as candidate bug-discovery leads.

### No-Fix Discipline

- [ ] **NFIX-01**: No source, manifest, skill, test, build, generated asset, or runtime behavior fixes are applied during this milestone.
- [ ] **NFIX-02**: If a verification probe creates temporary files, those files are removed before the phase completes and the probe is documented.
- [ ] **NFIX-03**: Git status is checked at phase boundaries to confirm changes are limited to planning artifacts and `docs/bugs/`.

### Repair Readiness

- [ ] **REPAIR-01**: The final bug index identifies highest-priority repair candidates without selecting fixes.
- [ ] **REPAIR-02**: Each bug report includes enough context for a later repair milestone to estimate scope and risk.
- [ ] **REPAIR-03**: The final milestone summary lists unresolved verification questions separately from confirmed bugs.

## v2 Requirements

Deferred to future repair milestones:

### Fix Execution

- **FIX-01**: Implement selected bug fixes.
- **FIX-02**: Add or update regression tests for fixed bugs.
- **FIX-03**: Refresh generated `dist` assets after source changes.
- **FIX-04**: Update runtime docs after repairs change intended behavior.

### Automation

- **AUTO-01**: Add an automated bug-report generator or MCP-backed defect registry.
- **AUTO-02**: Add a command that can summarize `docs/bugs/` into repair batches.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fixing defects | The user explicitly wants the first milestone to find, classify, and document bugs only. |
| Changing command routing | Discovery can report routing defects, but routing changes belong to a later fix milestone. |
| Adding new Blueprint features | Feature work would obscure defect-discovery evidence. |
| Mutating installed extension state | The audit should not alter user installations or host-global operational state. |
| Treating `.planning/` as runtime | Blueprint runtime state is `.blueprint/`; `.planning/` is local GSD bookkeeping. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOUND-01 | Phase 1 | Pending |
| BOUND-02 | Phase 1 | Pending |
| BOUND-03 | Phase 1 | Pending |
| HARN-01 | Phase 1 | Pending |
| HARN-02 | Phase 1 | Pending |
| HARN-03 | Phase 1 | Pending |
| HARN-04 | Phase 1 | Pending |
| BUG-01 | Phase 1 | Pending |
| BUG-02 | Phase 1 | Pending |
| BUG-03 | Phase 1 | Pending |
| BUG-04 | Phase 9 | Pending |
| CLASS-01 | Phase 1 | Pending |
| CLASS-02 | Phase 1 | Pending |
| CLASS-03 | Phase 1 | Pending |
| CLASS-04 | Phase 8 | Pending |
| EVID-01 | Phase 1 | Pending |
| EVID-02 | Phase 1 | Pending |
| EVID-03 | Phase 1 | Pending |
| EVID-04 | Phase 8 | Pending |
| SLICE-01 | Phase 1 | Pending |
| SLICE-02 | Phase 1 | Pending |
| SLICE-03 | Phase 1 | Pending |
| COV-01 | Phase 2 | Pending |
| COV-02 | Phase 3 | Pending |
| COV-03 | Phase 4 | Pending |
| COV-04 | Phase 5 | Pending |
| COV-05 | Phase 6 | Pending |
| COV-06 | Phase 7 | Pending |
| COV-07 | Phase 8 | Pending |
| COV-08 | Phase 8 | Pending |
| NFIX-01 | All Phases | Pending |
| NFIX-02 | All Phases | Pending |
| NFIX-03 | All Phases | Pending |
| REPAIR-01 | Phase 9 | Pending |
| REPAIR-02 | Phase 9 | Pending |
| REPAIR-03 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-05-01*
*Last updated: 2026-05-01 after initialization*
