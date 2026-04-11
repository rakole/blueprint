# Blueprint Progress

Last updated: 2026-04-11

Ordering policy: incomplete commands are bubbled up; completed commands are bubbled down. Importance is prioritized by immediate next slice (`validate-phase`, `verify-work`), then by wave, then by risk (High -> Medium -> Low).

## Incomplete Commands (Priority Up)

Total: 39

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `validate-phase` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 2 | `verify-work` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 3 | `resume-work` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 4 | `remove-phase` | ❌ | `planned` | 2 | `Roadmap And Milestone` | High |
| 5 | `add-phase` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 6 | `complete-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 7 | `insert-phase` | ❌ | `blocked` | 2 | `Roadmap And Milestone` | Medium |
| 8 | `new-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 9 | `plan-milestone-gaps` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 10 | `audit-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 11 | `list-phase-assumptions` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 12 | `milestone-summary` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 13 | `quick` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | High |
| 14 | `debug` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 15 | `fast` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 16 | `review-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 17 | `add-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 18 | `add-todo` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 19 | `check-todos` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 20 | `do` | ❌ | `blocked` | 3 | `Capture And Lightweight Execution` | Low |
| 21 | `explore` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 22 | `note` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 23 | `add-tests` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 24 | `audit-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 25 | `code-review-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 26 | `pr-branch` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 27 | `ship` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 28 | `undo` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 29 | `docs-update` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 30 | `review` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 31 | `code-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 32 | `secure-phase` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 33 | `ui-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 34 | `cleanup` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 35 | `new-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 36 | `reapply-patches` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 37 | `remove-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 38 | `workstreams` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Medium |
| 39 | `update` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Low |

## Parallel Batches (3 Worktrees / 3 Agents)

Dependency-aware grouping for safe parallel implementation. Commands within a batch have no intra-batch dependency edges. Start from Batch 1 and move downward.

| Batch | Slot A | Slot B | Slot C | Notes |
|---:|---|---|---|---|
| 1 | `validate-phase` | `verify-work` | `resume-work` | Safe parallel set. |
| 2 | `add-phase` | `audit-milestone` | `list-phase-assumptions` | Safe parallel set. |
| 3 | `remove-phase` | `complete-milestone` | `plan-milestone-gaps` | Safe parallel set. |
| 4 | `new-milestone` | `milestone-summary` | `quick` | Safe parallel set. |
| 5 | `debug` | `fast` | `review-backlog` | Safe parallel set. |
| 6 | `add-backlog` | `add-todo` | `note` | Safe parallel set. |
| 7 | `check-todos` | `explore` | `add-tests` | Safe parallel set. |
| 8 | `pr-branch` | `undo` | `docs-update` | Safe parallel set. |
| 9 | `review` | `code-review` | `audit-fix` | Safe parallel set. |
| 10 | `code-review-fix` | `ship` | `secure-phase` | Safe parallel set. |
| 11 | `ui-review` | `cleanup` | `new-workspace` | Safe parallel set. |
| 12 | `workstreams` | `update` | `reapply-patches` | Safe parallel set. |
| 13 | `remove-workspace` | — | — | Safe parallel set. |

Blocked commands (not schedulable until substrate/status changes):

| Command | Status | Depends On |
|---|---|---|
| `insert-phase` | `blocked` | `add-phase` |
| `do` | `blocked` | `help`, `progress` |

## Completed Commands (Bubbled Down)

Total: 14

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `health` | ✅ | `implemented` | 0 | `Foundation` | Medium |
| 2 | `help` | ✅ | `implemented` | 0 | `Foundation` | Low |
| 3 | `map-codebase` | ✅ | `implemented` | 0 | `Foundation` | Medium |
| 4 | `new-project` | ✅ | `implemented` | 0 | `Foundation` | Medium |
| 5 | `progress` | ✅ | `implemented` | 0 | `Foundation` | Low |
| 6 | `set-profile` | ✅ | `implemented` | 0 | `Foundation` | Low |
| 7 | `settings` | ✅ | `implemented` | 0 | `Foundation` | Low |
| 8 | `discuss-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Medium |
| 9 | `execute-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | High |
| 10 | `next` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 11 | `pause-work` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 12 | `plan-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Medium |
| 13 | `research-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 14 | `ui-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
