# Phase 8: Cross-Cut Drift And Regression Gaps - Research

**Researched:** 2026-05-02
**Status:** Complete

## Research Question

What must Phase 8 know to plan a discovery-only audit of Blueprint cross-layer drift, missing regression coverage, schema drift, generated-asset freshness, and bug root-cause clusters without applying source fixes?

## Phase Scope Synthesis

Phase 8 is not another command-family audit. Phases 2 through 7 already audited workflow slices and produced BPBUG-001 through BPBUG-004. This phase should instead look for cross-cutting failures that only appear when docs, command manifests, skills, MCP tool docs, source, tests, and generated assets are compared together.

The phase is bounded to evidence-backed discovery:

- Allowed writes: `.planning/phases/08-cross-cut-drift-and-regression-gaps/*`, `docs/bugs/*.md`, and `docs/bugs/INDEX.md`.
- Forbidden fixes: `src/**`, `commands/**`, `skills/**`, `agents/**`, `tests/**`, `scripts/**`, `hooks/**`, `dist/**`, package files, runtime `.blueprint/**`, installed extensions, host-global `~/.gemini/blueprint/**`, branches, PRs, remotes, and git history.
- Required classification: bug docs must distinguish contract drift, runtime behavior defects, documentation defects, test gaps, packaging defects, and performance or scaling risks.

## Contract Drift Architecture

Blueprint has several authoritative layers that can drift:

| Layer | Canonical Evidence | Drift Risk |
|-------|--------------------|------------|
| Product decisions | `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/GEMINI-CONSTRAINTS.md` | Later command docs or prompts can imply legacy/GSD behavior, non-Blueprint state paths, self-mutation, or planned-only routing. |
| Command catalog and specs | `docs/COMMAND-CATALOG.md`, `docs/commands/*.md` | Declared status, primary skill, risk, writes, and required runtime calls can diverge from manifests or live catalog computation. |
| Command manifests | `commands/blu*.toml` | User-facing command prompts can require tool sequences, reports, gates, or routing that docs/tests do not enforce. |
| Skills and agents | `skills/*/SKILL.md`, `agents/*.md` | Orchestration contracts can drift from command docs, required tool FQNs, and available specialist agents. |
| MCP docs and runtime source | `docs/MCP-TOOLS.md`, `src/mcp/tools/*.ts`, `src/mcp/server.ts` | Shared docs can advertise stale return fields or registered-tool behavior, as BPBUG-003 showed. |
| Tests and generated assets | `tests/**/*.test.ts`, `dist/**` | Green tests can miss high-risk guardrails or built bundle freshness, as BPBUG-002 and BPBUG-004 showed. |

Plan implication: the drift matrix should be grouped by surface family instead of command-by-command re-auditing every prior clean slice. Material drift should be filed only when it can mislead a user, model, installer, runtime caller, or later repair planner.

## Regression Gap Architecture

External testing guidance supports Phase 8's threshold:

- Contract-conformance checks are best used for fast structural mismatch detection, while behavioral and end-to-end tests should focus on meaningful system behavior. Source: PactFlow Drift docs, "Where Drift Fits in Your API Testing Strategy" (<https://pactflow.github.io/drift-docs/docs/concepts/where-drift-fits/>).
- Risk-based testing prioritizes gaps by the combination of implementation complexity and business impact; high-significance behavior should receive stronger coverage. Source: BesTest "Risk-Based Testing" (<https://getbestest.com/testing-methodologies/risk-based-testing/>).
- Root-cause analysis should preserve underlying causes and preventive actions, not only symptoms. Source: TechTarget "How to handle root cause analysis of software defects" (<https://www.techtarget.com/searchsoftwarequality/tip/How-to-handle-root-cause-analysis-of-software-defects>).

Plan implication: a missing test is a bug only when it protects high-risk behavior, prior-bug recurrence, generated asset freshness, destructive or remote operations, or user-visible runtime contracts. Lower-risk coverage notes should become phase notes for Phase 9 rather than new bug reports.

## Concern Map Triage Leads

`.planning/codebase/CONCERNS.md` provides Phase 8's cross-cut leads. The strongest candidates for execution plans are:

| Lead | Evidence Path | Bug Threshold |
|------|---------------|---------------|
| Regex-driven Markdown parsing | `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/workspace.ts`, artifact validation tests | File only if a documented contract can silently misparse or mutate the wrong section with concrete source/test evidence. |
| Permissive schema validation | `src/mcp/tools/impact.ts`, `tests/impact-tools.test.ts`, impact config/report docs | File only if unknown keys or schema drift can produce misleading PASS/WARN/confidence or report output. |
| Generated asset freshness | `scripts/build.mjs`, `dist/**`, `tests/built-assets-smoke.test.ts`, `tests/built-schema-assets.test.ts` | File only if source-to-dist parity can regress without a targeted guard after BPBUG-004. |
| Destructive filesystem edges | `src/mcp/tools/phase.ts`, `src/mcp/tools/workspace.ts`, `src/shared/security.ts`, workspace/cleanup tests | File only if confirmation, containment, or report-before-mutate guarantees are materially untested or contradicted. |
| Impact scaling and large inputs | `src/mcp/tools/impact.ts`, `tests/impact-fixtures.test.ts`, `tests/impact-tools.test.ts` | File only if large-repo or large-diff behavior can hide low confidence, unknowns, or incomplete analysis. |
| Test-only env toggles | `src/mcp/tools/workspace.ts`, workspace tests, runtime-host docs | File only if production use of test toggles is plausible and creates concrete user/runtime risk. |

## Existing Bug Cluster Inputs

Phase 8 should preserve existing bug identity while adding root-cause links:

| Bug | Likely Cluster | Preventive Repair Theme |
|-----|----------------|-------------------------|
| BPBUG-001 | Under-specified high-risk report contracts | Tighten canonical report schemas and regression tests for evidence-bearing maintenance flows. |
| BPBUG-002 | Missing behavioral regression guards | Add executable behavior coverage for destructive or protected-scope flows. |
| BPBUG-003 | Stale docs/runtime reference synchronization | Cross-check shared docs against live runtime types and tests. |
| BPBUG-004 | Generated-asset freshness | Assert source schema inventory and tracked `dist` parity for Git-installed host bundles. |

Plan implication: BPBUG-001 through BPBUG-004 should gain related-bug or cluster context only when the link helps Phase 9 prioritize repairs. Do not merge distinct defects unless they share the same defect and repair path.

## Validation Architecture

Phase 8 can validate planning and execution without new test infrastructure:

- Contract-drift validation: `npx tsx --test tests/command-contract-docs.test.ts tests/command-catalog.test.ts tests/extension-runtime-contracts.test.ts`.
- Regression-gap validation: targeted existing test discovery plus suites such as `tests/cleanup-tools.test.ts`, `tests/built-schema-assets.test.ts`, `tests/built-assets-smoke.test.ts`, `tests/impact-tools.test.ts`, and `tests/security-hardening.test.ts`.
- Concern-map validation: static source/doc/test comparisons with focused suites for artifact validation, impact, security, and workspace tools.
- Cluster validation: `rg` checks over `docs/bugs/INDEX.md` and `docs/bugs/BPBUG-*.md` for related-bug, no-fix, discovery-phase, and slice-row consistency.
- Boundary validation: `git status --short` at each plan boundary must show only `.planning/` and `docs/bugs/` changes.

## Planning Recommendations

Create five executable plans:

1. Cross-layer contract drift matrix.
2. Risk-backed regression gap audit.
3. Concern-map schema, parser, filesystem, and scaling triage.
4. Root-cause cluster and related-bug linkage.
5. Phase 8 closeout, bug-index reconciliation, and no-fix verification.

Each plan should explicitly preserve D-01 through D-20, route lower-risk notes into phase artifacts instead of bug inflation, and require the exact no-fix sentence for every new or touched bug report.

## Research Complete

