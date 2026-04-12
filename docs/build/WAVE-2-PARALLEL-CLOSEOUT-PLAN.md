# Wave 2 Parallel Closeout Plan

Last updated: 2026-04-12

## Locked Decisions

- Wave 2 closeout means the trio only:
  - `complete-milestone`
  - `milestone-summary`
  - `new-milestone`
- `insert-phase` remains blocked and non-routable in this cycle.
- Reuse existing MCP primitives instead of inventing new substrate.
- `complete-milestone` is report-driven and state-driven.
- `milestone-summary` stays Wave 2 local and does not use `blueprint-doc-writer`.
- `new-milestone` defaults to carry-forward and preserves historical phase artifacts.
- Implemented status semantics do not change.
- No new hooks, no new policy tier, and no later-wave agents in this closeout pack.

## Shared Execution Rules

- Claim exactly one task at a time through `scripts/drift-fix-memory.mjs`.
- Stay inside the write scope listed for that task.
- Truth-sync docs, manifests, skills, MCP contracts, and tests together.
- If the work requires a new MCP tool, new hook, or later-wave agent, stop and re-plan.
- Use targeted tests during the task and keep full `npm test` for the final closeout pass.

## Task Queue

### `W2-01` Command-contract repair

- Depends on: none
- Write scope:
  - `docs/commands/complete-milestone.md`
  - `docs/commands/milestone-summary.md`
  - `docs/commands/new-milestone.md`
  - `docs/COMMAND-CATALOG.md`
  - `docs/MCP-TOOLS.md`
  - `docs/GSD-RUNTIME-MIGRATION.md`
  - `docs/SKILLS-AND-AGENTS.md`
  - `docs/ARTIFACT-SCHEMA.md` if needed
- Goal:
  - remove speculative Wave 2 contract drift
  - lock report names, required MCP tools, and follow-up routing
- Done when:
  - `complete-milestone` no longer references `blueprint_phase_mark_complete`
  - `milestone-summary` no longer references `blueprint-doc-writer`
  - `new-milestone` is explicit about carry-forward default and phase continuity
- Verification:
  - `tests/command-contract-docs.test.ts`
  - `tests/drift-repair-docs.test.ts`

### `W2-02` Roadmap-admin skill repair

- Depends on: `W2-01`
- Write scope:
  - `skills/blueprint-roadmap-admin/SKILL.md`
  - skill metadata tests
- Goal:
  - add the trio's explicit workflow rules, confirmation gates, and output contracts
- Done when:
  - the skill defines closeout behavior for `complete-milestone`, `milestone-summary`, and `new-milestone`
  - the skill explicitly keeps `insert-phase` blocked in this cycle
- Verification:
  - `tests/complete-milestone-metadata.test.ts`
  - `tests/milestone-summary-metadata.test.ts`
  - `tests/new-milestone-metadata.test.ts`
  - `tests/skill-bundles-metadata.test.ts`

### `W2-03` `/blu:complete-milestone` manifest

- Depends on: `W2-01`, `W2-02`
- Write scope:
  - `commands/blu/complete-milestone.toml`
  - `tests/complete-milestone-metadata.test.ts`
- Goal:
  - implement the manifest using existing roadmap, artifact, and state tools only
- Done when:
  - the manifest writes `milestone-complete-<milestone>.md`
  - the manifest routes to `/blu:milestone-summary <milestone>`
  - the manifest does not introduce a new MCP tool or direct file-edit path
- Verification:
  - `tests/complete-milestone-metadata.test.ts`
  - `tests/extension-runtime-contracts.test.ts`

### `W2-04` `/blu:milestone-summary` manifest

- Depends on: `W2-01`, `W2-02`
- Write scope:
  - `commands/blu/milestone-summary.toml`
  - `tests/milestone-summary-metadata.test.ts`
- Goal:
  - implement the final milestone summary manifest using saved audit and completion evidence
- Done when:
  - the manifest writes `milestone-summary-<milestone>.md`
  - the manifest routes to `/blu:new-milestone`
  - the manifest does not reference `blueprint-doc-writer`
- Verification:
  - `tests/milestone-summary-metadata.test.ts`
  - `tests/extension-runtime-contracts.test.ts`

### `W2-05` `/blu:new-milestone` manifest

- Depends on: `W2-01`, `W2-02`
- Write scope:
  - `commands/blu/new-milestone.toml`
  - `tests/new-milestone-metadata.test.ts`
- Goal:
  - implement carry-forward milestone-start behavior with the existing scaffold flow
- Done when:
  - carry-forward is the default path
  - the manifest preserves historical phase directories
  - the manifest scaffolds the first next whole-number phase context
  - the manifest routes to `/blu:discuss-phase <first phase>`
- Verification:
  - `tests/new-milestone-metadata.test.ts`
  - `tests/extension-runtime-contracts.test.ts`

### `W2-06` Routing and progress integration

- Depends on: `W2-03`, `W2-04`, `W2-05`
- Write scope:
  - `src/mcp/tools/state.ts`
  - progress and routing tests
- Goal:
  - teach state-derived routing to detect audit, completion, and summary reports in order
- Done when:
  - post-closeout routing becomes `audit-milestone` -> `complete-milestone` -> `milestone-summary` -> `new-milestone`
  - implemented-only routing semantics remain unchanged
- Verification:
  - `tests/help-progress-health.test.ts`
  - `tests/next.test.ts`

### `W2-07` Catalog and control-plane truth sync

- Depends on: `W2-03`, `W2-04`, `W2-05`, `W2-06`
- Write scope:
  - command-catalog tests
  - runtime contract tests
  - `README.md`
  - `docs/GOLIVE.MD`
  - `MEMORY.md`
  - `AGENTS.md`
  - other closeout docs that still advertise the trio as unshipped
- Goal:
  - promote the trio to `implemented` only after the manifests, skill contract, and required tools all line up
- Done when:
  - shipped-surface docs no longer say `complete-milestone` is merely the next slice
  - runtime catalog tests expect the trio as implemented
  - `insert-phase` still stays blocked
- Verification:
  - `tests/command-catalog.test.ts`
  - `tests/extension-runtime-contracts.test.ts`
  - `tests/drift-repair-docs.test.ts`

### `W2-08` Final regression and blocked-surface guard

- Depends on: `W2-07`
- Write scope:
  - regression tests only
  - any minimal fixup discovered from those tests
- Goal:
  - validate the full Wave 2 closeout pack without widening scope
- Done when:
  - targeted Wave 2 suites pass
  - `insert-phase` remains blocked
  - hooks remain advisory
  - no Wave 3, Wave 4, or Wave 5 command was accidentally exposed
- Verification:
  - `tests/complete-milestone-metadata.test.ts`
  - `tests/milestone-summary-metadata.test.ts`
  - `tests/new-milestone-metadata.test.ts`
  - `tests/command-catalog.test.ts`
  - `tests/command-contract-docs.test.ts`
  - `tests/skill-bundles-metadata.test.ts`
  - `tests/help-progress-health.test.ts`
  - `tests/next.test.ts`
  - `tests/extension-runtime-contracts.test.ts`
  - `tests/drift-repair-docs.test.ts`
  - `tests/hooks.test.ts`
  - full `npm test`

## Parallel Batches

1. Batch A:
   - `W2-01`
   - `W2-02`
2. Batch B:
   - `W2-03`
   - `W2-04`
   - `W2-05`
3. Batch C:
   - `W2-06`
   - `W2-07`
4. Batch D:
   - `W2-08`

## Release Gate

This closeout cycle is done only when:

- the trio is implemented in docs and runtime catalog
- the build-pack docs remain present under `docs/build/`
- routing recommends the trio in the correct order
- `insert-phase` is still blocked
- the final `npm test` pass is green
