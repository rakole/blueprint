# Undo Runtime Contract

This reference is the detailed `/blu-undo` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, MCP tools own Blueprint persistence, and git mutation remains revert-style and confirmation-gated.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_project_status` first. Route to `/blu-new-project` when uninitialized and `/blu-health` when partial or unhealthy.
- Resolve the undo scope explicitly from a named phase, named plan, or bounded recent commit request.
- When a phase or plan is named, call `mcp_blueprint_blueprint_phase_locate`; stop if it cannot anchor the target.
- Resolve candidates to canonical full hashes, but defer `mcp_blueprint_blueprint_undo_preview` until artifact discovery and digest have produced the non-empty authoritative evidence input set.

### Read

- Treat preview blockers as authoritative. Dirty tree, detached HEAD, merge/rebase/cherry-pick/revert/sequencer state, malformed or missing targets, non-ancestors, roots, duplicates, incomparable candidates, and merges without valid mainline are hard stops.
- Call `mcp_blueprint_blueprint_artifact_list` for summaries, verification or UAT artifacts, review artifacts, shipping reports, and related stale-evidence signals.
- Call `mcp_blueprint_blueprint_artifact_summary_digest` with explicit `artifactPaths` and relevant `trackedFiles`.
- Call `mcp_blueprint_blueprint_artifact_contract_read` for `report.undo` before report persistence.
- Call `mcp_blueprint_blueprint_undo_preview` after these reads with the authoritative digest input paths. Its packet binds effective git config, prior report existence/content, durable idempotency, and evidence receipts.

### Decide

- Preview canonical repository identity, branch and HEAD, exact candidate ledger, dependency-impact notes, evidence receipts, `undo-latest`, operation id, fingerprint, and runtime-derived argv.
- State that Blueprint undo uses safe `git revert` style steps only.
- Require explicit confirmation and surface `undo-confirmation` until approved.
- If replacing `undo-latest` needs approval, surface `report-overwrite-confirmation`.

### Execute

- Call `mcp_blueprint_blueprint_undo_execute` once with the approved operation id, fingerprint, and `confirmed: true`.
- The executor consumes approval, immediately revalidates, and runs only literal `git revert --no-edit <full-sha>` or `git revert --no-edit -m <parent> <full-sha>` argv.
- Never auto-resolve, continue, abort, reset, clean, retry, or author shell commands. Preserve exact exit/stdout/stderr, observed HEAD, conflicts, sequencer state, and manual recovery choices.

### Persist

- The executor persists its canonical approved-plan report before the first revert argv.
- The executor overwrites `undo-latest` from the structured actual receipt after the attempt. If that persistence fails after git succeeds, return overall `partial` without retrying git.
- The executor applies an optional packet-bound state patch only after every revert and the actual-outcome report succeed. A state failure is partial and recovery retries only state persistence.
- Use `mcp_blueprint_blueprint_undo_persist` for fingerprint-bound report-only or state-only recovery. It must never run git and must refresh the durable report with final state persistence success or failure.

### Validate

- Verify final branch state, revert outcome, saved report path, and any stale evidence or conflict warnings.
- Treat the structured preview and execution receipts as authoritative. Successful reruns are `already-applied`; consumed, drifted, or replayed approvals fail closed.

### Route

- Prefer `/blu-progress`, `/blu-validate-phase`, `/blu-verify-work`, `/blu-code-review`, `/blu-pr-branch`, or manual conflict resolution when appropriate.
- Keep the next safe action explicit in blocked, partial, failed, stale, and successful receipts.
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
- `mcp_blueprint_blueprint_undo_preview`
- `mcp_blueprint_blueprint_undo_execute`
- `mcp_blueprint_blueprint_undo_persist`
