# Blueprint Progress

Last updated: 2026-04-12

Ordering policy: incomplete commands are bubbled up; completed commands are bubbled down. Importance is prioritized by the immediate next slice (`resume-work`), then by wave, then by risk (High -> Medium -> Low).

## Incomplete Commands (Priority Up)

Total: 36

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `resume-work` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 2 | `remove-phase` | ❌ | `planned` | 2 | `Roadmap And Milestone` | High |
| 3 | `complete-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 4 | `insert-phase` | ❌ | `blocked` | 2 | `Roadmap And Milestone` | Medium |
| 5 | `new-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 6 | `plan-milestone-gaps` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 7 | `audit-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 8 | `list-phase-assumptions` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 9 | `milestone-summary` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 10 | `quick` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | High |
| 11 | `debug` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 12 | `fast` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 13 | `review-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 14 | `add-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 15 | `add-todo` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 16 | `check-todos` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 17 | `do` | ❌ | `blocked` | 3 | `Capture And Lightweight Execution` | Low |
| 18 | `explore` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 19 | `note` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 20 | `add-tests` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 21 | `audit-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 22 | `code-review-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 23 | `pr-branch` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 24 | `ship` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 25 | `undo` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 26 | `docs-update` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 27 | `review` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 28 | `code-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 29 | `secure-phase` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 30 | `ui-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 31 | `cleanup` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 32 | `new-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 33 | `reapply-patches` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 34 | `remove-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 35 | `workstreams` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Medium |
| 36 | `update` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Low |

## Parallel Batches (3 Worktrees / 3 Agents)

Dependency-aware grouping for safe parallel implementation. Commands within a batch have no intra-batch dependency edges. Start from Batch 1 and move downward.

| Batch | Slot A | Slot B | Slot C | Notes |
|---:|---|---|---|---|
| 1 | `resume-work` | `audit-milestone` | — | Safe parallel set. |
| 2 | `list-phase-assumptions` | `remove-phase` | `complete-milestone` | Safe parallel set. |
| 3 | `plan-milestone-gaps` | `new-milestone` | `milestone-summary` | Safe parallel set. |
| 4 | `quick` | `debug` | `fast` | Safe parallel set. |
| 5 | `review-backlog` | `add-backlog` | `add-todo` | Safe parallel set. |
| 6 | `check-todos` | `explore` | `note` | Safe parallel set. |
| 7 | `add-tests` | `pr-branch` | `undo` | Safe parallel set. |
| 8 | `docs-update` | `review` | `code-review` | Safe parallel set. |
| 9 | `audit-fix` | `code-review-fix` | `ship` | Safe parallel set. |
| 10 | `secure-phase` | `ui-review` | `cleanup` | Safe parallel set. |
| 11 | `new-workspace` | `workstreams` | `update` | Safe parallel set. |
| 12 | `reapply-patches` | `remove-workspace` | — | Safe parallel set. |

Blocked commands (not schedulable until substrate/status changes):

| Command | Status | Depends On |
|---|---|---|
| `insert-phase` | `blocked` | `decimal-phase runtime substrate` |
| `do` | `blocked` | `help`, `progress` |

## Completed Commands (Bubbled Down)

Total: 17

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
| 15 | `validate-phase` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 16 | `verify-work` | ✅ | `implemented` | 1 | `Core Lifecycle` | Low |
| 17 | `add-phase` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Medium |
