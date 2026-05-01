# Research: Defect Discovery Architecture

**Date:** 2026-05-01
**Scope:** How the audit should be structured

## Audit Architecture

The milestone should behave like a read-only quality investigation with durable outputs:

```text
Blueprint contracts and code
  -> workflow-slice audit
  -> defect evidence packet
  -> docs/bugs/BPBUG-###-slug.md
  -> docs/bugs/INDEX.md
  -> final dedupe and priority review
```

## Primary Audit Slices

1. **Bug Taxonomy And Reporting Harness**
   - Define bug ids, severity, confidence, file template, index format, and evidence standard.

2. **Bootstrap, Router, Config, And Health**
   - `/blu`, `new-project`, `help`, `progress`, `next`, `settings`, `set-profile`, `health`, command catalog, project status, config normalization, map-first states.

3. **Core Phase Lifecycle**
   - `discuss-phase`, `research-phase`, `ui-phase`, `plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, `add-tests`, state transitions, phase artifacts, checkpoints, summaries, validation/UAT.

4. **Roadmap, Capture, And Lightweight Execution**
   - `add-phase`, `insert-phase`, `remove-phase`, milestone commands, notes, todos, backlog, explore, fast, quick, debug.

5. **Review, Quality, Docs, Impact, And Shipping**
   - `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `docs-update`, `impact`, `pr-branch`, `ship`, `undo`.

6. **Workspace And Maintenance**
   - `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `update`, `reapply-patches`, host-global registry and high-risk confirmation contracts.

7. **Extension Host, Packaging, Build, Dist, And Hooks**
   - `gemini-extension.json`, `tabnine-extension.json`, `hooks/`, `scripts/build.mjs`, generated `dist/`, package scripts, install/smoke tests.

8. **Cross-Cut Drift And Regression Gaps**
   - Reconcile docs, manifests, skills, agents, MCP registrations, tests, generated assets, and memory. Identify missing regression tests for confirmed defects.

9. **Bug Index And Priority Review**
   - Dedupe, classify, link, and prepare the bug inventory for a future fix milestone.

## Data Flow For Each Slice

1. Read the contract baseline for the slice.
2. Inventory implementation surfaces and tests.
3. Compare intended behavior to actual behavior.
4. Run targeted read-only or verification commands if needed.
5. Create one bug doc per defect or defect cluster.
6. Update `docs/bugs/INDEX.md`.
7. Record unresolved questions and follow-up verification needs.

## Boundaries

- Source code edits are out of scope unless they are bug documents or planning artifacts.
- Generated outputs should be inspected for drift, but not repaired.
- Host-global state should not be mutated.
- Optional agent/tool absence should be treated as a defect only if Blueprint docs promise behavior that the runtime does not provide or degrade from safely.

## Build Order Implications

The bug-reporting harness should happen first so all later slices produce consistent artifacts. Cross-cut dedupe and priority review should happen last because earlier slices will naturally discover duplicates and related issues.
