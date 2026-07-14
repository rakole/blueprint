# Ship Runtime Contract

This reference is the detailed `/blu-ship` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, MCP tools own Blueprint persistence, and git or remote mutation remains confirmation-gated.

`mcp_blueprint_blueprint_ship_preview` is the only shipping planner and `mcp_blueprint_blueprint_ship_execute` is the only push/PR executor. The host never authors or runs git or `gh` mutation commands. Preview binds canonical repository/common-dir identity, clean attached HEAD/branch, exact local and remote base OIDs and merge base, candidate commits, the single effective fetch and push URLs plus head/base refs and OIDs, upstream, effective Blueprint and Git config receipts, canonical same-directory and directory/filename phase-prefix artifact identity, a symlink-safe all-regular-file phase inventory whose raw-byte digests and fatal-UTF-8 decoded contents feed the live quality-gate evaluator, and successful `pr-branch-latest` digest linkage, requested draft/ready posture, title/body digest, report CAS, optional state patch, and exact argv into a bounded expiring one-shot fingerprint.

Execution requires the exact operation id/fingerprint and explicit confirmation. It revalidates the phase inventory before mutation and between separate push and PR stages. It never forces, retries, shells, guesses a remote, or creates a PR after failed/unknown push. Exact already-present remote/PR state is reused; divergent state blocks. A successful push whose ref cannot still be observed at the approved HEAD is durably `outcome-unknown`, as is an unverified PR-create outcome. Initial, post-report, and final PR-view observation failures remain typed `pr-view-unavailable` with their detail and contextual fresh-preview fallback. Typed `gh` failure recovery preserves the original push and PR intent when a required push has not run, switches to a fresh `push:false`, `createPr:true` preview only when the remote was already exact or push is confirmed, and reconciles exact remote truth first for outcome-unknown push. Stale direct argv is never emitted. Outcome-report/state failure after the pre-mutation report is recovered only through `mcp_blueprint_blueprint_ship_persist`, which never re-enters external mutation.

PR creation also requires one exact `[host/]owner/repo` selector derived from and matching the approved effective push URL. Every `gh repo view`, `gh pr view`, and `gh pr create` call binds that selector with `--repo`; authentication is checked for its hostname. Multiple effective push URLs, unstable rewrite endpoints, unparseable non-GitHub push URLs, selector mismatches, and missing or mismatched upstreams hard-stop. Explicit remote selection does not waive upstream safety.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_project_status` first. Route to `/blu-new-project` when uninitialized and `/blu-health` when partial or unhealthy.
- Resolve the shipping scope explicitly. If the user names a phase, call `mcp_blueprint_blueprint_phase_locate` and stop when it is missing.
- Call `mcp_blueprint_blueprint_config_get` with effective scope before deriving base branch, branching strategy, or commit-doc behavior. Treat effective `workflow.code_review` and `workflow.secure_phase` as the shipping gate authority: `workflow.secure_phase` defaults to `false`, `/blu-secure-phase` remains manually runnable and implemented either way, and shipping must treat secure-phase only as optional readiness gating layered on top of `workflow.code_review`, not as command existence.
- Inspect current branch, target base branch, `gh` availability, and whether the run is draft, ready, manual-only, push-only, or PR-creation mode.

### Read

- Inspect git status before mutation. A dirty working tree or missing base branch is a hard stop.
- Call `mcp_blueprint_blueprint_artifact_list` for saved verification, UAT, review, security, and latest `pr-branch` evidence.
- Evaluate saved review and security evidence against the effective config before proposing shipping readiness. If `workflow.code_review=false`, security evidence is never mandatory regardless of `workflow.secure_phase`. If `workflow.code_review=true` and `workflow.secure_phase=false`, review evidence may still be mandatory while security evidence is not. If both are true, require code-review evidence first and secure-phase or security evidence after that before ready shipping.
- Call `mcp_blueprint_blueprint_artifact_summary_digest` with explicit repo-relative `artifactPaths` and relevant `trackedFiles`. Treat `inputsUsed` as authoritative.
- Call `mcp_blueprint_blueprint_artifact_contract_read` for `report.ship` before any report persistence.

### Decide

- Preview selected scope, evidence found or missing, effective `workflow.code_review` and `workflow.secure_phase` values, source branch, base branch, draft or ready mode, push and PR steps, fallback behavior, and exact commands.
- Keep draft or ready mode honest against the saved evidence and config gate evaluation. Missing config-required review or security evidence blocks ready shipping even though `/blu-secure-phase` is still manually runnable.
- Keep local prep, push, and PR creation as separate decisions.
- Require explicit confirmation before any git push or PR creation and surface the pending gate as `ship-confirmation`.
- If replacing `ship-latest` needs approval, surface `report-overwrite-confirmation`.

### Execute

- Run only the approved local prep, push, or PR commands.
- Never hide a push behind PR creation.
- If `gh` is missing, unauthenticated, or declined, skip PR creation and preserve manual fallback guidance.

### Persist

- Persist the approved plan before remote mutation through `mcp_blueprint_blueprint_artifact_report_write` with bare `reportName: "ship-latest"`.
- After approved push or PR attempts finish, overwrite `ship-latest` through the same MCP tool so the report captures actual outcomes, blockers, and the config-aware review or security gate posture.
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
- `mcp_blueprint_blueprint_ship_preview`
- `mcp_blueprint_blueprint_ship_execute`
- `mcp_blueprint_blueprint_ship_persist`
