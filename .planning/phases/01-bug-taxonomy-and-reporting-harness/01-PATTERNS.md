# Phase 1: Bug Taxonomy And Reporting Harness - Pattern Map

**Mapped:** 2026-05-01
**Scope:** Docs-only bug-reporting harness under `docs/bugs/`

## Planned Files

| Target File | Role | Closest Existing Analog | Pattern To Reuse |
|-------------|------|-------------------------|------------------|
| `docs/bugs/TEMPLATE.md` | Canonical per-bug authoring contract | `docs/ARTIFACT-SCHEMA.md`; `src/mcp/artifact-contracts/index.ts` artifact templates | Explicit required headings, locked vocabulary, examples, and validation notes. |
| `docs/bugs/INDEX.md` | Rich triage board and dedupe ledger | `docs/COMMAND-CATALOG.md`; `.planning/ROADMAP.md` | Markdown table with stable ids, status, risk, and links plus explanatory sections. |
| `docs/bugs/BPBUG-000-illustrative-example.md` | Non-real example report | `docs/commands/plan-phase.md` for command/evidence framing; review report contracts in `src/mcp/artifact-contracts/index.ts` | Self-contained report with frontmatter, expected/actual/evidence/reproduction sections, and no-fix statement. |

## Data Flow

1. Later audit phases inspect Blueprint docs, command manifests, skills, MCP tools, hooks, tests, generated assets, and command outputs.
2. Each confirmed, likely, or suspected defect becomes one `docs/bugs/BPBUG-###-short-slug.md` report using `docs/bugs/TEMPLATE.md`.
3. `docs/bugs/INDEX.md` receives or updates one row per real bug and tracks duplicates or invalid findings.
4. Phase 9 dedupes and prioritizes the full index without needing to reread every report.

## Concrete Patterns

### Markdown Tables

Use the existing `docs/COMMAND-CATALOG.md` pattern: broad but compact table rows with links to detailed docs.

Required index columns:

```markdown
| ID | Title | Severity | Confidence | Surface | Status | Discovery Phase | Impact | Likely Cause | Report |
```

### Frontmatter And Required Sections

Use the existing plan/report pattern of frontmatter followed by required headings. The template should define exact values instead of free-form prose for fields later phases must aggregate.

Required frontmatter keys:

```yaml
id:
title:
severity:
confidence:
surface:
status:
discovery_phase:
reported:
```

### Evidence Layout

Use both inline evidence references and a consolidated evidence table. This matches the context decision while keeping later repair work scannable.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Later phases invent incompatible vocabulary. | Centralize vocabulary in `TEMPLATE.md` and repeat it in `INDEX.md` guidance. |
| The illustrative example is counted as a real defect. | Use `BPBUG-000`, `closed-invalid`, and repeated `ILLUSTRATIVE ONLY` labeling. |
| Discovery drifts into fixing. | Require `No Fix Applied` in template, index guidance, and example report. |
| `.planning/` is mistaken for Blueprint runtime state. | Template and example should explicitly distinguish `.blueprint/` from `.planning/`. |

## Executor Notes

- Keep this phase docs-only: do not edit source, tests, manifests, skills, generated assets, or runtime state.
- Use ASCII-only Markdown unless existing surrounding docs require otherwise.
- Verify with file reads, `rg`, and `git status --short`; no build is needed.
