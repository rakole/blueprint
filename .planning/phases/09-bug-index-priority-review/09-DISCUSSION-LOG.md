# Phase 9: Bug Index Priority Review - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 9-Bug Index Priority Review
**Areas discussed:** Priority rubric, Duplicate vs related policy, Repair-batch presentation, Open questions lane

---

## Priority rubric

### Question 1

| Option | Description | Selected |
|--------|-------------|----------|
| Separate repair priority lens | Rank by severity plus current impact, blast radius, and repair leverage. Recommended because Atlassian and Azure both separate impact from ship-order urgency. | ✓ |
| Severity-only ordering | Use severity as the entire ranking signal. | |
| Effort-first sequencing | Fix whatever looks cheapest first. | |

**User's choice:** Separate repair priority lens
**Notes:** Auto-selected and approved by the user. Research note: Atlassian frames triage around severity, impact, and deadlines, and Azure distinguishes severity from priority rather than treating them as the same field.

### Question 2

| Option | Description | Selected |
|--------|-------------|----------|
| Keep fixed items in inventory but out of active queue | Preserve history, but do not let already-repaired items distort current repair ordering. Recommended because the inventory is both a record and a planning input. | ✓ |
| Rank fixed items with unresolved bugs | Treat historical and active defects as one list. | |
| Remove fixed items entirely | Drop repaired defects from the inventory once fixed. | |

**User's choice:** Keep fixed items in inventory but out of active queue
**Notes:** Auto-selected and approved by the user. This keeps discovery history intact while avoiding stale priority noise.

### Question 3

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-cutting leverage tie-breaker | Prefer bugs that harden shared safety boundaries or reduce recurrence risk. Recommended because they prevent more downstream failures. | ✓ |
| Lowest effort tie-breaker | Prefer whichever fix seems easiest. | |
| Oldest-first tie-breaker | Prefer earlier discovery phases. | |

**User's choice:** Cross-cutting leverage tie-breaker
**Notes:** Auto-selected and approved by the user. This keeps the ranking aligned with risk reduction rather than chronology.

### Question 4

| Option | Description | Selected |
|--------|-------------|----------|
| Three priority bands | `Now`, `Next`, `Later`. Recommended because it stays legible without pretending the list is more precise than the evidence supports. | ✓ |
| Single 1..N order | Exact ordering across every bug. | |
| MoSCoW buckets | Must/Should/Could/Won't. | |

**User's choice:** Three priority bands
**Notes:** Auto-selected and approved by the user. A small inventory does not need a complicated scoring model.

---

## Duplicate vs related policy

### Question 1

| Option | Description | Selected |
|--------|-------------|----------|
| Same defect plus same repair path | Only mark duplicate when the user-visible defect and fix path are the same. Recommended because GitHub duplicate handling is designed for eliminating redundant work, not collapsing all shared causes. | ✓ |
| Shared root cause means duplicate | Collapse anything with the same underlying cause. | |
| Overlapping evidence means duplicate | Collapse when evidence overlaps materially. | |

**User's choice:** Same defect plus same repair path
**Notes:** Auto-selected and approved by the user. This matches the existing Phase 8 clustering rules and avoids over-collapsing the inventory.

### Question 2

| Option | Description | Selected |
|--------|-------------|----------|
| Keep separate but linked | Use related-bug links and cluster labels for shared root causes. Recommended because it preserves distinct evidence and repair paths. | ✓ |
| Collapse into umbrella report | Merge related bugs into a single report. | |
| Leave unlinked | Avoid explicit root-cause or related links. | |

**User's choice:** Keep separate but linked
**Notes:** Auto-selected and approved by the user. This is the cleanest way to preserve repair-ready detail.

### Question 3

| Option | Description | Selected |
|--------|-------------|----------|
| Earliest or strongest report is canonical | Choose the first or most complete evidence-backed report. Recommended because later duplicates should point back to the best source of truth. | ✓ |
| Most severe report is canonical | Choose by severity. | |
| Newest report is canonical | Choose by freshness of wording. | |

**User's choice:** Earliest or strongest report is canonical
**Notes:** Auto-selected and approved by the user. Canonicality should be evidence-driven, not just severity-driven.

### Question 4

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit duplicate status plus back-link | Record duplicate status in the index and cross-link in the bug docs. Recommended because GitHub-style duplicate handling is explicit and auditable. | ✓ |
| Mention only in prose | Keep duplicate handling informal. | |
| Infer from cluster membership | Do not add separate duplicate status. | |

**User's choice:** Explicit duplicate status plus back-link
**Notes:** Auto-selected and approved by the user. This keeps duplicate handling machine-readable and human-reviewable.

---

## Repair-batch presentation

### Question 1

| Option | Description | Selected |
|--------|-------------|----------|
| Batches first, bugs second | Present repair themes first and list the bugs inside them. Recommended because GitHub milestones and grouped project views work better when the grouping logic is explicit. | ✓ |
| Only per-bug ranking | Use no higher-level grouping. | |
| Only cluster ranking | Use clusters without bug-level ordering. | |

**User's choice:** Batches first, bugs second
**Notes:** Auto-selected and approved by the user. Later planners can still order within each batch.

### Question 2

| Option | Description | Selected |
|--------|-------------|----------|
| Shared repair direction and validation surface | Group bugs that need the same kind of fix and proof. Recommended because it makes the later repair milestone easier to slice. | ✓ |
| Same discovery phase | Group by when the bug was found. | |
| Same severity only | Group solely by impact label. | |

**User's choice:** Shared repair direction and validation surface
**Notes:** Auto-selected and approved by the user. This supports executable repair planning better than discovery chronology.

### Question 3

| Option | Description | Selected |
|--------|-------------|----------|
| Split active versus repaired or verification-only | Keep active candidates separate from already-addressed items. Recommended because current planning should reflect current work. | ✓ |
| Mix all statuses | One combined summary list. | |
| Hide repaired items | Remove them from the summary completely. | |

**User's choice:** Split active versus repaired or verification-only
**Notes:** Auto-selected and approved by the user. This is especially important for BPBUG-004, whose discovery-time status may no longer match its later repair state.

### Question 4

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime and safety, contract and test hardening, docs synchronization cleanup | Use three repair lanes that match current defect shapes. Recommended because it lines up with the actual repair styles implied by the current reports. | ✓ |
| One batch per bug | No thematic grouping. | |
| One batch per discovery phase | Preserve chronology as the main grouping. | |

**User's choice:** Runtime and safety, contract and test hardening, docs synchronization cleanup
**Notes:** Auto-selected and approved by the user. This keeps the summary concrete without locking the planner into a rigid exact sequence.

---

## Open questions lane

### Question 1

| Option | Description | Selected |
|--------|-------------|----------|
| Separate open-questions lane | Keep unresolved verification questions outside the confirmed bug table. Recommended because GitHub itself distinguishes tracked work from discussion-oriented questions. | ✓ |
| Suspected bugs in main table | Put unresolved questions directly beside confirmed defects. | |
| Per-bug uncertainty only | Never create a separate lane. | |

**User's choice:** Separate open-questions lane
**Notes:** Auto-selected and approved by the user. This preserves defect-count integrity.

### Question 2

| Option | Description | Selected |
|--------|-------------|----------|
| Evidence gaps and low-confidence follow-ups only | Reserve the lane for unresolved verification work. Recommended because it prevents future feature ideas from sneaking into the defect inventory. | ✓ |
| Any future improvement idea | Use the lane as a general parking lot. | |
| Confirmed bugs waiting for fixes | Use the lane for active defects too. | |

**User's choice:** Evidence gaps and low-confidence follow-ups only
**Notes:** Auto-selected and approved by the user. Confirmed bugs already have a canonical home.

### Question 3

| Option | Description | Selected |
|--------|-------------|----------|
| Block only when materially scope-changing | Only escalate open questions when they could change repair order or bug boundaries. Recommended because most open questions are context, not blockers. | ✓ |
| Always block | Treat every open question as a stop sign. | |
| Never block | Ignore all open questions during planning. | |

**User's choice:** Block only when materially scope-changing
**Notes:** Auto-selected and approved by the user. This keeps planning practical without hiding real uncertainty.

### Question 4

| Option | Description | Selected |
|--------|-------------|----------|
| Bugs as issues, questions as separate tracking threads or discussions | Preserve the same split if the inventory later moves to GitHub Issues or Projects. Recommended because GitHub supports tracked issues and separate discussion-oriented workflows. | ✓ |
| Every question becomes a bug issue | Expand the bug list with non-defects. | |
| Leave questions undocumented | Wait until someone investigates. | |

**User's choice:** Bugs as issues, questions as separate tracking threads or discussions
**Notes:** Auto-selected and approved by the user. This was treated as a future-mapping decision, not a current scope expansion.

---

## the agent's Discretion

- The exact labels for the repair batches may be tightened by the downstream planner if it improves readability without changing the grouping logic.
- The exact current-status handling for BPBUG-004 may change after the planner rechecks the bug inventory against the later quick repair evidence.

## Deferred Ideas

- If Blueprint later migrates this markdown inventory into GitHub Issues or Projects, preserve the same confirmed-defect versus open-question split instead of flattening both into one queue.
