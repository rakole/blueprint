# Phase 9: Bug Index Priority Review - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

## Phase Boundary

Discovery-only review of Blueprint's accumulated bug inventory so later repair
planning can start from a deduped, cross-linked, prioritized defect set. This
phase organizes `docs/bugs/INDEX.md` and the existing `BPBUG-001` through
`BPBUG-005` reports into an explicit repair-planning view. It does not fix
source, manifests, tests, generated assets, runtime behavior, or host state.

Phase 9 should preserve the earlier discovery evidence while answering the
final inventory-management questions that earlier phases intentionally deferred:
how to rank repair candidates, how to distinguish duplicates from related
bugs, how to present repair batches, and where to keep unresolved verification
questions without polluting the confirmed bug table.

## Implementation Decisions

### Priority Rubric
- **D-01:** Preserve `severity` and `confidence` as descriptive defect metadata, but add a separate repair-priority lens for Phase 9 outputs. Repair priority should be driven by current impact, blast radius, and repair leverage, not by severity alone.
- **D-02:** Separate active repair candidates from already repaired or verification-only defects before ranking. Inventory history and active repair ordering are different views and should not be merged.
- **D-03:** Break ties between similarly severe bugs by cross-cutting safety leverage or recurrence risk before considering effort or discovery order.
- **D-04:** Present repair priority in three bands: `Now`, `Next`, and `Later`, rather than only a flat numeric list.

### Duplicate Vs Related Policy
- **D-05:** Mark a finding as a duplicate only when it describes the same user-visible defect and would be resolved by the same repair change. Shared root cause alone is not enough.
- **D-06:** Keep distinct but related bugs separate when they have different affected surfaces, evidence, or repair paths. Connect them through `Related Bugs` links and root-cause clusters instead of collapsing them.
- **D-07:** When duplicates are found, the earliest or most complete evidence-backed report becomes the canonical bug. Duplicate entries should keep explicit back-links to that canonical report.
- **D-08:** Duplicate status must be explicit in both the index and the bug document trail; cluster membership must not be used as an implicit duplicate marker.

### Repair-Batch Presentation
- **D-09:** Summarize Phase 9 repair work as batches first, with ordered bugs inside each batch, rather than only as a flat per-bug list.
- **D-10:** Define each batch by shared repair direction and validation surface, not by discovery phase alone.
- **D-11:** Use the current inventory to seed three summary lanes: active runtime and safety fixes, contract and test hardening, and docs synchronization cleanup.
- **D-12:** Keep repaired or verification-only items visible in the inventory, but separate them from active candidates in the repair summary so closed work does not distort the next repair plan.

### Open Questions Lane
- **D-13:** Keep unresolved verification questions in a separate `Verification Questions / Follow-Ups` lane outside the main confirmed bug table.
- **D-14:** Only put evidence gaps, verification follow-ups, or low-confidence leads in that lane. Confirmed defects stay in the bug table, and feature ideas stay out of scope.
- **D-15:** Open questions should affect repair ordering only when they could materially change bug scope or urgency. Otherwise they remain tracked context, not blockers.
- **D-16:** If Blueprint later mirrors this inventory into GitHub Issues or Projects, preserve the same split: confirmed defects as issues, open questions as a separate tracking thread, discussion, or non-bug section rather than duplicate bug rows.

### the agent's Discretion
- The researcher and planner may choose the exact markdown table shapes for the Phase 9 outputs, but they must preserve separate fields or sections for repair priority, duplicate status, related-bug clustering, and open questions.
- The planner may rename the three suggested repair lanes if a better label set fits the final inventory, but the grouping must still reflect shared repair direction and validation surface.
- The planner may refine the active-candidate ordering after re-reading the bug reports, especially if one report's status has changed since discovery. For example, BPBUG-004 should be checked for current status freshness before it is ranked beside unresolved bugs.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Guardrails
- `.planning/PROJECT.md` - discovery-only milestone contract, Blueprint-not-GSD boundary, and the requirement that bug outputs live under `docs/bugs/`.
- `.planning/REQUIREMENTS.md` - Phase 9 requirements, especially `BUG-04`, `REPAIR-01`, `REPAIR-02`, `REPAIR-03`, and `NFIX-*`.
- `.planning/ROADMAP.md` - Phase 9 goal, dependencies, and success criteria.
- `.planning/STATE.md` - current milestone continuity, known blockers, and the Phase 8 handoff state.

### Prior Phase Context
- `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-CONTEXT.md` - root-cause clustering rules, drift standards, and the explicit deferral of final repair prioritization to Phase 9.
- `.planning/phases/05-review-quality-impact-shipping-audit/05-CONTEXT.md` - BPBUG-001 background and the evidence-backed mutation-safety standard.
- `.planning/phases/06-workspace-maintenance-audit/06-CONTEXT.md` - BPBUG-002 and BPBUG-003 background plus destructive-flow and docs-drift framing.
- `.planning/phases/07-host-packaging-build-hooks-audit/07-VALIDATION.md` - BPBUG-004 validation state after the later repair pass.

### Current Bug Inventory
- `docs/bugs/INDEX.md` - canonical inventory table, root-cause clusters, slice coverage, and routing guardrails.
- `docs/bugs/TEMPLATE.md` - bug report schema and vocabulary that Phase 9 must preserve while reorganizing the index.
- `docs/bugs/BPBUG-001-ship-undo-report-contracts-underconstrained.md` - contract-hardening defect and under-specified high-risk evidence cluster anchor.
- `docs/bugs/BPBUG-002-cleanup-lacks-behavioral-regression-coverage.md` - destructive-flow regression-gap defect and missing-guard cluster anchor.
- `docs/bugs/BPBUG-003-mcp-tools-docs-stale-update-return-shapes.md` - shared-doc drift defect and docs/runtime synchronization cluster anchor.
- `docs/bugs/BPBUG-004-stale-built-bundle-omits-audit-fix-generated-assets.md` - generated-asset freshness defect whose current status must be reconciled against the later quick repair.
- `docs/bugs/BPBUG-005-repo-root-guard-accepts-any-git-entry.md` - cross-cutting repo-root safety defect and current runtime-boundary risk.

### Codebase Context
- `.planning/codebase/TESTING.md` - test-suite structure and the repo's evidence patterns for regression and metadata coverage.
- `.planning/codebase/STRUCTURE.md` - source-of-truth locations for docs, tests, manifests, generated assets, and planning artifacts referenced by the bug reports.
- `.planning/codebase/CONVENTIONS.md` - naming and artifact-organization patterns that make the bug inventory predictable and searchable.

### External Process References
- [Atlassian bug triage guide](https://www.atlassian.com/agile/software-development/bug-triage) - prioritization should consider severity, impact, and deadlines rather than severity alone.
- [Azure Boards bug management](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/manage-bugs?view=azure-devops) - severity and priority are distinct fields; severe defects do not always get the highest immediate priority.
- [GitHub duplicate issue docs](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/marking-issues-or-pull-requests-as-a-duplicate) - duplicates should be explicitly marked and tied to a canonical issue.
- [GitHub issues overview](https://docs.github.com/en/issues/tracking-your-work-with-issues/learning-about-issues/about-issues) - issues are for tracked work, discussions are better for question-oriented threads, and metadata plus projects are the structured organization layer.
- [GitHub issue fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-issue-fields) - structured fields are useful for consistent priority and status metadata across an inventory.
- [GitHub milestones](https://docs.github.com/en/enterprise-cloud@latest/issues/using-labels-and-milestones-to-track-work/about-milestones) - grouped and ordered milestones are a practical model for presenting repair batches.

## Existing Code Insights

### Reusable Assets
- `docs/bugs/INDEX.md` already has the canonical table, vocabulary section, root-cause clusters, and phase coverage table that Phase 9 should extend rather than replace.
- The five real bug reports already contain severity, confidence, impact, likely cause, related-bug, and no-fix sections, so Phase 9 can prioritize without inventing a new bug schema.
- `.planning/phases/08-cross-cut-drift-and-regression-gaps/08-CONTEXT.md` already established the cluster vocabulary and the rule that shared root cause does not automatically imply duplication.

### Established Patterns
- Discovery phases keep defects as markdown artifacts under `docs/bugs/` and use `.planning/` only for workflow context, not as runtime state.
- Root-cause clusters and duplicate relationships are separate concepts in this repo and should stay separate in the final priority view.
- High-risk and cross-cutting defects are expected to carry explicit evidence, not just narrative ranking claims.
- The repo already distinguishes runtime truth, docs drift, generated-asset freshness, and missing regression coverage as materially different defect classes.

### Integration Points
- Phase 9 will likely update `docs/bugs/INDEX.md`, possibly touch individual bug statuses or related-bug links, and produce a milestone-level repair summary without changing underlying source behavior.
- Any repair-batch output should stay consistent with existing bug vocabulary so later repair planning can map directly from Phase 9 into follow-up issues, plans, or milestones.
- Status freshness matters: a bug report that has since been repaired or partially validated must stay visible as inventory history while being kept distinct from unresolved repair candidates.

## Specific Ideas

Use the Phase 9 summary to make the repair queue legible at a glance:

- Lead with current active runtime or safety risks before docs cleanup or hygiene work.
- Keep contract and regression-hardening items together when they share the same repair style even if they came from different discovery phases.
- Reconcile BPBUG-004's current status before final ranking so the repair summary reflects current work, not just discovery-time snapshots.
- Keep the open-questions lane short and explicitly non-bug so it does not re-inflate the defect count.

## Deferred Ideas

- If Blueprint later migrates this markdown inventory into GitHub Issues or Projects, preserve the same confirmed-defect versus open-question split instead of flattening both into a single issue list.

---

*Phase: 9-Bug Index Priority Review*
*Context gathered: 2026-05-02*
