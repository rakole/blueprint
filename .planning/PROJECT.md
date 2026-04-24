# Blueprint Impact Command

## What This Is

Blueprint Impact is a new Blueprint command (`/blu-impact`) that generates a blast-radius report for any proposed change before implementation or merge. It analyzes code diff and planning context to identify what services, modules, APIs, data paths, infrastructure, and ownership boundaries are affected. The target users are enterprise engineering teams that need faster, clearer review decisions with less uncertainty.

## Core Value

Any proposed change gets a trustworthy, structured impact report that makes review risk and ownership explicit before code lands.

## Requirements

### Validated

- ✓ Blueprint command routing and implemented-only exposure checks already exist (`/blu`, `/blu-help`, `/blu-progress`) — existing
- ✓ Blueprint MCP-backed project/phase/config/report persistence exists as deterministic state substrate — existing
- ✓ Blueprint phase and review workflows already generate phase-scoped artifacts and reports — existing

### Active

- [ ] Add `/blu-impact` as a Blueprint command with explicit contract, routing behavior, and high-risk confirmation rules.
- [ ] Generate impact reports from available evidence: git diff, roadmap phase context, changed files, owners, dependency links, and runtime topology hints.
- [ ] Produce required report sections: affected modules/services, downstream consumers, data touched, required test suites, required reviewers/owners, deploy risk level, and explicit unknowns.
- [ ] Enforce confidence labeling so uncertain claims are surfaced as unknowns instead of overconfident assertions.
- [ ] Provide an enterprise-friendly output artifact that can be shared in PR review and release sign-off.

### Out of Scope

- Auto-remediation or auto-merge actions — this command is analysis-first, not a mutating deploy/release workflow.
- Full static-program-analysis replacement — use existing linters/tests/scanners; `/blu-impact` is impact synthesis.
- Real-time production dependency discovery from live infrastructure APIs in v1 — start with repo + planning + config evidence and make external integrations optional.

## Context

Blueprint currently has broad coverage across lifecycle, capture, review, and maintenance command families, but enterprise review friction is still high when blast radius is unclear. The proposed `/blu-impact` command addresses this by producing a deterministic, explicit impact report before implementation or shipping decisions. Existing repo guardrails require implemented-only command exposure and documented command contracts before routing; adding `/blu-impact` therefore requires catalog/spec/runtime alignment before user-facing exposure.

## Constraints

- **Catalog Governance**: New command exposure must follow implemented-only routing and runtime catalog semantics — protects users from planned-only routes.
- **State Ownership**: Persistent outputs must be written through Blueprint MCP/report contracts where applicable — keeps state deterministic and auditable.
- **Safety**: Unknowns must be explicit and never silently inferred as facts — avoids false confidence in enterprise change management.
- **Compatibility**: Must preserve existing Wave 0-Wave 5 behavior and regression guarantees — no drift regressions while adding the new surface.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Command name is `/blu-impact` with direct command form `/blu-impact` and root-router discoverability only after implemented status | Aligns with Blueprint command naming and implemented-only exposure policies | — Pending |
| v1 impact analysis is evidence-driven from repo artifacts + planning state + diff signals | Fastest path to enterprise value while minimizing external dependency coupling | — Pending |
| Output must include an explicit `Unknowns We Could Not Prove` section | Review friction is caused by hidden uncertainty; surfacing unknowns improves trust | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-24 after initialization*
