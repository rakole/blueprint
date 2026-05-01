# Phase 1: Bug Taxonomy And Reporting Harness - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

## Phase Boundary

Define the shared defect-reporting harness that every later audit phase will use:
the `docs/bugs/` directory, the canonical per-bug template, a seeded example
bug report, the rich bug index, shared lifecycle and classification vocabulary,
and the audit rules that keep the milestone discovery-only.

This phase does not audit workflow-specific Blueprint surfaces and does not fix
source defects.

## Implementation Decisions

### Bug Document Structure
- **D-01:** The canonical per-bug authoring contract should live in
  `docs/bugs/TEMPLATE.md`.
- **D-02:** Phase 1 should also seed one realistic fake bug report that exists
  only to demonstrate the reporting format; it must not be mistaken for a real
  confirmed Blueprint defect.
- **D-03:** Individual bug reports should cite evidence inline where relevant and
  also end with a consolidated evidence section for quick scanning.

### Bug Index Structure
- **D-04:** `docs/bugs/INDEX.md` should be a rich triage board rather than a
  thin ledger.
- **D-05:** Each index row should include `id`, `title`, `severity`,
  `confidence`, `surface`, `status`, `discovery phase`, `short impact summary`,
  `likely cause summary`, and a link to the full bug report.

### Lifecycle And Classification Vocabulary
- **D-06:** The durable status vocabulary should be `new`, `triaged`, `planned`,
  `in-progress`, `fixed`, `verified`, `closed`, `duplicate`, and
  `closed-invalid`.
- **D-07:** Even though this milestone is discovery-only, the harness should
  define the full lifecycle vocabulary now so later repair work can reuse it
  without redesigning the bug docs.

### Audit Guardrails
- **D-08:** The harness must keep the no-fix rule visible in the template,
  example, and index guidance so later phases do not slide into source repair.
- **D-09:** The harness should preserve Blueprint-specific language throughout:
  downstream audits must treat Blueprint as a Gemini-native extension, not as
  GSD internals or a legacy slash-command port.

### the agent's Discretion
- Exact heading wording can align with existing Blueprint report style as long
  as the locked bug fields remain present.
- The seeded fake example can use any plausible Blueprint defect scenario, so
  long as it is clearly marked illustrative and not real audit evidence.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Contract
- `.planning/PROJECT.md` — defines the discovery-only milestone, output target
  under `docs/bugs/*.md`, and the Blueprint-not-GSD boundary.
- `.planning/REQUIREMENTS.md` — locks the Phase 1 harness requirements for bug
  ids, schema, classifications, evidence, slicing, and no-fix discipline.
- `.planning/ROADMAP.md` — defines the Phase 1 goal, dependencies, and success
  criteria for the reusable bug-reporting harness.
- `.planning/STATE.md` — captures the active milestone guardrails and current
  workflow posture for Phase 1.

### Blueprint Product And Runtime Baseline
- `docs/DECISIONS.md` — locked Blueprint product/runtime decisions, especially
  state boundaries and implemented-only routing expectations.
- `docs/ARCHITECTURE.md` — high-level Blueprint architecture, source-of-truth
  layers, and state boundaries that later bugs will cite against.
- `docs/ARTIFACT-SCHEMA.md` — existing Blueprint document/report conventions and
  section patterns that the bug harness should align with where useful.
- `docs/MCP-TOOLS.md` — authoritative runtime tool names and contracts that
  later audit slices will use as evidence targets.

### Codebase Maps For Later Audit Slices
- `.planning/codebase/STRUCTURE.md` — inventory of repo surfaces (`commands/`,
  `skills/`, `src/`, `tests/`, `dist/`, `docs/`) that future bug reports will
  cite.
- `.planning/codebase/CONVENTIONS.md` — naming, testing, and evidence-citation
  conventions relevant to bug-report file references.
- `.planning/codebase/ARCHITECTURE.md` — implemented behavior summary grounded
  in the codebase, useful when later reports need both docs-side and code-side
  evidence.

### Research Baseline
- `.planning/research/SUMMARY.md` — table-stakes summary for the bug-reporting
  harness and the nine-phase discovery shape.
- `.planning/research/FEATURES.md` — expected bug-capture behaviors, evidence
  quality rules, and anti-features to avoid in the harness.

## Existing Code Insights

### Reusable Assets
- `docs/ARTIFACT-SCHEMA.md` and `src/mcp/artifact-contracts/index.ts` already
  establish a house style for durable Markdown artifacts using explicit
  sections such as summary, evidence, and next-safe-action.
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, and `.planning/ROADMAP.md`
  already lock the required bug fields, output location, and no-fix boundary.
- `.planning/codebase/*.md` already gives later audit slices a ready-made map of
  the surfaces each bug report will inspect and cite.

### Established Patterns
- Blueprint truth is intentionally split across docs, manifests, skills, MCP
  tools, tests, and generated assets; bug reports should be ready to cite both
  contract and implementation evidence when they drift.
- Planning artifacts are phase-scoped under `.planning/phases/<phase>/`, while
  user-facing durable audit outputs belong under `docs/`.
- Markdown is the durable artifact format for this repo's planning and reporting
  surfaces.

### Integration Points
- The new harness belongs under `docs/bugs/`, not `.blueprint/` and not
  `.planning/`.
- Later audit phases (2 through 9) will consume the template, example, index,
  and shared vocabularies from this phase.
- Phase-boundary hygiene should include checking `git status` so discovery work
  stays limited to planning artifacts and `docs/bugs/`.

## Specific Ideas

- Seed one realistic fake bug report purely to demonstrate formatting and field
  expectations.
- Keep the index rich enough to support later prioritization without requiring a
  re-read of every bug doc.
- Use the full lifecycle status vocabulary as the durable reporting contract,
  even though this milestone itself should only discover and document defects.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 1-Bug Taxonomy And Reporting Harness*
*Context gathered: 2026-05-01*
