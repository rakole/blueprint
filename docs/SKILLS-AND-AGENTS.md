# Blueprint Skills And Agents

## Planned Skills

| Skill | Purpose | Primary Commands |
|---|---|---|
| `blueprint-router` | Root routing, command selection, and next-step guidance | `help`, `progress`, `next`, `do` |
| `blueprint-bootstrap` | Repo bootstrap and project initialization | `new-project` |
| `blueprint-governance` | Config, profile, health, and handoff flows | `settings`, `set-profile`, `health`, `pause-work`, `resume-work` |
| `blueprint-phase-discovery` | Pre-planning discovery and requirements shaping | `discuss-phase`, `research-phase`, `ui-phase`, `list-phase-assumptions` |
| `blueprint-phase-planning` | Plan synthesis and plan checks | `plan-phase`, `plan-milestone-gaps` |
| `blueprint-phase-execution` | Plan execution and summary generation | `execute-phase`, `quick`, `fast` |
| `blueprint-phase-validation` | Verification, UAT, tests, and gap closure | `validate-phase`, `verify-work`, `add-tests` |
| `blueprint-roadmap-admin` | Roadmap and milestone mutations | `add-phase`, `insert-phase`, `remove-phase`, `audit-milestone`, `complete-milestone`, `milestone-summary`, `new-milestone` |
| `blueprint-capture` | Notes, todos, backlog, ideation routing | `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `explore` |
| `blueprint-debug` | Debug investigations and recovery plans | `debug` |
| `blueprint-review` | Reviews, review-fix loops, security, UI, peer review | `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `ui-review`, `review` |
| `blueprint-docs` | Documentation generation and verification | `docs-update` |
| `blueprint-map` | Brownfield codebase mapping | `map-codebase` |
| `blueprint-maintenance` | Git, workspace, cleanup, update, and patch operations | `pr-branch`, `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `update`, `reapply-patches` |

## Planned Agents

| Agent | Purpose |
|---|---|
| `blueprint-project-researcher` | Gather initial repo and product context during `new-project` |
| `blueprint-roadmapper` | Build roadmap candidates and milestone structure |
| `blueprint-researcher` | Phase-specific technical research |
| `blueprint-ui-designer` | Produce `UI-SPEC` contracts |
| `blueprint-planner` | Create plan files |
| `blueprint-checker` | Verify plan quality before execution |
| `blueprint-executor` | Execute plan tasks and produce summaries |
| `blueprint-verifier` | Verify execution results and UAT evidence |
| `blueprint-mapper` | Create codebase mapping outputs |
| `blueprint-reviewer` | Produce code review findings |
| `blueprint-fixer` | Apply targeted fixes from review output |
| `blueprint-debugger` | Run structured debugging investigations |
| `blueprint-doc-writer` | Draft repo documentation |
| `blueprint-doc-verifier` | Fact-check generated docs against the repo |
| `blueprint-ui-auditor` | Perform retroactive UI audits |
| `blueprint-security-auditor` | Verify threat mitigations and security coverage |

## Command To Agent Expectations

- `new-project` may use `blueprint-project-researcher` and `blueprint-roadmapper`.
- `map-codebase` uses `blueprint-mapper`.
- `discuss-phase` may use `blueprint-researcher` selectively.
- `research-phase` uses `blueprint-researcher`.
- `ui-phase` uses `blueprint-ui-designer`.
- `plan-phase` uses `blueprint-planner` and `blueprint-checker`.
- `execute-phase` uses `blueprint-executor`.
- `validate-phase` and `verify-work` use `blueprint-verifier`.
- `code-review` uses `blueprint-reviewer`.
- `code-review-fix` and `audit-fix` use `blueprint-fixer`.
- `debug` uses `blueprint-debugger`.
- `docs-update` uses `blueprint-doc-writer` and `blueprint-doc-verifier`.
- `ui-review` uses `blueprint-ui-auditor`.
- `secure-phase` uses `blueprint-security-auditor`.

## Non-Goals

- No attempt to mirror every upstream GSD agent one-to-one.
- No runtime-generated skills or agents in v1 planning.
- No hidden support commands for omitted features.
