# `/blu-ship`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


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
- Effective config should supply the default base-branch and branching behavior when the user does not override them.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


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
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


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
- Verification and review artifacts should be treated as gating evidence, not best-effort suggestions.
- Shipping should honor normalized `git.*` and `planning.commit_docs` config rather than re-deriving branch policy from git state alone.
- Shipping should stop on a dirty working tree or branch mismatch instead of guessing through uncommitted or off-scope repo state.
- Shipping should make the resolved scope, source branch, base branch, and report-before-mutate path explicit before any push or PR step is confirmed.


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
- Records the selected scope, branch plan, push or PR outcome, and manual fallback guidance in `.blueprint/reports/ship-latest.md`.
- Honors normalized `git.base_branch`, `git.branching_strategy`, and `planning.commit_docs` when building the shipping path and fallback guidance.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Branch-strategy-from-config fixture.
- Direct `ship` happy-path fixture.


