# Blueprint Progress

Last updated: 2026-04-13

Ordering policy: incomplete commands are bubbled up; completed commands are bubbled down. Importance is prioritized by Wave 3 execution-path risk, then by Wave 4 quality-and-shipping risk, then by Wave 5 git/workspace risk.

## Incomplete Commands (Priority Up)

Total: 20

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `fast` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 2 | `review-backlog` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Medium |
| 3 | `check-todos` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 4 | `explore` | ❌ | `planned` | 3 | `Capture And Lightweight Execution` | Low |
| 5 | `do` | ❌ | `blocked` | 3 | `Capture And Lightweight Execution` | Low |
| 6 | `add-tests` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 7 | `audit-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 8 | `code-review-fix` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 9 | `pr-branch` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 10 | `ship` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 11 | `undo` | ❌ | `planned` | 4 | `Quality And Shipping` | High |
| 12 | `review` | ❌ | `planned` | 4 | `Quality And Shipping` | Medium |
| 13 | `code-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 14 | `ui-review` | ❌ | `planned` | 4 | `Quality And Shipping` | Low |
| 15 | `cleanup` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 16 | `new-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 17 | `reapply-patches` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 18 | `remove-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 19 | `workstreams` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Medium |
| 20 | `update` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Low |

## Parallel Batches (3 Worktrees / 3 Agents)

Dependency-aware grouping for safe parallel implementation. Commands within a batch have no intra-batch dependency edges. Start from Batch 1 and move downward.

| Batch | Slot A | Slot B | Slot C | Notes |
|---:|---|---|---|---|
| 1 | `fast` | `review-backlog` | `add-tests` | Safe parallel set. |
| 2 | `check-todos` | `explore` | `code-review` | Safe parallel set. |
| 3 | `pr-branch` | `undo` | `review` | Safe parallel set. |
| 4 | `ui-review` | `audit-fix` | `code-review-fix` | Safe parallel set. |
| 5 | `ship` | `cleanup` | `new-workspace` | Safe parallel set. |
| 6 | `workstreams` | `update` | `reapply-patches` | Safe parallel set. |
| 7 | `remove-workspace` | — | — | Safe parallel set. |

Blocked commands (not schedulable until substrate/status changes):

| Command | Status | Depends On |
|---|---|---|
| `do` | `blocked` | `freeform routing runtime substrate` |

## Completed Commands (Bubbled Down)

Total: 33

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
| 19 | `insert-phase` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Medium |
| 20 | `remove-phase` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | High |
| 21 | `plan-milestone-gaps` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Medium |
| 22 | `audit-milestone` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Low |
| 23 | `complete-milestone` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Medium |
| 24 | `milestone-summary` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Low |
| 25 | `new-milestone` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Medium |
| 26 | `list-phase-assumptions` | ✅ | `implemented` | 2 | `Roadmap And Milestone` | Low |
| 27 | `add-backlog` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Low |
| 28 | `add-todo` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Low |
| 29 | `note` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Low |
| 30 | `quick` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | High |
| 31 | `debug` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Medium |
| 32 | `docs-update` | ✅ | `implemented` | 4 | `Quality And Shipping` | Medium |
| 33 | `secure-phase` | ✅ | `implemented` | 4 | `Quality And Shipping` | Low |
