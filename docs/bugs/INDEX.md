# Blueprint Bug Index

## Purpose

This index is the triage board for the Blueprint Defect Discovery Milestone.
It tracks every real bug report, preserves shared vocabulary, records duplicate
relationships, and keeps the milestone discovery-only.

## Bug Reports

| ID | Title | Severity | Confidence | Surface | Status | Discovery Phase | Impact | Likely Cause | Report |
|----|-------|----------|------------|---------|--------|-----------------|--------|--------------|--------|
| BPBUG-001 | next real bug id | none yet | none yet | none yet | next real bug id | pending | reserved for the first real defect | pending discovery evidence | pending |

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

## Illustrative Example

- [`BPBUG-000-illustrative-example.md`](./BPBUG-000-illustrative-example.md)
  demonstrates the report format only.
- `BPBUG-000` is excluded from real defect totals and must not be used as repair evidence.
- `BPBUG-001` remains the next real bug id.

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
| Phase 3 | pending | pending | pending |
| Phase 4 | pending | pending | pending |
| Phase 5 | pending | pending | pending |
| Phase 6 | pending | pending | pending |
| Phase 7 | pending | pending | pending |
| Phase 8 | pending | pending | pending |
| Phase 9 | pending | pending | pending |

Later phases should update their slice row when they complete even if no bugs
are found.

## Routing Guardrails

Planned-only or non-routable Blueprint commands must not be recommended as
immediate remediation paths in discovery findings.
