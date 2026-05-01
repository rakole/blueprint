# Phase 4: Roadmap Capture Lightweight Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 4-Roadmap Capture Lightweight Audit
**Areas discussed:** Roadmap Mutation Safety

---

## Gray Areas Presented

| Area | Description | Selected |
|------|-------------|----------|
| Roadmap Mutation Safety | How deeply should `add-phase`, `insert-phase`, `remove-phase`, `plan-milestone-gaps`, and `new-milestone` be audited for preview gates, confirmation, state updates, directory/artifact drift, and recovery behavior? | Yes |
| Capture And Promotion Flow | How should `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, and `explore` be sliced, especially duplicate handling, status transitions, reserved `999.x` stubs, and promotion into active roadmap work? | |
| Quick/Fast/Debug Boundaries | What evidence depth should be used for commands that can run shell commands or mutate repo files, while this milestone remains discovery-only? | |
| Plan Shape And Closeout | How many audit slices should Phase 4 produce, and how should bug-index reconciliation/no-fix verification be handled at the end? | |

**User's choice:** Roadmap Mutation Safety.
**Notes:** User selected only area 1 for discussion. Other Phase 4 surfaces remain in scope but were not interactively clarified.

---

## Roadmap Mutation Safety

### Preview Parity

| Option | Description | Selected |
|--------|-------------|----------|
| Full parity preferred | Preview/confirmation evidence must exercise the same MCP mutation substrate as the real write wherever possible, and bugs should be filed when preview can drift from apply behavior. | Yes |
| Contract parity enough | It is acceptable if preview is reconstructed from roadmap reads, as long as the command spec clearly explains the same intended change and tests cover important cases. | |
| You decide | Use the repo's existing contracts to decide per command, stricter for `remove-phase` and looser for append/report-style flows. | |

**User's choice:** Full parity preferred.
**Notes:** Research-before-questions briefly cited Kubernetes dry-run/diff as a useful outside pattern: preview should pass through the same validation/mutation logic as real apply where possible.

### Destructive Or High-Risk Operations

| Option | Description | Selected |
|--------|-------------|----------|
| Two-gate scrutiny | Audit for a normal confirmation gate plus a second destructive confirmation when execution evidence or phase artifacts exist. File bugs for missing or bypassable gates. | Yes |
| Single explicit gate | One clear confirmation is enough if the preview names the affected roadmap entries and artifact paths. | |
| You decide | Apply two-gate scrutiny only when there is existing execution evidence; otherwise one explicit gate is enough. | |

**User's choice:** Two-gate scrutiny.
**Notes:** Applies especially to `remove-phase` and any flow that renumbers, deletes, archives, or rewrites phase artifacts.

### Partial Failure Across Durable Files

| Option | Description | Selected |
|--------|-------------|----------|
| Any partial-failure gap | File a bug when a multi-step mutation can leave roadmap/state/artifacts inconsistent without rollback, idempotent retry, or clear recovery guidance. | Yes |
| Only observed drift | File only when tests or direct inspection show an actual inconsistent end state; theoretical partial-failure windows go in summaries. | |
| You decide | File bugs for high-impact partial-failure gaps, summarize low-impact theoretical windows. | |

**User's choice:** Any partial-failure gap.
**Notes:** Rollback, idempotent retry, or explicit recovery guidance is the bar for avoiding a bug.

### State And Follow-Up Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Strict next-safe-action checks | Every roadmap mutation must update state through MCP and point only to implemented Blueprint commands, with concrete phase numbers/paths from returned MCP results. | Yes |
| Best-effort routing | State updates and follow-up guidance matter, but they are lower priority than roadmap/file correctness unless obviously wrong. | |
| You decide | Strict for commands that create/promote/remove phases; lighter for report-only milestone commands. | |

**User's choice:** Strict next-safe-action checks.
**Notes:** Downstream planning should verify MCP-owned state updates, implemented-only command recommendations, and returned phase identifiers rather than prose-derived paths.

---

## the agent's Discretion

- Choose the exact Phase 4 plan slicing.
- Apply prior phase standards to undiscussed Phase 4 surfaces.
- Select focused tests and static contract reads that best support or disprove roadmap mutation findings.

## Deferred Ideas

None - discussion stayed within phase scope.
