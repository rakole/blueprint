# `/blu-code-review-fix`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Upstream GSD intent | Auto-fix issues found by code review in REVIEW.md. Spawns fixer agent, commits each fix atomically, produces REVIEW-FIX.md summary. |


## Purpose


`code-review-fix` carries forward the GSD intent to auto-fix issues found by code review in REVIEW.md. Spawns fixer agent, commits each fix atomically, produces REVIEW-FIX.md summary.. In Blueprint it should stay Gemini-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later.


## Command Path And Examples

- Gemini command path: `/blu-code-review-fix`
- Compatibility during this release: `/blu:code-review-fix` (deprecated; remove next release)
- Root router form: `/blu code-review-fix`
- Argument hint: `<phase-number> [--all] [--auto]`
- `/blu-code-review-fix 3 --auto`
- `/blu code-review-fix`

## Inputs, Project State, And Prerequisite Artifacts


- A matching XX-REVIEW.md must already exist.


## Outputs


- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.


## Blueprint And Global State Reads


- none


## Blueprint And Global State Writes


- `phase XX-REVIEW-FIX.md`
- `code changes`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_review_load_findings` -> `{findings, severityCounts}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`
- `blueprint_state_update` -> `{updatedFields, statePath}`


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
- `blueprint-fixer`
- `blueprint-reviewer`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/code-review.md`


## External Shell Or Git Dependencies


- External dependencies:
- git


## Shell Risk Profile

- High: automated fixes plus optional iteration loop.

## User Prompts And Confirmation Gates


- Confirm the selected findings before applying fixes.


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
- Direct `code-review-fix` happy-path fixture.


## Upstream Reference


- Upstream command file: `commands/gsd/code-review-fix.md`
- Upstream workflow status: GSD has an upstream workflow file
