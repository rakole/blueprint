# `/blu-pr-branch`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Create a clean PR branch by filtering out implementation-bookkeeping commits — ready for code review |


## Purpose


`pr-branch` carries forward the GSD intent to create a clean PR branch by filtering out implementation-bookkeeping commits before code review. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-pr-branch`
- Compatibility during this release: `/blu:pr-branch` (deprecated; remove next release)
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


## Blueprint And Global State Reads


- `.blueprint/config.json`


## Blueprint And Global State Writes


- `git branch state`
- `branch report in .blueprint/reports/`


## Required MCP Tools


- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`


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

- High: git branch mutation.

## Risk Notes


- PR branch preparation must make the `.blueprint/` history treatment explicit so users understand what is intentionally excluded from the review branch.
- Branch creation must never discard local work that does not match the filtered PR shape.
- If filtering produces an unexpectedly empty diff, the command should stop and explain why before creating noise branches.
- Base-branch and commit-docs behavior should come from normalized effective config rather than a second branch-detection path inside the command.


## User Prompts And Confirmation Gates


- Always confirm the target base branch and filtered commit scope.


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
- Honors normalized `git.base_branch`, `git.branching_strategy`, and `planning.commit_docs` when preparing a review branch.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Base-branch-from-config fixture.
- Direct `pr-branch` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/pr-branch.md`
- Upstream workflow status: GSD has an upstream workflow file
