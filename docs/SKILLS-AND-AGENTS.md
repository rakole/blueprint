# Blueprint Skills And Agents

## Shipped Skills

Primary command lists are canonical ownership metadata and must stay consistent with `docs/COMMAND-CATALOG.md` and `docs/commands/*.md`. The `Status` column here is skill-family/file rollout metadata; command-level availability remains canonical in `docs/COMMAND-CATALOG.md` and the live `blueprint_command_catalog`.

| Skill | Status | Purpose | Primary Commands |
|---|---|---|---|
| `blueprint-router` | `implemented` | Root routing, command selection, and next-step guidance | `help`, `progress`, `/blu`, `next`, `do` |
| `blueprint-bootstrap` | `implemented` | Repo bootstrap and project initialization | `new-project` |
| `blueprint-governance` | `implemented` | Config, profile, health, and handoff flows | `settings`, `set-profile`, `health`, `pause-work`, `resume-work` |
| `blueprint-map` | `implemented` | Brownfield codebase mapping | `map-codebase` |
| `blueprint-phase-discovery` | `implemented` | Pre-planning discovery and requirements shaping | `discuss-phase`, `research-phase`, `ui-phase`, `list-phase-assumptions` |
| `blueprint-phase-planning` | `implemented` | Plan synthesis, plan checks, and phase plan persistence | `plan-phase` |
| `blueprint-phase-execution` | `implemented` | Plan execution and summary generation | `execute-phase`, `quick`, `fast` |
| `blueprint-phase-validation` | `implemented` | Verification, UAT, tests, and gap closure | `validate-phase`, `verify-work`, `add-tests` |
| `blueprint-roadmap-admin` | `implemented` | Roadmap append plus future roadmap and milestone mutations | `add-phase`, `insert-phase`, `remove-phase`, `plan-milestone-gaps`, `audit-milestone`, `complete-milestone`, `milestone-summary`, `new-milestone` |

## Planned Later Skills

| Skill | Status | Purpose | Primary Commands |
|---|---|---|---|
| `blueprint-capture` | `planned` | Notes, todos, backlog, ideation routing | `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `explore` |
| `blueprint-debug` | `planned` | Debug investigations and recovery plans | `debug` |
| `blueprint-review` | `planned` | Reviews, review-fix loops, security, UI, peer review | `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `ui-review`, `review` |
| `blueprint-docs` | `planned` | Documentation generation and verification | `docs-update` |
| `blueprint-maintenance` | `planned` | Git, workspace, cleanup, update, and patch operations | `pr-branch`, `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `update`, `reapply-patches` |

## Shipped Agent Contracts

| Agent | Status | Purpose |
|---|---|---|
| `blueprint-project-researcher` | `implemented` | Gather initial repo and product context during `new-project` |
| `blueprint-roadmapper` | `implemented` | Build roadmap candidates and milestone structure |
| `blueprint-mapper` | `implemented` | Create codebase mapping outputs |
| `blueprint-planner` | `implemented` | Create plan files |
| `blueprint-checker` | `implemented` | Verify plan quality before execution |
| `blueprint-executor` | `implemented` | Execute plan tasks and produce summaries |
| `blueprint-verifier` | `implemented` | Verify execution results and UAT evidence |
| `blueprint-researcher` | `implemented` | Phase-specific technical research |
| `blueprint-ui-designer` | `implemented` | Produce `UI-SPEC` contracts |

## Planned Later Agents

| Agent | Status | Purpose |
|---|---|---|
| `blueprint-reviewer` | `planned` | Produce code review findings |
| `blueprint-fixer` | `planned` | Apply targeted fixes from review output |
| `blueprint-debugger` | `planned` | Run structured debugging investigations |
| `blueprint-doc-writer` | `planned` | Draft repo documentation |
| `blueprint-doc-verifier` | `planned` | Fact-check generated docs against the repo |
| `blueprint-ui-auditor` | `planned` | Perform retroactive UI audits |
| `blueprint-security-auditor` | `planned` | Verify threat mitigations and security coverage |

## Command To Agent Expectations

- `new-project` may use `blueprint-project-researcher` and `blueprint-roadmapper`.
- `map-codebase` uses `blueprint-mapper`.
- `next` and `do` remain router-owned and do not require dedicated subagents.
- `pause-work` and `resume-work` remain governance-owned and do not require dedicated subagents.
- `discuss-phase` may use `blueprint-researcher` selectively.
- `research-phase` uses `blueprint-researcher`.
- `ui-phase` uses `blueprint-ui-designer`.
- `list-phase-assumptions` may use `blueprint-researcher`.
- `plan-phase` uses `blueprint-planner` and `blueprint-checker`.
- `execute-phase` uses `blueprint-executor`.
- `quick` may use `blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` depending on the requested depth.
- `validate-phase` and `verify-work` use `blueprint-verifier`.
- `add-phase` uses `blueprint-roadmap-admin`.
- `plan-milestone-gaps` and `new-milestone` use `blueprint-roadmapper`.
- `code-review` uses `blueprint-reviewer`.
- `code-review-fix` and `audit-fix` use `blueprint-fixer`.
- `audit-fix` may also use `blueprint-reviewer` and `blueprint-verifier`.
- `debug` uses `blueprint-debugger`.
- `docs-update` uses `blueprint-doc-writer` and `blueprint-doc-verifier`.
- `ui-review` uses `blueprint-ui-auditor`.
- `secure-phase` uses `blueprint-security-auditor`.

## Non-Goals

- No attempt to mirror every upstream GSD agent one-to-one.
- No runtime-generated skills or agents in v1 planning.
- No hidden support commands for omitted features.
