# `/blu-undo`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`undo` is Blueprint's command for safe git revert. In Blueprint it now ships as a confirmation-gated, report-backed maintenance flow that previews the revert scope first, makes dependency impact explicit, and limits git mutation to safe `git revert` style steps instead of destructive history rewrites.


## Command Path And Examples

- CLI command path: `/blu-undo`
- Root router form: `/blu undo`
- Argument hint: `--last N | --phase NN | --plan NN-MM`
- `/blu-undo --phase 03`
- `/blu undo`

## Inputs, Project State, And Prerequisite Artifacts


- The repo must be a git repository with recoverable commit history.
- A clean working tree and a non-detached branch are required before any revert runs.
- Replacing an existing undo report requires explicit overwrite confirmation.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- `.blueprint/STATE.md` when current phase or next action context is needed
- selected phase artifacts and saved reports under `.blueprint/phases/` and `.blueprint/reports/`


## Blueprint And Global State Writes


- `git history through revert operations`
- `.blueprint/reports/undo-latest.md`
- `.blueprint/STATE.md` when the next safe action changes after undo


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_artifact_report_write` -> `{path, written, created, overwritten, status, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Digest And Report Contract

- Pass only repo-relative `artifactPaths` and `trackedFiles` to `blueprint_artifact_summary_digest`.
- Treat the returned `inputsUsed` list as the authoritative preview scope instead of widening revert evidence after the tool returns.
- Persist the approved undo plan through `blueprint_artifact_report_write` with the bare report name `undo-latest`, not a `.blueprint/reports/...` path.
- Treat the returned report `path` as authoritative.


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
- `docs/commands/execute-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- High: intentionally destructive history-rewrite-adjacent workflow using safe revert-style steps.

## Risk Notes


- Blueprint should plan around safe revert-style operations and explicitly avoid destructive git shortcuts such as hard reset.
- Undo targets need dependency awareness so reverting a phase does not silently invalidate later validated work.
- A dry-run summary should exist before any commit-level mutation is attempted.
- The command should show the resolved revert target set, dependency impact, and report-before-mutate path before confirmation.
- The command should stop on dirty-tree, detached-head, or in-progress-merge states instead of trying to recover implicitly.


## User Prompts And Confirmation Gates


- Always require explicit confirmation after previewing the revert set.
- Confirm report replacement before overwriting `.blueprint/reports/undo-latest.md`.


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
- Records the selected scope, candidate revert set, dependency impact, and mutation outcome in `.blueprint/reports/undo-latest.md`.
- Never uses `git reset --hard`, implicit branch deletion, or other destructive history-rewrite shortcuts.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Dirty-tree or stale-artifact fixture.
- Direct `undo` happy-path fixture.

