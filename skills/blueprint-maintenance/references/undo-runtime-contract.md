# Undo Runtime Contract

This reference is the detailed `/blu-undo` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, MCP tools own Blueprint persistence, and git mutation remains revert-style and confirmation-gated.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_project_status` first. Route to `/blu-new-project` when uninitialized and `/blu-health` when partial or unhealthy.
- Resolve the undo scope explicitly from a named phase, named plan, or bounded recent commit request.
- When a phase or plan is named, call `mcp_blueprint_blueprint_phase_locate`; stop if it cannot anchor the target.
- Resolve current branch, candidate commits, revert order, and saved evidence likely to become stale.

### Read

- Inspect git status before mutation. Dirty tree, detached HEAD, in-progress merge, or missing target is a hard stop.
- Call `mcp_blueprint_blueprint_artifact_list` for summaries, verification or UAT artifacts, review artifacts, shipping reports, and related stale-evidence signals.
- Call `mcp_blueprint_blueprint_artifact_summary_digest` with explicit `artifactPaths` and relevant `trackedFiles`.
- Call `mcp_blueprint_blueprint_artifact_contract_read` for `report.undo` before report persistence.

### Decide

- Preview branch, exact revert scope, candidate commits in revert order, dependency-impact notes, `undo-latest`, and exact git commands.
- State that Blueprint undo uses safe `git revert` style steps only.
- Require explicit confirmation and surface `undo-confirmation` until approved.
- If replacing `undo-latest` needs approval, surface `report-overwrite-confirmation`.

### Execute

- Run only approved safe revert-style steps.
- Never use `git reset --hard`, implicit branch deletion, or destructive shortcuts.
- Stop immediately on conflicts or dependency mismatches and keep blockers explicit.

### Persist

- Persist the approved undo plan before git mutation through `mcp_blueprint_blueprint_artifact_report_write` with bare `reportName: "undo-latest"`.
- After the revert attempt, overwrite `undo-latest` through the same MCP tool with actual outcome, conflicts, stale-evidence fallout, and next safe action.
- If a successful undo changes routing, call `mcp_blueprint_blueprint_state_update` only after the post-mutation report is written.

### Validate

- Verify final branch state, revert outcome, saved report path, and any stale evidence or conflict warnings.
- Treat MCP report write results as authoritative.

### Route

- Prefer `/blu-progress`, `/blu-validate-phase`, `/blu-verify-work`, `/blu-code-review`, `/blu-pr-branch`, or manual conflict resolution when appropriate.
- Do not present planned-only commands as runnable.

## Persistence Boundaries

- Blueprint-owned writes are limited to `.blueprint/reports/undo-latest.md` and `.blueprint/STATE.md` when routing changes.
- Git mutation is limited to confirmed revert commits.

## Required MCP FQNs

- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_phase_locate`
- `mcp_blueprint_blueprint_artifact_list`
- `mcp_blueprint_blueprint_artifact_summary_digest`
- `mcp_blueprint_blueprint_artifact_contract_read`
- `mcp_blueprint_blueprint_artifact_report_write`
- `mcp_blueprint_blueprint_state_update`
