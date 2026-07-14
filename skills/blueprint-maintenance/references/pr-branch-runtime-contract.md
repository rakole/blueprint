# PR Branch Runtime Contract

This reference is the detailed `/blu-pr-branch` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, and MCP owns deterministic planning, freshness-bound confirmation, git mutation, truthful report persistence, and persistence-only recovery.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_project_status` first.
- Stop and route to `/blu-new-project` when Blueprint is uninitialized.
- Stop and route to `/blu-health` when health is partial or unhealthy.
- Call `mcp_blueprint_blueprint_config_get` with effective scope before deriving branch policy.
- Resolve the base branch from explicit user input, then normalized `git.base_branch`, then safe repo detection.
- The deterministic boundary accepts only a local branch, tag, or exact commit as base authority. It rejects remote-tracking refs rather than omitting remote name, URL, and ref from the approval packet.
- Resolve the source branch, source `HEAD`, candidate review branch name, `git.branching_strategy`, and `planning.commit_docs`.
- Refuse to run from the base branch itself unless the user explicitly supplied a different source branch to inspect.

### Read

- Inspect `git status --short --branch` before any mutation. A dirty tree is a hard stop with pending gate `clean-working-tree`.
- Count commits ahead of the base branch and stop when there is nothing to filter.
- After artifact discovery and digest creation, call `mcp_blueprint_blueprint_pr_branch_preview`; do not author git inspection or mutation argv in the host.
- Classify each commit:
  - `code-only`: touches no `.blueprint/**` files.
  - `blueprint-only`: touches only `.blueprint/**` files.
  - `mixed`: touches `.blueprint/**` plus non-Blueprint repo files.
  - `empty-after-filter`: replayed commit has no staged changes after excluded paths are restored.
- Default excluded bookkeeping scope is `.blueprint/**` when `planning.commit_docs` is true, unless the user explicitly asks to keep Blueprint artifacts. When `planning.commit_docs` is false, do not invent `.blueprint/**` commits that are not already in the branch diff.
- Call `mcp_blueprint_blueprint_artifact_summary_digest` with explicit repo-relative `artifactPaths` and changed-file `trackedFiles`. Treat `inputsUsed` as the authoritative evidence digest scope.
- Call `mcp_blueprint_blueprint_artifact_contract_read` for `report.pr-branch`. Use `contract.authoringTemplate` as the report heading/schema authority before persistence.

### Decide

- Preview the runtime packet's canonical repo/common-dir, exact source/base/merge-base OIDs, safe source and candidate refs, effective Blueprint config and Git config receipts, exact filtered final path/tree receipt, commit/path ledger, evidence/report receipts, and typed internal argv plan.
- If filtering produces an empty diff, stop before branch creation and explain which commits or paths were filtered out.
- Require explicit confirmation before branch creation or replay. While waiting, surface pending gate `review-branch-confirmation`.
- If `.blueprint/reports/pr-branch-latest.md` already exists, require explicit overwrite confirmation before replacing it and surface pending gate `report-overwrite-confirmation`.

### Execute

- Execute only once through `mcp_blueprint_blueprint_pr_branch_execute` after confirmation of the exact operation id and fingerprint.
- Preserve the source branch. Never rewrite, delete, reset, or force-push it.
- Create the review branch from the resolved base branch.
- Replay included commits in source order. Preserve commit messages when commit replay is used.
- For mixed commits, restore or remove excluded `.blueprint/**` paths from both the index and review-branch working tree before committing, so the review branch diff stays clean.
- The executor immediately revalidates all bound state, consumes the approval, records exact process and required validation receipts, requires every replay to advance HEAD when it creates a commit, compares exact retained path/tree and commit mapping/count outcomes, verifies literal source restoration, never auto-resolves, and returns a partial/conflict/restoration receipt without deleting or overwriting either branch.

### Persist

- The executor renders the approved pre-mutation report and actual outcome report from its structured packet and receipt.
- The report must include:
  - base branch, source branch, source `HEAD`, candidate and created review branch
  - config inputs used for branch policy
  - commit classification ledger with include/exclude/skip action and reason
  - included and excluded repo-relative paths
  - digest `inputsUsed`
  - exact verification commands and results
  - recovery notes or `none`
  - next safe action
- A post-mutation report failure is partial; retry only `mcp_blueprint_blueprint_pr_branch_persist` with the receipt-bound operation id/fingerprint. It never re-enters git.
- If runtime-rendered report persistence is rejected, stop before mutation for the approved-plan report or return partial after mutation for the outcome report; never replace it with model-authored facts.

### Validate

- Verify the review branch after replay:
  - `git status --short` is clean on the review branch before returning or finalizing.
  - `git diff --name-only <base>..<review> -- .blueprint` returns zero entries when `.blueprint/**` was excluded.
  - `git diff --name-only <base>..<review>` has at least one retained file.
  - `git rev-list --count <base>..<review>` matches the retained replay outcome, allowing skipped `empty-after-filter` commits.
- Return to the source branch after validation unless the user explicitly requested to stay on the review branch.
- Treat the saved report path and status returned by `artifact_report_write` as authoritative.

### Route

- End with the created review branch, base branch, source branch, filtered scope, report status, and next safe action.
- Prefer manual push or PR guidance such as `git push origin <review-branch>` and an explicit `gh pr create` example when appropriate.
- Route back to `/blu-progress` for Blueprint follow-up. Do not present planned-only commands as runnable.

## Subagent And Fallback Rules

- Default path: no subagent. The parent command owns git preflight, commit classification, confirmation, replay, verification, report authoring, and persistence.
- Capability-gated read-only sidecar: when a suitable code-analysis subagent is available and the user asks for extra risk review before confirmation, it may inspect only the candidate included/excluded file list and return advisory notes. It must not classify commits, run git mutation, author the final report, or call Blueprint persistence tools.
- Browser, web-search-only, shell-only, and generic agents are forbidden as substitutes for repo/workflow analysis.
- No-subagent fallback is the canonical behavior: process one commit at a time, keep a compact carry-forward ledger, and summarize included/excluded counts after each stage.

## Output Quality Criteria

- The preview and final response include concrete counts, branch names, commit classifications, clean branch state, retained file/commit counts, path sets, digest inputs, pending gate, execution mode, and next safe action.
- The durable report is useful to a reviewer without chat history.
- Uncertainty is explicit: missing base branch, missing diff, unexpected merge commits, skipped conflicts, empty filtered diff, or unverified branch state are blockers or warnings, not silent success.
- The workflow never hides git mutation behind vague phrasing such as "prepare branch"; it names the intended commands before confirmation and the actual verification after execution.

## Completion Criteria

- Blueprint project health was checked.
- Effective branch config was read.
- Dirty tree and empty diff blockers were handled before mutation.
- Commit classification ledger was previewed.
- User confirmation cleared before git mutation.
- Source branch was preserved and restored unless the user chose otherwise.
- Review branch diff contains retained non-Blueprint scope and no excluded `.blueprint/**` files when filtering is active.
- `pr-branch-latest` was written or a report-write blocker was surfaced honestly.
