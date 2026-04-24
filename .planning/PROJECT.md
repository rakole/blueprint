# Blueprint Impact Command

## What This Is

This project adds a new Blueprint command, `/blu-impact`, that computes blast radius for proposed changes before implementation or merge. It analyzes diff scope, roadmap context, touched code and configuration surfaces, and known dependencies to produce a structured impact report teams can review quickly. The primary audience is engineering teams that need reliable cross-service impact visibility and reviewer confidence in large or regulated repos.

## Core Value

Every meaningful change gets a provable blast-radius report before it ships.

## Requirements

### Validated

- ✓ Blueprint already has implemented-only command routing via `/blu` and direct `/blu-<command>` entrypoints — existing
- ✓ Blueprint already has MCP-backed deterministic read/write state and artifact tooling for roadmap, phase, review, and reports — existing
- ✓ Blueprint already has durable command metadata and phase/context artifacts that can ground impact analysis inputs — existing

### Active

- [ ] `/blu-impact` accepts a proposal scope (working diff, commit range, or PR branch) and produces a structured impact report.
- [ ] Impact analysis identifies affected services/modules, downstream consumers, data touched, and high-risk boundaries (API/config/migration/infra).
- [ ] Output includes required test suites, required reviewers/owners, deployment risk level, and explicit unknowns the tool could not prove.
- [ ] Command behavior remains read-only and advisory (no repo mutation, no deployment mutation, no stateful side effects outside report artifacts).
- [ ] `/blu`, `/blu-help`, and `/blu-progress` expose `/blu-impact` only after manifest, skill, and required MCP tools are present and catalog status is `implemented`.

### Out of Scope

- Automatic remediation or code rewriting based on impact findings — keep first release analysis-only.
- Auto-approving pull requests or bypassing human review gates — report augments review, not replaces it.
- Full runtime implementation of impact graph ingestion from external systems (e.g., CMDB/service catalog APIs) in v1 — start with repo-local evidence plus optional connectors.

## Context

Blueprint currently ships a broad command surface with implemented-only routing and MCP-owned state transitions. Review friction in enterprise settings often comes from unclear blast radius, ownership ambiguity, and incomplete test expectations. `/blu-impact` is positioned as a high-leverage preflight command that turns repo evidence plus roadmap context into an auditable risk/impact summary before merge or deployment planning.

## Constraints

- **Architecture**: Keep commands thin and user-facing while pushing deterministic analysis/state operations into MCP tools.
- **Routing safety**: Planned commands must stay non-routable until their runtime contract is complete and catalog status is `implemented`.
- **State boundary**: Project state remains `.blueprint/` at runtime; `.planning/` here is implementation bookkeeping only.
- **Risk posture**: Initial command must be advisory/read-only and must call out uncertainty rather than inventing certainty.
- **Compatibility**: Must degrade safely when optional ownership/dependency metadata is missing.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Start with analysis-only `/blu-impact` output (no auto-fix) | Reduces rollout risk and preserves trust in first release | — Pending |
| Make unknowns a first-class report section | Enterprise trust depends on explicit confidence boundaries | — Pending |
| Reuse existing Blueprint review/report conventions for output artifacts | Keeps adoption cost low and avoids parallel report formats | — Pending |
| Treat owners/reviewers/test-suite mapping as deterministic when possible and heuristic otherwise | Preserves signal while avoiding false certainty | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -> still the right priority?
3. Audit Out of Scope -> reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-24 after initialization*
