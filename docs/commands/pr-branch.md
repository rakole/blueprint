# `/blu-pr-branch`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `high-risk-maintenance` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the pre-mutation posture explicit throughout the run: resolved scope must stay tied to the source branch, base branch, candidate review branch, filtered include or exclude decision, and digest-backed evidence; pending gates stay limited to `clean-working-tree`, `review-branch-confirmation`, and report overwrite confirmation when those gates are triggered; execution mode should reflect preview-only versus confirmed review-branch preparation; and the next safe action should stay visible while the command is waiting on cleanup, approval, or manual follow-through.
- Detailed contract: `skills/blueprint-maintenance/references/pr-branch-runtime-contract.md`


## Purpose


`pr-branch` is Blueprint's command for create a clean PR branch by filtering out implementation-bookkeeping commits before code review. Blueprint now ships it as a confirmation-gated, report-backed review-branch preparation flow that keeps git mutations explicit, preserves the source branch, and makes `.blueprint/` inclusion or exclusion reviewable before branch creation.


## Command Path And Examples

- CLI command path: `/blu-pr-branch`
- Root router form: `/blu pr-branch`
- Argument hint: `[target branch, default: main]`
- `/blu-pr-branch develop`
- `/blu pr-branch`

## Inputs, Project State, And Prerequisite Artifacts


- The repo must be a git repository with a valid target base branch.
- When no explicit target is provided, the command should prefer `git.base_branch` from effective config before falling back to repo detection.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- In-flight pr-branch work should keep the resolved scope, active stage, pending gate, execution mode, report-backed pre-mutation posture, and next safe action legible while the run is still live.


## Blueprint And Global State Reads


- `.blueprint/config.json`


## Blueprint And Global State Writes


- `git branch state`
- `.blueprint/reports/pr-branch-latest.md`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`

## Digest And Report Contract

- Pass only repo-relative `artifactPaths` and `trackedFiles` to `blueprint_artifact_summary_digest`.
- Treat the returned `inputsUsed` list as the authoritative digest scope instead of widening the filtered branch evidence after the tool returns.
- Read `report.pr-branch` through `blueprint_artifact_contract_read` before drafting the saved report.
- Use `contract.authoringTemplate` as the heading and schema authority for `pr-branch-latest`.
- Persist the durable report through `blueprint_artifact_report_write` with the bare report name `pr-branch-latest`, not a `.blueprint/reports/...` path.
- Treat the returned report `path` as authoritative.

## Commit Classification And Replay Contract

- Analyze commits ahead of the base branch before confirmation.
- Classify each commit as `code-only`, `blueprint-only`, `mixed`, or `empty-after-filter`.
- Preview the commit SHA, subject, touched paths, filtered paths, include/exclude/skip action, and reason before mutation.
- Exclude `.blueprint/**` commits by default when `planning.commit_docs` is true unless the user explicitly asks to keep Blueprint artifacts.
- Replay retained commits in source order, preserve commit messages when using commit replay, and strip excluded `.blueprint/**` paths from mixed commits before committing on the review branch.
- Validate the created review branch with clean status, retained file count, retained commit count, and zero excluded `.blueprint/**` entries when filtering is active.
- Return to the source branch after validation unless the user explicitly asks to stay on the review branch.


## Skills And Subagents


- Primary skill: `blueprint-maintenance`
- Optional subagents: none
- No-subagent fallback is canonical for this workflow. A suitable code-analysis sidecar may provide read-only advisory notes on the candidate file list only when the user asks for extra risk review; browser, web-search-only, shell-only, and generic agents are not substitutes.


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/execute-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- High: git branch mutation.

## Risk Notes


- PR branch preparation must make the `.blueprint/` history treatment explicit so users understand what is intentionally excluded from the review branch.
- Branch creation must never discard local work that does not match the filtered PR shape.
- If filtering produces an unexpectedly empty diff, the command should stop and explain why before creating noise branches.
- Base-branch and commit-docs behavior should come from normalized effective config rather than a second branch-detection path inside the command.
- The command should stop on a dirty working tree instead of mixing uncommitted changes into the review-branch replay path.
- The command should also name the resolved source branch, base branch, filtered target, pending gate, and next safe action explicitly before mutation so preflight validation is reviewable.
- Mixed commits should stay reviewer-friendly: non-Blueprint changes are retained, excluded `.blueprint/**` paths are restored or removed before the replay commit, and the report records what was filtered.


## User Prompts And Confirmation Gates


- Always confirm the target base branch and filtered commit scope.
- Confirm report replacement before overwriting `.blueprint/reports/pr-branch-latest.md`.
- When the repo is dirty, the command should stop in a visible `clean-working-tree` waiting state instead of implying that branch creation can continue.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated reports when git or external CLI steps fail.
- Fall back to explicit file selection or manual shipping guidance instead of guessing.
- Leave the repo, workspace registry, and patch registry unchanged when a preflight check fails.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Never executes git, workspace, patch, or cleanup mutation without an explicit confirmation gate.
- Preserves the source branch and records the created review branch plus filtered scope in `.blueprint/reports/pr-branch-latest.md`.
- Honors normalized `git.base_branch`, `git.branching_strategy`, and `planning.commit_docs` when preparing a review branch.
- Keeps the report-backed pre-mutation posture, pending gates, and the next safe action explicit while the command is waiting on cleanup, confirmation, or report overwrite approval.
- Records a commit classification ledger and post-create verification evidence in the durable report.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Base-branch-from-config fixture.
- Direct `pr-branch` happy-path fixture.
