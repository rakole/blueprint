# Blueprint Progress

Last updated: 2026-04-12

Ordering policy: incomplete commands are bubbled up; completed commands are bubbled down. Importance is prioritized by the remaining Wave 2 blocker (`insert-phase`), then by Wave 3 execution-path risk, then by later-wave git and workspace risk.

## Incomplete Commands (Priority Up)

Total: 27

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `insert-phase` | ❌ | `blocked` | 2 | `Roadmap And Milestone` | Medium |
| 2 | `quick` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | High |
| 3 | `debug` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 4 | `fast` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 5 | `review-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 6 | `add-todo` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 7 | `check-todos` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 8 | `do` | ❌ | `blocked` | 3 | `Capture And Lightweight Execution` | Low |
| 9 | `explore` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 10 | `note` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 11 | `add-tests` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 12 | `audit-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 13 | `code-review-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 14 | `pr-branch` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 15 | `ship` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 16 | `undo` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 17 | `docs-update` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 18 | `review` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 19 | `code-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 20 | `secure-phase` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 21 | `ui-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 22 | `cleanup` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 23 | `new-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 24 | `reapply-patches` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 25 | `remove-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 26 | `workstreams` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Medium |
| 27 | `update` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Low |

## Parallel Batches (3 Worktrees / 3 Agents)

Dependency-aware grouping for safe parallel implementation. Commands within a batch have no intra-batch dependency edges. Start from Batch 1 and move downward.

| Batch | Slot A | Slot B | Slot C | Notes |
|---:|---|---|---|---|
| 1 | `add-todo` | `note` | `quick` | Safe parallel set. |
| 2 | `fast` | `debug` | `review-backlog` | Safe parallel set. |
| 3 | `check-todos` | `explore` | `add-tests` | Safe parallel set. |
| 4 | `pr-branch` | `docs-update` | `undo` | Safe parallel set. |
| 5 | `review` | `code-review` | `secure-phase` | Safe parallel set. |
| 6 | `ui-review` | `audit-fix` | `code-review-fix` | Safe parallel set. |
| 7 | `ship` | `cleanup` | `new-workspace` | Safe parallel set. |
| 8 | `workstreams` | `update` | `reapply-patches` | Safe parallel set. |
| 9 | `remove-workspace` | — | — | Safe parallel set. |

Blocked commands (not schedulable until substrate/status changes):

| Command | Status | Depends On |
|---|---|---|
| `insert-phase` | `blocked` | `decimal-phase runtime substrate` |
| `do` | `blocked` | `freeform routing runtime substrate` |

## Completed Commands (Bubbled Down)

Total: 26

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
| 22 | `complete-milestone` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Medium |
| 23 | `milestone-summary` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Low |
| 24 | `new-milestone` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Medium |
| 25 | `list-phase-assumptions` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Low |
| 26 | `add-backlog` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Low |
