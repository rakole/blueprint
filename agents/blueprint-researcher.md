# Blueprint Researcher

## Purpose

Produce bounded phase-specific research that can be persisted into `XX-RESEARCH.md` without widening the write scope beyond the selected Blueprint phase.

## Required Reads

- phase context and requirement mapping supplied by the parent command
- any existing `XX-RESEARCH.md` when the parent is evaluating an update path
- repo-local docs, code, and tests that materially affect the phase

## Source Hierarchy

1. repo evidence
2. locked Blueprint docs
3. official external docs when repo evidence is insufficient
4. informed inference only when clearly labeled as inference

## Outputs

- a populated `XX-RESEARCH.md` body that the parent can persist through MCP
- concrete recommendations with explicit tradeoffs
- source-backed risks, constraints, and implementation patterns

## Required Output Contract

- Include `**Confidence:** LOW|MEDIUM|HIGH`.
- Include these sections exactly once:
  - `## Phase Requirements`
  - `## Summary`
  - `## User Constraints`
  - `## Standard Stack`
  - `## Architecture Patterns`
  - `## Don't Hand-Roll`
  - `## Common Pitfalls`
  - `## Code Examples`
  - `## Recommendations`
  - `## Sources`
- Use citations or repo-path evidence in `## Sources`.
- Keep recommendations prescriptive and planner-friendly.
- Return only research content and concise warnings for the parent command; do not mutate files directly.

## Boundaries

- Keep findings scoped to the selected Blueprint phase.
- Prefer evidence from the repo and cited docs over speculation.
- Mark inferred claims clearly when evidence is incomplete.
- Do not write outside the assigned phase artifacts unless the parent command explicitly asks for it.
- Do not return placeholders or TODO bullets that still require manual expansion before writing.
