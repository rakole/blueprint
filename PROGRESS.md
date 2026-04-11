# Blueprint Progress

Last updated: 2026-04-11

Ordering policy: incomplete commands are bubbled up; completed commands are bubbled down. Importance is prioritized by immediate next slice (`validate-phase`, `verify-work`), then by wave, then by risk (High -> Medium -> Low).

## Incomplete Commands (Priority Up)

Total: 40

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `validate-phase` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 2 | `verify-work` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 3 | `pause-work` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 4 | `resume-work` | ❌ | `planned` | 1 | `Core Lifecycle` | Low |
| 5 | `remove-phase` | ❌ | `planned` | 2 | `Roadmap And Milestone` | High |
| 6 | `add-phase` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 7 | `complete-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 8 | `insert-phase` | ❌ | `blocked` | 2 | `Roadmap And Milestone` | Medium |
| 9 | `new-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 10 | `plan-milestone-gaps` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Medium |
| 11 | `audit-milestone` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 12 | `list-phase-assumptions` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 13 | `milestone-summary` | ❌ | `planned` | 2 | `Roadmap And Milestone` | Low |
| 14 | `quick` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | High |
| 15 | `debug` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 16 | `fast` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 17 | `review-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 18 | `add-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 19 | `add-todo` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 20 | `check-todos` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 21 | `do` | ❌ | `blocked` | 3 | `Capture And Lightweight Execution` | Low |
| 22 | `explore` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 23 | `note` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 24 | `add-tests` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 25 | `audit-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 26 | `code-review-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 27 | `pr-branch` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 28 | `ship` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 29 | `undo` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 30 | `docs-update` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 31 | `review` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 32 | `code-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 33 | `secure-phase` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 34 | `ui-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 35 | `cleanup` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 36 | `new-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 37 | `reapply-patches` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 38 | `remove-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 39 | `workstreams` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Medium |
| 40 | `update` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Low |

## Parallel Batches (3 Worktrees / 3 Agents)

Dependency-aware grouping for safe parallel implementation. Commands within a batch have no intra-batch dependency edges. Start from Batch 1 and move downward.

| Batch | Slot A | Slot B | Slot C | Notes |
|---:|---|---|---|---|
| 1 | `validate-phase` | `verify-work` | `pause-work` | Safe parallel set. |
| 2 | `resume-work` | `add-phase` | `audit-milestone` | Safe parallel set. |
| 3 | `remove-phase` | `complete-milestone` | `plan-milestone-gaps` | Safe parallel set. |
| 4 | `new-milestone` | `list-phase-assumptions` | `milestone-summary` | Safe parallel set. |
| 5 | `quick` | `debug` | `fast` | Safe parallel set. |
| 6 | `add-backlog` | `add-todo` | `note` | Safe parallel set. |
| 7 | `review-backlog` | `check-todos` | `explore` | Safe parallel set. |
| 8 | `add-tests` | `pr-branch` | `undo` | Safe parallel set. |
| 9 | `docs-update` | `review` | `code-review` | Safe parallel set. |
| 10 | `audit-fix` | `code-review-fix` | `ship` | Safe parallel set. |
| 11 | `secure-phase` | `ui-review` | `cleanup` | Safe parallel set. |
| 12 | `new-workspace` | `workstreams` | `update` | Safe parallel set. |
| 13 | `reapply-patches` | `remove-workspace` | — | Safe parallel set. |

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
