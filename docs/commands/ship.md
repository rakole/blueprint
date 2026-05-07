# `/blu-ship`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `high-risk-maintenance` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the branchy shipping posture explicit throughout the run: resolved scope must stay tied to the selected phase or milestone, source branch, base branch, digest-backed evidence, and requested remote actions; pending gates stay limited to `clean-working-tree`, shipping confirmation, report overwrite confirmation, and visible `gh-unavailable` or auth fallback states when those gates are triggered; execution mode should reflect preview-only versus confirmed local prep plus optional push and optional PR creation; and the next safe action should stay visible while the command is waiting on approval, fallback handling, or manual follow-through.


## Purpose


`ship` is Blueprint's command for create PR, run review, and prepare for merge after verification passes. In Blueprint it now ships as a confirmation-gated, report-backed maintenance flow that reuses saved verification and review evidence, keeps push and PR creation explicit, and leaves a durable manual fallback when GitHub automation is unavailable.


## Command Path And Examples

- CLI command path: `/blu-ship`
- Root router form: `/blu ship`
- Argument hint: `[phase number or milestone, e.g., '4' or 'v1.0']`
- `/blu-ship 3 --draft`
- `/blu ship`

## Inputs, Project State, And Prerequisite Artifacts


- Verification should already be complete and a target branch strategy should be clear.
- When `workflow.code_review` is true and saved execution evidence includes reviewable repo/source files, `XX-REVIEW.md` and `XX-SECURITY.md` must both exist before shipping can proceed.
- Effective config should supply the default base-branch and branching behavior when the user does not override them.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- In-flight shipping work should keep the resolved scope, active stage, pending gate, execution mode, branchy remote-action posture, and next safe action legible while the run is still live.


## Blueprint And Global State Reads


- `.blueprint/config.json`
- selected phase artifacts and saved reports under `.blueprint/phases/` and `.blueprint/reports/`


## Blueprint And Global State Writes


- `.blueprint/reports/ship-latest.md`
- `.blueprint/STATE.md` when the next safe action changes after shipping
- `git and remote state when shipping proceeds`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Digest And Report Contract

- Pass only repo-relative `artifactPaths` and `trackedFiles` to `blueprint_artifact_summary_digest`.
- Treat the returned `inputsUsed` list as the authoritative digest scope instead of widening shipping evidence after the tool returns.
- Read `blueprint_artifact_contract_read` for `report.ship` before report persistence and use `contract.authoringTemplate` as the canonical `ship-latest` report authority.
- Persist the approved shipping plan through `blueprint_artifact_report_write` with the bare report name `ship-latest`, not a `.blueprint/reports/...` path, before any approved push or PR step begins.
- After the approved push or PR attempt finishes, overwrite `ship-latest` through `blueprint_artifact_report_write` so the durable report captures the actual outcomes, fallback notes, and post-mutation evidence.
- Treat the returned report `path` as authoritative.

## In-Flight Progress Contract

- For non-trivial shipping runs, keep the shared stage vocabulary visible only for the stages the run actually reaches.
- For non-trivial shipping runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact shipping checklist with `write_todos`.
- Keep that visible progress aligned to the resolved scope, active stage, pending gate, execution mode, draft-versus-ready posture, requested push or PR steps, actual remote outcome, report status, and next safe action as the run moves from shipping preflight through confirmation, optional push, optional PR creation, report persistence, validation, and routing.
- Typical pending gates include dirty-tree cleanup, shipping confirmation, `ship-latest` overwrite approval, and `gh` availability or authentication fallback decisions.
- Execution mode should distinguish preview-only versus confirmed local prep, optional push, optional PR creation, and manual-fallback-only outcomes.
- Treat `update_topic` and `write_todos` as session-local visibility only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.

## Tracker Eligibility

- Branchy shipping work is tracker-eligible when the run splits across local preparation, remote checks, optional push, optional PR creation, manual fallback preparation, and post-ship routing while still fitting the bounded `ship` contract.
- Tracker use is session-local coordination only and must be paired with visible `write_todos`; it does not replace Blueprint MCP persistence.
- Tracker-backed coordination must not create a hidden saved plan, summary artifact, or shipping record outside `ship-latest`.
- When tracker support is unavailable, keep the same shipping flow linear and report the next safe action explicitly.


## Skills And Subagents


- Primary skill: `blueprint-maintenance`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/verify-work.md`
- `docs/commands/code-review.md`
- `docs/commands/secure-phase.md`
- `docs/commands/pr-branch.md`


## External Shell Or Git Dependencies


- External dependencies:
- git
- gh when available


## Shell Risk Profile

- High: remote and git mutation path.

## Risk Notes


- Shipping must separate local preparation, optional push, and optional PR creation so there is no implicit remote mutation chain.
- If `gh` is missing or unauthenticated, the command should still produce a durable manual PR checklist and draft body.
- Verification, UAT, review, and security artifacts should be treated as gating evidence, not best-effort suggestions.
- If post-UAT review/security gates are required but missing, shipping should route to `/blu-code-review <phase>` before review exists, `/blu-secure-phase <phase>` before security exists, or the saved review next safe action when `XX-REVIEW.md` has open findings.
- When `workflow.code_review` is false, shipping may use the previous verification/UAT-ready behavior without adding review/security prerequisites.
- Shipping should honor normalized `git.*` and `planning.commit_docs` config rather than re-deriving branch policy from git state alone.
- Shipping should stop on a dirty working tree or branch mismatch instead of guessing through uncommitted or off-scope repo state.
- Shipping should make the resolved scope, source branch, base branch, and report-before-mutate path explicit before any push or PR step is confirmed.
- Shipping should overwrite the saved report after remote attempts so `ship-latest` reflects the actual push or PR outcome instead of only the pre-mutation plan.
- Tracker-backed coordination must remain session-local and must never replace the durable `ship-latest` report or MCP-owned state updates.


## User Prompts And Confirmation Gates


- Confirm draft versus ready state, the exact push and PR steps to run, and fallback behavior when `gh` is unavailable.
- Confirm report replacement before overwriting `.blueprint/reports/ship-latest.md`.


## Edge Cases


- The repo may be ready for a draft PR but not a ready-for-review PR because verification or review artifacts are incomplete.
- GitHub CLI may be present without valid auth, requiring a manual PR checklist rather than a failed implicit push.
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
- Records the selected scope, branch plan, approved push or PR actions, actual remote outcomes, and manual fallback guidance in `.blueprint/reports/ship-latest.md`.
- Honors normalized `git.base_branch`, `git.branching_strategy`, and `planning.commit_docs` when building the shipping path and fallback guidance.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Branch-strategy-from-config fixture.
- Direct `ship` happy-path fixture.
