# Blueprint Progress

Last updated: 2026-04-23

Ordering policy: incomplete commands are bubbled up; completed commands are bubbled down. Importance is prioritized by Wave 3 execution-path risk, then by Wave 4 quality-and-shipping risk, then by Wave 5 git/workspace risk.

## Incomplete Commands (Priority Up)

Total: 3

| Priority | Command | Done | Status | Wave | Family | Risk |
|---:|---|---|---|---:|---|---|
| 1 | `do` | ❌ | `blocked` | 3 | `Capture And Lightweight Execution` | Low |
| 2 | `remove-workspace` | ❌ | `planned` | 5 | `Workspace And Maintenance` | High |
| 3 | `update` | ❌ | `planned` | 5 | `Workspace And Maintenance` | Low |

## Parallel Batches (3 Worktrees / 3 Agents)

Dependency-aware grouping for safe parallel implementation. Commands within a batch have no intra-batch dependency edges. Start from Batch 1 and move downward.

| Batch | Slot A | Slot B | Slot C | Notes |
|---:|---|---|---|---|
| 1 | `update` | `remove-workspace` | none | `reapply-patches`, `new-workspace`, `workstreams`, `undo`, and `cleanup` are now shipped; `workstreams` also closed its canonical-state hardening pass on 2026-04-23, so the remaining maintenance work is advisory update plus the deferred workspace-removal surface. |

Blocked commands (not schedulable until substrate/status changes):

| Command | Status | Depends On |
|---|---|---|
| `do` | `blocked` | `freeform routing runtime substrate` |

## Completed Commands (Bubbled Down)

Total: 50

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
| 27 | `fast` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | High |
| 28 | `review-backlog` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Medium |
| 29 | `check-todos` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Low |
| 30 | `add-backlog` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Low |
| 31 | `add-todo` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Low |
| 32 | `note` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Low |
| 33 | `quick` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | High |
| 34 | `debug` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Medium |
| 35 | `explore` | ✅ | `implemented` | 3 | `Capture And Lightweight Execution` | Low |
| 36 | `add-tests` | ✅ | `implemented` | 4 | `Quality And Shipping` | High |
| 37 | `audit-fix` | ✅ | `implemented` | 4 | `Quality And Shipping` | High |
| 38 | `code-review` | ✅ | `implemented` | 4 | `Quality And Shipping` | Low |
| 39 | `code-review-fix` | ✅ | `implemented` | 4 | `Quality And Shipping` | High |
| 40 | `review` | ✅ | `implemented` | 4 | `Quality And Shipping` | Medium |
| 41 | `docs-update` | ✅ | `implemented` | 4 | `Quality And Shipping` | Medium |
| 42 | `pr-branch` | ✅ | `implemented` | 4 | `Quality And Shipping` | High |
| 43 | `secure-phase` | ✅ | `implemented` | 4 | `Quality And Shipping` | Low |
| 44 | `ui-review` | ✅ | `implemented` | 4 | `Quality And Shipping` | Low |
| 45 | `ship` | ✅ | `implemented` | 4 | `Quality And Shipping` | High |
| 46 | `undo` | ✅ | `implemented` | 4 | `Quality And Shipping` | High |
| 47 | `new-workspace` | ✅ | `implemented` | 5 | `Workspace And Maintenance` | High |
| 48 | `workstreams` | ✅ | `implemented` | 5 | `Workspace And Maintenance` | Medium |
| 49 | `cleanup` | ✅ | `implemented` | 5 | `Workspace And Maintenance` | High |
| 50 | `reapply-patches` | ✅ | `implemented` | 5 | `Workspace And Maintenance` | High |
