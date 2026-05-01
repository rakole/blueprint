# Research: Defect Discovery Features

**Date:** 2026-05-01
**Scope:** What the bug-discovery milestone must produce

## Table Stakes

### Audit Inventory

- Enumerate all implemented Blueprint command families and their owning skill/MCP surfaces.
- Identify source, manifest, skill, agent, doc, test, build, hook, and generated-asset surfaces for each slice.
- Keep the audit rooted in Blueprint's shipped runtime, not legacy GSD assumptions.

### Bug Capture

- Create `docs/bugs/` if missing.
- Write one detailed Markdown file per defect or tightly related defect cluster.
- Add or maintain a bug index that summarizes all discovered defects and links to each report.
- Use stable filenames such as `BPBUG-001-short-slug.md`.

### Classification

- Classify each defect by severity, confidence, affected command/workflow, affected files, impact, and suggested next step.
- Distinguish confirmed bugs from likely drift, suspected gaps, test-only risks, and documentation-only inconsistencies.
- Mark duplicates and related defects instead of scattering the same issue across many files.

### Evidence Quality

- Include exact file paths and reproduction or verification steps.
- Cite command outputs, failing tests, code paths, or documented contract mismatches.
- Explain what was expected, what actually happens, and why that matters.
- Call out partial evidence honestly.

### Discovery-Only Guardrail

- Avoid source fixes, test fixes, manifest fixes, generated `dist` updates, or runtime behavior changes.
- If a minimal probe is needed, keep it read-only or isolated and document the command used.

## Differentiators

### Workflow-Level Slicing

The audit should map defects by product workflow rather than only by file type. This makes later repair planning easier because fixes can be batched by user-visible behavior.

### Contract Drift Focus

Blueprint is docs-and-contract heavy. High-value findings are likely to come from misalignment across:

- `docs/COMMAND-CATALOG.md`
- `commands/blu-*.toml`
- `skills/*/SKILL.md`
- `docs/commands/*.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `src/mcp/server.ts`
- `src/mcp/tools/*.ts`
- `tests/**/*.test.ts`
- generated `dist/`

### Readiness For Later Fixes

Bug reports should be detailed enough that a later milestone can choose a subset and fix them without repeating discovery.

## Anti-Features

- Do not produce a vague audit summary with no per-bug docs.
- Do not combine unrelated defects into one mega-report.
- Do not use severity inflation to force prioritization.
- Do not hide uncertainty.
- Do not fix issues while documenting them.
- Do not recommend planned-only or non-routable Blueprint commands as remediation paths.

## Feature Dependencies

- Bug docs depend on a shared bug template and index vocabulary.
- Workflow-slice audits depend on the current command catalog and runtime reference.
- Reproduction steps depend on targeted source/test inspection and, where needed, build/typecheck/test runs.
- Later prioritization depends on consistent severity and confidence labels.
