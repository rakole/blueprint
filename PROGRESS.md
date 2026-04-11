# Blueprint Progress

Last updated: 2026-04-11

Ordering policy: incomplete commands are bubbled up; completed commands are bubbled down. Importance is prioritized by immediate next slice (`pause-work`, `resume-work`), then by wave, then by risk (High -> Medium -> Low).

## Incomplete Commands (Priority Up)

Total: 38

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `pause-work` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 2 | `resume-work` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 3 | `remove-phase` | ❌ | `planned` | 2 | `Roadmap And Milestone` | High |
| 4 | `add-phase` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 5 | `complete-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 6 | `insert-phase` | ❌ | `blocked` | 2 | `Roadmap And Milestone` | Medium |
| 7 | `new-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 8 | `plan-milestone-gaps` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 9 | `audit-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 10 | `list-phase-assumptions` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 11 | `milestone-summary` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 12 | `quick` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | High |
| 13 | `debug` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 14 | `fast` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 15 | `review-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 16 | `add-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 17 | `add-todo` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 18 | `check-todos` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 19 | `do` | ❌ | `blocked` | 3 | `Capture And Lightweight Execution` | Low |
| 20 | `explore` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 21 | `note` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 22 | `add-tests` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 23 | `audit-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 24 | `code-review-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 25 | `pr-branch` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 26 | `ship` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 27 | `undo` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 28 | `docs-update` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 29 | `review` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 30 | `code-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 31 | `secure-phase` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 32 | `ui-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 33 | `cleanup` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 34 | `new-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 35 | `reapply-patches` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 36 | `remove-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 37 | `workstreams` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Medium |
| 38 | `update` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Low |

## Parallel Batches (3 Worktrees / 3 Agents)

Dependency-aware grouping for safe parallel implementation. Commands within a batch have no intra-batch dependency edges. Start from Batch 1 and move downward.

| Batch | Slot A | Slot B | Slot C | Notes |
|---:|---|---|---|---|
| 1 | `pause-work` | `add-phase` | `audit-milestone` | Safe parallel set. |
| 2 | `resume-work` | `remove-phase` | `complete-milestone` | Safe parallel set. |
| 3 | `plan-milestone-gaps` | `new-milestone` | `milestone-summary` | Safe parallel set. |
| 4 | `list-phase-assumptions` | `quick` | `debug` | Safe parallel set. |
| 5 | `fast` | `review-backlog` | `add-backlog` | Safe parallel set. |
| 6 | `add-todo` | `check-todos` | `note` | Safe parallel set. |
| 7 | `add-tests` | `pr-branch` | `undo` | Safe parallel set. |
| 8 | `docs-update` | `review` | `code-review` | Safe parallel set. |
| 9 | `audit-fix` | `code-review-fix` | `ship` | Safe parallel set. |
| 10 | `secure-phase` | `ui-review` | `cleanup` | Safe parallel set. |
| 11 | `new-workspace` | `workstreams` | `update` | Safe parallel set. |
| 12 | `reapply-patches` | `remove-workspace` | — | Safe parallel set. |

Blocked commands (not schedulable until substrate/status changes):

| Command | Status | Depends On |
|---|---|---|
| `insert-phase` | `blocked` | `add-phase` |
| `do` | `blocked` | `help`, `progress` |

## Completed Commands (Bubbled Down)

Total: 13

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
| 11 | `plan-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Medium |
| 12 | `research-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 13 | `ui-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 14 | `validate-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 15 | `verify-work` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
