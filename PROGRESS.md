# Blueprint Progress

Last updated: 2026-04-12

Ordering policy: incomplete commands are bubbled up; completed commands are bubbled down. Importance is prioritized by the immediate next slice (`plan-milestone-gaps`), then by wave, then by risk (High -> Medium -> Low).

## Incomplete Commands (Priority Up)

Total: 34

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `plan-milestone-gaps` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 2 | `remove-phase` | ❌ | `planned` | 2 | `Roadmap And Milestone` | High |
| 3 | `complete-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 4 | `new-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 5 | `insert-phase` | ❌ | `blocked` | 2 | `Roadmap And Milestone` | Medium |
| 6 | `list-phase-assumptions` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 7 | `milestone-summary` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 8 | `quick` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | High |
| 9 | `debug` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 10 | `fast` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 11 | `review-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 12 | `add-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 13 | `add-todo` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 14 | `check-todos` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 15 | `do` | ❌ | `blocked` | 3 | `Capture And Lightweight Execution` | Low |
| 16 | `explore` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 17 | `note` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 18 | `add-tests` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 19 | `audit-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 20 | `code-review-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 21 | `pr-branch` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 22 | `ship` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 23 | `undo` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 24 | `docs-update` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 25 | `review` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 26 | `code-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 27 | `secure-phase` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 28 | `ui-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 29 | `cleanup` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 30 | `new-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 31 | `reapply-patches` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 32 | `remove-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 33 | `workstreams` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Medium |
| 34 | `update` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Low |

## Parallel Batches (3 Worktrees / 3 Agents)

Dependency-aware grouping for safe parallel implementation. Commands within a batch have no intra-batch dependency edges. Start from Batch 1 and move downward.

| Batch | Slot A | Slot B | Slot C | Notes |
|---:|---|---|---|---|
| 1 | `plan-milestone-gaps` | `remove-phase` | `list-phase-assumptions` | Safe parallel set. |
| 2 | `complete-milestone` | `milestone-summary` | `new-milestone` | Safe parallel set. |
| 3 | `quick` | `fast` | `debug` | Safe parallel set. |
| 4 | `review-backlog` | `add-backlog` | `add-todo` | Safe parallel set. |
| 5 | `check-todos` | `explore` | `note` | Safe parallel set. |
| 6 | `add-tests` | `pr-branch` | `docs-update` | Safe parallel set. |
| 7 | `undo` | `review` | `code-review` | Safe parallel set. |
| 8 | `secure-phase` | `ui-review` | `audit-fix` | Safe parallel set. |
| 9 | `code-review-fix` | `ship` | `cleanup` | Safe parallel set. |
| 10 | `new-workspace` | `workstreams` | `update` | Safe parallel set. |
| 11 | `reapply-patches` | `remove-workspace` | — | Safe parallel set. |

Blocked commands (not schedulable until substrate/status changes):

| Command | Status | Depends On |
|---|---|---|
| `insert-phase` | `blocked` | `decimal-phase runtime substrate` |
| `do` | `blocked` | `help`, `progress` |

## Completed Commands (Bubbled Down)

Total: 19

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
| 12 | `resume-work` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 13 | `plan-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Medium |
| 14 | `research-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 15 | `ui-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 16 | `validate-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 17 | `verify-work` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 18 | `add-phase` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Medium |
| 19 | `audit-milestone` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Low |
