# `/blu-code-review`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Review source files changed during a phase for bugs, security issues, and code quality problems |


## Purpose


`code-review` carries forward the GSD intent to review source files changed during a phase for bugs, security issues, and code quality problems. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-code-review`
- Compatibility during this release: `/blu:code-review` (deprecated; remove next release)
- Root router form: `/blu code-review`
- Argument hint: `<phase-number> [--depth=quick|standard|deep] [--files file1,file2,...]`
- `/blu-code-review 3 --depth=deep`
- `/blu code-review`

## Inputs, Project State, And Prerequisite Artifacts


- Executed phase artifacts or an explicit file scope must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `phase XX-REVIEW.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_review_scope` -> `{phase, files, reviewMode}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
- `blueprint-reviewer`


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

- Low: review artifact generation only.

## User Prompts And Confirmation Gates


- Confirm scope when automatic scoping is ambiguous.


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
- Direct `code-review` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/code-review.md`
- Upstream workflow status: GSD has an upstream workflow file
