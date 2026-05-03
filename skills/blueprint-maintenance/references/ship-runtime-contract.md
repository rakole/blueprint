# Ship Runtime Contract

This reference is the detailed `/blu-ship` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, MCP tools own Blueprint persistence, and git or remote mutation remains confirmation-gated.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_project_status` first. Route to `/blu-new-project` when uninitialized and `/blu-health` when partial or unhealthy.
- Resolve the shipping scope explicitly. If the user names a phase, call `mcp_blueprint_blueprint_phase_locate` and stop when it is missing.
- Call `mcp_blueprint_blueprint_config_get` with effective scope before deriving base branch, branching strategy, or commit-doc behavior.
- Inspect current branch, target base branch, `gh` availability, and whether the run is draft, ready, manual-only, push-only, or PR-creation mode.

### Read

- Inspect git status before mutation. A dirty working tree or missing base branch is a hard stop.
- Call `mcp_blueprint_blueprint_artifact_list` for saved verification, UAT, review, security, and latest `pr-branch` evidence.
- Call `mcp_blueprint_blueprint_artifact_summary_digest` with explicit repo-relative `artifactPaths` and relevant `trackedFiles`. Treat `inputsUsed` as authoritative.
- Call `mcp_blueprint_blueprint_artifact_contract_read` for `report.ship` before any report persistence.

### Decide

- Preview selected scope, evidence found or missing, source branch, base branch, draft or ready mode, push and PR steps, fallback behavior, and exact commands.
- Keep local prep, push, and PR creation as separate decisions.
- Require explicit confirmation before any git push or PR creation and surface the pending gate as `ship-confirmation`.
- If replacing `ship-latest` needs approval, surface `report-overwrite-confirmation`.

### Execute

- Run only the approved local prep, push, or PR commands.
- Never hide a push behind PR creation.
- If `gh` is missing, unauthenticated, or declined, skip PR creation and preserve manual fallback guidance.

### Persist

- Persist the approved plan before remote mutation through `mcp_blueprint_blueprint_artifact_report_write` with bare `reportName: "ship-latest"`.
- After approved push or PR attempts finish, overwrite `ship-latest` through the same MCP tool so the report captures actual outcomes and blockers.
- If shipping changes the next safe Blueprint action, call `mcp_blueprint_blueprint_state_update` only after the post-mutation report is written.

### Validate

- Capture post-mutation evidence: branch, push result, PR URL or manual fallback, saved report path, and remaining blockers.
- Treat the report write result path as authoritative.

### Route

- End with the selected scope, branch and PR outcome, durable report status, evidence gaps, and next safe action.
- Prefer `/blu-progress`, `/blu-code-review`, `/blu-secure-phase`, `/blu-verify-work`, `/blu-pr-branch`, or manual git/PR steps when appropriate.
- Do not present planned-only commands as runnable.

## Persistence Boundaries

- Blueprint-owned writes are limited to `.blueprint/reports/ship-latest.md` and `.blueprint/STATE.md` when routing changes.
- Git remote state and GitHub PR state may change only after explicit confirmation.
- `update_topic`, `write_todos`, and tracker state are session-local only.

## Required MCP FQNs

- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_phase_locate`
- `mcp_blueprint_blueprint_config_get`
- `mcp_blueprint_blueprint_artifact_list`
- `mcp_blueprint_blueprint_artifact_summary_digest`
- `mcp_blueprint_blueprint_artifact_contract_read`
- `mcp_blueprint_blueprint_artifact_report_write`
- `mcp_blueprint_blueprint_state_update`
