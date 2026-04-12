# Blueprint Progress

Last updated: 2026-04-12

Ordering policy: incomplete commands are bubbled up; completed commands are bubbled down. Importance is prioritized by the immediate next slice (`complete-milestone`), then by wave, then by risk (High -> Medium -> Low).

## Incomplete Commands (Priority Up)

Total: 31

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `complete-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 2 | `new-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 3 | `insert-phase` | ❌ | `blocked` | 2 | `Roadmap And Milestone` | Medium |
| 4 | `milestone-summary` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 5 | `quick` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | High |
| 6 | `debug` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 7 | `fast` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 8 | `review-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 9 | `add-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 10 | `add-todo` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 11 | `check-todos` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 12 | `do` | ❌ | `blocked` | 3 | `Capture And Lightweight Execution` | Low |
| 13 | `explore` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 14 | `note` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 15 | `add-tests` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 16 | `audit-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 17 | `code-review-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 18 | `pr-branch` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 19 | `ship` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 20 | `undo` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 21 | `docs-update` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 22 | `review` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 23 | `code-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 24 | `secure-phase` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 25 | `ui-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 26 | `cleanup` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 27 | `new-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 28 | `reapply-patches` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 29 | `remove-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 30 | `workstreams` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Medium |
| 31 | `update` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Low |

## Parallel Batches (3 Worktrees / 3 Agents)

Dependency-aware grouping for safe parallel implementation. Commands within a batch have no intra-batch dependency edges. Start from Batch 1 and move downward.

| Batch | Slot A | Slot B | Slot C | Notes |
|---:|---|---|---|---|
| 1 | `complete-milestone` | — | — | Safe parallel set. |
| 2 | `milestone-summary` | `new-milestone` | — | Safe parallel set. |
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

Total: 22

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
| 19 | `remove-phase` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | High |
| 20 | `plan-milestone-gaps` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Medium |
| 21 | `audit-milestone` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Low |
| 22 | `list-phase-assumptions` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Low |
