# `/blu-add-tests`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Generate tests for a completed phase based on UAT criteria and implementation |


## Purpose


`add-tests` carries forward the GSD intent to generate tests for a completed phase based on UAT criteria and implementation. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-add-tests`
- Compatibility during this release: `/blu:add-tests` (deprecated; remove next release)
- Root router form: `/blu add-tests`
- Argument hint: `<phase> [additional instructions]`
- `/blu-add-tests 3`
- `/blu add-tests`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase should already have UAT or verification signals.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `new or updated test files in the repo`
- `verification notes in XX-VERIFICATION.md`
- `test-generation report in .blueprint/reports/`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-phase-validation`
- Optional subagents:
- `blueprint-executor`
- `blueprint-verifier`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/verify-work.md`


## External Shell Or Git Dependencies


- External dependencies:
- project test runners


## Shell Risk Profile

- High: repo code mutation plus verification updates.

## User Prompts And Confirmation Gates


- Confirm test scope when the request is broad.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated reports when git or external CLI steps fail.
- Fall back to explicit file selection or manual shipping guidance instead of guessing.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `add-tests` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/add-tests.md`
- Upstream workflow status: GSD has an upstream workflow file
