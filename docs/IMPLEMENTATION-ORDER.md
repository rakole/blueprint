# Blueprint Implementation Order

## Principle

Blueprint should be implemented one command at a time, but only after the prerequisite contracts are already in place.

The validation, UAT, governance handoff/resume, roadmap append/insertion/removal, milestone audit, milestone closeout, and `list-phase-assumptions` slices are already shipped. Any post-Wave-2 implementation should start from a fresh plan instead of treating the closeout trio or `insert-phase` as still pending.

## Waves

### Wave 0: Foundation

- `new-project`
- `settings`
- `set-profile`
- `help`
- `progress`
- `health`
- `map-codebase`

### Wave 1: Core lifecycle

- `discuss-phase`
- `research-phase`
- `ui-phase`
- `plan-phase`
- `execute-phase`
- `validate-phase`
- `verify-work`
- `next`
- `pause-work`
- `resume-work`

### Wave 2: Roadmap and milestone

- `add-phase`
- `insert-phase`
- `remove-phase`
- `list-phase-assumptions`
- `plan-milestone-gaps`
- `audit-milestone`
- `complete-milestone`
- `milestone-summary`
- `new-milestone`

Shipped in this wave: `add-phase`, `insert-phase`, `remove-phase`, `list-phase-assumptions`, `plan-milestone-gaps`, `audit-milestone`, `complete-milestone`, `milestone-summary`, and `new-milestone`.

### Wave 3: Capture and lightweight execution

- `note`
- `add-todo`
- `check-todos`
- `add-backlog`
- `review-backlog`
- `fast`
- `quick`
- `do`
- `explore`
- `debug`

Shipped in this wave: `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `fast`, `quick`, and `debug`.

### Wave 4: Quality and shipping

- `code-review`
- `code-review-fix`
- `audit-fix`
- `secure-phase`
- `docs-update`
- `ui-review`
- `review`
- `add-tests`
- `pr-branch`
- `ship`
- `undo`

Shipped in this wave: `code-review`, `audit-fix`, `secure-phase`, `docs-update`, `add-tests`, `pr-branch`, and `ship`.

### Wave 5: Workspace and maintenance

- `new-workspace`
- `remove-workspace`
- `workstreams`
- `cleanup`
- `update`
- `reapply-patches`

## Dependency Matrix

| Command | Wave | Depends On |
|---|---|---|
| `new-project` | 0 | none |
| `settings` | 0 | `new-project` |
| `set-profile` | 0 | `new-project`, `settings` |
| `help` | 0 | none |
| `progress` | 0 | `new-project` |
| `health` | 0 | `new-project` |
| `map-codebase` | 0 | `new-project` |
| `discuss-phase` | 1 | `new-project` |
| `research-phase` | 1 | `new-project`, `discuss-phase` |
| `ui-phase` | 1 | `new-project`, `discuss-phase`, `map-codebase` |
| `plan-phase` | 1 | `new-project`, `discuss-phase`, `research-phase` |
| `execute-phase` | 1 | `plan-phase` |
| `validate-phase` | 1 | `execute-phase` |
| `verify-work` | 1 | `execute-phase` |
| `next` | 1 | `progress` |
| `pause-work` | 1 | `progress` |
| `resume-work` | 1 | `progress`, `pause-work` |
| `add-phase` | 2 | `new-project` |
| `insert-phase` | 2 | `add-phase` |
| `remove-phase` | 2 | `add-phase` |
| `list-phase-assumptions` | 2 | `new-project`, `map-codebase` |
| `plan-milestone-gaps` | 2 | `audit-milestone` |
| `audit-milestone` | 2 | `execute-phase`, `verify-work` |
| `complete-milestone` | 2 | `audit-milestone` |
| `milestone-summary` | 2 | `complete-milestone` |
| `new-milestone` | 2 | `complete-milestone` |
| `note` | 3 | `new-project` |
| `add-todo` | 3 | `new-project` |
| `check-todos` | 3 | `add-todo` |
| `add-backlog` | 3 | `new-project` |
| `review-backlog` | 3 | `add-backlog`, `add-phase` |
| `fast` | 3 | `new-project` |
| `quick` | 3 | `new-project`, `progress` |
| `do` | 3 | `help`, `progress` |
| `explore` | 3 | `new-project`, `note` |
| `debug` | 3 | `progress` |
| `code-review` | 4 | `execute-phase` |
| `code-review-fix` | 4 | `code-review` |
| `audit-fix` | 4 | `code-review`, `verify-work` |
| `secure-phase` | 4 | `execute-phase` |
| `docs-update` | 4 | `new-project`, `map-codebase` |
| `ui-review` | 4 | `execute-phase`, `ui-phase` |
| `review` | 4 | `plan-phase` |
| `add-tests` | 4 | `verify-work` |
| `pr-branch` | 4 | `execute-phase` |
| `ship` | 4 | `verify-work`, `review`, `pr-branch` |
| `undo` | 4 | `execute-phase` |
| `new-workspace` | 5 | none |
| `remove-workspace` | 5 | `new-workspace` |
| `workstreams` | 5 | `new-project` |
| `cleanup` | 5 | `complete-milestone` |
| `update` | 5 | none |
| `reapply-patches` | 5 | `update` |

## Shared Primitive Checklist Before Wave 0 Code

- extension manifest shape
- root `/blu` router contract
- MCP server bootstrap
- project/config/state/artifact tool primitives
- config precedence and normalization across hardcoded defaults, `~/.gemini/blueprint/defaults.json`, repo config, and command flags
- config migration and repair for the legacy minimal Blueprint schema and removed repo-level hook/workspace toggles
- doc fixtures and command spec tests

## Recommended First Code Slice

1. Keep the shipped `insert-phase` contract aligned across docs, manifest, primary skill, required MCP substrate, and regression tests.
2. Start the next rollout from a newly locked Wave 3 or later slice instead of reopening shipped Wave 2 work.
3. Preserve implemented-only routing while later commands remain planned or blocked.

This sequence keeps the next implementation work aligned with the current runtime status instead of reopening already shipped Wave 2 closeout work.
