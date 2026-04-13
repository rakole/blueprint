# `/blu-undo`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`undo` is Blueprint's command for safe git revert. Roll back phase or plan commits using the phase manifest with dependency checks.. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-undo`
- Root router form: `/blu undo`
- Argument hint: `--last N | --phase NN | --plan NN-MM`
- `/blu-undo --phase 03`
- `/blu undo`

## Inputs, Project State, And Prerequisite Artifacts


- The repo must be a git repository with recoverable commit history.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `git history through revert operations`
- `undo report in .blueprint/reports/`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
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


## User Prompts And Confirmation Gates


- Always require explicit confirmation after previewing the revert set.


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


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `undo` happy-path fixture.


