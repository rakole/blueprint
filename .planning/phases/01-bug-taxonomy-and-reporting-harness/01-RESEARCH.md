# Phase 1: Bug Taxonomy And Reporting Harness - Research

**Researched:** 2026-05-01
**Domain:** Blueprint defect-reporting harness for a discovery-only audit milestone
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOUND-01 | Auditor treats Blueprint as Gemini-native, not GSD or legacy port. | Keep explicit Blueprint boundary language in `docs/bugs/TEMPLATE.md`, `docs/bugs/INDEX.md`, and the illustrative example. |
| BOUND-02 | Auditor uses Blueprint docs, manifests, skills, MCP tools, tests, generated assets, and source files as evidence. | Template evidence fields should require expected contract evidence and actual implementation/test/output evidence. |
| BOUND-03 | Auditor distinguishes `.blueprint/` runtime state from `.planning/` bookkeeping. | Template and index guidance should state that runtime defects concern `.blueprint/`; `.planning/` only tracks this audit. |
| HARN-01 | `docs/bugs/` exists before slice findings are recorded. | First execution plan should create the directory and core files before later phases write findings. |
| HARN-02 | Bug reports use stable `BPBUG-###-short-slug.md` names. | Template and index should reserve `BPBUG-000` for the illustrative non-real example and real reports should start at `BPBUG-001`. |
| HARN-03 | Reusable bug-report schema exists and is applied consistently. | `docs/bugs/TEMPLATE.md` should define required headings, metadata values, evidence rules, and no-fix statement. |
| HARN-04 | `docs/bugs/INDEX.md` summarizes every bug id, title, severity, confidence, surface, status, and phase. | Index table should include the richer fields requested in context: impact summary, likely cause summary, and report link. |
| BUG-01 | Each confirmed or strongly suspected defect gets its own bug file unless duplicate. | Template should include duplicate and related-bug fields; index should track duplicate rows instead of hidden repeats. |
| BUG-02 | Each bug includes expected, actual, impact, evidence, reproduction, cause, fix direction, affected files, related bugs. | Required sections should be explicit and grep-verifiable in the template. |
| BUG-03 | Each report states no fix was applied in this milestone. | Add a required `No Fix Applied` section with exact wording guidance. |
| CLASS-01 | Severity vocabulary is `critical`, `high`, `medium`, `low`, `info`. | Define severity table in template and index guidance. |
| CLASS-02 | Confidence vocabulary is `confirmed`, `likely`, `suspected`. | Define confidence table and require uncertainty notes when below confirmed. |
| CLASS-03 | Affected surface vocabulary is command, skill, MCP tool, hook, docs, tests, build, generated assets, state artifacts, host behavior, or cross-cutting. | Use exact surface values in template frontmatter and index table guidance. |
| EVID-01 | Each bug cites exact files, commands, tests, lines, or contract mismatches. | Template should require evidence rows with `source`, `claim`, and `why it matters`. |
| EVID-02 | Each bug includes reproduction or verification steps. | Template should require numbered steps and expected observable outcome. |
| EVID-03 | Uncertainty is explicit. | Template should require an `Uncertainty` section even when confidence is confirmed. |
| SLICE-01 | Audit is split into workflow-level or granular slices. | Index should include `discovery phase`; template should include `surfaces examined` and `surfaces deferred`. |
| SLICE-02 | Each slice records surfaces examined and deferred. | Add required section to every bug report and optional phase handoff guidance in index. |
| SLICE-03 | Each slice can complete without depending on source fixes from another slice. | No-fix and deferred-fix guidance should prevent repair dependencies from blocking discovery. |
| NFIX-01 | No source, manifest, skill, test, build, generated asset, or runtime fixes are applied. | Template and index must visibly state discovery-only boundaries. |
| NFIX-02 | Temporary probe files are removed and documented. | Template should include a probe-cleanup checkbox or note. |
| NFIX-03 | Git status is checked at phase boundaries. | Plans should require `git status --short` verification and limit changed paths to `.planning/` plus `docs/bugs/`. |

## Summary

- Phase 1 should build a documentation harness, not run a defect audit.
- The minimum durable artifact set is `docs/bugs/TEMPLATE.md`, `docs/bugs/INDEX.md`, and `docs/bugs/BPBUG-000-illustrative-example.md`.
- The template is the schema authority for later bug docs; the index is the triage board and dedupe ledger.
- The illustrative example should be unmistakably non-real so later phases do not count it as evidence.
- External currency was not checked because this phase is repo-local documentation and process design.

## Locked Decisions From Context

- `D-01`: the canonical per-bug authoring contract lives in `docs/bugs/TEMPLATE.md`.
- `D-02`: Phase 1 seeds one realistic fake bug report for format demonstration only.
- `D-03`: bug reports cite inline evidence where relevant and end with a consolidated evidence section.
- `D-04`: `docs/bugs/INDEX.md` is a rich triage board, not a thin ledger.
- `D-05`: each index row includes id, title, severity, confidence, surface, status, discovery phase, impact summary, likely cause summary, and report link.
- `D-06`: durable status vocabulary is `new`, `triaged`, `planned`, `in-progress`, `fixed`, `verified`, `closed`, `duplicate`, and `closed-invalid`.
- `D-07`: full lifecycle vocabulary is defined now even though this milestone is discovery-only.
- `D-08`: the no-fix rule is visible in the template, example, and index guidance.
- `D-09`: all harness language preserves Blueprint as a Gemini-native extension, not GSD internals or a legacy port.

## User Constraints

- Discovery-only milestone: write planning artifacts and `docs/bugs/*.md`; do not fix source defects.
- Blueprint runtime state is `.blueprint/`; `.planning/` is local GSD bookkeeping.
- Do not mutate installed extension directories or host-global `~/.gemini/blueprint/` state.
- Root routing safety defects must be documented, not repaired, during this milestone.
- Each later bug report needs evidence-backed classification and explicit uncertainty.

## Standard Stack

- Markdown is the durable artifact format for this harness.
- Repo-local docs are the source of truth for expected Blueprint behavior: `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/ARTIFACT-SCHEMA.md`, `docs/MCP-TOOLS.md`, `docs/COMMAND-CATALOG.md`, and `docs/commands/*.md`.
- Source, tests, manifests, skills, agents, generated assets, and command output are the actual-behavior evidence base.
- No build or TypeScript dependency is required to author the Phase 1 docs; later audit phases may run `npm ci`, `npm run typecheck`, or focused tests when evidence requires it.

## Installation And Setup

- No new dependency installation is required for this docs-only phase.
- If a later verification pass runs Node tooling in a fresh worktree, run `npm ci` before `npm run build`, `npm run typecheck`, or `npm test`.
- `docs/bugs/` should be created by the executor if it does not already exist.

## Alternatives Considered

- Use a single audit summary file: rejected because requirements demand one file per defect and a rich index.
- Store bug reports under `.blueprint/`: rejected because the milestone explicitly targets `docs/bugs/*.md`; `.blueprint/` is runtime state for Blueprint-managed repos.
- Defer lifecycle vocabulary until repair work: rejected by `D-06` and `D-07`; later repair phases should not redesign bug status values.
- Create a machine-readable JSON bug registry: deferred because current requirements specify Markdown docs and an index, not a runtime registry.

## Architecture Patterns

- Use `docs/bugs/TEMPLATE.md` as the schema-like authoring contract with required sections and value vocabularies.
- Use `docs/bugs/INDEX.md` as a sortable triage board with canonical rows for every real bug plus a separate note for the illustrative example.
- Use `BPBUG-000-illustrative-example.md` as the only fake report; real bug ids start at `BPBUG-001`.
- Keep classification vocabularies centralized in the template and referenced by the index.
- Keep every bug report self-contained enough for a later repair milestone to act without redoing discovery.

## Don't Hand-Roll

- Do not invent additional severity, confidence, status, or surface values in later reports.
- Do not treat `.planning/` artifacts as Blueprint runtime defects.
- Do not bypass the template by writing ad hoc bug notes directly into the index.
- Do not use planned-only Blueprint commands as remediation routes.
- Do not turn the illustrative example into a real defect or count it in bug totals.

## Anti-Patterns

- Vague findings without exact file paths or commands.
- Combining unrelated defects into one mega-report.
- Applying fixes during discovery and then documenting them after the fact.
- Using "confirmed" confidence without direct source, test, command, or contract evidence.
- Reporting docs/source drift without citing both sides of the mismatch.
- Leaving duplicate or invalid findings unmarked in the index.

## State Of The Art

- External currency was not checked on 2026-05-01 because the phase is internal documentation and process design.
- Repo-local source-of-truth docs already define the Blueprint product boundary and runtime ownership model as of 2026-05-01.

## Common Pitfalls

- Later audit phases may confuse Blueprint with GSD because `.planning/` is present; prevent this with explicit template language and examples.
- The index can become stale if bug reports are added without updating it; prevent this by requiring index updates in every later phase plan.
- The example bug can pollute totals; prevent this with `BPBUG-000`, status `closed-invalid`, and repeated illustrative-only labels.
- Evidence can drift into prose-only claims; prevent this by requiring a consolidated evidence table.
- No-fix discipline can erode during investigation; prevent this by making the no-fix statement mandatory in every report.

## Validation Architecture

- Validate docs by reading the created files and grepping for required section names, exact vocabulary values, and the no-fix statement.
- Validate requirement coverage by checking that Phase 1 requirement IDs appear in at least one plan frontmatter `requirements` list and in the plan coverage sections.
- Validate no-fix discipline with `git status --short` and confirm changes are limited to `.planning/` and `docs/bugs/` during this phase.
- Validate the illustrative example by grepping for `ILLUSTRATIVE ONLY` and `not a real Blueprint defect`.
- Validate index readiness by grepping for the rich board columns: `ID`, `Title`, `Severity`, `Confidence`, `Surface`, `Status`, `Discovery Phase`, `Impact`, `Likely Cause`, and `Report`.

## Open Questions

- None blocking. Exact wording can follow existing Blueprint docs style as long as locked fields and vocabularies remain present.

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Artifact set | HIGH | Context decisions and Phase 1 success criteria directly name template, index, example, and no-fix guidance. |
| Vocabulary values | HIGH | Requirements and context provide exact severity, confidence, surface, and status vocabularies. |
| Verification approach | HIGH | The phase is docs-only, so grep/file-read checks and git status are sufficient. |
| External best practices | MEDIUM | No external lookup was performed; recommendations are based on repo requirements and common documentation-harness practice. |

## Code Examples

```markdown
---
id: BPBUG-001
title: Short defect title
severity: medium
confidence: likely
surface: command
status: new
discovery_phase: 2
---

## No Fix Applied

No source, manifest, skill, test, generated asset, or runtime behavior fix was
applied during this discovery milestone.
```

## Recommendations

- Create `docs/bugs/TEMPLATE.md` first so later docs have a schema to follow.
- Create `docs/bugs/INDEX.md` second with the rich triage table and vocabulary reminders.
- Create `docs/bugs/BPBUG-000-illustrative-example.md` last, then add a clearly separated illustrative row or note to the index.
- Require every later phase to update the index whenever it writes or revises a real bug report.
- Include `git status --short` in Phase 1 verification to preserve the no-fix boundary.

## Sources

- `.planning/PROJECT.md` - discovery-only milestone boundary and bug-doc output target.
- `.planning/REQUIREMENTS.md` - exact Phase 1 requirement ids and classification/evidence requirements.
- `.planning/ROADMAP.md` - Phase 1 goal, dependencies, and success criteria.
- `.planning/phases/01-bug-taxonomy-and-reporting-harness/01-CONTEXT.md` - locked user decisions D-01 through D-09.
- `docs/DECISIONS.md` - Blueprint product and state-boundary decisions.
- `docs/ARCHITECTURE.md` - Blueprint runtime layers and implemented-only routing rule.
- `docs/ARTIFACT-SCHEMA.md` - existing durable Markdown artifact patterns.
- `docs/MCP-TOOLS.md` - MCP-owned persistence and evidence contract baseline.
